import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useEntryFlow } from '../shared/EntryFlowContext';
import DynamicQrCode from '../shared/mobileLink/DynamicQrCode';
import { useMobileLink } from '../shared/mobileLink/MobileLinkContext';
import { buildMobileJoinUrl, getMobilePublicOriginSync } from '../shared/mobileLink/publicOrigin';
import AgentOrb from '../f2/AgentOrb';
import { sceneFor } from './districts';
import BackgroundSequence from './BackgroundSequence';
import { AGENT_BOX, cueForClip, cueLines, gazeRingState } from './jongnoCues';
import { QR_LINES } from './sequence';
import styles from './Ending.module.css';

const STAGE = { width: 3881, height: 2183 };
// 글자가 먼저 사라지고 말풍선이 뒤따라 사라지는 시간(CSS .agentLayerLeaving과 맞춤).
const AGENT_EXIT_MS = 1200;
// 피그마 종로구18: 구체 지름 약 380 → 스테이지 640. 그려지는 구체는 박스의 61%라 박스는 1045.
const FINAL_ORB = { left: (3881 - 1045) / 2, top: 478, size: 1045 };
// 말하는 동안 AgentOrb의 그라데이션을 조금 더 움직이게 하는 고정 입력값.
const SPEAKING_LEVEL = { current: 0.3 };

function bubbleBox(bubble) {
  return {
    left: bubble.left + bubble.width / 2,
    top: bubble.top,
    width: bubble.width,
    height: bubble.height,
    transform: 'translateX(-50%)',
  };
}

function lineKey(lines) {
  return lines.map((line) => line.map((part) => part.text).join('')).join('\n');
}

function CueText({ lines, className }) {
  return (
    <span className={`${styles.agentText} ${className || ''}`}>
      {lines.map((line, index) => (
        <span key={index} className={styles.agentLine}>
          {line.map((part, partIndex) => (
            part.bold
              ? <span key={partIndex} className={styles.agentStrong}>{part.text}</span>
              : <span key={partIndex}>{part.text}</span>
          ))}
        </span>
      ))}
    </span>
  );
}

// 피그마 종로구5·6의 채움 링(Subtract)과 같은 필터·그라데이션. 링 중심선 반지름 127, 두께 24.
const RING_R = 127.1;
const RING_LENGTH = 2 * Math.PI * RING_R;

function RingFill({ side, progress }) {
  const id = `jongnoRingFill${side}`;
  return (
    <svg
      className={styles.gazeRingFill}
      style={{ opacity: progress > 0.005 ? 1 : 0 }}
      viewBox="0 0 430.112 430.111"
      fill="none"
      aria-hidden
    >
      <g filter={`url(#${id}-filter)`}>
        <circle
          cx="215.548"
          cy="214.553"
          r={RING_R}
          transform="rotate(-90 215.548 214.553)"
          stroke={`url(#${id}-paint)`}
          strokeOpacity="0.2"
          strokeWidth="24.3"
          strokeLinecap="round"
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={RING_LENGTH * (1 - progress)}
          className={styles.gazeRingStroke}
        />
      </g>
      <defs>
        <filter id={`${id}-filter`} x="0" y="0" width="430.112" height="430.111" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="bg" />
          <feColorMatrix in="SourceAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="a" />
          <feGaussianBlur stdDeviation="3.78819" />
          <feComposite in2="a" operator="out" />
          <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.78 0" />
          <feBlend in2="bg" result="d1" />
          <feColorMatrix in="SourceAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="a" />
          <feGaussianBlur stdDeviation="38.0729" />
          <feComposite in2="a" operator="out" />
          <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.53 0" />
          <feBlend in2="d1" result="d2" />
          <feColorMatrix in="SourceAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="a" />
          <feGaussianBlur stdDeviation="19.0364" />
          <feComposite in2="a" operator="out" />
          <feColorMatrix values="0 0 0 0 0.986871 0 0 0 0 1 0 0 0 0 0.88747 0 0 0 0.7 0" />
          <feBlend in2="d2" result="d3" />
          <feColorMatrix in="SourceAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="a" />
          <feOffset dy="1.52292" />
          <feGaussianBlur stdDeviation="19.0364" />
          <feComposite in2="a" operator="out" />
          <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 0.743352 0 0 0 0.3 0" />
          <feBlend in2="d3" result="d4" />
          <feBlend in="SourceGraphic" in2="bg" result="shape" />
          <feColorMatrix in="SourceAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="a" />
          <feOffset dx="-1.39657" dy="-1.39657" />
          <feGaussianBlur stdDeviation="5.71093" />
          <feComposite in2="a" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.38 0" />
          <feBlend in2="shape" result="i1" />
          <feColorMatrix in="SourceAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="a" />
          <feOffset dy="3.49142" />
          <feGaussianBlur stdDeviation="4.18971" />
          <feComposite in2="a" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix values="0 0 0 0 1 0 0 0 0 0.796496 0 0 0 0 0.507305 0 0 0 0.68 0" />
          <feBlend in2="i1" result="i2" />
          <feColorMatrix in="SourceAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="a" />
          <feOffset dx="6.47239" dy="-9.13749" />
          <feGaussianBlur stdDeviation="7.42421" />
          <feComposite in2="a" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0" />
          <feBlend in2="i2" result="i3" />
          <feColorMatrix in="SourceAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="a" />
          <feOffset dx="-13.9657" />
          <feGaussianBlur stdDeviation="7.19233" />
          <feComposite in2="a" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix values="0 0 0 0 0.995426 0 0 0 0 0.806753 0 0 0 0 1 0 0 0 0.39 0" />
          <feBlend in2="i3" result="i4" />
          <feColorMatrix in="SourceAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="a" />
          <feOffset dx="7.61458" dy="7.61458" />
          <feGaussianBlur stdDeviation="19.0364" />
          <feComposite in2="a" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix values="0 0 0 0 0.651974 0 0 0 0 1 0 0 0 0 0.582369 0 0 0 1 0" />
          <feBlend in2="i4" result="i5" />
          <feColorMatrix in="SourceAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="a" />
          <feOffset dx="-11.4219" dy="-11.4219" />
          <feGaussianBlur stdDeviation="19.0364" />
          <feComposite in2="a" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix values="0 0 0 0 0.954895 0 0 0 0 0.661715 0 0 0 0 1 0 0 0 0.36 0" />
          <feBlend in2="i5" result="i6" />
          <feColorMatrix in="SourceAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="a" />
          <feOffset dy="8.72856" />
          <feGaussianBlur stdDeviation="4.27699" />
          <feComposite in2="a" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.74 0" />
          <feBlend in2="i6" result="i7" />
          <feColorMatrix in="SourceAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="a" />
          <feOffset dx="-5.71093" dy="11.4219" />
          <feGaussianBlur stdDeviation="5.71093" />
          <feComposite in2="a" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix values="0 0 0 0 0.145001 0 0 0 0 0.8575 0 0 0 0 1 0 0 0 0.49 0" />
          <feBlend in2="i7" result="i8" />
          <feBlend in="i8" in2="d4" />
        </filter>
        <linearGradient id={`${id}-paint`} x1="262.986" y1="349.517" x2="140.834" y2="-5.89581" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFEF2" stopOpacity="0.12" />
          <stop offset="0.472316" stopColor="white" stopOpacity="0.4" />
          <stop offset="1" stopColor="#32ADFF" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function GazeRing({ side, name, progress, showLabel }) {
  return (
    <div className={`${styles.gazeTarget} ${side === 'A' ? styles.gazeTargetA : styles.gazeTargetB}`}>
      <div
        className={`${styles.plantName} ${side === 'A' ? styles.plantNameA : styles.plantNameB} ${
          showLabel ? '' : styles.plantNameOff
        }`}
      >
        {name || ''}
      </div>
      <img
        className={styles.gazeRingTrack}
        src={`/5/jongno/ui/gaze-ring-${side === 'A' ? 'left' : 'right'}.svg`}
        alt=""
      />
      <RingFill side={side} progress={progress} />
    </div>
  );
}

const PLACES = ['종로구', '마포구', '강남구'];

function readStoredPlace() {
  try {
    const stored = sessionStorage.getItem('seoul-district') || '';
    return PLACES.includes(stored) ? stored : '';
  } catch {
    return '';
  }
}

export default function EndingPage() {
  const router = useRouter();
  const { selectedDistrict } = useEntryFlow();
  const { qrTargetUrl, startKioskSession, mobilePublicOrigin, plantNames } = useMobileLink();
  const viewportRef = useRef(null);
  const doneRef = useRef(false);
  const [scale, setScale] = useState(1);
  const [placeName, setPlaceName] = useState('');
  const [qrOn, setQrOn] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef(0);
  const [localUrl, setLocalUrl] = useState('');
  const [progress, setProgress] = useState({ index: 0, time: 0, duration: 0 });
  const scene = sceneFor(placeName || '종로구');
  const cue = scene.name === '종로구'
    ? cueForClip(progress.index, progress.time, progress)
    : null;
  const lines = cueLines(cue, placeName, plantNames);
  const ringState = scene.name === '종로구'
    ? gazeRingState(progress.index, progress.time, progress)
    : { visible: false, progress: 0, labels: false };

  useEffect(() => {
    const fit = () => {
      const box = viewportRef.current;
      const width = box?.clientWidth || window.innerWidth;
      const height = box?.clientHeight || window.innerHeight;
      const next = Math.max(width / STAGE.width, height / STAGE.height);
      setScale(next > 0 ? next : 1);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const queryName = typeof router.query.district === 'string' ? router.query.district : '';
    const contextName = selectedDistrict?.name || '';
    const next = [queryName, contextName, readStoredPlace()].find((item) => PLACES.includes(item)) || '종로구';
    setPlaceName(next);
  }, [router.isReady, router.query.district, selectedDistrict]);

  const finishSequence = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setLeaving(true);
    leaveTimer.current = window.setTimeout(() => setQrOn(true), AGENT_EXIT_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  useEffect(() => {
    if (!qrOn || qrTargetUrl || localUrl) return undefined;
    try {
      const id = startKioskSession(placeName ? { name: placeName } : null);
      const origin = mobilePublicOrigin || getMobilePublicOriginSync();
      setLocalUrl(buildMobileJoinUrl(id, origin));
    } catch {
      setLocalUrl('');
    }
    return undefined;
  }, [qrOn, qrTargetUrl, localUrl, placeName, startKioskSession, mobilePublicOrigin]);

  const qrUrl = qrTargetUrl || localUrl;
  const speaking = qrOn || (lines.length > 0 && !leaving);
  const orbBox = qrOn ? FINAL_ORB : AGENT_BOX;

  return (
    <div className={styles.viewport} ref={viewportRef} role="application" aria-label="엔딩">
      <div className={styles.fit} style={{ width: STAGE.width * scale, height: STAGE.height * scale }}>
      <div className={styles.stage} style={{ transform: `scale(${scale})` }}>
        {placeName ? (
          <BackgroundSequence
            key={scene.name}
            shots={scene.shots}
            onDone={finishSequence}
            onProgress={setProgress}
          />
        ) : null}
        {scene.name === '종로구' ? (
          <img
            className={`${styles.topGradient} ${qrOn ? styles.agentLayerOff : ''}`}
            src="/5/jongno/ui/top-gradient.png"
            alt=""
          />
        ) : null}
        {scene.name === '종로구' ? (
          <div className={`${styles.gazeLayer} ${ringState.visible && !qrOn ? styles.gazeLayerOn : ''}`}>
            <GazeRing
              side="A"
              name={plantNames?.A}
              progress={ringState.progress}
              showLabel={ringState.labels}
            />
            <GazeRing
              side="B"
              name={plantNames?.B}
              progress={ringState.progress}
              showLabel={ringState.labels}
            />
          </div>
        ) : null}
        <div className={`${styles.finalBackdrop} ${qrOn ? styles.finalOn : ''}`} />
        {cue || qrOn ? (
          <div
            className={`${styles.agentLayer} ${leaving ? styles.agentLayerLeaving : ''} ${
              qrOn ? styles.agentLayerFinal : ''
            }`}
          >
            <div
              className={`${styles.agentOrb} ${speaking ? styles.agentOrbSpeaking : ''}`}
              style={{
                left: orbBox.left,
                top: orbBox.top,
                width: orbBox.size,
                height: orbBox.size,
              }}
            >
              <AgentOrb
                className={styles.agentCanvas}
                agentSpeaking={speaking}
                userListening={speaking}
                userLevelRef={SPEAKING_LEVEL}
              />
            </div>
            {cue?.bubble ? (
              <div
                className={`${styles.agentBubble} ${cue.id <= 2 ? styles.agentBubbleIntro : ''}`}
                style={bubbleBox(cue.bubble)}
              >
                {lines.length ? (
                  <CueText
                    key={lineKey(lines)}
                    lines={lines}
                    className={cue.bubble.align === 'left' ? styles.agentTextLeft : ''}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className={`${styles.finalPage} ${qrOn ? styles.finalOn : ''}`}>
          <div className={styles.finalBubble}>
            <CueText lines={QR_LINES} className={styles.finalText} />
          </div>
          <div className={styles.qrFrame}>
            {qrUrl ? <DynamicQrCode url={qrUrl} alt="엔딩 QR 코드" /> : null}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
