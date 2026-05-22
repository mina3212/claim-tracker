import { useState } from 'react';

const OVERLAY = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
  zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const MODAL = {
  background: '#fff', borderRadius: 12, padding: 24,
  width: 460, maxWidth: '95vw',
  display: 'flex', flexDirection: 'column', gap: 16,
  boxShadow: '0 20px 60px rgba(0,0,0,.25)',
};

export default function DeleteRequestModal({ claimName, onClose, onSubmit }) {
  const [reason, setReason]       = useState('');
  const [submitting, setSubmit]   = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) { alert('삭제 사유를 입력해주세요.'); return; }
    setSubmit(true);
    try {
      await onSubmit(reason.trim());
    } catch (e) {
      alert('요청 실패: ' + e.message);
      setSubmit(false);
    }
  };

  const handleKey = (e) => { if (e.key === 'Escape') onClose(); };

  return (
    <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={MODAL} onKeyDown={handleKey}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#dc2626' }}>🗑 삭제 요청</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
        </div>

        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 8, padding: '10px 14px', fontSize: 13,
        }}>
          <span style={{ color: '#64748b' }}>삭제 요청 대상: </span>
          <strong style={{ color: '#dc2626' }}>{claimName}</strong>
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6, color: '#374151' }}>
            삭제 사유 <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <textarea
            autoFocus
            rows={4}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="삭제 사유를 상세히 입력해주세요..."
            style={{
              width: '100%', padding: '10px 12px',
              border: '1px solid #e2e8f0', borderRadius: 8,
              fontSize: 13, resize: 'vertical', fontFamily: 'inherit', outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = '#f59e0b'; }}
            onBlur={e => { e.target.style.borderColor = '#e2e8f0'; }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={submitting}>취소</button>
          <button
            className="btn btn-sm"
            onClick={handleSubmit}
            disabled={submitting}
            style={{ background: '#f59e0b', color: '#fff', border: '1px solid #f59e0b' }}
          >
            {submitting ? '요청 중...' : '관리자에게 요청하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
