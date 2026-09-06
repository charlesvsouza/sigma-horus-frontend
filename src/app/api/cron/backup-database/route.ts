import { runFullBackup } from '@/lib/backup';
import { NextResponse } from 'next/server';

/**
 * Backup completo e criptografado da plataforma (todas as lojas). Acionado
 * pelo Vercel Cron (GET, header Authorization: Bearer $CRON_SECRET) ou
 * manualmente (token = CRON_SECRET ou PLATFORM_OWNER_TOKEN).
 * Agendar: Vercel Cron, 1×/dia às 03:00 UTC (antes dos demais crons do dia).
 */
function authorized(request: Request): boolean {
  const header = request.headers.get('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const qs = new URL(request.url).searchParams.get('token') ?? '';
  const accepted = [process.env.CRON_SECRET, process.env.PLATFORM_OWNER_TOKEN].filter(Boolean) as string[];
  return accepted.some((t) => t === bearer || t === qs);
}

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
