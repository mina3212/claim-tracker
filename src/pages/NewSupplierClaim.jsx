import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSupplierClaims } from '../context/SupplierClaimsContext';
import { useToast } from '../context/ToastContext';
import { insertSupplierClaim, PRODUCT_TYPES, PRODUCT_CATEGORIES, DEPARTMENTS, DEFECT_TYPES, RETURN_STATUSES } from '../lib/supabase';
import PartSearchModal from '../components/PartSearchModal';

const today = () => new Date().toISOString().slice(0, 10);

const INITIAL = {
  supplier_name:      '',
  part_number:        '',
  part_name:          '',
  product_type:       '',
  product_category:   '',
  quantity:           '',
  lot_number:         '',
  defect_quantity:    '',
  defect_type:        '',
  defect_description: '',
  occurrence_date:    '',
  receipt_date:       today(),
  return_status:      '미결',
  handler_dept:       '',
  handler_name:       '',
  handler_contact:    '',
};

export default function NewSupplierClaim() {
  const { user }    = useAuth();
  const { addClaim } = useSupplierClaims();
  const toast       = useToast();
  const navigate    = useNavigate();
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

  const handlePartSelect = (partNumber, partName) => {
    setForm(prev => ({ ...prev, part_number: partNumber, part_name: partName }));
  };

  const qty     = parseFloat(form.quantity);
  const defQty  = parseFloat(form.defect_quantity);
  const defRate = qty > 0 && defQty >= 0 ? ((defQty / qty) * 100).toFixed(1) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.supplier_name.trim())    { toast('입력 오류', '공급사명을 입력하세요', 'error'); return; }
    if (!form.occurrence_date)         { toast('입력 오류', '발생일을 선택하세요', 'error'); return; }
    if (!form.handler_dept)            { toast('입력 오류', '담당 부서를 선택하세요', 'error'); return; }
    if (!form.handler_name.trim())     { toast('입력 오류', '담당자를 입력하세요', 'error'); return; }
    if (!form.handler_contact.trim())  { toast('입력 오류', '담당자 연락처를 입력하세요', 'error'); return; }
    if (!form.part_number.trim())      { toast('입력 오류', '품번을 입력하세요', 'error'); return; }
    if (!form.part_name.trim())        { toast('입력 오류', '품명을 입력하세요', 'error'); return; }
    if (form.quantity === '')          { toast('입력 오류', '입고 수량을 입력하세요', 'error'); return; }
    if (!form.lot_number.trim())       { toast('입력 오류', 'LOT 번호를 입력하세요', 'error'); return; }
    if (!form.product_type)            { toast('입력 오류', '품목 유형을 선택하세요', 'error'); return; }
    if (!form.product_category)        { toast('입력 오류', '품목군을 선택하세요', 'error'); return; }
    if (form.defect_quantity === '')   { toast('입력 오류', '불량 수량을 입력하세요', 'error'); return; }
    if (defQty > qty)                  { toast('입력 오류', '불량 수량이 입고 수량보다 클 수 없습니다', 'error'); return; }
    if (!form.defect_type)             { toast('입력 오류', '불량 유형을 선택하세요', 'error'); return; }
    if (!form.defect_description.trim()){ toast('입력 오류', '불량 내용을 입력하세요', 'error'); return; }

    setSub(true);
    try {
      const payload = {
        ...form,
        quantity:           parseInt(form.quantity),
        defect_quantity:    parseInt(form.defect_quantity),
        supplier_name:      form.supplier_name.trim(),
        part_number:        form.part_number.trim(),
        part_name:          form.part_name.trim(),
        lot_number:         form.lot_number.trim(),
        product_type:       form.product_type || null,
        product_category:   form.product_category || null,
        defect_type:        form.defect_type || null,
        defect_description: form.defect_description.trim(),
        handler_dept:       form.handler_dept || null,
        handler_name:       form.handler_name.trim(),
        handler_contact:    form.handler_contact.trim(),
        occurrence_date:    form.occurrence_date,
        receipt_date:       form.receipt_date || null,
        return_status:      form.return_status || '미결',
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
              <input placeholder="예: 삼성전자" value={form.supplier_name} onChange={set('supplier_name')} required />
            </div>
            <div className="form-group">
              <label>발생일 <span className="required-star">*</span></label>
              <input type="date" value={form.occurrence_date} onChange={set('occurrence_date')} required />
            </div>
            <div className="form-group">
              <label>접수일</label>
              <input type="date" value={form.receipt_date} onChange={set('receipt_date')} />
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
            <div className="form-group">
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
              <label>LOT 번호 <span className="required-star">*</span></label>
              <input placeholder="LOT" value={form.lot_number} onChange={set('lot_number')} required />
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

        {/* 불량 내용 */}
        <div className="form-card">
          <div className="form-card-title">⚠️ 불량 내용</div>
          <div className="form-grid form-cols-4">
            <div className="form-group">
              <label>불량 수량 (EA) <span className="required-star">*</span></label>
              <input type="number" placeholder="0" min="0" value={form.defect_quantity} onChange={set('defect_quantity')} required />
            </div>
            <div className="form-group">
              <label>불량률 (자동 계산)</label>
              <div style={{
                padding: '8px 12px', border: '1px solid #e2e8f0',
                borderRadius: 8, background: '#f8fafc',
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
            <div className="form-group form-span-4">
              <label>반품/교환 상태</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {RETURN_STATUSES.map(s => (
                  <button key={s} type="button"
                    onClick={() => setForm(prev => ({ ...prev, return_status: s }))}
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
