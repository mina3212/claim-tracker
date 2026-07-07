import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSupplierClaims } from '../context/SupplierClaimsContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { deleteSupplierClaim, DISPOSITION_COLORS, IMPROVEMENT_STATUS_COLORS, INSPECTION_STAGES } from '../lib/supabase';
import { exportToExcel } from '../lib/exportExcel';
import { usePrintTitle } from '../context/PrintContext';

const STAGE_BTN_COLORS = {
  '부품 수입검사':   { active: '#1e40af', bg: '#dbeafe', text: '#1e40af' },
  '완제품 입고검사': { active: '#065f46', bg: '#d1fae5', text: '#065f46' },
  '출하검사':        { active: '#7c2d12', bg: '#fed7aa', text: '#7c2d12' },
};

export default function SupplierClaimList() {
  const { claims, loading, removeClaim, fileClaimIds } = useSupplierClaims();
  const { isAdmin } = useAuth();
  const toast    = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const dispositionFilter  = searchParams.get('disposition')  || 'all';
  const supplierFilter     = searchParams.get('supplier')     || 'all';
  const improvementFilter  = searchParams.get('improvement')  || 'all';
  const inspectionFilter   = searchParams.get('inspection')   || 'all';

  const { setPrintTitle } = usePrintTitle();
  useEffect(() => {
    const y  = new Date().getFullYear();
    const dp = dispositionFilter !== 'all' ? ` — ${dispositionFilter}` : '';
    const sp = supplierFilter    !== 'all' ? ` (${supplierFilter})`    : '';
    const ip = inspectionFilter  !== 'all' ? ` [${inspectionFilter}]`  : '';
    setPrintTitle(`AJW 공급사 불량 목록 ${y}${dp}${sp}${ip}`);
  }, [dispositionFilter, supplierFilter, inspectionFilter, setPrintTitle]);

  const setDispositionFilter = (v) => setSearchParams(prev => { const p = new URLSearchParams(prev); v === 'all' ? p.delete('disposition') : p.set('disposition', v); return p; });
  const setSupplierFilter    = (v) => setSearchParams(prev => { const p = new URLSearchParams(prev); v === 'all' ? p.delete('supplier')    : p.set('supplier', v);    return p; });
  const setImprovementFilter = (v) => setSearchParams(prev => { const p = new URLSearchParams(prev); v === 'all' ? p.delete('improvement') : p.set('improvement', v); return p; });
  const setInspectionFilter  = (v) => setSearchParams(prev => { const p = new URLSearchParams(prev); v === 'all' ? p.delete('inspection')  : p.set('inspection', v);  return p; });

  const suppliers = useMemo(() => [...new Set(claims.map(c => c.supplier_name).filter(Boolean))].sort(), [claims]);

  /* 검사단계별 건수 (버튼 뱃지용) */
  const stageCounts = useMemo(() => {
    const map = { all: claims.length };
    INSPECTION_STAGES.forEach(s => { map[s] = claims.filter(c => c.inspection_stage === s).length; });
    return map;
  }, [claims]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return claims
      .filter(c => {
        const disp = c.disposition || '미결';
        if (dispositionFilter  !== 'all' && disp !== dispositionFilter) return false;
        if (supplierFilter     !== 'all' && c.supplier_name !== supplierFilter) return false;
        if (improvementFilter  !== 'all' && (c.improvement_status || '미조치') !== improvementFilter) return false;
        if (inspectionFilter   !== 'all' && (c.inspection_stage   || '')        !== inspectionFilter)  return false;
        if (q) {
          const s = `${c.supplier_name} ${c.part_number} ${c.part_name} ${c.lot_number} ${c.defect_description} ${c.defect_type} ${c.incoming_lot_no}`.toLowerCase();
          if (!s.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.incoming_date || b.created_at || '') > (a.incoming_date || a.created_at || '') ? 1 : -1);
  }, [claims, search, dispositionFilter, supplierFilter, improvementFilter, inspectionFilter]);

  const handleExport = () => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rows = filtered.map(c => {
      const denom   = c.inspection_quantity ?? c.quantity;
      const defRate = denom > 0 && c.defect_quantity != null
        ? ((c.defect_quantity / denom) * 100).toFixed(1) : '';
      return {
        '입고일':       c.incoming_date           || '',
        '입고차수':     c.incoming_lot_no          || '',
        '공급사':       c.supplier_name            || '',
        '구매경로':     c.purchase_dept            || '',
        '품번':         c.part_number              || '',
        '품명':         c.part_name                || '',
        '품목군':       c.product_category         || '',
        '검사단계':     c.inspection_stage         || '',
        '불량유형':     c.defect_type              || '',
        '불량내용':     c.defect_description       || '',
        '입고수량':     c.quantity                 ?? '',
        '검사수량':     c.inspection_quantity      ?? '',
        '불량수량':     c.defect_quantity          ?? '',
        '불량률(%)':    defRate,
        '처리결과':     c.disposition              || '미결',
        '시정조치상태': c.improvement_status       || '미조치',
        '조치유형':     c.corrective_action_type   || '',
        '조치내용':     c.corrective_action_detail || '',
        '비고':         c.notes                    || '',
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

  const hasFilter = dispositionFilter !== 'all' || supplierFilter !== 'all' || improvementFilter !== 'all' || inspectionFilter !== 'all' || search;
  const clearAll  = () => { setSearch(''); setSearchParams({}); };

  if (loading) return <div className="loading">⏳ 불러오는 중...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">공급사 불량 이력</div>
          <div className="page-sub">검색결과 {filtered.length}건 / 전체 {claims.length}건</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={handleExport} disabled={filtered.length === 0}>📥 엑셀 저장</button>
          <button className="btn btn-primary" onClick={() => navigate('/supplier-claims/new')}>➕ 불량 접수</button>
        </div>
      </div>

      {/* 검사단계 탭 버튼 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {[{ key: 'all', label: '전체' }, ...INSPECTION_STAGES.map(s => ({ key: s, label: s }))].map(({ key, label }) => {
          const isActive = inspectionFilter === key;
          const sc = key !== 'all' ? STAGE_BTN_COLORS[key] : null;
          return (
            <button key={key} onClick={() => setInspectionFilter(key)} style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit', transition: '.12s',
              background: isActive ? (sc ? sc.active : '#0f172a') : '#fff',
              color:      isActive ? '#fff' : (sc ? sc.text : '#64748b'),
              borderColor: isActive ? (sc ? sc.active : '#0f172a') : '#e2e8f0',
            }}>
              {label}
              <span style={{
                marginLeft: 6, fontSize: 11, fontWeight: 700,
                background: isActive ? 'rgba(255,255,255,.25)' : '#f1f5f9',
                color: isActive ? '#fff' : '#64748b',
                padding: '1px 6px', borderRadius: 99,
              }}>
                {stageCounts[key] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* 세부 필터 */}
      <div className="filter-bar">
        <input
          className="filter-input"
          placeholder="🔍 공급사 / 품번 / 품명 / 불량유형 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="filter-select" value={dispositionFilter} onChange={e => setDispositionFilter(e.target.value)}>
          <option value="all">전체 처리결과</option>
          {['미결', '사용승인', '반품(대체품)', '폐기', '재작업', '선별작업'].map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="filter-select" value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}>
          <option value="all">전체 공급사</option>
          {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="filter-select" value={improvementFilter} onChange={e => setImprovementFilter(e.target.value)}>
          <option value="all">전체 시정조치</option>
          {['미조치', '진행중', '완료'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {hasFilter && (
          <button className="btn btn-ghost btn-sm" onClick={clearAll}>✕ 필터 초기화</button>
        )}
      </div>

      {/* 목록 테이블 */}
      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🏭</div>
            {hasFilter ? '검색 조건에 맞는 불량 이력이 없습니다' : '등록된 공급사 불량 이력이 없습니다'}
          </div>
        ) : (
          <div className="table-wrap">
            <table style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 80,  whiteSpace: 'nowrap' }}>입고일</th>
                  <th style={{ width: 110 }}>공급사</th>
                  <th style={{ width: 90  }}>품번</th>
                  <th style={{ width: 130 }}>품명</th>
                  <th style={{ width: 90  }}>불량유형</th>
                  <th style={{ width: 86,  textAlign: 'right', whiteSpace: 'nowrap' }}>불량/검사</th>
                  <th style={{ width: 72,  textAlign: 'center', whiteSpace: 'nowrap' }}>처리결과</th>
                  <th style={{ width: 58,  textAlign: 'center', whiteSpace: 'nowrap' }}>시정조치</th>
                  {inspectionFilter === 'all' && (
                    <th style={{ width: 78, whiteSpace: 'nowrap' }}>검사단계</th>
                  )}
                  <th style={{ width: 22,  textAlign: 'center' }}>📎</th>
                  {isAdmin && <th style={{ width: 40 }}></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const disp  = c.disposition || '미결';
                  const dc    = DISPOSITION_COLORS[disp] || DISPOSITION_COLORS['미결'];
                  const st    = c.improvement_status || '미조치';
                  const ic    = IMPROVEMENT_STATUS_COLORS[st] || IMPROVEMENT_STATUS_COLORS['미조치'];
                  const denom = c.inspection_quantity ?? c.quantity;
                  const defRate = denom > 0 && c.defect_quantity != null
                    ? ((c.defect_quantity / denom) * 100).toFixed(1) : null;
                  const sc = c.inspection_stage ? STAGE_BTN_COLORS[c.inspection_stage] : null;
                  return (
                    <tr key={c.id} className="clickable" onClick={() => navigate(`/supplier-claims/${c.id}`)}>
                      <td style={{ whiteSpace: 'nowrap', color: '#64748b', fontSize: 11 }}>
                        <div>{c.incoming_date || '-'}</div>
                        {c.incoming_lot_no && <div style={{ fontSize: 10, color: '#94a3b8' }}>{c.incoming_lot_no}</div>}
                      </td>
                      <td style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <strong style={{ fontSize: 12 }}>{c.supplier_name || '-'}</strong>
                        {c.purchase_dept && <div style={{ fontSize: 10, color: '#94a3b8' }}>{c.purchase_dept}</div>}
                      </td>
                      <td className="mono" style={{ fontSize: 11, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.part_number}>
                        {c.part_number || '-'}
                      </td>
                      <td style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.part_name}>
                        {c.part_name || '-'}
                      </td>
                      <td>
                        {c.defect_type ? (
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 99, background: '#fee2e2', color: '#991b1b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {c.defect_type}
                          </span>
                        ) : <span style={{ color: '#cbd5e1' }}>-</span>}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {c.defect_quantity != null ? (
                          <>
                            <span style={{ color: '#dc2626', fontWeight: 700 }}>{c.defect_quantity.toLocaleString()}</span>
                            <span style={{ color: '#94a3b8', fontSize: 11 }}> / {(denom || 0).toLocaleString()}</span>
                            {defRate !== null && (
                              <div style={{ fontSize: 10, fontWeight: 700, color: parseFloat(defRate) > 5 ? '#dc2626' : '#059669' }}>
                                {defRate}%
                              </div>
                            )}
                          </>
                        ) : <span style={{ color: '#cbd5e1' }}>-</span>}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: dc.bg, color: dc.text, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {disp}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 99, background: ic.bg, color: ic.text, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {st}
                        </span>
                      </td>
                      {inspectionFilter === 'all' && (
                        <td>
                          {c.inspection_stage && sc ? (
                            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: sc.bg, color: sc.text, fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {c.inspection_stage}
                            </span>
                          ) : <span style={{ color: '#cbd5e1' }}>-</span>}
                        </td>
                      )}
                      <td style={{ textAlign: 'center' }}>
                        {fileClaimIds?.has(c.id) && <span title="첨부파일 있음" style={{ fontSize: 13 }}>📎</span>}
                      </td>
                      {isAdmin && (
                        <td onClick={e => e.stopPropagation()} style={{ padding: '0 4px' }}>
                          <button
                            className="btn btn-sm"
                            onClick={e => handleDelete(e, c.id, c.supplier_name)}
                            style={{ fontSize: 10, color: '#dc2626', background: '#fee2e2', border: 'none', padding: '3px 6px', borderRadius: 5 }}
                          >삭제</button>
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
    </div>
  );
}
