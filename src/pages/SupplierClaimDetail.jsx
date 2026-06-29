import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSupplierClaims } from '../context/SupplierClaimsContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  advanceSupplierClaim, deleteSupplierClaim, updateSupplierClaim, updateSupplierStageEntry,
  insertImprovementLog, updateImprovementLog, deleteImprovementLog,
  SUPPLIER_STAGES, SUPPLIER_STAGE_ICONS, SUPPLIER_STAGE_COLORS,
  PRODUCT_TYPES, PRODUCT_CATEGORIES, DEPARTMENTS,
  DEFECT_TYPES, RETURN_STATUSES, INSPECTION_STAGES, IMPROVEMENT_RESULTS,
} from '../lib/supabase';
import { usePrintTitle } from '../context/PrintContext';
import PartSearchModal from '../components/PartSearchModal';
import SupplierSearch from '../components/SupplierSearch';

const RETURN_COLORS = {
  '미결': { bg: '#f1f5f9', text: '#475569' },
  '반품': { bg: '#fee2e2', text: '#991b1b' },
  '교환': { bg: '#fef3c7', text: '#92400e' },
  '폐기': { bg: '#f0fdf4', text: '#166534' },
};
const IMPROVE_COLORS = {
  '확인중': { bg: '#f1f5f9', text: '#475569' },
  '개선':   { bg: '#d1fae5', text: '#065f46' },
  '미개선': { bg: '#fee2e2', text: '#991b1b' },
};

function Field({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: value ? '#0f172a' : '#cbd5e1', fontFamily: mono ? 'monospace' : 'inherit' }}>
        {value || '—'}
      </div>
    </div>
  );
}

function Chip({ value, colors }) {
  if (!value) return <span style={{ color: '#cbd5e1', fontSize: 13 }}>—</span>;
  const c = colors?.[value] || { bg: '#f1f5f9', text: '#475569' };
  return (
    <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: c.bg, color: c.text, fontWeight: 600 }}>
      {value}
    </span>
  );
}

export default function SupplierClaimDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const {
    claims, loading, getStagesFor, updateClaimStage, updateClaimData, removeClaim, patchStageEntry,
    improvementLogs, addImprovementLog, updateImpLog, removeImpLog,
  } = useSupplierClaims();
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const { setPrintTitle } = usePrintTitle();

  /* ── 단계 진행 상태 ── */
  const [advDate,        setAdvDate]        = useState(new Date().toISOString().slice(0, 10));
  const [advHandlerDept, setAdvHandlerDept] = useState('');
  const [advHandler,     setAdvHandler]     = useState('');
  const [advDesc,        setAdvDesc]        = useState('');
  const [advPrevent,     setAdvPrevent]     = useState('');
  const [advReturn,      setAdvReturn]      = useState('');
  const [advancing,      setAdvancing]      = useState(false);

  /* ── 이력 수정 상태 ── */
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [entryEdit,      setEntryEdit]      = useState({});
  const [savingEntry,    setSavingEntry]    = useState(false);

  /* ── 기본정보 수정 상태 ── */
  const [editMode,       setEditMode]       = useState(false);
  const [editForm,       setEditForm]       = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [partSearchOpen, setPartSearchOpen] = useState(false);

  /* ── 개선 추적 상태 ── */
  const [impForm, setImpForm] = useState({
    incoming_lot_no: '', incoming_date: '', quantity: '', defect_quantity: '',
    is_improved: '확인중', notes: '', handler: '', handler_dept: '',
  });
  const [addingImp,   setAddingImp]   = useState(false);
  const [savingImp,   setSavingImp]   = useState(false);
  const [editingImpId, setEditingImpId] = useState(null);
  const [impEditForm, setImpEditForm] = useState({});

  if (loading) return <div className="loading">⏳ 불러오는 중...</div>;

  const claim = claims.find(c => c.id === id);
  if (!claim) return (
    <div>
      <button className="back-btn" onClick={() => navigate('/supplier-claims')}>← 목록으로</button>
      <div className="error-box">불량 이력을 찾을 수 없습니다.</div>
    </div>
  );

  const history    = getStagesFor(id);
  const currentIdx = SUPPLIER_STAGES.indexOf(claim.current_stage);
  const isClosed   = claim.current_stage === '종결';
  const logs       = (improvementLogs || []).filter(l => l.supplier_claim_id === id)
                       .sort((a, b) => a.created_at.localeCompare(b.created_at));

  useEffect(() => {
    if (!claim) return;
    setPrintTitle(`AJW 공급사 불량 상세 — ${claim.supplier_name} (${claim.receipt_date || ''})`);
  }, [claim, setPrintTitle]);

  /* ── 단계 진행 ── */
  const handleAdvance = async () => {
    if (history.some(h => h.stage_name === claim.current_stage)) {
      toast('중복 등록 불가', `"${claim.current_stage}" 단계는 이미 처리된 건입니다`, 'error'); return;
    }
    if (!advHandlerDept) { toast('입력 필요', '담당 부서를 선택하세요', 'error'); return; }
    if (!advHandler.trim()) { toast('입력 필요', '담당자 이름을 입력하세요', 'error'); return; }
    if (!advDesc.trim()) { toast('입력 필요', '처리 내용을 입력하세요', 'error'); return; }
    if (claim.current_stage === '조치' && !advPrevent.trim()) {
      toast('입력 필요', '재발방지대책을 입력하세요', 'error'); return;
    }
    setAdvancing(true);
    try {
      let description = advDesc.trim();
      if (claim.current_stage === '조치') {
        description = `[조치내용] ${advDesc.trim()}\n[재발방지] ${advPrevent.trim()}`;
      }
      if (claim.current_stage === '공급사 통보' && advReturn) {
        description = `[통보내용] ${advDesc.trim()}\n[처리결과] ${advReturn}`;
        await updateSupplierClaim(id, { return_status: advReturn });
        updateClaimData(id, { return_status: advReturn });
      }
      const { nextStage: ns, entry } = await advanceSupplierClaim(
        id, claim.current_stage,
        { stage_date: advDate, description, handler: advHandler, handler_dept: advHandlerDept },
        user
      );
      updateClaimStage(id, ns, entry);
      setAdvDesc(''); setAdvHandler(''); setAdvHandlerDept(''); setAdvPrevent(''); setAdvReturn('');
      toast(`"${ns}"으로 진행 완료`, '', 'success');
    } catch (err) {
      toast('진행 실패', err.message, 'error');
    } finally {
      setAdvancing(false);
    }
  };

  /* ── 삭제 ── */
  const handleDelete = async () => {
    if (!confirm(`"${claim.supplier_name}" 불량 이력을 삭제하시겠습니까?`)) return;
    try {
      await deleteSupplierClaim(id);
      removeClaim(id);
      toast('삭제 완료', '', 'success');
      navigate('/supplier-claims');
    } catch (err) {
      toast('삭제 실패', err.message, 'error');
    }
  };

  /* ── 기본정보 수정 ── */
  const startEdit = () => {
    setEditForm({
      supplier_name:      claim.supplier_name      || '',
      incoming_date:      claim.incoming_date      || claim.occurrence_date || '',
      receipt_date:       claim.receipt_date       || '',
      incoming_lot_no:    claim.incoming_lot_no    || '',
      handler_dept:       claim.handler_dept       || '',
      handler_name:       claim.handler_name       || '',
      handler_contact:    claim.handler_contact    || '',
      part_number:        claim.part_number        || '',
      part_name:          claim.part_name          || '',
      product_type:       claim.product_type       || '',
      product_category:   claim.product_category   || '',
      quantity:           claim.quantity    != null ? String(claim.quantity)    : '',
      lot_number:         claim.lot_number         || '',
      defect_quantity:    claim.defect_quantity != null ? String(claim.defect_quantity) : '',
      defect_type:        claim.defect_type        || '',
      inspection_stage:   claim.inspection_stage   || '',
      cavity_total:       claim.cavity_total    != null ? String(claim.cavity_total)    : '',
      cavity_defective:   claim.cavity_defective != null ? String(claim.cavity_defective) : '',
      defect_description: claim.defect_description || '',
      return_status:      claim.return_status      || '미결',
    });
    setEditMode(true);
  };

  const handleSave = async () => {
    if (!editForm.supplier_name.trim()) { toast('입력 오류', '공급사명을 입력하세요', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        supplier_name:      editForm.supplier_name.trim(),
        incoming_date:      editForm.incoming_date    || null,
        receipt_date:       editForm.receipt_date     || null,
        incoming_lot_no:    editForm.incoming_lot_no.trim() || null,
        handler_dept:       editForm.handler_dept     || null,
        handler_name:       editForm.handler_name.trim()     || null,
        handler_contact:    editForm.handler_contact.trim()  || null,
        part_number:        editForm.part_number.trim()      || null,
        part_name:          editForm.part_name.trim()        || null,
        product_type:       editForm.product_type      || null,
        product_category:   editForm.product_category  || null,
        quantity:           editForm.quantity    !== '' ? parseInt(editForm.quantity)    : null,
        lot_number:         editForm.lot_number.trim()       || null,
        defect_quantity:    editForm.defect_quantity !== '' ? parseInt(editForm.defect_quantity) : null,
        defect_type:        editForm.defect_type       || null,
        inspection_stage:   editForm.inspection_stage  || null,
        cavity_total:       editForm.cavity_total    !== '' ? parseInt(editForm.cavity_total)    : null,
        cavity_defective:   editForm.cavity_defective !== '' ? parseInt(editForm.cavity_defective) : null,
        defect_description: editForm.defect_description.trim() || null,
        return_status:      editForm.return_status     || '미결',
      };
      await updateSupplierClaim(id, payload);
      updateClaimData(id, payload);
      setEditMode(false);
      toast('수정 완료', '불량 이력이 수정되었습니다', 'success');
    } catch (err) {
      toast('수정 실패', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEntry = async () => {
    setSavingEntry(true);
    try {
      await updateSupplierStageEntry(editingEntryId, entryEdit);
      patchStageEntry(editingEntryId, entryEdit);
      setEditingEntryId(null);
      toast('수정 완료', '', 'success');
    } catch (err) {
      toast('수정 실패', err.message, 'error');
    } finally {
      setSavingEntry(false);
    }
  };

  /* ── 개선 추적 ── */
  const handleAddImpLog = async () => {
    if (!impForm.incoming_lot_no.trim()) { toast('입력 필요', '차수를 입력하세요', 'error'); return; }
    setSavingImp(true);
    try {
      const log = await insertImprovementLog(id, impForm, user);
      addImprovementLog(log);
      setImpForm({ incoming_lot_no: '', incoming_date: '', quantity: '', defect_quantity: '', is_improved: '확인중', notes: '', handler: '', handler_dept: '' });
      setAddingImp(false);
      toast('추적 이력 추가 완료', '', 'success');
    } catch (err) {
      toast('추가 실패', err.message, 'error');
    } finally {
      setSavingImp(false);
    }
  };

  const handleUpdateImpLog = async (logId) => {
    try {
      await updateImprovementLog(logId, impEditForm);
      updateImpLog(logId, impEditForm);
      setEditingImpId(null);
      toast('수정 완료', '', 'success');
    } catch (err) {
      toast('수정 실패', err.message, 'error');
    }
  };

  const handleDeleteImpLog = async (logId) => {
    if (!confirm('이 추적 이력을 삭제하시겠습니까?')) return;
    try {
      await deleteImprovementLog(logId);
      removeImpLog(logId);
      toast('삭제 완료', '', 'success');
    } catch (err) {
      toast('삭제 실패', err.message, 'error');
    }
  };

  const setEF = (key) => (e) => setEditForm(prev => ({ ...prev, [key]: e.target.value }));

  const qty     = claim.quantity;
  const defQty  = claim.defect_quantity;
  const defRate = qty > 0 && defQty != null ? ((defQty / qty) * 100).toFixed(1) : null;

  const eqty    = editForm ? parseFloat(editForm.quantity)        : 0;
  const edefQty = editForm ? parseFloat(editForm.defect_quantity) : 0;
  const edefRate = eqty > 0 && edefQty >= 0 ? ((edefQty / eqty) * 100).toFixed(1) : null;

  const rc = RETURN_COLORS[claim.return_status] || RETURN_COLORS['미결'];
  const displayIncomingDate = claim.incoming_date || claim.occurrence_date;

  return (
    <div>
      <button className="back-btn" onClick={() => navigate('/supplier-claims')}>← 공급사 불량 목록으로</button>

      <div className="page-header">
        <div>
          <div className="page-title">{claim.supplier_name}</div>
          <div className="page-sub">
            공급사 불량 · 입고일: {displayIncomingDate || '미입력'}
            {claim.incoming_lot_no && <> · <strong>{claim.incoming_lot_no}</strong></>}
            {claim.part_number && <> · <span style={{ fontFamily: 'monospace' }}>{claim.part_number}</span></>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!editMode && <button className="btn btn-ghost btn-sm" onClick={startEdit}>✏️ 수정</button>}
          {isAdmin && (
            <button className="btn btn-sm" onClick={handleDelete}
              style={{ background: '#fee2e2', color: '#dc2626', border: 'none' }}>🗑 삭제</button>
          )}
        </div>
      </div>

      {/* ── 기본 정보 ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ marginBottom: 16 }}>
          <span className="card-title" style={{ margin: 0 }}>📋 기본 정보</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 12, padding: '3px 10px', borderRadius: 99, fontWeight: 700,
              background: SUPPLIER_STAGE_COLORS[claim.current_stage]?.bg || '#f1f5f9',
              color: SUPPLIER_STAGE_COLORS[claim.current_stage]?.text || '#475569',
            }}>
              {SUPPLIER_STAGE_ICONS[SUPPLIER_STAGES.indexOf(claim.current_stage)]} {claim.current_stage}
            </span>
            <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: rc.bg, color: rc.text, fontWeight: 600 }}>
              {claim.return_status || '미결'}
            </span>
            {claim.inspection_stage && (
              <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: '#ccfbf1', color: '#0f766e', fontWeight: 600 }}>
                🔬 {claim.inspection_stage}
              </span>
            )}
          </div>
        </div>

        {editMode ? (
          <div>
            <div className="form-grid form-cols-4" style={{ marginBottom: 12 }}>
              <div className="form-group form-span-2">
                <label>공급사명 <span className="required-star">*</span></label>
                <SupplierSearch value={editForm.supplier_name} onChange={v => setEditForm(p => ({ ...p, supplier_name: v }))} />
              </div>
              <div className="form-group">
                <label>입고일자</label>
                <input type="date" value={editForm.incoming_date} onChange={setEF('incoming_date')} />
              </div>
              <div className="form-group">
                <label>접수일</label>
                <input type="date" value={editForm.receipt_date} onChange={setEF('receipt_date')} />
              </div>
              <div className="form-group form-span-2">
                <label>입고 차수</label>
                <input placeholder="예: 1차, 2024-3차" value={editForm.incoming_lot_no} onChange={setEF('incoming_lot_no')} />
              </div>
              <div className="form-group">
                <label>담당 부서</label>
                <select value={editForm.handler_dept} onChange={setEF('handler_dept')}>
                  <option value="">부서 선택</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>담당자</label>
                <input value={editForm.handler_name} onChange={setEF('handler_name')} />
              </div>
              <div className="form-group">
                <label>연락처</label>
                <input value={editForm.handler_contact} onChange={setEF('handler_contact')} />
              </div>
              <div className="form-group">
                <label>반품/교환 상태</label>
                <select value={editForm.return_status} onChange={setEF('return_status')}>
                  {RETURN_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>품번</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={editForm.part_number} onChange={setEF('part_number')} style={{ flex: 1 }} />
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => setPartSearchOpen(true)}>🔍</button>
                </div>
              </div>
              <div className="form-group">
                <label>품명</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={editForm.part_name} onChange={setEF('part_name')} style={{ flex: 1 }} />
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => setPartSearchOpen(true)}>🔍</button>
                </div>
              </div>
              <div className="form-group">
                <label>입고 수량 (EA)</label>
                <input type="number" min="0" value={editForm.quantity} onChange={setEF('quantity')} />
              </div>
              <div className="form-group">
                <label>입고 LOT</label>
                <input value={editForm.lot_number} onChange={setEF('lot_number')} />
              </div>
              <div className="form-group form-span-4">
                <label>품목 유형</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {PRODUCT_TYPES.map(t => (
                    <button key={t} type="button"
                      onClick={() => setEditForm(p => ({ ...p, product_type: p.product_type === t ? '' : t }))}
                      style={{ padding: '5px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', background: editForm.product_type === t ? '#2563eb' : '#fff', color: editForm.product_type === t ? '#fff' : '#64748b', borderColor: editForm.product_type === t ? '#2563eb' : '#e2e8f0', fontFamily: 'inherit' }}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="form-group form-span-4">
                <label>품목군</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {PRODUCT_CATEGORIES.map(c => (
                    <button key={c} type="button"
                      onClick={() => setEditForm(p => ({ ...p, product_category: p.product_category === c ? '' : c }))}
                      style={{ padding: '5px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', background: editForm.product_category === c ? '#7c3aed' : '#fff', color: editForm.product_category === c ? '#fff' : '#64748b', borderColor: editForm.product_category === c ? '#7c3aed' : '#e2e8f0', fontFamily: 'inherit' }}>{c}</button>
                  ))}
                </div>
              </div>
              <div className="form-group form-span-4">
                <label>검사 단계</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {INSPECTION_STAGES.map(s => (
                    <button key={s} type="button"
                      onClick={() => setEditForm(p => ({ ...p, inspection_stage: p.inspection_stage === s ? '' : s }))}
                      style={{ padding: '5px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', background: editForm.inspection_stage === s ? '#0f766e' : '#fff', color: editForm.inspection_stage === s ? '#fff' : '#64748b', borderColor: editForm.inspection_stage === s ? '#0f766e' : '#e2e8f0', fontFamily: 'inherit' }}>{s}</button>
                  ))}
                </div>
              </div>
              {editForm.inspection_stage === '부품 수입검사' && (
                <>
                  <div className="form-group">
                    <label>캐비티 총 수</label>
                    <input type="number" min="1" value={editForm.cavity_total} onChange={setEF('cavity_total')} />
                  </div>
                  <div className="form-group">
                    <label>불량 캐비티 수</label>
                    <input type="number" min="0" value={editForm.cavity_defective} onChange={setEF('cavity_defective')} />
                  </div>
                </>
              )}
              <div className="form-group">
                <label>불량 수량 (EA)</label>
                <input type="number" min="0" value={editForm.defect_quantity} onChange={setEF('defect_quantity')} />
              </div>
              <div className="form-group">
                <label>불량률 (자동)</label>
                <div style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', fontSize: 13, fontWeight: edefRate !== null ? 700 : 400, color: edefRate !== null ? (parseFloat(edefRate) > 5 ? '#dc2626' : '#059669') : '#94a3b8', display: 'flex', alignItems: 'center', gap: 6, minHeight: 38 }}>
                  {edefRate !== null ? <>{parseFloat(edefRate) > 5 ? '🔴' : '🟢'} {edefRate}%</> : '—'}
                </div>
              </div>
              <div className="form-group form-span-4">
                <label>불량 유형</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {DEFECT_TYPES.map(t => (
                    <button key={t} type="button"
                      onClick={() => setEditForm(p => ({ ...p, defect_type: p.defect_type === t ? '' : t }))}
                      style={{ padding: '5px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', background: editForm.defect_type === t ? '#dc2626' : '#fff', color: editForm.defect_type === t ? '#fff' : '#64748b', borderColor: editForm.defect_type === t ? '#dc2626' : '#e2e8f0', fontFamily: 'inherit' }}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="form-group form-span-4">
                <label>불량 내용 상세</label>
                <textarea rows={4} value={editForm.defect_description} onChange={setEF('defect_description')} style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? '저장 중...' : '💾 저장'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditMode(false)}>취소</button>
            </div>
          </div>
        ) : (
          <div className="form-grid form-cols-4">
            <div className="form-group form-span-2"><Field label="공급사명" value={claim.supplier_name} /></div>
            <div className="form-group"><Field label="입고일자" value={displayIncomingDate} /></div>
            <div className="form-group"><Field label="접수일" value={claim.receipt_date} /></div>
            <div className="form-group"><Field label="입고 차수" value={claim.incoming_lot_no} /></div>
            <div className="form-group"><Field label="담당 부서" value={claim.handler_dept} /></div>
            <div className="form-group"><Field label="담당자" value={claim.handler_name} /></div>
            <div className="form-group"><Field label="연락처" value={claim.handler_contact} /></div>
            <div className="form-group">
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>반품/교환</div>
              <Chip value={claim.return_status || '미결'} colors={RETURN_COLORS} />
            </div>
            <div className="form-group"><Field label="품번" value={claim.part_number} mono /></div>
            <div className="form-group"><Field label="품명" value={claim.part_name} /></div>
            <div className="form-group"><Field label="입고 LOT" value={claim.lot_number} mono /></div>
            <div className="form-group">
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>품목 유형</div>
              {claim.product_type
                ? <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: '#eff6ff', color: '#1d4ed8', fontWeight: 600 }}>{claim.product_type}</span>
                : <span style={{ color: '#cbd5e1', fontSize: 13 }}>—</span>}
            </div>
            <div className="form-group form-span-4">
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>품목군</div>
              {claim.product_category
                ? <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: '#f3e8ff', color: '#6b21a8', fontWeight: 600 }}>{claim.product_category}</span>
                : <span style={{ color: '#cbd5e1', fontSize: 13 }}>—</span>}
            </div>
            <div className="form-group form-span-2">
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>검사 단계</div>
              {claim.inspection_stage
                ? <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: '#ccfbf1', color: '#0f766e', fontWeight: 600 }}>🔬 {claim.inspection_stage}</span>
                : <span style={{ color: '#cbd5e1', fontSize: 13 }}>—</span>}
            </div>
            {claim.inspection_stage === '부품 수입검사' && (
              <div className="form-group form-span-2">
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 3 }}>캐비티 현황</div>
                <div style={{ fontSize: 13, color: '#0f172a' }}>
                  {claim.cavity_total != null
                    ? <>총 {claim.cavity_total}개 중 불량 {claim.cavity_defective ?? '?'}개
                        {claim.cavity_total > 0 && claim.cavity_defective != null &&
                          <span style={{ marginLeft: 8, fontSize: 12, color: '#dc2626', fontWeight: 700 }}>
                            ({((claim.cavity_defective / claim.cavity_total) * 100).toFixed(1)}%)
                          </span>}
                      </>
                    : '—'}
                </div>
              </div>
            )}
            <div className="form-group">
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 3 }}>입고 수량</div>
              <div style={{ fontSize: 13, color: '#0f172a' }}>{qty != null ? qty.toLocaleString() + ' EA' : '—'}</div>
            </div>
            <div className="form-group">
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 3 }}>불량 수량 / 불량률</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: defRate !== null ? (parseFloat(defRate) > 5 ? '#dc2626' : '#059669') : '#0f172a' }}>
                {defQty != null ? defQty.toLocaleString() + ' EA' : '—'}
                {defRate !== null && <span style={{ fontWeight: 400, color: '#64748b', marginLeft: 6 }}>({defRate}%)</span>}
              </div>
            </div>
            <div className="form-group form-span-2">
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>불량 유형</div>
              {claim.defect_type
                ? <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: '#fee2e2', color: '#991b1b', fontWeight: 600 }}>{claim.defect_type}</span>
                : <span style={{ color: '#cbd5e1', fontSize: 13 }}>—</span>}
            </div>
            <div className="form-group form-span-4">
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 3 }}>불량 내용 상세</div>
              <div style={{ fontSize: 13, color: '#0f172a', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{claim.defect_description || '—'}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── 단계 트래커 ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ marginBottom: 16 }}>
          <span className="card-title" style={{ margin: 0 }}>📍 처리 단계 현황</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
          {SUPPLIER_STAGES.map((stage, i) => {
            const sc = SUPPLIER_STAGE_COLORS[stage];
            const done = i < currentIdx;
            const curr = i === currentIdx;
            return (
              <div key={stage} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '8px 12px', borderRadius: 10, minWidth: 80,
                  background: curr ? sc.bg : done ? '#f0fdf4' : '#f8fafc',
                  border: `2px solid ${curr ? sc.dot : done ? '#86efac' : '#e2e8f0'}`,
                }}>
                  <span style={{ fontSize: 16 }}>{done ? '✅' : SUPPLIER_STAGE_ICONS[i]}</span>
                  <span style={{ fontSize: 11, fontWeight: curr ? 700 : 500, color: curr ? sc.text : done ? '#166534' : '#94a3b8', textAlign: 'center' }}>{stage}</span>
                </div>
                {i < SUPPLIER_STAGES.length - 1 && (
                  <div style={{ width: 20, height: 2, background: done ? '#86efac' : '#e2e8f0', flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>

        {!isClosed && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
              {SUPPLIER_STAGE_ICONS[currentIdx]} <span style={{ color: SUPPLIER_STAGE_COLORS[claim.current_stage]?.text }}>{claim.current_stage}</span> 처리 내용 입력
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, marginLeft: 8 }}>→ 다음: {SUPPLIER_STAGES[currentIdx + 1]}</span>
            </div>
            <div className="form-grid form-cols-4">
              <div className="form-group"><label>처리일 <span className="required-star">*</span></label>
                <input type="date" value={advDate} onChange={e => setAdvDate(e.target.value)} /></div>
              <div className="form-group"><label>담당 부서 <span className="required-star">*</span></label>
                <select value={advHandlerDept} onChange={e => setAdvHandlerDept(e.target.value)}>
                  <option value="">부서 선택</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select></div>
              <div className="form-group form-span-2"><label>담당자 <span className="required-star">*</span></label>
                <input placeholder="담당자 이름" value={advHandler} onChange={e => setAdvHandler(e.target.value)} /></div>
              {claim.current_stage === '공급사 통보' && (
                <div className="form-group form-span-4">
                  <label>처리 결과 (반품/교환 상태 업데이트)</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {RETURN_STATUSES.map(s => (
                      <button key={s} type="button"
                        onClick={() => setAdvReturn(p => p === s ? '' : s)}
                        style={{ padding: '5px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', background: advReturn === s ? '#0891b2' : '#fff', color: advReturn === s ? '#fff' : '#64748b', borderColor: advReturn === s ? '#0891b2' : '#e2e8f0', fontFamily: 'inherit' }}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="form-group form-span-4"><label>처리 내용 <span className="required-star">*</span></label>
                <textarea rows={3} value={advDesc} onChange={e => setAdvDesc(e.target.value)} style={{ resize: 'vertical' }}
                  placeholder={claim.current_stage === '원인분석' ? '불량 원인 분석 내용' : claim.current_stage === '공급사 통보' ? '공급사 통보 내용 및 협의 결과' : claim.current_stage === '조치' ? '조치 내용' : '처리 내용'} /></div>
              {claim.current_stage === '조치' && (
                <div className="form-group form-span-4"><label>재발방지대책 <span className="required-star">*</span></label>
                  <textarea rows={2} placeholder="재발 방지 대책을 입력하세요" value={advPrevent} onChange={e => setAdvPrevent(e.target.value)} style={{ resize: 'vertical' }} /></div>
              )}
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary btn-sm" onClick={handleAdvance} disabled={advancing}>
                {advancing ? '⏳ 처리 중...' : `✅ "${SUPPLIER_STAGES[currentIdx + 1]}" 단계로 진행`}
              </button>
            </div>
          </div>
        )}
        {isClosed && (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 14, textAlign: 'center', fontSize: 14, color: '#166534', fontWeight: 600 }}>
            ✅ 이 건은 종결 처리되었습니다
          </div>
        )}
      </div>

      {/* ── 처리 이력 ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ marginBottom: 16 }}>
          <span className="card-title" style={{ margin: 0 }}>📜 처리 이력</span>
        </div>
        {history.length === 0 ? (
          <div className="empty"><div className="empty-icon">📋</div>처리 이력이 없습니다</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {history.map(h => {
              const sc = SUPPLIER_STAGE_COLORS[h.stage_name] || { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' };
              const isEditing = editingEntryId === h.id;
              return (
                <div key={h.id} style={{ border: `1px solid ${sc.dot}30`, borderLeft: `4px solid ${sc.dot}`, borderRadius: 8, padding: '12px 14px', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 99, background: sc.bg, color: sc.text, fontWeight: 700 }}>{h.stage_name}</span>
                        {!isEditing && h.stage_date && <span style={{ fontSize: 12, color: '#64748b' }}>{h.stage_date}</span>}
                        {!isEditing && (h.handler || h.handler_dept) && (
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>{h.handler_dept && `[${h.handler_dept}]`} {h.handler}</span>
                        )}
                      </div>
                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {[['처리일', 'stage_date', 'date'], ['담당자', 'handler', 'text']].map(([lbl, key, type]) => (
                              <div key={key} style={{ flex: '1 1 120px' }}>
                                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 3 }}>{lbl}</label>
                                <input type={type} value={entryEdit[key] || ''} onChange={e => setEntryEdit(p => ({ ...p, [key]: e.target.value }))}
                                  style={{ width: '100%', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }} />
                              </div>
                            ))}
                            <div style={{ flex: '1 1 120px' }}>
                              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 3 }}>담당 부서</label>
                              <select value={entryEdit.handler_dept || ''} onChange={e => setEntryEdit(p => ({ ...p, handler_dept: e.target.value }))}
                                style={{ width: '100%', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }}>
                                <option value="">부서 선택</option>
                                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                              </select>
                            </div>
                          </div>
                          <textarea value={entryEdit.description || ''} onChange={e => setEntryEdit(p => ({ ...p, description: e.target.value }))}
                            rows={3} style={{ width: '100%', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-primary btn-sm" onClick={handleSaveEntry} disabled={savingEntry}>{savingEntry ? '저장 중...' : '저장'}</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setEditingEntryId(null)}>취소</button>
                          </div>
                        </div>
                      ) : (
                        h.description && <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{h.description}</div>
                      )}
                    </div>
                    {!isEditing && (
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditingEntryId(h.id); setEntryEdit({ stage_date: h.stage_date || '', description: h.description || '', handler: h.handler || '', handler_dept: h.handler_dept || '' }); }} style={{ fontSize: 11, flexShrink: 0 }}>수정</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 개선 추적 ── */}
      <div className="card">
        <div className="card-header" style={{ marginBottom: 16 }}>
          <span className="card-title" style={{ margin: 0 }}>📈 입고 차수별 개선 추적</span>
          <button className="btn btn-sm" onClick={() => setAddingImp(true)}
            style={{ background: '#0f766e', color: '#fff', border: 'none', display: addingImp ? 'none' : undefined }}>
            ➕ 차수 추가
          </button>
        </div>

        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
          이후 입고 차수에서 동일 불량이 개선되었는지 기록합니다.
        </div>

        {/* 추가 폼 */}
        {addingImp && (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#065f46', marginBottom: 12 }}>➕ 신규 차수 추적 등록</div>
            <div className="form-grid form-cols-4">
              <div className="form-group form-span-2">
                <label>차수 <span className="required-star">*</span></label>
                <input placeholder="예: 2차, 2024-4차" value={impForm.incoming_lot_no}
                  onChange={e => setImpForm(p => ({ ...p, incoming_lot_no: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>입고일</label>
                <input type="date" value={impForm.incoming_date}
                  onChange={e => setImpForm(p => ({ ...p, incoming_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>입고 수량 (EA)</label>
                <input type="number" min="0" value={impForm.quantity}
                  onChange={e => setImpForm(p => ({ ...p, quantity: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>불량 수량 (EA)</label>
                <input type="number" min="0" value={impForm.defect_quantity}
                  onChange={e => setImpForm(p => ({ ...p, defect_quantity: e.target.value }))} />
              </div>
              <div className="form-group form-span-4">
                <label>개선 여부</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {IMPROVEMENT_RESULTS.map(r => {
                    const c = IMPROVE_COLORS[r];
                    return (
                      <button key={r} type="button"
                        onClick={() => setImpForm(p => ({ ...p, is_improved: r }))}
                        style={{ padding: '6px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', background: impForm.is_improved === r ? c.text : '#fff', color: impForm.is_improved === r ? '#fff' : '#64748b', borderColor: impForm.is_improved === r ? c.text : '#e2e8f0', fontFamily: 'inherit' }}>{r}</button>
                    );
                  })}
                </div>
              </div>
              <div className="form-group">
                <label>담당자</label>
                <input placeholder="이름" value={impForm.handler}
                  onChange={e => setImpForm(p => ({ ...p, handler: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>담당 부서</label>
                <select value={impForm.handler_dept} onChange={e => setImpForm(p => ({ ...p, handler_dept: e.target.value }))}>
                  <option value="">부서 선택</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group form-span-4">
                <label>비고</label>
                <input placeholder="특이사항 입력" value={impForm.notes}
                  onChange={e => setImpForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn btn-primary btn-sm" onClick={handleAddImpLog} disabled={savingImp}>
                {savingImp ? '저장 중...' : '💾 저장'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setAddingImp(false)}>취소</button>
            </div>
          </div>
        )}

        {/* 추적 이력 목록 */}
        {logs.length === 0 && !addingImp ? (
          <div className="empty"><div className="empty-icon">📈</div>등록된 개선 추적 이력이 없습니다</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {logs.map(log => {
              const ic = IMPROVE_COLORS[log.is_improved] || IMPROVE_COLORS['확인중'];
              const isEditingThis = editingImpId === log.id;
              const logDefRate = log.quantity > 0 && log.defect_quantity != null
                ? ((log.defect_quantity / log.quantity) * 100).toFixed(1) : null;
              return (
                <div key={log.id} style={{ border: `1px solid ${ic.text}30`, borderLeft: `4px solid ${ic.text}`, borderRadius: 8, padding: '12px 14px', background: '#fff' }}>
                  {isEditingThis ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div className="form-grid form-cols-4">
                        <div className="form-group form-span-2">
                          <label style={{ fontSize: 11, color: '#94a3b8' }}>차수</label>
                          <input value={impEditForm.incoming_lot_no || ''} onChange={e => setImpEditForm(p => ({ ...p, incoming_lot_no: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label style={{ fontSize: 11, color: '#94a3b8' }}>입고일</label>
                          <input type="date" value={impEditForm.incoming_date || ''} onChange={e => setImpEditForm(p => ({ ...p, incoming_date: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label style={{ fontSize: 11, color: '#94a3b8' }}>개선 여부</label>
                          <select value={impEditForm.is_improved || '확인중'} onChange={e => setImpEditForm(p => ({ ...p, is_improved: e.target.value }))}>
                            {IMPROVEMENT_RESULTS.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label style={{ fontSize: 11, color: '#94a3b8' }}>입고 수량</label>
                          <input type="number" min="0" value={impEditForm.quantity ?? ''} onChange={e => setImpEditForm(p => ({ ...p, quantity: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label style={{ fontSize: 11, color: '#94a3b8' }}>불량 수량</label>
                          <input type="number" min="0" value={impEditForm.defect_quantity ?? ''} onChange={e => setImpEditForm(p => ({ ...p, defect_quantity: e.target.value }))} />
                        </div>
                        <div className="form-group form-span-2">
                          <label style={{ fontSize: 11, color: '#94a3b8' }}>비고</label>
                          <input value={impEditForm.notes || ''} onChange={e => setImpEditForm(p => ({ ...p, notes: e.target.value }))} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => handleUpdateImpLog(log.id)}>저장</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingImpId(null)}>취소</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{log.incoming_lot_no}</span>
                          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 99, background: ic.bg || '#f1f5f9', color: ic.text, fontWeight: 700, border: `1px solid ${ic.text}30` }}>
                            {log.is_improved}
                          </span>
                          {log.incoming_date && <span style={{ fontSize: 12, color: '#64748b' }}>{log.incoming_date}</span>}
                          {log.handler && <span style={{ fontSize: 11, color: '#94a3b8' }}>{log.handler_dept && `[${log.handler_dept}]`} {log.handler}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {log.quantity != null && <span>입고: {log.quantity.toLocaleString()}EA</span>}
                          {log.defect_quantity != null && (
                            <span style={{ color: log.defect_quantity > 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>
                              불량: {log.defect_quantity.toLocaleString()}EA
                              {logDefRate !== null && ` (${logDefRate}%)`}
                            </span>
                          )}
                          {log.notes && <span style={{ color: '#475569' }}>💬 {log.notes}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                          onClick={() => { setEditingImpId(log.id); setImpEditForm({ ...log }); }}>수정</button>
                        {isAdmin && (
                          <button className="btn btn-sm" style={{ fontSize: 11, background: '#fee2e2', color: '#dc2626', border: 'none' }}
                            onClick={() => handleDeleteImpLog(log.id)}>삭제</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {partSearchOpen && (
        <PartSearchModal
          onSelect={(pn, pm) => setEditForm(prev => prev ? { ...prev, part_number: pn, part_name: pm } : prev)}
          onClose={() => setPartSearchOpen(false)}
        />
      )}
    </div>
  );
}
