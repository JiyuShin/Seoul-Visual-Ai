/** @typedef {{ id: string, image: string, scale?: number, rotate?: number, offsetY?: number, objectPosition?: string }} EndPlantVariant */

/** @type {Record<string, EndPlantVariant>} */
export const END_PLANT_VARIANTS = {
  'jongno-a': {
    id: 'jongno-a',
    image: '/mobile/plants/jongno-a.png',
    scale: 1.06,
    rotate: 13.7,
    offsetY: 2,
    objectPosition: 'center 76%',
  },
  'jongno-b': {
    id: 'jongno-b',
    image: '/mobile/plants/jongno-b.png',
    scale: 1.02,
    objectPosition: 'center 68%',
  },
  'jongno-c': {
    id: 'jongno-c',
    image: '/mobile/plants/jongno-c.png',
    scale: 0.96,
    objectPosition: 'center center',
  },
  'mapo-a': {
    id: 'mapo-a',
    image: '/mobile/plants/mapo-a.png',
    scale: 1,
    objectPosition: 'center 70%',
  },
  'mapo-b': {
    id: 'mapo-b',
    image: '/mobile/plants/mapo-b.png',
    scale: 1.02,
    rotate: -7.63,
    offsetY: 4,
    objectPosition: 'center 73%',
  },
  'mapo-c': {
    id: 'mapo-c',
    image: '/mobile/plants/mapo-c.png',
    scale: 1,
    objectPosition: 'center 68%',
  },
  'gangnam-a': {
    id: 'gangnam-a',
    image: '/mobile/plants/gangnam-a.png',
    scale: 1.08,
    objectPosition: 'center 70%',
  },
  'gangnam-b': {
    id: 'gangnam-b',
    image: '/mobile/plants/gangnam-b.png',
    scale: 1.08,
    objectPosition: 'center 70%',
  },
  'gangnam-c': {
    id: 'gangnam-c',
    image: '/mobile/plants/gangnam-c.png',
    scale: 1.02,
    rotate: -8.43,
    offsetY: 2,
    objectPosition: 'center 72%',
  },
};

const POOL_BY_DISTRICT = {
  종로구: ['jongno-a', 'jongno-b', 'jongno-c'],
  마포구: ['mapo-a', 'mapo-b', 'mapo-c'],
  강남구: ['gangnam-a', 'gangnam-b', 'gangnam-c'],
};

const DEFAULT_POOL = ['jongno-a', 'jongno-b', 'jongno-c'];

/**
 * @param {string} districtName
 * @returns {EndPlantVariant}
 */
export function pickEndPlantVariant(districtName) {
  const pool = POOL_BY_DISTRICT[districtName] ?? DEFAULT_POOL;
  const id = pool[Math.floor(Math.random() * pool.length)];
  return END_PLANT_VARIANTS[id];
}
