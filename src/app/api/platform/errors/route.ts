import { prismaAdmin } from '@/lib/prisma';
import { platformAuthorized } from '@/lib/platform-auth';
import { NextResponse } from 'next/server';

// Painel do dono (header x-platform-token): lista dos erros registrados e "resolvido".
// GET   → últimos 100 por data da última ocorrência (abertos primeiro).
// PATCH → { id, resolved } marca/desmarca como resolvido (se voltar a ocorrer, reabre sozinho).
export async function GET(request: Request) {
  if (!platformAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const items = await prismaAdmin.errorEvent.findMany({ orderBy: [{ lastSeenAt: 'desc' }], take: 100 });
  items.sort((a, b) => Number(Boolean(a.resolvedAt)) - Number(Boolean(b.resolvedAt)));
  return NextResponse.json({ items });
}

export async function PATCH(request: Request) {
  if (!platformAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id || typeof body?.resolved !== 'boolean') return NextResponse.json({ error: 'Informe o erro e se foi resolvido.' }, { status: 400 });
  const found = await prismaAdmin.errorEvent.updateMany({ where: { id }, data: { resolvedAt: body.resolved ? new Date() : null } });
  if (found.count === 0) return NextResponse.json({ error: 'Erro não encontrado.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
