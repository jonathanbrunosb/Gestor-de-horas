import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { formatDateTime } from '../../utils/dates';
import { getAuditActionLabel, getEntityTypeLabel } from '../../utils/audit';
import type { BadgeTone } from '../../types/domain';
import type { AuditLog } from '../../types/audit';

const STATUS_TONE: Record<string, BadgeTone> = {
  success: 'success',
  warning: 'warning',
  error: 'danger'
};

const STATUS_LABEL: Record<string, string> = {
  success: 'Sucesso',
  warning: 'Alerta',
  error: 'Erro'
};

interface AuditTableProps {
  logs: AuditLog[];
  onViewDetails: (log: AuditLog) => void;
}

/** Tabela da trilha de auditoria — Data/Hora, Usuário, Perfil, Ação, Entidade, Origem, IP, Status, Detalhes. */
export function AuditTable({ logs, onViewDetails }: AuditTableProps) {
  if (!logs.length) {
    return <EmptyState message="Nenhum evento de auditoria localizado para os filtros aplicados." />;
  }

  return (
    <div className="table-wrap">
      <table className="audit-table">
        <thead>
          <tr>
            <th>Data/Hora</th>
            <th>Usuário</th>
            <th>Perfil</th>
            <th>Ação</th>
            <th>Entidade</th>
            <th>Origem</th>
            <th>IP</th>
            <th>Status</th>
            <th>Detalhes</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="mono">{formatDateTime(log.created_at)}</td>
              <td>{log.actor_name || log.actor_registration || <span className="muted">Não identificado</span>}</td>
              <td>{log.actor_role ? <Badge label={log.actor_role} tone="neutral" /> : <span className="muted">-</span>}</td>
              <td>{getAuditActionLabel(log.action)}</td>
              <td>
                {getEntityTypeLabel(log.entity_type)}
                {log.entity_label ? <span className="muted"> · {log.entity_label}</span> : null}
              </td>
              <td>{log.screen || log.route || <span className="muted">-</span>}</td>
              <td className="mono">{log.ip_address || <span className="muted">Não capturado</span>}</td>
              <td>
                <Badge label={STATUS_LABEL[log.status] ?? log.status} tone={STATUS_TONE[log.status] ?? 'neutral'} />
              </td>
              <td>
                <Button size="small" variant="secondary" onClick={() => onViewDetails(log)}>
                  Ver detalhes
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
