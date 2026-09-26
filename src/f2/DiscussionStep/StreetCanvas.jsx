import { useCallback, useEffect, useRef, useState } from 'react';
import { useEntryFlow } from '../../shared/EntryFlowContext';
import StreetPanorama from './StreetPanorama';
import styles from './StreetCanvas.module.css';

const PLANT_DWELL_MS = 3000;
const PLANT_STILL = 0.06;
const PLANT_GRACE_MS = 260;

function distance(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function lineText(line) {
  return typeof line === 'string' ? line : line?.text || '';
}

export default function StreetCanvas({
  imageUrl,
  pendingLabel,
  yawSpan = 360,
  zoom = 1,
  registerGazeHandler,
  phase = 'idle',
  activeViewerId,
  marks = [],
  onPlant,
  onCanvasRect,
  revealed = true,
  repeatDwell = false,
}) {
  const canvasRef = useRef(null);
  const panoramaRef = useRef(null);
  const markRefs = useRef({});
  const lookRef = useRef(null);
  const pendingRef = useRef(null);
  const phaseRef = useRef(phase);
  const plantedRef = useRef(false);
  const repeatRef = useRef(repeatDwell);
  const cooldownRef = useRef(0);
  const onPlantRef = useRef(onPlant);
  const marksRef = useRef(marks);
  const viewerRef = useRef(activeViewerId);
  const { gazeRef } = useEntryFlow();
  const [pendingCircle, setPendingCircle] = useState(null);

  viewerRef.current = activeViewerId;

  phaseRef.current = phase;
  repeatRef.current = repeatDwell;
  onPlantRef.current = onPlant;
  marksRef.current = marks;

  const screenToNormalized = useCallback((x, y) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
    return {
      x: (x - rect.left) / rect.width,
      y: (y - rect.top) / rect.height,
    };
  }, []);

  const clearPending = useCallback(() => {
    pendingRef.current = null;
    setPendingCircle(null);
  }, []);

  const hitMark = useCallback((x, y) => {
    for (const mark of marksRef.current) {
      const el = markRefs.current[mark.id];
      if (!el || el.style.opacity === '0') continue;
      const box = el.getBoundingClientRect();
      const pad = 28;
      if (x >= box.left - pad && x <= box.right + pad && y >= box.top - pad && y <= box.bottom + pad) {
        return mark.id;
      }
    }
    return null;
  }, []);

  const finishPlant = useCallback((anchorX, anchorY) => {
    if (phaseRef.current !== 'gaze') return;
    const now = Date.now();
    if (repeatRef.current) {
      if (now < cooldownRef.current) return;
      cooldownRef.current = now + 900;
    } else if (plantedRef.current) {
      return;
    } else {
      plantedRef.current = true;
    }

    const lockedId = pendingRef.current?.markId || null;
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    const markId = lockedId || (rect
      ? hitMark(rect.left + anchorX * rect.width, rect.top + anchorY * rect.height)
      : null);
    const direction = panoramaRef.current?.directionAt(anchorX, anchorY) || [0, 0, 1];
    clearPending();
    onPlantRef.current?.({ direction, nx: anchorX, ny: anchorY, markId });
  }, [clearPending, hitMark]);

  const applyPoint = useCallback((x, y) => {
      const norm = screenToNormalized(x, y);
      if (norm) lookRef.current = { nx: norm.x, ny: norm.y };
      if (!norm || phaseRef.current !== 'gaze' || (!repeatRef.current && plantedRef.current)) {
        if (phaseRef.current !== 'gaze') clearPending();
        return { dwellProgress: 0, target: null };
      }

      const now = Date.now();
      const pending = pendingRef.current;
      const inZone = (anchor) =>
        distance(anchor.anchorX, anchor.anchorY, norm.x, norm.y) < PLANT_STILL;

      if (pending && inZone(pending)) pending.lastInZoneAt = now;
      const still =
        pending && (inZone(pending) || now - pending.lastInZoneAt <= PLANT_GRACE_MS);

      if (!still) {
        pendingRef.current = {
          anchorX: norm.x,
          anchorY: norm.y,
          since: now,
          lastInZoneAt: now,
          markId: hitMark(x, y),
        };
        setPendingCircle({ x: norm.x, y: norm.y, progress: 0 });
        return { dwellProgress: 0, target: 'canvas' };
      }

      pendingRef.current = {
        ...pending,
        anchorX: norm.x,
        anchorY: norm.y,
        lastInZoneAt: now,
      };
      const elapsed = now - pending.since;
      const dwellProgress = Math.min(1, elapsed / PLANT_DWELL_MS);
      setPendingCircle({ x: norm.x, y: norm.y, progress: dwellProgress });
      return { dwellProgress, target: 'canvas' };
  }, [clearPending, hitMark, screenToNormalized]);

  const handleGaze = useCallback(
    (viewerId, x, y) => {
      if (viewerId !== activeViewerId) return { dwellProgress: 0, target: null };
      if (typeof window !== 'undefined' && window.__seoulPointerOwnsGaze > performance.now()) {
        return { dwellProgress: 0, target: null };
      }
      return applyPoint(x, y);
    },
    [activeViewerId, applyPoint]
  );

  useEffect(() => {
    const onMove = (event) => {
      if (event.pointerType === 'touch') return;
      window.__seoulPointerOwnsGaze = performance.now() + 4500;
      const viewerId = viewerRef.current;
      if (gazeRef.current && viewerId) {
        gazeRef.current[viewerId] = { x: event.clientX, y: event.clientY, at: Date.now() };
      }
      applyPoint(event.clientX, event.clientY);
    };
    window.addEventListener('pointermove', onMove, true);
    return () => window.removeEventListener('pointermove', onMove, true);
  }, [applyPoint, gazeRef]);

  useEffect(() => {
    plantedRef.current = false;
    if (phase !== 'gaze') {
      clearPending();
      return;
    }
    const sample = gazeRef.current?.[viewerRef.current];
    if (sample) applyPoint(sample.x, sample.y);
  }, [phase, repeatDwell, clearPending, applyPoint, gazeRef]);

  useEffect(() => {
    if (phase !== 'gaze') return undefined;
    let frame = 0;
    let lastPaint = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const pending = pendingRef.current;
      if (!pending || (!repeatRef.current && plantedRef.current)) return;
      const elapsed = Date.now() - pending.since;
      const progress = Math.min(1, elapsed / PLANT_DWELL_MS);
      const now = Date.now();
      if (now - lastPaint > 70) {
        lastPaint = now;
        setPendingCircle((prev) => {
          if (!prev) return prev;
          if (Math.abs((prev.progress || 0) - progress) < 0.025 && progress < 1) return prev;
          return { x: pending.anchorX, y: pending.anchorY, progress };
        });
      }
      if (elapsed >= PLANT_DWELL_MS) finishPlant(pending.anchorX, pending.anchorY);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, finishPlant]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onCanvasRect) return undefined;
    const publishRect = () => onCanvasRect(canvas.getBoundingClientRect());
    publishRect();
    const observer = new ResizeObserver(publishRect);
    observer.observe(canvas);
    window.addEventListener('resize', publishRect);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', publishRect);
    };
  }, [onCanvasRect]);

  useEffect(() => {
    if (phase === 'idle') {
      registerGazeHandler?.('discussion', null);
      return undefined;
    }
    registerGazeHandler?.('discussion', handleGaze);
    return () => registerGazeHandler?.('discussion', null);
  }, [handleGaze, phase, registerGazeHandler]);

  return (
    <div className={styles.canvasWrapper}>
      <div className={styles.canvas} ref={canvasRef}>
        <div className={`${styles.imageFrame} ${revealed ? '' : styles.imageVeiled}`}>
          {imageUrl ? (
            <StreetPanorama
              ref={panoramaRef}
              imageUrl={imageUrl}
              yawSpan={yawSpan}
              zoom={zoom}
              lookRef={lookRef}
              markRefs={markRefs}
              marks={marks}
            />
          ) : (
            <div className={styles.pendingScene}>
              <p>{pendingLabel} 거리뷰는 아직 제작 중입니다.</p>
            </div>
          )}
        </div>
        {pendingCircle && phase === 'gaze' && pendingCircle.progress > 0.02 && (
          <div
            className={styles.pendingRing}
            style={{
              left: `${pendingCircle.x * 100}%`,
              top: `${pendingCircle.y * 100}%`,
              background: `conic-gradient(rgba(255,255,255,0.95) ${pendingCircle.progress * 360}deg, rgba(255,255,255,0.18) 0deg)`,
              opacity: 0.35 + pendingCircle.progress * 0.55,
            }}
          />
        )}
        {marks.map((mark) => {
          const replies = mark.lines.slice(1);
          return (
            <div
              key={mark.id}
              ref={(el) => {
                markRefs.current[mark.id] = el;
              }}
              className={`${styles.plantMark} ${mark.cam === 'B' ? styles.markB : styles.markA} ${(mark.ny ?? 0.5) > 0.62 ? styles.plantAbove : ''}`}
              style={{
                left: `${(mark.nx ?? 0.5) * 100}%`,
                top: `${(mark.ny ?? 0.5) * 100}%`,
              }}
            >
              <span className={styles.badge}>
                <img
                  className={styles.badgeRing}
                  src={mark.cam === 'B' ? '/2/tag-b-ring.svg' : '/2/tag-a-ring.svg'}
                  alt=""
                />
                <img
                  className={styles.badgeFace}
                  src={mark.cam === 'B' ? '/2/tag-b-face.svg' : '/2/tag-a-face.svg'}
                  alt=""
                />
                <span className={styles.badgeLetter}>{mark.cam}</span>
              </span>
              {mark.lines.length > 0 && (
                <div className={styles.speech}>
                  <div className={styles.bubble}>
                    <p className={styles.mainLine}>{lineText(mark.lines[0])}</p>
                  </div>
                  {replies.length > 0 && (
                    <div className={`${styles.replies} ${mark.folded ? styles.repliesFolded : ''}`}>
                      {replies.map((line, index) => (
                        <p
                          key={`${mark.id}-reply-${index}`}
                          className={`${styles.reply} ${line.cam === 'B' ? styles.replyB : styles.replyA}`}
                        >
                          <span className={styles.replyText}>{lineText(line)}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
