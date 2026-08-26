export const GAZE_FOLLOW_FACTOR = 0.2;
export const GAZE_MAX_STEP_PX = 6;
export const GAZE_DEAD_ZONE_PX = 1.5;
export const GAZE_MEDIAN_WINDOW = 3;
export const GAZE_OUTLIER_PX = 120;

export const CALIBRATION_POINTS = [
  { x: 0.1, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.1, y: 0.9 },
  { x: 0.9, y: 0.9 },
];

export const CALIBRATION_SAMPLE_COUNT = 10;
export const CALIBRATION_SAMPLE_INTERVAL_MS = 50;
export const CALIBRATION_MEASURE_COUNT = 6;
export const CALIBRATION_MEASURE_INTERVAL_MS = 40;
export const MIN_CALIBRATION_POINTS = 4;

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function medianPoint(points) {
  if (!points.length) return null;
  return {
    x: median(points.map((p) => p.x)),
    y: median(points.map((p) => p.y)),
  };
}

function averagePoints(points) {
  if (!points.length) return null;
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function fitAxis(targets, raws) {
  const n = targets.length;
  if (n < 2) return { scale: 1, offset: 0 };

  let sumR = 0;
  let sumT = 0;
  let sumRR = 0;
  let sumRT = 0;

  for (let i = 0; i < n; i += 1) {
    sumR += raws[i];
    sumT += targets[i];
    sumRR += raws[i] * raws[i];
    sumRT += raws[i] * targets[i];
  }

  const denom = n * sumRR - sumR * sumR;
  if (Math.abs(denom) < 1e-6) return { scale: 1, offset: 0 };

  const scale = (n * sumRT - sumR * sumT) / denom;
  const offset = (sumT - scale * sumR) / n;
  return {
    scale: clamp(scale, 0.8, 1.25),
    offset,
  };
}

export function buildAxisCorrection(pairs) {
  if (pairs.length < 2) {
    return (rawX, rawY) => ({ x: rawX, y: rawY });
  }

  const xFit = fitAxis(
    pairs.map((p) => p.targetX),
    pairs.map((p) => p.rawX)
  );
  const yFit = fitAxis(
    pairs.map((p) => p.targetY),
    pairs.map((p) => p.rawY)
  );

  return (rawX, rawY) => {
    if (typeof window === 'undefined') {
      return {
        x: xFit.scale * rawX + xFit.offset,
        y: yFit.scale * rawY + yFit.offset,
      };
    }

    return {
      x: clamp(xFit.scale * rawX + xFit.offset, 0, window.innerWidth),
      y: clamp(yFit.scale * rawY + yFit.offset, 0, window.innerHeight),
    };
  };
}

export function createGazePipeline({
  followFactor = GAZE_FOLLOW_FACTOR,
  maxStepPx = GAZE_MAX_STEP_PX,
  deadZonePx = GAZE_DEAD_ZONE_PX,
  medianWindow = GAZE_MEDIAN_WINDOW,
  outlierPx = GAZE_OUTLIER_PX,
  correction = null,
} = {}) {
  let displayX = null;
  let displayY = null;
  let targetX = null;
  let targetY = null;
  let correctionFn = correction;
  const rawBuffer = [];

  const applyCorrection = (rawX, rawY) => {
    if (!correctionFn) return { x: rawX, y: rawY };
    return correctionFn(rawX, rawY);
  };

  const stepAxis = (display, target) => {
    const delta = target - display;
    const absDelta = Math.abs(delta);
    if (absDelta < deadZonePx) return display;

    let step = delta * followFactor;
    if (step > maxStepPx) step = maxStepPx;
    if (step < -maxStepPx) step = -maxStepPx;

    return display + step;
  };

  return {
    setCorrection(nextCorrection) {
      correctionFn = nextCorrection || null;
    },
    reset(x, y) {
      rawBuffer.length = 0;
      rawBuffer.push({ x, y });

      const corrected = applyCorrection(x, y);
      displayX = corrected.x;
      displayY = corrected.y;
      targetX = corrected.x;
      targetY = corrected.y;
    },
    pushRaw(rawX, rawY) {
      if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return;

      rawBuffer.push({ x: rawX, y: rawY });
      if (rawBuffer.length > medianWindow) {
        rawBuffer.shift();
      }

      const filtered = medianPoint(rawBuffer);
      if (!filtered) return;

      const corrected = applyCorrection(filtered.x, filtered.y);
      const isFirstSample = displayX === null || displayY === null;

      if (!isFirstSample && targetX != null && targetY != null) {
        const jump = distance(corrected.x, corrected.y, targetX, targetY);
        if (jump > outlierPx) return;
      }

      targetX = corrected.x;
      targetY = corrected.y;

      if (isFirstSample) {
        displayX = targetX;
        displayY = targetY;
      }
    },
    step() {
      if (displayX === null || displayY === null || targetX === null || targetY === null) {
        return null;
      }

      displayX = stepAxis(displayX, targetX);
      displayY = stepAxis(displayY, targetY);

      if (typeof window !== 'undefined') {
        displayX = clamp(displayX, 0, window.innerWidth);
        displayY = clamp(displayY, 0, window.innerHeight);
      }

      return { x: displayX, y: displayY };
    },
  };
}

export async function recordCalibrationPoint({
  webgazer,
  point,
  hasFaceLandmarks,
  getLastRawGaze,
}) {
  const screenX = point.x * window.innerWidth;
  const screenY = point.y * window.innerHeight;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (hasFaceLandmarks(webgazer)) break;
    await sleep(40);
  }

  if (!hasFaceLandmarks(webgazer)) {
    return { ok: false, reason: 'face' };
  }

  for (let i = 0; i < CALIBRATION_SAMPLE_COUNT; i += 1) {
    if (hasFaceLandmarks(webgazer)) {
      webgazer.recordScreenPosition(screenX, screenY, 'click');
    }
    await sleep(CALIBRATION_SAMPLE_INTERVAL_MS);
  }

  await sleep(180);

  const rawSamples = [];
  for (let i = 0; i < CALIBRATION_MEASURE_COUNT; i += 1) {
    const raw = getLastRawGaze();
    if (raw) rawSamples.push(raw);
    await sleep(CALIBRATION_MEASURE_INTERVAL_MS);
  }

  const avgRaw = averagePoints(rawSamples);
  if (!avgRaw) {
    return { ok: false, reason: 'measure' };
  }

  return {
    ok: true,
    pair: {
      targetX: screenX,
      targetY: screenY,
      rawX: avgRaw.x,
      rawY: avgRaw.y,
    },
  };
}
