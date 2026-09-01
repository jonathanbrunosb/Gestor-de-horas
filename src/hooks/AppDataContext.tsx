import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAppData } from './useAppData';
import { useAccessProfile } from './useAccessProfile';
import { useToast } from './useToast';
import { isTeamScopedAccess } from '../lib/permissions';
import { scopeDataToTeam } from '../utils/teamScope';

type AppDataValue = ReturnType<typeof useAppData>;
type AccessValue = ReturnType<typeof useAccessProfile>;
type ToastValue = ReturnType<typeof useToast>;

interface AppContextValue {
  data: AppDataValue;
  access: AccessValue;
  toast: ToastValue;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const rawData = useAppData();
  const access = useAccessProfile(rawData.accessProfiles, rawData.loading);
  const toast = useToast();

  // Perfil "Executivo": recorta colaboradores/registros/folgas para o time do
  // gestor logado, num único lugar — toda página que lê `data` do contexto
  // (Dashboard, Resumo, Controle de Horas, Calendário, Base de Colaboradores,
  // Gestão BH) já recebe a base recortada, sem precisar de ajuste individual.
  const data = useMemo<AppDataValue>(() => {
    if (!isTeamScopedAccess(access.context.profile?.access_type)) return rawData;
    const scoped = scopeDataToTeam(rawData.collaborators, rawData.records, rawData.leaves, rawData.managers, access.context.matricula);
    return { ...rawData, ...scoped };
  }, [rawData, access.context.profile?.access_type, access.context.matricula]);

  return <AppContext.Provider value={{ data, access, toast }}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext deve ser usado dentro de <AppDataProvider>.');
  return ctx;
}
