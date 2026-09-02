import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../hooks/AppDataContext';
import { PageContent } from '../components/layout/PageContent';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { CollaboratorForm } from '../components/forms/CollaboratorForm';
import { ManagerForm } from '../components/forms/ManagerForm';
import { LeaveForm } from '../components/forms/LeaveForm';
import { AccessProfileForm } from '../components/forms/AccessProfileForm';
import { PeopleTabs, peopleTabButtonId, peopleTabPanelId, type PeopleTab } from '../components/people/PeopleTabs';
import { CollaboratorsPanel } from '../components/people/CollaboratorsPanel';
import { ManagersPanel } from '../components/people/ManagersPanel';
import { usePersistedFilter } from '../hooks/useFilters';
import { createCollaborator, deleteCollaborator, updateCollaborator, type CollaboratorInput } from '../services/collaboratorsService';
import { createManager, deleteManager, updateManager, countCollaboratorsByManager, type ManagerInput } from '../services/managersService';
import { createLeave, type LeaveInput } from '../services/leavesService';
import { createAccessProfile, type AccessProfileInput } from '../services/accessProfilesService';
import { canManageMasterData, canManageAccessProfiles, canEditCollaborators, normalizeMatricula } from '../lib/permissions';
import { PEOPLE_ACTIVE_TAB_KEY } from '../lib/constants';
import { toISODate } from '../utils/dates';
import type { CollaboratorRow, ManagerRow } from '../types/database';

function readStoredActiveTab(): PeopleTab {
  try {
    const stored = window.localStorage.getItem(PEOPLE_ACTIVE_TAB_KEY);
    return stored === 'managers' ? 'managers' : 'collaborators';
  } catch {
    return 'collaborators';
  }
}

function writeStoredActiveTab(tab: PeopleTab): void {
  try {
    window.localStorage.setItem(PEOPLE_ACTIVE_TAB_KEY, tab);
  } catch {
    /* localStorage indisponível (modo privado, quota) — preferência de UI fica só em memória */
  }
}

export function PeoplePage() {
  const { data, access, toast } = useAppContext();
  const navigate = useNavigate();
  const canManage = canManageMasterData(access.context.profile?.access_type);
  const canEditCollab = canEditCollaborators(access.context.profile?.access_type);
  const canManageProfiles = canManageAccessProfiles(access.context.profile?.access_type);

  // Preferência puramente visual (qual aba estava aberta) — nunca dado de
  // negócio. Trocar de aba não recarrega a página nem afeta os filtros
  // abaixo, que continuam vivendo neste componente independentemente da aba
  // ativa.
  const [activeTab, setActiveTab] = useState<PeopleTab>(readStoredActiveTab);
  useEffect(() => writeStoredActiveTab(activeTab), [activeTab]);

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
      <PeopleTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'collaborators' && (
        <div id={peopleTabPanelId('collaborators')} role="tabpanel" aria-labelledby={peopleTabButtonId('collaborators')} className="people-tab-panel">
          <CollaboratorsPanel
            collaboratorRows={collaboratorRows}
            companies={data.companies}
            managers={data.managers}
            cycles={data.cycles}
            records={data.records}
            leaves={data.leaves}
            accessProfileByRegistration={accessProfileByRegistration}
            companyFilter={companyFilter}
            onCompanyFilterChange={setCompanyFilter}
            search={search}
            onSearchChange={setSearch}
            canEditCollab={canEditCollab}
            canManage={canManage}
            canManageProfiles={canManageProfiles}
            onNewCollaborator={() => {
              setEditingCollaborator(null);
              setCollaboratorModalOpen(true);
            }}
            onViewControl={(collaboratorId) => navigate(`/controle-horas?colaborador=${collaboratorId}`)}
            onEditCollaborator={(c) => {
              setEditingCollaborator(c);
              setCollaboratorModalOpen(true);
            }}
            onLeaveCollaborator={setLeaveModalCollaborator}
            onDeleteCollaborator={setDeletingCollaborator}
            onCreateAccessProfile={setAccessProfileCollaborator}
          />
        </div>
      )}

      {activeTab === 'managers' && (
        <div id={peopleTabPanelId('managers')} role="tabpanel" aria-labelledby={peopleTabButtonId('managers')} className="people-tab-panel">
          <ManagersPanel
            managerRows={managerRows}
            companies={data.companies}
            collaborators={data.collaborators}
            companyFilter={managerCompanyFilter}
            onCompanyFilterChange={setManagerCompanyFilter}
            search={managerSearch}
            onSearchChange={setManagerSearch}
            canManage={canManage}
            onNewManager={() => {
              setEditingManager(null);
              setManagerModalOpen(true);
            }}
            onEditManager={(m) => {
              setEditingManager(m);
              setManagerModalOpen(true);
            }}
            onDeleteManager={openDeleteManager}
          />
        </div>
      )}

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
