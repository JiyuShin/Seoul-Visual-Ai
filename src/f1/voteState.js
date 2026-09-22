import {
  VOTE_HIT_GRACE_MS,
  VOTE_JOINT_SCORE_WEIGHT,
  VOTE_REQUIRED_VIEWERS,
  VOTE_STAGE_SCALES,
  VOTE_WIN_SCORE_MS,
} from '../shared/gazeConfig.js';

/**
 * 여러 사람이 같은 카드를 응시한 시간을 누적해 승자를 뽑는 상태머신.
 *
 * 점수는 응시한 시간의 합에 "함께 본 시간"을 가중해서 더한다. 혼자 오래 보는 것보다
 * 두 사람이 같이 보는 쪽이 훨씬 빠르게 쌓이므로, 결과적으로 합의된 카드가 선택된다.
 *
 * 서버와 브라우저가 같은 모듈을 쓰도록 DOM에 의존하지 않는 순수 모듈로 유지한다.
 */
export function createVoteState({
  cardIds,
  requiredViewers = VOTE_REQUIRED_VIEWERS,
  graceMs = VOTE_HIT_GRACE_MS,
  jointWeight = VOTE_JOINT_SCORE_WEIGHT,
  winScoreMs = VOTE_WIN_SCORE_MS,
}) {
  const cards = new Map(
    cardIds.map((id) => [id, { dwellMsByViewer: new Map(), jointMs: 0, score: 0 }])
  );

  // viewerId -> { cardId, lastHitAt }
  const hits = new Map();

  let winnerId = null;
  let winnerDecidedAt = null;
  let lastTickAt = null;

  function activeViewersOn(cardId, now) {
    const result = [];
    hits.forEach((hit, viewerId) => {
      if (hit.cardId === cardId && now - hit.lastHitAt <= graceMs) {
        result.push(viewerId);
      }
    });
    return result.sort();
  }

  function totalDwellMs(card) {
    let total = 0;
    card.dwellMsByViewer.forEach((ms) => {
      total += ms;
    });
    return total;
  }

  return {
    /** 특정 뷰어가 지금 보고 있는 카드를 기록한다. cardId가 null이면 카드 밖을 보는 것. */
    recordHit(viewerId, cardId, now = Date.now()) {
      if (!viewerId) return;

      if (!cardId || !cards.has(cardId)) {
        hits.delete(viewerId);
        return;
      }

      hits.set(viewerId, { cardId, lastHitAt: now });
    },

    removeViewer(viewerId) {
      hits.delete(viewerId);
    },

    /** 경과 시간만큼 점수를 누적하고, 기준을 넘으면 승자를 확정한다. */
    tick(now = Date.now()) {
      if (lastTickAt === null) {
        lastTickAt = now;
        return;
      }

      const delta = now - lastTickAt;
      lastTickAt = now;

      // 탭이 백그라운드에 있다가 돌아오면 delta가 크게 튀므로 한 프레임 분량으로 제한한다.
      if (delta <= 0 || delta > 1000) return;
      if (winnerId) return;

      cards.forEach((card, cardId) => {
        const viewers = activeViewersOn(cardId, now);
        if (!viewers.length) return;

        viewers.forEach((viewerId) => {
          card.dwellMsByViewer.set(viewerId, (card.dwellMsByViewer.get(viewerId) || 0) + delta);
        });

        if (viewers.length >= requiredViewers) {
          card.jointMs += delta;
        }

        card.score = totalDwellMs(card) + card.jointMs * jointWeight;

        if (card.score >= winScoreMs) {
          winnerId = cardId;
          winnerDecidedAt = now;
        }
      });
    },

    /** 렌더링에 필요한 값만 담은 평범한 객체를 만든다. WebSocket으로 그대로 보낼 수 있다. */
    getSnapshot(now = Date.now()) {
      const cardSnapshots = {};

      cards.forEach((card, cardId) => {
        const viewers = activeViewersOn(cardId, now);
        const stage = Math.min(viewers.length, requiredViewers);

        cardSnapshots[cardId] = {
          viewers,
          stage,
          scale: VOTE_STAGE_SCALES[stage] ?? VOTE_STAGE_SCALES[VOTE_STAGE_SCALES.length - 1],
          score: Math.round(card.score),
          progress: Math.min(1, card.score / winScoreMs),
          jointMs: Math.round(card.jointMs),
        };
      });

      return {
        cards: cardSnapshots,
        winnerId,
        winnerDecidedAt,
        requiredViewers,
      };
    },

    reset() {
      cards.forEach((card) => {
        card.dwellMsByViewer.clear();
        card.jointMs = 0;
        card.score = 0;
      });
      hits.clear();
      winnerId = null;
      winnerDecidedAt = null;
      lastTickAt = null;
    },
  };
}
