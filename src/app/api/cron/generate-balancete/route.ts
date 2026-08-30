import { prismaAdmin, withTenant } from '@/lib/prisma';
import { generateBalancete, previousMonthRange } from '@/lib/balancete';
import { NextResponse } from 'next/server';

// Emissão automática do balancete do mês anterior, só para lojas que
// habilitaram em Configurações → Financeiro ("Emitir balancete mensal
// automaticamente"). Rodar 1x no início do mês (vercel.json: dia 1, 06:00).
// Acionado pelo Vercel Cron (GET, Authorization: Bearer $CRON_SECRET) ou
// manualmente (token = CRON_SECRET ou PLATFORM_OWNER_TOKEN).
function authorized(request: Request): boolean {
  const header = request.headers.get('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const qs = new URL(request.url).searchParams.get('token') ?? '';
  const accepted = [process.env.CRON_SECRET, process.env.PLATFORM_OWNER_TOKEN].filter(Boolean) as string[];
  return accepted.some((t) => t === bearer || t === qs);
}

async function run() {
  const { from, to } = previousMonthRange();
  const lodges = await prismaAdmin.lodge.findMany({ where: { autoBalanceteEnabled: true }, select: { id: true } });

  let generated = 0;
  let skipped = 0;
  for (const lodge of lodges) {
    try {
      const existing = await prismaAdmin.balancete.findFirst({ where: { lodgeId: lodge.id, periodFrom: from, periodTo: to } });
      if (existing) { skipped++; continue; }
      await withTenant(lodge.id, (db) => generateBalancete(db, { lodgeId: lodge.id, from, to }));
      generated++;
    } catch {
      // segue pras próximas lojas mesmo se uma falhar
    }
  }

  return { lodges: lodges.length, generated, skipped, period: { from, to } };
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await run());
}
