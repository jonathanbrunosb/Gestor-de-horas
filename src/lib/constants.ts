export const APP_NAME = 'Gestor de Horas';
export const APP_TITLE = 'Gestor de Horas — Equatorial';

export const COMPANIES = ['EQTL AL', 'EQTL PA', 'EQTL PI', 'EQTL MA', 'EQTL CEEE', 'EQTL CEA', 'EQTL GO', 'CSA'] as const;

export type CompanyShortName = (typeof COMPANIES)[number];

/** Código do empregador (campo do cartão-ponto) para nome curto da empresa. */
export const COMPANY_CODE_MAP: Record<string, CompanyShortName> = {
  '0001': 'EQTL MA',
  '0011': 'EQTL PI',
  '0012': 'EQTL AL',
  '0014': 'EQTL CEEE',
  '0015': 'EQTL CEA',
  '0016': 'CSA',
  '0021': 'EQTL GO',
  '0100': 'EQTL PA'
};

export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const DEVELOPER_MATRICULA = 'u1205385';

// Ordem reflete a hierarquia real dos cargos (Gerente acima de Executivo) —
// também é a ordem em que aparecem no seletor de "Tipo de acesso".
export const ACCESS_PROFILE_TYPES = ['Desenvolvedor', 'Administrador', 'Gerente', 'Executivo', 'Facilitador', 'Colaborador', 'Sem acesso'] as const;

export const DEFAULT_POSITIVE_ALERT_MINUTES = 600; // 10:00
export const DEFAULT_NEGATIVE_ALERT_MINUTES = -300; // -05:00

export const SESSION_STORAGE_KEY = 'monitor-controles-horas:session';
export const FILTERS_STORAGE_KEY = 'monitor-controles-horas:filters';
/** Preferência de UI (menu recolhido/expandido no desktop) — nunca dado de negócio. */
export const SIDEBAR_STORAGE_KEY = 'monitor-controles-horas:sidebar-collapsed';
/** Preferência de UI (última aba aberta em Base de Colaboradores) — nunca dado de negócio. */
export const PEOPLE_ACTIVE_TAB_KEY = 'monitor-controles-horas:people-active-tab';

export const NON_WORK_SCHEDULE_CODES = ['9997', '9998', '9999'];

/**
 * Tolerância do ACT: variação de até 15 minutos em CADA marcação, em relação
 * ao horário previsto daquela batida, não gera crédito nem débito. Ex.: com
 * entrada prevista às 08:00, bater até 08:15 conta como 08:00; com saída
 * prevista às 17:30, bater até 17:45 conta como 17:30. Vale igualmente para as
 * marcações de saída e retorno do almoço, e nos dois sentidos (crédito e
 * débito). Passando da tolerância, o horário real é considerado por inteiro —
 * a tolerância é limite, não desconto. Valor único para todo o sistema.
 */
export const PUNCH_TOLERANCE_MINUTES = 15;

/**
 * Horário previsto padrão de uma jornada administrativa (código 1135 dos
 * cartões-ponto do grupo): 08:00–12:00 e 14:00–17:30, jornada de 07:30. É só o
 * valor inicial do formulário de edição — cada registro pode ter o seu.
 */
export const DEFAULT_SCHEDULE_TIMES = ['08:00', '12:00', '14:00', '17:30'];
