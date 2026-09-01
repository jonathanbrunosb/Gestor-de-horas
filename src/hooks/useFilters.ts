import { useCallback, useEffect, useState } from 'react';
import { FILTERS_STORAGE_KEY } from '../lib/constants';

type FiltersMap = Record<string, string>;

function readStoredFilters(): FiltersMap {
  try {
    const raw = window.localStorage.getItem(FILTERS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FiltersMap) : {};
  } catch {
    return {};
  }
}

function writeStoredFilters(filters: FiltersMap): void {
  try {
    window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    /* localStorage indisponível — filtros ficam só em memória para a sessão atual */
  }
}

/**
 * Cache de filtros de UI em localStorage — nunca dados de negócio, apenas
 * preferências de tela (seção 10 do escopo: localStorage só para sessão/filtros).
 */
export function usePersistedFilter(key: string, defaultValue: string): [string, (value: string) => void] {
  const [value, setValue] = useState<string>(() => {
    const stored = readStoredFilters();
    return stored[key] ?? defaultValue;
  });

  useEffect(() => {
    const stored = readStoredFilters();
    stored[key] = value;
    writeStoredFilters(stored);
  }, [key, value]);

  const update = useCallback((next: string) => setValue(next), []);
  return [value, update];
}
