import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useEntryFlow } from '../shared/EntryFlowContext';
import { useMobileLink } from '../shared/mobileLink/MobileLinkContext';
import {
  DISTRICTS,
  ROULETTE_LOGOS,
  placementForLogo,
  rouletteOffsetForLogo,
} from '../f3/AreaSelection/sequence';
import arc from '../f3/AreaSelection/AreaSelection.module.css';
import styles from './Fail.module.css';

function readStoredPlace() {
  try {
    return sessionStorage.getItem('seoul-district') || '';
  } catch {
    return '';
  }
}

function districtByName(name) {
  return DISTRICTS.find((item) => item.name === name) || null;
}

function tokenStyle(placement, colored) {
  return {
    left: `${placement.x}px`,
    top: `${placement.y}px`,
    width: `${placement.size}px`,
    height: `${placement.size}px`,
    opacity: placement.fade,
    zIndex: placement.glow > 0.2 ? 3 : 1,
    boxShadow:
      colored || placement.glow <= 0.05
        ? 'none'
        : `0 0 ${36.667 * placement.glow}px rgba(130,245,255,${0.54 * placement.glow}), 0 0 ${14.339 * placement.glow}px rgba(255,207,227,${placement.glow})`,
  };
}

function imageStyle(placement, fade, sidePosition) {
  const atSide = placement.glow < 0.35 && sidePosition === 'bottom';
  return {
    left: `${placement.imgX}px`,
    top: `${placement.imgY}px`,
    width: `${placement.imgW}px`,
    height: `${placement.imgH}px`,
    opacity: placement.imgOpacity * fade,
    objectFit: 'contain',
    objectPosition: atSide ? 'center bottom' : 'center center',
  };
}

function CircleToken({ logo, placement, colored }) {
  const swaps = Boolean(logo.centerSrc);
  const textureStyle = logo.full
    ? { opacity: placement.glow, width: '142%', height: '142%', left: '-21%', top: '-21%' }
    : { opacity: placement.glow };
  const logoFade = colored && !logo.stack ? 1 - placement.glow : 1;
  const sideMark = imageStyle(placement, (swaps ? 1 - placement.swap : 1) * logoFade, logo.sidePosition);
  const centerMark = {
    ...imageStyle(placement, placement.swap, logo.sidePosition),
    objectFit: logo.cover ? 'cover' : 'contain',
  };

  return (
    <div className={arc.token} style={tokenStyle(placement, Boolean(colored && !logo.stack))}>
      <div
        className={arc.glass}
        style={{
          opacity: 1 - placement.glow,
          backgroundColor: `rgba(255, 255, 255, ${placement.chip})`,
        }}
      />
      {colored && logo.badge && !logo.stack ? (
        <img className={arc.badge} src={logo.badge} alt="" style={{ opacity: placement.glow }} />
      ) : (
        <>
          <img className={arc.disc} src="/3/circle-center-gradient.svg" alt="" style={{ opacity: placement.glow }} />
          <img className={arc.disc} src="/3/circle-center-glass.svg" alt="" style={{ opacity: placement.glow }} />
          {logo.texture ? <img className={arc.disc} src={logo.texture} alt="" style={textureStyle} /> : null}
        </>
      )}
      <img className={arc.mark} src={logo.src} alt="" style={sideMark} />
      {swaps && logo.centerCrop ? (
        <div className={arc.markCrop} style={centerMark}>
          <img
            src={logo.centerSrc}
            alt=""
            style={{
              width: logo.centerCrop.width,
              height: logo.centerCrop.height,
              marginTop: logo.centerCrop.top,
              marginLeft: logo.centerCrop.left,
            }}
          />
        </div>
      ) : null}
      {swaps && !logo.centerCrop ? <img className={arc.mark} src={logo.centerSrc} alt="" style={centerMark} /> : null}
    </div>
  );
}

function StillRoulette({ logoIndex }) {
  const offset = rouletteOffsetForLogo(logoIndex);
  return (
    <>
      <img className={arc.centerRing} src="/3/circle-center-ring.svg" alt="" />
      {ROULETTE_LOGOS.map((logo, index) => (
        <CircleToken key={logo.src} colored logo={logo} placement={placementForLogo(index, offset)} />
      ))}
    </>
  );
}

function Ring({ side, done }) {
  const left = side === 'A';
  return (
    <div className={`${styles.ring} ${left ? styles.ringLeft : styles.ringRight}`}>
      {done ? (
        <img className={styles.check} src={left ? '/fail/check-a.svg' : '/fail/check-b.svg'} alt="" />
      ) : (
        <>
          <img className={styles.disc} src={left ? '/fail/ring-left-disc.svg' : '/fail/ring-right-disc.svg'} alt="" />
          <div className={styles.spinner}>
            <img
              className={styles.track}
              src={left ? '/fail/ring-left-track.svg' : '/fail/ring-right-track.svg'}
              alt=""
            />
          </div>
        </>
      )}
      <p className={styles.label}>{done ? 'QR 인식 성공!' : 'QR 인식 중'}</p>
    </div>
  );
}

export default function FailScreen() {
  const router = useRouter();
  const { selectedDistrict } = useEntryFlow();
  const { slots } = useMobileLink();
  const [scale, setScale] = useState(1);
  const [district, setDistrict] = useState(DISTRICTS[0]);

  useEffect(() => {
    const fit = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const next = Math.max(width / 3881, height / 2183);
      setScale(next > 0 ? next : 1);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const queryName = typeof router.query.district === 'string' ? router.query.district : '';
    const next = districtByName(queryName)
      || districtByName(selectedDistrict?.name)
      || districtByName(readStoredPlace())
      || DISTRICTS[0];
    setDistrict(next);
  }, [router.isReady, router.query.district, selectedDistrict]);

  const recognized = { A: Boolean(slots.A), B: Boolean(slots.B) };
  const recognizedCount = Number(recognized.A) + Number(recognized.B);

  useEffect(() => {
    if (!recognized.A || !recognized.B || !district?.name) return undefined;
    const timer = window.setTimeout(() => {
      router.push(`/4?district=${encodeURIComponent(district.name)}`);
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [recognized.A, recognized.B, district, router]);

  const title = recognizedCount === 0
    ? '모바일 인식을 기다리고 있어요'
    : recognizedCount === 1
      ? '거의 다 완료되어가요'
      : '모바일 인식이 모두 완료되었어요';
  const subtitle = recognizedCount === 2
    ? '이제 모바일 웹에 접속하여 상상하신 대로 자유롭게 나만의 식물을 그려주세요'
    : '화면 속 QR을 인식하시고 모바일 웹으로 접속해주세요';

  return (
    <div className={arc.viewport}>
      <div className={arc.fit} style={{ width: 3881 * scale, height: 2183 * scale }}>
        <div className={arc.stage} style={{ transform: `scale(${scale})` }}>
          <img className={arc.bg} src="/3/bg.png" alt="" />
          <img className={arc.arc} src="/3/arc.svg" alt="" />
          <div className={arc.rouletteLayer}>
            <StillRoulette logoIndex={district.logoIndex} />
          </div>
          <p className={styles.title}>{title}</p>
          <p className={styles.subtitle}>{subtitle}</p>
          <div className={styles.veil} />
          <Ring side="A" done={recognized.A} />
          <Ring side="B" done={recognized.B} />
        </div>
      </div>
    </div>
  );
}
