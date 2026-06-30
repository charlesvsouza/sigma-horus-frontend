'use client';

import { useEffect, useState } from 'react';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (n: number) => BRL.format(n || 0);
const date = (d: string) => new Date(d).toLocaleDateString('pt-BR');

interface Closing {
  meta: { lodge: string; rite: string | null; power: string | null; from: string; to: string };
  balanco: {
    receitas: { code: string; name: string; value: number; pct: number }[];
    despesas: { code: string; name: string; value: number; pct: number }[];
    somaReceitas: number; somaDespesas: number; saldoAnterior: number; saldoAtual: number;
  };
  balancete: { code: string; name: string; category: string; type: string; saldoAnterior: number; debitos: number; creditos: number; saldoAtual: number }[];
  receitasDespesas: { mes: string; receita: number; despesa: number }[];
  livroCaixa: { data: string; nome: string; plano: string; historico: string; value: number; saldo: number }[];
  cobrancas: { items: { number: string; member: string; amount: number; dueDate: string; status: string }[]; total: number };
  saldoIrmaos: { name: string; debito: number; credito: number; saldo: number }[];
}

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 18mm 14mm; }
  body * { visibility: hidden !important; }
  .report-print, .report-print * { visibility: visible !important; }
  .report-print { position: absolute; left: 0; top: 0; width: 100%; color: #111 !important; background: #fff !important; font-family: Georgia, "Times New Roman", serif !important; font-size: 10pt; }
  .report-noprint { display: none !important; }
  .report-print h2, .report-print h3 { color: #111 !important; }
  .report-print .rcard { background: #fff !important; border: none !important; padding: 0 !important; }
  .report-print table { width: 100%; border-collapse: collapse; }
  .report-print th, .report-print td { border-bottom: 1px solid #ddd; padding: 3px 6px; }
  .report-print .report-section { break-inside: avoid; page-break-inside: avoid; }
  .report-print .pagebreak { break-before: page; page-break-before: always; }
}
`;

function Section({ title, children, breakBefore }: { title: string; children: React.ReactNode; breakBefore?: boolean }) {
  return (
    <section className={`report-section rcard rounded-xl border border-white/[6%] bg-sigma-card p-6 ${breakBefore ? 'pagebreak' : ''}`}>
      <h2 className="text-lg font-semibold text-sand-light">{title}</h2>
      <div className="mt-4 text-sm text-sand">{children}</div>
    </section>
  );
}

const TH = 'border-b border-white/10 px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-sand-dark';
const TD = 'border-b border-white/[5%] px-2 py-1.5 text-sand';

export default function FechamentoPage() {
  const [from, setFrom] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<Closing | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/reports/closing?from=${from}&to=${to}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const maxRD = data ? Math.max(1, ...data.receitasDespesas.flatMap((m) => [m.receita, m.despesa])) : 1;

  return (
    <main className="min-h-screen px-6 py-10">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Controles (não imprime) */}
        <div className="report-noprint flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-sand-light">Fechamento do veneralato</h1>
            <p className="mt-1 text-sm text-sand-dark">Relatório financeiro completo no formato livro caixa.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-sand-dark">De
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-3 py-2 text-sm text-sand-light" />
            </label>
            <label className="text-xs text-sand-dark">Até
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-3 py-2 text-sm text-sand-light" />
            </label>
            <button onClick={load} className="rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-gold/90 hover:border-gold/60 hover:text-gold">Aplicar</button>
            <button onClick={() => window.print()} className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-sigma-blue-deep hover:bg-gold-light">Salvar como PDF</button>
          </div>
        </div>

        {loading || !data ? (
          <p className="text-sm text-sand-dark">Carregando…</p>
        ) : (
          <div className="report-print space-y-6">
            {/* Cabeçalho do relatório */}
            <header className="report-section text-center">
              <h2 className="text-xl font-bold text-sand-light">{data.meta.lodge}</h2>
              <p className="text-sm text-sand-dark">Relatório Financeiro — Fechamento do Veneralato</p>
              <p className="text-xs text-sand-dark">
                Período: {date(data.meta.from)} a {date(data.meta.to)}
                {data.meta.rite ? ` · ${data.meta.rite}` : ''}{data.meta.power ? ` · ${data.meta.power}` : ''}
              </p>
            </header>

            {/* 1. Balanço Financeiro */}
            <Section title="1. Balanço Financeiro">
              <table>
                <thead><tr><th className={TH}>Cód.</th><th className={TH}>Conta</th><th className={`${TH} text-right`}>%</th><th className={`${TH} text-right`}>Valor</th></tr></thead>
                <tbody>
                  <tr><td className={`${TD} font-semibold text-emerald-300`} colSpan={4}>RECEITAS</td></tr>
                  {data.balanco.receitas.map((r) => (
                    <tr key={r.code + r.name}><td className={TD}>{r.code}</td><td className={TD}>{r.name}</td><td className={`${TD} text-right`}>{r.pct.toFixed(1)}%</td><td className={`${TD} text-right tabular-nums`}>{money(r.value)}</td></tr>
                  ))}
                  <tr><td className={`${TD} font-semibold`} colSpan={3}>Soma das Receitas</td><td className={`${TD} text-right font-semibold tabular-nums`}>{money(data.balanco.somaReceitas)}</td></tr>
                  <tr><td className={`${TD} font-semibold text-rose-300`} colSpan={4}>DESPESAS</td></tr>
                  {data.balanco.despesas.map((r) => (
                    <tr key={r.code + r.name}><td className={TD}>{r.code}</td><td className={TD}>{r.name}</td><td className={`${TD} text-right`}>{r.pct.toFixed(1)}%</td><td className={`${TD} text-right tabular-nums`}>{money(r.value)}</td></tr>
                  ))}
                  <tr><td className={`${TD} font-semibold`} colSpan={3}>Soma das Despesas</td><td className={`${TD} text-right font-semibold tabular-nums`}>{money(data.balanco.somaDespesas)}</td></tr>
                </tbody>
              </table>
              <div className="mt-3 flex justify-end gap-8 text-sm">
                <span className="text-sand-dark">Saldo Anterior: <strong className="text-sand-light tabular-nums">{money(data.balanco.saldoAnterior)}</strong></span>
                <span className="text-sand-dark">Saldo Atual: <strong className="text-gold tabular-nums">{money(data.balanco.saldoAtual)}</strong></span>
              </div>
            </Section>

            {/* 2. Balancete de Verificação */}
            <Section title="2. Balancete de Verificação por Plano de Contas" breakBefore>
              <table>
                <thead><tr><th className={TH}>Cód.</th><th className={TH}>Conta</th><th className={`${TH} text-right`}>Saldo Ant.</th><th className={`${TH} text-right`}>Débitos</th><th className={`${TH} text-right`}>Créditos</th><th className={`${TH} text-right`}>Saldo Atual</th></tr></thead>
                <tbody>
                  {data.balancete.map((b) => (
                    <tr key={b.code + b.name}>
                      <td className={TD}>{b.code}</td><td className={TD}>{b.name}</td>
                      <td className={`${TD} text-right tabular-nums`}>{money(b.saldoAnterior)}</td>
                      <td className={`${TD} text-right tabular-nums`}>{b.debitos ? money(b.debitos) : '—'}</td>
                      <td className={`${TD} text-right tabular-nums`}>{b.creditos ? money(b.creditos) : '—'}</td>
                      <td className={`${TD} text-right tabular-nums`}>{money(b.saldoAtual)}</td>
                    </tr>
                  ))}
                  {data.balancete.length === 0 ? <tr><td className={TD} colSpan={6}>Sem movimentação no período.</td></tr> : null}
                </tbody>
              </table>
            </Section>

            {/* 3. Receitas × Despesas */}
            <Section title="3. Receitas × Despesas (mensal)">
              {data.receitasDespesas.length === 0 ? <p className="text-sand-dark">Sem dados no período.</p> : (
                <div className="space-y-3">
                  {data.receitasDespesas.map((m) => (
                    <div key={m.mes}>
                      <div className="flex justify-between text-xs text-sand-dark"><span>{m.mes}</span><span>R: {money(m.receita)} · D: {money(m.despesa)}</span></div>
                      <div className="mt-1 space-y-1">
                        <div className="h-3 rounded bg-emerald-500/70" style={{ width: `${(m.receita / maxRD) * 100}%` }} />
                        <div className="h-3 rounded bg-rose-500/70" style={{ width: `${(m.despesa / maxRD) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* 4. Livro Caixa */}
            <Section title="4. Livro Caixa / Extrato" breakBefore>
              <table>
                <thead><tr><th className={TH}>Data</th><th className={TH}>Nome</th><th className={TH}>Plano</th><th className={TH}>Histórico</th><th className={`${TH} text-right`}>Valor</th><th className={`${TH} text-right`}>Saldo</th></tr></thead>
                <tbody>
                  <tr><td className={`${TD} text-sand-dark`} colSpan={5}>Saldo Anterior</td><td className={`${TD} text-right tabular-nums`}>{money(data.balanco.saldoAnterior)}</td></tr>
                  {data.livroCaixa.map((l, i) => (
                    <tr key={i}>
                      <td className={TD}>{date(l.data)}</td><td className={TD}>{l.nome}</td><td className={TD}>{l.plano}</td><td className={TD}>{l.historico}</td>
                      <td className={`${TD} text-right tabular-nums ${l.value < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{money(l.value)}</td>
                      <td className={`${TD} text-right tabular-nums`}>{money(l.saldo)}</td>
                    </tr>
                  ))}
                  {data.livroCaixa.length === 0 ? <tr><td className={TD} colSpan={6}>Sem lançamentos no período.</td></tr> : null}
                </tbody>
              </table>
            </Section>

            {/* 5. Cobranças */}
            <Section title="5. Cobranças em Geral" breakBefore>
              <table>
                <thead><tr><th className={TH}>Nº</th><th className={TH}>Destinatário</th><th className={`${TH} text-right`}>Valor</th><th className={TH}>Vencimento</th><th className={TH}>Situação</th></tr></thead>
                <tbody>
                  {data.cobrancas.items.map((c, i) => (
                    <tr key={i}><td className={TD}>{c.number}</td><td className={TD}>{c.member}</td><td className={`${TD} text-right tabular-nums`}>{money(c.amount)}</td><td className={TD}>{date(c.dueDate)}</td><td className={TD}>{c.status}</td></tr>
                  ))}
                  {data.cobrancas.items.length === 0 ? <tr><td className={TD} colSpan={5}>Sem cobranças no período.</td></tr> : null}
                </tbody>
              </table>
              <p className="mt-2 text-right text-sm text-sand-dark">Total: <strong className="text-sand-light tabular-nums">{money(data.cobrancas.total)}</strong></p>
            </Section>

            {/* 6. Saldo dos Irmãos */}
            <Section title="6. Saldo dos Irmãos" breakBefore>
              <table>
                <thead><tr><th className={TH}>Irmão</th><th className={`${TH} text-right`}>Débito</th><th className={`${TH} text-right`}>Crédito</th><th className={`${TH} text-right`}>Saldo</th></tr></thead>
                <tbody>
                  {data.saldoIrmaos.map((s, i) => (
                    <tr key={i}><td className={TD}>{s.name}</td><td className={`${TD} text-right tabular-nums`}>{money(s.debito)}</td><td className={`${TD} text-right tabular-nums`}>{money(s.credito)}</td><td className={`${TD} text-right tabular-nums ${s.saldo > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{money(s.saldo)}</td></tr>
                  ))}
                  {data.saldoIrmaos.length === 0 ? <tr><td className={TD} colSpan={4}>Sem irmãos com movimentação.</td></tr> : null}
                </tbody>
              </table>
            </Section>
          </div>
        )}
      </div>
    </main>
  );
}
