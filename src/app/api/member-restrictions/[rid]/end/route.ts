import { auth } from '@/lib/auth';
import { canManageRestrictions } from '@/lib/member-restriction';
import { endRestriction } from '@/lib/member-restriction-server';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Encerra a restrição (cumprimento, reabilitação, readmissão, retorno da licença). O irmão volta à
// situação anterior se o cadastro ainda estiver na situação que a restrição impôs.
export async function POST(request: Request, { params }: { params: Promise<{ rid: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session.user.role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!canManageRestrictions(session.user.role)) {
    return NextResponse.json({ error: 'Só o Venerável Mestre, o Administrador e o Secretário encerram restrições.' }, { status: 403 });
  }
  const { rid } = await params;
  const body = await request.json().catch(() => ({}));
  const note = typeof body?.note === 'string' ? body.note.slice(0, 500) : '';
  const result = await endRestriction(String(lodgeId), rid, String(session.user.id), note);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
