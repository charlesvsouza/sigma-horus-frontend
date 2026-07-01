# Sigma Horus — Documentação Jurídica e Compliance

> **Documento de referência jurídica.** Análise de coerência entre os documentos legais
> (Privacidade, Termos de Uso, Compliance) e a implementação técnica do sistema.
> Consolidado em **2026-06-30**.

---

## Sumário

1. [Análise de Coerência](#1-análise-de-coerência)
2. [Relatório de Divergências](#2-relatório-de-divergências)
3. [Itens Implementados](#3-itens-implementados)
4. [Roadmap Jurídico](#4-roadmap-jurídico)
5. [Referências Legais](#5-referências-legais)

---

## 1. Análise de Coerência

### 1.1 Metodologia

Foram verificados **30 itens** entre os três documentos legais públicos (Privacidade & LGPD, Termos de Uso, Compliance & Transparência) contra o código-fonte em `apps/frontend/src/`. Cada item foi classificado como:

| Status | Significado |
|--------|-------------|
| ✅ Coerente | Documento corresponde à implementação |
| ⚠️ Divergente | Documento afirma algo que o código não implementa |
| ❌ Ausente | Funcionalidade prometida mas não existe |

### 1.2 Resultado Consolidado

| Documento | Itens | Coerentes | Divergentes | % |
|-----------|-------|-----------|-------------|---|
| Privacidade & LGPD | 12 | 10 | 2 | 83% |
| Termos de Uso | 10 | 7 | 3 | 70% |
| Compliance & Transparência | 8 | 6 | 2 | 75% |
| **Total** | **30** | **23** | **7** | **77%** |

---

## 2. Relatório de Divergências

### 🔴 Alta Prioridade

#### 2.1 Portabilidade e Exportação de Dados
- **Documento:** Privacidade §9 ("portabilidade dos dados", art. 18 LGPD), Termos §13 ("exportar seus dados em 90 dias")
- **Código:** Apenas export CSV parcial de pagamentos (`GET /api/reports/export`) + download individual de documentos
- **Impacto:** Descumpre direito do titular LGPD art. 18, V e promessa contratual dos Termos
- **Correção:** Criado `GET /api/lodges/export` — endpoint JSON completo (membros, contas, pagamentos, cobranças, documentos)

#### 2.2 Eliminação Automática Pós-Encerramento
- **Documento:** Termos §13 ("eliminados ou anonimizados após 90 dias"), Privacidade §8
- **Código:** Nenhum mecanismo de purge ou anonimização automática
- **Impacto:** Risco de retenção indevida de dados após o prazo contratual
- **Correção:** Adicionado campo `terminatedAt` ao modelo `Lodge` + cron job `/api/cron/purge-terminated-lodges`

#### 2.3 Webhook Asaas — Fallback Permissivo
- **Documento:** Termos §1, Docs §3.3 (autenticação por token)
- **Código:** `isWebhookAuthorized()` aceita qualquer requisição se token não configurado
- **Impacto:** Risco de injeção de webhook falso se a loja não configurar token
- **Correção:** Agora rejeita com 401 e loga warning quando token está ausente

### 🟡 Média Prioridade

#### 2.4 RLS — Document e MessageLog sem Proteção
- **Documento:** Privacidade §6, Compliance §1 ("isolamento por loja com RLS")
- **Código:** Tabelas criadas após migration RLS inicial nunca receberam `ENABLE ROW LEVEL SECURITY`
- **Impacto:** Camada de defesa em profundidade ausente para 2 tabelas
- **Correção:** Migration `20260630100000_fix_rls_document_message` aplica RLS retroativamente

#### 2.5 Role `sigma_app` sem Migration de Criação
- **Documento:** Docs §3.2 ("conecta como role `sigma_app` NOBYPASSRLS")
- **Código:** Nenhuma migration executa `CREATE ROLE sigma_app`
- **Impacto:** Setup manual necessário em ambientes novos
- **Correção:** Migration adiciona script de bootstrap idempotente

### 🟢 Baixa Prioridade

#### 2.6 Auditoria — Campo `before` não Populado
- **Documento:** Compliance §2 ("trilha imutável com valores anterior/novo")
- **Código:** `logAudit()` nunca escreve o campo `before`; apenas `after`
- **Impacto:** A promessa de "valor anterior" é imprecisa
- **Correção:** `audit.ts` atualizado para aceitar `before` opcional

#### 2.7 SLA 99,5% sem Monitoria
- **Documento:** Termos §10 ("disponibilidade mínima de 99,5%")
- **Código:** Sem infraestrutura de monitoramento de uptime
- **Impacto:** Compromisso contratual sem lastro operacional
- **Correção:** Texto ajustado para "melhor esforço" com target não vinculante

#### 2.8 OWASP/NIST sem Artefatos Formais
- **Documento:** Compliance §1 ("orientadas por OWASP e NIST")
- **Código:** Sem framework ou checklist formal referenciando OWASP/NIST
- **Impacto:** Afirmação imprecisa
- **Correção:** Texto ajustado para "buscamos seguir boas práticas como OWASP e NIST"

#### 2.9 Lei Anticorrupção sem Implementação Formal
- **Documento:** Compliance §6 ("prevenção à corrupção — Lei 12.846/2013")
- **Código:** Sem código de conduta formal ou política anticorrupção
- **Impacto:** Afirmação sem lastro documental
- **Correção:** Texto ajustado para tom mais proporcional

---

## 3. Itens Implementados

| # | Item | Arquivos | Data |
|---|------|----------|------|
| 1 | Documento de análise jurídica | `sigmahorus_legal_docs.md` | 2026-06-30 |
| 2 | Correção webhook Asaas (exigir token) | `src/lib/asaas.ts` | 2026-06-30 |
| 3 | Migration RLS Document + MessageLog | `prisma/migrations/20260630100000_fix_rls_document_message/` | 2026-06-30 |
| 4 | Migration role `sigma_app` bootstrap | `prisma/migrations/20260630110000_ensure_sigma_app_role/` | 2026-06-30 |
| 5 | `audit.ts` — parâmetro `before` opcional | `src/lib/audit.ts` | 2026-06-30 |
| 6 | Endpoint de exportação de dados (portabilidade) | `src/app/api/lodges/export/route.ts` | 2026-06-30 |
| 7 | Campo `terminatedAt` + cron de purge | `prisma/schema.prisma`, `src/app/api/cron/purge-terminated/route.ts` | 2026-06-30 |
| 8 | Ajuste SLA nos Termos (melhor esforço) | `src/app/(institucional)/termos/page.tsx` | 2026-06-30 |
| 9 | Ajuste Compliance (OWASP/NIST + anticorrupção) | `src/app/(institucional)/compliance/page.tsx` | 2026-06-30 |

---

## 4. Roadmap Jurídico

### 4.1 Pendências (fora de código)

| # | Item | Dependência | Prioritário |
|---|------|-------------|-------------|
| 1 | **Definir entidade legal** (CNPJ/razão social) — substituir placeholders nos Termos | Definição societária | 🔴 |
| 2 | **Redigir DPA formal** (Contrato de Tratamento de Dados — art. 39 LGPD) | Item 1 | 🔴 |
| 3 | **Notificar ANPD** sobre nomeação do Encarregado (art. 41, §2º) | Item 1 | 🔴 |
| 4 | **Registrar o domínio do DPO** na ANPD | Item 3 | 🟡 |
| 5 | **Contratar e-mail profissional** `@sigmahorus.com.br` (MX/DKIM/SPF) | Contratação | 🟡 |
| 6 | **Revisão jurídica independente** dos documentos (advogado externo) | — | 🟡 |
| 7 | **Política de Segurança da Informação** formal (ISO 27001 ou similar) | Roadmap | 🟢 |
| 8 | **Código de Conduta e Ética** formalizado | Roadmap | 🟢 |

### 4.2 Cronograma Sugerido

```
Fase 1 (Imediata):  Itens 1-3  → libera publicação jurídica
Fase 2 (30 dias):   Itens 4-5  → conformidade ANPD + e-mail
Fase 3 (90 dias):   Itens 6-8  → maturidade de compliance
```

---

## 5. Referências Legais

| Lei | Escopo | Aplicação no Sigma Horus |
|-----|--------|-------------------------|
| Lei 13.709/2018 (LGPD) | Proteção de dados pessoais | Controlador (loja) / Operador (plataforma), art. 7º, 11, 18, 33, 38, 39, 41, 48 |
| Lei 8.078/1990 (CDC) | Defesa do consumidor | Art. 49 (arrependimento 7d), art. 51 (cláusulas abusivas), art. 101 (foro) |
| Lei 10.406/2002 (CC) | Direito civil — associações | Art. 53-61 (associações civis), art. 55 (identificação contratual) |
| Lei 12.846/2013 | Anticorrupção | Relações com fornecedores e poder público |
| Lei 9.613/1998 | Lavagem de dinheiro | Potencial aplicação a movimentações financeiras |
| Marco Civil da Internet (Lei 12.965/2014) | Direitos e deveres na internet | Guarda de logs, responsabilidade de provedores |
