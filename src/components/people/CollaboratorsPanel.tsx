import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { StatusBadge, Badge } from '../ui/Badge';
import { getCollaboratorStatus } from '../../utils/compliance';
import { getCompanyConfig, getCurrentCyclePeriod } from '../../utils/cycles';
import { getCollaboratorCycleBalance } from '../../utils/periodBalances';
import { minutesToTime } from '../../utils/time';
import { accessTypeBadgeTone, normalizeMatricula } from '../../lib/permissions';
import type { AccessProfileRow, CollaboratorRow, CompanyCycleRow, CompanyRow, LeaveRow, ManagerRow, TimeRecordRow } from '../../types/database';

interface CollaboratorsPanelProps {
  collaboratorRows: CollaboratorRow[];
  companies: CompanyRow[];
  managers: ManagerRow[];
  cycles: CompanyCycleRow[];
  records: TimeRecordRow[];
  leaves: LeaveRow[];
  accessProfileByRegistration: Map<string, AccessProfileRow>;
  companyFilter: string;
  onCompanyFilterChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  canEditCollab: boolean;
  canManage: boolean;
  canManageProfiles: boolean;
  onNewCollaborator: () => void;
  onViewControl: (collaboratorId: string) => void;
  onEditCollaborator: (collaborator: CollaboratorRow) => void;
  onLeaveCollaborator: (collaborator: CollaboratorRow) => void;
  onDeleteCollaborator: (collaborator: CollaboratorRow) => void;
  onCreateAccessProfile: (collaborator: CollaboratorRow) => void;
}

/**
 * Conteúdo da aba "Colaboradores" em Base de Colaboradores — apenas
 * apresentação; estado, filtros persistidos e regras de acesso continuam
 * vivendo em PeoplePage, que é quem decide o que cada botão faz.
 */
export function CollaboratorsPanel({
  collaboratorRows,
  companies,
  managers,
  cycles,
  records,
  leaves,
  accessProfileByRegistration,
  companyFilter,
  onCompanyFilterChange,
  search,
  onSearchChange,
  canEditCollab,
  canManage,
  canManageProfiles,
  onNewCollaborator,
  onViewControl,
  onEditCollaborator,
  onLeaveCollaborator,
  onDeleteCollaborator,
  onCreateAccessProfile
}: CollaboratorsPanelProps) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          Colaboradores ({collaboratorRows.length})
        </h2>
        {canEditCollab && (
          <Button size="small" onClick={onNewCollaborator}>
            + Novo colaborador
          </Button>
        )}
      </div>

      <div className="filters three" style={{ marginBottom: 12 }}>
        <div className="field">
          <label>Empresa</label>
          <select value={companyFilter} onChange={(e) => onCompanyFilterChange(e.target.value)}>
            <option value="">Todas</option>
            {companies.map((c) => (
              <option key={c.id} value={c.short_name}>
                {c.short_name}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ gridColumn: 'span 2' }}>
          <label>Busca por nome, matrícula, gestor ou e-mail</label>
          <input value={search} onChange={(e) => onSearchChange(e.target.value)} />
        </div>
      </div>

      {!collaboratorRows.length ? (
        <EmptyState message="Nenhum colaborador cadastrado para os filtros selecionados." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Matrícula</th>
                <th>Colaborador</th>
                <th>E-mail</th>
                <th>Cargo</th>
                <th>Gestor vinculado</th>
                <th>Saldo ciclo</th>
                <th>Status</th>
                <th>Acesso</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {collaboratorRows.map((c) => {
                const config = getCompanyConfig(cycles, c.company_id);
                const cycleBalanceMinutes = getCollaboratorCycleBalance(c.id, records, getCurrentCyclePeriod(config));
                const status = getCollaboratorStatus(c, cycleBalanceMinutes, config, leaves);
                const manager = managers.find((m) => m.id === c.manager_id);
                const accessProfile = accessProfileByRegistration.get(normalizeMatricula(c.registration));
                return (
                  <tr key={c.id}>
                    <td>{companies.find((co) => co.id === c.company_id)?.short_name ?? '-'}</td>
                    <td className="mono">{c.registration}</td>
                    <td>{c.name}</td>
                    <td>{c.email || <span className="muted">Sem e-mail</span>}</td>
                    <td>{c.title ?? '-'}</td>
                    <td>{manager?.name ?? c.legacy_manager_name ?? <span className="muted">-</span>}</td>
                    <td className="mono">{minutesToTime(cycleBalanceMinutes)}</td>
                    <td>
                      <StatusBadge status={status} />
                    </td>
                    <td>
                      {accessProfile ? (
                        <Badge label={accessProfile.access_type} tone={accessTypeBadgeTone(accessProfile.access_type)} />
                      ) : (
                        <span className="muted small-text">Sem perfil</span>
                      )}
                    </td>
                    <td className="actions-cell">
                      <Button size="small" variant="secondary" onClick={() => onViewControl(c.id)}>
                        Ver controle
                      </Button>
                      {canEditCollab && (
                        <Button size="small" variant="secondary" onClick={() => onEditCollaborator(c)}>
                          Editar
                        </Button>
                      )}
                      {canManage && (
                        <>
                          <Button size="small" variant="secondary" onClick={() => onLeaveCollaborator(c)}>
                            Folga
                          </Button>
                          <Button size="small" variant="danger" onClick={() => onDeleteCollaborator(c)}>
                            Excluir
                          </Button>
                        </>
                      )}
                      {canManageProfiles && !accessProfile && (
                        <Button size="small" variant="secondary" onClick={() => onCreateAccessProfile(c)}>
                          Criar perfil de acesso
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
