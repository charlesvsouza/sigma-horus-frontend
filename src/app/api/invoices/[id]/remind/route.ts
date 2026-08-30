import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { dispatch, EMPTY_CHANNELS } from '@/lib/messaging';
import { NextResponse } from 'next/server';

// Lembrete manual de uma cobrança específica — complementa o lembrete
// automático do cron diário (3 dias antes do vencimento), pra quando o
// tesoureiro quer cobrar na hora (ex.: cobrança já vencida).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;

  const data = await withTenant(String(lodgeId), async (db) => {
    const invoice = await db.invoice.findFirst({
      where: { id, lodgeId: String(lodgeId) },
      include: { member: { select: { name: true, email: true } }, lodge: { select: { name: true } } },
    });
    return invoice;
  });

  if (!data) return NextResponse.json({ error: 'Cobrança não encontrada.' }, { status: 404 });
  if (data.status === 'paid') return NextResponse.json({ error: 'Esta cobrança já está paga.' }, { status: 409 });
  if (!data.member?.email) return NextResponse.json({ error: 'O membro desta cobrança não tem e-mail cadastrado.' }, { status: 400 });

  const valor = Number(data.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const vencimento = new Date(data.dueDate).toLocaleDateString('pt-BR');
  const result = await dispatch(
    'email',
    data.member.email,
    `Lembrete de cobrança — ${data.lodge.name}`,
    `Olá, ${data.member.name}.\n\nLembramos que a cobrança ${data.number}, no valor de ${valor}, com vencimento em ${vencimento}, ainda está em aberto.\n\nAtenciosamente,\n${data.lodge.name}`,
    EMPTY_CHANNELS,
  );

  if (result.status === 'failed') {
    return NextResponse.json({ error: result.detail ?? 'Falha ao enviar o lembrete.' }, { status: 502 });
  }
  return NextResponse.json({ success: true, status: result.status });
}
