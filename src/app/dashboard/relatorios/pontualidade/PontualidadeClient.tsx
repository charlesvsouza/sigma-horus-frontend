'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/ui';
import { ReportActions, ReportDocument, type Signatory } from '@/components/report/report-document';
import { brl } from '@/lib/currency';
import { BUCKET_LABEL, type PunctualityBucket, type PunctualitySummary } from '@/lib/dues-punctuality';
import type { PunctualityRow } from '@/lib/dues-punctuality-server';
import { formatDateOnly } from '@/lib/date-only';

const ORDER: PunctualityBucket[] = ['on_time', 'late', 'open_overdue', 'open_upcoming'];
const BAR: Record<PunctualityBucket, string> = { on_time: 'bg-emerald-500', late: 'bg-amber-400', open_overdue: 'bg-rose-500', open_upcoming: 'bg-sand-dark/60' };
const monthLabel = (m: string) => new Date(`${m}-01T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export default function PontualidadeClient({ lodgeName, crestUrl, issuedBy, signatures, month, rows, summary }: { lodgeName: string; crestUrl: string | null; issuedBy?: string | null; signatures: Signatory[]; month: string; rows: PunctualityRow[]; summary: PunctualitySummary }) {
  const router = useRouter();
  const amountOf = (b: PunctualityBucket) => rows.filter((r) => r.bucket === b).reduce((s, r) => s + r.amount, 0);

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rpt-noprint">
          <Link href="/dashboard/relatorios" className="px-1 py-1 text-xs text-gold transition hover:text-gold-light">&larr; Voltar a Relatórios</Link>
          <h1 className="mt-2 font-display text-2xl font-bold text-sand-light">Pontualidade das mensalidades</h1>
          <p className="mt-1 text-sm text-sand-dark">Mensalidades com vencimento no mês: pagas até o vencimento, pagas depois e ainda não pagas. Conta por mensalidade; irmãos isentos ficam de fora.</p>
          <label className="mt-3 flex w-fit items-center gap-2 text-sm text-sand-dark">
            Mês
            <input type="month" value={month} onChange={(e) => e.target.value && router.push(`/dashboard/relatorios/pontualidade?mes=${e.target.value}`)} className="rounded-md border border-white/10 bg-sigma-blue-deep/60 px-2 py-1 text-sand-light" />
          </label>
        </div>

        {summary.total === 0 ? (
          <EmptyState title="Nenhuma mensalidade com vencimento neste mês." description="Escolha outro mês ou lance as mensalidades em Cobranças." />
        ) : (
          <>
            <ReportActions csv={() => ({ filename: `pontualidade_${month}`, rows: [['Irmão', 'Vencimento', 'Pago em', 'Valor', 'Situação'], ...rows.map((r) => [r.memberName, formatDateOnly(r.dueDay), r.paidDay ? formatDateOnly(r.paidDay) : '', r.amount, BUCKET_LABEL[r.bucket]])] })} />
            <ReportDocument lodgeName={lodgeName} crestUrl={crestUrl} title={`Pontualidade das mensalidades — ${monthLabel(month)}`} details={[`${summary.total} mensalidades`, 'por quantidade', 'posição na data de emissão']} issuedBy={issuedBy} signatures={signatures}>
              <div className="rpt-section mb-6">
                <div className="flex h-4 w-full overflow-hidden rounded-full bg-white/5" role="img" aria-label={ORDER.map((b) => `${BUCKET_LABEL[b]}: ${summary.percent[b]}%`).join('; ')}>
                  {ORDER.map((b) => summary.percent[b] > 0 ? <div key={b} className={BAR[b]} style={{ width: `${summary.percent[b]}%` }} /> : null)}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {ORDER.map((b) => (
                    <div key={b} className="rpt-card rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-4">
                      <p className="flex items-center gap-2 text-xs text-sand-dark"><span className={`inline-block h-2.5 w-2.5 rounded-full ${BAR[b]}`} />{BUCKET_LABEL[b]}</p>
                      <p className="mt-2 text-2xl font-semibold text-sand-light">{summary.percent[b]}%</p>
                      <p className="text-xs text-sand-dark">{summary.counts[b]} de {summary.total} · {brl(amountOf(b))}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-sm text-sand-dark">
                  Pagas: <strong className="text-sand-light">{summary.paid.percent}%</strong> ({summary.paid.count}) · Não pagas: <strong className="text-sand-light">{summary.unpaid.percent}%</strong> ({summary.unpaid.count}), das quais {summary.counts.open_overdue} já vencidas.
                </p>
              </div>

              {ORDER.map((b) => {
                const list = rows.filter((r) => r.bucket === b);
                if (list.length === 0) return null;
                return (
                  <div key={b} className="rpt-section mb-6">
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-sand-light">{BUCKET_LABEL[b]} ({list.length})</h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-sand-dark/70">
                          <th className="border-b border-white/10 px-2 py-2">Irmão</th>
                          <th className="border-b border-white/10 px-2 py-2">Vencimento</th>
                          <th className="border-b border-white/10 px-2 py-2">Pago em</th>
                          <th className="border-b border-white/10 px-2 py-2 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((r) => (
                          <tr key={r.accountId}>
                            <td className="border-b border-white/5 px-2 py-2 text-sand-light">{r.memberName}</td>
                            <td className="border-b border-white/5 px-2 py-2 text-sand-dark">{formatDateOnly(r.dueDay)}</td>
                            <td className="border-b border-white/5 px-2 py-2 text-sand-dark">{r.paidDay ? formatDateOnly(r.paidDay) : '—'}</td>
                            <td className="num border-b border-white/5 px-2 py-2 text-right tabular-nums text-sand">{brl(r.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </ReportDocument>
          </>
        )}
      </div>
    </main>
  );
}
