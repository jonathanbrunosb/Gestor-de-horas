import type { CollaboratorRow, CompanyCycleRow, LeaveRow, TimeRecordRow } from '../types/database';
import type { CollaboratorWithRelations, ComplianceAlert, CycleAlert, CycleReference } from '../types/domain';
import { NON_WORK_SCHEDULE_CODES } from '../lib/constants';
import { formatDate, toISODate } from './dates';
import { timeOfDayToMinutes } from './time';
import { computeRawWorkedMinutes, hasDayRollover } from './imports';
import {
  getCompanyConfig,
  getCurrentCyclePeriod,
  getCyclePeriodForPeriod,
  isCycleClosingMonth,
  isCycleClosingPeriod,
  positiveAlertMinutes
} from './cycles';
import { getCollaboratorCycleBalance, getCollaboratorCycleToDateBalance } from './periodBalances';

/** Um registro conta como dia útil "de trabalho" (exclui feriado/DSR/compensado/férias). */
export function isWorkingRecord(record: TimeRecordRow): boolean {
  if (!record) return false;
  if (record.schedule_code && NON_WORK_SCHEDULE_CODES.includes(record.schedule_code)) return false;
  if (/feriado|dsr|compensado|f[ée]rias/i.test(record.occurrence || '')) return false;
  return true;
}

export function hasFutureLeave(collaboratorId: string, leaves: LeaveRow[], today: Date = new Date()): boolean {
  const todayIso = toISODate(today);
  return leaves.some((leave) => leave.collaborator_id === collaboratorId && leave.leave_date >= todayIso);
}

function getMostRecentPeriod(collaboratorId: string, records: TimeRecordRow[]): string | null {
  const recs = records.filter((r) => r.collaborator_id === collaboratorId);
  if (!recs.length) return null;
  const periods = recs.map((r) => r.period || r.record_date?.slice(0, 7)).filter(Boolean).sort();
  return periods[periods.length - 1] ?? null;
}

/** Registros de trabalho (ver isWorkingRecord) de um colaborador numa competência, em ordem cronológica. */
export function getWorkingRecordsForPeriod(collaboratorId: string, records: TimeRecordRow[], period: string): TimeRecordRow[] {
  return records
    .filter((r) => r.collaborator_id === collaboratorId && (r.period === period || r.record_date?.startsWith(period)))
    .sort((a, b) => (a.record_date || '').localeCompare(b.record_date || ''))
    .filter(isWorkingRecord);
}

/** Um dia específico com violação de uma regra, com o registro de ponto correspondente (para exibir as marcações). */
export interface DailyViolation {
  date: string; // YYYY-MM-DD
  record: TimeRecordRow;
}

/** Interjornada CLT Art. 66: < 11h entre o fim de um dia de trabalho e o início do próximo. */
export function findInterjornadaViolations(workRecs: TimeRecordRow[]): DailyViolation[] {
  const violations: DailyViolation[] = [];
  for (let i = 0; i < workRecs.length - 1; i++) {
    const cur = workRecs[i];
    const next = workRecs[i + 1];
    if (!cur.punches?.length || !next.punches?.length) continue;

    const lastPunch = timeOfDayToMinutes(cur.punches[cur.punches.length - 1]);
    const firstPunch = timeOfDayToMinutes(next.punches[0]);
    if (lastPunch < 0 || firstPunch < 0) continue;

    const dateA = new Date(`${cur.record_date}T00:00:00`);
    const dateB = new Date(`${next.record_date}T00:00:00`);
    const daysDiff = Math.round((dateB.getTime() - dateA.getTime()) / 86400000);
    if (daysDiff < 1 || daysDiff > 3) continue;

    const gapMin = daysDiff * 1440 + firstPunch - lastPunch;
    if (gapMin > 0 && gapMin < 660) violations.push({ date: next.record_date, record: next });
  }
  return violations;
}

/** Intrajornada CLT Art. 71: intervalo de refeição < 1h em dias com > 6h trabalhadas. */
export function findIntrajornadaViolations(workRecs: TimeRecordRow[]): DailyViolation[] {
  const violations: DailyViolation[] = [];
  for (const rec of workRecs) {
    const marks = rec.punches || [];
    if (marks.length < 4) continue;

    const saida1 = timeOfDayToMinutes(marks[1]);
    const entrada2 = timeOfDayToMinutes(marks[2]);
    if (saida1 < 0 || entrada2 < 0) continue;

    const intervaloMin = entrada2 - saida1;
    if (intervaloMin < 60 && rec.worked_minutes > 360) violations.push({ date: rec.record_date, record: rec });
  }
  return violations;
}

/** Dias úteis com < 4 marcações (ignora dias já registrados como folga). */
export function findBatidaIncompletaViolations(workRecs: TimeRecordRow[], registeredLeaveDates: Set<string>): DailyViolation[] {
  const violations: DailyViolation[] = [];
  for (const rec of workRecs) {
    if (registeredLeaveDates.has(rec.record_date)) continue;
    if (!rec.punches?.length && rec.worked_minutes === 0) continue;
    const punchCount = rec.punches?.length ?? 0;
    if (punchCount > 0 && punchCount < 4) violations.push({ date: rec.record_date, record: rec });
    else if (punchCount === 0 && rec.worked_minutes > 0) violations.push({ date: rec.record_date, record: rec });
  }
  return violations;
}

/**
 * Regra do ACT — jornada padrão de 8h + até 2h extras/dia. Acima disso, o dia
 * infringe o acordo (tela KPIs - Classe A). Ex.: entra 08:00, sai 12:00,
 * volta 14:00, sai 20:00 -> 10h trabalhadas, 2h extras, dentro do ACT. Se a
 * saída final fosse 20:45 -> 10h45, 2h45 extras: as 2h primeiras vão para o
 * banco de horas normalmente, e os 45min excedentes é que configuram a
 * infração — ou seja, o que importa é o total de horas extras do dia
 * (trabalhado − jornada), não uma das parcelas em que ele é dividido depois.
 *
 * IMPORTANTE: por isso o cálculo usa o trabalhado BRUTO recalculado direto
 * das marcações (computeRawWorkedMinutes, utils/imports.ts) — nunca
 * worked_minutes (esse campo já chega limitado à jornada desde a origem:
 * cartão-ponto legado / calcPunchMetrics, "Trab." nunca passa de 8h) nem as
 * colunas credit_bh_minutes/extra_50_minutes/extra_100_minutes (essas podem
 * vir do arquivo importado já reclassificadas/divididas por outras regras da
 * folha, sem garantia de somarem de volta ao excedente real do dia — foi
 * essa suposição que causou contagem incorreta antes). Recalcular das 4
 * marcações elimina essa dependência e reproduz exatamente o exemplo acima.
 * Não é o mesmo limite de DEFAULT_POSITIVE_ALERT_MINUTES (esse é o saldo
 * ACUMULADO do ciclo; este aqui é por dia).
 */
export const DAILY_JOURNEY_MINUTES = 480;
export const DAILY_EXTRA_LIMIT_MINUTES = 120;

/** Horas extras do dia (trabalhado bruto pelas marcações − jornada padrão de 8h), nunca negativo. */
export function getDailyExtraMinutes(record: TimeRecordRow): number {
  return Math.max(0, computeRawWorkedMinutes(record.punches || []) - DAILY_JOURNEY_MINUTES);
}

/**
 * Dias com horas extras acima do limite diário permitido pelo ACT (2h).
 * Exclui dias com virada de dia (ver findDayRolloverViolations) — nesses
 * dias o trabalhado bruto pode chegar a 14h+ por causa de uma marcação de
 * saída provavelmente faltando (o sistema soma até o dia seguinte), então o
 * excedente calculado não é confiável para contar aqui; o dia ainda aparece,
 * só que como o alerta separado de virada de dia, para revisão manual.
 */
export function findOverDailyLimitViolations(workRecs: TimeRecordRow[]): DailyViolation[] {
  return workRecs
    .filter((rec) => !hasDayRollover(rec.punches || []) && getDailyExtraMinutes(rec) > DAILY_EXTRA_LIMIT_MINUTES)
    .map((rec) => ({ date: rec.record_date, record: rec }));
}

/**
 * Dias em que a saída registrada (4ª marcação) é numericamente anterior à
 * volta do almoço (3ª marcação) — indício de marcação de saída faltando,
 * não necessariamente um dia de 14h+ de trabalho real. Alerta separado
 * (tela KPIs - Classe A) para revisão manual, fora da contagem de "H Trab.
 * Acima do Limite".
 */
export function findDayRolloverViolations(workRecs: TimeRecordRow[]): DailyViolation[] {
  return workRecs.filter((rec) => hasDayRollover(rec.punches || [])).map((rec) => ({ date: rec.record_date, record: rec }));
}

/**
 * Gera alertas de compliance (interjornada CLT Art.66, intrajornada CLT Art.71,
 * batida incompleta e lembrete D-1 de folga).
 *
 * Com `reference`, a análise é feita na competência informada (o mês do
 * filtro) para todos os colaboradores — sem ela, cada colaborador é
 * analisado na sua própria competência mais recente, que é o comportamento
 * das telas sem filtro de mês. O lembrete D-1 de folga só é emitido quando a
 * competência analisada é a corrente (ou posterior): olhando um mês passado,
 * "folga amanhã" não é acionável.
 */
export function getComplianceAlerts(
  collaborators: CollaboratorWithRelations[],
  records: TimeRecordRow[],
  leaves: LeaveRow[],
  reference?: CycleReference
): ComplianceAlert[] {
  const alerts: ComplianceAlert[] = [];
  const today = reference?.date ?? new Date();

  for (const collaborator of collaborators) {
    if (collaborator.status !== 'Ativo') continue;

    const period = reference?.period ?? getMostRecentPeriod(collaborator.id, records);
    if (!period) continue;

    const workRecs = getWorkingRecordsForPeriod(collaborator.id, records, period);
    if (!workRecs.length) continue;

    // Interjornada: < 11h entre o fim de um dia e o início do próximo
    const interjornadaViolationDays = findInterjornadaViolations(workRecs);
    const interjornadaViolations = interjornadaViolationDays.length;
    if (interjornadaViolations >= 1) {
      const interjornadaDays = interjornadaViolationDays.map((v) => formatDate(v.date));
      alerts.push({
        type: 'interjornada',
        collaborator,
        count: interjornadaViolations,
        period,
        details: `${interjornadaViolations} descumprimento(s) — intervalo entre jornadas < 11h (${interjornadaDays
          .slice(0, 3)
          .join(', ')}${interjornadaViolations > 3 ? '…' : ''})`
      });
    }

    // Intrajornada: intervalo de refeição < 1h em dias com > 6h trabalhadas
    const intrajornadaViolationDays = findIntrajornadaViolations(workRecs);
    const intrajornadaViolations = intrajornadaViolationDays.length;
    if (intrajornadaViolations >= 1) {
      const intrajornadaDays = intrajornadaViolationDays.map((v) => formatDate(v.date));
      alerts.push({
        type: 'intrajornada',
        collaborator,
        count: intrajornadaViolations,
        period,
        details: `${intrajornadaViolations} descumprimento(s) — intervalo de refeição < 1h em dias com > 6h trabalhadas (${intrajornadaDays
          .slice(0, 3)
          .join(', ')}${intrajornadaViolations > 3 ? '…' : ''})`
      });
    }

    // Batidas incompletas: dias úteis com < 4 marcações (ignora dias já registrados como folga)
    const registeredLeaves = new Set(leaves.filter((l) => l.collaborator_id === collaborator.id).map((l) => l.leave_date));
    const incompleteDays = findBatidaIncompletaViolations(workRecs, registeredLeaves).map((v) => ({
      date: formatDate(v.date),
      iso: v.date,
      punches: v.record.punches?.length ?? 0
    }));
    if (incompleteDays.length > 0) {
      const label = incompleteDays
        .slice(0, 3)
        .map((d) => `${d.date}(${d.punches}bat.)`)
        .join(', ');
      alerts.push({
        type: 'batida_incompleta',
        collaborator,
        count: incompleteDays.length,
        period,
        details: `${incompleteDays.length} dia(s) com batida incompleta: ${label}${incompleteDays.length > 3 ? '…' : ''}`,
        incompleteDays: incompleteDays.map((d) => d.iso)
      });
    }
  }

  // Lembrete D-1: folgas agendadas para amanhã — só faz sentido no presente.
  if (reference && !reference.isPresent) return alerts.sort((a, b) => b.count - a.count);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = toISODate(tomorrow);

  for (const leave of leaves) {
    if (leave.leave_date !== tomorrowIso) continue;
    const collaborator = collaborators.find((c) => c.id === leave.collaborator_id);
    if (!collaborator || collaborator.status !== 'Ativo') continue;
    alerts.push({
      type: 'folga_amanha',
      collaborator,
      count: 1,
      period: tomorrowIso,
      details: `Folga amanhã (${formatDate(tomorrowIso)}) — ${leave.reason || 'Compensação'}`,
      leaveDate: leave.leave_date,
      leaveReason: leave.reason || 'Compensação de banco de horas'
    });
  }

  return alerts.sort((a, b) => b.count - a.count);
}

/**
 * Alertas de encerramento de ciclo com saldo positivo acima do limite. O
 * saldo é somado a partir dos registros de ponto do ciclo (nunca da coluna
 * estática cycle_balance_minutes do cadastro, que só é atualizada por
 * importação de backup e fica desatualizada assim que uma nova competência é
 * importada via upload de folha de ponto).
 *
 * Com `reference` (competência analisada), tanto a janela do ciclo quanto a
 * checagem de "é o mês de encerramento?" passam a ser dessa competência —
 * é o que faz o Dashboard responder ao filtro Mês. Sem ela, mantém o
 * comportamento ancorado em hoje (usado pelas telas sem filtro de mês).
 */
export function getCycleAlerts(
  collaborators: CollaboratorWithRelations[],
  cycles: CompanyCycleRow[],
  leaves: LeaveRow[],
  records: TimeRecordRow[],
  reference?: CycleReference
): CycleAlert[] {
  return collaborators
    .filter((c) => c.status === 'Ativo')
    .map((c): CycleAlert => {
      const config = getCompanyConfig(cycles, c.company_id);
      const cyclePeriod = reference ? getCyclePeriodForPeriod(config, reference.period) : getCurrentCyclePeriod(config);
      const balanceMinutes = reference
        ? getCollaboratorCycleToDateBalance(c.id, records, cyclePeriod, reference.period)
        : getCollaboratorCycleBalance(c.id, records, cyclePeriod);
      const limitMinutes = positiveAlertMinutes(config);
      const closing = reference ? isCycleClosingPeriod(config, reference.period) : isCycleClosingMonth(config);
      const futureLeave = hasFutureLeave(c.id, leaves, reference?.date);
      return { collaborator: c, config, balanceMinutes, limitMinutes, closing, hasFutureLeave: futureLeave };
    })
    .filter((item) => item.closing && item.balanceMinutes > item.limitMinutes)
    .sort((a, b) => b.balanceMinutes - a.balanceMinutes);
}

/**
 * Status calculado de um colaborador a partir do saldo do ciclo (ver
 * getCollaboratorCycleBalance) — usado em tabelas e badges. Com `reference`,
 * "Crítico" (encerramento com saldo acima do limite) e "Folga programada"
 * são avaliados na competência analisada em vez de sempre em hoje.
 */
export function getCollaboratorStatus(
  collaborator: CollaboratorRow,
  balanceMinutes: number,
  config: CompanyCycleRow | null,
  leaves: LeaveRow[],
  reference?: CycleReference
): 'Regular' | 'Atenção' | 'Crítico' | 'Folga programada' | 'Inativo' {
  if (!collaborator || collaborator.status !== 'Ativo') return 'Inativo';
  const positiveLimit = positiveAlertMinutes(config);
  const negativeLimit = config ? config.negative_alert_minutes : -300;
  const closing = reference ? isCycleClosingPeriod(config, reference.period) : isCycleClosingMonth(config);
  if (closing && balanceMinutes > positiveLimit) return 'Crítico';
  if (hasFutureLeave(collaborator.id, leaves, reference?.date)) return 'Folga programada';
  if (balanceMinutes > positiveLimit || balanceMinutes < negativeLimit) return 'Atenção';
  return 'Regular';
}
