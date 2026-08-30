import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import ReciboClient from './ReciboClient';

// Server Component: recibo imprimível de um pagamento (mesmo padrão de
// "Salvar como PDF" do relatório de Fechamento — print CSS, sem lib de PDF).
export default async function ReciboPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) notFound();

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'read');
  if (!access.ok) notFound();

  const payment = await withTenant(String(lodgeId), (db) =>
    db.payment.findFirst({
      where: { id, lodgeId: String(lodgeId) },
      include: {
        account: { select: { title: true, type: true } },
        member: { select: { name: true, cpf: true } },
        lodge: { select: { name: true, cnpj: true, addressLine: true, addressNumber: true, city: true, state: true } },
      },
    }),
  );
  if (!payment) notFound();

  return (
    <ReciboClient
      payment={{
        id: payment.id,
        amount: payment.amount,
        paidAt: payment.paidAt.toISOString(),
        method: payment.method,
        note: payment.note,
        accountTitle: payment.account?.title ?? '—',
        memberName: payment.member?.name ?? null,
        memberCpf: payment.member?.cpf ?? null,
        lodge: payment.lodge,
      }}
    />
  );
}
