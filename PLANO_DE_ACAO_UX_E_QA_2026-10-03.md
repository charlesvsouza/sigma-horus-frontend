# Plano de ação — UX/UI + rodada de debug (2026-10-03)

> ⚠️ Atualização de 2026-10-03 (noite): este plano já foi para a `main` (as correções de debug estão publicadas; o Toast e os alvos de toque também — componente `ui/toast.tsx` usado por 24 telas e regra `pointer: coarse` em `globals.css` + `Button`). Falta, da parte 2: P1.1 (índice de Relatórios), P1.4 (portal) e os itens P2/P3.
> Base de verificação: tsc ✔ · eslint 0 erros (3 avisos antigos) · prisma validate ✔ · **359 testes** passando.

## Como ler

- **Feito** = já está no commit local, testado.
- **Decidir** = muda regra de negócio/contábil; não mexi sozinho.
- **Fazer** = proposta de trabalho para a próxima sessão.

---

## Parte 1 — Debug (bugs "embaixo do tapete")

### Feito (commits `4fc5cf4` e o seguinte, ambos só na branch local)

| # | Problema | Impacto real | Correção |
|---|---|---|---|
| 1 | Cadastro de loja por convite (`/api/lodges`) só validava no navegador | Quem chamasse a API direto criava administrador com senha de 1 caractere, endereço inválido; sem limite de tentativas | Valida no servidor (mesmas regras da tela) + limite por IP; `signup/complete` idem |
| 2 | Convite era "consumido" depois de criar a loja, ignorando o resultado | Dois cadastros ao mesmo tempo com o **mesmo convite** criavam duas lojas | Consumo atômico dentro da transação; o segundo recebe "convite já utilizado" |
| 3 | `masonic-degree` (tempo de Ordem, idade, elegibilidade a Maçom Remido) lia datas "só dia" no fuso do aparelho | No navegador do Brasil o resultado era 1 dia diferente do servidor: o mesmo irmão podia aparecer com "25 anos" numa tela e "26" noutra no dia do aniversário | Lê a data em UTC e o "hoje" no calendário de Brasília; 2 testes novos, conferidos em 3 fusos |
| 4 | **Data de pagamento aparecia um dia antes** em extratos, contas pagas/recebidas, conciliação, transferências, XLSX, CSV e e-mail | `Payment.paidAt` mistura data digitada (00:00 UTC) e instante (baixa do Asaas). Em produção, **11 pagamentos da AMM** estão no formato "digitada" | Novo `formatDayMixed` (reconhece os dois formatos); aplicado em 8 pontos; **nenhum dado gravado foi alterado** |
| 5 | Cron `purge-terminated` anonimiza membros sem volta | Se alguém marcasse `terminatedAt` por engano numa loja ativa, todos os membros seriam anonimizados | Trava: nunca toca em loja com assinatura ativa/trial; devolve a lista de ignoradas |
| 6 | `/verificar/<código com %>` | Endereço mal digitado derrubava a página com erro 500 | Decodificação segura |
| 7 | Dois cliques em "Criar plano" de taxa de grau | Podia criar 2 planos ativos do mesmo tipo para o mesmo irmão | Trava consultiva (`lockKey`), igual à baixa de pagamento |


### Verificado e está certo (não precisa mexer)

- **163 rotas de API**: todas têm guarda de acesso (as 20 que o varredor marcou usam helpers `gate/access` ou são públicas por desenho — cadastro, esqueci a senha, modelo CSV).
- **7 crons**: todos exigem `CRON_SECRET`/token da plataforma; recorrência é idempotente (trava + conferência da data).
- **Cancelar plano de cartão**: testei na sandbox do Asaas — apagar parcela a parcela e o parcelamento inteiro funcionam (cliente e parcelamento de teste apagados depois).
- **Portal do irmão**: nenhuma rota aceita `memberId` vindo do navegador; sempre sai da sessão.
- **`dev.db`** (SQLite antigo, versionado no git): só estrutura de tabelas, **sem e-mails, CPFs ou senhas**.
- **Webhook do Asaas**: autentica por token da loja; idempotente; eco de "recebido em dinheiro" é ignorado de propósito.

### Decidir (preciso de você)

1. **`paidAt` misto.** Hoje manual = meia-noite UTC e Asaas = instante real. O `formatDayMixed` esconde a diferença na tela, mas **relatórios por mês/fechamento** (`closing-report`, balancetes, DRE) agrupam em UTC: um Pix pago às 22h do último dia do mês cai no mês seguinte. Opções: (a) gravar sempre "dia de Brasília" (data só-dia) também nas baixas do Asaas; (b) gravar tudo ao meio-dia de Brasília e fazer backfill dos 11 da AMM; (c) deixar assim. **Recomendo (a)** — pequena e sem backfill.
2. **Estorno/chargeback no Asaas depois de baixado.** O webhook volta a fatura para "pendente", mas **o Payment já lançado e a conta paga continuam**. Os livros dizem "recebido" e a cobrança "em aberto". Política possível: lançar um estorno (Payment negativo) + avisar o Tesoureiro; ou só avisar e deixar a baixa manual. É decisão contábil.
3. **Número de cobrança `COB-AAAAMM-`** usa o mês em UTC (virada às 21h de Brasília). Cosmético; resolve junto com o item 1.

### Fazer (baixo risco, próxima sessão)

- 48 rotas fazem `await request.json()` sem `catch`: JSON inválido vira 500. Criar `readJson()` e aplicar em lote.
- 3 avisos de ESLint (`window.location.href`).
- `git rm dev.db` (arquivo morto).
- Teste de ponta a ponta do cartão: **a sandbox do Asaas é uma só para as duas lojas**, e o webhook tem um token por conta → registrar o webhook de uma loja invalida o da outra. Para testar as duas, usar uma conta de sandbox para cada.
- Revisar telas novas de maior risco com teste real no navegador: Taxas de grau (plano + cartão), Ficha do candidato, Certificados.

---

## Parte 2 — Plano de UI/UX (critique com o impeccable)

> **Limite honesto desta análise:** foi feita **lendo o código** e rodando varreduras (o detector do impeccable não achou anti-padrões; não consegui subir o app com dados — sem Docker e sem senha de demo). Faltam captura de tela e teste com usuário. A nota abaixo é uma estimativa por heurísticas, não substitui a crítica visual.

**Estimativa:** ~29/40 (era 27/40 em 19/09). O sistema é consistente e tem identidade; os pontos fracos são **carga cognitiva do menu da Tesouraria**, **feedback de ações** e **alvos de toque/teclado no celular** — justo onde o irmão e o Venerável (sêniores, no celular) mais usam.

### P1 — Alto impacto

1. **Tesouraria tem 25 itens em 3 grupos (15 só em "Relatórios").** O Tesoureiro conhece o caminho, mas o Venerável não. Proposta: página-índice "Relatórios" com cartões por pergunta ("O que entrou?", "Quem está devendo?", "Fechar o mês") e deixar o menu lateral com 1 entrada. A paleta `Ctrl+K` já existe — divulgar no cabeçalho do celular também.
2. ✅ **FEITO (2026-10-03) — Feedback de ação.** Não há toast; o retorno é um `Alert` na tela e só 3 pontos usam `aria-live`. Resultado: salvar/pagar pode passar despercebido (principalmente no celular, com a mensagem fora da tela) e leitor de tela não anuncia. Proposta: um componente `Toast` único (sucesso/erro, 5 s, `aria-live`) usado por todo formulário.
3. ✅ **FEITO (2026-10-03) — Alvos de toque.** 49 botões com `py-1`/`h-6`/`h-7` (< 44 px). Para público sênior no celular, subir o mínimo para 40–44 px nas telas de portal, cobrança e sessões (presença).
4. **Portal do irmão (`dashboard/portal/page.tsx`, 655 linhas).** É a tela mais vista pelos 31 obreiros. Fazer o "teste dos 5 segundos": quanto eu devo / como pago / meu comprovante. Quebrar em componentes e deixar o botão **Pagar** como única ação em ouro.

### P2 — Médio

5. **Estados vazios**: 19 textos soltos "Nenhum…" fora do `EmptyState` (34 usam). Padronizar com a voz de cada ofício (já definida no DESIGN.md).
6. **Campos**: ~120 `placeholder` em formulários — auditar quais não estão dentro de `Field` (rótulo some ao digitar).
7. **`type="number"` sem `inputMode`** (32): em valores em reais usar `inputMode="decimal"` para o teclado numérico do celular.
8. **125 dicas por `title=`** não aparecem no toque; as que carregam informação essencial viram texto visível ou ícone com legenda.
9. **Relatórios com `h1` duplicado** (cabeçalho de impressão + tela): usar um só `h1` e marcar o outro como `aria-hidden`/`print-only`.
10. **Tabelas**: 8 arquivos com `<table>` sem `overflow-x-auto` direto (os 2 que conferi são folha de impressão — conferir os outros 6).

### P3 — Refinamento

11. Fio de prumo e Cinzel estão bem usados; **cuidado com o ouro**: em telas com muitos botões primários (Cobranças), reduzir a 1 por vista.
12. Tema Papiro: rodar uma verificação de contraste automática (ouro `#B8860B` sobre `#F5F0E8` em texto pequeno).
13. Landing: separar métricas de "Persuade" (landing) das de "Operate" (painel) para não misturar decisões.

### Próximos passos sugeridos (ordem)

1. Você decide os itens 1 e 2 de "Decidir" (30 min de conversa).
2. Eu faço a bateria "Fazer" de baixo risco + commit na branch e você confere antes do push.
3. Sessão visual: rodar o app local com a loja demo, capturar 375 px nos dois temas e refinar com `critique` → `polish`/`harden` em Contas, Cobranças, Portal e Taxas de grau.
4. Toast + alvos de toque (P1.2 e P1.3) como uma única entrega, por ser transversal.

## O que **não** foi feito (de propósito)

- Nenhum push, nenhum deploy, nenhuma migration, nenhuma alteração de dados em produção.
- Nenhuma mudança de regra contábil (itens "Decidir").
- Nenhuma mudança visual no tema/gradiente (vetado pelo dono em 09/2026).
- A sandbox do Asaas foi usada só para o teste de cancelamento (tudo apagado).
