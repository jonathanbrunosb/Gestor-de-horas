import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../hooks/AppDataContext';
import { PageContent } from '../components/layout/PageContent';
import { DataTable, type DataTableColumn } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { usePersistedFilter } from '../hooks/useFilters';
import { minutesToTime } from '../utils/time';
import { getCollaboratorStatus } from '../utils/compliance';
import { getCompanyConfig, getCurrentCyclePeriod } from '../utils/cycles';
import { getCollaboratorCycleBalance } from '../utils/periodBalances';
import type { CollaboratorRow } from '../types/database';

interface SummaryRow extends Omit<CollaboratorRow, 'status'> {
  companyName: string;
  cycleBalanceMinutes: number;
  computedStatus: ReturnType<typeof getCollaboratorStatus>;
}

export function SummaryPage() {
  const { data } = useAppContext();
  const navigate = useNavigate();
  const [companyFilter, setCompanyFilter] = usePersistedFilter('summary.company', '');
  const [search, setSearch] = usePersistedFilter('summary.search', '');
  const [statusFilter, setStatusFilter] = usePersistedFilter('summary.status', '');

  const rows: SummaryRow[] = useMemo(() => {
    return data.collaborators
      .map((c) => {
        const company = data.companies.find((co) => co.id === c.company_id);
        const config = getCompanyConfig(data.cycles, c.company_id);
        const cycleBalanceMinutes = getCollaboratorCycleBalance(c.id, data.records, getCurrentCyclePeriod(config));
        return {
          ...c,
          companyName: company?.short_name ?? '-',
          cycleBalanceMinutes,
          computedStatus: getCollaboratorStatus(c, cycleBalanceMinutes, config, data.leaves)
        };
      })
      .filter((c) => !companyFilter || c.companyName === companyFilter)
      .filter((c) => !statusFilter || c.computedStatus === statusFilter)
      .filter((c) => {
        if (!search.trim()) return true;
        const term = search.trim().toLowerCase();
        return c.name.toLowerCase().includes(term) || c.registration.includes(term);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.collaborators, data.companies, data.cycles, data.leaves, data.records, companyFilter, statusFilter, search]);

  const columns: Array<DataTableColumn<SummaryRow>> = [
    { key: 'company', header: 'Empresa', render: (r) => r.companyName },
    { key: 'registration', header: 'Matrícula', render: (r) => <span className="mono">{r.registration}</span> },
    { key: 'name', header: 'Colaborador', render: (r) => r.name },
    { key: 'title', header: 'Cargo', render: (r) => r.title ?? '-' },
    { key: 'previous', header: 'Saldo mês ant.', render: (r) => <span className="mono">{minutesToTime(r.previous_month_balance_minutes)}</span>, align: 'right' },
    { key: 'credit', header: 'Crédito mês', render: (r) => <span className="mono">{minutesToTime(r.month_credit_minutes)}</span>, align: 'right' },
    { key: 'debit', header: 'Débito mês', render: (r) => <span className="mono">{minutesToTime(r.month_debit_minutes)}</span>, align: 'right' },
    { key: 'monthBalance', header: 'Saldo mês', render: (r) => <span className="mono">{minutesToTime(r.month_balance_minutes)}</span>, align: 'right' },
    { key: 'cycleBalance', header: 'Saldo ciclo', render: (r) => <span className="mono">{minutesToTime(r.cycleBalanceMinutes)}</span>, align: 'right' },
    { key: 'extra50', header: 'Extra 50%', render: (r) => <span className="mono">{minutesToTime(r.extra_50_minutes)}</span>, align: 'right' },
    { key: 'extra100', header: 'Extra 100%', render: (r) => <span className="mono">{minutesToTime(r.extra_100_minutes)}</span>, align: 'right' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.computedStatus} /> },
    {
      key: 'actions',
      header: 'Ação',
      render: (r) => (
        <Button size="small" variant="secondary" onClick={() => navigate(`/controle-horas?colaborador=${r.id}`)}>
          Abrir detalhe
        </Button>
      )
    }
  ];

  return (
    <PageContent title="Resumo por Colaborador" description="Visão analítica dos saldos de banco de horas por colaborador, com filtros por empresa, mês e status.">
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="filters four">
          <div className="field">
            <label>Empresa</label>
            <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
              <option value="">Todas</option>
              {data.companies.map((c) => (
                <option key={c.id} value={c.short_name}>
                  {c.short_name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Todos</option>
              {['Regular', 'Atenção', 'Crítico', 'Folga programada', 'Inativo'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>Busca por nome ou matrícula</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Digite para buscar…" />
          </div>
        </div>
      </div>

      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyMessage="Nenhum colaborador encontrado para os filtros selecionados." />
    </PageContent>
  );
}
