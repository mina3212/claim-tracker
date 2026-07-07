import { useState } from 'react';
import { sb } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const FF = "'Inter','Nanum Gothic',sans-serif";
const inputStyle = {
  width: '100%', padding: '11px 14px',
  border: '1.5px solid #e2e8f0', borderRadius: 10,
  fontSize: 14, fontFamily: FF, outline: 'none',
  background: '#fff', color: '#1e293b', transition: 'border-color .15s',
  boxSizing: 'border-box',
};

export default function PasswordResetPage() {
  const { setIsPasswordRecovery } = useAuth();
  const toast = useToast();
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [done,      setDone]      = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return; }
    if (password !== confirm)  { setError('비밀번호가 일치하지 않습니다.'); return; }
    setLoading(true);
    try {
      const { error: err } = await sb.auth.updateUser({ password });
      if (err) { setError('비밀번호 변경에 실패했습니다. 다시 시도해 주세요.'); return; }
      setDone(true);
      toast('비밀번호 변경 완료', '새 비밀번호로 로그인되었습니다.', 'success');
      setTimeout(() => setIsPasswordRecovery(false), 1500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', fontFamily: FF,
      background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 45%, #ecfdf5 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '48px 40px',
        width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(30,41,59,.12)',
      }}>
        {done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
              비밀번호 변경 완료
            </div>
            <div style={{ fontSize: 13, color: '#64748b' }}>잠시 후 이동합니다...</div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔑</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                새 비밀번호 설정
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>
                새로 사용할 비밀번호를 입력해 주세요
              </div>
            </div>

            {error && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
                padding: '10px 14px', fontSize: 13, color: '#dc2626',
                marginBottom: 20,
              }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                  새 비밀번호 (6자 이상) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="password" placeholder="새 비밀번호" value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoFocus required style={inputStyle}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                  비밀번호 확인 <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="password" placeholder="비밀번호 재입력" value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required style={inputStyle}
                />
              </div>
              <button
                type="submit" disabled={loading}
                style={{
                  padding: '13px', marginTop: 4,
                  background: loading ? '#93c5fd' : 'linear-gradient(135deg, #2563eb, #3b82f6)',
                  color: '#fff', border: 'none', borderRadius: 12,
                  fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: FF, boxShadow: loading ? 'none' : '0 4px 14px rgba(59,130,246,.35)',
                  transition: '.2s',
                }}
              >
                {loading ? '⏳ 변경 중...' : '비밀번호 변경'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
