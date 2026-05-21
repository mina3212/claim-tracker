import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';

export function usePresence(user, displayName, department) {
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!user) return;

    const channel = sb.channel('online-presence', {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        // presenceState는 { [key]: [{ ...payload }] } 형태
        const users = Object.values(state)
          .flat()
          .sort((a, b) => a.display_name?.localeCompare(b.display_name || '') || 0);
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id:      user.id,
            display_name: displayName || user.email,
            department:   department  || '',
            email:        user.email  || '',
          });
        }
      });

    return () => { channel.unsubscribe(); };
  }, [user?.id, displayName, department]);

  return onlineUsers;
}
