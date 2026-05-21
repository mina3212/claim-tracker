import { useState } from 'react';
import { signIn, signUp, upsertProfile } from '../lib/supabase';
import { useToast } from '../context/ToastContext';

const DEPARTMENTS = ['영업팀', '마케팅팀', '품질기술팀', '영업관리팀'];

export default function LoginGate() {
  const toast = useToast();
  const [tab,      setTab]      = useState('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [name,     setName]     = useState('');
  const [dept,     setDept]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const reset = () => { setError(''); setPassword(''); setConfirm(''); };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: err } = await signIn(email, password);
      if (err) { setError('이메일 또는 비밀번호가 올바르지 않습니다.'); return; }
      toast('로그인 완료', '환영합니다!', 'success');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim())   { setError('이름을 입력해 주세요.'); return; }
    if (!dept)          { setError('부서를 선택해 주세요.'); return; }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return; }
    if (password !== confirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    setLoading(true);
    try {
      const { data, error: err } = await signUp(email, password, name.trim());
      if (err) { setError(err.message); return; }
      if (data?.user?.id) {
        await upsertProfile(data.user.id, name.trim(), dept).catch(() => {});
      }
      toast('회원가입 완료', '로그인 되었습니다.', 'success');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#f1f5f9',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Helvetica Neue','Nanum Gothic',Arial,sans-serif",
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '44px 48px',
        width: 460, boxShadow: '0 20px 60px rgba(0,0,0,.12)',
      }}>
        {/* 로고 */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🚨</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>클레임 관리 시스템</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>
            AJW 고객사 클레임 트래커
          </div>
        </div>

        {/* 탭 */}
        <div style={{
          display: 'flex', borderRadius: 10, overflow: 'hidden',
          border: '1px solid #e2e8f0', marginBottom: 24,
        }}>
          {[['login', '로그인'], ['signup', '회원가입']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setTab(key); reset(); }}
              style={{
                flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 600,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: tab === key ? '#1e293b' : '#f8fafc',
                color: tab === key ? '#fff' : '#64748b',
                transition: '.15s',
              }}
            >{label}</button>
          ))}
        </div>

        {/* 에러 */}
        {error && (
          <div style={{
            background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8,
            padding: '10px 14px', fontSize: 13, color: '#991b1b', marginBottom: 16,
          }}>{error}</div>
        )}

        {/* 로그인 */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="이메일">
              <input type="email" placeholder="example@ajw.co.kr"
                value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            </Field>
            <Field label="비밀번호">
              <input type="password" placeholder="비밀번호 입력"
                value={password} onChange={e => setPassword(e.target.value)} required />
            </Field>
            <Btn loading={loading}>🔐 로그인</Btn>
          </form>
        )}

        {/* 회원가입 */}
        {tab === 'signup' && (
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="이름 *">
                <input placeholder="홍길동"
                  value={name} onChange={e => setName(e.target.value)} required autoFocus />
              </Field>
              <Field label="부서 *">
                <select value={dept} onChange={e => setDept(e.target.value)} required
                  style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff', cursor: 'pointer' }}>
                  <option value="">부서 선택</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
            </div>
            <Field label="이메일 *">
              <input type="email" placeholder="example@ajw.co.kr"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="비밀번호 * (6자 이상)">
                <input type="password" placeholder="비밀번호"
                  value={password} onChange={e => setPassword(e.target.value)} required />
              </Field>
              <Field label="비밀번호 확인 *">
                <input type="password" placeholder="재입력"
                  value={confirm} onChange={e => setConfirm(e.target.value)} required />
              </Field>
            </div>
            <Btn loading={loading}>✅ 회원가입</Btn>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>{label}</label>
      <div style={{ display: 'contents' }}>
        {children}
      </div>
    </div>
  );
}

function Btn({ loading, children }) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        padding: '11px', background: '#3b82f6', color: '#fff',
        border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .7 : 1,
        fontFamily: 'inherit', marginTop: 4,
      }}
    >
      {loading ? '⏳ 처리 중...' : children}
    </button>
  );
}
