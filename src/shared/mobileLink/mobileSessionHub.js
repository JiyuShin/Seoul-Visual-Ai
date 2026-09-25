const WebSocket = require('ws');

/** @typedef {{ ws: import('ws').WebSocket, role: 'kiosk' | 'mobile', district?: object | null }} Peer */
/** @typedef {{ kiosk?: Peer, mobile?: Peer }} Room */

/** @type {Map<string, Room>} */
const rooms = new Map();

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function pairSession(sessionId) {
  const room = rooms.get(sessionId);
  if (!room?.kiosk?.ws || !room?.mobile?.ws) return;

  const district = room.kiosk.district ?? null;
  send(room.kiosk.ws, { type: 'paired', sessionId, role: 'mobile' });
  send(room.mobile.ws, { type: 'paired', sessionId, role: 'kiosk', district });
  if (district) {
    send(room.mobile.ws, { type: 'state', sessionId, payload: { district } });
  }
}

/**
 * @param {import('ws').WebSocket} ws
 * @param {{ sessionId: string, role: 'kiosk' | 'mobile', district?: object | null }} meta
 */
function attachMobileLinkClient(ws, meta) {
  const { sessionId, role } = meta;
  if (!sessionId || (role !== 'kiosk' && role !== 'mobile')) {
    send(ws, { type: 'error', message: 'invalid join' });
    ws.close();
    return;
  }

  let room = rooms.get(sessionId);
  if (!room) {
    room = {};
    rooms.set(sessionId, room);
  }

  if (room[role]) {
    try {
      room[role].ws.close();
    } catch {
      /* ignore */
    }
  }

  room[role] = { ws, role, district: meta.district ?? null };

  send(ws, { type: 'joined', sessionId, role });

  pairSession(sessionId);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    const current = rooms.get(sessionId);
    if (!current) return;

    if (msg.type === 'state' && role === 'kiosk') {
      if (msg.payload?.district) {
        current.kiosk.district = msg.payload.district;
      }
      if (current.mobile?.ws) {
        send(current.mobile.ws, { type: 'state', sessionId, payload: msg.payload ?? {} });
      }
    } else if (msg.type === 'state' && role === 'mobile') {
      if (current.kiosk?.ws) {
        send(current.kiosk.ws, { type: 'state', sessionId, payload: msg.payload ?? {} });
      }
    }
  });

  ws.on('close', () => {
    const current = rooms.get(sessionId);
    if (!current) return;
    if (current[role]?.ws === ws) {
      delete current[role];
      const peerRole = role === 'kiosk' ? 'mobile' : 'kiosk';
      if (current[peerRole]?.ws) {
        send(current[peerRole].ws, { type: 'peer_left', sessionId, role });
      }
      if (!current.kiosk && !current.mobile) {
        rooms.delete(sessionId);
      }
    }
  });
}

module.exports = { attachMobileLinkClient };
