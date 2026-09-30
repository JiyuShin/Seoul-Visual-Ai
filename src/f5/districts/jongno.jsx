import LightField from '../LightField';
import { NINE_CUE12_AT, NINE_SLOW } from '../jongnoCues';

const plants = [
  { id: 'jongno-1', name: '몬스테라', image: '/4/plant-left.png', tone: 'lilac' },
  { id: 'jongno-2', name: '금목서향새싹', image: '/4/plant-right.png', tone: 'mint' },
  { id: 'jongno-3', name: '새싹', image: '/4/plant-left.png', tone: 'lilac' },
];

export const name = '종로구';
export const assets = plants;
// 업스케일 영상을 번호 순서대로 잇는다. fade는 이 영상의 끝과 다음 영상의 시작이 겹치는 시간이다.
export const shots = [
  { kind: 'video', src: '/5/jongno/1-2.mp4', fade: 1200 },
  { kind: 'video', src: '/5/jongno/3-7.mp4', fade: 1000, freezeAt: 1, freezeMs: 7000, slowFrom: 1, slowUntil: 1e9, slowRate: 0.2, holdCue: true },
  { kind: 'video', src: '/5/jongno/8.mp4', fade: 1200 },
  {
    kind: 'video',
    src: '/5/jongno/9-10.mp4',
    fade: 400,
    slowFrom: NINE_SLOW.at,
    slowUntil: NINE_CUE12_AT,
    slowRate: NINE_SLOW.rate,
  },
  { kind: 'video', src: '/5/jongno/14-17.mp4', fade: 1500 },
];

export function Overlay() {
  return <LightField color={0xfff4d2} rise={0.012} sway={0.0005} />;
}
