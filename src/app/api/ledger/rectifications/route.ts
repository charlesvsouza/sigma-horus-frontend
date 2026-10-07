import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { requestRectification } from '@/lib/ledger-lock-server';
import { dispatch } from '@/lib/messaging';
import { buildLodgeChannels } from '@/lib/lodge-channels';
import { NextResponse } from 'next/server';

// O Tesoureiro (quem escreve em Contas) pede a retificação de um período já conferido; o Venerável/Administrador
// recebe um e-mail e dá a ciência na tela de Conferência.
export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => undefined);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  const user = { id: String(session.user.id), name: String(session.user.name ?? 'Usuário') };
  const dateFrom = String(body.dateFrom ?? '').slice(0, 10);
  const dateTo = String(body.dateTo ?? '').slice(0, 10);
  const reason = String(body.reason ?? '');

  const result = await withTenant(String(lodgeId), async (db) => {
    const r = await requestRectification(db, { lodgeId: String(lodgeId), user, reason, dateFrom, dateTo });
    if (!r.ok) return { r, approvers: [] as string[], lodgeName: '', channels: buildLodgeChannels(null) };
    const [approvers, lodge] = await Promise.all([
      db.user.findMany({ where: { lodgeId: String(lodgeId), status: 'active', role: { in: ['venerable', 'admin'] }, id: { not: user.id } }, select: { email: true } }),
      db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { name: true, crestUrl: true } }),
    ]);
    return { r, approvers: approvers.map((a) => a.email), lodgeName: lodge?.name ?? 'Sua loja', channels: buildLodgeChannels(lodge) };
  });
  if (!result.r.ok) return NextResponse.json({ error: result.r.error }, { status: 400 });

  // Aviso por e-mail (best-effort: o pedido já está salvo e aparece na tela de Conferência).
  const fmt = (d: string) => d.split('-').reverse().join('/');
  for (const email of result.approvers) {
    await dispatch(
      'email',
      email,
      `Pedido de retificação do livro — ${result.lodgeName}`,
      `${user.name} pediu para retificar lançamentos de ${fmt(dateFrom)} a ${fmt(dateTo)}, período já conferido com o banco.\n\nMotivo: ${reason.trim()}\n\nPara dar a ciência (concordar ou não), abra Tesouraria → Conferência com o banco, no Sigma Horus.`,
      result.channels,
    ).catch(() => null);
  }
  return NextResponse.json({ ok: true, id: result.r.id });
}
