<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:handoff -->
# Handoff — Sessão 2026-06-27

> 📘 **Escopo, arquitetura e histórico completos:** [`../../sigmahorus_documentacao.md`](../../sigmahorus_documentacao.md) (documento único de referência). Este arquivo é só o **estado da sessão corrente** — não duplicar escopo/história aqui.

## Estado atual (`main`, HEAD `cbe6c28` + alterações locais não commitadas)
- ⚠️ **Há trabalho não commitado** (sessão 2026-06-28): acesso do obreiro, encerramento de veneralato e tema claro. `npx next build` ✅ passou; `npx tsc --noEmit` ✅ limpo no app (erros só em `.test.ts`).
- Banco: **20/20 migrations** no Railway, RLS ativo (`prisma migrate deploy` aplicado). 24 modelos; `User` agora liga a `Member` (`memberId`).
- Next.js 16.2.9, next-auth v5 beta.31. Deploy automático Vercel. Domínio `sigmahorus.com.br` no ar (SSL ok).

## Concluído nesta sessão (2026-06-28) — NÃO refazer
- ✅ **Acesso do obreiro (Membro→Usuário):** `User.memberId` (1-1) + `mustChangePassword` (migration `20260628140000_add_user_member_link`). `POST /api/members/[id]/grant-access` (Admin) cria/renova login com senha provisória **enviada por e-mail (Resend)** (`lib/password.ts`). Gate de 1º acesso no `dashboard/layout.tsx` → `/trocar-senha` (revalida via `signIn`; `jwt` trata `trigger==='update'`). Página **Usuários & acessos** `/dashboard/configuracoes/usuarios` (`GET /api/users`, `PATCH /api/users/[id]` papel/status/reset; trava o último admin). `POST /api/account/password` (troca própria). **Self-edit**: `members/[id]` PUT libera quando `session.memberId === id`. Auth expõe `memberId`/`mustChangePassword`. Botão "Conceder acesso" no detalhe de Membros (role via `/api/auth/session`).
- ✅ **Encerramento de veneralato (3 passos):** migration `20260628160000_add_term_closing_flow` (`Term.openingBalance/closedAt/closedById`, `CashClose.openingBalance/closingBalance/approved/approvedAt/approvedById`). **1)** `POST /api/cash-close` (Tesoureiro, `accounts:write`) calcula closingBalance = openingBalance + pagamentos − contas a pagar. **2)** `POST /api/cash-close/approve` (Venerável/Admin). **3)** `POST /api/terms/[id]/close` (Admin; exige CashClose aprovado, seta status=closed e endDate). **Trava** `lib/term-lock.ts` (`findClosedTermForDate`) integrada em `accounts` e `payments` POST (409 se data em período fechado). **Herança**: `POST /api/terms` abre novo período com openingBalance = closingBalance do último fechamento aprovado. UI veneralato reescrita em 3 cartões por papel.
- ✅ **Tema claro:** `[data-theme="light"]` em `globals.css` remapeia os tokens `--sigma-*` (Tailwind v4 `@theme inline`). `components/theme-toggle.tsx` (localStorage `sigma-theme` + `html[data-theme]`), seção **Aparência** em Configurações, script anti-flash no `app/layout.tsx` (`suppressHydrationWarning`). ⚠️ Limitação v1: utilitários `border-white/[x%]`/`bg-white/x` ficam sutis no claro (foram desenhados p/ o escuro).
- ✅ **Docs/manual:** `sigmahorus_documentacao.md` + este AGENTS atualizados; manual (`manual-book.tsx`) 6.1 (Aparência), 6.3 (acesso do obreiro), 7.7 (encerramento 3 passos), cap. 10 (acesso/senha do membro).
- ⏳ **Falta (pós-sessão):** **commitar e push** (deploy Vercel); **conexão Meta do WhatsApp** (ação do dono — cap. 6.6); validar E2E o fluxo de acesso e o encerramento em produção.

## Sessão anterior (2026-06-27, HEAD `cbe6c28`)
- Últimos commits: `cbe6c28` docs/handoff + manual (6.6 Comunicação WhatsApp/SMS BYO) · `3da44d6` WhatsApp/SMS BYO por loja · `da0f6b7` WhatsApp via template.

## Concluído nesta sessão (2026-06-27)
- ✅ **Backfill de `Account.chartAccountId`**: `POST /api/accounts/backfill-chart` (tenant/RLS, `accounts:write`) + botão "Vincular contas ao plano" em Cadastros. Resolve o balde "Sem classificação" no balancete.
- ✅ **Membros — Fase 1**: página reescrita lista-primeiro (busca nome/CPF/CIM, tabela compacta com expandir inline, "Novo membro" recolhível), **editar/excluir** (`/api/members/[id]` PUT/DELETE; DELETE com guarda 409 se houver histórico financeiro/documentos), marco **Instalação** (`installationDate`/`installationLodge`, migration `20260627120000`), **evolução maçônica concatenada**. Helper `src/lib/member-fields.ts`.
- ✅ **Membros — Fase 2**: tabela relacional **`Relative`** (kind mother|father|spouse|son|daughter|child|other; name, birthDate, cpf, email, phone, order) com RLS + índices `(lodgeId,memberId)` e `(lodgeId,birthDate)`, migration `20260627140000`. UI **Família e dependentes** no MemberForm (slots fixos Mãe/Pai/Esposa + dependentes dinâmicos add/remove); create/update gravam relatives (PUT = replace-all transacional); GET inclui relatives ordenados; detalhe exibe a família. **Backfill** `POST /api/members/backfill-relatives` (idempotente; migra campos planos antigos) + botão "migrar família antiga". Campos planos antigos depreciados (fora do form; colunas mantidas).
- ✅ **Membros — grau sem redundância**: removido "Grau de iniciação" (sempre 1º grau; `initiationDegree` depreciado). **Situação simbólica** (Aprendiz/Companheiro/Mestre/Mestre Instalado) **derivada** dos marcos de evolução via `src/lib/masonic-degree.ts` (puro, usado por Membros e Portal). "Grau atual" → **Grau Filosófico atual** (seletor REAA 4–33, em `currentDegree`; vazio = situação simbólica). **Bloco "Origem"**: Potência de origem (`originPowerId` FK→Power, migration `20260627160000`) + Loja de origem (texto). `gradeName`/`initiationDegree` fora do parser (preserva legado ao editar).
- ✅ **Membros — Tempo de Ordem**: campo automático derivado da `initiationDate` (antiguidade maçônica), exibido no form e no detalhe. Helper `lib/masonic-degree.ts`: `yearsInOrder`, `timeInOrderLabel`, `TENURE_MILESTONES` (1,5,10,15,20,25,30,40,50,60), `tenureMilestoneForYear` — base p/ jubileus/aniversário de iniciação na Fase 7.
- ✅ **Membros — situações de afastamento + relatório**: novos status **Quit Placet** / **Placet Ex Officio** / **Art. 002** (+ Ativo/Suspenso/Inativo) em `lib/member-status.ts` (label + badge por tom; sem migration, status é texto livre; cobrança em massa de ativos segue `status=active`). **Filtro por situação** na listagem + **botão "Relatório PDF"** (imprime a lista filtrada por situação/busca em A4, cabeçalho da loja; reusa o padrão de print do fechamento).
- ✅ **Rodada UI/UX (skill impeccable, crítica 30/40)** — 5 commits: (P1) **disclosure progressivo** no form de membro (núcleo aberto + acordeões `Collapsible`); (P1) **dashboard** sem template métrica-herói (âncora de posição financeira + rail "Precisa de atenção" com empty state); (P2) **fonte única de campo** `components/ui/field-styles.ts` (`inputClass`) adotada por `<Input>` e Membros + `<Button>` nas ações; (P3) **skeleton/EmptyState/validação inline** na lista e no form; polish: timbre ouro no relatório PDF.
- ✅ **Polish UI demais telas**: design system (inputClass + `<Button>`) + skeleton/EmptyState em contas, cobranças, pagamentos, sessões, documentos, integrações, comunicação, veneralato, configurações. (cargos/auditoria não migrados — baixo valor.)
- ✅ **Fix plano de contas (AMORIO)**: lojas antigas ficavam com a codificação flat (1.01..1.11); `syncChartAccounts` + `POST /api/chart-accounts/sync` + botão "Atualizar plano (AMORIO)" em Cadastros migram para o canônico (1.1.xx…). **Dono deve clicar o botão** na sua loja (test) para aplicar.
- ✅ **Self-service de assinatura (Stripe-first + trial 10d)**: `POST /api/signup/checkout` (público, trial+cartão) → `/comecar/concluir` + `GET/POST /api/signup/complete` (cria loja ligada ao Stripe real) → auto-cobrança ao fim do trial. Landing usa o checkout self-service no cartão. Webhook preserva `trialing`. `POST /api/cron/cancel-abandoned-trials` (token `PLATFORM_OWNER_TOKEN`) cancela trials abandonados >48h. **Stripe LIVE verificado: 6 preços existem — nada a criar.**
- ✅ **Vercel Cron** do `cancel-abandoned-trials` (vercel.json, diário 04:00; rota aceita GET + `CRON_SECRET`, já configurado na Vercel). Botão do plano renomeado para "Atualizar plano de contas" (sem AMORIO).
- ✅ **Hospitalaria — Fase 1**: papel `hospitaller` + recurso `campaigns` no RBAC (admin/venerável também acessam). Seção "Hospitalaria": **Irmãos (consulta)** read-only com contatos do obreiro + família; **Campanhas** de benemerência (criar com modelos, beneficiário pessoa/empresa/instituição, meta, fonte; doações voluntárias que lançam no financeiro no Tronco com doador ocultável; custear pelo Tronco validando saldo). **Tronco de Solidariedade**: `ChartAccount.isSolidarity` (migration `20260627180000`), saldo = entradas − gastos (helper `lib/hospitalaria.ts`); seed/sync marcam Tronco de Beneficência (1.1.05) e Ação Social (8.9.03). Modelos `Campaign`/`CampaignDonation` com RLS.
- ✅ Docs consolidados em `../../sigmahorus_documentacao.md` (fonte única de escopo/história).

- ✅ **Hospitalaria — Fase 2 (convocação)**: `lib/messaging.ts` (providers via fetch, ativados por env — **Resend** `RESEND_API_KEY`/`RESEND_FROM`, **Meta WhatsApp** `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_ID`, **Twilio SMS** `TWILIO_*`); sem credenciais, fica `queued` no `MessageLog`. `POST /api/campaigns/[id]/convocar` envia a campanha por canal a cada irmão (ativos/todos). UI "Convocar os irmãos" no detalhe. **Reaproveitável pela Fase 7** (aniversários/jubileus/cobrança).
- ✅ **Manual v1.1** (`manual-book.tsx`): autocadastro/trial, papel Hospitaleiro, menu Hospitalaria, nova área de Membros, "Atualizar plano de contas", novo cap. 11 "Guia do Hospitaleiro".

## Fase 7 — Comunicação real
- ✅ **E-mail (Resend) ATIVO**: domínio `sigmahorus.com.br` verificado (DKIM/SPF/MX/DMARC na Hostinger), `RESEND_API_KEY`/`RESEND_FROM` na Vercel (produção, redeployado). Envio de teste confirmado. `from` = `no-reply@sigmahorus.com.br`.
- ✅ **Gatilhos automáticos diários** (`lib/notifications.ts` + cron `/api/cron/daily-notifications`, Vercel Cron 11:00 UTC): aniversário do obreiro e de familiares, jubileu/aniversário de iniciação (`TENURE_MILESTONES`), cobranças a vencer (3 dias) e vencidas. Dedup por dia via `MessageLog`, fuso America/Sao_Paulo, envia pelos canais configurados.
- ✅ **WhatsApp/SMS — BYO por loja** (decisão de produto: e-mail incluso na plataforma; WhatsApp/SMS com custo direto da loja). Cada loja conecta a própria conta em **Integrações** (cartão "Comunicação"): WhatsApp (Meta — Phone Number ID + token + template) e/ou SMS (Twilio — SID/token/from). Credenciais criptografadas por tenant (`Lodge.whatsapp*`/`sms*`, migration `20260628120000`). `lib/messaging.ts` agora recebe `lodgeChannels`; `lib/lodge-channels.ts` descriptografa. Convocação, gatilhos diários e GET de campanhas usam os canais da loja. **Sem envs globais de WhatsApp/SMS.** WhatsApp proativo exige **template aprovado** (corpo com 1 variável → `WHATSAPP_TEMPLATE` por loja).

## ⏳ Outras pendências
- **Atribuição de papel a usuário**: não há UI para definir `User.role` (ex.: tornar alguém `hospitaller`). Hoje admin/venerável já acessam a Hospitalaria; para um Hospitaleiro dedicado, falta uma tela de gestão de usuários/papéis (ou setar `role` direto no banco).

## ⏳ Operacional pendente do self-service
- **Agendar o cron** `POST /api/cron/cancel-abandoned-trials` (header `Authorization: Bearer $PLATFORM_OWNER_TOKEN`) ~1×/dia (Vercel Cron ou Railway) — sem ele, trials abandonados cobram ao fim de 10 dias.
- (Opcional) `customer.subscription.trial_will_end` → lembrete por e-mail (Fase 7).
- E2E real: clicar "Assinar" na landing → cartão de teste → concluir cadastro → confirmar acesso `trialing` no painel.

## ⏳ Próximos
- **Aniversariantes do mês** (`member.birthDate` + `Relative.birthDate`, indexados) **e jubileus/aniversário de iniciação** (`initiationDate` + `TENURE_MILESTONES`) → felicitações pela Secretária/Hospitalária. Faz parte da **Fase 7 (Comunicação real WhatsApp/E-mail)**.
- **E-mail profissional `@sigmahorus.com.br`** — contratar à parte; depois MX/SPF/DKIM na Hostinger.
- (Melhoria) refinar **Saldo dos Associados** no relatório de fechamento (reconciliar Account×Payment por documento).

## Concluído nesta sessão (NÃO refazer)
- ✅ **Desconto anual: cartão 10% / boleto 5%** (regra real de cobrança): `priceFor` + `annualDiscountFor` ([src/lib/plans.ts](src/lib/plans.ts)); `ensurePrice` ([src/lib/stripe.ts](src/lib/stripe.ts)) aplica 10% no anual do cartão com `lookup_key` versionada `_v2`. Textos: landing, painel, termos, compliance, manual.
- ✅ **Stripe LIVE**: 6 preços criados (3 planos × mês/ano) via script que replica `ensureProduct`/`ensurePrice`; produtos duplicados (lag do índice) **consolidados** — 1 produto ativo por plano (mês+ano), 3 arquivados. Checkout resolve por `lookup_key`.
- ✅ **Asaas E2E (sandbox) VALIDADO** pelo dono: emissão de boleto/PIX funcionando (cobrança recebida/visualizada). A Fase 3 deixa de ser pendência.
- ✅ **Número de referência automático** das cobranças (`COB-AAAAMM-NNNN`, sequencial por loja); campo opcional. Em `/api/invoices`.
- ✅ **Cobrança em massa**: `POST /api/invoices/bulk` (uma cobrança por membro, ativos/todos, recorrência opcional) + bloco na UI de Cobranças.
- ✅ **Configurações da loja**: `Lodge.riteName/powerName/sessionWeekdays/sessionFrequency` (migration `20260626130000`); seções "Loja maçônica" e "Sessões"; botão **"Aplicar cargos deste rito"** (`POST /api/lodges/seed-offices`, `seedOfficesForRite` não-destrutivo).
- ✅ **Plano de contas livro-caixa**: `MASONIC_CHART_OF_ACCOUNTS` recodificado hierárquico (1.1.xx, 2.1.xx, 8.9.xx…); `seedLodgeDefaults` faz **top-up por código** (não duplica); `DELETE /api/chart-accounts/[id]` + botão Remover.
- ✅ **Manual reescrito** ([src/components/manual-book.tsx](src/components/manual-book.tsx)): índice lateral + frame central + "Salvar como PDF" (print CSS livro acadêmico). Cobre todos os perfis e as funções novas.

- ✅ **Suíte de relatórios de fechamento do veneralato** (formato AMORIO): `GET /api/reports/closing?from&to` agrega Balanço Financeiro, Balancete por plano de contas, Receitas×Despesas mensal, Livro Caixa, Cobranças e Saldo dos Associados; página `/dashboard/relatorios/fechamento` com seletor de período + "Salvar como PDF" (print livro). Vínculo `Account.chartAccountId` (migration `20260626140000`) — agrupamento por plano de contas depende de vincular cada conta a uma categoria.

## Decisão pendente do dono
- Boleto anual a 5% **mantido** (decidido). Reavaliar só se quiser descontinuar.

## Concluído em sessões anteriores (NÃO refazer)
- ✅ **RBAC persistido por loja** (`RolePermission`): matriz papel × recurso × ação editável em `/dashboard/configuracoes/permissoes` (`/api/permissions`), fallback default em código.
- ✅ **Cadastro por convite** (`Invitation` + `/api/invites`), **trial 10 dias**, **billing mensal/anual** (`/api/stripe/change-plan`; anual sem cartão usa boleto).
- ✅ **Páginas institucionais** (`(institucional)`: sobre/termos/privacidade/compliance/manual) + consentimento de pagamento. Nova landing cinematográfica + logo ouro oficial.
- ✅ **Webhook Stripe** no domínio novo (`https://sigmahorus.com.br/api/stripe/webhook`); sem refs `*.vercel.app` em `src/`.
- ✅ **R2** com as 4 vars completas na Vercel (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET`).
- ✅ Testes unitários em `src/lib/{asaas,crypto,masks,rbac,storage}.test.ts`.

## ⏳ Pendências REAIS restantes
1. **Comunicação real WhatsApp/E-mail (Fase 7)** — `MessageLog` pronto; falta canal externo (Cloud API + e-mail).
2. **E-mail profissional `@sigmahorus.com.br`** — contratar à parte; depois MX/SPF/DKIM na zona DNS da Hostinger.
3. (Melhoria) vincular contas antigas ao plano de contas para o balancete sair completo; refinar Saldo dos Associados.

## Notas importantes
- ⚠️ Há uma env var de usuário do Windows `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sigmahorus` que sobrescreve o `.env`. Para Prisma local, sobrescreva na sessão:
  ```
  $env:DATABASE_URL = "<APP_DATABASE_URL do Railway>"
  ```
- `.env` local sem credenciais R2 → preencher para testar upload em dev.
- (Opcional/backlog técnico) confirmar pooling do Railway sob carga; lint `react-hooks/set-state-in-effect`; cobertura de testes além de `src/lib/*.test.ts`. (Migração de `bg-slate-950` para design tokens **já concluída** — 0 ocorrências.)
<!-- END:handoff -->
