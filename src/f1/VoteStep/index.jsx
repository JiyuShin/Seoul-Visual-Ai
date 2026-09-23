import { useEffect, useRef, useState } from 'react';
import {
  CARD_HIT_PADDING_PX,
  VISION_CARDS,
  VOTE_REQUIRED_VIEWERS,
  VOTE_SYNC_INTERVAL_MS,
  VOTE_QUESTION,
} from '../../shared/gazeConfig';
import { useEntryFlow } from '../../shared/EntryFlowContext';
import { CAM_KEYS, PERSON_LABEL, VIEWER_BY_CAM } from '../../shared/gaze/participants';
import { createVoteState } from '../voteState';
import VisionCard from './VisionCard';
import styles from './VoteStep.module.css';

function getCardRects(elements) {
  return elements.map(({ id, el }) => {
    const rect = el.getBoundingClientRect();
    return {
      id,
      rect: {
        left: rect.left - CARD_HIT_PADDING_PX,
        top: rect.top - CARD_HIT_PADDING_PX,
        right: rect.right + CARD_HIT_PADDING_PX,
        bottom: rect.bottom + CARD_HIT_PADDING_PX,
      },
    };
  });
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

/**
 * 두 사람이 함께 카드를 고르는 단계.
 *
 * 시선 엔진이 웹캠 두 대를 한 번에 다루므로 두 사람의 좌표가 이 창에 모두 들어온다.
 * 교차 판정과 점수 누적을 여기서 함께 처리하고, 화면 갱신은 카드 상태가 바뀔 정도의
 * 주기로만 올린다.
 */
export default function VoteStep({ onComplete }) {
  const { gazeRef } = useEntryFlow();
  const [snapshot, setSnapshot] = useState(null);
  const completedRef = useRef(false);

  useEffect(() => {
    const vote = createVoteState({ cardIds: VISION_CARDS.map((card) => card.id) });

    // querySelector 를 매 프레임 돌리면 시선 추론과 메인 스레드를 다툰다. 엘리먼트는 한 번만
    // 찾아두고, 위치만 프레임마다 읽는다 (카드가 커지면 실제 위치가 바뀌므로).
    const elements = VISION_CARDS.map((card) => ({
      id: card.id,
      el: document.querySelector(`[data-card-id="${card.id}"]`),
    })).filter((item) => item.el);

    let rafId;
    let lastPublishedAt = 0;

    const loop = () => {
      rafId = requestAnimationFrame(loop);

      const now = Date.now();
      const cardRects = getCardRects(elements);
      const tracked = [];

      CAM_KEYS.forEach((key) => {
        const viewerId = VIEWER_BY_CAM[key];
        const gaze = gazeRef.current?.[viewerId];
        if (gaze) tracked.push(viewerId);
        vote.recordHit(viewerId, gaze ? hitTestCard(gaze.x, gaze.y, cardRects) : null, now);
      });

      vote.tick(now);

      // 점수는 매 프레임 쌓지만 화면은 사람 눈에 보이는 주기로만 다시 그린다.
      if (now - lastPublishedAt >= VOTE_SYNC_INTERVAL_MS) {
        lastPublishedAt = now;
        setSnapshot({ ...vote.getSnapshot(now), tracked });
      }
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [gazeRef]);

  useEffect(() => {
    if (!snapshot?.winnerId || completedRef.current) return;

    completedRef.current = true;
    const winner = VISION_CARDS.find((card) => card.id === snapshot.winnerId);
    onComplete?.(winner, { reason: 'joint-gaze', cards: snapshot.cards });
  }, [snapshot, onComplete]);

  const requiredViewers = snapshot?.requiredViewers || VOTE_REQUIRED_VIEWERS;
  const trackedCount = snapshot?.tracked?.length || 0;

  return (
    <section className={styles.voteStep}>
      <h1 className={styles.question}>{VOTE_QUESTION}</h1>
      <p className={styles.hint}>
        두 사람이 같은 카드를 함께 바라보면 카드가 최종 크기까지 커지고 선택됩니다.
      </p>

      <p className={styles.viewerStatus}>
        {trackedCount >= requiredViewers
          ? `${requiredViewers}명의 시선을 추적 중입니다`
          : `시선 추적 ${trackedCount} / ${requiredViewers}명 · ${PERSON_LABEL.B} 카메라와 보정을 확인하세요`}
      </p>

      <div className={styles.cardRow}>
        {VISION_CARDS.map((card) => {
          const cardState = snapshot?.cards?.[card.id];

          return (
            <VisionCard
              key={card.id}
              card={card}
              stage={cardState?.stage || 0}
              scale={cardState?.scale || 1}
              progress={cardState?.progress || 0}
              viewers={cardState?.viewers || []}
              requiredViewers={requiredViewers}
            />
          );
        })}
      </div>
    </section>
  );
}
