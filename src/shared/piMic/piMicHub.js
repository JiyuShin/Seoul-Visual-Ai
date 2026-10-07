const http = require('http');
const WebSocket = require('ws');

// 라즈베리파이 마이크 소리(GET {PI_MIC_URL}/api/audio, 16비트 16kHz 모노 PCM)를 받아 브라우저에 중계한다.
// 브라우저는 같은 출처의 웹소켓만 열면 되므로 Pi 주소는 서버 설정(.env) 한 곳에만 둔다.
const WS_PATH = '/ws/pi-mic';
const RETRY_MS = 2000;
// Pi 가 이 시간 동안 아무 소리도 보내지 않으면 끊긴 것으로 보고 다시 붙는다.
const STALL_MS = 3000;

/** @type {Set<import('ws').WebSocket>} */
const clients = new Set();
let request = null;
let connected = false;
let retryTimer = null;
let stallTimer = null;
let carry = null;

// .env 는 next 가 준비되면서 읽히므로, 모듈을 불러올 때가 아니라 쓸 때마다 읽는다.
function config() {
  return {
    url: (process.env.PI_MIC_URL || '').replace(/\/+$/, ''),
    // always: Pi 연결을 계속 유지 / ondemand: 듣는 브라우저가 있을 때만 연결 (Pi 의 --mic-idle stop 과 짝)
    mode: process.env.PI_MIC_MODE === 'ondemand' ? 'ondemand' : 'always',
  };
}

function status() {
  const { url, mode } = config();
  return { type: 'status', configured: Boolean(url), connected, mode };
}

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function setConnected(next) {
  if (connected === next) return;
  connected = next;
  // eslint-disable-next-line no-console
  console.log(`[pi-mic] ${next ? '연결됨' : '끊김'}: ${config().url}`);
  clients.forEach((ws) => send(ws, status()));
}

function wanted() {
  const { url, mode } = config();
  return Boolean(url) && (mode === 'always' || clients.size > 0);
}

function drop() {
  clearTimeout(stallTimer);
  clearTimeout(retryTimer);
  retryTimer = null;
  const req = request;
  request = null;
  carry = null;
  if (req) req.destroy();
  setConnected(false);
}

function scheduleRetry() {
  if (retryTimer || !wanted()) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    connect();
  }, RETRY_MS);
}

function armStall(req) {
  clearTimeout(stallTimer);
  stallTimer = setTimeout(() => req.destroy(new Error('stalled')), STALL_MS);
}

function onAudio(chunk) {
  // 샘플(2바이트)이 조각 경계에서 잘리지 않게 홀수 바이트는 다음 조각 앞에 붙인다.
  let data = carry ? Buffer.concat([carry, chunk]) : chunk;
  carry = null;
  if (data.length % 2) {
    carry = data.subarray(data.length - 1);
    data = data.subarray(0, data.length - 1);
  }
  if (!data.length) return;
  clients.forEach((ws) => {
    // 밀린 브라우저에는 쌓아 두지 않는다 (소리가 점점 늦어지는 것보다 잠깐 끊기는 편이 낫다).
    if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 64 * 1024) ws.send(data, { binary: true });
  });
}

function connect() {
  if (request || !wanted()) return;
  const req = http.get(`${config().url}/api/audio`);
  request = req;
  armStall(req);
  const fail = () => {
    if (request !== req) return;
    drop();
    scheduleRetry();
  };
  req.on('response', (res) => {
    if (res.statusCode !== 200) {
      res.resume();
      fail();
      return;
    }
    res.on('data', (chunk) => {
      if (request !== req) return;
      armStall(req);
      setConnected(true);
      onAudio(chunk);
    });
    res.on('end', fail);
    res.on('error', fail);
  });
  req.on('error', fail);
}

/** 서버가 뜰 때 한 번 부른다. always 모드면 바로 Pi 에 붙는다. */
function startPiMic() {
  const { url, mode } = config();
  // eslint-disable-next-line no-console
  console.log(url ? `[pi-mic] ${url} (${mode})` : '[pi-mic] PI_MIC_URL 이 없어 Pi 마이크를 쓰지 않습니다');
  connect();
}

/** @param {import('ws').WebSocket} ws */
function attachPiMicClient(ws) {
  clients.add(ws);
  send(ws, status());
  connect();
  const leave = () => {
    if (!clients.delete(ws)) return;
    if (!wanted()) drop();
  };
  ws.on('close', leave);
  ws.on('error', leave);
}

module.exports = { WS_PATH, attachPiMicClient, startPiMic };
