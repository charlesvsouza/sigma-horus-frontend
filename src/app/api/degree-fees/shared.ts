import { auth } from '@/lib/auth';
import { canManageDegreeFees } from '@/lib/degree-fee';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { NextResponse } from 'next/server';

// Taxas de grau: Administrador, Venerável e Tesoureiro (decisão do dono, fixa —
// ver lib/degree-fee.ts). Escrita também exige assinatura vigente.
export async function degreeFeeAccess(mode: 'read' | 'write') {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!session?.user || !lodgeId) return { ok: false as const, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!canManageDegreeFees(session.user.role)) {
    return { ok: false as const, res: NextResponse.json({ error: 'Acesso restrito ao Administrador, ao Venerável e ao Tesoureiro.' }, { status: 403 }) };
  }
  if (mode === 'write') {
    const sub = await requireActiveSubscription(String(lodgeId));
    if (!sub.ok) return { ok: false as const, res: NextResponse.json({ error: sub.error }, { status: sub.status }) };
  }
  return { ok: true as const, session, lodgeId: String(lodgeId) };
}

/** null = vazio; undefined = inválida. */
export const parseDate = (v: unknown): Date | null | undefined => {
  const s = v == null ? '' : String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
};
