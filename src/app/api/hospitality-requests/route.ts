import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { dispatch, EMPTY_CHANNELS } from '@/lib/messaging';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Pedido leve do obreiro à Hospitalaria (propor campanha ou solicitar
// auxílio) — GET é o Hospitaleiro/Admin/Venerável olhando a fila (gate por
// "campaigns", mesmo resource da Hospitalaria); POST é o próprio obreiro
// criando (gate por "portal", que é o que o papel member tem). Cada POST
// dispara e-mail pra quem pode atender (admin/venerable/hospitaller) —
// não espera o cron diário, é um pedido pontual.
export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ items: [] });

  const access = await requireLodgeAccess(String(lodgeId), role, 'campaigns', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const items = await withTenant(String(lodgeId), (db) =>
    db.hospitalityRequest.findMany({
      where: { lodgeId: String(lodgeId) },
      include: { member: { select: { id: true, name: true, phone: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  );

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  const memberId = session?.user?.memberId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!memberId) return NextResponse.json({ error: 'Seu usuário não está vinculado a um cadastro de membro.' }, { status: 400 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'portal', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => ({}));
  const title = String(body?.title ?? '').trim();
  const description = body?.description ? String(body.description).trim() : null;
  if (!title) return NextResponse.json({ error: 'Informe um título para o pedido.' }, { status: 400 });

  const result = await withTenant(String(lodgeId), async (db) => {
    const [member, lodge, recipients] = await Promise.all([
      db.member.findFirst({ where: { id: String(memberId), lodgeId: String(lodgeId) }, select: { name: true } }),
      db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { name: true } }),
      db.user.findMany({ where: { lodgeId: String(lodgeId), role: { in: ['admin', 'venerable', 'hospitaller'] }, status: 'active' }, select: { email: true } }),
    ]);

    const created = await db.hospitalityRequest.create({
      data: { lodgeId: String(lodgeId), memberId: String(memberId), title, description },
    });

    const subject = `Pedido à Hospitalaria: ${title}`;
    const text = `O irmão ${member?.name ?? 'um obreiro'} enviou um pedido à Hospitalaria da ${lodge?.name ?? 'loja'}.\n\nTítulo: ${title}${description ? `\n\n${description}` : ''}\n\nAcesse Hospitalaria → Pedidos dos obreiros para ver os detalhes.`;
    for (const r of recipients) {
      if (!r.email) continue;
      const sendResult = await dispatch('email', r.email, subject, text, EMPTY_CHANNELS);
      await db.messageLog.create({ data: { lodgeId: String(lodgeId), memberId: String(memberId), channel: 'email', title: subject, content: text, status: sendResult.status, error: sendResult.detail ?? null } });
    }

    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'hospitality-request', entityId: created.id, metadata: { title } });
    return created;
  });

  return NextResponse.json({ item: result });
}
