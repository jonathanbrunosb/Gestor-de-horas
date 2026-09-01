import Papa from 'papaparse';
import type { ImportedRecord, ImportValidationMessage } from '../types/imports';
import { resolveCompany, extractCompanyCode } from './companies';
import { normalizeTime } from './time';
import { monthKey } from './dates';

const HEADER_MAP: Record<string, string> = {
  nome: 'nome',
  empregado: 'nome',
  colaborador: 'nome',
  matricula: 'matricula',
  'id empregado': 'matricula',
  chapa: 'matricula',
  cargo: 'cargo',
  funcao: 'cargo',
  email: 'email',
  'e mail': 'email',
  empresa: 'empresa',
  empregador: 'empresa',
  'codigo empresa': 'empresaCodigo',
  'cod empresa': 'empresaCodigo',
  codemp: 'empresaCodigo',
  'empresa codigo': 'empresaCodigo',
  empre: 'empresaCodigo',
  cod: 'empresaCodigo',
  codigo: 'empresaCodigo',
  periodo: 'periodo',
  competencia: 'periodo',
  data: 'data',
  dt: 'data',
  sem: 'diaSemana',
  'dia semana': 'diaSemana',
  hor: 'codigoHorario',
  'codigo horario': 'codigoHorario',
  horario: 'codigoHorario',
  marcacoes: 'marcacoes',
  marcacao: 'marcacoes',
  ocorrencia: 'ocorrencia',
  evento: 'ocorrencia',
  situacao: 'ocorrencia',
  trab: 'horasTrabalhadas',
  'horas trabalhadas': 'horasTrabalhadas',
  'crd bh': 'creditoBH',
  'credito bh': 'creditoBH',
  'credito banco horas': 'creditoBH',
  'credito banco de horas': 'creditoBH',
  'deb bh': 'debitoBH',
  'debito bh': 'debitoBH',
  'debito banco horas': 'debitoBH',
  'debito banco de horas': 'debitoBH',
  'sld bh': 'saldoBH',
  'saldo bh': 'saldoBH',
  'saldo banco horas': 'saldoBH',
  'saldo banco de horas': 'saldoBH',
  adnot: 'adicionalNoturno',
  'ad not': 'adicionalNoturno',
  'adicional noturno': 'adicionalNoturno',
  'ext 50': 'extra50',
  'extra 50': 'extra50',
  'extras 50': 'extra50',
  'ext 100': 'extra100',
  'extra 100': 'extra100',
  'extras 100': 'extra100'
};

function normalizeHeader(header: string): string {
  const h = String(header || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return HEADER_MAP[h] || h.replace(/\s+/g, '_');
}

function normalizeDate(value: string): string {
  const raw = String(value || '').trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = raw.match(/^(\d{2})[\/.](\d{2})[\/.](\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return raw;
}

/** Faz o parse de um CSV/TXT de cartão-ponto usando PapaParse, aceitando `;`, `,`, tab ou `|`. */
export function parseDelimitedFile(text: string): { records: ImportedRecord[]; messages: ImportValidationMessage[] } {
  const messages: ImportValidationMessage[] = [];
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = [';', ',', '\t', '|'].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    delimiter,
    skipEmptyLines: true,
    transformHeader: normalizeHeader
  });

  if (parsed.errors?.length) {
    parsed.errors.forEach((err) => messages.push({ level: 'warning', message: `Aviso de leitura CSV: ${err.message}`, line: err.row }));
  }

  const records: ImportedRecord[] = [];
  parsed.data.forEach((row, index) => {
    const lineNumber = index + 2; // +1 header, +1 base 1
    const empresa = resolveCompany(row.empresa, row.empresaCodigo, row.codigo, row.cod_empresa, row.empre, row.empregador);

    if (!row.nome && !row.matricula) {
      messages.push({ level: 'error', message: `Linha ${lineNumber}: colaborador não identificado.`, line: lineNumber });
      return;
    }
    if (!empresa) {
      messages.push({ level: 'error', message: `Linha ${lineNumber}: empresa não mapeada. Informe Empresa ou Código Empresa válido.`, line: lineNumber });
      return;
    }
    if (!row.data) {
      messages.push({ level: 'error', message: `Linha ${lineNumber}: data ausente.`, line: lineNumber });
      return;
    }

    for (const field of ['horasTrabalhadas', 'creditoBH', 'debitoBH', 'saldoBH', 'extra50', 'extra100']) {
      const raw = row[field];
      if (raw && !/^-?\d{1,5}:\d{2}$/.test(String(raw).trim().replace(',', ':'))) {
        messages.push({ level: 'warning', message: `Linha ${lineNumber}: campo ${field} com formato inválido (${raw}).`, line: lineNumber });
      }
    }

    records.push({
      collaboratorName: row.nome || 'Colaborador importado',
      collaboratorRegistration: row.matricula || '',
      collaboratorEmail: row.email || undefined,
      companyName: empresa,
      companyCode: row.empresaCodigo || extractCompanyCode(row.empresa || row.empregador || ''),
      period: row.periodo || monthKey(),
      date: normalizeDate(row.data),
      weekday: row.diaSemana || undefined,
      scheduleCode: row.codigoHorario || undefined,
      punches: String(row.marcacoes || '').split(/\s+/).filter(Boolean),
      occurrence: row.ocorrencia || undefined,
      workedTime: normalizeTime(row.horasTrabalhadas),
      creditBhTime: normalizeTime(row.creditoBH),
      debitBhTime: normalizeTime(row.debitoBH),
      balanceBhTime: normalizeTime(row.saldoBH),
      nightTime: normalizeTime(row.adicionalNoturno),
      extra50Time: normalizeTime(row.extra50),
      extra100Time: normalizeTime(row.extra100),
      dayType: 'Normal',
      sourceLine: `Linha ${lineNumber}`
    });
  });

  if (!parsed.data.length) {
    messages.push({ level: 'error', message: 'Arquivo vazio ou sem linhas reconhecíveis.' });
  }

  return { records, messages };
}
