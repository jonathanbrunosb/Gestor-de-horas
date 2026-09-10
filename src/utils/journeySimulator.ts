import type { JourneyEntryStatus, JourneyEntryValidationInput, JourneyEntryValidationResult, JourneySimulationInput, JourneySimulationResult } from '../types/journeySimulator';

/** Combina data ("YYYY-MM-DD") e horário ("HH:MM") num Date local — sem depender de fuso/UTC. */
function combineDateTime(dateISO: string, time: string): Date {
  const [year, month, day] = dateISO.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0, 0);
}

/** Soma minutos a um Date por aritmética de timestamp — vira dia/mês/ano automaticamente, sem setMinutes mutável. */
function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** "10/09/2026 às 10:41" */
export function formatJourneyDateTime(dateTime: Date): string {
  const dd = String(dateTime.getDate()).padStart(2, '0');
  const mm = String(dateTime.getMonth() + 1).padStart(2, '0');
  const yyyy = dateTime.getFullYear();
  const hh = String(dateTime.getHours()).padStart(2, '0');
  const mi = String(dateTime.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} às ${hh}:${mi}`;
}

/** "650" -> "10h50" / "660" -> "11h00" / "-30" -> "-0h30" */
export function formatDurationFromMinutes(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.round(Math.abs(minutes));
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return `${sign}${hours}h${String(mins).padStart(2, '0')}`;
}

/**
 * Horário técnico mínimo = última saída + descanso mínimo (11h por padrão,
 * conforme ACT/interjornada). Horário recomendado = técnico + margem
 * operacional de segurança (+1 minuto por padrão, para não deixar a
 * marcação exatamente no limite).
 */
export function calculateMinimumEntry(input: JourneySimulationInput): JourneySimulationResult {
  const lastExitDateTime = combineDateTime(input.lastExitDate, input.lastExitTime);
  const minimumRestMinutes = Math.round(input.minimumRestHours * 60);
  const technicalMinimumEntryDateTime = addMinutes(lastExitDateTime, minimumRestMinutes);
  const operationalMarginMinutes = input.useOperationalMargin ? Math.round(input.operationalMarginMinutes) : 0;
  const recommendedEntryDateTime = addMinutes(technicalMinimumEntryDateTime, operationalMarginMinutes);

  const message = input.useOperationalMargin
    ? `Para respeitar o descanso mínimo de ${formatDurationFromMinutes(minimumRestMinutes)} após a jornada anterior, a próxima entrada deve ocorrer a partir de ${formatJourneyDateTime(
        recommendedEntryDateTime
      )}, considerando margem operacional de segurança.`
    : `Para respeitar o descanso mínimo de ${formatDurationFromMinutes(minimumRestMinutes)} após a jornada anterior, a próxima entrada deve ocorrer a partir de ${formatJourneyDateTime(
        recommendedEntryDateTime
      )}.`;

  return {
    lastExitDateTime,
    technicalMinimumEntryDateTime,
    recommendedEntryDateTime,
    minimumRestMinutes,
    operationalMarginMinutes: input.operationalMarginMinutes,
    useOperationalMargin: input.useOperationalMargin,
    status: 'regular_from_recommended_time',
    message
  };
}

const STATUS_LABELS: Record<JourneyEntryStatus, string> = {
  risk: 'Risco de interjornada',
  attention: 'Atenção',
  regular: 'Regular'
};

const STATUS_MESSAGES: Record<JourneyEntryStatus, string> = {
  risk: 'Entrada antes do descanso mínimo obrigatório.',
  attention: 'Horário técnico atingido, mas recomenda-se aguardar a margem operacional.',
  regular: 'Jornada respeita o descanso mínimo.'
};

/**
 * Classifica uma próxima entrada prevista frente à última saída:
 * - Risco: descanso apurado abaixo do mínimo (11h).
 * - Atenção: mínimo técnico atingido, mas ainda dentro da margem operacional
 *   (só existe quando a margem está ativa).
 * - Regular: descanso apurado cobre o mínimo e, com margem ativa, a entrada
 *   prevista já alcança o horário recomendado.
 */
export function validatePlannedEntry(input: JourneyEntryValidationInput): JourneyEntryValidationResult {
  const base = calculateMinimumEntry(input);
  const plannedEntryDateTime = combineDateTime(input.plannedEntryDate, input.plannedEntryTime);
  const restMinutes = Math.round((plannedEntryDateTime.getTime() - base.lastExitDateTime.getTime()) / 60_000);

  let status: JourneyEntryStatus;
  if (plannedEntryDateTime.getTime() < base.technicalMinimumEntryDateTime.getTime()) {
    status = 'risk';
  } else if (input.useOperationalMargin && plannedEntryDateTime.getTime() < base.recommendedEntryDateTime.getTime()) {
    status = 'attention';
  } else {
    status = 'regular';
  }

  // Minutos que faltam até o horário mínimo efetivo (recomendado, quando a
  // margem operacional está ativa; técnico, quando ela está desligada) — 0
  // quando a entrada prevista já alcançou esse horário.
  const effectiveThreshold = input.useOperationalMargin ? base.recommendedEntryDateTime : base.technicalMinimumEntryDateTime;
  const missingMinutes = Math.max(0, Math.round((effectiveThreshold.getTime() - plannedEntryDateTime.getTime()) / 60_000));

  return {
    status,
    statusLabel: STATUS_LABELS[status],
    plannedEntryDateTime,
    restMinutes,
    missingMinutes,
    technicalMinimumEntryDateTime: base.technicalMinimumEntryDateTime,
    recommendedEntryDateTime: base.recommendedEntryDateTime,
    message: STATUS_MESSAGES[status]
  };
}
