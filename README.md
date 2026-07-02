# Sigma Horus

SaaS de gestão financeira e administrativa para lojas maçônicas brasileiras.

**Stack:** Next.js 16, React 19, Prisma 7, PostgreSQL (Railway), Turbopack.

## Começando

```bash
npm run dev        # dev server em http://localhost:3000
npm run build      # build de produção (prisma generate + next build)
npm run lint       # ESLint
```

## Estrutura

```
src/
├── app/
│   ├── api/          # API routes (REST)
│   ├── dashboard/    # Dashboard pages (protegidas)
│   ├── login/        # Login page
│   └── onboarding/   # Onboarding (criação de loja+admin)
├── components/
│   └── ui/           # Design system components (Button, Input, Badge, Card, etc.)
├── lib/
│   ├── masonic-reference.ts  # Dados de referência (ritos, potências, cargos, contas)
│   ├── seed-lodge.ts         # Seed dos dados padrão por loja
│   ├── masks.ts              # Máscaras BR (CPF, CNPJ, CEP, telefone)
│   └── rbac.ts               # RBAC granular por papel
├── generated/prisma/  # Prisma Client (auto-generated)
└── middleware.ts       # NextAuth + RLS por lodge_id
```

## Dados de Referência

Os seguintes dados são semeados automaticamente no onboarding:

- **8 ritos maçônicos** (REAA, York, Adonhiramita, Brasileiro, Moderno, Schröder, Emulação, RER)
- **37 potências** (GOB + 27 Grandes Lojas estaduais + 8 Grandes Orientes COMAB + opção "Outra/Independente")
- **Cargos do rito escolhido** (ex.: 22 cargos para REAA)
- **Plano de contas** (14 contas típicas de receita/despesa)

## Stripe / Asaas

- Stripe: assinaturas (3 planos: Oficina, Loja, Potência)
- Asaas: emissão de boletos/PIX com BYO-key por loja

## Migrations

Todas as migrations ficam em `prisma/migrations/`. Para criar uma nova:

```bash
npx prisma migrate dev --name descricao_da_mudanca
```

Após alterar o schema, execute `npx prisma generate` para regenerar o client.
