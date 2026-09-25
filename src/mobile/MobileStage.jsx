import { useEffect, useRef, useState } from 'react';
import styles from './MobileStage.module.css';

/**
 * Figma 아트보드(480×1044)를 뷰포트에 맞춘다.
 * @param {'contain' | 'cover'} fit — contain: Figma 그대로(레터박스), cover: 꽉 채움(잘림)
 */
export function MobileStage({ width, height, fit = 'contain', children }) {
  const viewportRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const measure = () => {
      const box = viewportRef.current;
      const w = box?.clientWidth || 0;
      const h = box?.clientHeight || 0;
      if (!w || !h) return;
      const sx = w / width;
      const sy = h / height;
      const next = fit === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy);
      setScale(next > 0 ? next : 1);
    };

    measure();
    const observer = new ResizeObserver(measure);
    if (viewportRef.current) observer.observe(viewportRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [width, height, fit]);

  return (
    <div className={styles.viewport} ref={viewportRef}>
      <div
        className={styles.stageOuter}
        style={{ width: width * scale, height: height * scale }}
      >
        <div
          className={styles.stage}
          style={{ width, height, transform: `scale(${scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
