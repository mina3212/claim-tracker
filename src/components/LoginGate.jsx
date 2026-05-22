import { useState } from 'react';
import { signIn, signUp, upsertProfile } from '../lib/supabase';
import { useToast } from '../context/ToastContext';

const DEPARTMENTS = ['영업팀', '마케팅팀', '품질기술팀', '영업관리팀'];

const FF = "'Inter','Nanum Gothic',sans-serif";

const inputStyle = {
  width: '100%', padding: '11px 14px',
  border: '1.5px solid #e2e8f0', borderRadius: 10,
  fontSize: 14, fontFamily: FF, outline: 'none',
  background: '#fff', color: '#1e293b', transition: 'border-color .15s',
  boxSizing: 'border-box',
};
const inputFocusStyle = { borderColor: '#3b82f6', boxShadow: '0 0 0 3px #dbeafe' };

function InputField({ label, required, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', fontFamily: FF }}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function FocusInput({ type = 'text', placeholder, value, onChange, autoFocus, required }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type} placeholder={placeholder} value={value} onChange={onChange}
      autoFocus={autoFocus} required={required}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ ...inputStyle, ...(focused ? inputFocusStyle : {}) }}
    />
  );
}

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
    if (!name.trim())         { setError('이름을 입력해 주세요.'); return; }
    if (!dept)                { setError('부서를 선택해 주세요.'); return; }
    if (password.length < 6)  { setError('비밀번호는 6자 이상이어야 합니다.'); return; }
    if (password !== confirm)  { setError('비밀번호가 일치하지 않습니다.'); return; }
    setLoading(true);
    try {
      const { data, error: err } = await signUp(email, password, name.trim());
      if (err) { setError(err.message); return; }
      if (data?.user?.id) await upsertProfile(data.user.id, name.trim(), dept, data.user.email).catch(() => {});
      toast('회원가입 완료', '로그인 되었습니다.', 'success');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', fontFamily: FF,
      background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 45%, #ecfdf5 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      {/* 배경 장식 원 */}
      <div style={{ position: 'fixed', top: -80, left: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(59,130,246,.08)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: -60, right: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(16,185,129,.07)', pointerEvents: 'none' }} />

      <div style={{
        display: 'flex', borderRadius: 24,
        overflow: 'hidden', width: '100%', maxWidth: 860,
        boxShadow: '0 32px 80px rgba(30,41,59,.13)', position: 'relative',
      }}>

        {/* ── 왼쪽 브랜딩 패널 ── */}
        <div style={{
          flex: '0 0 340px', background: 'linear-gradient(160deg, #1e40af 0%, #1d4ed8 40%, #2563eb 70%, #3b82f6 100%)',
          padding: '52px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          position: 'relative', overflow: 'hidden',
        }}
          className="login-brand-panel"
        >
          {/* 장식 원들 */}
          <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.07)' }} />
          <div style={{ position: 'absolute', bottom: 40, left: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,.05)' }} />
          <div style={{ position: 'absolute', bottom: -30, right: 40, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,.06)' }} />

          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🚨</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1.3, marginBottom: 10 }}>
              클레임 관리<br />시스템
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', lineHeight: 1.6 }}>
              AJW 고객사 클레임<br />통합 트래킹 플랫폼
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            {[
              { icon: '📋', text: '클레임 접수 및 단계 추적' },
              { icon: '📊', text: '고객사·품목별 심화 분석' },
              { icon: '🔔', text: '팀 협업 및 실시간 현황' },
            ].map(f => (
              <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: 'rgba(255,255,255,.15)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
                }}>
                  {f.icon}
                </div>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,.85)', fontWeight: 500 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 오른쪽 폼 패널 ── */}
        <div style={{ flex: 1, background: '#fff', padding: '48px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>

          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
              {tab === 'login' ? '로그인' : '회원가입'}
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              {tab === 'login' ? '계정 정보를 입력하여 로그인하세요' : '새 계정을 만들어 시작하세요'}
            </div>
          </div>

          {/* 탭 */}
          <div style={{
            display: 'flex', background: '#f1f5f9', borderRadius: 12,
            padding: 4, marginBottom: 28, gap: 4,
          }}>
            {[['login', '🔐 로그인'], ['signup', '✏️ 회원가입']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setTab(key); reset(); }}
                style={{
                  flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 600,
                  border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: FF,
                  background: tab === key ? '#fff' : 'transparent',
                  color: tab === key ? '#0f172a' : '#94a3b8',
                  boxShadow: tab === key ? '0 2px 8px rgba(0,0,0,.08)' : 'none',
                  transition: '.15s',
                }}
              >{label}</button>
            ))}
          </div>

          {/* 에러 */}
          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
              padding: '10px 14px', fontSize: 13, color: '#dc2626',
              marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* 로그인 폼 */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <InputField label="이메일" required>
                <FocusInput type="email" placeholder="example@ajw.co.kr" value={email} onChange={e => setEmail(e.target.value)} autoFocus required />
              </InputField>
              <InputField label="비밀번호" required>
                <FocusInput type="password" placeholder="비밀번호를 입력하세요" value={password} onChange={e => setPassword(e.target.value)} required />
              </InputField>
              <SubmitBtn loading={loading}>로그인</SubmitBtn>
            </form>
          )}

          {/* 회원가입 폼 */}
          {tab === 'signup' && (
            <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <InputField label="이름" required>
                  <FocusInput placeholder="홍길동" value={name} onChange={e => setName(e.target.value)} autoFocus required />
                </InputField>
                <InputField label="부서" required>
                  <DeptSelect value={dept} onChange={e => setDept(e.target.value)} />
                </InputField>
              </div>
              <InputField label="이메일" required>
                <FocusInput type="email" placeholder="example@ajw.co.kr" value={email} onChange={e => setEmail(e.target.value)} required />
              </InputField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <InputField label="비밀번호 (6자 이상)" required>
                  <FocusInput type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} required />
                </InputField>
                <InputField label="비밀번호 확인" required>
                  <FocusInput type="password" placeholder="재입력" value={confirm} onChange={e => setConfirm(e.target.value)} required />
                </InputField>
              </div>
              <SubmitBtn loading={loading}>회원가입</SubmitBtn>
            </form>
          )}

          <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: '#cbd5e1' }}>
            AJW 클레임 관리 시스템 · Powered by Supabase
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .login-brand-panel { display: none; }
        }
      `}</style>
    </div>
  );
}

function DeptSelect({ value, onChange }) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      value={value} onChange={onChange} required
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        ...inputStyle, cursor: 'pointer',
        ...(focused ? inputFocusStyle : {}),
      }}
    >
      <option value="">부서 선택</option>
      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
    </select>
  );
}

function SubmitBtn({ loading, children }) {
  return (
    <button
      type="submit" disabled={loading}
      style={{
        padding: '13px', marginTop: 4,
        background: loading ? '#93c5fd' : 'linear-gradient(135deg, #2563eb, #3b82f6)',
        color: '#fff', border: 'none', borderRadius: 12,
        fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
        fontFamily: FF, boxShadow: loading ? 'none' : '0 4px 14px rgba(59,130,246,.35)',
        transition: '.2s', letterSpacing: .3,
      }}
    >
      {loading ? '⏳ 처리 중...' : children}
    </button>
  );
}
