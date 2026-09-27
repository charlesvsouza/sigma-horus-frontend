'use client';

import type { ReactNode } from 'react';
import { longDateBR, orientOf, type Letterhead } from '@/lib/letterhead';
import { formatDateOnly } from '@/lib/date-only';
import { Signatures, fmtIssued, printCss, useIssuedAt, type Signatory } from './report-document';

// Documento oficial da loja (prancha): o que vai para a Potência ou é arquivado com
// assinatura — Composição da loja, Termo de responsabilidade. Cabeçalho maçônico
// centralizado (fórmula de abertura configurável, brasão, loja, Oriente, rito,
// Potência), fecho com local e data por extenso e assinaturas. Mesma base de
// impressão dos relatórios (report-document), então as classes rpt-* valem aqui.

const OFFICIAL_CSS = `
  .rpt-doc .off-rule { border-top: 3px double #333 !important; }
  .rpt-doc .off-title { letter-spacing: .12em; }
  .rpt-doc.off-break { break-before: page; page-break-before: always; }
`;

export function OfficialDocument({
  letterhead,
  title,
  subtitle,
  issuedBy,
  signatures,
  printOnly = false,
  pageBreakBefore = false,
  withPrintCss = true,
  className = '',
  children,
}: {
  letterhead: Letterhead;
  title: string;
  subtitle?: string | null;
  issuedBy?: string | null;
  signatures?: Signatory[];
  printOnly?: boolean;
  /** Vários documentos na mesma impressão (ex.: um termo por obreiro): cada um começa numa página. */
  pageBreakBefore?: boolean;
  /** Só um <style> por página: com vários documentos, desligue nos demais. */
  withPrintCss?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const issuedAt = useIssuedAt(`${title} — ${letterhead.name}`);
  const orient = orientOf(letterhead);
  const lodgeLine = [
    orient,
    letterhead.riteName,
    letterhead.powerName,
    letterhead.foundationDate ? `Fundada em ${formatDateOnly(letterhead.foundationDate)}` : null,
  ].filter(Boolean).join(' · ');
  const footer = `${letterhead.name} · ${title} · Emitido em ${fmtIssued(issuedAt)}${issuedBy ? ` por ${issuedBy}` : ''}`;

  return (
    <>
      {withPrintCss ? (
        <style dangerouslySetInnerHTML={{ __html: printCss({ footer, margin: '16mm 16mm 18mm', fontSize: '10pt', extra: OFFICIAL_CSS }) }} />
      ) : null}
      <div
        className={`rpt-doc ${pageBreakBefore ? 'off-break' : ''} rounded-xl border border-white/6 bg-sigma-card p-8 ${printOnly ? 'hidden' : ''} ${className}`}
      >
        <header className="text-center">
          {letterhead.openingFormula ? (
            <p className="mb-3 text-xs tracking-[0.25em] text-sand-dark">{letterhead.openingFormula}</p>
          ) : null}
          {letterhead.crestUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={letterhead.crestUrl} alt="" className="mx-auto mb-2 h-20 w-20 object-contain" />
          ) : null}
          <p className="font-display text-xl font-bold uppercase tracking-wide text-sand-light">{letterhead.name}</p>
          {lodgeLine ? <p className="mt-1 text-xs text-sand-dark">{lodgeLine}</p> : null}
          <div className="off-rule mx-auto mt-4 border-t-[3px] border-double border-gold/40" />
          <h2 className="off-title mt-4 text-base font-semibold uppercase text-gold">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-sand-dark">{subtitle}</p> : null}
        </header>

        <div className="mt-6">{children}</div>

        <p className="mt-10 text-right text-sm text-sand">
          {orient ? `${orient}, ` : ''}{longDateBR(issuedAt)}.
        </p>

        <Signatures signatures={signatures} className="lg:grid-cols-2" />
      </div>
    </>
  );
}
