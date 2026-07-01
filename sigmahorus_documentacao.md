# Sigma Horus — Documentação Única

## Sistema de Gestão de Lojas Maçônicas — Plataforma SaaS Multiloja

> **Documento único de referência** (escopo, arquitetura, modelo de dados, módulos e histórico de desenvolvimento).
> Consolidado em **2026-06-27**, atualizado em **2026-06-28** (HEAD `cbe6c28`). Substitui os antigos `sigmahorus_blueprint.md`, `sigmahorus_roadmap_inicial.md`, `sigmahorus_handoff_template.md`, `sigmahorus_handoff_dominio.md`, `sigmahorus_plano_execucao_agentes.md` e `themas_cores.md`.
>
> **Fonte viva para agentes:** `AGENTS.md` (estado da sessão corrente). **Este arquivo** é a memória persistente do escopo e da história. **Design system:** `DESIGN.md`. **Contexto de produto para design:** `PRODUCT.md`. **Análise jurídica e compliance:** `sigmahorus_legal_docs.md`.

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Estado Atual Verificado](#2-estado-atual-verificado-2026-06-27)
3. [Arquitetura Técnica](#3-arquitetura-técnica)
4. [Modelo de Dados](#4-modelo-de-dados)
5. [Módulos Funcionais](#5-módulos-funcionais)
6. [Papéis e Permissões (RBAC)](#6-papéis-e-permissões-rbac)
7. [Segurança e Conformidade](#7-segurança-e-conformidade)
8. [Identidade Visual e Design](#8-identidade-visual-e-design)
9. [Histórico de Desenvolvimento](#9-histórico-de-desenvolvimento)
10. [Pendências Reais Restantes](#10-pendências-reais-restantes)
11. [Decisões (Fechadas e em Aberto)](#11-decisões-fechadas-e-em-aberto)
12. [Processo de Handoff entre Agentes](#12-processo-de-handoff-entre-agentes)
13. [Notas Operacionais e Comandos Úteis](#13-notas-operacionais-e-comandos-úteis)

---

## 1. Visão Geral

O **Sigma Horus** é uma plataforma web (SaaS) para gestão administrativa e financeira de lojas maçônicas, com isolamento de dados por loja (multi-tenant). O escopo prioritário (MVP) é o módulo de **Tesouraria**: captações de membros, emissão e envio de boletos, contas a pagar e a receber, relatórios financeiros e fechamento de caixa ao término do veneralato. Acompanham presença em sessões, comunicação com membros e relatórios gerenciais. Secretaria e Chancelaria ficam previstas como evolução.

**Posicionamento de mercado:** existem concorrentes consolidados (SisMaçom, Portal Maçom, MasonWeb/eLoja/SigLoja, Painel da Loja, Pastmaster, Oriente.app). O diferencial está em **foco financeiro forte, UX moderna, automação de cobrança e auditoria detalhada**.

**Marca:** o nome remete ao **olho de Hórus** (visão, proteção, conhecimento). No Egito, as partes do olho representavam frações (1/2, 1/4, 1/8…), o que conversa com um sistema financeiro de precisão e prestação de contas. Conceito-mãe: *"a tesouraria da sua loja no prumo."*

### Objetivos do MVP
- Cadastrar membros, cargos e períodos de veneralato
- Gerar captações recorrentes (mensalidades) por membro
- Emitir boletos individuais e em lote (boleto + PIX via Asaas)
- Registrar contas a pagar e a receber com plano de contas
- Dar baixa automática (webhook do gateway) e manual
- Relatórios: extrato individual, débitos em aberto, fluxo de caixa, fechamento
- Encerrar o caixa ao fim do veneralato e travar o período
- Controle de acesso por cargo/perfil (RBAC) e trilha de auditoria

---

## 2. Estado Atual Verificado (2026-06-28)

> Verificado contra o código (`apps/frontend`) e o git. **HEAD `cbe6c28` (`main`)**, working tree limpo, tudo pushed (deploy automático na Vercel).

| Item | Estado |
|------|--------|
| Migrations Prisma | **20/20 aplicadas** no Railway, RLS ativo (`prisma migrate deploy` ok, 2026-06-28) |
| Modelos Prisma | 24 modelos (inclui `Relative`, `Campaign`, `CampaignDonation`; `User` ligado a `Member`) |
| Acesso do obreiro | Membro→Usuário: "Conceder acesso" gera login + senha por e-mail; gestão de papéis em Usuários & acessos |
| Encerramento veneralato | Fluxo 3 passos (Tesoureiro fecha → Venerável aprova → Admin encerra) + trava + herança de saldo |
| Tema | Escuro (padrão) + **Claro** alternável (Configurações → Aparência) |
| Framework | Next.js 16.2.9, next-auth v5 (`5.0.0-beta.31`) |
| Domínio | `sigmahorus.com.br` no ar (apex + www→apex 308), SSL Let's Encrypt válido até 24/set/2026 |
| Stripe | **LIVE**, 6 preços (3 planos × mês/ano), 1 produto ativo por plano; self-service Stripe-first com trial 10d |
| Asaas | BYO-key por loja, **E2E validado em sandbox** (emissão boleto/PIX confirmada) |
| Cloudflare R2 | bucket `sygmahorus-documents` verificado; 4 vars na Vercel |
| E-mail (Resend) | **ATIVO** — domínio verificado (DKIM/SPF/MX/DMARC), `no-reply@sigmahorus.com.br`; gatilhos diários no ar |
| WhatsApp/SMS | **BYO por loja** (Meta/Twilio), credenciais criptografadas por tenant; conexão Meta da plataforma ainda a configurar |
| Webhook Stripe | no domínio novo (`https://sigmahorus.com.br/api/stripe/webhook`); sem refs `*.vercel.app` em `src/` |

**Fases 0–11 entregues**, mais **módulo Hospitalaria (Fases 1–2)** e **Fase 7 (Comunicação real)** em grande parte concluída (e-mail Resend ativo, gatilhos diários, WhatsApp/SMS BYO). As frentes abertas estão na seção [10](#10-pendências-reais-restantes).

---

## 3. Arquitetura Técnica

### 3.1 Stack
Ecossistema único (TypeScript) do banco ao front, produtivo com desenvolvimento assistido por IA.

| Camada | Tecnologia | Por quê |
|--------|-----------|---------|
| Front-end | Next.js (React) + TypeScript | SSR, rotas, ecossistema |
| UI | Tailwind + componentes próprios (`src/components/ui`) | Visual moderno, tokens próprios |
| Back-end | Next.js API routes / Node | Mesmo runtime |
| ORM | Prisma | Schema tipado, migrações |
| Banco | PostgreSQL (Railway) | RLS, relacional robusto |
| Auth | Auth.js (NextAuth v5) | Login, sessões, papéis |
| Assinaturas SaaS | Stripe | Loja paga a plataforma |
| Boletos/PIX dos membros | Asaas (BYO-key) | Loja cobra seus membros |
| WhatsApp/SMS (Fase 7) | Meta Cloud API / Twilio — **BYO por loja** | Lembretes/convocação; custo direto da loja |
| E-mail (Fase 7) | **Resend (ATIVO)** | Boletos, avisos, gatilhos diários (incluso na plataforma) |
| Documentos | Cloudflare R2 (S3-compatible) | Storage de arquivos |
| Hospedagem | Vercel (app) + Railway (Postgres/jobs) | Deploy simples, escala gerenciada |

### 3.2 Multi-tenancy
Banco único compartilhado com coluna `lodge_id` em todas as tabelas de domínio, protegido por **Row-Level Security (RLS)** no PostgreSQL. O app conecta como role `NOBYPASSRLS` (`sigma_app`); o contexto por request é setado via `withTenant` ([src/lib/prisma.ts](src/lib/prisma.ts)). Isolamento validado por teste de integração. Dois clients: `prisma` (role `sigma_app`, `APP_DATABASE_URL`) e `prismaAdmin` (superuser, `DATABASE_URL`).

### 3.3 Dois fluxos de pagamento (não confundir)
O sistema lida com dinheiro em **duas direções distintas**. Misturá-las é erro de modelagem.

| Fluxo | Quem paga quem | Ferramenta |
|-------|----------------|------------|
| Assinatura da plataforma | Loja paga ao SaaS | **Stripe** (cartão/assinatura recorrente) |
| Captação de membros | Membro paga à loja | **Asaas** (boleto/PIX, baixa via webhook) |

- **Stripe:** planos de assinatura das lojas, cobrança recorrente, upgrade/downgrade, inadimplência via webhook. Acesso da loja condicionado ao status da assinatura.
- **Asaas — BYO-key por loja (decisão fechada):** cada loja conecta a **própria conta Asaas** (traz a própria API key pela tela de Integrações, salva **criptografada AES-256-GCM** em `Lodge.asaasApiKeyEnc`, **sem redeploy**). O pagamento cai **direto na conta da loja**; a plataforma não intermedia dinheiro. Webhook de baixa validado por **token por loja** (idempotente, via `externalReference`). A chave global única foi descontinuada.

### 3.4 Infraestrutura

| Componente | Onde | Função |
|-----------|------|--------|
| App Next.js (front + API) | Vercel | UI, API routes, webhook do gateway |
| PostgreSQL | Railway | Banco gerenciado com backups |
| Worker / Cron | Railway / API cron | Cobranças recorrentes, lembretes |
| Storage de documentos | Cloudflare R2 | Arquivos da loja via API S3 |

**Atenção a conexões:** as funções serverless da Vercel abrem conexão por invocação; o Postgres tem limite de conexões. **Pooling (pgBouncer / `connection_limit`) é obrigatório** sob carga.

### 3.5 Planos de Assinatura (faixas por nº de membros ativos)

| Plano | Membros ativos | Preço/mês |
|-------|----------------|---------------------|
| Oficina | até 30 | R$ 80 |
| Loja | 31 a 80 | R$ 110 |
| Potência | 81+ / multiloja | R$ 170 |

Valores **calibrados (2026-06-29)**. Trial de **10 dias**; cobrança mensal/anual. **Desconto anual: 10% no cartão, 5% no boleto** (regra real de cobrança em `priceFor`/`ensurePrice`). Prices no Stripe são imutáveis, então as lookup_keys são versionadas ao mudar o valor: atual **mês `_v2`, ano `_v3`**. **6 Prices LIVE materializados** (assinaturas antigas permanecem no preço anterior — grandfathered). **Plano anual sem cartão usa boleto** (PIX indisponível p/ contas BR no Stripe). Faixa medida por membros ativos, não por usuários de login.

---

## 4. Modelo de Dados

Toda tabela de domínio carrega `lodge_id` (tenant). Entidades centrais (24 modelos no total):

| Entidade | Descrição | Campos-chave |
|----------|-----------|--------------|
| `Lodge` | Loja (tenant) | id, nome, oriente, rito, potência; campos comerciais/bancários (CNPJ, legalName, tradeName, bankName, pixKey); `asaasApiKeyEnc`; `riteName`/`powerName`/`sessionWeekdays`/`sessionFrequency` |
| `Rite` / `Grade` | Rito e graus (parametrizável) | id, lodge_id, nome, ordem |
| `User` | Usuário de login | id, lodge_id, email, senha_hash, status, role |
| `Member` | Membro/obreiro | id, lodge_id, nome, grau, situação, contato (CPF p/ Asaas); marcos Iniciação/Elevação/Exaltação/**Instalação** (data+loja) |
| `Relative` | Família/dependentes do membro | id, lodge_id, member_id, kind (mother/father/spouse/son/daughter/child/other), name, birthDate, cpf?, email?, phone?, order — base p/ aniversariantes |
| `Office` | Cargo da loja | id, lodge_id, `riteId` (FK→Rite), nome |
| `Term` | Período de veneralato | id, lodge_id, início, fim, status |
| `MemberOffice` | Membro × cargo × período | id, member_id, office_id, term_id |
| `RolePermission` | RBAC persistido por loja | lodge_id, role, resource, action, allowed |
| `Invitation` | Convite de cadastro de loja | code, email?, status, expiresAt, usedAt, lodge_id? |
| `ChartAccount` | Plano de contas (semeado) | id, lodge_id, code, name, type (REVENUE/EXPENSE), category |
| `Account` | Conta a pagar/receber | id, lodge_id, type, member_id?, amount, dueDate, status, `chartAccountId` (FK→ChartAccount) |
| `Invoice` | Boleto/cobrança | id, lodge_id, member_id, number (`COB-AAAAMM-NNNN`), amount, dueDate, status, externalReference |
| `Payment` | Pagamento/baixa | id, lodge_id, account_id?, member_id?, amount, paidAt, origem (auto/manual), note |
| `CashClose` | Fechamento de caixa | id, term_id, saldo_inicial, saldo_final, data |
| `Session` | Sessão da loja | id, lodge_id, data, tipo, grau |
| `Attendance` | Presença em sessão | id, session_id, member_id, status |
| `Subscription` | Assinatura SaaS (Stripe) | id, lodge_id, stripe_id, plano, status, billingInterval, trialEndsAt, pendingPlan/pendingPlanEffectiveAt |
| `MessageLog` | Envio WhatsApp/e-mail | id, lodge_id, member_id, canal, template, status |
| `Document` | Arquivo da loja (R2) | id, lodge_id, member_id?, title, kind, storageKey, fileUrl, mimeType |
| `Campaign` | Campanha de benemerência (Hospitalaria) | id, lodge_id, título, beneficiário (pessoa/empresa/instituição), meta, fonte, status |
| `CampaignDonation` | Doação voluntária à campanha | id, lodge_id, campaign_id, doador (ocultável), valor, lançamento no Tronco |
| `AuditLog` | Auditoria | id, lodge_id, user_id, ação, antes, depois, ts |

> `Lodge` também carrega campos de mensageria BYO criptografados (`whatsapp*`/`sms*`) e `ChartAccount.isSolidarity` (Tronco de Solidariedade).

**Migrations (18):** `init_postgres`, `enable_rls`, `add_member_profile_fields`, `add_documents_and_messages`, `add_document_storage_fields`, `add_asaas_lodge_credentials`, `add_chart_accounts`, `add_lodge_business_fields`, `add_riteid_to_offices`, `add_role_permissions`, `add_invites_and_billing`, `add_lodge_rite_power_sessions`, `add_account_chart_link`, `add_member_installation`, `add_relatives`, `add_member_origin_power`, `add_campaigns`, `add_lodge_messaging`.

---

## 5. Módulos Funcionais

### 5.1 Cadastros
Membros (situação: ativo, licenciado, desligado), cargos (por rito), períodos de veneralato, vínculo membro×cargo×período, plano de contas/centro de custo, fornecedores. **Rito e potência configuráveis por loja.** Toda loja **nasce semeada** com ritos, potências e plano de contas do Brasil (idempotente, reaplicável em Cadastros).

### 5.2 Contas a Receber e Captações
Plano de mensalidade por membro (recorrência), geração de cobranças em lote (`POST /api/invoices/bulk`), número de referência automático (`COB-AAAAMM-NNNN`), emissão de boleto/PIX individual e em massa, baixa automática (webhook) e manual.

### 5.3 Contas a Pagar
Lançamento de despesas (fixas/variáveis), vínculo ao plano de contas/centro de custo, controle de vencimentos e status.

### 5.4 Cobrança (Asaas — Fase 3)
BYO-key por loja, UI "Emitir no Asaas" (cria customer + cobrança + `externalReference`), webhook de baixa automática idempotente com token por loja. **E2E validado em sandbox.**

### 5.5 Relatórios
Extrato individual, débitos em aberto, fluxo de caixa por período (mês/ano maçônico ou intervalo), pagamentos por período, balancete. Dashboard com indicadores (arrecadação, inadimplência, saldo, frequência). Export CSV. **Suíte de fechamento do veneralato** (formato livro caixa / AMORIO): `GET /api/reports/closing?from&to` agrega Balanço Financeiro, Balancete por plano de contas, Receitas×Despesas mensal, Livro Caixa, Cobranças e Saldo dos Irmãos; página `/dashboard/relatorios/fechamento` com seletor de período + "Salvar como PDF".

### 5.6 Fechamento de Veneralato
Apuração do período (entradas/saídas/saldo), transferência de saldo para a próxima gestão, travamento de lançamentos no período encerrado.

### 5.7 Auditoria
Registro imutável de toda alteração relevante (usuário, ação, registro, valor anterior/novo, data/hora). Helper `src/lib/audit.ts` integrado em 11 endpoints + página de consulta.

### 5.8 Presença em Sessões
Cadastro de sessões (data, tipo, grau), registro de presença por sessão (toggle), frequência/percentual por membro, relatório por período.

### 5.9 Comunicação (Fase 7 — em grande parte concluída)
- **E-mail (Resend) ATIVO:** domínio `sigmahorus.com.br` verificado (DKIM/SPF/MX/DMARC na Hostinger), `RESEND_API_KEY`/`RESEND_FROM` na Vercel; `from = no-reply@sigmahorus.com.br`.
- **Gatilhos automáticos diários** (`lib/notifications.ts` + cron `/api/cron/daily-notifications`, Vercel Cron 11:00 UTC): aniversário do obreiro e de familiares, jubileu/aniversário de iniciação (`TENURE_MILESTONES`), cobranças a vencer (3 dias) e vencidas. Dedup por dia via `MessageLog`, fuso America/Sao_Paulo.
- **WhatsApp/SMS — BYO por loja** (decisão de produto: e-mail incluso na plataforma; WhatsApp/SMS com custo direto da loja). Cada loja conecta a própria conta em **Integrações**: WhatsApp (Meta — Phone Number ID + token + template aprovado) e/ou SMS (Twilio — SID/token/from). Credenciais criptografadas por tenant (`Lodge.whatsapp*`/`sms*`). `lib/messaging.ts` recebe `lodgeChannels`; sem credenciais o envio fica `queued`.
- **Pendente:** conexão Meta da plataforma para o WhatsApp funcionar de ponta a ponta; opt-out por membro.

### 5.12 Hospitalaria (Fases 1–2)
Papel `hospitaller` (admin/venerável também acessam). **Irmãos (consulta)** read-only com contatos do obreiro + família. **Campanhas de benemerência** (`Campaign`/`CampaignDonation`): criar com modelos, beneficiário pessoa/empresa/instituição, meta e fonte; doações voluntárias que lançam no financeiro no Tronco (doador ocultável); custeio pelo Tronco validando saldo. **Tronco de Solidariedade**: `ChartAccount.isSolidarity`, saldo = entradas − gastos (`lib/hospitalaria.ts`). **Convocação dos irmãos** (`POST /api/campaigns/[id]/convocar`) por e-mail/WhatsApp/SMS via `lib/messaging.ts`.

### 5.10 Portal do Obreiro
`/dashboard/portal` + `/api/portal`: visão financeira/documentos do próprio membro, sob RBAC.

### 5.11 Centro de Documentos
Repositório de arquivos (atas, comprovantes, certificados) em **Cloudflare R2** (S3-compatible), isolado por tenant (RLS) e RBAC. Upload real para o bucket, registro `Document` por loja, download via **presigned GET URL (5 min, bucket privado/LGPD)**, cleanup automático no DELETE (sem órfãos).

---

## 6. Papéis e Permissões (RBAC)

Permissões associadas ao cargo dentro de um período de veneralato. Um membro pode ter cargos diferentes em gestões diferentes; as permissões acompanham o cargo vigente.

| Perfil | Acesso principal |
|--------|------------------|
| Administrador (plataforma) | Conta da loja, usuários, configurações, integrações |
| Venerável | Visão gerencial completa; relatórios; aprovação; sem lançar baixas |
| Tesoureiro | Lançar/baixar contas, emitir boletos, fechar caixa, relatórios financeiros |
| Secretário | Cadastro de membros, cargos, períodos; relatórios não financeiros |
| Hospitaleiro | Hospitalaria: consulta de irmãos + campanhas de benemerência (Tronco) |
| Membro comum | Próprio extrato, débitos e histórico |

**Granular por recurso × ação** (ex.: `receivable:create`, `payable:delete`, `report:view`, `cash:close`). Verificação em duas camadas: API (toda rota valida permissão + tenant) e UI (esconde o que não pode). **RBAC persistido por loja** (`RolePermission`): matriz papel × recurso × ação **editável** em `/dashboard/configuracoes/permissoes` (`/api/permissions`), com fallback para a matriz default em código (`src/lib/rbac.ts`). O escopo de tenant (`lodge_id`) é sempre aplicado junto, garantido pelo RLS.

---

## 7. Segurança e Conformidade

- Isolamento por tenant (RLS) — nenhuma loja vê dados de outra
- LGPD: base legal (art. 7º II, IV, V, IX e art. 11 II), consentimento, DPA disponível, política de retenção e direitos dos titulares; documentos em bucket privado com URL temporária
- Criptografia em trânsito (TLS) e em repouso; API key Asaas criptografada (AES-256-GCM)
- Senhas com hash forte
- Trilha de auditoria imutável
- Backups automáticos (Railway)
- Controle de acesso por cargo, princípio do menor privilégio

---

## 8. Identidade Visual e Design

Acabamento de alto padrão da tela de login a todas as telas internas — sem aparência de template genérico. Design system documentado em `DESIGN.md` (componentes Button, Input, Badge, Card, Skeleton, EmptyState; elevação; estados; animações). Tipografia Geist.

**Tokens de cor implementados** (`globals.css` / código):

```css
:root {
  --sigma-blue-deep:  #0A1628;  /* Fundo principal, profundidade */
  --sigma-blue-dark:  #0B1A2E;  /* Variação de fundo */
  --sigma-blue-mid:   #1E3A5F;  /* Cards, superfícies elevadas */
  --sigma-gold:       #C9A227;  /* Destaques, CTAs, bordas, ícones */
  --sigma-gold-light: #D4AF37;  /* Hover e brilho */
  --sigma-gold-dark:  #A08020;  /* Estados pressionados */
  --sigma-sand:       #E6D5B8;  /* Textos secundários, detalhes */
  --sigma-sand-light: #F2E8D5;  /* Textos claros sobre fundo escuro */
  --sigma-sand-dark:  #C4B49A;  /* Textos desabilitados/inativos */
}
```

**Marca:** logo ouro oficial; landing cinematográfica com fundo egípcio fixo (parallax) e redesign em torno dos quatro cargos/luzes da loja. **Princípios:** responsivo de verdade (mobile/tablet/desktop), hierarquia visual clara, acessibilidade (contraste, teclado, leitores de tela, motion reduzido).

**Landing page** (site público, separado do app): hero, recursos, prova social, tabela de planos com CTA (Stripe), FAQ, rodapé institucional, SEO/Core Web Vitals. Páginas institucionais (`(institucional)`: sobre, termos — foro na Comarca da Capital do RJ, privacidade/LGPD, compliance, manual do usuário).

---

## 9. Histórico de Desenvolvimento

Linha do tempo cronológica (junho/2026). Commits mais recentes ao topo dentro de cada bloco.

### Fundação e núcleo (Fases 0–2)
- Base Next.js + TypeScript + Tailwind + Prisma + Auth.js; multi-tenant; design tokens.
- **Migração SQLite → PostgreSQL no Railway** + **RLS por `lodge_id`** (`init_postgres`, `enable_rls`). Deploy automático na Vercel verificado.
- Cadastros (membros, cargos, períodos, ritos, potências, contas, fornecedores).
- Financeiro core: contas a pagar/receber, cobranças, pagamentos, recorrência (cron).

### Fase 8/9 — Fechamento + Auditoria + Asaas base + Polish
- APIs `offices`, `terms`, `member-offices`, `cash-close` + UIs (fechamento de veneralato).
- `src/lib/audit.ts` integrado em 11 endpoints + página de consulta.
- `src/lib/asaas.ts` base + rotas stub. Loading/empty states.

### Fase 10 — Documentos R2 + Asaas Fase 3 + seed maçonaria + dashboard shell (2026-06-25)
- Centro de Documentos: upload real + download presigned + cleanup; bucket `sygmahorus-documents` verificado por CLI (wrangler).
- Asaas Fase 3: BYO-key, baixa automática, UI de emissão.
- Seed de ritos/potências/plano de contas (`ChartAccount`); DashboardShell; máscaras de input; RBAC granular.
- `88e4831` — endpoint `POST /api/lodges/backfill-office-rites` (riteId p/ lojas existentes).
- `48d8de0` — DESIGN.md, `OFFICES_BY_RITE` (8 ritos), `seedLodgeDefaults(riteName)`, onboarding com seletor de rito, componentes UI, `Office.riteId`, campos comerciais/bancários do `Lodge`.

### Fase 11 — Comercial & institucional (2026-06-26)
- `33c53f6` — **RBAC persistido por loja** (`RolePermission`, matriz editável).
- `457a15c` — **Cadastro por convite** (`Invitation` + `/api/invites`), **trial 10 dias**, **billing mensal/anual**.
- `687b6e4` — plano **anual sem cartão usa boleto**; `/api/stripe/change-plan`.
- `9971d63` — **páginas institucionais** + consentimento de pagamento na landing.
- `abb6c1f`/`61b31f0`/`bdcece0` — **nova landing cinematográfica** + logo ouro oficial; foro na Comarca da Capital do RJ.
- Testes unitários em `src/lib/{asaas,crypto,masks,rbac,storage}.test.ts`.

### Publicação do domínio (2026-06-26)
- Domínios `sigmahorus.com.br` + `www` na Vercel; redirect 308 `www`→apex; `NEXT_PUBLIC_APP_URL` atualizada; redeploy `READY`.
- **DNS na Hostinger** (hPanel, opção A: nameservers mantidos na Hostinger): `A @ 76.76.21.21`, `CNAME www cname.vercel-dns.com`. Propagado, **SSL Let's Encrypt emitido**. Smoke test (curl): apex 200, www→apex 308, http→https 308, /login 200.
- Webhook do Stripe migrado para o domínio novo.

### Tesouraria avançada + livro caixa + fechamento (2026-06-26 → 27)
- `58ce961`/`26eab6a` — **desconto anual: cartão 10% / boleto 5%** (regra real, lookup_key `_v2`). Manual em formato livro.
- `ab447bb` — **configurações da loja** (rito, potência, dias/periodicidade de sessões) + "Aplicar cargos deste rito" (`POST /api/lodges/seed-offices`).
- `f890faf` — **número de referência automático** (`COB-AAAAMM-NNNN`) + **cobrança em massa** (`/api/invoices/bulk`).
- `976ec8b` — **plano de contas livro-caixa** recodificado hierárquico (1.1.xx/2.1.xx/8.9.xx), top-up por código não-destrutivo, `DELETE /api/chart-accounts/[id]`.
- **Asaas E2E validado em sandbox** pelo dono. **Stripe LIVE** com 6 preços (produtos duplicados consolidados — 1 por plano).
- `d3f647e` — **suíte de relatórios de fechamento do veneralato** (formato livro caixa): `GET /api/reports/closing` + página `/dashboard/relatorios/fechamento` + vínculo `Account.chartAccountId` (`add_account_chart_link`).
- `09bc20b` — handoff atualizado (13/13 migrations).

### Consolidação de docs + backfill financeiro + Membros Fase 1 (2026-06-27)
- **Documentação consolidada** neste arquivo único; removidos os 6 docs redundantes da raiz.
- `3548f6f` — **backfill de `Account.chartAccountId`** (`POST /api/accounts/backfill-chart` + botão em Cadastros).
- `a34ec76` — **Membros Fase 1**: lista-primeiro (busca nome/CPF/CIM, tabela compacta expansível), editar/excluir (`/api/members/[id]`), marco **Instalação** (migration `20260627120000`), evolução maçônica concatenada, helper `member-fields.ts`.
- `8344e6c` — **Membros Fase 2**: tabela relacional **`Relative`** (família/dependentes com contatos; migration `20260627140000`, RLS + índices), UI Família e dependentes (slots fixos Mãe/Pai/Esposa + dependentes dinâmicos), backfill idempotente dos campos antigos.
- `322a453` — **Membros, grau sem redundância**: "Grau de iniciação" removido; **situação simbólica derivada** dos marcos (helper `lib/masonic-degree.ts`, compartilhado com Portal); **Grau Filosófico atual** (seletor REAA 4–33); **bloco "Origem"** (Potência de origem `originPowerId` FK→Power, migration `20260627160000`, + Loja de origem texto).

### Self-service + Hospitalaria + Comunicação real (2026-06-27 → 28)
- **Self-service de assinatura (Stripe-first + trial 10d)**: `POST /api/signup/checkout` → `/comecar/concluir` → `GET/POST /api/signup/complete`; auto-cobrança ao fim do trial; `POST /api/cron/cancel-abandoned-trials` (Vercel Cron diário). Fix plano de contas AMORIO (`syncChartAccounts` + `POST /api/chart-accounts/sync`).
- `9b1aef3`/`0fdc599` — **Hospitalaria Fases 1–2**: papel `hospitaller`, consulta de irmãos, campanhas de benemerência (`Campaign`/`CampaignDonation`, migration `add_campaigns`), Tronco de Solidariedade (`ChartAccount.isSolidarity`), convocação por e-mail/WhatsApp/SMS (`POST /api/campaigns/[id]/convocar`).
- `8727b42`/`fc7ba26` — **Fase 7 Comunicação real**: **e-mail Resend ATIVO** (domínio verificado); **gatilhos automáticos diários** (`lib/notifications.ts` + cron `/api/cron/daily-notifications`): aniversários, jubileus, cobranças a vencer/vencidas.
- `da0f6b7`/`3da44d6`/`cbe6c28` — **WhatsApp via template** + **WhatsApp/SMS BYO por loja** (`lib/messaging.ts` recebe `lodgeChannels`; `Lodge.whatsapp*`/`sms*` criptografados, migration `add_lodge_messaging`); manual v1.x cap. 6.6.

### Acesso do obreiro + encerramento de veneralato + tema claro (2026-06-28)
- **Membro → Usuário (acesso):** `User.memberId` (1-1) + `User.mustChangePassword` (migration `add_user_member_link`). Botão **"Conceder acesso"** em Membros cria o login (e-mail = login, senha gerada e **enviada por e-mail/Resend**); 1º acesso força troca em `/trocar-senha`. Página **Usuários & acessos** (`/api/users`) — Admin define papel/status e reenvia senha. **Self-edit**: o obreiro edita o próprio cadastro (`members/[id]` PUT libera quando `session.memberId === id`), nunca o papel. Helper `lib/password.ts`.
- **Encerramento de veneralato (3 passos):** `Term.openingBalance/closedAt/closedById`, `CashClose.openingBalance/closingBalance/approved/approvedAt/approvedById` (migration `add_term_closing_flow`). Fluxo: **1)** Tesoureiro fecha o caixa (`POST /api/cash-close`); **2)** Venerável aprova (`POST /api/cash-close/approve`); **3)** Admin encerra (`POST /api/terms/[id]/close`, exige aprovação). **Trava de lançamentos** em período encerrado (`lib/term-lock.ts`, integrada em contas e pagamentos) e **herança de saldo** ao criar novo `Term`.
- **Tema claro:** tokens `[data-theme="light"]` em `globals.css` (Tailwind v4), `components/theme-toggle.tsx` + seção **Aparência** em Configurações; script anti-flash no root layout.

### Valores dos planos + reconciliação + login + tonalidade (2026-06-29)
- **Valores dos planos calibrados:** Oficina **R$ 80**, Loja **R$ 110**, Potência **R$ 170** (`lib/plans.ts`); atualizados em manual, compliance e docs. **6 Prices LIVE materializados** no Stripe (lookup_keys mês `_v2`/ano `_v3`; anual = 12× −10%: R$ 864 / R$ 1.188 / R$ 1.836). Assinaturas antigas grandfathered.
- **Saldo dos Irmãos** (ex-"Associados", termo herdado do AMORIO): renomeado em toda a UI/docs e **reconciliado por documento** em `reports/closing/route.ts` — pagamento ligado a recebível a vencer depois de `to` (antecipado) é ignorado dos dois lados, eliminando a distorção do saldo.
- **Login:** "Lembrar de mim" (prefill do e-mail via `localStorage`), painel **"Esqueceu a senha?"** com recuperação self-service (`POST /api/account/forgot-password`: gera senha provisória, envia por Resend, marca `mustChangePassword`; resposta genérica anti-enumeração; reusa `lib/password.ts`). Card refinado (glass/backdrop-blur).
- **Tonalidade unificada (sketch 003):** utilities `.bg-sigma-app`/`.bg-sigma-card`/`.bg-sigma-card-elevated` token-aware em `globals.css`; `Card` e os painéis do dashboard passam ao degradê azul (frame quase imperceptível). Sidebar/header (menus), títulos e fontes preservados.

### Backlog técnico resolvido (item 5) — Server Components + pooling + testes (2026-06-29)
- **Pooling Prisma** (`lib/prisma.ts`): pool com `max`/`idle`/`connectTimeout` (`DB_POOL_MAX` por env).
- **Test runner**: `npm test` (`node:test` + loader de alias `@/`); reconciliação do Saldo dos Irmãos extraída p/ `lib/closing.ts` + 6 testes; **24 verdes**.
- **`set-state-in-effect` zerado**: ~20 páginas do dashboard migradas p/ **Server Components** (server fetch + client por props + `router.refresh()`); `fechamento` por `searchParams` + `lib/closing-report.ts`; disables justificados nos casos de init/pureza/checkout.

### Uplift de design (crítica impeccable, 2026-06-30)
Crítica de design (registro Product) em `design_refinado.md` (saúde ~28/40 → ~34-36). Entregue: **componente `ui/alert.tsx`** semântico (intents) substituindo banners de classes soltas (layout + 11 telas); **tema claro** com bordas/tabelas em tinta escura (legíveis no pergaminho); **alinhamento ao DESIGN.md** (sem sombras no Card; glass só no login); **paleta de comandos `Ctrl/Cmd+K`**; **sidebar completa** — ícones Lucide (`lucide-react`), fixa no desktop (sticky), **rail colapsável** (toggle persistente, só-ícone) e **acordeão single-open** (abre a categoria da rota atual); **seta "Voltar"** no manual (`router.back`); **manual v1.2** documentando temas e menus. `DESIGN.md` atualizado. Adiados (com motivo): confirm dialog (risco em ações destrutivas), validação inline, auditoria de cards — precisam de iteração visual. **← HEAD da sessão.**

### Relatório de crítica executado com impeccable v3.8.0 (2026-06-30)
Executada análise com skill `impeccable` atualizado (`v3.8.0`) sobre os alvos `src/app/dashboard/assinatura`, `src/components/plans-section.tsx` e `src/app/page.tsx`. Relatório salvo em `impeccable-critique-2026-06-30.md`. Principais achados executados: ausência de fallback de erro visível no fluxo de checkout e ausência de `PRODUCT.md` para o fluxo `impeccable`. Nenhum código alterado; documento serve como fonte de avaliação para ajustes futuros.

---

## 10. Pendências Reais Restantes

1. **Conexão Meta (WhatsApp)** — `lib/messaging.ts` + BYO por loja prontos; falta concluir o cadastro/aprovação na Meta (Phone Number ID, token permanente, template `{{1}}` aprovado). **Guia passo a passo:** [`CONEXAO_WHATSAPP.md`](CONEXAO_WHATSAPP.md) (também no manual cap. 6.6). *Adiado (2026-06-29): dono vai adquirir um novo chip/número antes de prosseguir.*
2. ✅ **Membro → Usuário (acesso ao sistema)** — entregue (ver histórico 2026-06-28).
3. ✅ **Encerramento de veneralato + herança de saldo** — entregue (fluxo 3 passos + trava + herança).
4. ✅ **Tema claro** ("versão clara") — entregue, alternável em Configurações → Aparência.
5. ✅ **Atribuição de papel a usuário** — entregue na página Usuários & acessos.
6. **E-mail profissional `@sigmahorus.com.br`** — contratar à parte (Hostinger sem e-mail grátis) — *o envio transacional via Resend já está ativo.*
7. **Refinamentos financeiros** (melhoria, não bug):
   - ✅ **Backfill de `chartAccountId`** — entregue: `POST /api/accounts/backfill-chart` + botão "Vincular contas ao plano" em Cadastros.
   - ✅ **Saldo dos Irmãos** ([reports/closing/route.ts](src/app/api/reports/closing/route.ts)): reconciliado por documento — pagamento ligado a recebível ainda não vencido (antecipado) é ignorado dos dois lados, mantendo débito e crédito na mesma janela "até a data". (Termo "Associados" do AMORIO renomeado para "Irmãos".)
   - (Opcional) export do fechamento em Excel além de PDF.
8. **Definir entidade legal do SaaS** — CNPJ, razão social e endereço do Sigma Horus. Necessário p/ substituir placeholders nos Termos de Uso, emissão de notas fiscais e contrato Stripe. **Pré-requisito para publicação jurídica definitiva.**
9. **Redigir e disponibilizar Contrato de Tratamento de Dados (DPA)** — formaliza relação operador-controladora (art. 39 LGPD). Mencionado nas páginas de Privacidade e Compliance; precisa do documento propriamente dito.
10. **Notificar ANPD sobre a nomeação do Encarregado (DPO)** — art. 41, §2º LGPD exige comunicação formal à Autoridade Nacional. O DPO está nomeado e contato divulgado (privacidade@sigmahorus.com.br); falta o registro na ANPD.
11. ✅ **RLS — Document e MessageLog** — migration `20260630100000_fix_rls_document_message` criada.
12. ✅ **Webhook Asaas com token obrigatório** — `isWebhookAuthorized()` agora rejeita sem token.
13. ✅ **Audit — campo `before` opcional** — `audit.ts` aceita e persiste `before`.
14. ✅ **Portabilidade de dados (LGPD art. 18)** — `GET /api/lodges/export` exporta completa em JSON.
15. ✅ **Purge automático pós-90 dias** — `terminatedAt` em Lodge + cron `/api/cron/purge-terminated`.
16. ✅ **SLA ajustado p/ melhor esforço** — Termos §10 atualizado.
17. ✅ **Compliance ajustado** — OWASP/NIST e anticorrupção suavizados.
18. ✅ **Documento de análise jurídica** — `sigmahorus_legal_docs.md` criado na raiz.

### Melhorias técnicas conhecidas (backlog) — resolvido 2026-06-29
- ✅ **Lint `react-hooks/set-state-in-effect` — zerado.** As ~20 páginas do dashboard com *fetch-on-mount* foram migradas para **Server Components** (carregam dados no servidor via `withTenant`/`prismaAdmin` e passam por props; mutações usam `router.refresh()`). Padrão: `page.tsx` (server) + `XClient.tsx` (client). Casos legítimos de init (localStorage/URL no `DashboardShell`, `login`, `theme-toggle`, `onboarding`) e de pureza em server components (`Date.now()` no `layout`/`assinatura`) usam `eslint-disable` justificado. `relatorios/fechamento` usa período via URL (`searchParams`) + helper `lib/closing-report.ts`. `comecar/concluir` (fluxo público pós-checkout Stripe) tem disable justificado.
- ✅ **Pooling Railway — configurado.** `src/lib/prisma.ts`: `PrismaPg` com `max` (env `DB_POOL_MAX`, default 5), `idleTimeoutMillis` e `connectionTimeoutMillis`. Calibrável por env sob carga; sob carga alta o ideal continua sendo um pooler externo (pgBouncer).
- ✅ **Cobertura de testes — runner ativo.** Script `npm test` (Node `node:test` nativo + loader de alias `@/` em `test/loader.mjs`). **24 testes verdes** (asaas/crypto/masks/rbac/storage + **6 novos** da reconciliação do Saldo dos Irmãos, com a lógica extraída para `lib/closing.ts`).
- (Reconciliação Asaas) coluna `gatewayId` em `Invoice` p/ reconciliação reversa; tratamento de estorno. *(continua em aberto)*
- ✅ **Lint residual zerado (2026-06-29):** ESLint agora 100% limpo (exit 0). `where: any` → `Prisma.*WhereInput` + `DateTimeFilter` (`reports/export`, `relatorios`); `catch (error)`→`catch`; `<a>`→`<Link>` (`comecar/concluir`). Os `any` de callbacks next-auth e do objeto Stripe (`current_period_*` fora do tipo no SDK v22) ficaram com `eslint-disable` **justificado** — tipar quebraria o build / exigiria module augmentation global.
- ✅ **🎨 Tema claro — legibilidade dos avisos (RESOLVIDO 2026-06-29):** `globals.css` (fora de `@layer`) sobrescreve as **variáveis de cor** do Tailwind (`--color-{rose,amber,emerald,sky}-100/200/300` → 700/800) no `[data-theme="light"]`/`system` claro — escurece texto base **e** variantes de opacidade (`/60 /70 /80`); reforça os fundos de alerta (`bg-*-500/10–12` → 15–18%). Cobre banner "sem assinatura" (rosa), downgrade (azul), banners de mensagem e botões "Remover". Tema escuro intacto.
- **Tema "Sistema":** já segue o SO via `prefers-color-scheme` (cobre Windows 11 e macOS — sem necessidade de código Mac-específico); validar no ambiente do dono (modo de aplicativo do Windows / override de navegador).

---

## 11. Decisões (Fechadas e em Aberto)

### Fechadas
- **Gateway de boleto:** Asaas (BYO-key por loja).
- **Assinatura SaaS:** planos em faixas por nº de membros ativos.
- **Plataforma:** web responsiva + uso pleno no celular (PWA, sem app nativo no início).
- **Ritos/potências:** múltiplos, configuráveis por loja desde o MVP.
- **WhatsApp:** Cloud API oficial, integração direta com a Meta (com aquecimento do número).
- **E-mail:** a contratar à parte (Hostinger sem e-mail grátis).
- **Domínio:** `sigmahorus.com.br`, gerenciado na Hostinger (DNS opção A — nameservers na Hostinger para acomodar MX futuro).
- **Desconto anual:** cartão 10% / boleto 5% (boleto a 5% **mantido**).
- **Documentos:** Cloudflare R2 via API S3 (sem binding de Workers).
- **Valores dos planos (2026-06-29):** Oficina **R$ 80**, Loja **R$ 110**, Potência **R$ 170** (mês). 6 Prices LIVE criados (mês `_v2`/ano `_v3`).

### Em aberto
1. Duração final da avaliação gratuita (hoje 10 dias).
2. **Entidade legal que opera o SaaS** (necessária p/ Stripe, emissão de notas, contratos e documentos legais). Os Termos de Uso possuem placeholder `[razão social / CNPJ a inserir]` — a definição da entidade é pré-requisito para publicação jurídica definitiva.
3. **Redação do DPA formal** (Contrato de Tratamento de Dados — art. 39 LGPD).
4. **Registro do Encarregado (DPO) na ANPD** (art. 41, §2º LGPD).

---

## 12. Processo de Handoff entre Agentes

Para reduzir retrabalho, custo de contexto e perda de estado. **Antes de codar**, todo agente deve ler: este documento, o `AGENTS.md` (estado vivo) e verificar `git status`/`git log`.

**Regras:** trabalhar por unidade de entrega pequena e verificável; preferir incrementos focados (não reescrever módulos estáveis); documentar decisões importantes (o quê, por quê, impacto); manter o `AGENTS.md` atualizado.

**Ao finalizar, registrar no `AGENTS.md`:** (A) estado atual (branch/HEAD, arquitetura, módulos), (B) o que foi entregue (funcionalidades, arquivos, testes), (C) pendências/bugs conhecidos, (D) recomendações para o próximo agente (ordem de leitura, arquivos prioritários, pontos de integração), (E) o que **não** quebrar / preservar.

> **Convenção de fonte única:** este arquivo é a memória de **escopo e história**; o `AGENTS.md` é o **estado da sessão corrente**. Evite duplicar status entre os dois — atualize o `AGENTS.md` a cada sessão e migre para cá apenas o que vira história consolidada.

---

## 13. Notas Operacionais e Comandos Úteis

### ⚠️ Env var do Windows que conflita com `.env`
Existe uma env var de usuário `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sigmahorus` que **sobrescreve o `.env`**. Para rodar Prisma local, sobrescreva na sessão:
```powershell
$env:DATABASE_URL = "<APP_DATABASE_URL do Railway>"
```
(A porta do proxy público do Railway pode rotacionar.) `.env` local sem credenciais R2 → preencher para testar upload em dev.

### Comandos
```bash
# Verificação de tipos (erros só em .test.ts são esperados — config, não bug)
npx tsc --noEmit

# Migrations no Railway
npx prisma migrate deploy

# Status dos domínios / deploy
vercel domains inspect sigmahorus.com.br
vercel deploy --prod

# Conferir refs a domínio antigo (esperado: zero)
grep -rE "vercel\.app|frontend-[a-z0-9]" src --include="*.ts" --include="*.tsx"
```

### Stripe — produtos e checkout (⚠️ operacional)
- **Um `Product` ATIVO por plano.** Um `Price` anexado a um Product **arquivado** não é comprável ("product is not active") → `checkout.sessions.create` 400 → `/api/signup/checkout` 500 → a página do Stripe não abre. Bug de 2026-06-30 corrigido reativando os 3 produtos; `ensureProduct` blindado com `active:'true'`. Ao trocar preços, **arquive só o Price antigo, nunca o Product** em uso.

### Webhooks
- **Stripe:** `https://sigmahorus.com.br/api/stripe/webhook`.
- **Asaas (BYO-key):** cada loja configura na própria conta Asaas, apontando para `https://sigmahorus.com.br/api/asaas/webhook?lodgeToken=...`. Verificar se a UI de Integrações mostra o domínio novo (não `.vercel.app`).

### Repositório
`charlesvsouza/sigma-horus-frontend` (`main`). Deploy automático na Vercel a cada push.
