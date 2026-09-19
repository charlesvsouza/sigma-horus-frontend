import { auth } from '@/lib/auth';
import { requireLodgeAccess } from '@/lib/rbac';
import { withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// A trilha de auditoria mostra o que cada pessoa fez em todas as áreas da loja:
// só o Administrador, salvo se ele liberar 'Auditoria' para outro cargo em
// Configurações → Permissões.
export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ items: [] });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'audit', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const items = await withTenant(String(lodgeId), (db) =>
    db.auditLog.findMany({
      where: { lodgeId: String(lodgeId) },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  );

  return NextResponse.json({ items });
}
