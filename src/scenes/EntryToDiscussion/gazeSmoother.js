export const GAZE_SMOOTH_FACTOR = 0.07;
export const GAZE_MAX_SPEED_PX = 10;
export const GAZE_DEAD_ZONE_PX = 5;

export const CALIBRATION_POINTS = [
  { x: 0.1, y: 0.1 },
  { x: 0.5, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.1, y: 0.5 },
  { x: 0.5, y: 0.5 },
  { x: 0.9, y: 0.5 },
  { x: 0.1, y: 0.9 },
  { x: 0.5, y: 0.9 },
  { x: 0.9, y: 0.9 },
];

export const CALIBRATION_DWELL_MS = 2500;
export const CALIBRATION_SAMPLE_INTERVAL_MS = 450;
export const MIN_CALIBRATION_POINTS = 5;

export function createGazeSmoother({
  smoothFactor = GAZE_SMOOTH_FACTOR,
  maxSpeed = GAZE_MAX_SPEED_PX,
  deadZone = GAZE_DEAD_ZONE_PX,
} = {}) {
  let x = null;
  let y = null;
  let lastTime = null;

  return {
    reset(nx, ny) {
      x = nx;
      y = ny;
      lastTime = null;
    },
    update(targetX, targetY, now = performance.now()) {
      if (x === null || y === null) {
        x = targetX;
        y = targetY;
        lastTime = now;
        return { x, y };
      }

      const dt = lastTime ? Math.min(40, now - lastTime) : 16;
      lastTime = now;

      let dx = targetX - x;
      let dy = targetY - y;
      const distance = Math.hypot(dx, dy);

      if (distance < deadZone) {
        return { x, y };
      }

      const frameFactor = smoothFactor * (dt / 16);
      dx *= frameFactor;
      dy *= frameFactor;

      const moveDistance = Math.hypot(dx, dy);
      const maxMove = maxSpeed * (dt / 16);
      if (moveDistance > maxMove) {
        const scale = maxMove / moveDistance;
        dx *= scale;
        dy *= scale;
      }

      x += dx;
      y += dy;

      if (typeof window !== 'undefined') {
        x = Math.max(0, Math.min(window.innerWidth, x));
        y = Math.max(0, Math.min(window.innerHeight, y));
      }

      return { x, y };
    },
  };
}
