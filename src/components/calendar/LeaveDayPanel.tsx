import type { LeaveWithRelations } from '../../types/domain';
import { formatDate } from '../../utils/dates';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';

interface LeaveDayPanelProps {
  date: string;
  leaves: LeaveWithRelations[];
  canManage: boolean;
  onAdd: () => void;
  onEdit: (leave: LeaveWithRelations) => void;
  onDelete: (leave: LeaveWithRelations) => void;
}

export function LeaveDayPanel({ date, leaves, canManage, onAdd, onEdit, onDelete }: LeaveDayPanelProps) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h2 className="section-title" style={{ margin: 0 }}>
            Folgas em {formatDate(date)}
          </h2>
          <p className="section-subtitle" style={{ margin: '2px 0 0' }}>
            {leaves.length} folga(s) programada(s) nesta data.
          </p>
        </div>
        {canManage && (
          <Button size="small" onClick={onAdd}>
            + Nova folga
          </Button>
        )}
      </div>

      {!leaves.length ? (
        <EmptyState message="Nenhuma folga programada para esta data." />
      ) : (
        <div className="list">
          {leaves.map((leave) => (
            <div key={leave.id} className="list-item">
              <div>
                <div className="list-title">{leave.collaborator?.name ?? 'Colaborador'}</div>
                <div className="list-meta">
                  {leave.company?.short_name ?? '-'} · {leave.reason}
                  {leave.notes ? ` · ${leave.notes}` : ''}
                </div>
              </div>
              {canManage && (
                <div className="actions-cell">
                  <Button size="small" variant="secondary" onClick={() => onEdit(leave)}>
                    Editar
                  </Button>
                  <Button size="small" variant="danger" onClick={() => onDelete(leave)}>
                    Excluir
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
