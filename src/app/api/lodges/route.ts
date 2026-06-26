import { prismaAdmin } from '@/lib/prisma';
import { seedLodgeDefaults } from '@/lib/seed-lodge';
import { validateInvite, consumeInvite, INVITE_ERROR_MESSAGES } from '@/lib/invites';
import { TRIAL_DAYS, TRIAL_PLAN } from '@/lib/stripe';
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
  const riteName = String(body?.riteName ?? '').trim() || undefined;
  const inviteCode = String(body?.invite ?? '').trim();

  if (!name || !slug || !adminName || !adminEmail || !adminPassword) {
    return NextResponse.json({ error: 'Preencha todos os campos.' }, { status: 400 });
  }

  // Cadastro de teste SOMENTE por convite.
  if (!inviteCode) {
    return NextResponse.json({ error: INVITE_ERROR_MESSAGES.missing }, { status: 403 });
  }
  const check = await validateInvite(inviteCode);
  if (!check.ok) {
    return NextResponse.json({ error: INVITE_ERROR_MESSAGES[check.reason] }, { status: 403 });
  }
  // Convite direcionado a um e-mail específico deve bater com o admin.
  if (check.invite.email && check.invite.email !== adminEmail) {
    return NextResponse.json(
      { error: 'Este convite é destinado a outro e-mail.' },
      { status: 403 },
    );
  }

  const existingUser = await prismaAdmin.user.findUnique({ where: { email: adminEmail } });
  if (existingUser) {
    return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 409 });
  }

  const existingLodge = await prismaAdmin.lodge.findUnique({ where: { slug } });
  if (existingLodge) {
    return NextResponse.json({ error: 'Este slug já está em uso.' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const result = await prismaAdmin.$transaction(async (tx) => {
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

    // Trial de 10 dias no plano Oficina. Ao fim, deve assinar um dos planos.
    await tx.subscription.create({
      data: {
        lodgeId: lodge.id,
        plan: TRIAL_PLAN,
        status: 'trialing',
        billingInterval: 'month',
        trialEndsAt,
      },
    });

    // Semeia ritos, potências, cargos do rito escolhido e plano de contas.
    await seedLodgeDefaults(tx, lodge.id, riteName);

    return { lodge, user };
  });

  // Consome o convite após a loja existir (fora da transação tenant-agnóstica).
  await consumeInvite(inviteCode, result.lodge.id);

  return NextResponse.json({
    lodge: result.lodge,
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
    },
  });
}
