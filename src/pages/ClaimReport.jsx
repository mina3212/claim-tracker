import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useClaims } from '../context/ClaimsContext';
import { STAGES, STAGE_COLORS } from '../lib/supabase';

/* stage description 파싱 — ClaimDetail과 동일 로직 */
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

  /* 원인분석 / 조치 / 재발방지 추출 */
  const causeEntry  = history.find(h => h.stage_name === '회수품 원인분석');
  const actionEntry = history.find(h => h.stage_name === '조치');
  const causeParsed  = causeEntry  ? parseDesc(causeEntry.description)  : null;
  const actionParsed = actionEntry ? parseDesc(actionEntry.description) : null;

  const ROW = ({ label, value, wide }) => (
    <tr>
      <td style={{ ...tdLabel, width: wide ? '12%' : '13%' }}>{label}</td>
      <td style={{ ...tdValue, width: wide ? '88%' : '37%' }} colSpan={wide ? 3 : 1}>{value || '-'}</td>
    </tr>
  );

  return (
    <div style={{ fontFamily: "'Nanum Gothic','Malgun Gothic',sans-serif", background: '#fff', minHeight: '100vh', padding: '0 0 40px' }}>

      {/* ── 화면 전용 버튼 ── */}
      <div className="report-screen-bar" style={{
        background: '#1e293b', padding: '10px 24px', display: 'flex', gap: 10, alignItems: 'center',
      }}>
        <button
          onClick={() => window.print()}
          style={{
            background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6,
            padding: '7px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          🖨️ 인쇄 / PDF 저장
        </button>
        <button
          onClick={() => window.close()}
          style={{
            background: 'transparent', color: '#94a3b8', border: '1px solid #475569',
            borderRadius: 6, padding: '7px 14px', fontSize: 13, cursor: 'pointer',
          }}
        >
          닫기
        </button>
        <span style={{ color: '#64748b', fontSize: 12, marginLeft: 8 }}>
          인쇄 시 A4 세로 권장 · 여백: 보통
        </span>
      </div>

      {/* ── 보고서 본문 ── */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 32px 0' }}>

        {/* 헤더 */}
        <div style={{ borderBottom: '3px solid #1d4ed8', paddingBottom: 12, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1d4ed8', letterSpacing: '-0.5px' }}>클레임 처리결과보고서</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>CLAIM PROCESSING RESULT REPORT</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>(주)에이제이월드</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>발행일: {today}</div>
          </div>
        </div>

        {/* 기본정보 테이블 */}
        <SectionTitle>1. 기본 정보</SectionTitle>
        <table style={tblStyle}>
          <tbody>
            <tr>
              <td style={tdLabel}>고객사 그룹</td>
              <td style={tdValue}>{claim.customer_group || '-'}</td>
              <td style={tdLabel}>고객사명</td>
              <td style={{ ...tdValue, fontWeight: 700 }}>{claim.customer_name}</td>
            </tr>
            <tr>
              <td style={tdLabel}>발생일</td>
              <td style={tdValue}>{claim.occurrence_date || '-'}</td>
              <td style={tdLabel}>접수일</td>
              <td style={tdValue}>{claim.receipt_date || '-'}</td>
            </tr>
            <tr>
              <td style={tdLabel}>품번</td>
              <td style={{ ...tdValue, fontFamily: 'monospace' }}>{claim.part_number || '-'}</td>
              <td style={tdLabel}>품명</td>
              <td style={tdValue}>{claim.part_name || '-'}</td>
            </tr>
            <tr>
              <td style={tdLabel}>품목 유형</td>
              <td style={tdValue}>{claim.product_type || '-'}</td>
              <td style={tdLabel}>품목군</td>
              <td style={tdValue}>{claim.product_category || '-'}</td>
            </tr>
            <tr>
              <td style={tdLabel}>LOT 번호</td>
              <td style={{ ...tdValue, fontFamily: 'monospace' }}>{claim.lot_number || '-'}</td>
              <td style={tdLabel}>출고 수량</td>
              <td style={tdValue}>{claim.quantity != null ? claim.quantity.toLocaleString() + ' EA' : '-'}</td>
            </tr>
            <tr>
              <td style={tdLabel}>불량 수량</td>
              <td style={tdValue}>{claim.defect_quantity != null ? claim.defect_quantity.toLocaleString() + ' EA' : '-'}</td>
              <td style={tdLabel}>불량률</td>
              <td style={{ ...tdValue, fontWeight: 700, color: parseFloat(defRate) > 5 ? '#dc2626' : '#059669' }}>
                {defRate}
              </td>
            </tr>
            <tr>
              <td style={tdLabel}>영업 부서</td>
              <td style={tdValue}>{claim.sales_rep_dept || '-'}</td>
              <td style={tdLabel}>영업담당자</td>
              <td style={tdValue}>{claim.sales_rep_name || '-'} {claim.sales_rep_contact ? `(${claim.sales_rep_contact})` : ''}</td>
            </tr>
            <tr>
              <td style={tdLabel}>불량 내용</td>
              <td style={{ ...tdValue, whiteSpace: 'pre-wrap', lineHeight: 1.6 }} colSpan={3}>
                {claim.defect_description || '-'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 처리 경과 */}
        <SectionTitle>2. 처리 경과</SectionTitle>
        <table style={{ ...tblStyle, width: '100%' }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              {['단계', '처리일', '부서', '담당자', '처리 내용'].map(h => (
                <th key={h} style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 11, fontWeight: 700, textAlign: 'left', color: '#374151' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((entry, i) => {
              const sc = STAGE_COLORS[entry.stage_name] || { bg: '#f1f5f9', text: '#374151' };
              const parsed = parseDesc(entry.description);
              let descText = parsed.text;
              if (parsed.type === 'cause')   descText = `[원인] ${parsed.cause}\n[상세] ${parsed.detail}`;
              if (parsed.type === 'action')  descText = `[조치] ${parsed.action}\n[재발방지] ${parsed.prevent}`;
              return (
                <tr key={entry.id || i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', whiteSpace: 'nowrap' }}>
                    <span style={{ background: sc.bg, color: sc.text, padding: '2px 7px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                      {entry.stage_name}
                    </span>
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 12, whiteSpace: 'nowrap' }}>{entry.stage_date || '-'}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 12, whiteSpace: 'nowrap' }}>{entry.handler_dept || '-'}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {entry.handler || entry.user_name || entry.user_email || '-'}
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {descText || '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 분석 결과 요약 */}
        <SectionTitle>3. 분석 결과 요약</SectionTitle>
        <table style={tblStyle}>
          <tbody>
            <tr>
              <td style={{ ...tdLabel, width: '18%', verticalAlign: 'top' }}>원인 분류</td>
              <td style={{ ...tdValue, whiteSpace: 'pre-wrap' }}>
                {causeParsed?.cause || '-'}
              </td>
            </tr>
            <tr>
              <td style={{ ...tdLabel, verticalAlign: 'top' }}>원인 상세</td>
              <td style={{ ...tdValue, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {causeParsed?.detail || '-'}
              </td>
            </tr>
            <tr>
              <td style={{ ...tdLabel, verticalAlign: 'top' }}>조치 내용</td>
              <td style={{ ...tdValue, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {actionParsed?.action || '-'}
              </td>
            </tr>
            <tr>
              <td style={{ ...tdLabel, verticalAlign: 'top' }}>재발방지대책</td>
              <td style={{ ...tdValue, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {actionParsed?.prevent || '-'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 서명란 */}
        <SectionTitle>4. 확인</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 8 }}>
          {['작성자', '검토자', '승인자'].map(role => (
            <div key={role} style={{
              border: '1px solid #cbd5e1', borderRadius: 6, padding: '12px 16px',
              minHeight: 80, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{role}</div>
              <div style={{ fontSize: 10, color: '#cbd5e1', textAlign: 'right', marginTop: 24 }}>서명</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32, fontSize: 10, color: '#94a3b8', textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
          본 문서는 (주)에이제이월드 클레임 관리 시스템에서 자동 생성되었습니다.
        </div>
      </div>

      <style>{`
        @media print {
          .report-screen-bar { display: none !important; }
          @page { size: A4 portrait; margin: 15mm 12mm; }
          body { background: #fff !important; }
        }
      `}</style>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 13, fontWeight: 700, color: '#1e40af',
      borderLeft: '3px solid #3b82f6', paddingLeft: 10,
      marginTop: 24, marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

const tblStyle = {
  width: '100%', borderCollapse: 'collapse', fontSize: 12,
};
const tdLabel = {
  border: '1px solid #cbd5e1', padding: '7px 10px',
  background: '#f8fafc', fontWeight: 600, color: '#374151',
  fontSize: 11, whiteSpace: 'nowrap',
};
const tdValue = {
  border: '1px solid #cbd5e1', padding: '7px 12px',
  color: '#1e293b', fontSize: 12,
};
