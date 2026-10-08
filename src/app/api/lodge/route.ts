import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { canLodgeAccess, normalizeRole } from '@/lib/rbac';
import { NextResponse } from 'next/server';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { hasAtMostCents } from '@/lib/money';

const PERCENT_FIELDS = new Set<string>(['lateFeePercent', 'lateInterestPercentMonth', 'cardFeePercentOneTime', 'cardFeePercentInstallment']);

const FIELDS = [
  'name', 'legalName', 'tradeName', 'cnpj', 'email', 'phone',
  'addressLine', 'addressNumber', 'neighborhood', 'city', 'state', 'zipCode',
  'bankName', 'bankAgency', 'bankAccount', 'pixKey',
  'riteName', 'powerName', 'openingFormula', 'sessionWeekdays', 'sessionFrequency',
] as const;

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const lodge = await withTenant(String(lodgeId), (db) =>
    db.lodge.findUnique({
      where: { id: String(lodgeId) },
      select: {
        name: true, legalName: true, tradeName: true, cnpj: true, email: true, phone: true, crestUrl: true,
        addressLine: true, addressNumber: true, neighborhood: true, city: true, state: true, zipCode: true,
        bankName: true, bankAgency: true, bankAccount: true, pixKey: true,
        riteName: true, powerName: true, openingFormula: true, foundationDate: true, sessionWeekdays: true, sessionFrequency: true,
        expenseApprovalThreshold: true, lateFeePercent: true, lateInterestPercentMonth: true,
        initiationFee: true, elevationFee: true, exaltationFee: true, affiliationFee: true, powerDuesAmount: true,
        degreeFeeCardEnabled: true, cardFeePercentOneTime: true, cardFeePercentInstallment: true, cardFeeFixed: true,
        autoBalanceteEnabled: true, art002Enabled: true, chargeLateFeesOnPix: true,
        notifyBirthdaysEnabled: true, notifyMilestonesEnabled: true, notifyBillingRemindersEnabled: true,
        notifyFoundationAnniversaryEnabled: true,
      },
    }),
  );

  // Dados fiscais, bancários e as regras de cobrança/aprovação são de gestão: quem não lê Contas
  // (ex.: o Membro) só recebe a identificação da loja.
  if (lodge && !(await canLodgeAccess(String(lodgeId), session?.user?.role, 'accounts', 'read'))) {
    const { name, crestUrl, riteName, powerName } = lodge;
    return NextResponse.json({ lodge: { name, crestUrl, riteName, powerName } });
  }

  return NextResponse.json({ lodge });
}

export async function PUT(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const subscription = await requireActiveSubscription(String(lodgeId));
  if (!subscription.ok) return NextResponse.json({ error: subscription.error, code: subscription.code }, { status: subscription.status });
  if (normalizeRole(role) !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem editar os dados da loja.' }, { status: 403 });
  }

  const body = await request.json().catch(() => undefined);
  if (body === undefined) return NextResponse.json({ error: 'Corpo da requisição inválido: envie um JSON válido.' }, { status: 400 });
  const data: Record<string, string | number | boolean | null> = {};
  if ('autoBalanceteEnabled' in body) {
    data.autoBalanceteEnabled = String(body.autoBalanceteEnabled) === 'true';
  }
  if ('chargeLateFeesOnPix' in body) {
    data.chargeLateFeesOnPix = String(body.chargeLateFeesOnPix) === 'true';
  }
  if ('degreeFeeCardEnabled' in body) {
    data.degreeFeeCardEnabled = String(body.degreeFeeCardEnabled) === 'true';
  }
  if ('art002Enabled' in body) {
    data.art002Enabled = String(body.art002Enabled) === 'true';
  }
  for (const notifyField of ['notifyBirthdaysEnabled', 'notifyMilestonesEnabled', 'notifyBillingRemindersEnabled', 'notifyFoundationAnniversaryEnabled'] as const) {
    if (notifyField in body) {
      data[notifyField] = String(body[notifyField]) === 'true';
    }
  }
  if ('foundationDate' in body) {
    const raw = String(body.foundationDate ?? '').trim();
    const parsed = raw ? new Date(raw) : null;
    if (parsed && Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'Data de fundação inválida.' }, { status: 400 });
    }
    data.foundationDate = parsed ? parsed.toISOString() : null;
  }
  for (const field of FIELDS) {
    if (field in body) {
      const value = String(body[field] ?? '').trim();
      data[field] = value || null;
    }
  }
  for (const numField of ['expenseApprovalThreshold', 'lateFeePercent', 'lateInterestPercentMonth', 'initiationFee', 'elevationFee', 'exaltationFee', 'affiliationFee', 'powerDuesAmount', 'cardFeePercentOneTime', 'cardFeePercentInstallment', 'cardFeeFixed'] as const) {
    if (numField in body) {
      const raw = String(body[numField] ?? '').trim();
      const n = raw ? Number(raw) : null;
      // 0 é um valor explícito válido (ex.: exigir aprovação de QUALQUER
      // despesa) — só string vazia limpa o campo (volta a null/desativado).
      if (n != null && (!Number.isFinite(n) || n < 0 || !hasAtMostCents(n) || (PERCENT_FIELDS.has(numField) && n > 100))) {
        return NextResponse.json({ error: `Valor inválido em "${numField}": use até 2 casas decimais${PERCENT_FIELDS.has(numField) ? ' e no máximo 100%' : ''}.` }, { status: 400 });
      }
      data[numField] = n;
    }
  }
  if (!data.name) {
    return NextResponse.json({ error: 'O nome da loja é obrigatório.' }, { status: 400 });
  }

  const lodge = await withTenant(String(lodgeId), async (db) => {
    const updated = await db.lodge.update({ where: { id: String(lodgeId) }, data });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'lodge', entityId: String(lodgeId), metadata: { fields: Object.keys(data) } });
    return updated;
  });

  return NextResponse.json({ ok: true, lodge: { name: lodge.name } });
}
