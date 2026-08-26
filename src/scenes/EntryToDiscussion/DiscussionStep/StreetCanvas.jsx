import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  GAZE_LIKE_DURATION_MS,
  GAZE_PIN_DURATION_MS,
  GAZE_TAG_DWELL_GRACE_MS,
  GAZE_TAG_DWELL_TOLERANCE,
  PIN_HIT_RADIUS_PX,
  STREET_IMAGE,
} from '../gazeConfig';
import LocationTag from './LocationTag';
import OpinionPin from './OpinionPin';
import styles from './StreetCanvas.module.css';

function normalizePinText(text) {
  return text
    .trim()
    .replace(/[\r\n]+/g, '')
    .replace(/\s+/g, ' ');
}

function summarizeText(text) {
  const normalized = normalizePinText(text);
  if (!normalized) return '';
  return normalized;
}

function distance(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

export default forwardRef(function StreetCanvas(
  {
    pins,
    onAddPin,
    onLikePin,
    registerGazeHandler,
    phase = 'idle',
    activeTag = null,
    onTagLocked,
    onCanvasRect,
    currentViewerId = 'viewer-1',
  },
  ref
) {
  const canvasRef = useRef(null);
  const pinRefs = useRef({});
  const pendingPinRef = useRef(null);
  const likeDwellRef = useRef({ pinId: null, since: 0 });
  const phaseRef = useRef(phase);
  const activeTagRef = useRef(activeTag);
  const [pendingCircle, setPendingCircle] = useState(null);
  const [, setTick] = useState(0);

  phaseRef.current = phase;
  activeTagRef.current = activeTag;

  const screenToNormalized = useCallback((x, y) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      return null;
    }
    return {
      x: (x - rect.left) / rect.width,
      y: (y - rect.top) / rect.height,
    };
  }, []);

  const findPinAtScreen = useCallback(
    (x, y) => {
      for (const pin of pins) {
        const el = pinRefs.current[pin.id];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        if (distance(x, y, cx, cy) < PIN_HIT_RADIUS_PX) {
          return pin;
        }
      }
      return null;
    },
    [pins]
  );

  const clearPendingCircle = useCallback(() => {
    pendingPinRef.current = null;
    setPendingCircle(null);
  }, []);

  const finalizePin = useCallback(
    (normCoords, text) => {
      const summary = summarizeText(text);
      if (!summary) return false;

      onAddPin?.({
        id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        x: normCoords.x,
        y: normCoords.y,
        text: summary,
        authorViewerId: currentViewerId,
        likeCount: 0,
        likedBy: new Set(),
      });

      clearPendingCircle();
      return true;
    },
    [onAddPin, currentViewerId, clearPendingCircle]
  );

  const placeAtActiveTag = useCallback(
    (text) => {
      const tag = activeTagRef.current;
      if (!tag || phaseRef.current !== 'voice') return false;
      return finalizePin({ x: tag.x, y: tag.y }, text);
    },
    [finalizePin]
  );

  const handleGaze = useCallback(
    (viewerId, x, y) => {
      let dwellProgress = 0;

      const hitPin = findPinAtScreen(x, y);
      if (hitPin) {
        clearPendingCircle();

        if (hitPin.authorViewerId !== viewerId && !hitPin.likedBy.has(viewerId)) {
          const likeActive = likeDwellRef.current;
          if (likeActive.pinId === hitPin.id) {
            const elapsed = Date.now() - likeActive.since;
            dwellProgress = Math.min(1, elapsed / GAZE_LIKE_DURATION_MS);
            if (elapsed >= GAZE_LIKE_DURATION_MS) {
              onLikePin?.(hitPin.id, viewerId);
              likeDwellRef.current = { pinId: null, since: 0 };
            }
          } else {
            likeDwellRef.current = { pinId: hitPin.id, since: Date.now() };
          }
        } else {
          likeDwellRef.current = { pinId: null, since: 0 };
        }

        return { dwellProgress, target: 'pin' };
      }

      likeDwellRef.current = { pinId: null, since: 0 };

      if (phaseRef.current !== 'gaze') {
        clearPendingCircle();
        return { dwellProgress: 0, target: null };
      }

      const norm = screenToNormalized(x, y);
      if (!norm) {
        clearPendingCircle();
        return { dwellProgress: 0, target: null };
      }

      const pending = pendingPinRef.current;
      const now = Date.now();

      const isInZone = (anchor) =>
        distance(anchor.anchorX, anchor.anchorY, norm.x, norm.y) < GAZE_TAG_DWELL_TOLERANCE;

      if (pending && isInZone(pending)) {
        pending.lastInZoneAt = now;
      }

      const stillInZone =
        pending &&
        (isInZone(pending) || now - pending.lastInZoneAt <= GAZE_TAG_DWELL_GRACE_MS);

      if (stillInZone) {
        pendingPinRef.current = {
          ...pending,
          anchorX: norm.x,
          anchorY: norm.y,
          lastInZoneAt: now,
        };

        const elapsed = now - pending.since;
        dwellProgress = Math.min(1, elapsed / GAZE_PIN_DURATION_MS);
        setPendingCircle({
          x: norm.x,
          y: norm.y,
          progress: dwellProgress,
          locked: false,
        });

        if (elapsed >= GAZE_PIN_DURATION_MS) {
          clearPendingCircle();
          onTagLocked?.({ x: norm.x, y: norm.y });
        }
      } else {
        pendingPinRef.current = {
          anchorX: norm.x,
          anchorY: norm.y,
          since: now,
          lastInZoneAt: now,
        };
        setPendingCircle({ x: norm.x, y: norm.y, progress: 0, locked: false });
      }

      return { dwellProgress, target: 'canvas' };
    },
    [findPinAtScreen, screenToNormalized, onLikePin, onTagLocked, clearPendingCircle]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onCanvasRect) return undefined;

    const publishRect = () => {
      onCanvasRect(canvas.getBoundingClientRect());
    };

    publishRect();
    window.addEventListener('resize', publishRect);
    window.addEventListener('scroll', publishRect, true);

    const observer = new ResizeObserver(publishRect);
    observer.observe(canvas);

    return () => {
      window.removeEventListener('resize', publishRect);
      window.removeEventListener('scroll', publishRect, true);
      observer.disconnect();
    };
  }, [onCanvasRect]);

  useEffect(() => {
    if (phase === 'idle') {
      registerGazeHandler?.('discussion', null);
      return undefined;
    }
    registerGazeHandler?.('discussion', handleGaze);
    return () => registerGazeHandler?.('discussion', null);
  }, [handleGaze, registerGazeHandler, phase]);

  useEffect(() => {
    if (phase !== 'gaze') {
      clearPendingCircle();
    }
  }, [phase, clearPendingCircle]);

  useEffect(() => {
    const interval = setInterval(() => setTick((v) => v + 1), 100);
    return () => clearInterval(interval);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      placePinWithText(text) {
        return placeAtActiveTag(text);
      },
    }),
    [placeAtActiveTag]
  );

  return (
    <div className={styles.canvasWrapper}>
      <div className={styles.canvas} ref={canvasRef}>
        <div className={styles.imageFrame}>
          <img src={STREET_IMAGE} alt="토론 대상 거리" className={styles.image} draggable={false} />
        </div>
        {pendingCircle && phase === 'gaze' && (
          <div
            className={styles.pendingCircle}
            style={{
              left: `${pendingCircle.x * 100}%`,
              top: `${pendingCircle.y * 100}%`,
              opacity: 0.4 + pendingCircle.progress * 0.6,
              transform: `translate(-50%, -50%) scale(${1 + pendingCircle.progress * 0.3})`,
            }}
          />
        )}
        {phase === 'voice' && activeTag && (
          <LocationTag x={activeTag.x} y={activeTag.y} label="선택됨" />
        )}
        {pins.map((pin) => (
          <OpinionPin
            key={pin.id}
            pin={pin}
            onRef={(el) => {
              pinRefs.current[pin.id] = el;
            }}
          />
        ))}
      </div>
    </div>
  );
});
