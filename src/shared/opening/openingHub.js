const WebSocket = require('ws');

const WS_PATH = '/ws/opening';

/** @type {'still' | 'playing'} */
let phase = 'still';
let glassesWorn = false;

/** @type {Set<import('ws').WebSocket>} */
const displays = new Set();

function snapshot() {
  return { phase, glassesWorn };
}

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcast() {
  const payload = { type: 'opening', ...snapshot() };
  displays.forEach((ws) => send(ws, payload));
}

function setGlassesWorn(worn) {
  glassesWorn = Boolean(worn);
  if (glassesWorn && phase === 'still') {
    phase = 'playing';
  }
  broadcast();
  return snapshot();
}

function resetOpening() {
  phase = 'still';
  glassesWorn = false;
  broadcast();
  return snapshot();
}

/**
 * @param {import('ws').WebSocket} ws
 * @param {{ role: 'display' | 'glasses' }} meta
 */
function attachOpeningClient(ws, meta) {
  const role = meta.role;
  if (role !== 'display' && role !== 'glasses') {
    send(ws, { type: 'error', message: 'invalid role' });
    ws.close();
    return;
  }

  send(ws, { type: 'joined', role, ...snapshot() });

  if (role === 'display') {
    displays.add(ws);
    ws.on('close', () => displays.delete(ws));
    return;
  }

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg.type === 'glasses') setGlassesWorn(msg.worn);
    if (msg.type === 'reset') resetOpening();
  });
}

module.exports = {
  WS_PATH,
  snapshot,
  setGlassesWorn,
  resetOpening,
  attachOpeningClient,
};
