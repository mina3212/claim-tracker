// ============================================================
// API 클라이언트 — Supabase 대신 사내 백엔드 서버 호출
// 함수 시그니처는 기존과 동일하게 유지 (하위 호환)
// ============================================================

// ── 공통 fetch 헬퍼 ───────────────────────────────────────────
async function apiFetch(url, options = {}) {
  const res = await fetch(url, { credentials: 'include', ...options });
  if (res.status === 401) {
    window.location.href = '/auth/login';
    throw new Error('Unauthorized');
  }
  return res;
}

async function apiJson(url, options = {}) {
  const res = await apiFetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── 기존 AuthContext 호환용 sb 객체 ──────────────────────────
export const sb = {
  auth: {
    getSession: async () => {
      try {
        const res = await fetch('/auth/me', { credentials: 'include' });
        if (!res.ok) return { data: { session: null } };
        const user = await res.json();
        return { data: { session: { user } } };
      } catch {
        return { data: { session: null } };
      }
    },
    onAuthStateChange: (callback) => {
      // 60초마다 세션 상태 확인 (Portal SSO는 별도 이벤트 없음)
      const poll = setInterval(async () => {
        try {
          const res = await fetch('/auth/me', { credentials: 'include' });
          if (res.ok) {
            const user = await res.json();
            callback('SIGNED_IN', { user });
          } else {
            callback('SIGNED_OUT', null);
          }
        } catch { /* 네트워크 오류 무시 */ }
      }, 60000);
      return { data: { subscription: { unsubscribe: () => clearInterval(poll) } } };
    },
  },
  // Realtime 채널 — 폴링으로 대체됐으므로 no-op
  channel: () => ({
    on:           function() { return this; },
    subscribe:    function(cb) { if (cb) setTimeout(() => cb('SUBSCRIBED'), 0); return this; },
    presenceState: () => ({}),
    track:        async () => {},
    unsubscribe:  () => {},
  }),
  removeChannel: () => {},
};

// ── Constants ─────────────────────────────────────────────────
export const STAGES = ['접수', '1차 대응', '회수품 원인분석', '조치', '종결'];
export const STAGE_ICONS = ['📥', '🔔', '🔍', '🛠️', '✅'];
export const STAGE_COLORS = {
  '접수':           { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
  '1차 대응':       { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
  '회수품 원인분석': { bg: '#ede9fe', text: '#5b21b6', dot: '#8b5cf6' },
  '조치':           { bg: '#ffedd5', text: '#9a3412', dot: '#f97316' },
  '종결':           { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
};

export const SUPPLIER_STAGES = ['접수', '원인분석', '공급사 통보', '조치', '종결'];
export const SUPPLIER_STAGE_ICONS = ['📥', '🔍', '📢', '🛠️', '✅'];
export const SUPPLIER_STAGE_COLORS = {
  '접수':       { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
  '원인분석':   { bg: '#ede9fe', text: '#5b21b6', dot: '#8b5cf6' },
  '공급사 통보': { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
  '조치':       { bg: '#ffedd5', text: '#9a3412', dot: '#f97316' },
  '종결':       { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
};

export const CUSTOMER_GROUPS     = ['KT', 'LG', 'SK', '해외고객사', '온라인몰', '기타'];
export const PRODUCT_TYPES       = ['수입부품', '수입완제품', '내수부품', '내수완제품', '자체제작상품'];
export const PRODUCT_CATEGORIES  = ['광분배함류', '광단자함류', '광접속함체류', '광커넥터류', '광점퍼코드류', '동자재', '기타'];
export const DEPARTMENTS         = ['영업팀', '마케팅팀', '품질기술팀', '영업관리팀', 'SCM팀'];
export const SALES_DEPTS         = ['영업팀', '마케팅팀', '영업관리팀', 'SCM팀'];
export const SALES_REPS          = ['권해인', '김정선', '김한나', '김희수', '송현진', '양태양', '최유선', '최윤환'];
export const SHIPPING_WAREHOUSES = ['본사-물류', 'GLC창고', '의왕-물류'];
export const DEFECT_TYPES        = ['치수불량', '외관불량', '조립불량', '기능불량', '포장불량', '수량부족', '기타'];
export const RETURN_STATUSES     = ['미결', '반품', '교환', '폐기'];
export const INSPECTION_STAGES   = ['부품 수입검사', '완제품 입고검사', '출하검사'];
export const IMPROVEMENT_RESULTS = ['확인중', '개선', '미개선'];
export const CORRECTIVE_ACTION_TYPES = ['공급사 클레임', '작업자 교육', '공정 변경', '설계 변경', '기타'];
export const IMPROVEMENT_STATUS_OPTIONS = ['미조치', '진행중', '완료'];
export const IMPROVEMENT_STATUS_COLORS = {
  '미조치': { bg: '#f1f5f9', text: '#64748b' },
  '진행중': { bg: '#fef3c7', text: '#92400e' },
  '완료':   { bg: '#d1fae5', text: '#065f46' },
};
export const DISPOSITION_TYPES   = ['사용승인', '반품(대체품)', '폐기', '재작업', '선별작업'];
export const PURCHASE_DEPTS      = ['SCM팀(내수)', '마케팅팀(수입)'];

export const DISPOSITION_COLORS = {
  '사용승인':   { bg: '#d1fae5', text: '#065f46' },
  '반품(대체품)': { bg: '#dbeafe', text: '#1e40af' },
  '폐기':       { bg: '#fee2e2', text: '#991b1b' },
  '재작업':     { bg: '#fef3c7', text: '#92400e' },
  '선별작업':   { bg: '#ede9fe', text: '#5b21b6' },
  '미결':       { bg: '#f1f5f9', text: '#475569' },
};

export const canViewSupplierClaims = (department, isAdmin) =>
  isAdmin || department === '품질기술팀' || department === '마케팅팀' || department === 'SCM팀';

export const uid = () => crypto.randomUUID();

// ── Auth (Portal SSO — 로그인/로그아웃은 서버가 처리) ─────────
export const signIn = () => {
  window.location.href = '/auth/login';
  return Promise.resolve({ data: null, error: null });
};

export const signOut = async () => {
  try { await apiFetch('/auth/logout', { method: 'POST' }); } catch { /* 무시 */ }
  window.location.href = '/auth/login';
  return { error: null };
};

export const signUp = () => {
  window.location.href = '/auth/login';
  return Promise.resolve({ data: null, error: null });
};

export const resetPassword = () => {
  window.location.href = '/auth/login';
  return Promise.resolve({ error: null });
};

// ── Profiles ──────────────────────────────────────────────────
export async function getProfile(userId) {
  try { return await apiJson(`/api/profiles/${encodeURIComponent(userId)}`); }
  catch { return null; }
}

export async function upsertProfile(userId, name, department, email) {
  await apiJson('/api/profiles', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ id: userId, name, department, email }),
  });
}

export async function syncProfileEmail(userId, email) {
  if (!userId || !email) return;
  await apiFetch(`/api/profiles/${encodeURIComponent(userId)}/email`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email }),
  });
}

export async function fetchNotifyEmails() {
  try { return await apiJson('/api/profiles/notify-emails'); }
  catch { return []; }
}

// ── Claims ────────────────────────────────────────────────────
export async function fetchClaims() {
  return apiJson('/api/claims');
}

export async function fetchAllStages() {
  return apiJson('/api/claim-stages');
}

export async function insertClaim(data, user) {
  const claim = {
    ...data,
    id:            uid(),
    current_stage: '1차 대응',
    created_at:    new Date().toISOString(),
  };
  const firstEntry = {
    id:           uid(),
    claim_id:     claim.id,
    stage_name:   '접수',
    stage_date:   data.receipt_date || new Date().toISOString().slice(0, 10),
    description:  '클레임 최초 접수',
    handler:      data.sales_rep_name || '',
    handler_dept: data.sales_rep_dept || '',
    user_id:      user?.id    || null,
    user_email:   user?.email || null,
    user_name:    user?.user_metadata?.name || null,
    created_at:   new Date().toISOString(),
  };
  await apiJson('/api/claims', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ claim, firstEntry }),
  });
  return { claim, firstEntry };
}

export async function advanceClaim(claimId, currentStage, { stage_date, description, handler, handler_dept }, user) {
  const idx = STAGES.indexOf(currentStage);
  if (idx < 0 || idx >= STAGES.length - 1) throw new Error('이미 최종 단계입니다.');
  const nextStage = STAGES[idx + 1];

  const entry = {
    id:           uid(),
    claim_id:     claimId,
    stage_name:   currentStage,
    stage_date:   stage_date || new Date().toISOString().slice(0, 10),
    description:  description || '',
    handler:      handler || '',
    handler_dept: handler_dept || '',
    user_id:      user?.id    || null,
    user_email:   user?.email || null,
    user_name:    user?.user_metadata?.name || null,
    created_at:   new Date().toISOString(),
  };

  let closeEntry = null;
  if (nextStage === '종결') {
    closeEntry = {
      id:           uid(),
      claim_id:     claimId,
      stage_name:   '종결',
      stage_date:   stage_date || new Date().toISOString().slice(0, 10),
      description:  '클레임 종결 처리',
      handler:      handler || '',
      handler_dept: handler_dept || '',
      user_id:      user?.id    || null,
      user_email:   user?.email || null,
      user_name:    user?.user_metadata?.name || null,
      created_at:   new Date().toISOString(),
    };
  }

  const res = await apiFetch(`/api/claims/${claimId}/advance`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ currentStage, nextStage, entry, closeEntry }),
  });
  if (res.status === 409) {
    const body = await res.json();
    throw new Error(body.error);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { nextStage, entry };
}

export async function updateClaim(id, data) {
  await apiJson(`/api/claims/${id}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
}

export async function deleteClaim(id) {
  await apiJson(`/api/claims/${id}`, { method: 'DELETE' });
}

export async function updateStageEntry(id, { stage_date, description, handler, handler_dept }) {
  await apiJson(`/api/claim-stages/${id}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ stage_date: stage_date || null, description: description || '', handler: handler || '', handler_dept: handler_dept || '' }),
  });
}

// ── Delete Requests ───────────────────────────────────────────
export async function insertDeleteRequest(claimId, reason, user) {
  const req = {
    id:              uid(),
    claim_id:        claimId,
    requester_email: user?.email || '',
    requester_name:  user?.user_metadata?.name || user?.email || '',
    reason,
    status:          'pending',
    created_at:      new Date().toISOString(),
  };
  await apiJson('/api/delete-requests', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(req),
  });
  return req;
}

export async function fetchDeleteRequests() {
  return apiJson('/api/delete-requests?status=pending');
}

export async function resolveDeleteRequest(id, status) {
  await apiJson(`/api/delete-requests/${id}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ status }),
  });
}

// ── Parts ─────────────────────────────────────────────────────
export async function fetchParts() {
  return apiJson('/api/parts');
}

export async function searchParts(query) {
  if (!query || !query.trim()) return [];
  return apiJson(`/api/parts/search?q=${encodeURIComponent(query.trim())}`);
}

export async function upsertParts(rows) {
  await apiJson('/api/parts/upsert', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ rows }),
  });
}

export async function deletePart(id) {
  await apiJson(`/api/parts/${id}`, { method: 'DELETE' });
}

export async function deleteAllParts() {
  await apiJson('/api/parts/__all__', { method: 'DELETE' });
}

// ── Suppliers ─────────────────────────────────────────────────
export async function fetchSuppliers() {
  return apiJson('/api/suppliers');
}

export async function searchSuppliers(query) {
  if (!query || !query.trim()) return [];
  return apiJson(`/api/suppliers/search?q=${encodeURIComponent(query.trim())}`);
}

export async function upsertSuppliers(rows) {
  await apiJson('/api/suppliers/upsert', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ rows }),
  });
}

export async function deleteSupplier(id) {
  await apiJson(`/api/suppliers/${id}`, { method: 'DELETE' });
}

export async function deleteAllSuppliers() {
  await apiJson('/api/suppliers/__all__', { method: 'DELETE' });
}

export async function searchSupplierNames(query) {
  if (!query || !query.trim()) return [];
  return apiJson(`/api/supplier-names/search?q=${encodeURIComponent(query.trim())}`);
}

// ── Supplier Claims ───────────────────────────────────────────
export async function fetchSupplierClaims() {
  return apiJson('/api/supplier-claims');
}

export async function fetchAllSupplierStages() {
  return apiJson('/api/supplier-claim-stages');
}

export async function insertSupplierClaim(data, user) {
  const claim = {
    ...data,
    id:            uid(),
    current_stage: '접수',
    created_at:    new Date().toISOString(),
  };
  await apiJson('/api/supplier-claims', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(claim),
  });
  return { claim };
}

export async function advanceSupplierClaim(claimId, currentStage, { stage_date, description, handler, handler_dept }, user) {
  const idx = SUPPLIER_STAGES.indexOf(currentStage);
  if (idx < 0 || idx >= SUPPLIER_STAGES.length - 1) throw new Error('이미 최종 단계입니다.');
  const nextStage = SUPPLIER_STAGES[idx + 1];

  const entry = {
    id:           uid(),
    claim_id:     claimId,
    stage_name:   currentStage,
    stage_date:   stage_date || new Date().toISOString().slice(0, 10),
    description:  description || '',
    handler:      handler || '',
    handler_dept: handler_dept || '',
    user_id:      user?.id    || null,
    user_email:   user?.email || null,
    user_name:    user?.user_metadata?.name || null,
    created_at:   new Date().toISOString(),
  };

  let closeEntry = null;
  if (nextStage === '종결') {
    closeEntry = {
      id:           uid(),
      claim_id:     claimId,
      stage_name:   '종결',
      stage_date:   stage_date || new Date().toISOString().slice(0, 10),
      description:  '공급사 불량 종결 처리',
      handler:      handler || '',
      handler_dept: handler_dept || '',
      user_id:      user?.id    || null,
      user_email:   user?.email || null,
      user_name:    user?.user_metadata?.name || null,
      created_at:   new Date().toISOString(),
    };
  }

  const res = await apiFetch(`/api/supplier-claims/${claimId}/advance`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ currentStage, nextStage, entry, closeEntry }),
  });
  if (res.status === 409) {
    const body = await res.json();
    throw new Error(body.error);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { nextStage, entry };
}

export async function updateSupplierClaim(id, data) {
  await apiJson(`/api/supplier-claims/${id}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
}

export async function deleteSupplierClaim(id) {
  await apiJson(`/api/supplier-claims/${id}`, { method: 'DELETE' });
}

export async function updateSupplierStageEntry(id, { stage_date, description, handler, handler_dept }) {
  await apiJson(`/api/supplier-claim-stages/${id}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ stage_date: stage_date || null, description: description || '', handler: handler || '', handler_dept: handler_dept || '' }),
  });
}

// ── Improvement Logs ──────────────────────────────────────────
export async function fetchImprovementLogs(supplierClaimId) {
  const qs = supplierClaimId ? `?claim_id=${encodeURIComponent(supplierClaimId)}` : '';
  return apiJson(`/api/improvement-logs${qs}`);
}

export async function insertImprovementLog(supplierClaimId, data, user) {
  const log = {
    id:                uid(),
    supplier_claim_id: supplierClaimId,
    incoming_lot_no:   data.incoming_lot_no  || '',
    incoming_date:     data.incoming_date    || null,
    quantity:          data.quantity != null ? parseInt(data.quantity) : null,
    defect_quantity:   data.defect_quantity != null ? parseInt(data.defect_quantity) : null,
    is_improved:       data.is_improved      || '확인중',
    notes:             data.notes            || '',
    handler:           data.handler          || '',
    handler_dept:      data.handler_dept     || '',
    user_id:           user?.id    || null,
    user_email:        user?.email || null,
    created_at:        new Date().toISOString(),
  };
  await apiJson('/api/improvement-logs', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(log),
  });
  return log;
}

export async function updateImprovementLog(id, data) {
  await apiJson(`/api/improvement-logs/${id}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
}

export async function deleteImprovementLog(id) {
  await apiJson(`/api/improvement-logs/${id}`, { method: 'DELETE' });
}

// ── Supplier Claim Files ──────────────────────────────────────

export async function uploadSupplierFile(file, claimId) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiFetch(`/api/upload/supplier-file?claimId=${encodeURIComponent(claimId)}`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '업로드 실패');
  return res.json();  // { path, name, size, type }
}

export async function getSupplierFileUrl(filePath) {
  // 로컬 스토리지 파일은 API 경유, Supabase 서명 URL은 그대로 유지
  if (filePath && (filePath.startsWith('http://') || filePath.startsWith('https://'))) {
    return filePath;
  }
  return `/api/files/${filePath}`;
}

export async function uploadStageImage(file, claimId) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiFetch(`/api/upload/stage-image?claimId=${encodeURIComponent(claimId)}`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '업로드 실패');
  const { url } = await res.json();
  return url;  // '/api/files/stage-images/{claimId}/{filename}'
}

export async function fetchClaimIdsWithFiles() {
  return apiJson('/api/supplier-files/claim-ids');
}

export async function fetchSupplierFiles(claimId) {
  return apiJson(`/api/supplier-files?claim_id=${encodeURIComponent(claimId)}`);
}

export async function insertSupplierFile(claimId, fileInfo, user) {
  const row = {
    id:                uid(),
    claim_id:          claimId,
    file_name:         fileInfo.name,
    file_path:         fileInfo.path,
    file_size:         fileInfo.size,
    file_type:         fileInfo.type,
    uploaded_by_email: user?.email || null,
    uploaded_by_name:  user?.user_metadata?.name || user?.email || null,
    created_at:        new Date().toISOString(),
  };
  await apiJson('/api/supplier-files', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(row),
  });
  return row;
}

export async function deleteSupplierFile(fileId, filePath) {
  await apiJson(`/api/supplier-files/${fileId}`, { method: 'DELETE' });
}

export async function logFileDownload(fileId, claimId, fileName, user) {
  const row = {
    id:               uid(),
    file_id:          fileId,
    claim_id:         claimId,
    file_name:        fileName,
    downloader_email: user?.email || null,
    downloader_name:  user?.user_metadata?.name || user?.email || null,
    downloaded_at:    new Date().toISOString(),
  };
  await apiJson('/api/download-logs', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(row),
  });
  return row;
}

export async function fetchDownloadLogs(claimId) {
  return apiJson(`/api/download-logs?claim_id=${encodeURIComponent(claimId)}`);
}
