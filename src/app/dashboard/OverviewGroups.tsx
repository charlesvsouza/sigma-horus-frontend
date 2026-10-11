import Link from 'next/link';
import type { OverviewItem, Tone } from '@/lib/overview-server';

const TONE_TEXT: Record<Tone, string> = { rose: 'text-rose-300', gold: 'text-gold', muted: 'text-sand', emerald: 'text-emerald-300' };

/** "Precisa de atenção": uma lista só, com o que é maior que zero (a ordem — atrasos primeiro — vem de lib/overview-layout). */
export function OverviewAttention({ items }: { items: OverviewItem[] }) {
  return (
    <section aria-labelledby="ov-atencao" className="rounded-xl border border-white/6 bg-sigma-card p-6">
      <h2 id="ov-atencao" className="text-base font-semibold text-sand-light">Precisa de atenção</h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-sand-dark">Tudo em dia. Nada esperando por você no momento.</p>
      ) : (
        <ul className="mt-4 divide-y divide-white/5">
          {items.map((i) => {
            const body = (
              <>
                <span className="min-w-0 pr-3">
                  <span className="block text-sm text-sand-dark transition-colors group-hover:text-sand-light">{i.label}</span>
                  {i.hint ? <span className="block truncate text-xs text-sand-dark/70">{i.hint}</span> : null}
                </span>
                <span className={`shrink-0 text-lg font-semibold tabular-nums ${TONE_TEXT[i.tone]}`}>{i.value}</span>
              </>
            );
            return (
              <li key={i.key}>
                {i.href ? <Link href={i.href} className="group flex items-center justify-between py-2.5 transition-colors">{body}</Link> : <div className="group flex items-center justify-between py-2.5">{body}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** "Para acompanhar": informação, em faixas pequenas — sem cartão por assunto. */
export function OverviewFollow({ items }: { items: OverviewItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="ov-acompanhar">
      <h2 id="ov-acompanhar" className="text-xs font-medium uppercase tracking-wider text-sand-dark">Para acompanhar</h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => {
          const body = (
            <>
              <span className="block text-xs text-sand-dark">{i.label}</span>
              <span className={`mt-0.5 block text-base font-semibold tabular-nums ${TONE_TEXT[i.tone]}`}>{i.value}</span>
              {i.hint ? <span className="mt-0.5 block truncate text-xs text-sand-dark/70">{i.hint}</span> : null}
            </>
          );
          const box = 'block rounded-lg border border-white/6 bg-sigma-blue-deep/40 px-4 py-3';
          return <li key={i.key}>{i.href ? <Link href={i.href} className={`${box} transition-colors hover:border-white/12`}>{body}</Link> : <div className={box}>{body}</div>}</li>;
        })}
      </ul>
    </section>
  );
}
