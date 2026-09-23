import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useGazeEngine } from './gaze/useGazeEngine';
import { VIEWER_BY_CAM } from './gaze/participants';
import GazeCameraFeeds from './gaze/GazeCameraFeeds';
import GazeDebugHud from './gaze/GazeDebugHud';

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
  const [pins, setPins] = useState([]);
  const [discussionDone, setDiscussionDone] = useState(false);
  const [dwellProgress, setDwellProgress] = useState(0);
  const [gazeClip, setGazeClip] = useState(null);
  const [gazePosition, setGazePosition] = useState(null);

  // 운영자가 카메라를 잡고 보정을 마친 뒤 시작을 누르면 참여 화면으로 넘어간다.
  const [setupComplete, setSetupComplete] = useState(false);

  const gazeHandlersRef = useRef({});
  const gazeClipRef = useRef(null);
  const activeStepRef = useRef(null);
  const dwellProgressRef = useRef(0);
  const gazeStateAtRef = useRef(0);

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

    if (viewerId === PRIMARY_VIEWER_ID) {
      const now = performance.now();
      if (now - gazeStateAtRef.current >= GAZE_STATE_INTERVAL_MS) {
        gazeStateAtRef.current = now;
        setGazePosition({ x: sample.x, y: sample.y });
      }
    }

    // 토론(/2)만 1인용. 메뉴(/1)는 두 사람 시선을 모두 핸들러에 넘긴다.
    if (step === 'discussion' && viewerId !== PRIMARY_VIEWER_ID) {
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

  const engine = useGazeEngine({ onSample: registerGazeSample });

  const handleGazeClipChange = useCallback((clip) => {
    setGazeClip(clip);
  }, []);

  useEffect(() => {
    if (router.pathname !== '/2') {
      setGazeClip(null);
    }
  }, [router.pathname]);

  const completeSetup = useCallback(() => {
    setSetupComplete(true);
  }, []);

  const reopenSetup = useCallback(() => {
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
      isReady: engine.ready,
      // 준비가 끝나기 전에는 /1, /2 가 보정 화면으로 돌려보낸다.
      isCalibrating: !setupComplete,
      setupComplete,
      completeSetup,
      finishCalibration,
      reopenSetup,
      primaryViewerId: PRIMARY_VIEWER_ID,

      winnerCard,
      setWinnerCard,
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
      setupComplete,
      completeSetup,
      finishCalibration,
      reopenSetup,
      winnerCard,
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
      {/* 페이지가 바뀌어도 추적이 끊기지 않도록 비디오는 페이지 밖에서 계속 살려 둔다. */}
      <GazeCameraFeeds videoRefs={engine.videoRefs} />
      {children}
      <GazeDebugHud diagRef={engine.diagRef} gazeRef={engine.gazeRef} />
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
