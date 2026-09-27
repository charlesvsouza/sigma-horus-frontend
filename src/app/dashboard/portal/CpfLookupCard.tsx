'use client';

import { useEffect, useState } from 'react';
import { Alert, Badge, Button, inputClass } from '@/components/ui';
import { brl } from '@/lib/currency';
import { daysOverdueBR, formatDateOnly } from '@/lib/date-only';
import { maskCPF } from '@/lib/masks';

// "Lançamentos no meu CPF": para o login sem cadastro de membro ligado (o Administrador —
// papéis não se confundem). Só consulta; quem paga é o login de obreiro. O CPF fica
// lembrado só neste navegador, por conveniência.

const STORAGE_KEY = 'portal:cpf-lookup';

interface LookupAccount {
  id: string;
  title: string;
  type: string;
  amount: number;
  dueDate: string;
  effectiveStatus: 'paid' | 'overdue' | 'pending';
  balance: number;
  chartAccount?: { name: string; category: string | null } | null;
  payments: { id: string; amount: number }[];
}

const STATUS_LABEL = { paid: 'Pago', overdue: 'Vencido', pending: 'Em aberto' } as const;

export function CpfLookupCard() {
  const [cpf, setCpf] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<{ member: { name: string }; accounts: LookupAccount[] } | null>(null);

  async function lookup(value: string) {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/portal/by-cpf?cpf=${encodeURIComponent(value)}`);
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setData(null); setError(body.error ?? 'Não foi possível consultar.'); return; }
    setData(body);
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* navegador sem storage: só não lembra */ }
  }

  useEffect(() => {
    let saved = '';
    try { saved = localStorage.getItem(STORAGE_KEY) ?? ''; } catch { saved = ''; }
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCpf(maskCPF(saved));
      void lookup(saved);
    }
  }, []);

  function forget() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setCpf('');
    setData(null);
    setError('');
  }

  const open = data?.accounts.filter((a) => a.type === 'RECEIVABLE' && a.effectiveStatus !== 'paid') ?? [];
  const totalOpen = open.reduce((s, a) => s + a.balance, 0);

  return (
    <section className="rounded-xl border border-white/6 bg-sigma-card p-6" aria-labelledby="cpf-lookup-title">
      <h2 id="cpf-lookup-title" className="text-base font-semibold text-sand-light">Lançamentos no meu CPF</h2>
      <p className="mt-1 text-sm text-sand-dark">
        Este login não está ligado a um cadastro de membro (os papéis não se confundem). Informe o seu CPF para
        consultar o que está lançado para você. Para pagar pelo portal, entre com o seu login de obreiro.
      </p>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => { e.preventDefault(); void lookup(cpf); }}
      >
        <input
          value={cpf}
          onChange={(e) => setCpf(maskCPF(e.target.value))}
          inputMode="numeric"
          placeholder="000.000.000-00"
          aria-label="CPF"
          className={`${inputClass} sm:max-w-xs`}
        />
        <Button type="submit" size="sm" disabled={busy || cpf.replace(/\D/g, '').length !== 11}>{busy ? 'Consultando…' : 'Consultar'}</Button>
        {data ? <Button type="button" size="sm" variant="ghost" onClick={forget}>Esquecer CPF</Button> : null}
      </form>

      {error ? <Alert intent="danger" className="mt-4">{error}</Alert> : null}

      {data ? (
        <div className="mt-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-sm text-sand">Cadastro: <strong className="text-sand-light">{data.member.name}</strong></p>
            <p className="text-right">
              <span className="block text-xs uppercase tracking-[0.25em] text-gold">Em aberto</span>
              <span className="text-xl font-semibold text-sand-light">{brl(totalOpen)}</span>
            </p>
          </div>
          {data.accounts.length === 0 ? (
            <p className="mt-4 text-sm text-sand-dark">Nenhum lançamento neste cadastro.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.accounts.map((a) => {
                const days = a.effectiveStatus === 'overdue' ? daysOverdueBR(a.dueDate) : 0;
                return (
                  <li key={a.id} className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-4 text-sm text-sand">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sand-light">{a.title}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sand-dark">
                          <span>{a.type === 'RECEIVABLE' ? 'Devo' : 'A Loja me deve'} • {formatDateOnly(a.dueDate)}</span>
                          <Badge variant={a.effectiveStatus}>
                            {a.effectiveStatus === 'overdue' ? `Vencido há ${days} dia${days !== 1 ? 's' : ''}` : STATUS_LABEL[a.effectiveStatus]}
                          </Badge>
                        </p>
                        {a.chartAccount ? (
                          <p className="mt-0.5 text-xs text-gold/80">{a.chartAccount.category ? `${a.chartAccount.category} — ` : ''}{a.chartAccount.name}</p>
                        ) : null}
                      </div>
                      <p className="font-semibold text-sand-light">{brl(a.effectiveStatus === 'paid' ? a.amount : a.balance)}</p>
                    </div>
                    {a.payments.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-3">
                        {a.payments.map((p, i) => (
                          <a key={p.id} href={`/dashboard/pagamentos/${p.id}/recibo`} target="_blank" rel="noreferrer" className="text-xs text-gold hover:text-gold-light">
                            Recibo{a.payments.length > 1 ? ` ${i + 1}` : ''} · {brl(p.amount)}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
