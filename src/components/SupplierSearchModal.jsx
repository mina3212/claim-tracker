import { useState, useEffect } from 'react';
import { searchSuppliers } from '../lib/supabase';

const OVERLAY = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
  zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const MODAL = {
  background: '#fff', borderRadius: 12, padding: 24,
  width: 440, maxWidth: '95vw', maxHeight: '80vh',
  display: 'flex', flexDirection: 'column', gap: 14,
  boxShadow: '0 20px 60px rgba(0,0,0,.25)',
};

export default function SupplierSearchModal({ onSelect, onClose }) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try { setResults(await searchSuppliers(query)); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const handleKey = (e) => { if (e.key === 'Escape') onClose(); };

  return (
    <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={MODAL}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>🏭 공급사 검색</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
        </div>

        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          placeholder="공급사명을 입력하세요..."
          style={{
            padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8,
            fontSize: 14, outline: 'none', fontFamily: 'inherit',
          }}
          onFocus={e => { e.target.style.borderColor = '#3b82f6'; }}
          onBlur={e => { e.target.style.borderColor = '#e2e8f0'; }}
        />

        <div style={{ fontSize: 11, color: '#94a3b8' }}>
          선택하면 공급사명이 자동으로 채워집니다. 공급사 관리 메뉴에서 목록을 등록하세요.
        </div>

        <div style={{
          overflowY: 'auto', flex: 1,
          border: '1px solid #f1f5f9', borderRadius: 8, minHeight: 120, maxHeight: 360,
        }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>검색 중...</div>
          ) : !query.trim() ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              공급사명을 입력하세요.
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>검색 결과가 없습니다</div>
          ) : (
            results.map(s => (
              <div
                key={s.id}
                onClick={() => { onSelect(s.name); onClose(); }}
                style={{
                  display: 'flex', gap: 12, alignItems: 'center',
                  padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                  borderBottom: '1px solid #f8fafc', transition: '.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f0f9ff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = ''; }}
              >
                <span style={{ fontSize: 18 }}>🏭</span>
                <span style={{ color: '#374151', fontWeight: 500 }}>{s.name}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
