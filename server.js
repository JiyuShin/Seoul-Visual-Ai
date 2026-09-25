const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');
const { attachMobileLinkClient } = require('./src/shared/mobileLink/mobileSessionHub.js');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url);
    if (pathname === '/ws/mobile') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
      return;
    }
    socket.destroy();
  });

  wss.on('connection', (ws) => {
    let joined = false;

    ws.on('message', (raw) => {
      if (joined) return;
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'invalid json' }));
        ws.close();
        return;
      }
      if (msg.type !== 'join' || !msg.sessionId || !msg.role) {
        ws.send(JSON.stringify({ type: 'error', message: 'expected join' }));
        ws.close();
        return;
      }
      joined = true;
      attachMobileLinkClient(ws, {
        sessionId: msg.sessionId,
        role: msg.role,
        district: msg.district ?? null,
      });
    });

    ws.on('error', () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    });
  });

  server.listen(port, hostname, () => {
    // eslint-disable-next-line no-console
    console.log(`> Ready on http://${hostname === '0.0.0.0' ? 'localhost' : hostname}:${port} (WebSocket ${'/ws/mobile'})`);
  });
});
