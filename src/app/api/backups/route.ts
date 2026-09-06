import { runFullBackup } from '@/lib/backup';
import { prismaAdmin } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Endpoint do DONO DA PLATAFORMA (não é multi-tenant) — histórico e disparo
// manual do backup completo, consumido por /plataforma/backups. Protegido
// pelo mesmo token secreto usado em /api/invites (x-platform-token).
function authorized(request: Request): boolean {
  const token = process.env.PLATFORM_OWNER_TOKEN;
  if (!token) return false;
  const header = request.headers.get('x-platform-token') ?? '';
  return header.length > 0 && header === token;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const backups = await prismaAdmin.backupLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 60,
  });
  return NextResponse.json({ backups });
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await runFullBackup();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
