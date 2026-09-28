import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useEntryFlow } from '../shared/EntryFlowContext';
import OpeningAgent from './OpeningAgent';
import styles from './Opening.module.css';

const STAGE = { width: 3881, height: 2183 };
const FIGMA = { width: 4074, height: 2274 };
const SX = STAGE.width / FIGMA.width;
const SY = STAGE.height / FIGMA.height;
const HOLD_MS = 3200;
const LAST_FRAME = 19;

const TELLS = [
  {
    id: 7,
    text: (
      <>
        아스팔트와 콘크리트로 가득한 서울 속에, <b>조금 더 많은 자연</b>이 더해진다면 어떤 모습일까요?
      </>
    ),
  },
  {
    id: 8,
    text: (
      <>
        우리가 바라보는 <b>시선 끝에는 모두 각자의 관심</b>이 담겨 있습니다
        <br />
        그 시선과 목소리를 따라 내가 원하는 식물을 도시 곳곳에 더해보세요
      </>
    ),
  },
  {
    id: 9,
    text: (
      <>
        한 사람의 관심에서 시작된 작은 상상이 모이고 모여,
        <br />
        <b>서울의 풍경을 바꾸고 자연과 공존하는 서울</b>을 만들어갑니다
      </>
    ),
  },
  {
    id: 10,
    text: (
      <>
        <b>ONSI</b>를 통해 앞으로 우리가 만들어갈 서울이
        <br />
        어떤 모습으로 변화할 수 있을지 만나볼 수 있어요
      </>
    ),
  },
];

function agentPose(frame) {
  let diameter = 2567;
  let centerY = 2577.5;
  if (frame === 3) {
    centerY = 2881;
  } else if (frame === 4 || frame === 5) {
    diameter = 2647.725;
    centerY = 4300;
  } else if (frame >= 6 && frame <= 17) {
    diameter = 2647.725;
    centerY = 2586.13;
  } else if (frame >= 18) {
    diameter = 856;
    centerY = 1137;
  }
  return {
    x: STAGE.width / 2,
    y: centerY * SY,
    size: diameter * SX,
  };
}

const AGENT_SOURCE = 960;
const ORB_RADIUS = 0.72;

function agentStyle(frame) {
  const pose = agentPose(frame);
  const visual = pose.size * (0.88 / ORB_RADIUS);
  const scale = visual / AGENT_SOURCE;
  const x = pose.x - visual / 2;
  const y = pose.y - visual / 2;
  return {
    width: AGENT_SOURCE,
    height: AGENT_SOURCE,
    transform: `translate(${x}px, ${y}px) scale(${scale})`,
    transformOrigin: '0 0',
  };
}

function plainOpacity(frame) {
  if (frame <= 1) return 0;
  if (frame >= 2 && frame <= 5) return 1;
  if (frame === 6 || frame === 7) return 0.7;
  if (frame === 8) return 0.29;
  return 0;
}

function bloomOpacity(frame) {
  if (frame === 17) return 0.8;
  if (frame >= 8) return 1;
  return 0;
}

function holdFor(frame) {
  if (frame === 1) return 1500;
  if (frame === 2) return 760;
  if (frame === 3) return 1750;
  if (frame === 4) return 2400;
  if (frame === 5) return 1800;
  if (frame === 16) return 2200;
  if (frame === 11 || frame === 12) return 1100;
  if (frame === 18) return 1700;
  if (frame === 19) return 1500;
  if ([7, 8, 9, 10, 13, 14, 15, 17].includes(frame)) return 6800;
  return HOLD_MS;
}

function agentSpeaking(frame) {
  return [7, 8, 9, 10, 13, 14, 15, 17].includes(frame);
}

export default function Opening() {
  const router = useRouter();
  const { isReady, isCalibrating } = useEntryFlow();
  const viewportRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [frame, setFrame] = useState(1);

  useEffect(() => {
    if (isReady && isCalibrating) router.replace('/app');
  }, [isReady, isCalibrating, router]);

  useEffect(() => {
    const fit = () => {
      const box = viewportRef.current;
      const width = box?.clientWidth || window.innerWidth;
      const height = box?.clientHeight || window.innerHeight;
      const next = Math.max(width / STAGE.width, height / STAGE.height);
      setScale(next > 0 ? next : 1);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (frame >= LAST_FRAME) {
        router.push('/2');
        return;
      }
      setFrame((current) => current + 1);
    }, holdFor(frame));
    return () => window.clearTimeout(timer);
  }, [frame, router]);

  return (
    <div className={styles.viewport} ref={viewportRef}>
      <div className={styles.fit} style={{ width: STAGE.width * scale, height: STAGE.height * scale }}>
        <div className={styles.stage} style={{ transform: `scale(${scale})` }}>
          <div className={styles.cityBase}>
            <img src="/op/city-sharp.png" alt="" style={{ opacity: plainOpacity(frame) }} />
          </div>
          <div className={styles.cityBloom} style={{ opacity: bloomOpacity(frame) }}>
            <img src={frame >= 8 ? '/op/title-bg-blur.png' : '/op/title-bg.png'} alt="" />
          </div>
          <div className={`${styles.titleBoard} ${frame >= 4 ? styles.titleBoardOut : ''}`}>
            <img className={styles.titleBg} src="/op/title-bg-blur.png" alt="" />
            <div className={`${styles.flowersLeft} ${frame >= 3 ? styles.flowersLeftOut : ''}`}>
              <img className={styles.plantSpin} src="/op/plant-spin.png" alt="" />
              <img className={styles.plantLean} src="/op/plant-lean.png" alt="" />
              <img className={styles.sprout} src="/op/sprout.png" alt="" />
            </div>
            <div className={`${styles.flowersRight} ${frame >= 3 ? styles.flowersRightOut : ''}`}>
              <img className={styles.plantRight} src="/op/plant-right.png" alt="" />
              <img className={styles.plantFlip} src="/op/plant-flip.png" alt="" />
            </div>
            <p className={styles.wordmark} style={{ opacity: frame === 1 ? 1 : 0 }}>ONSI</p>
            <p className={styles.tagline} style={{ opacity: frame === 1 ? 1 : 0 }}>A City Cultivated by Sight</p>
          </div>
          <div className={styles.agentMove} style={agentStyle(frame)}>
            <div className={`${styles.agentFloat} ${agentSpeaking(frame) ? styles.agentSpeaking : ''}`}>
              <OpeningAgent speaking={agentSpeaking(frame)} />
            </div>
          </div>
          <div className={`${styles.cardScene} ${frame === 11 || frame === 12 ? styles.cardSceneOn : ''}`}>
            <div className={styles.cardRow}>
              <img className={styles.sideCard} src="/op/card-left.png" alt="" />
              <img className={styles.sideCardRight} src="/op/card-right.png" alt="" />
              <img className={styles.frameCenter} src="/op/op10-frame-center.png" alt="" />
            </div>
          </div>
          <div className={`${styles.floor} ${agentSpeaking(frame) || frame === 11 || frame === 12 ? styles.floorOn : ''}`} />
          {TELLS.map((item) => (
            <div
              key={item.id}
              className={`${styles.pill} ${styles.pillTell} ${item.id === 7 ? styles.pillTight : ''} ${frame === item.id ? styles.copyOn : ''}`}
            >
              <p className={styles.tellCopy}>{item.text}</p>
            </div>
          ))}
          <div className={`${styles.pill} ${styles.pillAsk} ${frame === 14 ? styles.copyOn : ''}`}>
            <p className={styles.askCopy}>이제 상상하는 서울을 직접 그려볼 시간이에요</p>
          </div>
          <div className={`${styles.pill} ${styles.pillAsk} ${frame === 15 ? styles.copyOn : ''}`}>
            <p className={styles.askCopy}>
              먼저, 여러분이 생각하는 서울의 모습을 <b>이야기하며 서로의 생각을 나눠볼게요</b>
            </p>
          </div>
          <div className={`${styles.pill} ${styles.pillAsk} ${frame === 13 ? styles.copyOn : ''}`}>
            <p className={styles.askCopy}>
              여러분이 <b>상상하는 서울</b>은 어떤 모습인가요?
            </p>
          </div>
          <div className={`${styles.pill} ${styles.pillAsk} ${frame === 17 ? styles.copyOn : ''}`}>
            <p className={styles.askCopy}>
              그럼 시작해볼까요?
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
