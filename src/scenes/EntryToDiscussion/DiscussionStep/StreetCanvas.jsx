import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  GAZE_LIKE_DURATION_MS,
  GAZE_PIN_DURATION_MS,
  PIN_HIT_RADIUS_PX,
  STREET_IMAGE,
} from '../gazeConfig';
import OpinionPin from './OpinionPin';
import styles from './StreetCanvas.module.css';

function summarizeText(text) {
  const trimmed = text.trim();
  if (!trimmed) return '의견';
  if (trimmed.length <= 48) return trimmed;
  return `${trimmed.slice(0, 46)}…`;
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
    pendingSpeechText,
    currentViewerId = 'viewer-1',
  },
  ref
) {
  const canvasRef = useRef(null);
  const pinRefs = useRef({});
  const pendingPinRef = useRef(null);
  const likeDwellRef = useRef({ pinId: null, since: 0 });
  const [pendingCircle, setPendingCircle] = useState(null);
  const [, setTick] = useState(0);

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

  const findPinAtScreen = useCallback((x, y) => {
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
  }, [pins]);

  const finalizePin = useCallback(
    (normCoords, text) => {
      const summary = summarizeText(text || pendingSpeechText || '');
      if (!summary || summary === '의견') return;

      onAddPin?.({
        id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        x: normCoords.x,
        y: normCoords.y,
        text: summary,
        authorViewerId: currentViewerId,
        likeCount: 0,
        likedBy: new Set(),
      });

      pendingPinRef.current = null;
      setPendingCircle(null);
    },
    [onAddPin, pendingSpeechText, currentViewerId]
  );

  const handleGaze = useCallback(
    (viewerId, x, y) => {
      let dwellProgress = 0;

      const hitPin = findPinAtScreen(x, y);
      if (hitPin) {
        pendingPinRef.current = null;
        setPendingCircle(null);

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

      const norm = screenToNormalized(x, y);
      if (!norm) {
        pendingPinRef.current = null;
        setPendingCircle(null);
        return { dwellProgress: 0, target: null };
      }

      const pending = pendingPinRef.current;
      if (pending && distance(pending.x, pending.y, norm.x, norm.y) < 0.04) {
        const elapsed = Date.now() - pending.since;
        dwellProgress = Math.min(1, elapsed / GAZE_PIN_DURATION_MS);
        setPendingCircle({ x: norm.x, y: norm.y, progress: dwellProgress });

        if (elapsed >= GAZE_PIN_DURATION_MS) {
          finalizePin(norm, pendingSpeechText);
        }
      } else {
        pendingPinRef.current = { x: norm.x, y: norm.y, since: Date.now() };
        setPendingCircle({ x: norm.x, y: norm.y, progress: 0 });
      }

      return { dwellProgress, target: 'canvas' };
    },
    [findPinAtScreen, screenToNormalized, onLikePin, finalizePin, pendingSpeechText]
  );

  useEffect(() => {
    registerGazeHandler?.('discussion', handleGaze);
    return () => registerGazeHandler?.('discussion', null);
  }, [handleGaze, registerGazeHandler]);

  useEffect(() => {
    const interval = setInterval(() => setTick((v) => v + 1), 100);
    return () => clearInterval(interval);
  }, []);

  useImperativeHandle(ref, () => ({
    submitManualAtPending(text) {
      const pending = pendingPinRef.current;
      if (!pending || !text?.trim()) return false;
      finalizePin({ x: pending.x, y: pending.y }, text);
      return true;
    },
  }));

  return (
    <div className={styles.canvasWrapper}>
      <div className={styles.canvas} ref={canvasRef}>
        <img src={STREET_IMAGE} alt="토론 대상 거리" className={styles.image} draggable={false} />
        {pendingCircle && (
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
