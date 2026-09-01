# Monitor de Controles de Horas — Equatorial

Sistema interno da área de Contabilidade IV / Gerência de Contabilidade para
acompanhamento de banco de horas, folgas, fechamento de ciclos, alertas
trabalhistas e exposição financeira relacionada a horas não compensadas.

Esta é a versão modernizada do antigo SPA em HTML único: agora é uma
aplicação **React + TypeScript + Vite**, com **Supabase/PostgreSQL** como
base oficial de dados e deploy do front-end via **GitHub Pages**.

## 1. Visão geral

- **Nome oficial:** Monitor de Controles de Horas
- **Título:** Monitor · Controles de Horas — Equatorial
- **Módulos:** Dashboard, Resumo por Colaborador, Controle de Horas,
  Calendário de Folgas, Upload de Arquivos, Gestão BH / Pagamento,
  Configurações, Base de Colaboradores.
- **Identidade visual** (paleta navy, IBM Plex Sans/Mono, sidebar de 240px)
  preservada 1:1 em relação ao sistema original.
- O **Supabase é a base oficial dos dados**. `localStorage` é usado
  exclusivamente como cache de filtros de UI e sessão (nunca como base de
  negócio) — ver `src/hooks/useFilters.ts` e `src/utils/access.ts`.

## 2. Stack

React · TypeScript · Vite · `@supabase/supabase-js` · PostgreSQL (Supabase) ·
CSS por tokens (sem framework) · GitHub Pages + GitHub Actions ·
SVGs próprios para ícones · `pdfjs-dist` (instalado via npm, sem CDN) ·
PapaParse (CSV) · `date-fns` (utilitário auxiliar de datas).

## 3. Estrutura do projeto

```text
src/
  lib/        supabaseClient, constantes (empresas/códigos), permissions
  types/      tipos das tabelas (database.ts), tipos de domínio, tipos de import
  styles/     tokens.css, globals.css, layout.css, components.css
  utils/      regras de negócio puras: horas, ciclos, compliance, parsers…
  services/   camada de acesso ao Supabase por domínio (1 arquivo por tabela)
  hooks/      useAppData (carga de dados), useAccessProfile, useToast, useFilters
  components/ layout, ui, calendar, import, forms
  pages/      uma página por módulo do menu
supabase/
  migrations/ 0001 schema · 0002 RLS · 0003 seed obrigatório (empresas + dev)
  seed.sql    dados fictícios de desenvolvimento (NÃO usar em produção)
```

## 4. Como criar o projeto no Supabase

1. Crie uma conta/projeto em [supabase.com](https://supabase.com).
2. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**.
3. Em **Project Settings → Database**, copie a *Connection string* caso queira
   rodar as migrations via `psql`, ou use o **SQL Editor** do painel do Supabase.

## 5. Como executar as migrations

**Opção A — SQL Editor do Supabase (mais simples):**
Abra cada arquivo de `supabase/migrations/`, na ordem numérica, e cole/execute
no SQL Editor:
1. `0001_create_schema.sql` — cria todas as tabelas, índices e triggers.
2. `0002_create_rls_policies.sql` — habilita RLS e cria as políticas.
3. `0003_seed_initial_data.sql` — cadastra as 8 empresas, ciclos padrão e o
   perfil do Desenvolvedor (`u1205385`), obrigatório em qualquer ambiente.

**Opção B — Supabase CLI:**
```bash
supabase link --project-ref <seu-project-ref>
supabase db push
```

**Dados de desenvolvimento (opcional, apenas local):**
```bash
psql "$DATABASE_URL" -f supabase/seed.sql
```
`supabase/seed.sql` contém apenas colaboradores/gestores **fictícios** — nunca
execute em produção.

## 6. Como configurar o `.env`

```bash
cp .env.example .env
```
Preencha:
```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_APP_NAME=Monitor de Controles de Horas
```
`.env` nunca é commitado (`.gitignore`). A chave `anon` é pública por design
do Supabase — a proteção real de dados vem do RLS (seção 9 abaixo).

## 7. Como rodar localmente

```bash
npm install
npm run dev
```
Acesse `http://localhost:5173`. No primeiro acesso, informe a matrícula
`u1205385` (perfil Desenvolvedor, criado pela migration 0003) na tela de
login para liberar o sistema.

## 8. Como buildar e pré-visualizar

```bash
npm run build     # tsc -b && vite build → gera dist/
npm run preview   # serve o build de produção localmente
```

## 9. Como publicar no GitHub Pages

O workflow `.github/workflows/deploy.yml` builda e publica `dist/`
automaticamente a cada push em `main`, usando GitHub Actions + Pages.

1. Em **Settings → Pages** do repositório, defina a origem como **GitHub
   Actions**.
2. Em **Settings → Secrets and variables → Actions**, cadastre os secrets
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (o workflow os injeta no
   build).
3. Faça push em `main` — o site fica disponível em
   `https://<usuario>.github.io/<repositorio>/` (ou no domínio próprio, se
   configurado — ver seção 9.1).

O `base` do Vite é definido pela variável `GITHUB_PAGES_BASE` no workflow.
Hoje está fixo em `/` porque o projeto usa domínio próprio (`public/CNAME`),
servido na raiz. Sem domínio próprio, o valor correto seria
`/<nome-do-repo>/` (URL padrão `<usuario>.github.io/<repo>/`).

### 9.1 Domínio próprio (subdomínio)

Este projeto está configurado para `gestorhoras.contabilidade-eqtl.com`
(arquivo `public/CNAME`). Para apontar para outro domínio/subdomínio:

1. **DNS** — no provedor onde o domínio está registrado, crie um registro
   `CNAME`: host `gestorhoras` (ou o subdomínio desejado) apontando para
   `<usuario>.github.io` (sem o nome do repositório).
2. **`public/CNAME`** — edite o arquivo com o novo domínio (uma linha, sem
   `https://` e sem barra no final) e faça o deploy.
3. **GitHub** — em **Settings → Pages → Custom domain**, informe o mesmo
   domínio e salve. O GitHub roda uma verificação de DNS (pode levar alguns
   minutos a algumas horas) e emite certificado HTTPS automaticamente.
4. Depois que o certificado for emitido, marque **Enforce HTTPS** na mesma
   tela.

Se o domínio próprio for removido, apague `public/CNAME` e troque
`GITHUB_PAGES_BASE` no workflow de volta para `/${{ github.event.repository.name }}/`.

## 10. Controle de acesso — como funciona (e suas limitações)

A identificação do usuário segue esta ordem (`src/utils/access.ts`):
1. **Supabase Auth** (se configurado) — local-part do e-mail == matrícula.
2. **Query string** `?matricula=u1205385` (compatibilidade/MVP).
3. **Sessão local** (localStorage, apenas cache — nunca fonte de verdade).
4. **Tela de login manual**, solicitando a matrícula corporativa.

A matrícula é então cruzada com a tabela `access_profiles`. Perfis possíveis:
`Desenvolvedor`, `Administrador`, `Gestor`, `Facilitador`, `Sem acesso`. Sem
perfil ativo → tela de **Acesso não autorizado**, com saldos ocultos.

**⚠️ Limitação conhecida do MVP:** enquanto o Supabase Auth corporativo não
estiver habilitado, as políticas de RLS (`0002_create_rls_policies.sql`)
liberam leitura/escrita para qualquer chamada com a chave `anon` — a
restrição por perfil acontece **apenas no front-end**
(`src/lib/permissions.ts`). Isso não é segurança de borda real. Antes de ir a
produção com dados sensíveis, habilite Supabase Auth (e-mail corporativo ou
Microsoft OAuth) e troque as políticas de escrita pelas versões comentadas ao
final de `0002_create_rls_policies.sql`, que validam `auth.jwt() ->> 'email'`
contra `access_profiles`.

## 11. Como cadastrar o primeiro acesso

O perfil `u1205385` (Desenvolvedor) já é criado pela migration `0003` e é
**protegido** — não pode ser excluído nem perder o tipo de acesso
(`src/services/accessProfilesService.ts`). Faça login com essa matrícula e,
em **Configurações → Perfis de acesso**, cadastre os demais usuários
(Administrador, Gestor, Facilitador).

## 12. Como migrar a base JSON legada

Em **Configurações → Base compartilhada**, use *Exportar backup JSON* para
gerar um snapshot a qualquer momento.

### 12.1 Migração completa (recomendada) — `scripts/migrate-legacy-json.mjs`

Para trazer um export completo do sistema antigo (`collaborators`,
`managers`, `records`, `leaves`, `cycles`, `userProfiles`, `gestaoConfig` —
o formato salvo como `monitor-controles-horas-db.json`), use o script de
migração incluído no projeto. Ele roda **localmente** (nunca dentro deste
repositório publicado), com acesso direto ao Supabase:

```bash
npm install   # se ainda não tiver feito
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co \
VITE_SUPABASE_ANON_KEY=eyJ... \
npm run migrate:legacy -- caminho/para/monitor-controles-horas-db.json
```

O que ele faz:
- Casa colaboradores por empresa+matrícula e gestores/perfis por matrícula —
  **atualiza** se já existir, **cria** se não existir (nunca duplica).
- Converte todos os saldos de `"HH:MM"` para minutos inteiros.
- Vincula colaborador → gestor pela `gestorMatricula` (nunca pelo nome).
- Importa registros de ponto e folgas em lote, ignorando duplicados pelas
  mesmas constraints únicas do schema (seguro rodar mais de uma vez).
- **Nunca** rebaixa o perfil protegido do Desenvolvedor (`u1205385`), mesmo
  que o JSON traga outro tipo de acesso para essa matrícula.

⚠️ O arquivo JSON de origem normalmente contém dados reais de colaboradores
(nome, e-mail, matrícula, saldos). Não o commite neste repositório — rode o
script a partir de uma cópia local, fora do controle de versão.

### 12.2 Importação avulsa pela interface (Upload de Arquivos)

Para adicionar/atualizar um cartão-ponto pontual (não uma base completa),
use a tela **Upload de Arquivos** — aceita CSV/TXT/PDF, e também um JSON no
formato de registros avulsos (campo `records`, um item por linha de
cartão-ponto). A normalização aceita os campos legados
(`nome`/`name`/`colaborador`, `matricula`/`registration`, `gestorEmail`, etc.
— ver `src/types/imports.ts` e `src/utils/imports.ts`). Essa importação
também nunca duplica colaboradores/gestores nem cria gestores automaticamente
a partir do texto do colaborador.

## 13. Importação de cartão-ponto (CSV/TXT/PDF/JSON)

- **CSV/TXT:** delimitador detectado automaticamente (`;`, `,`, tab ou `|`);
  cabeçalhos aceitam variações comuns em português (ver
  `src/utils/csvParser.ts`).
- **PDF:** extraído com `pdfjs-dist` **instalado via npm** (o worker é
  empacotado pelo Vite — nunca carregado por CDN). Se o PDF não tiver texto
  selecionável (digitalizado como imagem), a UI abre automaticamente o
  assistente de **lançamento manual**, sem travar a aplicação.
- **JSON:** mescla com a base existente, sem duplicar e sem sobrescrever
  perfis protegidos.

Toda importação é registrada em `imports`, com a mensagem padrão
`"Importação concluída: X registro(s), Y colaborador(es) criado(s), Z
atualizado(s), W duplicado(s), N ignorado(s)."`.

## 14. Limitações do MVP

- Segurança de borda depende de Supabase Auth ser habilitado (ver seção 10).
- Notificação por e-mail usa `mailto:` (abre o cliente de e-mail local) — não
  há envio automático via SMTP/Graph/Power Automate ainda.
- O parser de PDF cobre o layout de cartão-ponto observado no sistema
  legado; layouts muito diferentes podem exigir ajustes em
  `src/utils/pdfParser.ts` ou cair no lançamento manual.
- Não há paginação server-side nas telas de listagem — adequado ao volume
  atual (dezenas/centenas de colaboradores), mas deve ser revisto para bases
  muito maiores.

## 15. Próximos passos recomendados

1. Habilitar Supabase Auth (e-mail corporativo ou Microsoft OAuth) e migrar
   as políticas de RLS para a versão restrita por `auth.jwt()`.
2. Substituir as notificações `mailto:` por uma Supabase Edge Function ou
   integração com Microsoft Graph/Power Automate.
3. Adicionar testes automatizados para as regras de horas/ciclo/compliance
   (`src/utils/*.ts` são funções puras, fáceis de testar).
4. Avaliar paginação/streaming para `time_records` conforme a base cresce.
5. Revisar `supabase/migrations/0002_create_rls_policies.sql` junto à área de
   Segurança da Informação antes de armazenar dados sensíveis reais.
