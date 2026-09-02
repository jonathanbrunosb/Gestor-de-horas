import { useRef, type KeyboardEvent } from 'react';

export interface TabDef<T extends string> {
  id: T;
  label: string;
}

interface TabListProps<T extends string> {
  tabs: TabDef<T>[];
  activeTab: T;
  onChange: (tab: T) => void;
  ariaLabel: string;
  /** Classe do container (role="tablist"). */
  containerClassName: string;
  /** Classe de cada botão de aba — "active" é acrescentada por este componente quando selecionado. */
  buttonClassName: string;
  buttonId: (tab: T) => string;
  panelId: (tab: T) => string;
}

/**
 * Seletor de abas acessível e genérico (role="tablist"/"tab", aria-selected,
 * aria-controls, roving tabindex com Seta/Home/End movendo o foco do DOM
 * junto com a seleção) — usado por PeopleTabs e SettingsTabs para não
 * duplicar essa lógica entre as duas telas. Não guarda estado: quem decide
 * o que renderizar em cada aba é a página dona de `activeTab`.
 */
export function TabList<T extends string>({ tabs, activeTab, onChange, ariaLabel, containerClassName, buttonClassName, buttonId, panelId }: TabListProps<T>) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    onChange(tabs[nextIndex].id);
    buttonRefs.current[nextIndex]?.focus();
  }

  return (
    <div className={containerClassName} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab, index) => {
        const selected = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={buttonId(tab.id)}
            aria-selected={selected}
            aria-controls={panelId(tab.id)}
            tabIndex={selected ? 0 : -1}
            className={`${buttonClassName}${selected ? ' active' : ''}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
