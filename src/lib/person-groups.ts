// Agrupamento por pessoa nas listas de relatório (decisão do dono, 2026-10-21): na tela, quem tem mais de um lançamento pode virar
// uma linha só com o valor acumulado (clique abre o detalhe); no papel/CSV o detalhe sai sempre, do mais antigo ao mais novo.
// Regra pura: os lançamentos de uma mesma pessoa ficam juntos, do mais antigo ao mais novo, no lugar do primeiro deles.

export type PersonEntry<T> =
  | { kind: 'row'; row: T }
  | { kind: 'group'; key: string; name: string; rows: T[]; total: number; oldest: string };

export function groupByPerson<T>(
  rows: T[],
  o: { key: (r: T) => string | null; name: (r: T) => string; amount: (r: T) => number; date: (r: T) => string },
  accumulate: boolean,
): PersonEntry<T>[] {
  const people = new Map<string, T[]>();
  for (const r of rows) {
    const k = o.key(r);
    if (k) people.set(k, [...(people.get(k) ?? []), r]);
  }
  const out: PersonEntry<T>[] = [];
  const done = new Set<string>();
  for (const r of rows) {
    const k = o.key(r);
    if (!k) { out.push({ kind: 'row', row: r }); continue; }
    if (done.has(k)) continue;
    done.add(k);
    const list = [...people.get(k)!].sort((a, b) => o.date(a).localeCompare(o.date(b)));
    if (accumulate && list.length > 1) {
      const total = Math.round(list.reduce((s, x) => s + Math.round(o.amount(x) * 100), 0)) / 100;
      out.push({ kind: 'group', key: k, name: o.name(list[0]), rows: list, total, oldest: o.date(list[0]) });
    } else {
      for (const row of list) out.push({ kind: 'row', row });
    }
  }
  return out;
}
