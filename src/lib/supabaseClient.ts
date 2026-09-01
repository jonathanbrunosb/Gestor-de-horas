import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Erro amigável exibido em tela quando o projeto ainda não foi apontado
 * para um Supabase — evita uma tela em branco ou um throw silencioso.
 */
export class SupabaseConfigError extends Error {
  constructor() {
    super(
      'Supabase não está configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY ' +
        'no arquivo .env (veja .env.example) e reinicie a aplicação.'
    );
    this.name = 'SupabaseConfigError';
  }
}

let client: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  });
}

/** Client Supabase. Lança SupabaseConfigError se as variáveis de ambiente não estiverem definidas. */
export function getSupabase(): SupabaseClient {
  if (!client) throw new SupabaseConfigError();
  return client;
}

export const supabase = client;
