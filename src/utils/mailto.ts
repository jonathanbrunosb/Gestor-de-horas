import type { CollaboratorWithRelations } from '../types/domain';

export type MailtoAlertType =
  | 'Alerta de ciclo'
  | 'Alerta de interjornada'
  | 'Alerta de intrajornada'
  | 'Alerta de batida incompleta'
  | 'Folga registrada'
  | 'Folga amanhã';

export interface MailtoAlertInput {
  collaborator: CollaboratorWithRelations;
  type: MailtoAlertType;
  details: string;
  action: string;
}

/** Monta o link mailto: (assunto/corpo padrão da seção 23 do escopo). */
export function buildAlertMailto({ collaborator, type, details, action }: MailtoAlertInput): string {
  const companyName = collaborator.company?.short_name ?? '-';
  const subject = `[Gestor de Horas] ${type} — ${collaborator.name}`;
  const body = `Prezado(a) ${collaborator.name},

O Gestor de Horas da Gerência de Contabilidade identificou a seguinte ocorrência em seu registro de ponto:

Tipo: ${type}
Empresa: ${companyName}
Matrícula: ${collaborator.registration}
Detalhes: ${details}
Ação necessária: ${action}

Por favor, tome as providências necessárias ou entre em contato com seu gestor para regularização.

Atenciosamente,
Gerência de Contabilidade — Equatorial Energia
Gestor de Horas`;

  const to = collaborator.email || '';
  const cc = collaborator.manager?.email || collaborator.manager_email || '';
  const params = new URLSearchParams();
  if (cc) params.set('cc', cc);
  params.set('subject', subject);
  params.set('body', body);
  return `mailto:${encodeURIComponent(to)}?${params.toString().replace(/\+/g, '%20')}`;
}

export function hasCollaboratorEmail(collaborator: CollaboratorWithRelations): boolean {
  return Boolean(collaborator.email);
}
