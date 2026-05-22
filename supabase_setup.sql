-- ============================================================
-- 클레임 관리 시스템 - Supabase 테이블 설정 (전체)
-- Supabase 대시보드 → SQL Editor에서 실행하세요
-- ============================================================

-- 1. 사용자 프로필 (이름 / 부서 / 관리자 여부)
CREATE TABLE IF NOT EXISTS profiles (
  id         TEXT PRIMARY KEY,   -- Supabase auth.users.id
  name       TEXT NOT NULL,
  department TEXT,               -- 영업팀 / 마케팅팀 / 품질기술팀 / 영업관리팀
  is_admin   BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ※ 이미 profiles 테이블이 있다면 아래 ALTER로 컬럼 추가
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department TEXT;
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 관리자 지정 (해당 사용자 id로 교체하세요)
-- UPDATE profiles SET is_admin = TRUE WHERE id = '사용자-UUID';

-- 2. 클레임 테이블
CREATE TABLE IF NOT EXISTS claims (
  id                 TEXT PRIMARY KEY,
  customer_name      TEXT NOT NULL,
  part_number        TEXT,
  part_name          TEXT,
  quantity           INTEGER,
  lot_number         TEXT,
  defect_description TEXT,
  occurrence_date    DATE,
  receipt_date       DATE,
  sales_rep_name     TEXT,
  sales_rep_contact  TEXT,
  current_stage      TEXT DEFAULT '접수'
                          CHECK (current_stage IN ('접수','1차 대응','회수품 원인분석','조치','종결')),
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 처리 단계 이력 (작업자 추적 포함)
CREATE TABLE IF NOT EXISTS claim_stages (
  id          TEXT PRIMARY KEY,
  claim_id    TEXT REFERENCES claims(id) ON DELETE CASCADE,
  stage_name  TEXT NOT NULL,
  stage_date  DATE,
  description TEXT,
  handler     TEXT,           -- 직접 입력 담당자명
  user_id     TEXT,           -- 로그인한 사용자 ID (자동)
  user_email  TEXT,           -- 로그인한 사용자 이메일 (자동)
  user_name   TEXT,           -- 로그인한 사용자 등록 이름 (자동)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 품번/품명 마스터
CREATE TABLE IF NOT EXISTS parts (
  id          TEXT PRIMARY KEY,
  part_number TEXT UNIQUE NOT NULL,
  part_name   TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS (Row Level Security) 설정
-- ============================================================

ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims      ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts       ENABLE ROW LEVEL SECURITY;

-- profiles: 본인만 읽기/쓰기
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid()::text = id);
CREATE POLICY "profiles_upsert" ON profiles FOR INSERT WITH CHECK (auth.uid()::text = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid()::text = id);

-- claims: 읽기 전체 공개 / 쓰기는 인증 필요
CREATE POLICY "claims_select"  ON claims FOR SELECT USING (true);
CREATE POLICY "claims_insert"  ON claims FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "claims_update"  ON claims FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "claims_delete"  ON claims FOR DELETE USING (auth.role() = 'authenticated');

-- claim_stages: 읽기 전체 공개 / 쓰기는 인증 필요
CREATE POLICY "stages_select" ON claim_stages FOR SELECT USING (true);
CREATE POLICY "stages_insert" ON claim_stages FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "stages_delete" ON claim_stages FOR DELETE USING (auth.role() = 'authenticated');

-- parts: 읽기 전체 공개 / 쓰기는 인증 필요
CREATE POLICY "parts_select" ON parts FOR SELECT USING (true);
CREATE POLICY "parts_insert" ON parts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "parts_update" ON parts FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "parts_delete" ON parts FOR DELETE USING (auth.role() = 'authenticated');

-- 5. 삭제 요청 (일반 사용자 → 관리자)
CREATE TABLE IF NOT EXISTS delete_requests (
  id               TEXT PRIMARY KEY,
  claim_id         TEXT REFERENCES claims(id) ON DELETE CASCADE,
  requester_email  TEXT,
  requester_name   TEXT,
  reason           TEXT NOT NULL,
  status           TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE delete_requests ENABLE ROW LEVEL SECURITY;

-- 로그인 사용자는 삭제 요청 생성 가능
CREATE POLICY "dr_insert" ON delete_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- 로그인 사용자는 전체 조회 가능 (관리자가 확인)
CREATE POLICY "dr_select" ON delete_requests FOR SELECT USING (auth.role() = 'authenticated');
-- 로그인 사용자는 상태 업데이트 가능 (관리자가 처리)
CREATE POLICY "dr_update" ON delete_requests FOR UPDATE USING (auth.role() = 'authenticated');
