import { WebSocketServer } from 'ws';
import { createVoteState } from '../lib/voteState.js';
import {
  VISION_CARDS,
  VOTE_REQUIRED_VIEWERS,
  VOTE_SOCKET_PATH,
  VOTE_SYNC_INTERVAL_MS,
  VOTE_VIEWER_IDS,
  VOTE_VIEWER_TIMEOUT_MS,
} from '../scenes/EntryToDiscussion/gazeConfig.js';

const CARD_IDS = VISION_CARDS.map((card) => card.id);

/**
 * 투표 단계의 권위 있는 상태를 들고 있는 WebSocket 룸.
 *
 * WebGazer는 window마다 하나의 카메라·하나의 얼굴만 다루므로, 웹캠 두 대로 두 사람을
 * 추적하려면 창을 나눠야 한다. 역할은 둘이다.
 *
 * - display: 카드를 그리는 창(/1). 자기 웹캠으로 1번 참가자를 직접 추적하고,
 *   모든 참가자의 시선을 카드와 교차 판정해서 결과를 올려보낸다.
 * - tracker: 남은 참가자용 창(/tracker). 다른 웹캠을 잡고 시선 좌표만 올려보낸다.
 *
 * 카드 배치는 화면을 그리는 쪽만 알기 때문에 교차 판정은 display가 하고,
 * 점수 누적과 승자 결정은 서버가 맡는다.
 */
export function attachVoteRoom(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: VOTE_SOCKET_PATH });
  const voteState = createVoteState({ cardIds: CARD_IDS });

  // 트래커가 올려보낸 원본 시선. viewerId -> { x, y, lastSampleAt }
  const viewerGaze = new Map();
  const clients = new Set();

  function send(socket, payload) {
    if (socket.readyState !== socket.OPEN) return;
    socket.send(JSON.stringify(payload));
  }

  function ownedViewerIds() {
    const taken = new Set();
    clients.forEach((client) => {
      if (client.viewerId) taken.add(client.viewerId);
    });
    return taken;
  }

  /** 이미 다른 창이 쓰고 있는 참가자 번호는 피해서 배정한다. */
  function claimViewerId(client, requested) {
    const taken = ownedViewerIds();
    taken.delete(client.viewerId);

    if (requested && VOTE_VIEWER_IDS.includes(requested) && !taken.has(requested)) {
      return requested;
    }

    return VOTE_VIEWER_IDS.find((id) => !taken.has(id)) || null;
  }

  function buildViewerList(now) {
    const owners = new Map();
    clients.forEach((client) => {
      if (client.viewerId) owners.set(client.viewerId, client.role);
    });

    return VOTE_VIEWER_IDS.map((id) => {
      const role = owners.get(id) || null;
      const gaze = viewerGaze.get(id);
      const hasFreshGaze = Boolean(gaze) && now - gaze.lastSampleAt <= VOTE_VIEWER_TIMEOUT_MS;

      // display는 자기 시선을 서버로 보내지 않고 직접 판정하므로, 창이 붙어 있으면 연결된 것으로 본다.
      const connected = role === 'display' ? true : hasFreshGaze;

      return {
        id,
        role,
        connected,
        x: hasFreshGaze ? gaze.x : null,
        y: hasFreshGaze ? gaze.y : null,
      };
    });
  }

  function broadcastSync() {
    const now = Date.now();

    // 트래커가 끊기면 시선이 더 들어오지 않고, voteState의 유효시간(grace)이 지나면서
    // 해당 참가자는 자동으로 응시 목록에서 빠진다. 별도 정리가 필요하지 않다.
    voteState.tick(now);

    const message = JSON.stringify({
      t: 'sync',
      now,
      viewers: buildViewerList(now),
      ...voteState.getSnapshot(now),
    });

    clients.forEach((client) => {
      if (client.socket.readyState === client.socket.OPEN) {
        client.socket.send(message);
      }
    });
  }

  function handleMessage(client, raw) {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }

    switch (message.t) {
      case 'hello': {
        client.role = message.role === 'tracker' ? 'tracker' : 'display';
        client.viewerId = claimViewerId(client, message.viewerId);

        send(client.socket, {
          t: 'welcome',
          role: client.role,
          viewerId: client.viewerId,
          viewerIds: VOTE_VIEWER_IDS,
          requiredViewers: VOTE_REQUIRED_VIEWERS,
          cardIds: CARD_IDS,
        });
        break;
      }

      case 'gaze': {
        if (client.role !== 'tracker' || !client.viewerId) return;
        if (!Number.isFinite(message.x) || !Number.isFinite(message.y)) return;

        viewerGaze.set(client.viewerId, { x: message.x, y: message.y, lastSampleAt: Date.now() });
        break;
      }

      case 'hits': {
        if (client.role !== 'display' || !message.hits) return;

        const now = Date.now();
        Object.entries(message.hits).forEach(([viewerId, cardId]) => {
          voteState.recordHit(viewerId, cardId, now);
        });
        break;
      }

      case 'reset': {
        voteState.reset();
        viewerGaze.clear();
        break;
      }

      default:
        break;
    }
  }

  wss.on('connection', (socket) => {
    const client = { socket, role: 'display', viewerId: null };
    clients.add(client);

    socket.on('message', (raw) => handleMessage(client, raw));

    socket.on('close', () => {
      clients.delete(client);
      if (client.viewerId) {
        viewerGaze.delete(client.viewerId);
        voteState.removeViewer(client.viewerId);
      }
    });

    socket.on('error', () => {
      clients.delete(client);
    });
  });

  const syncTimer = setInterval(broadcastSync, VOTE_SYNC_INTERVAL_MS);

  return {
    close() {
      clearInterval(syncTimer);
      wss.close();
    },
  };
}
