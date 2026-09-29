const WebSocket = require('ws');

/** @typedef {'A' | 'B'} MobileSlot */
/** @typedef {{ ws: import('ws').WebSocket, role: 'kiosk' | 'mobile', slot?: MobileSlot, district?: object | null }} Peer */
/** @typedef {{ kiosk?: Peer, A?: Peer, B?: Peer }} Room */

const SLOTS = ['A', 'B'];

/** @type {Map<string, Room>} */
const rooms = new Map();

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function slotSnapshot(room) {
  return { A: Boolean(room.A?.ws), B: Boolean(room.B?.ws) };
}

function tellKiosk(sessionId) {
  const room = rooms.get(sessionId);
  if (!room?.kiosk?.ws) return;
  send(room.kiosk.ws, { type: 'slots', sessionId, slots: slotSnapshot(room) });
}

function tellMobilePaired(sessionId, slot) {
  const room = rooms.get(sessionId);
  const peer = room?.[slot];
  if (!room?.kiosk?.ws || !peer?.ws) return;
  const district = room.kiosk.district ?? null;
  send(peer.ws, { type: 'paired', sessionId, role: 'kiosk', slot, district });
  if (district) {
    send(peer.ws, { type: 'state', sessionId, payload: { district } });
  }
}

function freeSlot(room, requested) {
  if ((requested === 'A' || requested === 'B') && !room[requested]) return requested;
  return SLOTS.find((slot) => !room[slot]) || null;
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

  if (role === 'kiosk') {
    if (room.kiosk) {
      try {
        room.kiosk.ws.close();
      } catch {
        /* ignore */
      }
    }
    room.kiosk = { ws, role, district: meta.district ?? null };
    send(ws, { type: 'joined', sessionId, role });
    SLOTS.forEach((slot) => tellMobilePaired(sessionId, slot));
    tellKiosk(sessionId);
  } else {
    const slot = freeSlot(room, meta.slot);
    if (!slot) {
      send(ws, { type: 'error', message: 'room full' });
      ws.close();
      return;
    }
    room[slot] = { ws, role: 'mobile', slot };
    send(ws, { type: 'joined', sessionId, role: 'mobile', slot });
    tellMobilePaired(sessionId, slot);
    tellKiosk(sessionId);
  }

  const joinedSlot = role === 'mobile' ? room.A?.ws === ws ? 'A' : 'B' : null;

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
      if (msg.payload?.district && current.kiosk) {
        current.kiosk.district = msg.payload.district;
      }
      SLOTS.forEach((slot) => {
        if (current[slot]?.ws) {
          send(current[slot].ws, { type: 'state', sessionId, payload: msg.payload ?? {} });
        }
      });
    } else if (msg.type === 'state' && role === 'mobile' && current.kiosk?.ws) {
      send(current.kiosk.ws, {
        type: 'state',
        sessionId,
        slot: joinedSlot,
        payload: msg.payload ?? {},
      });
    }
  });

  ws.on('close', () => {
    const current = rooms.get(sessionId);
    if (!current) return;
    if (role === 'kiosk' && current.kiosk?.ws === ws) {
      delete current.kiosk;
      SLOTS.forEach((slot) => {
        if (current[slot]?.ws) {
          send(current[slot].ws, { type: 'peer_left', sessionId, role: 'kiosk' });
        }
      });
    } else if (joinedSlot && current[joinedSlot]?.ws === ws) {
      delete current[joinedSlot];
      if (current.kiosk?.ws) {
        send(current.kiosk.ws, { type: 'peer_left', sessionId, role: 'mobile', slot: joinedSlot });
        tellKiosk(sessionId);
      }
    }
    if (!current.kiosk && !current.A && !current.B) {
      rooms.delete(sessionId);
    }
  });
}

module.exports = { attachMobileLinkClient };
