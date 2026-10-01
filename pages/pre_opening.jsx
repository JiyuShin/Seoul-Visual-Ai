import { useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import OpeningStill from '../src/op/OpeningStill';
import usePresenceGate from '../src/shared/gaze/usePresenceGate';
import { PRESENCE } from '../src/shared/gaze/presence';

const DEBUG_STYLE = {
  position: 'fixed',
  left: 16,
  bottom: 16,
  zIndex: 50,
  padding: '10px 14px',
  borderRadius: 8,
  background: 'rgba(0, 0, 0, 0.7)',
  color: '#fff',
  font: '14px/1.5 monospace',
  whiteSpace: 'pre',
  pointerEvents: 'none',
};

function presenceText(state) {
  const faces = state.faces
    .map((face) => `w${face.width.toFixed(2)} yaw${face.yaw.toFixed(0)} pitch${face.pitch.toFixed(0)}`)
    .join('\n');
  return `${state.status} · 통과 ${state.kept}명 · ${((state.progress * PRESENCE.holdMs) / 1000).toFixed(1)}s\n${faces}`;
}

export default function PreOpeningPage() {
  const router = useRouter();
  const debug = router.query.presenceDebug === '1';
  const camera = typeof router.query.presenceCam === 'string' ? router.query.presenceCam : '';
  const goNext = useCallback(() => router.replace('/1'), [router]);
  const presence = usePresenceGate({ enabled: router.isReady, onPass: goNext, camera, report: debug });

  return (
    <>
      <Head>
        <title>Plant Your Seoul — Pre-opening</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </Head>
      <OpeningStill />
      {debug && <div style={DEBUG_STYLE}>{presenceText(presence)}</div>}
    </>
  );
}
