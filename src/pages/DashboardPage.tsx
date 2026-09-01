import { useMemo, useState } from 'react';
import { useAppContext } from '../hooks/AppDataContext';
import { PageContent } from '../components/layout/PageContent';
import { MetricCard } from '../components/ui/MetricCard';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { CalendarGrid } from '../components/calendar/CalendarGrid';
import { computeDashboardStats } from '../services/dashboardService';
import { minutesToTime } from '../utils/time';
import { getCycleSequence } from '../utils/cycles';
import { formatDate } from '../utils/dates';
import type { LeaveWithRelations } from '../types/domain';
import { canResetDatabase } from '../lib/permissions';
import { resetDatabase } from '../services/resetService';
import { downloadFile } from '../utils/formatters';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

const COMPLIANCE_LABELS: Record<string, string> = {
  interjornada: 'Interjornada (< 11h)',
  intrajornada: 'Intrajornada (almoço < 1h)',
  batida_incompleta: 'Batida incompleta',
  folga_amanha: 'Folga amanhã'
};

export function DashboardPage() {
  const { data, access, toast } = useAppContext();
  const [areaFilter, setAreaFilter] = useState('');
  const [resetOpen, setResetOpen] = useState(false);

  const areas = useMemo(() => Array.from(new Set(data.collaborators.map((c) => c.area).filter(Boolean))).sort(), [data.collaborators]);

  const stats = useMemo(
    () =>
      computeDashboardStats({
        collaborators: data.collaborators,
        companies: data.companies,
        managers: data.managers,
        cycles: data.cycles,
        records: data.records,
        leaves: data.leaves,
        areaFilter
      }),
    [data.collaborators, data.companies, data.managers, data.cycles, data.records, data.leaves, areaFilter]
  );

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

  const ranking = useMemo(
    () =>
      [...data.collaborators]
        .filter((c) => c.status === 'Ativo')
        .sort((a, b) => (b.cycle_balance_minutes || b.bank_hours_balance_minutes) - (a.cycle_balance_minutes || a.bank_hours_balance_minutes))
        .slice(0, 8),
    [data.collaborators]
  );

  async function handleExportJson() {
    const payload = {
      companies: data.companies,
      collaborators: data.collaborators,
      managers: data.managers,
      cycles: data.cycles,
      leaves: data.leaves,
      records: data.records,
      accessProfiles: data.accessProfiles,
      exportedAt: new Date().toISOString()
    };
    downloadFile(`monitor-controles-horas-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json');
    toast.notify('Backup JSON exportado.', 'success');
  }

  async function handleReset() {
    try {
      await resetDatabase(
        { collaborators: true, managers: true, records: true, leaves: true, imports: true, cycles: false },
        access.context.matricula
      );
      toast.notify('Base resetada. Perfis de acesso e ciclos foram preservados.', 'success');
      setResetOpen(false);
      data.reload();
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao resetar a base.', 'danger');
    }
  }

  const canReset = canResetDatabase(access.context.profile?.access_type);

  return (
    <PageContent
      title="Dashboard"
      description="Visão consolidada dos saldos de banco de horas, ciclos de compensação e folgas programadas."
      actions={
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Área</label>
            <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} style={{ minWidth: 160 }}>
              <option value="">Consolidado (todos)</option>
              {areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>
          <Button variant="secondary" onClick={handleExportJson}>
            Exportar JSON
          </Button>
          {canReset && (
            <Button variant="danger" onClick={() => setResetOpen(true)}>
              Resetar base
            </Button>
          )}
        </>
      }
    >
      <div className="grid cards-4" style={{ marginBottom: 14 }}>
        <MetricCard title="Colaboradores monitorados" value={String(stats.total)} tone="neutral" />
        <MetricCard title="Saldo total de BH" value={minutesToTime(stats.balanceTotalMinutes)} tone="info" />
        <MetricCard title="Créditos no mês" value={minutesToTime(stats.creditTotalMinutes)} tone="success" />
        <MetricCard title="Débitos no mês" value={minutesToTime(stats.debitTotalMinutes)} tone="warning" />
        <MetricCard title="Saldo positivo" value={String(stats.positiveCount)} note="colaboradores" tone="success" />
        <MetricCard title="Saldo negativo" value={String(stats.negativeCount)} note="colaboradores" tone="danger" />
        <MetricCard title="Empresas encerrando ciclo" value={String(stats.closingCompanies.length)} tone="warning" />
        <MetricCard title="Alertas do período" value={String(stats.totalAlerts)} tone={stats.totalAlerts > 0 ? 'danger' : 'neutral'} />
      </div>

      <div className="grid two-col">
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="card">
            <h2 className="section-title">Alertas do período</h2>
            {stats.totalAlerts === 0 ? (
              <EmptyState message="Nenhum alerta identificado para o filtro atual." />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Colaborador</th>
                      <th>Empresa</th>
                      <th>Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.cycleAlerts.map((alert, idx) => (
                      <tr key={`cycle-${idx}`}>
                        <td>
                          <Badge label="Encerramento de ciclo" tone="danger" />
                        </td>
                        <td>{alert.collaborator.name}</td>
                        <td>{alert.collaborator.company?.short_name ?? '-'}</td>
                        <td>
                          Saldo {minutesToTime(alert.balanceMinutes)} acima do limite {minutesToTime(alert.limitMinutes)}
                          {alert.hasFutureLeave ? ' — folga já programada' : ' — sem folga programada'}
                        </td>
                      </tr>
                    ))}
                    {stats.complianceAlerts.map((alert, idx) => (
                      <tr key={`compliance-${idx}`}>
                        <td>
                          <Badge label={COMPLIANCE_LABELS[alert.type] ?? alert.type} tone={alert.type === 'folga_amanha' ? 'info' : 'warning'} />
                        </td>
                        <td>{alert.collaborator.name}</td>
                        <td>{alert.collaborator.company?.short_name ?? '-'}</td>
                        <td>{alert.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="section-title">Ranking de saldos por colaborador</h2>
            {!ranking.length ? (
              <EmptyState message="Sem colaboradores ativos." />
            ) : (
              <div className="list">
                {ranking.map((c) => (
                  <div key={c.id} className="list-item">
                    <div>
                      <div className="list-title">{c.name}</div>
                      <div className="list-meta">{data.companies.find((co) => co.id === c.company_id)?.short_name ?? '-'}</div>
                    </div>
                    <span className="mono" style={{ fontWeight: 700 }}>
                      {minutesToTime(c.cycle_balance_minutes || c.bank_hours_balance_minutes)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div className="card">
            <h2 className="section-title">Calendário do mês</h2>
            <CalendarGrid
              month={new Date()}
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
            {!data.cycles.length ? (
              <EmptyState message="Nenhum ciclo cadastrado." />
            ) : (
              <div className="list">
                {data.cycles.map((cfg) => {
                  const company = data.companies.find((c) => c.id === cfg.company_id);
                  return (
                    <div key={cfg.id} className="list-item">
                      <div>
                        <div className="list-title">{company?.short_name ?? '-'}</div>
                        <div className="list-meta">
                          Início {cfg.start_month} · {cfg.periodicity_months} meses · posição {getCycleSequence(cfg)}
                        </div>
                      </div>
                      {stats.closingCompanies.some((c) => c.id === cfg.id) && <Badge label="Encerrando" tone="warning" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="small-text" style={{ marginTop: 14 }}>
        Última atualização: {formatDate(new Date().toISOString().slice(0, 10))}
      </p>

      <ConfirmDialog
        open={resetOpen}
        title="Resetar base de dados"
        message="Esta ação apaga colaboradores, gestores, registros de ponto, folgas e importações. Perfis de acesso e ciclos configurados são preservados. Esta ação não pode ser desfeita."
        confirmLabel="Resetar base"
        danger
        onConfirm={handleReset}
        onCancel={() => setResetOpen(false)}
      />
    </PageContent>
  );
}
