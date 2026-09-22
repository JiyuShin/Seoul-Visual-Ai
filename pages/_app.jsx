import '../styles/globals.css';
import { EntryFlowProvider, useEntryFlow } from '../src/shared/EntryFlowContext';
import GazeReticle from '../src/shared/GazeReticle';

function GlobalGazeCursor() {
  const { reticlePosition, dwellProgress, isReady } = useEntryFlow();

  return (
    <GazeReticle
      position={reticlePosition}
      dwellProgress={dwellProgress}
      visible={isReady}
    />
  );
}

export default function App({ Component, pageProps }) {
  // 트래커 페이지는 자기 카메라를 직접 고르기 위해 WebGazer를 스스로 띄운다.
  // WebGazer는 window에 하나만 존재하므로 공용 Provider와 같이 둘 수 없다.
  if (Component.skipEntryFlow) {
    return <Component {...pageProps} />;
  }

  return (
    <EntryFlowProvider>
      <Component {...pageProps} />
      <GlobalGazeCursor />
    </EntryFlowProvider>
  );
}
