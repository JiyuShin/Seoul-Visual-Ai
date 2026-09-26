import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
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

export const FOLD_MS = 1500;
const FOLD_EASE = 'cubic-bezier(0.4, 0, 0.15, 1)';

function clearFoldStyles(node) {
  [
    'position',
    'left',
    'top',
    'width',
    'height',
    'maxWidth',
    'margin',
    'right',
    'boxSizing',
    'padding',
    'borderRadius',
    'overflow',
    'fontSize',
    'transform',
    'transformOrigin',
  ].forEach((key) => {
    node.style[key] = '';
  });
}

function FoldReplies({ folded, children }) {
  const stackRef = useRef(null);
  const [settled, setSettled] = useState(false);
  const playedRef = useRef(false);

  useLayoutEffect(() => {
    if (!folded || playedRef.current) return undefined;
    const stack = stackRef.current;
    if (!stack) return undefined;
    const nodes = [...stack.querySelectorAll('[data-reply]')];
    if (!nodes.length) {
      playedRef.current = true;
      setSettled(true);
      return undefined;
    }

    playedRef.current = true;
    const openBox = stack.getBoundingClientRect();
    stack.style.position = 'relative';
    stack.style.width = `${openBox.width}px`;
    stack.style.height = `${openBox.height}px`;
    stack.style.flexShrink = '0';
    const origin = stack.getBoundingClientRect();
    const from = nodes.map((node) => {
      const box = node.getBoundingClientRect();
      const computed = getComputedStyle(node);
      return {
        box,
        radius: computed.borderRadius,
        padding: computed.padding,
      };
    });
    const alignEnd = getComputedStyle(stack).alignItems === 'flex-end';
    stack.style.alignItems = 'flex-start';
    if (alignEnd) stack.style.justifyContent = 'flex-end';
    stack.classList.add(styles.repliesFolded);
    const to = nodes.map((node) => {
      const computed = getComputedStyle(node);
      return {
        box: node.getBoundingClientRect(),
        radius: computed.borderRadius,
        padding: computed.padding,
      };
    });
    stack.classList.remove(styles.repliesFolded);
    stack.style.alignItems = '';
    stack.style.justifyContent = '';

    const place = (box) => ({
      left: box.left - origin.left,
      top: Math.max(0, box.top - origin.top),
      width: box.width,
      height: box.height,
    });

    stack.style.height = `${origin.height}px`;
    const motions = nodes.map((node, index) => {
      const start = from[index];
      const end = to[index];
      if (!start?.box.width || !end?.box.width) return null;
      const here = place(start.box);
      const next = place(end.box);
      node.style.position = 'absolute';
      node.style.boxSizing = 'border-box';
      node.style.margin = '0';
      node.style.right = 'auto';
      node.style.maxWidth = 'none';
      node.style.transition = 'none';
      node.style.left = `${here.left}px`;
      node.style.top = `${here.top}px`;
      node.style.width = `${here.width}px`;
      node.style.height = `${here.height}px`;
      node.style.padding = start.padding;
      node.style.borderRadius = start.radius;
      return {
        node,
        text: node.querySelector('[data-reply-text]'),
        next,
        radius: end.radius,
        padding: end.padding,
      };
    }).filter(Boolean);

    void stack.offsetWidth;
    const glide = [
      'left',
      'top',
      'width',
      'height',
      'padding',
      'border-radius',
      'font-size',
    ].map((prop) => `${prop} ${FOLD_MS}ms ${FOLD_EASE}`).join(', ');
    motions.forEach((item) => {
      item.node.style.transition = glide;
      item.node.style.left = `${item.next.left}px`;
      item.node.style.top = `${item.next.top}px`;
      item.node.style.width = `${item.next.width}px`;
      item.node.style.height = `${item.next.height}px`;
      item.node.style.padding = item.padding;
      item.node.style.borderRadius = item.radius;
      item.node.style.fontSize = '0px';
      if (item.text) {
        item.text.style.transition = `opacity ${FOLD_MS}ms ${FOLD_EASE}, font-size ${FOLD_MS}ms ${FOLD_EASE}`;
        item.text.style.opacity = '0';
        item.text.style.fontSize = '0px';
      }
    });

    let alive = true;
    const settleTimer = window.setTimeout(() => {
      if (!alive) return;
      stack.classList.add(styles.repliesFolded);
      stack.style.height = '';
      stack.style.width = '';
      stack.style.flexShrink = '';
      stack.style.position = '';
      motions.forEach((item) => {
        item.node.style.transition = 'none';
        clearFoldStyles(item.node);
        if (item.text) {
          item.text.style.transition = 'none';
          item.text.style.opacity = '';
          item.text.style.fontSize = '';
        }
      });
      setSettled(true);
    }, FOLD_MS + 40);

    const unlockTimer = window.setTimeout(() => {
      motions.forEach((item) => {
        item.node.style.transition = '';
        if (item.text) {
          item.text.style.transition = '';
          item.text.style.fontSize = '';
        }
      });
    }, FOLD_MS + 140);

    return () => {
      alive = false;
      playedRef.current = false;
      window.clearTimeout(settleTimer);
      window.clearTimeout(unlockTimer);
    };
  }, [folded]);

  return (
    <div ref={stackRef} className={`${styles.replies} ${settled ? styles.repliesFolded : ''}`}>
      {children}
    </div>
  );
}

const StreetCanvas = forwardRef(function StreetCanvas({
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
}, ref) {
  const canvasRef = useRef(null);
  const panoramaRef = useRef(null);
  const markRefs = useRef({});
  const lookRef = useRef(null);
  const holdLookRef = useRef(false);
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

  useImperativeHandle(ref, () => ({
    recenter(onDone, { release = true } = {}) {
      holdLookRef.current = true;
      lookRef.current = { nx: 0.5, ny: 0.5 };
      const panorama = panoramaRef.current;
      if (!panorama?.recenter) {
        if (release) holdLookRef.current = false;
        onDone?.();
        return false;
      }
      panorama.recenter(() => {
        lookRef.current = { nx: 0.5, ny: 0.5 };
        if (release) holdLookRef.current = false;
        onDone?.();
      });
      return true;
    },
  }), []);

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
      if (norm && !holdLookRef.current) lookRef.current = { nx: norm.x, ny: norm.y };
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
                    <FoldReplies folded={mark.folded}>
                      {replies.map((line, index) => (
                        <p
                          key={`${mark.id}-reply-${index}`}
                          data-reply=""
                          className={`${styles.reply} ${line.cam === 'B' ? styles.replyB : styles.replyA}`}
                        >
                          <span className={styles.replyText} data-reply-text="">{lineText(line)}</span>
                        </p>
                      ))}
                    </FoldReplies>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default StreetCanvas;
