// 피그마 종로구1–17. 말풍선 박스(2303×1295)를 3881×2183 스테이지로 옮긴 값이다.
// 오브는 모든 장면에서 화면 가로 가운데에 고정한다.
// 1~2는 오브만 떠 있다가(종로구1) 종로구2 말풍선이 나타난다.
// 3~7은 1초 지점에서 멈춘 채 3→4, 그다음 슬로모션으로 5→7.
// 8 영상 시작부터 9~10 영상이 끝날 때까지는 9.
// 9~10은 끝 프레임에서 멈춘 채 10 → 11.
// 14~17은 살짝 느리게 16, 끝 프레임에서 멈춘 채 17.
// 6·8·12·13·15는 쓰지 않는다.
export const JONGNO_CLIPS = [
  [1, 2],
  [3, 4, 5, 6, 7],
  [8],
  [9, 10],
  [14, 15, 16, 17],
];

export const AGENT_BOX = { left: (3881 - 440) / 2, top: 109, size: 440 };

export const JONGNO_CUES = {
  1: {},
  2: {
    lines: [[{ text: '여러분이 상상하는 용산구에 지금부터 직접 식물을 심고 함께 키워볼게요' }]],
    bubble: { left: 1143, top: 374, width: 1595, height: 167 },
  },
  3: {
    lines: [
      [{ text: '두 분이 그린 새싹이 이 거리에 자리를 잡았어요! ' }],
      [{ text: '이제 두 분의 시선이 새싹을 자라게 할 햇빛이 되어줄 거예요' }],
    ],
    bubble: { left: 1266, top: 386, width: 1349, height: 238 },
  },
  4: {
    lines: [
      [{ text: '이제 각자의 새싹을 가만히 바라봐 주세요 ' }],
      [{ text: '꽃이 피어야 이 거리에 온전히 뿌리내릴 수 있어요' }],
    ],
    bubble: { left: 1363, top: 398, width: 1157, height: 238 },
  },
  5: {
    lines: [
      [
        { text: '[애플망고랑 스무디]', bold: true, name: 'A' },
        { text: '과 ' },
        { text: '[카스테라]', bold: true, name: 'B' },
        { text: '의 새싹들이 반응하고 있어요 ' },
      ],
      [{ text: '뿌리가 더 단단하게 자랄 수 있도록 조금만 더 바라봐주세요' }],
    ],
    bubble: { left: 1223, top: 398, width: 1433, height: 238 },
  },
  6: {
    lines: [[{ text: '새싹들이 조금씩 자라나는 모습이 보여서 기뻐요!' }]],
    bubble: { left: 1368, top: 398, width: 1146, height: 167 },
  },
  7: {
    lines: [
      [{ text: '두 분의 시선을 받아 식물들이 한 단계 더 자랐어요' }],
      [{ text: '이제 새싹들이 도시 곳곳으로 뻗어나가기 시작해요!' }],
    ],
    bubble: { left: 1347, top: 398, width: 1189, height: 238 },
  },
  8: {
    lines: [[{ text: '새싹들이 도시 곳곳에서 자라나고 있어요!' }]],
    bubble: { left: 1437, top: 398, width: 1007, height: 167 },
  },
  9: {
    lines: [
      [{ text: '여러분들이 피운 새싹들이 도시와 더 어우러질 수 있도록' }],
      [{ text: '함께 화면을 바라봐주세요' }],
    ],
    bubble: { left: 1298, top: 398, width: 1285, height: 238 },
  },
  10: {
    lines: [
      [{ text: '두 분이 애정으로 키운 식물들이 서울 곳곳으로 퍼져 나가고 있어요' }],
      [{ text: '그 전경을 함께 감상해볼까요?' }],
    ],
    bubble: { left: 1202, top: 398, width: 1477, height: 238 },
  },
  11: {
    lines: [[{ text: '위쪽을 바라보면 변화된 공간으로 이동해요' }]],
    bubble: { left: 1421, top: 398, width: 1037, height: 167 },
  },
  12: {
    lines: [
      [{ text: '두 분의 시선이 양분이 되어 ' }],
      [{ text: '서울이 이만큼 더 푸르게 성장했어요' }],
    ],
    bubble: { left: 611, top: 508, width: 909, height: 238, align: 'left' },
  },
  13: {
    lines: [
      [{ text: '조금 더 위로 올라가볼까요?' }],
      [{ text: '함께 위를 바라봐주세요' }],
    ],
    bubble: { left: 611, top: 508, width: 750, height: 238, align: 'left' },
  },
  16: {
    lines: [
      [{ text: '여러분들이 상상한 식물들로 완성된 서울의 전경이에요!' }],
      [{ text: '도시가 한층 더 푸르고 쾌적해졌어요' }],
    ],
    bubble: { left: 1304, top: 398, width: 1275, height: 238 },
  },
  17: {
    lines: [
      [{ text: '오늘 두 분이 함께 피워낸 초록은 이곳에 남아 계속 자라납니다' }],
      [{ text: '전시장 밖에서도 이 초록을 이어가는 서울을 만들어주세요' }],
    ],
    bubble: { left: 1245, top: 398, width: 1393, height: 238 },
  },
};

// 3~7 영상은 1초 지점까지 느리게 다가가 멈춘 채 3 → 4, 그 뒤 슬로모션 구간에서 5 → 7.
// ringFill·ringEnd는 슬로모션 구간(1초~끝) 안의 비율: 링이 다 차는 지점, 링이 사라지고 7로 넘어가는 지점.
export const SEVEN_HOLD = {
  at: 1,
  approachRate: 0.5,
  cue3Ms: 5000,
  cue4Ms: 5000,
  slowRate: 0.25,
  ringFill: 0.53,
  ringEnd: 0.62,
};

// 9~10 영상은 끝 프레임에서 멈춘 채 10 → 11을 보여 준 뒤 14~17로 넘어간다.
export const NINE_HOLD = { at: 4.8, cue10Ms: 6500, cue11Ms: 6500 };

// 14~17 영상은 살짝 느리게 16, 끝 프레임에서 멈춘 채 16을 조금 더 보여 주고 17.
export const FINALE_HOLD = { at: 4.9, rate: 0.85, cue16Ms: 2500, cue17Ms: 7500 };

function cueIdForClip(clipIndex, time, detail) {
  if (clipIndex === 0) return time < 1.6 ? 1 : 2;
  if (clipIndex === 1) {
    if (detail?.frozen) return detail.freezeElapsed < SEVEN_HOLD.cue3Ms ? 3 : 4;
    if (time < SEVEN_HOLD.at) return null;
    const span = (typeof detail === 'number' ? detail : detail?.duration) || 1;
    const rest = Math.max(span - SEVEN_HOLD.at, 0.01);
    return (time - SEVEN_HOLD.at) / rest < SEVEN_HOLD.ringEnd ? 5 : 7;
  }
  if (clipIndex === 2) return 9;
  if (clipIndex === 3) {
    if (detail?.frozen) return detail.freezeElapsed < NINE_HOLD.cue10Ms ? 10 : 11;
    return time < NINE_HOLD.at ? 9 : 11;
  }
  if (clipIndex === 4) {
    if (detail?.frozen) return detail.freezeElapsed < FINALE_HOLD.cue16Ms ? 16 : 17;
    return time < FINALE_HOLD.at ? 16 : 17;
  }
  const beats = JONGNO_CLIPS[clipIndex];
  if (!beats || !beats.length) return null;
  return beats[0];
}

export function cueForClip(clipIndex, time, detail) {
  const id = cueIdForClip(clipIndex, time, detail);
  const cue = id ? JONGNO_CUES[id] || null : null;
  return cue ? { ...cue, id } : null;
}

export function gazeRingState(clipIndex, time, detail) {
  if (clipIndex !== 1) return { visible: false, progress: 0, labels: false };
  if (detail?.frozen) {
    const labels = detail.freezeElapsed >= SEVEN_HOLD.cue3Ms;
    return { visible: labels, progress: 0, labels };
  }
  if (time < SEVEN_HOLD.at) return { visible: false, progress: 0, labels: false };
  const duration = (typeof detail === 'number' ? detail : detail?.duration) || 1;
  const rest = Math.max(duration - SEVEN_HOLD.at, 0.01);
  const sourceProgress = Math.max(0, Math.min(1, (time - SEVEN_HOLD.at) / rest));
  // 사라질 때 이름표를 켜 둔 채 레이어째 페이드해야 링과 이름표가 한 번에 사라진다.
  if (sourceProgress >= SEVEN_HOLD.ringEnd) return { visible: false, progress: 1, labels: true };
  const progress = Math.min(1, sourceProgress / SEVEN_HOLD.ringFill);
  return { visible: true, progress, labels: true };
}

const NAME_FALLBACK = [
  [{ text: '두 분의 새싹들이 반응하고 있어요 ' }],
  [{ text: '뿌리가 더 단단하게 자랄 수 있도록 조금만 더 바라봐주세요' }],
];

export function cueLines(cue, placeName, names) {
  if (!cue?.lines) return [];
  const place = placeName || '종로구';
  const named = cue.lines.some((line) => line.some((part) => part.name));
  if (named && !(names?.A && names?.B)) return NAME_FALLBACK;
  return cue.lines.map((line) => line.map((part) => {
    let text = part.text.replace(/용산구/g, place);
    if (part.name === 'A') text = names.A;
    if (part.name === 'B') text = names.B;
    return { text, bold: part.bold };
  }));
}
