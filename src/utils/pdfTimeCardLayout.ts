import type { ImportedRecord, ImportValidationMessage } from '../types/imports';
import { resolveCompany } from './companies';
import { normalizeTime } from './time';
import { monthKey, toISODate } from './dates';

/**
 * Interpretação do cartão-ponto em PDF a partir do texto já extraído.
 *
 * Este módulo não depende de pdfjs — recebe apenas os itens de texto com suas
 * posições. Isso mantém a leitura do layout testável isoladamente e deixa
 * pdfParser.ts responsável somente pela entrada/saída do arquivo.
 */

export interface PdfTextItem {
  str: string;
  transform: number[];
}

/** Um item de texto do PDF com a posição horizontal onde foi impresso. */
export interface PdfRowEntry {
  x: number;
  text: string;
}

/** Uma linha do PDF: o texto completo e os itens individuais que a compõem. */
export interface PdfRow {
  text: string;
  entries: PdfRowEntry[];
}

/**
 * Posição horizontal de cada coluna do cartão-ponto, lida do cabeçalho
 * ("DT Sem Hor Marcações Trab. Crd BH Deb BH Sld BH AdNot Ext 50% Ext 100%").
 * É o que permite saber a qual coluna pertence cada valor, em vez de deduzir
 * pela ordem — colunas vazias simplesmente não são impressas no PDF, então a
 * contagem de valores varia de linha para linha.
 */
export interface ColumnLayout {
  marcacoes: number;
  trab: number;
  crd: number;
  deb: number;
  sld: number;
  adnot: number;
  ext50: number;
  ext100: number;
}

type MetricKey = 'trab' | 'crd' | 'deb' | 'sld' | 'adnot' | 'ext50' | 'ext100';

const METRIC_KEYS: MetricKey[] = ['trab', 'crd', 'deb', 'sld', 'adnot', 'ext50', 'ext100'];

/** Tolerância à esquerda da coluna "Trab." que separa marcações/ocorrência dos valores numéricos. */
const METRICS_LEFT_MARGIN = 20;
/** Tolerância à esquerda da coluna "Marcações" que exclui as colunas DT/Sem/Hor. */
const MARCACOES_LEFT_MARGIN = 8;

const METRIC_TOKEN_REGEX = /-?\d{1,5}:\d{2}-?/g;
const PUNCH_TOKEN_REGEX = /\b\d{2}:\d{2}\b/g;
const LETTER_REGEX = /[A-Za-zÀ-ÿ]/;

function isTimeToken(token: string): boolean {
  return /^-?\d{1,5}:\d{2}-?$/.test(token.trim());
}

function toTitleCase(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/\w/g, (char) => char.toUpperCase())
    .trim();
}

function normalizeYear(value: string | number, today: Date): number {
  const year = Number(value);
  if (!year) return today.getFullYear();
  return year < 100 ? 2000 + year : year;
}

/** Converte "02:16-" (negativo no padrão do relatório) em "-02:16". */
function normalizePdfTime(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '00:00';
  if (/^\d{1,5}:\d{2}-$/.test(raw)) return `-${raw.replace('-', '')}`;
  if (/^-?\d{1,5}:\d{2}$/.test(raw)) return raw;
  return '00:00';
}

function extractSummaryTime(text: string, regex: RegExp): string {
  const match = text.match(regex);
  return match ? normalizePdfTime(match[1]) : '00:00';
}

/** Agrupa os itens de texto do pdfjs em linhas, preservando a posição de cada item. */
export function groupPdfItemsIntoRows(items: PdfTextItem[]): PdfRow[] {
  const rows = new Map<number, PdfRowEntry[]>();
  for (const item of items) {
    const y = Math.round(item.transform?.[5] || 0);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y)!.push({ x: item.transform?.[4] || 0, text: item.str || '' });
  }
  return Array.from(rows.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([, entries]) => {
      const sorted = entries.sort((a, b) => a.x - b.x);
      const text = sorted
        .map((entry) => entry.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      return { text, entries: sorted };
    })
    .filter((row) => Boolean(row.text));
}

/**
 * Lê as posições das colunas no cabeçalho da tabela. Retorna null quando o
 * cabeçalho não é encontrado (layout diferente do esperado) — nesse caso a
 * leitura cai para a heurística por ordem dos valores.
 */
export function detectColumnLayout(rows: PdfRow[]): ColumnLayout | null {
  const header = rows.find((row) => /Marca[çc][õo]es/i.test(row.text) && /Trab/i.test(row.text) && /Sld/i.test(row.text));
  if (!header) return null;

  const found: Partial<ColumnLayout> = {};
  for (const entry of header.entries) {
    const text = entry.text.trim();
    if (!text) continue;
    if (found.marcacoes === undefined && /^Marca[çc][õo]es/i.test(text)) found.marcacoes = entry.x;
    else if (found.trab === undefined && /^Trab/i.test(text)) found.trab = entry.x;
    else if (found.crd === undefined && /^Crd/i.test(text)) found.crd = entry.x;
    else if (found.deb === undefined && /^D[eé]b/i.test(text)) found.deb = entry.x;
    else if (found.sld === undefined && /^Sld/i.test(text)) found.sld = entry.x;
    else if (found.adnot === undefined && /^Ad\.?\s*Not/i.test(text)) found.adnot = entry.x;
    else if (found.ext50 === undefined && /^Ext\.?\s*50/i.test(text)) found.ext50 = entry.x;
    else if (found.ext100 === undefined && /^Ext\.?\s*100/i.test(text)) found.ext100 = entry.x;
  }

  if (
    found.marcacoes === undefined ||
    found.trab === undefined ||
    found.crd === undefined ||
    found.deb === undefined ||
    found.sld === undefined
  ) {
    return null;
  }

  // AdNot/Ext 50%/Ext 100% podem faltar em relatórios sem essas colunas — nesse
  // caso são projetadas à direita de Sld, mantendo a ordem do relatório.
  const step = Math.max(10, found.sld - found.deb);
  return {
    marcacoes: found.marcacoes,
    trab: found.trab,
    crd: found.crd,
    deb: found.deb,
    sld: found.sld,
    adnot: found.adnot ?? found.sld + step,
    ext50: found.ext50 ?? found.sld + step * 2,
    ext100: found.ext100 ?? found.sld + step * 3
  };
}

function nearestMetricIndex(x: number, layout: ColumnLayout): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  METRIC_KEYS.forEach((key, index) => {
    const distance = Math.abs(x - layout[key]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

type MetricValues = Record<MetricKey, string>;

function emptyMetrics(): MetricValues {
  return { trab: '00:00', crd: '00:00', deb: '00:00', sld: '00:00', adnot: '00:00', ext50: '00:00', ext100: '00:00' };
}

/**
 * Distribui os valores numéricos nas colunas pela posição em que foram
 * impressos — é o que impede um valor de "escorregar" para a coluna vizinha
 * quando alguma coluna vem vazia na linha.
 */
function assignMetricsByColumn(entries: PdfRowEntry[], layout: ColumnLayout): MetricValues {
  const values = emptyMetrics();
  for (const entry of entries) {
    if (entry.x < layout.trab - METRICS_LEFT_MARGIN) continue;
    if (LETTER_REGEX.test(entry.text)) continue;
    const tokens = entry.text.match(METRIC_TOKEN_REGEX) || [];
    if (!tokens.length) continue;
    let index = nearestMetricIndex(entry.x, layout);
    for (const token of tokens) {
      if (index >= METRIC_KEYS.length) break;
      values[METRIC_KEYS[index]] = normalizePdfTime(token);
      index += 1;
    }
  }
  return values;
}

interface DailyParts {
  punches: string[];
  occurrence: string;
  metrics: MetricValues;
}

/** Leitura por coluna, usada quando o cabeçalho da tabela foi localizado. */
function readDailyPartsByColumn(entries: PdfRowEntry[], layout: ColumnLayout): DailyParts {
  const leftText = entries
    .filter((entry) => entry.x >= layout.marcacoes - MARCACOES_LEFT_MARGIN && entry.x < layout.trab - METRICS_LEFT_MARGIN)
    .map((entry) => entry.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const punches = (leftText.match(PUNCH_TOKEN_REGEX) || []).map(normalizePdfTime).filter(Boolean);
  const occurrence =
    leftText
      .replace(METRIC_TOKEN_REGEX, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Normal';

  return { punches, occurrence, metrics: assignMetricsByColumn(entries, layout) };
}

/**
 * Leitura por ordem dos valores, usada quando o cabeçalho não foi localizado.
 * A ocorrência é detectada estruturalmente — qualquer texto entre as marcações
 * e os valores numéricos — em vez de depender de uma lista fixa de rótulos,
 * que deixava passar ocorrências como "Interjornada" e "Intrajornada".
 */
function readDailyPartsByOrder(rest: string): DailyParts {
  const tokens = rest.split(/\s+/).filter(Boolean);
  const punchTokens: string[] = [];
  const occurrenceParts: string[] = [];
  const metricTokens: string[] = [];
  let stage: 'punches' | 'occurrence' | 'metrics' = 'punches';

  for (const token of tokens) {
    const isTime = isTimeToken(token);
    if (stage === 'punches') {
      if (isTime) punchTokens.push(token);
      else {
        stage = 'occurrence';
        occurrenceParts.push(token);
      }
      continue;
    }
    if (stage === 'occurrence') {
      if (isTime) {
        stage = 'metrics';
        metricTokens.push(token);
      } else {
        occurrenceParts.push(token);
      }
      continue;
    }
    if (isTime) metricTokens.push(token);
  }

  const metricValues = metricTokens.map(normalizePdfTime);
  const metrics = emptyMetrics();
  metrics.trab = metricValues[0] || '00:00';

  if (metricValues.length >= 4) {
    if ((metricValues[2] || '').startsWith('-')) {
      metrics.deb = metricValues[1] || '00:00';
      metrics.sld = metricValues[2] || '00:00';
      metrics.adnot = metricValues[3] || '00:00';
      metrics.ext50 = metricValues[4] || '00:00';
      metrics.ext100 = metricValues[5] || '00:00';
    } else if (metricValues[1] === metricValues[2]) {
      metrics.crd = metricValues[1] || '00:00';
      metrics.sld = metricValues[2] || '00:00';
      metrics.adnot = metricValues[3] || '00:00';
      metrics.ext50 = metricValues[4] || '00:00';
      metrics.ext100 = metricValues[5] || '00:00';
    } else {
      metrics.crd = metricValues[1] || '00:00';
      metrics.deb = metricValues[2] || '00:00';
      metrics.sld = metricValues[3] || '00:00';
      metrics.adnot = metricValues[4] || '00:00';
      metrics.ext50 = metricValues[5] || '00:00';
      metrics.ext100 = metricValues[6] || '00:00';
    }
  } else if (metricValues.length === 3) {
    // O sinal do saldo diz se o valor do meio é crédito ou débito, sem depender
    // do rótulo da ocorrência.
    const balance = metricValues[2] || '00:00';
    if (balance.startsWith('-')) metrics.deb = metricValues[1] || '00:00';
    else metrics.crd = metricValues[1] || '00:00';
    metrics.sld = balance;
  } else if (metricValues.length === 2) {
    const balance = metricValues[1] || '00:00';
    if (balance.startsWith('-')) metrics.deb = balance.replace('-', '');
    else metrics.crd = balance;
    metrics.sld = balance;
  }

  return {
    punches: punchTokens.map(normalizePdfTime).filter(Boolean),
    occurrence: occurrenceParts.join(' ').trim() || 'Normal',
    metrics
  };
}

interface PdfLineContext {
  period: string;
  name: string;
  registration: string;
  company: string;
  companyCode: string;
  employer: string;
}

function parsePdfDailyRow(row: PdfRow, layout: ColumnLayout | null, context: PdfLineContext, today: Date): ImportedRecord | null {
  const normalized = row.text.replace(/\s+/g, ' ').trim();
  const baseMatch = normalized.match(/^(\d{2})\s+([A-Z]{3})\s+(\d{4})\s*(.*)$/i);
  if (!baseMatch) return null;
  const [, day, weekday, scheduleCode, rest] = baseMatch;

  const { punches, occurrence, metrics } = layout ? readDailyPartsByColumn(row.entries, layout) : readDailyPartsByOrder(rest);

  const [year, month] = (context.period || monthKey(today)).split('-').map(Number);
  const baseDate = new Date(year, Math.max(0, (month || 1) - 1), Number(day));

  return {
    collaboratorName: context.name || 'Colaborador importado',
    collaboratorRegistration: context.registration || '',
    companyName: context.company || resolveCompany(context.companyCode, context.employer) || undefined,
    companyCode: context.companyCode || undefined,
    period: context.period || monthKey(today),
    date: toISODate(baseDate),
    weekday: weekday.toUpperCase(),
    scheduleCode,
    punches,
    occurrence,
    workedTime: normalizeTime(metrics.trab),
    creditBhTime: normalizeTime(metrics.crd),
    debitBhTime: normalizeTime(metrics.deb),
    balanceBhTime: normalizeTime(metrics.sld),
    nightTime: normalizeTime(metrics.adnot),
    extra50Time: normalizeTime(metrics.ext50),
    extra100Time: normalizeTime(metrics.ext100),
    dayType: /feriado|compensado|dsr/i.test(occurrence) ? 'Não útil' : /f[ée]rias/i.test(occurrence) ? 'Férias' : 'Normal'
  };
}

export function parsePdfRows(
  rows: PdfRow[],
  filename: string,
  today: Date
): { records: ImportedRecord[]; messages: ImportValidationMessage[] } {
  const cleaned = rows
    .map((row) => ({ ...row, text: row.text.replace(/\s+/g, ' ').trim() }))
    .filter((row) => Boolean(row.text));
  const fullText = cleaned.map((row) => row.text).join('\n');
  const messages: ImportValidationMessage[] = [];

  const layout = detectColumnLayout(cleaned);
  if (!layout) {
    messages.push({
      level: 'warning',
      message: 'Cabeçalho de colunas não localizado no PDF. Os valores foram distribuídos pela ordem em que aparecem — confira Trab./Crd/Deb/Sld antes de confirmar.'
    });
  }

  const filePeriod = filename.match(/(\d{2})[.\/-](\d{2})[.\/-](\d{2,4})\s*a\s*(\d{2})[.\/-](\d{2})[.\/-](\d{2,4})/i);
  const textPeriod = fullText.match(/(\d{2}\/\d{2}\/\d{4})\s*a\s*(\d{2}\/\d{2}\/\d{4})/i);
  const startParts = textPeriod
    ? textPeriod[1].split('/').map(Number)
    : filePeriod
      ? [Number(filePeriod[1]), Number(filePeriod[2]), normalizeYear(filePeriod[3], today)]
      : [1, today.getMonth() + 1, today.getFullYear()];
  let currentMonth = startParts[1];
  let currentYear = startParts[2];
  let lastDay = 0;

  const matriculaMatch = fullText.match(/Empregado:?\s*(\d{4,})/i) || fullText.match(/Matr[ií]cula:?\s*(\d{4,})/i);
  const employerMatch = fullText.match(/Empregador:?\s*(\d{1,4})\s+([^\n]+)/i);
  const companyMatch = employerMatch || fullText.match(/Empresa:?\s*(\d{1,4})?\s*([^\n]+)/i);

  let name = '';
  const employeeLine = cleaned.find((row) => /Empregado:/i.test(row.text));
  if (employeeLine) {
    const withoutLabel = employeeLine.text.replace(/.*Empregado:?/i, '').trim();
    name = withoutLabel.replace(/^\d+\s*/, '').trim();
  }
  if (!name && filename) {
    name = filename
      .replace(/\.pdf$/i, '')
      .replace(/\d{2}[.\/-]\d{2}[.\/-]\d{2,4}\s*a\s*\d{2}[.\/-]\d{2}[.\/-]\d{2,4}.*/i, '')
      .replace(/[-_]+/g, ' ')
      .trim();
  }
  if (!name) {
    const fallbackName = fullText.match(/([A-ZÀ-Ú]{2,}(?:\s+[A-ZÀ-Ú]{2,}){2,})/);
    name = fallbackName ? toTitleCase(fallbackName[1]) : 'Colaborador importado';
  } else {
    name = toTitleCase(name);
  }

  const companyCode = employerMatch ? employerMatch[1].padStart(4, '0') : companyMatch?.[1] ? String(companyMatch[1]).padStart(4, '0') : '';
  const companyText = employerMatch ? employerMatch[2] : companyMatch ? companyMatch[2] || companyMatch[1] || '' : '';
  const company = resolveCompany(companyCode, companyText, companyMatch ? companyMatch[0] : '', filename);

  const summary = {
    previousMonthBalance: extractSummaryTime(fullText, /Saldo\s*M[eê]s\s*Anterior:?\s*([\d:-]{4,})/i),
    monthCredit: extractSummaryTime(fullText, /Credito\s*M[eê]s:?\s*([\d:-]{4,})/i),
    monthDebit: extractSummaryTime(fullText, /Debito\s*M[eê]s:?\s*([\d:-]{4,})/i),
    monthBalance: extractSummaryTime(fullText, /Saldo\s*M[eê]s:?\s*([\d:-]{4,})/i),
    cycleBalance: extractSummaryTime(fullText, /Saldo\s*do\s*Ciclo:?\s*([\d:-]{4,})/i)
  };

  const records: ImportedRecord[] = [];
  cleaned.forEach((row, idx) => {
    const dailyMatch = row.text.match(/^(\d{2})\s+([A-Z]{3})\b/i);
    if (!dailyMatch) return;
    const dayNumber = Number(dailyMatch[1]);
    if (lastDay && dayNumber < lastDay) {
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }
    lastDay = dayNumber;
    const period = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const record = parsePdfDailyRow(
      row,
      layout,
      {
        period,
        name,
        registration: matriculaMatch ? matriculaMatch[1] : '',
        company,
        companyCode,
        employer: companyText
      },
      today
    );
    if (!record) {
      messages.push({ level: 'warning', message: `Linha PDF ${idx + 1}: não foi possível interpretar o registro.` });
      return;
    }
    records.push(record);
  });

  if (!records.length) {
    throw new Error('Nenhum registro diário foi identificado no PDF. O texto foi extraído, mas o layout não corresponde ao cartão-ponto esperado.');
  }
  if (!company) {
    messages.push({ level: 'error', message: 'Empresa não identificada automaticamente no PDF. Ajuste o cadastro do colaborador após importar.' });
  }

  return {
    records,
    messages: [
      ...messages,
      {
        level: 'info',
        message: `Resumo mensal detectado: saldo anterior ${summary.previousMonthBalance}, crédito ${summary.monthCredit}, débito ${summary.monthDebit}, saldo do ciclo ${summary.cycleBalance}.`
      }
    ]
  };
}
