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
    let lastStage = 0;
    let lastProgress = 0;
    let hoverStartedAt = 0;
    let bgSwitchedFor = -1;

    const hitTest = (x, y) => {
      const els = cardRefs.current || [];
      for (let i = 0; i < els.length; i += 1) {
        const el = els[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          return i;
        }
      }
      return -1;
    };

    const loop = () => {
      rafId = requestAnimationFrame(loop);
      if (completedRef.current) return;

      const now = Date.now();

      CAM_KEYS.forEach((key) => {
        if (calibrated.length && !calibrated.includes(key)) return;
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
    selectedIndex,
    bgIndex,
    stage,
    dwellProgress,
    scale,
  };
}
