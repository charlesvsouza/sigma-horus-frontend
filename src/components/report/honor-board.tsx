'use client';

import type { ReactNode } from 'react';
import { UserRound } from 'lucide-react';
import { formatDateOnly } from '@/lib/date-only';
import { longDateBR, orientOf, type Letterhead } from '@/lib/letterhead';
import { printCss, useIssuedAt } from './report-document';

// Quadro de honra: peça para expor, emoldurar ou mostrar em sessão (Galeria de
// Veneráveis, Quadro da Gestão). Cabeçalho centralizado com brasão grande, moldura
// dourada em volta da página e retratos em grade. Sem cara de sistema: nada de
// "Página X de Y" nem "emitido por" — só "Oriente de …, <data>" no rodapé.

export type BoardPaper = 'A4' | 'A3';
export type BoardOrientation = 'portrait' | 'landscape';

const BOARD_CSS = `
  .rpt-doc .hb-frame { display: block !important; position: fixed; inset: 0; border: 4px double #b8962e !important; pointer-events: none; }
  .rpt-doc .hb-gold { color: #7a5f16 !important; }
  .rpt-doc .hb-photo { border: 2px solid #b8962e !important; }
  .rpt-doc .hb-grid { grid-template-columns: repeat(var(--hb-cols), minmax(0, 1fr)) !important; }
  .rpt-doc .hb-portrait { break-inside: avoid; page-break-inside: avoid; }
  .rpt-doc .hb-body { padding: 0 8mm; }
  .rpt-doc .hb-head { padding-top: 6mm; }
`;

export function HonorBoard({
  letterhead,
  title,
  subtitle,
  paper = 'A4',
  orientation = 'portrait',
  columns,
  className = '',
  children,
}: {
  letterhead: Letterhead;
  title: string;
  subtitle?: string | null;
  paper?: BoardPaper;
  orientation?: BoardOrientation;
  /** Retratos por linha no papel (padrão: 3 em retrato, 4 em paisagem; +1 no A3). */
  columns?: number;
  className?: string;
  children: ReactNode;
}) {
  const issuedAt = useIssuedAt(`${title} — ${letterhead.name}`);
  const orient = orientOf(letterhead);
  const lodgeLine = [letterhead.riteName, letterhead.powerName].filter(Boolean).join(' · ');
  const cols = columns ?? (orientation === 'landscape' ? 4 : 3) + (paper === 'A3' ? 1 : 0);
  const footerCenter = `${orient ? `${orient}, ` : ''}${longDateBR(issuedAt)}`;

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: printCss({ orientation, paper, footerCenter, paginate: false, margin: '12mm', fontSize: '10pt', extra: BOARD_CSS }),
        }}
      />
      <div
        className={`rpt-doc rounded-xl border border-gold/20 bg-sigma-card p-8 ${className}`}
        style={{ ['--hb-cols' as string]: cols }}
      >
        <div className="hb-frame hidden" aria-hidden />
        <header className="hb-head text-center">
          {letterhead.crestUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={letterhead.crestUrl} alt="" className="mx-auto mb-3 h-24 w-24 object-contain" />
          ) : null}
          <p className="font-display text-2xl font-bold uppercase tracking-[0.12em] text-sand-light">{letterhead.name}</p>
          {orient || lodgeLine ? <p className="mt-1 text-xs tracking-wide text-sand-dark">{[orient, lodgeLine].filter(Boolean).join(' · ')}</p> : null}
          <div className="mx-auto mt-4 h-px w-40 bg-gold/50" />
          <h2 className="hb-gold mt-4 font-display text-xl font-semibold uppercase tracking-[0.2em] text-gold">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm italic text-sand-dark">{subtitle}</p> : null}
        </header>
        <div className="hb-body mt-8">{children}</div>
      </div>
    </>
  );
}

/** Grade de retratos: responsiva na tela; no papel, `columns` do HonorBoard. */
export function PortraitGrid({ children }: { children: ReactNode }) {
  return <div className="hb-grid grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

/** Retrato do quadro: foto com moldura dourada, cargo, nome e período. */
export function Portrait({
  name,
  photoUrl,
  office,
  period,
  periodLabel,
  highlight = false,
  children,
}: {
  name: string;
  photoUrl: string | null;
  office?: string | null;
  /** yyyy-mm-dd; fim nulo = "em exercício". Sem início, não mostra período. */
  period?: { start: string | null; end: string | null } | null;
  /** Período já formatado (ex.: "1985–1987"); tem precedência sobre `period`. */
  periodLabel?: string | null;
  highlight?: boolean;
  /** Controles só de tela (editar, trocar foto): ficam fora do papel. */
  children?: ReactNode;
}) {
  const size = highlight ? 'h-36 w-36' : 'h-24 w-24';
  const periodText = periodLabel ? periodLabel : period?.start
    ? `${formatDateOnly(period.start).slice(-4)}–${period.end ? formatDateOnly(period.end).slice(-4) : 'em exercício'}`
    : null;
  return (
    <div className="hb-portrait flex flex-col items-center gap-2 text-center">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={name} className={`hb-photo ${size} rounded-full border-2 border-gold/50 object-cover`} />
      ) : (
        <div className={`hb-photo flex ${size} items-center justify-center rounded-full border-2 border-dashed border-gold/30 text-sand-dark/50`}>
          <UserRound className="h-1/2 w-1/2" />
        </div>
      )}
      {office ? <p className="hb-gold text-xs font-semibold uppercase tracking-[0.15em] text-gold">{office}</p> : null}
      <p className={`${highlight ? 'text-base' : 'text-sm'} font-semibold text-sand-light`}>{name}</p>
      {periodText ? <p className="text-xs text-sand-dark">{periodText}</p> : null}
      {children ? <div className="rpt-noprint">{children}</div> : null}
    </div>
  );
}

/** Seletor de papel/orientação (fica fora do documento, some na impressão). */
export function BoardPaperPicker({
  paper,
  orientation,
  onChange,
}: {
  paper: BoardPaper;
  orientation: BoardOrientation;
  onChange: (paper: BoardPaper, orientation: BoardOrientation) => void;
}) {
  const opt = 'rounded-full border px-3 py-1.5 text-xs transition-colors';
  const on = 'border-gold/60 bg-gold/10 text-gold';
  const off = 'border-white/8 text-sand-dark hover:border-white/20 hover:text-sand-light';
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden" role="group" aria-label="Papel da impressão">
      {(['A4', 'A3'] as const).map((p) => (
        <button key={p} type="button" onClick={() => onChange(p, orientation)} className={`${opt} ${paper === p ? on : off}`}>{p}</button>
      ))}
      {([['portrait', 'Retrato'], ['landscape', 'Paisagem']] as const).map(([o, label]) => (
        <button key={o} type="button" onClick={() => onChange(paper, o)} className={`${opt} ${orientation === o ? on : off}`}>{label}</button>
      ))}
    </div>
  );
}
