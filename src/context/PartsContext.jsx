import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchParts } from '../lib/supabase';

const PartsCtx = createContext(null);

export function PartsProvider({ children }) {
  const [parts, setParts] = useState([]);

  const load = useCallback(async () => {
    try { setParts(await fetchParts()); }
    catch { /* 테이블 없으면 조용히 무시 */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <PartsCtx.Provider value={{ parts, reload: load, setParts }}>
      {children}
    </PartsCtx.Provider>
  );
}

export const useParts = () => useContext(PartsCtx);
