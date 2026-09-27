import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { getReportSignatories } from '@/lib/report-signatories';
import ReciboClient from './ReciboClient';

// Server Component: recibo imprimível de um pagamento (mesmo padrão de
// "Salvar como PDF" do relatório de Fechamento — print CSS, sem lib de PDF).
// Quem lê o Financeiro vê qualquer recibo; o irmão (pelo portal) vê só os dele.
export default async function ReciboPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  const memberId = session?.user?.memberId ? String(session.user.memberId) : null;
  if (!lodgeId) notFound();

  const finance = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'read');
  let ownOnly = false;
  if (!finance.ok) {
    const portal = await requireLodgeAccess(String(lodgeId), role, 'portal', 'read');
    if (!portal.ok || !memberId) notFound();
    ownOnly = true;
  }

  const payment = await withTenant(String(lodgeId), (db) =>
    db.payment.findFirst({
      where: {
        id,
        lodgeId: String(lodgeId),
        // Pagamento lançado à mão pode não ter memberId: vale o dono da conta.
        ...(ownOnly ? { OR: [{ memberId }, { account: { memberId } }] } : {}),
      },
      include: {
        // Baixa sem "vincular a um membro": o pagador do recibo é o dono da conta.
        account: { select: { title: true, type: true, member: { select: { name: true, cpf: true } } } },
        member: { select: { name: true, cpf: true } },
        lodge: { select: { name: true, cnpj: true, addressLine: true, addressNumber: true, city: true, state: true, crestUrl: true } },
      },
    }),
  );
  if (!payment) notFound();

  // Tesoureiro em exercício na data do pagamento (o Venerável não assina recibo).
  const [treasurer] = await withTenant(String(lodgeId), (db) => getReportSignatories(db, String(lodgeId), { at: payment.paidAt }));

  return (
    <ReciboClient
      payment={{
        id: payment.id,
        amount: payment.amount,
        paidAt: payment.paidAt.toISOString(),
        method: payment.method,
        note: payment.note,
        accountTitle: payment.account?.title ?? '—',
        memberName: (payment.member ?? payment.account?.member)?.name ?? null,
        memberCpf: (payment.member ?? payment.account?.member)?.cpf ?? null,
        lodge: payment.lodge,
      }}
      treasurerName={treasurer?.name ?? null}
      issuedBy={session?.user?.name ?? null}
    />
  );
}
