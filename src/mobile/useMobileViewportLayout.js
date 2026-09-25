import { useEffect, useRef } from 'react';

/** visualViewport 높이가 layout 대비 이만큼 줄면 소프트 키보드로 본다 */
const KEYBOARD_HEIGHT_DELTA_PX = 80;

function isSoftKeyboardOpen() {
  if (typeof window === 'undefined') return false;
  const vv = window.visualViewport;
  if (!vv) return false;
  const layoutH = window.innerHeight;
  return layoutH - vv.height > KEYBOARD_HEIGHT_DELTA_PX && vv.height < layoutH * 0.85;
}

/**
 * .safe 높이는 layout viewport 기준. 키보드는 UI 위에 겹치고, 셸·스케일은 줄이지 않는다.
 * @param {React.RefObject<HTMLElement>} rootRef — .safe
 */
export function useMobileViewportLayout(rootRef) {
  const lockedLayoutHeightRef = useRef(0);

  useEffect(() => {
    const apply = () => {
      const el = rootRef.current;
      if (!el || typeof window === 'undefined') return;

      if (isSoftKeyboardOpen()) {
        if (lockedLayoutHeightRef.current > 0) {
          el.style.height = `${lockedLayoutHeightRef.current}px`;
        }
        return;
      }

      const layoutH = window.innerHeight;
      lockedLayoutHeightRef.current = layoutH;
      const frame = el.parentElement;
      const frameH = frame?.clientHeight ?? layoutH;
      el.style.height = `${Math.max(frameH, layoutH)}px`;
    };

    apply();
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', apply);

    return () => {
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
      vv?.removeEventListener('resize', apply);
      rootRef.current?.style.removeProperty('height');
    };
  }, [rootRef]);
}
