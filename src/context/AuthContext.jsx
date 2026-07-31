import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { resolvePermissions } from '../lib/permissions';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId, email) => {
    try {
      const res = await fetch(`/api/profiles/${encodeURIComponent(userId)}`);
      const p   = res.ok ? await res.json() : null;
      setProfile(p ?? null);
      if (email && p && !p.email) {
        fetch(`/api/profiles/${encodeURIComponent(userId)}/email`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        }).catch(() => {});
      }
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    fetch('/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        setUser(u);
        if (u) return loadProfile(u.id, u.email);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [loadProfile]);

  const saveName = useCallback(async (name) => {
    if (!user) return;
    await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, name, department: profile?.department, email: user.email }),
    });
    setProfile(prev => ({ ...(prev ?? {}), name }));
  }, [user, profile]);

  const displayName = profile?.name || user?.user_metadata?.name || user?.email || '';
  const isAdmin     = profile?.is_admin === true;
  const department  = profile?.department || '';

  const permissions = useMemo(() => resolvePermissions(profile), [profile]);
  const canDo = useCallback((key) => !!permissions[key], [permissions]);

  return (
    <AuthCtx.Provider value={{
      user, profile, loading, displayName, isAdmin, department, saveName,
      permissions, canDo,
      reloadProfile: () => user && loadProfile(user.id, user.email),
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
