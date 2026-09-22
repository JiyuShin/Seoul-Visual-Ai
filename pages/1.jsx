import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useEntryFlow } from '../src/shared/EntryFlowContext';
import { GAZE_VOTE_DWELL_MS, GAZE_VOTE_DWELL_GRACE_MS, VISION_CARDS } from '../src/shared/gazeConfig';
import styles from './MenuSelectionPage.module.css';

const CARD_OFFSETS = [0, 913.167, 1826.34, 2739.5];
const SVG_WIDTH = 3541;
const MENU_CARDS = VISION_CARDS.slice(0, CARD_OFFSETS.length);
const HIT_PADDING_PX = 16;
const CARD_VIDEOS = ['/s.mp4', '/s2.mp4', '/s3.mp4', '/s4.mp4'];
const CARD_IMAGE_SRCS = ['/menu-card-1.svg?v=6', '/menu-cards.svg?v=6'];
const CARD_SVG_W = 800.537;
const BG_SWITCH_MS = 1200;
const SELECT_ADVANCE_MS = 3000;
const CARD_COPY = [
  '탁한 일상을 비우고 맑은 초록으로 채우는 서울',
  '초록 사이로 선명한 햇살이 스며드는 서울',
  '지친 걸음을 품어주는 넉넉한 초록 그늘의 서울',
  '자연의 형태가 도심 곳곳에 녹아드는 서울',
];

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
  const bgIndexRef = useRef(0);
  const bgVideoRefs = useRef([]);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [bgIndex, setBgIndex] = useState(0);
  const [cardsReady, setCardsReady] = useState(false);

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

        const hoveredMs = now - dwellStartRef.current;
        if (hoveredMs >= BG_SWITCH_MS && bgIndexRef.current !== hit) {
          bgIndexRef.current = hit;
          setBgIndex(hit);
        }

        const progress = Math.min(1, hoveredMs / GAZE_VOTE_DWELL_MS);
        if (progress >= 1) {
          selectedRef.current = true;
          hoverRef.current = hit;
          setHoveredIndex(hit);
          setSelectedIndex(hit);
          setWinnerCard(MENU_CARDS[hit]);
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
    [setWinnerCard]
  );

  useEffect(() => {
    if (selectedIndex < 0) return undefined;
    const timer = window.setTimeout(() => {
      router.push('/2');
    }, SELECT_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [router, selectedIndex]);

  useEffect(() => {
    registerGazeHandler?.('vote', handleGaze);
    return () => registerGazeHandler?.('vote', null);
  }, [handleGaze, registerGazeHandler]);

  useEffect(() => {
    bgVideoRefs.current.forEach((video) => {
      if (video?.paused) {
        video.play().catch(() => {});
      }
    });
  }, [bgIndex]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      CARD_IMAGE_SRCS.map(
        (src) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = resolve;
            img.onerror = resolve;
            img.src = src;
          })
      )
    ).then(() => {
      if (!cancelled) setCardsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.page}>
      {CARD_VIDEOS.map((src, index) => (
        <video
          key={src}
          ref={(el) => {
            bgVideoRefs.current[index] = el;
          }}
          className={`${styles.backgroundVideo} ${
            index === bgIndex ? styles.backgroundVideoVisible : ''
          }`}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        />
      ))}
      <div className={styles.titleGroup}>
        <img
          className={styles.pageTitle}
          src="/menu-title.svg?v=3"
          alt=""
        />
        <div className={styles.pageSubtitle} aria-hidden="true" />
      </div>
      <div
        className={`${styles.cardRow} ${cardsReady ? styles.cardImagesReady : ''}`}
        aria-label="메뉴 카드"
      >
        {CARD_OFFSETS.map((x, index) => (
          <div
            className={`${styles.card} ${hoveredIndex === index ? styles.cardHovered : ''}`}
            key={MENU_CARDS[index].id}
            data-card-id={MENU_CARDS[index].id}
            ref={(el) => {
              cardRefs.current[index] = el;
            }}
          >
            <div className={styles.cardFace}>
              <div
                className={styles.cardClip}
                style={
                  index === 0
                    ? { backgroundImage: 'url(/menu-card-1.svg?v=6)' }
                    : {
                        backgroundImage: 'url(/menu-cards.svg?v=6)',
                        backgroundSize: `${(SVG_WIDTH / CARD_SVG_W) * 100}% 100%`,
                        backgroundPosition: `calc(var(--card-w) * ${-x} / ${CARD_SVG_W}) 0`,
                      }
                }
              />
              {hoveredIndex === index && (
                <img
                  className={styles.cardHoverOutline}
                  src="/menu-card-hover-outline.svg?v=2"
                  alt=""
                />
              )}
            </div>
          </div>
        ))}
      </div>
      <p className={styles.pagePrompt}>
        {selectedIndex >= 0 ? (
          <>
            <span className={styles.pagePromptEm}>{CARD_COPY[selectedIndex]}</span>, 선택하셨네요.
            <br />
            이제 그 풍경 속을 함께 걸어보며 이야기 나눠볼게요!
          </>
        ) : (
          <>
            2026년, 쉼 없이 가속 페달을 밟고 있는{' '}
            <span className={styles.pagePromptEm}>무채색의 도시 서울</span>.
            <br />
            과열된 일상에 작은 여백과 지친 마음이 잠시 머물며 숨 고를 수 있는{' '}
            <span className={styles.pagePromptEm}>당신만의 초록빛 서울</span>은 어떤 모습인가요?
          </>
        )}
      </p>
    </div>
  );
}
