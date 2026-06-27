import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import { seedOfficesForRite } from '@/lib/seed-lodge';
import { OFFICES_BY_RITE } from '@/lib/masonic-reference';
import { NextResponse } from 'next/server';

// Semeia (ou completa) os cargos do rito da loja, sem apagar cargos existentes.
// Usa o riteName enviado no corpo ou, na falta, o rito salvo na loja.
export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (normalizeRole(role) !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem semear os cargos.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const bodyRite = String(body?.riteName ?? '').trim() || undefined;

  const result = await withTenant(String(lodgeId), async (db) => {
    const riteName =
      bodyRite ??
      (await db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { riteName: true } }))?.riteName ??
      undefined;

    if (!riteName) {
      return { error: 'Defina o rito da loja antes de semear os cargos.' as const };
    }
    if (!OFFICES_BY_RITE[riteName]) {
      return { error: `Não há catálogo de cargos para o rito "${riteName}".` as const };
    }

    const r = await seedOfficesForRite(db, String(lodgeId), riteName);
    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session.user.id,
      action: 'CREATE',
      entity: 'lodge-offices-seed',
      entityId: String(lodgeId),
      metadata: r,
    });
    return { seeded: r };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, ...result });
}
