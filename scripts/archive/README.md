# Scripts arquivados

Scripts de uso único que já cumpriram o papel. Ficam aqui como registro do que foi feito
(e de como foi feito) — **não rode de novo sem entender o contexto**: alguns gravam em
produção e foram feitos para um estado do banco que já não existe.

Os caminhos de import foram ajustados para a pasta `archive/`, então continuam executáveis
(`node --env-file=.env --import ./test/setup.mjs scripts/archive/<script>.ts`, a partir de
`apps/frontend`). Lembre do `DATABASE_URL` do ambiente sombreando o `.env` (ver AGENTS.md).

| Script | O que fez | Situação |
| --- | --- | --- |
| `recategorize-amm-opening-balance.ts` | Na `amm139`, moveu o saldo do sistema anterior (R$ 9.819,78 na conta corrente e R$ 124.289,94 na conta investimento) do campo Saldo inicial para lançamentos reais na categoria 1.5.04 (Account + Payment via `settleAccountAsPaid`, data 11/09/2026), para aparecer na Razão por categoria. Inverso pontual de `fix-amm-opening-balance.ts`. | **Executado em produção em 2026-09-22** e conferido. Rodar de novo duplicaria os lançamentos (o Saldo inicial já está zerado, então hoje ele não faz nada útil). |
| `inspect-notice-dues.ts` | Somente leitura: lista os avisos "Já paguei" recentes com origem (portal × Tesouraria), flag de mensalidade da conta e da categoria e as baixas geradas. Usado na investigação da flag de mensalidade no comprovante registrado pela Tesouraria (Art. 002). | Investigação concluída em 2026-09-29. Seguro de rodar (não grava nada). |

Arquivados em 2026-10-01, a pedido do dono (eram os scripts que estavam fora do git).
