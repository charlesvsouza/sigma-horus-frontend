import { runFullBackup } from '@/lib/backup';
import { NextResponse } from 'next/server';
import { cronAuthorized } from '@/lib/platform-auth';

/**
 * Backup completo e criptografado da plataforma (todas as lojas). Acionado
 * pelo Vercel Cron (GET, header Authorization: Bearer $CRON_SECRET) ou
 * manualmente (token = CRON_SECRET ou PLATFORM_OWNER_TOKEN).
 * Agendar: Vercel Cron, 1×/dia às 03:00 UTC (antes dos demais crons do dia).
 */
export const maxDuration = 60; // conforme a base cresce, ler 28 tabelas pode passar do padrão da função

const authorized = cronAuthorized;

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await runFullBackup();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await runFullBackup();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
