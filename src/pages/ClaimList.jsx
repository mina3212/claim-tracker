import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useClaims } from '../context/ClaimsContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { deleteClaim, insertDeleteRequest, STAGES } from '../lib/supabase';
import StageBadge from '../components/StageBadge';
import DeleteRequestModal from '../components/DeleteRequestModal';
import { usePrintTitle } from '../context/PrintContext';

export default function ClaimList() {
  const { claims, loading, stages, removeClaim, deleteRequests, addDeleteRequest } = useClaims();
  const { user, isAdmin } = useAuth();
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

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return claims
      .filter(c => {
        if (stageFilter !== 'all' && c.current_stage !== stageFilter) return false;
        if (customerFilter !== 'all' && c.customer_name !== customerFilter) return false;
        if (q) {
          const s = `${c.customer_name} ${c.part_number} ${c.part_name} ${c.lot_number} ${c.defect_description}`.toLowerCase();
          if (!s.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.receipt_date || b.created_at || '') > (a.receipt_date || a.created_at || '') ? 1 : -1);
  }, [claims, search, stageFilter, customerFilter]);

  const pendingIds = useMemo(() =>
    new Set(deleteRequests.map(r => r.claim_id)),
    [deleteRequests]
  );

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
          <div className="page-sub">총 {claims.length}건 · 검색결과 {filtered.length}건</div>
        </div>
        {user && <button className="btn btn-primary" onClick={() => navigate('/claims/new')}>➕ 클레임 접수</button>}
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
            <table>
              <thead>
                <tr>
                  <th>접수일</th>
                  <th>고객사</th>
                  <th>품번</th>
                  <th>품명</th>
                  <th>수량</th>
                  <th>LOT</th>
                  <th>불량내용</th>
                  <th>불량원인</th>
                  <th>현재 단계</th>
                  <th>영업담당</th>
                  {user && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="clickable" onClick={() => navigate(`/claims/${c.id}`)}>
                    <td style={{ whiteSpace: 'nowrap' }}>{c.receipt_date || '-'}</td>
                    <td>
                      <strong>{c.customer_name}</strong>
                      {isAdmin && pendingIds.has(c.id) && (
                        <span title="삭제 요청 대기중" style={{ marginLeft: 6, fontSize: 11, color: '#f59e0b' }}>⚠️</span>
                      )}
                    </td>
                    <td className="mono">{c.part_number || '-'}</td>
                    <td>{c.part_name || '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {c.quantity != null ? Number(c.quantity).toLocaleString() : '-'}
                    </td>
                    <td className="mono">{c.lot_number || '-'}</td>
                    <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={c.defect_description}>
                      {c.defect_description || '-'}
                    </td>
                    <td style={{ minWidth: 80 }}>
                      {(causeMap[c.id] || []).map(cause => {
                        const col = CAUSE_COLORS[cause] || CAUSE_COLORS['기타'];
                        return (
                          <span key={cause} style={{ display: 'inline-block', fontSize: 10, padding: '1px 6px', borderRadius: 99, background: col.bg, color: col.text, fontWeight: 600, marginRight: 3, marginBottom: 2, whiteSpace: 'nowrap' }}>
                            {cause}
                          </span>
                        );
                      })}
                    </td>
                    <td><StageBadge stage={c.current_stage} size="sm" /></td>
                    <td>{c.sales_rep_name || '-'}</td>
                    {isAdmin && (
                      <td onClick={e => e.stopPropagation()}>
                        <button
                          className="btn btn-danger btn-icon btn-sm"
                          title="삭제"
                          onClick={e => handleDelete(e, c.id, c.customer_name)}
                        >🗑</button>
                      </td>
                    )}
                    {user && !isAdmin && (
                      <td onClick={e => e.stopPropagation()}>
                        <button
                          className="btn btn-sm"
                          title="삭제 요청"
                          onClick={e => openDeleteRequest(e, c.id, c.customer_name)}
                          style={{ fontSize: 11, color: '#c2410c', background: '#fff7ed', border: '1px solid #fed7aa', whiteSpace: 'nowrap' }}
                        >
                          삭제요청
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
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
