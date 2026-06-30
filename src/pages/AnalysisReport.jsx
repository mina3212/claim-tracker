import { useState, useMemo } from 'react';
import { useClaims } from '../context/ClaimsContext';
import { useSupplierClaims } from '../context/SupplierClaimsContext';
import { usePrintTitle } from '../context/PrintContext';

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;

function sortedEntries(obj) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]);
}

function buildData(customerClaims, supplierClaims) {
  /* ── 고객사 클레임 ── */
  const cByStage = {}, cByGroup = {}, cByDefect = {}, cByProduct = {};
  let cClosed = 0;
  customerClaims.forEach(c => {
    cByStage[c.current_stage || '미분류'] = (cByStage[c.current_stage || '미분류'] || 0) + 1;
    cByGroup[c.customer_group || '미분류'] = (cByGroup[c.customer_group || '미분류'] || 0) + 1;
    cByDefect[c.defect_type || '미분류'] = (cByDefect[c.defect_type || '미분류'] || 0) + 1;
    cByProduct[c.product_category || '미분류'] = (cByProduct[c.product_category || '미분류'] || 0) + 1;
    if (c.current_stage === '종결') cClosed++;
  });

  /* ── 공급사 불량 ── */
  const sByDisp = {}, sBySupplier = {}, sByDefect = {}, sByInspection = {};
  let totalIn = 0, totalDef = 0;
  supplierClaims.forEach(c => {
    const disp = c.disposition || '미결';
    sByDisp[disp] = (sByDisp[disp] || 0) + 1;
    sBySupplier[c.supplier_name] = (sBySupplier[c.supplier_name] || 0) + (c.defect_quantity || 0);
    sByDefect[c.defect_type || '미분류'] = (sByDefect[c.defect_type || '미분류'] || 0) + 1;
    sByInspection[c.inspection_stage || '미분류'] = (sByInspection[c.inspection_stage || '미분류'] || 0) + 1;
    totalIn  += (c.quantity         || 0);
    totalDef += (c.defect_quantity   || 0);
  });

  return {
    고객사클레임: {
      총건수: customerClaims.length,
      종결건수: cClosed,
      미결건수: customerClaims.length - cClosed,
      종결률: customerClaims.length > 0 ? ((cClosed / customerClaims.length) * 100).toFixed(1) + '%' : '0%',
      단계별현황: Object.fromEntries(sortedEntries(cByStage)),
      고객사그룹별: Object.fromEntries(sortedEntries(cByGroup).slice(0, 5)),
      불량유형별: Object.fromEntries(sortedEntries(cByDefect).slice(0, 5)),
      품목군별: Object.fromEntries(sortedEntries(cByProduct).slice(0, 5)),
    },
    공급사불량: {
      총건수: supplierClaims.length,
      총입고수량: totalIn,
      총불량수량: totalDef,
      전체불량률: totalIn > 0 ? ((totalDef / totalIn) * 100).toFixed(2) + '%' : '0%',
      처리결과별: Object.fromEntries(sortedEntries(sByDisp)),
      공급사별불량수량: Object.fromEntries(sortedEntries(sBySupplier).slice(0, 5)),
      불량유형별: Object.fromEntries(sortedEntries(sByDefect).slice(0, 5)),
      검사단계별: Object.fromEntries(sortedEntries(sByInspection)),
    },
  };
}

function buildPrompt(data, start, end) {
  return `당신은 AJW(에이제이월드) 광통신 부품 회사의 품질 분석 전문가입니다.
AJW는 광커넥터, 광점퍼코드, 광분배함, 광접속함체 등 광통신 부품을 제조·유통합니다.

아래 ${start} ~ ${end} 기간의 데이터를 분석하여 클레임 종합 분석 보고서를 한국어로 작성하세요.

**데이터:**
${JSON.stringify(data, null, 2)}

**보고서 형식 (마크다운):**

# ${start} ~ ${end} 클레임 종합 분석 보고서

## 핵심 요약
핵심 수치 및 전체 현황을 3~4문장으로 요약. 가장 중요한 인사이트를 먼저 언급.

## 고객사 클레임 현황
건수, 종결률, 주요 고객사 그룹, 주요 불량 유형을 분석. 미결 클레임이 많으면 원인 추정.

## 공급사 불량 현황
건수, 전체 불량률, 문제 공급사 TOP3, 주요 불량 유형, 처리결과 분포 분석.

## 주요 문제점 및 패턴
데이터에서 발견되는 반복 패턴, 집중 영역, 심각도 높은 사항 지적. 수치 근거 포함.

## 개선 권고사항
구체적이고 실행 가능한 개선 방안 3~5가지. 각 항목에 담당 부서나 조치 방향 포함.

**작성 기준:**
- 데이터가 0건인 경우 "해당 기간 데이터 없음"으로 간략 처리
- 수치 기반 객관적 분석 위주, 추측 최소화
- 전문적이고 간결하게 (A4 2~3페이지 분량)`;
}

/* ── 마크다운 → HTML 변환 ── */
function mdToHtml(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const out = [];
  let inUl = false;

  const inline = (s) => s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#f1f5f9;padding:1px 5px;border-radius:3px;font-size:.9em">$1</code>');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isLi = /^[-*] /.test(line);
    if (!isLi && inUl) { out.push('</ul>'); inUl = false; }

    if (/^# /.test(line)) {
      out.push(`<h1 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 20px;padding-bottom:10px;border-bottom:3px solid #3b82f6">${inline(line.slice(2))}</h1>`);
    } else if (/^## /.test(line)) {
      out.push(`<h2 style="font-size:16px;font-weight:700;color:#1e293b;margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0">${inline(line.slice(3))}</h2>`);
    } else if (/^### /.test(line)) {
      out.push(`<h3 style="font-size:14px;font-weight:700;color:#334155;margin:18px 0 8px">${inline(line.slice(4))}</h3>`);
    } else if (isLi) {
      if (!inUl) { out.push('<ul style="margin:8px 0 12px;padding-left:22px">'); inUl = true; }
      out.push(`<li style="margin:5px 0;color:#374151;line-height:1.6">${inline(line.replace(/^[-*] /, ''))}</li>`);
    } else if (line.trim() === '') {
      out.push('<br/>');
    } else {
      out.push(`<p style="margin:6px 0;color:#374151;line-height:1.7">${inline(line)}</p>`);
    }
  }
  if (inUl) out.push('</ul>');
  return out.join('');
}

const defaultStart = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
};
const defaultEnd = () => new Date().toISOString().slice(0, 10);

export default function AnalysisReport({ embedded = false }) {
  const { claims }   = useClaims();
  const { claims: supplierClaims } = useSupplierClaims();
  const { setPrintTitle } = usePrintTitle();

  const [start,      setStart]      = useState(defaultStart);
  const [end,        setEnd]        = useState(defaultEnd);
  const [report,     setReport]     = useState('');
  const [generating, setGenerating] = useState(false);
  const [error,      setError]      = useState('');

  const filteredC = useMemo(() => claims.filter(c => {
    const d = c.receipt_date || c.created_at?.slice(0, 10) || '';
    return d >= start && d <= end;
  }), [claims, start, end]);

  const filteredS = useMemo(() => supplierClaims.filter(c => {
    const d = c.incoming_date || c.created_at?.slice(0, 10) || '';
    return d >= start && d <= end;
  }), [supplierClaims, start, end]);

  const total = filteredC.length + filteredS.length;

  const generate = async () => {
    if (!GEMINI_KEY) {
      setError('VITE_GEMINI_API_KEY 환경변수가 없습니다. 아래 안내를 확인하세요.');
      return;
    }
    if (total === 0) {
      setError('선택한 기간에 데이터가 없습니다.');
      return;
    }
    setGenerating(true);
    setError('');
    setReport('');
    setPrintTitle(`AJW 클레임 종합 분석 보고서 (${start} ~ ${end})`);
    try {
      const data   = buildData(filteredC, filteredS);
      const prompt = buildPrompt(data, start, end);
      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `HTTP ${res.status}`);
      }
      const json = await res.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) throw new Error('응답이 비어 있습니다.');
      setReport(text);
    } catch (err) {
      setError(`생성 실패: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const noKey = !GEMINI_KEY;

  return (
    <div>
      {!embedded && (
        <div className="page-header">
          <div>
            <div className="page-title">🤖 AI 클레임 분석 보고서</div>
            <div className="page-sub">기간을 선택하면 고객사 클레임 + 공급사 불량을 종합 분석합니다</div>
          </div>
          {report && (
            <button className="btn btn-ghost btn-sm no-print" onClick={() => window.print()}>🖨️ 인쇄/PDF</button>
          )}
        </div>
      )}

      {/* API 키 미설정 안내 */}
      {noKey && (
        <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#713f12', marginBottom: 8 }}>⚠️ Gemini API 키 설정 필요</div>
          <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.7 }}>
            1. <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', fontWeight: 600 }}>Google AI Studio</a>에서 무료 API 키 발급<br />
            2. 프로젝트 루트의 <code style={{ background: '#fef08a', padding: '1px 5px', borderRadius: 3 }}>.env</code> 파일에 추가:
            <div style={{ fontFamily: 'monospace', background: '#1e293b', color: '#7dd3fc', padding: '8px 12px', borderRadius: 6, marginTop: 6, fontSize: 12 }}>
              VITE_GEMINI_API_KEY=여기에_키_붙여넣기
            </div>
            3. 개발 서버 재시작 후 사용 가능 · Vercel 환경변수에도 동일하게 추가
          </div>
        </div>
      )}

      {/* 기간 선택 + 생성 버튼 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>시작일</div>
            <input type="date" value={start} onChange={e => setStart(e.target.value)}
              style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }} />
          </div>
          <div style={{ fontSize: 18, color: '#cbd5e1', paddingBottom: 8 }}>—</div>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>종료일</div>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)}
              style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              ['이번 달', () => { const n=new Date(); setStart(n.toISOString().slice(0,8)+'01'); setEnd(n.toISOString().slice(0,10)); }],
              ['최근 3개월', () => { const n=new Date(); const s=new Date(n); s.setMonth(s.getMonth()-3); setStart(s.toISOString().slice(0,10)); setEnd(n.toISOString().slice(0,10)); }],
              ['올해', () => { const y=new Date().getFullYear(); setStart(`${y}-01-01`); setEnd(new Date().toISOString().slice(0,10)); }],
            ].map(([label, fn]) => (
              <button key={label} className="btn btn-ghost btn-sm" onClick={fn} style={{ fontSize: 12 }}>{label}</button>
            ))}
          </div>
          <button
            className="btn btn-primary"
            onClick={generate}
            disabled={generating || noKey}
            style={{ marginLeft: 'auto', background: generating ? '#93c5fd' : undefined, minWidth: 140 }}
          >
            {generating ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                분석 중...
              </span>
            ) : '🤖 보고서 생성'}
          </button>
        </div>

        {/* 데이터 미리보기 */}
        {(filteredC.length > 0 || filteredS.length > 0) && (
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <div style={{ padding: '6px 14px', background: '#eff6ff', borderRadius: 8, fontSize: 12, color: '#1d4ed8', fontWeight: 600 }}>
              고객사 클레임 {filteredC.length}건
            </div>
            <div style={{ padding: '6px 14px', background: '#f0fdf4', borderRadius: 8, fontSize: 12, color: '#065f46', fontWeight: 600 }}>
              공급사 불량 {filteredS.length}건
            </div>
          </div>
        )}
      </div>

      {/* 에러 */}
      {error && (
        <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>
      )}

      {/* 생성 중 */}
      {generating && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', marginBottom: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🤖</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>AI가 데이터를 분석하고 있습니다</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>고객사 클레임 {filteredC.length}건 + 공급사 불량 {filteredS.length}건 종합 분석 중...</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* 보고서 */}
      {report && !generating && (
        <div className="card" style={{ padding: '32px 36px' }}>
          <div
            dangerouslySetInnerHTML={{ __html: mdToHtml(report) }}
            style={{ lineHeight: 1.7, fontFamily: "'Helvetica Neue',Arial,sans-serif" }}
          />
          <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
            <span>분석 기간: {start} ~ {end} · 고객사 {filteredC.length}건 + 공급사 {filteredS.length}건</span>
            <span>AI 생성 보고서 (Google Gemini) · 참고용으로만 활용하세요</span>
          </div>
        </div>
      )}

      {!report && !generating && !error && total === 0 && start && end && (
        <div className="empty">
          <div className="empty-icon">📊</div>
          선택한 기간({start} ~ {end})에 데이터가 없습니다
        </div>
      )}
    </div>
  );
}
