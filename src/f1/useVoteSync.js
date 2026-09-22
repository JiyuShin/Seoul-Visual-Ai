import { useCallback, useEffect, useRef, useState } from 'react';
import { createVoteSocket } from './voteSocket';

/**
 * 투표 룸과의 연결을 React 쪽에서 쓰기 편하게 감싼다.
 *
 * 서버 상태는 두 갈래로 내보낸다. 화면을 그리는 데 쓰는 `sync`는 state로,
 * requestAnimationFrame 루프에서 매 프레임 읽어야 하는 값은 `syncRef`로 준다.
 * 렌더를 유발하지 않고 최신 시선 좌표를 읽기 위한 구분이다.
 */
export function useVoteSync({ role, viewerId = null, enabled = true }) {
  const [status, setStatus] = useState('closed');
  const [welcome, setWelcome] = useState(null);
  const [sync, setSync] = useState(null);

  const syncRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    const socket = createVoteSocket({
      role,
      viewerId,
      onStatusChange: setStatus,
      onWelcome: setWelcome,
      onSync: (message) => {
        syncRef.current = message;
        setSync(message);
      },
    });

    socketRef.current = socket;

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [role, viewerId, enabled]);

  const send = useCallback((payload) => socketRef.current?.send(payload) ?? false, []);

  return { status, welcome, sync, syncRef, send };
}
