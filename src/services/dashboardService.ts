import type { CollaboratorRow, CompanyCycleRow, CompanyRow, LeaveRow, ManagerRow, TimeRecordRow } from '../types/database';
import type { CollaboratorWithRelations, CompanyCycleWithCompany, CycleSummary, DashboardStats, RankingEntry } from '../types/domain';
import { getComplianceAlerts, getCollaboratorStatus, getCycleAlerts } from '../utils/compliance';
import {
  buildCycleReference,
  currentPeriod,
  getCompanyConfig,
  getCyclePeriodForPeriod,
  getCycleSequenceForPeriod,
  isCycleClosingPeriod
} from '../utils/cycles';
import { getCollaboratorCycleToDateBalance, getCollaboratorPeriodBalance, getLatestPeriod } from '../utils/periodBalances';

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
 *
 * TODA análise de ciclo daqui — janela do ciclo, mês de encerramento,
 * alertas e status — é ancorada na competência efetiva (CycleReference), e
 * não em "hoje": filtrar agosto responde sobre agosto (inclusive quais
 * empresas encerram ciclo em agosto), e virar para setembro cai no ciclo
 * seguinte, zerando o acumulado do ciclo que encerrou.
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
  /** Injetável só para teste — o "hoje" usado para separar competência passada de presente. */
  today?: Date;
}): DashboardStats {
  const { collaborators, companies, managers, cycles, records, leaves, areaFilter, monthFilter, today = new Date() } = options;

  const withRelations: CollaboratorWithRelations[] = collaborators.map((c) => ({
    ...c,
    company: companies.find((co) => co.id === c.company_id) ?? null,
    manager: managers.find((m) => m.id === c.manager_id) ?? null
  }));

  const active = withRelations.filter((c) => c.status === 'Ativo' && (!areaFilter || c.area === areaFilter));

  const effectivePeriod = monthFilter || getLatestPeriod(records);
  const reference = buildCycleReference(effectivePeriod ?? currentPeriod(today), today);

  // Um resumo por empresa que tem colaborador ativo em tela, na competência
  // analisada — inclusive as SEM ciclo cadastrado, que antes sumiam daqui em
  // silêncio (sem ciclo, o sistema cai numa janela móvel de 4 meses que nunca
  // encerra e nunca zera o saldo, exatamente o sintoma de "o ciclo encerrou
  // mas o saldo continua o mesmo").
  const companyIdsInView = new Set(active.map((c) => c.company_id).filter(Boolean) as string[]);
  const cycleSummaries: CycleSummary[] = Array.from(companyIdsInView)
    .map((companyId): CycleSummary => {
      const config = getCompanyConfig(cycles, companyId);
      return {
        cycle: config,
        company: companies.find((co) => co.id === companyId) ?? null,
        period: getCyclePeriodForPeriod(config, reference.period),
        sequence: getCycleSequenceForPeriod(config, reference.period),
        isClosing: isCycleClosingPeriod(config, reference.period),
        missingConfig: !config,
        collaboratorCount: active.filter((c) => c.company_id === companyId).length
      };
    })
    .sort((a, b) => (a.company?.short_name ?? '').localeCompare(b.company?.short_name ?? ''));

  const closingCompanies: CompanyCycleWithCompany[] = cycleSummaries
    .filter((summary) => summary.isClosing && summary.cycle)
    .map((summary) => ({ ...(summary.cycle as CompanyCycleRow), company: summary.company }));

  const cycleAlerts = getCycleAlerts(active, cycles, leaves, records, reference);
  const complianceAlerts = getComplianceAlerts(active, records, leaves, reference);

  const periodBalances = effectivePeriod
    ? active.map((c) => ({ collaborator: c, ...getCollaboratorPeriodBalance(c.id, records, effectivePeriod) }))
    : [];

  // Snapshot único de saldo/status do ciclo acumulado até a competência
  // analisada, por colaborador ativo — alimenta o ranking (top 8), as
  // contagens positivo/negativo, o saldo total consolidado e a coluna
  // "Saldo ciclo" da tabela de Alertas, todos com o mesmo número.
  const cycleSnapshots: RankingEntry[] = active.map((c): RankingEntry => {
    const config = getCompanyConfig(cycles, c.company_id);
    const cyclePeriod = getCyclePeriodForPeriod(config, reference.period);
    const balanceMinutes = getCollaboratorCycleToDateBalance(c.id, records, cyclePeriod, reference.period);
    const status = getCollaboratorStatus(c, balanceMinutes, config, leaves, reference);
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
    cycleSummaries,
    cycleAlerts,
    complianceAlerts,
    totalAlerts: cycleAlerts.length + complianceAlerts.length,
    effectivePeriod,
    ranking,
    cycleBalanceByCollaboratorId
  };
}
