import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useGazeTracker } from './useGazeTracker';

const EntryFlowContext = createContext(null);

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

  const gazeHandlersRef = useRef({});
  const gazeClipRef = useRef(null);
  const activeStepRef = useRef(null);

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
    const handler = gazeHandlersRef.current[activeStepRef.current];
    if (!handler) return;

    const clip = gazeClipRef.current;
    const sample = clip ? clampGazeToRect(x, y, clip) : { x, y };
    const result = handler(viewerId, sample.x, sample.y);
    if (result?.dwellProgress != null) {
      setDwellProgress(result.dwellProgress);
    }
  }, []);

  const tracker = useGazeTracker(registerGazeSample);

  const handleGazeClipChange = useCallback((clip) => {
    setGazeClip(clip);
  }, []);

  useEffect(() => {
    if (router.pathname !== '/2') {
      setGazeClip(null);
    }
  }, [router.pathname]);

  useEffect(() => {
    const inTagPlacement = router.pathname === '/2' && Boolean(gazeClip);
    tracker.setTagPlacementMode(inTagPlacement);
    tracker.setGazeClipRect(inTagPlacement ? gazeClip : null);
  }, [router.pathname, gazeClip, tracker.setTagPlacementMode, tracker.setGazeClipRect]);

  const reticlePosition = useMemo(() => {
    if (!tracker.gazePosition) return null;
    if (router.pathname !== '/2' || !gazeClip) return tracker.gazePosition;
    const clamped = clampGazeToRect(tracker.gazePosition.x, tracker.gazePosition.y, gazeClip);
    return { ...tracker.gazePosition, x: clamped.x, y: clamped.y };
  }, [tracker.gazePosition, gazeClip, router.pathname]);

  const value = useMemo(
    () => ({
      ...tracker,
      winnerCard,
      setWinnerCard,
      pins,
      setPins,
      discussionDone,
      setDiscussionDone,
      dwellProgress,
      reticlePosition,
      registerGazeHandler,
      handleGazeClipChange,
    }),
    [
      tracker,
      winnerCard,
      pins,
      discussionDone,
      dwellProgress,
      reticlePosition,
      registerGazeHandler,
      handleGazeClipChange,
    ]
  );

  return <EntryFlowContext.Provider value={value}>{children}</EntryFlowContext.Provider>;
}

export function useEntryFlow() {
  const context = useContext(EntryFlowContext);
  if (!context) {
    throw new Error('useEntryFlow must be used inside EntryFlowProvider');
  }
  return context;
}
