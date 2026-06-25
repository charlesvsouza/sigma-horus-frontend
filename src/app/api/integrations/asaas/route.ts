import { auth } from '@/lib/auth';
import { asaasBaseUrl, validateApiKey } from '@/lib/asaas';
import { logAudit, } from '@/lib/audit';
import { encryptSecret, decryptSecret, maskSecret } from '@/lib/crypto';
import { withTenant } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const lodge = await withTenant(String(lodgeId), (db) =>
    db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { asaasApiKeyEnc: true, asaasEnv: true, asaasWebhookToken: true } }),
  );

  const apiKey = decryptSecret(lodge?.asaasApiKeyEnc);
  return NextResponse.json({
    configured: Boolean(apiKey),
    env: lodge?.asaasEnv ?? 'sandbox',
    maskedKey: apiKey ? maskSecret(apiKey) : null,
    hasWebhookToken: Boolean(lodge?.asaasWebhookToken),
    webhookUrl: '/api/asaas/webhook',
  });
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (normalizeRole(role) !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem configurar integrações.' }, { status: 403 });
  }

  const body = await request.json();
  const apiKey = String(body?.apiKey ?? '').trim();
  const env = String(body?.env ?? 'sandbox').trim() === 'production' ? 'production' : 'sandbox';
  const webhookToken = body?.webhookToken != null ? String(body.webhookToken).trim() : '';

  if (!apiKey) {
    return NextResponse.json({ error: 'A chave da API do Asaas é obrigatória.' }, { status: 400 });
  }

  // Valida a chave contra o Asaas antes de salvar — feedback imediato.
  try {
    await validateApiKey({ apiKey, baseUrl: asaasBaseUrl(env) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Não foi possível validar a chave Asaas.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await withTenant(String(lodgeId), async (db) => {
    await db.lodge.update({
      where: { id: String(lodgeId) },
      data: {
        asaasApiKeyEnc: encryptSecret(apiKey),
        asaasEnv: env,
        asaasWebhookToken: webhookToken || null,
      },
    });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'integration', entityId: 'asaas', metadata: { env, hasWebhookToken: Boolean(webhookToken) } });
  });

  return NextResponse.json({ ok: true, env, configured: true });
}

export async function DELETE() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (normalizeRole(role) !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem configurar integrações.' }, { status: 403 });
  }

  await withTenant(String(lodgeId), async (db) => {
    await db.lodge.update({
      where: { id: String(lodgeId) },
      data: { asaasApiKeyEnc: null, asaasWebhookToken: null },
    });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'DELETE', entity: 'integration', entityId: 'asaas' });
  });

  return NextResponse.json({ ok: true });
}
