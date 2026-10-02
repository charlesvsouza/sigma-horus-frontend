import QRCode from 'qrcode';
import { auth } from '@/lib/auth';
import { getPayment } from '@/lib/asaas';
import { emitInvoiceCharge, fetchPixQr, type PixQr } from '@/lib/asaas-charge';
import { buildLodgeAsaasConfig } from '@/lib/asaas-config';
import { isAsaasMode, paymentInstructions } from '@/lib/collection';
import { round2 } from '@/lib/money';
import { lateChargeConfig, pixAmount } from '@/lib/late-charge';
import { buildPixPayload } from '@/lib/pix';
import { canPay, openBalance, PORTAL_WRITE_DENIED } from '@/lib/portal-dues';
import { CLOSED_INVOICE_STATUSES, ensureOpenInvoice } from '@/lib/portal-invoice';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// "Pagar" do portal: o próprio irmão paga uma conta dele em aberto.
//  - Modo Asaas: reaproveita a cobrança já emitida (se ainda vale) ou emite na hora, em Pix;
//    a baixa é automática pelo webhook (externalReference = Invoice.id).
//  - Modo Loja: Pix estático na chave da loja, com o valor exato; nada é gravado — a baixa
//    é da Tesouraria (extrato ou "Já paguei").
// A responsabilidade de cobrar continua sendo da Tesouraria; isto é só o autoatendimento.

function qrDataUrl(pix: PixQr | null): string | null {
  return pix?.encodedImage ? `data:image/png;base64,${pix.encodedImage}` : null;
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const memberId = session?.user?.memberId ? String(session.user.memberId) : null;
  if (!lodgeId || !memberId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'portal', 'write');
  // 403 = a matriz da loja não dá escrita no portal a este cargo (402 = assinatura): mensagem que orienta.
  if (!access.ok) return NextResponse.json({ error: access.status === 403 ? PORTAL_WRITE_DENIED : access.error }, { status: access.status });

  const { id } = await params;

  const ctx = await withTenant(lodgeId, async (db) => {
    // Filtra pelo próprio irmão: conta de outro membro simplesmente não existe para ele.
    const account = await db.account.findFirst({
      where: { id, lodgeId, memberId },
      select: {
        id: true, title: true, type: true, amount: true, dueDate: true, status: true, memberId: true, approvalStatus: true, degreeFeePlan: { select: { paymentMethod: true } },
        payments: { select: { amount: true } },
        invoices: {
          where: { status: { notIn: CLOSED_INVOICE_STATUSES } },
          select: { id: true, asaasPaymentId: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    const lodge = await db.lodge.findUnique({
      where: { id: lodgeId },
      select: {
        name: true, tradeName: true, city: true, pixKey: true, bankName: true, bankAgency: true, bankAccount: true,
        collectionMode: true, asaasApiKeyEnc: true, asaasEnv: true,
        chargeLateFeesOnPix: true, lateFeePercent: true, lateInterestPercentMonth: true,
      },
    });
    return { account, lodge };
  });

  const { account, lodge } = ctx;
  if (!account || !lodge) return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 });

  const balance = openBalance(account, account.payments);
  if (!canPay(account, memberId, balance)) {
    return NextResponse.json({ error: 'Esta conta não está disponível para pagamento pelo portal.' }, { status: 409 });
  }

  // ── Modo Loja: Pix estático na chave da loja ──────────────────────────────
  if (!isAsaasMode(lodge)) {
    if (!lodge.pixKey?.trim()) {
      return NextResponse.json({ error: 'A loja ainda não cadastrou a chave Pix. Fale com a Tesouraria para saber como pagar.' }, { status: 409 });
    }
    // Vencida e a loja cobra multa e juros no Pix: o valor sai atualizado até hoje.
    const pix = pixAmount(balance, account.dueDate, lateChargeConfig(lodge));
    const pixCopyPaste = buildPixPayload({
      key: lodge.pixKey,
      name: lodge.tradeName || lodge.name,
      city: lodge.city,
      amount: pix.total,
      txid: account.id,
    });
    const qrImage = await QRCode.toDataURL(pixCopyPaste, { margin: 1, width: 280, errorCorrectionLevel: 'M' });
    return NextResponse.json({
      mode: 'lodge',
      amount: pix.total,
      principal: pix.principal,
      lateCharge: pix.extra,
      pixCopyPaste,
      qrImage,
      instructions: paymentInstructions(lodge),
    });
  }

  // ── Modo Asaas ────────────────────────────────────────────────────────────
  const config = buildLodgeAsaasConfig(lodge);
  if (!config) return NextResponse.json({ error: 'O pagamento online ainda não está disponível nesta loja. Fale com a Tesouraria.' }, { status: 409 });

  // Cobrança já emitida e ainda aberta no Asaas com o mesmo valor: só mostra o Pix dela
  // (reemitir cancelaria um Pix que o irmão talvez já tenha copiado). Vencida lá ou com
  // valor diferente (pagamento parcial no meio) → reemite, com vencimento de hoje.
  const open = account.invoices[0] ?? null;
  if (open?.asaasPaymentId) {
    try {
      const current = await getPayment(config, open.asaasPaymentId);
      if (current?.status === 'PENDING' && round2(Number(current.value)) === round2(balance)) {
        const pix = await fetchPixQr(config, open.asaasPaymentId);
        if (pix) {
          return NextResponse.json({ mode: 'asaas', amount: balance, pixCopyPaste: pix.payload, qrImage: qrDataUrl(pix), invoiceUrl: current.invoiceUrl ?? null });
        }
      }
    } catch {
      // Cobrança sumiu/erro no Asaas: segue para a reemissão.
    }
  }

  // Conta sem cobrança (lançamento avulso, venda de material…): cria a Invoice agora.
  // Trava por conta: dois cliques seguidos não criam duas cobranças.
  const invoiceId = open?.id ?? (await ensureOpenInvoice(lodgeId, account, memberId, balance));

  const result = await emitInvoiceCharge({
    lodgeId,
    invoiceId,
    actorId: session!.user.id,
    billingType: 'PIX',
    value: balance,
    missingCpfError: 'Seu CPF não está no cadastro, e o Asaas exige CPF para gerar o Pix. Peça à Secretaria para completar seu cadastro.',
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    mode: 'asaas',
    amount: balance,
    pixCopyPaste: result.pix?.payload ?? null,
    qrImage: qrDataUrl(result.pix),
    invoiceUrl: result.invoiceUrl,
  });
}
