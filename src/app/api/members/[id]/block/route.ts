import { auth } from '@/lib/auth';
import { blockMember, previewBlock } from '@/lib/member-block-server';
import { canBlockMembers, parseBlockInput } from '@/lib/member-block';
import { todayBR } from '@/lib/date-only';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

// Prévia do bloqueio: o que vai para o acordo (dívidas em aberto, com saldo) e se o irmão pode ser bloqueado.
export async function GET(_request: Request, { params }: Ctx) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session.user.role, 'accounts', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const preview = await withTenant(String(lodgeId), (db) => previewBlock(db, String(lodgeId), id));
  if (!preview) return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });
  return NextResponse.json({ ...preview, mayBlock: canBlockMembers(session.user.role) });
}

// Bloqueia o cadastro (comunicado à Potência já feito pelo Venerável) e monta o acordo de regularização.
// Só Venerável e Administrador.
export async function POST(request: Request, { params }: Ctx) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session.user.role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!canBlockMembers(session.user.role)) {
    return NextResponse.json({ error: 'Só o Venerável Mestre ou o Administrador podem bloquear um irmão.' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== true) {
    return NextResponse.json({ error: 'Confirme que o comunicado à Potência já foi feito.' }, { status: 400 });
  }
  const parsed = parseBlockInput(body ?? {}, todayBR());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  let powerSentAt: Date | null = null;
  if (body?.powerSentAt) {
    powerSentAt = typeof body.powerSentAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.powerSentAt) ? new Date(`${body.powerSentAt}T00:00:00Z`) : null;
    if (!powerSentAt || Number.isNaN(powerSentAt.getTime())) return NextResponse.json({ error: 'Data do comunicado à Potência inválida.' }, { status: 400 });
  }

  const result = await blockMember(String(lodgeId), id, String(session.user.id), parsed.value, {
    powerProtocol: typeof body?.powerProtocol === 'string' ? body.powerProtocol.slice(0, 120) : null,
    powerSentAt,
    note: typeof body?.note === 'string' ? body.note.slice(0, 1000) : null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, blockId: result.blockId });
}
