import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useEntryFlow } from '../shared/EntryFlowContext';
import DynamicQrCode from '../shared/mobileLink/DynamicQrCode';
import { useMobileLink } from '../shared/mobileLink/MobileLinkContext';
import { buildMobileJoinUrl, getMobilePublicOriginSync } from '../shared/mobileLink/publicOrigin';
import AgentOrb from '../f2/AgentOrb';
import { sceneFor } from './districts';
import BackgroundSequence from './BackgroundSequence';
import { cueForClip, cueLines } from './jongnoCues';
import { QR_COPY } from './sequence';
import styles from './Ending.module.css';

const STAGE = { width: 3881, height: 2183 };

function bubbleBox(bubble) {
  return {
    left: bubble.left + bubble.width / 2,
    top: bubble.top,
    width: bubble.width,
    height: bubble.height,
    transform: 'translateX(-50%)',
  };
}

function lineKey(lines) {
  return lines.map((line) => line.map((part) => part.text).join('')).join('\n');
}

function CueText({ lines, className }) {
  return (
    <span className={`${styles.agentText} ${className || ''}`}>
      {lines.map((line, index) => (
        <span key={index} className={styles.agentLine}>
          {line.map((part, partIndex) => (
            part.bold
              ? <span key={partIndex} className={styles.agentStrong}>{part.text}</span>
              : <span key={partIndex}>{part.text}</span>
          ))}
        </span>
      ))}
    </span>
  );
}

const PLACES = ['종로구', '마포구', '강남구'];

function readStoredPlace() {
  try {
    const stored = sessionStorage.getItem('seoul-district') || '';
    return PLACES.includes(stored) ? stored : '';
  } catch {
    return '';
  }
}

export default function EndingPage() {
  const router = useRouter();
  const { selectedDistrict } = useEntryFlow();
  const { qrTargetUrl, startKioskSession, mobilePublicOrigin, plantNames } = useMobileLink();
  const viewportRef = useRef(null);
  const doneRef = useRef(false);
  const [scale, setScale] = useState(1);
  const [placeName, setPlaceName] = useState('');
  const [qrOn, setQrOn] = useState(false);
  const [localUrl, setLocalUrl] = useState('');
  const [progress, setProgress] = useState({ index: 0, time: 0, duration: 0 });
  const scene = sceneFor(placeName || '종로구');
  const cue = scene.name === '종로구'
    ? cueForClip(progress.index, progress.time, progress)
    : null;
  const lines = cueLines(cue, placeName, plantNames);

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
    if (!router.isReady) return;
    const queryName = typeof router.query.district === 'string' ? router.query.district : '';
    const contextName = selectedDistrict?.name || '';
    const next = [queryName, contextName, readStoredPlace()].find((item) => PLACES.includes(item)) || '종로구';
    setPlaceName(next);
  }, [router.isReady, router.query.district, selectedDistrict]);

  const finishSequence = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setQrOn(true);
  }, []);

  useEffect(() => {
    if (!qrOn || qrTargetUrl || localUrl) return undefined;
    try {
      const id = startKioskSession(placeName ? { name: placeName } : null);
      const origin = mobilePublicOrigin || getMobilePublicOriginSync();
      setLocalUrl(buildMobileJoinUrl(id, origin));
    } catch {
      setLocalUrl('');
    }
    return undefined;
  }, [qrOn, qrTargetUrl, localUrl, placeName, startKioskSession, mobilePublicOrigin]);

  const qrUrl = qrTargetUrl || localUrl;

  return (
    <div className={styles.viewport} ref={viewportRef} role="application" aria-label="엔딩">
      <div className={styles.fit} style={{ width: STAGE.width * scale, height: STAGE.height * scale }}>
      <div className={styles.stage} style={{ transform: `scale(${scale})` }}>
        {placeName ? (
          <BackgroundSequence
            key={scene.name}
            shots={scene.shots}
            onDone={finishSequence}
            onProgress={setProgress}
          />
        ) : null}
        {cue ? (
          <div className={`${styles.agentLayer} ${qrOn ? styles.agentLayerOff : ''}`}>
            <div
              className={`${styles.agentOrb} ${lines.length ? styles.agentOrbSpeaking : ''}`}
              style={{
                left: cue.agent.left,
                top: cue.agent.top,
                width: cue.agent.size,
                height: cue.agent.size,
              }}
            >
              <AgentOrb className={styles.agentCanvas} agentSpeaking={lines.length > 0} />
            </div>
            {cue.bubble ? (
              <div className={styles.agentBubble} style={bubbleBox(cue.bubble)}>
                {lines.length ? (
                  <CueText
                    key={lineKey(lines)}
                    lines={lines}
                    className={cue.bubble.align === 'left' ? styles.agentTextLeft : ''}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className={`${styles.qrPage} ${qrOn ? styles.qrPageOn : ''}`}>
          <h1 className={styles.qrTitle}>{QR_COPY.title}</h1>
          <p className={styles.qrBody}>{QR_COPY.body}</p>
          <div className={styles.qrFrame}>
            {qrUrl ? <DynamicQrCode url={qrUrl} alt="엔딩 QR 코드" /> : null}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
