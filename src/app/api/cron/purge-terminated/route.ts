import { prismaAdmin } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * Cron job que anonimiza dados de lojas encerradas há mais de 90 dias.
 * - Preserva registros financeiros (exigência legal contábil/fiscal — 5 anos).
 * - Anonimiza dados pessoais de membros (nome, CPF, contatos).
 * - Remove usuários de login.
 * - Marca a loja como purged.
 *
 * Segurança: mesmo padrão dos demais crons (CRON_SECRET ou PLATFORM_OWNER_TOKEN).
 * Agendar: Vercel Cron, 1×/dia às 05:00 UTC.
 */
const DATA_RETENTION_DAYS = 90;

function authorized(request: Request): boolean {
  const header = request.headers.get('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const qs = new URL(request.url).searchParams.get('token') ?? '';
  const accepted = [process.env.CRON_SECRET, process.env.PLATFORM_OWNER_TOKEN].filter(Boolean) as string[];
  return accepted.some((t) => t === bearer || t === qs);
}

async function run() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DATA_RETENTION_DAYS);

  const expired: { id: string; name: string }[] = await prismaAdmin.$queryRawUnsafe(
    `SELECT id, name FROM "Lodge" WHERE "terminatedAt" IS NOT NULL AND "terminatedAt" <= $1 AND status != 'purged'`,
    cutoff,
  );

  const results: { lodgeId: string; name: string; membersAnonymized: number; usersRemoved: number }[] = [];

  for (const lodge of expired) {
    const memberCount = await prismaAdmin.member.updateMany({
      where: { lodgeId: lodge.id },
      data: {
        name: '[anonimizado]',
        email: null,
        phone: null,
        cpf: null,
        rg: null,
        addressLine: null,
        addressNumber: null,
        neighborhood: null,
        city: null,
        state: null,
        zipCode: null,
        spouseName: null,
        fatherName: null,
        motherName: null,
      },
    });

    await prismaAdmin.relative.updateMany({
      where: { lodgeId: lodge.id },
      data: { name: '[anonimizado]', email: null, phone: null, cpf: null },
    });

    const userCount = await prismaAdmin.user.deleteMany({
      where: { lodgeId: lodge.id },
    });

    await prismaAdmin.lodge.update({
      where: { id: lodge.id },
      data: { status: 'purged' },
    });

    results.push({
      lodgeId: lodge.id,
      name: lodge.name,
      membersAnonymized: memberCount.count,
      usersRemoved: userCount.count,
    });
  }

  return { purged: results.length, details: results };
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await run());
}
