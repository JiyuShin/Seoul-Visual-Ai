import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useEntryFlow } from '../shared/EntryFlowContext';
import DynamicQrCode from '../shared/mobileLink/DynamicQrCode';
import { useMobileLink } from '../shared/mobileLink/MobileLinkContext';
import { buildMobileJoinUrl, getMobilePublicOriginSync } from '../shared/mobileLink/publicOrigin';
import AgentOrb from '../f2/AgentOrb';
// /2 토론과 같은 TTS(목소리·톤·/api/discussion-speech)를 그대로 쓴다.
import { useSpeechOutput } from '../f2/useSpeechOutput';
import { sceneFor } from './districts';
import BackgroundSequence from './BackgroundSequence';
import { AGENT_BOX, CUES, cueForShot, cueLines, gazeRingState } from './endingCues';
import { QR_LINES } from './sequence';
import styles from './Ending.module.css';

const STAGE = { width: 3881, height: 2183 };
// 글자가 먼저 사라지고 말풍선이 뒤따라 사라지는 시간(CSS .agentLayerLeaving과 맞춤).
const AGENT_EXIT_MS = 1200;
// 피그마 종로구18: 구체 지름 약 380 → 스테이지 640. 그려지는 구체는 박스의 61%라 박스는 1045.
const FINAL_ORB = { left: (3881 - 1045) / 2, top: 478, size: 1045 };
// 말하는 동안 AgentOrb의 그라데이션을 조금 더 움직이게 하는 고정 입력값.
const SPEAKING_LEVEL = { current: 0.3 };
// 한 멘트를 다 읽은 뒤 다음 멘트로 넘어가기 전에 쉬는 숨.
const SPEECH_BREATH_MS = 400;
// 음성이 이만큼 지나도 안 끝나면(재생 차단·네트워크 등) 더 기다리지 않고 연출을 이어 간다.
const SPEECH_WAIT_MAX_MS = 20000;

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

// 말풍선에 보이는 글 그대로 읽는다. 줄은 한 문장씩 이어 붙인다.
function speechText(lines) {
  return lines.map((line) => line.map((part) => part.text).join('')).join(' ').trim();
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

function GazeRing({ side, name, progress, showLabel, place }) {
  return (
    <div
      className={`${styles.gazeTarget} ${side === 'A' ? styles.gazeTargetA : styles.gazeTargetB}`}
      style={place}
    >
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
  const { qrTargetUrl, startKioskSession, mobilePublicOrigin, slotPlants } = useMobileLink();
  // 휴대폰에서 적은 식물 이름. 슬롯 A·B 모두 있어야 5 멘트에 이름이 들어간다.
  const plantNames = useMemo(
    () => ({ A: slotPlants?.A?.plantName || '', B: slotPlants?.B?.plantName || '' }),
    [slotPlants]
  );
  const viewportRef = useRef(null);
  const doneRef = useRef(false);
  const [scale, setScale] = useState(1);
  const [placeName, setPlaceName] = useState('');
  const [qrOn, setQrOn] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef(0);
  const [localUrl, setLocalUrl] = useState('');
  const [progress, setProgress] = useState({ index: 0, time: 0, duration: 0 });
  const speech = useSpeechOutput();
  const speechRef = useRef(speech);
  speechRef.current = speech;
  // 지금 멘트를 읽는 중인지(speak 호출부터 onEnd + 숨 고르기까지). 배경 시퀀스가 경계에서 이걸 보고 기다린다.
  const speechBusy = useRef({ busy: false, since: 0, timer: 0 });
  const waitRef = useRef(() => false);
  waitRef.current = () =>
    speechBusy.current.busy && performance.now() - speechBusy.current.since < SPEECH_WAIT_MAX_MS;
  const scene = sceneFor(placeName || '종로구');
  const storied = scene.shots.some((shot) => shot.story);
  const shot = scene.shots[progress.index];
  const cue = cueForShot(shot, progress.time, progress);
  const lines = cueLines(cue, placeName, plantNames);
  const ringState = gazeRingState(shot, progress.time, progress);
  // 말풍선이 없는 멘트로 넘어가도 직전 말풍선을 남겨 두고 글자 → 박스 순서로 사라지게 한다.
  const bubbleMemo = useRef({ cue: null, lines: [], run: 0, gone: true });
  const memo = bubbleMemo.current;
  if (cue?.bubble) {
    if (memo.gone) memo.run += 1;
    memo.cue = cue;
    memo.lines = lines;
    memo.gone = false;
  } else if (memo.cue) {
    memo.gone = true;
  }

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

  // 자치구가 정해지면 이 엔딩에서 읽을 멘트를 모두 미리 받아 둔다(이름이 바뀌면 그 문장만 다시).
  useEffect(() => {
    if (!placeName) return;
    Object.values(CUES).forEach((item) => {
      const text = speechText(cueLines(item, placeName, plantNames));
      if (text) speechRef.current.warm(text);
    });
    speechRef.current.warm(speechText(QR_LINES));
  }, [placeName, plantNames]);

  // 말풍선이 바뀔 때마다 그 글을 읽는다. 배경 시퀀스는 이 음성이 끝나야 다음 멘트 경계를 넘는다.
  const cueId = cue?.id ?? null;
  const spokenText = speechText(lines);
  useEffect(() => {
    if (!cueId || !spokenText || leaving) return;
    const state = speechBusy.current;
    window.clearTimeout(state.timer);
    state.busy = true;
    state.since = performance.now();
    speechRef.current.speak(spokenText, () => {
      state.timer = window.setTimeout(() => {
        state.busy = false;
      }, SPEECH_BREATH_MS);
    });
  }, [cueId, spokenText, leaving]);

  useEffect(() => {
    const state = speechBusy.current;
    return () => window.clearTimeout(state.timer);
  }, []);

  // 오브가 떠나는 동안은 조용히, QR 화면이 뜨면 마지막 안내를 읽는다.
  useEffect(() => {
    if (!leaving) return;
    speechRef.current.stopSpeaking();
    speechBusy.current.busy = false;
  }, [leaving]);

  useEffect(() => {
    if (qrOn) speechRef.current.speak(speechText(QR_LINES));
  }, [qrOn]);

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
            waitRef={waitRef}
          />
        ) : null}
        {storied ? (
          <img
            className={`${styles.topGradient} ${qrOn ? styles.agentLayerOff : ''}`}
            src="/5/jongno/ui/top-gradient.png"
            alt=""
          />
        ) : null}
        {storied ? (
          <div className={`${styles.gazeLayer} ${ringState.visible && !qrOn ? styles.gazeLayerOn : ''}`}>
            <GazeRing
              side="A"
              name={plantNames?.A}
              progress={ringState.progress}
              showLabel={ringState.labels}
              place={scene.rings?.A}
            />
            <GazeRing
              side="B"
              name={plantNames?.B}
              progress={ringState.progress}
              showLabel={ringState.labels}
              place={scene.rings?.B}
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
            {memo.cue ? (
              <div
                key={memo.run}
                className={`${styles.agentBubble} ${styles.agentBubbleIntro} ${
                  memo.gone ? styles.agentBubbleGone : ''
                }`}
                style={bubbleBox(memo.cue.bubble)}
              >
                {memo.lines.length ? (
                  <CueText
                    key={lineKey(memo.lines)}
                    lines={memo.lines}
                    className={memo.cue.bubble.align === 'left' ? styles.agentTextLeft : ''}
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
