<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:handoff -->
# Handoff — Sessão 2026-06-25

## O que foi feito

### Seed de cargos maçônicos por rito
- Adicionado `riteId` (FK opcional para Rite) no modelo Office (`prisma/schema.prisma`)
- Migration: `prisma/migrations/20260625190000_add_riteid_to_offices/migration.sql`
- Criado `OFFICES_BY_RITE` em `src/lib/masonic-reference.ts` com cargos para todos os 8 ritos:
  - REAA (22), York (14), Adonhiramita (16), Brasileiro (16), Moderno (16), Schröder (11), Emulação (15), RER (9)
- `seedLodgeDefaults()` em `src/lib/seed-lodge.ts` agora aceita `riteName` opcional e semeia apenas os cargos do rito escolhido
- Onboarding (`src/app/onboarding/page.tsx`) ganhou dropdown de seleção de rito (default: REAA)
- API `POST /api/lodges` agora recebe `riteName` e repassa ao seed

### Documentação
- `README.md` atualizado com informações específicas do projeto Sigma Horus
- `AGENTS.md` com este handoff

### UI (sessão anterior, não comitado)
- Migração de cores nas páginas membros, configurações, contas, cobranças, integrações para design tokens (`--sigma-blue-deep`, `--sigma-gold`, `--sigma-sand`, etc.)
- Componentes UI: Button, Input, Badge, Card, Skeleton, EmptyState

## Estado atual
- Build: ✅ Limpo (0 erros TS, 52 rotas)
- Lint: ✅ 0 erros (1 warning pre-existente: `isFirstRun` não usado)
- Banco: Migrations 8/8 aplicadas no Railway
- Prisma Client: regenerado com campo `riteId` em Office
- Stripe CLI: configurado (3 planos test mode, webhook forwarding ativo)
- Cloudflare R2: bucket `sygmahorus-documents` verificado
- Asaas: Fase 3 em código (BYO-key, emissão, webhook), falta validar sandbox

## Pendências / Próximos passos
- Aplicar a migration `add_riteid_to_offices` no banco Railway (pendente)
- Validar Asaas sandbox real
- Finalizar páginas que ainda usam paleta `bg-slate-950` antiga (se houver)
- Comitar as alterações não comitadas (UI components, DESIGN.md, backgraund_theme.png)
- Backfill de `riteId` em Offices existentes via script one-off
<!-- END:handoff -->
