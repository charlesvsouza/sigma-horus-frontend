import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { buildLodgeAsaasConfig } from '@/lib/asaas-config';
import { MIN_WEBHOOK_TOKEN, generateWebhookToken, listWebhooks, upsertWebhook } from '@/lib/asaas-webhook-setup';
import { withTenant } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { NextResponse } from 'next/server';

const webhookUrl = (request: Request) => `${process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin}/api/asaas/webhook`;

async function adminLodge() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!session?.user || !lodgeId) return { ok: false as const, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (normalizeRole(session.user.role) !== 'admin') return { ok: false as const, res: NextResponse.json({ error: 'Apenas administradores configuram integrações.' }, { status: 403 }) };
  const lodge = await withTenant(String(lodgeId), (db) =>
    db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { name: true, email: true, asaasApiKeyEnc: true, asaasEnv: true, asaasWebhookToken: true } }),
  );
  const config = buildLodgeAsaasConfig(lodge);
  if (!lodge || !config) return { ok: false as const, res: NextResponse.json({ error: 'Conecte o Asaas (chave da API) antes do webhook.' }, { status: 409 }) };
  return { ok: true as const, session, lodgeId: String(lodgeId), lodge, config };
}

// Situação do webhook no Asaas: cadastrado com a nossa URL? ativo? e o token salvo aqui é válido (32+)?
export async function GET(request: Request) {
  const gate = await adminLodge();
  if (!gate.ok) return gate.res;
  try {
    const hook = (await listWebhooks(gate.config)).find((w) => w.url === webhookUrl(request));
    return NextResponse.json({
      registered: Boolean(hook), enabled: hook?.enabled ?? false, interrupted: hook?.interrupted ?? false,
      tokenOk: (gate.lodge.asaasWebhookToken ?? '').length >= MIN_WEBHOOK_TOKEN,
    });
  } catch (error) {
    return NextResponse.json({ error: `Não foi possível consultar o Asaas: ${error instanceof Error ? error.message : error}` }, { status: 502 });
  }
}

// Gera um token novo, cadastra/atualiza o webhook no Asaas e só então salva o token aqui
// (se o Asaas recusar, o token antigo continua valendo).
export async function POST(request: Request) {
  const gate = await adminLodge();
  if (!gate.ok) return gate.res;
  const sub = await requireActiveSubscription(gate.lodgeId);
  if (!sub.ok) return NextResponse.json({ error: sub.error }, { status: sub.status });
  if (!gate.lodge.email) return NextResponse.json({ error: 'Cadastre o e-mail da loja em Configurações da loja: o Asaas avisa nele se o webhook falhar.' }, { status: 400 });

  const token = generateWebhookToken();
  try {
    await upsertWebhook(gate.config, { url: webhookUrl(request), email: gate.lodge.email, token, name: `Sigma Horus — ${gate.lodge.name}`.slice(0, 50) });
  } catch (error) {
    return NextResponse.json({ error: `O Asaas recusou o webhook: ${error instanceof Error ? error.message : error}` }, { status: 502 });
  }
  await withTenant(gate.lodgeId, async (db) => {
    await db.lodge.update({ where: { id: gate.lodgeId }, data: { asaasWebhookToken: token } });
    await logAudit(db, { lodgeId: gate.lodgeId, userId: gate.session.user.id, action: 'UPDATE', entity: 'lodge', entityId: gate.lodgeId, metadata: { asaasWebhook: 'registered', env: gate.lodge.asaasEnv } });
  });
  return NextResponse.json({ ok: true });
}
