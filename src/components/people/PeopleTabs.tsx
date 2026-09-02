import { useRef, type KeyboardEvent } from 'react';

export type PeopleTab = 'collaborators' | 'managers';

interface PeopleTabsProps {
  activeTab: PeopleTab;
  onChange: (tab: PeopleTab) => void;
}

const TABS: Array<{ id: PeopleTab; label: string }> = [
  { id: 'collaborators', label: 'Colaboradores' },
  { id: 'managers', label: 'Gestores' }
];

/** Id do elemento de abas — usado pelos <button role="tab"> e pelos aria-controls/aria-labelledby dos painéis em PeoplePage. */
export function peopleTabButtonId(tab: PeopleTab): string {
  return `people-tab-${tab}`;
}

/** Id do painel de conteúdo de cada aba — ver peopleTabButtonId. */
export function peopleTabPanelId(tab: PeopleTab): string {
  return `people-tabpanel-${tab}`;
}

/**
 * Seletor de aba puramente de apresentação (Colaboradores / Gestores) para a
 * tela Base de Colaboradores. Não guarda estado — quem decide o que renderizar
 * em cada aba é PeoplePage, que também é dono do valor de activeTab.
 */
export function PeopleTabs({ activeTab, onChange }: PeopleTabsProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Padrão de "roving tabindex" do WAI-ARIA: a navegação por seta precisa
  // mover o foco do DOM para a aba selecionada, não só o estado — do
  // contrário Tab (fora do grupo) levaria para uma aba que não é mais a
  // realçada visualmente.
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = TABS.length - 1;
    onChange(TABS[nextIndex].id);
    buttonRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="people-tabs" role="tablist" aria-label="Base de Colaboradores">
      {TABS.map((tab, index) => {
        const selected = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={peopleTabButtonId(tab.id)}
            aria-selected={selected}
            aria-controls={peopleTabPanelId(tab.id)}
            tabIndex={selected ? 0 : -1}
            className={`people-tab-button${selected ? ' active' : ''}`}
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
