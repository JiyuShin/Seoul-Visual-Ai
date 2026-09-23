import { useEffect, useRef, useState } from 'react';
import {
  GAZE_VOTE_DWELL_MS,
  VOTE_HIT_GRACE_MS,
  VOTE_JOINT_SCORE_WEIGHT,
  VOTE_REQUIRED_VIEWERS,
  VOTE_STAGE_SCALES,
  VOTE_SYNC_INTERVAL_MS,
} from '../../shared/gazeConfig';
import { CAM_KEYS, VIEWER_BY_CAM } from '../../shared/gaze/participants';
import { createVoteState } from '../voteState';

const BG_SWITCH_MS = 1200;

/**
 * 친구 /1 메뉴 UI 위에 얹는 2인 합의 선택 로직.
 *
 * 카드 레이아웃·카피는 페이지가 그대로 두고, 시선 hit / 점수 / hover stage 만 여기서 계산한다.
 * 두 커서가 같은 카드를 같이 볼 때만 확정한다.
 */
export function useMenuJointSelect({
  gazeRef,
  cardRefs,
  menuCards,
  calibrated = [],
  enabled = true,
  onSelect,
}) {
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [hoverViewers, setHoverViewers] = useState([]);
  const [cardViewers, setCardViewers] = useState([]);
  const [isSplit, setIsSplit] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [bgIndex, setBgIndex] = useState(0);
  const [stage, setStage] = useState(0);
  const [dwellProgress, setDwellProgress] = useState(0);

  const completedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!enabled || completedRef.current) return undefined;

    const requiredViewers = VOTE_REQUIRED_VIEWERS;

    const vote = createVoteState({
      cardIds: menuCards.map((card) => card.id),
      requiredViewers,
      graceMs: VOTE_HIT_GRACE_MS,
      jointWeight: VOTE_JOINT_SCORE_WEIGHT,
      winScoreMs: GAZE_VOTE_DWELL_MS,
      jointOnly: true,
    });

    let rafId;
    let lastPublishedAt = 0;
    let lastHover = -1;
    let lastViewersKey = '';
    let lastCardsKey = '';
    let lastStage = 0;
    let lastProgress = 0;
    let hoverStartedAt = 0;
    let bgSwitchedFor = -1;

    // 레이아웃 박스만 쓴다. CSS scale/transition 이 붙어 있어도 offset 크기는 안 변하고,
    // transform-origin 이 가운데라 시각적 중심 = 레이아웃 중심이다.
    const getLayoutBox = (el) => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      return {
        left: cx - w / 2,
        right: cx + w / 2,
        top: cy - h / 2,
        bottom: cy + h / 2,
        cx,
        cy,
      };
    };

    const dist2ToBox = (x, y, box) => {
      const nx = Math.min(Math.max(x, box.left), box.right);
      const ny = Math.min(Math.max(y, box.top), box.bottom);
      const dx = x - nx;
      const dy = y - ny;
      return dx * dx + dy * dy;
    };

    const hitTest = (x, y) => {
      const els = cardRefs.current || [];
      let best = -1;
      let bestDist = Infinity;
      const near = 24;
      const near2 = near * near;

      for (let i = 0; i < els.length; i += 1) {
        const el = els[i];
        if (!el) continue;
        const box = getLayoutBox(el);
        if (dist2ToBox(x, y, box) > near2) continue;

        const dx = x - box.cx;
        const dy = y - box.cy;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      }

      return best;
    };

    const loop = () => {
      rafId = requestAnimationFrame(loop);
      if (completedRef.current) return;

      const now = Date.now();

      CAM_KEYS.forEach((key) => {
        const viewerId = VIEWER_BY_CAM[key];
        const gaze = gazeRef.current?.[viewerId];
        const index = gaze ? hitTest(gaze.x, gaze.y) : -1;
        vote.recordHit(viewerId, index >= 0 ? menuCards[index].id : null, now);
      });

      vote.tick(now);
      const snap = vote.getSnapshot(now);

      if (now - lastPublishedAt < VOTE_SYNC_INTERVAL_MS) return;
      lastPublishedAt = now;

      let hover = -1;
      let bestStage = 0;
      let bestProgress = 0;

      menuCards.forEach((card, index) => {
        const cardState = snap.cards[card.id];
        if (!cardState?.viewers?.length) return;

        if (
          cardState.stage > bestStage ||
          (cardState.stage === bestStage && cardState.progress > bestProgress)
        ) {
          bestStage = cardState.stage;
          bestProgress = cardState.progress;
          hover = index;
        }
      });

      const viewers = hover >= 0 ? snap.cards[menuCards[hover].id]?.viewers || [] : [];
      const viewersKey = viewers.join(',');
      const nextCardViewers = menuCards.map((card) => snap.cards[card.id]?.viewers || []);
      const cardsKey = nextCardViewers.map((ids) => ids.join(',')).join('|');
      const occupied = nextCardViewers.filter((ids) => ids.length > 0).length;
      const split = occupied >= 2 && nextCardViewers.every((ids) => ids.length < 2);

      if (hover !== lastHover) {
        lastHover = hover;
        lastViewersKey = viewersKey;
        hoverStartedAt = hover >= 0 ? now : 0;
        setHoveredIndex(hover);
        setHoverViewers(viewers);
      } else if (viewersKey !== lastViewersKey) {
        lastViewersKey = viewersKey;
        setHoverViewers(viewers);
      }

      if (cardsKey !== lastCardsKey) {
        lastCardsKey = cardsKey;
        setCardViewers(nextCardViewers);
        setIsSplit(split);
      }

      if (bestStage !== lastStage) {
        lastStage = bestStage;
        setStage(bestStage);
      }

      const progressRounded = Math.round(bestProgress * 50) / 50;
      if (progressRounded !== lastProgress) {
        lastProgress = progressRounded;
        setDwellProgress(progressRounded);
      }

      // 한 명이 일정 시간 보면 배경 영상 전환 (친구 UI 동작 유지)
      if (
        hover >= 0 &&
        hoverStartedAt > 0 &&
        now - hoverStartedAt >= BG_SWITCH_MS &&
        bgSwitchedFor !== hover
      ) {
        bgSwitchedFor = hover;
        setBgIndex(hover);
      }

      if (snap.winnerId && !completedRef.current) {
        completedRef.current = true;
        const index = menuCards.findIndex((card) => card.id === snap.winnerId);
        setSelectedIndex(index);
        setHoveredIndex(index);
        setHoverViewers(snap.cards[snap.winnerId]?.viewers || []);
        setCardViewers(menuCards.map((card) => snap.cards[card.id]?.viewers || []));
        setIsSplit(false);
        setStage(requiredViewers);
        setDwellProgress(1);
        onSelectRef.current?.(menuCards[index], index);
      }
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [gazeRef, cardRefs, menuCards, calibrated, enabled]);

  const scale = VOTE_STAGE_SCALES[Math.min(stage, VOTE_STAGE_SCALES.length - 1)] ?? 1;

  return {
    hoveredIndex,
    hoverViewers,
    cardViewers,
    isSplit,
    selectedIndex,
    bgIndex,
    stage,
    dwellProgress,
    scale,
  };
}
