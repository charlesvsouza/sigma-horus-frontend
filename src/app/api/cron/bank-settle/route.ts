import { cronAuthorized } from '@/lib/platform-auth';
import { prismaAdmin, withTenant } from '@/lib/prisma';
import { resolveBillingProvider } from '@/lib/billing-provider-registry';
import { settleBankPixReceipt } from '@/lib/bank-pix-settle-server';
import { NextResponse } from 'next/server';

/**
 * Baixa automática das cobranças emitidas pelo BANCO (hoje Itaú), sem depender de webhook.
 *
 * Para cada loja com integração ativa, olha as cobranças em aberto que têm txid no banco, pergunta
 * a situação ao provedor e, quando o Pix foi recebido, dá baixa (lib/bank-pix-settle-server). A
 * operação é idempotente: rodar de novo não duplica pagamento — a baixa é identificada pelo
 * `endToEndId` do Pix recebido.
 *
 * Acionado pelo Vercel Cron (GET, `Authorization: Bearer <CRON_SECRET>`) ou manualmente.
 */
const SELECT_INTEGRACAO = {
  provider: true, env: true, status: true, clientIdEnc: true, clientSecretEnc: true,
  certificateEnc: true, privateKeyEnc: true, pixKey: true, tokenPath: true,
} as const;

const LOTE_POR_LOJA = 100;

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const lojas = await prismaAdmin.bankIntegration.findMany({
    where: { provider: 'itau', status: 'active' },
    select: { lodgeId: true },
    distinct: ['lodgeId'],
  });

  const resumo: { lodgeId: string; abertas: number; baixadas: number; falhas: number; motivo?: string }[] = [];

  for (const { lodgeId } of lojas) {
    const lodge = await withTenant(lodgeId, (db) =>
      db.lodge.findUnique({
        where: { id: lodgeId },
        select: { asaasApiKeyEnc: true, asaasEnv: true, bankIntegrations: { where: { provider: 'itau' }, select: SELECT_INTEGRACAO } },
      }),
    );
    const provider = resolveBillingProvider(lodge);
    if (!provider?.fetchCharge) {
      resumo.push({ lodgeId, abertas: 0, baixadas: 0, falhas: 0, motivo: 'provedor sem consulta de situação' });
      continue;
    }

    const abertas = await withTenant(lodgeId, (db) =>
      db.invoice.findMany({
        where: { lodgeId, status: { in: ['pending', 'billed'] }, chargeProvider: 'itau', chargeExternalId: { not: null } },
        select: { id: true, chargeExternalId: true },
        orderBy: { dueDate: 'asc' },
        take: LOTE_POR_LOJA,
      }),
    );

    let baixadas = 0;
    let falhas = 0;
    for (const inv of abertas) {
      if (!inv.chargeExternalId) continue;
      try {
        const situacao = await provider.fetchCharge(inv.chargeExternalId);
        if (!situacao || situacao.state !== 'paid') continue;
        const baixa = await settleBankPixReceipt(lodgeId, inv.id, 'itau', situacao, 'cron:bank-settle');
        if (!baixa.ok) {
          falhas += 1;
          console.error('bank-settle: baixa recusada', lodgeId, inv.id, baixa.error);
        } else if (!baixa.alreadySettled) {
          baixadas += 1;
        }
      } catch (err) {
        falhas += 1;
        console.error('bank-settle: falha ao consultar o banco', lodgeId, inv.id, err);
      }
    }

    resumo.push({ lodgeId, abertas: abertas.length, baixadas, falhas });
  }

  return NextResponse.json({ lojas: lojas.length, resumo });
}
