// 전시 서버가 켜질 때 Pi 눈 카메라 처리 서버(EyeTracker-pi)와 브리지를 함께 켠다.
// 직원은 '전시 시작' 하나만 누르면 되고, 서버가 꺼질 때 같이 꺼진다.
const { spawn } = require('child_process');
const path = require('path');

function startEyeCompute() {
  if (process.env.EYE_COMPUTE_AUTOSTART === '0') {
    console.log('[pi-gaze] EYE_COMPUTE_AUTOSTART=0 — 처리 서버는 따로 켜야 합니다 (scripts/start-eye-compute.sh)');
    return;
  }
  const script = path.join(process.cwd(), 'scripts', 'start-eye-compute.sh');
  // 자기 프로세스 그룹으로 띄워서, 끌 때 파이썬 프로세스까지 한 번에 정리한다.
  const child = spawn('bash', [script], { detached: true, stdio: ['ignore', 'inherit', 'inherit'] });
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try { process.kill(-child.pid, 'SIGTERM'); } catch { /* 이미 꺼짐 */ }
  };
  child.on('error', (err) => console.error('[pi-gaze] 처리 서버를 켜지 못했습니다:', err.message));
  child.on('exit', (code) => {
    if (!stopped) console.error(`[pi-gaze] 처리 서버가 종료되었습니다 (code ${code}). 시선은 웹캠으로 동작합니다.`);
    stopped = true;
  });
  process.on('exit', stop);
  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
    process.on(signal, () => { stop(); process.exit(0); });
  }
}

module.exports = { startEyeCompute };
