## websockify-js: WebSockets support for any application/server

websockify was formerly named wsproxy and was part of the
[noVNC](https://github.com/kanaka/noVNC) project.

At the most basic level, websockify just translates WebSockets traffic
to normal socket traffic. Websockify accepts the WebSockets handshake,
parses it, and then begins forwarding traffic between the client and
the target in both directions.

Note that this is the JavaScript version of websockify. The primary
project is the [Python version of
websockify](https://github.com/novnc/websockify).

To run websockify-js:

    cd websockify
    npm install
    ./websockify.js [options] SOURCE_ADDR:PORT TARGET_ADDR:PORT

### News/help/contact

Notable commits, announcements and news are posted to
<a href="http://www.twitter.com/noVNC">@noVNC</a>

If you are a websockify developer/integrator/user (or want to be)
please join the <a
href="https://groups.google.com/forum/?fromgroups#!forum/novnc">noVNC/websockify
discussion group</a>

Bugs and feature requests can be submitted via [github
issues](https://github.com/novnc/websockify-js/issues).

If you want to show appreciation for websockify you could donate to a great
non-profits such as: [Compassion
International](http://www.compassion.com/), [SIL](http://www.sil.org),
[Habitat for Humanity](http://www.habitat.org), [Electronic Frontier
Foundation](https://www.eff.org/), [Against Malaria
Foundation](http://www.againstmalaria.com/), [Nothing But
Nets](http://www.nothingbutnets.net/), etc. Please tweet <a
href="http://www.twitter.com/noVNC">@noVNC</a> if you do.

### Encrypted WebSocket connections (wss://)

To encrypt the traffic using the WebSocket 'wss://' URI scheme you need to
generate a certificate and key for Websockify to load. The `--cert=CERT` and
`--key=KEY` options are used to specify the file name for the certificate and
key. You can generate a self-signed certificate using openssl. When asked for
the common name, use the hostname of the server where the proxy will be
running:

```
openssl req -new -x509 -days 365 -nodes -out self.pem -keyout self.pem
```

For a self-signed certificate to work, you need to make your client/browser
understand it. You can do this by installing it as accepted certificate, or by
using that same certificate for a HTTPS connection to which you navigate first
and approve. Browsers generally don't give you the "trust certificate?" prompt
by opening a WSS socket with invalid certificate, hence you need to have it
acccept it by either of those two methods.

If you have a commercial/valid SSL certificate with one ore more intermediate
certificates, concat them into one file, server certificate first, then the
intermediate(s) from the CA, etc. Point to this file with the `--cert` option
and then also to the key with `--key`.


### Websock Javascript library


The `include/websock.js` Javascript library library provides a Websock
object that is similar to the standard WebSocket object but Websock
enables communication with raw TCP sockets (i.e. the binary stream)
via websockify.

Websock has built-in receive queue buffering; the message event
does not contain actual data but is simply a notification that
there is new data available. Several rQ* methods are available to
read binary data off of the receive queue.

The Websock API is documented on the [websock.js API wiki
page](https://github.com/novnc/websockify-js/wiki/websock.js).
