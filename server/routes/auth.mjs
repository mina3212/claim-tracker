import express from 'express';
import crypto from 'crypto';
import { one, run } from '../lib/db.mjs';

const router = express.Router();

const PORTAL_PUBLIC_URL   = process.env.PORTAL_PUBLIC_URL  || '';
const PORTAL_INTERNAL_URL = process.env.PORTAL_INTERNAL_URL || PORTAL_PUBLIC_URL;
const APP_PUBLIC_URL      = process.env.APP_PUBLIC_URL     || `http://localhost:${process.env.PORT || 3000}`;
const CLIENT_ID           = process.env.OAUTH_CLIENT_ID    || '';
const CLIENT_SECRET       = process.env.OAUTH_CLIENT_SECRET || '';

const DEV_EMAIL = process.env.DEV_AUTO_LOGIN_EMAIL || '';
const DEV_NAME  = process.env.DEV_AUTO_LOGIN_NAME  || 'Dev User';

function makeUserObj(email, name) {
  return {
    id:            email,
    email,
    user_metadata: { name },
  };
}

// GET /auth/me  →  현재 세션 정보
router.get('/me', async (req, res) => {
  if (req.session.user) return res.json(req.session.user);

  // 개발 자동 로그인
  if (DEV_EMAIL) {
    req.session.user = makeUserObj(DEV_EMAIL, DEV_NAME);
    return res.json(req.session.user);
  }

  res.status(401).json({ error: 'Not authenticated' });
});

// GET /auth/login  →  Portal OAuth 시작 (개발 환경: dev-login 폼)
router.get('/login', (req, res) => {
  if (DEV_EMAIL) {
    // 개발 모드: 자동 로그인 후 홈으로
    req.session.user = makeUserObj(DEV_EMAIL, DEV_NAME);
    return res.redirect('/');
  }
  if (!PORTAL_PUBLIC_URL || !CLIENT_ID) {
    return res.status(500).send('PORTAL_PUBLIC_URL 또는 OAUTH_CLIENT_ID 환경변수가 설정되지 않았습니다.');
  }
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     CLIENT_ID,
    redirect_uri:  `${APP_PUBLIC_URL}/auth/callback`,
    scope:         'openid email profile',
    state,
  });
  res.redirect(`${PORTAL_PUBLIC_URL}/api/oauth/authorize?${params}`);
});

// GET /auth/callback  →  Portal OAuth 콜백
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).send('인증 코드 없음');

  if (state !== req.session.oauthState) {
    return res.status(400).send('OAuth state 불일치 (CSRF 방지)');
  }
  req.session.oauthState = undefined;

  try {
    // 토큰 교환
    const tokenRes = await fetch(`${PORTAL_INTERNAL_URL}/api/oauth/token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  `${APP_PUBLIC_URL}/auth/callback`,
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    });
    if (!tokenRes.ok) throw new Error('Token exchange failed');
    const tokens = await tokenRes.json();

    // 사용자 정보 조회
    const userRes = await fetch(`${PORTAL_INTERNAL_URL}/api/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userRes.ok) throw new Error('Userinfo fetch failed');
    const info = await userRes.json();

    const email = info.email || info.sub;
    const name  = info.name  || info.preferred_username || email;

    req.session.user = makeUserObj(email, name);

    // 프로필이 없으면 자동 생성
    const existing = await one('SELECT id FROM profiles WHERE id = $1', [email]);
    if (!existing) {
      await run(
        'INSERT INTO profiles (id, name, email) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING',
        [email, name, email]
      );
    }

    res.redirect('/');
  } catch (e) {
    console.error('[auth/callback]', e);
    res.status(500).send('로그인 처리 중 오류가 발생했습니다.');
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

export default router;
