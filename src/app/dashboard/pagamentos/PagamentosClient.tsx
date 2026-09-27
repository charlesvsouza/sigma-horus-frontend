"use client";

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, EmptyState, Field, FormCard, inputClass, useConfirm } from '@/components/ui';
import { brl } from '@/lib/currency';
import { formatDateOnly, todayBR } from '@/lib/date-only';

interface MemberOption { id: string; name: string; }
interface AccountOption {
  id: string;
  title: string;
  type: string;
  amount: number;
  /** Saldo em aberto (desconta parciais). */
  balance: number;
  dueDate: string;
  bankAccountId: string | null;
  memberId: string | null;
  /** Irmão ou contraparte da conta — sem isso, "Mensalidades" repetido não diz de quem é. */
  who: string | null;
}
/** "Já paguei" do portal (Modo Loja) ainda sem baixa. */
interface BankMatch { lineId: string; date: string; amount: number; description: string; by: 'txid' | 'amount'; }
interface PaymentNotice { accountId: string; noticeAt: string; noticeDay: string; note: string | null; hasReceipt?: boolean; bankMatch?: BankMatch | null; }

function accountLabel(a: AccountOption): string {
  return [a.title, a.who, `venc. ${formatDateOnly(a.dueDate)}`, `saldo ${brl(a.balance)}`].filter(Boolean).join(' · ');
}

const EMPTY_FORM = { accountId: '', memberId: '', bankAccountId: '', amount: '', paidAt: '', method: 'manual', note: '', bankTransactionId: '' };

/** Formulário pronto para a baixa de uma conta (saldo, irmão, conta prevista); com aviso do portal, Pix na data do aviso. */
function formFor(account: AccountOption, notice?: PaymentNotice | null) {
  return {
    ...EMPTY_FORM,
    accountId: account.id,
    memberId: account.memberId ?? '',
    bankAccountId: account.bankAccountId ?? '',
    amount: String(account.balance),
    // Crédito achado no extrato: a data do pagamento é a do crédito e a linha é conciliada junto.
    paidAt: notice?.bankMatch ? notice.bankMatch.date.slice(0, 10) : notice?.noticeDay ?? todayBR().toISOString().slice(0, 10),
    method: notice ? 'pix' : 'manual',
    note: notice ? `Pix informado pelo irmão no portal em ${new Date(notice.noticeAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}${notice.note ? ` — "${notice.note}"` : ''}. ${notice.bankMatch ? `Crédito no extrato em ${formatDateOnly(notice.bankMatch.date)}.` : 'Conferido no extrato.'}` : '',
    bankTransactionId: notice?.bankMatch && Math.round(notice.bankMatch.amount * 100) === Math.round(account.balance * 100) ? notice.bankMatch.lineId : '',
  };
}
interface FinancialAccountOption { id: string; name: string; kind: string; }
interface PaymentItem {
  id: string;
  amount: number;
  paidAt: string;
  method: string;
  note?: string | null;
  account?: { id: string; title: string; type: string } | null;
  member?: { id: string; name: string } | null;
  bankAccount?: { id: string; name: string; kind: string } | null;
}

export default function PagamentosClient({ accounts, members, payments, financialAccounts, notices = [], initialAccountId = null }: { accounts: AccountOption[]; members: MemberOption[]; payments: PaymentItem[]; financialAccounts: FinancialAccountOption[]; notices?: PaymentNotice[]; initialAccountId?: string | null }) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState(() => {
    const account = initialAccountId ? accounts.find((a) => a.id === initialAccountId) : null;
    return account ? formFor(account, notices.find((n) => n.accountId === account.id)) : EMPTY_FORM;
  });
  const byId = new Map(accounts.map((a) => [a.id, a]));

  function selectAccount(id: string) {
    const account = byId.get(id);
    if (!account) { setForm((prev) => ({ ...prev, accountId: id, bankTransactionId: '' })); return; }
    // Troca de conta: irmão, saldo e conta prevista vêm dela (mantém data, método e observação digitados).
    // A linha do extrato achada para um aviso é da conta DELE: trocar de conta desfaz o vínculo.
    setForm((prev) => ({ ...prev, accountId: id, memberId: account.memberId ?? '', amount: String(account.balance), bankAccountId: account.bankAccountId ?? prev.bankAccountId, bankTransactionId: '' }));
  }

  function settleNotice(notice: PaymentNotice) {
    const account = byId.get(notice.accountId);
    if (!account) return;
    setForm(formFor(account, notice));
    setMessage(null);
    document.getElementById('novo-pagamento')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const [consent, setConsent] = useState(false);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleEstorno(id: string) {
    const ok = await askConfirm({
      title: 'Estornar pagamento',
      message: 'Remove este pagamento e recalcula o status da conta (volta a ficar pendente, se for o caso). Não pode ser desfeito.',
      confirmLabel: 'Estornar',
      intent: 'danger',
    });
    if (!ok) return;
    const response = await fetch(`/api/payments/${id}`, { method: 'DELETE' });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setMessage({ kind: 'ok', text: 'Pagamento estornado.' });
      router.refresh();
    } else {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao estornar pagamento.' });
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!consent) {
      setMessage({ kind: 'error', text: 'Confirme a ciência sobre os lançamentos antes de registrar.' });
      return;
    }
    setSubmitting(true);
    try {
      const send = (confirmOutsideAsaas: boolean) => fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          memberId: form.memberId || undefined,
          ...(confirmOutsideAsaas ? { confirmOutsideAsaas: true } : {}),
        }),
      });

      let response = await send(false);
      let data = await response.json();
      // Cobrança aberta no Asaas: a baixa é do Asaas. Só segue se foi recebido fora dele.
      if (response.status === 409 && data.code === 'ASAAS_CHARGE_OPEN') {
        const ok = await askConfirm({ title: 'Cobrança aberta no Asaas', message: data.error, confirmLabel: 'Recebido fora do Asaas' });
        if (!ok) return;
        response = await send(true);
        data = await response.json();
      }
      if (response.ok) {
        setMessage(data.asaasWarning ? { kind: 'error', text: data.asaasWarning } : { kind: 'ok', text: 'Pagamento registrado com sucesso.' });
        setForm(EMPTY_FORM);
        setConsent(false);
        router.refresh();
      } else {
        setMessage({ kind: 'error', text: data.error ?? 'Erro ao registrar pagamento.' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const INPUT = inputClass; // fonte única do design system

  const q = search.trim().toLowerCase();
  const filteredPayments = q
    ? payments.filter((p) => p.account?.title.toLowerCase().includes(q) || p.member?.name.toLowerCase().includes(q) || p.method.toLowerCase().includes(q))
    : payments;

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Pagamentos</h1>
          <p className="mt-1 text-sm text-sand-dark">Registre entradas e saídas de caixa vinculadas às contas do MVP.</p>
        </div>

        {message ? <Alert intent={message.kind === 'ok' ? 'ok' : 'danger'}>{message.text}</Alert> : null}

        {notices.length > 0 ? (
          <section className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-6" aria-labelledby="avisos-title">
            <h2 id="avisos-title" className="text-base font-semibold text-sand-light">Avisos de pagamento dos irmãos</h2>
            <p className="mt-1 text-sm text-sand-dark">
              O irmão informou pelo portal que pagou via Pix na chave da loja. Confira o crédito no extrato do banco e clique em
              <strong> Dar baixa</strong>: o formulário abaixo vem preenchido.
            </p>
            <ul className="mt-4 space-y-3">
              {notices.map((n) => {
                const a = byId.get(n.accountId);
                if (!a) return null;
                return (
                  <li key={n.accountId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-sand-light">{a.who ?? 'Sem vínculo'} — {a.title}</p>
                      <p className="mt-0.5 text-xs text-sand-dark">
                        Venc. {formatDateOnly(a.dueDate)} · saldo {brl(a.balance)} · avisou em {new Date(n.noticeAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}
                        {n.note ? ` · "${n.note}"` : ''}
                      </p>
                      {n.bankMatch ? (
                        <p className="mt-1 text-xs text-emerald-300">
                          {n.bankMatch.by === 'txid' ? 'Crédito identificado no extrato' : 'Crédito compatível no extrato'}: {formatDateOnly(n.bankMatch.date)} · {brl(n.bankMatch.amount)} · {n.bankMatch.description}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-sand-dark">Nenhum crédito correspondente no extrato importado — confira no banco.</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {n.hasReceipt ? (
                        <a href={`/api/portal/accounts/${n.accountId}/paid-notice/receipt`} target="_blank" rel="noreferrer" className="text-xs font-medium text-gold hover:text-gold-light">
                          Ver comprovante
                        </a>
                      ) : null}
                      <Button size="sm" onClick={() => settleNotice(n)}>Dar baixa</Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <div className="grid items-start gap-6 lg:grid-cols-2">
        <div id="novo-pagamento" className="scroll-mt-6">
        <FormCard title="Novo pagamento">
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Selecione uma conta">
                <select value={form.accountId} onChange={(event) => selectAccount(event.target.value)} className={INPUT} required>
                  <option value="">Selecione…</option>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{accountLabel(account)}</option>)}
                </select>
              </Field>
              <Field label="Vincular a um membro">
                <select value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })} className={INPUT}>
                  <option value="">Selecione…</option>
                  {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
              </Field>
              <Field label="Valor">
                <input type="number" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className={INPUT} required />
              </Field>
              <Field label="Data do pagamento">
                <input type="date" value={form.paidAt} onChange={(event) => setForm({ ...form, paidAt: event.target.value })} className={INPUT} required />
              </Field>
              <Field label="Método de pagamento">
                <select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })} className={INPUT}>
                  <option value="manual">Manual</option>
                  <option value="pix">PIX</option>
                  <option value="cash">Dinheiro</option>
                  <option value="card">Cartão</option>
                </select>
              </Field>
              <Field label="Conta bancária/caixa que recebeu ou pagou">
                <select value={form.bankAccountId} onChange={(event) => setForm({ ...form, bankAccountId: event.target.value })} className={INPUT} required>
                  <option value="">Selecione…</option>
                  {financialAccounts.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </Field>
              <Field label="Observação" className="md:col-span-2">
                <textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} className={`${INPUT} md:col-span-2`} rows={3} />
              </Field>
            </div>
            <label className="flex items-start gap-3 rounded-lg border border-white/8 bg-sigma-blue-deep/60 px-4 py-3">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-4 w-4 accent-gold" />
              <span className="text-sm text-sand">
                Declaro estar ciente e de acordo com o registro deste e de eventuais lançamentos recorrentes,
                confirmo a veracidade dos dados informados e li os{' '}
                <Link href="/termos" target="_blank" className="text-gold hover:text-gold-light">Termos de Uso</Link>.
              </span>
            </label>
            <Button type="submit" disabled={!consent || submitting}>{submitting ? 'Registrando…' : 'Registrar pagamento'}</Button>
          </form>
        </FormCard>
        </div>

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-sand-light">Pagamentos recentes</h2>
            <input aria-label="Buscar por conta, membro ou forma" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por conta, membro ou forma…" className={`${INPUT} max-w-xs`} />
          </div>
          <div className="mt-5 space-y-3">
            {payments.length === 0 ? (
              <EmptyState title="O caixa aguarda o primeiro giro." description="Registre baixas manuais aqui; as baixas automáticas do Asaas aparecem assim que o webhook confirma o pagamento." />
            ) : filteredPayments.length === 0 ? (
              <p className="text-sm text-sand-dark">Nenhum pagamento encontrado para &quot;{search}&quot;.</p>
            ) : filteredPayments.map((payment) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-4 transition-colors hover:border-white/8">
                <div>
                  <p className="text-sm font-medium text-sand-light">{payment.account?.title ?? 'Conta removida'}</p>
                  <p className="mt-1 text-xs text-sand-dark">{payment.member?.name ?? 'Sem vínculo'} • {payment.method}{payment.bankAccount ? ` • ${payment.bankAccount.name}` : ''}</p>
                </div>
                <div className="text-right text-xs text-sand-dark">
                  <p className="tabular-nums">Valor: {brl(payment.amount)}</p>
                  <p className="mt-0.5">Data: {new Date(payment.paidAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
                  <div className="mt-1 flex items-center justify-end gap-3">
                    <Link href={`/dashboard/pagamentos/${payment.id}/recibo`} target="_blank" className="text-xs px-1 py-1 text-gold transition hover:text-gold-light">Recibo</Link>
                    <button onClick={() => void handleEstorno(payment.id)} className="text-xs px-1 py-1 text-rose-300 transition hover:text-rose-200">Estornar</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        </div>
      </div>
    </main>
  );
}
