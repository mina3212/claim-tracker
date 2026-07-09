/**
 * Supabase Storage → dev-data/ 파일 다운로드 스크립트
 *
 * 사용법:
 *   node scripts/migrate-storage.mjs
 *   node scripts/migrate-storage.mjs <service_role_key>   ← private 버킷이면 필요
 *
 * 다운로드된 파일은 dev-data/ 에 저장됩니다.
 * 이 폴더를 서버의 /data/ 에 복사하면 이관 완료입니다.
 */

import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

// ── 접속 정보 ────────────────────────────────────────────────────
const SUPABASE_URL = 'https://kwryojcreaajcbvblwhl.supabase.co';

// 1) CLI 인수로 서비스 롤 키 주입 가능
// 2) 없으면 .env 의 anon 키 사용 (private 버킷은 권한 오류 가능)
let KEY = process.argv[2]?.trim() || '';
if (!KEY) {
  try {
    const env = readFileSync(path.join(ROOT, '.env'), 'utf8');
    for (const line of env.split('\n')) {
      const m = line.match(/^VITE_SUPABASE_KEY=(.+)$/);
      if (m) { KEY = m[1].trim(); break; }
    }
  } catch { /* ignore */ }
}
if (!KEY) { console.error('[오류] SUPABASE_KEY를 찾을 수 없습니다.'); process.exit(1); }

const BUCKETS  = ['supplier-attachments', 'stage-images'];
const DEST_DIR = path.join(ROOT, 'dev-data');

const authHeaders = { Authorization: `Bearer ${KEY}`, apikey: KEY };

// ── Supabase Storage API 헬퍼 ────────────────────────────────────

async function listFiles(bucket, prefix = '') {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
    method:  'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ prefix, limit: 1000, offset: 0 }),
  });
  if (!res.ok) throw new Error(`List failed [${res.status}]: ${await res.text()}`);
  return res.json();
}

async function collectFiles(bucket, prefix = '') {
  const items = await listFiles(bucket, prefix);
  const files = [];
  for (const item of items) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (!item.id) {
      // 폴더 — 재귀 탐색
      files.push(...await collectFiles(bucket, fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

async function downloadFile(bucket, storagePath, destPath) {
  // 경로에 슬래시가 포함되므로 %2F 는 다시 /로 되돌림
  const encoded = storagePath.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${encoded}`, {
    headers: authHeaders,
  });
  if (!res.ok) throw new Error(`${res.status} — ${await res.text()}`);
  mkdirSync(path.dirname(destPath), { recursive: true });
  writeFileSync(destPath, Buffer.from(await res.arrayBuffer()));
}

// ── 메인 ─────────────────────────────────────────────────────────

async function processBucket(bucket) {
  console.log(`\n[${bucket}] 파일 목록 수집 중...`);
  let files;
  try {
    files = await collectFiles(bucket);
  } catch (e) {
    if (e.message.includes('404') || e.message.includes('not found')) {
      console.log(`  → 버킷 없음 (건너뜀)`);
      return { ok: 0, skip: 0, fail: 0 };
    }
    if (e.message.includes('400') || e.message.includes('403') || e.message.includes('401')) {
      console.log(`  → 접근 거부: ${e.message}`);
      console.log('  → 서비스 롤 키가 필요합니다 (아래 안내 참고)');
      return { ok: 0, skip: 0, fail: -1 };
    }
    throw e;
  }

  if (!files.length) {
    console.log('  → 파일 없음');
    return { ok: 0, skip: 0, fail: 0 };
  }
  console.log(`  → ${files.length}개 파일 발견`);

  let ok = 0, skip = 0, fail = 0;
  for (const fp of files) {
    const destPath = path.join(DEST_DIR, fp);
    if (existsSync(destPath)) {
      process.stdout.write(`  [skip] ${fp}\n`);
      skip++;
      continue;
    }
    try {
      await downloadFile(bucket, fp, destPath);
      process.stdout.write(`  [ok]   ${fp}\n`);
      ok++;
    } catch (e) {
      process.stdout.write(`  [err]  ${fp}: ${e.message}\n`);
      fail++;
    }
  }
  return { ok, skip, fail };
}

async function main() {
  const keyType = process.argv[2] ? '서비스 롤 키' : 'Anon 키 (private 버킷은 권한 오류 가능)';
  console.log(`[migrate-storage] ${keyType} 사용`);
  console.log(`저장 경로: ${DEST_DIR}`);

  let needServiceKey = false;
  let totalOk = 0;

  for (const bucket of BUCKETS) {
    const r = await processBucket(bucket);
    if (r.fail === -1) needServiceKey = true;
    totalOk += r.ok;
  }

  console.log(`\n─────────────────────────────────`);
  console.log(`총 ${totalOk}개 파일 다운로드 완료`);
  console.log(`저장 위치: ${DEST_DIR}`);

  if (needServiceKey) {
    console.log(`
┌─ 권한 오류 해결법 ─────────────────────────────────────────────────┐
│ Supabase 버킷이 private 입니다. 서비스 롤 키가 필요합니다.          │
│                                                                       │
│ 1. Supabase 대시보드 → Project Settings → API                        │
│ 2. "service_role" 키 복사                                             │
│ 3. 아래 명령 실행:                                                    │
│                                                                       │
│   node scripts/migrate-storage.mjs <service_role_key>                │
│                                                                       │
│ ⚠️  서비스 롤 키는 절대 git 커밋 금지                                │
└───────────────────────────────────────────────────────────────────────┘`);
    process.exit(1);
  }

  if (totalOk > 0) {
    console.log(`
다음 단계:
  dev-data/ 폴더를 맥미니 앱 폴더의 /data/ 에 복사하면 이관 완료입니다.

  Finder에서: dev-data/ 폴더 내용 → 맥미니 /data/ 에 붙여넣기
  또는 rsync 사용:
    rsync -av dev-data/ <서버주소>:/data/`);
  }
}

main().catch(e => { console.error('[오류]', e.message); process.exit(1); });
