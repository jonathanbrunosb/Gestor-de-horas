import type { CollaboratorRow, CompanyRow, LeaveRow, ManagerRow, TimeRecordRow } from '../types/database';
import type { CollaboratorWithRelations, KpiClasseAStats, KpiOccurrence, KpiOccurrenceCount, KpiOccurrenceType } from '../types/domain';
import {
  findBatidaIncompletaViolations,
  findDayRolloverViolations,
  findInterjornadaViolations,
  findIntrajornadaViolations,
  findOverDailyLimitViolations,
  getWorkingRecordsForPeriod
} from '../utils/compliance';
import { listAvailablePeriods } from '../utils/periodBalances';

export type Quarter = 1 | 2 | 3 | 4;

export const QUARTER_LABELS: Record<Quarter, string> = {
  1: 'Jan - Mar',
  2: 'Abr - Jun',
  3: 'Jul - Set',
  4: 'Out - Dez'
};

export const KPI_OCCURRENCE_TYPES: KpiOccurrenceType[] = ['over_daily_limit', 'interjornada', 'intrajornada', 'batida_incompleta', 'virada_dia'];

export const KPI_OCCURRENCE_LABELS: Record<KpiOccurrenceType, string> = {
  over_daily_limit: 'H Trab. Acima do Limite (+2h)',
  interjornada: 'Interjornada Diária (11h)',
  intrajornada: 'Intrajornada (1h)',
  batida_incompleta: 'Batida Incompleta',
  virada_dia: 'Virada de Dia (possível falha de marcação)'
};

/** Meses (YYYY-MM) do trimestre informado, em ordem cronológica. */
export function getQuarterMonths(year: number, quarter: Quarter): string[] {
  const startMonth = (quarter - 1) * 3 + 1;
  return [0, 1, 2].map((i) => `${year}-${String(startMonth + i).padStart(2, '0')}`);
}

export function getQuarterOfMonth(month: number): Quarter {
  return Math.min(4, Math.max(1, Math.ceil(month / 3))) as Quarter;
}

export function getCurrentQuarter(today: Date = new Date()): Quarter {
  return getQuarterOfMonth(today.getMonth() + 1);
}

/** "2026-07" -> "julho". */
function monthShortLabel(period: string): string {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return period;
  return new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(year, month - 1, 1));
}

/** Anos com dado importado, mais o ano corrente (para o filtro nunca ficar vazio numa base nova), mais recente primeiro. */
export function getAvailableKpiYears(records: TimeRecordRow[], today: Date = new Date()): number[] {
  const years = new Set<number>([today.getFullYear()]);
  for (const period of listAvailablePeriods(records)) {
    const year = Number(period.slice(0, 4));
    if (!Number.isNaN(year)) years.add(year);
  }
  return Array.from(years).sort((a, b) => b - a);
}

/**
 * Composição pura das ocorrências da tela KPIs - Classe A, consolidadas por
 * trimestre (seção "Gestão de horas" — acompanhamento gerencial). Cada
 * ocorrência é um evento (um colaborador, um dia, um tipo) — diferente de
 * ComplianceAlert (utils/compliance.ts), que agrega por colaborador só na
 * competência mais recente/selecionada. Aqui é preciso um evento por dia ao
 * longo dos 3 meses do trimestre, para alimentar o quadro de listagem.
 *
 * Reaproveita as mesmas regras de interjornada/intrajornada/batida
 * incompleta já usadas no Dashboard (getWorkingRecordsForPeriod + os
 * find*Violations de utils/compliance.ts) — nenhuma regra existente foi
 * alterada, só extraída para ser reutilizável por dia. As regras novas são
 * "H Trab. Acima do Limite (+2h)" (findOverDailyLimitViolations): jornada de
 * 8h + até 2h extras/dia, calculado direto das marcações; e "Virada de Dia"
 * (findDayRolloverViolations): dias em que a marcação de saída parece ter
 * "vazado" para o dia seguinte (indício de batida faltando) — ficam de fora
 * da contagem de H Trab. Acima do Limite (o trabalhado calculado ali não é
 * confiável) e aparecem como um alerta separado para revisão manual.
 */
export function computeKpiClasseAStats(options: {
  collaborators: CollaboratorRow[];
  companies: CompanyRow[];
  managers: ManagerRow[];
  records: TimeRecordRow[];
  leaves: LeaveRow[];
  year: number;
  quarter: Quarter;
}): KpiClasseAStats {
  const { collaborators, companies, managers, records, leaves, year, quarter } = options;

  const withRelations: CollaboratorWithRelations[] = collaborators.map((c) => ({
    ...c,
    company: companies.find((co) => co.id === c.company_id) ?? null,
    manager: managers.find((m) => m.id === c.manager_id) ?? null
  }));
  const active = withRelations.filter((c) => c.status === 'Ativo');
  const periods = getQuarterMonths(year, quarter);

  const occurrences: KpiOccurrence[] = [];
  for (const collaborator of active) {
    const registeredLeaves = new Set(leaves.filter((l) => l.collaborator_id === collaborator.id).map((l) => l.leave_date));

    for (const period of periods) {
      const workRecs = getWorkingRecordsForPeriod(collaborator.id, records, period);
      if (!workRecs.length) continue;

      const push = (type: KpiOccurrenceType, date: string, punches: string[]) => occurrences.push({ type, collaborator, date, punches });

      for (const v of findOverDailyLimitViolations(workRecs)) push('over_daily_limit', v.date, v.record.punches ?? []);
      for (const v of findInterjornadaViolations(workRecs)) push('interjornada', v.date, v.record.punches ?? []);
      for (const v of findIntrajornadaViolations(workRecs)) push('intrajornada', v.date, v.record.punches ?? []);
      for (const v of findBatidaIncompletaViolations(workRecs, registeredLeaves)) push('batida_incompleta', v.date, v.record.punches ?? []);
      for (const v of findDayRolloverViolations(workRecs)) push('virada_dia', v.date, v.record.punches ?? []);
    }
  }

  occurrences.sort((a, b) => (a.date === b.date ? a.collaborator.name.localeCompare(b.collaborator.name) : b.date.localeCompare(a.date)));

  const byMonth: KpiOccurrenceCount[] = periods.map((period) => ({
    key: period,
    label: monthShortLabel(period),
    count: occurrences.filter((o) => o.date.startsWith(period)).length
  }));

  const byType: KpiOccurrenceCount[] = KPI_OCCURRENCE_TYPES.map((type) => ({
    key: type,
    label: KPI_OCCURRENCE_LABELS[type],
    count: occurrences.filter((o) => o.type === type).length
  }));

  return { occurrences, byMonth, byType };
}
