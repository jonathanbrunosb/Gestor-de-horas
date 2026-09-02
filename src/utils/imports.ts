import type { DayType } from '../types/database';
import type {
  LegacyJsonAccessProfile,
  LegacyJsonCollaborator,
  LegacyJsonCycle,
  LegacyJsonManager,
  LegacyJsonExport
} from '../types/imports';
import { resolveCompany, extractCompanyCode } from './companies';
import { normalizeMatricula } from '../lib/permissions';
import { NON_WORK_SCHEDULE_CODES } from '../lib/constants';
import { timeToMinutes } from './time';

export interface PunchMetrics {
  workedMinutes: number;
  creditBhMinutes: number;
  debitBhMinutes: number;
  balanceBhMinutes: number;
  nightMinutes: number;
  extra50Minutes: number;
  extra100Minutes: number;
}

const EMPTY_METRICS: PunchMetrics = {
  workedMinutes: 0,
  creditBhMinutes: 0,
  debitBhMinutes: 0,
  balanceBhMinutes: 0,
  nightMinutes: 0,
  extra50Minutes: 0,
  extra100Minutes: 0
};

function toMin(value: string | undefined): number {
  if (!value) return -1;
  const match = String(value).match(/^(\d{1,2}):(\d{2})$/);
  return match ? parseInt(match[1], 10) * 60 + parseInt(match[2], 10) : -1;
}

function calcNight(start: number, end: number): number {
  if (start < 0 || end < 0) return 0;
  if (end < start) end += 1440;
  const nightStart = 1320; // 22:00
  const nightEnd = 1740; // 05:00 do dia seguinte
  let overlap = Math.max(0, Math.min(end, nightEnd) - Math.max(start, nightStart));
  if (start < 300) overlap += Math.max(0, Math.min(end, 300) - start);
  return overlap;
}

/**
 * Calcula trabalhado/crédito/débito/saldo/adicional noturno/extras a partir
 * das 4 marcações do dia — porta fiel de calcPunchMetrics() do sistema legado.
 * codigoHorario '0001' = jornada padrão de 8h; demais tratados como sem padrão fixo.
 */
export function calcPunchMetrics(punches: string[], scheduleCode: string, weekday: string): PunchMetrics {
  if (['9997', '9998', '9999'].includes(scheduleCode)) return { ...EMPTY_METRICS };

  const [m1, m2, m3, m4] = punches;
  const p1 = toMin(m1);
  const p2 = toMin(m2);
  const p3 = toMin(m3);
  const p4 = toMin(m4);

  const s1 = p1 >= 0 && p2 > p1 ? p2 - p1 : 0;
  let s2 = 0;
  if (p3 >= 0 && p4 >= 0) s2 = p4 >= p3 ? p4 - p3 : 1440 - p3 + p4;
  const worked = s1 + s2;
  if (worked <= 0) return { ...EMPTY_METRICS };

  const standard = scheduleCode === '0001' ? 480 : worked;
  const isWeekend = ['SAB', 'DOM'].includes((weekday || '').toUpperCase().slice(0, 3));

  const result: PunchMetrics = { ...EMPTY_METRICS, workedMinutes: Math.min(worked, standard) };

  if (isWeekend) {
    return { ...result, extra100Minutes: worked };
  }

  const diff = worked - standard;
  if (diff > 0) {
    result.creditBhMinutes = diff;
    result.balanceBhMinutes = diff;
  } else if (diff < 0) {
    result.debitBhMinutes = -diff;
    result.balanceBhMinutes = diff;
  }

  const nightMinutes = calcNight(p1, p2) + calcNight(p3, p4 < p3 ? p4 + 1440 : p4);
  if (nightMinutes > 0) result.nightMinutes = nightMinutes;

  return result;
}

/**
 * Jornada prevista do dia, inferida do próprio registro. Nos dias normais o
 * cartão-ponto traz "Trab." limitado à jornada e o que faltou como débito, de
 * modo que trabalhado + débito reconstrói a jornada (ex.: 05:14 + 02:16 =
 * 07:30; 07:30 + 00:00 = 07:30). Dias não úteis e férias não têm jornada a
 * cumprir. Serve de referência para recalcular crédito/débito ao editar as
 * marcações, sem depender de uma jornada fixa por código de horário.
 */
export function inferStandardMinutes(record: {
  worked_minutes: number;
  debit_bh_minutes: number;
  day_type: DayType;
  schedule_code: string | null;
}): number {
  if (record.schedule_code && NON_WORK_SCHEDULE_CODES.includes(record.schedule_code)) return 0;
  if (record.day_type !== 'Normal') return 0;
  return Math.max(0, record.worked_minutes + record.debit_bh_minutes);
}

/**
 * Recalcula as métricas do dia a partir das marcações e da jornada prevista.
 * Diferente de calcPunchMetrics (limitada a 4 marcações e a uma jornada fixa
 * só para o horário '0001'), aceita quantas marcações o dia tiver — os pares
 * entrada/saída são somados dois a dois — e recebe a jornada como parâmetro,
 * o que permite editar dias de qualquer código de horário.
 */
export function calcMetricsFromPunches(punches: string[], standardMinutes: number, weekday: string): PunchMetrics {
  const marks = punches.map(toMin).filter((value) => value >= 0);

  let worked = 0;
  let night = 0;
  for (let i = 0; i + 1 < marks.length; i += 2) {
    const start = marks[i];
    // Saída anterior à entrada significa virada de dia (ex.: 22:00 às 02:00).
    const end = marks[i + 1] >= start ? marks[i + 1] : marks[i + 1] + 1440;
    worked += end - start;
    night += calcNight(start, end);
  }

  if (worked <= 0) return { ...EMPTY_METRICS };

  const isWeekend = ['SAB', 'DOM'].includes((weekday || '').toUpperCase().slice(0, 3));
  if (isWeekend) {
    return { ...EMPTY_METRICS, workedMinutes: worked, extra100Minutes: worked, nightMinutes: night };
  }

  const standard = Math.max(0, Math.round(standardMinutes));
  if (standard === 0) {
    // Sem jornada a cumprir (feriado/compensado/férias): tudo trabalhado é crédito.
    return { ...EMPTY_METRICS, workedMinutes: worked, creditBhMinutes: worked, balanceBhMinutes: worked, nightMinutes: night };
  }

  const diff = worked - standard;
  return {
    workedMinutes: Math.min(worked, standard),
    creditBhMinutes: diff > 0 ? diff : 0,
    debitBhMinutes: diff < 0 ? -diff : 0,
    balanceBhMinutes: diff,
    nightMinutes: night,
    extra50Minutes: 0,
    extra100Minutes: 0
  };
}

export function resolveDayType(occurrence: string | undefined): DayType {
  if (!occurrence) return 'Normal';
  if (/feriado|compensado|dsr/i.test(occurrence)) return 'Não útil';
  if (/f[ée]rias/i.test(occurrence)) return 'Férias';
  return 'Normal';
}

/** Colaborador legado normalizado, pronto para casar/criar em collaborators. */
export interface NormalizedLegacyCollaborator {
  name: string;
  registration: string;
  email: string;
  company: string;
  managerId?: string;
  managerEmail?: string;
  managerRegistration?: string;
  isFacilitator: boolean;
  title?: string;
  status: 'Ativo' | 'Inativo';
  previousMonthBalanceMinutes: number;
  monthCreditMinutes: number;
  monthDebitMinutes: number;
  monthBalanceMinutes: number;
  cycleBalanceMinutes: number;
  bankHoursBalanceMinutes: number;
  extra50Minutes: number;
  extra100Minutes: number;
  absenceDelayMinutes: number;
  /** Folgas embutidas no próprio colaborador (fallback quando não há `leaves` no topo do export). */
  embeddedLeaves: Array<{ date: string; reason: string }>;
}

export function normalizeLegacyCollaborator(raw: LegacyJsonCollaborator): NormalizedLegacyCollaborator {
  const name = String(raw.nome ?? raw.name ?? raw.colaborador ?? raw.empregado ?? '').trim();
  const registration = normalizeMatricula(String(raw.matricula ?? raw.registration ?? raw.idEmpregado ?? ''));
  const email = String(raw.email ?? raw.eMail ?? raw.e_mail ?? raw.mail ?? raw.emailColaborador ?? raw.emailCorporativo ?? raw.corporateEmail ?? '').trim();
  const company = resolveCompany(raw.empresa, raw.company, raw.empregador, raw.empresaCodigo, raw.codigo, raw.codEmpresa);
  return {
    name,
    registration,
    email,
    company,
    managerId: raw.gestorId ? String(raw.gestorId) : raw.managerId ? String(raw.managerId) : undefined,
    managerEmail: raw.gestorEmail ? String(raw.gestorEmail) : raw.managerEmail ? String(raw.managerEmail) : undefined,
    managerRegistration: raw.gestorMatricula ? normalizeMatricula(String(raw.gestorMatricula)) : raw.managerRegistration ? normalizeMatricula(String(raw.managerRegistration)) : undefined,
    isFacilitator: Boolean(raw.facilitador ?? raw.isFacilitador ?? raw.perfilFacilitador ?? false),
    title: raw.cargo ? String(raw.cargo) : undefined,
    status: raw.status === 'Inativo' ? 'Inativo' : 'Ativo',
    previousMonthBalanceMinutes: timeToMinutes(raw.saldoMesAnterior),
    monthCreditMinutes: timeToMinutes(raw.creditoMes),
    monthDebitMinutes: timeToMinutes(raw.debitoMes),
    monthBalanceMinutes: timeToMinutes(raw.saldoMes),
    cycleBalanceMinutes: timeToMinutes(raw.saldoCiclo),
    bankHoursBalanceMinutes: timeToMinutes(raw.saldoBancoHoras),
    extra50Minutes: timeToMinutes(raw.horasExtras50),
    extra100Minutes: timeToMinutes(raw.horasExtras100),
    absenceDelayMinutes: timeToMinutes(raw.faltasAtrasos),
    embeddedLeaves: (raw.folgasProgramadas ?? [])
      .filter((leave): leave is { data: string; motivo?: string } => Boolean(leave?.data))
      .map((leave) => ({ date: leave.data, reason: leave.motivo || 'Compensação de banco de horas' }))
  };
}

export interface NormalizedLegacyManager {
  name: string;
  registration: string;
  email: string;
  area: string;
  company: string;
  status: 'Ativo' | 'Inativo';
}

export function normalizeLegacyManager(raw: LegacyJsonManager): NormalizedLegacyManager {
  return {
    name: String(raw.nome ?? raw.name ?? raw.gestor ?? raw.manager ?? '').trim(),
    registration: normalizeMatricula(String(raw.matricula ?? raw.registration ?? raw.codigo ?? '')),
    email: String(raw.email ?? raw.mail ?? raw.e_mail ?? '').trim(),
    area: String(raw.area ?? raw.departamento ?? 'Contabilidade').trim(),
    company: resolveCompany(raw.empresa, raw.company, raw.empresaCodigo, raw.codigoEmpresa),
    status: raw.status === 'Inativo' ? 'Inativo' : 'Ativo'
  };
}

export interface NormalizedLegacyAccessProfile {
  name: string;
  registration: string;
  email: string;
  accessType: 'Desenvolvedor' | 'Administrador' | 'Executivo' | 'Gerente' | 'Facilitador' | 'Sem acesso';
  title?: string;
  area?: string;
  notes?: string;
  status: 'Ativo' | 'Inativo';
}

const ACCESS_TYPE_ALIASES: Record<string, NormalizedLegacyAccessProfile['accessType']> = {
  desenvolvedor: 'Desenvolvedor',
  developer: 'Desenvolvedor',
  administrador: 'Administrador',
  admin: 'Administrador',
  // "gestor"/"manager" é o nome legado do perfil que enxergava tudo — mapeia
  // para "Gerente" (o sucessor com a mesma visão irrestrita), não para
  // "Executivo" (o novo perfil restrito ao próprio time, que não existia
  // nos backups antigos e exigiria uma decisão manual por pessoa).
  gestor: 'Gerente',
  manager: 'Gerente',
  gerente: 'Gerente',
  executivo: 'Executivo',
  executive: 'Executivo',
  facilitador: 'Facilitador',
  'sem acesso': 'Sem acesso'
};

export function normalizeLegacyAccessProfile(raw: LegacyJsonAccessProfile): NormalizedLegacyAccessProfile {
  const roleRaw = String(raw.tipo ?? raw.perfil ?? raw.role ?? raw.accessRole ?? '').trim().toLowerCase();
  return {
    name: String(raw.nome ?? raw.name ?? '').trim(),
    registration: normalizeMatricula(String(raw.matricula ?? raw.registration ?? raw.user ?? raw.login ?? '')),
    email: String(raw.email ?? '').trim(),
    accessType: ACCESS_TYPE_ALIASES[roleRaw] ?? 'Sem acesso',
    title: raw.cargo ? String(raw.cargo) : raw.funcao ? String(raw.funcao) : raw.title,
    area: raw.area ? String(raw.area) : undefined,
    notes: raw.observacao ? String(raw.observacao) : raw.obs,
    status: raw.status === 'Inativo' ? 'Inativo' : 'Ativo'
  };
}

export interface NormalizedLegacyCycle {
  company: string;
  startMonth: string;
  periodicityMonths: number;
  positiveAlertMinutes: number;
  negativeAlertMinutes: number;
  responsible: string;
}

export function normalizeLegacyCycle(raw: LegacyJsonCycle): NormalizedLegacyCycle {
  return {
    company: resolveCompany(raw.empresa),
    startMonth: String(raw.inicioCiclo ?? ''),
    periodicityMonths: raw.periodicidadeMeses === 3 ? 3 : 4,
    positiveAlertMinutes: raw.limiteAlertaPositivo ? timeToMinutes(raw.limiteAlertaPositivo) : 600,
    negativeAlertMinutes: raw.limiteAlertaNegativo ? timeToMinutes(raw.limiteAlertaNegativo) : -300,
    responsible: String(raw.responsavel ?? 'Contabilidade Corporativa')
  };
}

/** Aceita qualquer um dos nomes de coleção usados historicamente para perfis de acesso. */
export function extractLegacyAccessProfiles(payload: LegacyJsonExport): LegacyJsonAccessProfile[] {
  return payload.userProfiles ?? payload.perfisAcesso ?? payload.accessProfiles ?? payload.profiles ?? [];
}

export function extractCompanyCodeFromImport(value: unknown): string {
  return extractCompanyCode(value);
}

export { timeToMinutes };
