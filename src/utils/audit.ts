import { MENU_GROUPS, SELF_SERVICE_MENU_ITEM } from '../lib/menu';
import type { AuditAction, AuditDiff, AuditEntityType } from '../types/audit';

/**
 * Nome amigável da tela atual, a partir da rota — reaproveita a fonte única
 * de rótulos do menu lateral (lib/menu.tsx) em vez de manter uma segunda
 * lista de nomes de tela. Usado para preencher a coluna "Origem" da trilha
 * de auditoria automaticamente, sem que cada chamada precise informar a
 * tela manualmente.
 */
export function getCurrentRouteLabel(): string {
  if (typeof window === 'undefined') return '';
  const pathname = window.location.pathname;
  for (const group of MENU_GROUPS) {
    const item = group.items.find((i) => pathname === i.route || pathname.startsWith(`${i.route}/`));
    if (item) return item.label;
  }
  if (pathname === SELF_SERVICE_MENU_ITEM.route) return SELF_SERVICE_MENU_ITEM.label;
  if (pathname === '/configuracoes') return 'Configurações';
  if (pathname === '/login') return 'Login';
  if (pathname === '/acesso-negado') return 'Acesso negado';
  return pathname || '/';
}

const ACTION_LABELS: Partial<Record<AuditAction, string>> = {
  'access.login_success': 'Acesso liberado',
  'access.login_denied': 'Acesso negado',
  'access.logout': 'Saída (logout)',
  'profile.create': 'Perfil de acesso criado',
  'profile.update': 'Perfil de acesso editado',
  'profile.delete': 'Perfil de acesso excluído',
  'cycle.create': 'Ciclo criado',
  'cycle.update': 'Ciclo editado',
  'cycle.delete': 'Ciclo excluído',
  'cycle.restore_defaults': 'Ciclos padrão restaurados',
  'collaborator.create': 'Colaborador cadastrado',
  'collaborator.update': 'Colaborador editado',
  'collaborator.delete': 'Colaborador excluído',
  'manager.create': 'Gestor cadastrado',
  'manager.update': 'Gestor editado',
  'manager.delete': 'Gestor excluído',
  'record.create': 'Registro de ponto criado',
  'record.update': 'Registro de ponto editado',
  'record.delete': 'Registro de ponto excluído',
  'record.bulk_delete': 'Registros de ponto excluídos em lote',
  'leave.create': 'Folga cadastrada',
  'leave.update': 'Folga editada',
  'leave.delete': 'Folga excluída',
  'import.confirm': 'Importação confirmada',
  'import.clear_data': 'Base importada limpa',
  'notification.mailto_generated': 'E-mail de alerta gerado',
  'settings.update': 'Parâmetro de configuração alterado',
  'export.json': 'Exportação JSON',
  'export.csv': 'Exportação CSV',
  'system.reset_database': 'Base reiniciada',
  'system.error': 'Erro do sistema'
};

const ENTITY_TYPE_LABELS: Partial<Record<AuditEntityType, string>> = {
  access_profile: 'Perfil de acesso',
  company_cycle: 'Ciclo',
  collaborator: 'Colaborador',
  manager: 'Gestor',
  time_record: 'Registro de ponto',
  leave: 'Folga',
  import: 'Importação',
  database: 'Base de dados',
  notification: 'Notificação',
  app_setting: 'Configuração',
  system: 'Sistema'
};

/**
 * Traduz uma ação de auditoria para um rótulo em português. Ações fora da
 * lista conhecida (evento legado ou string livre) recebem um rótulo
 * derivado da própria string, em vez de aparecer crua na tela.
 */
export function getAuditActionLabel(action: string): string {
  const known = ACTION_LABELS[action as AuditAction];
  if (known) return known;
  const [namespace, verb] = action.split('.');
  const words = (verb ?? namespace ?? action).replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Traduz um entity_type para um rótulo em português, com o mesmo fallback de getAuditActionLabel. */
export function getEntityTypeLabel(entityType: string | null | undefined): string {
  if (!entityType) return '-';
  const known = ENTITY_TYPE_LABELS[entityType as AuditEntityType];
  if (known) return known;
  const words = entityType.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const SENSITIVE_KEY_PATTERN = /senha|password|token|secret|service[_-]?role|api[_-]?key|anon[_-]?key|authorization|credential/i;
const SANITIZE_MASK = '[oculto]';
const MAX_SANITIZE_DEPTH = 6;

/**
 * Remove/mascara campos sensíveis (senha, token, chave, secret) de um valor
 * antes de gravar em old_value/new_value/metadata da auditoria — aplicado
 * automaticamente pelo serviço de auditoria a toda gravação, então nenhum
 * chamador precisa lembrar de sanitizar manualmente (seção 13/21 do
 * escopo). Não registra o texto de arquivos importados por inteiro — os
 * chamadores de auditoria de importação já passam apenas metadados/contagens,
 * nunca o arquivo bruto.
 */
export function sanitizeAuditValue(value: unknown, seen: WeakSet<object> = new WeakSet(), depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth >= MAX_SANITIZE_DEPTH) return '[profundidade máxima excedida]';
  if (Array.isArray(value)) return value.map((item) => sanitizeAuditValue(item, seen, depth + 1));
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if (seen.has(value as object)) return '[referência circular]';
    seen.add(value as object);
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key) ? SANITIZE_MASK : sanitizeAuditValue(val, seen, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Diferença rasa entre dois objetos (mesmo nível) — usada pelo modal de
 * detalhes da auditoria para destacar os campos que mudaram, em vez de só
 * jogar dois blocos de JSON lado a lado. Só compara chaves presentes em pelo
 * menos um dos dois lados; valores são comparados por JSON.stringify (é
 * suficiente para os payloads planos que este sistema audita).
 */
export function diffObjects(oldValue: unknown, newValue: unknown): AuditDiff {
  const oldObj = oldValue && typeof oldValue === 'object' && !Array.isArray(oldValue) ? (oldValue as Record<string, unknown>) : null;
  const newObj = newValue && typeof newValue === 'object' && !Array.isArray(newValue) ? (newValue as Record<string, unknown>) : null;
  if (!oldObj && !newObj) return [];

  const keys = new Set([...Object.keys(oldObj ?? {}), ...Object.keys(newObj ?? {})]);
  const diff: AuditDiff = [];
  for (const field of keys) {
    const before = oldObj ? oldObj[field] : undefined;
    const after = newObj ? newObj[field] : undefined;
    if (JSON.stringify(before) !== JSON.stringify(after)) diff.push({ field, before, after });
  }
  return diff.sort((a, b) => a.field.localeCompare(b.field));
}
