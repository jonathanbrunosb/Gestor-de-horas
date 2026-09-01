import type { TimeRecordRow } from '../types/database';
import type { CyclePeriod } from '../types/domain';

export interface PeriodBalance {
  period: string;
  creditMinutes: number;
  debitMinutes: number;
  balanceMinutes: number;
  hasRecords: boolean;
}

function periodOf(record: TimeRecordRow): string {
  return record.period || record.record_date?.slice(0, 7) || '';
}

/** Todas as competências (YYYY-MM) com registro de ponto importado, mais recente primeiro. */
export function listAvailablePeriods(records: TimeRecordRow[]): string[] {
  const set = new Set<string>();
  for (const record of records) {
    const period = periodOf(record);
    if (period) set.add(period);
  }
  return Array.from(set).sort().reverse();
}

/** Competência mais recente com dados importados (base para a visão "dia-mês" padrão do Dashboard). */
export function getLatestPeriod(records: TimeRecordRow[]): string | null {
  const periods = listAvailablePeriods(records);
  return periods[0] ?? null;
}

/**
 * Soma crédito/débito/saldo de banco de horas de um colaborador em uma
 * competência específica, a partir dos registros de ponto (nunca de colunas
 * estáticas do cadastro, que podem estar desatualizadas em relação aos
 * últimos uploads).
 */
export function getCollaboratorPeriodBalance(collaboratorId: string, records: TimeRecordRow[], period: string): PeriodBalance {
  const recs = records.filter((r) => r.collaborator_id === collaboratorId && periodOf(r) === period);
  const totals = recs.reduce(
    (acc, r) => ({
      creditMinutes: acc.creditMinutes + r.credit_bh_minutes,
      debitMinutes: acc.debitMinutes + r.debit_bh_minutes,
      balanceMinutes: acc.balanceMinutes + r.balance_bh_minutes
    }),
    { creditMinutes: 0, debitMinutes: 0, balanceMinutes: 0 }
  );
  return { period, ...totals, hasRecords: recs.length > 0 };
}

/**
 * Saldo de banco de horas de um colaborador dentro do ciclo de compensação
 * vigente da empresa (ex.: 4 meses), somando o saldo (crédito − débito) de
 * cada competência do intervalo — nunca a coluna estática cycle_balance_minutes
 * do cadastro, que só é atualizada por importação de backup.
 */
export function getCollaboratorCycleBalance(collaboratorId: string, records: TimeRecordRow[], cyclePeriod: CyclePeriod): number {
  return records
    .filter((r) => r.collaborator_id === collaboratorId)
    .filter((r) => {
      const period = periodOf(r);
      return period >= cyclePeriod.start && period <= cyclePeriod.end;
    })
    .reduce((sum, r) => sum + r.balance_bh_minutes, 0);
}
