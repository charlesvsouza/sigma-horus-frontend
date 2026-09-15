import { auth } from '@/lib/auth';
import { normalizeRole } from '@/lib/rbac';
import { withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// A trilha de auditoria cruza vários recursos (contas, membros, cargos...) e
// não mapeia num Resource só do RBAC — restringe direto: qualquer papel
// exceto o obreiro comum (Membro só tem acesso a "portal" por padrão).
export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ items: [] });
  if (normalizeRole(session?.user?.role) === 'member') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  }

  const items = await withTenant(String(lodgeId), (db) =>
    db.auditLog.findMany({
      where: { lodgeId: String(lodgeId) },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  );

  return NextResponse.json({ items });
}
