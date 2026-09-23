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

export default function App({ Component, pageProps }) {
  return (
    <EntryFlowProvider>
      <Component {...pageProps} />
      <GlobalGazeCursor />
    </EntryFlowProvider>
  );
}
