# Retomada — Sigma Horus (pausa em 2026-09-19)

> Ponto de retomada da sessão de 18–19/09/2026. Tudo abaixo já está **commitado e enviado** para `main`
> (HEAD `f51a3d5`), com as 3 migrations aplicadas no banco de produção (Railway). Manual do usuário na **v1.29**.
> Testes: 116 passando · `tsc` e `eslint` limpos.

## 1. Sessões marcadas para a volta

### 1.1 Crítica de design com a skill `impeccable` — FEITA em 19/09 (repasse geral, 27/40)
Resumo em `.impeccable/critique/2026-09-19T18-54-36Z__src-app-dashboard.md`. **Aplicado** (sem tocar no tema): rótulos visíveis (componente `Field`),
Contas/Cobranças abrindo pela lista, Visão geral com saldo em caixa + posição em aberto (e correção do cálculo de a receber/recebido),
um dourado por vista, tabelas com rolagem no celular, um `h1` por tela, "Pular para o conteúdo", `loading.tsx`/`error.tsx`, texto mínimo de 12px, `Alert` no lugar de alertas soltos.
**Ficou de fora:** `bg-gradient-to-*` → `bg-linear-to-*` (dono vetou estilo), `h1` duplicado nos relatórios com cabeçalho de impressão (13 telas), `<script>` anti-flash do tema no layout.
Abaixo, a lista original de telas para referência (Fundos, Tarifas etc. já passaram pelo repasse; uma nova rodada pode medir de novo):
Rodar `/impeccable` (modo *critique*) — a última foi em 2026-06-30 (nota ~28/40, ver `impeccable-critique-2026-06-30.md`
e `design_refinado.md`). Telas **novas desta sessão**, nunca criticadas:

- **Hospitalaria → Fundos (Tronco e Doações)** — `dashboard/hospitalaria/fundos/` (densidade de tabelas, hierarquia dos KPIs, impressão em PDF)
- **Relatórios → Tarifas de cobrança (Asaas)** — `dashboard/relatorios/tarifas/`
- **Configurações da loja → Recebimento das cobranças** — `dashboard/configuracoes/CollectionSettings.tsx` (escolha Modo Loja/Modo Asaas)
- **Cobranças** — cartões "Modo Loja"/"Modo Asaas", formulário por categoria, badges de situação
- **Contas** — campos "Pago" (data + conta/caixa), selos de situação, "Aguardando Asaas"
- **Cadastros financeiros** — finalidade da conta (fundos)
- **Redefinir senha** — `app/redefinir-senha/`, tela de login ("Esqueceu a senha?")
- Diálogo "Recebido fora do Asaas" (`useConfirm`) em Contas e Pagamentos

Pendências herdadas do uplift de design (ver `AGENTS.md`): confirm dialog assíncrono nas ações destrutivas,
`useTransition`/validação inline, auditoria de cards. Avisos do IDE: `bg-gradient-to-*` → `bg-linear-to-*` (Tailwind v4).

### 1.2 Nova passada de debug ("pescar problemas ocultos")
**Feito em 19/09 (parcial — itens 1, 2, 4, 6 parcial, 9 e 10 parcial):** RLS verificado no banco (33 tabelas com FORCE, papel da app sem BYPASSRLS, fecha sem tenant);
ataque cruzado entre lojas (usuário da loja B em ids da loja A): nada vazou nem mudou; matriz de permissões por rota × papel; concorrência; integridade dos dados reais (só resta a conta de R$ 40 do Tronco, item 2.2).
**Corrigido:** Stripe (portal/troca de plano/checkout) só Administrador — antes qualquer papel, inclusive Membro, abria o portal de cobrança; `reports/export` exige leitura de Contas;
"Processar recorrentes" exige escrita em Contas; baixa em dobro por clique duplo (trava `lib/locks.ts`); numeração de cobrança duplicada; aprovação repetida de transferência;
webhook/reconciliação do Asaas idempotentes; cancelamento de trial abandonado que falhava em silêncio; reemissão no Asaas sem cancelar a cobrança anterior; CSV sem injeção de fórmula (`lib/csv.ts`);
upload de foto com lista de tipos e limite de 5 MB e 400 em vez de 500; contagem de presentes na lista de Sessões.
**Fechado no mesmo dia (decisão do dono: cada cargo na sua área; cada loja só enxerga a si mesma):** recurso **Auditoria** na matriz de Permissões (padrão só Administrador; outro cargo só se o Admin liberar; loja já personalizada usa o padrão para recurso sem linhas — `lib/rbac.ts`);
`GET /api/lodge` devolve só a identificação a quem não lê Contas; `backfill-office-rites` só da própria loja; PATCH/DELETE com id inexistente/de outra loja → 404 (sem auditoria falsa); tokens de cron/plataforma em tempo constante e **sem `?token=` na URL** (`lib/platform-auth.ts`);
`withTenant` com `maxWait` 10 s e transação de 15 s (rajadas viram fila, não 500); datas de pagamento/criação com fuso de Brasília; migration `20260919150000` (revoga `sigma_app` de Invitation/BackupLog/_prisma_migrations + 12 índices) **já aplicada em produção**.
**Ainda aberto:** (1) restauração real de backup — precisa das credenciais do R2 (só na Vercel) e de um banco vazio; (2) recorrência automática continua sem cron (decisão 9 da seção 3); (3) Stripe webhook revisado: só atualiza registros (idempotente), mas eventos fora de ordem podem regredir o estado — sem correção; (4) pool = 5 conexões por instância (`DB_POOL_MAX`) — observar sob carga real.
Repetir o método da varredura de 18/09 (rotas sem guarda, RLS, integridade por SQL, algoritmos, E2E com servidor local +
loja de teste), agora **além** do que já foi corrigido. Roteiro sugerido:

1. **Isolamento entre lojas (RLS)**: testar leituras/escritas cruzadas com dois usuários de lojas diferentes em *todas* as rotas novas (fundos, tarifas, `api/lodge/collection`, `api/documents`).
2. **Matriz de permissões**: cada rota nova/alterada × cada papel (admin, venerável, tesoureiro, secretário, hospitaleiro, membro) — hoje só Membro foi testado nos documentos.
3. **Fluxo do dinheiro ponta a ponta** por papel e por modo (Loja/Asaas): cobrança → baixa → extrato → DRE → fechamento do veneralato → trava de período.
4. **Concorrência**: numeração de cobranças (`COB-AAAAMM-NNNN`, sem unique), clique duplo em baixa, dois webhooks simultâneos do Asaas.
5. **Datas/fuso**: `paidAt`, `createdAt`, `issuedAt` (instantes) ainda formatados no fuso do navegador; virada de mês/ano em relatórios; DST (não há, mas checar).
6. **Cron jobs**: idempotência e falha parcial (`daily-notifications`, `sync-art002`, `generate-balancete`, `purge-terminated`, backup); recorrência **não está agendada**.
7. **Backup/restore**: testar restauração real em banco vazio (nunca foi feita com `--yes`).
8. **Stripe**: idempotência do webhook, downgrade agendado, trial abandonado.
9. **Erros engolidos** (32 `catch` silenciosos) — o padrão já derrubou a baixa do webhook uma vez (FK do `AuditLog`); revisar os que ficam dentro de `withTenant`.
10. **Import de membros (CSV/XLS)** e **upload de documentos** com arquivos ruins/grandes; XSS/CSV-injection nos exports.
11. **Desempenho**: índices, listas sem `take`, `export`/backup lendo tudo em memória, tempo de build.
12. **Acessibilidade e mobile** das telas novas; e-mails (templates, links, `NEXT_PUBLIC_APP_URL`).

## 2. Pendências (o que falta fazer)

### 2.1 Recebimentos / Asaas (diretriz do dono — ver memória `collection-mode-asaas-fees`)
- [ ] **Tim Maia** está em Modo Asaas **sem conta de repasse** → emissão responde "escolha a conta corrente". Cadastrar uma conta corrente e escolher em *Configurações → Recebimento das cobranças*.
- [ ] **Baixa assistida por extrato (OFX) no Modo Loja**: importar extrato e propor qual cobrança aberta casa com cada crédito (valor + nome); reaproveitar `lib/bank-reconciliation`.
- [ ] **Passo "modo de recebimento" no cadastro inicial** (onboarding) — hoje só em Configurações.
- [ ] **Repasse da tarifa ao irmão** (adiado): linha separada "Tarifa de cobrança", método fixo (Pix/boleto), tabela de tarifa por loja, isenção (ex.: Maçom Remido), categoria de ressarcimento. O relatório de tarifas já tem a coluna "repassada" (hoje 0).
- [ ] **Cobrança marcada "recebida em dinheiro" direto no painel do Asaas** cai hoje na conta corrente de repasse (pode ser dinheiro em espécie). Decidir e tratar (webhook/reconcile com status `RECEIVED_IN_CASH`).
- [ ] **Cobranças antigas emitidas como `UNDEFINED`** ainda podem ser pagas no cartão (cai em ~32 dias) — relatório de tarifas sinaliza; decidir se reemite/cancela.
- [ ] Tarifa de um pagamento **real** (não simulado) ainda não observada — o sandbox só confirmou o líquido da cobrança pendente (R$ 5 → líquido R$ 4,01).
- [ ] Possível tarifa de **transferência** do Asaas para o banco: confirmar e, se existir, lançar como despesa.

### 2.2 Fundos (Tronco e Doações)
- [ ] **Saldo inicial** dos dois caixas está **0** nas duas lojas — ajustar em *Cadastros financeiros → Editar*.
- [ ] **Conta de R$ 40 sem pagamento** (`cmu7f50qa000404jytigacbpb`, "Tronco de Beneficência", loja *Antônio Monteiro Martins 139*, status Pago): abrir em *Contas → Editar*, escolher o caixa e a data, salvar (gera o pagamento que falta).
- [ ] Lançamentos antigos do Tronco em outra conta aparecem em **Conferência** — corrigir por transferência entre contas (exige aprovação do Venerável).
- [ ] Custeio de campanha limitado ao saldo do **caixa** do Tronco (novo) — comunicar aos hospitaleiros.

### 2.3 Itens da varredura de 18/09 ainda abertos
- [ ] **Dependências**: `next` 16.2.9 → 16.3.5 (crítica); `next-auth`/`@auth/core` (crítica, correção disponível). *Não* aplicar o "downgrade" do Prisma sugerido pelo `npm audit`.
- [ ] **Índices ausentes**: `Payment.accountId`/`lodgeId`, `Invoice` (todos), `Account(lodgeId, dueDate)`, `Member(lodgeId)`, `AuditLog`/`MessageLog` (`lodgeId`, `createdAt`); FKs de cascata (exclusão de loja).
- [ ] **Assinatura vencida só é imposta na tela** (layout) — APIs não checam.
- [ ] **Recorrência automática**: `api/cron/recurring-invoices` não está em `vercel.json`; hoje só roda por clique em "Processar recorrentes".
- [ ] **Float → Decimal**: comparações e somas já usam centavos (`lib/money`), mas o schema segue `Float`.
- [ ] Listagens **sem limite/paginação** (~40 rotas/páginas) e `lodges/export` + backup lendo tudo em memória.
- [ ] **Número de cobrança** sem restrição de unicidade (corrida em cliques simultâneos).
- [ ] **Renegociação** usa o valor cheio das contas (ignora pagamentos parciais).
- [ ] **Rate limit** só por conta (login) e por e-mail (redefinição de senha); nada por IP.
- [ ] `paidAt`/`createdAt` ainda formatados no fuso do navegador (só datas "só dia" foram corrigidas).

## 3. Dúvidas de funcionamento (decisões do dono)

> Decidido em 19/09: o **saldo do Tronco é visível a todos** os irmãos (extrato, saídas e doadores continuam só para a gestão).

1. **Doações e Contribuições** é dinheiro com **destino restrito** (como o Tronco) ou receita geral só acompanhada à parte? (hoje: sem trava de gasto)
2. **Saldo inicial real** do Tronco e das Doações na loja de produção.
3. **Recebido em dinheiro no painel do Asaas**: em qual conta deve entrar (Caixa? conta corrente?) e como identificar o depósito depois?
4. **Cobrança em cartão**: alguma loja vai querer? (política atual: fora do Modo Asaas)
5. **Repasse de tarifa**: quando entra, para quais métodos e com que isenções? A loja informa a própria tabela de tarifas?
6. **Repasse Asaas → banco**: o sistema mostra o saldo a repassar (manual). Vale registrar cada repasse como evento/conferência com o extrato OFX?
7. **Doações do irmão por Pix (portal)** e doações a campanhas → sempre no caixa do Tronco. E **"Doações e Contribuições"** recebe o quê na prática (só pela categoria 1.1.04)?
8. **"Interno Loja"**: hoje só o papel **Membro** é barrado; oficiais (secretário, tesoureiro, hospitaleiro…) veem tudo em *Documentos*. Restringir por papel também?
9. **Recorrência**: agendar o cron diário (e o que fazer com recorrentes de cobranças já pagas)?
10. **Assinatura vencida**: bloquear escrita nas APIs ou só manter o aviso/pausa da tela?
11. **Lojas com Asaas já conectado** foram migradas para Modo Asaas; as demais ficaram em Modo Loja. Correto para todas?
12. **Sessão**: mudanças de papel/status agora valem em ~30 s (cache por instância). Aceitável ou exigir logout imediato?

## 4. Estado do que foi entregue (referência rápida)

| Commit | O quê |
|---|---|
| `72d4588` | Cobrança por **categoria** do plano de contas (lançamento criado junto); taxas de Iniciação/Elevação/Exaltação separadas; `ChartAccount.isDues` |
| `ca481a7` | "Pago" gera o pagamento no caixa; baixa de contas sem membro; trava/aviso Asaas ("Recebido fora do Asaas"); correção do `logAudit` (FK) que engolia a baixa do webhook |
| `abd35b2` | Manual v1.23 |
| `6861947` | Varredura: login/sessão, redefinição de senha por link, datas, valores em centavos, renegociação |
| `a0d53d4` | **Caixas próprios** do Tronco e das Doações + tela **Fundos** + roteamento automático |
| `3f81d69` | **Modo Loja/Modo Asaas**, baixa na conta corrente, **tarifa real** e relatório de tarifas |
| `18163a1` | Categoria **"Interno Loja"** em documentos (restrita à gestão) |
| `f51a3d5` | **Registrar aporte** nos Fundos (`api/funds/contributions`, testado na Tim Maia); **saldo do Tronco visível a todos** (portal Hospitalaria); tela Fundos só para quem lê Contas; manual v1.28 |

Migrations aplicadas em produção: `20260918120000_add_chartaccount_isdues`, `20260918140000_add_fund_accounts`,
`20260919100000_add_collection_mode_and_asaas_fees`.

Arquivos novos importantes: `lib/{collection,funds,funds-report,fees-report,money,date-only,auth-policy,reset-token,account-status,asaas-manual,charges,documents,renegotiation}.ts`.

## 5. Como retomar (dicas operacionais)

- **Variável de ambiente**: a shell do Windows tem `DATABASE_URL=localhost` que **sobrescreve o `.env`**. Para banco/Prisma/servidor: `export DATABASE_URL=$(grep "^DATABASE_URL=" .env | cut -d= -f2- | tr -d '"')`.
- **Servidor de teste**: `AUTH_TRUST_HOST=true RESEND_API_KEY= npx next dev -p 3111` (Resend vazio = não envia e-mail). Login por curl: `GET /api/auth/csrf` → `POST /api/auth/callback/credentials`.
- **Scripts TS avulsos** (usam alias `@/`): `node --env-file=.env --import ./test/tmp/setup-next.mjs script.ts` (o `test/tmp` é descartável e foi removido — recriar com o `loader.mjs` + um resolver que mapeia `next/*` e `next-auth/*` para `.js`).
- **Loja de testes**: *Augusta e Respeitável Loja Simbólica Tim Maia* — `cmqtoatcq0000ec4rva3a8roq`, Asaas **sandbox**, membro de teste "Charles Vasconcelos de Souza" `cmqtoi7fk0003ec4rqkeh04x0` (já com cliente Asaas). Está **limpa** (0 cobranças/pagamentos/contas/documentos). Tudo que se cria nela deve ser removido no fim (padrão dos scripts `cleanup`).
- **Lojas no banco**: Tim Maia (41 membros, Modo Asaas) e *Antônio Monteiro Martins 139* (36 membros, Modo Loja).
- **Windows/Git Bash**: comandos grandes com *heredoc* + aspas falham no parse — grave scripts com a ferramenta de escrita e rode `node arquivo.js`. Arquivos do repo misturam LF/CRLF (`autocrlf`): edições por script devem normalizar antes de casar strings.
- **Verificação padrão**: `npx tsc --noEmit` (ignora os `.test.ts`), `npx eslint src` (~1–2 min), `npm test` (116).
- **Memórias** (`~/.claude/projects/c--sygmahorus/memory/`): `collection-mode-asaas-fees` (diretriz do dono), `platform-owner-token-location`, etc.
