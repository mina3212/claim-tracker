import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useClaims } from '../context/ClaimsContext';
import { STAGES, STAGE_COLORS } from '../lib/supabase';

const COLORS_LIST = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f97316', '#ef4444', '#06b6d4', '#84cc16'];

export default function Analytics() {
  const { claims, loading } = useClaims();

  const monthlyData = useMemo(() => {
    const map = {};
    claims.forEach(c => {
      const m = (c.receipt_date || c.created_at || '').slice(0, 7);
      if (m && m.length === 7) map[m] = (map[m] || 0) + 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, count]) => ({ month, count }));
  }, [claims]);

  const customerData = useMemo(() => {
    const map = {};
    claims.forEach(c => { map[c.customer_name || '미정'] = (map[c.customer_name || '미정'] || 0) + 1; });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, [claims]);

  const stageData = useMemo(() =>
    STAGES.map(stage => ({
      name: stage,
      value: claims.filter(c => c.current_stage === stage).length,
    })),
  [claims]);

  const partData = useMemo(() => {
    const map = {};
    claims.forEach(c => {
      const key = c.part_number ? `${c.part_number} ${c.part_name || ''}`.trim() : null;
      if (key) map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, [claims]);

  const total  = claims.length;
  const active = claims.filter(c => c.current_stage !== '종결').length;
  const closed = claims.filter(c => c.current_stage === '종결').length;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const newThis   = claims.filter(c => (c.receipt_date || c.created_at || '').slice(0, 7) === thisMonth).length;

  if (loading) return <div className="loading">⏳ 불러오는 중...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">누적 분석</div>
          <div className="page-sub">클레임 접수 현황 및 고객사별 분석</div>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: '전체 클레임', value: total + '건', color: '#0f172a' },
          { label: '처리 중', value: active + '건', color: '#f59e0b' },
          { label: '종결 완료', value: closed + '건', color: '#10b981' },
          { label: '이번달 신규', value: newThis + '건', color: '#3b82f6' },
        ].map(item => (
          <div key={item.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{item.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Monthly trend + Customer */}
      <div className="chart-grid">
        <div className="card">
          <div className="card-title">📅 월별 클레임 접수 추이</div>
          {monthlyData.length === 0
            ? <div className="empty" style={{ padding: 40 }}>데이터 없음</div>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 4, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v + '건', '클레임']} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
        </div>

        <div className="card">
          <div className="card-title">🏢 고객사별 클레임 건수 (상위 10)</div>
          {customerData.length === 0
            ? <div className="empty" style={{ padding: 40 }}>데이터 없음</div>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={customerData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip formatter={(v) => [v + '건', '클레임']} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
        </div>
      </div>

      {/* Stage donut + Part */}
      <div className="chart-grid">
        <div className="card">
          <div className="card-title">📍 단계별 진행 현황</div>
          {total === 0
            ? <div className="empty" style={{ padding: 40 }}>데이터 없음</div>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={stageData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={50}
                    paddingAngle={2}
                  >
                    {stageData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={STAGE_COLORS[entry.name]?.dot || '#94a3b8'}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, name) => [v + '건', name]} />
                  <Legend formatter={(value) => value} iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
            )}
        </div>

        <div className="card">
          <div className="card-title">🔩 품번별 클레임 건수 (상위 10)</div>
          {partData.length === 0
            ? <div className="empty" style={{ padding: 40 }}>데이터 없음 (품번 입력된 클레임 없음)</div>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={partData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(v) => [v + '건', '클레임']} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {partData.map((_, i) => (
                      <Cell key={i} fill={COLORS_LIST[i % COLORS_LIST.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
        </div>
      </div>

      {/* Detailed table */}
      <div className="card">
        <div className="card-title">📊 고객사별 클레임 집계</div>
        {customerData.length === 0
          ? <div className="empty">데이터 없음</div>
          : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>고객사</th>
                    {STAGES.map(s => <th key={s}>{s}</th>)}
                    <th>합계</th>
                    <th>종결율</th>
                  </tr>
                </thead>
                <tbody>
                  {customerData.map(({ name }) => {
                    const rows = claims.filter(c => c.customer_name === name);
                    const stageCnts = Object.fromEntries(STAGES.map(s => [s, rows.filter(c => c.current_stage === s).length]));
                    const tot = rows.length;
                    const closedCnt = stageCnts['종결'] || 0;
                    const rate = tot > 0 ? Math.round(closedCnt / tot * 100) : 0;
                    return (
                      <tr key={name}>
                        <td><strong>{name}</strong></td>
                        {STAGES.map(s => (
                          <td key={s} style={{ textAlign: 'center' }}>
                            {stageCnts[s] > 0
                              ? <span className="stage-badge" style={{ background: STAGE_COLORS[s]?.bg, color: STAGE_COLORS[s]?.text }}>{stageCnts[s]}</span>
                              : <span style={{ color: '#cbd5e1' }}>-</span>}
                          </td>
                        ))}
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{tot}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ color: rate === 100 ? '#10b981' : rate >= 50 ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}
