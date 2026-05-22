import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useClaims } from '../context/ClaimsContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { advanceClaim, deleteClaim, updateClaim, insertDeleteRequest, resolveDeleteRequest, fetchNotifyEmails, STAGES, STAGE_ICONS, STAGE_COLORS, CUSTOMER_GROUPS, PRODUCT_TYPES } from '../lib/supabase';
import Tooltip from '../components/Tooltip';
import StageTracker from '../components/StageTracker';
import StageBadge from '../components/StageBadge';
import PartSearchModal from '../components/PartSearchModal';
import DeleteRequestModal from '../components/DeleteRequestModal';

const CAUSES = ['사용자 과실', '생산공정', '제품불량', '구조불량', '배송오류', '기타'];

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
  const { claims, loading, getStagesFor, updateClaimStage, updateClaimData, removeClaim, deleteRequests, addDeleteRequest, resolveRequest } = useClaims();
  const { user, isAdmin } = useAuth();
  const toast = useToast();

  const [notifyEmails, setNotifyEmails] = useState([]);
  useEffect(() => { fetchNotifyEmails().then(setNotifyEmails).catch(() => {}); }, []);

  /* ── 단계 진행 공통 상태 ── */
  const [advDate,    setAdvDate]    = useState(new Date().toISOString().slice(0, 10));
  const [advHandler, setAdvHandler] = useState('');
  const [advDesc,    setAdvDesc]    = useState('');
  const [advancing,  setAdvancing]  = useState(false);

  /* ── 회수품 원인분석 전용 상태 ── */
  const [selectedCauses,   setSelectedCauses]   = useState([]);
  const [etcDetail,        setEtcDetail]        = useState('');
  const [analysisDetail,   setAnalysisDetail]   = useState('');

  /* ── 조치 단계 전용 상태 ── */
  const [preventionMeasure, setPreventionMeasure] = useState('');

  /* ── 수정 모드 상태 ── */
  const [editMode, setEditMode]             = useState(false);
  const [editForm, setEditForm]             = useState(null);
  const [saving,   setSaving]               = useState(false);
  const [partSearchOpen, setPartSearchOpen] = useState(false);
  const [deleteReqOpen,  setDeleteReqOpen]  = useState(false);

  if (loading) return <div className="loading">⏳ 불러오는 중...</div>;

  const claim = claims.find(c => c.id === id);
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
      if (!analysisDetail.trim()) {
        toast('입력 필요', '상세 내용은 필수 입력 항목입니다', 'error');
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
      let description = advDesc;
      if (claim.current_stage === '회수품 원인분석') {
        const causeStr = selectedCauses
          .map(c => c === '기타' ? `기타(${etcDetail.trim()})` : c)
          .join(', ');
        description = `[원인] ${causeStr}\n[상세] ${analysisDetail.trim()}`;
      }
      if (claim.current_stage === '조치') {
        description = `[조치내용] ${advDesc.trim()}\n[재발방지] ${preventionMeasure.trim()}`;
      }

      const { nextStage: ns, entry } = await advanceClaim(
        id, claim.current_stage,
        { stage_date: advDate, description, handler: advHandler || user?.displayName || '' },
        user
      );
      updateClaimStage(id, ns, entry);
      setAdvDesc('');
      setAdvHandler('');
      setSelectedCauses([]);
      setEtcDetail('');
      setAnalysisDetail('');
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
    setEditForm({
      customer_group:     claim.customer_group || '',
      customer_name:      claim.customer_name || '',
      occurrence_date:    claim.occurrence_date || '',
      receipt_date:       claim.receipt_date || '',
      sales_rep_name:     claim.sales_rep_name || '',
      sales_rep_contact:  claim.sales_rep_contact || '',
      part_number:        claim.part_number || '',
      part_name:          claim.part_name || '',
      product_type:       claim.product_type || '',
      quantity:           claim.quantity != null ? String(claim.quantity) : '',
      lot_number:         claim.lot_number || '',
      defect_quantity:    claim.defect_quantity != null ? String(claim.defect_quantity) : '',
      defect_description: claim.defect_description || '',
    });
    setEditMode(true);
  };

  const setEF = (key) => (e) => setEditForm(prev => ({ ...prev, [key]: e.target.value }));

  /* ── 수정 저장 ── */
  const handleSave = async () => {
    if (!editForm.customer_name.trim()) { toast('입력 오류', '고객사명을 입력하세요', 'error'); return; }
    if (!editForm.defect_description.trim()) { toast('입력 오류', '불량내용을 입력하세요', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        customer_group:     editForm.customer_group || null,
        customer_name:      editForm.customer_name.trim(),
        occurrence_date:    editForm.occurrence_date || null,
        receipt_date:       editForm.receipt_date || null,
        sales_rep_name:     editForm.sales_rep_name.trim() || null,
        sales_rep_contact:  editForm.sales_rep_contact.trim() || null,
        part_number:        editForm.part_number.trim() || null,
        part_name:          editForm.part_name.trim() || null,
        product_type:       editForm.product_type || null,
        quantity:           editForm.quantity !== '' ? parseInt(editForm.quantity) : null,
        lot_number:         editForm.lot_number.trim() || null,
        defect_quantity:    editForm.defect_quantity !== '' ? parseInt(editForm.defect_quantity) : null,
        defect_description: editForm.defect_description.trim(),
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
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 12 }}>
          {STAGE_ICONS[currentIdx + 1]}&nbsp;
          <span style={{ color: '#3b82f6' }}>{nextStage}</span> 단계로 진행
        </div>

        {/* 공통: 처리일 + 담당자 */}
        <div className="form-grid form-cols-2" style={{ marginBottom: 12 }}>
          <div className="form-group">
            <label>처리일</label>
            <input type="date" value={advDate} onChange={e => setAdvDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label>
              담당자
              <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 6, fontWeight: 400 }}>
                (비우면 로그인 이름 자동 기록)
              </span>
            </label>
            <input
              placeholder={user?.displayName || user?.email}
              value={advHandler}
              onChange={e => setAdvHandler(e.target.value)}
            />
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

            {/* 상세 내용 (필수) */}
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>
                상세 내용 <span className="required-star">*</span>
              </label>
              <textarea
                rows={4}
                placeholder="원인 분석 결과를 상세하게 작성하세요 (필수)"
                value={analysisDetail}
                onChange={e => setAnalysisDetail(e.target.value)}
                style={{
                  resize: 'vertical', width: '100%',
                  borderColor: analysisDetail.trim() ? '#e2e8f0' : '#fca5a5',
                }}
              />
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
          </div>
        )}

        <div className="form-actions">
          <button className="btn btn-success" onClick={handleAdvance} disabled={advancing}>
            {advancing ? '처리 중...' : `→ ${nextStage}으로 진행`}
          </button>
        </div>
      </div>
    );
  };

  /* ── 이력 항목 렌더 (원인분석 포맷 파싱) ── */
  const renderDescription = (desc) => {
    if (!desc) return null;
    if (desc.startsWith('[원인]') || desc.startsWith('[조치내용]')) {
      const lines = desc.split('\n');
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {lines.map((line, i) => {
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
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 6px',
                    borderRadius: 4, flexShrink: 0, marginTop: 1,
                    background: bg, color,
                  }}>{label}</span>
                )}
                <span>{text}</span>
              </div>
            );
          })}
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
                <label>불량 내용 <span className="required-star">*</span></label>
                <textarea rows={3} value={editForm.defect_description} onChange={setEF('defect_description')} placeholder="불량 내용을 상세하게 입력하세요" style={{ resize: 'vertical', width: '100%' }} />
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
              { label: '품번',          value: claim.part_number || '-', mono: true },
              { label: '품명',          value: claim.part_name || '-' },
              { label: '품목 유형',     value: claim.product_type || '-', typeChip: claim.product_type },
              { label: '출고 수량',      value: claim.quantity != null ? Number(claim.quantity).toLocaleString() + ' EA' : '-' },
              { label: 'LOT 번호',      value: claim.lot_number || '-', mono: true },
              { label: '불량 수량',     value: claim.defect_quantity != null ? Number(claim.defect_quantity).toLocaleString() + ' EA' : '-' },
              { label: '불량률',        value: null, defRate: true },
              { label: '영업담당자',    value: claim.sales_rep_name || '-' },
              { label: '담당자 연락처', value: claim.sales_rep_contact || '-' },
              { label: '불량 내용',     value: claim.defect_description || '-', span: 2 },
            ].map((item, idx) => (
              <div key={idx} className={`info-item${item.span === 2 ? ' info-span-2' : ''}`}>
                <span className="info-label">{item.label}</span>
                {item.badge
                  ? <StageBadge stage={claim.current_stage} size="sm" />
                  : item.chip
                    ? <span style={{ background: '#0f172a', color: '#fff', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{item.chip}</span>
                    : item.typeChip
                      ? <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{item.typeChip}</span>
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
      </div>

      {/* 처리 단계 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">📍 처리 단계 현황</div>
        <StageTracker currentStage={claim.current_stage} />

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
              const displayName = entry.user_name || entry.user_email || entry.handler || '';
              return (
                <div key={entry.id || i} className="tl-item">
                  <div className="tl-dot" style={{ background: sc.dot }} />
                  <div className="tl-content">
                    <div className="tl-header">
                      <span className="tl-stage">{entry.stage_name}</span>
                      {entry.stage_date && <span className="tl-date">{entry.stage_date}</span>}
                    </div>
                    {entry.description && renderDescription(entry.description)}
                    {displayName && (
                      <div className="tl-handler">
                        👤 {displayName}
                        {entry.user_email && entry.user_name && (
                          <span style={{ color: '#94a3b8', marginLeft: 4 }}>({entry.user_email})</span>
                        )}
                      </div>
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
