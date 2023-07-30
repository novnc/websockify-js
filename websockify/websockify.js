#!/usr/bin/env node

// A WebSocket to TCP socket proxy
// Copyright 2012 Joel Martin
// Licensed under LGPL version 3 (see docs/LICENSE.LGPL-3)

// Known to work with node 0.8.9
// Requires node modules: ws and optimist
//     npm install ws optimist

// WEBIRC Spec based on
// https://ircv3.net/specs/extensions/webirc.html

const argv = require("optimist").argv,
    net = require("net"),
    dns = require("dns"),
    http = require("http"),
    https = require("https"),
    url = require("url"),
    path = require("path"),
    fs = require("fs"),
    mime = require("mime-types"),
    Buffer = require("buffer").Buffer,
    WebSocketServer = require("ws").Server;

const pjson = require("./package.json");

let webServer,
    wsServer,
    source_host,
    source_port,
    target_host,
    target_port,
    web_path = null,
    websocket_count = 0;

const options = {
    family: 6,
    hints: dns.ADDRCONFIG | dns.V4MAPPED,
};

// Handle new WebSocket client
new_client = function (client, req) {
    websocket_count++;
    let clientAddr = client._socket.remoteAddress,
        hostAddr = null;

    console.log(req ? req.url : client.upgradeReq.url);

    console.log(`WebSocket connection from: ${clientAddr}`);
    console.log(
        "Version " + client.protocolVersion + ", subprotocol: " + client.protocol
    );

    if (argv.record) {
        let rs = fs.createWriteStream(
            argv.record + "/" + new Date().toISOString().replace(/:/g, "_")
        );
        rs.write("let VNC_frame_data = [\n");
    } else {
        let rs = null;
    }

    dns.lookupService(
        client._socket.remoteAddress,
        client._socket.remotePort,
        function (err, hostname, service) {
            console.log(`Resolved dns: ${hostname}`);
            hostAddr = hostname;
            createConnection(client, req, rs, clientAddr, hostAddr);
        }
    );
};

function createConnection(client, req, rs, clientAddr, hostAddr) {
    let start_time = new Date().getTime();
    let log = function (msg) {
        console.log(" " + clientAddr + ": " + msg);
    };

    let target = net.createConnection(target_port, target_host, function () {
        log("connected to target");

        // If the IP address is an IPv6 address beginning with a colon, it MUST be sent with a canonically-acceptable preceding zero.

        let ipAdjusted = clientAddr.startsWith(":") ? `0${clientAddr}` : clientAddr;
        let hostAdjusted = hostAddr || ipAdjusted;

        target.write(`WEBIRC ${argv.password} ${argv.username} ${hostAdjusted} ${ipAdjusted} secure\r\n`);
    });
    // target.on("connect", (stream) => {
    // });
    target.on("data", function (data) {
        //log("sending message: " + data);

        if (rs) {
            let tdelta = Math.floor(new Date().getTime()) - start_time;
            let rsdata = "'{" + tdelta + "{" + decodeBuffer(data) + "',\n";
            rs.write(rsdata);
        }

        try {
            client.send(data);
        } catch (e) {
            log("Client closed, cleaning up target");
            target.end();
        }
    });
    target.on("end", function () {
        log("target disconnected");
        client.close();
        if (rs) {
            rs.end("'EOF'];\n");
        }
    });
    target.on("error", function () {
        log("target connection error");
        target.end();
        client.close();
        if (rs) {
            rs.end("'EOF'];\n");
        }
    });

    client.on("message", function (msg) {
        //log('got message: ' + msg);

        if (rs) {
            let rdelta = Math.floor(new Date().getTime()) - start_time;
            let rsdata = "'}" + rdelta + "}" + decodeBuffer(msg) + "',\n";
            rs.write(rsdata);
        }

        target.write(msg);
    });
    client.on("close", function (code, reason) {
        websocket_count--;
        log("WebSocket client disconnected: " + code + " [" + reason + "]");
        target.end();
    });
    client.on("error", function (a) {
        log("WebSocket client error: " + a);
        target.end();
    });
}

function decodeBuffer(buf) {
    let returnString = "";
    for (let i = 0; i < buf.length; i++) {
        if (buf[i] >= 48 && buf[i] <= 90) {
            returnString += String.fromCharCode(buf[i]);
        } else if (buf[i] === 95) {
            returnString += String.fromCharCode(buf[i]);
        } else if (buf[i] >= 97 && buf[i] <= 122) {
            returnString += String.fromCharCode(buf[i]);
        } else {
            let charToConvert = buf[i].toString(16);
            if (charToConvert.length === 0) {
                returnString += "\\x00";
            } else if (charToConvert.length === 1) {
                returnString += "\\x0" + charToConvert;
            } else {
                returnString += "\\x" + charToConvert;
            }
        }
    }
    return returnString;
}

// Send an HTTP error response
http_error = function (response, code, msg) {
    response.writeHead(code, { "Content-Type": "text/plain" });
    response.write(msg + "\n");
    response.end();
    return;
};

// Process an HTTP static file request
http_request = function (request, response) {
    if (request.url !== "/status") {
        return http_error(response, 403, "403 Permission Denied");
    }

    let status = { version: pjson.version, connections: websocket_count };
    let headers = {};
    headers["Content-Type"] = "application/json";
    response.writeHead(200, headers);
    response.write(JSON.stringify(status));
    response.end();
};

// parse source and target arguments into parts
try {
    if (!argv.username) {
        throw "username required for WEBIRC";
    }

    if (!argv.password) {
        throw "password required for WEBIRC";
    }

    source_arg = argv._[0].toString();
    target_arg = argv._[1].toString();

    let idx;
    idx = source_arg.indexOf(":");
    if (idx >= 0) {
        source_host = source_arg.slice(0, idx);
        source_port = parseInt(source_arg.slice(idx + 1), 10);
    } else {
        source_host = "";
        source_port = parseInt(source_arg, 10);
    }

    idx = target_arg.indexOf(":");
    if (idx < 0) {
        throw "target must be host:port";
    }
    target_host = target_arg.slice(0, idx);
    target_port = parseInt(target_arg.slice(idx + 1), 10);

    if (isNaN(source_port) || isNaN(target_port)) {
        throw "illegal port";
    }
} catch (e) {
    console.error(`error: ${e}`);
    console.dir(argv);
    console.error(
        "websockify.js [--web web_dir] [--cert cert.pem [--key key.pem]] [--record dir] [source_addr:]source_port target_addr:target_port"
    );
    process.exit(2);
}

console.log("WebSocket settings: ");
console.log(
    "    - proxying from " +
    source_host +
    ":" +
    source_port +
    " to " +
    target_host +
    ":" +
    target_port
);
if (argv.web) {
    console.log("    - Web server active. Serving: " + argv.web);
}

if (argv.cert) {
    argv.key = argv.key || argv.cert;
    let cert = fs.readFileSync(argv.cert),
        key = fs.readFileSync(argv.key);
    console.log(
        "    - Running in encrypted HTTPS (wss://) mode using: " +
        argv.cert +
        ", " +
        argv.key
    );
    webServer = https.createServer({ cert: cert, key: key }, http_request);
} else {
    console.log("    - Running in unencrypted HTTP (ws://) mode");
    webServer = http.createServer(http_request);
}
webServer.listen(source_port, function () {
    wsServer = new WebSocketServer({ server: webServer });
    wsServer.on("connection", new_client);
});
