import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './GazeReticle.module.css';

export default function GazeReticle({ position, dwellProgress = 0, visible = true }) {
  const elRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return undefined;
    const runtime = window.__seoulGazeRuntime || (window.__seoulGazeRuntime = {});
    runtime.cursorEl = elRef.current;
    if (elRef.current && position) {
      elRef.current.style.left = `${position.x}px`;
      elRef.current.style.top = `${position.y}px`;
    }
    return () => {
      if (runtime.cursorEl === elRef.current) runtime.cursorEl = null;
    };
  }, [mounted, position]);

  if (!mounted || !visible) return null;

  const scale = 1 + dwellProgress * 0.08;
  const x = position?.x ?? window.innerWidth / 2;
  const y = position?.y ?? window.innerHeight / 2;

  return createPortal(
    <div
      ref={elRef}
      className={styles.reticle}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: `translate(-50%, -50%) scale(${scale})`,
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
