import '../styles/globals.css';
import { EntryFlowProvider } from '../src/scenes/EntryToDiscussion/EntryFlowContext';

export default function App({ Component, pageProps }) {
  // 트래커 페이지는 자기 카메라를 직접 고르기 위해 WebGazer를 스스로 띄운다.
  // WebGazer는 window에 하나만 존재하므로 공용 Provider와 같이 둘 수 없다.
  if (Component.skipEntryFlow) {
    return <Component {...pageProps} />;
  }

  return (
    <EntryFlowProvider>
      <Component {...pageProps} />
    </EntryFlowProvider>
  );
}
