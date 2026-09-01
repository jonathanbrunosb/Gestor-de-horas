import { getSupabase } from '../lib/supabaseClient';
import type { AccessProfileRow } from '../types/database';
import { DEVELOPER_MATRICULA } from '../lib/constants';
import { normalizeMatricula } from '../lib/permissions';
import { recordAuditLog } from './auditLogService';

export type AccessProfileInput = Omit<AccessProfileRow, 'id' | 'created_at' | 'updated_at'>;

export async function listAccessProfiles(): Promise<AccessProfileRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('access_profiles').select('*').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createAccessProfile(payload: AccessProfileInput, actorRegistration: string | null): Promise<AccessProfileRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('access_profiles').insert({ ...payload, registration: normalizeMatricula(payload.registration) }).select().single();
  if (error) throw error;
  await recordAuditLog({ actorRegistration, action: 'create', entityType: 'access_profile', entityId: data.id, newValue: data });
  return data;
}

export async function updateAccessProfile(id: string, payload: Partial<AccessProfileInput>, actorRegistration: string | null): Promise<AccessProfileRow> {
  const supabase = getSupabase();
  const { data: existing } = await supabase.from('access_profiles').select('*').eq('id', id).maybeSingle();
  if (existing && normalizeMatricula(existing.registration) === DEVELOPER_MATRICULA) {
    // Perfil protegido: matrícula do desenvolvedor nunca perde o tipo de acesso nem é desativada.
    payload = { ...payload, access_type: 'Desenvolvedor', status: 'Ativo' };
  }
  const nextPayload = payload.registration ? { ...payload, registration: normalizeMatricula(payload.registration) } : payload;
  const { data, error } = await supabase.from('access_profiles').update(nextPayload).eq('id', id).select().single();
  if (error) throw error;
  await recordAuditLog({ actorRegistration, action: 'update', entityType: 'access_profile', entityId: id, oldValue: existing, newValue: data });
  return data;
}

export async function deleteAccessProfile(id: string, actorRegistration: string | null): Promise<void> {
  const supabase = getSupabase();
  const { data: existing } = await supabase.from('access_profiles').select('*').eq('id', id).maybeSingle();
  if (existing && normalizeMatricula(existing.registration) === DEVELOPER_MATRICULA) {
    throw new Error('O perfil do Desenvolvedor (u1205385) é protegido e não pode ser excluído.');
  }
  const { error } = await supabase.from('access_profiles').delete().eq('id', id);
  if (error) throw error;
  await recordAuditLog({ actorRegistration, action: 'delete', entityType: 'access_profile', entityId: id, oldValue: existing });
}

export async function getAccessProfileByMatricula(matricula: string): Promise<AccessProfileRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('access_profiles').select('*').eq('registration', normalizeMatricula(matricula)).maybeSingle();
  if (error) throw error;
  return data;
}
