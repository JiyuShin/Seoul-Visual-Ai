import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useEntryFlow } from '../EntryFlowContext';
import { useMobileLink } from '../mobileLink/MobileLinkContext';
import { evaluateFaces } from './presence';
import { subscribePresence } from './presenceCamera';

/**
 * 체험 흐름(/1~/5)에서 사람이 떠났거나 바뀌었으면 /pre_opening 으로 되돌린다.
 * - idleMs 동안 아무 활동이 없으면 돌아간다.
 * - newUserGapMs 넘게 비어 있다가 누군가 정면으로 들어오면, 새 사용자로 보고 돌아간다.
 * 활동: 카메라 앞에 arriveMs 이상 머문 얼굴, 시선 응시 진행, 마우스·터치·키 입력, 페이지 이동, 휴대폰 연동 메시지.
 * 짧게 스쳐 가는 사람(arriveMs 미만)은 활동으로 치지 않는다.
 */
export const IDLE_RESET = {
  pages: ['/1', '/2', '/3', '/fail', '/4', '/5'],
  home: '/pre_opening',
  idleMs: 5 * 60 * 1000,
  newUserGapMs: 30 * 1000,
  arriveMs: 2000,
  faceGraceMs: 800,
};

const INPUT_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'];

export default function FlowIdleGuard() {
  const router = useRouter();
  const { resetFlow, dwellProgress } = useEntryFlow();
  const { disconnect, status: linkStatus, slots, plantNames } = useMobileLink();
  const active = IDLE_RESET.pages.includes(router.pathname);

  const stateRef = useRef({ lastActiveAt: 0, faceSince: 0, lastNearAt: 0, gapBefore: 0, fired: false });

  const resetRef = useRef(null);
  resetRef.current = () => {
    resetFlow();
    disconnect();
    router.replace(IDLE_RESET.home);
  };

  const markActive = useCallback(() => {
    const state = stateRef.current;
    state.lastActiveAt = performance.now();
    state.gapBefore = 0;
  }, []);

  useEffect(() => {
    markActive();
  }, [router.asPath, markActive]);

  useEffect(() => {
    if (dwellProgress > 0) markActive();
  }, [dwellProgress, markActive]);

  // /4 에서 휴대폰으로 이름을 쓰는 동안은 고개를 숙여 얼굴이 안 잡힐 수 있다.
  useEffect(() => {
    markActive();
  }, [linkStatus, slots, plantNames, markActive]);

  useEffect(() => {
    if (!active) return undefined;

    const state = stateRef.current;
    Object.assign(state, {
      lastActiveAt: performance.now(),
      faceSince: 0,
      lastNearAt: 0,
      gapBefore: 0,
      fired: false,
    });

    const fire = () => {
      if (state.fired) return;
      state.fired = true;
      resetRef.current();
    };

    INPUT_EVENTS.forEach((type) => window.addEventListener(type, markActive, { passive: true }));

    const idleTimer = window.setInterval(() => {
      if (performance.now() - state.lastActiveAt >= IDLE_RESET.idleMs) fire();
    }, 1000);

    const unsubscribe = subscribePresence(({ result, now }) => {
      if (!result) return;
      const { faces } = evaluateFaces(result);
      const near = faces.some((face) => face.near);

      if (!near) {
        if (state.faceSince && now - state.lastNearAt > IDLE_RESET.faceGraceMs) state.faceSince = 0;
        return;
      }

      if (!state.faceSince) {
        state.faceSince = now;
        state.gapBefore = now - state.lastActiveAt;
      }
      state.lastNearAt = now;
      if (now - state.faceSince < IDLE_RESET.arriveMs) return;

      if (state.gapBefore < IDLE_RESET.newUserGapMs) {
        state.lastActiveAt = now;
      } else if (faces.some((face) => face.ok)) {
        fire();
      }
    });

    return () => {
      INPUT_EVENTS.forEach((type) => window.removeEventListener(type, markActive));
      window.clearInterval(idleTimer);
      unsubscribe();
    };
  }, [active, markActive]);

  return null;
}
