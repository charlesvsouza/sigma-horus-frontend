import QRCode from 'qrcode';
import { AGREEMENT_ITEM_MESSAGE, agreementDebtAccountIds } from '@/lib/agreement-items';
import { auth } from '@/lib/auth';
import { chargeUrgency, invoiceOpenBalance, whatsAppChargeMessage } from '@/lib/charge-notice';
import { isAsaasMode, paymentInstructions } from '@/lib/collection';
import { brl } from '@/lib/currency';
import { lateChargeConfig, lateChargeSentence, pixAmount } from '@/lib/late-charge';
import { buildPixPayload } from '@/lib/pix';
import { CLOSED_INVOICE_STATUSES } from '@/lib/portal-invoice';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { normalizeWhatsAppPhone, WHATSAPP_MANUAL_CHANNEL, whatsAppLogTitle } from '@/lib/whatsapp-link';
import { NextResponse } from 'next/server';

// Envio da cobrança pelo WhatsApp — SÓ Modo Loja. O servidor monta a mensagem (mesmo texto do
// lembrete por e-mail) com o Pix copia e cola na chave da loja e o QR; quem envia é o
// Tesoureiro, pelo wa.me. No Modo Asaas o próprio Asaas tem link público e notifica o cliente.
//  GET  → mensagem pronta + Pix + QR + celular normalizado.
//  POST  → registra no MessageLog que a mensagem foi aberta no WhatsApp (status "handed-off":
//          o wa.me não devolve nada, não dá para saber se ele apertou Enviar).
//  PATCH → confirmação do próprio Tesoureiro ao voltar: "Sim, enviei" → "sent";
//          "Não enviei" → apaga o registro (nada saiu). Sem resposta, fica "handed-off".

const MAX_TEXT = 4000;

async function guard() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId) return { ok: false as const, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'accounts', 'write');
  if (!access.ok) return { ok: false as const, res: NextResponse.json({ error: access.error }, { status: access.status }) };
  return { ok: true as const, lodgeId };
}

async function loadInvoice(lodgeId: string, id: string) {
  return withTenant(lodgeId, async (db) => {
    const invoice = await db.invoice.findFirst({
      where: { id, lodgeId },
      select: {
        id: true, number: true, amount: true, dueDate: true, status: true, accountId: true,
        member: { select: { id: true, name: true, phone: true } },
        account: { select: { amount: true, status: true, payments: { select: { amount: true } } } },
      },
    });
    const lodge = await db.lodge.findUnique({
      where: { id: lodgeId },
      select: {
        name: true, tradeName: true, city: true, collectionMode: true, pixKey: true, bankName: true, bankAgency: true, bankAccount: true,
        chargeLateFeesOnPix: true, lateFeePercent: true, lateInterestPercentMonth: true,
      },
    });
    const inAgreement = invoice ? (await agreementDebtAccountIds(db, lodgeId)).has(invoice.accountId) : false;
    return { invoice, lodge, inAgreement };
  });
}

type Loaded = Awaited<ReturnType<typeof loadInvoice>>;

/** Mesmas travas para montar e para registrar: Modo Loja, cobrança aberta, com saldo e com membro. */
function check({ invoice, lodge, inAgreement }: Loaded) {
  if (!invoice || !lodge) return { ok: false as const, res: NextResponse.json({ error: 'Cobrança não encontrada.' }, { status: 404 }) };
  if (inAgreement) return { ok: false as const, res: NextResponse.json({ error: AGREEMENT_ITEM_MESSAGE }, { status: 409 }) };
  if (isAsaasMode(lodge)) return { ok: false as const, res: NextResponse.json({ error: 'O envio pelo WhatsApp está disponível apenas no Modo Loja.' }, { status: 409 }) };
  if (CLOSED_INVOICE_STATUSES.includes(invoice.status)) return { ok: false as const, res: NextResponse.json({ error: 'Esta cobrança já está paga ou cancelada.' }, { status: 409 }) };
  if (!invoice.member) return { ok: false as const, res: NextResponse.json({ error: 'Vincule a cobrança a um membro para enviar pelo WhatsApp.' }, { status: 400 }) };
  const balance = invoiceOpenBalance(invoice.amount, invoice.account);
  if (balance <= 0) return { ok: false as const, res: NextResponse.json({ error: 'Esta cobrança não tem saldo em aberto.' }, { status: 409 }) };
  return { ok: true as const, invoice, member: invoice.member, lodge, balance };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (!g.ok) return g.res;
  const { id } = await params;
  const c = check(await loadInvoice(g.lodgeId, id));
  if (!c.ok) return c.res;
  const { invoice, member, lodge, balance } = c;

  // Valor do Pix: saldo e, se a loja cobra, multa e juros até hoje.
  const pix = pixAmount(balance, invoice.dueDate, lateChargeConfig(lodge));
  // Identificador = número da cobrança (único por cobrança). Se aparece no extrato depende do banco.
  const pixCopyPaste = lodge.pixKey?.trim()
    ? buildPixPayload({ key: lodge.pixKey, name: lodge.tradeName || lodge.name, city: lodge.city, amount: pix.total, txid: invoice.number })
    : null;
  const qrDataUrl = pixCopyPaste ? await QRCode.toDataURL(pixCopyPaste, { margin: 1, width: 320, errorCorrectionLevel: 'M' }) : null;
  const instructions = paymentInstructions(lodge);
  const overdue = chargeUrgency(invoice.dueDate, invoice.status) === 'overdue';

  const text = whatsAppChargeMessage({
    memberName: member.name,
    number: invoice.number,
    amount: balance,
    dueDate: invoice.dueDate,
    overdue,
    pixCopyPaste,
    instructions,
    lateChargeSentence: lateChargeSentence(pix, brl),
  });

  return NextResponse.json({
    invoiceId: invoice.id,
    number: invoice.number,
    memberName: member.name,
    phone: normalizeWhatsAppPhone(member.phone),
    rawPhone: member.phone ?? null,
    amount: pix.total,
    principal: pix.principal,
    lateCharge: pix.extra,
    overdue,
    text,
    pixCopyPaste,
    qrDataUrl,
    hasPixKey: !!pixCopyPaste,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (!g.ok) return g.res;
  const { id } = await params;
  const c = check(await loadInvoice(g.lodgeId, id));
  if (!c.ok) return c.res;

  const body = await request.json().catch(() => ({}));
  const text = typeof body?.text === 'string' ? body.text.slice(0, MAX_TEXT) : '';

  const log = await withTenant(g.lodgeId, (db) => db.messageLog.create({
    select: { id: true },
    data: {
      lodgeId: g.lodgeId,
      memberId: c.member.id,
      channel: WHATSAPP_MANUAL_CHANNEL,
      title: whatsAppLogTitle(c.invoice.number),
      content: text,
      status: 'handed-off',
    },
  }));
  return NextResponse.json({ success: true, logId: log.id });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (!g.ok) return g.res;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const logId = typeof body?.logId === 'string' ? body.logId : '';
  if (!logId || typeof body?.sent !== 'boolean') return NextResponse.json({ error: 'Informe o registro e se a mensagem foi enviada.' }, { status: 400 });

  const result = await withTenant(g.lodgeId, async (db) => {
    const invoice = await db.invoice.findFirst({ where: { id, lodgeId: g.lodgeId }, select: { number: true } });
    if (!invoice) return 'not-found' as const;
    // Só o registro "aberto" desta cobrança — não deixa confirmar/apagar outra mensagem da loja.
    const log = await db.messageLog.findFirst({
      where: { id: logId, lodgeId: g.lodgeId, channel: WHATSAPP_MANUAL_CHANNEL, title: whatsAppLogTitle(invoice.number), status: 'handed-off' },
      select: { id: true },
    });
    if (!log) return 'not-found' as const;
    if (body.sent) await db.messageLog.update({ where: { id: log.id }, data: { status: 'sent' } });
    else await db.messageLog.delete({ where: { id: log.id } });
    return 'ok' as const;
  });

  if (result === 'not-found') return NextResponse.json({ error: 'Registro de envio não encontrado.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
