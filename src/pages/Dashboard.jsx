import { useNavigate } from 'react-router-dom';
import { useClaims } from '../context/ClaimsContext';
import StageBadge from '../components/StageBadge';
import { STAGES, STAGE_COLORS, STAGE_ICONS } from '../lib/supabase';

export default function Dashboard() {
  const { claims, loading, dbReady } = useClaims();
  const navigate = useNavigate();

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

  const total    = claims.length;
  const active   = claims.filter(c => c.current_stage !== '종결').length;
  const closed   = claims.filter(c => c.current_stage === '종결').length;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const newThis   = claims.filter(c => (c.receipt_date || c.created_at || '').slice(0, 7) === thisMonth).length;

  const stageCounts = Object.fromEntries(STAGES.map(s => [s, claims.filter(c => c.current_stage === s).length]));

  const recent = [...claims]
    .sort((a, b) => (b.receipt_date || b.created_at || '') > (a.receipt_date || a.created_at || '') ? 1 : -1)
    .slice(0, 8);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">대시보드</div>
          <div className="page-sub">고객사 클레임 전체 현황</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/claims/new')}>
          ➕ 클레임 접수
        </button>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: '전체 클레임', value: total, sub: '누적 건', color: '#0f172a' },
          { label: '처리 중', value: active, sub: '진행 중인 클레임', color: '#f59e0b' },
          { label: '종결 완료', value: closed, sub: '처리 완료', color: '#10b981' },
          { label: '이번 달 신규', value: newThis, sub: thisMonth + ' 기준', color: '#3b82f6' },
        ].map(item => (
          <div key={item.label} className="kpi-card">
            <div className="kpi-label">{item.label}</div>
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
              style={{ borderColor: 'transparent' }}
              onClick={() => navigate('/claims?stage=' + encodeURIComponent(stage))}
              onMouseEnter={e => e.currentTarget.style.borderColor = sc.dot}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
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
    </div>
  );
}
