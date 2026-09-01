import type { AppData } from '../hooks/useAppData';

/**
 * Cache local (stale-while-revalidate) do snapshot de dados do Supabase.
 *
 * Sem isso, toda vez que a página é recarregada (F5) ou aberta numa nova
 * aba/janela, a aplicação inteira fica atrás de uma tela "Carregando dados…"
 * até as ~8 tabelas responderem — mesmo que os dados não tenham mudado desde
 * a última visita. Com o cache, o app renderiza instantaneamente com o
 * último snapshot salvo (levemente desatualizado) enquanto busca dados
 * novos em segundo plano, substituindo a tela sem nenhuma piscada perceptível
 * quando a resposta chega. Só o primeiro carregamento de todos (sem nada
 * salvo ainda) continua mostrando a tela de carregamento.
 *
 * Sobe a versão em CACHE_KEY sempre que o formato de AppData mudar de forma
 * incompatível, para não tentar reidratar um snapshot com um shape antigo.
 */
const CACHE_KEY = 'monitor-horas-cache-v1';

interface CacheEnvelope {
  savedAt: string;
  data: AppData;
}

export function readCache(): AppData | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope;
    if (!parsed || typeof parsed !== 'object' || !parsed.data) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeCache(data: AppData): void {
  try {
    const envelope: CacheEnvelope = { savedAt: new Date().toISOString(), data };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(envelope));
  } catch {
    // Cota de localStorage estourada ou indisponível (modo privado etc.) —
    // degrada silenciosamente para o comportamento sem cache, sem quebrar o app.
  }
}

export function clearCache(): void {
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}
