<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:handoff -->
# Handoff — Sessão 2026-06-26

## Estado atual (`main`, HEAD `976ec8b`)
- `npx tsc --noEmit`: ✅ limpo no código de app (erros só nos `.test.ts`; o "erro" `react-hooks/set-state-in-effect` existe em TODAS as páginas do dashboard e NÃO bloqueia o build da Vercel).
- Banco: **13/13 migrations** no Railway, RLS ativo. 21 modelos.
- Next.js 16.2.9, next-auth v5 beta.31. Deploy automático Vercel. Domínio `sigmahorus.com.br` no ar (SSL ok).
- ⚠️ **Há commits locais não enviados** — confira `git status`/`git log origin/main..main` e faça push (deploy) com autorização do dono.

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
- (Opcional) Stripe modo produção (live keys); pooling Railway; finalizar páginas com `bg-slate-950` antigo.
<!-- END:handoff -->
