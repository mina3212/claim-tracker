import { useState, useRef, useEffect } from 'react';
import { useParts } from '../context/PartsContext';

export default function PartAutocomplete({ partNumber, partName, onSelect }) {
  const { parts } = useParts();
  const [query,      setQuery]      = useState(partNumber || '');
  const [suggestions, setSuggestions] = useState([]);
  const [open,       setOpen]       = useState(false);
  const wrapRef = useRef();

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // partNumber prop이 외부에서 바뀌면 동기화
  useEffect(() => { setQuery(partNumber || ''); }, [partNumber]);

  const handleInput = (val) => {
    setQuery(val);
    onSelect(val, ''); // 품명 초기화
    if (!val.trim()) { setSuggestions([]); setOpen(false); return; }
    const q = val.toLowerCase();
    const matched = parts
      .filter(p => p.part_number.toLowerCase().includes(q) || p.part_name.toLowerCase().includes(q))
      .slice(0, 12);
    setSuggestions(matched);
    setOpen(matched.length > 0);
  };

  const pick = (p) => {
    setQuery(p.part_number);
    setSuggestions([]);
    setOpen(false);
    onSelect(p.part_number, p.part_name);
  };

  const highlight = (text, q) => {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: '#fef08a', borderRadius: 2, padding: 0 }}>{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={parts.length > 0 ? '품번 입력 또는 검색' : '품번 입력'}
      />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 240, overflowY: 'auto',
          marginTop: 2,
        }}>
          {suggestions.map(p => (
            <div
              key={p.id}
              onMouseDown={() => pick(p)}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                display: 'flex', gap: 10, alignItems: 'center',
                borderBottom: '1px solid #f1f5f9',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#0f172a', minWidth: 80 }}>
                {highlight(p.part_number, query)}
              </span>
              <span style={{ color: '#475569' }}>
                {highlight(p.part_name, query)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
