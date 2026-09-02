import type { CollaboratorRow } from '../../types/database';
import type { LeaveWithRelations } from '../../types/domain';
import type { LeaveInput } from '../../services/leavesService';
import { formatDate } from '../../utils/dates';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { LeaveForm } from '../forms/LeaveForm';

interface LeaveDayPanelProps {
  date: string;
  leaves: LeaveWithRelations[];
  collaborators: CollaboratorRow[];
  canManage: boolean;
  onEdit: (leave: LeaveWithRelations) => void;
  onDelete: (leave: LeaveWithRelations) => void;
  onCreate: (payload: LeaveInput) => void;
  /** Muda a cada folga criada com sucesso — remonta o formulário abaixo para limpar os campos. */
  createFormKey: number;
}

export function LeaveDayPanel({ date, leaves, collaborators, canManage, onEdit, onDelete, onCreate, createFormKey }: LeaveDayPanelProps) {
  return (
    <div className="card">
      <h2 className="section-title" style={{ margin: 0 }}>
        Folgas do dia
      </h2>
      <p className="section-subtitle" style={{ margin: '2px 0 12px' }}>
        Data selecionada: <strong>{formatDate(date)}</strong>
      </p>

      {!leaves.length ? (
        <EmptyState message="Nenhuma folga programada nesta data." />
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

      {canManage && (
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 16 }}>
          <h2 className="section-title" style={{ margin: '0 0 12px' }}>
            Registrar nova folga
          </h2>
          <LeaveForm key={createFormKey} collaborators={collaborators} defaultDate={date} onSubmit={onCreate} submitting={false} />
        </div>
      )}
    </div>
  );
}
