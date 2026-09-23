import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './GazeReticle.module.css';

/**
 * 친구 쪽 원형 시선 커서.
 *
 * gazeRef + viewerId 가 있으면 매 프레임 ref 를 읽어 위치를 옮긴다 (2인 동시 표시).
 * position 만 있으면 예전 1인 경로로도 동작한다.
 */
export default function GazeReticle({
  gazeRef,
  viewerId,
  position = null,
  dwellProgress = 0,
  visible = true,
  color,
}) {
  const elRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return undefined;

    const runtime = window.__seoulGazeRuntime || (window.__seoulGazeRuntime = {});
    if (!runtime.cursors) runtime.cursors = {};

    // 1인 시절 API 와 2인 map 을 같이 유지한다.
    if (viewerId) runtime.cursors[viewerId] = elRef.current;
    else runtime.cursorEl = elRef.current;

    if (elRef.current && position) {
      elRef.current.style.left = `${position.x}px`;
      elRef.current.style.top = `${position.y}px`;
    }

    return () => {
      if (viewerId && runtime.cursors?.[viewerId] === elRef.current) {
        delete runtime.cursors[viewerId];
      }
      if (!viewerId && runtime.cursorEl === elRef.current) {
        runtime.cursorEl = null;
      }
    };
  }, [mounted, position, viewerId]);

  useEffect(() => {
    if (!mounted || !visible || !gazeRef || !viewerId) return undefined;

    let rafId;
    const loop = () => {
      rafId = requestAnimationFrame(loop);
      const el = elRef.current;
      if (!el) return;

      const gaze = gazeRef.current?.[viewerId];
      if (!gaze) {
        el.style.opacity = '0';
        return;
      }

      el.style.opacity = '1';
      el.style.left = `${gaze.x}px`;
      el.style.top = `${gaze.y}px`;
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [mounted, visible, gazeRef, viewerId]);

  if (!mounted || !visible) return null;

  const scale = 1 + dwellProgress * 0.08;
  const x = position?.x ?? (typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
  const y = position?.y ?? (typeof window !== 'undefined' ? window.innerHeight / 2 : 0);

  return createPortal(
    <div
      ref={elRef}
      className={styles.reticle}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: `translate(-50%, -50%) scale(${scale})`,
        ...(color ? { '--reticle-tint': color } : null),
      }}
      aria-hidden="true"
    >
      <div className={styles.glowOuter} />
      <div className={styles.glowMid} />
      <div className={styles.glowInner} />
      <div className={styles.core}>
        <div className={styles.coreFillA} />
        <div className={styles.coreFillB} />
      </div>
    </div>,
    document.body
  );
}
