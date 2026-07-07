import { useState, useMemo, useEffect } from 'react';

const DOT_STYLE = {
  new:      { color: '#ef4444', pulse: true,  title: '신규 접수' },
  progress: { color: '#f59e0b', pulse: false, title: '진행중' },
  done:     { color: '#10b981', pulse: false, title: '종결' },
};

function StatusDot({ status }) {
  const d = DOT_STYLE[status] || DOT_STYLE.progress;
  return (
    <>
      <style>{`
        @keyframes dot-pulse {
          0%, 100% { transform: scale(1);   opacity: 1; }
          50%       { transform: scale(1.7); opacity: .5; }
        }
      `}</style>
      <span title={d.title} style={{
        display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
        background: d.color,
        animation: d.pulse ? 'dot-pulse 1.4s ease-in-out infinite' : 'none',
        flexShrink: 0,
      }} />
    </>
  );
}
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useClaims } from '../context/ClaimsContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { deleteClaim, insertDeleteRequest, STAGES } from '../lib/supabase';
import { exportToExcel } from '../lib/exportExcel';
import StageBadge from '../components/StageBadge';
import DeleteRequestModal from '../components/DeleteRequestModal';
import { usePrintTitle } from '../context/PrintContext';

export default function ClaimList() {
  const { claims, loading, stages, removeClaim, deleteRequests, addDeleteRequest } = useClaims();
  const { user, isAdmin, department } = useAuth();
  const toast    = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch]                 = useState('');
  const [deleteReqTarget, setDeleteReqTarget] = useState(null);
  const stageFilter    = searchParams.get('stage') || 'all';
  const customerFilter = searchParams.get('customer') || 'all';

  const { setPrintTitle } = usePrintTitle();
  useEffect(() => {
    const y = new Date().getFullYear();
    const stagePart    = stageFilter !== 'all'    ? ` — ${stageFilter} 단계` : '';
    const customerPart = customerFilter !== 'all' ? ` (${customerFilter})` : '';
    setPrintTitle(`AJW 클레임 목록 ${y}${stagePart}${customerPart}`);
  }, [stageFilter, customerFilter, setPrintTitle]);

  const setStageFilter    = (v) => setSearchParams(prev => { const p = new URLSearchParams(prev); v === 'all' ? p.delete('stage') : p.set('stage', v); return p; });
  const setCustomerFilter = (v) => setSearchParams(prev => { const p = new URLSearchParams(prev); v === 'all' ? p.delete('customer') : p.set('customer', v); return p; });

  const customers = useMemo(() => [...new Set(claims.map(c => c.customer_name).filter(Boolean))].sort(), [claims]);

  const causeMap = useMemo(() => {
    const map = {};
    (stages || []).forEach(s => {
      if (s.stage_name !== '회수품 원인분석') return;
      const match = (s.description || '').match(/\[원인\]\s*(.+)/);
      if (match) map[s.claim_id] = match[1].split(',').map(c => c.trim()).filter(Boolean);
    });
    return map;
  }, [stages]);

  const CAUSE_COLORS = {
    '사용자 과실': { bg: '#fef3c7', text: '#92400e' },
    '생산공정':   { bg: '#ede9fe', text: '#5b21b6' },
    '제품불량':   { bg: '#fee2e2', text: '#991b1b' },
    '구조불량':   { bg: '#fce7f3', text: '#9d174d' },
    '배송오류':   { bg: '#dbeafe', text: '#1e40af' },
    '기타':       { bg: '#f1f5f9', text: '#475569' },
  };

  // 불량증상만 추출 (새 포맷: [불량증상]\n... / 구형: 그대로)
  const extractSymptom = (desc) => {
    if (!desc) return '';
    if (desc.includes('[불량증상]')) {
      const m = desc.match(/\[불량증상\]\n([\s\S]*?)(?=\n\n\[|$)/);
      return m ? m[1].trim() : desc;
    }
    return desc;
  };

  // 기타(상세내용) → 기타
  const displayCause = (cause) => cause.startsWith('기타') ? '기타' : cause;

  // 부서별 접근 범위: 마케팅팀 = 해외만 / 영업·영업관리 = 해외 제외 / 나머지(품질기술팀·관리자) = 전체
  const deptFilter = useMemo(() => {
    if (isAdmin || department === '품질기술팀') return 'all';
    if (department === '마케팅팀') return 'overseas';
    if (department === '영업팀' || department === '영업관리팀') return 'domestic';
    return 'all';
  }, [isAdmin, department]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return claims
      .filter(c => {
        if (deptFilter === 'overseas' && c.customer_group !== '해외고객사') return false;
        if (deptFilter === 'domestic' && c.customer_group === '해외고객사') return false;
        if (stageFilter !== 'all' && c.current_stage !== stageFilter) return false;
        if (customerFilter !== 'all' && c.customer_name !== customerFilter) return false;
        if (q) {
          const s = `${c.customer_name} ${c.part_number} ${c.part_name} ${c.lot_number} ${c.defect_description}`.toLowerCase();
          if (!s.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.receipt_date || b.created_at || '') > (a.receipt_date || a.created_at || '') ? 1 : -1);
  }, [claims, search, stageFilter, customerFilter, deptFilter]);

  const pendingIds = useMemo(() =>
    new Set(deleteRequests.map(r => r.claim_id)),
    [deleteRequests]
  );

  const handleExport = () => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rows = filtered.map(c => {
      const defRate = c.quantity > 0 && c.defect_quantity != null
        ? ((c.defect_quantity / c.quantity) * 100).toFixed(1) : '';
      return {
        '접수일':     c.receipt_date      || '',
        '발생일':     c.occurrence_date   || '',
        '고객사그룹': c.customer_group    || '',
        '고객사명':   c.customer_name     || '',
        '품번':       c.part_number       || '',
        '품명':       c.part_name         || '',
        'LOT번호':    c.lot_number        || '',
        '출고수량':   c.quantity          ?? '',
        '불량수량':   c.defect_quantity   ?? '',
        '불량률(%)':  defRate,
        '불량내용':   c.defect_description || '',
        '불량원인':   (causeMap[c.id] || []).join(', '),
        '현재단계':   c.current_stage     || '',
        '영업담당부서': c.sales_rep_dept  || '',
        '영업담당자': c.sales_rep_name    || '',
      };
    });
    exportToExcel(rows, `AJW_클레임목록_${today}.xlsx`, '클레임목록');
  };

  const handleDelete = async (e, id, customerName) => {
    e.stopPropagation();
    if (!confirm(`"${customerName}" 클레임을 삭제하시겠습니까?\n처리 이력도 모두 삭제됩니다.`)) return;
    try {
      await deleteClaim(id);
      removeClaim(id);
      toast('삭제 완료', '클레임이 삭제되었습니다', 'success');
    } catch (err) {
      toast('삭제 실패', err.message, 'error');
    }
  };

  const openDeleteRequest = (e, id, name) => {
    e.stopPropagation();
    setDeleteReqTarget({ id, name });
  };

  const handleSubmitRequest = async (reason) => {
    const req = await insertDeleteRequest(deleteReqTarget.id, reason, user);
    addDeleteRequest(req);
    toast('삭제 요청 완료', '관리자에게 삭제 요청이 전달되었습니다', 'success');
    setDeleteReqTarget(null);
  };

  if (loading) return <div className="loading">⏳ 불러오는 중...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">클레임 목록</div>
          <div className="page-sub">
            검색결과 {filtered.length}건
            {deptFilter === 'overseas' && <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#dbeafe', color: '#1e40af', fontWeight: 600 }}>해외 접수건만</span>}
            {deptFilter === 'domestic' && <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#dcfce7', color: '#166534', fontWeight: 600 }}>국내 접수건만</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={handleExport} disabled={filtered.length === 0}>📥 엑셀 저장</button>
          {user && <button className="btn btn-primary" onClick={() => navigate('/claims/new')}>➕ 클레임 접수</button>}
        </div>
      </div>

      <div className="filter-bar">
        <input
          className="filter-input"
          placeholder="🔍 고객사 / 품번 / 불량내용 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="filter-select" value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
          <option value="all">전체 단계</option>
          {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="filter-select" value={customerFilter} onChange={e => setCustomerFilter(e.target.value)}>
          <option value="all">전체 고객사</option>
          {customers.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(stageFilter !== 'all' || customerFilter !== 'all' || search) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setSearchParams({}); }}>
            ✕ 필터 초기화
          </button>
        )}
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📋</div>
            조건에 맞는 클레임이 없습니다
          </div>
        ) : (
          <div className="table-wrap">
            <table style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 24, padding: '8px 4px' }}></th>
                  <th style={{ width: 82, whiteSpace: 'nowrap' }}>접수일</th>
                  <th style={{ width: 110 }}>고객사</th>
                  <th style={{ width: 100 }}>품번</th>
                  <th style={{ width: 130 }}>품명</th>
                  <th>불량내용</th>
                  <th style={{ width: 110 }}>불량원인</th>
                  <th style={{ width: 88, whiteSpace: 'nowrap' }}>현재단계</th>
                  <th style={{ width: 68, whiteSpace: 'nowrap' }}>담당자</th>
                  {user && <th style={{ width: 44 }}></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const stage = c.current_stage;
                  const dotStatus = stage === '종결' ? 'done'
                    : (stage === '접수' || stage === '1차 대응') ? 'new' : 'progress';
                  const symptom = extractSymptom(c.defect_description);
                  return (
                  <tr key={c.id} className="clickable" onClick={() => navigate(`/claims/${c.id}`)}>
                    <td style={{ textAlign: 'center', padding: '0 4px' }}>
                      <StatusDot status={dotStatus} />
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 11, color: '#64748b' }}>{c.receipt_date || '-'}</td>
                    <td style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <strong style={{ fontSize: 12 }}>{c.customer_name}</strong>
                      {isAdmin && pendingIds.has(c.id) && (
                        <span title="삭제 요청 대기중" style={{ marginLeft: 4, fontSize: 11, color: '#f59e0b' }}>⚠️</span>
                      )}
                    </td>
                    <td className="mono" style={{ fontSize: 11, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={c.part_number}>{c.part_number || '-'}</td>
                    <td style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}
                        title={c.part_name}>{c.part_name || '-'}</td>
                    <td style={{ maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={symptom}>
                      <span style={{ fontSize: 12, color: '#374151' }}>{symptom || '-'}</span>
                    </td>
                    <td style={{ minWidth: 0 }}>
                      {(causeMap[c.id] || []).map(cause => {
                        const key = displayCause(cause);
                        const col = CAUSE_COLORS[key] || CAUSE_COLORS['기타'];
                        return (
                          <span key={cause} style={{ display: 'inline-block', fontSize: 10, padding: '1px 5px', borderRadius: 99, background: col.bg, color: col.text, fontWeight: 600, marginRight: 2, marginBottom: 2, whiteSpace: 'nowrap' }}>
                            {key}
                          </span>
                        );
                      })}
                    </td>
                    <td><StageBadge stage={c.current_stage} size="sm" /></td>
                    <td style={{ fontSize: 11, whiteSpace: 'nowrap', color: '#475569' }}>{c.sales_rep_name || '-'}</td>
                    {isAdmin && (
                      <td onClick={e => e.stopPropagation()} style={{ padding: '0 4px' }}>
                        <button
                          className="btn btn-danger btn-icon btn-sm"
                          title="삭제"
                          onClick={e => handleDelete(e, c.id, c.customer_name)}
                        >🗑</button>
                      </td>
                    )}
                    {user && !isAdmin && (
                      <td onClick={e => e.stopPropagation()} style={{ padding: '0 4px' }}>
                        <button
                          className="btn btn-sm"
                          title="삭제 요청"
                          onClick={e => openDeleteRequest(e, c.id, c.customer_name)}
                          style={{ fontSize: 10, color: '#c2410c', background: '#fff7ed', border: '1px solid #fed7aa', whiteSpace: 'nowrap', padding: '3px 6px' }}
                        >
                          삭제요청
                        </button>
                      </td>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteReqTarget && (
        <DeleteRequestModal
          claimName={deleteReqTarget.name}
          onClose={() => setDeleteReqTarget(null)}
          onSubmit={handleSubmitRequest}
        />
      )}
    </div>
  );
}
