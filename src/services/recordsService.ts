import { getSupabase } from '../lib/supabaseClient';
import type { TimeRecordRow } from '../types/database';
import { recordAuditLog } from './auditLogService';

export type TimeRecordInput = Omit<TimeRecordRow, 'id' | 'created_at' | 'updated_at'>;

export interface RecordFilters {
  month?: string; // '01'..'12'
  year?: string;
}

export async function listRecordsByCollaborator(collaboratorId: string, filters: RecordFilters = {}): Promise<TimeRecordRow[]> {
  const supabase = getSupabase();
  let query = supabase.from('time_records').select('*').eq('collaborator_id', collaboratorId);
  if (filters.year && filters.month) {
    query = query.eq('period', `${filters.year}-${filters.month}`);
  } else if (filters.year) {
    query = query.gte('record_date', `${filters.year}-01-01`).lte('record_date', `${filters.year}-12-31`);
  }
  const { data, error } = await query.order('record_date');
  if (error) throw error;
  return data ?? [];
}

export async function listRecordsByPeriodRange(collaboratorIds: string[], startPeriod: string, endPeriod: string): Promise<TimeRecordRow[]> {
  if (!collaboratorIds.length) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('time_records')
    .select('*')
    .in('collaborator_id', collaboratorIds)
    .gte('period', startPeriod)
    .lte('period', endPeriod);
  if (error) throw error;
  return data ?? [];
}

/** Upsert em lote (evita duplicar por unique(collaborator_id, record_date, period)). */
export async function createRecordsBatch(records: TimeRecordInput[], actorRegistration: string | null): Promise<{ inserted: number; duplicates: number }> {
  if (!records.length) return { inserted: 0, duplicates: 0 };
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('time_records')
    .upsert(records, { onConflict: 'collaborator_id,record_date,period', ignoreDuplicates: true })
    .select('id');
  if (error) throw error;
  const inserted = data?.length ?? 0;
  await recordAuditLog({ actorRegistration, action: 'record.create', entityType: 'time_record', newValue: { count: inserted } });
  return { inserted, duplicates: records.length - inserted };
}

export async function updateRecord(id: string, payload: Partial<TimeRecordInput>, actorRegistration: string | null): Promise<TimeRecordRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('time_records').update(payload).eq('id', id).select().single();
  if (error) throw error;
  await recordAuditLog({ actorRegistration, action: 'record.update', entityType: 'time_record', entityId: id, newValue: payload });
  return data;
}

export async function deleteRecord(id: string, actorRegistration: string | null): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('time_records').delete().eq('id', id);
  if (error) throw error;
  await recordAuditLog({ actorRegistration, action: 'record.delete', entityType: 'time_record', entityId: id });
}

export async function deleteRecordsBatch(ids: string[], actorRegistration: string | null): Promise<void> {
  if (!ids.length) return;
  const supabase = getSupabase();
  const { error } = await supabase.from('time_records').delete().in('id', ids);
  if (error) throw error;
  await recordAuditLog({ actorRegistration, action: 'record.bulk_delete', entityType: 'time_record', newValue: { count: ids.length } });
}
