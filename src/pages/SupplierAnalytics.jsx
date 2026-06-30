import { useMemo, useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useSupplierClaims } from '../context/SupplierClaimsContext';
import { usePrintTitle } from '../context/PrintContext';
import { DISPOSITION_COLORS, PRODUCT_CATEGORIES } from '../lib/supabase';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f97316', '#ef4444', '#06b6d4', '#84cc16', '#ec4899', '#64748b'];
const TABS   = ['공급사별', '품목별', '불량유형별', '품목군별', '처리결과별', '월별 추이'];

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
        <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>🖨️ 인쇄</button>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: '전체',       value: total,     color: '#0f172a' },
          { label: '미결',       value: pending,   color: '#f59e0b' },
          { label: '처리완료',   value: processed, color: '#10b981' },
          { label: '이번달 신규', value: newThis,   color: '#3b82f6' },
        ].map(item => (
          <div key={item.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{item.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: item.color }}>{item.value}건</div>
          </div>
        ))}
      </div>

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
              <ResponsiveContainer width="100%" height={Math.max(180, supplierAnalysis.slice(0,10).length * 36)}>
                <BarChart data={supplierAnalysis.slice(0, 10).map(s => ({ name: s.name, count: s.total }))} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={v => [v + '건', '불량']} />
                  <Bar dataKey="count" fill="#0f766e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
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
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={partAnalysis.slice(0, 10).map(p => ({ name: p.part_name || p.part_number, count: p.total }))} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={v => [v + '건', '불량']} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {partAnalysis.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
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
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={defectTypeAnalysis} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} innerRadius={55} paddingAngle={2}>
                      {defectTypeAnalysis.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v, name) => [`${v}건`, name]} />
                    <Legend iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
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
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={categoryAnalysis.map(c => ({ name: c.name, count: c.total }))} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip formatter={v => [v + '건', '불량']} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {categoryAnalysis.map((_, i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
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
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={dispositionAnalysis} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} innerRadius={55} paddingAngle={2}>
                      {dispositionAnalysis.map(d => {
                        const dc = DISPOSITION_COLORS[d.name] || DISPOSITION_COLORS['미결'];
                        return <Cell key={d.name} fill={dc.text} />;
                      })}
                    </Pie>
                    <Tooltip formatter={(v, name) => [`${v}건`, name]} />
                    <Legend iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
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
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={dispositionAnalysis} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={55} paddingAngle={2}>
                    {dispositionAnalysis.map(d => {
                      const dc = DISPOSITION_COLORS[d.name] || DISPOSITION_COLORS['미결'];
                      return <Cell key={d.name} fill={dc.text} />;
                    })}
                  </Pie>
                  <Tooltip formatter={(v, name) => [v + '건', name]} />
                  <Legend iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
