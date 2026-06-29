import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSupplierClaims } from '../context/SupplierClaimsContext';
import { useToast } from '../context/ToastContext';
import {
  insertSupplierClaim,
  PRODUCT_TYPES, PRODUCT_CATEGORIES, DEPARTMENTS,
  DEFECT_TYPES, RETURN_STATUSES, INSPECTION_STAGES,
} from '../lib/supabase';
import PartSearchModal from '../components/PartSearchModal';
import SupplierSearch from '../components/SupplierSearch';

const today = () => new Date().toISOString().slice(0, 10);

const INITIAL = {
  supplier_name:      '',
  part_number:        '',
  part_name:          '',
  product_type:       '',
  product_category:   '',
  quantity:           '',
  lot_number:         '',          // 입고 LOT
  incoming_lot_no:    '',          // 입고 차수 (e.g. 1차, 2024-1차)
  defect_quantity:    '',
  defect_type:        '',
  defect_description: '',
  incoming_date:      today(),     // 입고일자
  receipt_date:       today(),     // 접수일
  inspection_stage:   '',          // 부품 수입검사 / 완제품 입고검사 / 출하검사
  cavity_total:       '',          // 캐비티 총 수 (부품 수입검사 시)
  cavity_defective:   '',          // 불량 캐비티 수
  return_status:      '미결',
  handler_dept:       '',
  handler_name:       '',
  handler_contact:    '',
};

export default function NewSupplierClaim() {
  const { user }     = useAuth();
  const { addClaim } = useSupplierClaims();
  const toast        = useToast();
  const navigate     = useNavigate();
  const [form, setForm]                     = useState(INITIAL);
  const [submitting, setSub]                = useState(false);
  const [partSearchOpen, setPartSearchOpen] = useState(false);

  if (!user) return (
    <div>
      <div className="page-header"><div className="page-title">공급사 불량 접수</div></div>
      <div className="error-box">⚠️ 접수는 로그인 후 가능합니다.</div>
    </div>
  );

  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));
  const setVal = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handlePartSelect = (partNumber, partName) => {
    setForm(prev => ({ ...prev, part_number: partNumber, part_name: partName }));
  };

  const qty     = parseFloat(form.quantity);
  const defQty  = parseFloat(form.defect_quantity);
  const defRate = qty > 0 && defQty >= 0 ? ((defQty / qty) * 100).toFixed(1) : null;
  const isPartInspection = form.inspection_stage === '부품 수입검사';

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.supplier_name.trim())      { toast('입력 오류', '공급사명을 입력하세요', 'error'); return; }
    if (!form.incoming_date)             { toast('입력 오류', '입고일자를 선택하세요', 'error'); return; }
    if (!form.handler_dept)              { toast('입력 오류', '담당 부서를 선택하세요', 'error'); return; }
    if (!form.handler_name.trim())       { toast('입력 오류', '담당자를 입력하세요', 'error'); return; }
    if (!form.handler_contact.trim())    { toast('입력 오류', '담당자 연락처를 입력하세요', 'error'); return; }
    if (!form.part_number.trim())        { toast('입력 오류', '품번을 입력하세요', 'error'); return; }
    if (!form.part_name.trim())          { toast('입력 오류', '품명을 입력하세요', 'error'); return; }
    if (form.quantity === '')            { toast('입력 오류', '입고 수량을 입력하세요', 'error'); return; }
    if (!form.lot_number.trim())         { toast('입력 오류', '입고 LOT를 입력하세요', 'error'); return; }
    if (!form.product_type)              { toast('입력 오류', '품목 유형을 선택하세요', 'error'); return; }
    if (!form.product_category)          { toast('입력 오류', '품목군을 선택하세요', 'error'); return; }
    if (!form.inspection_stage)          { toast('입력 오류', '검사 단계를 선택하세요', 'error'); return; }
    if (form.defect_quantity === '')     { toast('입력 오류', '불량 수량을 입력하세요', 'error'); return; }
    if (defQty > qty)                    { toast('입력 오류', '불량 수량이 입고 수량보다 클 수 없습니다', 'error'); return; }
    if (!form.defect_type)               { toast('입력 오류', '불량 유형을 선택하세요', 'error'); return; }
    if (!form.defect_description.trim()) { toast('입력 오류', '불량 내용을 입력하세요', 'error'); return; }
    if (isPartInspection && form.cavity_total !== '' && form.cavity_defective !== '') {
      if (parseFloat(form.cavity_defective) > parseFloat(form.cavity_total)) {
        toast('입력 오류', '불량 캐비티 수가 총 캐비티 수보다 클 수 없습니다', 'error'); return;
      }
    }

    setSub(true);
    try {
      const payload = {
        ...form,
        quantity:          parseInt(form.quantity),
        defect_quantity:   parseInt(form.defect_quantity),
        cavity_total:      form.cavity_total !== '' ? parseInt(form.cavity_total) : null,
        cavity_defective:  form.cavity_defective !== '' ? parseInt(form.cavity_defective) : null,
        supplier_name:     form.supplier_name.trim(),
        part_number:       form.part_number.trim(),
        part_name:         form.part_name.trim(),
        lot_number:        form.lot_number.trim(),
        incoming_lot_no:   form.incoming_lot_no.trim() || null,
        product_type:      form.product_type      || null,
        product_category:  form.product_category  || null,
        defect_type:       form.defect_type        || null,
        inspection_stage:  form.inspection_stage   || null,
        defect_description: form.defect_description.trim(),
        handler_dept:      form.handler_dept       || null,
        handler_name:      form.handler_name.trim(),
        handler_contact:   form.handler_contact.trim(),
        incoming_date:     form.incoming_date || null,
        receipt_date:      form.receipt_date  || null,
        return_status:     form.return_status || '미결',
      };
      const { claim, firstEntry } = await insertSupplierClaim(payload, user);
      addClaim(claim, firstEntry);
      toast('접수 완료', `${form.supplier_name} 공급사 불량이 등록되었습니다`, 'success');
      navigate(`/supplier-claims/${claim.id}`);
    } catch (err) {
      toast('접수 실패', err.message, 'error');
    } finally {
      setSub(false);
    }
  };

  return (
    <div>
      <button className="back-btn" onClick={() => navigate('/supplier-claims')}>← 공급사 불량 목록으로</button>
      <div className="page-header">
        <div>
          <div className="page-title">공급사 불량 접수</div>
          <div className="page-sub">입고 검사 등에서 발견된 공급사 불량을 등록합니다 · <span style={{ color: '#ef4444' }}>*</span> 항목은 필수입니다</div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* 접수 기본 정보 */}
        <div className="form-card" style={{ marginBottom: 16 }}>
          <div className="form-card-title">📌 접수 기본 정보</div>
          <div className="form-grid form-cols-4">

            <div className="form-group form-span-2">
              <label>공급사명 <span className="required-star">*</span></label>
              <SupplierSearch
                value={form.supplier_name}
                onChange={v => setVal('supplier_name', v)}
              />
            </div>
            <div className="form-group">
              <label>입고일자 <span className="required-star">*</span></label>
              <input type="date" value={form.incoming_date} onChange={set('incoming_date')} required />
            </div>
            <div className="form-group">
              <label>접수일</label>
              <input type="date" value={form.receipt_date} onChange={set('receipt_date')} />
            </div>

            <div className="form-group form-span-2">
              <label>입고 차수</label>
              <input
                placeholder="예: 1차, 2024-3차"
                value={form.incoming_lot_no}
                onChange={set('incoming_lot_no')}
              />
            </div>

            <div className="form-group">
              <label>담당 부서 <span className="required-star">*</span></label>
              <select value={form.handler_dept} onChange={set('handler_dept')} required>
                <option value="">부서 선택</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>담당자 <span className="required-star">*</span></label>
              <input placeholder="이름" value={form.handler_name} onChange={set('handler_name')} required />
            </div>
            <div className="form-group form-span-2">
              <label>담당자 연락처 <span className="required-star">*</span></label>
              <input placeholder="010-0000-0000" value={form.handler_contact} onChange={set('handler_contact')} required />
            </div>
          </div>
        </div>

        {/* 입고 정보 */}
        <div className="form-card" style={{ marginBottom: 16 }}>
          <div className="form-card-title">📦 입고 정보</div>
          <div className="form-grid form-cols-4">
            <div className="form-group">
              <label>품번 <span className="required-star">*</span></label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={form.part_number} onChange={set('part_number')} placeholder="품번 입력" style={{ flex: 1 }} required />
                <button type="button" className="btn btn-ghost btn-icon" title="품번/품명 검색"
                  onClick={() => setPartSearchOpen(true)} style={{ flexShrink: 0 }}>🔍</button>
              </div>
            </div>
            <div className="form-group">
              <label>품명 <span className="required-star">*</span></label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={form.part_name} onChange={set('part_name')} placeholder="품명 입력" style={{ flex: 1 }} required />
                <button type="button" className="btn btn-ghost btn-icon" title="품번/품명 검색"
                  onClick={() => setPartSearchOpen(true)} style={{ flexShrink: 0 }}>🔍</button>
              </div>
            </div>
            <div className="form-group">
              <label>입고 수량 (EA) <span className="required-star">*</span></label>
              <input type="number" placeholder="0" min="0" value={form.quantity} onChange={set('quantity')} required />
            </div>
            <div className="form-group">
              <label>입고 LOT <span className="required-star">*</span></label>
              <input placeholder="LOT 번호" value={form.lot_number} onChange={set('lot_number')} required />
            </div>
            <div className="form-group form-span-4">
              <label>품목 유형 <span className="required-star">*</span></label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PRODUCT_TYPES.map(t => (
                  <button key={t} type="button"
                    onClick={() => setForm(prev => ({ ...prev, product_type: prev.product_type === t ? '' : t }))}
                    style={{
                      padding: '6px 20px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', border: '1.5px solid',
                      background: form.product_type === t ? '#2563eb' : '#fff',
                      color: form.product_type === t ? '#fff' : '#64748b',
                      borderColor: form.product_type === t ? '#2563eb' : '#e2e8f0',
                      transition: '.15s', fontFamily: 'inherit',
                    }}
                  >{t}</button>
                ))}
              </div>
            </div>
            <div className="form-group form-span-4">
              <label>품목군 <span className="required-star">*</span></label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PRODUCT_CATEGORIES.map(c => (
                  <button key={c} type="button"
                    onClick={() => setForm(prev => ({ ...prev, product_category: prev.product_category === c ? '' : c }))}
                    style={{
                      padding: '6px 20px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', border: '1.5px solid',
                      background: form.product_category === c ? '#7c3aed' : '#fff',
                      color: form.product_category === c ? '#fff' : '#64748b',
                      borderColor: form.product_category === c ? '#7c3aed' : '#e2e8f0',
                      transition: '.15s', fontFamily: 'inherit',
                    }}
                  >{c}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 검사 단계 & 불량 내용 */}
        <div className="form-card">
          <div className="form-card-title">⚠️ 검사 단계 및 불량 내용</div>
          <div className="form-grid form-cols-4">

            {/* 검사 단계 */}
            <div className="form-group form-span-4">
              <label>불량 발생 검사 단계 <span className="required-star">*</span></label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {INSPECTION_STAGES.map(s => (
                  <button key={s} type="button"
                    onClick={() => setForm(prev => ({
                      ...prev,
                      inspection_stage: prev.inspection_stage === s ? '' : s,
                      cavity_total: s !== '부품 수입검사' ? '' : prev.cavity_total,
                      cavity_defective: s !== '부품 수입검사' ? '' : prev.cavity_defective,
                    }))}
                    style={{
                      padding: '8px 20px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', border: '1.5px solid',
                      background: form.inspection_stage === s ? '#0f766e' : '#fff',
                      color: form.inspection_stage === s ? '#fff' : '#64748b',
                      borderColor: form.inspection_stage === s ? '#0f766e' : '#e2e8f0',
                      transition: '.15s', fontFamily: 'inherit',
                    }}
                  >{s}</button>
                ))}
              </div>
            </div>

            {/* 캐비티 정보 (부품 수입검사 선택 시) */}
            {isPartInspection && (
              <>
                <div className="form-group">
                  <label>캐비티 총 수</label>
                  <input type="number" placeholder="예: 16" min="1"
                    value={form.cavity_total} onChange={set('cavity_total')} />
                </div>
                <div className="form-group">
                  <label>불량 캐비티 수</label>
                  <input type="number" placeholder="예: 3" min="0"
                    value={form.cavity_defective} onChange={set('cavity_defective')} />
                </div>
                {form.cavity_total && form.cavity_defective && (
                  <div className="form-group">
                    <label>캐비티 불량률 (자동)</label>
                    <div style={{
                      padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc',
                      fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, minHeight: 38,
                      color: parseFloat(form.cavity_defective) / parseFloat(form.cavity_total) > 0.1 ? '#dc2626' : '#059669',
                    }}>
                      {((parseFloat(form.cavity_defective) / parseFloat(form.cavity_total)) * 100).toFixed(1)}%
                      <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>
                        ({form.cavity_defective}/{form.cavity_total} 캐비티)
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 불량 수량 */}
            <div className="form-group">
              <label>불량 수량 (EA) <span className="required-star">*</span></label>
              <input type="number" placeholder="0" min="0"
                value={form.defect_quantity} onChange={set('defect_quantity')} required />
            </div>
            <div className="form-group">
              <label>불량률 (자동 계산)</label>
              <div style={{
                padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc',
                fontSize: 13, color: defRate !== null ? (parseFloat(defRate) > 5 ? '#dc2626' : '#059669') : '#94a3b8',
                fontWeight: defRate !== null ? 700 : 400,
                display: 'flex', alignItems: 'center', gap: 6, minHeight: 38,
              }}>
                {defRate !== null
                  ? <><span style={{ fontSize: 15 }}>{parseFloat(defRate) > 5 ? '🔴' : '🟢'}</span>{defRate}%
                      <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>({defQty}/{qty}개)</span></>
                  : <span style={{ fontSize: 12 }}>입고 수량 · 불량 수량 입력 시 자동 계산</span>
                }
              </div>
            </div>

            {/* 불량 유형 */}
            <div className="form-group form-span-4">
              <label>불량 유형 <span className="required-star">*</span></label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {DEFECT_TYPES.map(t => (
                  <button key={t} type="button"
                    onClick={() => setForm(prev => ({ ...prev, defect_type: prev.defect_type === t ? '' : t }))}
                    style={{
                      padding: '6px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', border: '1.5px solid',
                      background: form.defect_type === t ? '#dc2626' : '#fff',
                      color: form.defect_type === t ? '#fff' : '#64748b',
                      borderColor: form.defect_type === t ? '#dc2626' : '#e2e8f0',
                      transition: '.15s', fontFamily: 'inherit',
                    }}
                  >{t}</button>
                ))}
              </div>
            </div>

            {/* 반품/교환 상태 */}
            <div className="form-group form-span-4">
              <label>반품/교환 상태</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {RETURN_STATUSES.map(s => (
                  <button key={s} type="button"
                    onClick={() => setVal('return_status', s)}
                    style={{
                      padding: '6px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', border: '1.5px solid',
                      background: form.return_status === s ? '#0891b2' : '#fff',
                      color: form.return_status === s ? '#fff' : '#64748b',
                      borderColor: form.return_status === s ? '#0891b2' : '#e2e8f0',
                      transition: '.15s', fontFamily: 'inherit',
                    }}
                  >{s}</button>
                ))}
              </div>
            </div>

            {/* 불량 상세 내용 */}
            <div className="form-group form-span-4">
              <label>불량 내용 상세 <span className="required-star">*</span></label>
              <textarea rows={4}
                placeholder="불량 증상, 발생 상황, 입고 검사 내용 등을 상세히 입력하세요"
                value={form.defect_description} onChange={set('defect_description')}
                required style={{ resize: 'vertical' }}
              />
            </div>
          </div>
        </div>

        <div className="form-actions" style={{ marginTop: 16 }}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? '⏳ 등록 중...' : '📥 불량 접수 등록'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/supplier-claims')}>취소</button>
        </div>
      </form>

      {partSearchOpen && (
        <PartSearchModal onSelect={handlePartSelect} onClose={() => setPartSearchOpen(false)} />
      )}
    </div>
  );
}
