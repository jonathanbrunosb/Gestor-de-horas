import { getSupabase } from '../lib/supabaseClient';
import type { GestaoConfigValue } from '../types/database';
import { recordAuditLog } from './auditLogService';

const GESTAO_CONFIG_KEY = 'gestao_config';
const DEFAULT_GESTAO_CONFIG: GestaoConfigValue = { custoHora: 35, adicionalPct: 50 };

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('app_settings').select('setting_value').eq('setting_key', key).maybeSingle();
  if (error) throw error;
  return (data?.setting_value as T) ?? fallback;
}

export async function setSetting(key: string, value: unknown, actorRegistration: string | null): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('app_settings').upsert({ setting_key: key, setting_value: value }, { onConflict: 'setting_key' });
  if (error) throw error;
  await recordAuditLog({ actorRegistration, action: 'settings.update', entityType: 'app_setting', entityId: key, newValue: value });
}

export async function getGestaoConfig(): Promise<GestaoConfigValue> {
  return getSetting(GESTAO_CONFIG_KEY, DEFAULT_GESTAO_CONFIG);
}

export async function saveGestaoConfig(value: GestaoConfigValue, actorRegistration: string | null): Promise<void> {
  return setSetting(GESTAO_CONFIG_KEY, value, actorRegistration);
}
