import path from 'path';
import fs from 'fs';

// Production: /data/  |  Dev local: ./dev-data/
const BASE_DIR = process.env.NODE_ENV === 'production'
  ? '/data'
  : path.resolve(process.cwd(), 'dev-data');

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
