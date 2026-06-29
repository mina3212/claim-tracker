-- ============================================================
-- 클레임 관리 시스템 - Supabase 테이블 설정 (전체)
-- Supabase 대시보드 → SQL Editor에서 실행하세요
-- ============================================================

-- 1. 사용자 프로필 (이름 / 부서 / 관리자 여부)
CREATE TABLE IF NOT EXISTS profiles (
  id         TEXT PRIMARY KEY,   -- Supabase auth.users.id
  name       TEXT NOT NULL,
  email      TEXT,               -- 로그인 시 자동 동기화
  department TEXT,               -- 영업팀 / 마케팅팀 / 품질기술팀 / 영업관리팀
  is_admin   BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ※ 이미 profiles 테이블이 있다면 아래 ALTER로 컬럼 추가
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department TEXT;
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 관리자 지정 (해당 사용자 id로 교체하세요)
-- UPDATE profiles SET is_admin = TRUE WHERE id = '사용자-UUID';

-- 2. 클레임 테이블
CREATE TABLE IF NOT EXISTS claims (
  id                 TEXT PRIMARY KEY,
  customer_group     TEXT,              -- KT / LG / SK / 해외고객사 / 온라인몰 / 기타
  customer_name      TEXT NOT NULL,
  part_number        TEXT,
  part_name          TEXT,
  product_type       TEXT,              -- 수입품 / 자체제작상품 / 내수품
  product_category   TEXT,              -- 광분배함류 / 광접속함체류 / 광커넥터류 / 광점퍼코드류 / 동자재 / 기타
  quantity           INTEGER,
  defect_quantity    INTEGER,
  lot_number         TEXT,
  defect_description TEXT,
  occurrence_date    DATE,
  receipt_date       DATE,
  sales_rep_dept     TEXT,              -- 영업담당자 부서
  sales_rep_name     TEXT,
  sales_rep_contact  TEXT,
  current_stage      TEXT DEFAULT '접수'
                          CHECK (current_stage IN ('접수','1차 대응','회수품 원인분석','조치','종결')),
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ※ 기존 테이블에 컬럼 추가 (이미 claims 테이블이 있는 경우)
-- ALTER TABLE claims ADD COLUMN IF NOT EXISTS customer_group TEXT;
-- ALTER TABLE claims ADD COLUMN IF NOT EXISTS product_type TEXT;
-- ALTER TABLE claims ADD COLUMN IF NOT EXISTS defect_quantity INTEGER;
-- ALTER TABLE claims ADD COLUMN IF NOT EXISTS product_category TEXT;   -- 품목군 (광분배함류 등)
-- ALTER TABLE claims ADD COLUMN IF NOT EXISTS sales_rep_dept TEXT;     -- 영업담당자 부서

-- ※ 단계 흐름 변경: 접수 즉시 1차 대응으로 시작 (기존 데이터 마이그레이션)
-- UPDATE claims SET current_stage = '1차 대응' WHERE current_stage = '접수';

-- 3. 처리 단계 이력 (작업자 추적 포함)
CREATE TABLE IF NOT EXISTS claim_stages (
  id          TEXT PRIMARY KEY,
  claim_id    TEXT REFERENCES claims(id) ON DELETE CASCADE,
  stage_name  TEXT NOT NULL,
  stage_date  DATE,
  description TEXT,
  handler      TEXT,           -- 직접 입력 담당자명
  handler_dept TEXT,           -- 담당 부서
  user_id     TEXT,           -- 로그인한 사용자 ID (자동)
  user_email  TEXT,           -- 로그인한 사용자 이메일 (자동)
  user_name   TEXT,           -- 로그인한 사용자 등록 이름 (자동)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ※ 기존 claim_stages 테이블에 컬럼 추가
-- ALTER TABLE claim_stages ADD COLUMN IF NOT EXISTS handler_dept TEXT;

-- 4. 품번/품명 마스터
CREATE TABLE IF NOT EXISTS parts (
  id          TEXT PRIMARY KEY,
  part_number TEXT UNIQUE NOT NULL,
  part_name   TEXT NOT NULL,
  spec        TEXT,              -- 규격 (선택), 표시: 품명 [규격]
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ※ 기존 parts 테이블에 컬럼 추가
-- ALTER TABLE parts ADD COLUMN IF NOT EXISTS spec TEXT;

-- 5. 공급사 불량 테이블
CREATE TABLE IF NOT EXISTS supplier_claims (
  id                 TEXT PRIMARY KEY,
  supplier_name      TEXT NOT NULL,
  part_number        TEXT,
  part_name          TEXT,
  product_type       TEXT,
  product_category   TEXT,
  quantity           INTEGER,
  defect_quantity    INTEGER,
  lot_number         TEXT,
  defect_type        TEXT,              -- 치수불량 / 외관불량 / 기능불량 / 포장불량 / 수량부족 / 기타
  defect_description TEXT,
  occurrence_date    DATE,
  receipt_date       DATE,
  return_status      TEXT DEFAULT '미결'
                          CHECK (return_status IN ('반품','교환','폐기','미결')),
  handler_dept       TEXT,
  handler_name       TEXT,
  handler_contact    TEXT,
  current_stage      TEXT DEFAULT '원인분석'
                          CHECK (current_stage IN ('접수','원인분석','공급사 통보','조치','종결')),
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 공급사 불량 처리 단계 이력
CREATE TABLE IF NOT EXISTS supplier_claim_stages (
  id          TEXT PRIMARY KEY,
  claim_id    TEXT REFERENCES supplier_claims(id) ON DELETE CASCADE,
  stage_name  TEXT NOT NULL,
  stage_date  DATE,
  description TEXT,
  handler     TEXT,
  handler_dept TEXT,
  user_id     TEXT,
  user_email  TEXT,
  user_name   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS (Row Level Security) 설정
-- ============================================================

ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims               ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_stages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_claims      ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_claim_stages ENABLE ROW LEVEL SECURITY;

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
CREATE POLICY "stages_update" ON claim_stages FOR UPDATE USING (auth.role() = 'authenticated');
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

-- supplier_claims: 읽기 전체 공개 / 쓰기는 인증 필요
CREATE POLICY "sc_select" ON supplier_claims FOR SELECT USING (true);
CREATE POLICY "sc_insert" ON supplier_claims FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "sc_update" ON supplier_claims FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "sc_delete" ON supplier_claims FOR DELETE USING (auth.role() = 'authenticated');

-- supplier_claim_stages: 읽기 전체 공개 / 쓰기는 인증 필요
CREATE POLICY "scs_select" ON supplier_claim_stages FOR SELECT USING (true);
CREATE POLICY "scs_insert" ON supplier_claim_stages FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "scs_update" ON supplier_claim_stages FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "scs_delete" ON supplier_claim_stages FOR DELETE USING (auth.role() = 'authenticated');
