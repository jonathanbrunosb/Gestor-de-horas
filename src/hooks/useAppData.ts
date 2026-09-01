import { useCallback, useEffect, useState } from 'react';
import type { AccessProfileRow, CollaboratorRow, CompanyCycleRow, CompanyRow, ImportRow, LeaveRow, ManagerRow, TimeRecordRow } from '../types/database';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { listCompanies } from '../services/companiesService';
import { listCollaborators } from '../services/collaboratorsService';
import { listManagers } from '../services/managersService';
import { listAccessProfiles } from '../services/accessProfilesService';
import { listCycles } from '../services/cyclesService';
import { listLeaves } from '../services/leavesService';
import { listImports } from '../services/importsService';
import { getSupabase } from '../lib/supabaseClient';

export interface AppData {
  companies: CompanyRow[];
  collaborators: CollaboratorRow[];
  managers: ManagerRow[];
  accessProfiles: AccessProfileRow[];
  cycles: CompanyCycleRow[];
  leaves: LeaveRow[];
  records: TimeRecordRow[];
  imports: ImportRow[];
}

const EMPTY_DATA: AppData = {
  companies: [],
  collaborators: [],
  managers: [],
  accessProfiles: [],
  cycles: [],
  leaves: [],
  records: [],
  imports: []
};

/** Carrega todas as tabelas usadas pela aplicação. Os registros de ponto (time_records)
 * são grandes, então são paginados em blocos de 1000 para não estourar o limite do PostgREST. */
async function listAllRecords(): Promise<TimeRecordRow[]> {
  const supabase = getSupabase();
  const pageSize = 1000;
  let from = 0;
  const all: TimeRecordRow[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase.from('time_records').select('*').range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

/**
 * Hook central de dados — o Supabase é a base oficial (nunca localStorage).
 * Falha de configuração do Supabase é reportada em `configError`, sem travar a UI.
 */
export function useAppData() {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError('Supabase não está configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [companies, collaborators, managers, accessProfiles, cycles, leaves, records, imports] = await Promise.all([
        listCompanies(),
        listCollaborators(),
        listManagers(),
        listAccessProfiles(),
        listCycles(),
        listLeaves(),
        listAllRecords(),
        listImports()
      ]);
      setData({ companies, collaborators, managers, accessProfiles, cycles, leaves, records, imports });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar dados do Supabase.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...data, loading, error, reload };
}
