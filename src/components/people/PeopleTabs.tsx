import { TabList, type TabDef } from '../ui/Tabs';

export type PeopleTab = 'collaborators' | 'managers';

const TABS: TabDef<PeopleTab>[] = [
  { id: 'collaborators', label: 'Colaboradores' },
  { id: 'managers', label: 'Gestores' }
];

/** Id do elemento de aba — usado pelos <button role="tab"> e pelos aria-controls/aria-labelledby dos painéis em PeoplePage. */
export function peopleTabButtonId(tab: PeopleTab): string {
  return `people-tab-${tab}`;
}

/** Id do painel de conteúdo de cada aba — ver peopleTabButtonId. */
export function peopleTabPanelId(tab: PeopleTab): string {
  return `people-tabpanel-${tab}`;
}

interface PeopleTabsProps {
  activeTab: PeopleTab;
  onChange: (tab: PeopleTab) => void;
}

/**
 * Seletor de aba (Colaboradores / Gestores) para a tela Base de
 * Colaboradores. Não guarda estado — quem decide o que renderizar em cada
 * aba é PeoplePage, que também é dono do valor de activeTab. A navegação
 * por teclado/acessibilidade vive em components/ui/Tabs.tsx, reaproveitada
 * também por SettingsTabs.
 */
export function PeopleTabs({ activeTab, onChange }: PeopleTabsProps) {
  return (
    <TabList
      tabs={TABS}
      activeTab={activeTab}
      onChange={onChange}
      ariaLabel="Base de Colaboradores"
      containerClassName="people-tabs"
      buttonClassName="people-tab-button"
      buttonId={peopleTabButtonId}
      panelId={peopleTabPanelId}
    />
  );
}
