<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:handoff -->
# Handoff — Sessão 2026-06-25 (continuação)

## O que foi feito nesta sessão

### 1. Commit das alterações pendentes
- 30 arquivos comitados e enviados para `main` no GitHub
- Inclui: DESIGN.md, componentes UI (Button/Input/Badge/Card/Skeleton/EmptyState), migrations `add_lodge_business_fields` e `add_riteid_to_offices`, `OFFICES_BY_RITE` (8 ritos), design tokens no globals.css, onboarding com seletor de rito, seed com riteName, página Configuracoes, API lodge

### 2. Migrations aplicadas no Railway
- `prisma migrate deploy` executado com sucesso
- Migration `20260625190000_add_riteid_to_offices` aplicada (A coluna `riteId` e a FK já existem no banco)
- Migration `add_lodge_business_fields` já estava aplicada de sessão anterior
- Total: 9/9 migrations

### 5. Backfill de riteId em Offices existentes
- Criado endpoint `POST /api/lodges/backfill-office-rites` (admin/venerable)
- Lógica: para cada loja, tenta matching do nome do cargo contra `OFFICES_BY_RITE`; fallback para REAA (primeiro rito que contém "Escocês")

## Notas importantes
- ⚠️ Seu `.env` local tem uma env var de usuário do Windows (`DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sigmahorus`) que sobrescreve o `.env` do projeto. Para rodar comandos Prisma localmente, use:
  ```
  $env:DATABASE_URL = "postgresql://postgres:DwxdjghATQuxmjYkfctxaEreortoktcr@reseau.proxy.rlwy.net:37755/railway"
  ```
- R2 env vars na Vercel estão incompletas (só `R2_ACCESS_KEY_ID` presente). Upload/download de documentos não funcionará até gerar um novo token R2 e configurar as 5 vars.

## Estado atual
- Build: ✅ Último commit `88e4831` — limpo (só erros pré-existentes em `.test.ts`)
- Lint: ✅ 0 erros (1 warning pre-existente)
- Banco: 9/9 migrations aplicadas no Railway
- GitHub: `charlesvsouza/sigma-horus-frontend` (`main`) — push automático → Vercel
- Vercel: deploy do último commit em Building/Ready
- Stripe: 3 planos test mode configurados
- Cloudflare R2: bucket `sygmahorus-documents` existe, CLI verificada, mas sem token API configurado na Vercel

## Pendências / Próximos passos
- ⏳ Validar Asaas com sandbox real (conectar chave → emitir → pagar → baixa via webhook)
- ⏳ Gerar novo token R2 no Cloudflare Dashboard e configurar na Vercel (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET)
- ⏳ Disparar `POST /api/lodges/backfill-office-rites` em produção para backfill de offices existentes
- ⏳ Remover env var de usuário `DATABASE_URL` do Windows para evitar conflito
- ⏳ Finalizar páginas que ainda usam paleta `bg-slate-950` antiga
- ⏳ Comunicação real (WhatsApp/E-mail) — Fase 7
- ⏳ RBAC persistido por cargo × ação no banco
<!-- END:handoff -->
