import { TabList, type TabDef } from '../ui/Tabs';

export type SettingsTab = 'users' | 'cycles' | 'audit';

const TABS: TabDef<SettingsTab>[] = [
  { id: 'users', label: 'Usuários' },
  { id: 'cycles', label: 'Ciclos' },
  { id: 'audit', label: 'Auditoria' }
];

/** Id do elemento de aba — usado pelos <button role="tab"> e pelos aria-controls/aria-labelledby dos painéis em SettingsPage. */
export function settingsTabButtonId(tab: SettingsTab): string {
  return `settings-tab-${tab}`;
}

/** Id do painel de conteúdo de cada aba — ver settingsTabButtonId. */
export function settingsTabPanelId(tab: SettingsTab): string {
  return `settings-tabpanel-${tab}`;
}

interface SettingsTabsProps {
  activeTab: SettingsTab;
  onChange: (tab: SettingsTab) => void;
}

/**
 * Seletor de aba (Usuários / Ciclos / Auditoria) para a tela Configurações.
 * Não guarda estado — quem decide o que renderizar em cada aba é
 * SettingsPage, que também é dono do valor de activeTab. A navegação por
 * teclado/acessibilidade vive em components/ui/Tabs.tsx, reaproveitada
 * também por PeopleTabs.
 */
export function SettingsTabs({ activeTab, onChange }: SettingsTabsProps) {
  return (
    <TabList
      tabs={TABS}
      activeTab={activeTab}
      onChange={onChange}
      ariaLabel="Configurações do sistema"
      containerClassName="settings-tabs"
      buttonClassName="settings-tab-button"
      buttonId={settingsTabButtonId}
      panelId={settingsTabPanelId}
    />
  );
}
