// 피그마 종로구1–17. 보이는 오브·말풍선 박스(2303×1295)를 3881×2183 스테이지로 옮긴 값이다.
// 오브 박스는 빛망울이 들어 있는 바깥 프레임이라, 그려지는 구체는 그 한가운데에 앉는다.
// 1~2는 빈 말풍선(종로구1)에서 종로구2 문장으로 넘어간다.
// 3~7은 1초 지점에서 멈춘 채 3→4, 그다음 슬로모션으로 5→6→7.
// 8 영상은 8, 8→9 트랜지션부터 9~10 영상의 3초까지는 9.
// 9~10은 3초부터 슬로모션. 10을 거친 뒤 11이 나오고, 그 3초 뒤에 뒷부분을 원래 속도로 12.
// 14~17은 초반에 15, 이어서 16, 17.
export const JONGNO_CLIPS = [
  [1, 2],
  [3, 4, 5, 6, 7],
  [8],
  [9, 10],
  [14, 15, 16, 17],
];

export const JONGNO_CUES = {
  1: {
    bubble: { left: 1759, top: 411, width: 538, height: 170 },
    agent: { left: 1808, top: 110, size: 440 },
  },
  2: {
    lines: [[{ text: '여러분이 상상하는 용산구에 지금부터 직접 식물을 심고 함께 키워볼게요' }]],
    bubble: { left: 1143, top: 374, width: 1595, height: 167 },
    agent: { left: 1720, top: 109, size: 440 },
  },
  3: {
    lines: [
      [{ text: '두 분이 그린 새싹이 이 거리에 자리를 잡았어요! ' }],
      [{ text: '이제 두 분의 시선이 새싹을 자라게 할 햇빛이 되어줄 거예요' }],
    ],
    bubble: { left: 1266, top: 386, width: 1349, height: 238 },
    agent: { left: 1721, top: 121, size: 440 },
  },
  4: {
    lines: [
      [{ text: '이제 각자의 새싹을 가만히 바라봐 주세요 ' }],
      [{ text: '꽃이 피어야 이 거리에 온전히 뿌리내릴 수 있어요' }],
    ],
    bubble: { left: 1363, top: 398, width: 1157, height: 238 },
    agent: { left: 1721, top: 109, size: 440 },
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
    agent: { left: 1718, top: 109, size: 440 },
  },
  6: {
    lines: [[{ text: '새싹들이 조금씩 자라나는 모습이 보여서 기뻐요!' }]],
    bubble: { left: 1368, top: 398, width: 1146, height: 167 },
    agent: { left: 1721, top: 109, size: 440 },
  },
  7: {
    lines: [
      [{ text: '두 분의 시선을 받아 식물들이 한 단계 더 자랐어요' }],
      [{ text: '이제 새싹들이 도시 곳곳으로 뻗어나가기 시작해요!' }],
    ],
    bubble: { left: 1347, top: 398, width: 1189, height: 238 },
    agent: { left: 1720, top: 109, size: 440 },
  },
  8: {
    lines: [[{ text: '새싹들이 도시 곳곳에서 자라나고 있어요!' }]],
    bubble: { left: 1437, top: 398, width: 1007, height: 167 },
    agent: { left: 1721, top: 109, size: 440 },
  },
  9: {
    lines: [
      [{ text: '여러분들이 피운 새싹들이 도시와 더 어우러질 수 있도록' }],
      [{ text: '함께 화면을 바라봐주세요' }],
    ],
    bubble: { left: 1298, top: 398, width: 1285, height: 238 },
    agent: { left: 1721, top: 109, size: 440 },
  },
  10: {
    lines: [
      [{ text: '두 분이 애정으로 키운 식물들이 서울 곳곳으로 퍼져 나가고 있어요' }],
      [{ text: '그 전경을 함께 감상해볼까요?' }],
    ],
    bubble: { left: 1202, top: 398, width: 1477, height: 238 },
    agent: { left: 1721, top: 109, size: 440 },
  },
  11: {
    lines: [[{ text: '위쪽을 바라보면 변화된 공간으로 이동해요' }]],
    bubble: { left: 1421, top: 398, width: 1037, height: 167 },
    agent: { left: 1721, top: 110, size: 440 },
  },
  12: {
    lines: [
      [{ text: '두 분의 시선이 양분이 되어 ' }],
      [{ text: '서울이 이만큼 더 푸르게 성장했어요' }],
    ],
    bubble: { left: 611, top: 508, width: 909, height: 238, align: 'left' },
    agent: { left: 155, top: 408, size: 440 },
  },
  13: {
    lines: [
      [{ text: '조금 더 위로 올라가볼까요?' }],
      [{ text: '함께 위를 바라봐주세요' }],
    ],
    bubble: { left: 611, top: 508, width: 750, height: 238, align: 'left' },
    agent: { left: 155, top: 408, size: 440 },
  },
  14: {
    agent: { left: 155, top: 408, size: 440 },
  },
  15: {
    agent: { left: 1722, top: 110, size: 440 },
  },
  16: {
    lines: [
      [{ text: '여러분들이 상상한 식물들로 완성된 서울의 전경이에요!' }],
      [{ text: '도시가 한층 더 푸르고 쾌적해졌어요' }],
    ],
    bubble: { left: 1314, top: 1442, width: 1275, height: 238 },
    agent: { left: 1731, top: 1681, size: 440 },
  },
  17: {
    lines: [
      [{ text: '오늘 두 분이 함께 피워낸 초록은 이곳에 남아 계속 자라납니다.' }],
      [{ text: '전시장 밖에서도 이 초록을 이어가는 서울을 만들어주세요' }],
    ],
    bubble: { left: 1249, top: 1442, width: 1404, height: 238 },
    agent: { left: 1731, top: 1681, size: 440 },
  },
};

// 9~10 영상. 슬로모션 배속 0.25에서 10은 1.5초, 11은 그 다음 3초.
export const NINE_SLOW = {
  at: 3,
  rate: 0.25,
  cue10Wall: 1.5,
  cue11Wall: 3,
};

export const NINE_CUE10_AT = NINE_SLOW.at;
export const NINE_CUE11_AT = NINE_SLOW.at + NINE_SLOW.cue10Wall * NINE_SLOW.rate;
export const NINE_CUE12_AT = NINE_CUE11_AT + NINE_SLOW.cue11Wall * NINE_SLOW.rate;

function cueIdForClip(clipIndex, time, detail) {
  if (clipIndex === 0) return time < 1.6 ? 1 : 2;
  if (clipIndex === 1) {
    if (detail?.frozen) return detail.freezeElapsed < (detail.freezeMs || 1) / 2 ? 3 : 4;
    if (time < 1) return null;
    const span = (typeof detail === 'number' ? detail : detail?.duration) || 1;
    const rest = Math.max(span - 1, 0.01);
    const beats = [5, 6, 7];
    const index = Math.min(beats.length - 1, Math.max(0, Math.floor(((time - 1) / rest) * beats.length)));
    return beats[index];
  }
  if (clipIndex === 2) return 8;
  if (clipIndex === 3) {
    if (time < NINE_CUE10_AT) return 9;
    if (time < NINE_CUE11_AT) return 10;
    if (time < NINE_CUE12_AT) return 11;
    return 12;
  }
  if (clipIndex === 4) {
    if (time < 1) return 15;
    if (time < 2.5) return 16;
    return 17;
  }
  const beats = JONGNO_CLIPS[clipIndex];
  if (!beats || !beats.length) return null;
  return beats[0];
}

export function cueForClip(clipIndex, time, detail) {
  const id = cueIdForClip(clipIndex, time, detail);
  return id ? JONGNO_CUES[id] || null : null;
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
