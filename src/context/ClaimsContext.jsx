import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchClaims, fetchAllStages } from '../lib/supabase';

const ClaimsCtx = createContext(null);

export function ClaimsProvider({ children }) {
  const [claims, setClaims]   = useState([]);
  const [stages, setStages]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([fetchClaims(), fetchAllStages()]);
      setClaims(c);
      setStages(s);
      setDbReady(true);
    } catch (e) {
      if (e.code === '42P01') setDbReady(false); // table not found
      console.error('데이터 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const getStagesFor = useCallback(
    (claimId) => stages.filter(s => s.claim_id === claimId).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [stages]
  );

  const addClaim = useCallback((claim, firstEntry) => {
    setClaims(prev => [claim, ...prev]);
    setStages(prev => [...prev, firstEntry]);
  }, []);

  const updateClaimStage = useCallback((claimId, nextStage, entry) => {
    setClaims(prev => prev.map(c => c.id === claimId ? { ...c, current_stage: nextStage } : c));
    setStages(prev => [...prev, entry]);
  }, []);

  const removeClaim = useCallback((id) => {
    setClaims(prev => prev.filter(c => c.id !== id));
    setStages(prev => prev.filter(s => s.claim_id !== id));
  }, []);

  return (
    <ClaimsCtx.Provider value={{ claims, stages, loading, dbReady, refresh, getStagesFor, addClaim, updateClaimStage, removeClaim }}>
      {children}
    </ClaimsCtx.Provider>
  );
}

export const useClaims = () => useContext(ClaimsCtx);
