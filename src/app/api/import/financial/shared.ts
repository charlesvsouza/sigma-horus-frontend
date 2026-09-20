import { auth } from '@/lib/auth';
import { requireLodgeAccess } from '@/lib/rbac';
import { platformAuthorized } from '@/lib/platform-auth';
import { withTenant } from '@/lib/prisma';
import { readLegacyFiles } from '@/lib/legacy-import/service';
import { DEFAULT_PLAN_OPTIONS, buildPlan, type PlanOptions } from '@/lib/legacy-import/planner';

export const MAX_FILES = 12;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export type Actor = { lodgeId: string; userId: string; isPlatform: boolean };

/**
 * Quem pode importar o backup financeiro: quem escreve em Contas (Administrador e Tesoureiro pela
 * matriz padrão) — é movimento financeiro, não cadastro. O dono da plataforma pode importar para
 * qualquer loja (suporte), como no import de membros.
 */
export async function resolveActor(request: Request, lodgeOverride: string | null): Promise<Actor | { error: string; status: number }> {
  if (platformAuthorized(request) && lodgeOverride) return { lodgeId: lodgeOverride, userId: 'system:platform-import', isPlatform: true };
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId || !session?.user?.id) return { error: 'Unauthorized', status: 401 };
  const access = await requireLodgeAccess(lodgeId, session.user.role, 'accounts', 'write');
  if (!access.ok) return { error: access.error, status: access.status };
  return { lodgeId, userId: session.user.id, isPlatform: false };
}

export function parseOptions(raw: FormDataEntryValue | null): PlanOptions | { error: string } {
  if (!raw) return { ...DEFAULT_PLAN_OPTIONS };
  try {
    const o = JSON.parse(String(raw)) as Partial<PlanOptions>;
    const overrides: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(o.categoryOverrides ?? {})) {
      if (v === null || typeof v === 'string') overrides[k] = v;
    }
    return {
      memberMatching: o.memberMatching === 'none' || o.memberMatching === 'fuzzy' ? o.memberMatching : 'exact',
      categoryOverrides: overrides,
      openingEntriesAsOpeningBalance: o.openingEntriesAsOpeningBalance !== false,
      includeOpenItems: o.includeOpenItems !== false,
    };
  } catch {
    return { error: 'Opções inválidas.' };
  }
}

export async function readUploads(formData: FormData) {
  const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: 'Envie ao menos um arquivo (CSV ou Excel .xlsx).' } as const;
  if (files.length > MAX_FILES) return { error: `Envie no máximo ${MAX_FILES} arquivos por vez.` } as const;
  const big = files.find((f) => f.size > MAX_FILE_BYTES);
  if (big) return { error: `"${big.name}" passa de ${MAX_FILE_BYTES / 1024 / 1024} MB.` } as const;
  const uploads = await Promise.all(files.map(async (f) => ({ name: f.name, buffer: Buffer.from(await f.arrayBuffer()) })));
  return readLegacyFiles(uploads);
}

/** Lê o contexto da loja (plano de contas, membros, contas financeiras) e monta o plano. */
export async function planFor(lodgeId: string, files: Awaited<ReturnType<typeof readLegacyFiles>>['files'], options: PlanOptions) {
  const ctx = await withTenant(lodgeId, async (db) => {
    const [chart, members, financialAccounts] = await Promise.all([
      db.chartAccount.findMany({ where: { lodgeId, active: true }, select: { code: true, name: true, type: true }, orderBy: { code: 'asc' } }),
      db.member.findMany({ where: { lodgeId }, select: { id: true, name: true } }),
      db.financialAccount.findMany({ where: { lodgeId }, select: { id: true, name: true } }),
    ]);
    return { chart, members, financialAccounts };
  });
  return { plan: buildPlan(files, ctx, options), chart: ctx.chart };
}
