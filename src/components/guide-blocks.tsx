import { Section } from '@/components/legal-doc';
import type { GuideBlock } from '@/lib/guides';

/** Blocos de texto (parágrafos, listas, tabela) dos guias e das páginas de módulo — mesma aparência nos dois. */
export function GuideBlocks({ blocks }: { blocks: GuideBlock[] }) {
  return (
    <>
      {blocks.map((b) => (
        <Section key={b.h} title={b.h}>
          {b.p?.map((t) => <p key={t}>{t}</p>)}
          {b.ol ? <ol className="list-decimal space-y-2 pl-6">{b.ol.map((t) => <li key={t}>{t}</li>)}</ol> : null}
          {b.ul ? <ul className="list-disc space-y-2 pl-6">{b.ul.map((t) => <li key={t}>{t}</li>)}</ul> : null}
          {b.table ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm [&_td]:border-b [&_td]:border-white/6 [&_td]:px-3 [&_td]:py-2 [&_th]:border-b [&_th]:border-white/10 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-sand-light">
                <thead><tr>{b.table.head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                <tbody>{b.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
              </table>
            </div>
          ) : null}
        </Section>
      ))}
    </>
  );
}
