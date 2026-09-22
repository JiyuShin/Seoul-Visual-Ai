import '../styles/globals.css';
import { EntryFlowProvider } from '../src/scenes/EntryToDiscussion/EntryFlowContext';

export default function App({ Component, pageProps }) {
  return (
    <EntryFlowProvider>
      <Component {...pageProps} />
    </EntryFlowProvider>
  );
}
