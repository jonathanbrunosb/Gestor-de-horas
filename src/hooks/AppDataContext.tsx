import { createContext, useContext, type ReactNode } from 'react';
import { useAppData } from './useAppData';
import { useAccessProfile } from './useAccessProfile';
import { useToast } from './useToast';

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
  const data = useAppData();
  const access = useAccessProfile(data.accessProfiles, data.loading);
  const toast = useToast();

  return <AppContext.Provider value={{ data, access, toast }}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext deve ser usado dentro de <AppDataProvider>.');
  return ctx;
}
