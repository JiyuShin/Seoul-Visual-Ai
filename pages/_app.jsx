import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import '../styles/globals.css';
import { EntryFlowProvider, useEntryFlow } from '../src/shared/EntryFlowContext';
import GazeReticle from '../src/shared/GazeReticle';
import { CAM_COLOR, CAM_KEYS, VIEWER_BY_CAM } from '../src/shared/gaze/participants';

function GlobalGazeCursor() {
  const router = useRouter();
  const { gazeRef, dwellProgress, isReady, isCalibrating, calibrated } = useEntryFlow();

  // 보정 화면에서는 점 타깃만 보이게 커서를 숨긴다.
  const visible = isReady && !isCalibrating && router.pathname !== '/app';

  // 보정된 사람만 커서를 띄운다. 아직 목록이 비어 있으면 1번만.
  const keys = calibrated?.length ? CAM_KEYS.filter((key) => calibrated.includes(key)) : ['A'];

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

const STREET_URL = 'https://quiet-street-360.hello-ccid.chatgpt.site/';

function AppFrame({ Component, pageProps }) {
  const router = useRouter();
  const [cleared, setCleared] = useState(false);
  const onDiscussion = router.pathname === '/2';
  const cover = onDiscussion && !cleared;

  useEffect(() => {
    if (!onDiscussion) setCleared(false);
  }, [onDiscussion]);

  useEffect(() => {
    const clear = () => setCleared(true);
    window.addEventListener('street-blur-clear', clear);
    return () => window.removeEventListener('street-blur-clear', clear);
  }, []);

  return (
    <>
      <iframe
        title="거리뷰"
        src={STREET_URL}
        allow="fullscreen"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 0,
          zIndex: 4,
          pointerEvents: 'none',
          filter: 'blur(4px)',
          transform: 'scale(1.02)',
          opacity: cleared ? 0 : 1,
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: cover ? 0 : 6,
          minHeight: '100vh',
          opacity: cover ? 1 : 0.99,
        }}
      >
        <Component {...pageProps} />
      </div>
      <GlobalGazeCursor />
    </>
  );
}

export default function App({ Component, pageProps }) {
  return (
    <EntryFlowProvider>
      <AppFrame Component={Component} pageProps={pageProps} />
    </EntryFlowProvider>
  );
}
