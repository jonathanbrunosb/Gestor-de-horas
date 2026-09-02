import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Badge } from '../ui/Badge';
import type { CollaboratorRow, CompanyRow, ManagerRow } from '../../types/database';

interface ManagersPanelProps {
  managerRows: ManagerRow[];
  companies: CompanyRow[];
  collaborators: CollaboratorRow[];
  companyFilter: string;
  onCompanyFilterChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  canManage: boolean;
  onNewManager: () => void;
  onEditManager: (manager: ManagerRow) => void;
  onDeleteManager: (manager: ManagerRow) => void;
}

/**
 * Conteúdo da aba "Gestores" em Base de Colaboradores — apenas apresentação;
 * estado, filtros persistidos e regras de acesso continuam vivendo em
 * PeoplePage, que é quem decide o que cada botão faz.
 */
export function ManagersPanel({
  managerRows,
  companies,
  collaborators,
  companyFilter,
  onCompanyFilterChange,
  search,
  onSearchChange,
  canManage,
  onNewManager,
  onEditManager,
  onDeleteManager
}: ManagersPanelProps) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          Gestores ({managerRows.length})
        </h2>
        {canManage && (
          <Button size="small" onClick={onNewManager}>
            + Novo gestor
          </Button>
        )}
      </div>

      <div className="filters three" style={{ marginBottom: 12 }}>
        <div className="field">
          <label>Empresa lotação</label>
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
          <label>Busca por nome, matrícula, e-mail ou área</label>
          <input value={search} onChange={(e) => onSearchChange(e.target.value)} />
        </div>
      </div>

      {!managerRows.length ? (
        <EmptyState message="Nenhum gestor cadastrado para os filtros selecionados." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Matrícula</th>
                <th>Gestor</th>
                <th>E-mail</th>
                <th>Área</th>
                <th>Status</th>
                <th>Colaboradores vinculados</th>
                {canManage && <th>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {managerRows.map((m) => (
                <tr key={m.id}>
                  <td>{companies.find((c) => c.id === m.company_id)?.short_name ?? 'Corporativo'}</td>
                  <td className="mono">{m.registration}</td>
                  <td>{m.name}</td>
                  <td>{m.email}</td>
                  <td>{m.area}</td>
                  <td>
                    <Badge label={m.status} tone={m.status === 'Ativo' ? 'success' : 'inactive'} />
                  </td>
                  <td className="mono">{collaborators.filter((c) => c.manager_id === m.id).length}</td>
                  {canManage && (
                    <td className="actions-cell">
                      <Button size="small" variant="secondary" onClick={() => onEditManager(m)}>
                        Editar
                      </Button>
                      <Button size="small" variant="danger" onClick={() => onDeleteManager(m)}>
                        Excluir
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
