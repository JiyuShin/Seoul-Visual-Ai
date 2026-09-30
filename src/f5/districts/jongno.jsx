import LightField from '../LightField';
import { FINALE_HOLD, NINE_HOLD, SEVEN_HOLD } from '../jongnoCues';

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
  {
    kind: 'video',
    src: '/5/jongno/3-7.mp4',
    fade: 1000,
    freezeAt: SEVEN_HOLD.at,
    freezeMs: SEVEN_HOLD.cue3Ms + SEVEN_HOLD.cue4Ms,
    approachRate: SEVEN_HOLD.approachRate,
    slowFrom: SEVEN_HOLD.at,
    slowUntil: 1e9,
    slowRate: SEVEN_HOLD.slowRate,
    holdCue: true,
  },
  { kind: 'video', src: '/5/jongno/8.mp4', fade: 1200 },
  {
    kind: 'video',
    src: '/5/jongno/9-10.mp4',
    fade: 1200,
    freezeAt: NINE_HOLD.at,
    freezeMs: NINE_HOLD.cue10Ms + NINE_HOLD.cue11Ms,
    advanceAfterFreeze: true,
  },
  {
    kind: 'video',
    src: '/5/jongno/14-17.mp4',
    fade: 600,
    freezeAt: FINALE_HOLD.at,
    freezeMs: FINALE_HOLD.cue16Ms + FINALE_HOLD.cue17Ms,
    approachRate: FINALE_HOLD.rate,
    advanceAfterFreeze: true,
  },
];

export function Overlay() {
  return <LightField color={0xfff4d2} rise={0.012} sway={0.0005} />;
}
