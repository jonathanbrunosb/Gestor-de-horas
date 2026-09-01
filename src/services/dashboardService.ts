import type { CollaboratorRow, CompanyCycleRow, CompanyRow, LeaveRow, ManagerRow, TimeRecordRow } from '../types/database';
import type { CollaboratorWithRelations, CompanyCycleWithCompany, DashboardStats, RankingEntry } from '../types/domain';
import { getComplianceAlerts, getCollaboratorStatus, getCycleAlerts } from '../utils/compliance';
import { getCompanyConfig, getCurrentCyclePeriod, isCycleClosingMonth } from '../utils/cycles';
import { getCollaboratorCycleBalance, getCollaboratorPeriodBalance, getLatestPeriod } from '../utils/periodBalances';

/**
 * Composição pura de estatísticas do Dashboard a partir dos dados já
 * carregados em memória (via useAppData) — não faz chamadas de rede.
 *
 * Os números de saldo/crédito/débito e o ranking são sempre calculados a
 * partir dos registros de ponto (time_records) da competência efetiva
 * (a selecionada no filtro Mês, ou a mais recente com dados importados) —
 * nunca das colunas estáticas de saldo do cadastro do colaborador, que só
 * são atualizadas por importação de backup e ficam desatualizadas assim
 * que uma nova competência é importada via upload de folha de ponto.
 */
export function computeDashboardStats(options: {
  collaborators: CollaboratorRow[];
  companies: CompanyRow[];
  managers: ManagerRow[];
  cycles: CompanyCycleRow[];
  records: TimeRecordRow[];
  leaves: LeaveRow[];
  areaFilter?: string;
  monthFilter?: string;
}): DashboardStats {
  const { collaborators, companies, managers, cycles, records, leaves, areaFilter, monthFilter } = options;

  const withRelations: CollaboratorWithRelations[] = collaborators.map((c) => ({
    ...c,
    company: companies.find((co) => co.id === c.company_id) ?? null,
    manager: managers.find((m) => m.id === c.manager_id) ?? null
  }));

  const active = withRelations.filter((c) => c.status === 'Ativo' && (!areaFilter || c.area === areaFilter));

  const closingCompanies: CompanyCycleWithCompany[] = cycles
    .filter((cfg) => isCycleClosingMonth(cfg))
    .map((cfg) => ({ ...cfg, company: companies.find((co) => co.id === cfg.company_id) ?? null }));

  const cycleAlerts = getCycleAlerts(active, cycles, leaves, records);
  const complianceAlerts = getComplianceAlerts(active, records, leaves);

  const effectivePeriod = monthFilter || getLatestPeriod(records);

  const periodBalances = effectivePeriod
    ? active.map((c) => ({ collaborator: c, ...getCollaboratorPeriodBalance(c.id, records, effectivePeriod) }))
    : [];

  // Ranking de saldo/status do ciclo de compensação vigente — independente do
  // filtro Mês (que rege as métricas de "no mês" acima), pois seu propósito é
  // priorizar regularização antes do fechamento do ciclo, não de um mês específico.
  const ranking: RankingEntry[] = [...active]
    .map((c): RankingEntry => {
      const config = getCompanyConfig(cycles, c.company_id);
      const balanceMinutes = getCollaboratorCycleBalance(c.id, records, getCurrentCyclePeriod(config));
      const status = getCollaboratorStatus(c, balanceMinutes, config, leaves);
      return { collaborator: c, balanceMinutes, status };
    })
    .sort((a, b) => b.balanceMinutes - a.balanceMinutes)
    .slice(0, 8);

  return {
    total: active.length,
    balanceTotalMinutes: periodBalances.reduce((sum, p) => sum + p.balanceMinutes, 0),
    creditTotalMinutes: periodBalances.reduce((sum, p) => sum + p.creditMinutes, 0),
    debitTotalMinutes: periodBalances.reduce((sum, p) => sum + p.debitMinutes, 0),
    positiveCount: periodBalances.filter((p) => p.balanceMinutes > 0).length,
    negativeCount: periodBalances.filter((p) => p.balanceMinutes < 0).length,
    closingCompanies,
    cycleAlerts,
    complianceAlerts,
    totalAlerts: cycleAlerts.length + complianceAlerts.length,
    effectivePeriod,
    ranking
  };
}
