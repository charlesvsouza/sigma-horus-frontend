import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { MEMBER_LIST_INCLUDE, parseMemberFields, parseRelatives } from '@/lib/member-fields';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json();
  const fields = parseMemberFields(body);
  const relatives = parseRelatives(body);
  if (!fields.name) {
    return NextResponse.json({ error: 'Nome do membro é obrigatório.' }, { status: 400 });
  }

  const item = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.member.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { id: true } });
    if (!existing) return null;

    // Replace-all dos familiares: apaga os atuais e recria a partir do form.
    const updated = await db.member.update({
      where: { id },
      data: {
        ...fields,
        relatives: {
          deleteMany: {},
          create: relatives.map((r) => ({ lodgeId: String(lodgeId), ...r })),
        },
      },
      include: MEMBER_LIST_INCLUDE,
    });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'member', entityId: id, metadata: { name: fields.name } });
    return updated;
  });

  if (!item) return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });
  return NextResponse.json({ item });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const result = await withTenant(String(lodgeId), async (db) => {
    const member = await db.member.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { id: true, name: true } });
    if (!member) return { status: 404 as const };

    // Guarda: não excluir membro com histórico financeiro ou documentos (evita
    // perder rastreabilidade e deixar objetos órfãos no R2). Nesse caso, inativar.
    const [invoices, payments, documents] = await Promise.all([
      db.invoice.count({ where: { memberId: id } }),
      db.payment.count({ where: { memberId: id } }),
      db.document.count({ where: { memberId: id } }),
    ]);
    if (invoices > 0 || payments > 0 || documents > 0) {
      return { status: 409 as const, blocked: { invoices, payments, documents } };
    }

    await db.member.delete({ where: { id } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'DELETE', entity: 'member', entityId: id, metadata: { name: member.name } });
    return { status: 200 as const };
  });

  if (result.status === 404) return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });
  if (result.status === 409) {
    return NextResponse.json(
      {
        error: 'Este membro possui histórico financeiro ou documentos e não pode ser excluído. Inative o cadastro em vez de excluir.',
        details: result.blocked,
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
