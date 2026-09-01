import * as pdfjsLib from 'pdfjs-dist';
// Worker instalado via npm (pdfjs-dist), nunca via CDN — empacotado pelo Vite.
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import type { ImportedRecord, ImportValidationMessage } from '../types/imports';
import { resolveCompany } from './companies';
import { normalizeTime } from './time';
import { monthKey, toISODate } from './dates';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

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

interface PdfLineContext {
  period: string;
  name: string;
  registration: string;
  role: string;
  company: string;
  companyCode: string;
  employer: string;
}

function parsePdfDailyLine(line: string, context: PdfLineContext, today: Date): ImportedRecord | null {
  const normalized = line.replace(/\s+/g, ' ').trim();
  const baseMatch = normalized.match(/^(\d{2})\s+([A-Z]{3})\s+(\d{4})\s+(.*)$/i);
  if (!baseMatch) return null;
  const [, day, weekday, scheduleCode, rest] = baseMatch;

  const occurrences = [
    'Débito Banco de Horas',
    'Debito Banco de Horas',
    'Crédito Banco de Horas',
    'Credito Banco de Horas',
    'Compensado',
    'Feriado',
    'Trabalhando',
    'Férias',
    'Ferias',
    'Dsr',
    'DSR'
  ];
  const occurrence = occurrences.find((item) => rest.toLowerCase().includes(item.toLowerCase())) || 'Normal';
  const splitIndex = rest.toLowerCase().indexOf(occurrence.toLowerCase());
  const before = splitIndex >= 0 ? rest.slice(0, splitIndex).trim() : rest;
  const after = splitIndex >= 0 ? rest.slice(splitIndex + occurrence.length).trim() : '';

  const punches = (before.match(/\d{2}:\d{2}/g) || []).map(normalizePdfTime).filter(Boolean);
  const metrics = (after.match(/\d{1,5}:\d{2}-|-?\d{1,5}:\d{2}/g) || []).map(normalizePdfTime);

  let workedTime = metrics[0] || '00:00';
  let creditBhTime = '00:00';
  let debitBhTime = '00:00';
  let balanceBhTime = '00:00';
  let nightTime = '00:00';
  let extra50Time = '00:00';
  let extra100Time = '00:00';

  if (metrics.length >= 4) {
    const isCredit = /credito/i.test(occurrence);
    const isDebit = /debito|d[ée]bito/i.test(occurrence);
    if (isCredit && metrics[1] === metrics[2]) {
      creditBhTime = metrics[1] || '00:00';
      balanceBhTime = metrics[2] || '00:00';
      nightTime = metrics[3] || '00:00';
      extra50Time = metrics[4] || '00:00';
      extra100Time = metrics[5] || '00:00';
    } else if (isDebit && (metrics[2] || '').startsWith('-')) {
      debitBhTime = metrics[1] || '00:00';
      balanceBhTime = metrics[2] || '00:00';
      nightTime = metrics[3] || '00:00';
      extra50Time = metrics[4] || '00:00';
      extra100Time = metrics[5] || '00:00';
    } else {
      creditBhTime = metrics[1] || '00:00';
      debitBhTime = metrics[2] || '00:00';
      balanceBhTime = metrics[3] || '00:00';
      nightTime = metrics[4] || '00:00';
      extra50Time = metrics[5] || '00:00';
      extra100Time = metrics[6] || '00:00';
    }
  } else if (metrics.length === 3) {
    if (/credito/i.test(occurrence)) creditBhTime = metrics[1] || '00:00';
    else if (/debito|d[ée]bito/i.test(occurrence)) debitBhTime = metrics[1] || '00:00';
    balanceBhTime = metrics[2] || '00:00';
  } else if (metrics.length === 2) {
    if (/credito/i.test(occurrence)) {
      creditBhTime = metrics[1] || '00:00';
      balanceBhTime = metrics[1] || '00:00';
    } else if (/debito|d[ée]bito/i.test(occurrence)) {
      debitBhTime = metrics[1] || '00:00';
      balanceBhTime = `-${metrics[1].replace('-', '')}`;
    }
  }

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
    workedTime: normalizeTime(workedTime),
    creditBhTime: normalizeTime(creditBhTime),
    debitBhTime: normalizeTime(debitBhTime),
    balanceBhTime: normalizeTime(balanceBhTime),
    nightTime: normalizeTime(nightTime),
    extra50Time: normalizeTime(extra50Time),
    extra100Time: normalizeTime(extra100Time),
    dayType: /feriado|compensado|dsr/i.test(occurrence) ? 'Não útil' : /f[ée]rias/i.test(occurrence) ? 'Férias' : 'Normal'
  };
}

function groupPdfItemsIntoLines(items: Array<{ str: string; transform: number[] }>): string[] {
  const rows = new Map<number, Array<{ x: number; text: string }>>();
  for (const item of items) {
    const y = Math.round(item.transform?.[5] || 0);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y)!.push({ x: item.transform?.[4] || 0, text: item.str || '' });
  }
  return Array.from(rows.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([, entries]) =>
      entries
        .sort((a, b) => a.x - b.x)
        .map((entry) => entry.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean);
}

function parsePdfLines(lines: string[], filename: string, today: Date): { records: ImportedRecord[]; messages: ImportValidationMessage[] } {
  const cleaned = lines.map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const fullText = cleaned.join('\n');
  const messages: ImportValidationMessage[] = [];

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
  const employeeLine = cleaned.find((line) => /Empregado:/i.test(line));
  if (employeeLine) {
    const withoutLabel = employeeLine.replace(/.*Empregado:?/i, '').trim();
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
  cleaned.forEach((line, idx) => {
    const dailyMatch = line.match(/^(\d{2})\s+([A-Z]{3})\b/i);
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
    const record = parsePdfDailyLine(line, {
      period,
      name,
      registration: matriculaMatch ? matriculaMatch[1] : '',
      role: '',
      company,
      companyCode,
      employer: companyText
    }, today);
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

  return { records, messages: [...messages, { level: 'info', message: `Resumo mensal detectado: saldo anterior ${summary.previousMonthBalance}, crédito ${summary.monthCredit}, débito ${summary.monthDebit}, saldo do ciclo ${summary.cycleBalance}.` }] };
}

export interface PdfParseResult {
  hasSelectableText: boolean;
  records: ImportedRecord[];
  messages: ImportValidationMessage[];
}

/**
 * Extrai texto de um PDF de cartão-ponto usando pdfjs-dist (instalado via npm).
 * Se o PDF não tiver texto selecionável, retorna hasSelectableText=false para
 * que a UI acione o assistente de lançamento manual — nunca trava a aplicação.
 */
export async function parseTimeCardPdf(file: File, today: Date = new Date()): Promise<PdfParseResult> {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

  const lines: string[] = [];
  let totalChars = 0;
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items as Array<{ str: string; transform: number[] }>;
    totalChars += items.reduce((sum, item) => sum + (item.str?.length || 0), 0);
    lines.push(...groupPdfItemsIntoLines(items));
  }

  if (totalChars < 20) {
    return { hasSelectableText: false, records: [], messages: [{ level: 'warning', message: 'PDF sem texto selecionável (provavelmente digitalizado/imagem). Use o lançamento manual.' }] };
  }

  try {
    const { records, messages } = parsePdfLines(lines, file.name, today);
    return { hasSelectableText: true, records, messages };
  } catch (error) {
    return {
      hasSelectableText: false,
      records: [],
      messages: [{ level: 'error', message: error instanceof Error ? error.message : 'Falha ao interpretar o PDF.' }]
    };
  }
}
