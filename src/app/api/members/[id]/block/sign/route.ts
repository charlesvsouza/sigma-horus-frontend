import { auth } from '@/lib/auth';
import { signAgreement } from '@/lib/agreement-signature-server';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Assina digitalmente o Termo de acordo de regularização: Venerável/Administrador, Tesoureiro ou o próprio
// irmão do acordo. Cada parte assina uma vez; fica a marca (quem, quando, hash do acordo e código).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session.user.role, 'portal', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const result = await signAgreement(
    String(lodgeId), id,
    { id: String(session.user.id), name: String(session.user.name ?? 'Usuário'), role: session.user.role, memberId: session.user.memberId ? String(session.user.memberId) : null },
    ip,
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, code: result.code, party: result.party });
}
