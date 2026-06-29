import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClaims } from '../context/ClaimsContext';
import { useSupplierClaims } from '../context/SupplierClaimsContext';
import { useAuth } from '../context/AuthContext';
import StageBadge from '../components/StageBadge';
import { STAGES, STAGE_COLORS, STAGE_ICONS, SUPPLIER_STAGES, SUPPLIER_STAGE_COLORS, SUPPLIER_STAGE_ICONS, canViewSupplierClaims } from '../lib/supabase';
import { usePrintTitle } from '../context/PrintContext';

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
  const { claims: supplierClaims, loading: supplierLoading } = useSupplierClaims();
  const { department, isAdmin } = useAuth();
  const showSupplier = canViewSupplierClaims(department, isAdmin);
  const navigate = useNavigate();
  const [modal, setModal] = useState(null);
  const [activeTab, setActiveTab] = useState('customer');

  const { setPrintTitle } = usePrintTitle();
  useEffect(() => {
    const y = new Date().getFullYear();
    setPrintTitle(`AJW 클레임 관리 현황 — ${y}년`);
  }, [setPrintTitle]);

  if (loading || supplierLoading) return <div className="loading">⏳ 불러오는 중...</div>;

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

  const sTotal    = supplierClaims.length;
  const sActive   = supplierClaims.filter(c => c.current_stage !== '종결').length;
  const sClosed   = supplierClaims.filter(c => c.current_stage === '종결').length;
  const sNewThis  = supplierClaims.filter(c => (c.receipt_date || c.created_at || '').slice(0, 7) === thisMonth).length;
  const sStageCounts = Object.fromEntries(SUPPLIER_STAGES.map(s => [s, supplierClaims.filter(c => c.current_stage === s).length]));

  const recent = [...claims]
    .sort((a, b) => (b.receipt_date || b.created_at || '') > (a.receipt_date || a.created_at || '') ? 1 : -1)
    .slice(0, 8);

  const sorted = (list) => [...list].sort(
    (a, b) => (b.receipt_date || b.created_at || '') > (a.receipt_date || a.created_at || '') ? 1 : -1
  );

  const openModal = (label, icon, color, items, navPrefix = '/claims') => setModal({ label, icon, color, items: sorted(items), navPrefix });

  const kpiCards = [
    {
      label: '전체 클레임', value: total, sub: '누적 건',
      color: '#1e293b', bg: '#f8fafc', border: '#e2e8f0', icon: '📋',
      items: claims,
    },
    {
      label: '처리 중', value: active, sub: '진행 중인 클레임',
      color: '#b45309', bg: '#fffbeb', border: '#fde68a', icon: '⏳',
      items: claims.filter(c => c.current_stage !== '종결'),
    },
    {
      label: '종결 완료', value: closed, sub: '처리 완료',
      color: '#065f46', bg: '#ecfdf5', border: '#6ee7b7', icon: '✅',
      items: claims.filter(c => c.current_stage === '종결'),
    },
    {
      label: '이번 달 신규', value: newThis, sub: thisMonth + ' 기준',
      color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd', icon: '🆕',
      items: claims.filter(c => (c.receipt_date || c.created_at || '').slice(0, 7) === thisMonth),
    },
  ];

  const supplierKpiCards = [
    { label: '전체 불량', value: sTotal, sub: '누적 건', color: '#1e293b', bg: '#f8fafc', border: '#e2e8f0', icon: '🏭', items: supplierClaims },
    { label: '처리 중', value: sActive, sub: '진행 중', color: '#b45309', bg: '#fffbeb', border: '#fde68a', icon: '⏳', items: supplierClaims.filter(c => c.current_stage !== '종결') },
    { label: '종결 완료', value: sClosed, sub: '처리 완료', color: '#065f46', bg: '#ecfdf5', border: '#6ee7b7', icon: '✅', items: supplierClaims.filter(c => c.current_stage === '종결') },
    { label: '이번 달 신규', value: sNewThis, sub: thisMonth + ' 기준', color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd', icon: '🆕', items: supplierClaims.filter(c => (c.receipt_date || c.created_at || '').slice(0, 7) === thisMonth) },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">대시보드</div>
          <div className="page-sub">{showSupplier ? '고객사 클레임 + 공급사 불량 현황' : '고객사 클레임 전체 현황'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => window.open('/manual', '_blank')}
            style={{ fontSize: 12, color: '#64748b', border: '1px solid #e2e8f0' }}
            title="사용 매뉴얼 보기"
          >
            📖 사용 매뉴얼
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/claims/new')}>➕ 클레임 접수</button>
          {showSupplier && (
            <button className="btn btn-sm" onClick={() => navigate('/supplier-claims/new')}
              style={{ background: '#6d28d9', color: '#fff', border: 'none' }}>
              ➕ 공급사 불량 접수
            </button>
          )}
        </div>
      </div>

      {/* 탭 (공급사 볼 수 있는 경우만) */}
      {showSupplier && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[{ id: 'customer', label: '📋 고객사 클레임', count: total }, { id: 'supplier', label: '🏭 공급사 불량', count: sTotal }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', border: '2px solid',
                background: activeTab === tab.id ? '#1e293b' : '#fff',
                color: activeTab === tab.id ? '#fff' : '#64748b',
                borderColor: activeTab === tab.id ? '#1e293b' : '#e2e8f0',
                fontFamily: 'inherit',
              }}>
              {tab.label} <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 4 }}>({tab.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* ── 고객사 클레임 탭 ── */}
      {(!showSupplier || activeTab === 'customer') && <>

      {/* Summary KPIs */}
      <div className="kpi-grid-4">
        {kpiCards.map(item => (
          <div
            key={item.label}
            className="kpi-card"
            onClick={() => openModal(item.label, item.icon, item.color, item.items, '/claims')}
            style={{
              cursor: 'pointer', transition: '.15s',
              background: item.bg,
              borderColor: item.border,
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div className="kpi-label" style={{ marginBottom: 0 }}>{item.label}</div>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
            </div>
            <div className="kpi-value" style={{ color: item.color }}>{item.value}</div>
            <div className="kpi-sub">{item.sub}</div>
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
              style={{
                borderColor: sc.dot, cursor: 'pointer', transition: '.15s',
                background: sc.bg,
              }}
              onClick={() => openModal(stage, STAGE_ICONS[i], sc.dot, claims.filter(c => c.current_stage === stage), '/claims')}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 14px ${sc.dot}30`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
            >
              <div className="kpi-label" style={{ color: sc.dot, marginBottom: 6 }}>{STAGE_ICONS[i]} {stage}</div>
              <div className="kpi-value" style={{ color: sc.dot, fontSize: 24 }}>{stageCounts[stage]}</div>
              <div className="kpi-sub">건</div>
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

      </> /* end customer tab */}

      {/* ── 공급사 불량 탭 ── */}
      {showSupplier && activeTab === 'supplier' && <>

        <div className="kpi-grid-4" style={{ marginBottom: 0 }}>
          {supplierKpiCards.map(item => (
            <div key={item.label} className="kpi-card"
              onClick={() => openModal(item.label, item.icon, item.color, item.items, '/supplier-claims')}
              style={{ cursor: 'pointer', transition: '.15s', background: item.bg, borderColor: item.border }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div className="kpi-label" style={{ marginBottom: 0 }}>{item.label}</div>
                <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
              </div>
              <div className="kpi-value" style={{ color: item.color }}>{item.value}</div>
              <div className="kpi-sub">{item.sub}</div>
            </div>
          ))}
        </div>

        <div className="kpi-grid" style={{ marginBottom: 24 }}>
          {SUPPLIER_STAGES.map((stage, i) => {
            const sc = SUPPLIER_STAGE_COLORS[stage];
            return (
              <div key={stage} className="kpi-card"
                style={{ borderColor: sc.dot, cursor: 'pointer', transition: '.15s', background: sc.bg }}
                onClick={() => openModal(stage, SUPPLIER_STAGE_ICONS[i], sc.dot, supplierClaims.filter(c => c.current_stage === stage), '/supplier-claims')}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 14px ${sc.dot}30`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
              >
                <div className="kpi-label" style={{ color: sc.dot, marginBottom: 6 }}>{SUPPLIER_STAGE_ICONS[i]} {stage}</div>
                <div className="kpi-value" style={{ color: sc.dot, fontSize: 24 }}>{sStageCounts[stage]}</div>
                <div className="kpi-sub">건</div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ margin: 0 }}>최근 공급사 불량</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/supplier-claims')}>전체 보기 →</button>
          </div>
          {supplierClaims.length === 0 ? (
            <div className="empty"><div className="empty-icon">🏭</div>등록된 공급사 불량이 없습니다</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>접수일</th><th>공급사</th><th>품번</th><th>품명</th>
                    <th>불량 유형</th><th>현재 단계</th><th>담당자</th>
                  </tr>
                </thead>
                <tbody>
                  {[...supplierClaims]
                    .sort((a, b) => (b.receipt_date || b.created_at || '') > (a.receipt_date || a.created_at || '') ? 1 : -1)
                    .slice(0, 8)
                    .map(c => (
                      <tr key={c.id} className="clickable" onClick={() => navigate(`/supplier-claims/${c.id}`)}>
                        <td style={{ whiteSpace: 'nowrap' }}>{c.receipt_date || '-'}</td>
                        <td><strong>{c.supplier_name}</strong></td>
                        <td className="mono">{c.part_number || '-'}</td>
                        <td>{c.part_name || '-'}</td>
                        <td>{c.defect_type
                          ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#fee2e2', color: '#991b1b', fontWeight: 600 }}>{c.defect_type}</span>
                          : '-'}</td>
                        <td>
                          <span style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600,
                            background: SUPPLIER_STAGE_COLORS[c.current_stage]?.bg || '#f1f5f9',
                            color: SUPPLIER_STAGE_COLORS[c.current_stage]?.text || '#475569',
                          }}>{c.current_stage}</span>
                        </td>
                        <td>{c.handler_name || '-'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </> /* end supplier tab */}

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
                    onClick={() => { navigate(`${modal.navPrefix}/${c.id}`); setModal(null); }}
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
                          <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                            {c.customer_name || c.supplier_name}
                          </span>
                          <StageBadge stage={c.current_stage} size="sm" />
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                          {c.receipt_date ? `접수일: ${c.receipt_date}` : ''}
                          {c.part_number ? ` · 품번: ${c.part_number}` : ''}
                          {c.part_name ? ` · ${c.part_name}` : ''}
                          {c.sales_rep_name ? ` · 영업: ${c.sales_rep_name}` : ''}
                          {c.handler_name ? ` · 담당: ${c.handler_name}` : ''}
                          {c.defect_type ? ` · ${c.defect_type}` : ''}
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
                    const prefix = modal.navPrefix || '/claims';
                    const allStages = prefix === '/supplier-claims' ? SUPPLIER_STAGES : STAGES;
                    const stage = allStages.find(s => s === modal.label);
                    if (stage) navigate(`${prefix}?stage=` + encodeURIComponent(stage));
                    else navigate(prefix);
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
