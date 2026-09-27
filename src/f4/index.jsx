import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useEntryFlow } from '../shared/EntryFlowContext';
import QuietStreet from './QuietStreet';
import styles from './PageFour.module.css';

const STAGE = { width: 3881, height: 2183 };
const TRAVEL_MS = 8400;
const PLACES = ['종로구', '마포구', '강남구'];

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
  const named = useRef(false);

  useEffect(() => {
    if (!router.isReady || named.current) return;
    named.current = true;
    const queryName = typeof router.query.district === 'string' ? router.query.district : '';
    const contextName = selectedDistrict?.name || '';
    const next = [queryName, contextName, readStoredPlace()].find((item) => PLACES.includes(item)) || '종로구';
    setPlaceName(next);
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

  return (
    <div className={styles.viewport} ref={viewportRef}>
      <div className={styles.fit} style={{ width: STAGE.width * scale, height: STAGE.height * scale }}>
        <div className={styles.stage} style={{ transform: `scale(${scale})` }}>
          {placeName ? (
            <QuietStreet
              name={placeName}
              still={step === 'travel'}
              onReady={() => setStreetReady(true)}
            />
          ) : null}
          {streetReady && step === 'travel' ? (
            <div className={`${styles.bubble} ${styles.bubbleTravel}`}>
              <p className={styles.copy}>
                상상한 식물을 심을 <span className={styles.place}>{placeName}로 </span>이동중이에요...
              </p>
            </div>
          ) : null}
          {step === 'draw' ? (
            <div className={`${styles.bubble} ${styles.bubbleDraw}`}>
              <p className={styles.copy}>
                이 공간에 어떤 식물이 자라면 좋을까요?
                <br />
                모바일 화면에 원하는 식물을 그려주세요.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
