const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');
const { attachMobileLinkClient } = require('./src/shared/mobileLink/mobileSessionHub.js');
const { attachPresenceClient, WS_PATH: PRESENCE_WS_PATH } = require('./src/shared/gaze/presenceHub.js');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const handleUpgrade = app.getUpgradeHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url || '', true);
    if (pathname === '/ws/mobile') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
      return;
    }
    if (pathname === PRESENCE_WS_PATH) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.once('message', (raw) => {
          let msg;
          try {
            msg = JSON.parse(String(raw));
          } catch {
            ws.close();
            return;
          }
          if (msg.type !== 'join') {
            ws.close();
            return;
          }
          attachPresenceClient(ws, { role: msg.role });
        });
      });
      return;
    }
    handleUpgrade(req, socket, head).catch((err) => {
      console.error('Failed to handle upgrade', err);
      socket.destroy();
    });
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
