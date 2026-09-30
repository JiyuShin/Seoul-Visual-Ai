import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './Ending.module.css';

const DEFAULT_FADE = 800;

function fadeOf(shot) {
  return shot && shot.fade > 0 ? shot.fade : DEFAULT_FADE;
}

export function rateForShot(shot, time) {
  if (!shot || !(shot.slowUntil > 0)) return 1;
  const from = shot.slowFrom > 0 ? shot.slowFrom : 0;
  if (time >= from && time < shot.slowUntil) return shot.slowRate || 0.25;
  return 1;
}

function syncRate(video, shot) {
  if (!video || video.tagName !== 'VIDEO') return;
  const rate = rateForShot(shot, video.currentTime);
  if (video.playbackRate !== rate) video.playbackRate = rate;
}

function whenReady(el) {
  if (!el) return Promise.resolve();
  if (el.tagName !== 'VIDEO') {
    if (el.complete) return Promise.resolve();
    return new Promise((resolve) => {
      el.addEventListener('load', () => resolve(), { once: true });
      window.setTimeout(resolve, 400);
    });
  }
  if (el.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    el.addEventListener('loadeddata', () => resolve(), { once: true });
    window.setTimeout(resolve, 700);
  });
}

function layerOf(el) {
  return el && el.parentElement;
}

function holdOpaque(layer, z) {
  if (!layer) return;
  layer.style.transition = 'none';
  layer.style.opacity = '1';
  layer.style.zIndex = String(z);
}

function hideLayer(layer) {
  if (!layer) return;
  layer.style.transition = 'none';
  layer.style.opacity = '0';
  layer.style.zIndex = '0';
}

function fadeLayerIn(incomingEl, outgoingEl, ms, done) {
  const start = performance.now();
  const tick = (now) => {
    holdOpaque(layerOf(outgoingEl), 1);
    const layer = layerOf(incomingEl);
    if (!layer) {
      done();
      return;
    }
    const t = Math.min(1, (now - start) / ms);
    const eased = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
    layer.style.transition = 'none';
    layer.style.zIndex = '2';
    layer.style.opacity = String(t >= 1 ? 1 : eased);
    if (t < 1) {
      window.requestAnimationFrame(tick);
      return;
    }
    done();
  };
  window.requestAnimationFrame(tick);
}

function Shot({ shot, shotIndex, clock, slotIndex, remember, onAdvance, onProgress }) {
  const fired = useRef(false);
  const freezing = useRef(false);
  const held = useRef(false);
  const holdFrame = useRef(0);
  const nodeRef = useRef(null);
  const rememberRef = useRef(remember);
  const progressRef = useRef(onProgress);
  rememberRef.current = remember;
  progressRef.current = onProgress;

  const setNode = useCallback((node) => {
    nodeRef.current = node;
    rememberRef.current(slotIndex, node);
  }, [slotIndex]);

  useEffect(() => {
    fired.current = false;
    held.current = false;
    freezing.current = false;
    window.clearInterval(holdFrame.current);
  }, [shot]);

  useEffect(() => () => window.clearInterval(holdFrame.current), []);

  const go = useCallback(() => {
    if (!clock || fired.current) return;
    if (onAdvance()) fired.current = true;
  }, [clock, onAdvance]);
  const goRef = useRef(go);
  goRef.current = go;

  const startFreeze = useCallback((video) => {
    held.current = true;
    freezing.current = true;
    // 되감으면 화면이 몇 프레임 뒤로 튀므로, 멈춘 자리의 프레임을 그대로 둔다.
    video.pause();
    const start = performance.now();
    const freezeMs = shot.freezeMs || 0;
    const tick = () => {
      if (!freezing.current) {
        window.clearInterval(holdFrame.current);
        return;
      }
      const elapsed = performance.now() - start;
      progressRef.current?.({
        index: shotIndex,
        time: shot.freezeAt,
        duration: video.duration,
        frozen: elapsed < freezeMs,
        freezeElapsed: elapsed,
        freezeMs,
      });
      if (elapsed < freezeMs) return;
      if (shot.advanceAfterFreeze) {
        // 앞 전환이 아직 끝나지 않아 거절되면 다음 틱에 다시 시도한다.
        goRef.current();
        if (!fired.current) return;
        window.clearInterval(holdFrame.current);
        freezing.current = false;
        return;
      }
      window.clearInterval(holdFrame.current);
      freezing.current = false;
      video.playbackRate = shot.slowRate || 0.2;
      const pending = video.play();
      if (pending && pending.catch) pending.catch(() => {});
    };
    window.clearInterval(holdFrame.current);
    holdFrame.current = window.setInterval(tick, 50);
    tick();
  }, [shot, shotIndex]);

  useEffect(() => {
    const el = nodeRef.current;
    if (!clock || !el || el.tagName !== 'VIDEO') return undefined;
    el.dataset.live = '1';
    freezing.current = false;
    if (shot.freezeAt > 0) {
      el.playbackRate = shot.approachRate || 1;
    } else {
      syncRate(el, shot);
    }
    const pending = el.play();
    if (pending && pending.catch) pending.catch(() => {});
    return undefined;
  }, [clock, shot, shotIndex]);

  if (!shot) return null;

  if (shot.kind === 'video') {
    return (
      <div className={styles.shot}>
        <video
          ref={setNode}
          className={styles.media}
          src={shot.src}
          muted
          playsInline
          preload="auto"
          onLoadedData={(event) => {
            const video = event.currentTarget;
            if (video.dataset.live === '1') return;
            video.pause();
            if (video.currentTime > 0.04) {
              try {
                video.currentTime = 0;
              } catch {
                // metadata can arrive before seeking is allowed
              }
            }
          }}
          onSeeked={(event) => {
            if (!clock) return;
            syncRate(event.currentTarget, shot);
          }}
          onTimeUpdate={(event) => {
            if (!clock || freezing.current) return;
            const video = event.currentTarget;
            if (!video.duration || !Number.isFinite(video.duration)) return;
            if (shot.freezeAt > 0 && !held.current && video.currentTime >= shot.freezeAt) {
              startFreeze(video);
              return;
            }
            if (shot.freezeAt > 0 && !held.current) {
              video.playbackRate = shot.approachRate || 1;
              if (shot.advanceAfterFreeze) {
                onProgress?.({ index: shotIndex, time: video.currentTime, duration: video.duration });
              }
              return;
            }
            if (shot.advanceAfterFreeze) return;
            syncRate(video, shot);
            onProgress?.({ index: shotIndex, time: video.currentTime, duration: video.duration });
            if (video.duration - video.currentTime <= fadeOf(shot) / 1000) go();
          }}
          onEnded={(event) => {
            if (!clock) return;
            if (shot.freezeAt > 0 && !held.current) {
              startFreeze(event.currentTarget);
              return;
            }
            if (shot.advanceAfterFreeze) return;
            go();
          }}
          onError={() => {
            if (clock) go();
          }}
        />
      </div>
    );
  }

  return (
    <div className={styles.shot}>
      <img ref={setNode} className={styles.media} src={shot.src} alt="" draggable={false} />
    </div>
  );
}

export default function Sequence({ shots, onDone, onProgress }) {
  const refs = useRef([null, null]);
  const activeSlot = useRef(0);
  const busy = useRef(false);
  const mounted = useRef(true);
  const [slots, setSlots] = useState(() => ([
    { shot: 0, clock: true },
    { shot: shots.length > 1 ? 1 : null, clock: false },
  ]));
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  const remember = useCallback((index, node) => {
    refs.current[index] = node;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    holdOpaque(layerOf(refs.current[0]), 2);
  }, []);

  useEffect(() => {
    if (shots.length) return undefined;
    const timer = window.setTimeout(onDone, 700);
    return () => window.clearTimeout(timer);
  }, [shots.length, onDone]);

  const advance = useCallback(() => {
    if (busy.current) return false;
    const active = activeSlot.current;
    const currentShot = slotsRef.current[active]?.shot ?? 0;
    const next = currentShot + 1;
    if (next >= shots.length) {
      busy.current = true;
      onDone();
      return true;
    }

    busy.current = true;
    const incoming = 1 - active;
    const fade = fadeOf(shots[currentShot]);
    const reveal = () => {
      if (!mounted.current) return;
      const incomingEl = refs.current[incoming];
      const outgoingEl = refs.current[active];
      if (incomingEl && incomingEl.tagName === 'VIDEO') {
        incomingEl.dataset.live = '1';
        if (incomingEl.currentTime > 0.05) {
          try {
            incomingEl.currentTime = 0;
          } catch {
            // seek can fail before the first frame is ready
          }
        }
        const opening = shots[next];
        if (opening && opening.freezeAt > 0) {
          incomingEl.playbackRate = opening.approachRate || 1;
        } else {
          incomingEl.playbackRate = rateForShot(opening, 0);
        }
        const pending = incomingEl.play();
        if (pending && pending.catch) pending.catch(() => {});
      }
      holdOpaque(layerOf(outgoingEl), 1);
      const holdCue = Boolean(shots[currentShot] && shots[currentShot].holdCue);
      setSlots((prev) => prev.map((slot, index) => {
        if (holdCue) {
          return index === incoming ? { shot: next, clock: false } : slot;
        }
        return index === incoming
          ? { shot: next, clock: true }
          : { ...slot, clock: false };
      }));
      if (!holdCue) activeSlot.current = incoming;
      fadeLayerIn(incomingEl, outgoingEl, fade, () => {
        if (!mounted.current) return;
        const hidden = refs.current[active];
        if (hidden && hidden.dataset) delete hidden.dataset.live;
        hideLayer(layerOf(hidden));
        if (holdCue) activeSlot.current = incoming;
        const following = next + 1;
        setSlots((prev) => prev.map((slot, index) => (
          index === incoming
            ? { shot: next, clock: true }
            : { shot: following < shots.length ? following : null, clock: false }
        )));
        busy.current = false;
      });
    };

    whenReady(refs.current[incoming]).then(reveal);
    return true;
  }, [onDone, shots]);

  useEffect(() => {
    const slotIndex = slots.findIndex((slot) => slot.clock);
    const slot = slots[slotIndex];
    const shot = slot && slot.shot != null ? shots[slot.shot] : null;
    if (!shot || shot.kind !== 'image') return undefined;
    const timer = window.setTimeout(() => {
      activeSlot.current = slotIndex;
      advance();
    }, Math.max(600, shot.ms || 2200));
    return () => window.clearTimeout(timer);
  }, [slots, shots, advance]);

  if (!shots.length) return null;

  return slots.map((slot, index) => (
    <Shot
      key={index}
      slotIndex={index}
      shot={slot.shot == null ? null : shots[slot.shot]}
      shotIndex={slot.shot}
      clock={slot.clock}
      remember={remember}
      onAdvance={advance}
      onProgress={onProgress}
    />
  ));
}
