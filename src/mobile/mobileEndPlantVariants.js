/** @typedef {{ id: string, image: string, scale?: number, rotate?: number, offsetY?: number, objectPosition?: string }} EndPlantVariant */

/** @type {Record<string, EndPlantVariant>} */
export const END_PLANT_VARIANTS = {
  'jongno-a': {
    id: 'jongno-a',
    image: '/mobile/plants/jongno-a.png',
    scale: 1,
    objectPosition: 'center center',
  },
  'jongno-b': {
    id: 'jongno-b',
    image: '/mobile/plants/jongno-b.png',
    scale: 1,
    objectPosition: 'center center',
  },
  'jongno-c': {
    id: 'jongno-c',
    image: '/mobile/plants/jongno-c.png',
    scale: 1,
    objectPosition: 'center center',
  },
  'mapo-a': {
    id: 'mapo-a',
    image: '/mobile/plants/mapo-a.png',
    scale: 1,
    objectPosition: 'center center',
  },
  'mapo-b': {
    id: 'mapo-b',
    image: '/mobile/plants/mapo-b.png',
    scale: 1,
    objectPosition: 'center center',
  },
  'mapo-c': {
    id: 'mapo-c',
    image: '/mobile/plants/mapo-c.png',
    scale: 1,
    objectPosition: 'center center',
  },
  'gangnam-a': {
    id: 'gangnam-a',
    image: '/mobile/plants/gangnam-a.png',
    scale: 1,
    objectPosition: 'center center',
  },
  'gangnam-b': {
    id: 'gangnam-b',
    image: '/mobile/plants/gangnam-b.png',
    scale: 1,
    objectPosition: 'center center',
  },
  'gangnam-c': {
    id: 'gangnam-c',
    image: '/mobile/plants/gangnam-c.png',
    scale: 1,
    objectPosition: 'center center',
  },
};

const POOL_BY_DISTRICT = {
  종로구: ['jongno-a', 'jongno-b', 'jongno-c'],
  마포구: ['mapo-a', 'mapo-b', 'mapo-c'],
  강남구: ['gangnam-a', 'gangnam-b', 'gangnam-c'],
};

const DEFAULT_POOL = ['jongno-a', 'jongno-b', 'jongno-c'];

function hashString(value) {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * 같은 세션의 A·B 휴대폰은 sessionId 로 같은 시작 번호를 얻고,
 * B 는 그다음 식물을 받으므로 둘은 절대 겹치지 않는다 (풀 크기 ≥ 2 전제).
 * @param {string} districtName
 * @param {{ sessionId?: string | null, slot?: 'A' | 'B' | null }} [link]
 * @returns {EndPlantVariant}
 */
export function pickEndPlantVariant(districtName, link = {}) {
  const pool = POOL_BY_DISTRICT[districtName] ?? DEFAULT_POOL;
  const { sessionId, slot } = link;
  let index;
  if (sessionId && (slot === 'A' || slot === 'B')) {
    const base = hashString(sessionId) % pool.length;
    index = (base + (slot === 'B' ? 1 : 0)) % pool.length;
  } else {
    index = Math.floor(Math.random() * pool.length);
  }
  return END_PLANT_VARIANTS[pool[index]];
}
