import { useCallback, useEffect, useRef, useState } from 'react';
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
import { readCache, writeCache } from '../lib/dataCache';

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

/**
 * Carrega todas as tabelas usadas pela aplicação. Os registros de ponto
 * (time_records) são grandes, então são paginados em blocos de 1000 para não
 * estourar o limite do PostgREST — mas em vez de buscar página por página em
 * sequência (uma esperando a anterior terminar), busca primeiro só a
 * contagem e dispara todas as páginas em paralelo, o que reduz o tempo de
 * carregamento a praticamente uma única viagem de rede (mais o tempo da
 * página mais lenta), em vez de uma viagem por página.
 */
async function listAllRecords(): Promise<TimeRecordRow[]> {
  const supabase = getSupabase();
  const pageSize = 1000;

  const { count, error: countError } = await supabase.from('time_records').select('*', { count: 'exact', head: true });
  if (countError) throw countError;
  const total = count ?? 0;
  if (total === 0) return [];

  const pageCount = Math.ceil(total / pageSize);
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, i) => {
      const from = i * pageSize;
      return supabase.from('time_records').select('*').range(from, from + pageSize - 1);
    })
  );

  const all: TimeRecordRow[] = [];
  for (const { data, error } of pages) {
    if (error) throw error;
    all.push(...(data ?? []));
  }
  return all;
}

/**
 * Hook central de dados — o Supabase é sempre a fonte de verdade (nenhuma
 * escrita passa por localStorage). O que o localStorage guarda é só um
 * snapshot de leitura (ver lib/dataCache.ts) para renderizar instantaneamente
 * com o último dado conhecido em vez de bloquear a tela toda atrás de
 * "Carregando dados…" a cada F5/nova aba/ação que recarrega os dados —
 * enquanto isso, busca os dados atuais do Supabase em segundo plano e troca
 * silenciosamente assim que chegam. `loading` (que bloqueia a tela toda em
 * App.tsx) só fica true quando não há absolutamente nenhum dado — nem
 * cache nem uma busca anterior bem-sucedida — para mostrar; qualquer
 * recarregamento depois disso (F5 com cache, ou `reload()` chamado após uma
 * ação do usuário) usa `refreshing`, que não derruba a UI.
 */
export function useAppData() {
  const cached = readCache();
  const [data, setData] = useState<AppData>(cached ?? EMPTY_DATA);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasDataRef = useRef(Boolean(cached));

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError('Supabase não está configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
      setLoading(false);
      return;
    }
    if (hasDataRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
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
      const next: AppData = { companies, collaborators, managers, accessProfiles, cycles, leaves, records, imports };
      setData(next);
      setError(null);
      hasDataRef.current = true;
      writeCache(next);
    } catch (err) {
      // Se já havia dado em tela (cache ou busca anterior), uma falha ao
      // sincronizar em segundo plano não deve derrubar a aplicação inteira —
      // só reporta erro bloqueante quando não há nada para mostrar no lugar.
      if (!hasDataRef.current) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar dados do Supabase.');
      } else {
        console.error('Falha ao sincronizar dados do Supabase em segundo plano:', err);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...data, loading, refreshing, error, reload };
}
