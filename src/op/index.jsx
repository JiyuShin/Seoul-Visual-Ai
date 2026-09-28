import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useEntryFlow } from '../shared/EntryFlowContext';
import styles from './Opening.module.css';

const STAGE = { width: 3881, height: 2183 };
const HOLD_MS = 3200;
const LAST_FRAME = 15;

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
        우리가 바라보는 <b>시선 끝에는 모두 각자의 관심</b>이 담겨 있습니다.
        <br />
        그 시선과 목소리를 따라 내가 원하는 식물을 도시 곳곳에 더해보세요.
      </>
    ),
  },
  {
    id: 9,
    text: (
      <>
        한 사람의 관심에서 시작된 작은 상상이 모이고 모여,
        <br />
        <b>서울의 풍경을 바꾸고 자연과 공존하는 서울</b>을 만들어갑니다.
      </>
    ),
  },
];

function orbPose(frame) {
  if (frame < 6) return 'hidden';
  if (frame === 6) return 'rise';
  if (frame <= 9) return 'low';
  if (frame === 13) return 'peek';
  return 'high';
}

function cardShift(frame) {
  if (frame <= 10) return -682;
  if (frame === 11) return -1370;
  return -3726;
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
    }, HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [frame, router]);

  return (
    <div className={styles.viewport} ref={viewportRef}>
      <div className={styles.fit} style={{ width: STAGE.width * scale, height: STAGE.height * scale }}>
        <div className={styles.stage} style={{ transform: `scale(${scale})` }}>
          <div className={`${styles.citySoft} ${frame === 3 ? styles.layerOn : ''}`}>
            <img src="/op/title-bg.png" alt="" />
          </div>
          <div className={`${styles.citySharp} ${frame === 4 ? styles.layerOn : ''}`}>
            <img src="/op/city-sharp.png" alt="" />
          </div>
          <div className={`${styles.citySoft} ${frame === 5 || frame === 6 ? styles.layerOn : ''}`}>
            <img src="/op/city-soft.png" alt="" />
          </div>
          <div className={`${styles.cityPlanted} ${frame >= 7 ? styles.layerOn : ''}`}>
            <img src="/op/city-plants.png" alt="" />
          </div>
          <div className={styles.titleBoard} style={{ opacity: frame < 3 ? 1 : 0 }}>
            <img className={styles.titleBg} src="/op/title-bg.png" alt="" />
            <div className={`${styles.orb} ${styles.titleOrb}`} />
            <img className={styles.plantRight} src="/op/plant-right.png" alt="" />
            <img className={styles.sprout} src="/op/sprout.png" alt="" />
            <img className={styles.plantFlip} src="/op/plant-flip.png" alt="" />
            <img className={styles.plantSpin} src="/op/plant-spin.png" alt="" />
            <img className={styles.plantLean} src="/op/plant-lean.png" alt="" />
            <p className={styles.wordmark} style={{ opacity: frame === 1 ? 1 : 0 }}>ONSI</p>
            <p className={styles.tagline} style={{ opacity: frame === 1 ? 1 : 0 }}>A City Cultivated by Sight</p>
          </div>
          <div className={styles.floor} style={{ opacity: frame >= 7 && frame <= 9 ? 1 : 0 }} />
          <div className={`${styles.orb} ${styles[orbPose(frame)]}`} />
          <div
            className={styles.cardRow}
            style={{
              left: cardShift(frame),
              opacity: frame >= 10 && frame <= 12 ? 1 : 0,
            }}
          >
            <img className={styles.sideCard} src="/op/card-left.png" alt="" />
            <div className={styles.centerCard}>
              <img className={styles.centerBg} src="/op/card-center-bg.png" alt="" />
              <img className={styles.centerLeaf} src="/op/card-leaf.png" alt="" />
              <p>
                탁한 일상을 비우고
                <br />
                <b>맑은 초록으로 채우는</b> 서울
              </p>
            </div>
            <img className={styles.sideCardRight} src="/op/card-right.png" alt="" />
          </div>
          {TELLS.map((item) => (
            <div key={item.id} className={`${styles.pill} ${styles.pillTell} ${frame === item.id ? styles.copyOn : ''}`}>
              <p className={styles.tellCopy}>{item.text}</p>
            </div>
          ))}
          <div className={`${styles.pill} ${styles.pillAsk} ${frame === 14 ? styles.copyOn : ''}`}>
            <p className={styles.askCopy}>
              여러분이 <b>상상하는 서울</b>은 어떤 모습인가요?
            </p>
          </div>
          <div className={`${styles.pill} ${styles.pillAsk} ${frame === 15 ? styles.copyOn : ''}`}>
            <p className={styles.askCopy}>
              이제 상상했던 서울을 직접 그려볼 시간이에요. <b>그럼 시작해볼게요!</b>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
