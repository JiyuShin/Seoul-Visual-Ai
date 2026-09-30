import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/router';
import {
  buildMobileJoinUrl,
  getMobilePublicOriginSync,
  resolveMobilePublicOrigin,
} from './publicOrigin';
import { MSG, WS_PATH } from './protocol';
import { createMobileSessionId } from './sessionId';

const MobileLinkContext = createContext(null);

function wsUrl() {
  if (typeof window === 'undefined') return '';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${WS_PATH}`;
}

export function MobileLinkProvider({ children }) {
  const router = useRouter();
  const wsRef = useRef(null);
  const [sessionId, setSessionId] = useState(null);
  const [role, setRole] = useState(null);
  const [status, setStatus] = useState('idle');
  const [slots, setSlots] = useState({ A: false, B: false });
  const [districtFromKiosk, setDistrictFromKiosk] = useState(null);
  const [lastError, setLastError] = useState(null);
  const [mobilePublicOrigin, setMobilePublicOrigin] = useState(() => getMobilePublicOriginSync());

  const refreshMobilePublicOrigin = useCallback(() => {
    resolveMobilePublicOrigin().then((origin) => {
      if (origin) setMobilePublicOrigin(origin);
    });
  }, []);

  useEffect(() => {
    refreshMobilePublicOrigin();
    const onFocus = () => refreshMobilePublicOrigin();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshMobilePublicOrigin]);

  const disconnect = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  }, []);

  const connect = useCallback(
    ({ sessionId: id, linkRole, district }) => {
      if (typeof window === 'undefined' || !id) return;
      disconnect();

      setSessionId(id);
      setRole(linkRole);
      setStatus('connecting');
      setLastError(null);

      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: MSG.JOIN,
            sessionId: id,
            role: linkRole,
            district: district ?? null,
          })
        );
      };

      ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === MSG.JOINED) {
          setStatus(linkRole === 'kiosk' ? 'waiting_mobile' : 'waiting_kiosk');
          return;
        }
        if (msg.type === MSG.SLOTS && msg.slots) {
          setSlots({ A: Boolean(msg.slots.A), B: Boolean(msg.slots.B) });
          return;
        }
        if (msg.type === MSG.PAIRED) {
          setStatus('paired');
          if (msg.district) setDistrictFromKiosk(msg.district);
          if (msg.slot === 'A' || msg.slot === 'B') {
            setSlots((prev) => ({ ...prev, [msg.slot]: true }));
          }
          return;
        }
        if (msg.type === MSG.STATE && msg.payload?.district) {
          setDistrictFromKiosk(msg.payload.district);
          return;
        }
        if (msg.type === MSG.PEER_LEFT) {
          if (msg.slot === 'A' || msg.slot === 'B') {
            setSlots((prev) => ({ ...prev, [msg.slot]: false }));
          }
          if (linkRole === 'mobile' && msg.role === 'kiosk') {
            setStatus('waiting_kiosk');
          } else if (linkRole === 'kiosk' && msg.role === 'mobile') {
            setStatus('waiting_mobile');
          }
          return;
        }
        if (msg.type === MSG.ERROR) {
          setLastError(msg.message || 'link error');
          setStatus('error');
        }
      };

      ws.onerror = () => {
        setLastError('WebSocket 연결 실패');
        setStatus('error');
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
          setStatus((s) => (s === 'error' ? s : 'closed'));
        }
      };
    },
    [disconnect]
  );

  const startKioskSession = useCallback(
    (district) => {
      refreshMobilePublicOrigin();
      const id = createMobileSessionId();
      connect({ sessionId: id, linkRole: 'kiosk', district });
      return id;
    },
    [connect, refreshMobilePublicOrigin]
  );

  const joinMobileSession = useCallback(
    (id) => {
      if (!id) return;
      connect({ sessionId: id, linkRole: 'mobile' });
    },
    [connect]
  );

  const sendState = useCallback((payload) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !sessionId) return;
    ws.send(JSON.stringify({ type: MSG.STATE, sessionId, payload }));
  }, [sessionId]);

  const mobileJoinRef = useRef(null);

  useEffect(() => {
    if (!router.isReady || router.pathname !== '/mobile') return undefined;
    const join = router.query.join;
    const id = typeof join === 'string' ? join : join?.[0];
    if (!id || mobileJoinRef.current === id) return undefined;
    mobileJoinRef.current = id;
    joinMobileSession(id);
    return () => {
      mobileJoinRef.current = null;
      disconnect();
    };
  }, [router.isReady, router.pathname, router.query.join, joinMobileSession, disconnect]);

  useEffect(() => () => disconnect(), [disconnect]);

  const qrOrigin = mobilePublicOrigin || getMobilePublicOriginSync();
  const qrTargetUrl = sessionId ? buildMobileJoinUrl(sessionId, qrOrigin) : '';

  const value = useMemo(
    () => ({
      sessionId,
      role,
      status,
      slots,
      districtFromKiosk,
      lastError,
      mobilePublicOrigin,
      qrTargetUrl,
      startKioskSession,
      joinMobileSession,
      sendState,
      disconnect,
      isPaired: status === 'paired',
    }),
    [
      sessionId,
      role,
      status,
      slots,
      districtFromKiosk,
      lastError,
      mobilePublicOrigin,
      qrTargetUrl,
      startKioskSession,
      joinMobileSession,
      sendState,
      disconnect,
    ]
  );

  return <MobileLinkContext.Provider value={value}>{children}</MobileLinkContext.Provider>;
}

export function useMobileLink() {
  const ctx = useContext(MobileLinkContext);
  if (!ctx) {
    throw new Error('useMobileLink must be used inside MobileLinkProvider');
  }
  return ctx;
}
