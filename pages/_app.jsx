import { useRouter } from 'next/router';
import '../styles/globals.css';
import { EntryFlowProvider, useEntryFlow } from '../src/shared/EntryFlowContext';
import GazeReticle from '../src/shared/GazeReticle';
import { CAM_COLOR, CAM_KEYS, VIEWER_BY_CAM } from '../src/shared/gaze/participants';

function GlobalGazeCursor() {
  const router = useRouter();
  const { gazeRef, dwellProgress, isReady, isCalibrating, calibrated, discussionCam } = useEntryFlow();

  // 보정 화면에서는 점 타깃만 보이게 커서를 숨긴다.
  const visible = isReady && !isCalibrating && router.pathname !== '/app';

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
      <AppFrame Component={Component} pageProps={pageProps} />
    </EntryFlowProvider>
  );
}
