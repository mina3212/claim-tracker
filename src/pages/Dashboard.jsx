import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClaims } from '../context/ClaimsContext';
import StageBadge from '../components/StageBadge';
import { STAGES, STAGE_COLORS, STAGE_ICONS } from '../lib/supabase';

const OVERLAY = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
  zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const MODAL = {
  background: '#fff', borderRadius: 14, padding: 0,
  width: 680, maxWidth: '95vw', maxHeight: '80vh',
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 24px 64px rgba(0,0,0,.25)', overflow: 'hidden',
};

export default function Dashboard() {
  const { claims, loading, dbReady } = useClaims();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null); // { label, icon, color, items }

  if (loading) return <div className="loading">⏳ 불러오는 중...</div>;

  if (!dbReady) return (
    <div>
      <div className="page-header"><div><div className="page-title">대시보드</div></div></div>
      <div className="setup-box">
        <strong>⚠️ Supabase 테이블 설정이 필요합니다.</strong><br />
        Supabase 대시보드 → SQL Editor에서 아래 SQL을 실행해 주세요.<br /><br />
        <code>CREATE TABLE claims ( id TEXT PRIMARY KEY, customer_name TEXT NOT NULL, part_number TEXT, part_name TEXT, quantity INTEGER, lot_number TEXT, defect_description TEXT, occurrence_date DATE, receipt_date DATE, sales_rep_name TEXT, sales_rep_contact TEXT, current_stage TEXT DEFAULT '접수', created_at TIMESTAMPTZ DEFAULT NOW() );</code>
        <br /><br />
        <code>CREATE TABLE claim_stages ( id TEXT PRIMARY KEY, claim_id TEXT REFERENCES claims(id) ON DELETE CASCADE, stage_name TEXT, stage_date DATE, description TEXT, handler TEXT, created_at TIMESTAMPTZ DEFAULT NOW() );</code>
      </div>
    </div>
  );

  const total     = claims.length;
  const active    = claims.filter(c => c.current_stage !== '종결').length;
  const closed    = claims.filter(c => c.current_stage === '종결').length;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const newThis   = claims.filter(c => (c.receipt_date || c.created_at || '').slice(0, 7) === thisMonth).length;
  const stageCounts = Object.fromEntries(STAGES.map(s => [s, claims.filter(c => c.current_stage === s).length]));

  const recent = [...claims]
    .sort((a, b) => (b.receipt_date || b.created_at || '') > (a.receipt_date || a.created_at || '') ? 1 : -1)
    .slice(0, 8);

  const sorted = (list) => [...list].sort(
    (a, b) => (b.receipt_date || b.created_at || '') > (a.receipt_date || a.created_at || '') ? 1 : -1
  );

  const openModal = (label, icon, color, items) => setModal({ label, icon, color, items: sorted(items) });

  const kpiCards = [
    {
      label: '전체 클레임', value: total, sub: '누적 건', color: '#0f172a', icon: '📋',
      items: claims,
    },
    {
      label: '처리 중', value: active, sub: '진행 중인 클레임', color: '#f59e0b', icon: '⏳',
      items: claims.filter(c => c.current_stage !== '종결'),
    },
    {
      label: '종결 완료', value: closed, sub: '처리 완료', color: '#10b981', icon: '✅',
      items: claims.filter(c => c.current_stage === '종결'),
    },
    {
      label: '이번 달 신규', value: newThis, sub: thisMonth + ' 기준', color: '#3b82f6', icon: '🆕',
      items: claims.filter(c => (c.receipt_date || c.created_at || '').slice(0, 7) === thisMonth),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">대시보드</div>
          <div className="page-sub">고객사 클레임 전체 현황</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/claims/new')}>➕ 클레임 접수</button>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {kpiCards.map(item => (
          <div
            key={item.label}
            className="kpi-card"
            onClick={() => openModal(item.label, item.icon, item.color, item.items)}
            style={{ cursor: 'pointer', transition: '.15s' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
          >
            <div className="kpi-label">{item.label}</div>
            <div className="kpi-value" style={{ color: item.color }}>{item.value}</div>
            <div className="kpi-sub">{item.sub} · 클릭해서 보기</div>
          </div>
        ))}
      </div>

      {/* Stage KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        {STAGES.map((stage, i) => {
          const sc = STAGE_COLORS[stage];
          return (
            <div
              key={stage}
              className="kpi-card"
              style={{ borderColor: 'transparent', cursor: 'pointer', transition: '.15s' }}
              onClick={() => openModal(stage, STAGE_ICONS[i], sc.dot, claims.filter(c => c.current_stage === stage))}
              onMouseEnter={e => { e.currentTarget.style.borderColor = sc.dot; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.transform = ''; }}
            >
              <div className="kpi-label" style={{ color: sc.dot }}>{STAGE_ICONS[i]} {stage}</div>
              <div className="kpi-value" style={{ color: sc.dot }}>{stageCounts[stage]}</div>
              <div className="kpi-sub">건 · 클릭해서 보기</div>
            </div>
          );
        })}
      </div>

      {/* Recent claims */}
      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ margin: 0 }}>최근 클레임</span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/claims')}>전체 보기 →</button>
        </div>
        {recent.length === 0 ? (
          <div className="empty"><div className="empty-icon">📋</div>접수된 클레임이 없습니다</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>접수일</th><th>고객사</th><th>품번</th><th>품명</th>
                  <th>불량내용</th><th>현재 단계</th><th>영업담당</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(c => (
                  <tr key={c.id} className="clickable" onClick={() => navigate(`/claims/${c.id}`)}>
                    <td style={{ whiteSpace: 'nowrap' }}>{c.receipt_date || '-'}</td>
                    <td><strong>{c.customer_name}</strong></td>
                    <td className="mono">{c.part_number || '-'}</td>
                    <td>{c.part_name || '-'}</td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={c.defect_description}>
                      {c.defect_description || '-'}
                    </td>
                    <td><StageBadge stage={c.current_stage} size="sm" /></td>
                    <td>{c.sales_rep_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 카드 클릭 요약 모달 */}
      {modal && (
        <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div style={MODAL}>
            {/* 모달 헤더 */}
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid #f1f5f9',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: '#f8fafc', flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  {modal.icon} {modal.label}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  총 {modal.items.length}건 · 클릭하면 상세 페이지로 이동
                </div>
              </div>
              <button
                onClick={() => setModal(null)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}
              >×</button>
            </div>

            {/* 모달 내용 */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {modal.items.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                  해당하는 클레임이 없습니다
                </div>
              ) : (
                modal.items.map(c => (
                  <div
                    key={c.id}
                    onClick={() => { navigate(`/claims/${c.id}`); setModal(null); }}
                    style={{
                      padding: '14px 24px', borderBottom: '1px solid #f8fafc',
                      cursor: 'pointer', transition: '.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f0f9ff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{c.customer_name}</span>
                          <StageBadge stage={c.current_stage} size="sm" />
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                          {c.receipt_date ? `접수일: ${c.receipt_date}` : ''}
                          {c.part_number ? ` · 품번: ${c.part_number}` : ''}
                          {c.part_name ? ` · ${c.part_name}` : ''}
                          {c.sales_rep_name ? ` · 영업: ${c.sales_rep_name}` : ''}
                        </div>
                        {c.defect_description && (
                          <div style={{
                            fontSize: 13, color: '#374151',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            maxWidth: '100%',
                          }}>
                            {c.defect_description}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0, marginTop: 2 }}>→</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 모달 푸터 */}
            {modal.items.length > 0 && (
              <div style={{
                padding: '12px 24px', borderTop: '1px solid #f1f5f9',
                background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', flexShrink: 0,
              }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const stage = STAGES.find(s => s === modal.label);
                    if (stage) navigate('/claims?stage=' + encodeURIComponent(stage));
                    else navigate('/claims');
                    setModal(null);
                  }}
                >
                  전체 목록에서 보기 →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
