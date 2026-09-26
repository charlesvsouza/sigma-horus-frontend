'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, EmptyState, inputClass } from '@/components/ui';
import { brl } from '@/lib/currency';
import { csvRow } from '@/lib/csv';
import { MEMBER_STATUSES, memberStatusLabel } from '@/lib/member-status';
import { formatDateOnly } from '@/lib/date-only';

interface LateCharge { fee: number; interest: number; total: number; }
interface Row {
  memberId: string;
  memberName: string;
  memberStatus: string;
  openCount: number;
  totalAmount: number;
  oldestDueDate: string;
  daysOverdue: number;
  art002: boolean;
  lateCharge: LateCharge;
}


function RenegotiateForm({ memberId, onDone }: { memberId: string; onDone: () => void }) {
  const [firstDueDate, setFirstDueDate] = useState('');
  const [applyLateCharge, setApplyLateCharge] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/members/${memberId}/renegotiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstDueDate: firstDueDate || undefined, applyLateCharge }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      // Cobrança antiga no Asaas que não pôde ser cancelada: o operador precisa saber.
      if (data.asaasWarning) window.alert(data.asaasWarning);
      onDone();
    } else setError(data.error ?? 'Erro ao renegociar.');
  }

  return (
    <div className="mt-3 rounded-lg border border-gold/20 bg-gold/5 p-3">
      {error ? <p className="mb-2 text-xs text-rose-300">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-sand-dark">
          1º vencimento
          <input type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} className={`ml-2 ${inputClass}`} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-sand-dark">
          <input type="checkbox" checked={applyLateCharge} onChange={(e) => setApplyLateCharge(e.target.checked)} />
          Incluir multa/juros no total
        </label>
        <button onClick={() => void submit()} disabled={busy} className="rounded-full bg-gold px-4 py-1.5 text-xs font-medium text-sigma-blue-deep hover:bg-gold-light disabled:opacity-40">
          {busy ? 'Gerando…' : 'Confirmar parcelamento'}
        </button>
      </div>
      <p className="mt-2 text-xs text-sand-dark">
        Redistribui o valor em aberto (mensalidades vencidas) nas mesmas contas, com vencimentos mensais a partir da
        data acima. O Art. 002 deixa de contar assim que os vencimentos ficam no futuro.
      </p>
    </div>
  );
}

type AgingBucket = '1-30' | '31-60' | '61-90' | '90+';
const AGING_LABEL: Record<AgingBucket, string> = { '1-30': '1 a 30 dias', '31-60': '31 a 60 dias', '61-90': '61 a 90 dias', '90+': 'Mais de 90 dias' };

function agingBucketOf(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 30) return '1-30';
  if (daysOverdue <= 60) return '31-60';
  if (daysOverdue <= 90) return '61-90';
  return '90+';
}

type Enquadramento = 'all' | 'art002' | 'below';
const ENQUADRAMENTO_LABEL: Record<Enquadramento, string> = { all: 'Todos em aberto', art002: 'Só enquadrados no Art. 002', below: 'Ainda não enquadrados' };

const PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 14mm 12mm; }
  body * { visibility: hidden !important; }
  .inad-print, .inad-print * { visibility: visible !important; }
  .inad-print { display: block !important; position: absolute; left: 0; top: 0; width: 100%; color: #111 !important; background: #fff !important; font-family: Georgia, "Times New Roman", serif !important; font-size: 9pt; }
  .inad-print h1, .inad-print h2 { color: #111 !important; }
  .inad-print table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  .inad-print th, .inad-print td { border-bottom: 1px solid #ddd; padding: 3px 6px; text-align: left; color: #111 !important; }
  .inad-print th { text-transform: uppercase; font-size: 7.5pt; border-bottom: 1.5px solid #333; }
  .inad-print .num { text-align: right; }
  .inad-print tr { break-inside: avoid; page-break-inside: avoid; }
  .inad-print .sub td { font-weight: bold; border-top: 1.5px solid #333; }
}
`;

const num = (n: number) => n.toFixed(2).replace('.', ',');
const todayLabel = () => new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

export default function InadimplenciaClient({
  rows, canRenegotiate, lodgeName, crestUrl,
}: {
  rows: Row[];
  canRenegotiate: boolean;
  lodgeName: string;
  crestUrl: string | null;
}) {
  const router = useRouter();
  const art002Count = rows.filter((r) => r.art002).length;
  const [renegotiatingId, setRenegotiatingId] = useState<string | null>(null);
  const [agingFilter, setAgingFilter] = useState<AgingBucket | 'all'>('all');
  const [search, setSearch] = useState('');
  const [enquadramento, setEnquadramento] = useState<Enquadramento>('all');
  const [statusFilter, setStatusFilter] = useState('');

  const buckets: AgingBucket[] = ['1-30', '31-60', '61-90', '90+'];
  const aging = buckets.map((bucket) => {
    const bucketRows = rows.filter((r) => agingBucketOf(r.daysOverdue) === bucket);
    return { bucket, count: bucketRows.length, total: bucketRows.reduce((s, r) => s + r.totalAmount, 0) };
  });

  // Situações cadastrais presentes na lista (o filtro só oferece o que existe).
  const statusesPresent = MEMBER_STATUSES.filter((s) => rows.some((r) => r.memberStatus === s.value));

  const q = search.trim().toLocaleLowerCase('pt-BR');
  const visibleRows = rows.filter((r) =>
    (agingFilter === 'all' || agingBucketOf(r.daysOverdue) === agingFilter)
    && (enquadramento === 'all' || (enquadramento === 'art002' ? r.art002 : !r.art002))
    && (!statusFilter || r.memberStatus === statusFilter)
    && (!q || r.memberName.toLocaleLowerCase('pt-BR').includes(q)),
  );
  const visibleTotal = visibleRows.reduce((s, r) => s + r.totalAmount, 0);
  const visibleWithCharges = visibleRows.reduce((s, r) => s + r.lateCharge.total, 0);
  const hasFilter = agingFilter !== 'all' || enquadramento !== 'all' || !!statusFilter || !!q;

  function clearFilters() {
    setAgingFilter('all');
    setEnquadramento('all');
    setStatusFilter('');
    setSearch('');
  }

  const filterSummary = [
    enquadramento !== 'all' ? ENQUADRAMENTO_LABEL[enquadramento] : null,
    agingFilter !== 'all' ? AGING_LABEL[agingFilter] : null,
    statusFilter ? `situação: ${memberStatusLabel(statusFilter)}` : null,
    q ? `busca: "${search.trim()}"` : null,
  ].filter(Boolean).join(' · ');

  function exportCsv() {
    const lines = [csvRow(['Membro', 'Situação cadastral', 'Mensalidades em aberto', 'Vencimento mais antigo', 'Dias em atraso', 'Art. 002', 'Valor em aberto', 'Multa', 'Juros', 'Total com encargos'])];
    for (const r of visibleRows) {
      lines.push(csvRow([r.memberName, memberStatusLabel(r.memberStatus), String(r.openCount), formatDateOnly(r.oldestDueDate), String(r.daysOverdue), r.art002 ? 'Sim' : 'Não', num(r.totalAmount), num(r.lateCharge.fee), num(r.lateCharge.interest), num(r.lateCharge.total)]));
    }
    lines.push(csvRow(['Total', '', String(visibleRows.reduce((s, r) => s + r.openCount, 0)), '', '', '', num(visibleTotal), '', '', num(visibleWithCharges)]));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inadimplencia_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Inadimplência — Art. 002</h1>
          <p className="mt-1 text-sm text-sand-dark">
            Mensalidades em aberto por membro. O membro é enquadrado no Art. 002 quando a mensalidade em aberto mais
            antiga passa de 60 dias sem pagamento — o status é atualizado automaticamente pelo sistema.
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-white/6 bg-sigma-card p-5">
            <p className="text-sm text-sand-dark">Membros com mensalidade em aberto</p>
            <p className="mt-3 text-2xl font-semibold text-sand-light">{rows.length}</p>
          </div>
          <div className="rounded-xl border border-white/6 bg-sigma-card p-5">
            <p className="text-sm text-sand-dark">Enquadrados no Art. 002 (&gt; 60 dias)</p>
            <p className="mt-3 text-2xl font-semibold text-rose-300">{art002Count}</p>
          </div>
          <div className="rounded-xl border border-white/6 bg-sigma-card p-5">
            <p className="text-sm text-sand-dark">Total em aberto</p>
            <p className="mt-3 text-2xl font-semibold text-gold">{brl(rows.reduce((s, r) => s + r.totalAmount, 0))}</p>
          </div>
        </section>

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Faixas de atraso (aging)</h2>
          <p className="mt-1 text-xs text-sand-dark">Clique numa faixa pra filtrar a lista abaixo por tempo de atraso — ajuda a priorizar a cobrança.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {aging.map((a) => (
              <button
                key={a.bucket}
                onClick={() => setAgingFilter((cur) => (cur === a.bucket ? 'all' : a.bucket))}
                className={`rounded-lg border p-4 text-left transition-colors ${agingFilter === a.bucket ? 'border-gold/50 bg-gold/10' : 'border-white/5 bg-sigma-blue-deep/50 hover:border-white/12'}`}
              >
                <p className="text-xs text-sand-dark">{AGING_LABEL[a.bucket]}</p>
                <p className="mt-2 text-lg font-semibold text-sand-light">{a.count} membro{a.count !== 1 ? 's' : ''}</p>
                <p className="mt-0.5 text-xs tabular-nums text-sand-dark">{brl(a.total)}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-sand-light">Membros em aberto</h2>
            {rows.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => window.print()} disabled={visibleRows.length === 0}>Imprimir / PDF</Button>
                <Button type="button" variant="secondary" onClick={exportCsv} disabled={visibleRows.length === 0}>Exportar CSV</Button>
              </div>
            ) : null}
          </div>

          {rows.length > 0 ? (
            <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
              <label className="text-xs text-sand-dark">Buscar membro
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome do irmão…" className={`mt-1 ${inputClass}`} />
              </label>
              <label className="text-xs text-sand-dark">Enquadramento
                <select value={enquadramento} onChange={(e) => setEnquadramento(e.target.value as Enquadramento)} className={`mt-1 ${inputClass}`}>
                  {(Object.keys(ENQUADRAMENTO_LABEL) as Enquadramento[]).map((k) => <option key={k} value={k}>{ENQUADRAMENTO_LABEL[k]}</option>)}
                </select>
              </label>
              <label className="text-xs text-sand-dark">Situação cadastral
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`mt-1 ${inputClass}`}>
                  <option value="">Todas</option>
                  {statusesPresent.map((s) => <option key={s.value} value={s.value}>{s.short}</option>)}
                </select>
              </label>
            </div>
          ) : null}
          {hasFilter ? (
            <p className="mt-3 text-xs text-sand-dark">
              {visibleRows.length} de {rows.length} membro{rows.length !== 1 ? 's' : ''} · {brl(visibleTotal)} · {filterSummary}{' '}
              <button onClick={clearFilters} className="text-gold/80 hover:text-gold">— limpar filtros</button>
            </p>
          ) : null}

          <div className="mt-5 space-y-3">
            {rows.length === 0 ? (
              <EmptyState title="Tudo em dia. Nenhum irmão em atraso." description="Todos os membros estão em dia com a mensalidade." />
            ) : visibleRows.length === 0 ? (
              <p className="text-sm text-sand-dark">Nenhum membro com esses filtros.</p>
            ) : visibleRows.map((row) => {
              const hasCharge = row.lateCharge.fee > 0 || row.lateCharge.interest > 0;
              return (
                <div key={row.memberId} className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-sand-light">{row.memberName}</p>
                      <p className="mt-1 text-xs text-sand-dark">
                        {row.openCount} mensalidade{row.openCount > 1 ? 's' : ''} em aberto • vencimento mais antigo em{' '}
                        {formatDateOnly(row.oldestDueDate)} • situação atual: {memberStatusLabel(row.memberStatus)}
                      </p>
                      {hasCharge ? (
                        <p className="mt-1 text-xs text-amber-300/80">
                          Com multa/juros hoje: {brl(row.lateCharge.total)} (multa {brl(row.lateCharge.fee)} + juros {brl(row.lateCharge.interest)})
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-right text-xs text-sand-dark tabular-nums">{brl(row.totalAmount)}</span>
                      <Badge variant={row.art002 ? 'overdue' : 'warning'}>
                        {row.art002 ? `Art. 002 — ${row.daysOverdue} dias` : `${row.daysOverdue} dias em aberto`}
                      </Badge>
                      {canRenegotiate ? (
                        <Button
                          className="px-3! py-1! text-xs"
                          onClick={() => setRenegotiatingId(renegotiatingId === row.memberId ? null : row.memberId)}
                        >
                          Negociar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {renegotiatingId === row.memberId ? (
                    <RenegotiateForm memberId={row.memberId} onDone={() => { setRenegotiatingId(null); router.refresh(); }} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Versão de impressão: só aparece no PDF, com a lista já filtrada. */}
      <div className="inad-print hidden">
        <header className="text-center">
          {crestUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={crestUrl} alt="" className="mx-auto mb-2 h-14 w-14 object-contain" />
          ) : null}
          <h1 className="text-lg font-bold">{lodgeName}</h1>
          <h2 className="mt-0.5 text-sm">Relatório de inadimplência — mensalidades (Art. 002)</h2>
          <p className="mt-0.5 text-xs">Posição em {todayLabel()}{filterSummary ? ` · ${filterSummary}` : ''}</p>
        </header>
        <table>
          <thead>
            <tr>
              <th>Membro</th>
              <th>Situação</th>
              <th className="num">Qtd.</th>
              <th>Venc. mais antigo</th>
              <th className="num">Dias</th>
              <th>Art. 002</th>
              <th className="num">Em aberto</th>
              <th className="num">Com encargos</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => (
              <tr key={r.memberId}>
                <td>{r.memberName}</td>
                <td>{memberStatusLabel(r.memberStatus)}</td>
                <td className="num">{r.openCount}</td>
                <td>{formatDateOnly(r.oldestDueDate)}</td>
                <td className="num">{r.daysOverdue}</td>
                <td>{r.art002 ? 'Sim' : 'Não'}</td>
                <td className="num">{brl(r.totalAmount)}</td>
                <td className="num">{brl(r.lateCharge.total)}</td>
              </tr>
            ))}
            <tr className="sub">
              <td colSpan={2}>Total — {visibleRows.length} membro{visibleRows.length !== 1 ? 's' : ''}</td>
              <td className="num">{visibleRows.reduce((s, r) => s + r.openCount, 0)}</td>
              <td colSpan={3}>{visibleRows.filter((r) => r.art002).length} enquadrado(s) no Art. 002</td>
              <td className="num">{brl(visibleTotal)}</td>
              <td className="num">{brl(visibleWithCharges)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs">Enquadramento: mensalidade em aberto mais antiga vencida há mais de 60 dias. &quot;Com encargos&quot; inclui multa e juros informativos, calculados na data do relatório.</p>
      </div>
    </main>
  );
}
