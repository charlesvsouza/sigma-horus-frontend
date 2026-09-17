'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EmptyState, inputClass } from '@/components/ui';
import { brl } from '@/lib/currency';

interface AccountOption {
  id: string;
  name: string;
  kind: string;
  bankName: string | null;
  active: boolean;
  isInvestment: boolean;
}

interface Movement {
  date: string;
  kind: 'payment_in' | 'payment_out' | 'transfer_in' | 'transfer_out';
  description: string;
  reference: string | null;
  amount: number;
  signedAmount: number;
  balance: number;
}

interface Statement {
  openingBalance: number;
  movements: Movement[];
  closingBalance: number;
  totalIn: number;
  totalOut: number;
}

const KIND_LABEL: Record<Movement['kind'], string> = {
  payment_in: 'Entrada',
  payment_out: 'Saída',
  transfer_in: 'Transferência recebida',
  transfer_out: 'Transferência enviada',
};

const FA_KIND_LABEL: Record<string, string> = { bank: 'Banco', cash: 'Caixa' };

const PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 16mm 14mm; }
  body * { visibility: hidden !important; }
  .extrato-print, .extrato-print * { visibility: visible !important; }
  .extrato-print { position: absolute; left: 0; top: 0; width: 100%; color: #111 !important; background: #fff !important; font-family: Georgia, "Times New Roman", serif !important; font-size: 9.5pt; }
  .extrato-noprint { display: none !important; }
  .extrato-print h1, .extrato-print h2 { color: #111 !important; }
  .extrato-print table { width: 100%; border-collapse: collapse; }
  .extrato-print th, .extrato-print td { border-bottom: 1px solid #ddd; padding: 3px 6px; text-align: left; }
  .extrato-print th { text-transform: uppercase; font-size: 8pt; border-bottom: 1.5px solid #333; }
  .extrato-print .num { text-align: right; }
  .extrato-print tr { break-inside: avoid; page-break-inside: avoid; }
}
`;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function ExtratosClient({
  lodgeName,
  crestUrl,
  accounts,
  selectedAccountId,
  from,
  to,
  statement,
}: {
  lodgeName: string;
  crestUrl: string | null;
  accounts: AccountOption[];
  selectedAccountId: string | null;
  from: string;
  to: string;
  statement: Statement | null;
}) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(selectedAccountId ?? '');
  const [fromVal, setFromVal] = useState(from);
  const [toVal, setToVal] = useState(to);

  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;

  function applyWith(nextAccountId: string, nextFrom: string, nextTo: string) {
    const params = new URLSearchParams();
    if (nextAccountId) params.set('accountId', nextAccountId);
    if (nextFrom) params.set('from', nextFrom);
    if (nextTo) params.set('to', nextTo);
    router.push(`/dashboard/extratos?${params.toString()}`);
  }

  function apply() {
    applyWith(accountId, fromVal, toVal);
  }

  function shortcut(kind: 'mes-atual' | 'mes-anterior' | 'ano-atual' | 'abertura') {
    const now = new Date();
    let f: Date, t: Date;
    if (kind === 'mes-atual') {
      f = new Date(now.getFullYear(), now.getMonth(), 1);
      t = now;
    } else if (kind === 'mes-anterior') {
      f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      t = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (kind === 'ano-atual') {
      f = new Date(now.getFullYear(), 0, 1);
      t = now;
    } else {
      f = new Date(2000, 0, 1);
      t = now;
    }
    const fStr = f.toISOString().slice(0, 10);
    const tStr = t.toISOString().slice(0, 10);
    setFromVal(fStr);
    setToVal(tStr);
    applyWith(accountId, fStr, tStr);
  }

  const xlsHref = accountId ? `/api/financial-accounts/${accountId}/statement/xlsx?from=${fromVal}&to=${toVal}` : '#';

  return (
    <main className="min-h-screen px-6 py-12">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="extrato-noprint">
          <h1 className="font-display text-2xl font-bold text-sand-light">Extratos de contas</h1>
          <p className="mt-1 text-sm text-sand-dark">Movimentação completa de uma conta bancária ou do Caixa, com saldo inicial e final do período.</p>
        </div>

        {accounts.length === 0 ? (
          <EmptyState title="Nenhuma conta bancária ou Caixa cadastrada ainda." description="Cadastre pelo menos uma em Cadastros financeiros para ver o extrato." />
        ) : (
          <>
            <section className="extrato-noprint rounded-xl border border-white/6 bg-sigma-card p-6">
              <div className="grid gap-4 md:grid-cols-[1.4fr_1fr_1fr_auto]">
                <label className="text-xs text-sand-dark">Conta
                  <select
                    value={accountId}
                    onChange={(e) => { setAccountId(e.target.value); applyWith(e.target.value, fromVal, toVal); }}
                    className={`mt-1 ${inputClass}`}
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}{a.bankName ? ` — ${a.bankName}` : ''}{a.isInvestment ? ' (Investimento)' : ''}{!a.active ? ' — inativa' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-sand-dark">De
                  <input type="date" value={fromVal} onChange={(e) => setFromVal(e.target.value)} className={`mt-1 ${inputClass}`} />
                </label>
                <label className="text-xs text-sand-dark">Até
                  <input type="date" value={toVal} onChange={(e) => setToVal(e.target.value)} className={`mt-1 ${inputClass}`} />
                </label>
                <div className="flex items-end">
                  <button onClick={apply} className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">
                    Aplicar
                  </button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => shortcut('mes-atual')} className="rounded-full border border-white/8 px-3.5 py-1.5 text-xs text-sand-dark transition-colors hover:border-white/20 hover:text-sand-light">Mês atual</button>
                <button onClick={() => shortcut('mes-anterior')} className="rounded-full border border-white/8 px-3.5 py-1.5 text-xs text-sand-dark transition-colors hover:border-white/20 hover:text-sand-light">Mês anterior</button>
                <button onClick={() => shortcut('ano-atual')} className="rounded-full border border-white/8 px-3.5 py-1.5 text-xs text-sand-dark transition-colors hover:border-white/20 hover:text-sand-light">Ano atual</button>
                <button onClick={() => shortcut('abertura')} className="rounded-full border border-white/8 px-3.5 py-1.5 text-xs text-sand-dark transition-colors hover:border-white/20 hover:text-sand-light">Desde a abertura</button>
              </div>
            </section>

            {statement && selectedAccount ? (
              <>
                <section className="extrato-noprint grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-white/6 bg-sigma-card p-5">
                    <p className="text-xs uppercase tracking-[0.15em] text-sand-dark">Saldo inicial</p>
                    <p className="mt-2 text-xl font-semibold text-sand-light">{brl(statement.openingBalance)}</p>
                  </div>
                  <div className="rounded-xl border border-white/6 bg-sigma-card p-5">
                    <p className="text-xs uppercase tracking-[0.15em] text-sand-dark">Entradas no período</p>
                    <p className="mt-2 text-xl font-semibold text-emerald-300">{brl(statement.totalIn)}</p>
                  </div>
                  <div className="rounded-xl border border-white/6 bg-sigma-card p-5">
                    <p className="text-xs uppercase tracking-[0.15em] text-sand-dark">Saídas no período</p>
                    <p className="mt-2 text-xl font-semibold text-rose-300">{brl(statement.totalOut)}</p>
                  </div>
                  <div className="rounded-xl border border-white/6 bg-sigma-card p-5">
                    <p className="text-xs uppercase tracking-[0.15em] text-sand-dark">Saldo final</p>
                    <p className="mt-2 text-xl font-semibold text-gold">{brl(statement.closingBalance)}</p>
                  </div>
                </section>

                <div className="extrato-noprint flex flex-wrap gap-3">
                  <button onClick={() => window.print()} className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">
                    Salvar como PDF
                  </button>
                  <a href={xlsHref} className="rounded-full border border-gold/40 px-5 py-2.5 text-sm font-medium text-gold/90 transition-colors hover:border-gold/60 hover:text-gold">
                    Baixar XLS
                  </a>
                </div>

                <section className="rounded-xl border border-white/6 bg-sigma-card p-6 extrato-print">
                  <header className="mb-5 text-center">
                    {crestUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={crestUrl} alt="" className="mx-auto mb-2 h-14 w-14 object-contain" />
                    ) : null}
                    <h1 className="text-lg font-bold text-sand-light">{lodgeName}</h1>
                    <h2 className="mt-0.5 text-sm text-sand-dark">
                      Extrato — {selectedAccount.name}{selectedAccount.bankName ? ` (${selectedAccount.bankName})` : ''} · {FA_KIND_LABEL[selectedAccount.kind] ?? selectedAccount.kind}
                    </h2>
                    <p className="mt-0.5 text-xs text-sand-dark">Período: {fmtDate(`${fromVal}T00:00:00`)} a {fmtDate(`${toVal}T00:00:00`)}</p>
                  </header>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-sand-dark/70">
                          <th className="border-b border-white/10 px-2 py-2">Data</th>
                          <th className="border-b border-white/10 px-2 py-2">Histórico</th>
                          <th className="border-b border-white/10 px-2 py-2">Referência</th>
                          <th className="border-b border-white/10 px-2 py-2">Tipo</th>
                          <th className="border-b border-white/10 px-2 py-2 text-right num">Valor</th>
                          <th className="border-b border-white/10 px-2 py-2 text-right num">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border-b border-white/5 px-2 py-2 text-sand-dark" colSpan={5}>Saldo inicial do período</td>
                          <td className="border-b border-white/5 px-2 py-2 text-right num font-medium text-sand-light">{brl(statement.openingBalance)}</td>
                        </tr>
                        {statement.movements.length === 0 ? (
                          <tr><td className="px-2 py-4 text-sand-dark" colSpan={6}>Nenhuma movimentação neste período.</td></tr>
                        ) : statement.movements.map((m, i) => (
                          <tr key={i}>
                            <td className="border-b border-white/5 px-2 py-2 text-sand">{fmtDate(m.date)}</td>
                            <td className="border-b border-white/5 px-2 py-2 text-sand">{m.description}</td>
                            <td className="border-b border-white/5 px-2 py-2 text-sand-dark">{m.reference ?? '—'}</td>
                            <td className="border-b border-white/5 px-2 py-2 text-sand-dark">{KIND_LABEL[m.kind]}</td>
                            <td className={`border-b border-white/5 px-2 py-2 text-right num tabular-nums ${m.signedAmount >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                              {m.signedAmount >= 0 ? '+' : '−'}{brl(m.amount)}
                            </td>
                            <td className="border-b border-white/5 px-2 py-2 text-right num tabular-nums text-sand-light">{brl(m.balance)}</td>
                          </tr>
                        ))}
                        <tr>
                          <td className="px-2 py-2 font-semibold text-sand-light" colSpan={5}>Saldo final do período</td>
                          <td className="px-2 py-2 text-right num font-semibold text-gold">{brl(statement.closingBalance)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : (
              <EmptyState title="Sem dados para exibir." description="Escolha uma conta para ver o extrato." />
            )}
          </>
        )}
      </div>
    </main>
  );
}
