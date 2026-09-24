import { useEffect, useRef, useState } from 'react';
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
  const pageRef = useRef(null);
  const streetRef = useRef(null);
  const [fadeOut, setFadeOut] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [entering, setEntering] = useState(false);
  const onDiscussion = router.pathname === '/2';
  const cover = (onDiscussion || entering) && !cleared;

  useEffect(() => {
    if (!onDiscussion) {
      setFadeOut(false);
      setCleared(false);
      setEntering(false);
    }
  }, [onDiscussion]);

  useEffect(() => {
    const start = (url) => {
      const path = url.split('?')[0];
      if (path !== '/2') return;
      setEntering(true);
      document.documentElement.style.background = 'transparent';
      document.body.style.background = 'transparent';
      if (streetRef.current) streetRef.current.style.zIndex = '15';
      if (pageRef.current) pageRef.current.style.zIndex = '1';
    };
    router.events.on('routeChangeStart', start);
    return () => router.events.off('routeChangeStart', start);
  }, [router.events]);

  useEffect(() => {
    const clear = () => setFadeOut(true);
    window.addEventListener('street-blur-clear', clear);
    return () => window.removeEventListener('street-blur-clear', clear);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const { body } = document;
    if (cover) {
      root.style.background = 'transparent';
      body.style.background = 'transparent';
    } else if (!fadeOut) {
      root.style.background = '';
      body.style.background = '';
    }
  }, [cover, fadeOut]);

  useEffect(() => {
    if (!fadeOut) return undefined;
    const id = window.setTimeout(() => setCleared(true), 1700);
    return () => window.clearTimeout(id);
  }, [fadeOut]);

  return (
    <>
      <div
        ref={streetRef}
        style={{
          position: 'fixed',
          inset: '-4%',
          zIndex: cover ? 15 : 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          filter: fadeOut ? 'blur(0px)' : 'blur(4px)',
          opacity: fadeOut ? 0 : 1,
          transition: fadeOut ? 'opacity 1.6s ease, filter 1.6s ease' : 'none',
        }}
      >
        <iframe
          title="거리뷰"
          src={STREET_URL}
          allow="fullscreen"
          style={{
            width: '100%',
            height: '100%',
            border: 0,
            transform: 'scale(1.04)',
          }}
        />
      </div>
      <div
        ref={pageRef}
        style={{
          position: 'relative',
          zIndex: cover ? 1 : 6,
          minHeight: '100vh',
          background: cover ? 'transparent' : undefined,
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
