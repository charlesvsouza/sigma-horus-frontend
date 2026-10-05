import { auth } from '@/lib/auth';
import { NOT_CANDIDATE } from '@/lib/candidate';
import { logAudit } from '@/lib/audit';
import { canManageRestrictions } from '@/lib/member-restriction';
import { MEMBER_LIST_INCLUDE, parseMemberFields, parseRelatives, validateMemberFields, validateRelatives } from '@/lib/member-fields';
import { withTenant } from '@/lib/prisma';
import { adminEmails, memberEmailIsAdminMessage, normalizeEmail } from '@/lib/admin-policy';
import { canGrantDuesBenefit } from '@/lib/dues-benefit';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) {
    return NextResponse.json({ items: [] });
  }

  const access = await requireLodgeAccess(String(lodgeId), role, 'members', 'read');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const manage = canManageRestrictions(role);
  const items = await withTenant(String(lodgeId), async (db) => {
    const members = await db.member.findMany({
      // Candidatos têm tela própria (Secretaria → Candidatos): aqui só obreiros.
      where: { lodgeId: String(lodgeId), ...NOT_CANDIDATE },
      include: MEMBER_LIST_INCLUDE,
      orderBy: { name: 'asc' },
    });
    // Restrições em vigor (selo na lista): só para quem as gerencia — o motivo pode ser sigiloso para o resto do quadro.
    if (!manage) return members;
    const active = await db.memberRestriction.findMany({ where: { lodgeId: String(lodgeId), status: 'active' }, select: { id: true, memberId: true, kind: true, expectedEndAt: true } });
    const byMember = new Map<string, typeof active>();
    for (const r of active) byMember.set(r.memberId, [...(byMember.get(r.memberId) ?? []), r]);
    return members.map((m) => ({ ...m, restrictions: byMember.get(m.id) ?? [] }));
  });

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await requireLodgeAccess(String(lodgeId), role, 'members', 'write');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await request.json().catch(() => undefined);
  if (body === undefined) return NextResponse.json({ error: 'Corpo da requisição inválido: envie um JSON válido.' }, { status: 400 });
  const fields = parseMemberFields(body);
  // Benefício de mensalidade: só o Venerável e o Administrador concedem.
  if (!canGrantDuesBenefit(role)) Object.assign(fields, { duesExempt: false, duesPotencyOnly: false, duesPotencyReason: null });
  const relatives = parseRelatives(body);

  const validationError = validateMemberFields(fields) ?? validateRelatives(relatives);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const newEmail = normalizeEmail(fields.email);
  if (newEmail && (await adminEmails(String(lodgeId))).includes(newEmail)) {
    return NextResponse.json({ error: memberEmailIsAdminMessage() }, { status: 409 });
  }

  const item = await withTenant(String(lodgeId), async (db) => {
    const created = await db.member.create({
      data: {
        lodgeId: String(lodgeId),
        ...fields,
        relatives: { create: relatives.map((r) => ({ lodgeId: String(lodgeId), ...r })) },
      },
      include: MEMBER_LIST_INCLUDE,
    });

    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'member', entityId: created.id, metadata: { name: fields.name } });
    return created;
  });

  return NextResponse.json({ item });
}
