import { useEffect, useRef, useState } from 'react';
import { useEntryFlow } from '../shared/EntryFlowContext';
import styles from './PageFour.module.css';

const STAGE = { width: 3881, height: 2183 };
const TRAVEL_MS = 4200;

export default function PageFour() {
  const { selectedDistrict } = useEntryFlow();
  const viewportRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [step, setStep] = useState('travel');
  const placeName = selectedDistrict?.name || '성동구';

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
    const timer = window.setTimeout(() => setStep('draw'), TRAVEL_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={styles.viewport} ref={viewportRef}>
      <div className={styles.fit} style={{ width: STAGE.width * scale, height: STAGE.height * scale }}>
        <div className={styles.stage} style={{ transform: `scale(${scale})` }}>
          {step === 'travel' ? (
            <div className={`${styles.bubble} ${styles.bubbleTravel}`}>
              <p className={styles.copy}>
                상상한 식물을 심을 <span className={styles.place}>{placeName}로 </span>이동중이에요...
              </p>
            </div>
          ) : (
            <div className={`${styles.bubble} ${styles.bubbleDraw}`}>
              <p className={styles.copy}>
                이 공간에 어떤 식물이 자라면 좋을까요?
                <br />
                모바일 화면에 원하는 식물을 그려주세요.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
