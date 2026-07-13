import { useMemo, useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { useSupplierClaims } from '../context/SupplierClaimsContext';
import { usePrintTitle } from '../context/PrintContext';
import { DISPOSITION_COLORS, PRODUCT_CATEGORIES } from '../lib/supabase';
import { exportToExcel } from '../lib/exportExcel';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f97316', '#ef4444', '#06b6d4', '#84cc16', '#ec4899', '#64748b'];
const TABS   = ['공급사별', '품목별', '불량유형별', '품목군별', '처리결과별', '월별 추이', '공급사 등급', '불량률 추이', '품목 집중도'];

const truncLabel = (str, max = 16) => !str ? '' : str.length > max ? str.slice(0, max) + '…' : str;
const yAxisW = (data, key = 'name', max = 16) => {
  if (!data?.length) return 80;
  const longest = Math.max(...data.map(d => Math.min((d[key] || '').length, max)));
  return Math.max(longest * 7.5 + 8, 60);
};

function PeriodFilter({ claims, periodType, setPeriodType, selYear, setSelYear, selPeriod, setSelPeriod }) {
  const years = useMemo(() => {
    const s = new Set(claims.map(c => (c.incoming_date || c.created_at || '').slice(0, 4)).filter(Boolean));
    return [...s].sort().reverse();
  }, [claims]);

  const periodOptions = {
    '반기': ['상반기', '하반기'],
    '분기': ['Q1', 'Q2', 'Q3', 'Q4'],
    '월별': ['1','2','3','4','5','6','7','8','9','10','11','12'].map(m => m + '월'),
  };

  const btn = (active) => ({
    padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit', transition: '.12s',
    background: active ? '#0f172a' : '#fff',
    color:      active ? '#fff'    : '#64748b',
    borderColor: active ? '#0f172a' : '#e2e8f0',
  });

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16, padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>기간</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {['전체', '연도', '반기', '분기', '월별'].map(t => (
          <button key={t} style={btn(periodType === t)} onClick={() => { setPeriodType(t); setSelPeriod(''); }}>{t}</button>
        ))}
      </div>
      {periodType !== '전체' && years.length > 0 && (
        <select value={selYear} onChange={e => setSelYear(e.target.value)}
          style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0', fontFamily: 'inherit' }}>
          <option value="">연도 전체</option>
          {years.map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
      )}
      {periodOptions[periodType] && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {periodOptions[periodType].map(p => (
            <button key={p} style={btn(selPeriod === p)} onClick={() => setSelPeriod(prev => prev === p ? '' : p)}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SupplierAnalytics() {
  const { claims, loading } = useSupplierClaims();
  const navigate = useNavigate();
  const { setPrintTitle } = usePrintTitle();

  const [tab,         setTab]         = useState('공급사별');
  const [expandedKey, setExpandedKey] = useState(null);
  const [periodType,  setPeriodType]  = useState('전체');
  const [selYear,     setSelYear]     = useState('');
  const [selPeriod,   setSelPeriod]   = useState('');
  const [cardFilter,  setCardFilter]  = useState(null);

  useEffect(() => {
    let title = 'AJW 공급사 불량 분석';
    if (periodType !== '전체') {
      if (selYear) title += ` — ${selYear}년`;
      if (selPeriod) title += ` ${selPeriod}`;
    }
    setPrintTitle(title);
  }, [periodType, selYear, selPeriod, setPrintTitle]);

  /* 기간 필터 */
  const filteredClaims = useMemo(() => {
    if (periodType === '전체' && !selYear) return claims;
    return claims.filter(c => {
      const date  = c.incoming_date || c.created_at || '';
      const year  = date.slice(0, 4);
      const month = parseInt(date.slice(5, 7)) || 0;
      if (selYear && year !== selYear) return false;
      if (!selPeriod) return true;
      if (periodType === '반기') {
        if (selPeriod === '상반기' && month > 6)  return false;
        if (selPeriod === '하반기' && month <= 6) return false;
      }
      if (periodType === '분기') {
        if (`Q${Math.ceil(month / 3)}` !== selPeriod) return false;
      }
      if (periodType === '월별') {
        if (month !== parseInt(selPeriod)) return false;
      }
      return true;
    });
  }, [claims, periodType, selYear, selPeriod]);

  /* 불량률 헬퍼 */
  const defRate = (c) => {
    const denom = c.inspection_quantity || c.quantity;
    if (!denom || c.defect_quantity == null) return null;
    return (c.defect_quantity / denom * 100).toFixed(1);
  };
  const avgDefRate = (cs) => {
    const rates = cs.map(defRate).filter(r => r !== null).map(Number);
    if (!rates.length) return null;
    return (rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(1);
  };
  const rateColor = (r) => r == null ? '#94a3b8' : parseFloat(r) > 5 ? '#dc2626' : '#059669';

  /* KPI */
  const total     = filteredClaims.length;
  const pending   = filteredClaims.filter(c => !c.disposition).length;
  const processed = filteredClaims.filter(c =>  c.disposition).length;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const newThis   = filteredClaims.filter(c => (c.incoming_date || c.created_at || '').slice(0, 7) === thisMonth).length;

  const cardClaims = useMemo(() => {
    if (!cardFilter) return [];
    if (cardFilter === 'all')       return [...filteredClaims].sort((a, b) => (b.incoming_date || '') > (a.incoming_date || '') ? 1 : -1);
    if (cardFilter === 'pending')   return filteredClaims.filter(c => !c.disposition).sort((a, b) => (b.incoming_date || '') > (a.incoming_date || '') ? 1 : -1);
    if (cardFilter === 'processed') return filteredClaims.filter(c =>  c.disposition).sort((a, b) => (b.incoming_date || '') > (a.incoming_date || '') ? 1 : -1);
    if (cardFilter === 'newThis')   return filteredClaims.filter(c => (c.incoming_date || c.created_at || '').slice(0, 7) === thisMonth);
    return [];
  }, [cardFilter, filteredClaims, thisMonth]);

  /* 공급사별 */
  const supplierAnalysis = useMemo(() => {
    const names = [...new Set(filteredClaims.map(c => c.supplier_name).filter(Boolean))];
    return names.map(name => {
      const cs = filteredClaims.filter(c => c.supplier_name === name);
      const dispCnt    = {};
      const defTypeCnt = {};
      cs.forEach(c => {
        const d = c.disposition || '미결';
        dispCnt[d] = (dispCnt[d] || 0) + 1;
        if (c.defect_type) defTypeCnt[c.defect_type] = (defTypeCnt[c.defect_type] || 0) + 1;
      });
      const topDefType = Object.entries(defTypeCnt).sort(([,a],[,b]) => b-a)[0]?.[0];
      return { name, total: cs.length, pending: cs.filter(c => !c.disposition).length, dispCnt, defTypeCnt, topDefType, avgRate: avgDefRate(cs), claims: cs };
    }).sort((a, b) => b.total - a.total);
  }, [filteredClaims]);

  /* 품목별 */
  const partAnalysis = useMemo(() => {
    const map = {};
    filteredClaims.forEach(c => {
      if (!c.part_number && !c.part_name) return;
      const key = [c.part_number, c.part_name].filter(Boolean).join(' · ');
      if (!map[key]) map[key] = { key, part_number: c.part_number, part_name: c.part_name, claims: [], suppliers: new Set(), defTypeCnt: {} };
      map[key].claims.push(c);
      if (c.supplier_name) map[key].suppliers.add(c.supplier_name);
      if (c.defect_type)   map[key].defTypeCnt[c.defect_type] = (map[key].defTypeCnt[c.defect_type] || 0) + 1;
    });
    return Object.values(map).map(p => ({
      ...p,
      total:      p.claims.length,
      pending:    p.claims.filter(c => !c.disposition).length,
      topDefType: Object.entries(p.defTypeCnt).sort(([,a],[,b]) => b-a)[0]?.[0],
      avgRate:    avgDefRate(p.claims),
      suppliers:  [...p.suppliers],
    })).sort((a, b) => b.total - a.total);
  }, [filteredClaims]);

  /* 불량유형별 */
  const defectTypeAnalysis = useMemo(() => {
    const cnt = {};
    filteredClaims.forEach(c => {
      const t = c.defect_type || '(미분류)';
      cnt[t] = (cnt[t] || 0) + 1;
    });
    return Object.entries(cnt).sort(([,a],[,b]) => b-a).map(([name, value]) => ({ name, value }));
  }, [filteredClaims]);

  /* 품목군별 */
  const categoryAnalysis = useMemo(() => {
    const allCats = [...PRODUCT_CATEGORIES, '(미분류)'];
    return allCats.map(cat => {
      const cs = cat === '(미분류)'
        ? filteredClaims.filter(c => !c.product_category)
        : filteredClaims.filter(c => c.product_category === cat);
      if (!cs.length) return null;
      return { name: cat, total: cs.length, pending: cs.filter(c => !c.disposition).length, avgRate: avgDefRate(cs) };
    }).filter(Boolean);
  }, [filteredClaims]);

  /* 처리결과별 */
  const dispositionAnalysis = useMemo(() => {
    const ORDER = ['사용승인', '반품(대체품)', '재작업', '선별작업', '폐기', '미결'];
    const cnt = {};
    filteredClaims.forEach(c => { const d = c.disposition || '미결'; cnt[d] = (cnt[d] || 0) + 1; });
    return ORDER.filter(d => cnt[d] > 0).map(d => ({ name: d, value: cnt[d] }));
  }, [filteredClaims]);

  /* 월별 추이 */
  const monthlyData = useMemo(() => {
    const map = {};
    filteredClaims.forEach(c => {
      const m = (c.incoming_date || c.created_at || '').slice(0, 7);
      if (m && m.length === 7) map[m] = (map[m] || 0) + 1;
    });
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).slice(-24)
      .map(([month, count]) => ({ month, count }));
  }, [filteredClaims]);

  /* ── 공급사 등급 (A~D) ── */
  const gradeAnalysis = useMemo(() => {
    return supplierAnalysis.map(s => {
      const rate = parseFloat(s.avgRate) || 0;
      const processedCnt = s.claims.filter(c => c.improvement_status && c.improvement_status !== '미조치').length;
      const processedRate = s.claims.length ? Math.round(processedCnt / s.claims.length * 100) : 0;
      let grade, gradeColor;
      if (rate < 1 && processedRate >= 80)      { grade = 'A'; gradeColor = '#10b981'; }
      else if (rate < 3 && processedRate >= 60) { grade = 'B'; gradeColor = '#3b82f6'; }
      else if (rate < 5 && processedRate >= 40) { grade = 'C'; gradeColor = '#f59e0b'; }
      else                                      { grade = 'D'; gradeColor = '#ef4444'; }
      return { ...s, grade, gradeColor, processedRate, defRateNum: rate };
    }).sort((a, b) => a.grade.localeCompare(b.grade) || a.defRateNum - b.defRateNum);
  }, [supplierAnalysis]);

  /* ── 공급사별 월별 불량 발생 추이 (상위 5) ── */
  const defectTrendData = useMemo(() => {
    const top5 = supplierAnalysis.slice(0, 5).map(s => s.name);
    const monthSet = new Set();
    claims.forEach(c => {
      const m = (c.incoming_date || c.created_at || '').slice(0, 7);
      if (m.length === 7) monthSet.add(m);
    });
    const months = [...monthSet].sort().slice(-12);
    const rows = months.map(m => {
      const row = { month: m };
      top5.forEach(name => {
        row[name] = claims.filter(c => c.supplier_name === name && (c.incoming_date || c.created_at || '').startsWith(m)).length;
      });
      return row;
    });
    return { months, top5, rows };
  }, [claims, supplierAnalysis]);

  /* ── 품목별 불량 집중도 (불량수량 기준) ── */
  const partConcentration = useMemo(() => {
    const map = {};
    filteredClaims.forEach(c => {
      if (!c.part_number && !c.part_name) return;
      const key = [c.part_number, c.part_name].filter(Boolean).join(' · ');
      if (!map[key]) map[key] = { name: key, count: 0, defectQty: 0, suppliers: new Set() };
      map[key].count++;
      map[key].defectQty += c.defect_quantity || 0;
      if (c.supplier_name) map[key].suppliers.add(c.supplier_name);
    });
    const items = Object.values(map)
      .map(m => ({ ...m, suppliers: [...m.suppliers], supplierCount: m.suppliers.size }))
      .sort((a, b) => b.defectQty - a.defectQty || b.count - a.count)
      .slice(0, 15);
    const totalDefQty = items.reduce((s, v) => s + v.defectQty, 0);
    let cum = 0;
    return items.map(item => {
      const pct = totalDefQty ? parseFloat((item.defectQty / totalDefQty * 100).toFixed(1)) : 0;
      cum += pct;
      return { ...item, pct, cumPct: parseFloat(cum.toFixed(1)) };
    });
  }, [filteredClaims]);

  if (loading) return <div className="loading">⏳ 불러오는 중...</div>;

  const toggleRow = (key) => setExpandedKey(prev => prev === key ? null : key);
  const thStyle = { textAlign: 'center', fontSize: 11 };

  /* 공급사별 상세 패널 */
  const SupplierDetail = ({ item }) => (
    <tr>
      <td colSpan={6} style={{ padding: 0, background: '#f8fafc' }}>
        <div style={{ padding: '16px 24px', borderTop: '2px solid #e2e8f0' }}>
          <div style={{ display: 'flex', gap: 20, marginBottom: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>처리결과 분포</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(item.dispCnt).sort(([,a],[,b]) => b-a).map(([d, cnt]) => {
                  const dc = DISPOSITION_COLORS[d] || DISPOSITION_COLORS['미결'];
                  return <span key={d} style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: dc.bg, color: dc.text }}>{d} {cnt}건</span>;
                })}
              </div>
            </div>
            {Object.keys(item.defTypeCnt).length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>불량유형 분포</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(item.defTypeCnt).sort(([,a],[,b]) => b-a).map(([t, cnt], i) => (
                    <span key={t} style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: COLORS[i%COLORS.length]+'22', color: COLORS[i%COLORS.length], border: `1px solid ${COLORS[i%COLORS.length]}44` }}>{t} {cnt}건</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>불량 이력 ({item.claims.length}건)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
            {item.claims.map(c => {
              const d = c.disposition || '미결';
              const dc = DISPOSITION_COLORS[d] || DISPOSITION_COLORS['미결'];
              const r = defRate(c);
              return (
                <div key={c.id} onClick={() => { navigate(`/supplier-claims/${c.id}`); setExpandedKey(null); }}
                  style={{ padding: '8px 12px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: '.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: dc.bg, color: dc.text, fontWeight: 600, whiteSpace: 'nowrap' }}>{d}</span>
                  <span style={{ fontSize: 13 }}>{c.part_name || c.part_number || '-'}</span>
                  {c.defect_type && <span style={{ fontSize: 10, background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: 4 }}>{c.defect_type}</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
                    {c.incoming_date || ''}{r ? ` · 불량률 ${r}%` : ''}
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: 11 }}>→</span>
                </div>
              );
            })}
          </div>
        </div>
      </td>
    </tr>
  );

  return (
    <div>
      <div className="page-header no-print">
        <div>
          <div className="page-title">공급사 불량 누적 분석</div>
          <div className="page-sub">공급사·품목·불량유형별 심화 분석</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => {
            const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const rows = filteredClaims.map(c => {
              const denom = c.inspection_quantity || c.quantity;
              const rate = denom && c.defect_quantity != null ? ((c.defect_quantity / denom) * 100).toFixed(1) : '';
              return {
                '입고일': c.incoming_date || '', '입고차수': c.incoming_lot_no || '',
                '공급사': c.supplier_name || '', '구매경로': c.purchase_dept || '',
                '품번': c.part_number || '', '품명': c.part_name || '',
                '품목군': c.product_category || '', '검사단계': c.inspection_stage || '',
                '불량유형': c.defect_type || '', '불량내용': c.defect_description || '',
                '입고수량': c.quantity ?? '', '검사수량': c.inspection_quantity ?? '',
                '불량수량': c.defect_quantity ?? '', '불량률(%)': rate,
                '처리결과': c.disposition || '미결',
                '시정조치상태': c.improvement_status || '미조치',
                '조치유형': c.corrective_action_type || '',
              };
            });
            exportToExcel(rows, `AJW_공급사불량_누적분석_${today}.xlsx`, '누적분석');
          }} disabled={filteredClaims.length === 0}>📥 엑셀 저장</button>
          <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>🖨️ 인쇄</button>
        </div>
      </div>

      <div className="no-print">
        <PeriodFilter
          claims={claims}
          periodType={periodType} setPeriodType={setPeriodType}
          selYear={selYear}       setSelYear={setSelYear}
          selPeriod={selPeriod}   setSelPeriod={setSelPeriod}
        />
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: cardFilter ? 0 : 20 }}>
        {[
          { key: 'all',       label: '전체',       value: total,     color: '#0f172a' },
          { key: 'pending',   label: '미결',        value: pending,   color: '#f59e0b' },
          { key: 'processed', label: '처리완료',    value: processed, color: '#10b981' },
          { key: 'newThis',   label: '이번달 신규', value: newThis,   color: '#3b82f6' },
        ].map(item => {
          const isActive = cardFilter === item.key;
          return (
            <div key={item.key} className="card"
              onClick={() => setCardFilter(prev => prev === item.key ? null : item.key)}
              style={{ textAlign: 'center', cursor: 'pointer', transition: '.15s', outline: isActive ? `2px solid ${item.color}` : 'none', background: isActive ? item.color + '10' : '#fff', userSelect: 'none' }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{item.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: item.color }}>{item.value}건</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{isActive ? '▲ 닫기' : '클릭하여 보기'}</div>
            </div>
          );
        })}
      </div>

      {cardFilter && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="card-title" style={{ margin: 0 }}>
              {{all:'전체', pending:'미결', processed:'처리완료', newThis:'이번달 신규'}[cardFilter]} 불량 ({cardClaims.length}건)
            </div>
            <button onClick={() => setCardFilter(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
          </div>
          {cardClaims.length === 0 ? (
            <div className="empty" style={{ padding: 20 }}>해당 조건의 불량 이력이 없습니다</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
              {cardClaims.map(c => {
                const d = c.disposition || '미결';
                const dc = DISPOSITION_COLORS[d] || DISPOSITION_COLORS['미결'];
                return (
                  <div key={c.id} onClick={() => navigate(`/supplier-claims/${c.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, cursor: 'pointer', border: '1px solid #e2e8f0' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                    onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: dc.bg, color: dc.text, fontWeight: 600, whiteSpace: 'nowrap' }}>{d}</span>
                    <strong style={{ fontSize: 13, minWidth: 80 }}>{c.supplier_name || '-'}</strong>
                    <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{c.part_number || ''}</span>
                    <span style={{ fontSize: 12, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.part_name || ''}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>{c.incoming_date || ''}</span>
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>→</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }} className="no-print">
        {TABS.map(t => (
          <button key={t} onClick={() => { setTab(t); setExpandedKey(null); }} style={{
            padding: '8px 18px', borderRadius: 8, border: '1px solid', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', transition: '.15s', fontFamily: 'inherit',
            background: tab === t ? '#0f172a' : '#fff',
            color:      tab === t ? '#fff'    : '#64748b',
            borderColor: tab === t ? '#0f172a' : '#e2e8f0',
          }}>{t}</button>
        ))}
      </div>

      {/* ── 공급사별 ── */}
      {tab === '공급사별' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">🏭 공급사별 불량 분석 <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>· 행 클릭 시 상세 보기</span></div>
            {supplierAnalysis.length === 0 ? <div className="empty">데이터 없음</div> : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>공급사</th>
                      <th style={thStyle}>총 건수</th>
                      <th style={thStyle}>미결</th>
                      <th>주요 불량유형</th>
                      <th style={thStyle}>평균 불량률</th>
                      <th style={{ width: 20 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierAnalysis.map(item => (
                      <Fragment key={item.name}>
                        <tr className="clickable" onClick={() => toggleRow(item.name)}
                          style={{ background: expandedKey === item.name ? '#f0f9ff' : '' }}>
                          <td><strong>🏭 {item.name}</strong></td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.total}</td>
                          <td style={thStyle}>
                            {item.pending > 0
                              ? <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{item.pending}</span>
                              : <span style={{ color: '#10b981', fontSize: 11 }}>✓ 전처리</span>}
                          </td>
                          <td>
                            {item.topDefType
                              ? <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{item.topDefType}</span>
                              : <span style={{ color: '#cbd5e1' }}>-</span>}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {item.avgRate != null
                              ? <span style={{ fontWeight: 700, color: rateColor(item.avgRate) }}>{item.avgRate}%</span>
                              : '-'}
                          </td>
                          <td style={{ color: '#94a3b8', fontSize: 12 }}>{expandedKey === item.name ? '▲' : '▼'}</td>
                        </tr>
                        {expandedKey === item.name && <SupplierDetail item={item} />}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {supplierAnalysis.length > 0 && (
            <div className="card">
              <div className="card-title">🏭 공급사별 불량 건수</div>
              {(() => {
                const d = supplierAnalysis.slice(0, 10).map(s => ({ name: truncLabel(s.name), count: s.total }));
                return (
                  <ResponsiveContainer width="100%" height={Math.max(d.length * 32 + 20, 160)}>
                    <BarChart data={d} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={yAxisW(d)} />
                      <Tooltip formatter={v => [v + '건', '불량']} />
                      <Bar dataKey="count" fill="#0f766e" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── 품목별 ── */}
      {tab === '품목별' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">🔩 품목별 불량 분석 <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>· 행 클릭 시 상세 보기</span></div>
            {partAnalysis.length === 0 ? <div className="empty">품번/품명 데이터가 없습니다</div> : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>품번</th><th>품명</th>
                      <th style={thStyle}>건수</th>
                      <th style={thStyle}>미결</th>
                      <th>관련 공급사</th>
                      <th>주요 불량유형</th>
                      <th style={thStyle}>평균 불량률</th>
                      <th style={{ width: 20 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {partAnalysis.map(item => (
                      <Fragment key={item.key}>
                        <tr className="clickable" onClick={() => toggleRow(item.key)}
                          style={{ background: expandedKey === item.key ? '#f0f9ff' : '' }}>
                          <td className="mono" style={{ fontSize: 12 }}>{item.part_number || '-'}</td>
                          <td>{item.part_name || '-'}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.total}</td>
                          <td style={thStyle}>
                            {item.pending > 0
                              ? <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{item.pending}</span>
                              : <span style={{ color: '#10b981', fontSize: 11 }}>✓</span>}
                          </td>
                          <td style={{ fontSize: 12, color: '#475569' }}>
                            {item.suppliers.slice(0, 2).join(', ')}{item.suppliers.length > 2 ? ` 외 ${item.suppliers.length - 2}곳` : ''}
                          </td>
                          <td>
                            {item.topDefType
                              ? <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>{item.topDefType}</span>
                              : <span style={{ color: '#cbd5e1' }}>-</span>}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {item.avgRate != null
                              ? <span style={{ fontWeight: 700, color: rateColor(item.avgRate) }}>{item.avgRate}%</span>
                              : '-'}
                          </td>
                          <td style={{ color: '#94a3b8', fontSize: 12 }}>{expandedKey === item.key ? '▲' : '▼'}</td>
                        </tr>
                        {expandedKey === item.key && (
                          <tr>
                            <td colSpan={8} style={{ padding: 0, background: '#f8fafc' }}>
                              <div style={{ padding: '16px 24px', borderTop: '2px solid #e2e8f0' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>불량 이력 ({item.claims.length}건)</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
                                  {item.claims.map(c => {
                                    const d = c.disposition || '미결';
                                    const dc = DISPOSITION_COLORS[d] || DISPOSITION_COLORS['미결'];
                                    return (
                                      <div key={c.id} onClick={() => { navigate(`/supplier-claims/${c.id}`); setExpandedKey(null); }}
                                        style={{ padding: '8px 12px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: '.1s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: dc.bg, color: dc.text, fontWeight: 600 }}>{d}</span>
                                        <strong style={{ fontSize: 13 }}>🏭 {c.supplier_name}</strong>
                                        {c.defect_type && <span style={{ fontSize: 10, background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: 4 }}>{c.defect_type}</span>}
                                        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
                                          {c.incoming_date || ''}{defRate(c) ? ` · ${defRate(c)}%` : ''}
                                        </span>
                                        <span style={{ color: '#94a3b8', fontSize: 11 }}>→</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {partAnalysis.length > 0 && (
            <div className="card">
              <div className="card-title">🔩 품목별 불량 건수 (상위 10)</div>
              {(() => {
                const d = partAnalysis.slice(0, 10).map(p => ({ name: truncLabel(p.part_name || p.part_number), count: p.total }));
                return (
                  <ResponsiveContainer width="100%" height={Math.max(d.length * 32 + 20, 160)}>
                    <BarChart data={d} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={yAxisW(d)} />
                      <Tooltip formatter={v => [v + '건', '불량']} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {partAnalysis.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── 불량유형별 ── */}
      {tab === '불량유형별' && (
        <div>
          {defectTypeAnalysis.length === 0 ? (
            <div className="card"><div className="empty" style={{ padding: 40 }}>데이터 없음</div></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="card">
                <div className="card-title">📊 불량유형별 비율</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: '0 0 200px', height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={defectTypeAnalysis} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={48} paddingAngle={2}>
                          {defectTypeAnalysis.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v, name) => [`${v}건`, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(() => {
                      const tot = defectTypeAnalysis.reduce((s, x) => s + x.value, 0);
                      return defectTypeAnalysis.map((item, i) => {
                        const pct = tot ? Math.round(item.value / tot * 100) : 0;
                        return (
                          <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 13 }}>{item.name}</span>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{item.value}건</span>
                            <span style={{ fontSize: 12, color: '#64748b', minWidth: 44, textAlign: 'right' }}>({pct}%)</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-title">📋 불량유형별 집계</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {defectTypeAnalysis.map((item, i) => {
                    const tot = defectTypeAnalysis.reduce((s, x) => s + x.value, 0);
                    const pct = tot ? Math.round(item.value / tot * 100) : 0;
                    return (
                      <div key={item.name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                          <span style={{ fontWeight: 600 }}>{item.name}</span>
                          <span style={{ color: '#64748b' }}>{item.value}건 ({pct}%)</span>
                        </div>
                        <div style={{ background: '#f1f5f9', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                          <div style={{ background: COLORS[i % COLORS.length], height: '100%', width: `${pct}%`, borderRadius: 4, transition: '.5s' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 공급사 × 불량유형 매트릭스 */}
          {supplierAnalysis.length > 0 && defectTypeAnalysis.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-title">🗂 공급사 × 불량유형 매트릭스</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>공급사</th>
                      {defectTypeAnalysis.map(d => <th key={d.name} style={thStyle}>{d.name}</th>)}
                      <th style={thStyle}>합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierAnalysis.slice(0, 15).map(item => (
                      <tr key={item.name}>
                        <td><strong>{item.name}</strong></td>
                        {defectTypeAnalysis.map(d => (
                          <td key={d.name} style={thStyle}>
                            {(item.defTypeCnt[d.name] || 0) > 0
                              ? <span style={{ fontWeight: 700, color: '#dc2626' }}>{item.defTypeCnt[d.name]}</span>
                              : <span style={{ color: '#e2e8f0' }}>-</span>}
                          </td>
                        ))}
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 품목군별 ── */}
      {tab === '품목군별' && (
        <div>
          {categoryAnalysis.length === 0 ? (
            <div className="card"><div className="empty" style={{ padding: 40 }}>
              <div className="empty-icon">📦</div>품목군 데이터가 없습니다
            </div></div>
          ) : (
            <>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title">📦 품목군별 불량 현황</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                  {categoryAnalysis.map((item, i) => (
                    <div key={item.name} style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 18px', border: `1px solid ${COLORS[i%COLORS.length]}40`, borderLeft: `3px solid ${COLORS[i%COLORS.length]}` }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>{item.name}</div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: COLORS[i%COLORS.length] }}>{item.total}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                        미결 {item.pending}건
                        {item.avgRate != null && <span style={{ marginLeft: 6, color: rateColor(item.avgRate), fontWeight: 600 }}>불량률 {item.avgRate}%</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="card-title">📊 품목군별 불량 건수</div>
                {(() => {
                  const d = categoryAnalysis.map(c => ({ name: truncLabel(c.name, 20), count: c.total }));
                  return (
                    <ResponsiveContainer width="100%" height={Math.max(d.length * 32 + 20, 160)}>
                      <BarChart data={d} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={yAxisW(d, 'name', 20)} />
                        <Tooltip formatter={v => [v + '건', '불량']} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {categoryAnalysis.map((_, i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── 처리결과별 ── */}
      {tab === '처리결과별' && (
        <div>
          {dispositionAnalysis.length === 0 ? (
            <div className="card"><div className="empty" style={{ padding: 40 }}>데이터 없음</div></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="card">
                <div className="card-title">📊 처리결과 분포</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: '0 0 200px', height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={dispositionAnalysis} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={48} paddingAngle={2}>
                          {dispositionAnalysis.map(d => {
                            const dc = DISPOSITION_COLORS[d.name] || DISPOSITION_COLORS['미결'];
                            return <Cell key={d.name} fill={dc.text} />;
                          })}
                        </Pie>
                        <Tooltip formatter={(v, name) => [`${v}건`, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(() => {
                      const tot = dispositionAnalysis.reduce((s, x) => s + x.value, 0);
                      return dispositionAnalysis.map(item => {
                        const pct = tot ? Math.round(item.value / tot * 100) : 0;
                        const dc = DISPOSITION_COLORS[item.name] || DISPOSITION_COLORS['미결'];
                        return (
                          <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: dc.text, flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 13 }}>{item.name}</span>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{item.value}건</span>
                            <span style={{ fontSize: 12, color: '#64748b', minWidth: 44, textAlign: 'right' }}>({pct}%)</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-title">📋 처리결과 집계</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {dispositionAnalysis.map(item => {
                    const tot = dispositionAnalysis.reduce((s, x) => s + x.value, 0);
                    const pct = tot ? Math.round(item.value / tot * 100) : 0;
                    const dc = DISPOSITION_COLORS[item.name] || DISPOSITION_COLORS['미결'];
                    return (
                      <div key={item.name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                          <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: dc.bg, color: dc.text }}>{item.name}</span>
                          <span style={{ color: '#64748b' }}>{item.value}건 ({pct}%)</span>
                        </div>
                        <div style={{ background: '#f1f5f9', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                          <div style={{ background: dc.text, height: '100%', width: `${pct}%`, borderRadius: 4, transition: '.5s' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {supplierAnalysis.length > 0 && dispositionAnalysis.length > 0 && (
            <div className="card">
              <div className="card-title">🗂 공급사 × 처리결과 매트릭스</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>공급사</th>
                      {dispositionAnalysis.map(d => <th key={d.name} style={thStyle}>{d.name}</th>)}
                      <th style={thStyle}>합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierAnalysis.slice(0, 15).map(item => (
                      <tr key={item.name}>
                        <td><strong>{item.name}</strong></td>
                        {dispositionAnalysis.map(d => (
                          <td key={d.name} style={thStyle}>
                            {(item.dispCnt[d.name] || 0) > 0
                              ? <span style={{ fontWeight: 700, color: (DISPOSITION_COLORS[d.name]||DISPOSITION_COLORS['미결']).text }}>{item.dispCnt[d.name]}</span>
                              : <span style={{ color: '#e2e8f0' }}>-</span>}
                          </td>
                        ))}
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 공급사 등급 탭 ── */}
      {tab === '공급사 등급' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 등급 기준 설명 */}
          <div className="card" style={{ background: '#f8fafc' }}>
            <div className="card-title">📐 등급 산정 기준</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[
                { grade: 'A', color: '#10b981', bg: '#f0fdf4', desc: '불량률 < 1% + 시정조치율 ≥ 80%' },
                { grade: 'B', color: '#3b82f6', bg: '#eff6ff', desc: '불량률 < 3% + 시정조치율 ≥ 60%' },
                { grade: 'C', color: '#f59e0b', bg: '#fffbeb', desc: '불량률 < 5% + 시정조치율 ≥ 40%' },
                { grade: 'D', color: '#ef4444', bg: '#fef2f2', desc: '위 기준 미달 — 집중 관리 필요' },
              ].map(g => (
                <div key={g.grade} style={{ background: g.bg, borderRadius: 10, padding: '12px 16px', borderLeft: `4px solid ${g.color}` }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: g.color, marginBottom: 4 }}>등급 {g.grade}</div>
                  <div style={{ fontSize: 12, color: '#374151' }}>{g.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 등급 분포 요약 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {['A','B','C','D'].map((g, gi) => {
              const cnt = gradeAnalysis.filter(s => s.grade === g).length;
              const colors = ['#10b981','#3b82f6','#f59e0b','#ef4444'];
              return (
                <div key={g} className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>등급 {g}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: colors[gi] }}>{cnt}개사</div>
                </div>
              );
            })}
          </div>

          {/* 등급 테이블 */}
          <div className="card">
            <div className="card-title">🏭 공급사별 등급 현황 <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>· 등급순 정렬</span></div>
            {gradeAnalysis.length === 0 ? <div className="empty">데이터 없음</div> : (
              <div className="table-wrap">
                <table style={{ fontSize: 12 }}>
                  <thead>
                    <tr><th>공급사</th><th style={{ textAlign: 'center' }}>등급</th><th style={{ textAlign: 'center' }}>총 건수</th><th style={{ textAlign: 'center' }}>평균 불량률</th><th style={{ textAlign: 'center' }}>시정조치율</th><th style={{ textAlign: 'center' }}>미결</th></tr>
                  </thead>
                  <tbody>
                    {gradeAnalysis.map(s => (
                      <tr key={s.name}>
                        <td><strong>🏭 {s.name}</strong></td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 900, fontSize: 15, color: s.gradeColor }}>★ {s.grade}</span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.total}</td>
                        <td style={{ textAlign: 'center' }}>
                          {s.avgRate != null
                            ? <span style={{ fontWeight: 700, color: rateColor(s.avgRate) }}>{s.avgRate}%</span>
                            : <span style={{ color: '#94a3b8' }}>-</span>}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, color: s.processedRate >= 70 ? '#10b981' : s.processedRate >= 40 ? '#f59e0b' : '#ef4444' }}>{s.processedRate}%</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {s.pending > 0
                            ? <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{s.pending}</span>
                            : <span style={{ color: '#10b981' }}>✓</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 불량률 추이 탭 ── */}
      {tab === '불량률 추이' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-title">📈 공급사별 월별 불량 발생 추이 <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>· 상위 5개사, 최근 12개월</span></div>
            {defectTrendData.rows.length === 0 || defectTrendData.top5.length === 0 ? (
              <div className="empty">데이터 없음</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={defectTrendData.rows} margin={{ top: 4, right: 20, bottom: 4, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip formatter={(v, name) => [v + '건', name]} />
                    <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                    {defectTrendData.top5.map((name, i) => (
                      <Line key={name} type="monotone" dataKey={name} stroke={COLORS[i]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>최근 월 현황</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {defectTrendData.top5.map((name, i) => {
                      const lastRow = defectTrendData.rows[defectTrendData.rows.length - 1];
                      const prevRow = defectTrendData.rows[defectTrendData.rows.length - 2];
                      const curr = lastRow?.[name] ?? 0;
                      const prev = prevRow?.[name] ?? 0;
                      const delta = curr - prev;
                      return (
                        <div key={name} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', border: `1px solid ${COLORS[i]}40`, borderLeft: `3px solid ${COLORS[i]}` }}>
                          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{name}</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS[i] }}>{curr}건</div>
                          {delta !== 0 && <div style={{ fontSize: 11, color: delta > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta)}건 전월비</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 월별 공급사 분포 */}
          <div className="card">
            <div className="card-title">📊 상위 5개사 월별 건수 비교</div>
            {defectTrendData.rows.length === 0 ? <div className="empty">데이터 없음</div> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={defectTrendData.rows} margin={{ top: 4, right: 20, bottom: 4, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  {defectTrendData.top5.map((name, i) => (
                    <Bar key={name} dataKey={name} stackId="a" fill={COLORS[i]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ── 품목 집중도 탭 ── */}
      {tab === '품목 집중도' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 상위 집중도 요약 */}
          {partConcentration.length > 0 && (() => {
            const total = partConcentration.reduce((s, v) => s + v.defectQty, 0);
            const top3 = partConcentration.slice(0, 3);
            const top3pct = top3.reduce((s, v) => s + v.pct, 0).toFixed(0);
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <div className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>총 불량 수량</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{total.toLocaleString()}EA</div>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>집중 품목 수</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#8b5cf6' }}>{partConcentration.length}개</div>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>상위 3 품목 집중도</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: top3pct >= 70 ? '#ef4444' : '#f59e0b' }}>{top3pct}%</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>파레토 집중 구간</div>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>최다 불량 품목</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', wordBreak: 'break-all' }}>{truncLabel(partConcentration[0]?.name || '-', 18)}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{partConcentration[0]?.defectQty || 0}EA</div>
                </div>
              </div>
            );
          })()}

          {/* 불량수량 집중도 바 차트 */}
          <div className="card">
            <div className="card-title">📊 품목별 불량 수량 집중도 (상위 15품목) <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>· 수량 기준 정렬</span></div>
            {partConcentration.length === 0 ? <div className="empty">데이터 없음</div> : (
              <ResponsiveContainer width="100%" height={Math.max(partConcentration.length * 36 + 20, 200)}>
                <BarChart data={partConcentration.map(p => ({ name: truncLabel(p.name, 20), defectQty: p.defectQty, pct: p.pct, count: p.count }))} layout="vertical" margin={{ top: 4, right: 80, bottom: 4, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={yAxisW(partConcentration.map(p => ({ name: truncLabel(p.name, 20) })), 'name', 20)} />
                  <Tooltip formatter={(v, k) => [k === 'defectQty' ? v + 'EA' : v + '건', k === 'defectQty' ? '불량 수량' : '발생 건수']} />
                  <Bar dataKey="defectQty" name="불량 수량" radius={[0, 4, 4, 0]}
                    label={{ position: 'right', fontSize: 10, formatter: v => v > 0 ? v.toLocaleString() + 'EA' : '' }}>
                    {partConcentration.map((d, i) => (
                      <Cell key={i} fill={d.cumPct <= 50 ? '#ef4444' : d.cumPct <= 80 ? '#f59e0b' : '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <div style={{ marginTop: 8, fontSize: 11, color: '#64748b', display: 'flex', gap: 12 }}>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#ef4444', borderRadius: 2, marginRight: 4 }} />누적 상위 50%</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#f59e0b', borderRadius: 2, marginRight: 4 }} />누적 50~80%</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#94a3b8', borderRadius: 2, marginRight: 4 }} />누적 하위 20%</span>
            </div>
          </div>

          {/* 품목 집중도 테이블 */}
          <div className="card">
            <div className="card-title">📋 품목별 집중도 상세</div>
            {partConcentration.length === 0 ? <div className="empty">데이터 없음</div> : (
              <div className="table-wrap">
                <table style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center', width: 36 }}>#</th>
                      <th>품목</th>
                      <th style={{ textAlign: 'center' }}>발생 건수</th>
                      <th style={{ textAlign: 'center' }}>불량 수량</th>
                      <th style={{ textAlign: 'center' }}>비중</th>
                      <th style={{ textAlign: 'center' }}>누적</th>
                      <th style={{ textAlign: 'center' }}>공급사 수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partConcentration.map((item, i) => (
                      <tr key={item.name} style={{ background: item.cumPct <= 50 ? '#fff5f5' : item.cumPct <= 80 ? '#fffbeb' : '#fff' }}>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#94a3b8' }}>{i + 1}</td>
                        <td><strong>{item.name}</strong></td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.count}건</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: item.defectQty > 0 ? '#ef4444' : '#94a3b8' }}>{item.defectQty.toLocaleString()}EA</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                            <div style={{ width: 48, height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${item.pct}%`, height: '100%', background: item.cumPct <= 50 ? '#ef4444' : '#f59e0b', borderRadius: 3 }} />
                            </div>
                            <span style={{ fontWeight: 600 }}>{item.pct}%</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, color: item.cumPct <= 80 ? '#ef4444' : '#64748b' }}>{item.cumPct}%</span>
                        </td>
                        <td style={{ textAlign: 'center', color: '#64748b' }}>{item.supplierCount}개사</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 월별 추이 ── */}
      {tab === '월별 추이' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-title">📅 월별 불량 접수 추이 <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>(최대 24개월)</span></div>
            {monthlyData.length === 0 ? (
              <div className="empty" style={{ padding: 40 }}>데이터 없음</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 4, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={v => [v + '건', '불량']} />
                  <Bar dataKey="count" fill="#0f766e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          {dispositionAnalysis.length > 0 && (
            <div className="card">
              <div className="card-title">📍 처리결과 현황</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: '0 0 200px', height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={dispositionAnalysis} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={48} paddingAngle={2}>
                        {dispositionAnalysis.map(d => {
                          const dc = DISPOSITION_COLORS[d.name] || DISPOSITION_COLORS['미결'];
                          return <Cell key={d.name} fill={dc.text} />;
                        })}
                      </Pie>
                      <Tooltip formatter={(v, name) => [v + '건', name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(() => {
                    const tot = dispositionAnalysis.reduce((s, x) => s + x.value, 0);
                    return dispositionAnalysis.map(item => {
                      const pct = tot ? Math.round(item.value / tot * 100) : 0;
                      const dc = DISPOSITION_COLORS[item.name] || DISPOSITION_COLORS['미결'];
                      return (
                        <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: dc.text, flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 13 }}>{item.name}</span>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{item.value}건</span>
                          <span style={{ fontSize: 12, color: '#64748b', minWidth: 44, textAlign: 'right' }}>({pct}%)</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
