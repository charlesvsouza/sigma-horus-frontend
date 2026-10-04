import Link from 'next/link';
import type { OverviewGroup, Tone } from '@/lib/overview-server';

const TONE_TEXT: Record<Tone, string> = { rose: 'text-rose-300', gold: 'text-gold', muted: 'text-sand', emerald: 'text-emerald-300' };

/** Cartões de indicadores da Visão geral (um por área). Valor zero em tom apagado; cada linha leva à tela correspondente. */
export default function OverviewGroups({ groups }: { groups: OverviewGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {groups.map((g) => (
        <section key={g.title} aria-labelledby={`ov-${g.title}`} className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <h2 id={`ov-${g.title}`} className="text-base font-semibold text-sand-light">{g.title}</h2>
          <ul className="mt-4 divide-y divide-white/5">
            {g.items.map((i) => {
              const zero = typeof i.value === 'number' && i.value === 0;
              const body = (
                <>
                  <span className="min-w-0 pr-3">
                    <span className="block text-sm text-sand-dark transition-colors group-hover:text-sand-light">{i.label}</span>
                    {i.hint ? <span className="block truncate text-xs text-sand-dark/70">{i.hint}</span> : null}
                  </span>
                  <span className={`shrink-0 text-lg font-semibold tabular-nums ${zero ? 'text-sand-dark/40' : TONE_TEXT[i.tone]}`}>{i.value}</span>
                </>
              );
              return (
                <li key={i.key}>
                  {i.href ? (
                    <Link href={i.href} className="group flex items-center justify-between py-2.5 transition-colors">{body}</Link>
                  ) : (
                    <div className="group flex items-center justify-between py-2.5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
