// Relatório de intervenções da Auditoria: o que cada pessoa ("quem") fez em um período
// escolhido à mão. Regras puras (sem banco) — a página carrega as linhas e chama buildAuditReport.

export const AUDIT_ENTITY_LABEL: Record<string, string> = {
  account: 'Conta',
  member: 'Membro',
  invoice: 'Fatura',
  payment: 'Pagamento',
  session: 'Sessão',
  office: 'Cargo',
  term: 'Período',
  memberOffice: 'Vinculação',
  cashClose: 'Fechamento',
};

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  CREATE: 'Criação',
  UPDATE: 'Alteração',
  DELETE: 'Remoção',
};

export const entityLabel = (e: string) => AUDIT_ENTITY_LABEL[e] ?? e;
export const actionLabel = (a: string) => AUDIT_ACTION_LABEL[a] ?? a;

/** Teto de linhas por relatório (a página avisa quando o período estoura). */
export const AUDIT_REPORT_LIMIT = 5000;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Período em dias de Brasília (createdAt é instante): 00:00 do "de" a 23:59:59.999 do "até". */
export function auditPeriodBounds(from: string | null | undefined, to: string | null | undefined): { gte?: Date; lte?: Date } {
  const gte = from && DAY.test(from) ? new Date(`${from}T00:00:00.000-03:00`) : undefined;
  const lte = to && DAY.test(to) ? new Date(`${to}T23:59:59.999-03:00`) : undefined;
  return {
    ...(gte && !Number.isNaN(gte.getTime()) ? { gte } : {}),
    ...(lte && !Number.isNaN(lte.getTime()) ? { lte } : {}),
  };
}

export interface AuditReportInput {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  before?: string | null;
  after?: string | null;
  createdAt: Date | string;
  userId: string | null;
  userName?: string | null;
}

export interface AuditReportRow {
  id: string;
  at: string;
  action: string;
  entity: string;
  entityId: string;
  detail: string;
  viaSuperadmin: boolean;
}

export interface AuditReportActor {
  /** userId, "system:…" ou "system". */
  key: string;
  name: string;
  system: boolean;
  total: number;
  byAction: Record<string, number>;
  rows: AuditReportRow[];
}

export interface AuditReport {
  actors: AuditReportActor[];
  total: number;
  byAction: Record<string, number>;
}

function parseJson(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const HIDDEN_KEYS = new Set(['viaSuperadmin', 'actor']);

/** Resumo legível dos detalhes gravados ("chave: valor · …"), sem segredos nem ruído, cortado em `max`. */
export function summarizeDetail(after: string | null | undefined, max = 160): string {
  if (!after) return '';
  const obj = parseJson(after);
  if (!obj) return after.length > max ? `${after.slice(0, max - 1)}…` : after;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (HIDDEN_KEYS.has(k) || v === null || v === undefined || v === '') continue;
    if (typeof v === 'object') continue;
    parts.push(`${k}: ${String(v)}`);
  }
  const text = parts.join(' · ');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Quem fez: usuário, ator de sistema (webhook/cron — userId nulo, ator no metadata) ou "Sistema". */
export function actorOf(e: Pick<AuditReportInput, 'userId' | 'userName' | 'after'>): { key: string; name: string; system: boolean } {
  if (e.userId) return { key: e.userId, name: e.userName?.trim() || 'Usuário removido', system: false };
  const actor = parseJson(e.after)?.actor;
  if (typeof actor === 'string' && actor) return { key: actor, name: `Sistema (${actor.replace(/^system:/, '')})`, system: true };
  return { key: 'system', name: 'Sistema', system: true };
}

/**
 * Agrupa as intervenções por pessoa (mais ativa primeiro; empate por nome) e ordena as linhas de
 * cada uma da mais antiga para a mais recente. `onlyActor` filtra uma pessoa (userId ou chave de sistema).
 */
export function buildAuditReport(entries: AuditReportInput[], onlyActor?: string | null): AuditReport {
  const map = new Map<string, AuditReportActor>();
  const byAction: Record<string, number> = {};
  let total = 0;
  for (const e of entries) {
    const who = actorOf(e);
    if (onlyActor && who.key !== onlyActor) continue;
    const at = (e.createdAt instanceof Date ? e.createdAt : new Date(e.createdAt)).toISOString();
    let a = map.get(who.key);
    if (!a) {
      a = { ...who, total: 0, byAction: {}, rows: [] };
      map.set(who.key, a);
    }
    a.total += 1;
    a.byAction[e.action] = (a.byAction[e.action] ?? 0) + 1;
    byAction[e.action] = (byAction[e.action] ?? 0) + 1;
    total += 1;
    a.rows.push({
      id: e.id, at, action: e.action, entity: e.entity, entityId: e.entityId,
      detail: summarizeDetail(e.after), viaSuperadmin: Boolean(parseJson(e.after)?.viaSuperadmin),
    });
  }
  const actors = [...map.values()];
  for (const a of actors) a.rows.sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0));
  actors.sort((x, y) => y.total - x.total || x.name.localeCompare(y.name, 'pt-BR'));
  return { actors, total, byAction };
}
