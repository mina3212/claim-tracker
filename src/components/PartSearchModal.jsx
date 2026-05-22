import { useState } from 'react';
import { useParts } from '../context/PartsContext';

const OVERLAY = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
  zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const MODAL = {
  background: '#fff', borderRadius: 12, padding: 24,
  width: 500, maxWidth: '95vw', maxHeight: '80vh',
  display: 'flex', flexDirection: 'column', gap: 14,
  boxShadow: '0 20px 60px rgba(0,0,0,.25)',
};

export default function PartSearchModal({ onSelect, onClose }) {
  const { parts } = useParts();
  const [query, setQuery] = useState('');

  const filtered = parts.filter(p => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return p.part_number.toLowerCase().includes(q) || p.part_name.toLowerCase().includes(q);
  }).slice(0, 60);

  const handleKey = (e) => { if (e.key === 'Escape') onClose(); };

  return (
    <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={MODAL}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>🔍 품번 / 품명 검색</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
        </div>

        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          placeholder="품번 또는 품명을 입력하세요..."
          style={{
            padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8,
            fontSize: 14, outline: 'none', fontFamily: 'inherit',
          }}
          onFocus={e => { e.target.style.borderColor = '#3b82f6'; }}
          onBlur={e => { e.target.style.borderColor = '#e2e8f0'; }}
        />

        <div style={{ fontSize: 11, color: '#94a3b8' }}>
          선택하면 품번과 품명이 자동으로 채워집니다. {parts.length > 0 ? `(총 ${parts.length}개 품목)` : ''}
        </div>

        <div style={{
          overflowY: 'auto', flex: 1,
          border: '1px solid #f1f5f9', borderRadius: 8, minHeight: 120, maxHeight: 360,
        }}>
          {parts.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              등록된 품목이 없습니다.<br />
              <span style={{ fontSize: 11 }}>품번/품명 마스터 페이지에서 품목을 추가하세요.</span>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>검색 결과가 없습니다</div>
          ) : (
            filtered.map(p => (
              <div
                key={p.id}
                onClick={() => { onSelect(p.part_number, p.part_name); onClose(); }}
                style={{
                  display: 'flex', gap: 12, alignItems: 'center',
                  padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                  borderBottom: '1px solid #f8fafc', transition: '.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f0f9ff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = ''; }}
              >
                <span style={{
                  fontFamily: 'monospace', fontSize: 12,
                  background: '#e0f2fe', color: '#0369a1',
                  padding: '2px 8px', borderRadius: 4, flexShrink: 0, minWidth: 80,
                }}>
                  {p.part_number}
                </span>
                <span style={{ color: '#374151' }}>{p.part_name}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
