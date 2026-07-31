import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const DEPARTMENTS = ['영업팀', '마케팅팀', '영업관리팀', '품질기술팀', '경영지원팀', '개발팀', '생산팀'];

const DEPT_COLORS = {
  '영업팀':    { bg: '#dbeafe', text: '#1e40af' },
  '마케팅팀':  { bg: '#fce7f3', text: '#9d174d' },
  '품질기술팀': { bg: '#d1fae5', text: '#065f46' },
  '영업관리팀': { bg: '#fef3c7', text: '#92400e' },
};

export default function UserAdmin() {
  const { user } = useAuth();
  const toast = useToast();

  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [dirty,   setDirty]   = useState({});   // id → { department, is_admin }
  const [saving,  setSaving]  = useState({});   // id → true/false

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      if (!res.ok) throw new Error('불러오기 실패');
      setUsers(await res.json());
    } catch (e) {
      toast('불러오기 실패', e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const getVal = (u) => dirty[u.id] ?? { department: u.department, is_admin: u.is_admin };

  const change = (id, field, value) => {
    setDirty(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? users.find(u => u.id === id)), [field]: value },
    }));
  };

  const save = async (u) => {
    const val = getVal(u);
    setSaving(prev => ({ ...prev, [u.id]: true }));
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(u.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department: val.department, is_admin: val.is_admin }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '저장 실패');
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, ...val } : x));
      setDirty(prev => { const n = { ...prev }; delete n[u.id]; return n; });
      toast(`${u.name || u.email} 저장 완료`, '', 'success');
    } catch (e) {
      toast('저장 실패', e.message, 'error');
    } finally {
      setSaving(prev => ({ ...prev, [u.id]: false }));
    }
  };

  const discard = (id) => setDirty(prev => { const n = { ...prev }; delete n[id]; return n; });

  const initial = (u) => (u.name || u.email || '?').charAt(0).toUpperCase();

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: '#94a3b8', gap: 10 }}>
      <div style={{ width: 22, height: 22, border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      불러오는 중...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ padding: '24px 20px', maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>👥 사용자 권한 관리</h2>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          부서와 관리자 권한을 변경한 후 각 행의 저장 버튼을 누르세요. 권한 변경은 다음 로그인 시 적용됩니다.
        </p>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        {/* 헤더 */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr auto', gap: 12, padding: '10px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: .6 }}>
          <span>사용자</span>
          <span>부서</span>
          <span>관리자</span>
          <span></span>
          <span></span>
        </div>

        {users.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            등록된 사용자가 없습니다.
          </div>
        )}

        {users.map((u, idx) => {
          const val    = getVal(u);
          const isDirty = !!dirty[u.id];
          const isSelf  = u.id === user?.id;
          const dc      = DEPT_COLORS[val.department] || { bg: '#f1f5f9', text: '#475569' };

          return (
            <div key={u.id} style={{
              display: 'grid',
              gridTemplateColumns: '2fr 2fr 1fr 1fr auto',
              gap: 12,
              padding: '14px 20px',
              alignItems: 'center',
              borderBottom: idx < users.length - 1 ? '1px solid #f1f5f9' : 'none',
              background: isDirty ? '#fffbeb' : '#fff',
              transition: 'background .2s',
            }}>
              {/* 사용자 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  background: val.is_admin ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#2563eb,#1d4ed8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 800, color: '#fff',
                }}>
                  {initial(u)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.name || '(이름 없음)'}
                    {isSelf && <span style={{ fontSize: 10, color: '#3b82f6', marginLeft: 5, fontWeight: 600 }}>나</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                </div>
              </div>

              {/* 부서 드롭다운 */}
              <div>
                <select
                  value={val.department || ''}
                  onChange={e => change(u.id, 'department', e.target.value || null)}
                  style={{
                    width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 7,
                    border: `1.5px solid ${isDirty ? '#fbbf24' : '#e2e8f0'}`,
                    background: val.department ? dc.bg : '#f8fafc',
                    color: val.department ? dc.text : '#94a3b8',
                    fontWeight: val.department ? 600 : 400,
                    cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
                  }}
                >
                  <option value="">— 미지정 —</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {/* 관리자 토글 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => !isSelf && change(u.id, 'is_admin', !val.is_admin)}
                  title={isSelf ? '자신의 관리자 권한은 변경할 수 없습니다' : ''}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: isSelf ? 'not-allowed' : 'pointer',
                    background: val.is_admin ? '#f59e0b' : '#e2e8f0',
                    position: 'relative', transition: 'background .2s',
                    opacity: isSelf ? 0.5 : 1,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3, left: val.is_admin ? 22 : 3,
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                    transition: 'left .15s',
                  }} />
                </button>
                <span style={{ fontSize: 11, fontWeight: 600, color: val.is_admin ? '#92400e' : '#94a3b8' }}>
                  {val.is_admin ? '⭐ 관리자' : '일반'}
                </span>
              </div>

              {/* 변경 전/후 요약 */}
              <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.5 }}>
                {isDirty ? (
                  <span style={{ color: '#d97706', fontWeight: 600 }}>변경됨</span>
                ) : (
                  <span style={{ color: '#10b981', fontWeight: 600 }}>저장됨</span>
                )}
              </div>

              {/* 저장/취소 버튼 */}
              <div style={{ display: 'flex', gap: 5 }}>
                {isDirty ? (
                  <>
                    <button
                      onClick={() => save(u)}
                      disabled={saving[u.id]}
                      style={{
                        padding: '5px 12px', fontSize: 11, fontWeight: 700, borderRadius: 7,
                        background: '#0f172a', color: '#fff', border: 'none', cursor: 'pointer',
                        opacity: saving[u.id] ? 0.6 : 1,
                      }}
                    >
                      {saving[u.id] ? '저장 중...' : '저장'}
                    </button>
                    <button
                      onClick={() => discard(u.id)}
                      style={{ padding: '5px 8px', fontSize: 11, borderRadius: 7, background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', cursor: 'pointer' }}
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <div style={{ width: 70 }} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8' }}>
        총 {users.length}명 · 관리자 {users.filter(u => u.is_admin).length}명
      </div>
    </div>
  );
}
