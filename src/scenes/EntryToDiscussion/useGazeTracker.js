import { useCallback, useEffect, useRef, useState } from 'react';
import { loadWebGazerScript } from '../../lib/loadWebGazer';
import {
  CALIBRATION_DWELL_MS,
  CALIBRATION_POINTS,
  CALIBRATION_SAMPLE_INTERVAL_MS,
  MIN_CALIBRATION_POINTS,
  createGazeSmoother,
} from './gazeSmoother';

export { CALIBRATION_DWELL_MS };

function hasFaceLandmarks(webgazer) {
  const tracker = webgazer?.getTracker?.();
  return Boolean(tracker?.positionsArray?.length);
}

export function useGazeTracker(onGazeSample) {
  const [isReady, setIsReady] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(true);
  const [calibrationIndex, setCalibrationIndex] = useState(0);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [gazePosition, setGazePosition] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [trackingActive, setTrackingActive] = useState(false);
  const [calibrationHint, setCalibrationHint] = useState('');
  const [recordedPoints, setRecordedPoints] = useState(0);
  const [calibrationRetry, setCalibrationRetry] = useState(0);
  const [error, setError] = useState(null);

  const webgazerRef = useRef(null);
  const onGazeSampleRef = useRef(onGazeSample);
  const isCalibratingRef = useRef(true);
  const rawGazeRef = useRef(null);
  const smootherRef = useRef(createGazeSmoother());
  const lastFaceSeenRef = useRef(0);
  const calibrationTimerRef = useRef(null);
  const calibrationProgressRef = useRef(null);
  const calibrationSampleRef = useRef(null);
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

    if (rawGazeRef.current) {
      smootherRef.current.reset(rawGazeRef.current.x, rawGazeRef.current.y);
    }

    document.body.classList.remove('calibrating-gaze');
    if (webgazerRef.current) {
      webgazerRef.current.showVideoPreview(false);
    }
  }, []);

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
          .setRegression('weightedRidge')
          .setTracker('TFFacemesh')
          .saveDataAcrossSessions(false)
          .applyKalmanFilter(true)
          .setGazeListener((data) => {
            if (cancelled || !data) return;

            if (data.eyeFeatures || data.x != null) {
              lastFaceSeenRef.current = Date.now();
              setFaceDetected(true);
            }

            if (data.x != null && data.y != null && !Number.isNaN(data.x) && !Number.isNaN(data.y)) {
              setTrackingActive(true);
              rawGazeRef.current = { x: data.x, y: data.y };
            }
          });

        await webgazer.begin();
        webgazer.removeMouseEventListeners();

        webgazer.showVideoPreview(true);
        webgazer.showPredictionPoints(false);
        webgazer.showFaceOverlay(false);
        webgazer.showFaceFeedbackBox(false);
        webgazer.setVideoViewerSize(160, 120);

        document.body.classList.add('calibrating-gaze');

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
      if (calibrationTimerRef.current) clearTimeout(calibrationTimerRef.current);
      if (calibrationProgressRef.current) clearInterval(calibrationProgressRef.current);
      if (calibrationSampleRef.current) clearInterval(calibrationSampleRef.current);
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

    const tick = (now) => {
      if (rawGazeRef.current) {
        const smoothed = smootherRef.current.update(
          rawGazeRef.current.x,
          rawGazeRef.current.y,
          now
        );
        setGazePosition(smoothed);

        if (!isCalibratingRef.current) {
          onGazeSampleRef.current?.('viewer-1', smoothed.x, smoothed.y);
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

  const advanceCalibration = useCallback(() => {
    setCalibrationIndex((current) => {
      const nextIndex = current + 1;
      if (nextIndex >= CALIBRATION_POINTS.length) {
        finishCalibration();
        return current;
      }
      return nextIndex;
    });
    setCalibrationProgress(0);
  }, [finishCalibration]);

  useEffect(() => {
    if (!isReady || !isCalibrating || calibrationIndex >= CALIBRATION_POINTS.length) {
      return undefined;
    }

    const point = CALIBRATION_POINTS[calibrationIndex];
    const screenX = point.x * window.innerWidth;
    const screenY = point.y * window.innerHeight;
    let samplesRecorded = 0;

    setCalibrationProgress(0);
    setCalibrationHint('초록 점을 정확히 응시하세요. 천천히 시선을 맞춰 주세요.');

    const startedAt = Date.now();
    calibrationProgressRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setCalibrationProgress(Math.min(1, elapsed / CALIBRATION_DWELL_MS));
    }, 50);

    calibrationSampleRef.current = setInterval(() => {
      const webgazer = webgazerRef.current;
      if (!webgazer || !hasFaceLandmarks(webgazer)) return;

      try {
        webgazer.recordScreenPosition(screenX, screenY, 'click');
        samplesRecorded += 1;
      } catch {
        /* ignore sample errors */
      }
    }, CALIBRATION_SAMPLE_INTERVAL_MS);

    calibrationTimerRef.current = setTimeout(() => {
      if (calibrationSampleRef.current) clearInterval(calibrationSampleRef.current);

      if (samplesRecorded > 0) {
        setRecordedPoints((count) => count + 1);
        advanceCalibration();
      } else {
        setCalibrationHint('얼굴이 카메라에 보이도록 한 뒤, 다시 점을 응시해 주세요.');
        setCalibrationProgress(0);
        setCalibrationRetry((value) => value + 1);
      }
    }, CALIBRATION_DWELL_MS);

    return () => {
      if (calibrationTimerRef.current) clearTimeout(calibrationTimerRef.current);
      if (calibrationProgressRef.current) clearInterval(calibrationProgressRef.current);
      if (calibrationSampleRef.current) clearInterval(calibrationSampleRef.current);
    };
  }, [isReady, isCalibrating, calibrationIndex, calibrationRetry, advanceCalibration]);

  return {
    isReady,
    isCalibrating,
    calibrationIndex,
    calibrationTotal: CALIBRATION_POINTS.length,
    calibrationPoint: CALIBRATION_POINTS[calibrationIndex] || null,
    calibrationProgress,
    calibrationHint,
    gazePosition,
    faceDetected,
    cameraActive,
    trackingActive,
    recordedPoints,
    minCalibrationPoints: MIN_CALIBRATION_POINTS,
    finishCalibration,
    error,
  };
}
