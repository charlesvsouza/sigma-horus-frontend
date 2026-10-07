'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, inputClass } from '@/components/ui';
import { brl } from '@/lib/currency';
import { ledgerDayKey } from '@/lib/ledger-day';

export interface PanelPayment {
  id: string;
  amount: number;
  paidAt: string;
  method: string;
  note?: string | null;
  account?: { id: string; title: string; type: string } | null;
  bankAccount?: { id: string; name: string; kind: string } | null;
}

/** Pagamentos que nascem de outro fluxo (Asaas, doação/Tronco, custeio): não se editam nem se dividem à mão. */
const AUTOMATIC_METHODS = new Set(['asaas', 'asaas-cash', 'asaas-fee', 'asaas-refund', 'donation', 'fund']);
export const canEditPayment = (p: PanelPayment) => !AUTOMATIC_METHODS.has(p.method);
export const canSplitPayment = (p: PanelPayment) => !AUTOMATIC_METHODS.has(p.method) && p.account?.type === 'RECEIVABLE';

type Notify = (m: { kind: 'ok' | 'error'; text: string }) => void;

/** Corrige valor, data, conta e observação de um pagamento já lançado (o extrato acompanha). */
export function PaymentEditPanel({ payment, banks, onClose, notify }: { payment: PanelPayment; banks: { id: string; name: string }[]; onClose: () => void; notify: Notify }) {
  const router = useRouter();
  const [form, setForm] = useState({ amount: String(payment.amount), paidAt: ledgerDayKey(payment.paidAt), bankAccountId: payment.bankAccount?.id ?? '', note: payment.note ?? '' });
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);

  async function save() {
    setBusy(true);
    setLocked(false);
    try {
      const body: Record<string, unknown> = {};
      if (Math.round(Number(form.amount) * 100) !== Math.round(payment.amount * 100)) body.amount = Number(form.amount);
      if (form.paidAt !== ledgerDayKey(payment.paidAt)) body.paidAt = form.paidAt;
      if (form.bankAccountId && form.bankAccountId !== (payment.bankAccount?.id ?? '')) body.bankAccountId = form.bankAccountId;
      if (form.note !== (payment.note ?? '')) body.note = form.note;
      if (Object.keys(body).length === 0) { notify({ kind: 'ok', text: 'Nada para alterar.' }); onClose(); return; }
      const res = await fetch(`/api/payments/${payment.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLocked(data.code === 'LEDGER_LOCKED');
        notify({ kind: 'error', text: data.error ?? 'Não foi possível corrigir o pagamento.' });
        return;
      }
      notify({ kind: 'ok', text: `Pagamento corrigido (${(data.changed as string[]).join(', ')}). O extrato já mostra o novo valor.${data.reopenedBankLines ? ' A linha do extrato bancário conciliada voltou para conferência.' : ''}` });
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 w-full space-y-3 rounded-lg border border-gold/20 bg-sigma-blue-deep/70 p-4">
      <p className="text-xs text-sand-dark">Corrige o pagamento de &quot;{payment.account?.title ?? 'conta'}&quot; — o extrato e os saldos acompanham. A conta e as cobranças são recalculadas.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Valor"><input type="number" inputMode="decimal" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputClass} /></Field>
        <Field label="Data do pagamento"><input type="date" value={form.paidAt} onChange={(e) => setForm({ ...form, paidAt: e.target.value })} className={inputClass} /></Field>
        <Field label="Conta bancária/caixa">
          <select value={form.bankAccountId} onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })} className={inputClass}>
            {payment.bankAccount ? null : <option value="">Sem conta (histórico antigo)</option>}
            {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <Field label="Observação"><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={inputClass} /></Field>
      </div>
      {locked ? <p className="text-xs text-amber-300">Período já conferido com o banco. <Link href="/dashboard/conferencia" className="underline">Peça uma retificação</Link> ao Venerável Mestre.</p> : null}
      <div className="flex gap-3">
        <Button type="button" onClick={() => void save()} disabled={busy}>{busy ? 'Salvando…' : 'Salvar correção'}</Button>
        <button type="button" onClick={onClose} className="text-sm text-sand-dark transition hover:text-sand-light">Cancelar</button>
      </div>
    </div>
  );
}

interface Part { kind: 'category' | 'member'; chartAccountId: string; memberId: string; amount: string; title: string; paidOn: string }
interface Plan { source: { title: string; amount: number; paidAt: string }; lines: { kind: string; label: string; amount: number; allocations?: { title: string; dueDate: string; amount: number; remainingAfter: number }[] }[]; total: number; leftover: number }

const newPart = (kind: Part['kind']): Part => ({ kind, chartAccountId: '', memberId: '', amount: '', title: '', paidOn: '' });

/** Divide um recebimento (ex.: saldo de abertura): outra categoria (Tronco) e/ou mensalidades adiantadas de irmãos. */
export function PaymentSplitPanel({ payment, charts, members, onClose, notify }: { payment: PanelPayment; charts: { id: string; code: string; name: string }[]; members: { id: string; name: string }[]; onClose: () => void; notify: Notify }) {
  const router = useRouter();
  const [parts, setParts] = useState<Part[]>([newPart('category')]);
  const [note, setNote] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);

  const setPart = (i: number, patch: Partial<Part>) => { setPlan(null); setParts((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p))); };

  async function run(apply: boolean) {
    setBusy(true);
    setLocked(false);
    try {
      const body = {
        apply, note,
        parts: parts.map((p) => (p.kind === 'category'
          ? { kind: 'category', chartAccountId: p.chartAccountId, amount: Number(p.amount), title: p.title || undefined }
          : { kind: 'member', memberId: p.memberId, amount: Number(p.amount), paidOn: p.paidOn || undefined })),
      };
      const res = await fetch(`/api/payments/${payment.id}/split`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLocked(/conferido com o banco/.test(data.error ?? ''));
        notify({ kind: 'error', text: data.error ?? 'Não foi possível dividir o pagamento.' });
        return;
      }
      if (apply) {
        notify({ kind: 'ok', text: `Pagamento dividido: ${brl(data.plan.total)} separados, ${brl(data.plan.leftover)} continuam no lançamento original. O saldo do banco não mudou.` });
        onClose();
        router.refresh();
      } else {
        setPlan(data.plan as Plan);
      }
    } finally {
      setBusy(false);
    }
  }

  const ready = parts.length > 0 && parts.every((p) => Number(p.amount) > 0 && (p.kind === 'category' ? p.chartAccountId : p.memberId));

  return (
    <div className="mt-3 w-full space-y-3 rounded-lg border border-gold/20 bg-sigma-blue-deep/70 p-4">
      <p className="text-xs text-sand-dark">
        Separe partes de {brl(payment.amount)} (&quot;{payment.account?.title ?? 'recebimento'}&quot;): o valor sai deste lançamento e vira outra categoria (ex.: Tronco) ou a baixa das mensalidades adiantadas de um irmão. A conta bancária e o saldo do banco não mudam.
      </p>
      {parts.map((p, i) => (
        <div key={i} className="grid gap-3 rounded-lg border border-white/6 p-3 sm:grid-cols-[1fr_9rem]">
          <Field label="Parte">
            <select value={p.kind} onChange={(e) => setPart(i, { kind: e.target.value as Part['kind'] })} className={inputClass}>
              <option value="category">Outra categoria</option>
              <option value="member">Mensalidade adiantada de irmão</option>
            </select>
          </Field>
          <Field label="Valor"><input type="number" inputMode="decimal" step="0.01" value={p.amount} onChange={(e) => setPart(i, { amount: e.target.value })} className={inputClass} /></Field>
          {p.kind === 'category' ? (
            <Field label="Categoria (receita)" className="sm:col-span-2">
              <select value={p.chartAccountId} onChange={(e) => setPart(i, { chartAccountId: e.target.value })} className={inputClass}>
                <option value="">Escolha…</option>
                {charts.map((c) => <option key={c.id} value={c.id}>{c.code} {c.name}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Irmão" className="sm:col-span-2">
              <select value={p.memberId} onChange={(e) => setPart(i, { memberId: e.target.value })} className={inputClass}>
                <option value="">Escolha…</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
          )}
          {p.kind === 'member' ? (
            <Field label="Data em que ele pagou (opcional, vai na observação)" className="sm:col-span-2"><input type="date" value={p.paidOn} onChange={(e) => setPart(i, { paidOn: e.target.value })} className={`${inputClass} max-w-[12rem]`} /></Field>
          ) : (
            <Field label="Título do lançamento (opcional)" className="sm:col-span-2"><input value={p.title} onChange={(e) => setPart(i, { title: e.target.value })} className={inputClass} placeholder="Ex.: Saldo do Tronco na abertura" /></Field>
          )}
          {parts.length > 1 ? (
            <div className="sm:col-span-2"><button type="button" onClick={() => { setPlan(null); setParts((prev) => prev.filter((_, j) => j !== i)); }} className="text-xs text-rose-300 hover:text-rose-200">Remover esta parte</button></div>
          ) : null}
        </div>
      ))}
      <div className="flex flex-wrap gap-3 text-xs">
        <button type="button" onClick={() => { setPlan(null); setParts((prev) => [...prev, newPart('category')]); }} className="text-gold hover:text-gold-light">+ outra parte</button>
      </div>
      <Field label="Observação (opcional)"><input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} /></Field>

      {plan ? (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/8 p-3 text-sm text-sand">
          <p className="font-medium text-emerald-200">Prévia — nada foi gravado ainda</p>
          <ul className="mt-2 space-y-2">
            {plan.lines.map((l, i) => (
              <li key={i}>
                <span className="text-sand-light">{l.label}</span>: {brl(l.amount)}
                {l.allocations ? (
                  <ul className="ml-4 mt-1 list-disc text-xs text-sand-dark">
                    {l.allocations.map((a, j) => <li key={j}>{a.title} (venc. {a.dueDate.split('-').reverse().join('/')}): {brl(a.amount)}{a.remainingAfter > 0 ? ` — fica faltando ${brl(a.remainingAfter)}` : ' — quitada'}</li>)}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-sand-dark">Separado: {brl(plan.total)} · continua no lançamento original: {brl(plan.leftover)} · saldo do banco: sem alteração.</p>
        </div>
      ) : null}
      {locked ? <p className="text-xs text-amber-300">Período já conferido com o banco. <Link href="/dashboard/conferencia" className="underline">Peça uma retificação</Link> ao Venerável Mestre.</p> : null}
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={() => void run(false)} disabled={busy || !ready}>{busy && !plan ? 'Calculando…' : 'Ver prévia'}</Button>
        <Button type="button" onClick={() => void run(true)} disabled={busy || !ready || !plan}>{busy && plan ? 'Dividindo…' : 'Confirmar divisão'}</Button>
        <button type="button" onClick={onClose} className="text-sm text-sand-dark transition hover:text-sand-light">Cancelar</button>
      </div>
    </div>
  );
}
