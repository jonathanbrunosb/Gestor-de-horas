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
 * Competências (YYYY-MM) disponíveis para seleção no filtro Mês: sempre de
 * janeiro até o mês atual do ano corrente (independente de já haver ou não
 * registro importado nesse mês) — mais recente primeiro. Não lista meses
 * futuros nem de anos anteriores.
 */
export function listSelectableMonths(today: Date = new Date()): string[] {
  const year = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const months: string[] = [];
  for (let month = currentMonth; month >= 1; month--) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
  }
  return months;
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

/**
 * Saldo do ciclo acumulado da competência inicial do ciclo até `uptoPeriod`
 * (inclusive) — não conta meses do ciclo posteriores a `uptoPeriod`, mesmo
 * que já tenham registro importado. Usado para consolidar o Dashboard num
 * mês de filtro específico sem "vazar" saldo de competências futuras em
 * relação ao mês selecionado.
 */
export function getCollaboratorCycleToDateBalance(
  collaboratorId: string,
  records: TimeRecordRow[],
  cyclePeriod: CyclePeriod,
  uptoPeriod: string
): number {
  return getCollaboratorCycleBalance(collaboratorId, records, { ...cyclePeriod, end: uptoPeriod });
}
