import { alertAbsenceStreaks } from '@/lib/attendance-streak-server';
import { alertBrokenAgreements } from '@/lib/member-block-server';
import { runDailyNotifications } from '@/lib/notifications';
import { NextResponse } from 'next/server';
import { cronAuthorized } from '@/lib/platform-auth';

// Gatilhos diários: aniversariantes (obreiro + família), jubileus e lembretes de
// cobrança, e o alerta de acordo de regularização quebrado (parcela vencida e não paga). Acionado pelo Vercel Cron (GET, Authorization: Bearer $CRON_SECRET)
// ou manualmente (token = CRON_SECRET ou PLATFORM_OWNER_TOKEN).
const authorized = cronAuthorized;

async function run() {
  const notifications = await runDailyNotifications();
  const agreements = await alertBrokenAgreements().catch((err) => {
    console.error('acordos de regularização: falha no alerta diário', err);
    return null;
  });
  // 3 ou mais faltas seguidas: e-mail ao Venerável e ao Hospitaleiro (uma vez por sequência).
  const absences = await alertAbsenceStreaks().catch((err) => {
    console.error('faltas seguidas: falha no alerta diário', err);
    return null;
  });
  return { ...notifications, agreements, absences };
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await run());
}
