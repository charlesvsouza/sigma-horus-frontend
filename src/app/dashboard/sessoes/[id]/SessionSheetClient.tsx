'use client';

import Link from 'next/link';
import { OfficialDocument } from '@/components/report/official-document';
import { ReportActions } from '@/components/report/report-document';
import { BOOK_BLANK_ROWS, VISITOR_BLANK_ROWS } from '@/lib/attendance-book';
import type { SessionSheetData } from '@/lib/session-sheets-server';

// Folhas impressas da sessão, no papel timbrado da loja:
//  - "book":     livro de presença dos convocados (cargos primeiro), com linha de assinatura;
//  - "visitors": lista em branco para os irmãos visitantes preencherem (paisagem, 11 colunas).

const TZ = 'America/Sao_Paulo';

// No papel, a regra geral dos relatórios deixa as linhas baixas (2,5 px) — aqui é folha de
// assinatura: grade completa e altura para assinar à mão.
const SHEET_PRINT_CSS = `
@media print {
  .rpt-doc .sheet th, .rpt-doc .sheet td { border: 1px solid #888 !important; padding: 2px 5px !important; }
  .rpt-doc .sheet tbody td { height: 9mm; }
  .rpt-doc .sheet { font-size: 9pt; }
}`;
const cell = 'border border-white/10 px-2 py-2 align-middle';
const head = `${cell} text-left text-[11px] font-semibold uppercase tracking-wide text-sand-dark`;

function when(date: string, endDate: string | null): string {
  const start = new Date(date);
  const day = start.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ });
  const time = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  return endDate ? `${day}, das ${time(start)} às ${time(new Date(endDate))}` : `${day}, às ${time(start)}`;
}

export default function SessionSheetClient({ kind, sessionId, data, issuedBy, filled = false, troncoQr = null }: { kind: 'book' | 'visitors'; sessionId: string; data: SessionSheetData; issuedBy: string | null; filled?: boolean; troncoQr?: { dataUrl: string; expiresAt: string; identifier?: string | null; provider?: string } | null }) {
  const { scope } = data;
  const isBook = kind === 'book';
  // Lista preenchida (para arquivo): os visitantes digitados e poucas linhas em branco.
  const visitorRows = filled ? data.visitors : [];
  const blank = Array.from({ length: isBook ? BOOK_BLANK_ROWS : filled ? 3 : VISITOR_BLANK_ROWS });

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rpt-noprint flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-sand-light">{isBook ? 'Livro de presença' : 'Lista de presença de visitantes'}</h1>
            <p className="mt-1 max-w-3xl text-sm text-sand-dark">
              {isBook
                ? `Os ${data.rows.length} irmãos convocados pelos graus da sessão, com os cargos no topo. Imprima antes da sessão; depois, marque a presença no sistema.`
                : filled
                  ? `Os ${data.visitors.length} visitantes digitados na sessão, para arquivo junto com a folha assinada.`
                  : 'Folha em branco para os irmãos visitantes preencherem na sessão. Depois, a Secretaria cadastra os visitantes na sessão para emitir os certificados.'}
            </p>
            <Link href={`/dashboard/sessoes/${sessionId}`} className="mt-2 inline-block text-xs text-gold transition hover:text-gold-light">← Voltar para a sessão</Link>
          </div>
          <ReportActions />
        </div>

        <OfficialDocument
          letterhead={data.letterhead}
          title={isBook ? 'Livro de presença' : 'Lista de presença de visitantes'}
          subtitle={`Sessão ${scope.typeLabel} — “${scope.title}”`}
          issuedBy={issuedBy}
          signatures={data.signatures}
          orientation={isBook ? 'portrait' : 'landscape'}
        >
          <div className="space-y-1 text-sm text-sand">
            <p><strong className="text-sand-light">Data:</strong> {when(scope.date, scope.endDate)}</p>
            <p><strong className="text-sand-light">Graus trabalhados:</strong> {scope.degrees ?? 'não informados'}</p>
            {isBook && scope.agenda ? (
              <p className="whitespace-pre-line"><strong className="text-sand-light">Ordem do dia:</strong>{'\n'}{scope.agenda}</p>
            ) : null}
          </div>

          <style dangerouslySetInnerHTML={{ __html: SHEET_PRINT_CSS }} />
          <table className="sheet mt-5 w-full border-collapse text-sm text-sand">
            {isBook ? (
              <>
                <thead>
                  <tr>
                    <th className={`${head} w-10`}>Nº</th>
                    <th className={head}>Irmão</th>
                    <th className={`${head} w-40`}>Cargo</th>
                    <th className={`${head} w-32`}>Grau</th>
                    <th className={`${head} w-56`}>Assinatura</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.n}>
                      <td className={`${cell} tabular-nums`}>{String(r.n).padStart(2, '0')}</td>
                      <td className={`${cell} text-sand-light`}>{r.name}</td>
                      <td className={cell}>{r.office}</td>
                      <td className={cell}>{r.degree}</td>
                      <td className={cell} />
                    </tr>
                  ))}
                  {blank.map((_, i) => (
                    <tr key={`b${i}`}>
                      <td className={`${cell} tabular-nums text-sand-dark`}>{String(data.rows.length + i + 1).padStart(2, '0')}</td>
                      <td className={cell} />
                      <td className={cell} />
                      <td className={cell} />
                      <td className={cell} />
                    </tr>
                  ))}
                </tbody>
              </>
            ) : (
              <>
                <thead>
                  <tr>
                    <th className={`${head} w-8`}>Nº</th>
                    <th className={head}>Nome do obreiro</th>
                    <th className={`${head} w-24`}>Grau</th>
                    <th className={head}>Loja</th>
                    <th className={`${head} w-12`}>Nº</th>
                    <th className={`${head} w-28`}>Oriente</th>
                    <th className={`${head} w-24`}>Potência</th>
                    <th className={`${head} w-20`}>CIM</th>
                    <th className={`${head} w-28`}>Telefone</th>
                    <th className={head}>E-mail</th>
                    <th className={`${head} w-36`}>Assinatura</th>
                  </tr>
                </thead>
                <tbody>
                  {visitorRows.map((v, i) => (
                    <tr key={`v${i}`}>
                      <td className={`${cell} tabular-nums`}>{String(i + 1).padStart(2, '0')}</td>
                      <td className={`${cell} text-sand-light`}>{v.name}</td>
                      <td className={cell}>{v.degree}</td>
                      <td className={cell}>{v.lodgeName}</td>
                      <td className={cell}>{v.lodgeNumber}</td>
                      <td className={cell}>{v.orient}</td>
                      <td className={cell}>{v.powerName}</td>
                      <td className={cell}>{v.cim}</td>
                      <td className={cell}>{v.phone}</td>
                      <td className={`${cell} break-all`}>{v.email}</td>
                      <td className={cell} />
                    </tr>
                  ))}
                  {blank.map((_, i) => (
                    <tr key={i}>
                      <td className={`${cell} h-9 tabular-nums text-sand-dark`}>{String(visitorRows.length + i + 1).padStart(2, '0')}</td>
                      {Array.from({ length: 10 }).map((__, j) => <td key={j} className={cell} />)}
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </table>

          {troncoQr ? (
            <div className="mt-5 flex items-center gap-4 rounded-lg border border-white/10 p-3 [break-inside:avoid]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={troncoQr.dataUrl} alt="QR Code Pix do Tronco de Solidariedade desta sessão" width={110} height={110} className="h-[110px] w-[110px] shrink-0 bg-white p-1" />
              <div className="text-xs leading-relaxed text-sand">
                <p className="text-sm font-semibold text-sand-light">Tronco de Solidariedade — doe pelo Pix</p>
                <p>Aponte a câmera do app do banco para o QR e informe o valor que desejar. A doação é anônima e fica registrada nesta sessão ({isBook ? 'obreiros' : 'visitantes'}).</p>
                {troncoQr.provider === 'lodge' ? (
                  <p className="text-sand-dark">Pix para a chave da loja · identificador da sessão: <strong className="font-mono text-sand-light">{troncoQr.identifier}</strong></p>
                ) : (
                  <p className="text-sand-dark">QR válido até 00:00 de {new Date(troncoQr.expiresAt).toLocaleDateString('pt-BR', { timeZone: TZ })}.</p>
                )}
              </div>
            </div>
          ) : null}

          {isBook ? (
            <p className="mt-4 text-sm text-sand">Total de presentes: ________</p>
          ) : (
            <p className="mt-4 text-xs text-sand-dark">
              Ao informar seu e-mail, você autoriza a Loja a enviar o seu certificado de presença desta sessão. Seus dados não serão usados para outro fim.
            </p>
          )}
        </OfficialDocument>
      </div>
    </main>
  );
}
