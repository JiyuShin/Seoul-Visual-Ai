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
const CARD_TRAVEL_MS = 4500;
const CARD_SHIFT_PX = 7734;
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
  if (frame === 11 || frame === 12) return CARD_TRAVEL_MS / 2 + 40;
  if (frame === 18) return 1700;
  if (frame === 19) return 1500;
  if ([7, 8, 9, 10, 13, 14, 15, 17].includes(frame)) return 6800;
  return HOLD_MS;
}

function agentSpeaking(frame) {
  return [7, 8, 9, 10, 13, 14, 15, 17].includes(frame);
}

function CenterCard() {
  return (
    <div className={`${styles.centerCard} ${styles.cardRim}`}>
      <svg className={styles.centerSvg} viewBox="0 0 1450 815" aria-hidden="true">
        <defs>
          <clipPath id="opCenterClip">
            <rect width="1450" height="815" rx="53.3" ry="53.3" />
          </clipPath>
          <clipPath id="opLeafClip">
            <circle cx="725" cy="290" r="173" />
          </clipPath>
          <filter id="opPhotoBlur" x="-80" y="-80" width="1900" height="1200" filterUnits="userSpaceOnUse">
            <feGaussianBlur stdDeviation="7.5" />
          </filter>
          <filter id="opLeafHaloBlur" x="420" y="-10" width="620" height="600" filterUnits="userSpaceOnUse">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <linearGradient id="opWashA" gradientUnits="userSpaceOnUse" x1="1007.89" y1="1130.77" x2="635.11" y2="-185.77">
            <stop offset="8.209%" stopColor="rgb(60, 209, 255)" stopOpacity="0.4" />
            <stop offset="49.53%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="opWashB" gradientUnits="userSpaceOnUse" x1="1376.06" y1="1172.96" x2="266.94" y2="-227.96">
            <stop offset="4.516%" stopColor="rgb(223, 255, 213)" stopOpacity="0.4" />
            <stop offset="43.56%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="opWashC" gradientUnits="userSpaceOnUse" x1="275.57" y1="-230.36" x2="1367.43" y2="1175.36">
            <stop offset="9.983%" stopColor="rgb(184, 255, 162)" stopOpacity="0.6" />
            <stop offset="67.366%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="opLeafHalo" gradientUnits="userSpaceOnUse" cx="725" cy="290" r="250">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="72%" stopColor="#ffffff" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#e4ffd2" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g clipPath="url(#opCenterClip)">
          <rect width="1450" height="815" fill="#ffffff" />
          <g filter="url(#opPhotoBlur)">
            <g transform="rotate(180 821.5 472.5)">
              <image href="/op/card-center-bg.png" x="-21" y="0" width="1685" height="945" opacity="0.9" preserveAspectRatio="none" />
              <rect x="-21" y="0" width="1685" height="945" fill="url(#opWashA)" />
              <rect x="-21" y="0" width="1685" height="945" fill="url(#opWashB)" />
              <rect x="-21" y="0" width="1685" height="945" fill="url(#opWashC)" />
            </g>
          </g>
          <circle cx="725" cy="290" r="230" fill="url(#opLeafHalo)" filter="url(#opLeafHaloBlur)" />
          <g transform="translate(726.04 290) scale(1 -1) rotate(90) translate(-726.04 -290)" clipPath="url(#opLeafClip)">
            <image href="/op/card-leaf.png" x="553.04" y="117" width="346" height="346" preserveAspectRatio="none" style={{ mixBlendMode: 'lighten' }} />
          </g>
          <g transform="translate(726.04 290) scale(1 -1) rotate(90) translate(-726.04 -290)" clipPath="url(#opLeafClip)">
            <image href="/op/card-leaf.png" x="553.04" y="117" width="346" height="346" preserveAspectRatio="none" style={{ mixBlendMode: 'lighten' }} />
          </g>
          <g transform="translate(724.96 289.99) scale(1 -1) rotate(-98.12) translate(-724.96 -289.99)" clipPath="url(#opLeafClip)">
            <image href="/op/card-leaf-b.png" x="551.96" y="117" width="346" height="346" preserveAspectRatio="none" style={{ mixBlendMode: 'lighten' }} />
          </g>
        </g>
      </svg>
      <p>
        탁한 일상을 비우고
        <br />
        <b>맑은 초록으로 채우는</b> 서울
      </p>
    </div>
  );
}

export default function Opening() {
  const router = useRouter();
  const { isReady, isCalibrating } = useEntryFlow();
  const viewportRef = useRef(null);
  const cardRowRef = useRef(null);
  const cardGlideRef = useRef(null);
  const cardExitRef = useRef(false);
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
    const row = cardRowRef.current;
    if (!row) return undefined;
    if (frame === 11 && !cardGlideRef.current) {
      cardGlideRef.current = row.animate(
        [{ transform: 'translateX(0px)' }, { transform: `translateX(-${CARD_SHIFT_PX}px)` }],
        { duration: CARD_TRAVEL_MS, easing: 'linear', fill: 'forwards' },
      );
    }
    if (frame < 11 && cardGlideRef.current) {
      cardGlideRef.current.cancel();
      cardGlideRef.current = null;
      cardExitRef.current = false;
      row.style.transform = 'translateX(0px)';
    }
    if (frame >= 13 && cardGlideRef.current && !cardExitRef.current) {
      cardExitRef.current = true;
      row.animate(
        [
          { transform: `translateX(-${CARD_SHIFT_PX}px)` },
          { transform: `translateX(-${CARD_SHIFT_PX + 980}px)` },
        ],
        { duration: 1100, easing: 'ease-out', fill: 'forwards' },
      );
    }
    return undefined;
  }, [frame]);

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
            <div className={styles.cardRow} ref={cardRowRef}>
              <CenterCard />
              <div className={`${styles.sideCard} ${styles.cardRim}`}>
                <img src="/op/card-left.png" alt="" />
              </div>
              <div className={`${styles.sideCardRight} ${styles.cardRim}`}>
                <img src="/op/card-right.png" alt="" />
              </div>
            </div>
            <div className={styles.cardEdgeLeft}>
              <div className={styles.cardEdgeBlur} />
            </div>
            <div className={styles.cardEdgeRight}>
              <div className={styles.cardEdgeBlur} />
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
