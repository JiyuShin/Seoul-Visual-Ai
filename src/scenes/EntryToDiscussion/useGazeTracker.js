import { useCallback, useEffect, useRef, useState } from 'react';
import { loadWebGazerScript } from '../../lib/loadWebGazer';
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

export function useGazeTracker(onGazeSample) {
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
  const isCalibratingRef = useRef(true);
  const gazePipelineRef = useRef(createGazePipeline());
  const lastRawGazeRef = useRef(null);
  const lastFaceSeenRef = useRef(0);
  const facePollRef = useRef(null);
  const rafRef = useRef(null);

  isCalibratingRef.current = isCalibrating;

  useEffect(() => {
    onGazeSampleRef.current = onGazeSample;
  }, [onGazeSample]);

  const finishCalibration = useCallback(() => {
    isCalibratingRef.current = false;
    setIsCalibrating(false);
    setCalibrationIndex(CALIBRATION_POINTS.length);
    setCalibrationHint('');
    setIsRecordingCalibration(false);

    document.body.classList.remove('calibrating-gaze');
    if (webgazerRef.current) {
      webgazerRef.current.showVideoPreview(false);
      webgazerRef.current.showPredictionPoints(false);
    }

    if (lastRawGazeRef.current) {
      gazePipelineRef.current.reset(lastRawGazeRef.current.x, lastRawGazeRef.current.y);
    }
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
    if (typeof window === 'undefined') return undefined;

    let cancelled = false;

    const init = async () => {
      try {
        const webgazer = await loadWebGazerScript();
        if (cancelled) return;

        webgazerRef.current = webgazer;
        webgazer.params.faceMeshSolutionPath = '/mediapipe/face_mesh';

        await webgazer.clearData();

        webgazer
          .setRegression('ridge')
          .setTracker('TFFacemesh')
          .saveDataAcrossSessions(false)
          .applyKalmanFilter(false)
          .setGazeListener((data) => {
            if (cancelled || !data) return;

            if (data.eyeFeatures || data.x != null) {
              lastFaceSeenRef.current = Date.now();
              setFaceDetected(true);
            }

            if (data.x == null || data.y == null || Number.isNaN(data.x) || Number.isNaN(data.y)) {
              return;
            }

            lastRawGazeRef.current = { x: data.x, y: data.y };
            setTrackingActive(true);
            gazePipelineRef.current.pushRaw(data.x, data.y);
          });

        await webgazer.begin();
        webgazer.removeMouseEventListeners();

        webgazer.showVideoPreview(true);
        webgazer.showPredictionPoints(false);
        webgazer.showFaceOverlay(false);
        webgazer.showFaceFeedbackBox(false);
        webgazer.setVideoViewerSize(160, 120);

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
      document.body.classList.remove('calibrating-gaze');
      if (facePollRef.current) clearInterval(facePollRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (webgazerRef.current) {
        try {
          webgazerRef.current.end();
        } catch {
          /* ignore cleanup errors */
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!isReady) return undefined;

    const tick = () => {
      const result = gazePipelineRef.current.step();

      if (result) {
        setGazePosition({ x: result.x, y: result.y, locked: result.locked });
        if (!isCalibratingRef.current) {
          onGazeSampleRef.current?.('viewer-1', result.x, result.y);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
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
  };
}
