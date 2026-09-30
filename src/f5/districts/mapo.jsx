import LightField from '../LightField';

const plants = [
  { id: 'mapo-1', name: '몬스테라', image: '/4/plant-left.png', tone: 'lilac' },
  { id: 'mapo-2', name: '금목서향새싹', image: '/4/plant-right.png', tone: 'mint' },
  { id: 'mapo-3', name: '새싹', image: '/4/plant-right.png', tone: 'mint' },
];

export const name = '마포구';
export const assets = plants;
export const shots = [];

export function Overlay() {
  return <LightField color={0xffd6ef} rise={0.02} sway={0.0011} />;
}
