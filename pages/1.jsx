import { useEffect } from 'react';
import { useEntryFlow } from '../src/shared/EntryFlowContext';
import styles from './MenuSelectionPage.module.css';

const CARD_OFFSETS = [0, 913.167, 1826.34, 2739.5];
const SVG_WIDTH = 3541;

export default function MenuSelectionPage() {
  const { isReady, isCalibrating, finishCalibration } = useEntryFlow();

  useEffect(() => {
    if (isReady && isCalibrating) {
      finishCalibration();
    }
  }, [isReady, isCalibrating, finishCalibration]);

  return (
    <div className={styles.page}>
      <video
        className={styles.backgroundVideo}
        src="/s.mp4"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
      />
      <div className={styles.titleGroup}>
        <img
          className={styles.pageTitle}
          src="/menu-title.svg?v=2"
          alt=""
        />
        <img
          className={styles.pageSubtitle}
          src="/menu-subtitle.svg"
          alt=""
        />
      </div>
      <div className={styles.cardRow} aria-label="메뉴 카드">
        {CARD_OFFSETS.map((x, index) => (
          <div className={styles.card} key={index}>
            <div className={styles.cardClip}>
              {index === 0 ? (
                <img
                  className={styles.cardImageSingle}
                  src="/menu-card-1.svg"
                  alt=""
                />
              ) : (
                <img
                  className={styles.cardImage}
                  src="/menu-cards.svg"
                  alt=""
                  style={{ transform: `translateX(${(-x / SVG_WIDTH) * 100}%)` }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
