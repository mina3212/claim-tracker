import { useState, useRef, useEffect } from 'react';
import { searchSupplierNames } from '../lib/supabase';

export default function SupplierSearch({ value, onChange, placeholder = '공급사명 입력 또는 검색' }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open,        setOpen]        = useState(false);
  const wrapRef = useRef();

  useEffect(() => {
    const handler = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!value.trim()) { setSuggestions([]); setOpen(false); return; }
    const timer = setTimeout(async () => {
      const results = await searchSupplierNames(value);
      setSuggestions(results);
      setOpen(results.length > 0);
    }, 250);
    return () => clearTimeout(timer);
  }, [value]);

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
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
      />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 200, overflowY: 'auto',
          marginTop: 2,
        }}>
          {suggestions.map((name, i) => (
            <div
              key={i}
              onMouseDown={() => { onChange(name); setOpen(false); }}
              style={{
                padding: '9px 14px', cursor: 'pointer', fontSize: 13,
                borderBottom: '1px solid #f1f5f9',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              🏭 {highlight(name, value)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
