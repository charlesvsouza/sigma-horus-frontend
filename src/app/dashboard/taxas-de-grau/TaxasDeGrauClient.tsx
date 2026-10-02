'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, EmptyState, Field, inputClass, useConfirm, type BadgeVariant } from '@/components/ui';
import { DEGREE_FEE_KINDS, MAX_INSTALLMENTS, PLAN_SITUATION_LABEL, cardGrossUp, splitInstallments, type CardFees, type DegreeFeeKind, type PlanSituation } from '@/lib/degree-fee';
import type { PresentedPlan } from '@/lib/degree-fee-server';
import { brl } from '@/lib/currency';
import { clampDateYear } from '@/lib/masks';
import { formatDateOnly } from '@/lib/date-only';

export interface EligibleMember { id: string; name: string; kind: DegreeFeeKind; situation: string }

type Tab = 'open' | 'paid_waiting' | 'event_done' | 'canceled' | 'all';
const TABS: { key: Tab; label: string }[] = [
  { key: 'open', label: 'Em pagamento' },
  { key: 'paid_waiting', label: 'Quitados' },
  { key: 'event_done', label: 'Evento realizado' },
  { key: 'canceled', label: 'Cancelados' },
  { key: 'all', label: 'Todos' },
];
const SITUATION_BADGE: Record<PlanSituation, BadgeVariant> = { open: 'pending', paid_waiting: 'success', paid: 'success', event_done: 'info', canceled: 'canceled' };
// A aba "Quitados" junta os dois quitados: aguardando o evento e o quitado sem evento a detectar (filiação).
const tabOf = (s: PlanSituation): Exclude<Tab, 'all'> => (s === 'paid' ? 'paid_waiting' : s);

const today = () => new Date().toISOString().slice(0, 10);
const nextMonthDay10 = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 10)).toISOString().slice(0, 10);
};

type Msg = { kind: 'ok' | 'error'; text: string } | null;

export default function TaxasDeGrauClient({
  plans, eligible, fees, asaasMode, card, prefill,
}: {
  plans: PresentedPlan[];
  eligible: EligibleMember[];
  fees: Record<DegreeFeeKind, number | null>;
  asaasMode: boolean;
  /** Tarifas do cartão (Modo Asaas com cartão ligado); null = só Pix/boleto. */
  card: CardFees | null;
  prefill: { memberId: string; kind: string };
}) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const prefillKind = (DEGREE_FEE_KINDS.some((k) => k.kind === prefill.kind) ? prefill.kind : '') as DegreeFeeKind | '';
  const [tab, setTab] = useState<Tab>('open');
  const [creating, setCreating] = useState(Boolean(prefill.memberId));
  const [form, setForm] = useState({ kind: prefillKind as DegreeFeeKind | '', memberId: prefill.memberId, fourth: '', installments: '1', firstDue: nextMonthDay10(), method: 'standard' as 'standard' | 'card' });
  const [cardLink, setCardLink] = useState<{ name: string; url: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Msg>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [eventDraft, setEventDraft] = useState<Record<string, string>>({});
  const [cancelDraft, setCancelDraft] = useState<{ id: string; reason: string } | null>(null);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { open: 0, paid_waiting: 0, event_done: 0, canceled: 0, all: plans.length };
    for (const p of plans) c[tabOf(p.summary.situation)]++;
    return c;
  }, [plans]);
  const visible = plans.filter((p) => tab === 'all' || tabOf(p.summary.situation) === tab);

  const total = form.kind ? fees[form.kind] : null;
  const n = Number(form.installments);
  const useCard = Boolean(card) && form.method === 'card';
  const gross = useCard && total ? cardGrossUp(total, n, card!) : null;
  const preview = total && form.firstDue
    ? splitInstallments(total, n, new Date(form.firstDue)).map((c) => (gross?.ok ? { ...c, amount: gross.installmentValue } : c))
    : [];
  const choices = eligible.filter((m) => m.kind === form.kind);
  const missingFees = DEGREE_FEE_KINDS.filter((k) => fees[k.kind] == null);
  const notify = (kind: 'ok' | 'error', text: string) => { setMessage({ kind, text }); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  async function call(key: string, url: string, method: string, body?: unknown) {
    setBusy(key);
    setMessage(null);
    const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { notify('error', data.error ?? 'Não foi possível concluir.'); return null; }
    router.refresh();
    return data;
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const member = choices.find((m) => m.id === form.memberId);
    if (!member || !form.kind || !total) return;
    const label = DEGREE_FEE_KINDS.find((k) => k.kind === form.kind)!.label;
    if (!(await askConfirm({
      title: 'Criar plano',
      message: useCard && gross?.ok
        ? `${label} de ${member.name} no CARTÃO: ${n}x de ${brl(gross.installmentValue)} = ${brl(gross.total)} (taxa ${brl(total)} + repasse da tarifa do cartão ${brl(gross.surcharge)}). O Asaas cria o parcelamento agora e o sistema mostra o link para o irmão pagar.`
        : `${label} de ${member.name}: ${brl(total)} em ${n === 1 ? '1 cota (à vista)' : `${n} cotas`}, 1º vencimento em ${formatDateOnly(form.firstDue)}. As cotas entram como cobranças do irmão${asaasMode ? ' e o Asaas emite cada uma perto do vencimento' : ''}.`,
      confirmLabel: 'Criar plano',
    }))) return;
    const data = await call('create', '/api/degree-fees', 'POST', {
      kind: form.kind, memberId: form.memberId, installments: n, firstDueDate: form.firstDue, fourthInstructionDate: form.kind === 'elevation' || form.kind === 'exaltation' ? form.fourth : '',
      paymentMethod: useCard ? 'card' : 'standard',
    });
    if (data?.cardUrl) setCardLink({ name: member.name, url: data.cardUrl });
    if (data) {
      setCreating(false);
      setExpanded(data.id);
      setTab('open');
      notify('ok', data.cardUrl ? 'Parcelamento no cartão criado no Asaas. Envie o link ao irmão e imprima o contrato para ele assinar.' : 'Plano criado. Imprima o contrato para o irmão assinar.');
    }
  }

  async function saveEventDate(p: PresentedPlan) {
    const ok = await call(`event-${p.id}`, `/api/degree-fees/${p.id}`, 'PATCH', { expectedEventDate: eventDraft[p.id] ?? '' });
    if (ok) notify('ok', 'Data prevista salva.');
  }

  async function anticipate(p: PresentedPlan) {
    if (!(await askConfirm({ title: 'Antecipar cotas', message: `As cotas em aberto que venceriam depois de ${formatDateOnly(p.expectedEventDate)} passam a vencer nessa data, para a ${p.label.toLowerCase()} estar quitada até a ${p.event}.`, confirmLabel: 'Antecipar' }))) return;
    const data = await call(`ant-${p.id}`, `/api/degree-fees/${p.id}/anticipate`, 'POST');
    if (data) notify('ok', `${data.moved} cota(s) antecipada(s)${data.skipped ? `; ${data.skipped} já emitida(s) no Asaas ficou(aram) como estava(m)` : ''}.`);
  }

  async function cancel(p: PresentedPlan) {
    if (!cancelDraft?.reason.trim()) { notify('error', 'Informe o motivo do cancelamento.'); return; }
    if (!(await askConfirm({
      title: 'Cancelar plano',
      message: `As cotas em aberto saem${p.summary.paid > 0 ? ` e ${brl(p.summary.paid)} já pagos viram uma conta a pagar ao irmão (devolução), em Contas` : ''}. Não tem volta.`,
      confirmLabel: 'Cancelar plano',
      intent: 'danger',
    }))) return;
    const data = await call(`cancel-${p.id}`, `/api/degree-fees/${p.id}/cancel`, 'POST', { reason: cancelDraft.reason });
    if (data) { setCancelDraft(null); notify('ok', data.refund > 0 ? `Plano cancelado. Devolução de ${brl(data.refund)} lançada em Contas a pagar.` : 'Plano cancelado.'); }
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-sand-light">Taxas de grau</h1>
            <p className="mt-1 max-w-3xl text-sm text-sand-dark">
              Iniciação, elevação, exaltação e filiação/regularização à vista ou em até {MAX_INSTALLMENTS} cotas. O valor fica travado no plano; a taxa deve estar quitada até a data
              do evento. Elevação e exaltação antecipadas a partir da 4ª instrução do grau atual.
            </p>
          </div>
          <Button onClick={() => setCreating((v) => !v)}>{creating ? 'Fechar' : '+ Novo plano'}</Button>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          {DEGREE_FEE_KINDS.map((k) => (
            <span key={k.kind} className="rounded-full border border-white/10 px-3 py-1.5 text-sand-dark">
              {k.label}: <strong className="text-sand-light">{fees[k.kind] != null ? brl(fees[k.kind]!) : 'não configurada'}</strong>
            </span>
          ))}
          <Link href="/dashboard/configuracoes" className="px-1 py-1.5 text-gold hover:text-gold-light">Alterar valores</Link>
        </div>

        {message ? <Alert intent={message.kind === 'ok' ? 'ok' : 'danger'}>{message.text}</Alert> : null}
        {cardLink ? (
          <Alert intent="info">
            Link para {cardLink.name} pagar no cartão:{' '}
            <a href={cardLink.url} target="_blank" rel="noreferrer" className="break-all underline">{cardLink.url}</a>{' '}
            <button type="button" className="underline" onClick={() => void navigator.clipboard?.writeText(cardLink.url)}>Copiar</button>
          </Alert>
        ) : null}
        {missingFees.length === DEGREE_FEE_KINDS.length ? (
          <Alert intent="warn">Configure os valores das taxas em Configurações da loja → Financeiro antes de criar planos.</Alert>
        ) : null}

        {creating ? (
          <form onSubmit={create} className="space-y-4 rounded-xl border border-white/6 bg-sigma-card p-6">
            <h2 className="text-base font-semibold text-sand-light">Novo plano</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Taxa">
                <select required value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as DegreeFeeKind, memberId: '' })} className={inputClass}>
                  <option value="">Escolha…</option>
                  {DEGREE_FEE_KINDS.map((k) => <option key={k.kind} value={k.kind} disabled={fees[k.kind] == null}>{k.label}{fees[k.kind] == null ? ' (sem valor)' : ''}</option>)}
                </select>
              </Field>
              <Field label={form.kind === 'initiation' ? 'Candidato' : form.kind === 'elevation' ? 'Aprendiz' : form.kind === 'exaltation' ? 'Companheiro' : 'Obreiro'}>
                <select required disabled={!form.kind} value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })} className={inputClass}>
                  <option value="">{form.kind ? (choices.length ? 'Escolha…' : 'Ninguém nessa situação') : 'Escolha a taxa primeiro'}</option>
                  {choices.map((m) => <option key={m.id} value={m.id}>{form.kind === 'affiliation' ? `${m.name} — ${m.situation}` : m.name}</option>)}
                </select>
              </Field>
              {form.kind === 'elevation' || form.kind === 'exaltation' ? (
                <Field label={`4ª instrução de ${form.kind === 'elevation' ? 'Aprendiz' : 'Companheiro'} em`}>
                  <input type="date" required max={today()} value={form.fourth} onChange={(e) => setForm({ ...form, fourth: clampDateYear(e.target.value, form.fourth) })} className={inputClass} />
                </Field>
              ) : null}
              {card ? (
                <Field label="Forma de pagamento">
                  <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as 'standard' | 'card' })} className={inputClass}>
                    <option value="standard">Pix ou boleto por cota (sem acréscimo)</option>
                    <option value="card">Cartão de crédito no Asaas (com repasse da tarifa)</option>
                  </select>
                </Field>
              ) : null}
              <Field label="Parcelamento">
                <select value={form.installments} onChange={(e) => setForm({ ...form, installments: e.target.value })} className={inputClass}>
                  {Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1).map((i) => <option key={i} value={i}>{i === 1 ? 'À vista (1 cota)' : `${i} cotas`}</option>)}
                </select>
              </Field>
              <Field label={useCard ? 'Vencimento da 1ª parcela no Asaas' : n === 1 ? 'Vencimento' : 'Vencimento da 1ª cota'}>
                <input type="date" required value={form.firstDue} onChange={(e) => setForm({ ...form, firstDue: clampDateYear(e.target.value, form.firstDue) })} className={inputClass} />
              </Field>
            </div>
            {preview.length > 0 ? (
              <div className="rounded-lg border border-white/5 bg-sigma-blue-deep/40 p-4 text-sm">
                {useCard && gross && !gross.ok ? <p className="text-rose-300">{gross.error}</p> : null}
                <p className="text-sand-light">
                  {useCard && gross?.ok
                    ? <>No cartão: {n}x de {brl(gross.installmentValue)} = {brl(gross.total)} <span className="text-sand-dark">(taxa {brl(total!)} + repasse da tarifa {brl(gross.surcharge)})</span></>
                    : <>Total {brl(total!)} {n > 1 ? `em ${n} cotas` : 'à vista'}</>}
                </p>
                <ul className="mt-2 grid gap-1 text-xs text-sand-dark sm:grid-cols-2">
                  {preview.map((c) => <li key={c.number}>Cota {c.number}: {brl(c.amount)} — vence em {formatDateOnly(c.dueDate.toISOString())}</li>)}
                </ul>
              </div>
            ) : null}
            <p className="text-xs text-sand-dark">
              {useCard
                ? 'No cartão, o irmão paga uma vez pelo link do Asaas e o cartão é cobrado em parcelas; a loja recebe cada parcela mês a mês, já descontada a tarifa (que foi repassada a ele).'
                : <>Cada cota vira uma cobrança comum do irmão: aparece no portal dele, pode ser paga {asaasMode ? 'pelo Pix ou boleto do Asaas (emitido perto do vencimento)' : 'pelo Pix da loja (sem cartão)'} e
                  entra nos lembretes. Ele pode quitar tudo antes — sem acréscimo.</>}
            </p>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy !== null || !form.memberId || !total || (useCard && !gross?.ok)}>{busy === 'create' ? 'Criando…' : 'Criar plano'}</Button>
              <Button type="button" variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
            </div>
          </form>
        ) : null}

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <div role="tablist" aria-label="Situação do plano" className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${tab === t.key ? 'border-gold/60 bg-gold/10 text-gold' : 'border-white/10 text-sand-dark hover:text-sand-light'}`}
              >
                {t.label} <span className="opacity-70">({counts[t.key]})</span>
              </button>
            ))}
          </div>

          <div className="mt-5">
            {visible.length === 0 ? (
              plans.length === 0
                ? <EmptyState title="Nenhum plano de taxa ainda." description="Crie o plano quando o irmão pedir para pagar a taxa — à vista ou parcelada." />
                : <p className="text-sm text-sand-dark">Nenhum plano nesta lista.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {visible.map((p) => {
                  const open = expanded === p.id;
                  const s = p.summary;
                  return (
                    <li key={p.id} className="py-3">
                      <button type="button" onClick={() => setExpanded(open ? null : p.id)} aria-expanded={open} className="flex w-full flex-wrap items-center justify-between gap-3 text-left">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-sand-light">{p.member.name} <span className="font-normal text-sand-dark">· {p.label}</span></p>
                          <p className="mt-0.5 text-xs text-sand-dark">
                            {brl(p.totalAmount)} em {p.installments === 1 ? '1 cota' : `${p.installments} cotas`}{p.paymentMethod === 'card' ? ` no cartão (+ ${brl(p.cardSurcharge ?? 0)} de repasse da tarifa)` : ''} · pago {brl(s.paid)} · em aberto {brl(s.open)}
                            {p.expectedEventDate ? ` · ${p.event} prevista para ${formatDateOnly(p.expectedEventDate)}` : ''}
                          </p>
                          {s.overdue > 0 && s.situation !== 'canceled' ? <p className="mt-0.5 text-xs text-rose-300">{s.overdue} cota(s) vencida(s)</p> : null}
                          {s.cotasAfterEvent > 0 && s.situation === 'open' && p.paymentMethod !== 'card' ? <p className="mt-0.5 text-xs text-amber-300">{s.cotasAfterEvent} cota(s) vencem depois da data prevista da {p.event}</p> : null}
                          {s.eventDoneWithBalance ? <p className="mt-0.5 text-xs text-amber-300">A {p.event} já foi registrada e o plano ainda tem saldo em aberto</p> : null}
                        </div>
                        <Badge variant={SITUATION_BADGE[s.situation]}>{PLAN_SITUATION_LABEL[s.situation]}</Badge>
                      </button>

                      {open ? (
                        <div className="mt-3 space-y-4 rounded-lg border border-white/5 bg-sigma-blue-deep/40 p-4 text-sm">
                          <ul className="space-y-1 text-xs">
                            {p.cotas.map((c) => (
                              <li key={c.id} className="flex flex-wrap justify-between gap-2">
                                <span className="text-sand">{c.title} · vence {formatDateOnly(c.dueDate)}{c.invoiceNumber ? ` · ${c.invoiceNumber}` : ''}{c.emitted ? ' · emitida no Asaas' : ''}</span>
                                <span className={c.status === 'paid' || c.paid >= c.amount ? 'text-emerald-300' : 'text-sand-dark'}>
                                  {brl(c.amount)} · {c.status === 'paid' || c.paid >= c.amount ? `paga${c.paidAt ? ` em ${formatDateOnly(c.paidAt)}` : ''}` : c.paid > 0 ? `pago ${brl(c.paid)}` : 'em aberto'}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <p className="text-xs text-sand-dark">
                            Valor travado em {formatDateOnly(p.createdAt)}{p.fourthInstructionDate ? ` · 4ª instrução em ${formatDateOnly(p.fourthInstructionDate)}` : ''}
                            {p.status === 'canceled' ? ` · cancelado em ${formatDateOnly(p.canceledAt)}: ${p.cancelReason}` : ''}
                          </p>

                          {p.status === 'active' && s.situation !== 'event_done' ? (
                            <div className="flex flex-wrap items-end gap-3">
                              <Field label={`Data prevista da ${p.event}`}>
                                <input
                                  type="date"
                                  value={eventDraft[p.id] ?? (p.expectedEventDate ? p.expectedEventDate.slice(0, 10) : '')}
                                  onChange={(e) => setEventDraft({ ...eventDraft, [p.id]: clampDateYear(e.target.value, eventDraft[p.id] ?? '') })}
                                  className={inputClass}
                                />
                              </Field>
                              <Button size="sm" variant="secondary" disabled={busy !== null || eventDraft[p.id] === undefined} onClick={() => void saveEventDate(p)}>Salvar data</Button>
                              {s.cotasAfterEvent > 0 && p.paymentMethod !== 'card' ? <Button size="sm" disabled={busy !== null} onClick={() => void anticipate(p)}>Antecipar cotas para a data</Button> : null}
                            </div>
                          ) : null}

                          <div className="flex flex-wrap gap-2">
                            <Link href={`/dashboard/taxas-de-grau/${p.id}/contrato`} target="_blank" className="rounded-full border border-gold/40 px-4 py-2 text-xs font-medium text-gold/80 hover:text-gold">Contrato (imprimir)</Link>
                            {p.cardUrl && p.status === 'active' && s.open > 0 ? (
                              <a href={p.cardUrl} target="_blank" rel="noreferrer" className="rounded-full border border-gold/40 px-4 py-2 text-xs font-medium text-gold/80 hover:text-gold">Link do cartão (Asaas)</a>
                            ) : null}
                            {p.status === 'active' && s.situation !== 'event_done' ? (
                              <Button size="sm" variant="ghost" onClick={() => setCancelDraft(cancelDraft?.id === p.id ? null : { id: p.id, reason: '' })}>Cancelar plano</Button>
                            ) : null}
                          </div>

                          {cancelDraft?.id === p.id ? (
                            <div className="space-y-3 rounded-lg border border-rose-500/20 p-3">
                              <Field label="Motivo (vai na devolução)">
                                <input value={cancelDraft.reason} onChange={(e) => setCancelDraft({ id: p.id, reason: e.target.value })} className={inputClass} placeholder="Ex.: desligamento do irmão a pedido" />
                              </Field>
                              <Button size="sm" variant="danger" disabled={busy !== null} onClick={() => void cancel(p)}>{busy === `cancel-${p.id}` ? 'Cancelando…' : 'Confirmar cancelamento'}</Button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
