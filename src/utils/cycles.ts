import type { CompanyCycleRow } from '../types/database';
import type { CycleReference, CyclePeriod } from '../types/domain';
import { addMonths, monthKey } from './dates';

/** Primeiro dia da competência (YYYY-MM) como Date — âncora das funções de ciclo por competência. */
export function periodToDate(period: string): Date {
  const [year, month] = period.split('-').map(Number);
  return new Date(year || 1970, (month || 1) - 1, 1);
}

/** Config de ciclo da empresa (ou null se não houver ciclo cadastrado). */
export function getCompanyConfig(cycles: CompanyCycleRow[], companyId: string | null): CompanyCycleRow | null {
  if (!companyId) return null;
  return cycles.find((c) => c.company_id === companyId && c.active) ?? null;
}

/** Verifica se `date` cai no mês de encerramento do ciclo configurado. */
export function isCycleClosingMonth(config: CompanyCycleRow | null, date: Date = new Date()): boolean {
  if (!config || !config.start_month || !config.periodicity_months) return false;
  const [year, month] = config.start_month.split('-').map(Number);
  if (!year || !month) return false;
  const diff = (date.getFullYear() - year) * 12 + (date.getMonth() + 1 - month);
  if (diff < 0) return false;
  return (diff + 1) % config.periodicity_months === 0;
}

/** Posição atual no ciclo, ex.: "2/4". */
export function getCycleSequence(config: CompanyCycleRow | null, date: Date = new Date()): string {
  if (!config || !config.start_month) return '-';
  const [year, month] = config.start_month.split('-').map(Number);
  const diff = (date.getFullYear() - year) * 12 + (date.getMonth() + 1 - month);
  if (diff < 0) return 'não iniciado';
  const period = config.periodicity_months || 4;
  const pos = (diff % period) + 1;
  return `${pos}/${period}`;
}

/** Intervalo [start,end] (YYYY-MM) do ciclo vigente para a empresa. */
export function getCurrentCyclePeriod(config: CompanyCycleRow | null, date: Date = new Date()): CyclePeriod {
  if (!config || !config.start_month || !config.periodicity_months) {
    const end = new Date(date.getFullYear(), date.getMonth(), 1);
    const start = new Date(date.getFullYear(), date.getMonth() - 3, 1);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { start: fmt(start), end: fmt(end) };
  }
  const [sy, sm] = config.start_month.split('-').map(Number);
  const p = config.periodicity_months;
  const diffM = (date.getFullYear() - sy) * 12 + (date.getMonth() + 1 - sm);
  if (diffM < 0) return { start: config.start_month, end: config.start_month };
  const off = Math.floor(diffM / p) * p;
  return { start: addMonths(sy, sm, off), end: addMonths(sy, sm, off + p - 1), months: p };
}

/**
 * Igual a getCurrentCyclePeriod, mas ancorado numa competência (YYYY-MM)
 * explícita em vez da data atual — o ciclo de compensação que contém
 * `period`, mesmo que não seja o ciclo vigente "hoje". Usado para consolidar
 * o Dashboard num mês selecionado no filtro (histórico ou não).
 */
export function getCyclePeriodForPeriod(config: CompanyCycleRow | null, period: string): CyclePeriod {
  return getCurrentCyclePeriod(config, periodToDate(period));
}

/** Igual a isCycleClosingMonth, mas ancorado numa competência (YYYY-MM) em vez da data atual. */
export function isCycleClosingPeriod(config: CompanyCycleRow | null, period: string): boolean {
  return isCycleClosingMonth(config, periodToDate(period));
}

/** Igual a getCycleSequence, mas ancorado numa competência (YYYY-MM) em vez da data atual. */
export function getCycleSequenceForPeriod(config: CompanyCycleRow | null, period: string): string {
  return getCycleSequence(config, periodToDate(period));
}

/**
 * Data de referência para as checagens que dependem de "quando estamos"
 * (ex.: existe folga programada à frente?) ao analisar uma competência: é o
 * agora, limitado ao fim do mês analisado. Para um mês já passado, o último
 * dia dele — a pergunta passa a ser "naquele fechamento havia folga
 * programada?" em vez de "há folga programada hoje?"; para o mês corrente
 * (ou uma competência à frente do calendário), continua sendo hoje, ou seja,
 * o comportamento atual da tela não muda na visão padrão.
 */
export function referenceDateForPeriod(period: string, today: Date = new Date()): Date {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return today;
  const lastDayOfPeriod = new Date(year, month, 0);
  return lastDayOfPeriod < today ? lastDayOfPeriod : today;
}

/** Competência (YYYY-MM) do mês corrente — competência padrão quando não há filtro nem dado importado. */
export function currentPeriod(today: Date = new Date()): string {
  return monthKey(today);
}

/**
 * Monta a âncora temporal usada por toda análise de ciclo de uma
 * competência (ver CycleReference). Passar essa referência adiante é o que
 * faz o Dashboard responder ao filtro Mês em vez de responder sempre em
 * relação a "hoje".
 */
export function buildCycleReference(period: string, today: Date = new Date()): CycleReference {
  return {
    period,
    date: referenceDateForPeriod(period, today),
    isPresent: period >= monthKey(today)
  };
}

export function positiveAlertMinutes(config: CompanyCycleRow | null): number {
  return config ? config.positive_alert_minutes : 600;
}

export function negativeAlertMinutes(config: CompanyCycleRow | null): number {
  return config ? config.negative_alert_minutes : -300;
}

export function isOverPositiveLimit(balanceMinutes: number, config: CompanyCycleRow | null): boolean {
  return balanceMinutes > positiveAlertMinutes(config);
}

export function isUnderNegativeLimit(balanceMinutes: number, config: CompanyCycleRow | null): boolean {
  return balanceMinutes < negativeAlertMinutes(config);
}

export function defaultCycleFormValues() {
  return {
    start_month: '',
    periodicity_months: 4 as 3 | 4,
    positive_alert_minutes: 600,
    negative_alert_minutes: -300,
    responsible: 'Contabilidade Corporativa'
  };
}
