export const APP_NAME = 'Monitor de Controles de Horas';
export const APP_TITLE = 'Monitor · Controles de Horas — Equatorial';

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

export const ACCESS_PROFILE_TYPES = ['Desenvolvedor', 'Administrador', 'Gestor', 'Facilitador', 'Sem acesso'] as const;

export const DEFAULT_POSITIVE_ALERT_MINUTES = 600; // 10:00
export const DEFAULT_NEGATIVE_ALERT_MINUTES = -300; // -05:00

export const SESSION_STORAGE_KEY = 'monitor-controles-horas:session';
export const FILTERS_STORAGE_KEY = 'monitor-controles-horas:filters';

export const NON_WORK_SCHEDULE_CODES = ['9997', '9998', '9999'];
