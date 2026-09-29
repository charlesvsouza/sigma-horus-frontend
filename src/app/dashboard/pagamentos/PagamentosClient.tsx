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
interface ReceiptCheck { status: 'conferido' | 'divergente' | 'ilegivel'; txid: boolean; amount: boolean; payee: boolean; e2e: string | null; paidAt: string | null }
interface PaymentNotice {
  accountId: string; noticeAt: string; noticeDay: string; note: string | null; hasReceipt?: boolean;
  bankMatch?: BankMatch | null; group?: { accountIds: string[]; total: number } | null;
  /** Comprovante em PDF (conferível) e o resultado da conferência. */
  receiptPdf?: boolean; receiptCheck?: ReceiptCheck | null; e2eUsed?: boolean; suggestedBankId?: string | null;
  /** Comprovante recebido fora do portal e registrado pela Tesouraria; data do Pix informada por ela. */
  registeredBy?: { userId: string; name: string } | null; paidAtInformed?: string | null;
  /** Multa e juros pagos junto (comprovante conferido acima do saldo): lançados à parte na baixa. */
  lateCharge?: number;
}

/** Dia do pagamento (Brasília) a partir do ISO do comprovante. */
function brDay(iso: string): string {
  return new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

function accountLabel(a: AccountOption): string {
  return [a.title, a.who, `venc. ${formatDateOnly(a.dueDate)}`, `saldo ${brl(a.balance)}`].filter(Boolean).join(' · ');
}

const EMPTY_FORM = { accountId: '', memberId: '', bankAccountId: '', amount: '', lateCharge: '', paidAt: '', method: 'manual', note: '', bankTransactionId: '' };

/** Formulário pronto para a baixa de uma conta (saldo, irmão, conta prevista); com aviso do portal, Pix na data do aviso. */
function formFor(account: AccountOption, notice?: PaymentNotice | null) {
  return {
    ...EMPTY_FORM,
    accountId: account.id,
    memberId: account.memberId ?? '',
    bankAccountId: account.bankAccountId ?? '',
    amount: String(account.balance),
    lateCharge: notice?.lateCharge ? String(notice.lateCharge) : '',
    // Crédito achado no extrato: a data do pagamento é a do crédito e a linha é conciliada junto.
    paidAt: notice?.bankMatch ? notice.bankMatch.date.slice(0, 10) : notice?.paidAtInformed ?? notice?.noticeDay ?? todayBR().toISOString().slice(0, 10),
    method: notice ? 'pix' : 'manual',
    note: notice ? `${notice.registeredBy ? `Comprovante do irmão registrado por ${notice.registeredBy.name}` : 'Pix informado pelo irmão no portal'} em ${new Date(notice.noticeAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}${notice.note ? ` — "${notice.note}"` : ''}. ${notice.bankMatch ? `Crédito no extrato em ${formatDateOnly(notice.bankMatch.date)}.` : 'Conferido no extrato.'}` : '',
    bankTransactionId: notice?.bankMatch && Math.round(notice.bankMatch.amount * 100) === Math.round((account.balance + (notice.lateCharge ?? 0)) * 100) ? notice.bankMatch.lineId : '',
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

export default function PagamentosClient({ accounts, members, payments, financialAccounts, notices = [], initialAccountId = null, currentUserId = null }: { accounts: AccountOption[]; members: MemberOption[]; payments: PaymentItem[]; financialAccounts: FinancialAccountOption[]; notices?: PaymentNotice[]; initialAccountId?: string | null; currentUserId?: string | null }) {
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

  const [noticeBusy, setNoticeBusy] = useState<string | null>(null);
  const [bankChoice, setBankChoice] = useState<Record<string, string>>({});

  // Conferência do comprovante de um aviso antigo (ou de novo): grava um registro próprio e recarrega.
  async function checkNoticeReceipt(notice: PaymentNotice) {
    setNoticeBusy(notice.accountId);
    setMessage(null);
    const res = await fetch('/api/payments/notice-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: notice.accountId }) });
    const data = await res.json().catch(() => ({}));
    setNoticeBusy(null);
    if (!res.ok) { setMessage({ kind: 'error', text: data.error ?? 'Não foi possível conferir o comprovante.' }); return; }
    router.refresh();
  }

  // Baixa de UM clique para comprovante conferido: a Tesouraria só confirma.
  async function confirmNotice(notice: PaymentNotice) {
    const account = byId.get(notice.accountId);
    const check = notice.receiptCheck;
    const bankAccountId = bankChoice[notice.accountId] ?? notice.suggestedBankId ?? '';
    if (!account || !check || check.status !== 'conferido') return;
    if (!bankAccountId) { setMessage({ kind: 'error', text: 'Escolha a conta bancária onde o Pix caiu.' }); return; }
    setNoticeBusy(notice.accountId);
    setMessage(null);
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: account.id,
        memberId: account.memberId ?? undefined,
        amount: account.balance,
        paidAt: check.paidAt ? brDay(check.paidAt) : notice.paidAtInformed ?? notice.noticeDay,
        method: 'pix',
        bankAccountId,
        note: `Pix conferido pelo comprovante (nº de controle ${check.e2e}).${notice.group ? ` Pix agrupado de ${notice.group.accountIds.length} contas.` : ''}`,
        e2eId: check.e2e,
        ...(notice.lateCharge ? { lateCharge: notice.lateCharge } : {}),
        ...(notice.bankMatch && Math.round(notice.bankMatch.amount * 100) === Math.round((account.balance + (notice.lateCharge ?? 0)) * 100) ? { bankTransactionId: notice.bankMatch.lineId } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setNoticeBusy(null);
    if (!res.ok) { setMessage({ kind: 'error', text: data.error ?? 'Não foi possível registrar a baixa.' }); return; }
    setMessage({ kind: 'ok', text: `Baixa registrada: ${account.who ?? ''} — ${account.title}, ${brl(account.balance)}${notice.lateCharge ? ` + ${brl(notice.lateCharge)} de multa e juros (lançados em 1.2.06)` : ''}.` });
    router.refresh();
  }

  // Recusar aviso (comprovante errado): a conta volta a "em aberto" sem aviso e o irmão, avisado
  // do motivo, manda o comprovante certo pelo mesmo "Já paguei". Nada é apagado (fica na auditoria).
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectNotify, setRejectNotify] = useState(true);

  function openReject(notice: PaymentNotice) {
    setRejecting(notice.accountId);
    setRejectReason('');
    setRejectNotify(true);
    setMessage(null);
  }

  async function rejectNotice(notice: PaymentNotice) {
    const account = byId.get(notice.accountId);
    setNoticeBusy(notice.accountId);
    setMessage(null);
    const res = await fetch('/api/payments/notice-reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: notice.accountId, reason: rejectReason, notifyMember: rejectNotify }),
    });
    const data = await res.json().catch(() => ({}));
    setNoticeBusy(null);
    if (!res.ok) { setMessage({ kind: 'error', text: data.error ?? 'Não foi possível recusar o aviso.' }); return; }
    setRejecting(null);
    const n = Array.isArray(data.accountIds) ? data.accountIds.length : 1;
    setMessage({
      kind: 'ok',
      text: `Aviso recusado: ${account?.who ?? ''} — ${n > 1 ? `${n} contas do Pix agrupado voltaram` : 'a conta voltou'} a "em aberto".${rejectNotify ? (data.notified ? ' O irmão recebeu o motivo por e-mail.' : ' Não foi possível mandar o e-mail ao irmão — avise-o por outro meio.') : ''}`,
    });
    router.refresh();
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
          lateCharge: form.lateCharge ? Number(form.lateCharge) : undefined,
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
              O irmão informou pelo portal que pagou via Pix na chave da loja — ou a Tesouraria registrou o comprovante que ele mandou por fora.
              Confira o crédito no extrato do banco e clique em <strong>Dar baixa</strong>: o formulário abaixo vem preenchido.
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
                      {n.registeredBy ? (
                        <p className="mt-1 text-xs text-sky-200">
                          Registrado por {n.registeredBy.name} (comprovante recebido fora do portal){n.paidAtInformed ? ` · Pix em ${formatDateOnly(n.paidAtInformed)}, data informada` : ''}.
                          {n.registeredBy.userId === currentUserId ? <span className="block text-amber-300">Você registrou este comprovante: confira o crédito no extrato antes de dar a baixa.</span> : null}
                        </p>
                      ) : null}
                      {n.group ? (
                        <p className="mt-1 text-xs text-sky-200">
                          Pix agrupado: {n.group.accountIds.length} contas num só Pix de {brl(n.group.total)} — dê a baixa em cada uma.
                        </p>
                      ) : null}
                      {n.bankMatch ? (
                        <p className="mt-1 text-xs text-emerald-300">
                          {n.bankMatch.by === 'txid' ? 'Crédito identificado no extrato' : 'Crédito compatível no extrato'}: {formatDateOnly(n.bankMatch.date)} · {brl(n.bankMatch.amount)} · {n.bankMatch.description}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-sand-dark">Nenhum crédito correspondente no extrato importado — confira no banco.</p>
                      )}
                      {n.receiptCheck ? (
                        n.receiptCheck.status === 'conferido' ? (
                          <p className="mt-1 text-xs text-emerald-300">
                            Comprovante conferido: ✓ identificador do QR · ✓ valor · ✓ recebido pela loja · ✓ nº de controle {n.receiptCheck.e2e}
                            {n.lateCharge ? <span className="block text-sky-200">Pago com {brl(n.lateCharge)} de multa e juros por atraso — lançados à parte (1.2.06) na baixa.</span> : null}
                            {n.e2eUsed ? <span className="block text-rose-300">Atenção: este nº de controle já foi usado na baixa de outra conta.</span> : null}
                          </p>
                        ) : n.receiptCheck.status === 'ilegivel' ? (
                          <p className="mt-1 text-xs text-sand-dark">Comprovante sem texto legível (PDF escaneado) — confira pelo &quot;Ver comprovante&quot;.</p>
                        ) : (
                          <p className="mt-1 text-xs text-amber-300">
                            Comprovante com divergência: {[!n.receiptCheck.txid && 'identificador não é o do QR desta conta', !n.receiptCheck.amount && 'valor diferente do esperado (saldo, ou saldo com multa e juros)', !n.receiptCheck.payee && 'não mostra a loja como recebedora', !n.receiptCheck.e2e && 'sem nº de controle do Pix'].filter(Boolean).join(' · ')}. Confira antes de dar baixa.
                          </p>
                        )
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      {n.hasReceipt ? (
                        <a href={`/api/portal/accounts/${n.accountId}/paid-notice/receipt`} target="_blank" rel="noreferrer" className="text-xs font-medium text-gold hover:text-gold-light">
                          Ver comprovante
                        </a>
                      ) : null}
                      {n.receiptPdf && n.receiptCheck?.status !== 'conferido' ? (
                        <Button size="sm" variant="secondary" onClick={() => void checkNoticeReceipt(n)} disabled={noticeBusy === n.accountId}>
                          {noticeBusy === n.accountId ? 'Conferindo…' : n.receiptCheck ? 'Conferir de novo' : 'Conferir comprovante'}
                        </Button>
                      ) : null}
                      {n.receiptCheck?.status === 'conferido' && !n.e2eUsed ? (
                        <>
                          {!n.suggestedBankId ? (
                            <select
                              aria-label="Conta onde o Pix caiu"
                              value={bankChoice[n.accountId] ?? ''}
                              onChange={(e) => setBankChoice((prev) => ({ ...prev, [n.accountId]: e.target.value }))}
                              className={`${INPUT} max-w-[12rem] py-1.5 text-xs`}
                            >
                              <option value="">Conta onde caiu…</option>
                              {financialAccounts.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                          ) : null}
                          <Button size="sm" onClick={() => void confirmNotice(n)} disabled={noticeBusy === n.accountId || (!n.suggestedBankId && !bankChoice[n.accountId])}>
                            {noticeBusy === n.accountId ? 'Registrando…' : 'Confirmar e dar baixa'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => settleNotice(n)}>Revisar</Button>
                        </>
                      ) : (
                        <Button size="sm" onClick={() => settleNotice(n)}>Dar baixa</Button>
                      )}
                      {rejecting !== n.accountId ? (
                        <Button size="sm" variant="ghost" onClick={() => openReject(n)} disabled={noticeBusy === n.accountId}>Recusar aviso</Button>
                      ) : null}
                    </div>
                    {rejecting === n.accountId ? (
                      <div className="w-full rounded-lg border border-rose-500/25 bg-rose-500/5 p-4">
                        <p className="text-sm font-medium text-sand-light">Recusar este aviso de pagamento</p>
                        <p className="mt-1 text-xs text-sand-dark">
                          Use quando o comprovante não é deste pagamento (arquivo errado, outra conta, valor ou recebedor diferente).
                          {n.group ? ` É um Pix agrupado: as ${n.group.accountIds.length} contas do grupo voltam juntas.` : ''} A conta volta a &quot;em aberto&quot; no portal
                          e o irmão pode avisar de novo com o comprovante certo. O aviso recusado fica registrado na auditoria.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {['Comprovante anexado não corresponde a este pagamento.', 'Valor do comprovante diferente do cobrado.', 'Crédito não localizado no extrato da loja.', 'Comprovante ilegível.'].map((r) => (
                            <button key={r} type="button" onClick={() => setRejectReason(r)} className="rounded-full border border-white/10 px-3 py-1 text-xs text-sand-dark transition-colors hover:border-gold/40 hover:text-sand">
                              {r}
                            </button>
                          ))}
                        </div>
                        <textarea
                          aria-label="Motivo da recusa"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          maxLength={300}
                          rows={2}
                          placeholder="Motivo (vai no e-mail ao irmão)"
                          className={`${INPUT} mt-3 text-sm`}
                        />
                        <label className="mt-2 flex items-center gap-2 text-xs text-sand-dark">
                          <input type="checkbox" checked={rejectNotify} onChange={(e) => setRejectNotify(e.target.checked)} className="h-4 w-4 accent-gold" />
                          Avisar o irmão por e-mail, com o motivo
                        </label>
                        <div className="mt-3 flex justify-end gap-3">
                          <Button size="sm" variant="ghost" onClick={() => setRejecting(null)} disabled={noticeBusy === n.accountId}>Cancelar</Button>
                          <Button size="sm" variant="danger" onClick={() => void rejectNotice(n)} disabled={noticeBusy === n.accountId || rejectReason.trim().length < 3}>
                            {noticeBusy === n.accountId ? 'Recusando…' : 'Recusar aviso'}
                          </Button>
                        </div>
                      </div>
                    ) : null}
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
              <Field label="Multa e juros recebidos (opcional)">
                <input type="number" step="0.01" min="0" value={form.lateCharge} onChange={(event) => setForm({ ...form, lateCharge: event.target.value })} className={INPUT} placeholder="0,00" />
                <span className="mt-1 block text-xs text-sand-dark">Acréscimo por atraso pago junto: vai à parte, em 1.2.06 Multas e Juros por Atraso. Só para conta a receber de irmão.</span>
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
