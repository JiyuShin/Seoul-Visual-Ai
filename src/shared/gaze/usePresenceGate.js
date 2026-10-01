import { useEffect, useRef, useState } from 'react';
import { createFaceLandmarker } from './faceLandmarker';
import { eulerFromMatrix } from './features';

const DEG = 180 / Math.PI;

/**
 * 키오스크 앞 두 사람이 정면으로 버티고 있는지 아이맥 카메라로 판정한다.
 * 카메라가 좌대(63~80cm) 위에서 올려다보므로 상체·얼굴만 잡히고, 고개가 위아래로 꽤 기울어 보인다.
 * 눈동자는 쓰지 않고 얼굴 크기·위치·고개 방향만 본다.
 */
export const PRESENCE = {
  people: 2,
  holdMs: 15000,
  // 검출이 잠깐 끊겨도 이 시간 안에 돌아오면 누적 시간을 지우지 않는다.
  graceMs: 1000,
  intervalMs: 100,
  maxFaces: 6,
  // 얼굴 폭 / 화면 폭. 약 1.5m 안쪽에 선 사람만 남기고 뒤로 지나가는 사람을 거른다.
  minFaceWidth: 0.07,
  // 가장 큰 얼굴의 이 비율보다 작으면 뒤쪽 사람으로 본다.
  minRelativeWidth: 0.5,
  // 얼굴이 화면 좌우 끝에 걸쳐 있으면 들어오거나 나가는 중으로 본다.
  edgeMargin: 0.03,
  maxYawDeg: 28,
  // 올려다보는 각도 때문에 정면을 봐도 pitch 가 0에서 벗어난다. 현장에서 ?presenceDebug=1 로 보고 맞춘다.
  pitchCenterDeg: 0,
  maxPitchDeg: 35,
  cameraLabel: /facetime|built-in|내장/i,
  cameraStorageKey: 'seoul-presence-camera',
};

function measureFace(lm, matrix) {
  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  for (const p of lm) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const pose = matrix?.length >= 16 ? eulerFromMatrix(matrix) : null;
  return {
    minX,
    maxX,
    minY,
    maxY,
    cy: (minY + maxY) / 2,
    width: maxX - minX,
    yaw: pose ? pose.yaw * DEG : 0,
    pitch: pose ? pose.pitch * DEG : 0,
  };
}

/** 얼굴마다 통과하지 못한 이유(reasons)를 붙이고, 통과한 얼굴(kept)을 큰 순서로 돌려준다. */
export function evaluateFaces(result, config = PRESENCE) {
  const measured = (result?.faceLandmarks || []).map((lm, i) =>
    measureFace(lm, result.facialTransformationMatrixes?.[i]?.data)
  );
  const largest = measured.reduce((max, face) => Math.max(max, face.width), 0);
  const faces = measured.map((face) => {
    const reasons = [];
    if (face.width < config.minFaceWidth) reasons.push('멀다');
    else if (face.width < largest * config.minRelativeWidth) reasons.push('뒤쪽');
    if (face.minX < config.edgeMargin || face.maxX > 1 - config.edgeMargin || face.cy <= 0 || face.cy >= 1) {
      reasons.push('가장자리');
    }
    if (Math.abs(face.yaw) > config.maxYawDeg) reasons.push('고개 좌우');
    if (Math.abs(face.pitch - config.pitchCenterDeg) > config.maxPitchDeg) reasons.push('고개 위아래');
    return { ...face, reasons, ok: reasons.length === 0 };
  });
  const kept = faces.filter((face) => face.ok).sort((a, b) => b.width - a.width);
  return { faces, kept };
}

/** 검출이 graceMs 넘게 끊기면 누적 시간을 0으로 돌린다. hold 는 { heldMs, lastOkAt } 를 그대로 고친다. */
export function advanceHold(hold, ok, now, dt, config = PRESENCE) {
  if (ok) {
    hold.lastOkAt = now;
    hold.heldMs += dt;
  } else if (now - hold.lastOkAt > config.graceMs) {
    hold.heldMs = 0;
  }
  return Math.min(1, hold.heldMs / config.holdMs);
}

export async function videoInputs() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === 'videoinput');
}

export function pickCamera(devices, want) {
  if (want) {
    const needle = want.toLowerCase();
    const hit = devices.find(
      (device) => device.deviceId === want || device.label.toLowerCase().includes(needle)
    );
    if (hit) return hit.deviceId;
  }
  return devices.find((device) => PRESENCE.cameraLabel.test(device.label))?.deviceId || '';
}

function cameraConstraints(deviceId) {
  return {
    video: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    },
    audio: false,
  };
}

// 권한을 받기 전에는 장치 이름이 비어 있으므로, 기본 카메라로 한 번 연 뒤 다시 고른다.
export async function openCamera(want) {
  let id = pickCamera(await videoInputs(), want);
  let stream = await navigator.mediaDevices.getUserMedia(cameraConstraints(id));
  if (!id) {
    id = pickCamera(await videoInputs(), want);
    const current = stream.getVideoTracks()[0]?.getSettings().deviceId;
    if (id && id !== current) {
      stream.getTracks().forEach((track) => track.stop());
      stream = await navigator.mediaDevices.getUserMedia(cameraConstraints(id));
    }
  }
  return stream;
}

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
    if (!navigator.mediaDevices?.getUserMedia) {
      setState((current) => ({ ...current, status: 'no-camera-api' }));
      return undefined;
    }

    let alive = true;
    let timer = 0;
    let stream = null;
    let landmarker = null;
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;

    // 통과하자마자 카메라를 끈다. /1 로 넘어간 뒤까지 내장 카메라가 켜져 있으면 안 된다.
    const release = () => {
      alive = false;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      video.srcObject = null;
      landmarker?.close();
      landmarker = null;
    };

    const hold = { heldMs: 0, lastOkAt: 0 };
    let lastTick = 0;
    let lastStamp = 0;

    const step = () => {
      if (!alive) return;
      const now = performance.now();
      const dt = lastTick ? Math.min(now - lastTick, 250) : 0;
      lastTick = now;

      if (video.readyState >= 2 && video.videoWidth) {
        const stamp = Math.max(now, lastStamp + 1);
        lastStamp = stamp;
        const { faces, kept } = evaluateFaces(landmarker.detectForVideo(video, stamp));
        const progress = advanceHold(hold, kept.length >= PRESENCE.people, now, dt);
        if (report) setState({ status: 'watching', faces, kept: kept.length, progress });
        if (progress >= 1) {
          release();
          onPassRef.current?.();
          return;
        }
      }
      timer = window.setTimeout(step, PRESENCE.intervalMs);
    };

    (async () => {
      try {
        setState((current) => ({ ...current, status: 'loading' }));
        const want = camera || window.localStorage.getItem(PRESENCE.cameraStorageKey) || '';
        const opened = await openCamera(want);
        if (!alive) {
          opened.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = opened;
        video.srcObject = stream;
        await video.play();
        const created = await createFaceLandmarker(undefined, { numFaces: PRESENCE.maxFaces });
        if (!alive) {
          created.close();
          return;
        }
        landmarker = created;
        setState((current) => ({ ...current, status: 'watching' }));
        step();
      } catch (err) {
        if (alive) setState((current) => ({ ...current, status: `error: ${err?.message || err}` }));
      }
    })();

    return release;
  }, [enabled, camera, report]);

  return state;
}
