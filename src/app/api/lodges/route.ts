import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ lodge: null });
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = String(body?.name ?? '').trim();
  const slug = String(body?.slug ?? '').trim().toLowerCase();
  const adminName = String(body?.adminName ?? '').trim();
  const adminEmail = String(body?.adminEmail ?? '').trim().toLowerCase();
  const adminPassword = String(body?.adminPassword ?? '');

  if (!name || !slug || !adminName || !adminEmail || !adminPassword) {
    return NextResponse.json({ error: 'Preencha todos os campos.' }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existingUser) {
    return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 409 });
  }

  const existingLodge = await prisma.lodge.findUnique({ where: { slug } });
  if (existingLodge) {
    return NextResponse.json({ error: 'Este slug já está em uso.' }, { status: 409 });
  }

  const userCount = await prisma.user.count();
  const isFirstRun = userCount === 0;

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const result = await prisma.$transaction(async (tx) => {
    const lodge = await tx.lodge.create({
      data: {
        name,
        slug,
        status: 'active',
      },
    });

    const user = await tx.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        passwordHash,
        role: 'admin',
        lodgeId: lodge.id,
      },
    });

    return { lodge, user };
  });

  return NextResponse.json({
    lodge: result.lodge,
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
    },
  });
}
