import { auth } from '@/lib/auth';
import { prismaAdmin } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Gestão de usuários da loja (apenas Administrador). Lista os logins e o papel
// de cada um. A criação de login do obreiro é feita por "Conceder acesso" no
// cadastro do membro; aqui o admin ajusta papel/status.
export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ items: [] });
  if (normalizeRole(session?.user?.role) !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  }

  const items = await prismaAdmin.user.findMany({
    where: { lodgeId: String(lodgeId) },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      memberId: true,
      mustChangePassword: true,
      createdAt: true,
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ items });
}
