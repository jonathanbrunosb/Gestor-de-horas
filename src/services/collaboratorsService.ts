import { getSupabase } from '../lib/supabaseClient';
import type { CollaboratorRow } from '../types/database';
import { recordAuditLog } from './auditLogService';

export type CollaboratorInput = Omit<CollaboratorRow, 'id' | 'created_at' | 'updated_at'>;

export async function listCollaborators(): Promise<CollaboratorRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('collaborators').select('*').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getCollaborator(id: string): Promise<CollaboratorRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('collaborators').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function findCollaboratorByRegistration(companyId: string, registration: string): Promise<CollaboratorRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('collaborators').select('*').eq('company_id', companyId).eq('registration', registration).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createCollaborator(payload: CollaboratorInput, actorRegistration: string | null): Promise<CollaboratorRow> {
  const supabase = getSupabase();
  if (!payload.name?.trim() || !payload.registration?.trim()) {
    throw new Error('Nome e matrícula são obrigatórios para cadastrar um colaborador.');
  }
  const { data, error } = await supabase.from('collaborators').insert(payload).select().single();
  if (error) throw error;
  await recordAuditLog({ actorRegistration, action: 'create', entityType: 'collaborator', entityId: data.id, newValue: data });
  return data;
}

export async function updateCollaborator(id: string, payload: Partial<CollaboratorInput>, actorRegistration: string | null): Promise<CollaboratorRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('collaborators').update(payload).eq('id', id).select().single();
  if (error) throw error;
  await recordAuditLog({ actorRegistration, action: 'update', entityType: 'collaborator', entityId: id, newValue: payload });
  return data;
}

/** Exclui o colaborador e seus registros de ponto/folgas vinculados (cascade no banco). */
export async function deleteCollaborator(id: string, actorRegistration: string | null): Promise<void> {
  const supabase = getSupabase();
  const { data: existing } = await supabase.from('collaborators').select('*').eq('id', id).maybeSingle();
  const { error } = await supabase.from('collaborators').delete().eq('id', id);
  if (error) throw error;
  await recordAuditLog({ actorRegistration, action: 'delete', entityType: 'collaborator', entityId: id, oldValue: existing });
}
