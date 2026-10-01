import { useEffect, useRef, useState } from 'react';
import { createFaceLandmarker } from '../shared/gaze/faceLandmarker';
import {
  PRESENCE,
  advanceHold,
  evaluateFaces,
  openCamera,
  videoInputs,
} from '../shared/gaze/usePresenceGate';
import styles from './PresenceTest.module.css';

const SLIDERS = [
  { key: 'minFaceWidth', label: '최소 얼굴 폭 (화면 대비)', min: 0.02, max: 0.3, step: 0.005, digits: 3 },
  { key: 'minRelativeWidth', label: '가장 큰 얼굴 대비 비율', min: 0, max: 1, step: 0.05, digits: 2 },
  { key: 'edgeMargin', label: '좌우 가장자리 여백', min: 0, max: 0.2, step: 0.01, digits: 2 },
  { key: 'maxYawDeg', label: '고개 좌우 허용 (°)', min: 5, max: 60, step: 1, digits: 0 },
  { key: 'pitchCenterDeg', label: '고개 위아래 기준 (°)', min: -45, max: 45, step: 1, digits: 0 },
  { key: 'maxPitchDeg', label: '고개 위아래 허용 (±°)', min: 5, max: 60, step: 1, digits: 0 },
  { key: 'graceMs', label: '끊김 허용 (ms)', min: 0, max: 3000, step: 100, digits: 0 },
  { key: 'holdMs', label: '유지 시간 (ms)', min: 1000, max: 30000, step: 500, digits: 0 },
];

const TUNABLE = SLIDERS.map((slider) => slider.key);
const PASS_BANNER_MS = 3000;

function initialConfig() {
  return Object.fromEntries(TUNABLE.map((key) => [key, PRESENCE[key]]));
}

function drawFaces(canvas, video, faces) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = Math.max(3, width / 300);
  ctx.font = `${Math.round(width / 45)}px monospace`;
  ctx.textBaseline = 'bottom';

  faces.forEach((face, index) => {
    const color = face.ok ? '#3ddc84' : '#ff5a5a';
    const x = face.minX * width;
    const y = face.minY * height;
    ctx.strokeStyle = color;
    ctx.strokeRect(x, y, (face.maxX - face.minX) * width, (face.maxY - face.minY) * height);
    ctx.fillStyle = color;
    ctx.fillText(`${index + 1} ${face.ok ? '통과' : face.reasons.join('·')}`, x, y - 6);
  });
}

export default function PresenceTest() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [config, setConfig] = useState(initialConfig);
  const configRef = useRef(config);
  configRef.current = config;

  const [devices, setDevices] = useState([]);
  const [want, setWant] = useState('');
  const [activeId, setActiveId] = useState('');
  const [status, setStatus] = useState('준비 중…');
  const [view, setView] = useState({ faces: [], kept: 0, progress: 0, fps: 0 });
  const [passes, setPasses] = useState(0);
  const [bannerUntil, setBannerUntil] = useState(0);
  const holdRef = useRef({ heldMs: 0, lastOkAt: 0 });

  useEffect(() => {
    let alive = true;
    let timer = 0;
    let stream = null;
    let landmarker = null;
    let lastTick = 0;
    let lastStamp = 0;
    let frames = 0;
    let fpsSince = performance.now();
    let fps = 0;
    const video = videoRef.current;

    const step = () => {
      if (!alive) return;
      const now = performance.now();
      const dt = lastTick ? Math.min(now - lastTick, 250) : 0;
      lastTick = now;

      if (video.readyState >= 2 && video.videoWidth) {
        const stamp = Math.max(now, lastStamp + 1);
        lastStamp = stamp;
        const cfg = { ...PRESENCE, ...configRef.current };
        const { faces, kept } = evaluateFaces(landmarker.detectForVideo(video, stamp), cfg);
        const progress = advanceHold(holdRef.current, kept.length >= cfg.people, now, dt, cfg);
        drawFaces(canvasRef.current, video, faces);

        frames += 1;
        if (now - fpsSince >= 1000) {
          fps = (frames * 1000) / (now - fpsSince);
          frames = 0;
          fpsSince = now;
        }
        setView({ faces, kept: kept.length, progress, fps });

        if (progress >= 1) {
          holdRef.current.heldMs = 0;
          setPasses((count) => count + 1);
          setBannerUntil(Date.now() + PASS_BANNER_MS);
        }
      }
      timer = window.setTimeout(step, PRESENCE.intervalMs);
    };

    (async () => {
      try {
        setStatus('카메라 여는 중…');
        const opened = await openCamera(want);
        if (!alive) {
          opened.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = opened;
        video.srcObject = stream;
        await video.play();
        setActiveId(stream.getVideoTracks()[0]?.getSettings().deviceId || '');
        setDevices(await videoInputs());

        setStatus('모델 불러오는 중…');
        const created = await createFaceLandmarker(undefined, { numFaces: PRESENCE.maxFaces });
        if (!alive) {
          created.close();
          return;
        }
        landmarker = created;
        const track = stream.getVideoTracks()[0];
        setStatus(`인식 중 · ${track?.label || '카메라'} · ${video.videoWidth}×${video.videoHeight}`);
        step();
      } catch (err) {
        if (alive) setStatus(`오류: ${err?.message || err}`);
      }
    })();

    return () => {
      alive = false;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
      landmarker?.close();
    };
  }, [want]);

  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!bannerUntil) return undefined;
    setNow(Date.now());
    const id = window.setTimeout(() => setNow(Date.now()), PASS_BANNER_MS);
    return () => window.clearTimeout(id);
  }, [bannerUntil]);
  const showBanner = bannerUntil > now;

  const seconds = (view.progress * config.holdMs) / 1000;
  const snippet = TUNABLE.map((key) => `  ${key}: ${config[key]},`).join('\n');

  return (
    <div className={styles.page}>
      <section className={styles.stage}>
        <div className={styles.frame}>
          <video ref={videoRef} className={styles.video} muted playsInline />
          <canvas ref={canvasRef} className={styles.overlay} />
          {showBanner && <div className={styles.banner}>통과 · 실제 화면이면 /1 로 이동</div>}
        </div>
        <div className={styles.meter}>
          <div className={styles.meterFill} style={{ width: `${view.progress * 100}%` }} />
          <span className={styles.meterText}>
            {seconds.toFixed(1)}s / {(config.holdMs / 1000).toFixed(0)}s
          </span>
        </div>
      </section>

      <aside className={styles.panel}>
        <h1 className={styles.title}>인원 인식 테스트</h1>
        <p className={styles.status}>{status}</p>

        <label className={styles.field}>
          <span>카메라</span>
          <select value={activeId} onChange={(event) => setWant(event.target.value)}>
            {devices.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `카메라 ${index + 1}`}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.summary}>
          <div>
            <b>{view.faces.length}</b>
            <small>감지된 얼굴</small>
          </div>
          <div className={view.kept >= PRESENCE.people ? styles.good : ''}>
            <b>{view.kept}</b>
            <small>통과 인원 (필요 {PRESENCE.people})</small>
          </div>
          <div>
            <b>{passes}</b>
            <small>통과 횟수</small>
          </div>
          <div>
            <b>{view.fps.toFixed(1)}</b>
            <small>판정 fps</small>
          </div>
        </div>

        <table className={styles.faces}>
          <thead>
            <tr>
              <th>#</th>
              <th>폭</th>
              <th>좌우°</th>
              <th>위아래°</th>
              <th>판정</th>
            </tr>
          </thead>
          <tbody>
            {view.faces.map((face, index) => (
              <tr key={index} className={face.ok ? styles.good : styles.bad}>
                <td>{index + 1}</td>
                <td>{face.width.toFixed(3)}</td>
                <td>{face.yaw.toFixed(0)}</td>
                <td>{face.pitch.toFixed(0)}</td>
                <td>{face.ok ? '통과' : face.reasons.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={styles.sliders}>
          {SLIDERS.map((slider) => (
            <label key={slider.key} className={styles.slider}>
              <span>
                {slider.label} <em>{Number(config[slider.key]).toFixed(slider.digits)}</em>
              </span>
              <input
                type="range"
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={config[slider.key]}
                onChange={(event) =>
                  setConfig((current) => ({ ...current, [slider.key]: Number(event.target.value) }))
                }
              />
            </label>
          ))}
        </div>

        <div className={styles.actions}>
          <button type="button" onClick={() => { holdRef.current.heldMs = 0; }}>
            타이머 리셋
          </button>
          <button type="button" onClick={() => setConfig(initialConfig())}>
            기본값으로
          </button>
        </div>

        <p className={styles.hint}>
          맞춘 값은 <code>src/shared/gaze/usePresenceGate.js</code> 의 <code>PRESENCE</code> 에 옮겨야 /pre_opening 에 반영됩니다.
        </p>
        <pre className={styles.snippet}>{snippet}</pre>
      </aside>
    </div>
  );
}
