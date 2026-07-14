import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, CartesianGrid, Legend, LineChart, Line,
} from 'recharts';
import { useClaims } from '../context/ClaimsContext';
import { useSupplierClaims } from '../context/SupplierClaimsContext';
import { usePrintTitle } from '../context/PrintContext';
import { STAGES } from '../lib/supabase';

// ── 팔레트 ────────────────────────────────────────────────────
const BLUE   = '#3b82f6';
const AMBER  = '#f59e0b';
const GREEN  = '#10b981';
const RED    = '#ef4444';
const PURPLE = '#8b5cf6';

// ── Action Required 우선순위 설정 ─────────────────────────────
const PRIORITY_CONFIG = [
  { key: 'urgent',    icon: '🚨', label: '즉시 조치',    color: '#dc2626', bg: '#fee2e2', border: '#fecaca' },
  { key: 'process',   icon: '🔄', label: '프로세스 개선', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  { key: 'personnel', icon: '👥', label: '인력/교육',     color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  { key: 'supply',    icon: '🏭', label: '공급사 관리',   color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { key: 'monitor',   icon: '👁️', label: '모니터링',     color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
];

// ── 헬퍼 ──────────────────────────────────────────────────────
function topN(arr, key, n = 5) {
  const m = {};
  arr.forEach(c => { const k = c[key] || '(미분류)'; m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).sort(([, a], [, b]) => b - a).slice(0, n);
}

function statusColor(rate, lo = 1, hi = 3) {
  return parseFloat(rate) <= lo ? GREEN : parseFloat(rate) <= hi ? AMBER : RED;
}
function statusBg(rate, lo = 1, hi = 3) {
  return parseFloat(rate) <= lo ? '#f0fdf4' : parseFloat(rate) <= hi ? '#fffbeb' : '#fef2f2';
}
function statusBorder(rate, lo = 1, hi = 3) {
  return parseFloat(rate) <= lo ? '#bbf7d0' : parseFloat(rate) <= hi ? '#fde68a' : '#fecaca';
}

// ── 서브 컴포넌트 ─────────────────────────────────────────────
function SectionTitle({ icon, title, color = '#1e293b' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color }}>{title}</h2>
    </div>
  );
}

function KpiTile({ label, value, sub, color, bg, border }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function HBar({ name, count, total, color, rank }) {
  const pct = total > 0 ? Math.round(count / total * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {rank != null && (
            <span style={{ fontSize: 10, fontWeight: 700, color: rank === 1 ? AMBER : '#94a3b8', width: 14, textAlign: 'center' }}>{rank}</span>
          )}
          <span style={{ fontSize: 12, fontWeight: rank === 1 ? 700 : 400, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{name}</span>
        </div>
        <span style={{ fontSize: 11, color: '#64748b', flexShrink: 0, marginLeft: 8 }}>
          {count}건 <span style={{ color: '#cbd5e1' }}>({pct}%)</span>
        </span>
      </div>
      <div style={{ background: '#f1f5f9', borderRadius: 4, height: 7, overflow: 'hidden' }}>
        <div style={{ background: color, width: `${pct}%`, height: '100%', borderRadius: 4 }} />
      </div>
    </div>
  );
}

function IssueCard({ text }) {
  return (
    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '4px solid #ef4444', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
      <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>⚠️ {text}</span>
    </div>
  );
}

function RecCard({ idx, text }) {
  return (
    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderLeft: '4px solid #3b82f6', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', marginBottom: 3 }}>권고 {idx}</div>
      <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{text}</span>
    </div>
  );
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,.1)', fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: '#1e293b' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color || '#374151' }}>
          {p.name !== 'count' ? p.name + ': ' : ''}<strong>{p.value}건</strong>
        </div>
      ))}
    </div>
  );
}

function SubTitle({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 12 }}>{children}</div>;
}

// ── 기본 기간 ─────────────────────────────────────────────────
const defaultStart = () => {
  const d = new Date(); d.setMonth(d.getMonth() - 3);
  return d.toISOString().slice(0, 10);
};
const defaultEnd = () => new Date().toISOString().slice(0, 10);

// ── 메인 ──────────────────────────────────────────────────────
export default function AnalysisReport({ embedded = false }) {
  const { claims, stages }         = useClaims();
  const { claims: supplierClaims } = useSupplierClaims();
  const { setPrintTitle }          = usePrintTitle();

  const [mode,  setMode]  = useState('period'); // 'period' | 'year'
  const [start, setStart] = useState(defaultStart);
  const [end,   setEnd]   = useState(defaultEnd);
  const [shown, setShown] = useState(false);

  const filteredC = useMemo(() => claims.filter(c => {
    const d = c.receipt_date || c.created_at?.slice(0, 10) || '';
    return d >= start && d <= end;
  }), [claims, start, end]);

  const filteredS = useMemo(() => supplierClaims.filter(c => {
    const d = c.incoming_date || c.created_at?.slice(0, 10) || '';
    return d >= start && d <= end;
  }), [supplierClaims, start, end]);

  // ── 고객사 통계 ──────────────────────────────────────────────
  const C = useMemo(() => {
    const total   = filteredC.length;
    const closed  = filteredC.filter(c => c.current_stage === '종결').length;
    const pending = total - closed;
    const closeRate = total > 0 ? (closed / total * 100).toFixed(1) : '0';

    const byStage = STAGES
      .map(s => ({ name: s, count: filteredC.filter(c => c.current_stage === s).length }))
      .filter(d => d.count > 0);

    const causeMap = {};
    const idSet = new Set(filteredC.map(c => c.id));
    (stages || []).forEach(s => {
      if (s.stage_name !== '회수품 원인분석' || !idSet.has(s.claim_id)) return;
      const m = (s.description || '').match(/\[원인\]\s*(.+)/);
      if (!m) return;
      m[1].split(',').map(x => x.trim()).forEach(k => { causeMap[k] = (causeMap[k] || 0) + 1; });
    });
    const byCause = Object.entries(causeMap).sort(([, a], [, b]) => b - a);

    const monthlyMap = {};
    filteredC.forEach(c => {
      const m = (c.receipt_date || c.created_at?.slice(0, 10) || '').slice(0, 7);
      if (m) monthlyMap[m] = (monthlyMap[m] || 0) + 1;
    });

    return {
      total, closed, pending, closeRate, byStage, byCause,
      topCustomers: topN(filteredC, 'customer_name'),
      topDefects:   topN(filteredC, 'defect_type'),
      monthly:      Object.entries(monthlyMap).sort().map(([m, n]) => ({ month: m.slice(5), count: n })),
    };
  }, [filteredC, stages]);

  // ── 공급사 통계 ──────────────────────────────────────────────
  const S = useMemo(() => {
    const total    = filteredS.length;
    const totalIn  = filteredS.reduce((s, c) => s + (c.quantity || 0), 0);
    const totalDef = filteredS.reduce((s, c) => s + (c.defect_quantity || 0), 0);
    const defRate  = totalIn > 0 ? (totalDef / totalIn * 100).toFixed(2) : '0';

    const noAction   = filteredS.filter(c => !c.improvement_status || c.improvement_status === '미조치').length;
    const inProgress = filteredS.filter(c => c.improvement_status === '진행중').length;
    const done       = filteredS.filter(c => c.improvement_status === '완료').length;
    const doneRate   = total > 0 ? (done / total * 100).toFixed(0) : '0';

    const donut = [
      { name: '미조치', value: noAction,   color: RED },
      { name: '진행중', value: inProgress, color: AMBER },
      { name: '완료',   value: done,       color: GREEN },
    ].filter(d => d.value > 0);

    const supMap = {};
    filteredS.forEach(c => {
      const k = c.supplier_name || '(미분류)';
      if (!supMap[k]) supMap[k] = { count: 0, qty: 0, def: 0 };
      supMap[k].count++;
      supMap[k].qty += c.quantity || 0;
      supMap[k].def += c.defect_quantity || 0;
    });
    const topSuppliers = Object.entries(supMap)
      .sort(([, a], [, b]) => b.count - a.count).slice(0, 5)
      .map(([name, d]) => ({ name, count: d.count, rate: d.qty > 0 ? (d.def / d.qty * 100).toFixed(1) : '0' }));

    const monthlyMap = {};
    filteredS.forEach(c => {
      const m = (c.incoming_date || c.created_at?.slice(0, 10) || '').slice(0, 7);
      if (m) monthlyMap[m] = (monthlyMap[m] || 0) + 1;
    });

    return {
      total, totalIn, totalDef, defRate, noAction, inProgress, done, doneRate, donut, topSuppliers,
      topDefects: topN(filteredS, 'defect_type'),
      byStage:    topN(filteredS, 'inspection_stage'),
      monthly:    Object.entries(monthlyMap).sort().map(([m, n]) => ({ month: m.slice(5), count: n })),
    };
  }, [filteredS]);

  // ── 이슈 & 권고 ──────────────────────────────────────────────
  const { issues, recs } = useMemo(() => {
    const issues = [], recs = [];
    if (C.total > 0 && parseFloat(C.closeRate) < 60 && C.pending >= 2)
      issues.push(`고객사 클레임 종결률 ${C.closeRate}% — 미결 ${C.pending}건이 체류 중입니다. 단계별 병목을 점검하세요.`);
    if (C.topCustomers.length && C.topCustomers[0][1] / C.total >= 0.3)
      issues.push(`"${C.topCustomers[0][0]}" 단일 고객사 집중: 전체의 ${(C.topCustomers[0][1]/C.total*100).toFixed(0)}% (${C.topCustomers[0][1]}건). 해당 고객사와 품질 협의가 필요합니다.`);
    if (C.byCause.length && C.byCause[0][1] >= 2)
      issues.push(`반복 발생 원인 "${C.byCause[0][0]}" (${C.byCause[0][1]}건) — 재발방지 대책의 실효성을 점검하세요.`);
    if (S.total && parseFloat(S.defRate) > 3)
      issues.push(`공급사 전체 불량률 ${S.defRate}% — 허용 기준(3%) 초과. 수입검사 강화 또는 공급사 평가 재검토가 필요합니다.`);
    if (S.topSuppliers.length && S.topSuppliers[0].count / S.total >= 0.4)
      issues.push(`"${S.topSuppliers[0].name}" 단일 공급사 집중: 전체의 ${(S.topSuppliers[0].count/S.total*100).toFixed(0)}% (${S.topSuppliers[0].count}건). 집중 관리 필요.`);
    if (S.noAction >= 3)
      issues.push(`시정조치 미등록 ${S.noAction}건 — 담당자를 지정하고 즉시 조치 계획을 수립하세요.`);

    if (C.pending > 0)
      recs.push(`[품질기술팀·영업팀] 미결 클레임 ${C.pending}건 진행 현황을 일괄 점검하고, 30일 이상 지연 건은 조기 종결 조치를 취하세요.`);
    if (C.byCause.length)
      recs.push(`[품질기술팀] 주요 원인 "${C.byCause[0][0]}" 재발방지 대책의 현장 적용 여부를 확인하고, 개선 효과를 수치로 측정할 기준을 마련하세요.`);
    if (S.topSuppliers.length)
      recs.push(`[SCM팀] 불량 상위 공급사(${S.topSuppliers.slice(0, 2).map(s => s.name).join(', ')})에 공식 클레임 통보 및 시정조치 요구서를 발행하고 다음 입고 시 전수검사를 실시하세요.`);
    if (S.noAction >= 2)
      recs.push(`[품질기술팀] 시정조치 미등록 ${S.noAction}건에 조치 유형을 등록하고 완료 일정을 수립하세요.`);
    if (parseFloat(S.defRate) > 3)
      recs.push(`[SCM팀·품질기술팀] 공급사 정기 품질 평가 주기를 단축하고, 불량률 3% 초과 시 경고·5% 초과 시 거래 재검토 기준을 내규화하세요.`);
    return { issues, recs };
  }, [C, S]);

  // ── 서술형 Action Required 인사이트 ──────────────────────────
  const actionInsights = useMemo(() => {
    const items = [];
    const today = new Date();
    const daysSince = (dateStr) => dateStr
      ? Math.round((today - new Date(dateStr)) / 86400000)
      : 0;

    // ─ 즉시 조치 ─
    const longPending60 = filteredC.filter(c => {
      if (c.current_stage === '종결') return false;
      const d = c.receipt_date || (c.created_at || '').slice(0, 10);
      return d && daysSince(d) >= 60;
    });
    if (longPending60.length > 0) {
      const names = [...new Set(longPending60.map(c => c.customer_name).filter(Boolean))].slice(0, 3);
      items.push({
        priority: 'urgent',
        title: `장기 미처리 클레임 ${longPending60.length}건 (60일+)`,
        detail: `${names.join(', ')}${longPending60.length > names.length ? ` 외 ${longPending60.length - names.length}건` : ''} — 각 건이 60일 이상 단계에 체류 중입니다.`,
        action: '품질기술팀·영업팀이 금주 내 각 고객사와 종결 일정을 합의하고, 90일+ 건은 팀장 에스컬레이션을 진행하세요.',
        team: '품질기술팀 · 영업팀',
      });
    }

    const highRateSuppliers = S.topSuppliers.filter(s => parseFloat(s.rate) >= 5);
    if (highRateSuppliers.length > 0) {
      items.push({
        priority: 'urgent',
        title: `고불량률 공급사 ${highRateSuppliers.length}개사 — 불량률 5% 초과`,
        detail: `${highRateSuppliers.map(s => `${s.name}(${s.rate}%)`).join(', ')} — 허용 기준(5%)을 초과한 상태로 즉각적인 조치가 필요합니다.`,
        action: 'SCM팀이 해당 공급사에 긴급 시정조치 요구서(8D 포맷)를 발행하고, 다음 입고분은 전수검사로 전환하세요.',
        team: 'SCM팀 · 품질기술팀',
      });
    }

    if (S.noAction >= 5) {
      items.push({
        priority: 'urgent',
        title: `시정조치 미등록 ${S.noAction}건 — 담당자 미지정`,
        detail: `공급사 불량 ${S.total}건 중 ${S.noAction}건에 조치 계획이 없습니다. 방치 시 재발 위험이 높습니다.`,
        action: '품질기술팀이 이번 주 내 미등록 건에 조치 담당자를 지정하고, 2주 내 조치 완료를 목표로 계획을 수립하세요.',
        team: '품질기술팀',
      });
    }

    // ─ 프로세스 개선 ─
    const comboCnt = {};
    filteredC.forEach(c => {
      if (!c.customer_name || !c.part_number) return;
      const key = `${c.customer_name}||${c.part_number}`;
      comboCnt[key] = (comboCnt[key] || 0) + 1;
    });
    const repeatCombos = Object.entries(comboCnt).filter(([, v]) => v >= 2).sort(([, a], [, b]) => b - a);
    if (repeatCombos.length > 0) {
      const [[topKey, topCnt]] = repeatCombos;
      const [cust, part] = topKey.split('||');
      items.push({
        priority: 'process',
        title: `동일 품목 재발 ${repeatCombos.length}조합 — 시정조치 실효성 의심`,
        detail: `재발 최다: "${cust}" × 품번 ${part} (${topCnt}회). 조치 후에도 동일 불량이 반복 발생하고 있어 근본 원인이 해결되지 않았을 가능성이 있습니다.`,
        action: '해당 품목의 원인분석 이력을 검토하고, 조치 내용이 현장 공정/검사 기준서에 실제로 반영됐는지 확인하세요. 재발 시 4M 원인 재분석을 의무화하세요.',
        team: '품질기술팀',
      });
    }

    if (C.total >= 3 && parseFloat(C.closeRate) < 50) {
      items.push({
        priority: 'process',
        title: `클레임 처리 프로세스 정체 — 종결률 ${C.closeRate}%`,
        detail: `전체 ${C.total}건 중 ${C.pending}건이 미결 상태입니다. 단계별 처리 절차에 병목이 있거나 담당자 간 업무 이관이 원활하지 않은 상태입니다.`,
        action: '각 단계별 평균 체류 시간을 측정하고, 14일 이상 정체 건에 대해 자동 알림 또는 주간 미결 보고 체계를 도입하세요.',
        team: '품질기술팀 · 영업팀',
      });
    }

    const postInspectionCnt = filteredS.filter(c => c.inspection_stage && c.inspection_stage !== '수입검사').length;
    if (filteredS.length >= 3 && postInspectionCnt / filteredS.length >= 0.3) {
      items.push({
        priority: 'process',
        title: `수입검사 이후 단계 불량 검출 비율 ${Math.round(postInspectionCnt / filteredS.length * 100)}%`,
        detail: `불량 ${filteredS.length}건 중 ${postInspectionCnt}건이 공정/완성 검사에서 뒤늦게 발견됐습니다. 수입검사에서 선제적으로 걸러내지 못하고 있습니다.`,
        action: '수입검사 체크리스트에 해당 불량 유형을 추가하고, 반복 발생 품목은 전수검사 또는 샘플 수량을 늘리세요.',
        team: '품질기술팀 · SCM팀',
      });
    }

    // ─ 인력/교육 개선 ─
    const faultCount = C.byCause.find(([k]) => k.includes('과실') || k.includes('오용'))?.[1] || 0;
    const causeTotalCount = C.byCause.reduce((s, [, v]) => s + v, 0);
    if (faultCount >= 2 && causeTotalCount > 0 && faultCount / causeTotalCount >= 0.3) {
      items.push({
        priority: 'personnel',
        title: `사용자 과실 원인 집중 — 원인 분석 대비 ${Math.round(faultCount / causeTotalCount * 100)}%`,
        detail: `원인 분석 ${causeTotalCount}건 중 ${faultCount}건이 사용자 과실로 분류됩니다. 제품 취급 방법에 대한 고객 교육이 부족하거나, 제품 설명이 불명확할 수 있습니다.`,
        action: '영업팀이 사용자 과실 발생 고객사에 제품 취급 매뉴얼과 주의사항을 재배포하고, 현장 사용 교육을 실시하세요. 지속 발생 시 경고 라벨 또는 인터락 설계 개선을 검토하세요.',
        team: '영업팀 · 기술지원팀',
      });
    }

    const repMap = {};
    filteredC.forEach(c => { if (c.sales_rep_name) repMap[c.sales_rep_name] = (repMap[c.sales_rep_name] || 0) + 1; });
    const topRep = Object.entries(repMap).sort(([, a], [, b]) => b - a)[0];
    if (topRep && C.total >= 5 && topRep[1] / C.total >= 0.5) {
      items.push({
        priority: 'personnel',
        title: `영업담당자별 클레임 편중: ${topRep[0]} (${Math.round(topRep[1] / C.total * 100)}%)`,
        detail: `전체 클레임의 절반 이상이 한 명의 담당자 관할에서 발생합니다. 담당 고객사의 품질 관리 방식이나 소통 채널에 문제가 있을 수 있습니다.`,
        action: '팀장이 해당 담당자와 주 1회 클레임 현황을 공유하고, 반복 발생 고객사는 품질기술팀과 합동 방문을 진행하세요.',
        team: '영업팀장',
      });
    }

    // ─ 공급사 관리 ─
    if (S.topSuppliers.length && S.total >= 5 && S.topSuppliers[0].count / S.total >= 0.4) {
      const top = S.topSuppliers[0];
      items.push({
        priority: 'supply',
        title: `공급사 불량 집중: ${top.name} — 전체의 ${Math.round(top.count / S.total * 100)}%`,
        detail: `${top.count}건(${Math.round(top.count / S.total * 100)}%)이 한 개 공급사에서 발생합니다. 해당 공급사 의존도가 높아 공급망 리스크가 큽니다.`,
        action: 'SCM팀이 해당 공급사와 품질 개선 협약을 체결하고 월 1회 이상 현장 점검을 실시하세요. 중장기적으로 대안 공급사 확보를 검토하세요.',
        team: 'SCM팀',
      });
    }

    if (S.total >= 3 && parseFloat(S.doneRate) < 40) {
      items.push({
        priority: 'supply',
        title: `시정조치 완료율 저조 — ${S.doneRate}% (목표 80%)`,
        detail: `공급사 불량 ${S.total}건 중 완료는 ${S.done}건에 불과합니다. 조치 이행을 추적하는 체계가 미흡한 상태입니다.`,
        action: '미완료 건별 데드라인을 설정하고, 공급사별 이행 현황을 주간 단위로 추적하세요. 기한 내 미이행 시 구매 보류 또는 페널티 적용을 검토하세요.',
        team: 'SCM팀 · 품질기술팀',
      });
    }

    // ─ 모니터링 ─
    if (C.monthly.length >= 2) {
      const lastM = C.monthly[C.monthly.length - 1].count;
      const prevM = C.monthly[C.monthly.length - 2].count;
      if (prevM > 0 && (lastM - prevM) / prevM >= 0.3) {
        items.push({
          priority: 'monitor',
          title: `최근 클레임 증가 추세 — 전월 대비 +${lastM - prevM}건 (+${Math.round((lastM - prevM) / prevM * 100)}%)`,
          detail: `전월 ${prevM}건에서 최근 ${lastM}건으로 증가했습니다. 계절적 요인인지 구조적 요인인지 빠른 파악이 필요합니다.`,
          action: '품질기술팀이 최근 접수 클레임의 고객사·품목·불량 유형 공통점을 분석하고 이번 달 내 원인 보고서를 작성하세요.',
          team: '품질기술팀',
        });
      }
    }

    if (S.total > 0 && parseFloat(S.defRate) > 1 && parseFloat(S.defRate) <= 3) {
      items.push({
        priority: 'monitor',
        title: `공급사 불량률 허용 범위 내 — ${S.defRate}% (기준 3%)`,
        detail: `현재는 기준 이하이나, 목표(1%) 대비 여전히 개선 여지가 있습니다. 추세가 반등하면 즉각 대응이 필요합니다.`,
        action: '현행 수입검사 주기를 유지하면서 분기별 추이를 관찰하세요. 2개월 연속 2% 초과 시 검사 강화 또는 공급사 현장 점검으로 전환하세요.',
        team: '품질기술팀',
      });
    }

    if (C.total > 0 && parseFloat(C.closeRate) >= 70 && S.total > 0 && parseFloat(S.defRate) <= 1 && items.length === 0) {
      items.push({
        priority: 'monitor',
        title: '전반적으로 양호한 품질 수준 유지 중',
        detail: `클레임 종결률 ${C.closeRate}%, 공급사 불량률 ${S.defRate}%로 두 지표 모두 목표 기준을 충족하고 있습니다.`,
        action: '현행 관리 수준을 유지하면서, 데이터를 지속 축적하여 분기별 트렌드 변화에 대비하세요.',
        team: '품질기술팀',
      });
    }

    return items;
  }, [C, S, filteredC, filteredS]);

  const summaryText = useMemo(() => {
    const parts = [];
    parts.push(`${start} ~ ${end} 기간 내 고객사 클레임 ${C.total}건, 공급사 불량 ${S.total}건이 접수되었습니다.`);
    if (C.total > 0) {
      const rateDesc = parseFloat(C.closeRate) >= 70 ? `목표(70%)를 달성한 양호한 수준(${C.closeRate}%)입니다` : `목표(70%) 대비 ${(70 - parseFloat(C.closeRate)).toFixed(0)}%p 미달(${C.closeRate}%)로 개선이 필요합니다`;
      parts.push(`클레임 종결률은 ${rateDesc}.`);
    }
    if (S.total > 0) {
      const defDesc = parseFloat(S.defRate) <= 1 ? `우수한 수준(${S.defRate}%)입니다` : parseFloat(S.defRate) <= 3 ? `허용 범위 내(${S.defRate}%)이나 지속 모니터링이 필요합니다` : `허용 기준(3%)을 초과(${S.defRate}%)하여 즉각적인 개선이 필요합니다`;
      parts.push(`공급사 전체 불량률은 ${defDesc}.`);
    }
    const urgentCnt = actionInsights.filter(i => i.priority === 'urgent').length;
    if (urgentCnt > 0) parts.push(`즉각적인 조치가 필요한 사항 ${urgentCnt}건이 발견되었습니다.`);
    return parts.join(' ');
  }, [C, S, start, end, actionInsights]);

  // ── 월별 통합 ─────────────────────────────────────────────────
  const trend = useMemo(() => {
    const allM = new Set([...C.monthly.map(d => d.month), ...S.monthly.map(d => d.month)]);
    return [...allM].sort().map(m => ({
      month: m,
      고객사클레임: C.monthly.find(d => d.month === m)?.count || 0,
      공급사불량:   S.monthly.find(d => d.month === m)?.count || 0,
    }));
  }, [C, S]);

  const total = filteredC.length + filteredS.length;

  const generate = () => {
    if (!total) return;
    setPrintTitle(`AJW 클레임 종합 분석 보고서 (${start} ~ ${end})`);
    setShown(true);
  };

  const presets = [
    ['이번 달',    () => { const n=new Date(); setStart(n.toISOString().slice(0,8)+'01'); setEnd(n.toISOString().slice(0,10)); setShown(false); }],
    ['최근 3개월', () => { const n=new Date(),s=new Date(n); s.setMonth(s.getMonth()-3); setStart(s.toISOString().slice(0,10)); setEnd(n.toISOString().slice(0,10)); setShown(false); }],
    ['올해',       () => { const y=new Date().getFullYear(); setStart(`${y}-01-01`); setEnd(new Date().toISOString().slice(0,10)); setShown(false); }],
  ];

  return (
    <div>
      {/* 헤더 */}
      {!embedded && (
        <div className="page-header">
          <div>
            <div className="page-title">📊 클레임 종합 분석 보고서</div>
            <div className="page-sub">기간을 선택하면 고객사 클레임 + 공급사 불량을 시각화·분석합니다</div>
          </div>
          {shown && <button className="btn btn-ghost btn-sm no-print" onClick={() => window.print()}>🖨️ 인쇄/PDF</button>}
        </div>
      )}

      {/* 모드 탭 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[['period','📅 기간 분석'],['year','📊 연도별 비교']].map(([v, label]) => (
          <button key={v} onClick={() => setMode(v)} style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit',
            background: mode === v ? '#0f172a' : '#fff',
            color: mode === v ? '#fff' : '#64748b',
            borderColor: mode === v ? '#0f172a' : '#e2e8f0',
          }}>{label}</button>
        ))}
      </div>

      {/* 연도별 비교 모드 */}
      {mode === 'year' && (
        <YearCompareReport claims={claims} supplierClaims={supplierClaims} stages={stages} />
      )}

      {/* 기간 분석 모드 */}
      {mode === 'period' && (<>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>시작일</div>
            <input type="date" value={start} onChange={e => { setStart(e.target.value); setShown(false); }}
              style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }} />
          </div>
          <div style={{ fontSize: 18, color: '#cbd5e1', paddingBottom: 8 }}>—</div>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>종료일</div>
            <input type="date" value={end} onChange={e => { setEnd(e.target.value); setShown(false); }}
              style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {presets.map(([label, fn]) => (
              <button key={label} className="btn btn-ghost btn-sm" onClick={fn} style={{ fontSize: 12 }}>{label}</button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={generate} disabled={!total} style={{ marginLeft: 'auto', minWidth: 140 }}>
            📊 보고서 생성
          </button>
        </div>
        {total > 0 && (
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <span style={{ padding: '4px 12px', background: '#eff6ff', borderRadius: 8, fontSize: 12, color: '#1d4ed8', fontWeight: 600 }}>고객사 클레임 {filteredC.length}건</span>
            <span style={{ padding: '4px 12px', background: '#fffbeb', borderRadius: 8, fontSize: 12, color: '#92400e', fontWeight: 600 }}>공급사 불량 {filteredS.length}건</span>
          </div>
        )}
      </div>

      {!total && (
        <div className="empty"><div className="empty-icon">📊</div>선택한 기간({start} ~ {end})에 데이터가 없습니다</div>
      )}

      {shown && total > 0 && (
        <>
          {/* KPI 타일 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
            <KpiTile label="고객사 클레임" value={`${C.total}건`} sub={`미결 ${C.pending}건`} color={BLUE} bg="#eff6ff" border="#bfdbfe" />
            <KpiTile
              label="클레임 종결률" value={`${C.closeRate}%`} sub={`종결 ${C.closed}건`}
              color={parseFloat(C.closeRate)>=70?GREEN:parseFloat(C.closeRate)>=50?AMBER:RED}
              bg={parseFloat(C.closeRate)>=70?'#f0fdf4':parseFloat(C.closeRate)>=50?'#fffbeb':'#fef2f2'}
              border={parseFloat(C.closeRate)>=70?'#bbf7d0':parseFloat(C.closeRate)>=50?'#fde68a':'#fecaca'}
            />
            <KpiTile label="공급사 불량" value={`${S.total}건`}
              sub={`불량 ${S.totalDef.toLocaleString()} / 입고 ${S.totalIn.toLocaleString()} EA`}
              color={AMBER} bg="#fffbeb" border="#fde68a" />
            <KpiTile
              label="전체 불량률" value={`${S.defRate}%`} sub="입고 대비 불량 수량"
              color={statusColor(S.defRate)} bg={statusBg(S.defRate)} border={statusBorder(S.defRate)}
            />
          </div>

          {/* 월별 추이 */}
          {trend.length > 1 && (
            <div className="card" style={{ marginBottom: 16, padding: '20px 24px' }}>
              <SectionTitle icon="📈" title="월별 접수 추이" />
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={trend} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="고객사클레임" fill={BLUE}  radius={[4,4,0,0]} maxBarSize={28} />
                  <Bar dataKey="공급사불량"   fill={AMBER} radius={[4,4,0,0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, justifyContent: 'center' }}>
                {[[BLUE,'고객사 클레임'],[AMBER,'공급사 불량']].map(([color,label])=>(
                  <span key={label} style={{ fontSize:11,color:'#64748b',display:'flex',alignItems:'center',gap:4 }}>
                    <span style={{ width:10,height:10,borderRadius:2,background:color,display:'inline-block' }}/>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 고객사 클레임 분석 */}
          {C.total > 0 && (
            <div className="card" style={{ marginBottom: 16, padding: '20px 24px' }}>
              <SectionTitle icon="🏢" title="고객사 클레임 분석" color="#1d4ed8" />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, marginBottom: 24 }}>
                {/* 단계별 분포 */}
                <div>
                  <SubTitle>단계별 현황</SubTitle>
                  <ResponsiveContainer width="100%" height={Math.max(C.byStage.length * 38, 80)}>
                    <BarChart data={C.byStage} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} width={90} />
                      <Tooltip formatter={v => [`${v}건`]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="count" fill={BLUE} radius={[0,4,4,0]} maxBarSize={18}
                        label={{ position:'right', fontSize:11, fill:'#64748b', formatter: v => v+'건' }} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
                    {C.pending > 0
                      ? `현재 미결 <strong style="color:#dc2626">${C.pending}건</strong>이 처리 중입니다. 종결률은 <strong>${C.closeRate}%</strong>로, ${parseFloat(C.closeRate) >= 70 ? '양호한 수준입니다.' : '목표(70%) 대비 개선이 필요합니다.'}`
                      : `선택 기간 내 모든 클레임이 종결 처리되었습니다. (종결률 100%)`
                    }
                  </div>
                </div>

                {/* 주요 고객사 */}
                <div>
                  <SubTitle>주요 고객사 TOP 5</SubTitle>
                  {C.topCustomers.map(([name, count], i) => (
                    <HBar key={name} name={name} count={count} total={C.total} color={BLUE} rank={i + 1} />
                  ))}
                  {C.topCustomers.length > 0 && (
                    <div style={{ marginTop: 10, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
                      1위 <strong>{C.topCustomers[0][0]}</strong>가 전체의 <strong>{(C.topCustomers[0][1]/C.total*100).toFixed(0)}%</strong>를 차지합니다.
                      {C.topCustomers[0][1]/C.total >= 0.3 && ' 특정 고객사 집중도가 높아 리스크 관리가 필요합니다.'}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
                {/* 불량 유형 */}
                {C.topDefects.length > 0 && (
                  <div>
                    <SubTitle>불량 유형별</SubTitle>
                    {C.topDefects.map(([name, count], i) => (
                      <HBar key={name} name={name} count={count} total={C.total} color={PURPLE} rank={i + 1} />
                    ))}
                  </div>
                )}

                {/* 원인 분석 */}
                {C.byCause.length > 0 ? (
                  <div>
                    <SubTitle>원인 분석 결과 (회수품 분석 기준)</SubTitle>
                    <ResponsiveContainer width="100%" height={Math.max(C.byCause.length * 36, 60)}>
                      <BarChart data={C.byCause.map(([name,count])=>({name,count}))} layout="vertical"
                        margin={{ top:0, right:48, left:0, bottom:0 }}>
                        <XAxis type="number" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:'#374151' }} axisLine={false} tickLine={false} width={110} />
                        <Tooltip formatter={v=>[`${v}건`]} contentStyle={{ fontSize:12, borderRadius:8 }} />
                        <Bar dataKey="count" fill={PURPLE} radius={[0,4,4,0]} maxBarSize={18}
                          label={{ position:'right', fontSize:11, fill:'#64748b', formatter: v=>v+'건' }} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ marginTop:10, padding:'10px 14px', background:'#faf5ff', borderRadius:8, fontSize:12, color:'#475569', lineHeight:1.6 }}>
                      가장 빈번한 원인은 <strong style={{ color:'#7c3aed' }}>{C.byCause[0][0]}</strong> ({C.byCause[0][1]}건)입니다.
                      {C.byCause[0][1] >= 2 && ' 반복 발생 원인으로, 재발방지 대책의 실효성 점검이 필요합니다.'}
                    </div>
                  </div>
                ) : (
                  <div>
                    <SubTitle>원인 분석 결과</SubTitle>
                    <div style={{ fontSize:12, color:'#94a3b8', padding:'16px 0' }}>회수품 원인분석 단계 데이터 없음</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 공급사 불량 분석 */}
          {S.total > 0 && (
            <div className="card" style={{ marginBottom: 16, padding: '20px 24px' }}>
              <SectionTitle icon="🏭" title="공급사 불량 분석" color="#92400e" />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, marginBottom: 24 }}>
                {/* 시정조치 현황 도넛 */}
                <div>
                  <SubTitle>시정조치 현황</SubTitle>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <PieChart width={130} height={130}>
                      <Pie data={S.donut} cx={60} cy={60} innerRadius={38} outerRadius={58}
                        dataKey="value" startAngle={90} endAngle={-270} paddingAngle={2}>
                        {S.donut.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                      </Pie>
                      <Tooltip formatter={(v, name) => [`${v}건`, name]} contentStyle={{ fontSize:12, borderRadius:8 }} />
                    </PieChart>
                    <div>
                      {S.donut.map(d => (
                        <div key={d.name} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                          <span style={{ width:10, height:10, borderRadius:2, background:d.color, display:'inline-block', flexShrink:0 }}/>
                          <span style={{ fontSize:13, color:'#374151' }}>{d.name}</span>
                          <span style={{ fontSize:13, fontWeight:700, color:'#1e293b', marginLeft:4 }}>{d.value}건</span>
                        </div>
                      ))}
                      <div style={{ fontSize:12, color:'#94a3b8', marginTop:4, borderTop:'1px solid #f1f5f9', paddingTop:8 }}>
                        완료율 <strong style={{ color:parseFloat(S.doneRate)>=70?GREEN:parseFloat(S.doneRate)>=40?AMBER:RED }}>{S.doneRate}%</strong>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop:12, padding:'10px 14px', background:'#fffbeb', borderRadius:8, fontSize:12, color:'#475569', lineHeight:1.6 }}>
                    전체 {S.total}건 중 시정조치 완료 <strong>{S.done}건</strong>,
                    미조치 <strong style={{ color:S.noAction>=3?RED:'inherit' }}>{S.noAction}건</strong>.
                    {S.noAction >= 3 && ' 즉시 조치 담당자 지정이 필요합니다.'}
                  </div>
                </div>

                {/* 주요 공급사 */}
                <div>
                  <SubTitle>주요 공급사 TOP 5 (건수 / 불량률)</SubTitle>
                  {S.topSuppliers.map((s, i) => (
                    <div key={s.name} style={{ marginBottom: 10 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:10, fontWeight:700, color:i===0?AMBER:'#94a3b8', width:14, textAlign:'center' }}>{i+1}</span>
                          <span style={{ fontSize:12, fontWeight:i===0?700:400, color:'#1e293b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:150 }}>{s.name}</span>
                        </div>
                        <div style={{ fontSize:11, color:'#64748b', flexShrink:0, marginLeft:8, textAlign:'right' }}>
                          {s.count}건
                          {parseFloat(s.rate) > 0 && (
                            <span style={{ marginLeft:4, color:parseFloat(s.rate)>5?RED:parseFloat(s.rate)>3?AMBER:'#64748b', fontWeight:600 }}>
                              ({s.rate}%)
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ background:'#f1f5f9', borderRadius:4, height:7, overflow:'hidden' }}>
                        <div style={{
                          background: parseFloat(s.rate)>5?RED:parseFloat(s.rate)>3?AMBER:AMBER,
                          width:`${S.total>0?Math.round(s.count/S.total*100):0}%`,
                          height:'100%', borderRadius:4,
                        }}/>
                      </div>
                    </div>
                  ))}
                  {S.topSuppliers.length > 0 && (
                    <div style={{ marginTop:10, padding:'10px 14px', background:'#fffbeb', borderRadius:8, fontSize:12, color:'#475569', lineHeight:1.6 }}>
                      불량률 3% 초과 공급사:&nbsp;
                      <strong style={{ color:RED }}>
                        {S.topSuppliers.filter(s=>parseFloat(s.rate)>3).map(s=>s.name).join(', ') || '없음'}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
                {S.topDefects.length > 0 && (
                  <div>
                    <SubTitle>불량 유형별</SubTitle>
                    {S.topDefects.map(([name, count], i) => (
                      <HBar key={name} name={name} count={count} total={S.total} color={AMBER} rank={i+1} />
                    ))}
                  </div>
                )}
                {S.byStage.length > 0 && (
                  <div>
                    <SubTitle>검사 단계별</SubTitle>
                    {S.byStage.map(([name, count], i) => (
                      <HBar key={name} name={name} count={count} total={S.total} color={PURPLE} rank={i+1} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 종합 인사이트 & Action Required */}
          <div className="card" style={{ marginBottom: 16, padding: '20px 24px' }}>
            <SectionTitle icon="🎯" title="종합 인사이트 & Action Required" />

            {/* 현황 요약 내러티브 */}
            {summaryText && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', marginBottom: 18, fontSize: 13, lineHeight: 1.75, color: '#334155' }}>
                {summaryText}
              </div>
            )}

            {/* 우선순위 배지 행 */}
            {actionInsights.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {PRIORITY_CONFIG.map(pc => {
                  const cnt = actionInsights.filter(i => i.priority === pc.key).length;
                  if (!cnt) return null;
                  return (
                    <span key={pc.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, background: pc.bg, border: `1px solid ${pc.border}`, fontSize: 12, fontWeight: 700, color: pc.color }}>
                      {pc.icon} {pc.label} <span style={{ background: pc.color, color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 11 }}>{cnt}</span>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Action Required 카드 목록 */}
            {actionInsights.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
                분석 기간 내 특별한 조치 사항이 발견되지 않았습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {PRIORITY_CONFIG.map(pc =>
                  actionInsights.filter(i => i.priority === pc.key).map((item, idx) => (
                    <div key={`${pc.key}-${idx}`} style={{ border: `1.5px solid ${pc.border}`, borderLeft: `4px solid ${pc.color}`, borderRadius: 10, padding: '14px 18px', background: pc.bg }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 16 }}>{pc.icon}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: pc.color, background: '#fff', border: `1px solid ${pc.border}`, borderRadius: 6, padding: '2px 8px' }}>{pc.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{item.title}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: '#475569', marginBottom: 10, lineHeight: 1.6 }}>{item.detail}</div>
                      <div style={{ background: '#fff', border: `1px solid ${pc.border}`, borderRadius: 7, padding: '9px 13px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: pc.color, marginBottom: 4 }}>권고 조치</div>
                        <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>{item.action}</div>
                        <div style={{ marginTop: 6, fontSize: 11, color: '#94a3b8' }}>담당: <strong style={{ color: '#64748b' }}>{item.team}</strong></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
              <span>분석 기간: {start} ~ {end} · 고객사 {filteredC.length}건 + 공급사 {filteredS.length}건</span>
              <span>자동 생성 보고서 · AJW 클레임 트래커</span>
            </div>
          </div>
        </>
      )}
      </>)} {/* end period mode */}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   연도별 비교 컴포넌트 (AI 종합보고 전용)
═══════════════════════════════════════════════════════════════ */
function YearCompareReport({ claims, supplierClaims, stages }) {
  const [range, setRange] = useState(3);

  const allYears = useMemo(() => {
    const sc = new Set([
      ...claims.map(c => (c.receipt_date || c.created_at || '').slice(0, 4)),
      ...supplierClaims.map(c => (c.incoming_date || c.created_at || '').slice(0, 4)),
    ]);
    return [...sc].filter(y => y >= '2020').sort();
  }, [claims, supplierClaims]);

  const displayYears = useMemo(() =>
    range ? allYears.slice(-range) : allYears,
  [allYears, range]);

  const causeMap = useMemo(() => {
    const m = {};
    (stages || []).forEach(s => {
      if (!s.description?.includes('[원인]')) return;
      const match = s.description.match(/\[원인\]\s*([^\n]+)/);
      if (!match) return;
      match[1].split(',').map(x => x.trim()).forEach(k => {
        if (!m[s.claim_id]) m[s.claim_id] = [];
        m[s.claim_id].push(k);
      });
    });
    return m;
  }, [stages]);

  const yearStats = useMemo(() => displayYears.map(year => {
    const yC = claims.filter(c => (c.receipt_date || c.created_at || '').startsWith(year));
    const yS = supplierClaims.filter(c => (c.incoming_date || c.created_at || '').startsWith(year));

    const cTotal    = yC.length;
    const cClosed   = yC.filter(c => c.current_stage === '종결').length;
    const closeRate = cTotal ? Math.round(cClosed / cTotal * 100) : 0;

    const sTotal   = yS.length;
    const totalIn  = yS.reduce((s, c) => s + (c.quantity || 0), 0);
    const totalDef = yS.reduce((s, c) => s + (c.defect_quantity || 0), 0);
    const defRate  = totalIn > 0 ? +(totalDef / totalIn * 100).toFixed(2) : 0;

    const custMap = {};
    yC.forEach(c => { const k = c.customer_name||'(미분류)'; custMap[k]=(custMap[k]||0)+1; });
    const topCustomer = Object.entries(custMap).sort(([,a],[,b])=>b-a)[0];

    const supMap = {};
    yS.forEach(c => { const k = c.supplier_name||'(미분류)'; supMap[k]=(supMap[k]||0)+1; });
    const topSupplier = Object.entries(supMap).sort(([,a],[,b])=>b-a)[0];

    const cCauseMap = {};
    yC.forEach(c => {
      (causeMap[c.id]||[]).forEach(k => { cCauseMap[k]=(cCauseMap[k]||0)+1; });
    });
    const topCause = Object.entries(cCauseMap).sort(([,a],[,b])=>b-a)[0];

    const sNoAction = yS.filter(c => !c.improvement_status || c.improvement_status==='미조치').length;
    const sDone     = yS.filter(c => c.improvement_status==='완료').length;
    const sDoneRate = sTotal ? Math.round(sDone/sTotal*100) : 0;

    return { year, cTotal, cClosed, closeRate, sTotal, totalIn, totalDef, defRate, sNoAction, sDone, sDoneRate, topCustomer, topSupplier, topCause };
  }), [displayYears, claims, supplierClaims, causeMap]);

  const BAR_C = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4'];

  const DeltaBadge = ({ curr, prev, key, unit='건', inverse=false }) => {
    if (!prev) return <span style={{ color:'#94a3b8', fontSize:11 }}>—</span>;
    const d = curr[key] - prev[key];
    const isGood = inverse ? d <= 0 : d >= 0;
    const color = d === 0 ? '#94a3b8' : isGood ? '#10b981' : '#ef4444';
    return (
      <span style={{ fontSize:11, color, fontWeight:600 }}>
        {d > 0 ? '▲' : d < 0 ? '▼' : '±'} {Math.abs(d)}{unit}
      </span>
    );
  };

  const btnStyle = (active) => ({
    padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit',
    background: active ? '#0f172a' : '#fff',
    color: active ? '#fff' : '#64748b',
    borderColor: active ? '#0f172a' : '#e2e8f0',
  });

  const yearInsights = useMemo(() => {
    if (yearStats.length < 2) return [];
    const items = [];
    const last  = yearStats[yearStats.length - 1];
    const prev  = yearStats[yearStats.length - 2];

    // ─ 즉시 조치 ─
    const risingYears = yearStats.filter((y, i) => i > 0 && y.cTotal > yearStats[i-1].cTotal).length;
    if (risingYears >= 2 && yearStats.length >= 3) {
      items.push({
        priority: 'urgent',
        title: `고객사 클레임 ${risingYears}년 연속 증가 추세`,
        detail: `${yearStats.slice(-risingYears-1).map(y=>`${y.year}년 ${y.cTotal}건`).join(' → ')} — 단순 변동이 아닌 구조적 증가 패턴으로, 근본 원인 파악이 필요합니다.`,
        action: '품질기술팀이 클레임 증가 원인을 제품군·고객사별로 분류 분석하고, 이번 분기 내 개선 목표치를 설정하세요.',
        team: '품질기술팀 · 영업팀',
      });
    }

    if (last.defRate > 3) {
      items.push({
        priority: 'urgent',
        title: `${last.year}년 공급사 불량률 허용 기준 초과 — ${last.defRate}%`,
        detail: `불량률 3% 기준을 초과했습니다. ${prev.year}년(${prev.defRate}%)과 비교 시 ${last.defRate > prev.defRate ? `▲ ${(last.defRate - prev.defRate).toFixed(2)}%p 악화` : `▼ ${(prev.defRate - last.defRate).toFixed(2)}%p 개선됐으나 여전히 기준 초과`}입니다.`,
        action: 'SCM팀이 고불량 공급사에 8D 시정조치 요구서를 발행하고, 입고 전수검사 적용 대상을 확대하세요.',
        team: 'SCM팀 · 품질기술팀',
      });
    }

    // ─ 프로세스 개선 ─
    const closeRateDrop = yearStats.length >= 2 &&
      yearStats.slice(-Math.min(yearStats.length, 3)).every((y, i, arr) => i === 0 || y.closeRate < arr[i-1].closeRate);
    if (closeRateDrop && last.closeRate < 70) {
      const dropStart = yearStats[yearStats.length - Math.min(yearStats.length, 3)];
      items.push({
        priority: 'process',
        title: `종결률 하락 추세 — ${dropStart.year}년 ${dropStart.closeRate}% → ${last.year}년 ${last.closeRate}%`,
        detail: `종결률이 ${yearStats.length >= 3 ? '2년 이상' : '전년 대비'} 지속 하락하고 있습니다. 클레임 처리 속도보다 접수 속도가 빠르거나, 처리 프로세스에 병목이 발생했을 수 있습니다.`,
        action: '각 처리 단계별 평균 소요일을 측정하고 병목 구간을 파악하세요. 처리 기한 기준을 명문화하고, 기한 초과 건에 대한 에스컬레이션 절차를 도입하세요.',
        team: '품질기술팀 · 영업팀',
      });
    }

    if (last.cTotal > 0 && last.sTotal > 0) {
      const cRatio = last.cTotal / last.sTotal;
      if (cRatio > 3) {
        items.push({
          priority: 'process',
          title: `고객사 클레임 대비 공급사 불량 비율 불균형 (${last.year}년)`,
          detail: `고객사 클레임 ${last.cTotal}건 / 공급사 불량 ${last.sTotal}건 — 비율이 ${cRatio.toFixed(1)}:1입니다. 공급사 불량 원인의 클레임 연계 추적이 이루어지지 않고 있을 수 있습니다.`,
          action: '공급사 불량 발생 시 관련 고객사 클레임과의 연계 여부를 의무 확인하고, 원인 분석 단계에 공급사 귀책 여부 항목을 추가하세요.',
          team: '품질기술팀',
        });
      }
    }

    // ─ 인력/교육 ─
    const sameTopCustomer = yearStats.length >= 2 &&
      yearStats.slice(-3).every(y => y.topCustomer?.[0] === last.topCustomer?.[0]);
    if (sameTopCustomer && last.topCustomer) {
      items.push({
        priority: 'personnel',
        title: `동일 고객사 클레임 집중 반복 — ${last.topCustomer[0]} (${Math.min(3, yearStats.length)}년 연속 1위)`,
        detail: `${yearStats.slice(-3).map(y=>`${y.year}년 ${y.topCustomer?.[1]}건`).join(', ')} — 동일 고객사에서 매년 최다 클레임이 발생합니다. 해당 고객사 전담 관리가 필요합니다.`,
        action: '영업·품질 합동으로 해당 고객사 방문 점검을 진행하고, 제품 사용 환경과 취급 방법을 재점검하세요. 필요시 전담 품질 담당자를 지정하세요.',
        team: '영업팀 · 품질기술팀',
      });
    }

    // ─ 공급사 관리 ─
    const sameTopSupplier = yearStats.length >= 2 &&
      yearStats.slice(-3).every(y => y.topSupplier?.[0] === last.topSupplier?.[0]);
    if (sameTopSupplier && last.topSupplier) {
      items.push({
        priority: 'supply',
        title: `동일 공급사 불량 집중 반복 — ${last.topSupplier[0]} (${Math.min(3, yearStats.length)}년 연속 1위)`,
        detail: `${yearStats.slice(-3).map(y=>`${y.year}년 ${y.topSupplier?.[1]}건`).join(', ')} — 반복적인 집중은 해당 공급사의 근본적인 품질 관리 역량 문제를 시사합니다.`,
        action: 'SCM팀이 해당 공급사와 연간 품질 개선 협약을 체결하고 분기별 현장 점검을 실시하세요. 중장기적으로 복수 공급사 확보를 추진하세요.',
        team: 'SCM팀',
      });
    }

    const doneRateDropYears = yearStats.filter((y, i) => i > 0 && y.sDoneRate < yearStats[i-1].sDoneRate && y.sDoneRate < 60).length;
    if (doneRateDropYears >= 1 && last.sDoneRate < 60) {
      items.push({
        priority: 'supply',
        title: `시정조치 완료율 저조 지속 — ${last.year}년 ${last.sDoneRate}%`,
        detail: `${prev.year}년 ${prev.sDoneRate}%에서 ${last.year}년 ${last.sDoneRate}%로 하락했습니다. 공급사 조치 이행 추적 체계가 작동하지 않고 있습니다.`,
        action: '미완료 건에 데드라인을 설정하고 공급사별 주간 이행률을 추적하세요. 2개 분기 연속 50% 미달 공급사는 구매 검토 대상에 포함하세요.',
        team: 'SCM팀 · 품질기술팀',
      });
    }

    // ─ 모니터링 ─
    const defRateRising = yearStats.length >= 2 &&
      last.defRate > prev.defRate && last.defRate > 1 && last.defRate <= 3;
    if (defRateRising) {
      items.push({
        priority: 'monitor',
        title: `공급사 불량률 상승 추세 — ${prev.year}년 ${prev.defRate}% → ${last.year}년 ${last.defRate}%`,
        detail: `아직 허용 기준(3%) 이하이나 상승하고 있습니다. 이 추세가 지속되면 내년에 기준을 초과할 수 있습니다.`,
        action: '현행 수입검사 체계를 점검하고, 불량률 상승 공급사를 집중 모니터링 대상으로 지정하세요. 분기 말 불량률이 2%를 초과하면 검사 강화를 즉시 적용하세요.',
        team: '품질기술팀 · SCM팀',
      });
    }

    if (last.closeRate >= 70 && last.defRate <= 1 && items.length === 0) {
      items.push({
        priority: 'monitor',
        title: `${last.year}년 품질 지표 목표 달성 — 현수준 유지 권고`,
        detail: `종결률 ${last.closeRate}%·불량률 ${last.defRate}%로 두 핵심 지표 모두 목표 기준을 충족하고 있습니다. ${yearStats.length >= 2 ? `전년(${prev.year}년) 대비 안정적 수준을 유지 중입니다.` : ''}`,
        action: '현행 관리 체계를 유지하면서 연간 목표를 단계적으로 상향(종결률 80%, 불량률 0.5%)하는 것을 검토하세요.',
        team: '품질기술팀',
      });
    }

    return items;
  }, [yearStats]);

  const yearSummaryText = useMemo(() => {
    if (yearStats.length === 0) return '';
    const last = yearStats[yearStats.length - 1];
    const first = yearStats[0];
    const parts = [];
    parts.push(`${first.year}~${last.year}년 ${yearStats.length}개년 데이터 기준, ${last.year}년 고객사 클레임 ${last.cTotal}건, 공급사 불량 ${last.sTotal}건이 접수되었습니다.`);
    if (yearStats.length >= 2) {
      const prev = yearStats[yearStats.length - 2];
      const cDir = last.cTotal > prev.cTotal ? `전년 대비 ${last.cTotal - prev.cTotal}건 증가` : last.cTotal < prev.cTotal ? `전년 대비 ${prev.cTotal - last.cTotal}건 감소` : '전년과 동일';
      parts.push(`클레임 건수는 ${cDir}하였으며, 종결률은 ${last.closeRate >= 70 ? `목표(70%) 달성(${last.closeRate}%)` : `목표(70%) 미달(${last.closeRate}%)`}입니다.`);
    }
    const urgentCnt = yearInsights.filter(i => i.priority === 'urgent').length;
    if (urgentCnt > 0) parts.push(`연도별 추이 분석 결과 즉각적인 조치가 필요한 사항 ${urgentCnt}건이 확인되었습니다.`);
    return parts.join(' ');
  }, [yearStats, yearInsights]);

  if (allYears.length === 0) return (
    <div className="empty"><div className="empty-icon">📊</div>연도별 비교를 위한 데이터가 없습니다</div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* 범위 */}
      <div className="card" style={{ padding:'14px 18px' }}>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:12, color:'#64748b', fontWeight:600 }}>비교 범위</span>
          {[[3,'최근 3년'],[5,'최근 5년'],[0,'전체']].map(([v,label]) => (
            <button key={v} onClick={() => setRange(v)} style={btnStyle(range===v)}>{label}</button>
          ))}
          <span style={{ fontSize:12, color:'#94a3b8', marginLeft:4 }}>
            {displayYears[0]} ~ {displayYears[displayYears.length-1]}년 ({displayYears.length}개년)
          </span>
        </div>
      </div>

      {/* 고객사 클레임 건수 + 공급사 불량 건수 */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div className="card" style={{ padding:'18px 20px' }}>
          <SectionTitle icon="🏢" title="연도별 고객사 클레임" color="#1d4ed8" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={yearStats} margin={{ top:4, right:20, left:-8, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="year" tickFormatter={y=>y+'년'} tick={{ fontSize:11 }} />
              <YAxis tick={{ fontSize:11 }} allowDecimals={false} />
              <Tooltip formatter={v=>[v+'건','클레임']} labelFormatter={l=>l+'년'} />
              <Bar dataKey="cTotal" name="클레임" radius={[6,6,0,0]} maxBarSize={56}
                label={{ position:'top', fontSize:12, fontWeight:700, formatter:v=>v+'건' }}>
                {yearStats.map((_,i)=><Cell key={i} fill={BAR_C[i%BAR_C.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ padding:'18px 20px' }}>
          <SectionTitle icon="🏭" title="연도별 공급사 불량" color="#92400e" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={yearStats} margin={{ top:4, right:20, left:-8, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="year" tickFormatter={y=>y+'년'} tick={{ fontSize:11 }} />
              <YAxis tick={{ fontSize:11 }} allowDecimals={false} />
              <Tooltip formatter={v=>[v+'건','불량']} labelFormatter={l=>l+'년'} />
              <Bar dataKey="sTotal" name="불량" radius={[6,6,0,0]} maxBarSize={56}
                label={{ position:'top', fontSize:12, fontWeight:700, formatter:v=>v+'건' }}>
                {yearStats.map((_,i)=><Cell key={i} fill={i===yearStats.length-1?'#f59e0b':BAR_C[i%BAR_C.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 종결률 + 불량률 추이 */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div className="card" style={{ padding:'18px 20px' }}>
          <SectionTitle icon="✅" title="연도별 종결률 추이" />
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={yearStats} margin={{ top:4, right:20, left:-8, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="year" tickFormatter={y=>y+'년'} tick={{ fontSize:11 }} />
              <YAxis domain={[0,100]} tickFormatter={v=>v+'%'} tick={{ fontSize:11 }} />
              <Tooltip formatter={v=>[v+'%','종결률']} labelFormatter={l=>l+'년'} />
              <Line type="monotone" dataKey="closeRate" stroke={GREEN} strokeWidth={2.5}
                dot={{ r:5, fill:GREEN, stroke:'#fff', strokeWidth:2 }}
                label={{ position:'top', fontSize:11, fontWeight:700, fill:GREEN, formatter:v=>v+'%' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ padding:'18px 20px' }}>
          <SectionTitle icon="📉" title="연도별 불량률 추이" />
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={yearStats} margin={{ top:4, right:20, left:-8, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="year" tickFormatter={y=>y+'년'} tick={{ fontSize:11 }} />
              <YAxis tickFormatter={v=>v+'%'} tick={{ fontSize:11 }} />
              <Tooltip formatter={v=>[v+'%','불량률']} labelFormatter={l=>l+'년'} />
              <Line type="monotone" dataKey="defRate" stroke={AMBER} strokeWidth={2.5}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  const color = payload.defRate > 3 ? RED : payload.defRate > 1 ? AMBER : GREEN;
                  return <circle key={payload.year} cx={cx} cy={cy} r={5} fill={color} stroke="#fff" strokeWidth={2}/>;
                }}
                label={{ position:'top', fontSize:11, fontWeight:700, fill:AMBER, formatter:v=>v+'%' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 연도별 핵심 지표 비교 테이블 */}
      <div className="card" style={{ padding:'18px 20px' }}>
        <SectionTitle icon="📋" title="연도별 핵심 지표 비교" />
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:'2px solid #e2e8f0' }}>
                <th style={{ padding:'10px 12px', textAlign:'left', color:'#64748b', fontWeight:600, fontSize:12, whiteSpace:'nowrap' }}>지표</th>
                {yearStats.map(y=>(
                  <th key={y.year} style={{ padding:'10px 16px', textAlign:'center', color:'#1e293b', fontWeight:700, whiteSpace:'nowrap' }}>{y.year}년</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label:'고객사 클레임', render:(y,p)=><div><span style={{fontWeight:700,fontSize:15}}>{y.cTotal}건</span><div style={{marginTop:2}}><DeltaBadge curr={y} prev={p} _key="cTotal" inverse key="cTotal" /></div></div> },
                { label:'종결률', render:(y,p)=><div><span style={{fontWeight:700,color:y.closeRate>=70?GREEN:y.closeRate>=50?AMBER:RED}}>{y.closeRate}%</span><div style={{marginTop:2}}><DeltaBadge curr={y} prev={p} _key="closeRate" unit="%" key="closeRate" /></div></div> },
                { label:'공급사 불량', render:(y,p)=><div><span style={{fontWeight:700}}>{y.sTotal}건</span><div style={{marginTop:2}}><DeltaBadge curr={y} prev={p} _key="sTotal" inverse key="sTotal" /></div></div> },
                { label:'전체 불량률', render:(y,p)=><div><span style={{fontWeight:700,color:y.defRate>3?RED:y.defRate>1?AMBER:GREEN}}>{y.defRate}%</span><div style={{marginTop:2}}><DeltaBadge curr={y} prev={p} _key="defRate" unit="%" inverse key="defRate" /></div></div> },
                { label:'시정조치 완료율', render:(y)=><span style={{color:y.sDoneRate>=70?GREEN:y.sDoneRate>=40?AMBER:RED,fontWeight:700}}>{y.sDoneRate}%</span> },
                { label:'주요 고객사', render:(y)=>y.topCustomer?<span style={{color:'#1d4ed8',fontWeight:600}}>{y.topCustomer[0]} <span style={{color:'#94a3b8',fontWeight:400}}>({y.topCustomer[1]}건)</span></span>:<span style={{color:'#94a3b8'}}>—</span> },
                { label:'주요 공급사', render:(y)=>y.topSupplier?<span>{y.topSupplier[0]} <span style={{color:'#94a3b8'}}>({y.topSupplier[1]}건)</span></span>:<span style={{color:'#94a3b8'}}>—</span> },
                { label:'주요 원인', render:(y)=>y.topCause?<span style={{color:PURPLE}}>{y.topCause[0]} <span style={{color:'#94a3b8'}}>({y.topCause[1]}건)</span></span>:<span style={{color:'#94a3b8'}}>—</span> },
              ].map(({ label, render }, ri) => (
                <tr key={label} style={{ borderBottom:'1px solid #f1f5f9', background:ri%2===0?'#fff':'#fafafa' }}>
                  <td style={{ padding:'10px 12px', color:'#64748b', fontWeight:600, fontSize:12, whiteSpace:'nowrap' }}>{label}</td>
                  {yearStats.map((y,i)=>(
                    <td key={y.year} style={{ padding:'10px 16px', textAlign:'center', verticalAlign:'middle' }}>
                      {render(y, yearStats[i-1])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 전년도 대비 YoY */}
      {yearStats.length >= 2 && (() => {
        const curr = yearStats[yearStats.length - 1];
        const prev = yearStats[yearStats.length - 2];
        const items = [
          { label:'고객사 클레임', d: curr.cTotal - prev.cTotal, unit:'건', inverse:true, curr:curr.cTotal, prev:prev.cTotal },
          { label:'종결률', d: curr.closeRate - prev.closeRate, unit:'%p', inverse:false, curr:curr.closeRate+'%', prev:prev.closeRate+'%' },
          { label:'공급사 불량', d: curr.sTotal - prev.sTotal, unit:'건', inverse:true, curr:curr.sTotal, prev:prev.sTotal },
          { label:'불량률', d: curr.defRate - prev.defRate, unit:'%p', inverse:true, curr:curr.defRate+'%', prev:prev.defRate+'%' },
        ];
        return (
          <div className="card" style={{ padding:'18px 20px', background:'#f8fafc' }}>
            <SectionTitle icon="💡" title={`전년도 대비 요약 (${prev.year} → ${curr.year})`} />
            <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
              {items.map(({ label, d, unit, inverse, curr: cv, prev: pv }) => {
                const good = inverse ? d <= 0 : d >= 0;
                const neutral = d === 0;
                return (
                  <div key={label} style={{
                    flex:'1 1 200px', padding:'12px 16px', borderRadius:8,
                    background: neutral?'#f8fafc':good?'#f0fdf4':'#fef2f2',
                    border:`1px solid ${neutral?'#e2e8f0':good?'#bbf7d0':'#fecaca'}`,
                    borderLeft:`4px solid ${neutral?'#94a3b8':good?GREEN:RED}`,
                  }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>{label}</div>
                    <div style={{ fontSize:14, fontWeight:700, color:neutral?'#94a3b8':good?GREEN:RED }}>
                      {d === 0 ? '±0' : (d > 0 ? '▲ +' : '▼ ')}{Math.abs(d)}{unit}
                    </div>
                    <div style={{ fontSize:11, color:'#94a3b8', marginTop:3 }}>{pv} → {cv}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* 연도별 종합 인사이트 & Action Required */}
      {yearInsights.length > 0 && (
        <div className="card" style={{ padding: '20px 24px' }}>
          <SectionTitle icon="🎯" title="연도별 종합 인사이트 & Action Required" />

          {yearSummaryText && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', marginBottom: 18, fontSize: 13, lineHeight: 1.75, color: '#334155' }}>
              {yearSummaryText}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {PRIORITY_CONFIG.map(pc => {
              const cnt = yearInsights.filter(i => i.priority === pc.key).length;
              if (!cnt) return null;
              return (
                <span key={pc.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, background: pc.bg, border: `1px solid ${pc.border}`, fontSize: 12, fontWeight: 700, color: pc.color }}>
                  {pc.icon} {pc.label} <span style={{ background: pc.color, color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 11 }}>{cnt}</span>
                </span>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {PRIORITY_CONFIG.map(pc =>
              yearInsights.filter(i => i.priority === pc.key).map((item, idx) => (
                <div key={`${pc.key}-${idx}`} style={{ border: `1.5px solid ${pc.border}`, borderLeft: `4px solid ${pc.color}`, borderRadius: 10, padding: '14px 18px', background: pc.bg }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 16 }}>{pc.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: pc.color, background: '#fff', border: `1px solid ${pc.border}`, borderRadius: 6, padding: '2px 8px' }}>{pc.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{item.title}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: '#475569', marginBottom: 10, lineHeight: 1.6 }}>{item.detail}</div>
                  <div style={{ background: '#fff', border: `1px solid ${pc.border}`, borderRadius: 7, padding: '9px 13px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: pc.color, marginBottom: 4 }}>권고 조치</div>
                    <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>{item.action}</div>
                    <div style={{ marginTop: 6, fontSize: 11, color: '#94a3b8' }}>담당: <strong style={{ color: '#64748b' }}>{item.team}</strong></div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
            <span>비교 범위: {displayYears[0]} ~ {displayYears[displayYears.length-1]}년 ({displayYears.length}개년)</span>
            <span>자동 생성 보고서 · AJW 클레임 트래커</span>
          </div>
        </div>
      )}
    </div>
  );
}
