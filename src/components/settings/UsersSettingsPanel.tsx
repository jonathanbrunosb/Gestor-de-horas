import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Badge } from '../ui/Badge';
import { accessTypeBadgeTone, isDeveloperMatricula } from '../../lib/permissions';
import { ACCESS_PROFILE_TYPES } from '../../lib/constants';
import type { AccessContext } from '../../types/domain';
import type { AccessProfileRow } from '../../types/database';

interface UsersSettingsPanelProps {
  accessContext: AccessContext;
  profiles: AccessProfileRow[];
  search: string;
  onSearchChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  canManageProfiles: boolean;
  onNewProfile: () => void;
  onEditProfile: (profile: AccessProfileRow) => void;
  onDeleteProfile: (profile: AccessProfileRow) => void;
}

/**
 * Conteúdo da aba "Usuários" em Configurações — apenas apresentação; estado,
 * filtro persistido e regras de acesso continuam vivendo em SettingsPage,
 * que é quem decide o que cada botão faz.
 */
export function UsersSettingsPanel({
  accessContext,
  profiles,
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  canManageProfiles,
  onNewProfile,
  onEditProfile,
  onDeleteProfile
}: UsersSettingsPanelProps) {
  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <h2 className="section-title">Perfil do usuário</h2>
        <div className="form-row">
          <div className="field">
            <label>Nome</label>
            <input value={accessContext.profile?.name ?? ''} disabled />
          </div>
          <div className="field">
            <label>Matrícula</label>
            <input value={accessContext.matricula} disabled />
          </div>
          <div className="field">
            <label>Área</label>
            <input value={accessContext.profile?.area ?? ''} disabled />
          </div>
          <div className="field">
            <label>Status da matrícula</label>
            <Badge label={accessContext.role} tone={accessTypeBadgeTone(accessContext.profile?.access_type)} />
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Perfis de acesso
          </h2>
          {canManageProfiles && (
            <Button size="small" onClick={onNewProfile}>
              + Cadastrar perfil de acesso
            </Button>
          )}
        </div>

        <div className="filters three" style={{ marginBottom: 12 }}>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>Busca</label>
            <input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Nome, matrícula, e-mail, área ou cargo" />
          </div>
          <div className="field">
            <label>Perfil</label>
            <select value={typeFilter} onChange={(e) => onTypeFilterChange(e.target.value)}>
              <option value="">Todos</option>
              {ACCESS_PROFILE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {!profiles.length ? (
          <EmptyState message="Nenhum perfil de acesso cadastrado." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Matrícula</th>
                  <th>Usuário</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Área</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id}>
                    <td className="mono">{p.registration}</td>
                    <td>{p.name}</td>
                    <td>{p.email || '-'}</td>
                    <td>
                      <Badge label={p.access_type} tone={accessTypeBadgeTone(p.access_type)} />
                    </td>
                    <td>{p.area || '-'}</td>
                    <td>
                      <Badge label={p.status} tone={p.status === 'Ativo' ? 'success' : 'inactive'} />
                    </td>
                    <td className="actions-cell">
                      {canManageProfiles && (
                        <Button size="small" variant="secondary" onClick={() => onEditProfile(p)}>
                          Editar
                        </Button>
                      )}
                      {canManageProfiles && !isDeveloperMatricula(p.registration) && (
                        <Button size="small" variant="danger" onClick={() => onDeleteProfile(p)}>
                          Excluir
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
