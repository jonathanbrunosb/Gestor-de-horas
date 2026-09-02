import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { formatDateTime } from '../../utils/dates';
import { diffObjects, getAuditActionLabel, getEntityTypeLabel } from '../../utils/audit';
import type { AuditLog } from '../../types/audit';

interface AuditDetailsModalProps {
  log: AuditLog | null;
  onClose: () => void;
}

function JsonBlock({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <p className="small-text muted">Sem valor.</p>;
  return <pre className="audit-json-block">{JSON.stringify(value, null, 2)}</pre>;
}

/** Modal de detalhes de um evento de auditoria: contexto completo, diferenças, JSON bruto, IP e user agent. */
export function AuditDetailsModal({ log, onClose }: AuditDetailsModalProps) {
  const diff = log ? diffObjects(log.old_value, log.new_value) : [];

  return (
    <Modal open={Boolean(log)} title="Detalhes do evento de auditoria" onClose={onClose} wide>
      {log && (
        <div className="audit-details-modal">
          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="field">
              <label>Data/Hora</label>
              <input value={formatDateTime(log.created_at)} disabled />
            </div>
            <div className="field">
              <label>Usuário</label>
              <input value={log.actor_name || log.actor_registration || 'Não identificado'} disabled />
            </div>
            <div className="field">
              <label>Perfil</label>
              <input value={log.actor_role ?? '-'} disabled />
            </div>
            <div className="field">
              <label>Status</label>
              <div style={{ marginTop: 6 }}>
                <Badge label={log.status} tone={log.status === 'success' ? 'success' : log.status === 'warning' ? 'warning' : 'danger'} />
              </div>
            </div>
          </div>

          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="field">
              <label>Ação</label>
              <input value={getAuditActionLabel(log.action)} disabled />
            </div>
            <div className="field">
              <label>Entidade</label>
              <input value={`${getEntityTypeLabel(log.entity_type)}${log.entity_label ? ` — ${log.entity_label}` : ''}`} disabled />
            </div>
            <div className="field">
              <label>Origem</label>
              <input value={log.screen || log.route || '-'} disabled />
            </div>
          </div>

          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="field">
              <label>IP</label>
              <input value={log.ip_address || 'Não capturado'} disabled />
            </div>
            <div className="field" style={{ gridColumn: 'span 3' }}>
              <label>Navegador</label>
              <input value={log.user_agent || 'Não informado'} disabled />
            </div>
          </div>

          {log.error_message && (
            <div className="card" style={{ marginBottom: 14, borderColor: 'var(--danger-mid)' }}>
              <h3 className="section-title" style={{ marginTop: 0, color: 'var(--danger-mid)' }}>
                Erro
              </h3>
              <p className="small-text">{log.error_message}</p>
            </div>
          )}

          {diff.length > 0 && (
            <div className="card" style={{ marginBottom: 14 }}>
              <h3 className="section-title" style={{ marginTop: 0 }}>
                Campos alterados
              </h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Campo</th>
                      <th>Valor anterior</th>
                      <th>Valor novo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diff.map((entry) => (
                      <tr key={entry.field}>
                        <td className="mono">{entry.field}</td>
                        <td className="mono">{JSON.stringify(entry.before) ?? '-'}</td>
                        <td className="mono">{JSON.stringify(entry.after) ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="form-row" style={{ alignItems: 'start' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <h3 className="section-title">Valor anterior (old_value)</h3>
              <JsonBlock value={log.old_value} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <h3 className="section-title">Valor novo (new_value)</h3>
              <JsonBlock value={log.new_value} />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <h3 className="section-title">Metadados</h3>
            <JsonBlock value={log.metadata} />
          </div>
        </div>
      )}
    </Modal>
  );
}
