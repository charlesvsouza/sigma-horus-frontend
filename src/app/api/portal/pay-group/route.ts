import QRCode from 'qrcode';
import { agreementDebtAccountIds } from '@/lib/agreement-items';
import { auth } from '@/lib/auth';
import { getPayment } from '@/lib/asaas';
import { fetchPixQr } from '@/lib/asaas-charge';
import { buildLodgeAsaasConfig } from '@/lib/asaas-config';
import { emitGroupCharge } from '@/lib/asaas-group-server';
import { isAsaasMode, paymentInstructions } from '@/lib/collection';
import { round2, sumMoney } from '@/lib/money';
import { lateChargeConfig, pixAmount } from '@/lib/late-charge';
import { buildPixPayload } from '@/lib/pix';
import { canPay, openBalance, PORTAL_WRITE_DENIED } from '@/lib/portal-dues';
import { CLOSED_INVOICE_STATUSES, ensureOpenInvoice } from '@/lib/portal-invoice';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// "Pagar selecionadas": o irmão paga várias pendências com UM Pix.
//  - Modo Loja: QR estático na chave da loja com a soma (txid = conta mais antiga); o aviso
//    é o "Já paguei" agrupado (paid-notice-group).
//  - Modo Asaas: um Pix agrupado no Asaas (lib/asaas-group-server) — o webhook divide o valor
//    entre as contas. Reaproveita o grupo aberto se for exatamente o mesmo conjunto e total.

const MAX_GROUP = 24;

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const memberId = session?.user?.memberId ? String(session.user.memberId) : null;
  if (!lodgeId || !memberId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'portal', 'write');
  // 403 = a matriz da loja não dá escrita no portal a este cargo (402 = assinatura): mensagem que orienta.
  if (!access.ok) return NextResponse.json({ error: access.status === 403 ? PORTAL_WRITE_DENIED : access.error }, { status: access.status });

  const body = await request.json().catch(() => ({}));
  const accountIds = Array.isArray(body?.accountIds) ? [...new Set((body.accountIds as unknown[]).map(String))] : [];
  if (accountIds.length < 2) return NextResponse.json({ error: 'Escolha pelo menos duas contas para pagar juntas.' }, { status: 400 });
  if (accountIds.length > MAX_GROUP) return NextResponse.json({ error: `Escolha no máximo ${MAX_GROUP} contas de uma vez.` }, { status: 400 });

  const ctx = await withTenant(lodgeId, async (db) => ({
    accounts: await db.account.findMany({
      where: { id: { in: accountIds }, lodgeId, memberId },
      select: {
        id: true, title: true, type: true, amount: true, dueDate: true, status: true, memberId: true, approvalStatus: true, degreeFeePlan: { select: { paymentMethod: true } },
        payments: { select: { amount: true } },
        invoices: { where: { status: { notIn: CLOSED_INVOICE_STATUSES } }, select: { id: true, asaasPaymentId: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { dueDate: 'asc' },
    }),
    lodge: await db.lodge.findUnique({
      where: { id: lodgeId },
      select: {
        name: true, tradeName: true, city: true, pixKey: true, bankName: true, bankAgency: true, bankAccount: true, collectionMode: true, asaasApiKeyEnc: true, asaasEnv: true,
        chargeLateFeesOnPix: true, lateFeePercent: true, lateInterestPercentMonth: true,
      },
    }),
  }));
  const { accounts, lodge } = ctx;
  const inAgreement = await withTenant(lodgeId, (db) => agreementDebtAccountIds(db, lodgeId, memberId));
  if (accounts.some((a) => inAgreement.has(a.id))) return NextResponse.json({ error: 'Alguma das contas faz parte do seu acordo com a Loja. Pague as parcelas do acordo em “Meu acordo”.' }, { status: 409 });
  if (!lodge || accounts.length !== accountIds.length) return NextResponse.json({ error: 'Alguma das contas não foi encontrada.' }, { status: 404 });

  const items = accounts.map((a) => ({ account: a, balance: openBalance(a, a.payments) }));
  if (items.some((i) => !canPay(i.account, memberId, i.balance))) {
    return NextResponse.json({ error: 'Alguma das contas escolhidas não está mais disponível para pagamento. Recarregue a página.' }, { status: 409 });
  }
  const total = sumMoney(items.map((i) => i.balance));

  // ── Modo Loja ────────────────────────────────────────────────────────────
  if (!isAsaasMode(lodge)) {
    if (!lodge.pixKey?.trim()) {
      return NextResponse.json({ error: 'A loja ainda não cadastrou a chave Pix. Fale com a Tesouraria para saber como pagar.' }, { status: 409 });
    }
    // Multa e juros (se a loja cobra) de cada conta vencida, somados no mesmo Pix.
    const cfg = lateChargeConfig(lodge);
    const parts = items.map((i) => pixAmount(i.balance, i.account.dueDate, cfg));
    const lateCharge = sumMoney(parts.map((p) => p.extra));
    const pixTotal = sumMoney(parts.map((p) => p.total));
    const pixCopyPaste = buildPixPayload({ key: lodge.pixKey, name: lodge.tradeName || lodge.name, city: lodge.city, amount: pixTotal, txid: items[0].account.id });
    const qrImage = await QRCode.toDataURL(pixCopyPaste, { margin: 1, width: 280, errorCorrectionLevel: 'M' });
    return NextResponse.json({ mode: 'lodge', amount: pixTotal, principal: total, lateCharge, pixCopyPaste, qrImage, instructions: paymentInstructions(lodge), accountIds });
  }

  // ── Modo Asaas ───────────────────────────────────────────────────────────
  const config = buildLodgeAsaasConfig(lodge);
  if (!config) return NextResponse.json({ error: 'O pagamento online ainda não está disponível nesta loja. Fale com a Tesouraria.' }, { status: 409 });

  // Mesmo grupo já aberto (mesmas contas, mesmo total, ainda pendente no Asaas): só mostra o Pix.
  const openIds = items.map((i) => i.account.invoices[0]?.asaasPaymentId ?? null);
  const sameGroup = openIds[0] && openIds.every((id) => id === openIds[0]) ? openIds[0] : null;
  if (sameGroup) {
    const members = await withTenant(lodgeId, (db) => db.invoice.count({ where: { lodgeId, asaasPaymentId: sameGroup, status: { not: 'paid' } } }));
    if (members === items.length) {
      try {
        const current = await getPayment(config, sameGroup);
        if (current?.status === 'PENDING' && round2(Number(current.value)) === round2(total)) {
          const pix = await fetchPixQr(config, sameGroup);
          if (pix) return NextResponse.json({ mode: 'asaas', amount: total, pixCopyPaste: pix.payload, qrImage: `data:image/png;base64,${pix.encodedImage}`, invoiceUrl: current.invoiceUrl ?? null });
        }
      } catch {
        // Some no Asaas/erro: emite de novo abaixo.
      }
    }
  }

  const withInvoices = [];
  for (const i of items) {
    const invoiceId = i.account.invoices[0]?.id ?? (await ensureOpenInvoice(lodgeId, i.account, memberId, i.balance));
    withInvoices.push({ invoiceId, value: i.balance });
  }

  const result = await emitGroupCharge({
    lodgeId,
    memberId,
    items: withInvoices,
    actorId: session!.user.id,
    missingCpfError: 'Seu CPF não está no cadastro, e o Asaas exige CPF para gerar o Pix. Peça à Secretaria para completar seu cadastro.',
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    mode: 'asaas',
    amount: result.total,
    pixCopyPaste: result.pix?.payload ?? null,
    qrImage: result.pix?.encodedImage ? `data:image/png;base64,${result.pix.encodedImage}` : null,
    invoiceUrl: result.invoiceUrl,
  });
}
