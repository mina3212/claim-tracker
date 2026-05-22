import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signOut } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { usePresence } from '../hooks/usePresence';

const DEPT_COLORS = {
  '영업팀':    { bg: '#dbeafe', text: '#1e40af' },
  '마케팅팀':  { bg: '#fce7f3', text: '#9d174d' },
  '품질기술팀': { bg: '#d1fae5', text: '#065f46' },
  '영업관리팀': { bg: '#fef3c7', text: '#92400e' },
};

export default function Layout() {
  const { user, displayName, department, isAdmin, saveName } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const onlineUsers = usePresence(user, displayName, department);

  const [editingName, setEditingName] = useState(false);
  const [nameInput,   setNameInput]   = useState('');
  const [mobileOpen,  setMobileOpen]  = useState(false);

  const handleLogout = async () => {
    if (!confirm('로그아웃 하시겠습니까?')) return;
    await signOut();
    toast('로그아웃 완료', '', 'info');
  };

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    try {
      await saveName(nameInput.trim());
      setEditingName(false);
      toast('이름 저장 완료', '', 'success');
    } catch (e) {
      toast('저장 실패', e.message, 'error');
    }
  };

  const initial = (displayName || user?.email || '?').charAt(0).toUpperCase();

  const closeMenu = () => setMobileOpen(false);

  return (
    <div className="app-layout">
      {/* 모바일 상단 바 */}
      <div className="mobile-topbar no-print">
        <button className="mobile-hamburger" onClick={() => setMobileOpen(true)}>☰</button>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>🚨 클레임 관리</span>
        <button
          className="btn btn-sm"
          onClick={() => { navigate('/claims/new'); closeMenu(); }}
          style={{ marginLeft: 'auto', background: '#3b82f6', color: '#fff', border: 'none', fontSize: 12, padding: '5px 10px' }}
        >➕ 접수</button>
      </div>

      {/* 모바일 오버레이 */}
      {mobileOpen && <div className="mobile-overlay" onClick={closeMenu} />}

      <aside className={`sidebar${mobileOpen ? ' mobile-open' : ''}`}>
        <button className="mobile-close-btn" onClick={closeMenu}>✕</button>
        <div className="sidebar-logo">
          <h1>🚨 클레임 관리</h1>
          <p>고객사 클레임 트래커</p>
        </div>

        <nav onClick={closeMenu}>
          <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span>🏠</span> 대시보드
          </NavLink>
          <NavLink to="/claims" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span>📋</span> 클레임 목록
          </NavLink>
          <NavLink to="/claims/new" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span>➕</span> 클레임 접수
          </NavLink>
          <NavLink to="/analytics" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span>📊</span> 누적 분석
          </NavLink>
          <NavLink to="/parts" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span>🔩</span> 품번 관리
          </NavLink>
        </nav>

        {/* ── 접속자 현황 (관리자 전용) ── */}
        {isAdmin && (
          <div style={{ padding: '10px 8px' }}>
            <div style={{
              background: '#0f172a', borderRadius: 10, padding: '10px 12px',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 8,
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: .5 }}>
                  접속 중
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  background: '#10b981', color: '#fff',
                  padding: '1px 7px', borderRadius: 99,
                }}>
                  {onlineUsers.length}명
                </span>
              </div>

              {onlineUsers.length === 0 ? (
                <div style={{ fontSize: 11, color: '#475569', textAlign: 'center', padding: '6px 0' }}>
                  접속자 없음
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {onlineUsers.map((u, i) => {
                    const dc = DEPT_COLORS[u.department] || { bg: '#f1f5f9', text: '#475569' };
                    const isMe = u.user_id === user?.id;
                    return (
                      <div key={u.user_id || i} style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        padding: '5px 7px', borderRadius: 7,
                        background: isMe ? '#1e3a5f' : '#1e293b',
                      }}>
                        {/* 온라인 점 */}
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: '#10b981', flexShrink: 0,
                          boxShadow: '0 0 0 2px #064e3b',
                        }} />
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{
                            fontSize: 12, fontWeight: 600,
                            color: isMe ? '#93c5fd' : '#e2e8f0',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {u.display_name}
                            {isMe && <span style={{ fontSize: 9, color: '#64748b', marginLeft: 4 }}>(나)</span>}
                          </div>
                          {u.department && (
                            <span style={{
                              fontSize: 9, padding: '1px 5px', borderRadius: 99,
                              background: dc.bg, color: dc.text, fontWeight: 600,
                            }}>
                              {u.department}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 사용자 정보 ── */}
        <div className="sidebar-footer" style={{ marginTop: 'auto' }}>
          <div style={{ background: '#0f172a', borderRadius: 10, padding: '12px', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: isAdmin ? '#f59e0b' : '#3b82f6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0,
              }}>
                {initial}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {editingName ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                      autoFocus
                      style={{
                        flex: 1, padding: '3px 6px', fontSize: 12,
                        border: '1px solid #334155', borderRadius: 5,
                        background: '#1e293b', color: '#fff',
                        outline: 'none', fontFamily: 'inherit',
                      }}
                    />
                    <button onClick={handleSaveName} style={{ padding: '3px 7px', fontSize: 11, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}>✓</button>
                  </div>
                ) : (
                  <div
                    title="클릭해서 이름 수정"
                    onClick={() => { setNameInput(displayName); setEditingName(true); }}
                    style={{
                      fontSize: 13, fontWeight: 700, color: '#fff',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}
                  >
                    {displayName} <span style={{ fontSize: 10, color: '#475569' }}>✏️</span>
                  </div>
                )}
                <div style={{ fontSize: 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                  {user?.email}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {department && (() => {
                const dc = DEPT_COLORS[department] || { bg: '#1e3a5f', text: '#93c5fd' };
                return (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: dc.bg, color: dc.text, fontWeight: 600 }}>
                    {department}
                  </span>
                );
              })()}
              {isAdmin && (
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: '#78350f', color: '#fde68a', fontWeight: 600 }}>
                  ⭐ 관리자
                </span>
              )}
            </div>
          </div>

          <button className="auth-btn" onClick={handleLogout} style={{ color: '#f87171', fontSize: 12 }}>
            🔓 로그아웃
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
