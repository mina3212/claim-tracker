import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ClaimNotificationPopup({ notifications, onDismiss }) {
  const navigate = useNavigate();

  if (!notifications.length) return null;

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
      {notifications.map(n => (
        <NotificationCard key={n.id} notification={n} onDismiss={onDismiss} navigate={navigate} />
      ))}
    </div>
  );
}

function NotificationCard({ notification: n, onDismiss, navigate }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 슬라이드 인
    const t1 = setTimeout(() => setVisible(true), 10);
    // 8초 후 자동 닫기
    const t2 = setTimeout(() => onDismiss(n.id), 8000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [n.id, onDismiss]);

  const handleClick = () => {
    navigate(`/claims/${n.id}`);
    onDismiss(n.id);
  };

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,.18)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        transform: visible ? 'translateX(0)' : 'translateX(120%)',
        opacity: visible ? 1 : 0,
        transition: 'transform .35s cubic-bezier(.22,1,.36,1), opacity .3s',
      }}
    >
      {/* 상단 진행바 */}
      <div style={{ height: 3, background: '#3b82f6', animation: 'shrink 8s linear forwards' }} />

      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6', marginBottom: 4 }}>
              🔔 새 클레임 접수
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>
              {n.customer_name}
            </div>
            {n.part_name && (
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>
                {n.part_number && <span style={{ fontFamily: 'monospace', marginRight: 6 }}>{n.part_number}</span>}
                {n.part_name}
              </div>
            )}
            {n.defect_description && (
              <div style={{ fontSize: 12, color: '#475569', marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {n.defect_description}
              </div>
            )}
          </div>
          <button
            onClick={() => onDismiss(n.id)}
            style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94a3b8', lineHeight: 1, padding: 0, flexShrink: 0 }}
          >×</button>
        </div>
        <button
          onClick={handleClick}
          style={{ marginTop: 10, width: '100%', padding: '7px 0', borderRadius: 8, border: 'none', background: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          클레임 확인하기 →
        </button>
      </div>

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}
