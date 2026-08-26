import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CARD_HIT_PADDING_PX,
  GAZE_VOTE_DWELL_MS,
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
  const activeDwellRef = useRef({ viewerId: null, cardId: null, since: 0 });
  const lastTickRef = useRef(Date.now());
  const completedRef = useRef(false);
  const forceUpdateRef = useRef(null);

  const triggerUpdate = useCallback(() => {
    forceUpdateRef.current?.((v) => v + 1);
  }, []);

  useEffect(() => {
    let rafId;
    const tick = () => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      const { viewerId, cardId } = activeDwellRef.current;
      if (viewerId && cardId) {
        const state = cardStatesRef.current[cardId];
        if (state) {
          state.dwellMs += delta;
          state.viewers.add(viewerId);
        }
        triggerUpdate();
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [triggerUpdate]);

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

      const cardRects = getCardRects();
      const hitCardId = hitTestCard(x, y, cardRects);
      const active = activeDwellRef.current;

      if (hitCardId) {
        if (active.viewerId === viewerId && active.cardId === hitCardId) {
          const elapsed = Date.now() - active.since;
          const progress = Math.min(1, elapsed / GAZE_VOTE_DWELL_MS);

          if (elapsed >= GAZE_VOTE_DWELL_MS) {
            pickWinner('dwell');
          }

          return { dwellProgress: progress, hitCardId };
        }

        activeDwellRef.current = { viewerId, cardId: hitCardId, since: Date.now() };
        return { dwellProgress: 0, hitCardId };
      }

      activeDwellRef.current = { viewerId: null, cardId: null, since: 0 };
      return { dwellProgress: 0, hitCardId: null };
    },
    [pickWinner]
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

  const [, setTick] = useState(0);
  forceUpdateRef.current = setTick;

  return (
    <section className={styles.voteStep}>
      <h1 className={styles.question}>{VOTE_QUESTION}</h1>
      <p className={styles.hint}>카드를 3초간 응시하면 선택됩니다</p>
      <div className={styles.cardRow}>
        {VISION_CARDS.map((card) => (
          <VisionCard key={card.id} card={card} intensity={getIntensity(card.id)} />
        ))}
      </div>
    </section>
  );
}
