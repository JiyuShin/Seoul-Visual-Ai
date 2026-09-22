import { useCallback, useEffect, useRef, useState } from 'react';
import { loadWebGazerScript } from './loadWebGazer';
import {
  CALIBRATION_POINTS,
  createGazePipeline,
  MIN_CALIBRATION_POINTS,
  recordCalibrationPoint,
} from './gazeSmoother';

function hasFaceLandmarks(webgazer) {
  const tracker = webgazer?.getTracker?.();
  return Boolean(tracker?.positionsArray?.length);
}

function getGazeRuntime() {
  if (typeof window === 'undefined') return null;
  if (!window.__seoulGazeRuntime) {
    window.__seoulGazeRuntime = { started: false, initPromise: null };
  }
  return window.__seoulGazeRuntime;
}

function pointAt(pts, index) {
  const p = pts?.[index];
  if (!p) return null;
  if (typeof p.x === 'number' && typeof p.y === 'number') return p;
  if (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
    return { x: p[0], y: p[1] };
  }
  return null;
}

function ratioOnAxis(value, a, b) {
  const min = Math.min(a, b);
  const span = Math.max(8, Math.abs(b - a));
  return (value - min) / span;
}

function expand01(value, inner = 0.32, outer = 0.68) {
  return Math.max(0, Math.min(1, (value - inner) / Math.max(0.08, outer - inner)));
}

function gazeFromIris(webgazer) {
  const tracker = webgazer?.getTracker?.();
  const pts = tracker?.getPositions?.() || tracker?.positionsArray;
  if (!pts || pts.length < 400) return null;

  const leftOuter = pointAt(pts, 33);
  const leftInner = pointAt(pts, 133);
  const leftTop = pointAt(pts, 159);
  const leftBot = pointAt(pts, 145);
  const rightOuter = pointAt(pts, 263);
  const rightInner = pointAt(pts, 362);
  const rightTop = pointAt(pts, 386);
  const rightBot = pointAt(pts, 374);
  const leftIris = pointAt(pts, 468) || pointAt(pts, 159);
  const rightIris = pointAt(pts, 473) || pointAt(pts, 386);

  if (!leftOuter || !leftInner || !leftIris || !rightOuter || !rightInner || !rightIris) {
    return null;
  }

  const nx =
    1 -
    (ratioOnAxis(leftIris.x, leftOuter.x, leftInner.x) +
      ratioOnAxis(rightIris.x, rightOuter.x, rightInner.x)) /
      2;

  let ny = 0.5;
  if (leftTop && leftBot && rightTop && rightBot) {
    ny =
      (ratioOnAxis(leftIris.y, leftTop.y, leftBot.y) +
        ratioOnAxis(rightIris.y, rightTop.y, rightBot.y)) /
      2;
  }

  return {
    x: expand01(nx) * window.innerWidth,
    y: expand01(ny, 0.28, 0.72) * window.innerHeight,
  };
}

function applyCursorDom(x, y) {
  const el = getGazeRuntime()?.cursorEl;
  if (!el) return;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

function guardFaceMeshSend(webgazer) {
  const tracker = webgazer?.getTracker?.();
  if (!tracker?.getEyePatches || tracker.__abortGuarded) return;

  tracker.__abortGuarded = true;
  const original = tracker.getEyePatches.bind(tracker);

  tracker.getEyePatches = async function (video, canvas, width, height) {
    if (!video || video.readyState < 2 || video.videoWidth < 2 || video.videoHeight < 2) {
      return null;
    }

    try {
      return await original(video, canvas, width, height);
    } catch {
      return null;
    }
  };
}

async function ensureWebGazerStarted(cameraDeviceId) {
  const runtime = getGazeRuntime();
  if (runtime.initPromise) return runtime.initPromise;

  runtime.initPromise = (async () => {
    const webgazer = await loadWebGazerScript();
    webgazer.params.faceMeshSolutionPath = '/mediapipe/face_mesh';

    if (!runtime.started) {
      if (cameraDeviceId) {
        webgazer.params.camConstraints = {
          video: {
            deviceId: { exact: cameraDeviceId },
            width: { min: 320, ideal: 640, max: 1280 },
            height: { min: 240, ideal: 480, max: 720 },
            facingMode: 'user',
          },
        };
      }

      await webgazer.clearData();
      webgazer
        .setRegression('ridge')
        .setTracker('TFFacemesh')
        .saveDataAcrossSessions(false)
        .applyKalmanFilter(true);

      guardFaceMeshSend(webgazer);
      await webgazer.begin();
      webgazer.removeMouseEventListeners();
      webgazer.showVideoPreview(true);
      webgazer.showPredictionPoints(true);
      webgazer.showFaceOverlay(false);
      webgazer.showFaceFeedbackBox(false);
      webgazer.setVideoViewerSize(160, 120);
      runtime.started = true;
    }

    guardFaceMeshSend(webgazer);
    return webgazer;
  })();

  return runtime.initPromise;
}

export function useGazeTracker(
  onGazeSample,
  { viewerId = 'viewer-1', cameraDeviceId = null, enabled = true } = {}
) {
  const [isReady, setIsReady] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(true);
  const [calibrationIndex, setCalibrationIndex] = useState(0);
  const [gazePosition, setGazePosition] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [trackingActive, setTrackingActive] = useState(false);
  const [calibrationHint, setCalibrationHint] = useState('');
  const [recordedPoints, setRecordedPoints] = useState(0);
  const [isRecordingCalibration, setIsRecordingCalibration] = useState(false);
  const [error, setError] = useState(null);

  const webgazerRef = useRef(null);
  const onGazeSampleRef = useRef(onGazeSample);
  const viewerIdRef = useRef(viewerId);
  const isCalibratingRef = useRef(true);
  const gazePipelineRef = useRef(createGazePipeline());
  const lastRawGazeRef = useRef(null);
  const lastFaceSeenRef = useRef(0);
  const facePollRef = useRef(null);
  const rafRef = useRef(null);
  const recordedPointsRef = useRef(0);
  recordedPointsRef.current = recordedPoints;

  isCalibratingRef.current = isCalibrating;
  viewerIdRef.current = viewerId;

  useEffect(() => {
    onGazeSampleRef.current = onGazeSample;
  }, [onGazeSample]);

  const finishCalibration = useCallback(() => {
    isCalibratingRef.current = false;
    setIsCalibrating(false);
    setCalibrationIndex(CALIBRATION_POINTS.length);
    setCalibrationHint('');
    setIsRecordingCalibration(false);
    // 보정 종료 후에도 웹캠 프리뷰를 보정 때와 같이 유지한다.
    // 숨기면 브라우저가 카메라 프레임을 멈춰 시선 커서가 사라진다.
  }, []);

  const advanceCalibration = useCallback(() => {
    setCalibrationIndex((current) => {
      const nextIndex = current + 1;
      if (nextIndex >= CALIBRATION_POINTS.length) {
        finishCalibration();
        return current;
      }
      return nextIndex;
    });
    setCalibrationHint('');
  }, [finishCalibration]);

  const confirmCalibrationPoint = useCallback(async () => {
    if (
      isRecordingCalibration ||
      !isCalibratingRef.current ||
      calibrationIndex >= CALIBRATION_POINTS.length
    ) {
      return false;
    }

    const webgazer = webgazerRef.current;
    const point = CALIBRATION_POINTS[calibrationIndex];
    if (!webgazer || !point) return false;

    setIsRecordingCalibration(true);
    setCalibrationHint('이 점을 응시한 채 보정 중…');

    try {
      const result = await recordCalibrationPoint({
        webgazer,
        point,
        hasFaceLandmarks,
      });

      if (!result.ok) {
        setCalibrationHint('얼굴이 카메라에 보일 때, 점을 응시한 채 다시 눌러주세요.');
        return false;
      }

      setRecordedPoints((count) => count + 1);
      advanceCalibration();
      return true;
    } catch {
      setCalibrationHint('보정 기록에 실패했습니다. 다시 시도해 주세요.');
      return false;
    } finally {
      setIsRecordingCalibration(false);
    }
  }, [advanceCalibration, calibrationIndex, isRecordingCalibration]);

  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) return undefined;

    let cancelled = false;
    const runtime = getGazeRuntime();

    runtime.onGaze = (data) => {
      if (cancelled || !data) return;

      if (data.eyeFeatures || data.x != null) {
        lastFaceSeenRef.current = Date.now();
        setFaceDetected(true);
      }

      if (data.x == null || data.y == null || Number.isNaN(data.x) || Number.isNaN(data.y)) {
        return;
      }

      lastRawGazeRef.current = { x: data.x, y: data.y, receivedAt: Date.now() };
      setTrackingActive(true);
      gazePipelineRef.current.pushRaw(data.x, data.y);
    };

    const init = async () => {
      try {
        const webgazer = await ensureWebGazerStarted(cameraDeviceId);
        if (cancelled) return;

        webgazerRef.current = webgazer;
        webgazer.showVideoPreview(true);
        webgazer.showPredictionPoints(true);
        webgazer.showFaceOverlay(false);
        webgazer.showFaceFeedbackBox(false);

        webgazer.setGazeListener((data) => {
          getGazeRuntime().onGaze?.(data);
        });
        runtime.listenerAttached = true;

        document.body.classList.add('calibrating-gaze');
        setCalibrationHint(
          '초록 점을 눈동자로 맞춘 뒤 스페이스바 또는 버튼을 누르세요. 첫 보정 후 커서가 나타납니다.'
        );

        if (!cancelled) setIsReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'WebGazer initialization failed');
        }
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [cameraDeviceId, enabled]);

  useEffect(() => {
    if (!isReady) return undefined;

    let smoothX = null;
    let smoothY = null;
    const history = [];
    const HISTORY_SIZE = 6;
    const CURSOR_MARGIN = 41;
    let reading = false;
    let lastRidge = null;

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const webgazer = webgazerRef.current;

      if (webgazer && !reading) {
        reading = true;
        Promise.resolve(webgazer.getCurrentPrediction())
          .then((pred) => {
            if (pred && Number.isFinite(pred.x) && Number.isFinite(pred.y)) {
              lastRidge = { x: pred.x, y: pred.y };
            }
            const iris = gazeFromIris(webgazer);
            const useRidge = lastRidge && recordedPointsRef.current >= 3;
            const sample = useRidge ? lastRidge : iris || lastRidge;
            if (sample) {
              lastRawGazeRef.current = {
                x: sample.x,
                y: sample.y,
                receivedAt: Date.now(),
              };
              lastFaceSeenRef.current = Date.now();
            }
          })
          .catch(() => {})
          .finally(() => {
            reading = false;
          });
      }

      const lastRaw = lastRawGazeRef.current;
      if (!lastRaw || Date.now() - lastRaw.receivedAt >= 800) return;

      const screenW = window.innerWidth;
      const screenH = window.innerHeight;
      const targetX = Math.max(CURSOR_MARGIN, Math.min(screenW - CURSOR_MARGIN, lastRaw.x));
      const targetY = Math.max(CURSOR_MARGIN, Math.min(screenH - CURSOR_MARGIN, lastRaw.y));

      history.push({ x: targetX, y: targetY });
      if (history.length > HISTORY_SIZE) history.shift();

      const avgX = history.reduce((sum, p) => sum + p.x, 0) / history.length;
      const avgY = history.reduce((sum, p) => sum + p.y, 0) / history.length;

      if (smoothX === null || smoothY === null) {
        smoothX = avgX;
        smoothY = avgY;
      } else {
        smoothX += (avgX - smoothX) * 0.35;
        smoothY += (avgY - smoothY) * 0.35;
      }

      const x = Math.max(CURSOR_MARGIN, Math.min(screenW - CURSOR_MARGIN, Math.round(smoothX)));
      const y = Math.max(CURSOR_MARGIN, Math.min(screenH - CURSOR_MARGIN, Math.round(smoothY)));

      applyCursorDom(x, y);
      setGazePosition((prev) => {
        if (prev && prev.x === x && prev.y === y) return prev;
        return { x, y, locked: false };
      });
      setTrackingActive(true);
      if (!isCalibratingRef.current) {
        onGazeSampleRef.current?.(viewerIdRef.current, x, y);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isReady]);

  useEffect(() => {
    if (!isReady || !isCalibrating) return undefined;

    const onKeyDown = (event) => {
      if (event.code !== 'Space' || event.repeat || isRecordingCalibration) return;
      event.preventDefault();
      confirmCalibrationPoint();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isReady, isCalibrating, isRecordingCalibration, confirmCalibrationPoint]);

  useEffect(() => {
    if (!isReady) return undefined;

    facePollRef.current = setInterval(() => {
      const video = document.getElementById('webgazerVideoFeed');
      if (video?.paused) {
        video.play().catch(() => {});
      }
      const videoOk =
        video && video.readyState >= 2 && video.videoWidth > 0 && !video.paused;

      setCameraActive(Boolean(videoOk));

      const webgazer = webgazerRef.current;
      if (!webgazer) return;

      if (hasFaceLandmarks(webgazer)) {
        lastFaceSeenRef.current = Date.now();
        setFaceDetected(true);
      } else if (Date.now() - lastFaceSeenRef.current > 1200) {
        setFaceDetected(false);
      }

      const lastRaw = lastRawGazeRef.current;
      if (!lastRaw || Date.now() - lastRaw.receivedAt > 500) {
        setTrackingActive(false);
      }
    }, 250);

    return () => {
      if (facePollRef.current) clearInterval(facePollRef.current);
    };
  }, [isReady]);

  return {
    isReady,
    isCalibrating,
    calibrationIndex,
    calibrationTotal: CALIBRATION_POINTS.length,
    calibrationPoint: CALIBRATION_POINTS[calibrationIndex] || null,
    calibrationHint,
    gazePosition,
    faceDetected,
    cameraActive,
    trackingActive,
    recordedPoints,
    isRecordingCalibration,
    minCalibrationPoints: MIN_CALIBRATION_POINTS,
    confirmCalibrationPoint,
    finishCalibration,
    error,
    setTagPlacementMode: useCallback((active) => {
      gazePipelineRef.current.setTagPlacementMode(active);
    }, []),
    setGazeClipRect: useCallback((rect) => {
      gazePipelineRef.current.setGazeClipRect(rect);
    }, []),
  };
}
