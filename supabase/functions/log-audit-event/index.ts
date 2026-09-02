// Edge Function opcional: log-audit-event (Deno, runtime Supabase Edge Functions)
//
// Responsabilidade única: receber o evento de auditoria que o front-end já
// montou (auditLogService.ts#createAuditLog) e completar com o que só o
// SERVIDOR consegue capturar de forma confiável — IP de origem (dos headers
// da requisição) e a hora do próprio servidor — antes de inserir em
// audit_logs. O front-end publicado no GitHub Pages nunca "inventa" IP
// sozinho (não é confiável a partir do navegador).
//
// NÃO É DEPLOYADA AUTOMATICAMENTE por este repositório — não há pipeline de
// CI/CD nem acesso à Supabase CLI neste projeto. Para publicá-la:
//
//   supabase functions deploy log-audit-event --project-ref <seu-projeto>
//
// e configurar, nos Secrets da função (nunca no front-end/GitHub Pages):
//   SUPABASE_URL             (já disponível automaticamente no runtime)
//   SUPABASE_SERVICE_ROLE_KEY (Settings → API → service_role — NUNCA no bundle JS)
//
// Enquanto esta função não estiver publicada, auditLogService.ts detecta a
// falha de rede/timeout e cai automaticamente para o insert direto na
// tabela (chave anon, RLS aberta) — ip_address fica null e a tela de
// Auditoria mostra "Não capturado". Ver README, seção "Trilha de Auditoria".

// @ts-nocheck — arquivo roda no runtime Deno da Supabase, fora do
// TypeScript/Vite deste projeto (sem os tipos "npm:@supabase/supabase-js" e
// "Deno" instalados aqui); mantido como referência de implementação, não
// como parte do build do front-end.

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

/** Só os campos que o front-end tem condição de preencher — o resto é sobrescrito pelo servidor abaixo. */
const ALLOWED_PAYLOAD_KEYS = [
  'actor_profile_id',
  'actor_registration',
  'actor_name',
  'actor_email',
  'actor_role',
  'action',
  'entity_type',
  'entity_id',
  'entity_label',
  'route',
  'screen',
  'old_value',
  'new_value',
  'metadata',
  'status',
  'error_message'
];

function pickAllowedFields(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ALLOWED_PAYLOAD_KEYS) {
    if (key in payload) out[key] = payload[key];
  }
  return out;
}

function extractClientIp(req: Request): string | null {
  // x-forwarded-for pode trazer uma cadeia "cliente, proxy1, proxy2" — o
  // primeiro endereço é o do cliente original.
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }

  if (!payload || typeof payload.action !== 'string' || !payload.action.trim()) {
    return new Response(JSON.stringify({ error: 'Campo "action" é obrigatório' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }

  const row = {
    ...pickAllowedFields(payload),
    ip_address: extractClientIp(req),
    user_agent: req.headers.get('user-agent') ?? (typeof payload.user_agent === 'string' ? payload.user_agent : null),
    created_at: new Date().toISOString()
  };

  // service_role — só existe no ambiente seguro da Edge Function, nunca no
  // front-end/GitHub Pages. Insere ignorando RLS de propósito, já que esta
  // função É a camada de confiança para este insert.
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  const { error } = await supabase.from('audit_logs').insert(row);
  if (error) {
    console.error('log-audit-event: falha ao inserir', error);
    return new Response(JSON.stringify({ error: 'Falha ao registrar evento de auditoria' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
});
