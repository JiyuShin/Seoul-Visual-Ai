import { useCallback, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import OpeningStill from '../src/op/OpeningStill';
import usePresenceLink from '../src/shared/gaze/usePresenceLink';

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

/**
 * 인원 인식은 /presence_test(센서)가 한다. 이 화면은 카메라를 열지 않고,
 * 센서가 보낸 통과 신호를 받으면 /1 로 넘어간다.
 */
export default function PreOpeningPage() {
  const router = useRouter();
  const debug = router.query.presenceDebug === '1';
  const [sensorState, setSensorState] = useState(null);
  const passedRef = useRef(false);

  const goNext = useCallback(() => {
    if (passedRef.current) return;
    passedRef.current = true;
    router.replace('/1');
  }, [router]);

  const onMessage = useCallback(
    (msg) => {
      if (msg.type === 'pass' || (msg.type === 'joined' && msg.passAt)) goNext();
      if (msg.type === 'state' || (msg.type === 'joined' && msg.state)) setSensorState(msg.state || msg);
    },
    [goNext]
  );

  const link = usePresenceLink('display', onMessage);

  const debugText = [
    `서버 ${link.connected ? '연결됨' : '끊김'} · 센서 ${link.peers.sensors}대`,
    sensorState
      ? `얼굴 ${sensorState.faces}명 · 통과 ${sensorState.kept}명 · ${Math.round((sensorState.progress || 0) * 100)}%`
      : '센서 신호 없음',
  ].join('\n');

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
      {debug && <div style={DEBUG_STYLE}>{debugText}</div>}
    </>
  );
}
