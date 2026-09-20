// Auditoria de campos de dinheiro (Float) — lógica pura, usada por scripts/audit-money-decimals.ts.
// Responde: existe hoje algum valor gravado com mais de 2 casas decimais (ou inválido)? Se não,
// dá para proteger o banco com um CHECK simples em vez de migrar tudo para Decimal.

export type FloatColumn = { model: string; field: string; kind: 'money' | 'percent' };

/** Campos Float do schema. Nomes com "percent" são taxas (podem ter casas), não dinheiro. */
export function parseFloatColumns(schema: string): FloatColumn[] {
  const out: FloatColumn[] = [];
  let model: string | null = null;
  for (const raw of schema.replace(/\r\n/g, '\n').split('\n')) {
    const start = /^model\s+(\w+)\s*\{/.exec(raw);
    if (start) { model = start[1]; continue; }
    if (/^\}/.test(raw)) { model = null; continue; }
    if (!model) continue;
    const field = /^\s+(\w+)\s+Float\??(\s|$)/.exec(raw);
    if (field) out.push({ model, field: field[1], kind: /percent/i.test(field[1]) ? 'percent' : 'money' });
  }
  return out;
}

const NON_FINITE = `('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8)`;

const q = (identifier: string) => {
  if (!/^\w+$/.test(identifier)) throw new Error(`identificador inválido: ${identifier}`);
  return `"${identifier}"`;
};

/** Condição SQL "tem mais de 2 casas" (ignora NaN/Infinity, tratados à parte). */
const subCent = (f: string) =>
  `(CASE WHEN ${f} IN ${NON_FINITE} THEN false ELSE ${f}::numeric <> round(${f}::numeric, 2) END)`;

export function summarySql(col: FloatColumn): string {
  const t = q(col.model);
  const f = q(col.field);
  return `SELECT
  count(*)::int AS total,
  count(${f})::int AS filled,
  count(*) FILTER (WHERE ${f} IS NOT NULL AND ${subCent(f)})::int AS sub_cent,
  count(*) FILTER (WHERE ${f} < 0)::int AS negative,
  count(*) FILTER (WHERE ${f} IN ${NON_FINITE})::int AS non_finite,
  count(*) FILTER (WHERE ${f} IS NOT NULL AND ${f} NOT IN ${NON_FINITE} AND abs(${f}) >= 1e12)::int AS too_big,
  max(abs(${f})) FILTER (WHERE ${f} NOT IN ${NON_FINITE})::text AS max_abs
FROM ${t}`;
}

export function examplesSql(col: FloatColumn, limit = 5): string {
  const t = q(col.model);
  const f = q(col.field);
  return `SELECT "id"::text AS id, ${f}::text AS value FROM ${t} WHERE ${f} IS NOT NULL AND ${subCent(f)} ORDER BY "id" LIMIT ${Number(limit) | 0}`;
}

export type ColumnReport = FloatColumn & {
  total: number;
  filled: number;
  subCent: number;
  negative: number;
  nonFinite: number;
  tooBig: number;
  maxAbs: string | null;
  examples: { id: string; value: string }[];
};

type Query = (sql: string) => Promise<{ rows: Record<string, unknown>[] }>;

export async function auditColumn(query: Query, col: FloatColumn): Promise<ColumnReport> {
  const r = (await query(summarySql(col))).rows[0] ?? {};
  const report: ColumnReport = {
    ...col,
    total: Number(r.total ?? 0),
    filled: Number(r.filled ?? 0),
    subCent: Number(r.sub_cent ?? 0),
    negative: Number(r.negative ?? 0),
    nonFinite: Number(r.non_finite ?? 0),
    tooBig: Number(r.too_big ?? 0),
    maxAbs: (r.max_abs as string | null) ?? null,
    examples: [],
  };
  if (report.subCent > 0) {
    const ex = await query(examplesSql(col));
    report.examples = ex.rows.map((row) => ({ id: String(row.id), value: String(row.value) }));
  }
  return report;
}

/** Só dinheiro entra no veredito: taxas percentuais podem ter casas. */
export function verdict(reports: ColumnReport[]) {
  const money = reports.filter((r) => r.kind === 'money');
  const dirty = money.filter((r) => r.subCent > 0 || r.nonFinite > 0 || r.tooBig > 0);
  return {
    clean: dirty.length === 0,
    dirty,
    subCentTotal: money.reduce((s, r) => s + r.subCent, 0),
    negativeColumns: money.filter((r) => r.negative > 0).map((r) => `${r.model}.${r.field}`),
  };
}
