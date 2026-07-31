import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PERM_SECTIONS, ALL_PERM_KEYS, resolvePermissions } from '../lib/permissions';
import { DEPARTMENTS } from '../lib/supabase';

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
  const [dirty,   setDirty]   = useState({});   // id → { department, is_admin, permissions }
  const [saving,  setSaving]  = useState({});

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

  const getVal = (u) => {
    if (dirty[u.id]) return dirty[u.id];
    const resolved = resolvePermissions(u);
    return { department: u.department, is_admin: u.is_admin, permissions: resolved };
  };

  const changeRole = (id, field, value) => {
    const u = users.find(x => x.id === id);
    const current = getVal(u);
    // 관리자 켜면 permissions도 모두 on, 끄면 현재 dept 기본값으로
    const next = { ...current, [field]: value };
    if (field === 'is_admin' && value) {
      next.permissions = Object.fromEntries(ALL_PERM_KEYS.map(k => [k, true]));
    }
    setDirty(prev => ({ ...prev, [id]: next }));
  };

  const togglePerm = (id, key) => {
    const u = users.find(x => x.id === id);
    const current = getVal(u);
    if (current.is_admin) return; // 관리자는 개별 토글 불가
    const newPerms = { ...current.permissions, [key]: !current.permissions[key] };
    setDirty(prev => ({ ...prev, [id]: { ...current, permissions: newPerms } }));
  };

  const save = async (u) => {
    const val = getVal(u);
    setSaving(prev => ({ ...prev, [u.id]: true }));
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(u.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department:  val.department,
          is_admin:    val.is_admin,
          permissions: val.is_admin ? null : val.permissions,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '저장 실패');
      setUsers(prev => prev.map(x => x.id === u.id
        ? { ...x, department: val.department, is_admin: val.is_admin, permissions: val.is_admin ? null : val.permissions }
        : x
      ));
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

  // 전체 permission key 플랫 목록 (헤더용)
  const allPerms = PERM_SECTIONS.flatMap(s => s.perms);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: '#94a3b8', gap: 10 }}>
      <div style={{ width: 22, height: 22, border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      불러오는 중...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ padding: '24px 20px' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>👥 사용자 권한 관리</h2>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          부서·관리자 여부와 메뉴별 읽기/쓰기 권한을 설정합니다. 변경 후 저장 버튼을 누르세요.
        </p>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <thead>
            {/* 섹션 헤더 */}
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th rowSpan={2} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', borderRight: '1px solid #e2e8f0', minWidth: 200 }}>사용자</th>
              <th rowSpan={2} style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', borderRight: '1px solid #e2e8f0', minWidth: 130 }}>부서</th>
              <th rowSpan={2} style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', borderRight: '2px solid #e2e8f0', minWidth: 70 }}>관리자</th>
              {PERM_SECTIONS.map((s, si) => (
                <th key={s.section} colSpan={s.perms.length}
                  style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: 11,
                    borderRight: si < PERM_SECTIONS.length - 1 ? '2px solid #e2e8f0' : 'none',
                    borderBottom: '1px solid #e2e8f0',
                    background: si % 2 === 0 ? '#f8fafc' : '#f1f5f9' }}>
                  {s.section}
                </th>
              ))}
              <th rowSpan={2} style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', borderLeft: '2px solid #e2e8f0', minWidth: 100 }}>저장</th>
            </tr>
            {/* 권한 항목 헤더 */}
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              {PERM_SECTIONS.map((s, si) =>
                s.perms.map((p, pi) => (
                  <th key={p.key} style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600, color: '#94a3b8', fontSize: 11, whiteSpace: 'nowrap',
                    borderRight: pi === s.perms.length - 1 && si < PERM_SECTIONS.length - 1 ? '2px solid #e2e8f0' : '1px solid #f1f5f9' }}>
                    {p.label}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={3 + allPerms.length + 1} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>등록된 사용자가 없습니다.</td></tr>
            )}
            {users.map((u, idx) => {
              const val     = getVal(u);
              const isDirty = !!dirty[u.id];
              const isSelf  = u.id === user?.id;
              const dc      = DEPT_COLORS[val.department] || { bg: '#f1f5f9', text: '#475569' };

              return (
                <tr key={u.id} style={{ borderBottom: idx < users.length - 1 ? '1px solid #f1f5f9' : 'none', background: isDirty ? '#fffbeb' : idx % 2 === 0 ? '#fff' : '#fafafa', transition: 'background .15s' }}>

                  {/* 사용자 */}
                  <td style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: val.is_admin ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#2563eb,#1d4ed8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>
                        {initial(u)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.name || '(이름 없음)'}
                          {isSelf && <span style={{ fontSize: 10, color: '#3b82f6', marginLeft: 4 }}>나</span>}
                        </div>
                        <div style={{ fontSize: 10, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* 부서 */}
                  <td style={{ padding: '10px 12px', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <select value={val.department || ''} onChange={e => changeRole(u.id, 'department', e.target.value || null)}
                      style={{ width: '100%', padding: '5px 8px', fontSize: 11, borderRadius: 6, fontFamily: 'inherit',
                        border: `1.5px solid ${isDirty ? '#fbbf24' : '#e2e8f0'}`,
                        background: val.department ? dc.bg : '#f8fafc',
                        color: val.department ? dc.text : '#94a3b8',
                        fontWeight: val.department ? 600 : 400, cursor: 'pointer', outline: 'none' }}>
                      <option value="">— 미지정 —</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </td>

                  {/* 관리자 토글 */}
                  <td style={{ padding: '10px 14px', borderRight: '2px solid #e2e8f0', textAlign: 'center' }}>
                    <button onClick={() => !isSelf && changeRole(u.id, 'is_admin', !val.is_admin)}
                      title={isSelf ? '자신의 관리자 권한은 변경할 수 없습니다' : ''}
                      style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: isSelf ? 'not-allowed' : 'pointer',
                        background: val.is_admin ? '#f59e0b' : '#e2e8f0', position: 'relative', transition: 'background .2s', opacity: isSelf ? 0.5 : 1 }}>
                      <span style={{ position: 'absolute', top: 2, left: val.is_admin ? 20 : 2, width: 18, height: 18, borderRadius: '50%',
                        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'left .15s' }} />
                    </button>
                  </td>

                  {/* 권한 체크박스들 */}
                  {PERM_SECTIONS.map((s, si) =>
                    s.perms.map((p, pi) => {
                      const checked  = !!val.permissions?.[p.key];
                      const disabled = val.is_admin;
                      return (
                        <td key={p.key} style={{ textAlign: 'center', padding: '10px 8px',
                          borderRight: pi === s.perms.length - 1 && si < PERM_SECTIONS.length - 1 ? '2px solid #e2e8f0' : '1px solid #f1f5f9' }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer' }}>
                            <input type="checkbox" checked={checked} disabled={disabled}
                              onChange={() => togglePerm(u.id, p.key)}
                              style={{ width: 16, height: 16, accentColor: '#2563eb', cursor: disabled ? 'default' : 'pointer' }} />
                          </label>
                        </td>
                      );
                    })
                  )}

                  {/* 저장/취소 */}
                  <td style={{ padding: '10px 12px', borderLeft: '2px solid #e2e8f0', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {isDirty ? (
                      <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                        <button onClick={() => save(u)} disabled={saving[u.id]}
                          style={{ padding: '5px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6,
                            background: '#0f172a', color: '#fff', border: 'none', cursor: 'pointer', opacity: saving[u.id] ? 0.6 : 1 }}>
                          {saving[u.id] ? '...' : '저장'}
                        </button>
                        <button onClick={() => discard(u.id)}
                          style={{ padding: '5px 8px', fontSize: 11, borderRadius: 6, background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                          취소
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>✓</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: '#94a3b8' }}>
        총 {users.length}명 · 관리자 {users.filter(u => u.is_admin).length}명 ·
        <span style={{ marginLeft: 6, color: '#f59e0b' }}>관리자 계정은 체크박스와 무관하게 모든 메뉴에 접근 가능합니다</span>
      </div>
    </div>
  );
}
