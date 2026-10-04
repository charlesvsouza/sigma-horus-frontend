'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, Card, EmptyState, inputClass, useConfirm } from '@/components/ui';
import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';
import { AGREEMENT_PARTIES, partyLabel } from '@/lib/agreement-signature';
import { agreementKindLabel, buildInstallments, isSettlementKind, MAX_AGREEMENT_INSTALLMENTS } from '@/lib/member-block';
import Link from 'next/link';

export interface AgreementView {
  id: string;
  signedParties: string[];
  canSignAs: string | null;
  memberId: string;
  kind: string; // regularization | settlement
  memberName: string;
  status: string; // open | settled | lifted
  blockedAt: string;
  powerProtocol: string | null;
  powerSentAt: string | null;
  note: string | null;
  overdueDaysAtBlock: number;
  total: number;
  paid: number;
  remaining: number;
  installments: number;
  brokenAt: string | null;
  settledAt: string | null;
  liftedAt: string | null;
  items: { id: string; kind: string; title: string; openAmount: number; remaining: number }[];
  schedule: { number: number; dueDate: string; amount: number; covered: boolean; late: boolean }[];
}
interface Bank { id: string; name: string; kind: string; isDefault: boolean }

const KIND_LABEL: Record<string, string> = { debt: 'Dívida', fee: 'Taxa de regularização', extra: 'Multa e juros' };
const parseMoney = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(/\./g, '').replace(',', '.')));
const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const moneyInput = (n: number) => n.toFixed(2).replace('.', ',');

function PaymentForm({ a, banks, onDone }: { a: AgreementView; banks: Bank[]; onDone: (msg: string) => void }) {
  // Sugere o que falta para cobrir a próxima parcela (parcelas anteriores + esta, menos o já pago).
  const nextIdx = a.schedule.findIndex((p) => !p.covered);
  const dueThroughNext = nextIdx < 0 ? a.total : a.schedule.slice(0, nextIdx + 1).reduce((s, p) => s + p.amount, 0);
  const suggested = Math.round(Math.min(a.remaining, Math.max(0, dueThroughNext - a.paid)) * 100) / 100 || a.remaining;
  const [amount, setAmount] = useState(moneyInput(suggested));
  const [bankAccountId, setBankAccountId] = useState(banks.find((b) => b.isDefault)?.id ?? banks[0]?.id ?? '');
  const [paidAt, setPaidAt] = useState(todayIso());
  const [method, setMethod] = useState('pix');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const askConfirm = useConfirm();

  async function send(confirmOutsideAsaas: boolean) {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/members/${a.memberId}/block/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseMoney(amount), bankAccountId, paidAt, method, confirmOutsideAsaas }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) return onDone('Pagamento do acordo registrado.');
    if (res.status === 409 && data.code === 'ASAAS_CHARGE_OPEN') {
      if (await askConfirm({ title: 'Cobrança aberta no Asaas', message: data.error, confirmLabel: 'Foi recebido por fora — registrar' })) return send(true);
      return;
    }
    setError(data.error ?? 'Erro ao registrar o pagamento.');
  }

  return (
    <div className="mt-3 rounded-lg border border-gold/20 bg-gold/5 p-3">
      {error ? <p className="mb-2 text-xs text-rose-300">{error}</p> : null}
      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-xs text-sand-dark">Valor recebido (R$)
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-xs text-sand-dark">Conta / caixa que recebeu
          <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className={`mt-1 ${inputClass}`}>
            {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-sand-dark">Data
          <input type="date" value={paidAt} max={todayIso()} onChange={(e) => setPaidAt(e.target.value)} className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-xs text-sand-dark">Forma
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={`mt-1 ${inputClass}`}>
            <option value="pix">Pix</option>
            <option value="cash">Dinheiro</option>
            <option value="transfer">Transferência</option>
            <option value="manual">Outra</option>
          </select>
        </label>
      </div>
      <p className="mt-2 text-xs text-sand-dark">
        {isSettlementKind(a.kind)
          ? 'O valor é repartido entre as dívidas do acordo, da mais antiga para a mais nova. Cada parte entra na categoria certa do caixa e do DRE.'
          : 'O valor é repartido entre os itens do acordo: primeiro a taxa de regularização, depois a dívida mais antiga. Cada parte entra na categoria certa do caixa e do DRE.'}
      </p>
      <Button type="button" className="mt-3" onClick={() => void send(false)} disabled={busy || !bankAccountId || !(parseMoney(amount) > 0)}>
        {busy ? 'Registrando…' : 'Registrar pagamento'}
      </Button>
    </div>
  );
}

function RegularizeForm({ a, onDone }: { a: AgreementView; onDone: (msg: string) => void }) {
  const [fee, setFee] = useState('');
  const [extra, setExtra] = useState('');
  const [installments, setInstallments] = useState('1');
  const [firstDueDate, setFirstDueDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const feeN = parseMoney(fee);
  const extraN = extra.trim() === '' ? 0 : parseMoney(extra);
  const total = Number.isFinite(feeN) && Number.isFinite(extraN) ? Math.round((feeN + extraN) * 100) / 100 : null;
  const n = Number(installments);
  const schedule = total != null && total > 0 && firstDueDate ? buildInstallments(total, n, new Date(`${firstDueDate}T00:00:00Z`)) : [];

  async function submit() {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/members/${a.memberId}/block/regularize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fee: feeN, extra: extraN, installments: n, firstDueDate }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) onDone('Acordo de regularização aberto. O irmão segue bloqueado até pagar a taxa.');
    else setError(data.error ?? 'Erro ao abrir o acordo de regularização.');
  }

  return (
    <div className="mt-3 rounded-lg border border-gold/20 bg-gold/5 p-3">
      <p className="text-xs text-sand-dark">As dívidas já foram quitadas. Informe a taxa de regularização: nasce um acordo de regularização e o irmão só volta depois de pagá-lo.</p>
      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <label className="text-xs text-sand-dark">Taxa de regularização (R$) *
          <input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" placeholder="0,00" className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-xs text-sand-dark">Multa e juros (R$) — opcional
          <input value={extra} onChange={(e) => setExtra(e.target.value)} inputMode="decimal" placeholder="0,00" className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-xs text-sand-dark">Pagamento
          <select value={installments} onChange={(e) => setInstallments(e.target.value)} className={`mt-1 ${inputClass}`}>
            <option value="1">À vista (padrão)</option>
            {Array.from({ length: MAX_AGREEMENT_INSTALLMENTS - 1 }, (_, i) => i + 2).map((k) => <option key={k} value={k}>Em {k} parcelas</option>)}
          </select>
        </label>
        <label className="text-xs text-sand-dark">{n > 1 ? '1º vencimento' : 'Vencimento'}
          <input type="date" value={firstDueDate} min={todayIso()} onChange={(e) => setFirstDueDate(e.target.value)} className={`mt-1 ${inputClass}`} />
        </label>
      </div>
      <p className="mt-2 text-xs text-sand">Total: <strong className="tabular-nums text-gold">{total != null ? brl(total) : '—'}</strong></p>
      {schedule.length > 1 ? (
        <ul className="mt-1 text-xs text-sand-dark">
          {schedule.map((s) => <li key={s.number}>Parcela {s.number}/{schedule.length}: {brl(s.amount)} em {formatDateOnly(s.dueDate)}</li>)}
        </ul>
      ) : null}
      <Button type="button" className="mt-3" onClick={() => void submit()} disabled={busy || total == null || total <= 0}>
        {busy ? 'Abrindo…' : 'Abrir acordo de regularização'}
      </Button>
    </div>
  );
}

function AgreementCard({ a, banks, canPay, mayLift }: { a: AgreementView; banks: Bank[]; canPay: boolean; mayLift: boolean }) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [paying, setPaying] = useState(false);
  const [regularizing, setRegularizing] = useState(false);
  const settlement = isSettlementKind(a.kind);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const late = a.status === 'open' && a.schedule.some((p) => p.late);
  const pct = a.total > 0 ? Math.min(100, Math.round((a.paid / a.total) * 100)) : 0;

  async function sign() {
    const label = a.canSignAs ? partyLabel(a.canSignAs) : '';
    if (!(await askConfirm({
      title: 'Assinar o termo de acordo',
      message: `Você assina digitalmente o Termo de ${agreementKindLabel(a.kind).toLowerCase()} de ${a.memberName} como ${label}. A assinatura registra quem assinou, quando e o resumo do acordo, e não pode ser desfeita. Antes, leia o termo (botão "Abrir termo").`,
      confirmLabel: 'Assinar digitalmente',
    }))) return;
    const res = await fetch(`/api/members/${a.memberId}/block/sign`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { setMessage({ kind: 'ok', text: `Termo assinado. Código de verificação: ${data.code}.` }); router.refresh(); }
    else setMessage({ kind: 'error', text: data.error ?? 'Não foi possível assinar.' });
  }

  async function lift(outcome: 'active' | 'placet' = 'active') {
    const placet = outcome === 'placet';
    if (!(await askConfirm({
      title: placet ? 'Concluir com Placet' : 'Liberar o irmão',
      message: placet
        ? `O acordo de quitação de ${a.memberName} está pago e ele não vai regularizar. A situação do cadastro passa a "Quit Placet" e o acordo é encerrado. Confirme que o Placet foi solicitado/informado à Potência.`
        : `O acordo de ${a.memberName} está quitado. Liberar o cadastro: ele volta a ser convocado e a receber cobranças (a mensalidade recomeça no próximo vencimento). Confirme que a Potência também foi informada.`,
      confirmLabel: placet ? 'Concluir com Placet' : 'Liberar o irmão',
    }))) return;
    const res = await fetch(`/api/members/${a.memberId}/block/lift`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outcome }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { setMessage({ kind: 'ok', text: placet ? 'Acordo encerrado: irmão em Quit Placet.' : 'Irmão liberado.' }); router.refresh(); }
    else setMessage({ kind: 'error', text: data.error ?? 'Erro ao concluir.' });
  }

  const badge = a.status === 'lifted' ? <Badge variant="success">Liberado</Badge>
    : a.status === 'settled' ? <Badge variant="success">{settlement ? 'Dívidas quitadas — aguardando regularização ou Placet' : 'Quitado — aguardando retorno'}</Badge>
    : late ? <Badge variant="overdue">Parcela em atraso</Badge>
    : <Badge variant="warning">Bloqueado — acordo em andamento</Badge>;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-sand-light">{a.memberName}</h2>
          <p className="mt-0.5 text-xs font-medium text-gold">{agreementKindLabel(a.kind)}</p>
          <p className="mt-1 text-xs text-sand-dark">
            Bloqueado em {formatDateOnly(a.blockedAt)} · {a.overdueDaysAtBlock} dias de atraso na época
            {a.powerProtocol ? ` · protocolo ${a.powerProtocol}` : ''}{a.powerSentAt ? ` · comunicado em ${formatDateOnly(a.powerSentAt)}` : ''}
            {a.liftedAt ? ` · liberado em ${formatDateOnly(a.liftedAt)}` : ''}
          </p>
          {a.note ? <p className="mt-1 text-xs text-sand-dark">Obs.: {a.note}</p> : null}
        </div>
        {badge}
      </div>

      {a.brokenAt && a.status === 'open' ? (
        <Alert intent="danger" className="mt-3">
          Acordo quebrado: houve parcela vencida e não paga (alerta enviado em {formatDateOnly(a.brokenAt)}). O irmão segue bloqueado; decidam as medidas cabíveis.
        </Alert>
      ) : null}
      {message ? <Alert intent={message.kind === 'ok' ? 'ok' : 'danger'} className="mt-3">{message.text}</Alert> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-3"><p className="text-xs text-sand-dark">Total do acordo</p><p className="mt-1 text-lg font-semibold tabular-nums text-sand-light">{brl(a.total)}</p></div>
        <div className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-3"><p className="text-xs text-sand-dark">Pago</p><p className="mt-1 text-lg font-semibold tabular-nums text-emerald-300">{brl(a.paid)}</p></div>
        <div className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-3"><p className="text-xs text-sand-dark">Saldo</p><p className="mt-1 text-lg font-semibold tabular-nums text-gold">{brl(a.remaining)}</p></div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Quanto do acordo já foi pago">
        <div className="h-full rounded-full bg-emerald-400/80" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-sand-light">{a.installments > 1 ? `Parcelas (${a.installments}x)` : 'À vista'}</p>
          <ul className="mt-2 space-y-1 text-xs text-sand-dark">
            {a.schedule.map((p) => (
              <li key={p.number} className="flex justify-between gap-3">
                <span>{a.installments > 1 ? `Parcela ${p.number}/${a.installments}` : 'Pagamento'} · {formatDateOnly(p.dueDate)}</span>
                <span className={`tabular-nums ${p.covered ? 'text-emerald-300' : p.late ? 'text-rose-300' : ''}`}>{brl(p.amount)} {p.covered ? '✓' : p.late ? '· atrasada' : ''}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium text-sand-light">O que compõe o acordo</p>
          <ul className="mt-2 space-y-1 text-xs text-sand-dark">
            {a.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span>{i.kind === 'debt' ? `${KIND_LABEL.debt}: ${i.title}` : i.title}</span>
                <span className="tabular-nums">{i.remaining <= 0 ? <span className="text-emerald-300">pago</span> : <>{brl(i.remaining)}{i.remaining < i.openAmount ? ` de ${brl(i.openAmount)}` : ''}</>}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-3 text-xs">
        <span className="font-medium text-sand-light">Termo de acordo</span>
        {AGREEMENT_PARTIES.map((p) => (
          <span key={p.party} className={a.signedParties.includes(p.party) ? 'text-emerald-300' : 'text-sand-dark'}>
            {a.signedParties.includes(p.party) ? '✓' : '○'} {p.label}
          </span>
        ))}
        <span className="ml-auto flex flex-wrap items-center gap-3">
          <Link href={`/dashboard/acordos/${a.id}/termo`} className="text-gold hover:text-gold-light">Abrir termo</Link>
          {a.canSignAs ? <Button type="button" size="sm" onClick={() => void sign()}>Assinar como {partyLabel(a.canSignAs)}</Button> : null}
        </span>
      </div>

      {a.status !== 'lifted' ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {a.status === 'open' && canPay ? <Button type="button" onClick={() => setPaying((v) => !v)}>{paying ? 'Fechar' : 'Registrar pagamento do acordo'}</Button> : null}
          {a.status === 'settled' && mayLift && settlement ? (
            <>
              <Button type="button" onClick={() => setRegularizing((v) => !v)}>{regularizing ? 'Fechar' : 'Regularizar agora'}</Button>
              <Button type="button" onClick={() => void lift('placet')}>Concluir com Placet</Button>
              <Button type="button" onClick={() => void lift()}>Liberar o irmão</Button>
            </>
          ) : null}
          {a.status === 'settled' && mayLift && !settlement ? <Button type="button" onClick={() => void lift()}>Liberar o irmão</Button> : null}
          {a.status === 'settled' && !mayLift ? <p className="text-xs text-sand-dark">Acordo quitado. Só o Venerável ou o Administrador decide o que acontece com o irmão.</p> : null}
          {a.status === 'open' ? <p className="text-xs text-sand-dark">{settlement ? 'As dívidas com a loja precisam ser totalmente pagas; a regularização fica para depois.' : 'O irmão só volta com o acordo totalmente pago.'}</p> : null}
        </div>
      ) : null}
      {regularizing && a.status === 'settled' && settlement ? <RegularizeForm a={a} onDone={(text) => { setRegularizing(false); setMessage({ kind: 'ok', text }); router.refresh(); }} /> : null}
      {paying && a.status === 'open' ? <PaymentForm a={a} banks={banks} onDone={(text) => { setPaying(false); setMessage({ kind: 'ok', text }); router.refresh(); }} /> : null}
    </Card>
  );
}

export default function AcordosClient({ agreements, banks, canPay, mayLift }: { agreements: AgreementView[]; banks: Bank[]; canPay: boolean; mayLift: boolean }) {
  const active = agreements.filter((a) => a.status !== 'lifted');
  const history = agreements.filter((a) => a.status === 'lifted');
  const [showHistory, setShowHistory] = useState(false);

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Acordos de quitação e regularização</h1>
          <p className="mt-1 text-sm text-sand-dark">
            Irmãos bloqueados por comunicado à Potência (Art. 002). O bloqueio é feito pelo Venerável ou pelo Administrador em Relatórios → Inadimplência.
            O acordo pode ser de <strong>quitação de dívidas</strong> com a loja (sem taxa; o irmão segue bloqueado, podendo pedir o Placet ou regularizar depois) ou de <strong>regularização</strong> (dívidas mais a taxa; pago o acordo, o irmão pode ser liberado).
          </p>
        </div>

        {active.length === 0 ? (
          <EmptyState title="Nenhum irmão bloqueado." description="Quando o Venerável bloquear um irmão do Art. 002, o acordo (de quitação ou de regularização) aparece aqui." />
        ) : active.map((a) => <AgreementCard key={a.id} a={a} banks={banks} canPay={canPay} mayLift={mayLift} />)}

        {history.length > 0 ? (
          <section>
            <button type="button" onClick={() => setShowHistory((v) => !v)} className="text-sm text-gold/80 hover:text-gold">
              {showHistory ? 'Ocultar' : 'Ver'} histórico ({history.length} liberado{history.length > 1 ? 's' : ''})
            </button>
            {showHistory ? <div className="mt-4 space-y-6">{history.map((a) => <AgreementCard key={a.id} a={a} banks={banks} canPay={false} mayLift={false} />)}</div> : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
