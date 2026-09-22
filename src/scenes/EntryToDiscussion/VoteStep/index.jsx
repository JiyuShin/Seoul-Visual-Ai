import { useCallback, useEffect, useRef } from 'react';
import {
  CARD_HIT_PADDING_PX,
  VISION_CARDS,
  VOTE_HITS_SEND_INTERVAL_MS,
  VOTE_LOCAL_GAZE_STALE_MS,
  VOTE_REQUIRED_VIEWERS,
  VOTE_VIEWER_IDS,
  VOTE_QUESTION,
} from '../gazeConfig';
import { useVoteSync } from '../useVoteSync';
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

/**
 * 두 사람이 함께 카드를 고르는 단계.
 *
 * 이 창은 화면을 그리면서 1번 참가자의 웹캠도 직접 쓴다. 2번 참가자는 /tracker 창이
 * 다른 웹캠으로 측정해서 서버로 보낸다. 카드 배치를 아는 건 이 창뿐이므로
 * 교차 판정은 여기서 하고, 점수 누적과 승자 결정은 서버가 맡는다.
 */
export default function VoteStep({ onComplete, registerGazeHandler }) {
  const { sync, syncRef, send, status } = useVoteSync({
    role: 'display',
    viewerId: VOTE_VIEWER_IDS[0],
  });

  const localViewerId = VOTE_VIEWER_IDS[0];
  const localGazeRef = useRef(null);
  const hitsRef = useRef({});
  const lastSentAtRef = useRef(0);
  const completedRef = useRef(false);

  // 이 창의 웹캠에서 나온 시선은 서버를 거치지 않고 바로 판정한다.
  const handleGaze = useCallback(
    (_viewerId, x, y) => {
      localGazeRef.current = { x, y, at: Date.now() };

      const hitCardId = hitsRef.current[localViewerId] || null;
      const progress = hitCardId ? syncRef.current?.cards?.[hitCardId]?.progress || 0 : 0;

      return { dwellProgress: progress, hitCardId };
    },
    [localViewerId, syncRef]
  );

  useEffect(() => {
    registerGazeHandler?.('vote', handleGaze);
    return () => registerGazeHandler?.('vote', null);
  }, [handleGaze, registerGazeHandler]);

  useEffect(() => {
    let rafId;

    const loop = () => {
      const now = Date.now();
      const cardRects = getCardRects();
      const hits = {};

      const local = localGazeRef.current;
      if (local && now - local.at <= VOTE_LOCAL_GAZE_STALE_MS) {
        hits[localViewerId] = hitTestCard(local.x, local.y, cardRects);
      }

      // 트래커 창이 보낸 좌표는 0~1로 정규화되어 있으므로 이 창 크기에 맞춰 되돌린다.
      syncRef.current?.viewers?.forEach((viewer) => {
        if (viewer.id === localViewerId || !viewer.connected || viewer.x == null) return;

        hits[viewer.id] = hitTestCard(
          viewer.x * window.innerWidth,
          viewer.y * window.innerHeight,
          cardRects
        );
      });

      hitsRef.current = hits;

      if (now - lastSentAtRef.current >= VOTE_HITS_SEND_INTERVAL_MS) {
        lastSentAtRef.current = now;
        send({ t: 'hits', hits });
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [localViewerId, send, syncRef]);

  useEffect(() => {
    if (!sync?.winnerId || completedRef.current) return;

    completedRef.current = true;
    const winner = VISION_CARDS.find((card) => card.id === sync.winnerId);
    onComplete?.(winner, { reason: 'joint-gaze', cards: sync.cards });
  }, [sync, onComplete]);

  const connectedViewers = sync?.viewers?.filter((viewer) => viewer.connected) || [];
  const requiredViewers = sync?.requiredViewers || VOTE_REQUIRED_VIEWERS;

  return (
    <section className={styles.voteStep}>
      <h1 className={styles.question}>{VOTE_QUESTION}</h1>
      <p className={styles.hint}>
        두 사람이 같은 카드를 함께 바라보면 카드가 최종 크기까지 커지고 선택됩니다.
      </p>

      <p className={styles.viewerStatus}>
        {status !== 'open'
          ? '투표 서버에 연결 중…'
          : `참가자 ${connectedViewers.length} / ${requiredViewers}명 연결됨${
              connectedViewers.length < requiredViewers ? ' · /tracker 창을 열어 주세요' : ''
            }`}
      </p>

      <div className={styles.cardRow}>
        {VISION_CARDS.map((card) => {
          const cardState = sync?.cards?.[card.id];

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
