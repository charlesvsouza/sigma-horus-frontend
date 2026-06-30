import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const where: Prisma.PaymentWhereInput = { lodgeId: String(lodgeId) };
  if (from || to) {
    const paidAt: Prisma.DateTimeFilter = {};
    if (from) paidAt.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      paidAt.lte = end;
    }
    where.paidAt = paidAt;
  }

  const payments = await withTenant(String(lodgeId), (db) =>
    db.payment.findMany({
      where,
      include: {
        account: { select: { title: true, type: true } },
        member: { select: { name: true } },
      },
      orderBy: { paidAt: 'desc' },
    }),
  );

  const header = 'Data;Valor;Método;Conta;Tipo;Membro;Observação';
  const rows = payments.map((p) =>
    [
      new Date(p.paidAt).toLocaleDateString('pt-BR'),
      p.amount.toFixed(2),
      p.method,
      p.account?.title ?? '',
      p.account?.type === 'RECEIVABLE' ? 'Receber' : 'Pagar',
      p.member?.name ?? '',
      p.note ?? '',
    ].join(';'),
  );

  const csv = `\uFEFF${header}\n${rows.join('\n')}`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="relatorio.csv"',
    },
  });
}
