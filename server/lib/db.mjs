import pg from 'pg';
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn('[db] DATABASE_URL 미설정 — dev-data/.db-credentials 또는 환경변수를 확인하세요.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:dev@localhost:5432/postgres',
  max: 5,
});

let schemaReady = null;
function ensureDb() {
  if (!schemaReady) schemaReady = initSchema().catch(e => { schemaReady = null; throw e; });
  return schemaReady;
}

export async function q(sql, params = [])   { await ensureDb(); return (await pool.query(sql, params)).rows; }
export async function one(sql, params = []) { return (await q(sql, params))[0] ?? null; }
export async function run(sql, params = []) { await ensureDb(); return pool.query(sql, params); }

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL DEFAULT '',
      email      TEXT,
      department TEXT,
      is_admin   BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS claims (
      id                 TEXT PRIMARY KEY,
      customer_group     TEXT,
      customer_name      TEXT NOT NULL,
      part_number        TEXT,
      part_name          TEXT,
      product_type       TEXT,
      product_category   TEXT,
      quantity           INTEGER,
      defect_quantity    INTEGER,
      lot_number         TEXT,
      shipping_warehouse TEXT,
      shipping_date      DATE,
      shipments          JSONB,
      defect_description TEXT,
      occurrence_date    DATE,
      receipt_date       DATE,
      sales_rep_dept     TEXT,
      sales_rep_name     TEXT,
      sales_rep_contact  TEXT,
      current_stage      TEXT DEFAULT '접수',
      created_at         TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS claim_stages (
      id           TEXT PRIMARY KEY,
      claim_id     TEXT REFERENCES claims(id) ON DELETE CASCADE,
      stage_name   TEXT NOT NULL,
      stage_date   DATE,
      description  TEXT,
      handler      TEXT,
      handler_dept TEXT,
      user_id      TEXT,
      user_email   TEXT,
      user_name    TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS delete_requests (
      id               TEXT PRIMARY KEY,
      claim_id         TEXT REFERENCES claims(id) ON DELETE CASCADE,
      requester_email  TEXT,
      requester_name   TEXT,
      reason           TEXT NOT NULL,
      status           TEXT DEFAULT 'pending',
      created_at       TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS parts (
      id          TEXT PRIMARY KEY,
      part_number TEXT UNIQUE NOT NULL,
      part_name   TEXT NOT NULL,
      spec        TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id         TEXT PRIMARY KEY,
      name       TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS supplier_claims (
      id                       TEXT PRIMARY KEY,
      supplier_name            TEXT NOT NULL,
      purchase_dept            TEXT,
      incoming_date            DATE,
      incoming_lot_no          TEXT,
      part_number              TEXT,
      part_name                TEXT,
      quantity                 INTEGER,
      inspection_quantity      INTEGER,
      product_type             TEXT,
      product_category         TEXT,
      inspection_stage         TEXT,
      cavity_total             INTEGER,
      cavity_defective         INTEGER,
      defect_quantity          INTEGER,
      defect_type              TEXT,
      defect_description       TEXT,
      disposition              TEXT,
      notes                    TEXT,
      handler_name             TEXT,
      handler_dept             TEXT,
      handler_contact          TEXT,
      return_status            TEXT DEFAULT '미결',
      improvement_status       TEXT DEFAULT '미조치',
      corrective_action_type   TEXT,
      corrective_action_detail TEXT,
      current_stage            TEXT DEFAULT '접수',
      occurrence_date          DATE,
      receipt_date             DATE,
      lot_number               TEXT,
      created_at               TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS supplier_claim_stages (
      id           TEXT PRIMARY KEY,
      claim_id     TEXT REFERENCES supplier_claims(id) ON DELETE CASCADE,
      stage_name   TEXT NOT NULL,
      stage_date   DATE,
      description  TEXT,
      handler      TEXT,
      handler_dept TEXT,
      user_id      TEXT,
      user_email   TEXT,
      user_name    TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS supplier_improvement_logs (
      id                TEXT PRIMARY KEY,
      supplier_claim_id TEXT REFERENCES supplier_claims(id) ON DELETE CASCADE,
      incoming_lot_no   TEXT NOT NULL DEFAULT '',
      incoming_date     DATE,
      quantity          INTEGER,
      defect_quantity   INTEGER,
      is_improved       TEXT DEFAULT '확인중',
      notes             TEXT,
      handler           TEXT,
      handler_dept      TEXT,
      user_id           TEXT,
      user_email        TEXT,
      created_at        TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS supplier_claim_files (
      id                TEXT PRIMARY KEY,
      claim_id          TEXT REFERENCES supplier_claims(id) ON DELETE CASCADE,
      file_name         TEXT,
      file_path         TEXT,
      file_size         BIGINT,
      file_type         TEXT,
      uploaded_by_email TEXT,
      uploaded_by_name  TEXT,
      created_at        TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS file_download_logs (
      id               TEXT PRIMARY KEY,
      file_id          TEXT,
      claim_id         TEXT,
      file_name        TEXT,
      downloader_email TEXT,
      downloader_name  TEXT,
      downloaded_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export { pool };
