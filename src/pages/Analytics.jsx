import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useClaims } from '../context/ClaimsContext';
import StageBadge from '../components/StageBadge';
import { STAGES, STAGE_COLORS } from '../lib/supabase';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f97316', '#ef4444', '#06b6d4', '#84cc16', '#ec4899', '#64748b'];
const CAUSE_OPTIONS = ['사용자 과실', '생산공정', '제품불량', '구조불량', '배송오류', '기타'];

const TABS = ['고객사별', '품목별', '원인별', '월별 추이'];

const OVERLAY = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
  zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const MODAL = {
  background: '#fff', borderRadius: 14, padding: 0,
  width: 700, maxWidth: '96vw', maxHeight: '82vh',
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 24px 64px rgba(0,0,0,.25)', overflow: 'hidden',
};

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

export default function Analytics() {
  const { claims, stages, loading } = useClaims();
  const navigate = useNavigate();
  const [tab, setTab]     = useState('고객사별');
  const [modal, setModal] = useState(null);

  /* ── 원인 파싱 (stage_name이 '조치'인 항목에 저장됨) ── */
  const causesByClaimId = useMemo(() => {
    const map = {};
    stages.forEach(s => {
      if (s.description && s.description.includes('[원인]')) {
        map[s.claim_id] = parseCauses(s.description);
      }
    });
    return map;
  }, [stages]);

  /* ── 고객사별 분석 ── */
  const customerAnalysis = useMemo(() => {
    const names = [...new Set(claims.map(c => c.customer_name).filter(Boolean))];
    return names.map(name => {
      const cs = claims.filter(c => c.customer_name === name);
      const total = cs.length;
      const closed = cs.filter(c => c.current_stage === '종결').length;
      const closeRate = total ? Math.round(closed / total * 100) : 0;

      // 품목 집계
      const partCnt = {};
      cs.forEach(c => {
        const k = [c.part_number, c.part_name].filter(Boolean).join(' ');
        if (k) partCnt[k] = (partCnt[k] || 0) + 1;
      });
      const topPart = Object.entries(partCnt).sort(([,a],[,b]) => b-a)[0];

      // 원인 집계
      const causeCnt = {};
      cs.forEach(c => {
        (causesByClaimId[c.id] || []).forEach(cause => {
          causeCnt[cause] = (causeCnt[cause] || 0) + 1;
        });
      });
      const topCause = Object.entries(causeCnt).sort(([,a],[,b]) => b-a)[0];

      const stageCnts = Object.fromEntries(STAGES.map(s => [s, cs.filter(c => c.current_stage === s).length]));

      return {
        name, total, closed, closeRate,
        topPart: topPart?.[0], topCause: topCause?.[0],
        causeCnt, partCnt, stageCnts, claims: cs,
      };
    }).sort((a, b) => b.total - a.total);
  }, [claims, causesByClaimId]);

  /* ── 품목별 분석 ── */
  const partAnalysis = useMemo(() => {
    const map = {};
    claims.forEach(c => {
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
      const total = p.claims.length;
      const closed = p.claims.filter(c => c.current_stage === '종결').length;
      const closeRate = total ? Math.round(closed / total * 100) : 0;
      const topCause = Object.entries(p.causeCnt).sort(([,a],[,b]) => b-a)[0];
      const topCustomer = (() => {
        const cnt = {};
        p.claims.forEach(c => { if (c.customer_name) cnt[c.customer_name] = (cnt[c.customer_name] || 0) + 1; });
        return Object.entries(cnt).sort(([,a],[,b]) => b-a)[0]?.[0];
      })();
      return {
        ...p, total, closed, closeRate,
        topCause: topCause?.[0], topCustomer,
        customers: [...p.customers],
      };
    }).sort((a, b) => b.total - a.total);
  }, [claims, causesByClaimId]);

  /* ── 원인별 집계 ── */
  const causeAnalysis = useMemo(() => {
    const total = {};
    CAUSE_OPTIONS.forEach(c => { total[c] = 0; });
    Object.values(causesByClaimId).forEach(causes => {
      causes.forEach(cause => {
        const key = CAUSE_OPTIONS.find(o => cause.startsWith(o.replace('기타', '기타'))) || cause;
        if (key) total[key] = (total[key] || 0) + 1;
      });
    });
    return Object.entries(total)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));
  }, [causesByClaimId]);

  /* ── 월별 데이터 ── */
  const monthlyData = useMemo(() => {
    const map = {};
    claims.forEach(c => {
      const m = (c.receipt_date || c.created_at || '').slice(0, 7);
      if (m && m.length === 7) map[m] = (map[m] || 0) + 1;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
      .map(([month, count]) => ({ month, count }));
  }, [claims]);

  const total     = claims.length;
  const active    = claims.filter(c => c.current_stage !== '종결').length;
  const closed    = claims.filter(c => c.current_stage === '종결').length;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const newThis   = claims.filter(c => (c.receipt_date || c.created_at || '').slice(0, 7) === thisMonth).length;

  if (loading) return <div className="loading">⏳ 불러오는 중...</div>;

  /* ── 모달 헬퍼 ── */
  const openCustomerModal = (item) => setModal({
    type: 'customer', title: `🏢 ${item.name}`, item,
  });
  const openPartModal = (item) => setModal({
    type: 'part', title: `🔩 ${item.key}`, item,
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">누적 분석</div>
          <div className="page-sub">클레임 현황 및 품목·고객사·원인별 심화 분석</div>
        </div>
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
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 18px', borderRadius: 8, border: '1px solid',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: '.15s', fontFamily: 'inherit',
              background: tab === t ? '#0f172a' : '#fff',
              color: tab === t ? '#fff' : '#64748b',
              borderColor: tab === t ? '#0f172a' : '#e2e8f0',
            }}
          >{t}</button>
        ))}
      </div>

      {/* ── 고객사별 탭 ── */}
      {tab === '고객사별' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">🏢 고객사별 클레임 분석</div>
            {customerAnalysis.length === 0 ? (
              <div className="empty">데이터 없음</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>고객사</th>
                      {STAGES.map(s => <th key={s} style={{ textAlign: 'center', fontSize: 11 }}>{s}</th>)}
                      <th style={{ textAlign: 'center' }}>합계</th>
                      <th style={{ textAlign: 'center' }}>종결율</th>
                      <th>인사이트</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerAnalysis.map(item => (
                      <tr key={item.name} className="clickable" onClick={() => openCustomerModal(item)}>
                        <td><strong>{item.name}</strong></td>
                        {STAGES.map(s => (
                          <td key={s} style={{ textAlign: 'center' }}>
                            {item.stageCnts[s] > 0
                              ? <span className="stage-badge" style={{ background: STAGE_COLORS[s]?.bg, color: STAGE_COLORS[s]?.text }}>{item.stageCnts[s]}</span>
                              : <span style={{ color: '#e2e8f0' }}>-</span>}
                          </td>
                        ))}
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.total}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, color: item.closeRate === 100 ? '#10b981' : item.closeRate >= 50 ? '#f59e0b' : '#ef4444' }}>
                            {item.closeRate}%
                          </span>
                        </td>
                        <td style={{ fontSize: 11, color: '#64748b', maxWidth: 180 }}>
                          {getInsightText({ total: item.total, closeRate: item.closeRate, topCause: item.topCause, topPart: item.topPart })}
                        </td>
                        <td style={{ color: '#94a3b8', fontSize: 12 }}>→</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 고객사 바 차트 */}
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
            <div className="card-title">🔩 품목별 클레임 분석</div>
            {partAnalysis.length === 0 ? (
              <div className="empty">품번/품명이 입력된 클레임이 없습니다</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>품번</th>
                      <th>품명</th>
                      <th style={{ textAlign: 'center' }}>건수</th>
                      <th style={{ textAlign: 'center' }}>종결율</th>
                      <th>관련 고객사</th>
                      <th>주요 원인</th>
                      <th>인사이트</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {partAnalysis.map(item => (
                      <tr key={item.key} className="clickable" onClick={() => openPartModal(item)}>
                        <td className="mono" style={{ fontSize: 12 }}>{item.part_number || '-'}</td>
                        <td>{item.part_name || '-'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.total}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, color: item.closeRate === 100 ? '#10b981' : item.closeRate >= 50 ? '#f59e0b' : '#ef4444' }}>
                            {item.closeRate}%
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: '#475569' }}>
                          {item.customers.slice(0, 2).join(', ')}{item.customers.length > 2 ? ` 외 ${item.customers.length - 2}곳` : ''}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {item.topCause
                            ? <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>{item.topCause}</span>
                            : <span style={{ color: '#cbd5e1' }}>-</span>}
                        </td>
                        <td style={{ fontSize: 11, color: '#64748b', maxWidth: 160 }}>
                          {getInsightText({ total: item.total, closeRate: item.closeRate, topCause: item.topCause, topCustomer: item.topCustomer })}
                        </td>
                        <td style={{ color: '#94a3b8', fontSize: 12 }}>→</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 품목 바 차트 */}
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
              {/* 원인 파이 차트 */}
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

              {/* 원인 상세 테이블 */}
              <div className="card">
                <div className="card-title">📋 원인별 집계</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {causeAnalysis.map((item, i) => {
                    const total = causeAnalysis.reduce((s, x) => s + x.value, 0);
                    const pct = total ? Math.round(item.value / total * 100) : 0;
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

          {/* 고객사 × 원인 매트릭스 */}
          {causeAnalysis.length > 0 && customerAnalysis.some(c => Object.keys(c.causeCnt).length > 0) && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-title">🗂 고객사 × 원인 매트릭스</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>고객사</th>
                      {causeAnalysis.map(c => <th key={c.name} style={{ textAlign: 'center', fontSize: 11 }}>{c.name}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {customerAnalysis.filter(c => Object.keys(c.causeCnt).length > 0).map(item => (
                      <tr key={item.name}>
                        <td><strong>{item.name}</strong></td>
                        {causeAnalysis.map(cause => (
                          <td key={cause.name} style={{ textAlign: 'center' }}>
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
            <div className="card-title">📅 월별 클레임 접수 추이</div>
            {monthlyData.length === 0 ? (
              <div className="empty" style={{ padding: 40 }}>데이터 없음</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 4, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={v => [v + '건', '클레임']} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 단계별 현황 도넛 */}
          <div className="card">
            <div className="card-title">📍 단계별 진행 현황</div>
            {total === 0 ? (
              <div className="empty" style={{ padding: 40 }}>데이터 없음</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={STAGES.map(s => ({ name: s, value: claims.filter(c => c.current_stage === s).length }))}
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

      {/* ── 상세 모달 ── */}
      {modal && (
        <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div style={MODAL}>
            {/* 헤더 */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{modal.title}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    {modal.type === 'customer' && (
                      <>총 {modal.item.total}건 · 종결율 {modal.item.closeRate}% · {getInsightText({ total: modal.item.total, closeRate: modal.item.closeRate, topCause: modal.item.topCause, topPart: modal.item.topPart })}</>
                    )}
                    {modal.type === 'part' && (
                      <>총 {modal.item.total}건 · 종결율 {modal.item.closeRate}% · {modal.item.customers.length}개 고객사</>
                    )}
                  </div>
                </div>
                <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
              </div>

              {/* 미니 차트 - 원인 분포 */}
              {Object.keys(modal.item.causeCnt || {}).length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(modal.item.causeCnt).sort(([,a],[,b]) => b-a).map(([cause, cnt], i) => (
                    <span key={cause} style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: COLORS[i % COLORS.length] + '20',
                      color: COLORS[i % COLORS.length],
                      border: `1px solid ${COLORS[i % COLORS.length]}40`,
                    }}>
                      {cause} {cnt}건
                    </span>
                  ))}
                </div>
              )}

              {/* 품목 분포 (고객사 모달) */}
              {modal.type === 'customer' && Object.keys(modal.item.partCnt || {}).length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(modal.item.partCnt).sort(([,a],[,b]) => b-a).slice(0, 5).map(([part, cnt]) => (
                    <span key={part} style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11,
                      background: '#f1f5f9', color: '#475569',
                    }}>
                      🔩 {part} ({cnt}건)
                    </span>
                  ))}
                </div>
              )}

              {/* 고객사 분포 (품목 모달) */}
              {modal.type === 'part' && modal.item.customers.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {modal.item.customers.map(c => (
                    <span key={c} style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11,
                      background: '#f1f5f9', color: '#475569',
                    }}>
                      🏢 {c}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 클레임 목록 */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {modal.item.claims.map(c => (
                <div
                  key={c.id}
                  style={{ padding: '12px 24px', borderBottom: '1px solid #f8fafc', cursor: 'pointer', transition: '.1s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f0f9ff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                  onClick={() => { navigate(`/claims/${c.id}`); setModal(null); }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <strong style={{ fontSize: 14 }}>{c.customer_name}</strong>
                        <StageBadge stage={c.current_stage} size="sm" />
                        {causesByClaimId[c.id]?.length > 0 && (
                          <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 4 }}>
                            {causesByClaimId[c.id][0]}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {c.receipt_date || ''}{c.part_number ? ` · ${c.part_number}` : ''}{c.part_name ? ` ${c.part_name}` : ''}
                      </div>
                      {c.defect_description && (
                        <div style={{ fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.defect_description}
                        </div>
                      )}
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>→</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
