import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useClaims } from '../context/ClaimsContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { advanceClaim, deleteClaim, updateClaim, updateStageEntry, insertDeleteRequest, resolveDeleteRequest, fetchNotifyEmails, uploadStageImage, STAGES, STAGE_ICONS, STAGE_COLORS, CUSTOMER_GROUPS, PRODUCT_TYPES, PRODUCT_CATEGORIES, DEPARTMENTS, SALES_REPS } from '../lib/supabase';
import { usePrintTitle } from '../context/PrintContext';
import Tooltip from '../components/Tooltip';
import StageTracker from '../components/StageTracker';
import StageBadge from '../components/StageBadge';
import PartSearchModal from '../components/PartSearchModal';
import DeleteRequestModal from '../components/DeleteRequestModal';

const CAUSES = ['사용자 과실', '생산공정', '제품불량', '구조불량', '배송오류', '기타'];
const INSPECTORS = ['권순규', '김민아', '민영재', '오은세', '윤창준', '최용민'];

function parseDefect(desc) {
  if (!desc) return { symptom: '', situation: '', request: '', imgs: [], legacy: false };
  let imgs = [];
  const imgsMatch = desc.match(/\n\n\[imgs\] (\[.*\])$/s);
  if (imgsMatch) { try { imgs = JSON.parse(imgsMatch[1]); } catch {} }
  const textPart = desc.replace(/\n\n\[imgs\] \[.*\]$/s, '');
  if (textPart.includes('[불량증상]')) {
    const get = (tag) => {
      const re = new RegExp(`\\[${tag}\\]\\n([\\s\\S]*?)(?=\\n\\n\\[|$)`);
      const m = textPart.match(re);
      return m ? m[1].trim() : '';
    };
    return { symptom: get('불량증상'), situation: get('발생상황'), request: get('고객요청사항'), imgs, legacy: false };
  }
  return { symptom: textPart, situation: '', request: '', imgs, legacy: true };
}

function buildDefectDescription(symptom, situation, request) {
  const parts = [];
  if (symptom.trim())   parts.push(`[불량증상]\n${symptom.trim()}`);
  if (situation.trim()) parts.push(`[발생상황]\n${situation.trim()}`);
  if (request.trim())   parts.push(`[고객요청사항]\n${request.trim()}`);
  return parts.join('\n\n');
}

function DefectBox({ label, text, color, labelColor }) {
  return (
    <div style={{ background: color, borderRadius: 8, padding: '10px 14px', minHeight: 70 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: labelColor, marginBottom: 6, letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
        {text || <span style={{ color: '#94a3b8' }}>없음</span>}
      </div>
    </div>
  );
}

function makeMailtoLink(claim, notifyEmails) {
  const NOTIFY_TO = notifyEmails.length > 0 ? notifyEmails.join(',') : '';
  const defRate = (() => {
    const q = claim.quantity; const dq = claim.defect_quantity;
    return q > 0 && dq != null ? ((dq / q) * 100).toFixed(1) + '%' : '-';
  })();

  const subject = encodeURIComponent(
    `[클레임 접수] ${claim.customer_name} / ${claim.part_number || claim.part_name || ''} (${claim.receipt_date || '날짜미상'})`
  );
  const body = encodeURIComponent([
    '■ 클레임 접수 알림',
    '',
    `고객사 그룹  : ${claim.customer_group || '-'}`,
    `고객사명    : ${claim.customer_name}`,
    `접수일      : ${claim.receipt_date || '-'}`,
    `발생일      : ${claim.occurrence_date || '-'}`,
    '',
    `품번        : ${claim.part_number || '-'}`,
    `품명        : ${claim.part_name || '-'}`,
    `품목 유형   : ${claim.product_type || '-'}`,
    `LOT 번호    : ${claim.lot_number || '-'}`,
    '',
    `출고 수량   : ${claim.quantity != null ? claim.quantity + ' EA' : '-'}`,
    `불량 수량   : ${claim.defect_quantity != null ? claim.defect_quantity + ' EA' : '-'}`,
    `불량률      : ${defRate}`,
    '',
    `불량 내용   :`,
    claim.defect_description || '-',
    '',
    `영업담당자  : ${claim.sales_rep_name || '-'}  /  ${claim.sales_rep_contact || '-'}`,
    '',
    '─────────────────────────────',
    '이 메일은 클레임 관리 시스템에서 수동 발송되었습니다.',
  ].join('\n'));

  return `mailto:${NOTIFY_TO}?subject=${subject}&body=${body}`;
}

export default function ClaimDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { claims, loading, getStagesFor, updateClaimStage, updateClaimData, removeClaim, deleteRequests, addDeleteRequest, resolveRequest, patchStageEntry } = useClaims();
  const { user, isAdmin, displayName, department } = useAuth();
  const toast = useToast();

  const [notifyEmails, setNotifyEmails] = useState([]);
  useEffect(() => { fetchNotifyEmails().then(setNotifyEmails).catch(() => {}); }, []);

  const { setPrintTitle } = usePrintTitle();

  /* ── 단계 진행 공통 상태 ── */
  const [advDate,        setAdvDate]        = useState(new Date().toISOString().slice(0, 10));
  const [advHandlerDept, setAdvHandlerDept] = useState(department || '');
  const [advHandler,     setAdvHandler]     = useState(displayName || '');
  const [advDesc,        setAdvDesc]        = useState('');
  const [advancing,      setAdvancing]      = useState(false);

  /* ── 이력 항목 수정 상태 ── */
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [entryEdit,      setEntryEdit]      = useState({});
  const [savingEntry,    setSavingEntry]    = useState(false);
  const [entryEditMode,   setEntryEditMode]   = useState('raw'); // 'raw'|'cause'|'action'
  const [entryEditFiles,  setEntryEditFiles]  = useState([]);
  const [entryEditCauses,       setEntryEditCauses]       = useState([]);
  const [entryEditExistingImgs, setEntryEditExistingImgs] = useState([]);

  /* ── 회수품 원인분석 전용 상태 ── */
  const [selectedCauses,   setSelectedCauses]   = useState([]);
  const [etcDetail,        setEtcDetail]        = useState('');
  /* ── 조치 단계 전용 상태 ── */
  const [preventionMeasure, setPreventionMeasure] = useState('');

  /* ── 이미지 업로드 상태 ── */
  const [causes,   setCauses]   = useState([{ text: '', files: [] }]); // 회수품원인분析 다중원인
  const [advFiles, setAdvFiles] = useState([]); // 기타 단계 첨부 이미지
  const advFileRef          = useRef(null);
  const causeFileRef        = useRef(null);
  const causeFileIdx        = useRef(0);
  const entryEditFileRef    = useRef(null);
  const entryEditCauseRef   = useRef(null);
  const entryEditCauseIdx   = useRef(0);

  /* ── 프로필 로드 후 담당자/부서 자동세팅 ── */
  useEffect(() => {
    setAdvHandlerDept(prev => prev || department || '');
    setAdvHandler(prev => prev || displayName || '');
  }, [department, displayName]);

  /* ── 수정 모드 상태 ── */
  const [editMode, setEditMode]             = useState(false);
  const [editForm, setEditForm]             = useState(null);
  const [saving,   setSaving]               = useState(false);
  const [partSearchOpen, setPartSearchOpen] = useState(false);
  const [deleteReqOpen,  setDeleteReqOpen]  = useState(false);

  // 훅은 반드시 조기 리턴 전에 호출 (Rules of Hooks)
  const claim = claims.find(c => c.id === id);
  useEffect(() => {
    if (!claim) return;
    const date = claim.receipt_date ? ` (${claim.receipt_date})` : '';
    setPrintTitle(`AJW 클레임 상세 — ${claim.customer_name}${date}`);
  }, [claim, setPrintTitle]);

  if (loading) return <div className="loading">⏳ 불러오는 중...</div>;

  if (!claim) return (
    <div>
      <button className="back-btn" onClick={() => navigate('/claims')}>← 목록으로</button>
      <div className="error-box">클레임을 찾을 수 없습니다.</div>
    </div>
  );

  const history    = getStagesFor(id);
  const currentIdx = STAGES.indexOf(claim.current_stage);
  const isClosed   = claim.current_stage === '종결';
  const nextStage  = !isClosed ? STAGES[currentIdx + 1] : null;
  const pendingReqs = deleteRequests.filter(r => r.claim_id === id);

  /* ── 원인 체크박스 토글 ── */
  const toggleCause = (cause) => {
    setSelectedCauses(prev =>
      prev.includes(cause) ? prev.filter(c => c !== cause) : [...prev, cause]
    );
    if (cause === '기타') setEtcDetail('');
  };

  /* ── 단계 진행 ── */
  const handleAdvance = async () => {
    if (history.some(h => h.stage_name === claim.current_stage)) {
      toast('중복 등록 불가', `"${claim.current_stage}" 단계는 이미 처리된 건입니다`, 'error');
      return;
    }

    if (!advHandlerDept) {
      toast('입력 필요', '담당 부서를 선택하세요', 'error');
      return;
    }
    if (!advHandler.trim()) {
      toast('입력 필요', '담당자 이름을 입력하세요', 'error');
      return;
    }

    // 1차 대응 → 회수품 원인분석: 처리내용 필수
    if (claim.current_stage === '1차 대응') {
      if (!advDesc.trim()) {
        toast('입력 필요', '처리 내용을 입력해야 다음 단계로 진행할 수 있습니다', 'error');
        return;
      }
    }

    // 회수품 원인분석 → 조치: 원인 선택 + 상세내용 필수
    if (claim.current_stage === '회수품 원인분석') {
      if (selectedCauses.length === 0) {
        toast('입력 필요', '원인 분석 항목을 하나 이상 선택하세요', 'error');
        return;
      }
      if (selectedCauses.includes('기타') && !etcDetail.trim()) {
        toast('입력 필요', '기타 원인의 구체적인 내용을 입력하세요', 'error');
        return;
      }
      if (causes.some(c => !c.text.trim())) {
        toast('입력 필요', '모든 원인의 상세 내용을 입력하세요', 'error');
        return;
      }
    }

    // 조치 → 종결: 처리내용 + 재발방지대책 필수
    if (claim.current_stage === '조치') {
      if (!advDesc.trim()) {
        toast('입력 필요', '처리 내용을 입력해야 종결로 진행할 수 있습니다', 'error');
        return;
      }
      if (!preventionMeasure.trim()) {
        toast('입력 필요', '재발방지대책을 입력해야 종결로 진행할 수 있습니다', 'error');
        return;
      }
    }

    setAdvancing(true);
    try {
      const uploadAll = async (files) => {
        const urls = [];
        for (const f of files) {
          urls.push(await uploadStageImage(f, id));
        }
        return urls;
      };

      let description = advDesc;
      if (claim.current_stage === '회수품 원인분석') {
        const causeStr = selectedCauses
          .map(c => c === '기타' ? `기타(${etcDetail.trim()})` : c)
          .join(', ');
        const causesWithImgs = await Promise.all(
          causes.map(async (c) => ({ text: c.text.trim(), imgs: await uploadAll(c.files) }))
        );
        description = `[원인] ${causeStr}\n[상세JSON] ${JSON.stringify(causesWithImgs)}`;
      } else if (claim.current_stage === '조치') {
        const imgs = await uploadAll(advFiles);
        description = `[조치내용] ${advDesc.trim()}\n[재발방지] ${preventionMeasure.trim()}`;
        if (imgs.length > 0) description += `\n[imgs] ${JSON.stringify(imgs)}`;
      } else {
        const imgs = await uploadAll(advFiles);
        if (imgs.length > 0) description = `${advDesc}\n[imgs] ${JSON.stringify(imgs)}`;
      }

      const { nextStage: ns, entry } = await advanceClaim(
        id, claim.current_stage,
        { stage_date: advDate, description, handler: advHandler || user?.displayName || '', handler_dept: advHandlerDept },
        user
      );
      updateClaimStage(id, ns, entry);
      setAdvDesc('');
      setAdvHandler(displayName || '');
      setAdvHandlerDept(department || '');
      setSelectedCauses([]);
      setEtcDetail('');
      setCauses([{ text: '', files: [] }]);
      setAdvFiles([]);
      setPreventionMeasure('');
      toast(`"${ns}"으로 진행 완료`, '', 'success');
    } catch (err) {
      toast('진행 실패', err.message, 'error');
    } finally {
      setAdvancing(false);
    }
  };

  /* ── 삭제 (관리자) ── */
  const handleDelete = async () => {
    if (!confirm(`"${claim.customer_name}" 클레임을 삭제하시겠습니까?`)) return;
    try {
      await deleteClaim(id);
      removeClaim(id);
      toast('삭제 완료', '', 'success');
      navigate('/claims');
    } catch (err) {
      toast('삭제 실패', err.message, 'error');
    }
  };

  /* ── 수정 모드 시작 ── */
  const startEdit = () => {
    const d = parseDefect(claim.defect_description);
    setEditForm({
      customer_group:     claim.customer_group    || '',
      customer_name:      claim.customer_name     || '',
      occurrence_date:    claim.occurrence_date   || '',
      receipt_date:       claim.receipt_date      || '',
      sales_rep_dept:     claim.sales_rep_dept    || '',
      sales_rep_name:     claim.sales_rep_name    || '',
      sales_rep_contact:  claim.sales_rep_contact || '',
      part_number:        claim.part_number       || '',
      part_name:          claim.part_name         || '',
      product_type:       claim.product_type      || '',
      product_category:   claim.product_category  || '',
      quantity:           claim.quantity    != null ? String(claim.quantity)    : '',
      lot_number:         claim.lot_number        || '',
      defect_quantity:    claim.defect_quantity != null ? String(claim.defect_quantity) : '',
      defect_symptom:     d.symptom,
      defect_situation:   d.situation,
      customer_request:   d.request,
    });
    setEditMode(true);
  };

  /* ── 이력 항목 저장 ── */
  const handleSaveEntry = async () => {
    setSavingEntry(true);
    try {
      const uploadAllEntry = async (files) => {
        const urls = [];
        for (const f of files) urls.push(await uploadStageImage(f, id));
        return urls;
      };

      let description = entryEdit.description || '';

      if (entryEditMode === 'cause') {
        // 회수품 원인분析: rebuild [상세JSON] with updated texts + new images
        const lines = description.split('\n');
        const causeStr = (lines.find(l => l.startsWith('[원인]')) || '').replace('[원인] ', '');
        const causesWithImgs = await Promise.all(
          entryEditCauses.map(async (c) => {
            const newImgs = await uploadAllEntry(c.newFiles || []);
            return { text: c.text, imgs: [...(c.existingImgs || []), ...newImgs] };
          })
        );
        description = `[원인] ${causeStr}\n[상세JSON] ${JSON.stringify(causesWithImgs)}`;
      } else {
        // 기타/조치: combine surviving existing imgs + new uploads
        const newImgs = await uploadAllEntry(entryEditFiles);
        const allImgs = [...entryEditExistingImgs, ...newImgs];
        if (allImgs.length) {
          description = description.replace(/\n+\[imgs\] \[.*\]$/s, '') + `\n[imgs] ${JSON.stringify(allImgs)}`;
        }
      }

      await updateStageEntry(editingEntryId, {
        stage_date:   entryEdit.stage_date,
        description,
        handler:      entryEdit.handler,
        handler_dept: entryEdit.handler_dept,
      });
      patchStageEntry(editingEntryId, { ...entryEdit, description });
      setEditingEntryId(null);
      setEntryEditFiles([]);
      setEntryEditCauses([]);
      setEntryEditExistingImgs([]);
      setEntryEditMode('raw');
      toast('수정 완료', '이력이 수정되었습니다', 'success');
    } catch (err) {
      toast('수정 실패', err.message, 'error');
    } finally {
      setSavingEntry(false);
    }
  };

  const setEF = (key) => (e) => setEditForm(prev => ({ ...prev, [key]: e.target.value }));

  /* ── 수정 저장 ── */
  const handleSave = async () => {
    if (!editForm.customer_name.trim()) { toast('입력 오류', '고객사명을 입력하세요', 'error'); return; }
    if (!editForm.defect_symptom.trim()) { toast('입력 오류', '불량증상을 입력하세요', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        customer_group:     editForm.customer_group    || null,
        customer_name:      editForm.customer_name.trim(),
        occurrence_date:    editForm.occurrence_date   || null,
        receipt_date:       editForm.receipt_date      || null,
        sales_rep_dept:     editForm.sales_rep_dept    || null,
        sales_rep_name:     editForm.sales_rep_name.trim()    || null,
        sales_rep_contact:  editForm.sales_rep_contact.trim() || null,
        part_number:        editForm.part_number.trim()       || null,
        part_name:          editForm.part_name.trim()         || null,
        product_type:       editForm.product_type      || null,
        product_category:   editForm.product_category  || null,
        quantity:           editForm.quantity    !== '' ? parseInt(editForm.quantity)    : null,
        lot_number:         editForm.lot_number.trim()        || null,
        defect_quantity:    editForm.defect_quantity !== '' ? parseInt(editForm.defect_quantity) : null,
        defect_description: buildDefectDescription(editForm.defect_symptom, editForm.defect_situation, editForm.customer_request),
      };
      await updateClaim(id, payload);
      updateClaimData(id, payload);
      setEditMode(false);
      toast('수정 완료', '클레임이 수정되었습니다', 'success');
    } catch (err) {
      toast('수정 실패', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ── 삭제 요청 제출 (일반 사용자) ── */
  const handleDeleteRequest = async (reason) => {
    const req = await insertDeleteRequest(id, reason, user);
    addDeleteRequest(req);
    toast('삭제 요청 완료', '관리자에게 삭제 요청이 전달되었습니다', 'success');
    setDeleteReqOpen(false);
  };

  /* ── 삭제 요청 승인 (관리자) ── */
  const handleApproveRequest = async (reqId) => {
    if (!confirm('삭제 요청을 승인하고 클레임을 삭제하시겠습니까?')) return;
    try {
      await deleteClaim(id);
      await resolveDeleteRequest(reqId, 'approved');
      removeClaim(id);
      toast('삭제 완료', '삭제 요청이 승인되어 클레임이 삭제되었습니다', 'success');
      navigate('/claims');
    } catch (err) {
      toast('오류', err.message, 'error');
    }
  };

  /* ── 삭제 요청 거절 (관리자) ── */
  const handleRejectRequest = async (reqId) => {
    try {
      await resolveDeleteRequest(reqId, 'rejected');
      resolveRequest(reqId);
      toast('거절 완료', '삭제 요청이 거절되었습니다', 'success');
    } catch (err) {
      toast('오류', err.message, 'error');
    }
  };

  /* ── 단계 진행 폼 렌더 ── */
  const renderAdvanceForm = () => {
    const isFirstResponse  = claim.current_stage === '1차 대응';
    const isCauseAnalysis  = claim.current_stage === '회수품 원인분석';
    const isAction         = claim.current_stage === '조치';
    const hasEtc           = selectedCauses.includes('기타');

    return (
      <div className="advance-section">
        {/* hidden file inputs — ref로 제어 */}
        <input ref={advFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
          onChange={e => {
            const files = Array.from(e.target.files || []);
            if (files.length > 0) setAdvFiles(prev => [...prev, ...files]);
          }}
        />
        <input ref={causeFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
          onChange={e => {
            const files = Array.from(e.target.files || []);
            const idx = causeFileIdx.current;
            if (files.length > 0) setCauses(prev => prev.map((c, i) => i === idx ? { ...c, files: [...c.files, ...files] } : c));
          }}
        />
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 12 }}>
          {STAGE_ICONS[currentIdx]}&nbsp;
          <span style={{ color: '#3b82f6' }}>{claim.current_stage}</span> 처리 결과 입력
        </div>

        {/* 공통: 처리일 + 부서 + 담당자 */}
        <div className="adv-grid-3">
          <div className="form-group">
            <label>처리일</label>
            <input type="date" value={advDate} onChange={e => setAdvDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label>담당 부서 <span className="required-star">*</span></label>
            <select value={advHandlerDept} onChange={e => setAdvHandlerDept(e.target.value)} style={{ borderColor: !advHandlerDept ? '#fca5a5' : undefined }}>
              <option value="">부서 선택</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>담당자 이름 <span className="required-star">*</span></label>
            <input
              list={isCauseAnalysis ? 'adv-inspectors' : 'adv-salesreps'}
              placeholder="담당자 이름"
              value={advHandler}
              onChange={e => setAdvHandler(e.target.value)}
              style={{ borderColor: !advHandler ? '#fca5a5' : undefined }}
            />
            <datalist id="adv-inspectors">
              {INSPECTORS.map(n => <option key={n} value={n} />)}
            </datalist>
            <datalist id="adv-salesreps">
              {SALES_REPS.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>
        </div>

        {/* ── 회수품 원인분석 전용 UI ── */}
        {isCauseAnalysis ? (
          <div>
            {/* 원인 체크박스 */}
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>
                원인 분류 <span className="required-star">*</span>
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, marginLeft: 6 }}>
                  (복수 선택 가능)
                </span>
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CAUSES.map(cause => {
                  const checked = selectedCauses.includes(cause);
                  return (
                    <label
                      key={cause}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${checked ? '#3b82f6' : '#e2e8f0'}`,
                        background: checked ? '#eff6ff' : '#f8fafc',
                        color: checked ? '#1e40af' : '#475569',
                        fontWeight: checked ? 600 : 400,
                        fontSize: 13, transition: '.15s', userSelect: 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCause(cause)}
                        style={{ display: 'none' }}
                      />
                      {checked ? '✓ ' : ''}{cause}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 기타 상세 입력 */}
            {hasEtc && (
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>
                  기타 원인 상세 <span className="required-star">*</span>
                </label>
                <input
                  autoFocus
                  placeholder="기타 원인을 구체적으로 입력하세요"
                  value={etcDetail}
                  onChange={e => setEtcDetail(e.target.value)}
                  style={{ borderColor: etcDetail.trim() ? '#e2e8f0' : '#fca5a5' }}
                />
              </div>
            )}

            {/* 원인별 상세 내용 + 사진 (복수) */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                원인별 상세 내용 <span className="required-star">*</span>
              </label>
              {causes.map((item, idx) => (
                <div key={idx} style={{
                  border: '1px solid #e2e8f0', borderRadius: 8, padding: 12,
                  marginBottom: 10, background: '#f8fafc',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{
                      background: '#dbeafe', color: '#1e40af', fontWeight: 700,
                      fontSize: 11, padding: '2px 8px', borderRadius: 12,
                    }}>{idx + 1}번째 원인</span>
                    {causes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setCauses(prev => prev.filter((_, i) => i !== idx))}
                        style={{
                          marginLeft: 'auto', fontSize: 11, color: '#ef4444',
                          background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px',
                        }}
                      >✕ 삭제</button>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    placeholder={`${idx + 1}번째 원인 분석 내용을 입력하세요`}
                    value={item.text}
                    onChange={e => setCauses(prev => prev.map((c, i) => i === idx ? { ...c, text: e.target.value } : c))}
                    style={{
                      resize: 'vertical', width: '100%', marginBottom: 8,
                      borderColor: item.text.trim() ? '#e2e8f0' : '#fca5a5',
                    }}
                  />
                  <div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                      <button type="button"
                        onClick={() => { causeFileIdx.current = idx; causeFileRef.current?.click(); }}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer' }}>
                        📷 사진 선택
                      </button>
                      {item.files.map((f, fi) => (
                        <div key={fi} style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          background: '#eff6ff', borderRadius: 6, padding: '2px 8px', fontSize: 11,
                        }}>
                          <span>📷 {f.name}</span>
                          <button
                            type="button"
                            onClick={() => setCauses(prev => prev.map((c, i) => i === idx ? { ...c, files: c.files.filter((_, fi2) => fi2 !== fi) } : c))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, lineHeight: 1 }}
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setCauses(prev => [...prev, { text: '', files: [] }])}
                style={{
                  fontSize: 12, color: '#3b82f6', background: 'none',
                  border: '1px dashed #93c5fd', borderRadius: 8,
                  padding: '6px 14px', cursor: 'pointer', width: '100%',
                }}
              >+ 원인 추가</button>
            </div>
          </div>
        ) : isAction ? (
          /* ── 조치 단계: 처리내용 + 재발방지대책 ── */
          <div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>처리 내용 <span className="required-star">*</span></label>
              <textarea
                rows={3}
                placeholder="조치 내용을 상세하게 입력하세요 (필수)"
                value={advDesc}
                onChange={e => setAdvDesc(e.target.value)}
                style={{
                  resize: 'vertical', width: '100%',
                  borderColor: !advDesc.trim() ? '#fca5a5' : '#e2e8f0',
                }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>재발방지대책 <span className="required-star">*</span></label>
              <textarea
                rows={3}
                placeholder="향후 재발을 방지하기 위한 대책을 입력하세요 (필수)"
                value={preventionMeasure}
                onChange={e => setPreventionMeasure(e.target.value)}
                style={{
                  resize: 'vertical', width: '100%',
                  borderColor: !preventionMeasure.trim() ? '#fca5a5' : '#e2e8f0',
                }}
              />
            </div>
            {/* 사진 첨부 (선택) */}
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#64748b' }}>사진 첨부 <span style={{ fontSize: 11, color: '#94a3b8' }}>(선택)</span></label>
              <input ref={advFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={e => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) setAdvFiles(prev => [...prev, ...files]);
                }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <button type="button"
                  onClick={() => advFileRef.current?.click()}
                  style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer' }}>
                  📷 사진 선택
                </button>
                {advFiles.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#eff6ff', borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>
                    <span>📷 {f.name}</span>
                    <button type="button" onClick={() => setAdvFiles(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ── 그 외 단계: 처리 내용 ── */
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>
              처리 내용
              {isFirstResponse && <span className="required-star"> *</span>}
              {!isFirstResponse && (
                <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400, marginLeft: 6 }}>(선택)</span>
              )}
            </label>
            <input
              placeholder={isFirstResponse ? '처리 내용을 입력하세요 (필수)' : '처리 내용을 입력하세요'}
              value={advDesc}
              onChange={e => setAdvDesc(e.target.value)}
              style={{ borderColor: isFirstResponse && !advDesc.trim() ? '#fca5a5' : '#e2e8f0' }}
            />
            {isFirstResponse && !advDesc.trim() && (
              <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                처리 내용을 입력해야 다음 단계로 진행할 수 있습니다
              </div>
            )}
            {/* 사진 첨부 (선택) */}
            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>사진 첨부 <span style={{ fontSize: 11, color: '#94a3b8' }}>(선택)</span></label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <button type="button"
                  onClick={() => advFileRef.current?.click()}
                  style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer' }}>
                  📷 사진 선택
                </button>
                {advFiles.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#eff6ff', borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>
                    <span>📷 {f.name}</span>
                    <button type="button" onClick={() => setAdvFiles(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button className="btn btn-success" onClick={handleAdvance} disabled={advancing}>
            {advancing ? '처리 중...' : `✅ ${claim.current_stage} 완료`}
          </button>
        </div>
      </div>
    );
  };

  /* ── 이력 항목 렌더 (원인분석 포맷 파싱 + 이미지) ── */
  const renderDescription = (desc) => {
    if (!desc) return null;

    // Helper: image thumbnail strip
    const ImgStrip = ({ urls }) => urls.length === 0 ? null : (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
        {urls.map((url, i) => (
          <a key={i} href={url} target="_blank" rel="noreferrer">
            <img src={url} alt={`사진${i+1}`}
              style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0', cursor: 'pointer' }} />
          </a>
        ))}
      </div>
    );

    // New JSON format for 회수품 원인분析
    if (desc.includes('[상세JSON]')) {
      const lines = desc.split('\n');
      const cause = (lines.find(l => l.startsWith('[원인]')) || '').replace('[원인] ', '');
      const jsonLine = lines.find(l => l.startsWith('[상세JSON]')) || '';
      let causesArr = [];
      try { causesArr = JSON.parse(jsonLine.replace('[상세JSON] ', '')); } catch {}
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {cause && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, flexShrink: 0, background: '#dbeafe', color: '#1e40af' }}>원인</span>
              <span>{cause}</span>
            </div>
          )}
          {causesArr.map((c, i) => (
            <div key={i} style={{ borderLeft: '3px solid #93c5fd', paddingLeft: 8, marginTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#1e40af', marginBottom: 2 }}>{i + 1}번째 원인</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{c.text}</div>
              {c.imgs && <ImgStrip urls={c.imgs} />}
            </div>
          ))}
        </div>
      );
    }

    // Plain format or old [상세] format or [조치내용] format
    if (desc.startsWith('[원인]') || desc.startsWith('[조치내용]')) {
      const lines = desc.split('\n');
      // Extract trailing [imgs] if any
      const imgsLine = lines.find(l => l.startsWith('[imgs]')) || '';
      let imgs = [];
      try { if (imgsLine) imgs = JSON.parse(imgsLine.replace('[imgs] ', '')); } catch {}
      const displayLines = lines.filter(l => !l.startsWith('[imgs]'));
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {displayLines.map((line, i) => {
            const isOrigin     = line.startsWith('[원인]');
            const isDetail     = line.startsWith('[상세]');
            const isAction     = line.startsWith('[조치내용]');
            const isPrevention = line.startsWith('[재발방지]');
            const label = isOrigin ? '원인' : isDetail ? '상세' : isAction ? '조치' : isPrevention ? '재발방지' : null;
            const text  = label ? line.replace(/^\[(원인|상세|조치내용|재발방지)\]\s*/, '') : line;
            const bg    = isOrigin ? '#dbeafe' : isDetail ? '#f0fdf4' : isAction ? '#fff7ed' : '#fdf4ff';
            const color = isOrigin ? '#1e40af' : isDetail ? '#166534' : isAction ? '#c2410c' : '#7e22ce';
            return (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                {label && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, flexShrink: 0, marginTop: 1, background: bg, color }}>{label}</span>
                )}
                <span>{text}</span>
              </div>
            );
          })}
          {imgs.length > 0 && <ImgStrip urls={imgs} />}
        </div>
      );
    }

    // Plain text with optional [imgs]
    if (desc.includes('[imgs]')) {
      const parts = desc.split('\n');
      const imgsLine = parts.find(l => l.startsWith('[imgs]')) || '';
      const text = parts.filter(l => !l.startsWith('[imgs]')).join('\n');
      let imgs = [];
      try { if (imgsLine) imgs = JSON.parse(imgsLine.replace('[imgs] ', '')); } catch {}
      return (
        <div>
          <div className="tl-desc" style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
          <ImgStrip urls={imgs} />
        </div>
      );
    }

    return <div className="tl-desc">{desc}</div>;
  };


  return (
    <div>
      {/* 상단 버튼 바 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <button className="back-btn" onClick={() => navigate('/claims')}>← 클레임 목록으로</button>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* 이메일 알림 버튼 */}
          {isClosed && !editMode && (
            <button
              className="btn btn-sm no-print"
              onClick={() => window.open(`/claims/${id}/report`, '_blank')}
              style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', fontWeight: 700 }}
            >
              📄 처리결과보고서
            </button>
          )}
          {!editMode && (
            <a
              href={makeMailtoLink(claim, notifyEmails)}
              className="btn btn-ghost btn-sm no-print"
              style={{ textDecoration: 'none', color: '#1d4ed8', borderColor: '#bfdbfe', background: '#eff6ff' }}
              title={notifyEmails.length > 0 ? `수신: ${notifyEmails.join(', ')}` : '수신자 없음 (로그인 후 이메일 자동 등록됨)'}
            >
              📧 이메일 알림
            </a>
          )}
          {user && !editMode && (
            <button className="btn btn-ghost btn-sm" onClick={startEdit}>✏️ 수정</button>
          )}
          {isAdmin && !editMode && (
            <button className="btn btn-danger btn-sm" onClick={handleDelete}>🗑 삭제</button>
          )}
          {user && !isAdmin && !editMode && (
            <button
              className="btn btn-sm"
              onClick={() => setDeleteReqOpen(true)}
              style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}
            >
              🗑 삭제 요청하기
            </button>
          )}
        </div>
      </div>

      <div className="page-header">
        <div>
          <div className="page-title">{claim.customer_name} 클레임</div>
          <div className="page-sub">
            접수일: {claim.receipt_date || '-'} &nbsp;·&nbsp; 발생일: {claim.occurrence_date || '-'}
          </div>
        </div>
        <StageBadge stage={claim.current_stage} />
      </div>

      {/* 관리자용 삭제 요청 패널 */}
      {isAdmin && pendingReqs.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 10 }}>
            ⚠️ 삭제 요청 {pendingReqs.length}건 (처리 대기중)
          </div>
          {pendingReqs.map(req => (
            <div key={req.id} style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                  요청자: <strong>{req.requester_name || req.requester_email}</strong>
                  &nbsp;·&nbsp;{req.created_at ? new Date(req.created_at).toLocaleDateString('ko-KR') : ''}
                </div>
                <div style={{ fontSize: 13, color: '#7c3aed', background: '#f5f3ff', padding: '6px 10px', borderRadius: 6 }}>
                  "{req.reason}"
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="btn btn-danger btn-sm" onClick={() => handleApproveRequest(req.id)}>삭제 승인</button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleRejectRequest(req.id)}>거절</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 기본 정보 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="card-title" style={{ margin: 0 }}>📋 클레임 기본 정보</div>
          {editMode && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? '저장 중...' : '💾 저장'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditMode(false)} disabled={saving}>취소</button>
            </div>
          )}
        </div>

        {editMode ? (
          <div>
            <div className="form-grid form-cols-4" style={{ marginBottom: 12 }}>
              <div className="form-group form-span-4">
                <label>고객사 그룹</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {CUSTOMER_GROUPS.map(g => (
                    <button key={g} type="button"
                      onClick={() => setEditForm(prev => ({ ...prev, customer_group: prev.customer_group === g ? '' : g }))}
                      style={{
                        padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit',
                        background: editForm.customer_group === g ? '#0f172a' : '#fff',
                        color: editForm.customer_group === g ? '#fff' : '#64748b',
                        borderColor: editForm.customer_group === g ? '#0f172a' : '#e2e8f0',
                      }}
                    >{g}</button>
                  ))}
                </div>
              </div>
              <div className="form-group form-span-2">
                <label>고객사명 <span className="required-star">*</span></label>
                <input value={editForm.customer_name} onChange={setEF('customer_name')} placeholder="고객사명" />
              </div>
              <div className="form-group">
                <label>발생일</label>
                <input type="date" value={editForm.occurrence_date} onChange={setEF('occurrence_date')} />
              </div>
              <div className="form-group">
                <label>접수일</label>
                <input type="date" value={editForm.receipt_date} onChange={setEF('receipt_date')} />
              </div>
              <div className="form-group">
                <label>영업담당 부서</label>
                <select value={editForm.sales_rep_dept} onChange={setEF('sales_rep_dept')}>
                  <option value="">부서 선택</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>영업담당자</label>
                <input value={editForm.sales_rep_name} onChange={setEF('sales_rep_name')} placeholder="이름" />
              </div>
              <div className="form-group">
                <label>담당자 연락처</label>
                <input value={editForm.sales_rep_contact} onChange={setEF('sales_rep_contact')} placeholder="010-0000-0000" />
              </div>
              <div className="form-group">
                <label>품번</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={editForm.part_number} onChange={setEF('part_number')} placeholder="품번" style={{ flex: 1 }} />
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => setPartSearchOpen(true)} title="품번/품명 검색">🔍</button>
                </div>
              </div>
              <div className="form-group">
                <label>품명</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={editForm.part_name} onChange={setEF('part_name')} placeholder="품명" style={{ flex: 1 }} />
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => setPartSearchOpen(true)} title="품번/품명 검색">🔍</button>
                </div>
              </div>
              <div className="form-group">
                <label>수량 (EA)</label>
                <input type="number" min="0" value={editForm.quantity} onChange={setEF('quantity')} placeholder="0" />
              </div>
              <div className="form-group">
                <label>LOT 번호</label>
                <input value={editForm.lot_number} onChange={setEF('lot_number')} placeholder="LOT" />
              </div>
              <div className="form-group form-span-4">
                <label>품목 유형</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {PRODUCT_TYPES.map(t => {
                    const tips = { '수입품': '해외 수입 품목', '자체제작상품': 'AJW, SCON, AJP 직접생산품', '내수품': '국내 구매 품목' };
                    return (
                      <Tooltip key={t} text={tips[t]}>
                        <button type="button"
                          onClick={() => setEditForm(prev => ({ ...prev, product_type: prev.product_type === t ? '' : t }))}
                          style={{
                            padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                            cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit',
                            background: editForm.product_type === t ? '#3b82f6' : '#fff',
                            color: editForm.product_type === t ? '#fff' : '#64748b',
                            borderColor: editForm.product_type === t ? '#3b82f6' : '#e2e8f0',
                          }}
                        >{t}</button>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
              <div className="form-group form-span-4">
                <label>품목군</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {PRODUCT_CATEGORIES.map(c => (
                    <button key={c} type="button"
                      onClick={() => setEditForm(prev => ({ ...prev, product_category: prev.product_category === c ? '' : c }))}
                      style={{
                        padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit',
                        background: editForm.product_category === c ? '#7c3aed' : '#fff',
                        color: editForm.product_category === c ? '#fff' : '#64748b',
                        borderColor: editForm.product_category === c ? '#7c3aed' : '#e2e8f0',
                      }}
                    >{c}</button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>불량 수량 (EA)</label>
                <input type="number" min="0" value={editForm.defect_quantity} onChange={setEF('defect_quantity')} placeholder="0" />
              </div>
              <div className="form-group">
                <label>불량률</label>
                {(() => {
                  const q = parseFloat(editForm.quantity);
                  const dq = parseFloat(editForm.defect_quantity);
                  const rate = q > 0 && dq >= 0 ? ((dq / q) * 100).toFixed(1) : null;
                  return (
                    <div style={{
                      padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
                      background: '#f8fafc', fontSize: 13, minHeight: 38, display: 'flex', alignItems: 'center',
                      color: rate !== null ? (parseFloat(rate) > 5 ? '#dc2626' : '#059669') : '#94a3b8',
                      fontWeight: rate !== null ? 700 : 400,
                    }}>
                      {rate !== null ? `${parseFloat(rate) > 5 ? '🔴' : '🟢'} ${rate}% (${dq}/${q}개)` : '-'}
                    </div>
                  );
                })()}
              </div>
              <div className="form-group form-span-4">
                <label>불량증상 <span className="required-star">*</span></label>
                <textarea rows={3} value={editForm.defect_symptom} onChange={setEF('defect_symptom')} placeholder="불량 증상을 상세히 입력하세요" style={{ resize: 'vertical', width: '100%' }} />
              </div>
              <div className="form-group form-span-2">
                <label>발생상황</label>
                <textarea rows={3} value={editForm.defect_situation} onChange={setEF('defect_situation')} placeholder="없으면 '없음'으로 입력하세요" style={{ resize: 'vertical', width: '100%' }} />
              </div>
              <div className="form-group form-span-2">
                <label>고객요청사항</label>
                <textarea rows={3} value={editForm.customer_request} onChange={setEF('customer_request')} placeholder="없으면 '없음'으로 입력하세요" style={{ resize: 'vertical', width: '100%' }} />
              </div>
            </div>
          </div>
        ) : (
          <div className="info-grid">
            {[
              { label: '고객사 그룹',   value: claim.customer_group || '-', chip: claim.customer_group },
              { label: '고객사',        value: claim.customer_name },
              { label: '발생일',        value: claim.occurrence_date || '-' },
              { label: '접수일',        value: claim.receipt_date || '-' },
              { label: '현재 단계',     value: null, badge: true },
              { label: '품번',          value: claim.part_number || '-' },
              { label: '품명',          value: claim.part_name || '-' },
              { label: '품목 유형',     value: claim.product_type || '-', typeChip: claim.product_type },
              { label: '품목군',        value: claim.product_category || '-', catChip: claim.product_category },
              { label: '출고 수량',     value: claim.quantity != null ? Number(claim.quantity).toLocaleString() + ' EA' : '-' },
              { label: 'LOT 번호',      value: claim.lot_number || '-' },
              { label: '불량 수량',     value: claim.defect_quantity != null ? Number(claim.defect_quantity).toLocaleString() + ' EA' : '-' },
              { label: '불량률',        value: null, defRate: true },
              { label: '영업 부서',     value: claim.sales_rep_dept || '-' },
              { label: '영업담당자',    value: claim.sales_rep_name || '-' },
            ].map((item, idx) => (
              <div key={idx} className={`info-item${item.span === 2 ? ' info-span-2' : ''}`}>
                <span className="info-label">{item.label}</span>
                {item.badge
                  ? <StageBadge stage={claim.current_stage} size="sm" />
                  : item.chip
                    ? <span style={{ background: '#0f172a', color: '#fff', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{item.chip}</span>
                    : item.typeChip
                      ? <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{item.typeChip}</span>
                      : item.catChip
                        ? <span style={{ background: '#ede9fe', color: '#5b21b6', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{item.catChip}</span>
                      : item.defRate
                        ? (() => {
                            const q = claim.quantity; const dq = claim.defect_quantity;
                            const rate = q > 0 && dq != null ? ((dq / q) * 100).toFixed(1) : null;
                            return <span className="info-value" style={{ color: rate !== null ? (parseFloat(rate) > 5 ? '#dc2626' : '#059669') : '#94a3b8', fontWeight: 700 }}>
                              {rate !== null ? `${parseFloat(rate) > 5 ? '🔴' : '🟢'} ${rate}% (${dq}/${q}개)` : '-'}
                            </span>;
                          })()
                        : <span className={`info-value${item.mono ? ' mono' : ''}`}>{item.value}</span>}
              </div>
            ))}
          </div>
        )}

        {/* 불량 내용 3칸 섹션 (뷰 모드에서만 표시) */}
        {!editMode && claim.defect_description && (() => {
          const d = parseDefect(claim.defect_description);
          return (
            <div style={{ marginTop: 14, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 10, letterSpacing: 0.5 }}>불량 내용</div>
              {d.legacy ? (
                <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {d.symptom}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <DefectBox label="불량증상" text={d.symptom} color="#eff6ff" labelColor="#1e40af" />
                  <DefectBox label="발생상황" text={d.situation} color="#f0fdf4" labelColor="#166534" />
                  <DefectBox label="고객요청사항" text={d.request} color="#fff7ed" labelColor="#c2410c" />
                </div>
              )}
              {d.imgs && d.imgs.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>첨부 사진 ({d.imgs.length}장)</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {d.imgs.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt={`사진${i+1}`}
                          style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer' }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* 처리 단계 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">📍 처리 단계 현황</div>
        <StageTracker currentStage={claim.current_stage} stageEntries={history} />

        {user && !isClosed && renderAdvanceForm()}

        {isClosed && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: '#d1fae5', borderRadius: 8, fontSize: 13, color: '#065f46', fontWeight: 600 }}>
            ✅ 이 클레임은 종결 처리되었습니다.
          </div>
        )}
      </div>

      {/* 처리 이력 */}
      <div className="card">
        <div className="card-title">📜 처리 이력</div>
        {history.length === 0 ? (
          <div className="empty" style={{ padding: 24 }}>이력이 없습니다</div>
        ) : (
          <div className="timeline">
            {history.map((entry, i) => {
              const sc = STAGE_COLORS[entry.stage_name] || { dot: '#94a3b8' };
              // handler(담당자 입력값)를 우선, 없으면 실제 로그인 계정명
              const displayName = entry.handler || entry.user_name || entry.user_email || '';
              const isEditing = editingEntryId === entry.id;
              return (
                <div key={entry.id || i} className="tl-item">
                  <div className="tl-dot" style={{ background: sc.dot }} />
                  <div className="tl-content">
                    <div className="tl-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="tl-stage">{entry.stage_name}</span>
                        {entry.stage_date && <span className="tl-date">{entry.stage_date}</span>}
                      </div>
                      {user && !isEditing && (
                        <button
                          className="btn btn-ghost btn-sm no-print"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => {
                            setEditingEntryId(entry.id);
                            const desc = entry.description || '';
                            setEntryEditFiles([]);
                            if (desc.includes('[상세JSON]')) {
                              // 회수품 원인분析: cause edit mode (detected by format)
                              setEntryEditMode('cause');
                              setEntryEditExistingImgs([]);
                              setEntryEdit({ stage_date: entry.stage_date || '', description: desc, handler: entry.handler || '', handler_dept: entry.handler_dept || '' });
                              let parsedCauses = [];
                              const jl = desc.split('\n').find(l => l.startsWith('[상세JSON]')) || '';
                              try { parsedCauses = JSON.parse(jl.replace('[상세JSON] ', '')); } catch {}
                              setEntryEditCauses(parsedCauses.length ? parsedCauses.map(c => ({ text: c.text || '', existingImgs: c.imgs || [], newFiles: [] })) : [{ text: '', existingImgs: [], newFiles: [] }]);
                            } else {
                              // 기타/조치: strip [imgs] from description, store as existing thumbnails
                              setEntryEditMode(entry.stage_name === '조치' ? 'action' : 'raw');
                              setEntryEditCauses([]);
                              let existingImgs = [];
                              const im = desc.match(/\n+\[imgs\] (\[.*\])$/s);
                              if (im) { try { existingImgs = JSON.parse(im[1]); } catch {} }
                              setEntryEditExistingImgs(existingImgs);
                              setEntryEdit({ stage_date: entry.stage_date || '', description: desc.replace(/\n+\[imgs\] \[.*\]$/s, ''), handler: entry.handler || '', handler_dept: entry.handler_dept || '' });
                            }
                          }}
                        >✏️ 수정</button>
                      )}
                    </div>

                    {isEditing ? (
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginTop: 8 }}>
                        <div className="adv-grid-3" style={{ marginBottom: 10 }}>
                          <div className="form-group">
                            <label style={{ fontSize: 11 }}>처리일</label>
                            <input type="date" value={entryEdit.stage_date || ''} onChange={e => setEntryEdit(p => ({ ...p, stage_date: e.target.value }))} />
                          </div>
                          <div className="form-group">
                            <label style={{ fontSize: 11 }}>담당 부서</label>
                            <select value={entryEdit.handler_dept || ''} onChange={e => setEntryEdit(p => ({ ...p, handler_dept: e.target.value }))}>
                              <option value="">부서 선택</option>
                              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </div>
                          <div className="form-group">
                            <label style={{ fontSize: 11 }}>담당자</label>
                            <input
                              list={entryEditMode === 'cause' ? 'entry-inspectors' : 'entry-salesreps'}
                              value={entryEdit.handler || ''}
                              onChange={e => setEntryEdit(p => ({ ...p, handler: e.target.value }))}
                            />
                            <datalist id="entry-inspectors">
                              {INSPECTORS.map(n => <option key={n} value={n} />)}
                            </datalist>
                            <datalist id="entry-salesreps">
                              {SALES_REPS.map(n => <option key={n} value={n} />)}
                            </datalist>
                          </div>
                        </div>

                        {/* ── 원인분析 수정 UI ── */}
                        {entryEditMode === 'cause' ? (
                          <div style={{ marginBottom: 10 }}>
                            <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>원인별 상세 내용</label>
                            <input ref={entryEditCauseRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                              onChange={e => {
                                const files = Array.from(e.target.files || []);
                                const i2 = entryEditCauseIdx.current;
                                if (files.length > 0) setEntryEditCauses(p => p.map((c, i) => i === i2 ? { ...c, newFiles: [...(c.newFiles||[]), ...files] } : c));
                              }}
                            />
                            {entryEditCauses.map((item, idx) => (
                              <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, marginBottom: 8, background: '#fff' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                  <span style={{ background: '#dbeafe', color: '#1e40af', fontWeight: 700, fontSize: 10, padding: '2px 7px', borderRadius: 12 }}>{idx+1}번째 원인</span>
                                  {entryEditCauses.length > 1 && (
                                    <button type="button" onClick={() => setEntryEditCauses(p => p.filter((_, i) => i !== idx))}
                                      style={{ marginLeft: 'auto', fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>✕ 삭제</button>
                                  )}
                                </div>
                                <textarea rows={2} value={item.text}
                                  onChange={e => setEntryEditCauses(p => p.map((c, i) => i === idx ? { ...c, text: e.target.value } : c))}
                                  style={{ resize: 'vertical', width: '100%', marginBottom: 6 }}
                                />
                                {item.existingImgs && item.existingImgs.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                                    {item.existingImgs.map((url, ui) => (
                                      <div key={ui} style={{ position: 'relative' }}>
                                        <a href={url} target="_blank" rel="noreferrer">
                                          <img src={url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0' }} />
                                        </a>
                                        <button type="button"
                                          onClick={() => setEntryEditCauses(p => p.map((c, i) => i === idx ? { ...c, existingImgs: c.existingImgs.filter((_, j) => j !== ui) } : c))}
                                          style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 16, height: 16, fontSize: 9, cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginTop: 4 }}>
                                  <button type="button"
                                    onClick={() => { entryEditCauseIdx.current = idx; entryEditCauseRef.current?.click(); }}
                                    style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer' }}>📷 사진 추가</button>
                                  {item.newFiles && item.newFiles.map((f, fi) => (
                                    <span key={fi} style={{ fontSize: 10, background: '#eff6ff', borderRadius: 4, padding: '1px 6px' }}>📷 {f.name}
                                      <button type="button" onClick={() => setEntryEditCauses(p => p.map((c, i) => i === idx ? { ...c, newFiles: c.newFiles.filter((_, j) => j !== fi) } : c))}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', marginLeft: 2 }}>✕</button>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                            <button type="button" onClick={() => setEntryEditCauses(p => [...p, { text: '', existingImgs: [], newFiles: [] }])}
                              style={{ fontSize: 11, color: '#3b82f6', background: 'none', border: '1px dashed #93c5fd', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', width: '100%' }}>+ 원인 추가</button>
                          </div>
                        ) : (
                          /* ── 기타 단계 수정 UI ── */
                          <div className="form-group" style={{ marginBottom: 10 }}>
                            <label style={{ fontSize: 11 }}>처리 내용</label>
                            <textarea rows={3} value={entryEdit.description || ''}
                              onChange={e => setEntryEdit(p => ({ ...p, description: e.target.value }))}
                              style={{ resize: 'vertical', width: '100%' }}
                            />
                            <div style={{ marginTop: 8 }}>
                              <label style={{ fontSize: 11, color: '#64748b' }}>사진 첨부 <span style={{ fontSize: 10, color: '#94a3b8' }}>(선택)</span></label>
                              <input ref={entryEditFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                                onChange={e => { const files = Array.from(e.target.files || []); if (files.length > 0) setEntryEditFiles(prev => [...prev, ...files]); }}
                              />
                              {entryEditExistingImgs.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                  {entryEditExistingImgs.map((url, i) => (
                                    <div key={i} style={{ position: 'relative' }}>
                                      <a href={url} target="_blank" rel="noreferrer">
                                        <img src={url} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }} />
                                      </a>
                                      <button type="button" onClick={() => setEntryEditExistingImgs(p => p.filter((_, j) => j !== i))}
                                        style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 16, height: 16, fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, alignItems: 'center' }}>
                                <button type="button" onClick={() => entryEditFileRef.current?.click()}
                                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer' }}>📷 사진 선택</button>
                                {entryEditFiles.map((f, i) => (
                                  <span key={i} style={{ fontSize: 10, background: '#eff6ff', borderRadius: 4, padding: '1px 6px' }}>📷 {f.name}
                                    <button type="button" onClick={() => setEntryEditFiles(p => p.filter((_, j) => j !== i))}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', marginLeft: 2 }}>✕</button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-primary btn-sm" onClick={handleSaveEntry} disabled={savingEntry}>
                            {savingEntry ? '저장 중...' : '💾 저장'}
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setEditingEntryId(null); setEntryEditFiles([]); setEntryEditCauses([]); }}>취소</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {entry.description && renderDescription(entry.description)}
                        {(displayName || entry.handler_dept) && (
                          <div className="tl-handler">
                            👤 {entry.handler_dept && <span style={{ fontSize: 11, background: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: 4, marginRight: 4 }}>{entry.handler_dept}</span>}
                            {displayName}
                            {false && (
                              <span style={{ color: '#94a3b8', marginLeft: 4 }}>({entry.user_email})</span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {partSearchOpen && (
        <PartSearchModal
          onSelect={(pno, pname) => setEditForm(prev => ({ ...prev, part_number: pno, part_name: pname }))}
          onClose={() => setPartSearchOpen(false)}
        />
      )}

      {deleteReqOpen && (
        <DeleteRequestModal
          claimName={claim.customer_name}
          onClose={() => setDeleteReqOpen(false)}
          onSubmit={handleDeleteRequest}
        />
      )}
    </div>
  );
}




