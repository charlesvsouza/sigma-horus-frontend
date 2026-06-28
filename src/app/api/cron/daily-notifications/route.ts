import { runDailyNotifications } from '@/lib/notifications';
import { NextResponse } from 'next/server';

// Gatilhos diários: aniversariantes (obreiro + família), jubileus e lembretes de
// cobrança. Acionado pelo Vercel Cron (GET, Authorization: Bearer $CRON_SECRET)
// ou manualmente (token = CRON_SECRET ou PLATFORM_OWNER_TOKEN).
function authorized(request: Request): boolean {
  const header = request.headers.get('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const qs = new URL(request.url).searchParams.get('token') ?? '';
  const accepted = [process.env.CRON_SECRET, process.env.PLATFORM_OWNER_TOKEN].filter(Boolean) as string[];
  return accepted.some((t) => t === bearer || t === qs);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await runDailyNotifications());
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await runDailyNotifications());
}
