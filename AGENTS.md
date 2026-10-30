# Sigma Horus — regras para agentes

Carregado em toda sessão: só regras duradouras. Estado, decisões e histórico ficam fora (ver "Onde está o resto").

## Next.js
Esta versão do Next.js (16) tem mudanças de API e de convenção. Antes de escrever código de Next, leia o guia certo em `node_modules/next/dist/docs/` e respeite os avisos de depreciação.

## Banco e scripts (cuidado: produção)
- A variável de usuário do Windows `DATABASE_URL` aponta para localhost e **sombreia o `.env`**. Em script contra produção: `env -u DATABASE_URL -u APP_DATABASE_URL npx tsx --env-file=.env scripts/x.ts` (PowerShell: `Remove-Item Env:DATABASE_URL, Env:APP_DATABASE_URL` antes).
- **Nunca edite uma migration já entregue.** Mudança = migration nova. Confira as colunas em produção antes do push (o `affiliationFee` quebrou produção assim).
- Aplique migrations pendentes em produção (`prisma migrate deploy`, com o `env -u` acima) **antes** do push/deploy.
- Scripts de escrita em loja real exigem `--i-know-this-is-a-real-lodge` (`scripts/protected-lodges.ts`; hoje `amm139`). A amm139 é a única loja real; Tim Maia (`horus-reaa`) é demo fictícia.
- Toda tabela por loja tem RLS; use `withTenant(lodgeId, …)`; `prismaAdmin` só para o que é de plataforma ou cruza lojas.
- Dinheiro: use os helpers de `lib/money.ts` (`round2`, `sumMoney`, `remainingAmount`); datas "só dia" são meia-noite UTC (`lib/date-only`, `todayBR`, `ledgerDayKey`). Não use `new Date('…T23:59:59')` em relatório de período.
- Teste local sem tocar produção: o servidor local carrega o `.env` de produção. Zere `R2_*`, `RESEND_*`, `ASAAS_*` e use `SUBSCRIPTION_ENFORCEMENT=off`; banco descartável via Docker (`postgres:16-alpine`, crie o role `sigma_app` antes do `migrate deploy`).

## Antes de publicar
- Rode o checklist inteiro do CI: `npx tsc --noEmit`, `npx eslint`, `npm test`, `npx prisma validate` (não só tsc + test). A Vercel deploya `main` mesmo com CI vermelho; push na `main` já publica.
- Só faça commit/push quando o dono pedir. Commit termina com a linha de coautoria combinada.
- O `next dev` reescreve um bloco "agent rules" neste arquivo. Não use `git checkout AGENTS.md` com texto novo não commitado (apaga o texto): remova só o bloco gerado.

## Regras de produto que não se discutem
- **Acesso:** cada cargo só vê a sua área (só a matriz de permissões amplia) e cada loja só vê a si mesma. Administrador é fixo (não se promove nem rebaixa; máximo de 2 ativos; um e-mail = um papel).
- **Nada retido em terceiros:** o dinheiro vai direto para a conta da loja. Modo Loja (padrão: Pix/cobrança manual da loja) × Modo Asaas (por loja). Acordos de regularização **nunca** pelo Asaas.
- **Toda nova rota que grava `Payment`, `AccountTransfer` ou saldo inicial** chama `checkLedgerOpen` (e `findClosedTermForDate`).
- **Baixa de despesa** exige comprovante; baixa manual exige tipo de baixa (`settlementType`).
- **Tronco e Doações são categorias**, não caixas. Saldo e relatórios por categoria.
- **Art. 002 só informa.** Bloqueio é ato manual do Venerável/Administrador e cria o acordo. Restrição do cadastro com motivo não impede login.
- **Perda de acesso de uma loja real:** olhe primeiro `Subscription` (status, `trialEndsAt`, `pastDueSince`); lojas sem assinatura vigente ficam presas na tela de planos.
- Stripe: um produto ativo por plano; arquive só o `Price` antigo, nunca o `Product` em uso. Conta certa: "Sigma Horus" (`acct_1TmZP5PQlSh5FMQx`), não "SigmaDiagnostic".

## Escrita e interface
- Português simples em telas, e-mails, relatórios e auditoria: evite anglicismos e jargão técnico.
- Relatórios usam `ReportDocument` + `HonorBoard` + `OfficialDocument`; Toast para retorno de ação; `Button` com alvo de 44 px em toque; cores e componentes do `DESIGN.md`.
- Páginas do dashboard: Server Component (`page.tsx`) + `XClient.tsx` com dados por props e `router.refresh()` após mutação.
- Ao terminar uma investigação ou decisão: registrar em memória **e** no `historico_de_desenvolvimento.md` (entrada nova no topo).

## Onde está o resto
- Visão geral curta do produto e das decisões do dono: `../../RESUMO_DO_PROJETO.md`.
- Escopo, arquitetura e modelo de dados: `sigmahorus_documentacao.md`. Design: `DESIGN.md`, `PRODUCT.md`.
- Histórico recente: `../../historico_de_desenvolvimento.md`; até 10/10/2026: `../../historico/arquivo/`.
- Handoffs de sessões antigas (jun–out/2026): `../../historico/arquivo/AGENTS_handoffs_ate_2026-10-30.md`.
