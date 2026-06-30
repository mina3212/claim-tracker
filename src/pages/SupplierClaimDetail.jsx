import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSupplierClaims } from '../context/SupplierClaimsContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  deleteSupplierClaim, updateSupplierClaim,
  insertImprovementLog, updateImprovementLog, deleteImprovementLog,
  PRODUCT_TYPES, PRODUCT_CATEGORIES,
  DEFECT_TYPES, INSPECTION_STAGES, IMPROVEMENT_RESULTS,
  DISPOSITION_TYPES, DISPOSITION_COLORS, PURCHASE_DEPTS,
  CORRECTIVE_ACTION_TYPES, IMPROVEMENT_STATUS_OPTIONS, IMPROVEMENT_STATUS_COLORS,
} from '../lib/supabase';
import { usePrintTitle } from '../context/PrintContext';
import PartSearchModal from '../components/PartSearchModal';
import SupplierSearch from '../components/SupplierSearch';
import SupplierFileAttachments from '../components/SupplierFileAttachments';

const IMPROVE_COLORS = {
  '확인중': { bg: '#f1f5f9', text: '#475569' },
  '개선':   { bg: '#d1fae5', text: '#065f46' },
  '미개선': { bg: '#fee2e2', text: '#991b1b' },
};

function Field({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: value ? '#0f172a' : '#cbd5e1', fontFamily: mono ? 'monospace' : 'inherit' }}>{value || '—'}</div>
    </div>
  );
}

export default function SupplierClaimDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const {
    claims, loading,
    updateClaimData, removeClaim,
    improvementLogs, addImprovementLog, updateImpLog, removeImpLog,
  } = useSupplierClaims();
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const { setPrintTitle } = usePrintTitle();

  const [editMode,       setEditMode]       = useState(false);
  const [editForm,       setEditForm]       = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [partSearchOpen, setPartSearchOpen] = useState(false);

  const [impForm,       setImpForm]       = useState({ incoming_lot_no: '', incoming_date: '', quantity: '', defect_quantity: '', is_improved: '확인중', notes: '', handler: '' });
  const [addingImp,     setAddingImp]     = useState(false);
  const [savingImp,     setSavingImp]     = useState(false);
  const [editingImpId,  setEditingImpId]  = useState(null);
  const [impEditForm,   setImpEditForm]   = useState({});

  const [editingAction, setEditingAction] = useState(false);
  const [savingAction,  setSavingAction]  = useState(false);
  const [actionForm,    setActionForm]    = useState({ improvement_status: '미조치', corrective_action_type: '', corrective_action_detail: '' });

  if (loading) return <div className="loading">⏳ 불러오는 중...</div>;

  const claim = claims.find(c => c.id === id);
  if (!claim) return (
    <div>
      <button className="back-btn" onClick={() => navigate('/supplier-claims')}>← 목록으로</button>
      <div className="error-box">불량 이력을 찾을 수 없습니다.</div>
    </div>
  );

  const logs = (improvementLogs || []).filter(l => l.supplier_claim_id === id)
                 .sort((a, b) => a.created_at.localeCompare(b.created_at));

  useEffect(() => {
    if (!claim) return;
    setPrintTitle(`AJW 공급사 불량 — ${claim.supplier_name} (${claim.incoming_date || ''})`);
  }, [claim, setPrintTitle]);

  const dc = DISPOSITION_COLORS[claim.disposition] || DISPOSITION_COLORS['미결'];

  /* ── 기본정보 수정 ── */
  const startEdit = () => {
    setEditForm({
      supplier_name:      claim.supplier_name      || '',
      purchase_dept:      claim.purchase_dept      || '',
      incoming_date:      claim.incoming_date      || '',
      incoming_lot_no:    claim.incoming_lot_no    || '',
      lot_number:         claim.lot_number         || '',
      handler_name:       claim.handler_name       || '',
      part_number:        claim.part_number        || '',
      part_name:          claim.part_name          || '',
      quantity:           claim.quantity    != null ? String(claim.quantity)          : '',
      product_type:       claim.product_type       || '',
      product_category:   claim.product_category   || '',
      inspection_stage:   claim.inspection_stage   || '',
      cavity_total:       claim.cavity_total       != null ? String(claim.cavity_total)       : '',
      cavity_defective:   claim.cavity_defective   != null ? String(claim.cavity_defective)   : '',
      defect_quantity:    claim.defect_quantity     != null ? String(claim.defect_quantity)    : '',
      defect_type:        claim.defect_type        || '',
      defect_description: claim.defect_description || '',
      disposition:        claim.disposition        || '',
      notes:              claim.notes              || '',
    });
    setEditMode(true);
  };

  const handleSave = async () => {
    if (!editForm.supplier_name.trim()) { toast('입력 오류', '공급사명을 입력하세요', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        supplier_name:      editForm.supplier_name.trim(),
        purchase_dept:      editForm.purchase_dept      || null,
        incoming_date:      editForm.incoming_date      || null,
        incoming_lot_no:    editForm.incoming_lot_no.trim() || null,
        lot_number:         editForm.lot_number.trim()       || null,
        handler_name:       editForm.handler_name.trim()     || null,
        part_number:        editForm.part_number.trim()      || null,
        part_name:          editForm.part_name.trim()        || null,
        quantity:           editForm.quantity          !== '' ? parseInt(editForm.quantity)          : null,
        product_type:       editForm.product_type       || null,
        product_category:   editForm.product_category   || null,
        inspection_stage:   editForm.inspection_stage   || null,
        cavity_total:       editForm.cavity_total       !== '' ? parseInt(editForm.cavity_total)       : null,
        cavity_defective:   editForm.cavity_defective   !== '' ? parseInt(editForm.cavity_defective)   : null,
        defect_quantity:    editForm.defect_quantity     !== '' ? parseInt(editForm.defect_quantity)    : null,
        defect_type:        editForm.defect_type        || null,
        defect_description: editForm.defect_description.trim() || null,
        disposition:        editForm.disposition        || null,
        notes:              editForm.notes.trim()        || null,
      };
      await updateSupplierClaim(id, payload);
      updateClaimData(id, payload);
      setEditMode(false);
      toast('수정 완료', '', 'success');
    } catch (err) {
      toast('수정 실패', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const startEditAction = () => {
    setActionForm({
      improvement_status:       claim.improvement_status       || '미조치',
      corrective_action_type:   claim.corrective_action_type   || '',
      corrective_action_detail: claim.corrective_action_detail || '',
    });
    setEditingAction(true);
  };

  const handleSaveAction = async () => {
    setSavingAction(true);
    try {
      const payload = {
        improvement_status:       actionForm.improvement_status,
        corrective_action_type:   actionForm.corrective_action_type   || null,
        corrective_action_detail: actionForm.corrective_action_detail.trim() || null,
      };
      await updateSupplierClaim(id, payload);
      updateClaimData(id, payload);
      setEditingAction(false);
      toast('시정조치 저장 완료', '', 'success');
    } catch (err) {
      toast('저장 실패', err.message, 'error');
    } finally {
      setSavingAction(false);
    }
  };

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

  /* ── 개선 추적 ── */
  const handleAddImpLog = async () => {
    if (!impForm.incoming_lot_no.trim()) { toast('입력 필요', '차수를 입력하세요', 'error'); return; }
    setSavingImp(true);
    try {
      const log = await insertImprovementLog(id, impForm, user);
      addImprovementLog(log);
      setImpForm({ incoming_lot_no: '', incoming_date: '', quantity: '', defect_quantity: '', is_improved: '확인중', notes: '', handler: '' });
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

  const setEF  = (key) => (e) => setEditForm(prev => ({ ...prev, [key]: e.target.value }));
  const toggle = (key, val) => setEditForm(prev => ({ ...prev, [key]: prev[key] === val ? '' : val }));

  const qty     = claim.quantity;
  const defQty  = claim.defect_quantity;
  const defRate = qty > 0 && defQty != null ? ((defQty / qty) * 100).toFixed(1) : null;
  const eqty    = editForm ? parseFloat(editForm.quantity)        : 0;
  const edefQty = editForm ? parseFloat(editForm.defect_quantity) : 0;
  const edefRate = eqty > 0 && edefQty >= 0 ? ((edefQty / eqty) * 100).toFixed(1) : null;

  return (
    <div>
      <button className="back-btn" onClick={() => navigate('/supplier-claims')}>← 공급사 불량 목록으로</button>

      <div className="page-header">
        <div>
          <div className="page-title">{claim.supplier_name}</div>
          <div className="page-sub">
            공급사 불량 · 입고일: {claim.incoming_date || '미입력'}
            {claim.incoming_lot_no && <> · <strong>{claim.incoming_lot_no}</strong></>}
            {claim.part_number && <> · <span style={{ fontFamily: 'monospace' }}>{claim.part_number}</span></>}
            {claim.purchase_dept && <> · {claim.purchase_dept}</>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!editMode && <button className="btn btn-ghost btn-sm" onClick={startEdit}>✏️ 수정</button>}
          {isAdmin && (
            <button className="btn btn-sm" onClick={handleDelete} style={{ background: '#fee2e2', color: '#dc2626', border: 'none' }}>🗑 삭제</button>
          )}
        </div>
      </div>

      {/* ── 기본 정보 ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ marginBottom: 16 }}>
          <span className="card-title" style={{ margin: 0 }}>📋 불량 상세 정보</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: dc.bg, color: dc.text, fontWeight: 700 }}>
              {claim.disposition || '미결'}
            </span>
            {claim.inspection_stage && (
              <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: '#ccfbf1', color: '#0f766e', fontWeight: 600 }}>🔬 {claim.inspection_stage}</span>
            )}
            {claim.purchase_dept && (
              <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>{claim.purchase_dept}</span>
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
              <div className="form-group form-span-2">
                <label>구매 경로</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {PURCHASE_DEPTS.map(d => (
                    <button key={d} type="button" onClick={() => toggle('purchase_dept', d)}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit', background: editForm.purchase_dept === d ? '#0f766e' : '#fff', color: editForm.purchase_dept === d ? '#fff' : '#64748b', borderColor: editForm.purchase_dept === d ? '#0f766e' : '#e2e8f0' }}>{d}</button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>입고일자</label>
                <input type="date" value={editForm.incoming_date} onChange={setEF('incoming_date')} />
              </div>
              <div className="form-group">
                <label>입고 차수</label>
                <input placeholder="예: 1차, 2024-3차" value={editForm.incoming_lot_no} onChange={setEF('incoming_lot_no')} />
              </div>
              <div className="form-group">
                <label>입고 LOT</label>
                <input value={editForm.lot_number} onChange={setEF('lot_number')} />
              </div>
              <div className="form-group">
                <label>담당자</label>
                <input value={editForm.handler_name} onChange={setEF('handler_name')} />
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
                <label>불량 수량 (EA)</label>
                <input type="number" min="0" value={editForm.defect_quantity} onChange={setEF('defect_quantity')} />
              </div>
              <div className="form-group">
                <label>불량률 (자동)</label>
                <div style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', fontSize: 13, fontWeight: edefRate !== null ? 700 : 400, color: edefRate !== null ? (parseFloat(edefRate) > 5 ? '#dc2626' : '#059669') : '#94a3b8', display: 'flex', alignItems: 'center', minHeight: 38 }}>
                  {edefRate !== null ? `${parseFloat(edefRate) > 5 ? '🔴' : '🟢'} ${edefRate}%` : '—'}
                </div>
              </div>
              <div className="form-group" />
              <div className="form-group form-span-4">
                <label>품목 유형</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {PRODUCT_TYPES.map(t => <button key={t} type="button" onClick={() => toggle('product_type', t)} style={{ padding: '5px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit', background: editForm.product_type === t ? '#2563eb' : '#fff', color: editForm.product_type === t ? '#fff' : '#64748b', borderColor: editForm.product_type === t ? '#2563eb' : '#e2e8f0' }}>{t}</button>)}
                </div>
              </div>
              <div className="form-group form-span-4">
                <label>품목군</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {PRODUCT_CATEGORIES.map(c => <button key={c} type="button" onClick={() => toggle('product_category', c)} style={{ padding: '5px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit', background: editForm.product_category === c ? '#7c3aed' : '#fff', color: editForm.product_category === c ? '#fff' : '#64748b', borderColor: editForm.product_category === c ? '#7c3aed' : '#e2e8f0' }}>{c}</button>)}
                </div>
              </div>
              <div className="form-group form-span-4">
                <label>검사 단계</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {INSPECTION_STAGES.map(s => <button key={s} type="button" onClick={() => toggle('inspection_stage', s)} style={{ padding: '5px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit', background: editForm.inspection_stage === s ? '#0f766e' : '#fff', color: editForm.inspection_stage === s ? '#fff' : '#64748b', borderColor: editForm.inspection_stage === s ? '#0f766e' : '#e2e8f0' }}>{s}</button>)}
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
              <div className="form-group form-span-4">
                <label>불량 유형</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {DEFECT_TYPES.map(t => <button key={t} type="button" onClick={() => toggle('defect_type', t)} style={{ padding: '5px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit', background: editForm.defect_type === t ? '#dc2626' : '#fff', color: editForm.defect_type === t ? '#fff' : '#64748b', borderColor: editForm.defect_type === t ? '#dc2626' : '#e2e8f0' }}>{t}</button>)}
                </div>
              </div>
              <div className="form-group form-span-4">
                <label>불량 내용 상세</label>
                <textarea rows={4} value={editForm.defect_description} onChange={setEF('defect_description')} style={{ resize: 'vertical' }} />
              </div>
              <div className="form-group form-span-4">
                <label>처리 결과</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {DISPOSITION_TYPES.map(d => {
                    const c = DISPOSITION_COLORS[d];
                    return <button key={d} type="button" onClick={() => toggle('disposition', d)} style={{ padding: '6px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit', background: editForm.disposition === d ? c.text : '#fff', color: editForm.disposition === d ? '#fff' : '#64748b', borderColor: editForm.disposition === d ? c.text : '#e2e8f0' }}>{d}</button>;
                  })}
                </div>
              </div>
              <div className="form-group form-span-4">
                <label>비고</label>
                <input value={editForm.notes} onChange={setEF('notes')} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '💾 저장'}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditMode(false)}>취소</button>
            </div>
          </div>
        ) : (
          <div className="form-grid form-cols-4">
            <div className="form-group form-span-2"><Field label="공급사명" value={claim.supplier_name} /></div>
            <div className="form-group"><Field label="구매 경로" value={claim.purchase_dept} /></div>
            <div className="form-group"><Field label="담당자" value={claim.handler_name} /></div>

            <div className="form-group"><Field label="입고일자" value={claim.incoming_date} /></div>
            <div className="form-group"><Field label="입고 차수" value={claim.incoming_lot_no} /></div>
            <div className="form-group"><Field label="입고 LOT" value={claim.lot_number} mono /></div>
            <div className="form-group" />

            <div className="form-group"><Field label="품번" value={claim.part_number} mono /></div>
            <div className="form-group"><Field label="품명" value={claim.part_name} /></div>
            <div className="form-group">
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 3 }}>품목 유형</div>
              {claim.product_type ? <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: '#eff6ff', color: '#1d4ed8', fontWeight: 600 }}>{claim.product_type}</span> : <span style={{ color: '#cbd5e1', fontSize: 13 }}>—</span>}
            </div>
            <div className="form-group">
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 3 }}>품목군</div>
              {claim.product_category ? <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: '#f3e8ff', color: '#6b21a8', fontWeight: 600 }}>{claim.product_category}</span> : <span style={{ color: '#cbd5e1', fontSize: 13 }}>—</span>}
            </div>

            <div className="form-group form-span-2">
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 3 }}>검사 단계</div>
              {claim.inspection_stage ? <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: '#ccfbf1', color: '#0f766e', fontWeight: 600 }}>🔬 {claim.inspection_stage}</span> : <span style={{ color: '#cbd5e1', fontSize: 13 }}>—</span>}
            </div>
            {claim.inspection_stage === '부품 수입검사' ? (
              <div className="form-group form-span-2">
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 3 }}>캐비티 현황</div>
                <div style={{ fontSize: 13, color: '#0f172a' }}>
                  {claim.cavity_total != null
                    ? <>총 {claim.cavity_total}개 중 불량 {claim.cavity_defective ?? '?'}개{claim.cavity_total > 0 && claim.cavity_defective != null && <span style={{ marginLeft: 8, fontSize: 12, color: '#dc2626', fontWeight: 700 }}>({((claim.cavity_defective / claim.cavity_total) * 100).toFixed(1)}%)</span>}</>
                    : '—'}
                </div>
              </div>
            ) : <div className="form-group form-span-2" />}

            <div className="form-group">
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 3 }}>입고 수량</div>
              <div style={{ fontSize: 13 }}>{qty != null ? qty.toLocaleString() + ' EA' : '—'}</div>
            </div>
            <div className="form-group">
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 3 }}>불량 수량 / 불량률</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: defRate !== null ? (parseFloat(defRate) > 5 ? '#dc2626' : '#059669') : '#0f172a' }}>
                {defQty != null ? defQty.toLocaleString() + ' EA' : '—'}
                {defRate !== null && <span style={{ fontWeight: 400, color: '#64748b', marginLeft: 6 }}>({defRate}%)</span>}
              </div>
            </div>
            <div className="form-group form-span-2">
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 3 }}>불량 유형</div>
              {claim.defect_type ? <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: '#fee2e2', color: '#991b1b', fontWeight: 600 }}>{claim.defect_type}</span> : <span style={{ color: '#cbd5e1', fontSize: 13 }}>—</span>}
            </div>

            <div className="form-group form-span-4">
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 3 }}>불량 내용 상세</div>
              <div style={{ fontSize: 13, color: '#0f172a', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{claim.defect_description || '—'}</div>
            </div>

            <div className="form-group form-span-2">
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>처리 결과</div>
              <span style={{ fontSize: 13, padding: '4px 12px', borderRadius: 99, background: dc.bg, color: dc.text, fontWeight: 700 }}>{claim.disposition || '미결'}</span>
            </div>
            {claim.notes && (
              <div className="form-group form-span-2"><Field label="비고" value={claim.notes} /></div>
            )}
          </div>
        )}
      </div>

      {/* ── 시정조치 현황 ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ marginBottom: editingAction ? 16 : 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="card-title" style={{ margin: 0 }}>🔧 시정조치 현황</span>
            {(() => {
              const st = claim.improvement_status || '미조치';
              const ic = IMPROVEMENT_STATUS_COLORS[st];
              return <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: ic.bg, color: ic.text, fontWeight: 700 }}>{st}</span>;
            })()}
            {claim.corrective_action_type && !editingAction && (
              <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: '#eff6ff', color: '#1d4ed8', fontWeight: 600 }}>{claim.corrective_action_type}</span>
            )}
          </div>
          {!editingAction && (
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={startEditAction}>✏️ 수정</button>
          )}
        </div>

        {editingAction ? (
          <div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>조치 상태</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {IMPROVEMENT_STATUS_OPTIONS.map(st => {
                  const ic = IMPROVEMENT_STATUS_COLORS[st];
                  const active = actionForm.improvement_status === st;
                  return (
                    <button key={st} type="button"
                      onClick={() => setActionForm(p => ({ ...p, improvement_status: st }))}
                      style={{ padding: '7px 22px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '2px solid', fontFamily: 'inherit', background: active ? ic.text : '#fff', color: active ? '#fff' : '#64748b', borderColor: active ? ic.text : '#e2e8f0', transition: '.12s' }}>
                      {st}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>조치 유형</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CORRECTIVE_ACTION_TYPES.map(t => {
                  const active = actionForm.corrective_action_type === t;
                  return (
                    <button key={t} type="button"
                      onClick={() => setActionForm(p => ({ ...p, corrective_action_type: p.corrective_action_type === t ? '' : t }))}
                      style={{ padding: '5px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit', background: active ? '#2563eb' : '#fff', color: active ? '#fff' : '#64748b', borderColor: active ? '#2563eb' : '#e2e8f0' }}>
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>조치 내용 상세</div>
              <textarea
                rows={3}
                placeholder="예) 공급사에 불량 클레임 통보 및 재발방지 대책 요청 (2024-06-30), 2차 입고분부터 전수검사 실시 예정"
                value={actionForm.corrective_action_detail}
                onChange={e => setActionForm(p => ({ ...p, corrective_action_detail: e.target.value }))}
                style={{ width: '100%', resize: 'vertical', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={handleSaveAction} disabled={savingAction}>{savingAction ? '저장 중...' : '💾 저장'}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingAction(false)}>취소</button>
            </div>
          </div>
        ) : (
          <div>
            {claim.corrective_action_detail ? (
              <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.7, background: '#f8fafc', borderRadius: 8, padding: '10px 14px', border: '1px solid #e2e8f0' }}>
                {claim.corrective_action_detail}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#94a3b8' }}>
                {(claim.improvement_status || '미조치') === '미조치'
                  ? '아직 시정조치가 등록되지 않았습니다. 수정 버튼을 눌러 조치 내용을 입력하세요.'
                  : '조치 내용 상세가 없습니다.'}
              </div>
            )}
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
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>이후 입고 차수에서 동일 불량이 개선되었는지 기록합니다.</div>

        {addingImp && (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#065f46', marginBottom: 12 }}>➕ 신규 차수 추적 등록</div>
            <div className="form-grid form-cols-4">
              <div className="form-group form-span-2">
                <label>차수 <span className="required-star">*</span></label>
                <input placeholder="예: 2차, 2024-4차" value={impForm.incoming_lot_no} onChange={e => setImpForm(p => ({ ...p, incoming_lot_no: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>입고일</label>
                <input type="date" value={impForm.incoming_date} onChange={e => setImpForm(p => ({ ...p, incoming_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>담당자</label>
                <input placeholder="이름" value={impForm.handler} onChange={e => setImpForm(p => ({ ...p, handler: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>입고 수량 (EA)</label>
                <input type="number" min="0" value={impForm.quantity} onChange={e => setImpForm(p => ({ ...p, quantity: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>불량 수량 (EA)</label>
                <input type="number" min="0" value={impForm.defect_quantity} onChange={e => setImpForm(p => ({ ...p, defect_quantity: e.target.value }))} />
              </div>
              <div className="form-group form-span-2">
                <label>개선 여부</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {IMPROVEMENT_RESULTS.map(r => {
                    const c = IMPROVE_COLORS[r];
                    return <button key={r} type="button" onClick={() => setImpForm(p => ({ ...p, is_improved: r }))} style={{ padding: '6px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit', background: impForm.is_improved === r ? c.text : '#fff', color: impForm.is_improved === r ? '#fff' : '#64748b', borderColor: impForm.is_improved === r ? c.text : '#e2e8f0' }}>{r}</button>;
                  })}
                </div>
              </div>
              <div className="form-group form-span-4">
                <label>비고</label>
                <input placeholder="특이사항" value={impForm.notes} onChange={e => setImpForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn btn-primary btn-sm" onClick={handleAddImpLog} disabled={savingImp}>{savingImp ? '저장 중...' : '💾 저장'}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setAddingImp(false)}>취소</button>
            </div>
          </div>
        )}

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
                          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 99, background: ic.bg, color: ic.text, fontWeight: 700, border: `1px solid ${ic.text}30` }}>{log.is_improved}</span>
                          {log.incoming_date && <span style={{ fontSize: 12, color: '#64748b' }}>{log.incoming_date}</span>}
                          {log.handler && <span style={{ fontSize: 11, color: '#94a3b8' }}>{log.handler}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {log.quantity != null && <span>입고: {log.quantity.toLocaleString()}EA</span>}
                          {log.defect_quantity != null && (
                            <span style={{ color: log.defect_quantity > 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>
                              불량: {log.defect_quantity.toLocaleString()}EA{logDefRate !== null && ` (${logDefRate}%)`}
                            </span>
                          )}
                          {log.notes && <span style={{ color: '#475569' }}>💬 {log.notes}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => { setEditingImpId(log.id); setImpEditForm({ ...log }); }}>수정</button>
                        {isAdmin && <button className="btn btn-sm" style={{ fontSize: 11, background: '#fee2e2', color: '#dc2626', border: 'none' }} onClick={() => handleDeleteImpLog(log.id)}>삭제</button>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SupplierFileAttachments claimId={id} user={user} isAdmin={isAdmin} />

      {partSearchOpen && (
        <PartSearchModal
          onSelect={(pn, pm) => setEditForm(prev => prev ? { ...prev, part_number: pn, part_name: pm } : prev)}
          onClose={() => setPartSearchOpen(false)}
        />
      )}
    </div>
  );
}
