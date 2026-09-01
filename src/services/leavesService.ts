import { getSupabase } from '../lib/supabaseClient';
import type { LeaveRow } from '../types/database';
import { recordAuditLog } from './auditLogService';

export type LeaveInput = Omit<LeaveRow, 'id' | 'created_at' | 'updated_at'>;

export async function listLeaves(): Promise<LeaveRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('leaves').select('*').order('leave_date');
  if (error) throw error;
  return data ?? [];
}

export async function createLeave(payload: LeaveInput, actorRegistration: string | null): Promise<LeaveRow> {
  const supabase = getSupabase();
  const { data: dup } = await supabase
    .from('leaves')
    .select('id')
    .eq('collaborator_id', payload.collaborator_id)
    .eq('leave_date', payload.leave_date)
    .maybeSingle();
  if (dup) throw new Error('Já existe uma folga cadastrada para este colaborador nesta data.');

  const { data, error } = await supabase.from('leaves').insert(payload).select().single();
  if (error) throw error;
  await recordAuditLog({ actorRegistration, action: 'create', entityType: 'leave', entityId: data.id, newValue: data });
  return data;
}

export async function updateLeave(id: string, payload: Partial<LeaveInput>, actorRegistration: string | null): Promise<LeaveRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('leaves').update(payload).eq('id', id).select().single();
  if (error) throw error;
  await recordAuditLog({ actorRegistration, action: 'update', entityType: 'leave', entityId: id, newValue: payload });
  return data;
}

export async function deleteLeave(id: string, actorRegistration: string | null): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('leaves').delete().eq('id', id);
  if (error) throw error;
  await recordAuditLog({ actorRegistration, action: 'delete', entityType: 'leave', entityId: id });
}
