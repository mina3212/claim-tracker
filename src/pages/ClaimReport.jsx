import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useClaims } from '../context/ClaimsContext';
import { STAGE_COLORS } from '../lib/supabase';

function parseDesc(desc) {
  if (!desc) return { type: 'plain', text: '' };
  if (desc.startsWith('[원인]')) {
    const lines = desc.split('\n');
    const cause  = lines.find(l => l.startsWith('[원인]'))?.replace('[원인] ', '') || '';
    const detail = lines.find(l => l.startsWith('[상세]'))?.replace('[상세] ', '') || '';
    return { type: 'cause', cause, detail };
  }
  if (desc.startsWith('[조치내용]')) {
    const lines   = desc.split('\n');
    const action  = lines.find(l => l.startsWith('[조치내용]'))?.replace('[조치내용] ', '') || '';
    const prevent = lines.find(l => l.startsWith('[재발방지]'))?.replace('[재발방지] ', '') || '';
    return { type: 'action', action, prevent };
  }
  return { type: 'plain', text: desc };
}

const APPROVERS = ['작성', '팀장', 'COO', 'CEO'];

export default function ClaimReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { claims, loading, getStagesFor } = useClaims();

  useEffect(() => { document.title = 'AJW 클레임 처리결과보고서'; }, []);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
      불러오는 중...
    </div>
  );

  const claim = claims.find(c => c.id === id);
  if (!claim) return (
    <div style={{ padding: 40, color: '#ef4444' }}>
      클레임을 찾을 수 없습니다.
      <button onClick={() => navigate('/claims')} style={{ marginLeft: 16 }}>목록으로</button>
    </div>
  );

  if (claim.current_stage !== '종결') return (
    <div style={{ padding: 40, color: '#f59e0b', fontFamily: 'sans-serif' }}>
      ⚠️ 종결된 클레임에 한해 처리결과보고서를 발행할 수 있습니다.
      <button onClick={() => window.close()} style={{ marginLeft: 16 }}>닫기</button>
    </div>
  );

  const history = getStagesFor(id);
  const today   = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const defRate = (() => {
    const q = claim.quantity; const dq = claim.defect_quantity;
    return q > 0 && dq != null ? ((dq / q) * 100).toFixed(1) + '%' : '-';
  })();

  const causeEntry   = history.find(h => h.stage_name === '회수품 원인분석');
  const actionEntry  = history.find(h => h.stage_name === '조치');
  const causeParsed  = causeEntry  ? parseDesc(causeEntry.description)  : null;
  const actionParsed = actionEntry ? parseDesc(actionEntry.description) : null;

  return (
    <div style={{ fontFamily: "'Nanum Gothic','Malgun Gothic',sans-serif", background: '#fff', minHeight: '100vh', padding: '0 0 40px' }}>

      {/* ── 화면 전용 버튼 ── */}
      <div className="report-screen-bar" style={{
        background: '#1e293b', padding: '10px 24px', display: 'flex', gap: 10, alignItems: 'center',
      }}>
        <button
          onClick={() => window.print()}
          style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          🖨️ 인쇄 / PDF 저장
        </button>
        <button
          onClick={() => window.close()}
          style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #475569', borderRadius: 6, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}
        >
          닫기
        </button>
        <span style={{ color: '#64748b', fontSize: 12, marginLeft: 8 }}>A4 세로 · 여백 최소 · 배경그래픽 포함</span>
      </div>

      {/* ── 보고서 본문 ── */}
      <div className="rpt-body" style={{ maxWidth: 800, margin: '0 auto', padding: '24px 32px 0' }}>

        {/* ── 헤더 (제목 + 결재란) ── */}
        <div style={{ borderBottom: '3px solid #1d4ed8', paddingBottom: 10, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
          <div style={{ flex: '1 1 auto' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1d4ed8', letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>클레임 처리결과보고서</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>CLAIM PROCESSING RESULT REPORT</div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>(주)에이제이월드</div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>발행일: {today}</div>
            </div>
          </div>

          {/* 결재란 — 남은 공간 전부 채움 */}
          <div style={{ flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  {APPROVERS.map(r => (
                    <td key={r} style={{
                      border: '1px solid #94a3b8', padding: '3px 0',
                      textAlign: 'center', fontWeight: 700, fontSize: 10,
                      background: '#f1f5f9',
                    }}>{r}</td>
                  ))}
                </tr>
                <tr>
                  {APPROVERS.map(r => (
                    <td key={r} style={{ border: '1px solid #94a3b8', height: 50 }} />
                  ))}
                </tr>
                <tr>
                  {APPROVERS.map(r => (
                    <td key={r} style={{ border: '1px solid #94a3b8', height: 14 }} />
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 1. 기본 정보 */}
        <div className="rpt-section">1. 기본 정보</div>
        <table className="rpt-tbl">
          <tbody>
            <tr>
              <td className="rpt-td-lbl">고객사 그룹</td>
              <td className="rpt-td-val">{claim.customer_group || '-'}</td>
              <td className="rpt-td-lbl">고객사명</td>
              <td className="rpt-td-val" style={{ fontWeight: 700 }}>{claim.customer_name}</td>
            </tr>
            <tr>
              <td className="rpt-td-lbl">발생일</td>
              <td className="rpt-td-val">{claim.occurrence_date || '-'}</td>
              <td className="rpt-td-lbl">접수일</td>
              <td className="rpt-td-val">{claim.receipt_date || '-'}</td>
            </tr>
            <tr>
              <td className="rpt-td-lbl">품번</td>
              <td className="rpt-td-val" style={{ fontFamily: 'monospace' }}>{claim.part_number || '-'}</td>
              <td className="rpt-td-lbl">품명</td>
              <td className="rpt-td-val">{claim.part_name || '-'}</td>
            </tr>
            <tr>
              <td className="rpt-td-lbl">품목 유형</td>
              <td className="rpt-td-val">{claim.product_type || '-'}</td>
              <td className="rpt-td-lbl">품목군</td>
              <td className="rpt-td-val">{claim.product_category || '-'}</td>
            </tr>
            <tr>
              <td className="rpt-td-lbl">LOT 번호</td>
              <td className="rpt-td-val" style={{ fontFamily: 'monospace' }}>{claim.lot_number || '-'}</td>
              <td className="rpt-td-lbl">출고 수량</td>
              <td className="rpt-td-val">{claim.quantity != null ? claim.quantity.toLocaleString() + ' EA' : '-'}</td>
            </tr>
            <tr>
              <td className="rpt-td-lbl">불량 수량</td>
              <td className="rpt-td-val">{claim.defect_quantity != null ? claim.defect_quantity.toLocaleString() + ' EA' : '-'}</td>
              <td className="rpt-td-lbl">불량률</td>
              <td className="rpt-td-val" style={{ fontWeight: 700, color: parseFloat(defRate) > 5 ? '#dc2626' : '#059669' }}>{defRate}</td>
            </tr>
            <tr>
              <td className="rpt-td-lbl">영업 부서</td>
              <td className="rpt-td-val">{claim.sales_rep_dept || '-'}</td>
              <td className="rpt-td-lbl">영업담당자</td>
              <td className="rpt-td-val">{claim.sales_rep_name || '-'}</td>
            </tr>
            <tr>
              <td className="rpt-td-lbl" style={{ verticalAlign: 'top' }}>불량 내용</td>
              <td className="rpt-td-val" colSpan={3} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {claim.defect_description || '-'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 2. 처리 경과 */}
        <div className="rpt-section">2. 처리 경과</div>
        <table className="rpt-tbl">
          <thead>
            <tr>
              {['단계', '처리일', '부서', '담당자', '처리 내용'].map(h => (
                <th key={h} className="rpt-th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((entry, i) => {
              const sc = STAGE_COLORS[entry.stage_name] || { bg: '#f1f5f9', text: '#374151' };
              const parsed = parseDesc(entry.description);
              let descText = parsed.text;
              if (parsed.type === 'cause')  descText = `[원인] ${parsed.cause}\n[상세] ${parsed.detail}`;
              if (parsed.type === 'action') descText = `[조치] ${parsed.action}\n[재발방지] ${parsed.prevent}`;
              return (
                <tr key={entry.id || i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td className="rpt-td-val" style={{ whiteSpace: 'nowrap' }}>
                    <span style={{ background: sc.bg, color: sc.text, padding: '2px 6px', borderRadius: 8, fontSize: 10, fontWeight: 700 }}>
                      {entry.stage_name}
                    </span>
                  </td>
                  <td className="rpt-td-val" style={{ whiteSpace: 'nowrap' }}>{entry.stage_date || '-'}</td>
                  <td className="rpt-td-val" style={{ whiteSpace: 'nowrap' }}>{entry.handler_dept || '-'}</td>
                  <td className="rpt-td-val" style={{ whiteSpace: 'nowrap' }}>{entry.handler || entry.user_name || entry.user_email || '-'}</td>
                  <td className="rpt-td-val" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{descText || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 3. 분석 결과 요약 */}
        <div className="rpt-section">3. 분석 결과 요약</div>
        <table className="rpt-tbl">
          <tbody>
            <tr>
              <td className="rpt-td-lbl" style={{ width: '15%', verticalAlign: 'top' }}>원인 분류</td>
              <td className="rpt-td-val" style={{ whiteSpace: 'pre-wrap' }}>{causeParsed?.cause || '-'}</td>
            </tr>
            <tr>
              <td className="rpt-td-lbl" style={{ verticalAlign: 'top' }}>원인 상세</td>
              <td className="rpt-td-val" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{causeParsed?.detail || '-'}</td>
            </tr>
            <tr>
              <td className="rpt-td-lbl" style={{ verticalAlign: 'top' }}>조치 내용</td>
              <td className="rpt-td-val" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{actionParsed?.action || '-'}</td>
            </tr>
            <tr>
              <td className="rpt-td-lbl" style={{ verticalAlign: 'top' }}>재발방지대책</td>
              <td className="rpt-td-val" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{actionParsed?.prevent || '-'}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: 20, fontSize: 9, color: '#94a3b8', textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
          본 문서는 (주)에이제이월드 클레임 관리 시스템에서 자동 생성되었습니다.
        </div>
      </div>

      <style>{`
        .rpt-section {
          font-size: 12px; font-weight: 700; color: #1e40af;
          border-left: 3px solid #3b82f6; padding-left: 9px;
          margin-top: 16px; margin-bottom: 7px;
        }
        .rpt-tbl { width: 100%; border-collapse: collapse; font-size: 12px; }
        .rpt-th {
          border: 1px solid #cbd5e1; padding: 5px 9px;
          font-size: 11px; font-weight: 700; text-align: left;
          color: #374151; background: #f1f5f9;
        }
        .rpt-td-lbl {
          border: 1px solid #cbd5e1; padding: 6px 9px;
          background: #f8fafc; font-weight: 600; color: #374151;
          font-size: 11px; white-space: nowrap;
        }
        .rpt-td-val {
          border: 1px solid #cbd5e1; padding: 6px 10px;
          color: #1e293b; font-size: 11px;
        }

        @media print {
          .report-screen-bar { display: none !important; }
          .sidebar { display: none !important; }
          .print-header { display: none !important; }
          .mobile-topbar { display: none !important; }
          .app-layout { display: block !important; }
          .main-content { padding: 0 !important; margin: 0 !important; }
          @page { size: A4 portrait; margin: 8mm 10mm; }
          body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .rpt-body { padding: 0 2px !important; }
          .rpt-section { margin-top: 10px !important; margin-bottom: 5px !important; font-size: 11px !important; }
          .rpt-tbl { font-size: 9.5px !important; }
          .rpt-th { padding: 3px 6px !important; font-size: 9.5px !important; }
          .rpt-td-lbl { padding: 3px 6px !important; font-size: 9.5px !important; }
          .rpt-td-val { padding: 3px 7px !important; font-size: 9.5px !important; }
        }
      `}</style>
    </div>
  );
}
