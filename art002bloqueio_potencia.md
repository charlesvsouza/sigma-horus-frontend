# Art. 002, Bloqueio pela Potência e Acordo de Regularização — remodelagem

> **ATUALIZAÇÃO 2026-10-03 (implementado localmente — ver AGENTS.md):** o dono refinou as regras depois desta spec e a implementação segue as decisões abaixo, não os pontos divergentes do texto:
> - O acordo nasce no **bloqueio** (não no desbloqueio); o irmão só volta com **tudo pago**, e o desbloqueio é um clique do Venerável/Administrador depois da quitação.
> - A **taxa de regularização é digitada** (sem `affiliationFee` por padrão, sem P1); multa/juros opcional **caso a caso**; **sem desconto**; padrão **à vista**, no máximo **3 parcelas**.
> - **Sem mensalidades do período bloqueado** no pacote: o bloqueio já interrompe os débitos novos; ao voltar a recorrência recomeça no próximo vencimento.
> - O pacote inclui **toda dívida em aberto** (vencida ou a vencer), pelo saldo.
> - Parcela vencida e não paga = **acordo quebrado**: alerta por e-mail ao Tesoureiro, Venerável e Administradores; o irmão segue bloqueado (sem religar nada sozinho).
> - Bloqueio = `Member.status = 'blocked'` (não um campo `blockedAt` à parte) e **sem conta-envelope**: cada dívida segue sendo a própria Account; a seção 6 (contabilidade) virou "repartir o pagamento em Payments por conta".
> - Quem bloqueia/libera: Venerável e Administrador. Quem registra pagamento: Tesouraria (accounts:write).

> Salvar na raiz do projeto como `ART002_BLOQUEIO_POTENCIA.md` (junto de `AGENTS.md` e
> `PROXIMA_SESSAO.md`). Para o Claude Code: "Leia `ART002_BLOQUEIO_POTENCIA.md` e implemente a
> Entrega 1 (seção 9)."

> Especificação para implementar no Sigma Horus. Base analisada: `main` em `3c0f071`.
> Antes de começar, leia `AGENTS.md`, `PROXIMA_SESSAO.md` e os arquivos citados abaixo.
> **Esta mudança reverte a decisão nº 9 de 19/09** em `PROXIMA_SESSAO.md` ("Art. 002 retém a
> recorrência e o Tesoureiro/Venerável libera"). Atualize esse item ao terminar.
> **A seção 6 (contabilidade do acordo parcelado) precisa ser analisada e decidida com o dono
> antes de codificar o acordo.** As seções 1 a 5 podem ser implementadas antes.

## 0. Registro da conversa (origem das decisões — 03/10/2026)

> Conversa do dono com o Claude (claude.ai), que analisou o repositório na `main` em `3c0f071`.
> As falas do dono estão transcritas como foram escritas; as respostas do Claude estão resumidas.

### 0.1 Pedido inicial do dono

> "preciso analisar algumas coisas. 1- quanto ao 002 que ocorre quando os membros da loja devem a
> mais de 60 dias, nessa situação ele não poderá deixar de ser convocado para as sessões e não
> poderá deixar de receber novos lançamentos de novas mensalidades ou débitos, em tese ele não
> poderá ficar "impedido" porém toda a estratégia de notificação e mensagem pertinentes a ele por
> ter entrado em 002 continuam. o fato é que o irmão estar já classificado como 002 na loja não está
> ligado ao aviso de que ele esteja inadimplente à potência pois isso é prerrogativa do venerável.
> desta forma precisamos entender que uma vez que o venerável decida enviar essa tal comunicação à
> potência ele deverá bloquear o cadastro do irmão. para isso penso que deveremos remodelar a
> estratégia e criar um bloqueio no cadastro, por exemplo: já sabemos quais irmãos estão em 002, o
> venerável clica em um check box junto ao cadastro do referido irmão a partir daí ele fica
> bloqueado, desta forma entende-se que o venerável já protocolou a sanção junto à potência e a
> partir daí não são gerados mais débitos para esse membro, porém os débitos passados continuam
> disponíveis para pagamento mediante acordo com o venerável e ou tesoureiro pois a partir desse
> momento já implicará na possível cobrança de valores referentes à regularização do 002."

### 0.2 Análise do Claude (resumo)

- Hoje o 002 é gravado como **situação do cadastro** (`Member.status = 'art_002'`) pelo cron
  `sync-art002` e pelas baixas. Com isso o irmão deixa de ser `active` e sai de tudo que filtra
  ativos: **convocação e livro de presença, frequência, cobrança em lote, comunicados, quadro
  social**. Além disso, a recorrência dele fica **retida** (`isHeldForArt002`). Ou seja, o sistema
  já aplica um "bloqueio" automático no 002, o oposto do que o dono quer.
- Proposta: separar o **Art. 002** (enquadramento calculado, só informativo, régua de notificação
  continua) do **bloqueio** (ato manual do Venerável, com histórico, protocolo e data do comunicado
  à Potência). Só o bloqueio para os débitos novos.
- Isso **reverte a decisão nº 9 de 19/09** do `PROXIMA_SESSAO.md` (002 retém a recorrência).
- Ficaram abertas: convocação do bloqueado (D1), lembretes (D2), mensalidades do período
  bloqueado no desbloqueio (D3), portal (D4), quem bloqueia (D5), bloqueio sem 002 (D6), quais
  débitos param (D7).

### 0.3 Resposta do dono (decisões)

> "o irmão bloqueado pelo venerável ou administrador de forma manual e não automática pelo 002, não
> será convocado pois o 002 implica em afastamento, ao desbloquear as mensalidades vencidas entram no
> pacote de acordo de regularização, e uma vez certificado pagamento do acordo concatena-se o valor
> do acordo com o valor da dívida e quita as mensalidades e ou qualquer débito que faça parte do
> pacote de acordo, inclusive no acordo deverá constar o valor da taxa de regularização, precisamos
> analisar isso pois no acordo deverá constar qualquer débito vencido em nome do irmão e a taxa de
> regularização."

Decisões fechadas por essa resposta:

| Ponto | Decisão |
|---|---|
| Quem bloqueia (D5) | **Venerável ou administrador**, sempre manual, nunca automático pelo 002 |
| Convocação do bloqueado (D1) | **Não é convocado**: o 002 com comunicado à Potência implica afastamento |
| Período bloqueado no desbloqueio (D3) | As mensalidades vencidas **entram no pacote do acordo de regularização** |
| Conteúdo do acordo | **Qualquer débito vencido** em nome do irmão + **taxa de regularização** |
| Quitação | Certificado o pagamento do acordo, **quita todas as mensalidades e débitos do pacote** |
| D2, D4, D6, D7 | Seguem as propostas padrão, salvo decisão em contrário |

### 0.4 Análise do Claude sobre o acordo (resumo)

- A renegociação atual (`api/members/[id]/renegotiate`) **não serve de base**: só considera
  mensalidades, usa o valor cheio das contas (ignora pagamentos parciais) e não tem lugar para a
  taxa nem para o período bloqueado. O acordo é um recurso novo (seção 5).
- A taxa de regularização **já existe** no plano de contas (`1.1.03 Taxa de Filiação /
  Regularização`, valor em `Lodge.affiliationFee`) e pode ser reaproveitada (pendência P1).
- **Ponto a analisar**: no acordo **parcelado**, cada parcela mistura categorias. Três opções na
  seção 6; recomendada a **A** (cada parcela paga é apropriada direto nos itens, em ordem), que
  chega ao resultado descrito pelo dono (pago o acordo, tudo quitado) com caixa e DRE corretos mês
  a mês.
- Implementação em **duas entregas**: (1) 002 informativo + bloqueio manual, que já pode ser feita;
  (2) desbloqueio com acordo, depois das decisões da seção 7 (principal: **P1**, a taxa de
  regularização fica com a loja ou é repassada à Potência).

## 1. Regra de negócio (decisões do dono, 2026-10-03)

São três conceitos distintos, que hoje o sistema mistura:

| | **Art. 002 (enquadramento)** | **Bloqueio (comunicado à Potência)** | **Acordo de regularização** |
|---|---|---|---|
| O que é | Condição financeira interna: débito vencido há mais de 60 dias | Sanção protocolada junto à Potência | Pacote que reúne toda a dívida do irmão para quitação |
| Como entra | **Automático**, calculado (não é gravado no cadastro) | **Manual**: Venerável ou administrador, por checkbox no cadastro | Criado no **desbloqueio** |
| Quem faz | O sistema | Venerável ou administrador | Venerável, administrador ou Tesoureiro (ver P4) |
| Convocação | **Continua convocado** | **Não é convocado** (o 002 implica afastamento) | Volta a ser convocado com o desbloqueio |
| Débitos novos | **Continuam sendo gerados** | **Param** (nenhum débito novo) | Recorrência retoma no próximo vencimento |
| Régua de notificação do 002 | **Continua** | Para os lembretes automáticos de vencidas | Cobrança passa a ser das parcelas do acordo |
| `Member.status` | **Não muda** (`active`) | **Não muda**: o bloqueio é um campo próprio | — |

Fluxo completo:

```
em dia → (60 dias) → Art. 002 [automático, só informa, régua continua]
       → Venerável/admin comunica à Potência e marca o bloqueio [manual]
       → (bloqueado: sem convocação, sem débitos novos)
       → desbloqueio = formaliza o ACORDO DE REGULARIZAÇÃO com tudo:
           débitos vencidos em nome do irmão
         + mensalidades do período bloqueado (que não foram geradas)
         + taxa de regularização
         (+ multa/juros, se a loja aplicar)
       → pagamento do acordo certificado → quita todos os itens do pacote
```

## 2. Como funciona hoje (o que precisa mudar)

O cron e as baixas gravam `Member.status = 'art_002'`, tirando o irmão de `active`. Como várias
partes do sistema filtram `status: 'active'`, o irmão em 002 hoje sofre um "bloqueio" automático:

| Onde | Arquivo | Efeito atual (indevido) |
|---|---|---|
| Troca automática de status | `src/lib/overdue.ts` (`syncMemberArt002Status`, `syncAllLodgesArt002`), chamada em `asaas-settlement.ts`, `recurring.ts`, `api/members/[id]/renegotiate`, rotas de pagamento/exclusão e cron `api/cron/sync-art002` | Grava `status = 'art_002'` |
| Recorrência retida | `src/lib/recurring.ts` (`heldMemberIds`), `src/lib/recurring-rules.ts` (`isHeldForArt002`) | Mensalidades novas **não são geradas** |
| Liberação manual | `api/members/[id]/release-recurring` + `releaseMemberRecurring` | Gera as parcelas atrasadas de uma vez |
| Convocação de sessão e livro de presença | `src/lib/session-convocation-server.ts` | **Não é convocado** |
| Frequência | `dashboard/sessoes/frequencia/page.tsx` | Não aparece |
| Cobrança em lote "ativos" | `api/invoices/bulk/route.ts` | **Não recebe** a cobrança |
| Mensagens para "ativos" | `api/messages/route.ts` | Não recebe comunicados |
| Quadro social, quadro de gestão, fundos da Hospitalaria, padrinhos | `membros/quadro-social`, `quadro-gestao`, `hospitalaria/fundos`, `candidatos` | Some ou aparece como não ativo |

Ficam **como estão**: `src/components/art002-alert.tsx` (alerta no painel), o relatório
`relatorios/inadimplencia`, os lembretes automáticos de `lib/notifications.ts` (só passam a pular o
bloqueado) e o toggle `Lodge.art002Enabled`.

## 3. Bloqueio — modelo de dados

```prisma
model MemberBlock {
  id                   String    @id @default(cuid())
  lodgeId              String
  memberId             String
  blockedAt            DateTime  @default(now())
  blockedById          String    // User (Venerável ou administrador)
  powerProtocol        String?   // nº do protocolo/ofício na Potência
  powerSentAt          DateTime? // data do comunicado (data-só-dia)
  note                 String?
  overdueDaysAtBlock   Int       // fotografia no momento do bloqueio
  overdueAmountAtBlock Float
  liftedAt             DateTime?
  liftedById           String?
  liftNote             String?
  agreementId          String?   // acordo formalizado no desbloqueio
  @@index([lodgeId, memberId])
  @@index([lodgeId, liftedAt])
}
```

- Bloqueio vigente = `liftedAt IS NULL`. **No máximo um vigente por membro**: índice único parcial
  na migration (`UNIQUE ("lodgeId","memberId") WHERE "liftedAt" IS NULL`). RLS no padrão do projeto.
- Campo desnormalizado `Member.blockedAt DateTime?`, atualizado na mesma transação, para os `where`.
- Migração dos dados: `UPDATE "Member" SET status = 'active' WHERE status = 'art_002';`, sem criar
  bloqueio (o Venerável decide quem bloquear). Registrar no `AuditLog` quantos foram revertidos.
- `src/lib/member-status.ts`: tirar `art_002` de `MEMBER_STATUSES` (sai do formulário), mantendo o
  rótulo para registros antigos.

## 4. Bloqueio — mudanças por área

### 4.1 Parar de gravar o status
- `overdue.ts`: `syncMemberArt002Status` / `syncAllLodgesArt002` deixam de alterar `status`;
  `getMemberDuesStatus` e `getLodgeOverdueDuesReport` ficam como estão.
- Remover o cron `api/cron/sync-art002` (e a entrada no `vercel.json`) e as chamadas de sincronização.

### 4.2 Débitos novos
- Recorrência: trocar `isHeldForArt002` por `isBlocked` (002 sem bloqueio gera normalmente).
  As ocorrências do período bloqueado **não são geradas** (entram no acordo, seção 5).
- `api/invoices/bulk`: excluir `blockedAt != null` nos escopos `active` e `all`.
- Cobrança/lançamento individual (`api/invoices/route.ts`, `api/accounts/route.ts`, taxas de grau):
  **409** para bloqueado ("Irmão bloqueado por comunicação à Potência. A regularização é feita pelo
  acordo no desbloqueio.").
- `release-recurring` + `releaseMemberRecurring`: remover (o 002 não retém mais; o período
  bloqueado é tratado pelo acordo).

### 4.3 Convocação e listas
- `session-convocation-server.ts` (convocação e livro de presença), `sessoes/frequencia`,
  lembretes automáticos de `notifications.ts`: excluir `blockedAt != null`. O irmão em 002 sem
  bloqueio volta a ser incluído (continua `active`).
- `api/messages`: bloqueado fica fora do padrão "ativos", mas pode ser escolhido individualmente.
- Cadastro, quadro social e relatório: badges **"Art. 002 — N dias"** (âmbar, derivado) e
  **"Bloqueado — Potência"** (vermelho), com data e protocolo no detalhe.
- Portal: o bloqueado mantém acesso para ver e pagar, com aviso do bloqueio.

### 4.4 Interface e permissões
- Cadastro do irmão e linha do relatório de inadimplência: ação **"Comunicado à Potência —
  bloquear cadastro"**, habilitada só se o irmão estiver em 002 e não bloqueado. Confirmação com
  dias/valor em aberto, protocolo, data do comunicado e observação.
- RBAC: nova ação (ex.: `members:block`) para `venerable` e `admin`; Tesoureiro só vê.
  Testes em `rbac.test.ts`.
- Rotas: `POST /api/members/[id]/block` e o desbloqueio (seção 5). Guarda de assinatura como nas
  demais rotas de escrita (`subscription-routes.test.ts` falha se faltar). `AuditLog` em tudo.

## 5. Acordo de regularização

### 5.1 Por que não reaproveitar a renegociação atual
`api/members/[id]/renegotiate` não serve de base: só considera **mensalidades** (deixa de fora
eventos, taxas etc.), usa o **valor cheio** das contas (ignora pagamentos parciais — pendência já
registrada) e apenas redistribui as mesmas contas em parcelas, sem lugar para a taxa nem para as
mensalidades do período bloqueado. Ela pode continuar existindo para o caso comum (irmão em 002 sem
bloqueio), mas o acordo é um recurso novo.

### 5.2 Composição do pacote (montada pelo sistema, revisada por quem formaliza)

| Item | Origem | Valor |
|---|---|---|
| **Débitos vencidos** | Toda `Account` `RECEIVABLE` do irmão, **qualquer categoria**, não paga, com vencimento passado | **Saldo em aberto** = valor − pagamentos já feitos (corrige o problema da renegociação) |
| **Mensalidades do período bloqueado** | Ocorrências das recorrências do irmão entre o bloqueio e o desbloqueio, que não foram geradas | Valor da recorrência; uma linha por competência (mês) |
| **Taxa de regularização** | Padrão `Lodge.affiliationFee`, categoria `1.1.03 Taxa de Filiação / Regularização` (ver P1) | Editável na formalização |
| Multa/juros (opcional) | `sumLateCharges` com as regras da loja (`lateFeePercent`, `lateInterestPercentMonth`) | Calculado, pode ser dispensado (ver P3) |
| Desconto (opcional) | Concedido na formalização | Ver P3 |

Débitos **a vencer** (ainda não vencidos) **não** entram: seguem normais.

### 5.3 Modelo de dados

```prisma
model RegularizationAgreement {
  id               String    @id @default(cuid())
  lodgeId          String
  memberId         String
  blockId          String    // MemberBlock levantado por este acordo
  status           String    @default("active") // active | paid | broken | canceled
  debtsTotal       Float     // soma dos saldos dos débitos vencidos
  blockedDuesTotal Float     // mensalidades do período bloqueado
  regularizationFee Float
  lateCharge       Float     @default(0)
  discount         Float     @default(0)
  total            Float
  installments     Int       // 1 = à vista
  firstDueDate     DateTime
  createdById      String
  paidAt           DateTime?
  brokenAt         DateTime?
  notes            String?
  items            RegularizationAgreementItem[]
}

model RegularizationAgreementItem {
  id          String  @id @default(cuid())
  agreementId String
  accountId   String  // a Account do item (existente ou criada pelo acordo)
  kind        String  // overdue_debt | blocked_period_dues | regularization_fee | late_charge
  competence  String? // "2026-05" para mensalidade do período bloqueado
  openAmount  Float   // saldo no momento do acordo
  allocated   Float   @default(0) // quanto já foi apropriado pelos pagamentos
}
```

Na `Account`, acrescentar `agreementId String?` (item do pacote) e `agreementInstallment Int?`
(quando a conta é parcela do acordo, conforme a opção da seção 6).

### 5.4 Regras
- **Desbloqueio = formalização do acordo**, num só ato: fecha o `MemberBlock` (`liftedAt`,
  `agreementId`), cria o acordo e as parcelas, e a recorrência do irmão recomeça no **próximo
  vencimento após hoje** (sem gerar retroativo: o retroativo está no pacote).
- **Itens do pacote ficam "em acordo"**: saem do cálculo do 002, do relatório de inadimplência
  como vencidos e dos lembretes automáticos (senão o irmão continuaria enquadrado). Quem passa a
  contar para o 002 são as **parcelas do acordo**: se uma parcela passar de 60 dias, ele volta ao
  002 normalmente, e o Venerável decide se bloqueia de novo.
- **Mensalidades do período bloqueado** viram `Account` (`isDues`, categoria Mensalidades,
  `kind = blocked_period_dues`, competência no título: "Mensalidade 05/2026 — período de
  bloqueio"). Atenção a `findClosedTermForDate`: se a competência cair num veneralato encerrado,
  não dá para lançar com aquela data. Proposta: vencimento = data do acordo, competência guardada
  no item.
- **Cobranças antigas no Asaas** dos itens do pacote são canceladas (reaproveitar o padrão de
  `retargetInvoices` + `cancelAsaasCharges`, inclusive o caso do Pix agrupado), para ninguém pagar
  o boleto antigo.
- **Pagamento certificado do acordo quita todos os itens do pacote.** À vista é direto: uma baixa
  quita todos os itens. **Parcelado depende da decisão da seção 6.**
- **Quebra do acordo** (P5): itens com saldo voltam a ficar vencidos com os vencimentos originais;
  o que já foi pago continua apropriado.
- Corrida: se o webhook do Asaas baixar um boleto antigo de um item já no pacote (pago antes de o
  cancelamento chegar), abater do saldo do acordo e avisar o Tesoureiro.

### 5.5 Interface
- Ação **"Levantar bloqueio e formalizar acordo"** (Venerável/admin): mostra o pacote montado,
  com cada item, saldo, competência e totais; campos para taxa, multa/juros, desconto, número de
  parcelas, 1º vencimento e observação; e uma prévia das parcelas.
- Termo de acordo para imprimir/assinar (papel timbrado: `lib/letterhead.ts` +
  `components/report/official-document.tsx`) com a lista de itens, a taxa, as parcelas e as
  assinaturas do irmão, do Venerável e do Tesoureiro.
- Detalhe do acordo: itens, parcelas, apropriação e status; no portal do irmão, as parcelas.

## 6. ⚠️ A ANALISAR: contabilidade do acordo parcelado

Cada parcela mistura itens de categorias diferentes (mensalidade, evento, taxa), e o livro caixa,
o DRE e o balancete leem os `Payment` por `Account` → `ChartAccount`. É preciso decidir **em qual
categoria e quando** entra cada real recebido. Atenção: `Payment` exige `accountId` e `Invoice`
exige `accountId`, então uma cobrança não pode existir "solta".

| Opção | Como funciona | Prós | Contras |
|---|---|---|---|
| **A. Apropriação a cada parcela (recomendada)** | A parcela é uma conta-envelope (categoria de trânsito, não receita). Ao ser paga, o sistema registra os `Payment` **direto nos itens**, em ordem (FIFO pelo vencimento, ver P2), até somar o valor da parcela, e marca a parcela como liquidada sem `Payment` próprio (o dinheiro entra uma vez só) | DRE e caixa corretos mês a mês e por categoria; quebra do acordo fica limpa; ao pagar a última parcela, todos os itens estão quitados (é o que o dono descreveu) | Precisa de um gancho na baixa manual e no webhook do Asaas (`settleAsaasInvoicePayment`) para desviar a parcela-envelope |
| B. Itens reagendados (estilo renegociação) | Cada item vira parcela com nova data; parcelas = itens | Simples, sem envelope, categorias corretas | Parcelas de valores irregulares e em número fixo (= nº de itens); não permite "3x iguais" |
| C. Quitação só no final | Parcelas caem numa conta de trânsito; ao pagar a última, transfere para as categorias e quita os itens | É a descrição literal ("certificado o pagamento, quita") | Receita só aparece meses depois no DRE; na quebra, o dinheiro fica parado no trânsito |

**Recomendação: opção A.** O resultado final é o mesmo que o dono descreveu (pago o acordo, tudo
quitado), mas com a contabilidade correta durante o parcelamento. À vista funciona igual nas três.
Antes de codificar, confirme com o dono e verifique no código: `lib/asaas-settlement.ts`, a rota
de baixa manual de pagamento, o Pix agrupado e como o balancete/DRE leem os pagamentos.

## 7. Decisões pendentes

| # | Pergunta | Proposta padrão |
|---|---|---|
| P1 | A taxa de regularização do 002 é a mesma da filiação (`affiliationFee`, conta 1.1.03) ou um valor próprio? É receita da loja ou repassada à Potência (conta a pagar)? | Valor próprio `Lodge.art002RegularizationFee`, mesma conta 1.1.03; se houver repasse, gerar a conta a pagar à Potência junto |
| P2 | Ordem de apropriação dos pagamentos (opção A) | Taxa de regularização primeiro (é o que libera junto à Potência), depois débitos do mais antigo para o mais novo |
| P3 | Multa/juros e desconto no acordo: obrigatórios, opcionais? Quem pode dar desconto? | Multa/juros opcionais, sugeridos pelo sistema; desconto só pelo Venerável, com justificativa |
| P4 | O Tesoureiro pode formalizar o acordo ou só o Venerável/admin (que levantam o bloqueio)? | Tesoureiro monta a proposta; Venerável/admin formaliza (é o desbloqueio) |
| P5 | Quebra do acordo: após quantos dias de parcela em atraso? Volta a bloquear sozinho? | Nunca automático: parcela vencida conta para o 002 como qualquer débito; o Venerável decide |
| P6 | Limite de parcelas | Até 6, como nas taxas de grau |
| P7 | Pode levantar o bloqueio **sem** acordo (ex.: Potência dispensou)? | Sim, só Venerável/admin, com justificativa obrigatória; o pacote fica para depois |

## 8. Testes

- Puros: `canBlock` (papel venerable/admin, sem 002, já bloqueado); composição do pacote (saldo
  com pagamento parcial, qualquer categoria, exclui a vencer, competências do período bloqueado com
  virada de mês/ano e fuso de Brasília); próximo vencimento após o desbloqueio; apropriação FIFO
  (centavos, último item, taxa primeiro).
- `recurring-rules.test.ts`: 002 sem bloqueio **gera**; bloqueado **não gera**.
- Cobrança em lote e convocação: 002 incluído; bloqueado excluído.
- Itens "em acordo" fora do 002; parcela vencida há 61 dias recoloca no 002.
- Migração `art_002` → `active` sem criar bloqueio.
- Webhook Asaas pagando parcela do acordo (envelope) e pagando boleto antigo de item do pacote.

## 9. Ordem sugerida

1. Migration do bloqueio (tabela, índice parcial, `Member.blockedAt`, reversão `art_002`).
2. `member-block.ts` + testes; parar de gravar o status; trocar a retenção (4.1, 4.2).
3. Rotas de bloqueio + RBAC + auditoria; travas e convocação (4.2, 4.3); interface (4.4).
   **Entregável 1**: 002 só informativo, bloqueio manual funcionando.
4. Decidir a seção 6 e as pendências da seção 7 com o dono.
5. Migration do acordo; `regularization-agreement.ts` (montagem do pacote e apropriação, puro) +
   testes; rotas; gancho na baixa/webhook; interface e termo.
   **Entregável 2**: desbloqueio com acordo.
6. Manual (`components/manual-book.tsx`), `AGENTS.md`, `PROXIMA_SESSAO.md` (decisão nº 9).
7. `npx tsc --noEmit`, `npm test`, eslint; migrations em produção com
   `env -u DATABASE_URL -u APP_DATABASE_URL npx prisma migrate deploy` antes do deploy.

## 10. Critérios de aceite

- Irmão com 61+ dias em aberto continua **ativo, convocado e recebendo débitos novos**, aparece
  como "Art. 002" e recebe a régua de notificação.
- Só Venerável/admin bloqueiam, e só quem está em 002; o ato fica no histórico com protocolo.
- Bloqueado: não é convocado e não recebe débito novo de nenhum tipo; débitos antigos continuam
  visíveis e pagáveis.
- Desbloqueio formaliza o acordo com **todos** os débitos vencidos (pelo saldo), as mensalidades do
  período bloqueado e a taxa de regularização; a recorrência volta no próximo vencimento.
- Pago o acordo, **todos os itens do pacote ficam quitados**, e o caixa/DRE mostram cada valor na
  categoria certa.
