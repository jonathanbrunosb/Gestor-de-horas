import { COMPANIES, COMPANY_CODE_MAP, type CompanyShortName } from '../lib/constants';

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Extrai um código de 4 dígitos de empresa de um valor cru vindo de PDF/CSV. */
export function extractCompanyCode(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const direct = raw.match(/^0*\d{1,4}$/);
  if (direct) return raw.padStart(4, '0');
  const employer = raw.match(/(?:EMPREGADOR|EMPRESA|EMPRE)\s*:?\s*(\d{1,4})\b/i);
  if (employer) return employer[1].padStart(4, '0');
  const firstCode = raw.match(/\b(0001|0011|0012|0014|0015|0016|0021|0100)\b/);
  return firstCode ? firstCode[1] : '';
}

export function companyByCode(value: unknown): CompanyShortName | '' {
  const code = extractCompanyCode(value);
  return code ? COMPANY_CODE_MAP[code] ?? '' : '';
}

/** Normaliza qualquer representação (código, nome completo, sigla) para o short_name oficial. */
export function normalizeCompany(value: unknown): CompanyShortName | '' {
  if (value === null || value === undefined) return '';
  const fromCode = companyByCode(value);
  if (fromCode) return fromCode;

  const original = String(value).trim();
  if ((COMPANIES as readonly string[]).includes(original)) return original as CompanyShortName;

  const raw = stripAccents(original.toUpperCase()).replace(/\s+/g, ' ');
  if (!raw) return '';
  if (raw.includes('ALAGOAS') || raw.includes('EQUATORIAL AL') || raw.includes('EQTL AL')) return 'EQTL AL';
  if (raw.includes('EQUATORIAL PA') || raw.includes('EQUATORIAL PARA') || raw.includes('PARA DISTR') || raw.includes('EQTL PA')) return 'EQTL PA';
  if (raw.includes('PIAUI') || raw.includes('PIAU') || raw.includes('EQUATORIAL PI') || raw.includes('EQTL PI')) return 'EQTL PI';
  if (raw.includes('MARANHAO') || raw.includes('EQUATORIAL MA') || raw.includes('MA DISTRIB') || raw.includes('EQTL MA')) return 'EQTL MA';
  if (raw.includes('CEEE')) return 'EQTL CEEE';
  if (raw.includes('CEA') || raw.includes('AMAPA')) return 'EQTL CEA';
  if (raw.includes('GOIAS') || raw.includes('EQUATORIAL GO') || raw.includes('EQTL GO')) return 'EQTL GO';
  if (raw.includes('CSA')) return 'CSA';
  return '';
}

/** Retorna a primeira empresa reconhecível dentre múltiplos valores candidatos. */
export function resolveCompany(...values: unknown[]): CompanyShortName | '' {
  for (const value of values.flat()) {
    const mapped = normalizeCompany(value);
    if (mapped) return mapped;
  }
  return '';
}
