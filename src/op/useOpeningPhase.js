import { useEffect, useState } from 'react';

const WS_PATH = '/ws/opening';

function openingSocketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${WS_PATH}`;
}

export default function useOpeningPhase() {
  const [phase, setPhase] = useState('still');

  useEffect(() => {
    let socket = null;
    let closed = false;
    let retryTimer = 0;

    const connect = () => {
      if (closed) return;
      socket = new WebSocket(openingSocketUrl());
      socket.addEventListener('open', () => {
        socket.send(JSON.stringify({ type: 'join', role: 'display' }));
      });
      socket.addEventListener('message', (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        if (msg.type === 'joined' || msg.type === 'opening') {
          setPhase(msg.phase === 'playing' ? 'playing' : 'still');
        }
      });
      socket.addEventListener('close', () => {
        if (closed) return;
        retryTimer = window.setTimeout(connect, 1000);
      });
    };

    connect();
    return () => {
      closed = true;
      window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, []);

  return phase;
}
