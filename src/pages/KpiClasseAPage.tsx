import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../hooks/AppDataContext';
import { PageContent } from '../components/layout/PageContent';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { Pagination } from '../components/ui/Pagination';
import { SimpleBarChart } from '../components/kpi/SimpleBarChart';
import { usePersistedFilter } from '../hooks/useFilters';
import { formatDate } from '../utils/dates';
import {
  computeKpiClasseAStats,
  getAvailableKpiYears,
  getCurrentQuarter,
  QUARTER_LABELS,
  KPI_OCCURRENCE_LABELS,
  type Quarter
} from '../services/kpiClasseAService';

const QUARTERS: Quarter[] = [1, 2, 3, 4];
const PAGE_SIZE = 15;

export function KpiClasseAPage() {
  const { data } = useAppContext();

  const availableYears = useMemo(() => getAvailableKpiYears(data.records), [data.records]);
  const [yearFilter, setYearFilter] = usePersistedFilter('kpiClasseA.year', String(new Date().getFullYear()));
  const [quarterFilter, setQuarterFilter] = usePersistedFilter('kpiClasseA.quarter', String(getCurrentQuarter()));
  const year = availableYears.includes(Number(yearFilter)) ? Number(yearFilter) : availableYears[0];
  const quarter = (QUARTERS.includes(Number(quarterFilter) as Quarter) ? Number(quarterFilter) : getCurrentQuarter()) as Quarter;

  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [year, quarter]);

  const stats = useMemo(
    () =>
      computeKpiClasseAStats({
        collaborators: data.collaborators,
        companies: data.companies,
        managers: data.managers,
        records: data.records,
        leaves: data.leaves,
        year,
        quarter
      }),
    [data.collaborators, data.companies, data.managers, data.records, data.leaves, year, quarter]
  );

  const pagedOccurrences = stats.occurrences.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <PageContent
      title="KPIs - Classe A"
      description="Acompanhamento gerencial trimestral de ocorrências de jornada — banco de horas, interjornada, intrajornada e batidas incompletas."
      actions={
        <>
          <div className="filter-inline">
            <label>Ano</label>
            <select value={String(year)} onChange={(e) => setYearFilter(e.target.value)}>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-inline quarter-filter">
            <label>Trimestre</label>
            <div className="quarter-filter-buttons">
              {QUARTERS.map((q) => (
                <Button key={q} size="small" variant={q === quarter ? 'primary' : 'secondary'} onClick={() => setQuarterFilter(String(q))}>
                  {QUARTER_LABELS[q]}
                </Button>
              ))}
            </div>
          </div>
        </>
      }
    >
      <div className="grid charts-split" style={{ marginBottom: 14 }}>
        <SimpleBarChart title="Total Ocorrências" legendLabel={String(year)} orientation="vertical" data={stats.byMonth} />
        <SimpleBarChart title="Total Ocorrências" legendLabel={String(year)} orientation="horizontal" data={stats.byType} />
      </div>

      <div className="card">
        <h2 className="section-title">Ocorrências do trimestre</h2>
        <p className="section-subtitle">
          {QUARTER_LABELS[quarter]}/{year} · {stats.occurrences.length} ocorrência(s)
        </p>

        {!stats.occurrences.length ? (
          <EmptyState message="Nenhuma ocorrência identificada para o trimestre selecionado." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Área</th>
                  <th>Ocorrência</th>
                  <th>Data</th>
                  <th>Marcação</th>
                </tr>
              </thead>
              <tbody>
                {pagedOccurrences.map((occ, i) => (
                  <tr key={`${occ.collaborator.id}-${occ.type}-${occ.date}-${i}`}>
                    <td>{occ.collaborator.name}</td>
                    <td>{occ.collaborator.area || '-'}</td>
                    <td>{KPI_OCCURRENCE_LABELS[occ.type]}</td>
                    <td className="mono">{formatDate(occ.date)}</td>
                    <td className="mono">{occ.punches.length ? occ.punches.join(' ') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} totalItems={stats.occurrences.length} onPageChange={setPage} />
      </div>
    </PageContent>
  );
}
