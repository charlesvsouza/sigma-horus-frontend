import { prismaAdmin } from '@/lib/prisma';
import { subscriptionAccess, type SubscriptionAccess } from '@/lib/subscription-access';

/**
 * Trava de ESCRITA para loja sem assinatura vigente. Só escrita: a loja bloqueada continua
 * consultando e exportando os próprios dados (LGPD) e pode pagar/regularizar (rotas de
 * cobrança, conta e login não passam por aqui).
 *
 * Modo por env `SUBSCRIPTION_ENFORCEMENT`:
 *  - `enforce`: responde 402 e não grava;
 *  - `log` (padrão): deixa passar e registra `[subscription-guard] would block` — serve para
 *    descobrir, nos logs, quais lojas seriam bloqueadas ANTES de ligar de verdade;
 *  - `off`: não checa.
 */
export type EnforcementMode = 'enforce' | 'log' | 'off';

export function enforcementMode(raw: string | undefined = process.env.SUBSCRIPTION_ENFORCEMENT): EnforcementMode {
  const v = (raw ?? '').trim().toLowerCase();
  return v === 'enforce' || v === 'off' ? v : 'log';
}

const TTL_MS = 15_000;
// Cache por instância (15 s): quem acabou de pagar espera no máximo isso para voltar a gravar.
const cache = new Map<string, { at: number; access: SubscriptionAccess }>();

async function loadAccess(lodgeId: string): Promise<SubscriptionAccess> {
  const hit = cache.get(lodgeId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.access;
  const sub = await prismaAdmin.subscription.findUnique({
    where: { lodgeId },
    select: { status: true, trialEndsAt: true },
  });
  const access = subscriptionAccess(sub);
  cache.set(lodgeId, { at: Date.now(), access });
  return access;
}

export const SUBSCRIPTION_BLOCKED_MESSAGE =
  'A assinatura da loja não está ativa: o sistema está somente para consulta. Regularize em Assinatura para voltar a editar.';

/**
 * Retorna `{ ok: true }` se a escrita pode seguir; senão `{ ok: false, status: 402, error }`
 * (mesmo formato de `requireLodgeAccess`, para as rotas tratarem igual).
 */
export async function requireActiveSubscription(lodgeId: string | undefined | null, mode: EnforcementMode = enforcementMode()) {
  if (!lodgeId || mode === 'off') return { ok: true } as const;
  let access: SubscriptionAccess;
  try {
    access = await loadAccess(String(lodgeId));
  } catch (error) {
    // Falha de leitura não pode derrubar a loja inteira: não bloqueia, mas deixa rastro.
    console.error('[subscription-guard] falha ao ler a assinatura; escrita liberada', error);
    return { ok: true } as const;
  }
  if (!access.blocked) return { ok: true } as const;
  if (mode === 'log') {
    console.warn(`[subscription-guard] would block write lodge=${lodgeId} reason=${access.reason}`);
    return { ok: true } as const;
  }
  return { ok: false, status: 402, error: SUBSCRIPTION_BLOCKED_MESSAGE, code: 'SUBSCRIPTION_INACTIVE' } as const;
}
