import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { fetchClaims, fetchAllStages, fetchDeleteRequests } from '../lib/supabase';

const ClaimsCtx = createContext(null);

const POLL_INTERVAL = 30 * 1000; // 30초 주기로 폴링

export function ClaimsProvider({ children }) {
  const [claims,         setClaims]         = useState([]);
  const [stages,         setStages]         = useState([]);
  const [deleteRequests, setDeleteRequests] = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [dbReady,        setDbReady]        = useState(true);
  const [notifications,  setNotifications]  = useState([]);
  const prevClaimIdsRef = useRef(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([fetchClaims(), fetchAllStages()]);

      // 폴링으로 새 클레임 감지 (다른 사용자가 접수한 건)
      const newOnes = c.filter(claim => !prevClaimIdsRef.current.has(claim.id));
      if (prevClaimIdsRef.current.size > 0 && newOnes.length > 0) {
        setNotifications(prev => [...prev, ...newOnes]);
      }
      prevClaimIdsRef.current = new Set(c.map(cl => cl.id));

      setClaims(c);
      setStages(s);
      setDbReady(true);
    } catch (e) {
      if (e.message?.includes('42P01')) setDbReady(false);
      console.error('데이터 로드 실패:', e);
    } finally {
      setLoading(false);
    }
    try {
      const dr = await fetchDeleteRequests();
      setDeleteRequests(dr);
    } catch { /* delete_requests 테이블 미생성 시 무시 */ }
  }, []);

  // 최초 로드
  useEffect(() => { refresh(); }, [refresh]);

  // 30초 폴링 (Supabase Realtime 대체)
  useEffect(() => {
    const timer = setInterval(() => { refresh(); }, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [refresh]);

  const getStagesFor = useCallback(
    (claimId) => stages.filter(s => s.claim_id === claimId).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [stages]
  );

  const addClaim = useCallback((claim, firstEntry) => {
    setClaims(prev => [claim, ...prev]);
    setStages(prev => [...prev, firstEntry]);
    prevClaimIdsRef.current.add(claim.id);
  }, []);

  const updateClaimStage = useCallback((claimId, nextStage, entry) => {
    setClaims(prev => prev.map(c => c.id === claimId ? { ...c, current_stage: nextStage } : c));
    setStages(prev => [...prev, entry]);
  }, []);

  const removeClaim = useCallback((id) => {
    setClaims(prev => prev.filter(c => c.id !== id));
    setStages(prev => prev.filter(s => s.claim_id !== id));
    setDeleteRequests(prev => prev.filter(r => r.claim_id !== id));
    prevClaimIdsRef.current.delete(id);
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

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const setCurrentUser = useCallback(() => {}, []); // 폴링 방식에서는 사용 안 함

  return (
    <ClaimsCtx.Provider value={{
      claims, stages, deleteRequests, loading, dbReady, notifications,
      refresh, getStagesFor, addClaim, updateClaimStage, updateClaimData,
      removeClaim, addDeleteRequest, resolveRequest, patchStageEntry,
      dismissNotification, setCurrentUser,
    }}>
      {children}
    </ClaimsCtx.Provider>
  );
}

export const useClaims = () => useContext(ClaimsCtx);
