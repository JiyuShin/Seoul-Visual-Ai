/**
 * 자치구별 식물 도감 카드. 슬롯 A가 왼쪽(초록·NABI), B가 오른쪽(보라·SORA).
 * 키오스크 연출은 하단 박스를 직접 그려야 해서 그 부분을 들어낸 -base 를 쓰고,
 * 폰에 저장하는 쪽은 글자까지 들어간 원본을 그대로 쓴다.
 */
const CARD_ART = {
  마포구: [
    { slot: 'A', art: 'mapo-1' },
    { slot: 'B', art: 'mapo-2' },
  ],
};

export function cardsFor(district) {
  return CARD_ART[district] || [];
}

export function cardFor(district, slot) {
  return cardsFor(district).find((card) => card.slot === slot) || null;
}

export function cardArtUrl(art, { base = false } = {}) {
  return `/5/cards/${art}${base ? '-base' : ''}.svg`;
}

export const CARD_SIZE = { width: 505, height: 769 };

// 폰에서 이름을 아직 안 적었을 때 카드에 들어가는 기본 이름.
const FALLBACK_NAMES = { A: 'NABI', B: 'SORA' };

export function plantNameFor(slot, names) {
  const typed = (names?.[slot] || '').trim();
  return typed || FALLBACK_NAMES[slot] || '';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 카드에 찍히는 날짜. 원래 디자인과 같은 'Sep. 27. 2026' 꼴. */
export function formatCardDate(date = new Date()) {
  return `${MONTHS[date.getMonth()]}. ${date.getDate()}. ${date.getFullYear()}`;
}
