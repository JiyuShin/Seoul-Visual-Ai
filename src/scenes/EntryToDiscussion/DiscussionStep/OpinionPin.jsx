import { useEffect, useState } from 'react';
import styles from './OpinionPin.module.css';

export default function OpinionPin({ pin, onRef }) {
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [prevLikeCount, setPrevLikeCount] = useState(pin.likeCount);

  useEffect(() => {
    if (pin.likeCount > prevLikeCount) {
      setShowHeartAnim(true);
      const t = setTimeout(() => setShowHeartAnim(false), 600);
      setPrevLikeCount(pin.likeCount);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [pin.likeCount, prevLikeCount]);

  const glowIntensity = Math.min(1, pin.likeCount / 5);

  const displayText = pin.text.replace(/[\r\n]+/g, '').replace(/\s+/g, ' ').trim();

  return (
    <div
      ref={onRef}
      className={styles.pin}
      data-pin-id={pin.id}
      style={{
        left: `${pin.x * 100}%`,
        top: `${pin.y * 100}%`,
        boxShadow: `0 4px 16px rgba(0,0,0,0.08), 0 0 0 1px rgba(255,255,255,0.6), 0 0 ${12 + glowIntensity * 20}px rgba(102,187,122,${0.2 + glowIntensity * 0.5})`,
        borderColor: `rgba(102,187,122,${0.2 + glowIntensity * 0.6})`,
      }}
    >
      <p className={styles.text}>{displayText}</p>
      <div className={styles.likeRow}>
        {showHeartAnim && <span className={styles.heartPop}>♥</span>}
        <span className={styles.heartIcon}>♥</span>
        <span className={styles.likeCount}>{pin.likeCount}</span>
      </div>
    </div>
  );
}
