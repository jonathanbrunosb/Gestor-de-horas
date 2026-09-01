import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../hooks/AppDataContext';
import { PageContent } from '../components/layout/PageContent';
import { MetricCard } from '../components/ui/MetricCard';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { minutesToTime } from '../utils/time';
import { getCurrentCyclePeriod, isCycleClosingMonth } from '../utils/cycles';
import { formatBRL } from '../utils/formatters';
import { getGestaoConfig, saveGestaoConfig } from '../services/settingsService';
import { canManageMasterData } from '../lib/permissions';
import type { GestaoCompanyRow, PaymentProjectionRow } from '../types/domain';

export function ManagementPage() {
  const { data, access, toast } = useAppContext();
  const [custoHora, setCustoHora] = useState(35);
  const [adicionalPct, setAdicionalPct] = useState(50);
  const [saving, setSaving] = useState(false);

  const canManage = canManageMasterData(access.context.profile?.access_type);

  useEffect(() => {
    getGestaoConfig().then((cfg) => {
      setCustoHora(cfg.custoHora);
      setAdicionalPct(cfg.adicionalPct);
    });
  }, []);

  const companyRows: GestaoCompanyRow[] = useMemo(() => {
    return data.companies
      .map((company) => {
        const collaborators = data.collaborators.filter((c) => c.company_id === company.id && c.status === 'Ativo');
        if (!collaborators.length) return null;

        const cycleConfig = data.cycles.find((c) => c.company_id === company.id) ?? null;
        const period = getCurrentCyclePeriod(cycleConfig);
        const isClosing = isCycleClosingMonth(cycleConfig);
        const ids = new Set(collaborators.map((c) => c.id));

        const cycleRecords = data.records.filter((r) => ids.has(r.collaborator_id) && (r.period ?? '') >= period.start && (r.period ?? '') <= period.end);
        const creditMinutes = cycleRecords.reduce((sum, r) => sum + r.credit_bh_minutes, 0);
        const debitMinutes = cycleRecords.reduce((sum, r) => sum + r.debit_bh_minutes, 0);

        const cycleLeaves = data.leaves.filter((l) => ids.has(l.collaborator_id) && l.leave_date >= `${period.start}-01` && l.leave_date <= `${period.end}-31`);

        const limitPositive = cycleConfig?.positive_alert_minutes ?? 600;

        const collaboratorRows = collaborators.map((c) => {
          const balanceMinutes = c.cycle_balance_minutes || c.bank_hours_balance_minutes;
          const leaves = cycleLeaves.filter((l) => l.collaborator_id === c.id);
          const cycleCreditMinutes = cycleRecords.filter((r) => r.collaborator_id === c.id).reduce((sum, r) => sum + r.credit_bh_minutes, 0);
          return {
            ...c,
            company,
            manager: data.managers.find((m) => m.id === c.manager_id) ?? null,
            balanceMinutes,
            leavesCount: leaves.length,
            leavesMinutes: leaves.length * 480,
            cycleCreditMinutes,
            atRisk: balanceMinutes > limitPositive
          };
        });

        const positiveBalanceMinutes = collaboratorRows.reduce((sum, c) => sum + Math.max(0, c.balanceMinutes), 0);
        const negativeBalanceMinutes = collaboratorRows.reduce((sum, c) => sum + Math.abs(Math.min(0, c.balanceMinutes)), 0);
        const atRiskCollaborators = collaboratorRows.filter((c) => c.atRisk);

        const accumulatedBhMinutes = Math.max(0, creditMinutes);
        const pendingBalanceMinutes = Math.max(0, positiveBalanceMinutes);
        const compensatedMinutes = Math.max(0, Math.min(accumulatedBhMinutes, accumulatedBhMinutes - pendingBalanceMinutes));
        const compensatedPct = accumulatedBhMinutes > 0 ? compensatedMinutes / accumulatedBhMinutes : 0;

        const row: GestaoCompanyRow = {
          company,
          cycleConfig,
          period,
          isClosing,
          collaboratorRows,
          atRiskCollaborators,
          accumulatedBhMinutes,
          debitMinutes,
          compensatedMinutes,
          pendingBalanceMinutes,
          positiveBalanceMinutes,
          negativeBalanceMinutes,
          totalLeaves: cycleLeaves.length,
          compensatedPct
        };
        return row;
      })
      .filter((row): row is GestaoCompanyRow => row !== null);
  }, [data.companies, data.collaborators, data.cycles, data.records, data.leaves, data.managers]);

  const totals = useMemo(() => {
    const totalCollaborators = companyRows.reduce((sum, r) => sum + r.collaboratorRows.length, 0);
    const accumulated = companyRows.reduce((sum, r) => sum + r.accumulatedBhMinutes, 0);
    const compensated = companyRows.reduce((sum, r) => sum + r.compensatedMinutes, 0);
    const pending = companyRows.reduce((sum, r) => sum + r.pendingBalanceMinutes, 0);
    const atRisk = companyRows.reduce((sum, r) => sum + r.atRiskCollaborators.length, 0);
    const exposure = (pending / 60) * custoHora * (1 + adicionalPct / 100);
    return { totalCollaborators, accumulated, compensated, pending, atRisk, exposure };
  }, [companyRows, custoHora, adicionalPct]);

  const projectionRows: PaymentProjectionRow[] = useMemo(() => {
    const rows: PaymentProjectionRow[] = [];
    for (const companyRow of companyRows) {
      for (const c of companyRow.atRiskCollaborators) {
        const pendingMinutes = Math.max(0, c.balanceMinutes);
        rows.push({
          status: companyRow.isClosing ? 'Obrigação' : 'Risco',
          company: companyRow.company.short_name,
          collaborator: c.name,
          accumulatedMinutes: c.cycleCreditMinutes,
          compensatedMinutes: Math.max(0, c.cycleCreditMinutes - pendingMinutes),
          pendingMinutes,
          estimatedValue: (pendingMinutes / 60) * custoHora * (1 + adicionalPct / 100)
        });
      }
    }
    return rows.sort((a, b) => b.estimatedValue - a.estimatedValue);
  }, [companyRows, custoHora, adicionalPct]);

  async function handleSaveParams() {
    setSaving(true);
    try {
      await saveGestaoConfig({ custoHora, adicionalPct }, access.context.matricula);
      toast.notify('Parâmetros de valoração salvos.', 'success');
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao salvar parâmetros.', 'danger');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContent title="Gestão BH / Pagamento" description="Visão executiva do banco de horas acumulado, compensado e exposição financeira por empresa.">
      <div className="grid cards-4" style={{ marginBottom: 14 }}>
        <MetricCard title="Colaboradores monitorados" value={String(totals.totalCollaborators)} tone="neutral" />
        <MetricCard title="BH acumulado no ciclo" value={minutesToTime(totals.accumulated)} tone="info" />
        <MetricCard title="Horas compensadas" value={minutesToTime(totals.compensated)} tone="success" />
        <MetricCard title="Saldo pendente" value={minutesToTime(totals.pending)} tone="warning" />
        <MetricCard title="Colaboradores em risco" value={String(totals.atRisk)} tone="danger" />
        <MetricCard title="Exposição financeira" value={formatBRL(totals.exposure)} tone="danger" />
      </div>

      {!companyRows.length ? (
        <EmptyState message="Sem dados suficientes para compor a Gestão BH / Pagamento." />
      ) : (
        <div className="card" style={{ marginBottom: 14 }}>
          <h2 className="section-title">Banco de horas por empresa</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Período do ciclo</th>
                  <th>Status</th>
                  <th>Colaboradores</th>
                  <th>BH Acumulado</th>
                  <th>Compensado</th>
                  <th>% Compensado</th>
                  <th>Saldo Pendente</th>
                  <th>Em risco</th>
                  <th>Valor projetado</th>
                </tr>
              </thead>
              <tbody>
                {companyRows.map((row) => (
                  <tr key={row.company.id}>
                    <td>{row.company.short_name}</td>
                    <td className="mono">
                      {row.period.start} a {row.period.end}
                    </td>
                    <td>
                      <Badge label={row.isClosing ? 'Encerrando' : 'Em aberto'} tone={row.isClosing ? 'danger' : 'neutral'} />
                    </td>
                    <td className="mono">{row.collaboratorRows.length}</td>
                    <td className="mono">{minutesToTime(row.accumulatedBhMinutes)}</td>
                    <td className="mono">{minutesToTime(row.compensatedMinutes)}</td>
                    <td className="mono">{(row.compensatedPct * 100).toFixed(0)}%</td>
                    <td className="mono">{minutesToTime(row.pendingBalanceMinutes)}</td>
                    <td className="mono">{row.atRiskCollaborators.length}</td>
                    <td className="mono">{formatBRL((row.pendingBalanceMinutes / 60) * custoHora * (1 + adicionalPct / 100))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 14 }}>
        <h2 className="section-title">Parâmetros de valoração</h2>
        <div className="form-row">
          <div className="field">
            <label>Custo hora base (R$)</label>
            <input type="number" min={0} step="0.01" value={custoHora} onChange={(e) => setCustoHora(Number(e.target.value))} disabled={!canManage} />
          </div>
          <div className="field">
            <label>Adicional de horas extras (%)</label>
            <input type="number" min={0} step="1" value={adicionalPct} onChange={(e) => setAdicionalPct(Number(e.target.value))} disabled={!canManage} />
          </div>
          <div className="field" style={{ alignSelf: 'end' }}>
            <Button onClick={handleSaveParams} disabled={!canManage || saving}>
              {saving ? 'Salvando…' : 'Aplicar e recalcular'}
            </Button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Projeção de pagamento</h2>
        {!projectionRows.length ? (
          <EmptyState message="Nenhum colaborador em risco no momento." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Empresa</th>
                  <th>Colaborador</th>
                  <th>BH acumulado</th>
                  <th>Compensações</th>
                  <th>Saldo pendente</th>
                  <th>Valor estimado</th>
                </tr>
              </thead>
              <tbody>
                {projectionRows.map((row, idx) => (
                  <tr key={idx}>
                    <td>
                      <Badge label={row.status} tone={row.status === 'Obrigação' ? 'danger' : 'warning'} />
                    </td>
                    <td>{row.company}</td>
                    <td>{row.collaborator}</td>
                    <td className="mono">{minutesToTime(row.accumulatedMinutes)}</td>
                    <td className="mono">{minutesToTime(row.compensatedMinutes)}</td>
                    <td className="mono">{minutesToTime(row.pendingMinutes)}</td>
                    <td className="mono">{formatBRL(row.estimatedValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageContent>
  );
}
