import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signOut } from '../lib/supabase';
import { useToast } from '../context/ToastContext';

export default function Layout() {
  const { user, displayName, department, isAdmin, saveName } = useAuth();
  const toast = useToast();
  const [editingName, setEditingName] = useState(false);
  const [nameInput,   setNameInput]   = useState('');

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

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>🚨 클레임 관리</h1>
          <p>고객사 클레임 트래커</p>
        </div>

        <nav>
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

        {/* 사용자 정보 */}
        <div className="sidebar-footer">
          {/* 아바타 카드 */}
          <div style={{
            background: '#0f172a', borderRadius: 10, padding: '12px',
            marginBottom: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              {/* 아바타 */}
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: isAdmin ? '#f59e0b' : '#3b82f6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0,
              }}>
                {initial}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {/* 이름 */}
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
                    style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                    onClick={() => { setNameInput(displayName); setEditingName(true); }}
                  >
                    {displayName} <span style={{ fontSize: 10, color: '#475569' }}>✏️</span>
                  </div>
                )}
                {/* 이메일 */}
                <div style={{ fontSize: 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                  {user?.email}
                </div>
              </div>
            </div>

            {/* 부서 / 관리자 뱃지 */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {department && (
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 99,
                  background: '#1e3a5f', color: '#93c5fd', fontWeight: 600,
                }}>
                  {department}
                </span>
              )}
              {isAdmin && (
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 99,
                  background: '#78350f', color: '#fde68a', fontWeight: 600,
                }}>
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
