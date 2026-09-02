/**
 * Utilitários de tempo — porta fiel das funções timeToMinutes/minutesToTime
 * do sistema legado. O banco armazena sempre minutos inteiros; strings
 * "HH:MM" existem só na borda de UI/import/export.
 */

/** Converte "HH:MM", "-HH:MM" ou "HH:MM-" (sufixo de PDF) em minutos inteiros. */
export function timeToMinutes(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Math.round(value);

  let text = String(value).trim();
  if (!text || text === '-' || text.toLowerCase() === 'null') return 0;
  text = text.replace(',', ':');

  // PDFs do cartão-ponto às vezes trazem o sinal negativo como sufixo: "00:34-"
  let sign = 1;
  if (text.endsWith('-')) {
    sign = -1;
    text = text.slice(0, -1);
  }
  if (text.startsWith('-')) {
    sign = -1;
    text = text.slice(1);
  }

  if (!/^\d{1,5}:\d{2}$/.test(text)) return 0;
  const [hours, minutes] = text.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return sign * (hours * 60 + minutes);
}

/** Converte minutos inteiros (positivos ou negativos, acima ou não de 24h) em "HH:MM". */
export function minutesToTime(minutes: number | null | undefined): string {
  const total = Number(minutes) || 0;
  const sign = total < 0 ? '-' : '';
  const abs = Math.abs(total);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return `${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function sumTimes(values: Array<string | number | null | undefined>): string {
  return minutesToTime(values.reduce<number>((acc, item) => acc + timeToMinutes(item), 0));
}

export function subtractTimes(a: string | number, b: string | number): string {
  return minutesToTime(timeToMinutes(a) - timeToMinutes(b));
}

/** Normaliza uma entrada de horário de usuário/import para o formato canônico "HH:MM"/"-HH:MM". */
export function normalizeTime(value: string | null | undefined): string {
  return minutesToTime(timeToMinutes(value));
}

/** Formata minutos como duração legível, ex.: "8h 30min" — usado em notas/tooltips. */
export function formatDuration(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}min`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}min`;
}

/** Faz o parse de um campo de horário em formulário (aceita "8:30", "08:30", "-5:00" etc.) para minutos. */
export function parseTimeInput(value: string): number {
  return timeToMinutes(value);
}

/** Extrai HH:MM de um horário de ponto isolado (ex.: marcação), retorna -1 se inválido. */
export function timeOfDayToMinutes(value: string | null | undefined): number {
  const match = String(value ?? '').match(/^(\d{1,2}):(\d{2})$/);
  return match ? parseInt(match[1], 10) * 60 + parseInt(match[2], 10) : -1;
}

const LUNCH_BREAK_START_MINUTES = 12 * 60; // 12:00
const LUNCH_BREAK_END_MINUTES = 14 * 60; // 14:00

/**
 * Minutos de sobreposição entre [startMinutes, endMinutes) e o intervalo de
 * almoço fixo 12:00–14:00 — o quanto desse intervalo precisa ser descontado
 * de uma folga que atravessa o horário de almoço.
 */
function lunchOverlapMinutes(startMinutes: number, endMinutes: number): number {
  const overlapStart = Math.max(startMinutes, LUNCH_BREAK_START_MINUTES);
  const overlapEnd = Math.min(endMinutes, LUNCH_BREAK_END_MINUTES);
  return Math.max(0, overlapEnd - overlapStart);
}

/**
 * Horas compensadas de uma folga registrada por hora inicial/final: a
 * duração do intervalo menos o horário de almoço fixo (12:00–14:00) quando
 * a folga o atravessa — dentro da jornada, esse intervalo não é trabalhado
 * nem precisa ser compensado. Ex.: folga das 08:00 às 18:00 (10h corridas)
 * compensa 08:00 (10h − 2h de almoço), não 10h. Retorna 0 para horários
 * inválidos ou hora final não posterior à inicial.
 */
export function computeCompensatedMinutes(startTime: string, endTime: string): number {
  const start = timeOfDayToMinutes(startTime);
  const end = timeOfDayToMinutes(endTime);
  if (start < 0 || end < 0 || end <= start) return 0;
  return Math.max(0, end - start - lunchOverlapMinutes(start, end));
}
