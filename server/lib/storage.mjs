import path from 'path';
import fs from 'fs';

// 저장 위치: 앱허브 컨테이너는 영속 볼륨 /data, 로컬 개발은 ./dev-data.
// NODE_ENV 에 의존하지 않는다(쿠키 secure 설정과 얽히면 안 됨). /data 볼륨이
// 존재하면 그걸 쓰고, 없으면(로컬) dev-data 로 폴백. STORAGE_DIR 로 강제 지정 가능.
const BASE_DIR = process.env.STORAGE_DIR
  || (fs.existsSync('/data') ? '/data' : path.resolve(process.cwd(), 'dev-data'));

export function getStoragePath(relPath) {
  return path.join(BASE_DIR, relPath);
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function deleteFile(relPath) {
  const abs = getStoragePath(relPath);
  if (fs.existsSync(abs)) fs.unlinkSync(abs);
}

export { BASE_DIR };
