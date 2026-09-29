import QRCode from 'qrcode';
import { auth } from '@/lib/auth';
import { chargeUrgency, invoiceOpenBalance, whatsAppChargeMessage } from '@/lib/charge-notice';
import { isAsaasMode, paymentInstructions } from '@/lib/collection';
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
//  POST → registra no MessageLog que a mensagem foi entregue ao WhatsApp (não dá para saber
//         se ele apertou Enviar — por isso status "handed-off").

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
        id: true, number: true, amount: true, dueDate: true, status: true,
        member: { select: { id: true, name: true, phone: true } },
        account: { select: { amount: true, status: true, payments: { select: { amount: true } } } },
      },
    });
    const lodge = await db.lodge.findUnique({
      where: { id: lodgeId },
      select: { name: true, tradeName: true, city: true, collectionMode: true, pixKey: true, bankName: true, bankAgency: true, bankAccount: true },
    });
    return { invoice, lodge };
  });
}

type Loaded = Awaited<ReturnType<typeof loadInvoice>>;

/** Mesmas travas para montar e para registrar: Modo Loja, cobrança aberta, com saldo e com membro. */
function check({ invoice, lodge }: Loaded) {
  if (!invoice || !lodge) return { ok: false as const, res: NextResponse.json({ error: 'Cobrança não encontrada.' }, { status: 404 }) };
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

  // Identificador = número da cobrança (único por cobrança). Se aparece no extrato depende do banco.
  const pixCopyPaste = lodge.pixKey?.trim()
    ? buildPixPayload({ key: lodge.pixKey, name: lodge.tradeName || lodge.name, city: lodge.city, amount: balance, txid: invoice.number })
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
  });

  return NextResponse.json({
    invoiceId: invoice.id,
    number: invoice.number,
    memberName: member.name,
    phone: normalizeWhatsAppPhone(member.phone),
    rawPhone: member.phone ?? null,
    amount: balance,
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

  await withTenant(g.lodgeId, (db) => db.messageLog.create({
    data: {
      lodgeId: g.lodgeId,
      memberId: c.member.id,
      channel: WHATSAPP_MANUAL_CHANNEL,
      title: whatsAppLogTitle(c.invoice.number),
      content: text,
      status: 'handed-off',
    },
  }));
  return NextResponse.json({ success: true, sentAt: new Date().toISOString() });
}
