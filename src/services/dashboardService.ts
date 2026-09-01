import type { CollaboratorRow, CompanyCycleRow, CompanyRow, LeaveRow, ManagerRow, TimeRecordRow } from '../types/database';
import type { CollaboratorWithRelations, CompanyCycleWithCompany, DashboardStats, RankingEntry } from '../types/domain';
import { getComplianceAlerts, getCollaboratorStatus, getCycleAlerts } from '../utils/compliance';
import { getCompanyConfig, getCurrentCyclePeriod, getCyclePeriodForPeriod, isCycleClosingMonth } from '../utils/cycles';
import { getCollaboratorCycleBalance, getCollaboratorCycleToDateBalance, getCollaboratorPeriodBalance, getLatestPeriod } from '../utils/periodBalances';

/**
 * Composição pura de estatísticas do Dashboard a partir dos dados já
 * carregados em memória (via useAppData) — não faz chamadas de rede.
 *
 * Créditos/débitos são o movimento da competência efetiva (a selecionada no
 * filtro Mês, ou a mais recente com dados importados) isoladamente. Saldo,
 * ranking e as contagens positivo/negativo, por sua vez, são o saldo do
 * ciclo de compensação ACUMULADO desde o início do ciclo que contém a
 * competência efetiva até ela (nunca só o mês isolado) — é assim que banco
 * de horas funciona (o saldo carrega de um mês para o outro dentro do
 * ciclo), e é o mesmo cálculo usado no Ranking/Status/coluna "Saldo ciclo"
 * dos Alertas, para os números da consolidação baterem entre si em vez de
 * cada bloco do Dashboard mostrar um recorte diferente. Tudo a partir dos
 * registros de ponto (time_records) — nunca das colunas estáticas de saldo
 * do cadastro do colaborador, que só são atualizadas por importação de
 * backup e ficam desatualizadas assim que uma nova competência é importada
 * via upload de folha de ponto.
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

  // Snapshot único de saldo/status do ciclo acumulado até effectivePeriod,
  // por colaborador ativo — alimenta o ranking (top 8), as contagens
  // positivo/negativo, o saldo total consolidado e a coluna "Saldo ciclo"
  // da tabela de Alertas, todos com o mesmo número.
  const cycleSnapshots: RankingEntry[] = active.map((c): RankingEntry => {
    const config = getCompanyConfig(cycles, c.company_id);
    const cyclePeriod = effectivePeriod ? getCyclePeriodForPeriod(config, effectivePeriod) : getCurrentCyclePeriod(config);
    const balanceMinutes = effectivePeriod
      ? getCollaboratorCycleToDateBalance(c.id, records, cyclePeriod, effectivePeriod)
      : getCollaboratorCycleBalance(c.id, records, cyclePeriod);
    const status = getCollaboratorStatus(c, balanceMinutes, config, leaves);
    return { collaborator: c, balanceMinutes, status };
  });

  const ranking = [...cycleSnapshots].sort((a, b) => b.balanceMinutes - a.balanceMinutes).slice(0, 8);
  const cycleBalanceByCollaboratorId = new Map(cycleSnapshots.map((s) => [s.collaborator.id, s.balanceMinutes]));

  return {
    total: active.length,
    balanceTotalMinutes: cycleSnapshots.reduce((sum, s) => sum + s.balanceMinutes, 0),
    creditTotalMinutes: periodBalances.reduce((sum, p) => sum + p.creditMinutes, 0),
    debitTotalMinutes: periodBalances.reduce((sum, p) => sum + p.debitMinutes, 0),
    positiveCount: cycleSnapshots.filter((s) => s.balanceMinutes > 0).length,
    negativeCount: cycleSnapshots.filter((s) => s.balanceMinutes < 0).length,
    closingCompanies,
    cycleAlerts,
    complianceAlerts,
    totalAlerts: cycleAlerts.length + complianceAlerts.length,
    effectivePeriod,
    ranking,
    cycleBalanceByCollaboratorId
  };
}
