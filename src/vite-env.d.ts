/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_APP_NAME: string;
  /** Opcional — URL completa da Edge Function log-audit-event, só depois de publicada. Ver README, seção "Trilha de Auditoria". */
  readonly VITE_AUDIT_EDGE_FUNCTION_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
