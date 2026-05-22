import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useClaims } from '../context/ClaimsContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { advanceClaim, deleteClaim, updateClaim, insertDeleteRequest, resolveDeleteRequest, STAGES, STAGE_ICONS, STAGE_COLORS } from '../lib/supabase';
import StageTracker from '../components/StageTracker';
import StageBadge from '../components/StageBadge';
import PartSearchModal from '../components/PartSearchModal';
import DeleteRequestModal from '../components/DeleteRequestModal';

export default function ClaimDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { claims, loading, getStagesFor, updateClaimStage, updateClaimData, removeClaim, deleteRequests, addDeleteRequest, resolveRequest } = useClaims();
  const { user, isAdmin } = useAuth();
  const toast = useToast();

  const [advDate,    setAdvDate]    = useState(new Date().toISOString().slice(0, 10));
  const [advHandler, setAdvHandler] = useState('');
  const [advDesc,    setAdvDesc]    = useState('');
  const [advancing,  setAdvancing]  = useState(false);

  const [editMode, setEditMode]           = useState(false);
  const [editForm, setEditForm]           = useState(null);
  const [saving,   setSaving]             = useState(false);
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

  // 이 클레임에 대한 대기 중인 삭제 요청
  const pendingReqs = deleteRequests.filter(r => r.claim_id === id);

  /* ── 단계 진행 ── */
  const handleAdvance = async () => {
    setAdvancing(true);
    try {
      const { nextStage: ns, entry } = await advanceClaim(
        id, claim.current_stage,
        { stage_date: advDate, description: advDesc, handler: advHandler || user?.displayName || '' },
        user
      );
      updateClaimStage(id, ns, entry);
      setAdvDesc(''); setAdvHandler('');
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
      customer_name:      claim.customer_name || '',
      occurrence_date:    claim.occurrence_date || '',
      receipt_date:       claim.receipt_date || '',
      sales_rep_name:     claim.sales_rep_name || '',
      sales_rep_contact:  claim.sales_rep_contact || '',
      part_number:        claim.part_number || '',
      part_name:          claim.part_name || '',
      quantity:           claim.quantity != null ? String(claim.quantity) : '',
      lot_number:         claim.lot_number || '',
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
        customer_name:      editForm.customer_name.trim(),
        occurrence_date:    editForm.occurrence_date || null,
        receipt_date:       editForm.receipt_date || null,
        sales_rep_name:     editForm.sales_rep_name.trim() || null,
        sales_rep_contact:  editForm.sales_rep_contact.trim() || null,
        part_number:        editForm.part_number.trim() || null,
        part_name:          editForm.part_name.trim() || null,
        quantity:           editForm.quantity !== '' ? parseInt(editForm.quantity) : null,
        lot_number:         editForm.lot_number.trim() || null,
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

  return (
    <div>
      {/* 상단 버튼 바 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <button className="back-btn" onClick={() => navigate('/claims')}>← 클레임 목록으로</button>
        <div style={{ display: 'flex', gap: 8 }}>
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
        <div style={{
          background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10,
          padding: '14px 16px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 10 }}>
            ⚠️ 삭제 요청 {pendingReqs.length}건 (처리 대기중)
          </div>
          {pendingReqs.map(req => (
            <div key={req.id} style={{
              background: '#fff', border: '1px solid #fde68a', borderRadius: 8,
              padding: '10px 14px', display: 'flex', alignItems: 'flex-start',
              gap: 12, marginBottom: 8,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                  요청자: <strong>{req.requester_name || req.requester_email}</strong>
                  &nbsp;·&nbsp;{req.created_at ? new Date(req.created_at).toLocaleDateString('ko-KR') : ''}
                </div>
                <div style={{
                  fontSize: 13, color: '#7c3aed',
                  background: '#f5f3ff', padding: '6px 10px', borderRadius: 6,
                }}>
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
          /* ── 수정 폼 ── */
          <div>
            <div className="form-grid form-cols-4" style={{ marginBottom: 12 }}>
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
                <label>불량 내용 <span className="required-star">*</span></label>
                <textarea
                  rows={3}
                  value={editForm.defect_description}
                  onChange={setEF('defect_description')}
                  placeholder="불량 내용을 상세하게 입력하세요"
                  style={{ resize: 'vertical', width: '100%' }}
                />
              </div>
            </div>
          </div>
        ) : (
          /* ── 보기 모드 ── */
          <div className="info-grid">
            {[
              { label: '고객사',        value: claim.customer_name },
              { label: '발생일',        value: claim.occurrence_date || '-' },
              { label: '접수일',        value: claim.receipt_date || '-' },
              { label: '현재 단계',     value: null, badge: true },
              { label: '품번',          value: claim.part_number || '-', mono: true },
              { label: '품명',          value: claim.part_name || '-' },
              { label: '수량',          value: claim.quantity != null ? Number(claim.quantity).toLocaleString() + ' EA' : '-' },
              { label: 'LOT 번호',      value: claim.lot_number || '-', mono: true },
              { label: '영업담당자',    value: claim.sales_rep_name || '-' },
              { label: '담당자 연락처', value: claim.sales_rep_contact || '-' },
              { label: '불량 내용',     value: claim.defect_description || '-', span: 2 },
            ].map((item, idx) => (
              <div key={idx} className={`info-item${item.span === 2 ? ' info-span-2' : ''}`}>
                <span className="info-label">{item.label}</span>
                {item.badge
                  ? <StageBadge stage={claim.current_stage} size="sm" />
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

        {user && !isClosed && (
          <div className="advance-section">
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 12 }}>
              {STAGE_ICONS[currentIdx + 1]}&nbsp;
              <span style={{ color: '#3b82f6' }}>{nextStage}</span> 단계로 진행
            </div>
            <div className="form-grid form-cols-3">
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
                  placeholder={user.displayName || user.email}
                  value={advHandler}
                  onChange={e => setAdvHandler(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>처리 내용</label>
                <input
                  placeholder="처리 내용을 입력하세요"
                  value={advDesc}
                  onChange={e => setAdvDesc(e.target.value)}
                />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-success" onClick={handleAdvance} disabled={advancing}>
                {advancing ? '처리 중...' : `→ ${nextStage}으로 진행`}
              </button>
            </div>
          </div>
        )}

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
                    {entry.description && <div className="tl-desc">{entry.description}</div>}
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

      {/* 품번/품명 검색 모달 */}
      {partSearchOpen && (
        <PartSearchModal
          onSelect={(pno, pname) => setEditForm(prev => ({ ...prev, part_number: pno, part_name: pname }))}
          onClose={() => setPartSearchOpen(false)}
        />
      )}

      {/* 삭제 요청 모달 */}
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
