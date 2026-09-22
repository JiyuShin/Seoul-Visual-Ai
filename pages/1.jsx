import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useEntryFlow } from '../src/shared/EntryFlowContext';
import { GAZE_VOTE_DWELL_MS, GAZE_VOTE_DWELL_GRACE_MS, VISION_CARDS } from '../src/shared/gazeConfig';
import styles from './MenuSelectionPage.module.css';

const CARD_OFFSETS = [0, 913.167, 1826.34, 2739.5];
const SVG_WIDTH = 3541;
const MENU_CARDS = VISION_CARDS.slice(0, CARD_OFFSETS.length);
const HIT_PADDING_PX = 16;

function hitTestCard(x, y, cardEls) {
  for (let i = 0; i < cardEls.length; i += 1) {
    const el = cardEls[i];
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (
      x >= rect.left - HIT_PADDING_PX &&
      x <= rect.right + HIT_PADDING_PX &&
      y >= rect.top - HIT_PADDING_PX &&
      y <= rect.bottom + HIT_PADDING_PX
    ) {
      return i;
    }
  }
  return -1;
}

export default function MenuSelectionPage() {
  const router = useRouter();
  const {
    isReady,
    isCalibrating,
    finishCalibration,
    registerGazeHandler,
    setWinnerCard,
  } = useEntryFlow();

  const cardRefs = useRef([]);
  const hoverRef = useRef(-1);
  const dwellStartRef = useRef(0);
  const lastHitAtRef = useRef(0);
  const selectedRef = useRef(false);
  const [hoveredIndex, setHoveredIndex] = useState(-1);

  useEffect(() => {
    if (isReady && isCalibrating) {
      finishCalibration();
    }
  }, [isReady, isCalibrating, finishCalibration]);

  useEffect(() => {
    const root = document.documentElement;
    const previousHtml = root.style.cursor;
    const previousBody = document.body.style.cursor;
    root.style.cursor = 'none';
    document.body.style.cursor = 'none';
    return () => {
      root.style.cursor = previousHtml;
      document.body.style.cursor = previousBody;
    };
  }, []);

  const handleGaze = useCallback(
    (_viewerId, x, y) => {
      if (selectedRef.current) return { dwellProgress: 1 };

      const now = Date.now();
      const hit = hitTestCard(x, y, cardRefs.current);

      if (hit >= 0) {
        lastHitAtRef.current = now;
        if (hoverRef.current !== hit) {
          hoverRef.current = hit;
          dwellStartRef.current = now;
          setHoveredIndex(hit);
        }

        const progress = Math.min(1, (now - dwellStartRef.current) / GAZE_VOTE_DWELL_MS);
        if (progress >= 1) {
          selectedRef.current = true;
          setWinnerCard(MENU_CARDS[hit]);
          router.push('/2');
          return { dwellProgress: 1, hitCardId: MENU_CARDS[hit].id };
        }

        return { dwellProgress: progress, hitCardId: MENU_CARDS[hit].id };
      }

      if (hoverRef.current >= 0 && now - lastHitAtRef.current > GAZE_VOTE_DWELL_GRACE_MS) {
        hoverRef.current = -1;
        dwellStartRef.current = 0;
        setHoveredIndex(-1);
      }

      return { dwellProgress: 0, hitCardId: null };
    },
    [router, setWinnerCard]
  );

  useEffect(() => {
    registerGazeHandler?.('vote', handleGaze);
    return () => registerGazeHandler?.('vote', null);
  }, [handleGaze, registerGazeHandler]);

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
          <div
            className={`${styles.card} ${hoveredIndex === index ? styles.cardHovered : ''}`}
            key={MENU_CARDS[index].id}
            data-card-id={MENU_CARDS[index].id}
            ref={(el) => {
              cardRefs.current[index] = el;
            }}
          >
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
            {hoveredIndex === index && (
              <img
                className={styles.cardHoverOutline}
                src="/menu-card-hover-outline.svg"
                alt=""
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
