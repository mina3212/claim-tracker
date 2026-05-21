import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useClaims } from '../context/ClaimsContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { advanceClaim, deleteClaim, STAGES, STAGE_ICONS, STAGE_COLORS } from '../lib/supabase';
import StageTracker from '../components/StageTracker';
import StageBadge from '../components/StageBadge';

export default function ClaimDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { claims, loading, getStagesFor, updateClaimStage, removeClaim } = useClaims();
  const { user, isAdmin } = useAuth();
  const toast = useToast();

  const [advDate,    setAdvDate]    = useState(new Date().toISOString().slice(0, 10));
  const [advHandler, setAdvHandler] = useState('');
  const [advDesc,    setAdvDesc]    = useState('');
  const [advancing,  setAdvancing]  = useState(false);

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

  const handleAdvance = async () => {
    setAdvancing(true);
    try {
      const { nextStage: ns, entry } = await advanceClaim(
        id,
        claim.current_stage,
        { stage_date: advDate, description: advDesc, handler: advHandler || user?.displayName || '' },
        user
      );
      updateClaimStage(id, ns, entry);
      setAdvDesc('');
      setAdvHandler('');
      toast(`"${ns}"으로 진행 완료`, '', 'success');
    } catch (err) {
      toast('진행 실패', err.message, 'error');
    } finally {
      setAdvancing(false);
    }
  };

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

  const infoItems = [
    { label: '고객사',       value: claim.customer_name },
    { label: '발생일',       value: claim.occurrence_date || '-' },
    { label: '접수일',       value: claim.receipt_date || '-' },
    { label: '현재 단계',    value: null, badge: true },
    { label: '품번',         value: claim.part_number || '-', mono: true },
    { label: '품명',         value: claim.part_name || '-' },
    { label: '수량',         value: claim.quantity != null ? Number(claim.quantity).toLocaleString() + ' EA' : '-' },
    { label: 'LOT 번호',     value: claim.lot_number || '-', mono: true },
    { label: '영업담당자',   value: claim.sales_rep_name || '-' },
    { label: '담당자 연락처', value: claim.sales_rep_contact || '-' },
    { label: '불량 내용',    value: claim.defect_description || '-', span: 2 },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <button className="back-btn" onClick={() => navigate('/claims')}>← 클레임 목록으로</button>
        {isAdmin && (
          <button className="btn btn-danger btn-sm" onClick={handleDelete}>🗑 삭제</button>
        )}
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

      {/* 기본 정보 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">📋 클레임 기본 정보</div>
        <div className="info-grid">
          {infoItems.map((item, idx) => (
            <div key={idx} className={`info-item${item.span === 2 ? ' info-span-2' : ''}`}>
              <span className="info-label">{item.label}</span>
              {item.badge
                ? <StageBadge stage={claim.current_stage} size="sm" />
                : <span className={`info-value${item.mono ? ' mono' : ''}`}>{item.value}</span>}
            </div>
          ))}
        </div>
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
    </div>
  );
}
