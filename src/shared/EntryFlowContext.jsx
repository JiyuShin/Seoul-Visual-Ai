import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/router';
import { useGazeEngine } from './gaze/useGazeEngine';
import { VIEWER_BY_CAM } from './gaze/participants';
import GazeCameraFeeds from './gaze/GazeCameraFeeds';
import GazeDebugHud from './gaze/GazeDebugHud';
import { loadGazeSession, saveGazeSession } from './gaze/gazeSession';

const EntryFlowContext = createContext(null);

// 거리뷰 토론(/2)은 한 사람이 조작하는 단계라 1번 참가자의 시선만 쓴다.
const PRIMARY_VIEWER_ID = VIEWER_BY_CAM.A;

// /2 의 StreetView3D 는 prop 으로 받은 좌표를 쓰므로 반응형 값이 필요하다.
// 시선은 초당 60번 갱신되니 30fps 로 줄여서 리렌더 부담을 반으로 낮춘다.
const GAZE_STATE_INTERVAL_MS = 33;

function clampGazeToRect(x, y, rect) {
  if (!rect) return { x, y };
  return {
    x: Math.max(rect.left, Math.min(rect.right, x)),
    y: Math.max(rect.top, Math.min(rect.bottom, y)),
  };
}

export function EntryFlowProvider({ children }) {
  const router = useRouter();
  const [winnerCard, setWinnerCard] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [pins, setPins] = useState([]);
  const [discussionDone, setDiscussionDone] = useState(false);
  const [dwellProgress, setDwellProgress] = useState(0);
  const [gazeClip, setGazeClip] = useState(null);
  const [gazePosition, setGazePosition] = useState(null);

  // 운영자가 카메라를 잡고 보정을 마친 뒤 시작을 누르면 참여 화면으로 넘어간다.
  const [setupComplete, setSetupComplete] = useState(false);

  // 자식 페이지의 보정 화면 이동보다 먼저 복원해야, 1페이지가 보정을 다시 요구하지 않는다.
  useLayoutEffect(() => {
    if (loadGazeSession()?.setupComplete) setSetupComplete(true);
  }, []);
  // DEV ONLY: 최종 파일에서 제거. 시선 보정 없이 마우스 좌표로 이후 인터랙션을 진행한다.
  const [mouseDev, setMouseDev] = useState(false);

  const gazeHandlersRef = useRef({});
  const gazeClipRef = useRef(null);
  const activeStepRef = useRef(null);
  const dwellProgressRef = useRef(0);
  const gazeStateAtRef = useRef(0);
  const discussionCamRef = useRef('A');
  const [discussionCam, setDiscussionCam] = useState('A');
  discussionCamRef.current = discussionCam;

  const activeStep =
    router.pathname === '/2'
      ? 'discussion'
      : router.pathname === '/1' && !winnerCard
        ? 'vote'
        : null;

  activeStepRef.current = activeStep;
  gazeClipRef.current = gazeClip;

  const registerGazeHandler = useCallback((phase, handler) => {
    if (handler) {
      gazeHandlersRef.current[phase] = handler;
    } else {
      delete gazeHandlersRef.current[phase];
    }
  }, []);

  const registerGazeSample = useCallback((viewerId, x, y) => {
    const step = activeStepRef.current;
    const clip = gazeClipRef.current;
    const sample = clip ? clampGazeToRect(x, y, clip) : { x, y };

    // 사람별 커서 DOM 을 바로 옮긴다 (리렌더 없이 60fps).
    if (typeof window !== 'undefined') {
      const runtime = window.__seoulGazeRuntime;
      const cursorEl = runtime?.cursors?.[viewerId] || (viewerId === PRIMARY_VIEWER_ID ? runtime?.cursorEl : null);
      if (cursorEl) {
        cursorEl.style.left = `${sample.x}px`;
        cursorEl.style.top = `${sample.y}px`;
        cursorEl.style.opacity = '1';
      }
    }

    const discussionViewerId = VIEWER_BY_CAM[discussionCamRef.current] || PRIMARY_VIEWER_ID;
    const publishesPosition = step === 'discussion'
      ? viewerId === discussionViewerId
      : viewerId === PRIMARY_VIEWER_ID;

    if (publishesPosition) {
      const now = performance.now();
      if (now - gazeStateAtRef.current >= GAZE_STATE_INTERVAL_MS) {
        gazeStateAtRef.current = now;
        setGazePosition({ x: sample.x, y: sample.y });
      }
    }

    // 토론은 지금 말하는 사람의 시선만 심기 판정에 쓴다.
    if (step === 'discussion' && viewerId !== discussionViewerId) {
      return;
    }

    const handler = gazeHandlersRef.current[step];
    if (!handler) return;

    const result = handler(viewerId, sample.x, sample.y);
    if (result?.dwellProgress == null) return;

    // 매 프레임 setState 하면 화면 전체가 다시 그려지므로 눈에 보일 만큼 바뀔 때만 올린다.
    const next = Math.round(result.dwellProgress * 50) / 50;
    if (next !== dwellProgressRef.current) {
      dwellProgressRef.current = next;
      setDwellProgress(next);
    }
  }, []);

  const gazeEnabled = router.pathname !== '/mobile';
  const engine = useGazeEngine({ onSample: registerGazeSample, enabled: gazeEnabled });

  const handleGazeClipChange = useCallback((clip) => {
    setGazeClip(clip);
  }, []);

  useEffect(() => {
    if (router.pathname !== '/2') {
      setGazeClip(null);
    }
  }, [router.pathname]);

  const publishMousePoint = useCallback((x, y) => {
    const gaze = engine.gazeRef.current;
    if (gaze) {
      gaze[VIEWER_BY_CAM.A] = { x, y };
      gaze[VIEWER_BY_CAM.B] = { x, y };
    }
    registerGazeSample(VIEWER_BY_CAM.A, x, y);
    registerGazeSample(VIEWER_BY_CAM.B, x, y);
  }, [engine.gazeRef, registerGazeSample]);

  const enableMouseDev = useCallback((event) => {
    setMouseDev(true);
    setSetupComplete(true);
    if (event?.clientX != null) {
      publishMousePoint(event.clientX, event.clientY);
    }
  }, [publishMousePoint]);

  useEffect(() => {
    if (!mouseDev) return undefined;

    const onMove = (event) => {
      publishMousePoint(event.clientX, event.clientY);
    };

    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [mouseDev, publishMousePoint]);

  const completeSetup = useCallback(() => {
    saveGazeSession({ setupComplete: true });
    setSetupComplete(true);
  }, []);

  const reopenSetup = useCallback(() => {
    saveGazeSession({ setupComplete: false });
    setSetupComplete(false);
  }, []);

  // 친구 프론트가 쓰던 이름. 보정 완료 = 참여 시작과 같다.
  const finishCalibration = completeSetup;

  const reportDwellProgress = useCallback((progress) => {
    if (progress == null) return;
    const next = Math.round(progress * 50) / 50;
    if (next !== dwellProgressRef.current) {
      dwellProgressRef.current = next;
      setDwellProgress(next);
    }
  }, []);

  const value = useMemo(
    () => ({
      ...engine,
      isReady: engine.ready || mouseDev,
      mouseDev,
      enableMouseDev,
      // 준비가 끝나기 전에는 /1, /2 가 보정 화면으로 돌려보낸다.
      isCalibrating: !setupComplete,
      setupComplete,
      completeSetup,
      finishCalibration,
      reopenSetup,
      primaryViewerId: PRIMARY_VIEWER_ID,

      winnerCard,
      setWinnerCard,
      selectedDistrict,
      setSelectedDistrict,
      discussionCam,
      setDiscussionCam,
      pins,
      setPins,
      discussionDone,
      setDiscussionDone,
      dwellProgress,
      reportDwellProgress,
      gazePosition,
      // 친구 GazeReticle / GlobalGazeCursor 가 읽는 이름
      reticlePosition: gazePosition,
      registerGazeHandler,
      handleGazeClipChange,
    }),
    [
      engine,
      mouseDev,
      enableMouseDev,
      setupComplete,
      completeSetup,
      finishCalibration,
      reopenSetup,
      winnerCard,
      selectedDistrict,
      discussionCam,
      pins,
      discussionDone,
      dwellProgress,
      reportDwellProgress,
      gazePosition,
      registerGazeHandler,
      handleGazeClipChange,
    ]
  );

  return (
    <EntryFlowContext.Provider value={value}>
      {gazeEnabled ? <GazeCameraFeeds videoRefs={engine.videoRefs} /> : null}
      {children}
      {gazeEnabled ? <GazeDebugHud diagRef={engine.diagRef} gazeRef={engine.gazeRef} /> : null}
    </EntryFlowContext.Provider>
  );
}

export function useEntryFlow() {
  const context = useContext(EntryFlowContext);
  if (!context) {
    throw new Error('useEntryFlow must be used inside EntryFlowProvider');
  }
  return context;
}
