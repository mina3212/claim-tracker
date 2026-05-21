import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useClaims } from '../context/ClaimsContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { deleteClaim, STAGES } from '../lib/supabase';
import StageBadge from '../components/StageBadge';

export default function ClaimList() {
  const { claims, loading, removeClaim } = useClaims();
  const { user, isAdmin } = useAuth();
  const toast    = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch]       = useState('');
  const stageFilter   = searchParams.get('stage') || 'all';
  const customerFilter = searchParams.get('customer') || 'all';

  const setStageFilter   = (v) => setSearchParams(prev => { const p = new URLSearchParams(prev); v === 'all' ? p.delete('stage') : p.set('stage', v); return p; });
  const setCustomerFilter = (v) => setSearchParams(prev => { const p = new URLSearchParams(prev); v === 'all' ? p.delete('customer') : p.set('customer', v); return p; });

  const customers = useMemo(() => [...new Set(claims.map(c => c.customer_name).filter(Boolean))].sort(), [claims]);

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

  if (loading) return <div className="loading">⏳ 불러오는 중...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">클레임 목록</div>
          <div className="page-sub">총 {claims.length}건 · 검색결과 {filtered.length}건</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/claims/new')}>➕ 클레임 접수</button>
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
                  <th>현재 단계</th>
                  <th>영업담당</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="clickable" onClick={() => navigate(`/claims/${c.id}`)}>
                    <td style={{ whiteSpace: 'nowrap' }}>{c.receipt_date || '-'}</td>
                    <td><strong>{c.customer_name}</strong></td>
                    <td className="mono">{c.part_number || '-'}</td>
                    <td>{c.part_name || '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {c.quantity != null ? Number(c.quantity).toLocaleString() : '-'}
                    </td>
                    <td className="mono">{c.lot_number || '-'}</td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={c.defect_description}>
                      {c.defect_description || '-'}
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
