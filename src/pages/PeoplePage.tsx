import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../hooks/AppDataContext';
import { PageContent } from '../components/layout/PageContent';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusBadge, Badge } from '../components/ui/Badge';
import { CollaboratorForm } from '../components/forms/CollaboratorForm';
import { ManagerForm } from '../components/forms/ManagerForm';
import { LeaveForm } from '../components/forms/LeaveForm';
import { AccessProfileForm } from '../components/forms/AccessProfileForm';
import { usePersistedFilter } from '../hooks/useFilters';
import { createCollaborator, deleteCollaborator, updateCollaborator, type CollaboratorInput } from '../services/collaboratorsService';
import { createManager, deleteManager, updateManager, countCollaboratorsByManager, type ManagerInput } from '../services/managersService';
import { createLeave, type LeaveInput } from '../services/leavesService';
import { createAccessProfile, type AccessProfileInput } from '../services/accessProfilesService';
import { canManageMasterData, canManageAccessProfiles, canEditCollaborators, normalizeMatricula, accessTypeBadgeTone } from '../lib/permissions';
import { getCollaboratorStatus } from '../utils/compliance';
import { getCompanyConfig, getCurrentCyclePeriod } from '../utils/cycles';
import { getCollaboratorCycleBalance } from '../utils/periodBalances';
import { minutesToTime } from '../utils/time';
import { toISODate } from '../utils/dates';
import type { CollaboratorRow, ManagerRow } from '../types/database';

export function PeoplePage() {
  const { data, access, toast } = useAppContext();
  const navigate = useNavigate();
  const canManage = canManageMasterData(access.context.profile?.access_type);
  const canEditCollab = canEditCollaborators(access.context.profile?.access_type);
  const canManageProfiles = canManageAccessProfiles(access.context.profile?.access_type);

  const [companyFilter, setCompanyFilter] = usePersistedFilter('people.company', '');
  const [search, setSearch] = usePersistedFilter('people.search', '');
  const [managerCompanyFilter, setManagerCompanyFilter] = usePersistedFilter('people.managerCompany', '');
  const [managerSearch, setManagerSearch] = usePersistedFilter('people.managerSearch', '');

  const [collaboratorModalOpen, setCollaboratorModalOpen] = useState(false);
  const [editingCollaborator, setEditingCollaborator] = useState<CollaboratorRow | null>(null);
  const [deletingCollaborator, setDeletingCollaborator] = useState<CollaboratorRow | null>(null);
  const [leaveModalCollaborator, setLeaveModalCollaborator] = useState<CollaboratorRow | null>(null);
  const [accessProfileCollaborator, setAccessProfileCollaborator] = useState<CollaboratorRow | null>(null);

  const [managerModalOpen, setManagerModalOpen] = useState(false);
  const [editingManager, setEditingManager] = useState<ManagerRow | null>(null);
  const [deletingManager, setDeletingManager] = useState<ManagerRow | null>(null);
  const [managerLinkedCount, setManagerLinkedCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const accessProfileByRegistration = useMemo(
    () => new Map(data.accessProfiles.map((p) => [normalizeMatricula(p.registration), p])),
    [data.accessProfiles]
  );

  const collaboratorRows = useMemo(() => {
    return data.collaborators
      .filter((c) => !companyFilter || data.companies.find((co) => co.id === c.company_id)?.short_name === companyFilter)
      .filter((c) => {
        if (!search.trim()) return true;
        const term = search.trim().toLowerCase();
        const manager = data.managers.find((m) => m.id === c.manager_id);
        return c.name.toLowerCase().includes(term) || c.registration.includes(term) || manager?.name.toLowerCase().includes(term) || c.email?.toLowerCase().includes(term);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.collaborators, data.companies, data.managers, companyFilter, search]);

  const managerRows = useMemo(() => {
    return data.managers
      .filter((m) => !managerCompanyFilter || data.companies.find((c) => c.id === m.company_id)?.short_name === managerCompanyFilter)
      .filter((m) => {
        if (!managerSearch.trim()) return true;
        const term = managerSearch.trim().toLowerCase();
        return m.name.toLowerCase().includes(term) || m.registration.includes(term) || m.email.toLowerCase().includes(term) || m.area.toLowerCase().includes(term);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.managers, data.companies, managerCompanyFilter, managerSearch]);

  async function handleCollaboratorSubmit(payload: CollaboratorInput) {
    setSubmitting(true);
    try {
      if (editingCollaborator) {
        await updateCollaborator(editingCollaborator.id, payload, access.context.matricula);
        toast.notify('Colaborador atualizado.', 'success');
      } else {
        await createCollaborator(payload, access.context.matricula);
        toast.notify('Colaborador cadastrado.', 'success');
      }
      setCollaboratorModalOpen(false);
      setEditingCollaborator(null);
      data.reload();
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao salvar colaborador.', 'danger');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteCollaborator() {
    if (!deletingCollaborator) return;
    try {
      await deleteCollaborator(deletingCollaborator.id, access.context.matricula);
      toast.notify('Colaborador excluído. Registros e folgas vinculados foram removidos.', 'success');
      setDeletingCollaborator(null);
      data.reload();
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao excluir colaborador.', 'danger');
    }
  }

  async function handleManagerSubmit(payload: ManagerInput) {
    setSubmitting(true);
    try {
      if (editingManager) {
        await updateManager(editingManager.id, payload, access.context.matricula);
        toast.notify('Gestor atualizado.', 'success');
      } else {
        await createManager(payload, access.context.matricula);
        toast.notify('Gestor cadastrado.', 'success');
      }
      setManagerModalOpen(false);
      setEditingManager(null);
      data.reload();
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao salvar gestor.', 'danger');
    } finally {
      setSubmitting(false);
    }
  }

  async function openDeleteManager(manager: ManagerRow) {
    const count = await countCollaboratorsByManager(manager.id);
    setManagerLinkedCount(count);
    setDeletingManager(manager);
  }

  async function handleDeleteManager() {
    if (!deletingManager) return;
    try {
      await deleteManager(deletingManager.id, access.context.matricula);
      toast.notify('Gestor excluído. Colaboradores vinculados foram desvinculados (nome legado preservado).', 'success');
      setDeletingManager(null);
      data.reload();
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao excluir gestor.', 'danger');
    }
  }

  async function handleCreateAccessProfile(payload: AccessProfileInput) {
    setSubmitting(true);
    try {
      await createAccessProfile(payload, access.context.matricula);
      toast.notify(`Perfil de acesso criado para ${payload.name}.`, 'success');
      setAccessProfileCollaborator(null);
      data.reload();
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao criar perfil de acesso.', 'danger');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLeaveSubmit(payload: LeaveInput) {
    try {
      await createLeave(payload, access.context.matricula);
      toast.notify('Folga cadastrada.', 'success');
      setLeaveModalCollaborator(null);
      data.reload();
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao cadastrar folga.', 'danger');
    }
  }

  return (
    <PageContent title="Base de Colaboradores" description="Cadastro oficial de colaboradores e gestores utilizados no monitoramento de banco de horas.">
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Colaboradores ({collaboratorRows.length})
          </h2>
          {canEditCollab && (
            <Button
              size="small"
              onClick={() => {
                setEditingCollaborator(null);
                setCollaboratorModalOpen(true);
              }}
            >
              + Novo colaborador
            </Button>
          )}
        </div>

        <div className="filters three" style={{ marginBottom: 12 }}>
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
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>Busca por nome, matrícula, gestor ou e-mail</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
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
                  const config = getCompanyConfig(data.cycles, c.company_id);
                  const cycleBalanceMinutes = getCollaboratorCycleBalance(c.id, data.records, getCurrentCyclePeriod(config));
                  const status = getCollaboratorStatus(c, cycleBalanceMinutes, config, data.leaves);
                  const manager = data.managers.find((m) => m.id === c.manager_id);
                  const accessProfile = accessProfileByRegistration.get(normalizeMatricula(c.registration));
                  return (
                    <tr key={c.id}>
                      <td>{data.companies.find((co) => co.id === c.company_id)?.short_name ?? '-'}</td>
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
                        <Button size="small" variant="secondary" onClick={() => navigate(`/controle-horas?colaborador=${c.id}`)}>
                          Ver controle
                        </Button>
                        {canEditCollab && (
                          <Button
                            size="small"
                            variant="secondary"
                            onClick={() => {
                              setEditingCollaborator(c);
                              setCollaboratorModalOpen(true);
                            }}
                          >
                            Editar
                          </Button>
                        )}
                        {canManage && (
                          <>
                            <Button size="small" variant="secondary" onClick={() => setLeaveModalCollaborator(c)}>
                              Folga
                            </Button>
                            <Button size="small" variant="danger" onClick={() => setDeletingCollaborator(c)}>
                              Excluir
                            </Button>
                          </>
                        )}
                        {canManageProfiles && !accessProfile && (
                          <Button size="small" variant="secondary" onClick={() => setAccessProfileCollaborator(c)}>
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

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Gestores ({managerRows.length})
          </h2>
          {canManage && (
            <Button
              size="small"
              onClick={() => {
                setEditingManager(null);
                setManagerModalOpen(true);
              }}
            >
              + Novo gestor
            </Button>
          )}
        </div>

        <div className="filters three" style={{ marginBottom: 12 }}>
          <div className="field">
            <label>Empresa lotação</label>
            <select value={managerCompanyFilter} onChange={(e) => setManagerCompanyFilter(e.target.value)}>
              <option value="">Todas</option>
              {data.companies.map((c) => (
                <option key={c.id} value={c.short_name}>
                  {c.short_name}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>Busca por nome, matrícula, e-mail ou área</label>
            <input value={managerSearch} onChange={(e) => setManagerSearch(e.target.value)} />
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
                    <td>{data.companies.find((c) => c.id === m.company_id)?.short_name ?? 'Corporativo'}</td>
                    <td className="mono">{m.registration}</td>
                    <td>{m.name}</td>
                    <td>{m.email}</td>
                    <td>{m.area}</td>
                    <td>
                      <Badge label={m.status} tone={m.status === 'Ativo' ? 'success' : 'inactive'} />
                    </td>
                    <td className="mono">{data.collaborators.filter((c) => c.manager_id === m.id).length}</td>
                    {canManage && (
                      <td className="actions-cell">
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => {
                            setEditingManager(m);
                            setManagerModalOpen(true);
                          }}
                        >
                          Editar
                        </Button>
                        <Button size="small" variant="danger" onClick={() => openDeleteManager(m)}>
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

      <Modal open={collaboratorModalOpen} title={editingCollaborator ? 'Editar colaborador' : 'Novo colaborador'} onClose={() => setCollaboratorModalOpen(false)} wide>
        <CollaboratorForm
          initial={editingCollaborator}
          companies={data.companies}
          managers={data.managers}
          onSubmit={handleCollaboratorSubmit}
          onCancel={() => setCollaboratorModalOpen(false)}
          submitting={submitting}
        />
      </Modal>

      <Modal open={managerModalOpen} title={editingManager ? 'Editar gestor' : 'Novo gestor'} onClose={() => setManagerModalOpen(false)}>
        <ManagerForm initial={editingManager} companies={data.companies} onSubmit={handleManagerSubmit} onCancel={() => setManagerModalOpen(false)} submitting={submitting} />
      </Modal>

      <Modal
        open={Boolean(accessProfileCollaborator)}
        title={`Criar perfil de acesso — ${accessProfileCollaborator?.name ?? ''}`}
        description="Dados pré-preenchidos a partir do cadastro do colaborador. A matrícula não pode ser alterada aqui. Perfil padrão 'Colaborador': acesso restrito ao próprio Controle de Horas."
        onClose={() => setAccessProfileCollaborator(null)}
      >
        {accessProfileCollaborator && (
          <AccessProfileForm
            initial={{
              name: accessProfileCollaborator.name,
              registration: accessProfileCollaborator.registration,
              email: accessProfileCollaborator.email,
              title: accessProfileCollaborator.title,
              area: accessProfileCollaborator.area,
              access_type: 'Colaborador',
              status: 'Ativo'
            }}
            onSubmit={handleCreateAccessProfile}
            onCancel={() => setAccessProfileCollaborator(null)}
            submitting={submitting}
          />
        )}
      </Modal>

      <Modal open={Boolean(leaveModalCollaborator)} title={`Nova folga — ${leaveModalCollaborator?.name ?? ''}`} onClose={() => setLeaveModalCollaborator(null)}>
        {leaveModalCollaborator && (
          <LeaveForm
            collaborators={[leaveModalCollaborator]}
            defaultDate={toISODate(new Date())}
            onSubmit={handleLeaveSubmit}
            onCancel={() => setLeaveModalCollaborator(null)}
            submitting={false}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingCollaborator)}
        title="Excluir colaborador"
        message="Esta ação remove o colaborador e todos os registros de ponto e folgas vinculados. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        danger
        onConfirm={handleDeleteCollaborator}
        onCancel={() => setDeletingCollaborator(null)}
      />

      <ConfirmDialog
        open={Boolean(deletingManager)}
        title="Excluir gestor"
        message={
          managerLinkedCount > 0
            ? `Este gestor possui ${managerLinkedCount} colaborador(es) vinculado(s). Eles serão desvinculados (o nome do gestor é preservado apenas como referência legada) — o gestor não é recriado automaticamente.`
            : 'Esta ação remove permanentemente o gestor selecionado.'
        }
        confirmLabel="Excluir gestor"
        danger
        onConfirm={handleDeleteManager}
        onCancel={() => setDeletingManager(null)}
      />
    </PageContent>
  );
}
