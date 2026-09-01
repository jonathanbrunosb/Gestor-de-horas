import type { CollaboratorRow, CompanyCycleRow, LeaveRow, TimeRecordRow } from '../types/database';
import type { CollaboratorWithRelations, ComplianceAlert, CycleAlert } from '../types/domain';
import { NON_WORK_SCHEDULE_CODES } from '../lib/constants';
import { formatDate, toISODate } from './dates';
import { timeOfDayToMinutes } from './time';
import { getCompanyConfig, isCycleClosingMonth, positiveAlertMinutes } from './cycles';

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

/**
 * Gera alertas de compliance (interjornada CLT Art.66, intrajornada CLT Art.71,
 * batida incompleta e lembrete D-1 de folga) — porta fiel de getComplianceAlerts().
 */
export function getComplianceAlerts(
  collaborators: CollaboratorWithRelations[],
  records: TimeRecordRow[],
  leaves: LeaveRow[],
  today: Date = new Date()
): ComplianceAlert[] {
  const alerts: ComplianceAlert[] = [];

  for (const collaborator of collaborators) {
    if (collaborator.status !== 'Ativo') continue;

    const period = getMostRecentPeriod(collaborator.id, records);
    if (!period) continue;

    const allRecs = records
      .filter((r) => r.collaborator_id === collaborator.id && (r.period === period || r.record_date?.startsWith(period)))
      .sort((a, b) => (a.record_date || '').localeCompare(b.record_date || ''));

    const workRecs = allRecs.filter(isWorkingRecord);
    if (!workRecs.length) continue;

    // Interjornada: < 11h entre o fim de um dia e o início do próximo
    let interjornadaViolations = 0;
    const interjornadaDays: string[] = [];
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
      if (gapMin > 0 && gapMin < 660) {
        interjornadaViolations++;
        interjornadaDays.push(formatDate(next.record_date));
      }
    }
    if (interjornadaViolations >= 1) {
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
    let intrajornadaViolations = 0;
    const intrajornadaDays: string[] = [];
    for (const rec of workRecs) {
      const marks = rec.punches || [];
      if (marks.length < 4) continue;

      const saida1 = timeOfDayToMinutes(marks[1]);
      const entrada2 = timeOfDayToMinutes(marks[2]);
      if (saida1 < 0 || entrada2 < 0) continue;

      const intervaloMin = entrada2 - saida1;
      const trabalhados = rec.worked_minutes;

      if (intervaloMin < 60 && trabalhados > 360) {
        intrajornadaViolations++;
        intrajornadaDays.push(formatDate(rec.record_date));
      }
    }
    if (intrajornadaViolations >= 1) {
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
    const incompleteDays: Array<{ date: string; iso: string; punches: number }> = [];
    for (const rec of workRecs) {
      if (registeredLeaves.has(rec.record_date)) continue;
      if (!rec.punches?.length && rec.worked_minutes === 0) continue;
      const punchCount = rec.punches?.length ?? 0;
      if (punchCount > 0 && punchCount < 4) {
        incompleteDays.push({ date: formatDate(rec.record_date), iso: rec.record_date, punches: punchCount });
      } else if (punchCount === 0 && rec.worked_minutes > 0) {
        incompleteDays.push({ date: formatDate(rec.record_date), iso: rec.record_date, punches: 0 });
      }
    }
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

  // Lembrete D-1: folgas agendadas para amanhã
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

/** Alertas de encerramento de ciclo com saldo positivo acima do limite. */
export function getCycleAlerts(
  collaborators: CollaboratorWithRelations[],
  cycles: CompanyCycleRow[],
  leaves: LeaveRow[]
): CycleAlert[] {
  return collaborators
    .filter((c) => c.status === 'Ativo')
    .map((c): CycleAlert => {
      const config = getCompanyConfig(cycles, c.company_id);
      const balanceMinutes = c.cycle_balance_minutes || c.bank_hours_balance_minutes;
      const limitMinutes = positiveAlertMinutes(config);
      const closing = isCycleClosingMonth(config);
      const futureLeave = hasFutureLeave(c.id, leaves);
      return { collaborator: c, config, balanceMinutes, limitMinutes, closing, hasFutureLeave: futureLeave };
    })
    .filter((item) => item.closing && item.balanceMinutes > item.limitMinutes)
    .sort((a, b) => b.balanceMinutes - a.balanceMinutes);
}

/** Status calculado de um colaborador — usado em tabelas e badges. */
export function getCollaboratorStatus(
  collaborator: CollaboratorRow,
  config: CompanyCycleRow | null,
  leaves: LeaveRow[]
): 'Regular' | 'Atenção' | 'Crítico' | 'Folga programada' | 'Inativo' {
  if (!collaborator || collaborator.status !== 'Ativo') return 'Inativo';
  const balance = collaborator.cycle_balance_minutes || collaborator.bank_hours_balance_minutes;
  const positiveLimit = positiveAlertMinutes(config);
  const negativeLimit = config ? config.negative_alert_minutes : -300;
  if (isCycleClosingMonth(config) && balance > positiveLimit) return 'Crítico';
  if (hasFutureLeave(collaborator.id, leaves)) return 'Folga programada';
  if (balance > positiveLimit || balance < negativeLimit) return 'Atenção';
  return 'Regular';
}
