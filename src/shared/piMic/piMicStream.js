// 서버(/ws/pi-mic)가 중계하는 라즈베리파이 마이크 소리를 브라우저의 MediaStream 으로 바꾼다.
// 이 스트림을 음량 측정(AnalyserNode)과 음성 인식(SpeechRecognition.start(track))에 그대로 넣을 수 있다.
const WS_PATH = '/ws/pi-mic';
const SAMPLE_RATE = 16000;
// 네트워크 흔들림을 흡수하려고 이만큼 늦춰 재생한다.
const LEAD_S = 0.15;
// 이보다 많이 밀리면 새 조각을 버려서 지연이 쌓이지 않게 한다.
const MAX_BACKLOG_S = 0.6;
const FIRST_AUDIO_TIMEOUT_MS = 1500;
// ondemand 모드는 Pi 가 마이크를 여는 시간이 더 걸린다.
const FIRST_AUDIO_TIMEOUT_ONDEMAND_MS = 3000;
// 이어 쓰던 연결에서 이 시간 넘게 소리가 없었으면 죽은 것으로 보고 새로 연다.
const STALE_MS = 1000;
// SpeechRecognition.start(audioTrack) 은 Chrome 135 부터 된다. 그 전 버전은 인자를 무시하고 기본 마이크를 쓴다.
const MIN_CHROME = 135;

export const MIC_SOURCE = process.env.NEXT_PUBLIC_MIC_SOURCE === 'pi' ? 'pi' : 'local';

let session = null;
let users = 0;

function socketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${WS_PATH}`;
}

export function piMicSupported() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const match = /Chrome\/(\d+)/.exec(navigator.userAgent);
  return Boolean(match) && Number(match[1]) >= MIN_CHROME;
}

function closeSession() {
  const current = session;
  session = null;
  if (!current) return;
  current.closed = true;
  current.socket.close();
  current.stream.getTracks().forEach((track) => track.stop());
  void current.ctx.close();
}

function openSession() {
  const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
  const dest = ctx.createMediaStreamDestination();
  const socket = new WebSocket(socketUrl());
  socket.binaryType = 'arraybuffer';
  const current = { ctx, socket, stream: dest.stream, mode: 'always', closed: false, nextAt: 0, lastAt: 0 };

  current.ready = new Promise((resolve, reject) => {
    const fail = (reason) => {
      reject(new Error(reason));
      if (session === current) closeSession();
    };
    const onTimeout = () => fail('Pi 마이크 소리가 오지 않음');
    let timer = window.setTimeout(onTimeout, FIRST_AUDIO_TIMEOUT_MS);

    socket.addEventListener('message', (event) => {
      if (typeof event.data === 'string') {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        if (msg.type !== 'status') return;
        current.mode = msg.mode === 'ondemand' ? 'ondemand' : 'always';
        if (!msg.configured) {
          window.clearTimeout(timer);
          fail('서버에 PI_MIC_URL 이 없음');
        } else if (current.mode === 'ondemand' && !current.lastAt) {
          window.clearTimeout(timer);
          timer = window.setTimeout(onTimeout, FIRST_AUDIO_TIMEOUT_ONDEMAND_MS);
        }
        return;
      }
      const pcm = new Int16Array(event.data, 0, Math.floor(event.data.byteLength / 2));
      if (!pcm.length) return;
      window.clearTimeout(timer);
      current.lastAt = performance.now();
      resolve(current);

      const now = ctx.currentTime;
      if (current.nextAt - now > MAX_BACKLOG_S) return;
      const buffer = ctx.createBuffer(1, pcm.length, SAMPLE_RATE);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < pcm.length; i += 1) samples[i] = pcm[i] / 32768;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(dest);
      const at = Math.max(current.nextAt, now + LEAD_S);
      source.start(at);
      current.nextAt = at + buffer.duration;
    });
    socket.addEventListener('close', () => {
      window.clearTimeout(timer);
      fail('Pi 마이크 연결이 닫힘');
    });
  });
  // 실패는 acquirePiMic 에서 받는다. 받는 쪽이 없을 때 경고가 뜨지 않게 한다.
  current.ready.catch(() => {});
  void ctx.resume();
  return current;
}

/**
 * Pi 마이크 스트림을 빌린다. 소리가 실제로 들어오기 시작하면 resolve, 못 받으면 reject.
 * 다 쓰면 release() 를 부른다. 서버가 ondemand 모드면 마지막 사용자가 놓을 때 연결을 닫아 Pi 마이크가 꺼진다.
 * @returns {Promise<{ stream: MediaStream, release: () => void }>}
 */
export async function acquirePiMic() {
  if (session && session.lastAt && performance.now() - session.lastAt > STALE_MS) closeSession();
  if (!session) session = openSession();
  const current = session;
  users += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    users -= 1;
    if (users <= 0 && session === current && current.mode === 'ondemand') closeSession();
  };
  try {
    await current.ready;
  } catch (err) {
    release();
    throw err;
  }
  if (current.closed) {
    release();
    throw new Error('Pi 마이크 연결이 닫힘');
  }
  return { stream: current.stream, release };
}
