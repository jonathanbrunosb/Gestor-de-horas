import type { CollaboratorRow, CompanyCycleRow, CompanyRow, LeaveRow, ManagerRow, TimeRecordRow } from '../types/database';
import type { CollaboratorWithRelations, CompanyCycleWithCompany, DashboardStats } from '../types/domain';
import { getComplianceAlerts, getCycleAlerts } from '../utils/compliance';
import { isCycleClosingMonth } from '../utils/cycles';

/**
 * Composição pura de estatísticas do Dashboard a partir dos dados já
 * carregados em memória (via useAppData) — não faz chamadas de rede.
 */
export function computeDashboardStats(options: {
  collaborators: CollaboratorRow[];
  companies: CompanyRow[];
  managers: ManagerRow[];
  cycles: CompanyCycleRow[];
  records: TimeRecordRow[];
  leaves: LeaveRow[];
  areaFilter?: string;
}): DashboardStats {
  const { collaborators, companies, managers, cycles, records, leaves, areaFilter } = options;

  const withRelations: CollaboratorWithRelations[] = collaborators.map((c) => ({
    ...c,
    company: companies.find((co) => co.id === c.company_id) ?? null,
    manager: managers.find((m) => m.id === c.manager_id) ?? null
  }));

  const active = withRelations.filter((c) => c.status === 'Ativo' && (!areaFilter || c.area === areaFilter));

  const closingCompanies: CompanyCycleWithCompany[] = cycles
    .filter((cfg) => isCycleClosingMonth(cfg))
    .map((cfg) => ({ ...cfg, company: companies.find((co) => co.id === cfg.company_id) ?? null }));

  const cycleAlerts = getCycleAlerts(active, cycles, leaves);
  const complianceAlerts = getComplianceAlerts(active, records, leaves);

  const balanceOf = (c: CollaboratorRow) => c.cycle_balance_minutes || c.bank_hours_balance_minutes;

  return {
    total: active.length,
    balanceTotalMinutes: active.reduce((sum, c) => sum + balanceOf(c), 0),
    creditTotalMinutes: active.reduce((sum, c) => sum + c.month_credit_minutes, 0),
    debitTotalMinutes: active.reduce((sum, c) => sum + c.month_debit_minutes, 0),
    positiveCount: active.filter((c) => balanceOf(c) > 0).length,
    negativeCount: active.filter((c) => balanceOf(c) < 0).length,
    closingCompanies,
    cycleAlerts,
    complianceAlerts,
    totalAlerts: cycleAlerts.length + complianceAlerts.length
  };
}
