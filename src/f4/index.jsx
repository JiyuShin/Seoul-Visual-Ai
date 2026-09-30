import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useEntryFlow } from '../shared/EntryFlowContext';
import QuietStreet from './QuietStreet';
import styles from './PageFour.module.css';

const STAGE = { width: 3881, height: 2183 };
const TRAVEL_MS = 7000;
const DRAW_HOLD_MS = 5600;
const PLACES = ['종로구', '마포구', '강남구'];

const PLACEHOLDER_PLANTS = [
  { name: '몬스테라', image: '/4/plant-left.png', tone: 'lilac' },
  { name: '금목서향새싹', image: '/4/plant-right.png', tone: 'mint' },
];

function readStoredPlace() {
  try {
    const stored = sessionStorage.getItem('seoul-district') || '';
    return PLACES.includes(stored) ? stored : '';
  } catch {
    return '';
  }
}

export default function PageFour() {
  const router = useRouter();
  const { selectedDistrict } = useEntryFlow();
  const viewportRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [step, setStep] = useState('travel');
  const [streetReady, setStreetReady] = useState(false);
  const [placeName, setPlaceName] = useState('');
  const travelStarted = useRef(false);

  useEffect(() => {
    if (!router.isReady) return;
    const queryName = typeof router.query.district === 'string' ? router.query.district : '';
    const contextName = selectedDistrict?.name || '';
    const next = [queryName, contextName, readStoredPlace()].find((item) => PLACES.includes(item)) || '종로구';
    setPlaceName((current) => (current === next ? current : next));
  }, [router.isReady, router.query.district, selectedDistrict]);

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
    if (!streetReady || travelStarted.current) return undefined;
    travelStarted.current = true;
    const timer = window.setTimeout(() => setStep('draw'), TRAVEL_MS);
    return () => window.clearTimeout(timer);
  }, [streetReady]);

  useEffect(() => {
    if (step !== 'draw') return undefined;
    // 모바일 전송 신호가 연결되면 이 타이머 대신 그 신호로 slots로 넘긴다.
    const timer = window.setTimeout(() => setStep('slots'), DRAW_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [step]);

  return (
    <div className={styles.viewport} ref={viewportRef}>
      <div className={styles.fit} style={{ width: STAGE.width * scale, height: STAGE.height * scale }}>
        <div className={styles.stage} style={{ transform: `scale(${scale})` }}>
          {placeName ? (
            <QuietStreet
              name={placeName}
              still={step === 'travel'}
              hold={step === 'slots'}
              onReady={() => setStreetReady(true)}
            />
          ) : null}
          {streetReady && (step === 'travel' || step === 'draw') ? (
            <div className={`${styles.bubble} ${styles.bubbleTravel} ${step === 'draw' ? styles.bubbleLeave : ''}`}>
              <p className={styles.copy}>
                상상한 식물을 심을 <span className={styles.place}>{placeName}로 </span>이동중이에요...
              </p>
            </div>
          ) : null}
          {step === 'draw' || step === 'slots' ? (
            <div className={`${styles.bubble} ${styles.bubbleDraw} ${step === 'draw' ? styles.bubbleEnter : styles.bubbleLeaveSoft}`}>
              <p className={styles.copy}>
                이 공간에 어떤 식물이 자라면 좋을까요?
                <br />
                모바일 화면에 원하는 식물을 그려주세요
              </p>
            </div>
          ) : null}
          {step === 'slots' ? (
            <>
              <div className={`${styles.sproutCopy} ${styles.sproutSequence}`}>
                <p className={styles.sproutTitle}>
                  두 분의 식물이 <b>새싹을 틔웠어요!</b>
                </p>
                <p className={styles.sproutSub}>이제 {placeName}로 함께 이동해 직접 심어볼게요</p>
              </div>
              {PLACEHOLDER_PLANTS.map((plant, index) => (
                <div
                  key={plant.name}
                  className={`${styles.plantSlot} ${index === 0 ? styles.slotLeft : styles.slotRight} ${styles.slotSequence}`}
                >
                  <div className={styles.orb}>
                    <div className={styles.orbClip}>
                      <img className={styles.plant} src={plant.image} alt="" />
                    </div>
                    <img className={styles.orbRing} src="/4/orb-grown.svg" alt="" />
                  </div>
                  <p className={`${styles.namePill} ${plant.tone === 'lilac' ? styles.nameLilac : styles.nameMint}`}>
                    <span className={styles.nameText}>{plant.name}</span>
                  </p>
                </div>
              ))}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
