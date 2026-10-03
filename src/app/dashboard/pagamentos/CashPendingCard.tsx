'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, inputClass } from '@/components/ui';
import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';

export interface CashPendingItem {
  id: string;
  amount: number;
  paidAt: string;
  accountTitle: string;
  memberName: string | null;
  bankAccountId: string | null;
}
interface Bank { id: string; name: string; kind: string }

// Recebimentos marcados como "em dinheiro" direto no painel do Asaas: o sistema lançou a baixa no Caixa e a
// Tesouraria confirma (ou troca a conta, se o dinheiro foi depositado em outro lugar).
export default function CashPendingCard({ items, banks }: { items: CashPendingItem[]; banks: Bank[] }) {
  const router = useRouter();
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (items.length === 0) return null;

  async function confirm(item: CashPendingItem) {
    setBusy(item.id);
    setError('');
    const res = await fetch(`/api/payments/${item.id}/confirm-cash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bankAccountId: choice[item.id] ?? item.bankAccountId ?? undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) router.refresh();
    else setError(data.error ?? 'Não foi possível confirmar.');
  }

  return (
    <section aria-labelledby="cash-pending-title" className="">
      <Alert intent="warn">
        <h2 id="cash-pending-title" className="text-sm font-semibold">Recebidos em dinheiro no Asaas — confirme na Tesouraria ({items.length})</h2>
        <p className="mt-1 text-xs">
          Estes valores foram marcados como &quot;recebidos em dinheiro&quot; direto no painel do Asaas. O sistema já lançou a baixa no <strong>Caixa</strong>;
          confira o dinheiro e confirme (ou escolha outra conta, se ele foi depositado em outro lugar).
        </p>
        {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
        <ul className="mt-3 space-y-2">
          {items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-sigma-blue-deep/50 px-3 py-2">
              <div className="text-sm">
                <p className="font-medium text-sand-light">{i.accountTitle}{i.memberName ? ` — ${i.memberName}` : ''}</p>
                <p className="text-xs text-sand-dark">{brl(i.amount)} · {formatDateOnly(i.paidAt)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label={`Conta que recebeu — ${i.accountTitle}`}
                  value={choice[i.id] ?? i.bankAccountId ?? ''}
                  onChange={(e) => setChoice((c) => ({ ...c, [i.id]: e.target.value }))}
                  className={`${inputClass} w-auto py-1.5`}
                >
                  {!i.bankAccountId && !choice[i.id] ? <option value="">Escolha a conta…</option> : null}
                  {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <Button type="button" size="sm" onClick={() => void confirm(i)} disabled={busy === i.id || !(choice[i.id] ?? i.bankAccountId)}>
                  {busy === i.id ? 'Confirmando…' : 'Confirmar recebimento'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Alert>
    </section>
  );
}
