'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '@/components/ui';
import { downloadCsv } from '@/lib/csv';

// Documento de relatório padrão (tela + impressão/PDF). Todos os relatórios usam este
// mesmo cabeçalho institucional (brasão, loja, título, período/filtros, emissão), o
// mesmo estilo de tabela e o mesmo rodapé paginado — em vez de cada tela carregar a
// sua própria cópia do CSS de impressão.
//
// Classes utilitárias para o conteúdo:
//   rpt-noprint   some no papel (botões, gráficos de barra da tela)
//   rpt-section   bloco que não quebra no meio da página
//   rpt-pagebreak começa numa página nova
//   rpt-total     linha de total (negrito + fio)
//   rpt-flat      cartão da tela que vira seção sem moldura no papel
//   rpt-card      caixa com borda fina no papel (resumos/indicadores)
//   num           célula numérica (alinhada à direita)

export interface Signatory {
  role: string;
  name?: string | null;
}

const fmtIssued = (d: Date) =>
  d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Texto do rodapé vai dentro de `content: "..."` do CSS.
const cssString = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ')}"`;

function printCss(orientation: 'portrait' | 'landscape', footer: string) {
  return `
@media print {
  @page {
    size: A4 ${orientation};
    margin: 14mm 12mm 16mm;
    @bottom-left { content: ${cssString(footer)}; font: 7pt Georgia, "Times New Roman", serif; color: #555; }
    @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 7pt Georgia, "Times New Roman", serif; color: #555; }
  }
  html, body { background: #fff !important; }
  body * { visibility: hidden !important; }
  .rpt-doc, .rpt-doc * { visibility: visible !important; }
  .rpt-doc {
    display: block !important; position: absolute; left: 0; top: 0; width: 100%;
    margin: 0 !important; padding: 0 !important; border: none !important; border-radius: 0 !important; box-shadow: none !important;
    background: #fff !important; color: #111 !important;
    font-family: Georgia, "Times New Roman", serif !important; font-size: 9pt; line-height: 1.35;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .rpt-doc * { color: #111 !important; box-shadow: none !important; text-decoration: none !important; }
  .rpt-doc [class*="bg-sigma"], .rpt-doc [class*="bg-white/"] { background: #fff !important; }
  .rpt-doc [class*="border-white"] { border-color: #ccc !important; }
  .rpt-doc .rpt-noprint { display: none !important; }
  .rpt-doc h1, .rpt-doc h2, .rpt-doc h3 { font-family: Georgia, "Times New Roman", serif !important; }
  .rpt-doc table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  .rpt-doc thead { display: table-header-group; }
  .rpt-doc th, .rpt-doc td { border-bottom: 1px solid #ddd !important; padding: 2.5px 5px !important; }
  .rpt-doc th { text-transform: uppercase; font-size: 7pt; letter-spacing: .03em; border-bottom: 1.5px solid #333 !important; }
  .rpt-doc .num { text-align: right !important; font-variant-numeric: tabular-nums; }
  .rpt-doc tr { break-inside: avoid; page-break-inside: avoid; }
  .rpt-doc .rpt-total td { font-weight: bold; border-top: 1.5px solid #333 !important; }
  .rpt-doc .rpt-section { break-inside: avoid; page-break-inside: avoid; }
  .rpt-doc .rpt-pagebreak { break-before: page; page-break-before: always; }
  .rpt-doc .rpt-flat { border: none !important; border-radius: 0 !important; padding: 0 !important; margin-top: 14px !important; }
  .rpt-doc .rpt-card { border: 1px solid #ccc !important; border-radius: 3px; padding: 6px 8px !important; }
  .rpt-doc .rpt-head { border-bottom: 1.5px solid #333 !important; }
  .rpt-doc .rpt-signatures { break-inside: avoid; page-break-inside: avoid; margin-top: 24mm !important; grid-template-columns: repeat(auto-fit, minmax(48mm, 1fr)) !important; }
}`;
}

/**
 * Cabeçalho + corpo + assinaturas. `printOnly` = não aparece na tela, só no papel
 * (para telas cujo layout de tela é diferente do documento, ex.: lista com ações).
 */
export function ReportDocument({
  lodgeName,
  crestUrl,
  title,
  details,
  issuedBy,
  orientation = 'portrait',
  signatures,
  printOnly = false,
  className = '',
  children,
}: {
  lodgeName: string;
  crestUrl?: string | null;
  title: string;
  /** Período, filtros e observações do cabeçalho (vazios são ignorados), unidos por " · ". */
  details?: (string | null | false | undefined)[];
  issuedBy?: string | null;
  orientation?: 'portrait' | 'landscape';
  signatures?: Signatory[];
  printOnly?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [issuedAt, setIssuedAt] = useState(() => new Date());
  const detailLine = (details ?? []).filter(Boolean).join(' · ');

  // Hora de emissão = hora da impressão; título da aba vira o nome sugerido do PDF.
  useEffect(() => {
    let previous = document.title;
    const before = () => {
      // flushSync: o navegador tira o "retrato" da página logo depois deste evento.
      flushSync(() => setIssuedAt(new Date()));
      previous = document.title;
      document.title = `${title} — ${lodgeName}`;
    };
    const after = () => { document.title = previous; };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, [title, lodgeName]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: printCss(orientation, `${lodgeName} · ${title} · Sigma Horus`) }} />
      <div className={`rpt-doc rounded-xl border border-white/6 bg-sigma-card p-6 ${printOnly ? 'hidden' : ''} ${className}`}>
        <header className="rpt-head mb-5 flex items-center gap-4 border-b border-white/10 pb-4">
          {crestUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={crestUrl} alt="" className="h-14 w-14 shrink-0 object-contain" />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold leading-tight text-sand-light">{lodgeName}</p>
            <h2 className="mt-1 text-sm font-semibold uppercase tracking-wide text-gold">{title}</h2>
            {detailLine ? <p className="mt-0.5 text-xs text-sand-dark">{detailLine}</p> : null}
          </div>
          <div className="shrink-0 text-right text-[0.7rem] leading-snug text-sand-dark">
            <p>Emitido em</p>
            <p className="font-medium text-sand" suppressHydrationWarning>{fmtIssued(issuedAt)}</p>
            {issuedBy ? <p>por {issuedBy}</p> : null}
          </div>
        </header>

        {children}

        {signatures && signatures.length > 0 ? (
          <div className="rpt-signatures mt-16 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {signatures.map((s) => (
              <div key={s.role} className="text-center text-xs">
                <div className="border-t border-sand-dark/60 pt-1.5" />
                {s.name ? <p className="font-semibold text-sand-light">{s.name}</p> : <p className="text-sand-dark">&nbsp;</p>}
                <p className="text-sand-dark">{s.role}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}

/** Botões padrão: Imprimir / PDF e (opcional) Exportar CSV. Aceita as linhas prontas, então serve também em Server Components. */
export function ReportActions({
  csv,
  disabled = false,
  children,
}: {
  csv?: { filename: string; rows: unknown[][] } | (() => { filename: string; rows: unknown[][] });
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="rpt-noprint flex flex-wrap items-center gap-3 print:hidden">
      <Button type="button" onClick={() => window.print()} disabled={disabled}>Imprimir / PDF</Button>
      {csv ? (
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => {
            const data = typeof csv === 'function' ? csv() : csv;
            downloadCsv(data.filename, data.rows);
          }}
        >
          Exportar CSV
        </Button>
      ) : null}
      {children}
    </div>
  );
}
