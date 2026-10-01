import { useEffect, useRef, useState } from 'react';
import { PRESENCE, advanceHold, evaluateFaces } from './presence';
import { subscribePresence } from './presenceCamera';

/**
 * 두 사람이 holdMs 동안 정면에 머물면 onPass 를 한 번 부른다.
 * @param {{ enabled?: boolean, onPass: () => void, camera?: string, report?: boolean }} options
 *   camera 는 deviceId 나 장치 이름 일부. 비우면 localStorage 값, 그다음 아이맥 내장 카메라.
 *   report 를 켜면 판정 상태를 매 프레임 state 로 돌려준다.
 */
export default function usePresenceGate({ enabled = true, onPass, camera = '', report = false }) {
  const [state, setState] = useState({ status: 'idle', faces: [], kept: 0, progress: 0 });
  const onPassRef = useRef(onPass);
  onPassRef.current = onPass;

  useEffect(() => {
    if (!enabled) return undefined;

    const hold = { heldMs: 0, lastOkAt: 0 };
    let lastTick = 0;
    let done = false;
    let unsubscribe = null;

    unsubscribe = subscribePresence(
      ({ status, result, now }) => {
        if (done) return;
        if (!result) {
          setState((current) => (current.status === status ? current : { ...current, status }));
          return;
        }
        const dt = lastTick ? Math.min(now - lastTick, 250) : 0;
        lastTick = now;
        const { faces, kept } = evaluateFaces(result);
        const progress = advanceHold(hold, kept.length >= PRESENCE.people, now, dt);
        if (report) setState({ status, faces, kept: kept.length, progress });
        if (progress >= 1) {
          done = true;
          unsubscribe?.();
          onPassRef.current?.();
        }
      },
      { camera }
    );

    return () => {
      done = true;
      unsubscribe?.();
    };
  }, [enabled, camera, report]);

  return state;
}
