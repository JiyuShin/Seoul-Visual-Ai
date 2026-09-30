import LightField from '../LightField';

const plants = [
  { id: 'gangnam-1', name: '몬스테라', image: '/4/plant-left.png', tone: 'lilac' },
  { id: 'gangnam-2', name: '금목서향새싹', image: '/4/plant-right.png', tone: 'mint' },
  { id: 'gangnam-3', name: '새싹', image: '/4/plant-left.png', tone: 'lilac' },
];

export const name = '강남구';
export const assets = plants;
export const shots = [];

export function Overlay() {
  return <LightField color={0xd7fff4} rise={0.028} sway={0.0007} />;
}
