import { useEffect, useMemo, useState } from 'react';
import { MetricCard } from '../ui/MetricCard';
import { EmptyState } from '../ui/EmptyState';
import { AuditFiltersBar } from '../audit/AuditFilters';
import { AuditTable } from '../audit/AuditTable';
import { AuditDetailsModal } from '../audit/AuditDetailsModal';
import { listAuditLogs } from '../../services/auditLogService';
import type { AuditFilters, AuditLog } from '../../types/audit';

const SEARCH_DEBOUNCE_MS = 400;

interface AuditSettingsPanelProps {
  canView: boolean;
}

/**
 * Conteúdo da aba "Auditoria" em Configurações. Só busca a trilha de
 * auditoria quando `canView` é true — SettingsPage garante que esta aba só
 * fica montada quando o usuário está na aba Auditoria, então não há
 * requisição de logs enquanto essa aba não está aberta nem para quem não
 * tem permissão de vê-la.
 */
export function AuditSettingsPanel({ canView }: AuditSettingsPanelProps) {
  const [filters, setFilters] = useState<AuditFilters>({});
  const [debouncedFilters, setDebouncedFilters] = useState<AuditFilters>({});
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Busca livre não dispara uma consulta por tecla digitada — só depois de
  // uma pequena pausa. Os demais filtros (datas/selects) mudam em blocos,
  // não por tecla, então não precisam desse atraso.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedFilters(filters), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [filters]);

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listAuditLogs(debouncedFilters)
      .then((data) => {
        if (!cancelled) setLogs(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Falha ao carregar a trilha de auditoria.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedFilters, canView]);

  const kpis = useMemo(() => {
    const totalEvents = logs.length;
    const accessEvents = logs.filter((l) => l.action.startsWith('access.')).length;
    const registrationChanges = logs.filter((l) => {
      const [namespace, verb] = l.action.split('.');
      return ['profile', 'cycle', 'collaborator', 'manager'].includes(namespace) && ['create', 'update', 'delete'].includes(verb ?? '');
    }).length;
    const alertEvents = logs.filter((l) => l.status !== 'success').length;
    return { totalEvents, accessEvents, registrationChanges, alertEvents };
  }, [logs]);

  if (!canView) {
    return <EmptyState message="Você não possui permissão para visualizar a trilha de auditoria." />;
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <h2 className="section-title" style={{ marginBottom: 2 }}>
          Trilha de Auditoria
        </h2>
        <p className="section-subtitle">Consulta dos acessos, alterações cadastrais, movimentações e eventos relevantes registrados pelo sistema.</p>

        <div className="grid cards-4" style={{ marginBottom: 14 }}>
          <MetricCard title="Total de eventos no período" value={String(kpis.totalEvents)} tone="neutral" />
          <MetricCard title="Eventos de acesso" value={String(kpis.accessEvents)} tone="info" />
          <MetricCard title="Alterações cadastrais" value={String(kpis.registrationChanges)} tone="success" />
          <MetricCard title="Eventos com erro/alerta" value={String(kpis.alertEvents)} tone="danger" />
        </div>

        <AuditFiltersBar value={filters} onChange={setFilters} onClear={() => setFilters({})} />
      </div>

      <div className="card">
        {loading ? (
          <p className="small-text">Carregando eventos de auditoria…</p>
        ) : error ? (
          <p className="small-text" style={{ color: 'var(--danger-mid)' }}>
            {error}
          </p>
        ) : (
          <AuditTable logs={logs} onViewDetails={setSelectedLog} />
        )}
      </div>

      <AuditDetailsModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </>
  );
}
