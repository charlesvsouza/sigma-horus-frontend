import { auth } from '@/lib/auth';
import { firstInvalidDate, parseDateInput, todayBR } from '@/lib/date-only';
import { canManageRestrictions, RESTRICTION_KINDS } from '@/lib/member-restriction';
import { applyRestriction } from '@/lib/member-restriction-server';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Histórico de restrições do irmão (em vigor e encerradas). Só quem gerencia (Venerável, Administrador,
// Secretário) e o próprio irmão — o motivo pode ser sigiloso para o resto do quadro.
export async function GET(_request: Request, { params }: Ctx) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const isSelf = session.user.memberId === id;
  if (!isSelf && !canManageRestrictions(session.user.role)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  const rows = await withTenant(String(lodgeId), (db) => db.memberRestriction.findMany({ where: { lodgeId: String(lodgeId), memberId: id }, orderBy: { startedAt: 'desc' } }));
  return NextResponse.json({ items: rows, mayManage: canManageRestrictions(session.user.role), kinds: RESTRICTION_KINDS });
}

// Registra a restrição com o motivo (artigo). Venerável, Administrador e Secretário.
export async function POST(request: Request, { params }: Ctx) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session.user.role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!canManageRestrictions(session.user.role)) {
    return NextResponse.json({ error: 'Só o Venerável Mestre, o Administrador e o Secretário registram restrições.' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  const invalid = firstInvalidDate(body, ['startedAt', 'deliberatedAt', 'expectedEndAt']);
  if (invalid) return NextResponse.json({ error: `Data inválida em "${invalid}".` }, { status: 400 });

  const startedAt = parseDateInput(body.startedAt) ?? todayBR();
  const result = await applyRestriction(String(lodgeId), id, String(session.user.id), {
    kind: text(body.kind, 40),
    startedAt,
    deliberatedAt: parseDateInput(body.deliberatedAt),
    expectedEndAt: parseDateInput(body.expectedEndAt),
    reason: text(body.reason, 2000),
    destination: text(body.destination, 200),
    protocol: text(body.protocol, 80),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
