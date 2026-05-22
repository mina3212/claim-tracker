import { useMemo, useState, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useClaims } from '../context/ClaimsContext';
import { useAuth } from '../context/AuthContext';
import StageBadge from '../components/StageBadge';
import { STAGES, STAGE_COLORS, CUSTOMER_GROUPS, PRODUCT_TYPES } from '../lib/supabase';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f97316', '#ef4444', '#06b6d4', '#84cc16', '#ec4899', '#64748b'];
const CAUSE_OPTIONS = ['사용자 과실', '생산공정', '제품불량', '구조불량', '배송오류', '기타'];
const TABS = ['고객사별', '품목별', '그룹별', '원인별', '월별 추이'];

function parseCauses(description) {
  if (!description) return [];
  const m = description.match(/\[원인\]\s*([^\n]+)/);
  if (!m) return [];
  return m[1].split(',').map(c => c.trim().replace(/\(.*\)/g, '').trim()).filter(Boolean);
}

function getInsightText({ total, closeRate, topCause, topPart, topCustomer }) {
  const parts = [];
  if (total === 0) return '데이터 없음';
  if (closeRate === 100) parts.push('모든 클레임 종결 ✅');
  else if (closeRate >= 70) parts.push(`종결율 ${closeRate}%`);
  else if (closeRate < 30 && total >= 2) parts.push(`⚠️ 미처리 주의 (종결 ${closeRate}%)`);
  else parts.push(`종결율 ${closeRate}%`);
  if (topCause) parts.push(`주요 원인: ${topCause}`);
  if (topPart) parts.push(`최다 품목: ${topPart}`);
  if (topCustomer) parts.push(`최다 고객사: ${topCustomer}`);
  return parts.join(' · ');
}

/* ── 기간 필터 컨트롤 ── */
function PeriodFilter({ claims, periodType, setPeriodType, selYear, setSelYear, selPeriod, setSelPeriod }) {
  const years = useMemo(() => {
    const s = new Set(claims.map(c => (c.receipt_date || c.created_at || '').slice(0, 4)).filter(Boolean));
    return [...s].sort().reverse();
  }, [claims]);

  const periodOptions = {
    '반기': ['상반기', '하반기'],
    '분기': ['Q1', 'Q2', 'Q3', 'Q4'],
    '월별': ['1','2','3','4','5','6','7','8','9','10','11','12'].map(m => m + '월'),
  };

  const btnStyle = (active) => ({
    padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit',
    background: active ? '#0f172a' : '#fff',
    color: active ? '#fff' : '#64748b',
    borderColor: active ? '#0f172a' : '#e2e8f0',
    transition: '.12s',
  });

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16, padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>기간</span>

      {/* 기간 유형 */}
      <div style={{ display: 'flex', gap: 4 }}>
        {['전체', '연도', '반기', '분기', '월별'].map(t => (
          <button key={t} style={btnStyle(periodType === t)} onClick={() => { setPeriodType(t); setSelPeriod(''); }}>
            {t}
          </button>
        ))}
      </div>

      {/* 연도 선택 */}
      {periodType !== '전체' && years.length > 0 && (
        <select
          value={selYear}
          onChange={e => setSelYear(e.target.value)}
          style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0', fontFamily: 'inherit' }}
        >
          <option value="">연도 전체</option>
          {years.map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
      )}

      {/* 하위 기간 */}
      {periodOptions[periodType] && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {periodOptions[periodType].map(p => (
            <button key={p} style={btnStyle(selPeriod === p)} onClick={() => setSelPeriod(prev => prev === p ? '' : p)}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 확장 상세 패널 (고객사/품목 공통) ── */
function ExpandPanel({ item, type, causesByClaimId, navigate, setExpandedKey }) {
  return (
    <tr>
      <td colSpan={20} style={{ padding: 0, background: '#f8fafc' }}>
        <div style={{ padding: '16px 24px', borderTop: '2px solid #e2e8f0' }}>
          {/* 원인 분포 */}
          {Object.keys(item.causeCnt || {}).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>원인 분포</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(item.causeCnt).sort(([,a],[,b]) => b-a).map(([cause, cnt], i) => (
                  <span key={cause} style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: COLORS[i % COLORS.length] + '20', color: COLORS[i % COLORS.length],
                    border: `1px solid ${COLORS[i % COLORS.length]}40`,
                  }}>{cause} {cnt}건</span>
                ))}
              </div>
            </div>
          )}

          {/* 품목 분포 (고객사) */}
          {type === 'customer' && Object.keys(item.partCnt || {}).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>관련 품목</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(item.partCnt).sort(([,a],[,b]) => b-a).slice(0, 6).map(([part, cnt]) => (
                  <span key={part} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, background: '#f1f5f9', color: '#475569' }}>
                    🔩 {part} ({cnt}건)
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 고객사 분포 (품목) */}
          {type === 'part' && (item.customers || []).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>관련 고객사</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {item.customers.map(c => (
                  <span key={c} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, background: '#f1f5f9', color: '#475569' }}>
                    🏢 {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 클레임 목록 */}
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>클레임 목록 ({item.claims.length}건)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
            {item.claims.map(c => (
              <div
                key={c.id}
                onClick={() => { navigate(`/claims/${c.id}`); setExpandedKey(null); }}
                style={{
                  padding: '8px 12px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: '.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <StageBadge stage={c.current_stage} size="sm" />
                <strong style={{ fontSize: 13 }}>{c.customer_name}</strong>
                {causesByClaimId[c.id]?.length > 0 && (
                  <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 4 }}>
                    {causesByClaimId[c.id][0]}
                  </span>
                )}
                <span style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>
                  {c.receipt_date || ''}{c.part_number ? ` · ${c.part_number}` : ''}{c.part_name ? ` ${c.part_name}` : ''}
                </span>
                <span style={{ color: '#94a3b8', fontSize: 11 }}>→</span>
              </div>
            ))}
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function Analytics() {
  const { claims, stages, loading } = useClaims();
  const { department } = useAuth();
  const navigate = useNavigate();
  const isQualityTeam = department === '품질기술팀';

  const [tab, setTab] = useState('고객사별');
  const [expandedKey, setExpandedKey] = useState(null);

  /* ── 기간 필터 상태 ── */
  const [periodType, setPeriodType] = useState('전체');
  const [selYear,    setSelYear]    = useState('');
  const [selPeriod,  setSelPeriod]  = useState('');

  /* ── 기간 필터 적용 ── */
  const filteredClaims = useMemo(() => {
    if (periodType === '전체' && !selYear) return claims;
    return claims.filter(c => {
      const date  = c.receipt_date || c.created_at || '';
      const year  = date.slice(0, 4);
      const month = parseInt(date.slice(5, 7)) || 0;
      if (selYear && year !== selYear) return false;
      if (!selPeriod) return true;
      if (periodType === '반기') {
        if (selPeriod === '상반기' && month > 6) return false;
        if (selPeriod === '하반기' && month <= 6) return false;
      }
      if (periodType === '분기') {
        const quarter = Math.ceil(month / 3);
        if (`Q${quarter}` !== selPeriod) return false;
      }
      if (periodType === '월별') {
        const selM = parseInt(selPeriod);
        if (month !== selM) return false;
      }
      return true;
    });
  }, [claims, periodType, selYear, selPeriod]);

  /* ── 원인 파싱 ── */
  const causesByClaimId = useMemo(() => {
    const map = {};
    stages.forEach(s => {
      if (s.description && s.description.includes('[원인]')) {
        map[s.claim_id] = parseCauses(s.description);
      }
    });
    return map;
  }, [stages]);

  /* ── 분석 공통 헬퍼 ── */
  function buildGroupStats(groupClaims) {
    const total    = groupClaims.length;
    const closed   = groupClaims.filter(c => c.current_stage === '종결').length;
    const closeRate = total ? Math.round(closed / total * 100) : 0;
    const causeCnt = {};
    groupClaims.forEach(c => {
      (causesByClaimId[c.id] || []).forEach(cause => {
        causeCnt[cause] = (causeCnt[cause] || 0) + 1;
      });
    });
    const topCause = Object.entries(causeCnt).sort(([,a],[,b]) => b-a)[0]?.[0];
    const stageCnts = Object.fromEntries(STAGES.map(s => [s, groupClaims.filter(c => c.current_stage === s).length]));
    return { total, closed, closeRate, causeCnt, topCause, stageCnts };
  }

  /* ── 고객사별 분석 ── */
  const customerAnalysis = useMemo(() => {
    const names = [...new Set(filteredClaims.map(c => c.customer_name).filter(Boolean))];
    return names.map(name => {
      const cs = filteredClaims.filter(c => c.customer_name === name);
      const stats = buildGroupStats(cs);
      const partCnt = {};
      cs.forEach(c => {
        const k = [c.part_number, c.part_name].filter(Boolean).join(' ');
        if (k) partCnt[k] = (partCnt[k] || 0) + 1;
      });
      const topPart = Object.entries(partCnt).sort(([,a],[,b]) => b-a)[0]?.[0];
      return { name, ...stats, partCnt, topPart, claims: cs };
    }).sort((a, b) => b.total - a.total);
  }, [filteredClaims, causesByClaimId]);

  /* ── 품목별 분석 ── */
  const partAnalysis = useMemo(() => {
    const map = {};
    filteredClaims.forEach(c => {
      if (!c.part_number && !c.part_name) return;
      const key = [c.part_number, c.part_name].filter(Boolean).join(' · ');
      if (!map[key]) map[key] = { key, part_number: c.part_number, part_name: c.part_name, claims: [], customers: new Set(), causeCnt: {} };
      map[key].claims.push(c);
      if (c.customer_name) map[key].customers.add(c.customer_name);
      (causesByClaimId[c.id] || []).forEach(cause => {
        map[key].causeCnt[cause] = (map[key].causeCnt[cause] || 0) + 1;
      });
    });
    return Object.values(map).map(p => {
      const stats = buildGroupStats(p.claims);
      const topCustomer = (() => {
        const cnt = {};
        p.claims.forEach(c => { if (c.customer_name) cnt[c.customer_name] = (cnt[c.customer_name] || 0) + 1; });
        return Object.entries(cnt).sort(([,a],[,b]) => b-a)[0]?.[0];
      })();
      return { ...p, ...stats, topCustomer, customers: [...p.customers] };
    }).sort((a, b) => b.total - a.total);
  }, [filteredClaims, causesByClaimId]);

  /* ── 그룹별 분석 ── */
  const groupAnalysis = useMemo(() => {
    const allGroups = [...CUSTOMER_GROUPS, '(미분류)'];
    return allGroups.map(group => {
      const cs = group === '(미분류)'
        ? filteredClaims.filter(c => !c.customer_group)
        : filteredClaims.filter(c => c.customer_group === group);
      if (cs.length === 0) return null;
      const stats = buildGroupStats(cs);
      const partCnt = {};
      cs.forEach(c => {
        const k = [c.part_number, c.part_name].filter(Boolean).join(' ');
        if (k) partCnt[k] = (partCnt[k] || 0) + 1;
      });
      const customerCnt = {};
      cs.forEach(c => { if (c.customer_name) customerCnt[c.customer_name] = (customerCnt[c.customer_name] || 0) + 1; });
      const typeCnt = {};
      cs.forEach(c => { if (c.product_type) typeCnt[c.product_type] = (typeCnt[c.product_type] || 0) + 1; });
      const topPart = Object.entries(partCnt).sort(([,a],[,b]) => b-a)[0]?.[0];
      return { name: group, ...stats, partCnt, customerCnt, typeCnt, topPart, claims: cs };
    }).filter(Boolean);
  }, [filteredClaims, causesByClaimId]);

  /* ── 원인별 집계 ── */
  const causeAnalysis = useMemo(() => {
    const total = {};
    CAUSE_OPTIONS.forEach(c => { total[c] = 0; });
    filteredClaims.forEach(c => {
      (causesByClaimId[c.id] || []).forEach(cause => {
        const key = CAUSE_OPTIONS.find(o => cause.startsWith(o.replace('기타', '기타'))) || cause;
        if (key) total[key] = (total[key] || 0) + 1;
      });
    });
    return Object.entries(total).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));
  }, [filteredClaims, causesByClaimId]);

  /* ── 월별 데이터 ── */
  const monthlyData = useMemo(() => {
    const map = {};
    filteredClaims.forEach(c => {
      const m = (c.receipt_date || c.created_at || '').slice(0, 7);
      if (m && m.length === 7) map[m] = (map[m] || 0) + 1;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-24)
      .map(([month, count]) => ({ month, count }));
  }, [filteredClaims]);

  /* ── 요약 KPI ── */
  const total     = filteredClaims.length;
  const active    = filteredClaims.filter(c => c.current_stage !== '종결').length;
  const closed    = filteredClaims.filter(c => c.current_stage === '종결').length;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const newThis   = filteredClaims.filter(c => (c.receipt_date || c.created_at || '').slice(0, 7) === thisMonth).length;

  if (loading) return <div className="loading">⏳ 불러오는 중...</div>;

  /* ── 행 클릭 토글 ── */
  const toggleRow = (key) => setExpandedKey(prev => prev === key ? null : key);

  /* ── 인쇄 ── */
  const handlePrint = () => window.print();

  /* ── 엑셀 내보내기 ── */
  const handleExcel = () => {
    const wb = XLSX.utils.book_new();

    // 전체 클레임 시트
    const claimRows = filteredClaims.map(c => ({
      '접수일': c.receipt_date || '',
      '고객사그룹': c.customer_group || '',
      '고객사명': c.customer_name || '',
      '품번': c.part_number || '',
      '품명': c.part_name || '',
      '품목유형': c.product_type || '',
      '수량': c.quantity ?? '',
      'LOT번호': c.lot_number || '',
      '불량내용': c.defect_description || '',
      '현재단계': c.current_stage || '',
      '영업담당': c.sales_rep_name || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(claimRows), '전체클레임');

    // 고객사별 시트
    const custRows = customerAnalysis.map(a => ({
      '고객사': a.name,
      '전체': a.total,
      '종결': a.closed,
      '종결율(%)': a.closeRate,
      '주요원인': a.topCause || '',
      '최다품목': a.topPart || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(custRows), '고객사별');

    // 그룹별 시트
    const grpRows = groupAnalysis.map(a => ({
      '그룹': a.name,
      '전체': a.total,
      '종결': a.closed,
      '종결율(%)': a.closeRate,
      '주요원인': a.topCause || '',
      '최다품목': a.topPart || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(grpRows), '그룹별');

    const dateTag = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `클레임분석_${dateTag}.xlsx`);
  };

  /* ── 공통 테이블 헤더 스타일 ── */
  const thStyle = { textAlign: 'center', fontSize: 11 };
  const closeColor = (rate) => rate === 100 ? '#10b981' : rate >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 11px; }
          .card { box-shadow: none; border: 1px solid #e2e8f0; break-inside: avoid; }
        }
      `}</style>

      {/* 페이지 헤더 */}
      <div className="page-header no-print">
        <div>
          <div className="page-title">누적 분석</div>
          <div className="page-sub">클레임 현황 및 품목·고객사·원인별 심화 분석</div>
        </div>

        {/* 품질기술팀 전용 버튼 */}
        {isQualityTeam && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={handlePrint} title="인쇄">🖨️ 인쇄</button>
            <button className="btn btn-ghost btn-sm" onClick={handlePrint} title="PDF로 저장 (인쇄 창에서 PDF 선택)">📄 PDF 저장</button>
            <button className="btn btn-ghost btn-sm" onClick={handleExcel} title="엑셀 다운로드">📊 엑셀 저장</button>
          </div>
        )}
      </div>

      {/* 기간 필터 */}
      <div className="no-print">
        <PeriodFilter
          claims={claims}
          periodType={periodType} setPeriodType={setPeriodType}
          selYear={selYear} setSelYear={setSelYear}
          selPeriod={selPeriod} setSelPeriod={setSelPeriod}
        />
      </div>

      {/* Summary KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: '전체', value: total, color: '#0f172a' },
          { label: '처리 중', value: active, color: '#f59e0b' },
          { label: '종결 완료', value: closed, color: '#10b981' },
          { label: '이번달 신규', value: newThis, color: '#3b82f6' },
        ].map(item => (
          <div key={item.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{item.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: item.color }}>{item.value}건</div>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }} className="no-print">
        {TABS.map(t => (
          <button key={t} onClick={() => { setTab(t); setExpandedKey(null); }} style={{
            padding: '8px 18px', borderRadius: 8, border: '1px solid', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', transition: '.15s', fontFamily: 'inherit',
            background: tab === t ? '#0f172a' : '#fff',
            color: tab === t ? '#fff' : '#64748b',
            borderColor: tab === t ? '#0f172a' : '#e2e8f0',
          }}>{t}</button>
        ))}
      </div>

      {/* ── 고객사별 탭 ── */}
      {tab === '고객사별' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">🏢 고객사별 클레임 분석 <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>· 행 클릭 시 상세 보기</span></div>
            {customerAnalysis.length === 0 ? <div className="empty">데이터 없음</div> : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>고객사</th>
                      {STAGES.map(s => <th key={s} style={thStyle}>{s}</th>)}
                      <th style={thStyle}>합계</th>
                      <th style={thStyle}>종결율</th>
                      <th>인사이트</th>
                      <th style={{ width: 20 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerAnalysis.map(item => (
                      <Fragment key={item.name}>
                        <tr className="clickable" onClick={() => toggleRow(item.name)}
                          style={{ background: expandedKey === item.name ? '#f0f9ff' : '' }}>
                          <td><strong>{item.name}</strong></td>
                          {STAGES.map(s => (
                            <td key={s} style={thStyle}>
                              {item.stageCnts[s] > 0
                                ? <span className="stage-badge" style={{ background: STAGE_COLORS[s]?.bg, color: STAGE_COLORS[s]?.text }}>{item.stageCnts[s]}</span>
                                : <span style={{ color: '#e2e8f0' }}>-</span>}
                            </td>
                          ))}
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.total}</td>
                          <td style={thStyle}><span style={{ fontWeight: 700, color: closeColor(item.closeRate) }}>{item.closeRate}%</span></td>
                          <td style={{ fontSize: 11, color: '#64748b', maxWidth: 180 }}>{getInsightText({ total: item.total, closeRate: item.closeRate, topCause: item.topCause, topPart: item.topPart })}</td>
                          <td style={{ color: '#94a3b8', fontSize: 12 }}>{expandedKey === item.name ? '▲' : '▼'}</td>
                        </tr>
                        {expandedKey === item.name && (
                          <ExpandPanel item={item} type="customer" causesByClaimId={causesByClaimId} navigate={navigate} setExpandedKey={setExpandedKey} />
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {customerAnalysis.length > 0 && (
            <div className="card">
              <div className="card-title">🏢 고객사별 클레임 건수</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={customerAnalysis.slice(0, 10).map(c => ({ name: c.name, count: c.total }))} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip formatter={v => [v + '건', '클레임']} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── 품목별 탭 ── */}
      {tab === '품목별' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">🔩 품목별 클레임 분석 <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>· 행 클릭 시 상세 보기</span></div>
            {partAnalysis.length === 0 ? <div className="empty">품번/품명이 입력된 클레임이 없습니다</div> : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>품번</th><th>품명</th>
                      <th style={thStyle}>건수</th><th style={thStyle}>종결율</th>
                      <th>관련 고객사</th><th>주요 원인</th><th>인사이트</th>
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
                          <td style={thStyle}><span style={{ fontWeight: 700, color: closeColor(item.closeRate) }}>{item.closeRate}%</span></td>
                          <td style={{ fontSize: 12, color: '#475569' }}>
                            {item.customers.slice(0, 2).join(', ')}{item.customers.length > 2 ? ` 외 ${item.customers.length - 2}곳` : ''}
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {item.topCause
                              ? <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>{item.topCause}</span>
                              : <span style={{ color: '#cbd5e1' }}>-</span>}
                          </td>
                          <td style={{ fontSize: 11, color: '#64748b', maxWidth: 160 }}>{getInsightText({ total: item.total, closeRate: item.closeRate, topCause: item.topCause, topCustomer: item.topCustomer })}</td>
                          <td style={{ color: '#94a3b8', fontSize: 12 }}>{expandedKey === item.key ? '▲' : '▼'}</td>
                        </tr>
                        {expandedKey === item.key && (
                          <ExpandPanel item={item} type="part" causesByClaimId={causesByClaimId} navigate={navigate} setExpandedKey={setExpandedKey} />
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
              <div className="card-title">🔩 품목별 클레임 건수 (상위 10)</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={partAnalysis.slice(0, 10).map(p => ({ name: p.part_name || p.part_number, count: p.total }))} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={v => [v + '건', '클레임']} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {partAnalysis.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── 그룹별 탭 ── */}
      {tab === '그룹별' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">🗂 고객사 그룹별 분석 <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>· 행 클릭 시 상세 보기</span></div>
            {groupAnalysis.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">🗂</div>
                고객사 그룹 데이터가 없습니다<br/>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>클레임 접수 시 고객사 그룹을 선택하면 분석됩니다</span>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>그룹</th>
                      {STAGES.map(s => <th key={s} style={thStyle}>{s}</th>)}
                      <th style={thStyle}>합계</th><th style={thStyle}>종결율</th>
                      <th>주요 원인</th><th>최다 품목</th>
                      <th style={{ width: 20 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupAnalysis.map(item => (
                      <Fragment key={item.name}>
                        <tr className="clickable" onClick={() => toggleRow('grp_' + item.name)}
                          style={{ background: expandedKey === 'grp_' + item.name ? '#f0f9ff' : '' }}>
                          <td><strong>{item.name}</strong></td>
                          {STAGES.map(s => (
                            <td key={s} style={thStyle}>
                              {item.stageCnts[s] > 0
                                ? <span className="stage-badge" style={{ background: STAGE_COLORS[s]?.bg, color: STAGE_COLORS[s]?.text }}>{item.stageCnts[s]}</span>
                                : <span style={{ color: '#e2e8f0' }}>-</span>}
                            </td>
                          ))}
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.total}</td>
                          <td style={thStyle}><span style={{ fontWeight: 700, color: closeColor(item.closeRate) }}>{item.closeRate}%</span></td>
                          <td style={{ fontSize: 12 }}>
                            {item.topCause
                              ? <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>{item.topCause}</span>
                              : <span style={{ color: '#cbd5e1' }}>-</span>}
                          </td>
                          <td style={{ fontSize: 12, color: '#64748b' }}>{item.topPart || '-'}</td>
                          <td style={{ color: '#94a3b8', fontSize: 12 }}>{expandedKey === 'grp_' + item.name ? '▲' : '▼'}</td>
                        </tr>
                        {expandedKey === 'grp_' + item.name && (
                          <ExpandPanel key={'grp_' + item.name + '_exp'} item={item} type="group" causesByClaimId={causesByClaimId} navigate={navigate} setExpandedKey={setExpandedKey} />
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 그룹별 바 차트 */}
          {groupAnalysis.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="card">
                <div className="card-title">📊 그룹별 클레임 건수</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={groupAnalysis.map(g => ({ name: g.name, count: g.total }))} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                    <Tooltip formatter={v => [v + '건', '클레임']} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {groupAnalysis.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card">
                <div className="card-title">📊 그룹별 종결율</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={groupAnalysis.map(g => ({ name: g.name, rate: g.closeRate }))} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={v => v + '%'} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                    <Tooltip formatter={v => [v + '%', '종결율']} />
                    <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                      {groupAnalysis.map((g, i) => <Cell key={i} fill={closeColor(g.closeRate)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 품목 유형별 집계 */}
          {filteredClaims.some(c => c.product_type) && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-title">📦 품목 유형별 현황</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {PRODUCT_TYPES.map(type => {
                  const cs = filteredClaims.filter(c => c.product_type === type);
                  if (cs.length === 0) return null;
                  const closed = cs.filter(c => c.current_stage === '종결').length;
                  return (
                    <div key={type} style={{ flex: 1, minWidth: 160, background: '#f8fafc', borderRadius: 10, padding: '14px 18px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>{type}</div>
                      <div style={{ fontSize: 24, fontWeight: 700 }}>{cs.length}건</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                        종결 {closed}건 · {cs.length ? Math.round(closed / cs.length * 100) : 0}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 원인별 탭 ── */}
      {tab === '원인별' && (
        <div>
          {causeAnalysis.length === 0 ? (
            <div className="card">
              <div className="empty" style={{ padding: 40 }}>
                <div className="empty-icon">🔍</div>
                원인 분석 데이터가 없습니다<br />
                <span style={{ fontSize: 12, color: '#94a3b8' }}>회수품 원인분석 단계를 진행하면 데이터가 쌓입니다</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="card">
                <div className="card-title">📊 원인 분류별 비율</div>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={causeAnalysis} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={55} paddingAngle={2}>
                      {causeAnalysis.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v, name) => [`${v}건`, name]} />
                    <Legend iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="card">
                <div className="card-title">📋 원인별 집계</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {causeAnalysis.map((item, i) => {
                    const tot = causeAnalysis.reduce((s, x) => s + x.value, 0);
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

          {causeAnalysis.length > 0 && customerAnalysis.some(c => Object.keys(c.causeCnt).length > 0) && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-title">🗂 고객사 × 원인 매트릭스</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>고객사</th>
                      {causeAnalysis.map(c => <th key={c.name} style={thStyle}>{c.name}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {customerAnalysis.filter(c => Object.keys(c.causeCnt).length > 0).map(item => (
                      <tr key={item.name}>
                        <td><strong>{item.name}</strong></td>
                        {causeAnalysis.map(cause => (
                          <td key={cause.name} style={thStyle}>
                            {item.causeCnt[cause.name] > 0
                              ? <span style={{ fontWeight: 700, color: '#3b82f6' }}>{item.causeCnt[cause.name]}</span>
                              : <span style={{ color: '#e2e8f0' }}>-</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 월별 추이 탭 ── */}
      {tab === '월별 추이' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-title">📅 클레임 접수 추이 <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>(필터 기간 기준, 최대 24개월)</span></div>
            {monthlyData.length === 0 ? (
              <div className="empty" style={{ padding: 40 }}>데이터 없음</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 4, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={v => [v + '건', '클레임']} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card">
            <div className="card-title">📍 단계별 진행 현황</div>
            {total === 0 ? (
              <div className="empty" style={{ padding: 40 }}>데이터 없음</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={STAGES.map(s => ({ name: s, value: filteredClaims.filter(c => c.current_stage === s).length }))}
                    dataKey="value" nameKey="name" cx="50%" cy="50%"
                    outerRadius={90} innerRadius={55} paddingAngle={2}
                  >
                    {STAGES.map(s => <Cell key={s} fill={STAGE_COLORS[s]?.dot || '#94a3b8'} />)}
                  </Pie>
                  <Tooltip formatter={(v, name) => [v + '건', name]} />
                  <Legend iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
