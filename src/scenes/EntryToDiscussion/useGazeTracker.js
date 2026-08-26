import { useCallback, useEffect, useRef, useState } from 'react';
import { loadWebGazerScript } from '../../lib/loadWebGazer';
import {
  buildAxisCorrection,
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
  const calibrationPairsRef = useRef([]);
  const lastRawGazeRef = useRef(null);
  const lastFaceSeenRef = useRef(0);
  const facePollRef = useRef(null);
  const rafRef = useRef(null);

  isCalibratingRef.current = isCalibrating;

  useEffect(() => {
    onGazeSampleRef.current = onGazeSample;
  }, [onGazeSample]);

  const applyTrackingCorrection = useCallback(() => {
    const correction = buildAxisCorrection(calibrationPairsRef.current);
    gazePipelineRef.current.setCorrection(correction);

    if (lastRawGazeRef.current) {
      gazePipelineRef.current.reset(lastRawGazeRef.current.x, lastRawGazeRef.current.y);
    }
  }, []);

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

    applyTrackingCorrection();
  }, [applyTrackingCorrection]);

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
        getLastRawGaze: () => lastRawGazeRef.current,
      });

      if (!result.ok) {
        if (result.reason === 'face') {
          setCalibrationHint('얼굴이 카메라에 보일 때, 점을 응시한 채 다시 눌러주세요.');
        } else {
          setCalibrationHint('시선 측정에 실패했습니다. 점을 응시한 채 다시 눌러주세요.');
        }
        return false;
      }

      calibrationPairsRef.current.push(result.pair);
      setRecordedPoints((count) => count + 1);
      advanceCalibration();
      return true;
    } catch {
      setCalibrationHint('보정 기록에 실패했습니다. 다시 시도해 주세요.');
      return false;
    } finally {
      setIsRecordingCalibration(false);
    }
  }, [
    advanceCalibration,
    calibrationIndex,
    isRecordingCalibration,
  ]);

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
        calibrationPairsRef.current = [];

        webgazer
          .setRegression('ridge')
          .setTracker('TFFacemesh')
          .saveDataAcrossSessions(false)
          .applyKalmanFilter(true)
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
        webgazer.showPredictionPoints(true);
        webgazer.showFaceOverlay(false);
        webgazer.showFaceFeedbackBox(false);
        webgazer.setVideoViewerSize(160, 120);

        document.body.classList.add('calibrating-gaze');
        setCalibrationHint(
          '초록 점을 눈동자로 맞춘 뒤 스페이스바 또는 버튼을 누르세요. 첫 보정 후 초록 커서가 나타납니다.'
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
      let position = gazePipelineRef.current.step();

      if (!position && lastRawGazeRef.current) {
        gazePipelineRef.current.pushRaw(
          lastRawGazeRef.current.x,
          lastRawGazeRef.current.y
        );
        position = gazePipelineRef.current.step();
      }

      if (position) {
        setGazePosition(position);
        if (!isCalibratingRef.current) {
          onGazeSampleRef.current?.('viewer-1', position.x, position.y);
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
