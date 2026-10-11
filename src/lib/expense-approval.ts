// Dupla aprovação de despesa (opcional por loja — Lodge.expenseDualApproval). Regras puras, sem banco.
//
// Despesa (conta a pagar) igual ou acima do limite fica "aguardando aprovação". Com a dupla ligada ela precisa de
// DUAS aprovações de pessoas diferentes: a do Venerável e a do Tesoureiro. Quem lançou a despesa não aprova.
//   - Tesoureiro lançou → o lugar do Tesoureiro passa a ser do Administrador (Venerável + Administrador).
//   - O Administrador pode ocupar qualquer um dos dois lugares (desde que não seja a mesma pessoa nos dois);
//   - e, quando o Venerável não está, aprovar SOZINHO, valendo pelos dois ("válvula"): fica marcado e auditado.
// Sem a dupla, vale a regra de sempre: um visto do Venerável ou do Administrador.

const norm = (role: string | null | undefined) => (role ?? '').toLowerCase().trim();

export const APPROVER_ROLES = ['venerable', 'treasurer', 'admin'] as const;
export type ApproverRole = (typeof APPROVER_ROLES)[number];
export const isApproverRole = (role: string | null | undefined): role is ApproverRole => (APPROVER_ROLES as readonly string[]).includes(norm(role));

export const APPROVER_LABEL: Record<ApproverRole, string> = { venerable: 'Venerável', treasurer: 'Tesoureiro', admin: 'Administrador' };

export interface ApprovalRow { userId: string; role: string; valve?: boolean }

export interface ApprovalState {
  complete: boolean;
  /** Quem falta, em texto para a tela ("Venerável", "Tesoureiro"…); vazio quando completo. */
  missing: string[];
  /** Concluída pela válvula do Administrador (aprovou sozinho). */
  viaValve: boolean;
}

/**
 * Situação das aprovações de uma despesa.
 * @param launcherUserId quem lançou a despesa (não conta como aprovador); null/undefined = desconhecido (conta de importação etc.)
 * @param opts.launcherRole papel de quem lançou — só para o texto: se foi o Tesoureiro, o lugar dele é do Administrador.
 */
export function evaluateApprovals(rows: ApprovalRow[], launcherUserId?: string | null, opts: { launcherRole?: string | null } = {}): ApprovalState {
  const valid = rows.filter((r) => isApproverRole(r.role) && r.userId !== launcherUserId);
  if (valid.some((r) => norm(r.role) === 'admin' && r.valve)) return { complete: true, missing: [], viaValve: true };

  const by = (role: ApproverRole) => valid.filter((r) => norm(r.role) === role).map((r) => r.userId);
  const venerables = by('venerable');
  const treasurers = by('treasurer');
  const admins = by('admin');
  // Lugar do Venerável: Venerável ou Administrador. Lugar do Tesoureiro: Tesoureiro ou Administrador.
  // Duas pessoas diferentes; o Administrador pode ocupar qualquer lugar, mas só um.
  const vSlot = [...venerables, ...admins];
  const tSlot = [...treasurers, ...admins];
  if (vSlot.some((v) => tSlot.some((t) => t !== v))) return { complete: true, missing: [], viaValve: false };

  const treasurerSeat = norm(opts.launcherRole) === 'treasurer' ? APPROVER_LABEL.admin : APPROVER_LABEL.treasurer;
  const missing: string[] = [];
  if (vSlot.length === 0) missing.push(APPROVER_LABEL.venerable);
  if (tSlot.length === 0) missing.push(treasurerSeat);
  // Um Administrador deu a única aprovação (sem válvula): falta mais uma pessoa — o Venerável ou o Tesoureiro.
  if (missing.length === 0) missing.push(norm(opts.launcherRole) === 'treasurer' ? APPROVER_LABEL.venerable : `${APPROVER_LABEL.venerable} ou ${APPROVER_LABEL.treasurer}`);
  return { complete: false, missing, viaValve: false };
}

export interface ApproverContext {
  role: string | null | undefined;
  userId: string;
  /** Quem lançou a despesa (null = desconhecido). */
  launcherUserId?: string | null;
}

export type CanApprove = { ok: true; valve: boolean } | { ok: false; error: string };

/** Esta pessoa pode dar a aprovação agora? `valve` indica que ela pode também aprovar sozinha (só o Administrador). */
export function canApproveExpense(ctx: ApproverContext, existing: ApprovalRow[]): CanApprove {
  const role = norm(ctx.role);
  if (!isApproverRole(role)) return { ok: false, error: 'Só o Venerável, o Tesoureiro ou o Administrador aprovam despesas.' };
  if (ctx.launcherUserId && ctx.launcherUserId === ctx.userId) return { ok: false, error: 'Quem lançou a despesa não aprova: outra pessoa precisa dar a aprovação.' };
  if (existing.some((r) => r.userId === ctx.userId)) return { ok: false, error: 'Você já aprovou esta despesa.' };
  return { ok: true, valve: role === 'admin' };
}

/** Texto curto da situação para a lista de Contas. */
export function approvalSummary(state: ApprovalState, rows: { name: string; role: string; valve?: boolean }[]): string {
  if (state.complete) return state.viaValve ? 'Aprovada pelo Administrador (sozinho)' : 'Aprovada';
  const done = rows.map((r) => `${APPROVER_LABEL[norm(r.role) as ApproverRole] ?? r.role}: ${r.name}`).join(' · ');
  return `${done ? `${done} · ` : ''}Falta: ${state.missing.join(' e ')}`;
}
