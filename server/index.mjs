import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import authRouter from './routes/auth.mjs';
import apiRouter  from './routes/api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);

// .env 및 .db-credentials 로드 (로컬 개발용 — 운영은 환경변수 자동 주입)
const { readFileSync } = await import('fs');
for (const fname of ['.env', '.db-credentials']) {
  try {
    const content = readFileSync(path.resolve(process.cwd(), fname), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (key && !process.env[key]) process.env[key] = val;
    }
    console.log(`[server] ${fname} 로드됨`);
  } catch { /* 파일 없으면 무시 */ }
}

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret:            process.env.SESSION_SECRET || 'dev-secret-please-change-in-prod',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   24 * 60 * 60 * 1000,
  },
}));

// ── Health check (인증 불필요) ────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

// ── Auth routes ───────────────────────────────────────────────
app.use('/auth', authRouter);

// ── 인증 미들웨어 ─────────────────────────────────────────────
const DEV_EMAIL = process.env.DEV_AUTO_LOGIN_EMAIL || '';

function requireAuth(req, res, next) {
  if (req.session.user) return next();

  if (DEV_EMAIL) {
    req.session.user = {
      id:            DEV_EMAIL,
      email:         DEV_EMAIL,
      user_metadata: { name: process.env.DEV_AUTO_LOGIN_NAME || 'Dev User' },
    };
    return next();
  }

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.redirect('/auth/login');
}

// ── API routes (인증 필수) ────────────────────────────────────
app.use('/api', requireAuth, apiRouter);

// ── Static 파일 서빙 (빌드된 React 앱) ───────────────────────
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// ── SPA fallback ──────────────────────────────────────────────
app.get('*', (req, res) => {
  if (!req.session.user && !DEV_EMAIL) {
    return res.redirect('/auth/login');
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] 포트 ${PORT} 에서 기동 중`);
  console.log(`[server] 개발 자동 로그인: ${DEV_EMAIL || '없음 (Portal SSO 사용)'}`);
});
