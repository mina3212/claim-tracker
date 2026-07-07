import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

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
export const PRODUCT_TYPES       = ['수입부품', '수입완제품', '내수부품', '내수완제품'];
export const PRODUCT_CATEGORIES  = ['광분배함류', '광접속함체류', '광커넥터류', '광점퍼코드류', '동자재', '기타'];
export const DEPARTMENTS         = ['영업팀', '마케팅팀', '품질기술팀', '영업관리팀', 'SCM팀'];
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

// ── Auth ──────────────────────────────────────────────────────
export const signIn  = (email, pw) => sb.auth.signInWithPassword({ email, password: pw });
export const signOut = () => sb.auth.signOut();
export const signUp  = (email, pw, name) =>
  sb.auth.signUp({ email, password: pw, options: { data: { name } } });
export const resetPassword = (email) =>
  sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });

export async function getProfile(userId) {
  const { data } = await sb.from('profiles').select('*').eq('id', userId).single();
  return data;
}

export async function upsertProfile(userId, name, department, email) {
  const payload = { id: userId, name };
  if (department) payload.department = department;
  if (email)      payload.email      = email;
  const { error } = await sb.from('profiles').upsert(payload);
  if (error) throw error;
}

export async function syncProfileEmail(userId, email) {
  if (!userId || !email) return;
  await sb.from('profiles').update({ email }).eq('id', userId);
}

/* 알림 수신자: 관리자 + 품질기술팀 이메일 목록 */
export async function fetchNotifyEmails() {
  const { data } = await sb
    .from('profiles')
    .select('email')
    .or('is_admin.eq.true,department.eq.품질기술팀')
    .not('email', 'is', null);
  return (data || []).map(r => r.email).filter(Boolean);
}

// ── Claims CRUD ───────────────────────────────────────────────
export async function fetchClaims() {
  const { data, error } = await sb
    .from('claims')
    .select('*')
    .order('receipt_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchAllStages() {
  const { data, error } = await sb
    .from('claim_stages')
    .select('*')
    .order('created_at');
  if (error) throw error;
  return data || [];
}

export async function insertClaim(data, user) {
  const claim = {
    ...data,
    id: uid(),
    current_stage: '1차 대응',   // 접수 즉시 1차 대응 단계로 시작
    created_at: new Date().toISOString(),
  };
  const { error } = await sb.from('claims').insert(claim);
  if (error) throw error;

  const firstEntry = {
    id: uid(),
    claim_id: claim.id,
    stage_name: '접수',
    stage_date: data.receipt_date || new Date().toISOString().slice(0, 10),
    description: '클레임 최초 접수',
    handler:      data.sales_rep_name || '',
    handler_dept: data.sales_rep_dept || '',
    user_id:    user?.id    || null,
    user_email: user?.email || null,
    user_name:  user?.user_metadata?.name || null,
    created_at: new Date().toISOString(),
  };
  await sb.from('claim_stages').insert(firstEntry);

  return { claim, firstEntry };
}

export async function advanceClaim(claimId, currentStage, { stage_date, description, handler, handler_dept }, user) {
  const idx = STAGES.indexOf(currentStage);
  if (idx < 0 || idx >= STAGES.length - 1) throw new Error('이미 최종 단계입니다.');
  const nextStage = STAGES[idx + 1];

  // 현재 단계 이력이 이미 있으면 중복 방지
  const { data: existing } = await sb
    .from('claim_stages')
    .select('id')
    .eq('claim_id', claimId)
    .eq('stage_name', currentStage)
    .limit(1);
  if (existing && existing.length > 0) throw new Error(`"${currentStage}" 단계는 이미 등록된 건입니다.`);

  const { error: ue } = await sb
    .from('claims')
    .update({ current_stage: nextStage })
    .eq('id', claimId);
  if (ue) throw ue;

  // 현재 단계의 처리 결과를 이력으로 기록
  const entry = {
    id: uid(),
    claim_id:     claimId,
    stage_name:   currentStage,
    stage_date:   stage_date || new Date().toISOString().slice(0, 10),
    description:  description || '',
    handler:      handler || '',
    handler_dept: handler_dept || '',
    user_id:    user?.id    || null,
    user_email: user?.email || null,
    user_name:  user?.user_metadata?.name || null,
    created_at: new Date().toISOString(),
  };
  const { error: ie } = await sb.from('claim_stages').insert(entry);
  if (ie) throw ie;

  // 종결 단계 도달 시 종결 이력 자동 생성
  if (nextStage === '종결') {
    const closeEntry = {
      id: uid(),
      claim_id:   claimId,
      stage_name: '종결',
      stage_date: stage_date || new Date().toISOString().slice(0, 10),
      description: '클레임 종결 처리',
      handler:      handler || '',
      handler_dept: handler_dept || '',
      user_id:    user?.id    || null,
      user_email: user?.email || null,
      user_name:  user?.user_metadata?.name || null,
      created_at: new Date().toISOString(),
    };
    await sb.from('claim_stages').insert(closeEntry);
  }

  return { nextStage, entry };
}

export async function updateClaim(id, data) {
  const { error } = await sb.from('claims').update(data).eq('id', id);
  if (error) throw error;
}

export async function deleteClaim(id) {
  const { error } = await sb.from('claims').delete().eq('id', id);
  if (error) throw error;
}

export async function updateStageEntry(id, { stage_date, description, handler, handler_dept }) {
  const { error } = await sb
    .from('claim_stages')
    .update({
      stage_date:   stage_date   || null,
      description:  description  || '',
      handler:      handler      || '',
      handler_dept: handler_dept || '',
    })
    .eq('id', id);
  if (error) throw error;
}

// ── Delete Requests ───────────────────────────────────────────
export async function insertDeleteRequest(claimId, reason, user) {
  const req = {
    id: uid(),
    claim_id: claimId,
    requester_email: user?.email || '',
    requester_name: user?.user_metadata?.name || user?.email || '',
    reason,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  const { error } = await sb.from('delete_requests').insert(req);
  if (error) throw error;
  return req;
}

export async function fetchDeleteRequests() {
  const { data, error } = await sb
    .from('delete_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at');
  if (error) throw error;
  return data || [];
}

export async function resolveDeleteRequest(id, status) {
  const { error } = await sb.from('delete_requests').update({ status }).eq('id', id);
  if (error) throw error;
}

// ── Parts master ──────────────────────────────────────────────
export async function fetchParts() {
  const pageSize = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from('parts')
      .select('*')
      .order('part_number')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export async function searchParts(query) {
  if (!query || !query.trim()) return [];
  const q = query.trim();
  const { data, error } = await sb
    .from('parts')
    .select('id, part_number, part_name')
    .or(`part_number.ilike.%${q}%,part_name.ilike.%${q}%`)
    .order('part_number')
    .limit(20);
  if (error) throw error;
  return data || [];
}

export async function upsertParts(rows) {
  const { error } = await sb.from('parts').upsert(rows, { onConflict: 'part_number' });
  if (error) throw error;
}

export async function deletePart(id) {
  const { error } = await sb.from('parts').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteAllParts() {
  const { error } = await sb.from('parts').delete().neq('id', '');
  if (error) throw error;
}

// ── Suppliers master ──────────────────────────────────────────
export async function fetchSuppliers() {
  const { data, error } = await sb.from('suppliers').select('*').order('name');
  if (error) throw error;
  return data || [];
}

export async function searchSuppliers(query) {
  if (!query || !query.trim()) return [];
  const { data, error } = await sb
    .from('suppliers')
    .select('id, name')
    .ilike('name', `%${query.trim()}%`)
    .order('name')
    .limit(20);
  if (error) throw error;
  return data || [];
}

export async function upsertSuppliers(rows) {
  const { error } = await sb.from('suppliers').upsert(rows, { onConflict: 'name' });
  if (error) throw error;
}

export async function deleteSupplier(id) {
  const { error } = await sb.from('suppliers').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteAllSuppliers() {
  const { error } = await sb.from('suppliers').delete().neq('id', '');
  if (error) throw error;
}

// ── Supplier name autocomplete (legacy fallback) ──────────────
export async function searchSupplierNames(query) {
  if (!query || !query.trim()) return [];
  const { data } = await sb
    .from('supplier_claims')
    .select('supplier_name')
    .ilike('supplier_name', `%${query.trim()}%`)
    .order('supplier_name')
    .limit(15);
  return [...new Set((data || []).map(r => r.supplier_name).filter(Boolean))];
}

// ── Supplier Claims CRUD ──────────────────────────────────────
export async function fetchSupplierClaims() {
  const { data, error } = await sb
    .from('supplier_claims')
    .select('*')
    .order('receipt_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchAllSupplierStages() {
  const { data, error } = await sb
    .from('supplier_claim_stages')
    .select('*')
    .order('created_at');
  if (error) throw error;
  return data || [];
}

export async function insertSupplierClaim(data, user) {
  const claim = {
    ...data,
    id: uid(),
    current_stage: '접수',
    created_at: new Date().toISOString(),
  };
  const { error } = await sb.from('supplier_claims').insert(claim);
  if (error) throw error;
  return { claim };
}

export async function advanceSupplierClaim(claimId, currentStage, { stage_date, description, handler, handler_dept }, user) {
  const idx = SUPPLIER_STAGES.indexOf(currentStage);
  if (idx < 0 || idx >= SUPPLIER_STAGES.length - 1) throw new Error('이미 최종 단계입니다.');
  const nextStage = SUPPLIER_STAGES[idx + 1];

  const { data: existing } = await sb
    .from('supplier_claim_stages')
    .select('id')
    .eq('claim_id', claimId)
    .eq('stage_name', currentStage)
    .limit(1);
  if (existing && existing.length > 0) throw new Error(`"${currentStage}" 단계는 이미 등록된 건입니다.`);

  const { error: ue } = await sb
    .from('supplier_claims')
    .update({ current_stage: nextStage })
    .eq('id', claimId);
  if (ue) throw ue;

  const entry = {
    id: uid(),
    claim_id:     claimId,
    stage_name:   currentStage,
    stage_date:   stage_date || new Date().toISOString().slice(0, 10),
    description:  description || '',
    handler:      handler || '',
    handler_dept: handler_dept || '',
    user_id:    user?.id    || null,
    user_email: user?.email || null,
    user_name:  user?.user_metadata?.name || null,
    created_at: new Date().toISOString(),
  };
  const { error: ie } = await sb.from('supplier_claim_stages').insert(entry);
  if (ie) throw ie;

  if (nextStage === '종결') {
    const closeEntry = {
      id: uid(),
      claim_id:    claimId,
      stage_name:  '종결',
      stage_date:  stage_date || new Date().toISOString().slice(0, 10),
      description: '공급사 불량 종결 처리',
      handler:      handler || '',
      handler_dept: handler_dept || '',
      user_id:    user?.id    || null,
      user_email: user?.email || null,
      user_name:  user?.user_metadata?.name || null,
      created_at: new Date().toISOString(),
    };
    await sb.from('supplier_claim_stages').insert(closeEntry);
  }

  return { nextStage, entry };
}

export async function updateSupplierClaim(id, data) {
  const { error } = await sb.from('supplier_claims').update(data).eq('id', id);
  if (error) throw error;
}

export async function deleteSupplierClaim(id) {
  const { error } = await sb.from('supplier_claims').delete().eq('id', id);
  if (error) throw error;
}

export async function updateSupplierStageEntry(id, { stage_date, description, handler, handler_dept }) {
  const { error } = await sb
    .from('supplier_claim_stages')
    .update({ stage_date: stage_date || null, description: description || '', handler: handler || '', handler_dept: handler_dept || '' })
    .eq('id', id);
  if (error) throw error;
}

// ── Supplier Improvement Logs ─────────────────────────────────
export async function fetchImprovementLogs(supplierClaimId) {
  let query = sb.from('supplier_improvement_logs').select('*').order('created_at');
  if (supplierClaimId) query = query.eq('supplier_claim_id', supplierClaimId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function insertImprovementLog(supplierClaimId, data, user) {
  const log = {
    id: uid(),
    supplier_claim_id: supplierClaimId,
    incoming_lot_no:  data.incoming_lot_no  || '',
    incoming_date:    data.incoming_date    || null,
    quantity:         data.quantity != null ? parseInt(data.quantity) : null,
    defect_quantity:  data.defect_quantity != null ? parseInt(data.defect_quantity) : null,
    is_improved:      data.is_improved      || '확인중',
    notes:            data.notes            || '',
    handler:          data.handler          || '',
    handler_dept:     data.handler_dept     || '',
    user_id:    user?.id    || null,
    user_email: user?.email || null,
    created_at: new Date().toISOString(),
  };
  const { error } = await sb.from('supplier_improvement_logs').insert(log);
  if (error) throw error;
  return log;
}

export async function updateImprovementLog(id, data) {
  const { error } = await sb.from('supplier_improvement_logs').update(data).eq('id', id);
  if (error) throw error;
}

export async function deleteImprovementLog(id) {
  const { error } = await sb.from('supplier_improvement_logs').delete().eq('id', id);
  if (error) throw error;
}

// ── Supplier Claim Files ──────────────────────────────────────

const BUCKET = 'supplier-attachments';

export async function uploadSupplierFile(file, claimId) {
  const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
  const path = `${claimId}/${uid()}${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  return { path, name: file.name, size: file.size, type: file.type };
}

export async function getSupplierFileUrl(filePath) {
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(filePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function fetchClaimIdsWithFiles() {
  const { data, error } = await sb.from('supplier_claim_files').select('claim_id');
  if (error) throw error;
  return [...new Set((data || []).map(r => r.claim_id))];
}

export async function fetchSupplierFiles(claimId) {
  const { data, error } = await sb.from('supplier_claim_files').select('*').eq('claim_id', claimId).order('created_at');
  if (error) throw error;
  return data || [];
}

export async function insertSupplierFile(claimId, fileInfo, user) {
  const row = {
    id: uid(),
    claim_id: claimId,
    file_name: fileInfo.name,
    file_path: fileInfo.path,
    file_size: fileInfo.size,
    file_type: fileInfo.type,
    uploaded_by_email: user?.email || null,
    uploaded_by_name:  user?.user_metadata?.name || user?.email || null,
    created_at: new Date().toISOString(),
  };
  const { error } = await sb.from('supplier_claim_files').insert(row);
  if (error) throw error;
  return row;
}

export async function deleteSupplierFile(fileId, filePath) {
  await sb.storage.from(BUCKET).remove([filePath]);
  const { error } = await sb.from('supplier_claim_files').delete().eq('id', fileId);
  if (error) throw error;
}

export async function logFileDownload(fileId, claimId, fileName, user) {
  const row = {
    id: uid(),
    file_id: fileId,
    claim_id: claimId,
    file_name: fileName,
    downloader_email: user?.email || null,
    downloader_name:  user?.user_metadata?.name || user?.email || null,
    downloaded_at: new Date().toISOString(),
  };
  const { error } = await sb.from('file_download_logs').insert(row);
  if (error) throw error;
  return row;
}

export async function fetchDownloadLogs(claimId) {
  const { data, error } = await sb
    .from('file_download_logs')
    .select('*')
    .eq('claim_id', claimId)
    .order('downloaded_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
