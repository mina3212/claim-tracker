import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchSupplierClaims, fetchAllSupplierStages, fetchImprovementLogs } from '../lib/supabase';

const SupplierClaimsCtx = createContext(null);

export function SupplierClaimsProvider({ children }) {
  const [claims,           setClaims]           = useState([]);
  const [stages,           setStages]           = useState([]);
  const [improvementLogs,  setImprovementLogs]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [c, s, imp] = await Promise.all([
        fetchSupplierClaims(),
        fetchAllSupplierStages(),
        fetchImprovementLogs().catch(() => []),
      ]);
      setClaims(c);
      setStages(s);
      setImprovementLogs(imp || []);
      setDbReady(true);
    } catch (e) {
      if (e.code === '42P01') setDbReady(false);
      console.error('공급사 불량 데이터 로드 실패:', e);
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
    if (firstEntry) setStages(prev => [...prev, firstEntry]);
  }, []);

  const updateClaimStage = useCallback((claimId, nextStage, entry) => {
    setClaims(prev => prev.map(c => c.id === claimId ? { ...c, current_stage: nextStage } : c));
    setStages(prev => [...prev, entry]);
  }, []);

  const removeClaim = useCallback((id) => {
    setClaims(prev => prev.filter(c => c.id !== id));
    setStages(prev => prev.filter(s => s.claim_id !== id));
  }, []);

  const updateClaimData = useCallback((id, data) => {
    setClaims(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  }, []);

  const patchStageEntry = useCallback((id, data) => {
    setStages(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  }, []);

  const addImprovementLog = useCallback((log) => {
    setImprovementLogs(prev => [...prev, log]);
  }, []);

  const updateImpLog = useCallback((id, data) => {
    setImprovementLogs(prev => prev.map(l => l.id === id ? { ...l, ...data } : l));
  }, []);

  const removeImpLog = useCallback((id) => {
    setImprovementLogs(prev => prev.filter(l => l.id !== id));
  }, []);

  return (
    <SupplierClaimsCtx.Provider value={{
      claims, stages, improvementLogs, loading, dbReady,
      refresh, getStagesFor, addClaim, updateClaimStage, updateClaimData,
      removeClaim, patchStageEntry,
      addImprovementLog, updateImpLog, removeImpLog,
    }}>
      {children}
    </SupplierClaimsCtx.Provider>
  );
}

export const useSupplierClaims = () => useContext(SupplierClaimsCtx);
