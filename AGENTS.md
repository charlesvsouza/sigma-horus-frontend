<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:handoff -->
# Handoff — Sessão 2026-06-27

> 📘 **Escopo, arquitetura e histórico completos:** [`../../sigmahorus_documentacao.md`](../../sigmahorus_documentacao.md) (documento único de referência). Este arquivo é só o **estado da sessão corrente** — não duplicar escopo/história aqui.

## Estado atual (`main`, HEAD `c4d9b21`)
- Working tree limpo, tudo pushed (deploy automático na Vercel).
- `npx tsc --noEmit`: ✅ limpo no código de app (erros só nos `.test.ts`; o "erro" `react-hooks/set-state-in-effect` existe em TODAS as páginas do dashboard e NÃO bloqueia o build da Vercel).
- Banco: **16/16 migrations** no Railway, RLS ativo. 22 modelos (inclui `Relative`).
- Next.js 16.2.9, next-auth v5 beta.31. Deploy automático Vercel. Domínio `sigmahorus.com.br` no ar (SSL ok).

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
- ✅ Docs consolidados em `../../sigmahorus_documentacao.md` (fonte única de escopo/história).

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
