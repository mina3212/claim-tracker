import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { sb, getProfile, upsertProfile, syncProfileEmail } from '../lib/supabase';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user,               setUser]               = useState(null);
  const [profile,            setProfile]            = useState(null);
  const [loading,            setLoading]            = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    // Portal SSO: 세션 정보를 /auth/me 로 확인
    sb.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) loadProfile(u.id, u.email).finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) loadProfile(u.id, u.email);
      else setProfile(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId, email) {
    try {
      const p = await getProfile(userId);
      setProfile(p ?? null);
      if (email) syncProfileEmail(userId, email).catch(() => {});
    } catch {
      setProfile(null);
    }
  }

  const saveName = useCallback(async (name) => {
    if (!user) return;
    await upsertProfile(user.id, name, profile?.department);
    setProfile(prev => ({ ...(prev ?? {}), name }));
  }, [user, profile]);

  const displayName = profile?.name || user?.user_metadata?.name || user?.email || '';
  const isAdmin     = profile?.is_admin === true;
  const department  = profile?.department || '';

  return (
    <AuthCtx.Provider value={{
      user, profile, loading, displayName, isAdmin, department, saveName,
      reloadProfile: () => user && loadProfile(user.id, user.email),
      isPasswordRecovery, setIsPasswordRecovery,
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
