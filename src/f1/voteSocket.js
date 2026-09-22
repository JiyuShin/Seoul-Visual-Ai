import { VOTE_SOCKET_PATH } from '../shared/gazeConfig.js';

const RECONNECT_DELAY_MS = 1000;

function socketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${VOTE_SOCKET_PATH}`;
}

/**
 * 투표 룸에 붙는 WebSocket 클라이언트. 전시 중에 탭이 잠들거나 서버가 재시작되어도
 * 사람이 새로고침하지 않아도 되도록 끊기면 계속 다시 붙는다.
 */
export function createVoteSocket({ role, viewerId = null, onWelcome, onSync, onStatusChange }) {
  let socket = null;
  let reconnectTimer = null;
  let closed = false;

  function connect() {
    if (closed) return;

    socket = new WebSocket(socketUrl());

    socket.addEventListener('open', () => {
      onStatusChange?.('open');
      socket.send(JSON.stringify({ t: 'hello', role, viewerId }));
    });

    socket.addEventListener('message', (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      if (message.t === 'welcome') onWelcome?.(message);
      else if (message.t === 'sync') onSync?.(message);
    });

    socket.addEventListener('close', () => {
      onStatusChange?.('closed');
      if (closed) return;
      reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
    });

    socket.addEventListener('error', () => {
      socket?.close();
    });
  }

  connect();

  return {
    send(payload) {
      if (socket?.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify(payload));
      return true;
    },
    close() {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    },
  };
}
