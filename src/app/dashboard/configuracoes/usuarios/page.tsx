import { auth } from '@/lib/auth';
import { prismaAdmin } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import UsuariosClient from './UsuariosClient';

// Server Component: lista usuários da loja (admin-only, via prismaAdmin).
export default async function UsuariosPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const isAdmin = !!lodgeId && normalizeRole(session?.user?.role) === 'admin';

  const rows = isAdmin
    ? await prismaAdmin.user.findMany({
        where: { lodgeId: String(lodgeId) },
        select: { id: true, name: true, email: true, role: true, status: true, memberId: true, mustChangePassword: true, createdAt: true },
        orderBy: { name: 'asc' },
      })
    : [];

  const users = rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    memberId: u.memberId ?? null,
    mustChangePassword: u.mustChangePassword,
    createdAt: u.createdAt.toISOString(),
  }));

  return <UsuariosClient users={users} denied={!isAdmin} />;
}
