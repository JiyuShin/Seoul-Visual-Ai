import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useEntryFlow } from '../../shared/EntryFlowContext';
import {
  buildMobileJoinUrl,
  getMobilePublicOriginSync,
  isLikelyLocalhostQr,
} from '../../shared/mobileLink/publicOrigin';
import DynamicQrCode from '../../shared/mobileLink/DynamicQrCode';
import { useMobileLink } from '../../shared/mobileLink/MobileLinkContext';
import {
  DISTRICTS,
  ROULETTE_LOGOS,
  S_DURATION_MS,
  STAGE,
  placementForLogo,
  startRoulette,
  stopRoulette,
} from './sequence';
import styles from './AreaSelection.module.css';

function Stage({ children }) {
  const viewportRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fit = () => {
      const box = viewportRef.current;
      const width = box?.clientWidth || window.innerWidth;
      const height = box?.clientHeight || window.innerHeight;
      // 1·2페이지는 창을 가득 채운다. 3번도 같은 화면을 덮도록 맞춘다.
      const next = Math.max(width / STAGE.width, height / STAGE.height);
      setScale(next > 0 ? next : 1);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  return (
    <div className={styles.viewport} ref={viewportRef}>
      <div className={styles.fit} style={{ width: STAGE.width * scale, height: STAGE.height * scale }}>
        <div className={styles.stage} style={{ transform: `scale(${scale})` }}>
          {children}
        </div>
      </div>
    </div>
  );
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
    ...imageStyle(placement, placement.swap * logoFade, logo.sidePosition),
    objectFit: logo.cover ? 'cover' : 'contain',
  };

  return (
    <div className={styles.token} style={tokenStyle(placement, Boolean(colored && !logo.stack))}>
      <div
        data-part="side"
        className={styles.glass}
        style={{
          opacity: 1 - placement.glow,
          backgroundColor: `rgba(255, 255, 255, ${placement.chip})`,
        }}
      />
      {colored && logo.badge && !logo.stack ? (
        <img className={styles.badge} src={logo.badge} alt="" style={{ opacity: placement.glow }} />
      ) : (
        <>
          <img data-part="center" className={styles.disc} src="/3/circle-center-gradient.svg" alt="" style={{ opacity: placement.glow }} />
          <img data-part="center" className={styles.disc} src="/3/circle-center-glass.svg" alt="" style={{ opacity: placement.glow }} />
          {logo.texture ? <img data-part="texture" className={styles.disc} src={logo.texture} alt="" style={textureStyle} /> : null}
        </>
      )}
      <img data-part="logo" className={styles.mark} src={logo.src} alt="" style={sideMark} />
      {swaps && logo.centerCrop ? (
        <div className={styles.markCrop} style={centerMark}>
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
      {swaps && !logo.centerCrop ? <img data-part="swap" className={styles.mark} src={logo.centerSrc} alt="" style={centerMark} /> : null}
    </div>
  );
}

function RouletteTrack({ children, ring }) {
  return (
    <>
      {ring ? <img className={styles.centerRing} src="/3/circle-center-ring.svg" alt="" /> : null}
      {children}
    </>
  );
}

function SpinningRoulette({ onComplete }) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    startRoulette(setOffset, onComplete);
    return () => stopRoulette();
  }, [onComplete]);

  return (
    <RouletteTrack ring>
      {ROULETTE_LOGOS.map((logo, index) => (
        <CircleToken key={logo.src} colored logo={logo} placement={placementForLogo(index, offset)} />
      ))}
    </RouletteTrack>
  );
}

function StillCenter({ district }) {
  const mark = district.centerMark;
  const markStyle = {
    left: `${mark.x}px`,
    top: `${mark.y}px`,
    width: `${mark.w}px`,
    height: `${mark.h}px`,
    objectFit: 'cover',
    objectPosition: mark.position === 'bottom' ? 'center bottom' : 'center center',
  };

  const markNode = mark.crop ? (
    <div className={styles.markCrop} style={markStyle}>
      <img src={mark.src} alt="" style={{ width: mark.crop.width, height: mark.crop.height }} />
    </div>
  ) : (
    <img className={styles.mark} src={mark.src} alt="" style={markStyle} />
  );

  return (
    <div className={mark.disc ? `${styles.stillCenter} ${styles.stillPlain}` : styles.stillCenter}>
      {mark.disc ? <img className={styles.stillDiscImage} src={mark.disc} alt="" /> : null}
      <div className={styles.stillClip}>
        {mark.disc ? null : (
          <>
            <img className={styles.disc} src="/3/s-center-gradient.svg" alt="" />
            <img className={styles.disc} src="/3/s-center-glass.svg" alt="" />
            <img className={styles.disc} src={mark.texture} alt="" />
          </>
        )}
        {markNode}
      </div>
    </div>
  );
}

function StillRoulette({ district }) {
  const count = ROULETTE_LOGOS.length;

  return (
    <RouletteTrack ring={false}>
      {ROULETTE_LOGOS.map((logo, index) => {
        const slot = (((index - district.rouletteOffset) % count) + count) % count;
        if (slot === 4) return <StillCenter key={logo.src} district={district} />;
        return <CircleToken key={logo.src} logo={logo} placement={placementForLogo(index, district.rouletteOffset)} />;
      })}
    </RouletteTrack>
  );
}

function Background({ hidden }) {
  return <img className={`${styles.bg} ${hidden ? styles.isHidden : ''}`} src="/3/bg.png" alt="" />;
}

function FindingVideo({ hidden }) {
  return (
    <video
      className={`${styles.findingVideo} ${hidden ? styles.isHidden : ''}`}
      src="/3/f001.mp4"
      autoPlay
      muted
      playsInline
    />
  );
}

const MAP_PINS = [
  [1177.28, 0],
  [1392.39, 36.9],
  [698.45, 225.92],
  [360.92, 387.93],
  [939.47, 423],
  [1036.87, 454.53],
  [1224.98, 539.14],
  [1560.7, 576.95],
  [839.74, 711.96],
  [237.61, 726.35],
  [491.43, 961.28],
  [770.45, 1037.78],
  [1414.88, 1059.38],
  [667.84, 1126.88],
  [1199.77, 1169.19],
];

const FINDING_MAP = { left: 1143, top: 749, width: 1544, height: 1108 };
const RESULT_MAP = { left: 1765, top: 526, width: 1904, height: 1269 };
const PIN_SCALE = FINDING_MAP.width / 1903.629;
const PIN_MAP_TOP = (FINDING_MAP.height - 1288 * PIN_SCALE) / 2;

function copyClass(phase, scene) {
  if (phase === scene) return styles.copyShow;
  if (scene === 's' && phase === 'q') return styles.copyLeave;
  return styles.copyHide;
}

function MovingMap({ phase }) {
  const atResult = phase !== 'f';

  return (
    <div
      className={`${styles.mapMotion} ${phase === 'f' || phase === 'q' ? styles.isGone : ''}`}
      style={atResult ? RESULT_MAP : FINDING_MAP}
    >
      <img className={styles.mapScreen} src="/3/map-screen.png" alt="" />
      <img src="/3/map.png" alt="" />
      {MAP_PINS.map(([x, y]) => (
        <span
          key={`${x}-${y}`}
          className={styles.pin}
          style={{
            left: `${(x * PIN_SCALE / FINDING_MAP.width) * 100}%`,
            top: `${((PIN_MAP_TOP + y * PIN_SCALE) / FINDING_MAP.height) * 100}%`,
            width: `${(25.2 * PIN_SCALE / FINDING_MAP.width) * 100}%`,
            height: `${(74.9 * PIN_SCALE / FINDING_MAP.height) * 100}%`,
            opacity: phase === 'f' ? 1 : 0,
          }}
        />
      ))}
    </div>
  );
}

function FindingCopy({ phase }) {
  const hidden = phase !== 'f';

  return (
    <>
      <h1 className={`${styles.fTitle} ${styles.fadeLayer} ${hidden ? styles.isHidden : ''}`}>
        서울특별시 자치구를 찾고 있어요
      </h1>
      <p className={`${styles.fBody} ${styles.fadeLayer} ${hidden ? styles.isHidden : ''}`}>
        토론 데이터를 기반으로, 서울특별시 25개 자치구 중
        <br />
        <strong>여러분의 초록빛 서울</strong>에 가장 적합한 구를 선별하고 있어요
      </p>
      <p className={`${styles.fWait} ${styles.fadeLayer} ${hidden ? styles.isHidden : ''}`}>잠시만 기다려 주세요...</p>
    </>
  );
}

function DistrictGlow({ district, hidden }) {
  const glowRef = useRef(null);

  useEffect(() => {
    const glow = glowRef.current;
    const started = performance.now();
    let frame;

    const tick = (now) => {
      const elapsed = now - started;
      const turn = (elapsed / S_DURATION_MS) * Math.PI * 8;
      const wave = 0.5 - 0.5 * Math.cos(turn);
      glow.style.opacity = String(0.4 + 0.6 * wave);
      glow.style.transform = `scale(${0.86 + 0.22 * wave})`;
      if (elapsed < S_DURATION_MS) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className={`${styles.districtGlow} ${hidden ? styles.isHidden : ''}`}
      style={{ left: district.glow.x, top: district.glow.y }}
    >
      <img ref={glowRef} src="/3/district-glow.svg" alt="" />
    </div>
  );
}

function SelectedCopy({ district, phase }) {
  const motion = copyClass(phase, 's');

  return (
    <>
      <h1
        className={`${styles.resultTitle} ${motion}`}
        style={district.title ? { left: district.title.x, top: district.title.y } : undefined}
      >
        <span className={styles.resultName}>{district.name}</span>
        <span>가 </span>
        <br />
        선정 되었어요
      </h1>
      <p className={`${styles.resultBody} ${styles.resultLines} ${motion}`}>
        {district.lines[0]}
        <br />
        {district.lines[1]}
      </p>
    </>
  );
}

const QR_BORDER_SHADOWS = [
  { x: 0, y: 22.262, blur: 21.816, color: 'rgba(255, 255, 255, 0.74)' },
  { x: -19.421, y: -19.421, blur: 97.103, color: 'rgba(250, 151, 255, 0.58)' },
  { x: 0, y: 8.014, blur: 5.343, color: '#fff' },
  { x: -35.619, y: 0, blur: 36.687, color: 'rgba(254, 206, 255, 0.62)' },
  { x: 16.507, y: -23.305, blur: 37.87, color: 'rgba(255, 255, 255, 0.6)' },
  { x: 0, y: 8.905, blur: 21.371, color: 'rgba(255, 203, 129, 0.88)' },
  { x: -3.562, y: -3.562, blur: 15.405, color: 'rgba(255, 255, 255, 0.38)' },
  { x: -8.905, y: -8.905, blur: 16.83, color: 'rgba(0, 0, 0, 0.25)' },
];
const QR_BORDER_TURN_MS = 5000;

function QrBorder() {
  const borderRef = useRef(null);

  useEffect(() => {
    const border = borderRef.current;
    const started = performance.now();
    let frame;

    const tick = (now) => {
      const angle = (((now - started) % QR_BORDER_TURN_MS) / QR_BORDER_TURN_MS) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      border.style.boxShadow = QR_BORDER_SHADOWS.map((shadow) => {
        const x = shadow.x * cos - shadow.y * sin;
        const y = shadow.x * sin + shadow.y * cos;
        return `inset ${x.toFixed(2)}px ${y.toFixed(2)}px ${shadow.blur}px ${shadow.color}`;
      }).join(', ');
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <div ref={borderRef} className={styles.qrGlow} />;
}

function QrCopy({ phase, qrUrl, linkStatus, isPaired, holdSecondsLeft, mobilePublicOrigin }) {
  const motion = copyClass(phase, 'q');
  const localhostHint =
    phase === 'q' && isLikelyLocalhostQr(mobilePublicOrigin)
      ? 'LAN IP를 찾지 못했습니다. PC와 폰이 같은 Wi‑Fi인지 확인하고 yarn dev(server.js)로 실행해 주세요.'
      : null;

  let statusLine = null;
  if (phase === 'q' && !qrUrl) {
    statusLine = 'QR 링크를 준비하는 중…';
  } else if (linkStatus === 'error') {
    statusLine = '연결 오류 · yarn dev(node server.js) 실행 여부를 확인해 주세요.';
  } else if (linkStatus === 'connecting') {
    statusLine = '키오스크 세션 연결 중…';
  } else if (isPaired) {
    statusLine = '휴대폰과 연결되었어요. 모바일 화면에서 식물을 그려 주세요.';
  } else if (linkStatus === 'waiting_mobile') {
    statusLine =
      holdSecondsLeft > 0
        ? `QR을 스캔해 /mobile 로 연결하세요. ${holdSecondsLeft}초 후 다음 화면으로 이동합니다.`
        : 'QR을 스캔하면 /mobile 페이지로 연결됩니다.';
  }

  return (
    <>
      <h1 className={`${styles.qTitle} ${motion}`}>
        화면 속 <strong>QR코드</strong>를
        <br />
        인식해주세요
      </h1>
      <p className={`${styles.resultBody} ${motion}`}>
        이제 모든 준비는 끝났어요! 화면 속 QR를 인식해 휴대폰으로 직접 식물을 그려볼 차례예요.
        여러분이 원하는 서울 속 나만의 식물을 심으러 가볼까요?
      </p>
      {statusLine ? (
        <p className={`${styles.qrStatus} ${isPaired ? styles.qrStatusPaired : ''}`}>{statusLine}</p>
      ) : null}
      {localhostHint ? <p className={styles.qrDevHint}>{localhostHint}</p> : null}
      {phase === 'q' && qrUrl ? (
        <p className={styles.qrLinkPreview} title={qrUrl}>
          {qrUrl}
        </p>
      ) : null}
      <div className={`${styles.qrFrame} ${phase === 'q' ? styles.qrOn : ''}`}>
        <div className={phase === 'q' ? styles.qrImageLive : styles.qrImage}>
          {phase === 'q' ? (
            qrUrl ? (
              <DynamicQrCode url={qrUrl} alt="모바일 연결 QR 코드" />
            ) : (
              <div className={styles.qrImageLiveLoading} aria-hidden="true" />
            )
          ) : (
            <img src="/3/qr.png" alt="" aria-hidden="true" />
          )}
        </div>
        <QrBorder />
      </div>
    </>
  );
}

/** QR 단계 최소 노출 후 키오스크 /2 로 이동 (모바일 WS 는 유지) */
const QR_HOLD_MS = 10000;

export default function AreaSelection() {
  const router = useRouter();
  const { setSelectedDistrict } = useEntryFlow();
  const { startKioskSession, qrTargetUrl, mobilePublicOrigin, status: linkStatus, isPaired } =
    useMobileLink();
  const kioskSessionRef = useRef(false);
  const [qrHoldSecondsLeft, setQrHoldSecondsLeft] = useState(0);
  const [localQrUrl, setLocalQrUrl] = useState('');
  const [phase, setPhase] = useState('f');
  const [districtIndex, setDistrictIndex] = useState(0);
  const district = DISTRICTS[districtIndex];
  const displayQrUrl = qrTargetUrl || localQrUrl;

  const finishFinding = useCallback(() => {
    const index = Math.floor(Math.random() * DISTRICTS.length);
    setDistrictIndex(index);
    setSelectedDistrict(DISTRICTS[index]);
    setPhase('s');
  }, [setSelectedDistrict]);

  useEffect(() => {
    if (phase !== 's') return undefined;
    const timeout = setTimeout(() => setPhase('q'), S_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [phase]);

  useLayoutEffect(() => {
    if (phase === 'f') {
      kioskSessionRef.current = false;
      setLocalQrUrl('');
      return undefined;
    }
    if (phase !== 's' && phase !== 'q') return undefined;
    if (kioskSessionRef.current) return undefined;

    kioskSessionRef.current = true;
    try {
      const id = startKioskSession(district);
      const origin = mobilePublicOrigin || getMobilePublicOriginSync();
      setLocalQrUrl(buildMobileJoinUrl(id, origin));
    } catch {
      kioskSessionRef.current = false;
    }
    return undefined;
  }, [phase, district, startKioskSession, mobilePublicOrigin]);

  useEffect(() => {
    if (phase !== 'q') {
      setQrHoldSecondsLeft(0);
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'q') return undefined;

    setQrHoldSecondsLeft(Math.ceil(QR_HOLD_MS / 1000));
    const tick = setInterval(() => {
      setQrHoldSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);

    const advance = setTimeout(() => {
      router.push('/2');
    }, QR_HOLD_MS);

    return () => {
      clearInterval(tick);
      clearTimeout(advance);
    };
  }, [phase, router]);

  return (
    <Stage>
      <Background hidden={phase === 'f'} />
      <FindingVideo hidden={phase !== 'f'} />
      <img className={styles.arc} src="/3/arc.svg" alt="" />
      <div className={`${styles.rouletteLayer} ${phase === 'f' ? '' : styles.isHidden}`}>
        <SpinningRoulette onComplete={finishFinding} />
      </div>
      <div className={`${styles.rouletteLayer} ${phase === 'f' ? styles.isHidden : ''}`}>
        <StillRoulette district={district} />
      </div>
      <FindingCopy phase={phase} />
      <MovingMap phase={phase} />
      <SelectedCopy district={district} phase={phase} />
      {phase !== 'f' && <DistrictGlow district={district} hidden={phase !== 's'} />}
      <QrCopy
        phase={phase}
        qrUrl={displayQrUrl}
        linkStatus={linkStatus}
        isPaired={isPaired}
        holdSecondsLeft={qrHoldSecondsLeft}
        mobilePublicOrigin={mobilePublicOrigin}
      />
    </Stage>
  );
}
