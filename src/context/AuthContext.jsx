import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { sb, getProfile, upsertProfile } from '../lib/supabase';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);   // { name, department, is_admin }
  const [loading, setLoading] = useState(true);   // 세션 확인 중

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) loadProfile(u.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((_, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) loadProfile(u.id);
      else { setProfile(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId) {
    try {
      const p = await getProfile(userId);
      setProfile(p ?? null);
    } catch {
      setProfile(null);
    }
  }

  const saveName = useCallback(async (name) => {
    if (!user) return;
    await upsertProfile(user.id, name, profile?.department);
    setProfile(prev => ({ ...(prev ?? {}), name }));
  }, [user, profile]);

  // 편의 getter
  const displayName = profile?.name || user?.user_metadata?.name || user?.email || '';
  const isAdmin     = profile?.is_admin === true;
  const department  = profile?.department || '';

  return (
    <AuthCtx.Provider value={{ user, profile, loading, displayName, isAdmin, department, saveName, reloadProfile: () => user && loadProfile(user.id) }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
