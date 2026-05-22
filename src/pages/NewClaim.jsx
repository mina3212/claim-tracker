import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useClaims } from '../context/ClaimsContext';
import { useToast } from '../context/ToastContext';
import { insertClaim, CUSTOMER_GROUPS, PRODUCT_TYPES } from '../lib/supabase';
import PartSearchModal from '../components/PartSearchModal';
import Tooltip from '../components/Tooltip';

const today = () => new Date().toISOString().slice(0, 10);

const INITIAL = {
  customer_group: '',
  customer_name: '',
  occurrence_date: '',
  receipt_date: today(),
  sales_rep_name: '',
  sales_rep_contact: '',
  part_number: '',
  part_name: '',
  product_type: '',
  quantity: '',
  lot_number: '',
  defect_description: '',
};

export default function NewClaim() {
  const { user }     = useAuth();
  const { addClaim } = useClaims();
  const toast        = useToast();
  const navigate     = useNavigate();
  const [form, setForm]           = useState(INITIAL);
  const [submitting, setSub]      = useState(false);
  const [partSearchOpen, setPartSearchOpen] = useState(false);

  if (!user) return (
    <div>
      <div className="page-header"><div className="page-title">클레임 접수</div></div>
      <div className="error-box">⚠️ 클레임 접수는 로그인 후 가능합니다. 사이드바에서 로그인 / 회원가입 해주세요.</div>
    </div>
  );

  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handlePartSelect = (partNumber, partName) => {
    setForm(prev => ({ ...prev, part_number: partNumber, part_name: partName }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_name.trim()) { toast('입력 오류', '고객사명을 입력하세요', 'error'); return; }
    if (!form.part_number.trim() && !form.part_name.trim()) { toast('입력 오류', '품번 또는 품명을 입력하세요', 'error'); return; }
    if (!form.defect_description.trim()) { toast('입력 오류', '불량내용을 입력하세요', 'error'); return; }

    setSub(true);
    try {
      const payload = {
        ...form,
        quantity:           form.quantity !== '' ? parseInt(form.quantity) : null,
        customer_name:      form.customer_name.trim(),
        customer_group:     form.customer_group || null,
        product_type:       form.product_type || null,
        defect_description: form.defect_description.trim(),
        sales_rep_name:     form.sales_rep_name.trim() || null,
        sales_rep_contact:  form.sales_rep_contact.trim() || null,
        part_number:        form.part_number.trim() || null,
        part_name:          form.part_name.trim() || null,
        lot_number:         form.lot_number.trim() || null,
        occurrence_date:    form.occurrence_date || null,
        receipt_date:       form.receipt_date || null,
      };
      const { claim, firstEntry } = await insertClaim(payload, user);
      addClaim(claim, firstEntry);
      toast('클레임 접수 완료', `${form.customer_name} 클레임이 등록되었습니다`, 'success');
      navigate(`/claims/${claim.id}`);
    } catch (err) {
      toast('접수 실패', err.message, 'error');
    } finally {
      setSub(false);
    }
  };

  return (
    <div>
      <button className="back-btn" onClick={() => navigate('/claims')}>← 클레임 목록으로</button>
      <div className="page-header">
        <div>
          <div className="page-title">클레임 접수</div>
          <div className="page-sub">고객사로부터 접수된 클레임을 등록합니다</div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* 접수 기본 정보 */}
        <div className="form-card" style={{ marginBottom: 16 }}>
          <div className="form-card-title">📌 접수 기본 정보</div>
          <div className="form-grid form-cols-4">
            <div className="form-group form-span-4">
              <label>고객사 그룹</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CUSTOMER_GROUPS.map(g => (
                  <button
                    key={g} type="button"
                    onClick={() => setForm(prev => ({ ...prev, customer_group: prev.customer_group === g ? '' : g }))}
                    style={{
                      padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', border: '1.5px solid',
                      background: form.customer_group === g ? '#0f172a' : '#fff',
                      color: form.customer_group === g ? '#fff' : '#64748b',
                      borderColor: form.customer_group === g ? '#0f172a' : '#e2e8f0',
                      transition: '.15s', fontFamily: 'inherit',
                    }}
                  >{g}</button>
                ))}
              </div>
            </div>
            <div className="form-group form-span-2">
              <label>고객사명 <span className="required-star">*</span></label>
              <input placeholder="예: ABC전자" value={form.customer_name} onChange={set('customer_name')} required />
            </div>
            <div className="form-group">
              <label>발생일</label>
              <input type="date" value={form.occurrence_date} onChange={set('occurrence_date')} />
            </div>
            <div className="form-group">
              <label>접수일</label>
              <input type="date" value={form.receipt_date} onChange={set('receipt_date')} />
            </div>
            <div className="form-group">
              <label>영업담당자</label>
              <input placeholder="이름" value={form.sales_rep_name} onChange={set('sales_rep_name')} />
            </div>
            <div className="form-group">
              <label>담당자 연락처</label>
              <input placeholder="010-0000-0000" value={form.sales_rep_contact} onChange={set('sales_rep_contact')} />
            </div>
          </div>
        </div>

        {/* 출고 정보 */}
        <div className="form-card" style={{ marginBottom: 16 }}>
          <div className="form-card-title">📦 출고 정보</div>
          <div className="form-grid form-cols-4">
            <div className="form-group">
              <label>품번</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={form.part_number} onChange={set('part_number')} placeholder="품번 입력" style={{ flex: 1 }} />
                <button type="button" className="btn btn-ghost btn-icon" title="품번/품명 검색" onClick={() => setPartSearchOpen(true)} style={{ flexShrink: 0 }}>🔍</button>
              </div>
            </div>
            <div className="form-group">
              <label>품명</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={form.part_name} onChange={set('part_name')} placeholder="품명 입력" style={{ flex: 1 }} />
                <button type="button" className="btn btn-ghost btn-icon" title="품번/품명 검색" onClick={() => setPartSearchOpen(true)} style={{ flexShrink: 0 }}>🔍</button>
              </div>
            </div>
            <div className="form-group">
              <label>수량 (EA)</label>
              <input type="number" placeholder="0" min="0" value={form.quantity} onChange={set('quantity')} />
            </div>
            <div className="form-group">
              <label>LOT 번호</label>
              <input placeholder="LOT" value={form.lot_number} onChange={set('lot_number')} />
            </div>
            <div className="form-group form-span-4">
              <label>품목 유형</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PRODUCT_TYPES.map(t => {
                  const tips = { '수입품': '해외 수입 품목', '자체제작상품': 'AJW, SCON, AJP 직접생산품', '내수품': '국내 구매 품목' };
                  return (
                    <Tooltip key={t} text={tips[t]}>
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, product_type: prev.product_type === t ? '' : t }))}
                        style={{
                          padding: '6px 20px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', border: '1.5px solid',
                          background: form.product_type === t ? '#3b82f6' : '#fff',
                          color: form.product_type === t ? '#fff' : '#64748b',
                          borderColor: form.product_type === t ? '#3b82f6' : '#e2e8f0',
                          transition: '.15s', fontFamily: 'inherit',
                        }}
                      >{t}</button>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 불량 내용 */}
        <div className="form-card">
          <div className="form-card-title">⚠️ 불량 내용</div>
          <div className="form-group">
            <label>불량 내용 <span className="required-star">*</span></label>
            <textarea
              rows={4}
              placeholder="불량 내용을 상세하게 입력하세요"
              value={form.defect_description}
              onChange={set('defect_description')}
              required
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>

        <div className="form-actions" style={{ marginTop: 16 }}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? '⏳ 등록 중...' : '📥 클레임 접수 등록'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/claims')}>
            취소
          </button>
        </div>
      </form>

      {partSearchOpen && (
        <PartSearchModal
          onSelect={handlePartSelect}
          onClose={() => setPartSearchOpen(false)}
        />
      )}
    </div>
  );
}
