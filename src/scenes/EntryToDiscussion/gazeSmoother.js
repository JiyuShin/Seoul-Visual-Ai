export const GAZE_MEDIAN_WINDOW = 2;
export const GAZE_LOCK_SAMPLE_COUNT = 22;
export const GAZE_LOCK_ENTER_SPREAD_PX = 16;
export const GAZE_LOCK_BREAK_SPREAD_PX = 34;
export const GAZE_LOCK_ENTER_FRAMES = 3;
export const GAZE_LOCK_BREAK_FRAMES = 8;
export const GAZE_LOCK_BREAK_DISTANCE_PX = 65;

export const GAZE_ONE_EURO_MIN_CUTOFF = 1.5;
export const GAZE_ONE_EURO_BETA = 0.08;
export const GAZE_ONE_EURO_D_CUTOFF = 1.0;
export const GAZE_MICRO_DEADZONE_PX = 0;
export const GAZE_GLIDE_DEADZONE_PX = 2;
export const GAZE_SACCADE_THRESHOLD_PX = 22;
export const GAZE_GLIDE_FOLLOW_FAST = 0.32;
export const GAZE_GLIDE_FOLLOW_SLOW = 0.19;
export const GAZE_GLIDE_MAX_STEP_FAST = 10;
export const GAZE_GLIDE_MAX_STEP_SLOW = 5;
export const GAZE_DISPLAY_MAX_STEP = 200;
export const GAZE_DISPLAY_MIN_STEP = 3;
export const GAZE_DISPLAY_EASE = 0.6;

export const GAZE_TAG_PLACEMENT_MEDIAN_WINDOW = 2;
export const GAZE_TAG_PLACEMENT_ONE_EURO_MIN_CUTOFF = 1.2;
export const GAZE_TAG_PLACEMENT_ONE_EURO_BETA = 0.06;
export const GAZE_TAG_PLACEMENT_MICRO_DEADZONE_PX = 0;
export const GAZE_TAG_PLACEMENT_GLIDE_DEADZONE_PX = 2;
export const GAZE_TAG_PLACEMENT_GLIDE_FOLLOW_SLOW = 0.14;
export const GAZE_TAG_PLACEMENT_GLIDE_MAX_STEP_SLOW = 3;
export const GAZE_TAG_PLACEMENT_DISPLAY_MAX_STEP = 150;
export const GAZE_TAG_PLACEMENT_DISPLAY_MIN_STEP = 2;
export const GAZE_TAG_PLACEMENT_DISPLAY_EASE = 0.5;

export const CALIBRATION_POINTS = [
  { x: 0.1, y: 0.1 },
  { x: 0.5, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.1, y: 0.5 },
  { x: 0.9, y: 0.5 },
  { x: 0.1, y: 0.9 },
  { x: 0.5, y: 0.9 },
  { x: 0.9, y: 0.9 },
  { x: 0.5, y: 0.5 },
];

export const CALIBRATION_SAMPLE_COUNT = 20;
export const CALIBRATION_SAMPLE_INTERVAL_MS = 40;
export const CALIBRATION_SETTLE_MS = 250;
export const MIN_CALIBRATION_POINTS = CALIBRATION_POINTS.length;

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

function spreadFromCenter(points, center) {
  if (!points.length || !center) return Infinity;
  return Math.max(...points.map((p) => distance(p.x, p.y, center.x, center.y)));
}

function moveTowardPoint(currentX, currentY, targetX, targetY, maxStep, minStep, ease) {
  const errX = targetX - currentX;
  const errY = targetY - currentY;
  const errDist = Math.hypot(errX, errY);
  if (errDist < 1) {
    return { x: targetX, y: targetY };
  }

  const step = Math.min(maxStep, Math.max(minStep, errDist * ease));
  const ratio = step / errDist;
  return {
    x: currentX + errX * ratio,
    y: currentY + errY * ratio,
  };
}

function createOneEuroAxis({ minCutoff, beta, dCutoff }) {
  let value = null;
  let derivative = 0;
  let lastTime = null;

  const alpha = (cutoff, dt) => {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  };

  return {
    reset(next) {
      value = next;
      derivative = 0;
      lastTime = null;
    },
    filter(sample, timestampMs) {
      if (value === null || !Number.isFinite(sample)) {
        value = sample;
        lastTime = timestampMs;
        return sample;
      }

      const dt = Math.max(0.001, (timestampMs - lastTime) / 1000);
      lastTime = timestampMs;

      const rawDerivative = (sample - value) / dt;
      derivative += alpha(dCutoff, dt) * (rawDerivative - derivative);

      const cutoff = minCutoff + beta * Math.abs(derivative);
      value += alpha(cutoff, dt) * (sample - value);
      return value;
    },
  };
}

export function createGazePipeline({
  medianWindow = GAZE_MEDIAN_WINDOW,
  lockSampleCount = GAZE_LOCK_SAMPLE_COUNT,
  lockEnterSpreadPx = GAZE_LOCK_ENTER_SPREAD_PX,
  lockBreakSpreadPx = GAZE_LOCK_BREAK_SPREAD_PX,
  lockEnterFrames = GAZE_LOCK_ENTER_FRAMES,
  lockBreakFrames = GAZE_LOCK_BREAK_FRAMES,
  lockBreakDistancePx = GAZE_LOCK_BREAK_DISTANCE_PX,
  minCutoff = GAZE_ONE_EURO_MIN_CUTOFF,
  beta = GAZE_ONE_EURO_BETA,
  dCutoff = GAZE_ONE_EURO_D_CUTOFF,
  microDeadzonePx = GAZE_MICRO_DEADZONE_PX,
  glideDeadzonePx = GAZE_GLIDE_DEADZONE_PX,
  saccadeThresholdPx = GAZE_SACCADE_THRESHOLD_PX,
  glideFollowFast = GAZE_GLIDE_FOLLOW_FAST,
  glideFollowSlow = GAZE_GLIDE_FOLLOW_SLOW,
  glideMaxStepFast = GAZE_GLIDE_MAX_STEP_FAST,
  glideMaxStepSlow = GAZE_GLIDE_MAX_STEP_SLOW,
  displayMaxStep = GAZE_DISPLAY_MAX_STEP,
  displayMinStep = GAZE_DISPLAY_MIN_STEP,
  displayEase = GAZE_DISPLAY_EASE,
} = {}) {
  let displayX = null;
  let displayY = null;
  let glideTargetX = null;
  let glideTargetY = null;
  let latestGazeX = null;
  let latestGazeY = null;
  let stableFrameCount = 0;
  let breakFrameCount = 0;
  let isLocked = false;
  let lockPoint = null;
  let tagPlacementMode = false;
  let clipRect = null;
  const rawBuffer = [];
  const smoothBuffer = [];

  const defaultRuntime = {
    microDeadzonePx,
    glideDeadzonePx,
    glideFollowSlow,
    glideMaxStepSlow,
    displayMaxStep,
    displayMinStep,
    displayEase,
    medianWindow,
    lockEnabled: false,
    roundOutput: false,
  };

  const tagRuntime = {
    microDeadzonePx: GAZE_TAG_PLACEMENT_MICRO_DEADZONE_PX,
    glideDeadzonePx: GAZE_TAG_PLACEMENT_GLIDE_DEADZONE_PX,
    glideFollowSlow: GAZE_TAG_PLACEMENT_GLIDE_FOLLOW_SLOW,
    glideMaxStepSlow: GAZE_TAG_PLACEMENT_GLIDE_MAX_STEP_SLOW,
    displayMaxStep: GAZE_TAG_PLACEMENT_DISPLAY_MAX_STEP,
    displayMinStep: GAZE_TAG_PLACEMENT_DISPLAY_MIN_STEP,
    displayEase: GAZE_TAG_PLACEMENT_DISPLAY_EASE,
    medianWindow: GAZE_TAG_PLACEMENT_MEDIAN_WINDOW,
    lockEnabled: false,
    roundOutput: false,
  };

  let runtime = { ...defaultRuntime };

  const filterX = createOneEuroAxis({ minCutoff, beta, dCutoff });
  const filterY = createOneEuroAxis({ minCutoff, beta, dCutoff });
  const tagFilterX = createOneEuroAxis({
    minCutoff: GAZE_TAG_PLACEMENT_ONE_EURO_MIN_CUTOFF,
    beta: GAZE_TAG_PLACEMENT_ONE_EURO_BETA,
    dCutoff,
  });
  const tagFilterY = createOneEuroAxis({
    minCutoff: GAZE_TAG_PLACEMENT_ONE_EURO_MIN_CUTOFF,
    beta: GAZE_TAG_PLACEMENT_ONE_EURO_BETA,
    dCutoff,
  });

  const stepAxis = (display, target, follow, maxStep) => {
    const delta = target - display;
    if (Math.abs(delta) < 0.5) return display;

    let step = delta * follow;
    if (step > maxStep) step = maxStep;
    if (step < -maxStep) step = -maxStep;

    return display + step;
  };

  const updateGlideTarget = (targetX, targetY) => {
    if (glideTargetX === null || glideTargetY === null) {
      glideTargetX = targetX;
      glideTargetY = targetY;
      return;
    }

    const glideDrift = distance(glideTargetX, glideTargetY, targetX, targetY);
    if (glideDrift < runtime.glideDeadzonePx) return;

    const isSaccade = glideDrift >= saccadeThresholdPx;
    const follow = isSaccade ? glideFollowFast : runtime.glideFollowSlow;
    const maxStep = isSaccade ? glideMaxStepFast : runtime.glideMaxStepSlow;

    glideTargetX = stepAxis(glideTargetX, targetX, follow, maxStep);
    glideTargetY = stepAxis(glideTargetY, targetY, follow, maxStep);
  };

  const breakLock = () => {
    stableFrameCount = 0;
    breakFrameCount = 0;
    isLocked = false;
    lockPoint = null;
  };

  const computeLockPoint = () => {
    const point = medianPoint(rawBuffer.slice(-lockSampleCount));
    if (!point) return null;
    return { x: Math.round(point.x), y: Math.round(point.y) };
  };

  const pushSmoothedSample = (point, timestampMs) => {
    const filtered = {
      x: filterX.filter(point.x, timestampMs),
      y: filterY.filter(point.y, timestampMs),
    };

    smoothBuffer.push(filtered);
    if (smoothBuffer.length > medianWindow) {
      smoothBuffer.shift();
    }

    return filtered;
  };

  return {
    getIsLocked() {
      return isLocked;
    },
    setTagPlacementMode(active) {
      tagPlacementMode = Boolean(active);
      runtime = tagPlacementMode ? tagRuntime : defaultRuntime;
      breakLock();
      if (tagPlacementMode && latestGazeX !== null && latestGazeY !== null) {
        tagFilterX.reset(latestGazeX);
        tagFilterY.reset(latestGazeY);
      }
    },
    setGazeClipRect(rect) {
      clipRect = rect || null;
      if (clipRect && displayX !== null && displayY !== null) {
        displayX = clamp(displayX, clipRect.left, clipRect.right);
        displayY = clamp(displayY, clipRect.top, clipRect.bottom);
      }
    },
    reset(x, y) {
      rawBuffer.length = 0;
      smoothBuffer.length = 0;
      rawBuffer.push({ x, y });
      breakLock();
      filterX.reset(x);
      filterY.reset(y);
      displayX = x;
      displayY = y;
      glideTargetX = x;
      glideTargetY = y;
      latestGazeX = x;
      latestGazeY = y;
    },
    pushRaw(rawX, rawY, timestampMs = Date.now()) {
      if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return;

      // 간단한 2-프레임 평균만 적용
      rawBuffer.push({ x: rawX, y: rawY });
      if (rawBuffer.length > 3) {
        rawBuffer.shift();
      }

      // 최근 2개 값의 평균
      const recent = rawBuffer.slice(-2);
      const avgX = recent.reduce((sum, p) => sum + p.x, 0) / recent.length;
      const avgY = recent.reduce((sum, p) => sum + p.y, 0) / recent.length;

      latestGazeX = avgX;
      latestGazeY = avgY;

      if (clipRect) {
        latestGazeX = clamp(latestGazeX, clipRect.left, clipRect.right);
        latestGazeY = clamp(latestGazeY, clipRect.top, clipRect.bottom);
      }
    },
    step() {
      if (latestGazeX === null || latestGazeY === null) {
        return null;
      }

      // 필터 없이 시선 좌표를 직접 따라감 (약간의 스무딩만 적용)
      if (displayX === null || displayY === null) {
        displayX = latestGazeX;
        displayY = latestGazeY;
      } else {
        // 80% 비율로 새 좌표를 따라감
        displayX = displayX + (latestGazeX - displayX) * 0.8;
        displayY = displayY + (latestGazeY - displayY) * 0.8;
      }

      if (clipRect) {
        displayX = clamp(displayX, clipRect.left, clipRect.right);
        displayY = clamp(displayY, clipRect.top, clipRect.bottom);
      } else if (typeof window !== 'undefined') {
        displayX = clamp(displayX, 0, window.innerWidth);
        displayY = clamp(displayY, 0, window.innerHeight);
      }

      return {
        x: Math.round(displayX),
        y: Math.round(displayY),
        locked: false,
      };
    },
  };
}

export async function recordCalibrationPoint({ webgazer, point, hasFaceLandmarks }) {
  const screenX = point.x * window.innerWidth;
  const screenY = point.y * window.innerHeight;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (hasFaceLandmarks(webgazer)) break;
    await sleep(40);
  }

  if (!hasFaceLandmarks(webgazer)) {
    return { ok: false, reason: 'face' };
  }

  await sleep(CALIBRATION_SETTLE_MS);

  for (let i = 0; i < CALIBRATION_SAMPLE_COUNT; i += 1) {
    if (hasFaceLandmarks(webgazer)) {
      webgazer.recordScreenPosition(screenX, screenY, 'click');
    }
    await sleep(CALIBRATION_SAMPLE_INTERVAL_MS);
  }

  return { ok: true };
}
