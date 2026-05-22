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

export const CUSTOMER_GROUPS = ['KT', 'LG', 'SK', '해외고객사', '온라인몰', '기타'];
export const PRODUCT_TYPES   = ['수입품', '자체제작상품', '내수품'];

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ── Auth ──────────────────────────────────────────────────────
export const signIn  = (email, pw) => sb.auth.signInWithPassword({ email, password: pw });
export const signOut = () => sb.auth.signOut();
export const signUp  = (email, pw, name) =>
  sb.auth.signUp({ email, password: pw, options: { data: { name } } });

export async function getProfile(userId) {
  const { data } = await sb.from('profiles').select('*').eq('id', userId).single();
  return data;
}

export async function upsertProfile(userId, name, department) {
  const payload = { id: userId, name };
  if (department) payload.department = department;
  const { error } = await sb.from('profiles').upsert(payload);
  if (error) throw error;
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
    current_stage: '접수',
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
    handler: data.sales_rep_name || '',
    user_id:    user?.id    || null,
    user_email: user?.email || null,
    user_name:  user?.user_metadata?.name || null,
    created_at: new Date().toISOString(),
  };
  await sb.from('claim_stages').insert(firstEntry);

  return { claim, firstEntry };
}

export async function advanceClaim(claimId, currentStage, { stage_date, description, handler }, user) {
  const idx = STAGES.indexOf(currentStage);
  if (idx < 0 || idx >= STAGES.length - 1) throw new Error('이미 최종 단계입니다.');
  const nextStage = STAGES[idx + 1];

  const { error: ue } = await sb
    .from('claims')
    .update({ current_stage: nextStage })
    .eq('id', claimId);
  if (ue) throw ue;

  const entry = {
    id: uid(),
    claim_id:   claimId,
    stage_name: nextStage,
    stage_date: stage_date || new Date().toISOString().slice(0, 10),
    description: description || '',
    handler:    handler || '',
    user_id:    user?.id    || null,
    user_email: user?.email || null,
    user_name:  user?.user_metadata?.name || null,
    created_at: new Date().toISOString(),
  };
  const { error: ie } = await sb.from('claim_stages').insert(entry);
  if (ie) throw ie;

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

export async function updateStageEntry(id, { stage_date, description, handler }) {
  const { error } = await sb
    .from('claim_stages')
    .update({ stage_date: stage_date || null, description: description || '', handler: handler || '' })
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
  const { data, error } = await sb
    .from('parts')
    .select('*')
    .order('part_number')
    .range(0, 9999);
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
