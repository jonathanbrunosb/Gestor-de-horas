import { getSupabase } from '../lib/supabaseClient';
import type { ManagerRow } from '../types/database';
import { recordAuditLog } from './auditLogService';

export type ManagerInput = Omit<ManagerRow, 'id' | 'created_at' | 'updated_at'>;

export async function listManagers(): Promise<ManagerRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('managers').select('*').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getManager(id: string): Promise<ManagerRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('managers').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createManager(payload: ManagerInput, actorRegistration: string | null): Promise<ManagerRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('managers').insert(payload).select().single();
  if (error) throw error;
  await recordAuditLog({ actorRegistration, action: 'create', entityType: 'manager', entityId: data.id, newValue: data });
  return data;
}

export async function updateManager(id: string, payload: Partial<ManagerInput>, actorRegistration: string | null): Promise<ManagerRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('managers').update(payload).eq('id', id).select().single();
  if (error) throw error;
  await recordAuditLog({ actorRegistration, action: 'update', entityType: 'manager', entityId: id, newValue: payload });
  return data;
}

/**
 * Exclui o gestor e desvincula (não exclui) os colaboradores associados —
 * mantém apenas o nome legado, conforme regra da seção 22.2 do escopo.
 */
export async function deleteManager(id: string, actorRegistration: string | null): Promise<void> {
  const supabase = getSupabase();
  const { data: manager } = await supabase.from('managers').select('*').eq('id', id).maybeSingle();

  const { error: unlinkError } = await supabase
    .from('collaborators')
    .update({ manager_id: null, legacy_manager_name: manager?.name ?? null, manager_email: null, manager_registration: null })
    .eq('manager_id', id);
  if (unlinkError) throw unlinkError;

  const { error } = await supabase.from('managers').delete().eq('id', id);
  if (error) throw error;
  await recordAuditLog({ actorRegistration, action: 'delete', entityType: 'manager', entityId: id, oldValue: manager });
}

export async function countCollaboratorsByManager(managerId: string): Promise<number> {
  const supabase = getSupabase();
  const { count, error } = await supabase.from('collaborators').select('id', { count: 'exact', head: true }).eq('manager_id', managerId);
  if (error) throw error;
  return count ?? 0;
}
