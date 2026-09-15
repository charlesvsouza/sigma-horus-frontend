import { prismaAdmin } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Lista de lojas ativas p/ o seletor de "Entrar como superadmin"
// (/plataforma/entrar). Protegido pelo mesmo token de /plataforma/convites e
// /plataforma/backups (x-platform-token).
function authorized(request: Request): boolean {
  const token = process.env.PLATFORM_OWNER_TOKEN;
  if (!token) return false;
  const header = request.headers.get('x-platform-token') ?? '';
  return header.length > 0 && header === token;
}

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
