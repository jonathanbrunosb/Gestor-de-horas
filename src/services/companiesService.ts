import { getSupabase } from '../lib/supabaseClient';
import type { CompanyRow } from '../types/database';

export async function listCompanies(): Promise<CompanyRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('companies').select('*').order('short_name');
  if (error) throw error;
  return data ?? [];
}
