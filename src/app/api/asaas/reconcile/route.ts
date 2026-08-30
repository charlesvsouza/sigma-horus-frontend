import { auth } from '@/lib/auth';
import { getPayment } from '@/lib/asaas';
import { buildLodgeAsaasConfig } from '@/lib/asaas-config';
import { settleAsaasInvoicePayment } from '@/lib/asaas-settlement';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { dispatch, EMPTY_CHANNELS } from '@/lib/messaging';
import { NextResponse } from 'next/server';

// Estados do Asaas que significam "dinheiro recebido" (mesmo critério do webhook).
const PAID_STATUSES = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']);

// Reconciliação reversa: verifica no Asaas o status real de cada cobrança
// emitida e ainda não paga localmente. Cobre o caso do webhook ter falhado ou
// nunca chegado (ex.: token trocado, instabilidade). Usa lib/asaas.ts
// getPayment, já existente mas até então não usado em lugar nenhum.
export async function POST() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const lodge = await withTenant(String(lodgeId), (db) =>
    db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { asaasApiKeyEnc: true, asaasEnv: true, name: true } }),
  );
  const config = buildLodgeAsaasConfig(lodge);
  if (!config) return NextResponse.json({ error: 'Asaas não conectado para esta loja.' }, { status: 409 });

  const pendingInvoices = await withTenant(String(lodgeId), (db) =>
    db.invoice.findMany({
      where: { lodgeId: String(lodgeId), status: { not: 'paid' }, asaasPaymentId: { not: null } },
      include: { member: { select: { name: true, email: true } } },
    }),
  );

  let reconciled = 0;
  let stillPending = 0;
  let errors = 0;

  for (const invoice of pendingInvoices) {
    try {
      const remote = await getPayment(config, invoice.asaasPaymentId!);
      if (!PAID_STATUSES.has(remote?.status)) {
        stillPending++;
        continue;
      }

      await withTenant(String(lodgeId), (db) =>
        settleAsaasInvoicePayment(db, {
          lodgeId: String(lodgeId),
          invoiceId: invoice.id,
          accountId: invoice.accountId,
          memberId: invoice.memberId,
          amount: Number(remote.value ?? invoice.amount),
          asaasPaymentId: invoice.asaasPaymentId!,
          userId: session.user.id,
        }),
      );
      reconciled++;

      if (invoice.member?.email) {
        const valor = Number(remote.value ?? invoice.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        dispatch(
          'email',
          invoice.member.email,
          `Pagamento confirmado — ${lodge?.name}`,
          `Olá, ${invoice.member.name}.\n\nConfirmamos o recebimento do seu pagamento de ${valor} referente à cobrança ${invoice.number}.\n\nAtenciosamente,\n${lodge?.name}`,
          EMPTY_CHANNELS,
        ).catch(() => {});
      }
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ checked: pendingInvoices.length, reconciled, stillPending, errors });
}
