import type { CompanyCycleRow } from '../types/database';
import type { CyclePeriod } from '../types/domain';
import { addMonths } from './dates';

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
