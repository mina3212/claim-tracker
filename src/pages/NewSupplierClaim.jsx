import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSupplierClaims } from '../context/SupplierClaimsContext';
import { useToast } from '../context/ToastContext';
import {
  insertSupplierClaim,
  uploadSupplierFile, insertSupplierFile,
  PRODUCT_TYPES, PRODUCT_CATEGORIES,
  DEFECT_TYPES, INSPECTION_STAGES,
  DISPOSITION_TYPES, DISPOSITION_COLORS, PURCHASE_DEPTS,
} from '../lib/supabase';
import PartSearchModal from '../components/PartSearchModal';
import SupplierSearchModal from '../components/SupplierSearchModal';

const FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.gif,.webp,.xlsx,.xls,.doc,.docx';
function fileIcon(type) {
  if (!type) return '📄';
  if (type.includes('pdf'))   return '📕';
  if (type.includes('image')) return '🖼️';
  return '📄';
}
function fmtSize(b) {
  if (!b) return '';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(0) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

const today = () => new Date().toISOString().slice(0, 10);
const DISABLED_CATS = ['동자재', '기타', '광점퍼코드류'];

const INITIAL = {
  supplier_name:       '',
  purchase_dept:       '',
  incoming_date:       today(),
  incoming_lot_no:     '',
  part_number:         '',
  part_name:           '',
  quantity:            '',
  inspection_quantity: '',
  product_type:        '',
  product_category:    '',
  inspection_stage:    '',
  cavity_total:        '',
  cavity_defective:    '',
  defect_quantity:     '',
  defect_type:         '',
  defect_description:  '',
  disposition:         '',
  notes:               '',
  handler_name:        '',
};

export default function NewSupplierClaim() {
  const { user, displayName } = useAuth();
  const { addClaim } = useSupplierClaims();
  const toast        = useToast();
  const navigate     = useNavigate();
  const [form, setForm]                         = useState(INITIAL);
  const [submitting, setSub]                    = useState(false);
  const [pendingFiles, setPendingFiles]         = useState([]);
  const [dragging,     setDragging]             = useState(false);
  const [partSearchOpen, setPartSearchOpen]     = useState(false);
  const [supplierSearchOpen, setSupplierSearch] = useState(false);
  const fileRef = useRef(null);

  const INSPECTORS = ['권순규', '김민아', '민영재', '오은세', '윤창준', '최용민'];

  useEffect(() => {
    if (!displayName) return;
    setForm(prev => ({ ...prev, handler_name: prev.handler_name || displayName }));
  }, [displayName]);

  const addFiles = (selected) => {
    const valid = [...selected].filter(f => f.size <= 20 * 1024 * 1024);
    if (valid.length < selected.length) toast('파일 크기 초과', '20MB 이하 파일만 첨부 가능합니다', 'error');
    setPendingFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...valid.filter(f => !names.has(f.name))];
    });
  };

  if (!user) return (
    <div>
      <div className="page-header"><div className="page-title">공급사 불량 접수</div></div>
      <div className="error-box">⚠️ 접수는 로그인 후 가능합니다.</div>
    </div>
  );

  const set    = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));
  const setVal = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const qty     = parseFloat(form.quantity);
  const insQty  = parseFloat(form.inspection_quantity);
  const defQty  = parseFloat(form.defect_quantity);
  const defRate = insQty > 0 && defQty >= 0 ? ((defQty / insQty) * 100).toFixed(1) : null;
  const isPartInspection = form.inspection_stage === '부품 수입검사';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplier_name.trim())      { toast('입력 오류', '공급사명을 입력하세요', 'error'); return; }
    if (!form.incoming_date)             { toast('입력 오류', '입고일자를 선택하세요', 'error'); return; }
    if (!form.part_number.trim())        { toast('입력 오류', '품번을 입력하세요', 'error'); return; }
    if (!form.part_name.trim())          { toast('입력 오류', '품명을 입력하세요', 'error'); return; }
    if (form.quantity === '')            { toast('입력 오류', '입고 수량을 입력하세요', 'error'); return; }
    if (!form.inspection_stage)          { toast('입력 오류', '검사 단계를 선택하세요', 'error'); return; }
    if (form.defect_quantity === '')     { toast('입력 오류', '불량 수량을 입력하세요', 'error'); return; }
    if (!isNaN(defQty) && !isNaN(qty) && defQty > qty) {
      toast('입력 오류', '불량 수량이 입고 수량보다 클 수 없습니다', 'error'); return;
    }
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
        supplier_name:       form.supplier_name.trim(),
        purchase_dept:       form.purchase_dept      || null,
        incoming_date:       form.incoming_date      || null,
        incoming_lot_no:     form.incoming_lot_no.trim() || null,
        part_number:         form.part_number.trim(),
        part_name:           form.part_name.trim(),
        quantity:            parseInt(form.quantity),
        inspection_quantity: form.inspection_quantity !== '' ? parseInt(form.inspection_quantity) : null,
        product_type:        form.product_type       || null,
        product_category:    form.product_category   || null,
        inspection_stage:    form.inspection_stage   || null,
        cavity_total:        form.cavity_total       !== '' ? parseInt(form.cavity_total)       : null,
        cavity_defective:    form.cavity_defective   !== '' ? parseInt(form.cavity_defective)   : null,
        defect_quantity:     parseInt(form.defect_quantity),
        defect_type:         form.defect_type        || null,
        defect_description:  form.defect_description.trim(),
        disposition:         form.disposition        || null,
        notes:               form.notes.trim()        || null,
        handler_name:        form.handler_name.trim() || null,
        handler_dept:        '품질기술팀',
      };
      const { claim } = await insertSupplierClaim(payload, user);
      addClaim(claim);
      // 파일 업로드 (실패해도 접수는 완료)
      if (pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          try {
            const info = await uploadSupplierFile(file, claim.id);
            await insertSupplierFile(claim.id, info, user);
          } catch (err) {
            toast('파일 업로드 실패', `${file.name}: ${err.message}`, 'error');
          }
        }
      }
      toast('접수 완료', `${form.supplier_name} 불량이 등록되었습니다`, 'success');
      navigate(`/supplier-claims/${claim.id}`);
    } catch (err) {
      toast('접수 실패', err.message, 'error');
    } finally {
      setSub(false);
    }
  };

  const toggleBtn = (key, val) => setForm(prev => ({ ...prev, [key]: prev[key] === val ? '' : val }));

  return (
    <div>
      <button className="back-btn" onClick={() => navigate('/supplier-claims')}>← 공급사 불량 목록으로</button>
      <div className="page-header">
        <div>
          <div className="page-title">공급사 불량 접수</div>
          <div className="page-sub">입고 검사에서 발견된 불량을 등록합니다 · <span style={{ color: '#ef4444' }}>*</span> 항목은 필수입니다</div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── 공급사 & 입고 정보 ── */}
        <div className="form-card" style={{ marginBottom: 16 }}>
          <div className="form-card-title">🏭 공급사 및 입고 정보</div>
          <div className="form-grid form-cols-4">

            <div className="form-group form-span-2">
              <label>공급사명 <span className="required-star">*</span></label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={form.supplier_name} onChange={set('supplier_name')} placeholder="공급사명 입력" style={{ flex: 1 }} />
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => setSupplierSearch(true)}>🔍</button>
              </div>
            </div>

            <div className="form-group form-span-2">
              <label>구매 경로</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {PURCHASE_DEPTS.map(d => (
                  <button key={d} type="button"
                    onClick={() => toggleBtn('purchase_dept', d)}
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit', transition: '.15s',
                      background: form.purchase_dept === d ? '#0f766e' : '#fff',
                      color:      form.purchase_dept === d ? '#fff'    : '#64748b',
                      borderColor: form.purchase_dept === d ? '#0f766e' : '#e2e8f0',
                    }}>{d}</button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>입고일자 <span className="required-star">*</span></label>
              <input type="date" value={form.incoming_date} onChange={set('incoming_date')} required />
            </div>
            <div className="form-group">
              <label>입고 차수</label>
              <input placeholder="예: 1차, 2024-3차" value={form.incoming_lot_no} onChange={set('incoming_lot_no')} />
            </div>
            <div className="form-group" />
            <div className="form-group">
              <label>검사자</label>
              <select value={form.handler_name} onChange={set('handler_name')}>
                <option value="">검사자 선택</option>
                {INSPECTORS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

          </div>
        </div>

        {/* ── 품목 정보 ── */}
        <div className="form-card" style={{ marginBottom: 16 }}>
          <div className="form-card-title">📦 품목 정보</div>
          <div className="form-grid form-cols-4">

            <div className="form-group">
              <label>품번 <span className="required-star">*</span></label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={form.part_number} onChange={set('part_number')} placeholder="품번 입력" style={{ flex: 1 }} />
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => setPartSearchOpen(true)}>🔍</button>
              </div>
            </div>
            <div className="form-group">
              <label>품명 <span className="required-star">*</span></label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={form.part_name} onChange={set('part_name')} placeholder="품명 입력" style={{ flex: 1 }} />
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => setPartSearchOpen(true)}>🔍</button>
              </div>
            </div>
            <div className="form-group">
              <label>입고 수량 (EA) <span className="required-star">*</span></label>
              <input type="number" placeholder="0" min="0" value={form.quantity} onChange={set('quantity')} />
            </div>
            <div className="form-group" />

            <div className="form-group form-span-4">
              <label>품목 유형</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PRODUCT_TYPES.map(t => (
                  <button key={t} type="button" onClick={() => setForm(prev => {
                      const next = prev.product_type === t ? '' : t;
                      return { ...prev, product_type: next, product_category: next === '자체제작상품' && DISABLED_CATS.includes(prev.product_category) ? '' : prev.product_category };
                    })}
                    style={{ padding: '6px 20px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit', transition: '.15s', background: form.product_type === t ? '#2563eb' : '#fff', color: form.product_type === t ? '#fff' : '#64748b', borderColor: form.product_type === t ? '#2563eb' : '#e2e8f0' }}>{t}</button>
                ))}
              </div>
            </div>
            <div className="form-group form-span-4">
              <label>품목군</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PRODUCT_CATEGORIES.map(c => {
                  const disabled = form.product_type === '자체제작상품' && DISABLED_CATS.includes(c);
                  return (
                    <button key={c} type="button"
                      disabled={disabled}
                      onClick={() => !disabled && toggleBtn('product_category', c)}
                      style={{ padding: '6px 20px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', border: '1.5px solid', fontFamily: 'inherit', transition: '.15s', opacity: disabled ? 0.35 : 1, background: form.product_category === c ? '#7c3aed' : '#fff', color: form.product_category === c ? '#fff' : '#64748b', borderColor: form.product_category === c ? '#7c3aed' : '#e2e8f0' }}>{c}</button>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        {/* ── 검사 및 불량 내용 ── */}
        <div className="form-card" style={{ marginBottom: 16 }}>
          <div className="form-card-title">⚠️ 검사 및 불량 내용</div>
          <div className="form-grid form-cols-4">

            <div className="form-group form-span-4">
              <label>불량 발생 검사 단계 <span className="required-star">*</span></label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {INSPECTION_STAGES.map(s => (
                  <button key={s} type="button"
                    onClick={() => setForm(prev => ({
                      ...prev,
                      inspection_stage: prev.inspection_stage === s ? '' : s,
                      cavity_total:     s !== '부품 수입검사' ? '' : prev.cavity_total,
                      cavity_defective: s !== '부품 수입검사' ? '' : prev.cavity_defective,
                    }))}
                    style={{ padding: '8px 20px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit', transition: '.15s', background: form.inspection_stage === s ? '#0f766e' : '#fff', color: form.inspection_stage === s ? '#fff' : '#64748b', borderColor: form.inspection_stage === s ? '#0f766e' : '#e2e8f0' }}>{s}</button>
                ))}
              </div>
            </div>

            {isPartInspection && (
              <>
                <div className="form-group">
                  <label>캐비티 총 수</label>
                  <input type="number" placeholder="예: 16" min="1" value={form.cavity_total} onChange={set('cavity_total')} />
                </div>
                <div className="form-group">
                  <label>불량 캐비티 수</label>
                  <input type="number" placeholder="예: 3" min="0" value={form.cavity_defective} onChange={set('cavity_defective')} />
                </div>
                {form.cavity_total && form.cavity_defective && (
                  <div className="form-group">
                    <label>캐비티 불량률 (자동)</label>
                    <div style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, minHeight: 38, color: parseFloat(form.cavity_defective) / parseFloat(form.cavity_total) > 0.1 ? '#dc2626' : '#059669' }}>
                      {((parseFloat(form.cavity_defective) / parseFloat(form.cavity_total)) * 100).toFixed(1)}%
                      <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>({form.cavity_defective}/{form.cavity_total})</span>
                    </div>
                  </div>
                )}
                <div className="form-group" />
              </>
            )}

            <div className="form-group">
              <label>검사 수량 (EA)</label>
              <input type="number" placeholder="불량률 계산 기준" min="0" value={form.inspection_quantity} onChange={set('inspection_quantity')} />
            </div>
            <div className="form-group">
              <label>불량 수량 (EA) <span className="required-star">*</span></label>
              <input type="number" placeholder="0" min="0" value={form.defect_quantity} onChange={set('defect_quantity')} />
            </div>
            <div className="form-group">
              <label>불량률 (자동)</label>
              <div style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', fontSize: 13, fontWeight: defRate !== null ? 700 : 400, color: defRate !== null ? (parseFloat(defRate) > 5 ? '#dc2626' : '#059669') : '#94a3b8', display: 'flex', alignItems: 'center', gap: 6, minHeight: 38 }}>
                {defRate !== null ? <>{parseFloat(defRate) > 5 ? '🔴' : '🟢'} {defRate}% <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>({defQty}/{insQty}개)</span></> : <span style={{ fontSize: 12 }}>검사수량+불량수량 입력 시 자동 계산</span>}
              </div>
            </div>
            <div className="form-group" />

            <div className="form-group form-span-4">
              <label>불량 유형 <span className="required-star">*</span></label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {DEFECT_TYPES.map(t => (
                  <button key={t} type="button" onClick={() => toggleBtn('defect_type', t)}
                    style={{ padding: '6px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit', transition: '.15s', background: form.defect_type === t ? '#dc2626' : '#fff', color: form.defect_type === t ? '#fff' : '#64748b', borderColor: form.defect_type === t ? '#dc2626' : '#e2e8f0' }}>{t}</button>
                ))}
              </div>
            </div>

            <div className="form-group form-span-4">
              <label>불량 내용 상세 <span className="required-star">*</span></label>
              <textarea rows={4} placeholder="불량 증상, 발생 상황, 검사 결과 등을 상세히 입력하세요" value={form.defect_description} onChange={set('defect_description')} style={{ resize: 'vertical' }} />
            </div>

          </div>
        </div>

        {/* ── 처리 결과 ── */}
        <div className="form-card">
          <div className="form-card-title">✅ 처리 결과</div>
          <div className="form-grid form-cols-4">

            <div className="form-group form-span-4">
              <label>처리 결과 <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>(결정 전이면 선택 안 해도 됩니다)</span></label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {DISPOSITION_TYPES.map(d => {
                  const c = DISPOSITION_COLORS[d];
                  return (
                    <button key={d} type="button" onClick={() => toggleBtn('disposition', d)}
                      style={{ padding: '8px 20px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit', transition: '.15s', background: form.disposition === d ? c.text : '#fff', color: form.disposition === d ? '#fff' : '#64748b', borderColor: form.disposition === d ? c.text : '#e2e8f0' }}>{d}</button>
                  );
                })}
              </div>
            </div>

            <div className="form-group form-span-4">
              <label>비고</label>
              <input placeholder="특이사항, 추가 메모 등" value={form.notes} onChange={set('notes')} />
            </div>

          </div>
        </div>

        {/* ── 첨부파일 ── */}
        <div className="form-card" style={{ marginTop: 16 }}>
          <div className="form-card-title">📎 첨부파일 <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>(성적서, 사진 등 · 선택)</span></div>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); addFiles([...e.dataTransfer.files]); }}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? '#3b82f6' : '#e2e8f0'}`,
              borderRadius: 10, padding: pendingFiles.length ? '12px 16px' : '24px 16px',
              cursor: 'pointer', background: dragging ? '#eff6ff' : '#f8fafc', transition: '.15s',
            }}>
            <input ref={fileRef} type="file" multiple accept={FILE_ACCEPT} style={{ display: 'none' }}
              onChange={e => addFiles([...e.target.files])} />
            {pendingFiles.length === 0 ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>📎</div>
                <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>파일을 드래그하거나 클릭하여 첨부</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>PDF, 이미지, Excel, Word · 최대 20MB</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>첨부 예정 ({pendingFiles.length}개)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {pendingFiles.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span>{fileIcon(f.type)}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>{fmtSize(f.size)}</span>
                      <button type="button" onClick={e => { e.stopPropagation(); setPendingFiles(prev => prev.filter((_, j) => j !== i)); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14, padding: '0 4px' }}>✕</button>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 8 }}>클릭하여 파일 추가</div>
              </div>
            )}
          </div>
        </div>

        <div className="form-actions" style={{ marginTop: 16 }}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? (pendingFiles.length ? '⏳ 접수 및 업로드 중...' : '⏳ 등록 중...') : '📥 불량 접수 등록'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/supplier-claims')}>취소</button>
        </div>
      </form>

      {partSearchOpen && (
        <PartSearchModal
          onSelect={(pn, pm) => setForm(prev => ({ ...prev, part_number: pn, part_name: pm }))}
          onClose={() => setPartSearchOpen(false)}
        />
      )}
      {supplierSearchOpen && (
        <SupplierSearchModal
          onSelect={name => setVal('supplier_name', name)}
          onClose={() => setSupplierSearch(false)}
        />
      )}
    </div>
  );
}
