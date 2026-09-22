'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, EmptyState, inputClass } from '@/components/ui';
import { brl } from '@/lib/currency';
import { csvRow } from '@/lib/csv';

interface ChartOption { id: string; code: string; name: string; type: string; group: string; fund: 'tronco' | 'donations' | null }
interface LedgerRow { id: string; date: string; description: string; person: string | null; bank: string | null; method: string | null; in: number; out: number; balance: number; status: 'paid' | 'open' }
interface LedgerGroup { key: string; code: string; name: string; category: string; opening: number; totalIn: number; totalOut: number; closing: number; openIn: number; openOut: number; rows: LedgerRow[] }
interface Ledger { totals: { opening: number; in: number; out: number; closing: number; openIn: number; openOut: number }; groups: LedgerGroup[] }

const PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 14mm 12mm; }
  body * { visibility: hidden !important; }
  .razao-print, .razao-print * { visibility: visible !important; }
  .razao-print { position: absolute; left: 0; top: 0; width: 100%; color: #111 !important; background: #fff !important; font-family: Georgia, "Times New Roman", serif !important; font-size: 9pt; }
  .razao-noprint { display: none !important; }
  .razao-print h1, .razao-print h2, .razao-print h3 { color: #111 !important; }
  .razao-print table { width: 100%; border-collapse: collapse; }
  .razao-print th, .razao-print td { border-bottom: 1px solid #ddd; padding: 3px 6px; text-align: left; color: #111 !important; }
  .razao-print th { text-transform: uppercase; font-size: 7.5pt; border-bottom: 1.5px solid #333; }
  .razao-print .num { text-align: right; }
  .razao-print tr { break-inside: avoid; page-break-inside: avoid; }
  .razao-print .group { break-inside: auto; margin-bottom: 14px; }
  .razao-print .sub td { font-weight: bold; border-top: 1.5px solid #333; }
}
`;

const METHOD_LABEL: Record<string, string> = {
  manual: 'Manual', cash: 'Dinheiro', pix: 'Pix', transfer: 'Transferência', asaas: 'Asaas', donation: 'Doação', fund: 'Custeio (Tronco)', boleto: 'Boleto', card: 'Cartão',
};
const FUND_LABEL = { tronco: 'Tronco', donations: 'Doações' } as const;

const TH = 'border-b border-white/10 px-2 py-2 text-left text-xs uppercase tracking-wide text-sand-dark/70';
const TD = 'border-b border-white/5 px-2 py-2';

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const fmtInput = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
const num = (n: number) => n.toFixed(2).replace('.', ',');

export default function CategoriasClient({
  lodgeName, crestUrl, from, to, direction, includeOpen, bankId, selectedIds, charts, banks, ledger,
}: {
  lodgeName: string;
  crestUrl: string | null;
  from: string;
  to: string;
  direction: 'all' | 'in' | 'out';
  includeOpen: boolean;
  bankId: string | null;
  selectedIds: string[];
  charts: ChartOption[];
  banks: { id: string; name: string; active: boolean }[];
  ledger: Ledger;
}) {
  const router = useRouter();
  const [fromVal, setFromVal] = useState(from);
  const [toVal, setToVal] = useState(to);
  const [dirVal, setDirVal] = useState(direction);
  const [openVal, setOpenVal] = useState(includeOpen);
  const [bankVal, setBankVal] = useState(bankId ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));
  const [search, setSearch] = useState('');

  const showBalance = direction === 'all';
  const visibleCharts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? charts.filter((c) => `${c.code} ${c.name}`.toLowerCase().includes(q)) : charts;
  }, [charts, search]);
  const grouped = useMemo(() => {
    const map = new Map<string, ChartOption[]>();
    for (const c of visibleCharts) map.set(c.group, [...(map.get(c.group) ?? []), c]);
    return [...map.entries()];
  }, [visibleCharts]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const pickFund = (fund: 'tronco' | 'donations') => setSelected(new Set(charts.filter((c) => c.fund === fund).map((c) => c.id)));

  function go(over: { from?: string; to?: string; cat?: string[] } = {}) {
    const params = new URLSearchParams();
    params.set('from', over.from ?? fromVal);
    params.set('to', over.to ?? toVal);
    const cats = over.cat ?? [...selected];
    if (cats.length) params.set('cat', cats.join(','));
    if (dirVal !== 'all') params.set('dir', dirVal);
    if (openVal) params.set('open', '1');
    if (bankVal) params.set('bank', bankVal);
    router.push(`/dashboard/relatorios/categorias?${params.toString()}`);
  }

  function shortcut(k: 'mes' | 'ano' | 'tudo') {
    const now = new Date();
    const y = now.getFullYear();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const [f, t] = k === 'mes' ? [iso(new Date(Date.UTC(y, now.getMonth(), 1))), iso(now)] : k === 'ano' ? [`${y}-01-01`, iso(now)] : ['2000-01-01', iso(now)];
    setFromVal(f);
    setToVal(t);
    go({ from: f, to: t });
  }

  function exportCsv() {
    const lines: string[] = [csvRow(['Categoria', 'Data', 'Status', 'Histórico', 'Pessoa', 'Conta/Caixa', 'Forma', 'Entrada', 'Saída', ...(showBalance ? ['Saldo'] : [])])];
    for (const g of ledger.groups) {
      const label = `${g.code} ${g.name}`;
      if (showBalance) lines.push(csvRow([label, '', '', 'Saldo anterior', '', '', '', '', '', num(g.opening)]));
      for (const r of g.rows) {
        lines.push(csvRow([label, fmtDay(r.date), r.status === 'open' ? 'Em aberto' : 'Pago', r.description, r.person ?? '', r.bank ?? '', r.method ? (METHOD_LABEL[r.method] ?? r.method) : '', r.in ? num(r.in) : '', r.out ? num(r.out) : '', ...(showBalance ? [r.status === 'open' ? '' : num(r.balance)] : [])]));
      }
      lines.push(csvRow([label, '', '', 'Total da categoria (pago)', '', '', '', num(g.totalIn), num(g.totalOut), ...(showBalance ? [num(g.closing)] : [])]));
      if (g.openIn > 0 || g.openOut > 0) {
        lines.push(csvRow([label, '', '', 'Total em aberto', '', '', '', g.openIn ? num(g.openIn) : '', g.openOut ? num(g.openOut) : '', ...(showBalance ? [''] : [])]));
      }
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `razao-por-categoria_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const scope = selectedIds.length === 0 ? 'Todas as categorias' : `${selectedIds.length} categoria(s)`;
  const bankName = bankId ? banks.find((b) => b.id === bankId)?.name : null;

  return (
    <main className="min-h-screen px-6 py-12">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="razao-noprint">
          <h1 className="font-display text-2xl font-bold text-sand-light">Razão por categoria</h1>
          <p className="mt-1 text-sm text-sand-dark">Tudo o que foi lançado em cada categoria do plano de contas, lançamento a lançamento, com o banco ou caixa por onde o dinheiro passou. O Tronco e as Doações são categorias como as outras.</p>
        </div>

        <section className="razao-noprint space-y-4 rounded-xl border border-white/6 bg-sigma-card p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <label className="text-xs text-sand-dark">De
              <input type="date" value={fromVal} onChange={(e) => setFromVal(e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-xs text-sand-dark">Até
              <input type="date" value={toVal} onChange={(e) => setToVal(e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-xs text-sand-dark">Conta ou caixa
              <select value={bankVal} onChange={(e) => setBankVal(e.target.value)} className={`mt-1 ${inputClass}`}>
                <option value="">Todas</option>
                {banks.map((b) => <option key={b.id} value={b.id}>{b.name}{!b.active ? ' (inativa)' : ''}</option>)}
              </select>
            </label>
            <label className="text-xs text-sand-dark">Movimento
              <select value={dirVal} onChange={(e) => setDirVal(e.target.value as 'all' | 'in' | 'out')} className={`mt-1 ${inputClass}`}>
                <option value="all">Entradas e saídas</option>
                <option value="in">Só entradas</option>
                <option value="out">Só saídas</option>
              </select>
            </label>
            <div className="flex items-end">
              <Button type="button" variant="secondary" onClick={() => go()}>Aplicar</Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {([['mes', 'Mês atual'], ['ano', 'Ano atual'], ['tudo', 'Desde o início']] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => shortcut(k)} className="rounded-full border border-white/8 px-3.5 py-1.5 text-xs text-sand-dark transition-colors hover:border-white/20 hover:text-sand-light">{label}</button>
            ))}
            <label className="ml-2 flex items-center gap-2 text-xs text-sand-dark">
              <input type="checkbox" checked={openVal} onChange={(e) => setOpenVal(e.target.checked)} className="accent-gold" />
              Incluir lançamentos em aberto (pendentes)
            </label>
          </div>
          {openVal ? <p className="text-xs text-sand-dark/80">Cobranças ainda não pagas aparecem na lista com a etiqueta "Em aberto", mas não entram no saldo — só o que já foi recebido/pago de fato conta pra ele.</p> : null}

          <details className="rounded-lg border border-white/6 bg-sigma-blue-deep/40 p-4" open={selected.size > 0}>
            <summary className="cursor-pointer text-sm font-medium text-sand-light">
              Categorias {selected.size > 0 ? `(${selected.size} marcada${selected.size > 1 ? 's' : ''})` : '(nenhuma marcada = todas)'}
            </summary>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => pickFund('tronco')} className="rounded-full border border-gold/40 px-3 py-1 text-xs text-gold/90 hover:border-gold/60 hover:text-gold">Só o Tronco</button>
              <button type="button" onClick={() => pickFund('donations')} className="rounded-full border border-gold/40 px-3 py-1 text-xs text-gold/90 hover:border-gold/60 hover:text-gold">Só Doações e Contribuições</button>
              <button type="button" onClick={() => setSelected(new Set())} className="rounded-full border border-white/8 px-3 py-1 text-xs text-sand-dark hover:text-sand-light">Limpar (todas)</button>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar categoria…" aria-label="Buscar categoria" className={`ml-auto w-56 ${inputClass}`} />
            </div>
            <div className="mt-3 grid gap-x-6 gap-y-4 md:grid-cols-2">
              {grouped.map(([group, items]) => (
                <fieldset key={group}>
                  <legend className="text-xs font-semibold uppercase tracking-wide text-sand-dark/80">{group}</legend>
                  <ul className="mt-1 space-y-1">
                    {items.map((c) => (
                      <li key={c.id}>
                        <label className="flex items-center gap-2 text-sm text-sand">
                          <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="accent-gold" />
                          <span className="text-sand-dark">{c.code}</span> {c.name}
                          {c.fund ? <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[0.65rem] font-medium text-violet-300">{FUND_LABEL[c.fund]}</span> : null}
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              ))}
              {grouped.length === 0 ? <p className="text-sm text-sand-dark">Nenhuma categoria encontrada.</p> : null}
            </div>
          </details>
        </section>

        {ledger.groups.length === 0 ? (
          <EmptyState title="Nenhum lançamento nas categorias e no período escolhidos." description="Ajuste o período, a conta ou as categorias." />
        ) : (
          <>
            <div className="razao-noprint flex flex-wrap gap-3">
              <Button type="button" onClick={() => window.print()}>Salvar como PDF</Button>
              <Button type="button" variant="secondary" onClick={exportCsv}>Exportar CSV</Button>
            </div>

            <div className="razao-print space-y-6">
              <header className="text-center">
                {crestUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={crestUrl} alt="" className="mx-auto mb-2 h-14 w-14 object-contain" />
                ) : null}
                <h1 className="text-lg font-bold text-sand-light">{lodgeName}</h1>
                <h2 className="mt-0.5 text-sm text-sand-dark">Razão por categoria</h2>
                <p className="mt-0.5 text-xs text-sand-dark">
                  Período: {fmtInput(from)} a {fmtInput(to)} · {scope}{bankName ? ` · ${bankName}` : ''}{direction === 'in' ? ' · só entradas' : direction === 'out' ? ' · só saídas' : ''}{openVal ? ' · inclui em aberto' : ''}
                </p>
              </header>

              {ledger.groups.map((g) => (
                <section key={g.key} className="group rounded-xl border border-white/6 bg-sigma-card p-5">
                  <h3 className="text-base font-semibold text-sand-light"><span className="text-sand-dark">{g.code}</span> · {g.name} <span className="ml-1 text-xs font-normal text-sand-dark">({g.category})</span></h3>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className={TH}>Data</th>
                          <th className={TH}>Histórico</th>
                          <th className={TH}>Pessoa</th>
                          <th className={TH}>Conta / caixa</th>
                          <th className={TH}>Forma</th>
                          <th className={`${TH} num text-right`}>Entrada</th>
                          <th className={`${TH} num text-right`}>Saída</th>
                          {showBalance ? <th className={`${TH} num text-right`}>Saldo</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {showBalance ? (
                          <tr>
                            <td className={`${TD} text-sand-dark`} colSpan={7}>Saldo anterior ao período</td>
                            <td className={`${TD} num text-right tabular-nums text-sand-light`}>{brl(g.opening)}</td>
                          </tr>
                        ) : null}
                        {g.rows.map((r) => (
                          <tr key={r.id} className={r.status === 'open' ? 'opacity-70' : undefined}>
                            <td className={`${TD} whitespace-nowrap text-sand`}>{fmtDay(r.date)}</td>
                            <td className={`${TD} text-sand`}>
                              {r.description}
                              {r.status === 'open' ? <span className="ml-2 rounded-full bg-gold/10 px-2 py-0.5 text-[0.65rem] font-medium text-gold">Em aberto</span> : null}
                            </td>
                            <td className={`${TD} text-sand-dark`}>{r.person ?? '—'}</td>
                            <td className={`${TD} text-sand-dark`}>{r.bank ?? '—'}</td>
                            <td className={`${TD} text-sand-dark`}>{r.method ? (METHOD_LABEL[r.method] ?? r.method) : '—'}</td>
                            <td className={`${TD} num text-right tabular-nums text-emerald-300`}>{r.in ? brl(r.in) : ''}</td>
                            <td className={`${TD} num text-right tabular-nums text-rose-300`}>{r.out ? brl(r.out) : ''}</td>
                            {showBalance ? <td className={`${TD} num text-right tabular-nums text-sand-light`}>{r.status === 'open' ? '—' : brl(r.balance)}</td> : null}
                          </tr>
                        ))}
                        <tr className="sub">
                          <td className="px-2 py-2 font-semibold text-sand-light" colSpan={5}>Total da categoria (pago)</td>
                          <td className="px-2 py-2 text-right num font-semibold tabular-nums text-emerald-300">{brl(g.totalIn)}</td>
                          <td className="px-2 py-2 text-right num font-semibold tabular-nums text-rose-300">{brl(g.totalOut)}</td>
                          {showBalance ? <td className="px-2 py-2 text-right num font-semibold tabular-nums text-gold">{brl(g.closing)}</td> : null}
                        </tr>
                        {g.openIn > 0 || g.openOut > 0 ? (
                          <tr>
                            <td className="px-2 py-2 text-sand-dark" colSpan={5}>Em aberto nessa categoria (não conta no saldo)</td>
                            <td className="px-2 py-2 text-right num tabular-nums text-emerald-300/70">{g.openIn ? brl(g.openIn) : ''}</td>
                            <td className="px-2 py-2 text-right num tabular-nums text-rose-300/70">{g.openOut ? brl(g.openOut) : ''}</td>
                            {showBalance ? <td className="px-2 py-2" /> : null}
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}

              <section className="rounded-xl border border-white/6 bg-sigma-card p-5">
                <h3 className="text-base font-semibold text-sand-light">Total geral</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  {([
                    ['Saldo anterior', ledger.totals.opening, 'text-sand-light', showBalance],
                    ['Entradas', ledger.totals.in, 'text-emerald-300', true],
                    ['Saídas', ledger.totals.out, 'text-rose-300', true],
                    ['Saldo final', ledger.totals.closing, 'text-gold', showBalance],
                    ['Em aberto a receber', ledger.totals.openIn, 'text-emerald-300/70', ledger.totals.openIn > 0],
                    ['Em aberto a pagar', ledger.totals.openOut, 'text-rose-300/70', ledger.totals.openOut > 0],
                  ] as const).filter((x) => x[3]).map(([label, value, tone]) => (
                    <div key={label}>
                      <p className="text-xs uppercase tracking-[0.15em] text-sand-dark">{label}</p>
                      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone}`}>{brl(value)}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
