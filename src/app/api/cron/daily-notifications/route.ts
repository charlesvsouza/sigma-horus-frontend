import { runDailyNotifications } from '@/lib/notifications';
import { NextResponse } from 'next/server';
import { cronAuthorized } from '@/lib/platform-auth';

// Gatilhos diários: aniversariantes (obreiro + família), jubileus e lembretes de
// cobrança. Acionado pelo Vercel Cron (GET, Authorization: Bearer $CRON_SECRET)
// ou manualmente (token = CRON_SECRET ou PLATFORM_OWNER_TOKEN).
const authorized = cronAuthorized;

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await runDailyNotifications());
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await runDailyNotifications());
}
