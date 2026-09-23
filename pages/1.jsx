import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useEntryFlow } from '../src/shared/EntryFlowContext';
import { VISION_CARDS } from '../src/shared/gazeConfig';
import { useMenuJointSelect } from '../src/f1/VoteStep/useMenuJointSelect';
import { CardHoverOutline } from '../src/f1/VoteStep/CardHoverOutline';
import styles from './MenuSelectionPage.module.css';

const CARD_OFFSETS = [0, 913.167, 1826.34, 2739.5];
const SVG_WIDTH = 3541;
const MENU_CARDS = VISION_CARDS.slice(0, CARD_OFFSETS.length);
const CARD_VIDEOS = ['/1/s.mp4', '/1/s2.mp4', '/1/s3.mp4', '/1/s4.mp4'];
const CARD_IMAGE_SRCS = ['/1/menu-card-1.svg?v=6', '/1/menu-cards.svg?v=6'];
const CARD_SVG_W = 800.537;
const SELECT_ADVANCE_MS = 3000;
const SPLIT_SCALE = 1.03;
const SPLIT_HOLD_MS = 1000;
const CARD_COPY = [
  '탁한 일상을 비우고 맑은 초록으로 채우는 서울',
  '초록 사이로 선명한 햇살이 스며드는 서울',
  '지친 걸음을 품어주는 넉넉한 초록 그늘의 서울',
  '자연의 형태가 도심 곳곳에 녹아드는 서울',
];

export default function MenuSelectionPage() {
  const router = useRouter();
  const {
    isReady,
    isCalibrating,
    gazeRef,
    calibrated,
    setWinnerCard,
    reportDwellProgress,
  } = useEntryFlow();

  const cardRefs = useRef([]);
  const bgVideoRefs = useRef([]);
  const [cardsReady, setCardsReady] = useState(false);
  const [splitScale, setSplitScale] = useState(1);

  // 보정은 /app 에서 MediaPipe 엔진으로 진행한다.
  useEffect(() => {
    if (isReady && isCalibrating) {
      router.replace('/app');
    }
  }, [isReady, isCalibrating, router]);

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

  const handleSelect = useCallback(
    (card, index) => {
      setWinnerCard(card);
    },
    [setWinnerCard]
  );

  const {
    cardViewers,
    isSplit,
    selectedIndex,
    bgIndex,
    dwellProgress,
    scale,
  } = useMenuJointSelect({
    gazeRef,
    cardRefs,
    menuCards: MENU_CARDS,
    calibrated,
    enabled: isReady && !isCalibrating,
    onSelect: handleSelect,
  });

  const occupiedKey = (cardViewers || []).map((ids) => (ids.length ? '1' : '0')).join('');

  useEffect(() => {
    reportDwellProgress?.(dwellProgress);
  }, [dwellProgress, reportDwellProgress]);

  useEffect(() => {
    if (!isSplit) {
      setSplitScale(1);
      return undefined;
    }
    setSplitScale(SPLIT_SCALE);
    const timer = window.setTimeout(() => setSplitScale(1), SPLIT_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [isSplit, occupiedKey]);

  useEffect(() => {
    if (selectedIndex < 0) return undefined;
    const timer = window.setTimeout(() => {
      router.push('/2');
    }, SELECT_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [router, selectedIndex]);

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
        <div className={`${styles.titleBlur} ${isSplit ? styles.titleBlurVisible : ''}`} />
        <div className={styles.titleStack}>
          <img
            className={`${styles.pageTitle} ${isSplit ? styles.titleHidden : ''}`}
            src="/1/menu-title.svg?v=3"
            alt=""
          />
          <p className={`${styles.pageTitleText} ${isSplit ? styles.titleVisible : ''}`}>
            두 분이 <span className={styles.pageTitleEm}>같은 주제</span>를 바라봐주세요
          </p>
        </div>
        <div className={styles.pageSubtitle} aria-hidden="true" />
      </div>
      <div
        className={`${styles.cardRow} ${cardsReady ? styles.cardImagesReady : ''}`}
        aria-label="메뉴 카드"
      >
        {CARD_OFFSETS.map((x, index) => {
          const viewers = cardViewers[index] || [];
          const active = viewers.length > 0;
          const jointOnCard = viewers.length >= 2;
          const faceScale = jointOnCard
            ? scale
            : isSplit && active
              ? splitScale
              : active
                ? 1.055
                : 1;

          return (
            <div
              className={`${styles.card} ${active ? styles.cardHovered : ''}`}
              key={MENU_CARDS[index].id}
              data-card-id={MENU_CARDS[index].id}
              ref={(el) => {
                cardRefs.current[index] = el;
              }}
            >
              <div
                className={styles.cardFace}
                style={{ transform: `scale(${faceScale})` }}
              >
                <div
                  className={styles.cardClip}
                  style={
                    index === 0
                      ? { backgroundImage: 'url(/1/menu-card-1.svg?v=6)' }
                      : {
                          backgroundImage: 'url(/1/menu-cards.svg?v=6)',
                          backgroundSize: `${(SVG_WIDTH / CARD_SVG_W) * 100}% 100%`,
                          backgroundPosition: `calc(var(--card-w) * ${-x} / ${CARD_SVG_W}) 0`,
                        }
                  }
                />
                {active && (
                  <CardHoverOutline
                    key={`${MENU_CARDS[index].id}-${viewers.join('-')}`}
                    viewers={viewers}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className={styles.pagePrompt}>
        {selectedIndex >= 0 ? (
          <>
            <span className={styles.pagePromptEm}>{CARD_COPY[selectedIndex]}</span>, 선택하셨네요.
            <br />
            이제 그 풍경 속을 함께 걸어보며 이야기 나눠볼게요!
          </>
        ) : isSplit ? (
          <>
            두분께서 서로 다른 주제를 선택해주셨네요.
            <br />
            다음 단계로 넘어가기 위해{' '}
            <span className={styles.pagePromptEm}>같은 주제를 함께 응시해주세요!</span>
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
