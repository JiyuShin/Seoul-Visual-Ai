import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CARD_HIT_PADDING_PX,
  GAZE_VOTE_DWELL_GRACE_MS,
  GAZE_VOTE_DWELL_MS,
  GAZE_VOTE_HOVER_MS,
  GAZE_VOTE_PHASE_MAX_MS,
  MAX_EXPECTED_VIEWERS,
  VISION_CARDS,
  VOTE_QUESTION,
} from '../gazeConfig';
import VisionCard from './VisionCard';
import styles from './VoteStep.module.css';

function getCardRects() {
  return VISION_CARDS.map((card) => {
    const el = document.querySelector(`[data-card-id="${card.id}"]`);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      id: card.id,
      rect: {
        left: rect.left - CARD_HIT_PADDING_PX,
        top: rect.top - CARD_HIT_PADDING_PX,
        right: rect.right + CARD_HIT_PADDING_PX,
        bottom: rect.bottom + CARD_HIT_PADDING_PX,
      },
    };
  }).filter(Boolean);
}

function hitTestCard(x, y, cardRects) {
  for (const item of cardRects) {
    const { rect } = item;
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return item.id;
    }
  }
  return null;
}

export default function VoteStep({ onComplete, registerGazeHandler }) {
  const cardStatesRef = useRef(
    VISION_CARDS.reduce((acc, card) => {
      acc[card.id] = { viewers: new Set(), dwellMs: 0 };
      return acc;
    }, {})
  );
  const dwellRef = useRef({
    viewerId: null,
    cardId: null,
    since: 0,
    lastOnCardAt: 0,
  });
  const lastTickRef = useRef(Date.now());
  const completedRef = useRef(false);
  const forceUpdateRef = useRef(null);
  const [hoveredCardId, setHoveredCardId] = useState(null);

  const triggerUpdate = useCallback(() => {
    forceUpdateRef.current?.((v) => v + 1);
  }, []);

  const getActiveCardId = useCallback((now) => {
    const dwell = dwellRef.current;
    if (!dwell.cardId) return null;

    if (now - dwell.lastOnCardAt <= GAZE_VOTE_DWELL_GRACE_MS) {
      return dwell.cardId;
    }

    return null;
  }, []);

  useEffect(() => {
    let rafId;
    const tick = () => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      const dwell = dwellRef.current;
      const activeCardId = getActiveCardId(now);

      if (dwell.viewerId && activeCardId) {
        const state = cardStatesRef.current[activeCardId];
        if (state) {
          state.dwellMs += delta;
          state.viewers.add(dwell.viewerId);
        }

        const elapsed = now - dwell.since;
        if (elapsed >= GAZE_VOTE_HOVER_MS) {
          setHoveredCardId((prev) => (prev === activeCardId ? prev : activeCardId));
        }
      } else {
        setHoveredCardId(null);
      }

      triggerUpdate();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [getActiveCardId, triggerUpdate]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (completedRef.current) return;
      pickWinner('timeout');
    }, GAZE_VOTE_PHASE_MAX_MS);

    return () => clearTimeout(timeoutId);
  }, []);

  const pickWinner = useCallback(
    (reason) => {
      if (completedRef.current) return;
      completedRef.current = true;
      setHoveredCardId(null);

      let winnerId = VISION_CARDS[0].id;
      let bestScore = -1;

      Object.entries(cardStatesRef.current).forEach(([cardId, state]) => {
        const score = state.viewers.size * state.dwellMs;
        if (score > bestScore) {
          bestScore = score;
          winnerId = cardId;
        }
      });

      const winner = VISION_CARDS.find((c) => c.id === winnerId);
      onComplete?.(winner, { reason, scores: cardStatesRef.current });
    },
    [onComplete]
  );

  const handleGaze = useCallback(
    (viewerId, x, y) => {
      if (completedRef.current) return { dwellProgress: 0 };

      const now = Date.now();
      const cardRects = getCardRects();
      const hitCardId = hitTestCard(x, y, cardRects);
      const dwell = dwellRef.current;

      if (hitCardId) {
        dwell.lastOnCardAt = now;

        if (dwell.viewerId === viewerId && dwell.cardId === hitCardId) {
          const elapsed = now - dwell.since;
          const progress = Math.min(1, elapsed / GAZE_VOTE_DWELL_MS);

          if (elapsed >= GAZE_VOTE_DWELL_MS) {
            pickWinner('dwell');
          }

          return { dwellProgress: progress, hitCardId };
        }

        dwellRef.current = {
          viewerId,
          cardId: hitCardId,
          since: now,
          lastOnCardAt: now,
        };
        setHoveredCardId(null);
        return { dwellProgress: 0, hitCardId };
      }

      const activeCardId = getActiveCardId(now);
      if (activeCardId && dwell.viewerId === viewerId) {
        const elapsed = now - dwell.since;
        const progress = Math.min(1, elapsed / GAZE_VOTE_DWELL_MS);

        if (elapsed >= GAZE_VOTE_DWELL_MS) {
          pickWinner('dwell');
        }

        return { dwellProgress: progress, hitCardId: activeCardId };
      }

      dwellRef.current = { viewerId: null, cardId: null, since: 0, lastOnCardAt: 0 };
      setHoveredCardId(null);
      return { dwellProgress: 0, hitCardId: null };
    },
    [getActiveCardId, pickWinner]
  );

  useEffect(() => {
    registerGazeHandler?.('vote', handleGaze);
    return () => registerGazeHandler?.('vote', null);
  }, [handleGaze, registerGazeHandler]);

  const getIntensity = (cardId) => {
    const state = cardStatesRef.current[cardId];
    if (!state) return 0;
    const viewerFactor = Math.min(1, state.viewers.size / MAX_EXPECTED_VIEWERS);
    const dwellFactor = Math.min(1, state.dwellMs / GAZE_VOTE_DWELL_MS);
    return Math.min(1, viewerFactor * 0.4 + dwellFactor * 0.6);
  };

  const getHoverProgress = (cardId) => {
    const dwell = dwellRef.current;
    const activeCardId = getActiveCardId(Date.now());
    if (activeCardId !== cardId) return 0;
    const elapsed = Date.now() - dwell.since;
    if (elapsed < GAZE_VOTE_HOVER_MS) return 0;
    return Math.min(1, (elapsed - GAZE_VOTE_HOVER_MS) / (GAZE_VOTE_DWELL_MS - GAZE_VOTE_HOVER_MS));
  };

  const [, setTick] = useState(0);
  forceUpdateRef.current = setTick;

  return (
    <section className={styles.voteStep}>
      <h1 className={styles.question}>{VOTE_QUESTION}</h1>
      <p className={styles.hint}>
        카드 위에서 3초간 머물면 선택됩니다. 커서가 조금 움직여도 괜찮아요.
      </p>
      <div className={styles.cardRow}>
        {VISION_CARDS.map((card) => (
          <VisionCard
            key={card.id}
            card={card}
            intensity={getIntensity(card.id)}
            isHovered={hoveredCardId === card.id}
            hoverProgress={getHoverProgress(card.id)}
          />
        ))}
      </div>
    </section>
  );
}
