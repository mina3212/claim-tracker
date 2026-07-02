import { useState, useMemo } from 'react';
import { useClaims } from '../context/ClaimsContext';
import { useSupplierClaims } from '../context/SupplierClaimsContext';
import { usePrintTitle } from '../context/PrintContext';
import { DISPOSITION_COLORS } from '../lib/supabase';

function cnt(arr, key) {
  const m = {};
  arr.forEach(c => { const k = c[key] || '미분류'; m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).sort(([,a],[,b]) => b-a);
}

function generateLocalReport(filteredC, filteredS, start, end, stages) {
  const lines = [];
  const now = new Date().toLocaleDateString('ko-KR');

  /* ── 고객사 클레임 통계 ── */
  const cTotal   = filteredC.length;
  const cClosed  = filteredC.filter(c => c.current_stage === '종결').length;
  const cPending = cTotal - cClosed;
  const closeRate = cTotal > 0 ? ((cClosed / cTotal) * 100).toFixed(1) : '0';

  const cByStage   = cnt(filteredC, 'current_stage');
  const cByGroup   = cnt(filteredC, 'customer_group');
  const cByCustomer = cnt(filteredC, 'customer_name');
  const cByDefect  = cnt(filteredC, 'defect_type');
  const cByProduct = cnt(filteredC, 'product_category');

  // 원인 분석 (stages에서 파싱)
  const causeCount = {};
  const claimIdSet = new Set(filteredC.map(c => c.id));
  (stages || []).forEach(s => {
    if (s.stage_name !== '회수품 원인분석' || !claimIdSet.has(s.claim_id)) return;
    const m = (s.description || '').match(/\[원인\]\s*(.+)/);
    if (!m) return;
    m[1].split(',').map(x => x.trim()).forEach(cause => {
      causeCount[cause] = (causeCount[cause] || 0) + 1;
    });
  });
  const cByCause = Object.entries(causeCount).sort(([,a],[,b]) => b-a);

  /* ── 공급사 불량 통계 ── */
  const sTotal   = filteredS.length;
  const totalIn  = filteredS.reduce((s, c) => s + (c.quantity || 0), 0);
  const totalDef = filteredS.reduce((s, c) => s + (c.defect_quantity || 0), 0);
  const defRate  = totalIn > 0 ? ((totalDef / totalIn) * 100).toFixed(2) : '0';

  const sBySupplier = cnt(filteredS, 'supplier_name');
  const sByDefect   = cnt(filteredS, 'defect_type');
  const sByDisp     = cnt(filteredS, 'disposition');
  const sByStage    = cnt(filteredS, 'inspection_stage');

  const sNoAction = filteredS.filter(c => !c.improvement_status || c.improvement_status === '미조치').length;
  const sInProgress = filteredS.filter(c => c.improvement_status === '진행중').length;
  const sDone = filteredS.filter(c => c.improvement_status === '완료').length;

  /* ── 보고서 작성 ── */
  lines.push(`# AJW 클레임 종합 분석 보고서`);
  lines.push(`## 분석 기간: ${start} ~ ${end}  ·  작성일: ${now}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  /* 핵심 요약 */
  lines.push('## 📌 핵심 요약');
  lines.push('');
  if (cTotal > 0) {
    lines.push(`- 분석 기간 고객사 클레임 **${cTotal}건** 접수 · 종결 **${cClosed}건** (종결률 **${closeRate}%**) · 미결 **${cPending}건**`);
    if (parseFloat(closeRate) < 50 && cTotal >= 3)
      lines.push(`  - ⚠️ 종결률이 50% 미만입니다. 미결 클레임 ${cPending}건에 대한 신속한 처리가 필요합니다.`);
  } else {
    lines.push('- 해당 기간 고객사 클레임 데이터 없음');
  }
  if (sTotal > 0) {
    lines.push(`- 공급사 불량 **${sTotal}건** · 총 입고 **${totalIn.toLocaleString()}EA** 중 불량 **${totalDef.toLocaleString()}EA** (전체 불량률 **${defRate}%**)`);
    if (parseFloat(defRate) > 5)
      lines.push(`  - ⚠️ 전체 불량률이 5%를 초과했습니다. 즉각적인 원인 분석과 공급사 대응이 필요합니다.`);
    if (sNoAction > 0)
      lines.push(`  - ⚠️ 시정조치 미완료 **${sNoAction + sInProgress}건** (미조치 ${sNoAction}건 · 진행중 ${sInProgress}건)`);
  } else {
    lines.push('- 해당 기간 공급사 불량 데이터 없음');
  }
  if (cTotal === 0 && sTotal === 0) {
    lines.push('');
    lines.push('> 선택한 기간에 분석할 데이터가 없습니다.');
    return lines.join('\n');
  }
  lines.push('');

  /* ── 고객사 클레임 현황 ── */
  if (cTotal > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## 🏢 고객사 클레임 현황');
    lines.push('');

    lines.push('### 단계별 현황');
    cByStage.forEach(([stage, n]) => {
      const bar = '█'.repeat(Math.round(n / cTotal * 20));
      lines.push(`- **${stage}**: ${n}건 (${(n/cTotal*100).toFixed(0)}%) ${bar}`);
    });
    lines.push('');

    if (cByGroup.length > 0) {
      lines.push('### 고객사 그룹별');
      cByGroup.slice(0, 5).forEach(([g, n]) => lines.push(`- ${g}: ${n}건`));
      lines.push('');
    }

    if (cByCustomer.length > 0) {
      lines.push('### 주요 고객사 TOP 5');
      cByCustomer.slice(0, 5).forEach(([name, n], i) =>
        lines.push(`${i + 1}. **${name}**: ${n}건 (${(n/cTotal*100).toFixed(0)}%)`));
      lines.push('');
    }

    if (cByDefect.length > 0) {
      lines.push('### 불량 유형');
      cByDefect.slice(0, 6).forEach(([t, n]) => lines.push(`- ${t}: ${n}건`));
      lines.push('');
    }

    if (cByProduct.length > 0) {
      lines.push('### 품목군별');
      cByProduct.slice(0, 5).forEach(([p, n]) => lines.push(`- ${p}: ${n}건`));
      lines.push('');
    }

    if (cByCause.length > 0) {
      lines.push('### 원인 분석 결과');
      cByCause.forEach(([cause, n]) => lines.push(`- ${cause}: ${n}건`));
      lines.push('');
    }
  }

  /* ── 공급사 불량 현황 ── */
  if (sTotal > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## 🏭 공급사 불량 현황');
    lines.push('');
    lines.push(`- 총 발생: **${sTotal}건**  ·  입고 **${totalIn.toLocaleString()}EA**  ·  불량 **${totalDef.toLocaleString()}EA**  ·  불량률 **${defRate}%**`);
    lines.push('');

    lines.push('### 처리결과 현황');
    const dispWithDefault = sByDisp.length > 0 ? sByDisp : [['미결', sTotal]];
    dispWithDefault.forEach(([d, n]) => lines.push(`- **${d || '미결'}**: ${n}건`));
    lines.push('');

    lines.push('### 시정조치 현황');
    lines.push(`- 미조치: **${sNoAction}건**`);
    lines.push(`- 진행중: **${sInProgress}건**`);
    lines.push(`- 완료:   **${sDone}건**`);
    lines.push('');

    if (sBySupplier.length > 0) {
      lines.push('### 불량 공급사 TOP 5');
      sBySupplier.slice(0, 5).forEach(([name, n], i) =>
        lines.push(`${i + 1}. **${name}**: ${n}건 (${(n/sTotal*100).toFixed(0)}%)`));
      lines.push('');
    }

    if (sByDefect.length > 0) {
      lines.push('### 불량 유형별');
      sByDefect.slice(0, 6).forEach(([t, n]) => lines.push(`- ${t}: ${n}건`));
      lines.push('');
    }

    if (sByStage.length > 0) {
      lines.push('### 검사 단계별');
      sByStage.forEach(([s, n]) => lines.push(`- ${s}: ${n}건`));
      lines.push('');
    }
  }

  /* ── 주요 이슈 ── */
  lines.push('---');
  lines.push('');
  lines.push('## ⚠️ 주요 이슈 및 패턴');
  lines.push('');

  const issues = [];
  if (cTotal > 0 && parseFloat(closeRate) < 60 && cPending >= 2)
    issues.push(`고객사 클레임 종결률 **${closeRate}%** — 미결 **${cPending}건**이 장기 체류 중입니다. 단계별 병목 원인을 점검하세요.`);
  if (cByCustomer.length > 0 && cByCustomer[0][1] / cTotal >= 0.3)
    issues.push(`**${cByCustomer[0][0]}** 단일 고객사 집중: 전체의 ${(cByCustomer[0][1]/cTotal*100).toFixed(0)}% (${cByCustomer[0][1]}건). 해당 고객사와의 품질 협의 필요.`);
  if (cByCause.length > 0 && cByCause[0][1] >= 2)
    issues.push(`반복 발생 원인 **${cByCause[0][0]}** (${cByCause[0][1]}건) — 재발방지 대책의 실효성 점검 필요.`);
  if (sTotal > 0 && parseFloat(defRate) > 3)
    issues.push(`공급사 전체 불량률 **${defRate}%** — 허용 기준(3%) 초과. 수입검사 강화 또는 공급사 평가 재검토가 필요합니다.`);
  if (sBySupplier.length > 0 && sBySupplier[0][1] / sTotal >= 0.4)
    issues.push(`**${sBySupplier[0][0]}** 단일 공급사 집중: 전체의 ${(sBySupplier[0][1]/sTotal*100).toFixed(0)}% (${sBySupplier[0][1]}건). 해당 공급사에 대한 집중 관리 필요.`);
  if (sNoAction >= 3)
    issues.push(`시정조치 미등록 **${sNoAction}건** — 불량 발생 후 조치가 취해지지 않은 건이 다수입니다. 즉시 담당자를 지정해 조치 계획을 수립하세요.`);

  if (issues.length === 0) {
    lines.push('- 분석 기간 내 특별한 집중 이슈가 발견되지 않았습니다.');
  } else {
    issues.forEach(iss => lines.push(`- ${iss}`));
  }
  lines.push('');

  /* ── 개선 권고사항 ── */
  lines.push('---');
  lines.push('');
  lines.push('## 💡 개선 권고사항');
  lines.push('');

  const recs = [];
  if (cPending > 0)
    recs.push(`**[품질기술팀·영업팀]** 미결 클레임 ${cPending}건 진행 현황을 일괄 점검하고, 30일 이상 지연된 건은 조기 종결 조치를 취하세요.`);
  if (cByCause.length > 0)
    recs.push(`**[품질기술팀]** 주요 원인 "${cByCause[0][0]}" 재발방지 대책의 현장 적용 여부를 확인하고, 개선 효과를 수치로 측정할 기준을 마련하세요.`);
  if (sBySupplier.length > 0)
    recs.push(`**[구매/SCM팀]** 불량 상위 공급사(${sBySupplier.slice(0, 2).map(([n]) => n).join(', ')})에 대해 공식 클레임 통보 및 시정조치 요구서를 발행하고 다음 입고 시 전수검사를 실시하세요.`);
  if (sNoAction >= 2)
    recs.push(`**[품질기술팀]** 시정조치 미등록 ${sNoAction}건에 대해 조치 유형(공급사 클레임·작업자 교육·공정 변경 등)을 등록하고 완료 일정을 수립하세요.`);
  if (parseFloat(defRate) > 3)
    recs.push(`**[구매/SCM팀·품질기술팀]** 공급사 정기 품질 평가 주기를 단축하고, 불량률 기준(예: 3% 초과 시 경고, 5% 초과 시 거래 재검토) 관리 기준을 내규화하세요.`);

  if (recs.length === 0)
    recs.push('데이터가 충분하지 않아 구체적 권고사항을 도출하기 어렵습니다. 더 많은 데이터가 누적된 후 재분석을 권장합니다.');

  recs.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`> *본 보고서는 ${start} ~ ${end} 기간의 데이터를 기반으로 자동 생성되었습니다. 고객사 클레임 ${cTotal}건 + 공급사 불량 ${sTotal}건 분석.*`);

  return lines.join('\n');
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

function topEntries(items, key, n = 5) {
  const cnt = {};
  items.forEach(c => { const k = c[key] || '(미분류)'; cnt[k] = (cnt[k] || 0) + 1; });
  return Object.entries(cnt).sort(([,a],[,b]) => b-a).slice(0, n);
}

export default function AnalysisReport({ embedded = false }) {
  const { claims, stages }   = useClaims();
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

  /* ── 요약 통계 (AI 없이도 항상 표시) ── */
  const stats = useMemo(() => {
    const cClosed   = filteredC.filter(c => c.current_stage === '종결').length;
    const cPending  = filteredC.length - cClosed;
    const sPending  = filteredS.filter(c => !c.disposition).length;
    const sDone     = filteredS.filter(c =>  c.disposition).length;

    const totalIn  = filteredS.reduce((s, c) => s + (c.quantity || 0), 0);
    const totalDef = filteredS.reduce((s, c) => s + (c.defect_quantity || 0), 0);
    const defRate  = totalIn > 0 ? ((totalDef / totalIn) * 100).toFixed(2) : null;

    const topCustomers  = topEntries(filteredC, 'customer_name');
    const topCDefects   = topEntries(filteredC, 'defect_type');
    const topSuppliers  = topEntries(filteredS, 'supplier_name');
    const topSDefects   = topEntries(filteredS, 'defect_type');
    const dispositions  = topEntries(filteredS, 'disposition');

    return { cClosed, cPending, sPending, sDone, totalIn, totalDef, defRate, topCustomers, topCDefects, topSuppliers, topSDefects, dispositions };
  }, [filteredC, filteredS]);

  const generate = () => {
    if (total === 0) { setError('선택한 기간에 데이터가 없습니다.'); return; }
    setGenerating(true);
    setError('');
    setReport('');
    setPrintTitle(`AJW 클레임 종합 분석 보고서 (${start} ~ ${end})`);
    setTimeout(() => {
      try {
        const text = generateLocalReport(filteredC, filteredS, start, end, stages);
        setReport(text);
      } catch (err) {
        setError(`생성 실패: ${err.message}`);
      } finally {
        setGenerating(false);
      }
    }, 200);
  };

  return (
    <div>
      {!embedded && (
        <div className="page-header">
          <div>
            <div className="page-title">📊 클레임 종합 분석 보고서</div>
            <div className="page-sub">기간을 선택하면 고객사 클레임 + 공급사 불량을 종합 분석합니다</div>
          </div>
          {report && (
            <button className="btn btn-ghost btn-sm no-print" onClick={() => window.print()}>🖨️ 인쇄/PDF</button>
          )}
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
            disabled={generating}
            style={{ marginLeft: 'auto', minWidth: 140 }}
          >
            {generating ? '⏳ 생성 중...' : '📊 보고서 생성'}
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

      {/* ── 데이터 요약 (항상 표시) ── */}
      {total > 0 && (
        <div style={{ marginBottom: 16 }}>
          {/* KPI 행 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 12 }}>
            {[
              { label: '고객사 클레임', value: filteredC.length + '건', sub: `미결 ${stats.cPending}건`, color: '#3b82f6' },
              { label: '클레임 종결률', value: filteredC.length > 0 ? ((stats.cClosed / filteredC.length) * 100).toFixed(0) + '%' : '-', sub: `종결 ${stats.cClosed}건`, color: '#10b981' },
              { label: '공급사 불량',  value: filteredS.length + '건', sub: `미결 ${stats.sPending}건`, color: '#f59e0b' },
              { label: '전체 불량률',  value: stats.defRate != null ? stats.defRate + '%' : '-', sub: `${stats.totalDef.toLocaleString()} / ${stats.totalIn.toLocaleString()} EA`, color: stats.defRate > 5 ? '#dc2626' : '#059669' },
            ].map(item => (
              <div key={item.label} className="card" style={{ textAlign: 'center', padding: '14px 12px' }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{item.sub}</div>
              </div>
            ))}
          </div>

          {/* 상세 분석 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {/* 고객사 클레임 TOP */}
            <div className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', marginBottom: 10 }}>📋 주요 고객사 (클레임 건수)</div>
              {stats.topCustomers.length === 0
                ? <div style={{ fontSize: 12, color: '#94a3b8' }}>데이터 없음</div>
                : stats.topCustomers.map(([name, cnt], i) => {
                    const pct = filteredC.length > 0 ? Math.round(cnt / filteredC.length * 100) : 0;
                    return (
                      <div key={name} style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                          <span style={{ fontWeight: i === 0 ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>{name}</span>
                          <span style={{ color: '#64748b', flexShrink: 0 }}>{cnt}건 ({pct}%)</span>
                        </div>
                        <div style={{ background: '#f1f5f9', borderRadius: 3, height: 5 }}>
                          <div style={{ background: '#3b82f6', width: `${pct}%`, height: '100%', borderRadius: 3 }} />
                        </div>
                      </div>
                    );
                  })}
            </div>

            {/* 공급사 불량 TOP */}
            <div className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 10 }}>🏭 주요 공급사 (불량 건수)</div>
              {stats.topSuppliers.length === 0
                ? <div style={{ fontSize: 12, color: '#94a3b8' }}>데이터 없음</div>
                : stats.topSuppliers.map(([name, cnt], i) => {
                    const pct = filteredS.length > 0 ? Math.round(cnt / filteredS.length * 100) : 0;
                    return (
                      <div key={name} style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                          <span style={{ fontWeight: i === 0 ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>{name}</span>
                          <span style={{ color: '#64748b', flexShrink: 0 }}>{cnt}건 ({pct}%)</span>
                        </div>
                        <div style={{ background: '#f1f5f9', borderRadius: 3, height: 5 }}>
                          <div style={{ background: '#f59e0b', width: `${pct}%`, height: '100%', borderRadius: 3 }} />
                        </div>
                      </div>
                    );
                  })}
            </div>

            {/* 클레임 불량유형 TOP */}
            <div className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#5b21b6', marginBottom: 10 }}>⚠️ 고객사 클레임 불량유형</div>
              {stats.topCDefects.length === 0
                ? <div style={{ fontSize: 12, color: '#94a3b8' }}>데이터 없음</div>
                : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {stats.topCDefects.map(([name, cnt]) => (
                      <span key={name} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: '#f3e8ff', color: '#6b21a8', fontWeight: 600 }}>
                        {name} {cnt}건
                      </span>
                    ))}
                  </div>}
            </div>

            {/* 공급사 처리결과 */}
            <div className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 10 }}>✅ 공급사 불량 처리결과</div>
              {stats.dispositions.length === 0
                ? <div style={{ fontSize: 12, color: '#94a3b8' }}>데이터 없음</div>
                : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {stats.dispositions.map(([name, cnt]) => {
                      const dc = DISPOSITION_COLORS[name] || DISPOSITION_COLORS['미결'];
                      return (
                        <span key={name} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: dc.bg, color: dc.text, fontWeight: 600 }}>
                          {name} {cnt}건
                        </span>
                      );
                    })}
                  </div>}
            </div>
          </div>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>
      )}

      {/* 생성 중 */}
      {generating && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', marginBottom: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>데이터를 분석하고 있습니다</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>고객사 클레임 {filteredC.length}건 + 공급사 불량 {filteredS.length}건 종합 분석 중...</div>
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
            <span>자동 생성 보고서 · AJW 클레임 트래커</span>
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
