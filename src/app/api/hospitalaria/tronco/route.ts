import { auth } from '@/lib/auth';
import { createCustomer, createPayment } from '@/lib/asaas';
import { findFundChart } from '@/lib/funds';
import { buildLodgeAsaasConfig } from '@/lib/asaas-config';
import { fetchPixQr } from '@/lib/asaas-charge';
import { isAsaasMode } from '@/lib/collection';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { isValidMoney } from '@/lib/money';
import { lockKey } from '@/lib/locks';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { activeSessionFor } from '@/lib/tronco-session';
import { nextSequenceNumbers } from '@/lib/invoice-number';

// Pelo Asaas, doações a partir de R$ 50,00 (a tarifa por Pix recebido pesa em valores pequenos). Abaixo disso: Pix na chave da
// loja ou o tronco passado na sessão.
export const MIN_ASAAS_DONATION = 50;
const PRESET_AMOUNTS = [50, 100, 200, 500];

// Número de referência da doação, mesmo esquema de nextInvoiceNumber em
// api/invoices/route.ts (COB-AAAAMM-NNNN), com prefixo próprio (DOA-) pra não
// colidir com a numeração de cobranças normais.
async function nextDonationNumber(db: { invoice: { findMany: (args: { where: Record<string, unknown>; select: { number: true } }) => Promise<{ number: string }[]> } }, lodgeId: string) {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `DOA-${ym}-`;
  const existing = await db.invoice.findMany({ where: { lodgeId, number: { startsWith: prefix } }, select: { number: true } });
  return nextSequenceNumbers(prefix, existing.map((i) => i.number), 1)[0];
}

// Doação ao Tronco de Solidariedade, aberta a qualquer membro logado (não é
// gated por accounts:write — é o próprio doador que aciona, não a Tesouraria).
// Sempre via Pix (imediato, valores pequenos e espontâneos). Reaproveita o
// pipeline de cobrança Asaas já existente (Invoice → Payment → webhook): o
// webhook em api/asaas/webhook resolve pelo Invoice.id em externalReference
// e já sabe dar baixa em Account/Invoice — nenhuma mudança lá foi necessária.
export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const memberId = session?.user?.memberId;
  if (!lodgeId || !memberId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const subscription = await requireActiveSubscription(String(lodgeId));
  if (!subscription.ok) return NextResponse.json({ error: subscription.error, code: subscription.code }, { status: subscription.status });

  const body = await request.json().catch(() => ({}));
  const amount = Number(body?.amount ?? 0);
  if (!isValidMoney(amount)) {
    return NextResponse.json({ error: 'Informe um valor de doação válido (maior que zero, com no máximo 2 casas decimais).' }, { status: 400 });
  }

  if (amount < MIN_ASAAS_DONATION) {
    return NextResponse.json({ error: `Pelo Pix do Asaas, as doações começam em R$ ${MIN_ASAAS_DONATION},00. Para valores menores, doe na chave Pix da loja ou no tronco da sessão.` }, { status: 400 });
  }

  const ctx = await withTenant(String(lodgeId), async (db) => {
    const [lodge, member, tronco] = await Promise.all([
      db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { asaasApiKeyEnc: true, asaasEnv: true, collectionMode: true } }),
      db.member.findUnique({ where: { id: String(memberId) } }),
      findFundChart(db, String(lodgeId), 'tronco', 'REVENUE'),
    ]);
    return { lodge, member, tronco };
  });

  // Modo Loja: o dinheiro entra direto na conta da loja — não se emite no Asaas, mesmo com chave conectada.
  if (!isAsaasMode(ctx.lodge)) {
    return NextResponse.json({ error: 'Esta loja recebe no Modo Loja: a doação por Pix pelo portal exige o Modo Asaas. Doe direto na chave Pix da loja ou com a Hospitalaria.' }, { status: 409 });
  }
  const config = buildLodgeAsaasConfig(ctx.lodge);
  if (!config) {
    return NextResponse.json({ error: 'Asaas não conectado para esta loja. Configure em Integrações.' }, { status: 409 });
  }
  if (!ctx.member) {
    return NextResponse.json({ error: 'Cadastro de membro não encontrado.' }, { status: 404 });
  }
  if (!ctx.tronco) {
    return NextResponse.json({ error: 'Configure a conta do Tronco de Solidariedade: use "Atualizar plano de contas" em Cadastros.' }, { status: 400 });
  }
  const member = ctx.member;
  if (!member.cpf) {
    return NextResponse.json({ error: 'Seu CPF não está no cadastro, e o Asaas exige CPF para gerar o Pix. Peça à Secretaria para completar seu cadastro.' }, { status: 400 });
  }
  const cpf = member.cpf;

  // Sessão em curso agora (janela: 2 h antes até o fim + 3 h; sem nenhuma, a do mesmo dia). A doação fica ligada a ela; sem sessão
  // marcada para hoje, segue sem vínculo (não é bloqueada por isso).
  const nearby = await withTenant(String(lodgeId), (db) =>
    db.session.findMany({
      where: { lodgeId: String(lodgeId), date: { gte: new Date(Date.now() - 36 * 3_600_000), lte: new Date(Date.now() + 36 * 3_600_000) } },
      select: { id: true, title: true, date: true, endDate: true },
    }),
  );
  const todaySession = activeSessionFor(nearby, new Date());

  // 1) Grava Account + Invoice (só banco, rápido) — dentro da transação.
  const dueDate = new Date();
  const created = await withTenant(String(lodgeId), async (db) => {
    const account = await db.account.create({
      data: {
        lodgeId: String(lodgeId),
        type: 'RECEIVABLE',
        title: 'Doação — Tronco de Solidariedade',
        amount,
        dueDate,
        chartAccountId: ctx.tronco!.id,
        memberId: member.id,
        sessionId: todaySession?.id ?? null,
      },
    });
    await lockKey(db, `invoice-number:${String(lodgeId)}:DOA`);
    const number = await nextDonationNumber(db, String(lodgeId));
    const invoice = await db.invoice.create({
      data: {
        lodgeId: String(lodgeId),
        accountId: account.id,
        memberId: member.id,
        number,
        amount,
        dueDate,
        description: 'Doação — Tronco de Solidariedade',
      },
    });
    return { account, invoice };
  });

  // 2) Chamadas de rede ao Asaas — FORA da transação (mesmo padrão de
  // api/asaas/payment/route.ts): nunca segurar uma transação de banco aberta
  // esperando uma resposta de rede.
  let customerId = member.asaasCustomerId;
  let createdCustomer = false;
  try {
    if (!customerId) {
      const customer = await createCustomer(config, {
        name: member.name,
        email: member.email ?? undefined,
        cpfCnpj: cpf,
        phone: member.phone ?? undefined,
      });
      customerId = customer?.id ?? null;
      createdCustomer = true;
    }
    if (!customerId) {
      return NextResponse.json({ error: 'Falha ao criar/obter o cliente no Asaas.' }, { status: 502 });
    }

    const paymentResponse = await createPayment(config, {
      customer: customerId,
      billingType: 'PIX',
      value: amount,
      dueDate: dueDate.toISOString().slice(0, 10),
      description: 'Doação — Tronco de Solidariedade',
      externalReference: created.invoice.id,
    });

    // 3) Persiste o resultado (transação curta, sem rede).
    await withTenant(String(lodgeId), async (db) => {
      if (createdCustomer && customerId) {
        await db.member.update({ where: { id: member.id }, data: { asaasCustomerId: customerId } });
      }
      await db.invoice.update({
        where: { id: created.invoice.id },
        data: {
          status: 'billed',
          asaasPaymentId: paymentResponse?.id ?? null,
          asaasInvoiceUrl: paymentResponse?.invoiceUrl ?? null,
        },
      });
      await logAudit(db, {
        lodgeId: String(lodgeId),
        userId: session!.user.id,
        action: 'CREATE',
        entity: 'donation',
        entityId: created.account.id,
        metadata: { amount, sessionId: todaySession?.id ?? null, asaasPaymentId: paymentResponse?.id },
      });
    });

    // O Pix (copia e cola + QR) não vem no POST /payments — só em /pixQrCode.
    const pix = paymentResponse?.id ? await fetchPixQr(config, paymentResponse.id) : null;
    return NextResponse.json({
      invoiceId: created.invoice.id,
      pixCopyPaste: pix?.payload ?? null,
      pixQrImage: pix?.encodedImage ? `data:image/png;base64,${pix.encodedImage}` : null,
      invoiceUrl: paymentResponse?.invoiceUrl ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar a doação no Asaas.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json({ presets: PRESET_AMOUNTS });
}
