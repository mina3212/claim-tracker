import { useEffect, useState, useRef } from 'react';

const HEARTBEAT_INTERVAL = 30 * 1000;  // 30초
const POLL_INTERVAL      = 30 * 1000;  // 30초

export function usePresence(user, displayName, department) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    const sendHeartbeat = async () => {
      try {
        await fetch('/api/presence/heartbeat', {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({ display_name: displayName || user.email, department: department || '' }),
        });
      } catch { /* 오프라인 시 무시 */ }
    };

    const pollPresence = async () => {
      try {
        const res   = await fetch('/api/presence', { credentials: 'include' });
        if (res.ok) setOnlineUsers(await res.json());
      } catch { /* 무시 */ }
    };

    // 즉시 실행
    sendHeartbeat();
    pollPresence();

    // 주기적 실행
    timerRef.current = setInterval(() => {
      sendHeartbeat();
      pollPresence();
    }, Math.max(HEARTBEAT_INTERVAL, POLL_INTERVAL));

    return () => { clearInterval(timerRef.current); };
  }, [user?.id, displayName, department]);

  return onlineUsers;
}
