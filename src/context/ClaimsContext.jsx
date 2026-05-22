import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchClaims, fetchAllStages, fetchDeleteRequests } from '../lib/supabase';

const ClaimsCtx = createContext(null);

export function ClaimsProvider({ children }) {
  const [claims,         setClaims]         = useState([]);
  const [stages,         setStages]         = useState([]);
  const [deleteRequests, setDeleteRequests] = useState([]);
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
      if (e.code === '42P01') setDbReady(false);
      console.error('데이터 로드 실패:', e);
    } finally {
      setLoading(false);
    }
    try {
      const dr = await fetchDeleteRequests();
      setDeleteRequests(dr);
    } catch { /* delete_requests 테이블 미생성 시 무시 */ }
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
    setDeleteRequests(prev => prev.filter(r => r.claim_id !== id));
  }, []);

  const updateClaimData = useCallback((id, data) => {
    setClaims(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  }, []);

  const addDeleteRequest = useCallback((req) => {
    setDeleteRequests(prev => [...prev, req]);
  }, []);

  const resolveRequest = useCallback((id) => {
    setDeleteRequests(prev => prev.filter(r => r.id !== id));
  }, []);

  const patchStageEntry = useCallback((id, data) => {
    setStages(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  }, []);

  return (
    <ClaimsCtx.Provider value={{
      claims, stages, deleteRequests, loading, dbReady,
      refresh, getStagesFor, addClaim, updateClaimStage, updateClaimData,
      removeClaim, addDeleteRequest, resolveRequest, patchStageEntry,
    }}>
      {children}
    </ClaimsCtx.Provider>
  );
}

export const useClaims = () => useContext(ClaimsCtx);
