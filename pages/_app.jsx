import { useRouter } from 'next/router';
import Head from 'next/head';
import '../styles/globals.css';
import { EntryFlowProvider, useEntryFlow } from '../src/shared/EntryFlowContext';
import { MobileLinkProvider } from '../src/shared/mobileLink/MobileLinkContext';
import GazeReticle from '../src/shared/GazeReticle';
import { CAM_COLOR, CAM_KEYS, VIEWER_BY_CAM } from '../src/shared/gaze/participants';

const STREET_POSTER = '/street/red/assets/street-panorama.webp';

if (typeof window !== 'undefined' && !window.__streetPoster) {
  const image = new Image();
  image.dataset.src = STREET_POSTER;
  image.decoding = 'sync';
  image.src = STREET_POSTER;
  window.__streetPoster = image;
  image.decode?.().catch(() => {});
}

function GlobalGazeCursor() {
  const router = useRouter();
  const { gazeRef, dwellProgress, isReady, isCalibrating, calibrated, discussionCam } = useEntryFlow();

  // 보정 화면에서는 점 타깃만 보이게 커서를 숨긴다.
  const visible =
    isReady &&
    !isCalibrating &&
    router.pathname !== '/app' &&
    router.pathname !== '/mobile' &&
    router.pathname !== '/op' &&
    router.pathname !== '/still';

  // 토론 중에는 지금 차례인 사람의 커서만 따라다닌다. 심어 둔 자리는 따로 남는다.
  const keys = router.pathname === '/2'
    ? [discussionCam || 'A']
    : calibrated?.length
      ? CAM_KEYS.filter((key) => calibrated.includes(key))
      : ['A'];

  return keys.map((key) => (
    <GazeReticle
      key={key}
      gazeRef={gazeRef}
      viewerId={VIEWER_BY_CAM[key]}
      color={CAM_COLOR[key]}
      dwellProgress={dwellProgress}
      visible={visible}
    />
  ));
}

function AppFrame({ Component, pageProps }) {
  return (
    <>
      <Head>
        <link rel="preload" as="image" href="/street/red/assets/street-panorama.webp" />
      </Head>
      <div style={{ position: 'relative', zIndex: 6, minHeight: '100vh' }}>
        <Component {...pageProps} />
      </div>
      <GlobalGazeCursor />
    </>
  );
}

export default function App({ Component, pageProps }) {
  return (
    <EntryFlowProvider>
      <MobileLinkProvider>
        <AppFrame Component={Component} pageProps={pageProps} />
      </MobileLinkProvider>
    </EntryFlowProvider>
  );
}
