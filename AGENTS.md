<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:handoff -->
# Handoff — Sessão 2026-06-26

## Estado atual (`main`)
- `npx tsc --noEmit`: ✅ limpo no código de app (erros só nos `.test.ts`, por importarem com extensão `.ts` — config, não bug).
- Banco: **11/11 migrations** no Railway, RLS ativo. 21 modelos (incl. `RolePermission`, `Invitation`).
- Next.js 16.2.9, next-auth v5 beta.31. Deploy automático Vercel. Domínio `sigmahorus.com.br` no ar (SSL ok).

## Concluído nesta sessão (correção de preço + manual)
- ✅ **Desconto anual movido do boleto para o CARTÃO** (regra de cobrança, não só texto): `priceFor` ([src/lib/plans.ts](src/lib/plans.ts)) desconta só `card`; `ensurePrice` ([src/lib/stripe.ts](src/lib/stripe.ts)) aplica 10% no anual e **versiona a lookup_key do anual (`_v2`)** — Prices no Stripe são imutáveis, os antigos (cheios) ficam órfãos/inativos. UI/textos: `plans-section.tsx`, `SubscriptionManager.tsx`, `termos`, `compliance`, `manual`.
  - ⚠️ **Decisão pendente do dono:** o boleto anual ficou pelo valor cheio e sem auto-renovação (vira o pior negócio). Avaliar remover boleto anual ou dar desconto menor.
- ✅ **Manual reescrito** em [src/components/manual-book.tsx](src/components/manual-book.tsx) (página = server wrapper com metadata): **índice lateral + frame central + botão "Salvar como PDF"** (print CSS formato livro acadêmico: capa, serifada, quebra por capítulo). Passo a passo por perfil — Admin (incl. conectar Asaas: gerar API key + webhook/token), Tesoureiro (7 sub-seções), Secretário, Venerável, Membro (portal), assinatura, regras, LGPD, FAQ.
- Validação: `tsc --noEmit` limpo (exceto `.test.ts`); `eslint` 0 erros nos arquivos tocados.

## Concluído em sessões anteriores (NÃO refazer)
- ✅ **RBAC persistido por loja** (`RolePermission`): matriz papel × recurso × ação editável em `/dashboard/configuracoes/permissoes` (`/api/permissions`), fallback default em código.
- ✅ **Cadastro por convite** (`Invitation` + `/api/invites`), **trial 10 dias**, **billing mensal/anual** (`/api/stripe/change-plan`; anual sem cartão usa boleto).
- ✅ **Páginas institucionais** (`(institucional)`: sobre/termos/privacidade/compliance/manual) + consentimento de pagamento. Nova landing cinematográfica + logo ouro oficial.
- ✅ **Webhook Stripe** no domínio novo (`https://sigmahorus.com.br/api/stripe/webhook`); sem refs `*.vercel.app` em `src/`.
- ✅ **R2** com as 4 vars completas na Vercel (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET`).
- ✅ Testes unitários em `src/lib/{asaas,crypto,masks,rbac,storage}.test.ts`.

## ⏳ Pendências REAIS restantes (só estas 3, confirmadas com o dono)
1. **Teste E2E do Asaas com sandbox** — conectar → emitir → pagar no sandbox → baixa via webhook (código pronto, nunca exercido contra API real).
2. **Comunicação real WhatsApp/E-mail (Fase 7)** — `MessageLog` pronto; falta canal externo (Cloud API + e-mail).
3. **E-mail profissional `@sigmahorus.com.br`** — contratar à parte; depois MX/SPF/DKIM na zona DNS da Hostinger.

## Notas importantes
- ⚠️ Há uma env var de usuário do Windows `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sigmahorus` que sobrescreve o `.env`. Para Prisma local, sobrescreva na sessão:
  ```
  $env:DATABASE_URL = "<APP_DATABASE_URL do Railway>"
  ```
- `.env` local sem credenciais R2 → preencher para testar upload em dev.
- (Opcional) Stripe modo produção (live keys); pooling Railway; finalizar páginas com `bg-slate-950` antigo.
<!-- END:handoff -->
