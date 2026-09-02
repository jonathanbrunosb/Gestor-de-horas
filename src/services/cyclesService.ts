import { getSupabase } from '../lib/supabaseClient';
import type { CompanyCycleRow, CompanyRow } from '../types/database';
import { DEFAULT_NEGATIVE_ALERT_MINUTES, DEFAULT_POSITIVE_ALERT_MINUTES } from '../lib/constants';
import { recordAuditLog } from './auditLogService';

export type CycleInput = Omit<CompanyCycleRow, 'id' | 'created_at' | 'updated_at'>;

export async function listCycles(): Promise<CompanyCycleRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('company_cycles').select('*').order('start_month');
  if (error) throw error;
  return data ?? [];
}

export async function createCycle(payload: CycleInput, actorRegistration: string | null): Promise<CompanyCycleRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('company_cycles').insert(payload).select().single();
  if (error) throw error;
  await recordAuditLog({ actorRegistration, action: 'cycle.create', entityType: 'company_cycle', entityId: data.id, entityLabel: data.start_month, newValue: data });
  return data;
}

export async function updateCycle(id: string, payload: Partial<CycleInput>, actorRegistration: string | null): Promise<CompanyCycleRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('company_cycles').update(payload).eq('id', id).select().single();
  if (error) throw error;
  await recordAuditLog({ actorRegistration, action: 'cycle.update', entityType: 'company_cycle', entityId: id, entityLabel: data.start_month, newValue: payload });
  return data;
}

export async function deleteCycle(id: string, actorRegistration: string | null): Promise<void> {
  const supabase = getSupabase();
  const { data: existing } = await supabase.from('company_cycles').select('*').eq('id', id).maybeSingle();
  const { error } = await supabase.from('company_cycles').delete().eq('id', id);
  if (error) throw error;
  await recordAuditLog({ actorRegistration, action: 'cycle.delete', entityType: 'company_cycle', entityId: id, entityLabel: existing?.start_month, oldValue: existing });
}

/** Recria os ciclos padrão (4 meses, limites 10:00/-05:00) para empresas sem ciclo cadastrado. */
export async function restoreDefaultCycles(companies: CompanyRow[], actorRegistration: string | null): Promise<void> {
  const supabase = getSupabase();
  const existing = await listCycles();
  const existingCompanyIds = new Set(existing.map((c) => c.company_id));
  const today = new Date();
  const startMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const missing = companies.filter((c) => !existingCompanyIds.has(c.id));
  if (!missing.length) return;

  const payload: CycleInput[] = missing.map((company) => ({
    company_id: company.id,
    start_month: startMonth,
    periodicity_months: 4,
    positive_alert_minutes: DEFAULT_POSITIVE_ALERT_MINUTES,
    negative_alert_minutes: DEFAULT_NEGATIVE_ALERT_MINUTES,
    responsible: 'Contabilidade Corporativa',
    active: true
  }));

  const { error } = await supabase.from('company_cycles').insert(payload);
  if (error) throw error;
  await recordAuditLog({ actorRegistration, action: 'cycle.restore_defaults', entityType: 'company_cycle', newValue: payload });
}
