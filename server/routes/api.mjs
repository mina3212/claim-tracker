import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { q, one, run } from '../lib/db.mjs';
import { getStoragePath, ensureDir, deleteFile } from '../lib/storage.mjs';

const router = express.Router();

const uid = () => crypto.randomUUID();

// ── 파일 업로드 설정 ──────────────────────────────────────────
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const type   = req.uploadType || 'supplier-file';
    const claimId = req.body.claimId || req.query.claimId || 'unknown';
    const relDir  = type === 'stage-image'
      ? `stage-images/${claimId}`
      : `uploads/${claimId}`;
    const absDir  = getStoragePath(relDir);
    ensureDir(absDir);
    req.relDir = relDir;
    cb(null, absDir);
  },
  filename(req, file, cb) {
    const ext      = path.extname(file.originalname);
    const filename = `${uid()}${ext}`;
    req.savedFilename = filename;
    cb(null, filename);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// ── Profiles ──────────────────────────────────────────────────

router.get('/profiles/notify-emails', async (req, res) => {
  try {
    const rows = await q(
      "SELECT email FROM profiles WHERE (is_admin = true OR department = '품질기술팀') AND email IS NOT NULL"
    );
    res.json(rows.map(r => r.email).filter(Boolean));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/profiles/:id', async (req, res) => {
  try {
    const row = await one('SELECT * FROM profiles WHERE id = $1', [req.params.id]);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/profiles', async (req, res) => {
  try {
    const { id, name, department, email } = req.body;
    await run(
      `INSERT INTO profiles (id, name, department, email)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET
         name       = EXCLUDED.name,
         department = COALESCE(EXCLUDED.department, profiles.department),
         email      = COALESCE(EXCLUDED.email, profiles.email)`,
      [id, name || '', department || null, email || null]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/profiles/:id/email', async (req, res) => {
  try {
    const { email } = req.body;
    await run('UPDATE profiles SET email = $1 WHERE id = $2', [email, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Claims ────────────────────────────────────────────────────

router.get('/claims', async (req, res) => {
  try {
    const rows = await q('SELECT * FROM claims ORDER BY receipt_date DESC NULLS LAST, created_at DESC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/claims', async (req, res) => {
  try {
    const { claim, firstEntry } = req.body;
    const c = claim;
    await run(
      `INSERT INTO claims
         (id,customer_group,customer_name,part_number,part_name,product_type,product_category,
          quantity,defect_quantity,lot_number,shipping_warehouse,shipping_date,shipments,
          defect_description,occurrence_date,receipt_date,sales_rep_dept,sales_rep_name,
          sales_rep_contact,current_stage,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [c.id,c.customer_group||null,c.customer_name,c.part_number||null,c.part_name||null,
       c.product_type||null,c.product_category||null,c.quantity||null,c.defect_quantity||null,
       c.lot_number||null,c.shipping_warehouse||null,c.shipping_date||null,
       c.shipments ? JSON.stringify(c.shipments) : null,
       c.defect_description||null,c.occurrence_date||null,c.receipt_date||null,
       c.sales_rep_dept||null,c.sales_rep_name||null,c.sales_rep_contact||null,
       c.current_stage||'1차 대응',c.created_at||new Date().toISOString()]
    );
    const e = firstEntry;
    await run(
      `INSERT INTO claim_stages
         (id,claim_id,stage_name,stage_date,description,handler,handler_dept,user_id,user_email,user_name,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [e.id,e.claim_id,e.stage_name,e.stage_date||null,e.description||'',e.handler||'',
       e.handler_dept||'',e.user_id||null,e.user_email||null,e.user_name||null,
       e.created_at||new Date().toISOString()]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/claims/:id/advance', async (req, res) => {
  try {
    const { currentStage, nextStage, entry, closeEntry } = req.body;
    await run('UPDATE claims SET current_stage = $1 WHERE id = $2', [nextStage, req.params.id]);
    const insertEntry = async (en) => {
      await run(
        `INSERT INTO claim_stages
           (id,claim_id,stage_name,stage_date,description,handler,handler_dept,user_id,user_email,user_name,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [en.id,en.claim_id,en.stage_name,en.stage_date||null,en.description||'',en.handler||'',
         en.handler_dept||'',en.user_id||null,en.user_email||null,en.user_name||null,
         en.created_at||new Date().toISOString()]
      );
    };

    // 중복 체크
    const existing = await q(
      'SELECT id FROM claim_stages WHERE claim_id = $1 AND stage_name = $2 LIMIT 1',
      [req.params.id, currentStage]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: `"${currentStage}" 단계는 이미 등록된 건입니다.` });
    }

    await insertEntry(entry);
    if (closeEntry) await insertEntry(closeEntry);
    res.json({ ok: true });
  } catch (e) {
    if (e.message.includes('이미 등록')) return res.status(409).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});

router.put('/claims/:id', async (req, res) => {
  try {
    const data = req.body;
    const keys  = Object.keys(data);
    const vals  = keys.map(k => data[k]);
    const set   = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    await run(`UPDATE claims SET ${set} WHERE id = $${keys.length + 1}`, [...vals, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/claims/:id', async (req, res) => {
  try {
    await run('DELETE FROM claims WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Claim Stages ──────────────────────────────────────────────

router.get('/claim-stages', async (req, res) => {
  try {
    const rows = await q('SELECT * FROM claim_stages ORDER BY created_at');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/claim-stages/:id', async (req, res) => {
  try {
    const { stage_date, description, handler, handler_dept } = req.body;
    await run(
      'UPDATE claim_stages SET stage_date=$1,description=$2,handler=$3,handler_dept=$4 WHERE id=$5',
      [stage_date||null, description||'', handler||'', handler_dept||'', req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Delete Requests ───────────────────────────────────────────

router.get('/delete-requests', async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const rows   = await q(
      'SELECT * FROM delete_requests WHERE status = $1 ORDER BY created_at', [status]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/delete-requests', async (req, res) => {
  try {
    const { id, claim_id, requester_email, requester_name, reason, status, created_at } = req.body;
    await run(
      `INSERT INTO delete_requests (id,claim_id,requester_email,requester_name,reason,status,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id,claim_id,requester_email||null,requester_name||null,reason,'pending',created_at||new Date().toISOString()]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/delete-requests/:id', async (req, res) => {
  try {
    const { status } = req.body;
    await run('UPDATE delete_requests SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Parts ─────────────────────────────────────────────────────

router.get('/parts/search', async (req, res) => {
  try {
    const q_ = (req.query.q || '').trim();
    if (!q_) return res.json([]);
    const rows = await q(
      `SELECT id,part_number,part_name FROM parts
       WHERE part_number ILIKE $1 OR part_name ILIKE $1
       ORDER BY part_number LIMIT 20`,
      [`%${q_}%`]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/parts', async (req, res) => {
  try {
    const rows = await q('SELECT * FROM parts ORDER BY part_number');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/parts/upsert', async (req, res) => {
  try {
    const { rows } = req.body;
    if (!rows || !rows.length) return res.json({ ok: true });
    const values = rows.map((r, i) => `($${i*4+1},$${i*4+2},$${i*4+3},$${i*4+4})`).join(',');
    const params = rows.flatMap(r => [r.id, r.part_number, r.part_name, r.spec || null]);
    await run(
      `INSERT INTO parts (id,part_number,part_name,spec) VALUES ${values}
       ON CONFLICT (part_number) DO UPDATE SET part_name=EXCLUDED.part_name, spec=EXCLUDED.spec`,
      params
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/parts/:id', async (req, res) => {
  try {
    if (req.params.id === '__all__') {
      await run("DELETE FROM parts WHERE id <> ''");
    } else {
      await run('DELETE FROM parts WHERE id = $1', [req.params.id]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Suppliers ─────────────────────────────────────────────────

router.get('/suppliers/search', async (req, res) => {
  try {
    const q_ = (req.query.q || '').trim();
    if (!q_) return res.json([]);
    const rows = await q(
      'SELECT id,name FROM suppliers WHERE name ILIKE $1 ORDER BY name LIMIT 20',
      [`%${q_}%`]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/suppliers', async (req, res) => {
  try {
    const rows = await q('SELECT * FROM suppliers ORDER BY name');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/suppliers/upsert', async (req, res) => {
  try {
    const { rows } = req.body;
    if (!rows || !rows.length) return res.json({ ok: true });
    const values = rows.map((r, i) => `($${i*2+1},$${i*2+2})`).join(',');
    const params = rows.flatMap(r => [r.id, r.name]);
    await run(
      `INSERT INTO suppliers (id,name) VALUES ${values}
       ON CONFLICT (name) DO NOTHING`,
      params
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/suppliers/:id', async (req, res) => {
  try {
    if (req.params.id === '__all__') {
      await run("DELETE FROM suppliers WHERE id <> ''");
    } else {
      await run('DELETE FROM suppliers WHERE id = $1', [req.params.id]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 공급사명 자동완성 (supplier_claims 테이블에서)
router.get('/supplier-names/search', async (req, res) => {
  try {
    const q_ = (req.query.q || '').trim();
    if (!q_) return res.json([]);
    const rows = await q(
      'SELECT DISTINCT supplier_name FROM supplier_claims WHERE supplier_name ILIKE $1 ORDER BY supplier_name LIMIT 15',
      [`%${q_}%`]
    );
    res.json(rows.map(r => r.supplier_name).filter(Boolean));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Supplier Claims ───────────────────────────────────────────

router.get('/supplier-claims', async (req, res) => {
  try {
    const rows = await q('SELECT * FROM supplier_claims ORDER BY receipt_date DESC NULLS LAST, created_at DESC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/supplier-claims', async (req, res) => {
  try {
    const c = req.body;
    await run(
      `INSERT INTO supplier_claims
         (id,supplier_name,purchase_dept,incoming_date,incoming_lot_no,part_number,part_name,
          quantity,inspection_quantity,product_type,product_category,inspection_stage,
          cavity_total,cavity_defective,defect_quantity,defect_type,defect_description,
          disposition,notes,handler_name,handler_dept,handler_contact,
          return_status,improvement_status,corrective_action_type,corrective_action_detail,
          current_stage,occurrence_date,receipt_date,lot_number,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
               $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)`,
      [c.id,c.supplier_name,c.purchase_dept||null,c.incoming_date||null,c.incoming_lot_no||null,
       c.part_number||null,c.part_name||null,c.quantity||null,c.inspection_quantity||null,
       c.product_type||null,c.product_category||null,c.inspection_stage||null,
       c.cavity_total||null,c.cavity_defective||null,c.defect_quantity||null,
       c.defect_type||null,c.defect_description||null,c.disposition||null,c.notes||null,
       c.handler_name||null,c.handler_dept||null,c.handler_contact||null,
       c.return_status||'미결',c.improvement_status||'미조치',
       c.corrective_action_type||null,c.corrective_action_detail||null,
       c.current_stage||'접수',c.occurrence_date||null,c.receipt_date||null,
       c.lot_number||null,c.created_at||new Date().toISOString()]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/supplier-claims/:id/advance', async (req, res) => {
  try {
    const { currentStage, nextStage, entry, closeEntry } = req.body;

    // 중복 체크
    const existing = await q(
      'SELECT id FROM supplier_claim_stages WHERE claim_id = $1 AND stage_name = $2 LIMIT 1',
      [req.params.id, currentStage]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: `"${currentStage}" 단계는 이미 등록된 건입니다.` });
    }

    await run('UPDATE supplier_claims SET current_stage = $1 WHERE id = $2', [nextStage, req.params.id]);
    const insertEntry = async (en) => {
      await run(
        `INSERT INTO supplier_claim_stages
           (id,claim_id,stage_name,stage_date,description,handler,handler_dept,user_id,user_email,user_name,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [en.id,en.claim_id,en.stage_name,en.stage_date||null,en.description||'',en.handler||'',
         en.handler_dept||'',en.user_id||null,en.user_email||null,en.user_name||null,
         en.created_at||new Date().toISOString()]
      );
    };
    await insertEntry(entry);
    if (closeEntry) await insertEntry(closeEntry);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/supplier-claims/:id', async (req, res) => {
  try {
    const data = req.body;
    const keys  = Object.keys(data);
    const vals  = keys.map(k => data[k]);
    const set   = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    await run(`UPDATE supplier_claims SET ${set} WHERE id = $${keys.length + 1}`, [...vals, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/supplier-claims/:id', async (req, res) => {
  try {
    await run('DELETE FROM supplier_claims WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Supplier Claim Stages ─────────────────────────────────────

router.get('/supplier-claim-stages', async (req, res) => {
  try {
    const rows = await q('SELECT * FROM supplier_claim_stages ORDER BY created_at');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/supplier-claim-stages/:id', async (req, res) => {
  try {
    const { stage_date, description, handler, handler_dept } = req.body;
    await run(
      'UPDATE supplier_claim_stages SET stage_date=$1,description=$2,handler=$3,handler_dept=$4 WHERE id=$5',
      [stage_date||null, description||'', handler||'', handler_dept||'', req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Improvement Logs ──────────────────────────────────────────

router.get('/improvement-logs', async (req, res) => {
  try {
    const claimId = req.query.claim_id;
    const rows = claimId
      ? await q('SELECT * FROM supplier_improvement_logs WHERE supplier_claim_id = $1 ORDER BY created_at', [claimId])
      : await q('SELECT * FROM supplier_improvement_logs ORDER BY created_at');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/improvement-logs', async (req, res) => {
  try {
    const l = req.body;
    await run(
      `INSERT INTO supplier_improvement_logs
         (id,supplier_claim_id,incoming_lot_no,incoming_date,quantity,defect_quantity,
          is_improved,notes,handler,handler_dept,user_id,user_email,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [l.id,l.supplier_claim_id,l.incoming_lot_no||'',l.incoming_date||null,
       l.quantity||null,l.defect_quantity||null,l.is_improved||'확인중',l.notes||'',
       l.handler||'',l.handler_dept||'',l.user_id||null,l.user_email||null,
       l.created_at||new Date().toISOString()]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/improvement-logs/:id', async (req, res) => {
  try {
    const data = req.body;
    const keys  = Object.keys(data);
    const vals  = keys.map(k => data[k]);
    const set   = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    await run(`UPDATE supplier_improvement_logs SET ${set} WHERE id = $${keys.length + 1}`, [...vals, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/improvement-logs/:id', async (req, res) => {
  try {
    await run('DELETE FROM supplier_improvement_logs WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Supplier Claim Files ──────────────────────────────────────

router.get('/supplier-files/claim-ids', async (req, res) => {
  try {
    const rows = await q('SELECT DISTINCT claim_id FROM supplier_claim_files');
    res.json([...new Set(rows.map(r => r.claim_id))]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/supplier-files', async (req, res) => {
  try {
    const { claim_id } = req.query;
    const rows = claim_id
      ? await q('SELECT * FROM supplier_claim_files WHERE claim_id = $1 ORDER BY created_at', [claim_id])
      : await q('SELECT * FROM supplier_claim_files ORDER BY created_at');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/supplier-files', async (req, res) => {
  try {
    const f = req.body;
    await run(
      `INSERT INTO supplier_claim_files
         (id,claim_id,file_name,file_path,file_size,file_type,uploaded_by_email,uploaded_by_name,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [f.id,f.claim_id,f.file_name||null,f.file_path||null,f.file_size||null,
       f.file_type||null,f.uploaded_by_email||null,f.uploaded_by_name||null,
       f.created_at||new Date().toISOString()]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/supplier-files/:id', async (req, res) => {
  try {
    const row = await one('SELECT file_path FROM supplier_claim_files WHERE id = $1', [req.params.id]);
    if (row?.file_path) {
      try { deleteFile(row.file_path); } catch { /* 파일 없어도 계속 */ }
    }
    await run('DELETE FROM supplier_claim_files WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── File Upload ───────────────────────────────────────────────

router.post('/upload/supplier-file', (req, res, next) => {
  req.uploadType = 'supplier-file';
  next();
}, upload.single('file'), async (req, res) => {
  try {
    const relPath = `${req.relDir}/${req.savedFilename}`;
    res.json({
      path: relPath,
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/upload/stage-image', (req, res, next) => {
  req.uploadType = 'stage-image';
  next();
}, upload.single('file'), async (req, res) => {
  try {
    const relPath = `${req.relDir}/${req.savedFilename}`;
    res.json({ url: `/api/files/${relPath}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── File Serving ──────────────────────────────────────────────

router.get('/files/*', (req, res) => {
  const relPath = req.params[0];
  const absPath = getStoragePath(relPath);
  if (!fs.existsSync(absPath)) return res.status(404).json({ error: '파일 없음' });
  res.sendFile(absPath);
});

// ── Download Logs ─────────────────────────────────────────────

router.post('/download-logs', async (req, res) => {
  try {
    const l = req.body;
    await run(
      `INSERT INTO file_download_logs
         (id,file_id,claim_id,file_name,downloader_email,downloader_name,downloaded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [l.id,l.file_id||null,l.claim_id||null,l.file_name||null,
       l.downloader_email||null,l.downloader_name||null,
       l.downloaded_at||new Date().toISOString()]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/download-logs', async (req, res) => {
  try {
    const { claim_id } = req.query;
    const rows = claim_id
      ? await q('SELECT * FROM file_download_logs WHERE claim_id = $1 ORDER BY downloaded_at DESC', [claim_id])
      : await q('SELECT * FROM file_download_logs ORDER BY downloaded_at DESC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Presence (polling 방식) ────────────────────────────────────

const presenceMap = new Map();  // email → { ...info, ts }
const PRESENCE_TTL = 90 * 1000; // 90초

router.post('/presence/heartbeat', (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  presenceMap.set(user.email, {
    user_id:      user.id,
    display_name: req.body.display_name || user.email,
    department:   req.body.department   || '',
    email:        user.email,
    ts:           Date.now(),
  });
  res.json({ ok: true });
});

router.get('/presence', (req, res) => {
  const now   = Date.now();
  const users = [];
  for (const [, v] of presenceMap) {
    if (now - v.ts < PRESENCE_TTL) users.push(v);
    else presenceMap.delete(v.email);
  }
  res.json(users.sort((a, b) => (a.display_name || '').localeCompare(b.display_name || '')));
});

export default router;
