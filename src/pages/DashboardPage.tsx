import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../hooks/AppDataContext';
import { PageContent } from '../components/layout/PageContent';
import { MetricCard } from '../components/ui/MetricCard';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { CalendarGrid } from '../components/calendar/CalendarGrid';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { LeaveForm } from '../components/forms/LeaveForm';
import { computeDashboardStats } from '../services/dashboardService';
import { minutesToTime } from '../utils/time';
import { periodToDate } from '../utils/cycles';
import { formatDate, formatPeriodLabel, toISODate } from '../utils/dates';
import { listSelectableMonths, listAvailablePeriods, getLatestPeriod } from '../utils/periodBalances';
import { hasCollaboratorEmail, type MailtoAlertType } from '../utils/mailto';
import { generateAndLogNotification } from '../services/notificationsService';
import { createLeave, type LeaveInput } from '../services/leavesService';
import type { BadgeTone, CollaboratorWithRelations, LeaveWithRelations } from '../types/domain';
import { canRegisterLeaves } from '../lib/permissions';
import { Button } from '../components/ui/Button';

interface AlertRow {
  key: string;
  typeLabel: string;
  tone: BadgeTone;
  companyName: string;
  collaborator: CollaboratorWithRelations;
  cycleBalance: string;
  details: string;
  status: string;
  actionText: string;
  mailtoType: MailtoAlertType;
  mailtoAction: string;
  registerLeaveDate?: string;
}

const ALERT_KPI_NOTE_DESCRIPTION =
  'Encerramento de ciclo com saldo positivo acima do limite · descumprimentos de interjornada/intrajornada · batidas de ponto incompletas · folgas programadas D-1';

export function DashboardPage() {
  const { data, access, toast } = useAppContext();
  const navigate = useNavigate();
  const [areaFilter, setAreaFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [leaveModal, setLeaveModal] = useState<{ collaborator: CollaboratorWithRelations; date: string } | null>(null);
  const [alertsPage, setAlertsPage] = useState(1);
  const ALERTS_PAGE_SIZE = 10;

  const areas = useMemo(() => Array.from(new Set(data.collaborators.map((c) => c.area).filter(Boolean))).sort(), [data.collaborators]);
  // União do calendário (janeiro até o mês atual) com qualquer competência que
  // já tenha registro importado, mesmo fora dessa janela — nunca esconde dado
  // real e evita precisar de uma opção especial "Mais recente importado": a
  // competência mais recente já aparece como uma seleção direta na lista.
  const availablePeriods = useMemo(() => {
    const combined = new Set([...listSelectableMonths(), ...listAvailablePeriods(data.records)]);
    return Array.from(combined).sort().reverse();
  }, [data.records]);
  const defaultPeriod = useMemo(() => getLatestPeriod(data.records) ?? availablePeriods[0] ?? '', [data.records, availablePeriods]);
  const effectiveMonthFilter = monthFilter || defaultPeriod;

  const stats = useMemo(
    () =>
      computeDashboardStats({
        collaborators: data.collaborators,
        companies: data.companies,
        managers: data.managers,
        cycles: data.cycles,
        records: data.records,
        leaves: data.leaves,
        areaFilter,
        monthFilter: effectiveMonthFilter
      }),
    [data.collaborators, data.companies, data.managers, data.cycles, data.records, data.leaves, areaFilter, effectiveMonthFilter]
  );

  const periodLabel = stats.effectivePeriod ? formatPeriodLabel(stats.effectivePeriod) : 'sem dados importados';

  const alertCounts = useMemo(() => {
    const ciclo = stats.cycleAlerts.length;
    const interjornada = stats.complianceAlerts.filter((a) => a.type === 'interjornada').length;
    const intrajornada = stats.complianceAlerts.filter((a) => a.type === 'intrajornada').length;
    const batida = stats.complianceAlerts.filter((a) => a.type === 'batida_incompleta').length;
    const folgaAmanha = stats.complianceAlerts.filter((a) => a.type === 'folga_amanha').length;
    return { ciclo, interjornada, intrajornada, batida, folgaAmanha };
  }, [stats.cycleAlerts, stats.complianceAlerts]);

  const alertRows: AlertRow[] = useMemo(() => {
    const rows: AlertRow[] = [];

    for (const alert of stats.cycleAlerts) {
      const cycleBalance = minutesToTime(alert.balanceMinutes);
      const details = `Saldo ${minutesToTime(alert.balanceMinutes)} acima do limite ${minutesToTime(alert.limitMinutes)}${
        alert.hasFutureLeave ? ' — folga já programada' : ' — sem folga programada'
      }`;
      const actionText = alert.hasFutureLeave
        ? 'Validar compensação programada com o colaborador.'
        : 'Programar folga / alinhar com gestor para compensação do saldo.';
      rows.push({
        key: `cycle-${alert.collaborator.id}`,
        typeLabel: 'Fechamento ciclo',
        tone: 'danger',
        companyName: alert.collaborator.company?.short_name ?? '-',
        collaborator: alert.collaborator,
        cycleBalance,
        details,
        status: alert.hasFutureLeave ? 'Folga programada' : 'Crítico',
        actionText,
        mailtoType: 'Alerta de ciclo',
        mailtoAction: actionText
      });
    }

    for (const alert of stats.complianceAlerts) {
      const cycleBalance = minutesToTime(stats.cycleBalanceByCollaboratorId.get(alert.collaborator.id) ?? 0);
      const base = {
        companyName: alert.collaborator.company?.short_name ?? '-',
        collaborator: alert.collaborator,
        cycleBalance,
        details: alert.details
      };
      if (alert.type === 'interjornada') {
        const actionText = 'Revisar escala e ajustar horários para garantir 11h de descanso.';
        rows.push({
          key: `interjornada-${alert.collaborator.id}`,
          typeLabel: 'Interjornada',
          tone: 'warning',
          status: `${alert.count} ocorrência(s)`,
          actionText,
          mailtoType: 'Alerta de interjornada',
          mailtoAction: actionText,
          ...base
        });
      } else if (alert.type === 'intrajornada') {
        const actionText = 'Verificar registros e garantir intervalo mínimo de 1h para refeição.';
        rows.push({
          key: `intrajornada-${alert.collaborator.id}`,
          typeLabel: 'Intrajornada',
          tone: 'warning',
          status: `${alert.count} ocorrência(s)`,
          actionText,
          mailtoType: 'Alerta de intrajornada',
          mailtoAction: actionText,
          ...base
        });
      } else if (alert.type === 'batida_incompleta') {
        const actionText = 'Registrar folga ou solicitar justificativa/regularização ao colaborador.';
        rows.push({
          key: `batida-${alert.collaborator.id}`,
          typeLabel: 'Batida ponto',
          tone: 'danger',
          status: `${alert.count} ocorrência(s)`,
          actionText,
          mailtoType: 'Alerta de batida incompleta',
          mailtoAction: actionText,
          registerLeaveDate: alert.incompleteDays?.[0],
          ...base
        });
      } else if (alert.type === 'folga_amanha') {
        const actionText = 'Confirmar presença e comunicar gestor e equipe sobre a ausência de amanhã.';
        rows.push({
          key: `folga-${alert.collaborator.id}`,
          typeLabel: 'Folga amanhã',
          tone: 'info',
          status: '1 ocorrência(s)',
          actionText,
          mailtoType: 'Folga amanhã',
          mailtoAction: actionText,
          ...base
        });
      }
    }

    return rows;
  }, [stats.cycleAlerts, stats.complianceAlerts, stats.cycleBalanceByCollaboratorId]);

  // Volta para a primeira página sempre que os filtros mudam a lista de alertas.
  useEffect(() => {
    setAlertsPage(1);
  }, [areaFilter, effectiveMonthFilter]);

  const alertsPageCount = Math.max(1, Math.ceil(alertRows.length / ALERTS_PAGE_SIZE));
  const alertsCurrentPage = Math.min(alertsPage, alertsPageCount);
  const pagedAlertRows = useMemo(
    () => alertRows.slice((alertsCurrentPage - 1) * ALERTS_PAGE_SIZE, alertsCurrentPage * ALERTS_PAGE_SIZE),
    [alertRows, alertsCurrentPage]
  );

  const attentionFragments = useMemo(() => {
    const fragments: string[] = [];
    if (alertCounts.ciclo > 0) fragments.push(`${alertCounts.ciclo} alerta(s) de encerramento de ciclo`);
    if (alertCounts.interjornada > 0) fragments.push(`${alertCounts.interjornada} colaborador(es) com violação de interjornada`);
    if (alertCounts.intrajornada > 0) fragments.push(`${alertCounts.intrajornada} colaborador(es) com violação de intrajornada`);
    if (alertCounts.batida > 0) fragments.push(`${alertCounts.batida} colaborador(es) com batidas incompletas`);
    if (alertCounts.folgaAmanha > 0) fragments.push(`${alertCounts.folgaAmanha} colaborador(es) com folga programada para amanhã`);
    return fragments;
  }, [alertCounts]);

  const alertKpiNote = `${alertCounts.ciclo} ciclo · ${alertCounts.interjornada} interjornada · ${alertCounts.intrajornada} intrajornada · ${alertCounts.batida} batida · ${alertCounts.folgaAmanha} folga D-1`;

  const leavesWithRelations: LeaveWithRelations[] = useMemo(
    () =>
      data.leaves.map((leave) => ({
        ...leave,
        collaborator: data.collaborators.find((c) => c.id === leave.collaborator_id) ?? null,
        company: data.companies.find((co) => co.id === leave.company_id) ?? null
      })),
    [data.leaves, data.collaborators, data.companies]
  );

  const leavesByDay = useMemo(() => {
    const map = new Map<string, LeaveWithRelations[]>();
    for (const leave of leavesWithRelations) {
      const list = map.get(leave.leave_date) ?? [];
      list.push(leave);
      map.set(leave.leave_date, list);
    }
    return map;
  }, [leavesWithRelations]);

  const canManageLeaves = canRegisterLeaves(access.context.profile?.access_type);

  async function handleNotify(row: AlertRow) {
    try {
      const { mailtoUrl } = await generateAndLogNotification(
        { collaborator: row.collaborator, type: row.mailtoType, details: row.details, action: row.mailtoAction },
        access.context.matricula
      );
      window.location.href = mailtoUrl;
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao gerar notificação.', 'danger');
    }
  }

  async function handleRegisterLeave(payload: LeaveInput) {
    try {
      await createLeave(payload, access.context.matricula);
      toast.notify('Folga registrada.', 'success');
      setLeaveModal(null);
      data.reload();
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao registrar folga.', 'danger');
    }
  }

  return (
    <PageContent
      title="Dashboard"
      description="Visão consolidada dos saldos de banco de horas, ciclos de compensação e folgas programadas."
      actions={
        <>
          <div className="filter-inline">
            <label>Área</label>
            <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
              <option value="">Consolidado (todos)</option>
              {areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-inline">
            <label>Mês</label>
            <select value={effectiveMonthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
              {availablePeriods.map((period) => (
                <option key={period} value={period}>
                  {formatPeriodLabel(period)}
                </option>
              ))}
            </select>
          </div>
        </>
      }
    >
      {stats.totalAlerts > 0 && (
        <div className="alert-box">
          <span className="alert-box-icon">!</span>
          <div>
            <h3>Atenção: existem itens que requerem ação do RH / Gestão.</h3>
            <p>{attentionFragments.join(' · ')}</p>
            <p style={{ marginTop: 4 }}>Critérios considerados: {ALERT_KPI_NOTE_DESCRIPTION}.</p>
          </div>
        </div>
      )}

      <p className="small-text" style={{ marginBottom: 10 }}>
        Saldo e ranking abaixo consideram o ciclo de compensação de cada colaborador acumulado até <strong>{periodLabel}</strong>
        {areaFilter ? <> · área <strong>{areaFilter}</strong></> : null} — calculados a partir dos registros de ponto importados.
      </p>

      <div className="grid cards-6" style={{ marginBottom: 14 }}>
        <MetricCard title="Colaboradores monitorados" value={String(stats.total)} tone="neutral" />
        <MetricCard title="Saldo acumulado do ciclo" value={minutesToTime(stats.balanceTotalMinutes)} note={`até ${periodLabel}`} tone="info" />
        <MetricCard title="Saldo positivo" value={String(stats.positiveCount)} note="colaboradores · saldo do ciclo" tone="success" />
        <MetricCard title="Saldo negativo" value={String(stats.negativeCount)} note="colaboradores · saldo do ciclo" tone="danger" />
        <MetricCard title="Empresas encerrando ciclo" value={String(stats.closingCompanies.length)} note={`em ${periodLabel}`} tone="warning" />
        <MetricCard
          title="Alertas do período"
          value={String(stats.totalAlerts)}
          note={alertKpiNote}
          tone={stats.totalAlerts > 0 ? 'danger' : 'success'}
        />
      </div>

      <div className="grid two-col">
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="card">
            <h2 className="section-title">Alertas do período</h2>
            {!alertRows.length ? (
              <EmptyState message="Nenhum alerta identificado para o período atual." />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Empresa</th>
                      <th>Colaborador</th>
                      <th>Saldo ciclo</th>
                      <th>Detalhes</th>
                      <th>Status</th>
                      <th>Ação sugerida</th>
                      <th>Notificação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedAlertRows.map((row) => (
                      <tr key={row.key}>
                        <td>
                          <Badge label={row.typeLabel} tone={row.tone} />
                        </td>
                        <td>{row.companyName}</td>
                        <td>{row.collaborator.name}</td>
                        <td className="mono">{row.cycleBalance}</td>
                        <td>{row.details}</td>
                        <td>{row.status}</td>
                        <td>
                          {row.actionText}
                          {row.registerLeaveDate && canManageLeaves && (
                            <div style={{ marginTop: 6 }}>
                              <Button
                                size="small"
                                variant="secondary"
                                onClick={() => setLeaveModal({ collaborator: row.collaborator, date: row.registerLeaveDate! })}
                              >
                                Registrar folga
                              </Button>
                            </div>
                          )}
                        </td>
                        <td>
                          {hasCollaboratorEmail(row.collaborator) ? (
                            <Button size="small" variant="secondary" onClick={() => handleNotify(row)}>
                              Notificar
                            </Button>
                          ) : (
                            <span className="muted small-text">Sem e-mail cadastrado</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={alertsCurrentPage} pageSize={ALERTS_PAGE_SIZE} totalItems={alertRows.length} onPageChange={setAlertsPage} />
          </div>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div className="card">
            <h2 className="section-title">Calendário de {periodLabel}</h2>
            <CalendarGrid
              month={periodToDate(effectiveMonthFilter)}
              leavesByDay={leavesByDay}
              criticalDays={new Set()}
              cycleClosingDays={new Set()}
              selectedDate=""
              onSelectDate={() => undefined}
              compact
            />
          </div>

          <div className="card">
            <h2 className="section-title">Ciclos por empresa</h2>
            <p className="section-subtitle">Ciclo de compensação vigente em {periodLabel} para cada empresa com colaborador na visão atual.</p>
            {!stats.cycleSummaries.length ? (
              <EmptyState message="Nenhuma empresa com colaborador ativo para os filtros selecionados." />
            ) : (
              <div className="list">
                {stats.cycleSummaries.map((summary) => (
                  <div key={summary.company?.id ?? summary.cycle?.id ?? 'sem-empresa'} className="list-item">
                    <div>
                      <div className="list-title">{summary.company?.short_name ?? '-'}</div>
                      <div className="list-meta">
                        {summary.missingConfig ? (
                          <>Sem ciclo cadastrado — saldo apurado numa janela móvel de 4 meses ({formatPeriodLabel(summary.period.start)} → {formatPeriodLabel(summary.period.end)}), que nunca encerra</>
                        ) : (
                          <>
                            {formatPeriodLabel(summary.period.start)} → {formatPeriodLabel(summary.period.end)} · posição {summary.sequence} · {summary.collaboratorCount} colaborador(es)
                          </>
                        )}
                      </div>
                    </div>
                    {summary.missingConfig ? (
                      <Badge label="Sem ciclo" tone="danger" />
                    ) : summary.isClosing ? (
                      <Badge label="Encerrando" tone="warning" />
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h2 className="section-title">Ranking de saldos por colaborador</h2>
        <p className="section-subtitle">
          Visão rápida para priorizar compensações, alinhamentos com gestores e regularização antes do fechamento do ciclo.
        </p>
        {!stats.ranking.length ? (
          <EmptyState message="Nenhum colaborador ativo para os filtros selecionados." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Empresa</th>
                  <th>Saldo ciclo</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {stats.ranking.map((entry) => (
                  <tr key={entry.collaborator.id}>
                    <td>
                      <div className="list-title">{entry.collaborator.name}</div>
                      <div className="list-meta mono">{entry.collaborator.registration}</div>
                    </td>
                    <td>{entry.collaborator.company?.short_name ?? '-'}</td>
                    <td className="mono" style={{ fontWeight: 700 }}>
                      {minutesToTime(entry.balanceMinutes)}
                    </td>
                    <td>
                      <StatusBadge status={entry.status} />
                    </td>
                    <td>
                      <Button size="small" variant="secondary" onClick={() => navigate(`/controle-horas?colaborador=${entry.collaborator.id}`)}>
                        Detalhar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="small-text" style={{ marginTop: 14 }}>
        Última atualização: {formatDate(new Date().toISOString().slice(0, 10))}
      </p>

      <Modal
        open={Boolean(leaveModal)}
        title={`Registrar folga — ${leaveModal?.collaborator.name ?? ''}`}
        description="Folga sugerida a partir do dia com batida incompleta identificado no alerta."
        onClose={() => setLeaveModal(null)}
      >
        {leaveModal && (
          <LeaveForm
            collaborators={[leaveModal.collaborator]}
            defaultDate={leaveModal.date || toISODate(new Date())}
            onSubmit={handleRegisterLeave}
            onCancel={() => setLeaveModal(null)}
            submitting={false}
          />
        )}
      </Modal>
    </PageContent>
  );
}
