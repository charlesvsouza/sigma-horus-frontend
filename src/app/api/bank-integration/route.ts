import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { sealBankCredentials, bankCredentialsHint, openBankCredentials } from '@/lib/bank-credentials';
import { inspectCertificate, certificateMatchesKey, certificateHealth } from '@/lib/bank-certificate';
import { validateItauCredentials } from '@/lib/billing-provider-itau';
import { billingProviderSummary, itauIntegrationOf } from '@/lib/billing-provider-registry';
import { bancoPorId, bancoPadrao, bancosProntos } from '@/lib/bank-catalog';
import { logAudit } from '@/lib/audit';
import { NextResponse } from 'next/server';

/**
 * Integração de cobrança pelo banco (Itaú) — credenciais da loja.
 *
 * GET    → estado da integração (nunca devolve credencial; só dica dos últimos 4 dígitos do client_id).
 * POST   → salva credenciais, confere o par certificado/chave e TESTA contra o Itaú; grava active/error.
 * DELETE → desliga a integração (a loja volta a emitir pelo Asaas, se tiver).
 *
 * Enquanto não houver credencial salva e validada, a emissão usa o Asaas (ou nenhum provedor) e a tela
 * mostra "aguardando credenciais" — nada estoura no meio de uma cobrança.
 */

const SELECT = {
  provider: true, env: true, status: true, clientIdEnc: true, clientSecretEnc: true, certificateEnc: true,
  privateKeyEnc: true, pixKey: true, tokenPath: true, certNotAfter: true, lastCheckAt: true, lastError: true,
} as const;

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Bancos que a tela pode oferecer vêm do catálogo: banco novo homologado aparece sozinho.
  const bancos = bancosProntos().map((b) => ({ id: b.id, label: b.label, auth: b.auth, temBoleto: Boolean(b.endpoints?.production.boleto) }));

  const data = await withTenant(String(lodgeId), async (db) => {
    const lodge = await db.lodge.findUnique({
      where: { id: String(lodgeId) },
      select: {
        asaasApiKeyEnc: true, asaasEnv: true,
        bankIntegrations: { where: { provider: 'itau' }, select: SELECT },
      },
    });
    const bi = itauIntegrationOf(lodge);
    const summary = billingProviderSummary(lodge);
    return {
      provider: summary,
      bancos,
      integration: bi
        ? {
            env: bi.env,
            status: bi.status,
            clientHint: bankCredentialsHint(bi),
            pixKey: bi.pixKey,
            certNotAfter: bi.certNotAfter,
            certHealth: bi.certNotAfter ? certificateHealth(bi.certNotAfter).status : null,
            lastCheckAt: bi.lastCheckAt,
            lastError: bi.lastError,
            hasCredentials: Boolean(openBankCredentials(bi)),
          }
        : null,
    };
  });

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => undefined);
  if (!body) return NextResponse.json({ error: 'Corpo da requisição inválido: envie um JSON válido.' }, { status: 400 });

  const banco = bancoPorId(body?.provider) ?? bancoPadrao();
  if (!banco || banco.status !== 'ready') {
    return NextResponse.json({ error: 'Banco não homologado para cobrança. Fale com o suporte antes de tentar conectar.' }, { status: 400 });
  }
  const env = body?.env === 'sandbox' ? 'sandbox' : 'production';
  const clientId = String(body?.clientId ?? '').trim();
  const clientSecret = String(body?.clientSecret ?? '').trim();
  const certificatePem = String(body?.certificatePem ?? '').trim();
  const privateKeyPem = String(body?.privateKeyPem ?? '').trim();
  const pixKey = body?.pixKey ? String(body.pixKey).trim() : null;

  if (!clientId || !clientSecret || !certificatePem || !privateKeyPem) {
    return NextResponse.json({ error: 'Informe client_id, client_secret, o certificado (.crt/PEM) e a chave privada (.key/PEM).' }, { status: 400 });
  }

  let certNotAfter: Date;
  try {
    certNotAfter = inspectCertificate(certificatePem).notAfter;
  } catch {
    return NextResponse.json({ error: 'O certificado não é um PEM válido. Baixe o .crt do Itaú e cole o conteúdo inteiro.' }, { status: 400 });
  }
  if (!certificateMatchesKey(certificatePem, privateKeyPem)) {
    return NextResponse.json({ error: 'A chave privada não corresponde ao certificado. Envie o par correto (.crt e .key do mesmo credenciamento).' }, { status: 400 });
  }
  if (certificateHealth(certNotAfter).status === 'expired') {
    return NextResponse.json({ error: 'Este certificado já venceu. Gere um novo no Itaú antes de salvar.' }, { status: 400 });
  }

  const selada = sealBankCredentials({ clientId, clientSecret, certificatePem, privateKeyPem });
  // Hoje o único banco homologado é o Itaú; o catálogo é quem diz isso (`bank-catalog`).
  const teste = await validateItauCredentials({ env, credentials: { clientId, clientSecret, certificatePem, privateKeyPem }, pixKey });

  const salvo = await withTenant(String(lodgeId), async (db) => {
    const existente = await db.bankIntegration.findFirst({ where: { lodgeId: String(lodgeId), provider: banco.id }, select: { id: true } });
    const dados = {
      ...selada,
      env,
      pixKey,
      certNotAfter,
      status: teste.ok ? 'active' : 'error',
      tokenPath: teste.ok ? teste.tokenPath : null,
      lastCheckAt: new Date(),
      lastError: teste.ok ? null : teste.error,
    };
    const row = existente
      ? await db.bankIntegration.update({ where: { id: existente.id }, data: dados, select: SELECT })
      : await db.bankIntegration.create({ data: { ...dados, lodgeId: String(lodgeId), provider: banco.id }, select: SELECT });
    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session?.user?.id ?? null,
      action: 'UPDATE',
      entity: 'bankIntegration',
      entityId: row.provider,
      metadata: { provider: banco.id, env, status: row.status, certificadoVence: certNotAfter.toISOString().slice(0, 10) },
    });
    return row;
  });

  return NextResponse.json(
    {
      ok: teste.ok,
      status: salvo.status,
      error: teste.ok ? null : teste.error,
      clientHint: bankCredentialsHint(salvo),
      certNotAfter: salvo.certNotAfter,
      certHealth: certificateHealth(salvo.certNotAfter ?? certNotAfter).status,
      lastCheckAt: salvo.lastCheckAt,
    },
    { status: teste.ok ? 200 : 400 },
  );
}

export async function DELETE() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  await withTenant(String(lodgeId), async (db) => {
    const bi = await db.bankIntegration.findFirst({ where: { lodgeId: String(lodgeId), provider: 'itau' }, select: { id: true } });
    if (!bi) return;
    await db.bankIntegration.update({ where: { id: bi.id }, data: { status: 'disabled', lastError: null } });
    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session?.user?.id ?? null,
      action: 'UPDATE',
      entity: 'bankIntegration',
      entityId: 'itau',
      metadata: { provider: 'itau', acao: 'desligada' },
    });
  });

  return NextResponse.json({ ok: true });
}
