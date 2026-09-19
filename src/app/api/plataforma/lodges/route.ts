import { prismaAdmin } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { platformAuthorized } from '@/lib/platform-auth';

// Lista de lojas ativas p/ o seletor de "Entrar como superadmin"
// (/plataforma/entrar). Protegido pelo mesmo token de /plataforma/convites e
// /plataforma/backups (x-platform-token).
const authorized = platformAuthorized;

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const lodges = await prismaAdmin.lodge.findMany({
    where: { status: 'active' },
    select: { id: true, name: true, slug: true, city: true, state: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ lodges });
}
