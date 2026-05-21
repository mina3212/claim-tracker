import { useState, useEffect } from 'react';
import { signIn, signUp, upsertProfile } from '../lib/supabase';
import { useToast } from '../context/ToastContext';

export default function AuthModal({ onClose }) {
  const toast = useToast();
  const [tab,      setTab]      = useState('login');   // 'login' | 'signup'
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [name,     setName]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // ESC 키로 닫기
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const reset = () => { setError(''); setPassword(''); setConfirm(''); };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: err } = await signIn(email, password);
      if (err) { setError(err.message); return; }
      toast('로그인 완료', '환영합니다!', 'success');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('이름을 입력해 주세요.'); return; }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return; }
    if (password !== confirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    setLoading(true);
    try {
      const { data, error: err } = await signUp(email, password, name.trim());
      if (err) { setError(err.message); return; }
      // 프로필 이름 저장
      if (data?.user?.id) {
        await upsertProfile(data.user.id, name.trim()).catch(() => {});
      }
      toast('회원가입 완료', '환영합니다! 이메일 인증이 필요할 수 있습니다.', 'success');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    /* backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,23,42,0.55)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* modal box */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, padding: '32px 36px',
          width: 420, boxShadow: '0 24px 60px rgba(0,0,0,.2)',
          position: 'relative',
        }}
      >
        {/* 닫기 */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 16,
            background: 'none', border: 'none', fontSize: 20,
            cursor: 'pointer', color: '#94a3b8', lineHeight: 1,
          }}
        >✕</button>

        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🚨</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>클레임 관리 시스템</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>관리자 계정으로 로그인하세요</div>
        </div>

        {/* 탭 */}
        <div style={{
          display: 'flex', borderRadius: 8, overflow: 'hidden',
          border: '1px solid #e2e8f0', marginBottom: 22,
        }}>
          {[['login', '로그인'], ['signup', '회원가입']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setTab(key); reset(); }}
              style={{
                flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 600,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: tab === key ? '#3b82f6' : '#f8fafc',
                color: tab === key ? '#fff' : '#64748b',
                transition: '.15s',
              }}
            >{label}</button>
          ))}
        </div>

        {/* 에러 */}
        {error && (
          <div style={{
            background: '#fee2e2', border: '1px solid #fecaca',
            borderRadius: 8, padding: '10px 14px', fontSize: 13,
            color: '#991b1b', marginBottom: 14,
          }}>{error}</div>
        )}

        {/* 로그인 폼 */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label>이메일</label>
              <input
                type="email"
                placeholder="example@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>비밀번호</label>
              <input
                type="password"
                placeholder="비밀번호 입력"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '10px', marginTop: 4 }}
            >
              {loading ? '⏳ 로그인 중...' : '🔐 로그인'}
            </button>
          </form>
        )}

        {/* 회원가입 폼 */}
        {tab === 'signup' && (
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label>이름 <span className="required-star">*</span></label>
              <input
                placeholder="홍길동"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>이메일 <span className="required-star">*</span></label>
              <input
                type="email"
                placeholder="example@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>비밀번호 <span style={{ fontSize: 10, color: '#94a3b8' }}>(6자 이상)</span></label>
              <input
                type="password"
                placeholder="비밀번호 입력"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>비밀번호 확인</label>
              <input
                type="password"
                placeholder="비밀번호 재입력"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '10px', marginTop: 4 }}
            >
              {loading ? '⏳ 처리 중...' : '✅ 회원가입'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
