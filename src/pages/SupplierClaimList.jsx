import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSupplierClaims } from '../context/SupplierClaimsContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { deleteSupplierClaim, DISPOSITION_COLORS, IMPROVEMENT_STATUS_COLORS } from '../lib/supabase';
import { exportToExcel } from '../lib/exportExcel';
import { usePrintTitle } from '../context/PrintContext';

export default function SupplierClaimList() {
  const { claims, loading, removeClaim, fileClaimIds } = useSupplierClaims();
  const { isAdmin } = useAuth();
  const toast    = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const dispositionFilter   = searchParams.get('disposition')    || 'all';
  const supplierFilter      = searchParams.get('supplier')       || 'all';
  const improvementFilter   = searchParams.get('improvement')    || 'all';

  const { setPrintTitle } = usePrintTitle();
  useEffect(() => {
    const y = new Date().getFullYear();
    const dp = dispositionFilter !== 'all' ? ` — ${dispositionFilter}` : '';
    const sp = supplierFilter    !== 'all' ? ` (${supplierFilter})`    : '';
    setPrintTitle(`AJW 공급사 불량 목록 ${y}${dp}${sp}`);
  }, [dispositionFilter, supplierFilter, setPrintTitle]);

  const setDispositionFilter  = (v) => setSearchParams(prev => { const p = new URLSearchParams(prev); v === 'all' ? p.delete('disposition') : p.set('disposition', v); return p; });
  const setSupplierFilter     = (v) => setSearchParams(prev => { const p = new URLSearchParams(prev); v === 'all' ? p.delete('supplier')    : p.set('supplier', v);    return p; });
  const setImprovementFilter  = (v) => setSearchParams(prev => { const p = new URLSearchParams(prev); v === 'all' ? p.delete('improvement') : p.set('improvement', v); return p; });

  const suppliers = useMemo(() => [...new Set(claims.map(c => c.supplier_name).filter(Boolean))].sort(), [claims]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return claims
      .filter(c => {
        const disp = c.disposition || '미결';
        if (dispositionFilter  !== 'all' && disp !== dispositionFilter) return false;
        if (supplierFilter     !== 'all' && c.supplier_name !== supplierFilter) return false;
        if (improvementFilter  !== 'all' && (c.improvement_status || '미조치') !== improvementFilter) return false;
        if (q) {
          const s = `${c.supplier_name} ${c.part_number} ${c.part_name} ${c.lot_number} ${c.defect_description} ${c.defect_type} ${c.incoming_lot_no}`.toLowerCase();
          if (!s.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.incoming_date || b.created_at || '') > (a.incoming_date || a.created_at || '') ? 1 : -1);
  }, [claims, search, dispositionFilter, supplierFilter]);

  const handleExport = () => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rows = filtered.map(c => {
      const denom   = c.inspection_quantity ?? c.quantity;
      const defRate = denom > 0 && c.defect_quantity != null
        ? ((c.defect_quantity / denom) * 100).toFixed(1) : '';
      return {
        '입고일':       c.incoming_date              || '',
        '입고차수':     c.incoming_lot_no             || '',
        '공급사':       c.supplier_name               || '',
        '구매경로':     c.purchase_dept               || '',
        '품번':         c.part_number                 || '',
        '품명':         c.part_name                   || '',
        '품목군':       c.product_category            || '',
        '검사단계':     c.inspection_stage            || '',
        '불량유형':     c.defect_type                 || '',
        '불량내용':     c.defect_description          || '',
        '입고수량':     c.quantity                    ?? '',
        '검사수량':     c.inspection_quantity         ?? '',
        '불량수량':     c.defect_quantity             ?? '',
        '불량률(%)':    defRate,
        '처리결과':     c.disposition                 || '미결',
        '시정조치상태': c.improvement_status          || '미조치',
        '조치유형':     c.corrective_action_type      || '',
        '조치내용':     c.corrective_action_detail    || '',
        '비고':         c.notes                       || '',
      };
    });
    exportToExcel(rows, `AJW_공급사불량목록_${today}.xlsx`, '공급사불량');
  };

  const handleDelete = async (e, id, supplierName) => {
    e.stopPropagation();
    if (!confirm(`"${supplierName}" 불량 이력을 삭제하시겠습니까?\n관련 이력도 모두 삭제됩니다.`)) return;
    try {
      await deleteSupplierClaim(id);
      removeClaim(id);
      toast('삭제 완료', '불량 이력이 삭제되었습니다', 'success');
    } catch (err) {
      toast('삭제 실패', err.message, 'error');
    }
  };

  const DISPOSITION_OPTIONS = ['미결', '사용승인', '반품(대체품)', '폐기', '재작업', '선별작업'];

  if (loading) return <div className="loading">⏳ 불러오는 중...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">공급사 불량 이력</div>
          <div className="page-sub">총 {claims.length}건 · 현재 {filtered.length}건 표시</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={handleExport} disabled={filtered.length === 0}>📥 엑셀 저장</button>
          <button className="btn btn-primary" onClick={() => navigate('/supplier-claims/new')}>➕ 불량 접수</button>
        </div>
      </div>

      {/* 필터 */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="search-input"
            placeholder="🔍 공급사명, 품번, 품명, LOT, 차수 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: '1 1 220px', minWidth: 180 }}
          />
          <select
            value={dispositionFilter}
            onChange={e => setDispositionFilter(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff', color: '#374151' }}
          >
            <option value="all">전체 처리결과</option>
            {DISPOSITION_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={supplierFilter}
            onChange={e => setSupplierFilter(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff', color: '#374151' }}
          >
            <option value="all">전체 공급사</option>
            {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={improvementFilter}
            onChange={e => setImprovementFilter(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff', color: '#374151' }}
          >
            <option value="all">전체 시정조치</option>
            {['미조치', '진행중', '완료'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {(dispositionFilter !== 'all' || supplierFilter !== 'all' || improvementFilter !== 'all' || search) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setDispositionFilter('all'); setSupplierFilter('all'); setImprovementFilter('all'); setSearch(''); }}>✕ 초기화</button>
          )}
        </div>
      </div>

      {/* 목록 테이블 */}
      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🏭</div>
            {search || dispositionFilter !== 'all' || supplierFilter !== 'all'
              ? '검색 결과가 없습니다'
              : '등록된 공급사 불량 이력이 없습니다'}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>입고일</th>
                  <th>공급사</th>
                  <th>구매경로</th>
                  <th>품번</th>
                  <th>품명</th>
                  <th>검사단계</th>
                  <th>불량 유형</th>
                  <th style={{ textAlign: 'right' }}>불량/입고</th>
                  <th>처리결과</th>
                  <th>시정조치</th>
                  <th style={{ textAlign: 'center' }}>📎</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const disp = c.disposition || '미결';
                  const dc   = DISPOSITION_COLORS[disp] || DISPOSITION_COLORS['미결'];
                  const denom   = c.inspection_quantity ?? c.quantity;
                  const defRate = denom > 0 && c.defect_quantity != null
                    ? ((c.defect_quantity / denom) * 100).toFixed(1) : null;
                  return (
                    <tr key={c.id} className="clickable" onClick={() => navigate(`/supplier-claims/${c.id}`)}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div>{c.incoming_date || '-'}</div>
                        {c.incoming_lot_no && <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.incoming_lot_no}</div>}
                      </td>
                      <td><strong>{c.supplier_name}</strong></td>
                      <td style={{ fontSize: 12, color: '#64748b' }}>{c.purchase_dept || '-'}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{c.part_number || '-'}</td>
                      <td style={{ fontSize: 13 }}>{c.part_name || '-'}</td>
                      <td>
                        {c.inspection_stage ? (
                          <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 6, background: '#ccfbf1', color: '#0f766e', fontWeight: 600, whiteSpace: 'nowrap' }}>{c.inspection_stage}</span>
                        ) : '-'}
                      </td>
                      <td>
                        {c.defect_type ? (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#fee2e2', color: '#991b1b', fontWeight: 600 }}>{c.defect_type}</span>
                        ) : '-'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {c.defect_quantity != null ? (
                          <span>
                            <span style={{ color: '#dc2626', fontWeight: 700 }}>{c.defect_quantity.toLocaleString()}</span>
                            <span style={{ color: '#94a3b8', fontSize: 11 }}> / {(c.quantity || 0).toLocaleString()}</span>
                            {defRate !== null && <div style={{ fontSize: 10, color: parseFloat(defRate) > 5 ? '#dc2626' : '#059669', fontWeight: 700 }}>{defRate}%</div>}
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: dc.bg, color: dc.text, fontWeight: 600, whiteSpace: 'nowrap' }}>{disp}</span>
                      </td>
                      <td>
                        {(() => {
                          const st = c.improvement_status || '미조치';
                          const ic = IMPROVEMENT_STATUS_COLORS[st] || IMPROVEMENT_STATUS_COLORS['미조치'];
                          return (
                            <div>
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: ic.bg, color: ic.text, fontWeight: 600, whiteSpace: 'nowrap' }}>{st}</span>
                              {c.corrective_action_type && (
                                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, whiteSpace: 'nowrap' }}>{c.corrective_action_type}</div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {fileClaimIds?.has(c.id) && (
                          <span title="첨부파일 있음" style={{ fontSize: 14 }}>📎</span>
                        )}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        {isAdmin && (
                          <button className="btn btn-sm" onClick={(e) => handleDelete(e, c.id, c.supplier_name)}
                            style={{ background: '#fee2e2', color: '#dc2626', border: 'none', fontSize: 11, padding: '3px 8px' }}>삭제</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
