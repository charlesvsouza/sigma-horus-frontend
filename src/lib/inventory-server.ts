import type { Prisma } from '@/generated/prisma/client';
import { withTenant } from '@/lib/prisma';
import { DISPATCH_THROTTLE_MS, EMPTY_CHANNELS, dispatch, sleep } from '@/lib/messaging';
import { KIND_LABEL, unitsInQuarantine, type IncidentKind } from '@/lib/inventory';

/** Unidades em quarentena (dano/perda pendentes) por material da loja. */
export async function quarantineByMaterial(db: Prisma.TransactionClient, lodgeId: string, materialId?: string) {
  const open = await db.materialIncident.findMany({
    where: { lodgeId, status: 'open', kind: { in: ['damage', 'loss'] }, ...(materialId ? { materialId } : {}) },
    select: { materialId: true, kind: true, status: true, quantity: true },
  });
  const byMaterial = new Map<string, number>();
  for (const i of open) byMaterial.set(i.materialId, (byMaterial.get(i.materialId) ?? 0) + i.quantity);
  return { byMaterial, total: unitsInQuarantine(open) };
}

/**
 * Avisa por e-mail quem decide baixa/reposição (Administrador, Venerável e
 * Secretário) que o Arquiteto pediu reposição. Nunca derruba a requisição: falha
 * de envio fica só no MessageLog.
 */
export async function notifyReplacementRequest(args: {
  lodgeId: string;
  materialName: string;
  kind: IncidentKind;
  quantity: number;
  reporterName: string;
  notes: string | null;
}) {
  try {
    const { recipients, lodgeName } = await withTenant(args.lodgeId, async (db) => {
      const [users, lodge] = await Promise.all([
        db.user.findMany({
          where: { lodgeId: args.lodgeId, role: { in: ['admin', 'venerable', 'secretary'] }, status: 'active' },
          select: { email: true },
        }),
        db.lodge.findUnique({ where: { id: args.lodgeId }, select: { name: true } }),
      ]);
      return { recipients: [...new Set(users.map((u) => u.email).filter((e): e is string => !!e))], lodgeName: lodge?.name ?? 'loja' };
    });
    if (recipients.length === 0) return;

    const subject = `Reposição de material solicitada: ${args.materialName}`;
    const text =
      `${args.reporterName} registrou uma ocorrência no inventário da ${lodgeName} e solicitou reposição.\n\n` +
      `Material: ${args.materialName}\nOcorrência: ${KIND_LABEL[args.kind]} (${args.quantity} ${args.quantity === 1 ? 'unidade' : 'unidades'})` +
      `${args.notes ? `\nObservação: ${args.notes}` : ''}\n\n` +
      'Acesse Secretaria → Materiais e patrimônio para dar baixa, repor ou dispensar a ocorrência.';

    for (const to of recipients) {
      const result = await dispatch('email', to, subject, text, EMPTY_CHANNELS);
      await withTenant(args.lodgeId, (db) =>
        db.messageLog.create({
          data: { lodgeId: args.lodgeId, channel: 'email', title: subject, content: text, status: result.status, error: result.detail ?? null },
        }),
      );
      await sleep(DISPATCH_THROTTLE_MS);
    }
  } catch {
    // Aviso é um extra: a ocorrência já foi gravada e aparece como pendência no painel.
  }
}
