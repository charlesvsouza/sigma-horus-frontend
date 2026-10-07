'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, EmptyState, Field, FormCard, inputClass, Toast, useConfirm } from '@/components/ui';
import { brl } from '@/lib/currency';

interface Balance { accountId: string; name: string; informed: number; calculated: number }
interface Rectification {
  id: string;
  status: string;
  reason: string;
  dateFrom: string;
  dateTo: string;
  requestedById: string;
  requestedByName: string;
  requestedAt: string;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  selfApproved: boolean;
  expiresAt: string | null;
  usedCount: number;
  lastUsedAt: string | null;
}
interface Mismatch { accountId: string; name: string; informed: number; calculated: number; difference: number }

const STATUS_LABEL: Record<string, string> = { pending: 'Aguardando ciência', approved: 'Aprovada', rejected: 'Não concordou', canceled: 'Cancelada', closed: 'Encerrada' };
const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-300',
  approved: 'bg-emerald-500/10 text-emerald-300',
  rejected: 'bg-rose-500/10 text-rose-300',
  canceled: 'bg-white/5 text-sand-dark',
  closed: 'bg-white/5 text-sand-dark',
};

const day = (key: string) => key.split('-').reverse().join('/');
const dateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

export default function ConferenciaClient({
  role, userId, defaultDate, accounts, checkpoint, drift, rectificationOpen, rectifications,
}: {
  role: string;
  userId: string;
  defaultDate: string;
  accounts: { id: string; name: string }[];
  checkpoint: { throughDate: string; confirmedByName: string; createdAt: string; balances: Balance[] } | null;
  drift: Mismatch[];
  rectificationOpen: boolean;
  rectifications: Rectification[];
}) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const canDecide = role === 'venerable' || role === 'admin';
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [through, setThrough] = useState(defaultDate);
  const [informed, setInformed] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [mismatches, setMismatches] = useState<Mismatch[]>([]);
  const [rect, setRect] = useState({ dateFrom: '', dateTo: '', reason: '' });

  async function call(url: string, method: string, body?: unknown) {
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  }

  async function confirmCheckpoint(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMismatches([]);
    try {
      const { response, data } = await call('/api/ledger/checkpoint', 'POST', { throughDate: through, balances: informed, note });
      if (response.ok) {
        setMessage({ kind: 'ok', text: `Livro conferido até ${day(data.throughDate)}. Lançamentos com data até esse dia agora só mudam com retificação.` });
        setInformed({});
        setNote('');
        router.refresh();
      } else {
        setMismatches(data.mismatches ?? []);
        setMessage({ kind: 'error', text: data.error ?? 'Não foi possível registrar a conferência.' });
      }
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    const ok = await askConfirm({ title: 'Desfazer a conferência', message: 'O livro volta a aceitar lançamentos de qualquer data. Use só se a conferência foi registrada por engano.', confirmLabel: 'Desfazer', intent: 'danger' });
    if (!ok) return;
    setBusy(true);
    try {
      const { response, data } = await call('/api/ledger/checkpoint', 'DELETE');
      setMessage(response.ok ? { kind: 'ok', text: 'Conferência desfeita.' } : { kind: 'error', text: data.error ?? 'Erro ao desfazer.' });
      if (response.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function requestRect(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { response, data } = await call('/api/ledger/rectifications', 'POST', rect);
      if (response.ok) {
        setMessage({ kind: 'ok', text: 'Pedido enviado. O Venerável Mestre foi avisado por e-mail e precisa dar a ciência.' });
        setRect({ dateFrom: '', dateTo: '', reason: '' });
        router.refresh();
      } else {
        setMessage({ kind: 'error', text: data.error ?? 'Erro ao pedir a retificação.' });
      }
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: 'approve' | 'reject' | 'close') {
    const labels = { approve: 'Concordo', reject: 'Não concordo', close: 'Encerrar' } as const;
    const text = {
      approve: 'Você concorda com esta retificação? O Tesoureiro poderá lançar, editar e excluir lançamentos nesse período por 48 horas. Cada alteração fica registrada com o seu nome como quem deu a ciência.',
      reject: 'Não concordar: o pedido é encerrado e o período continua travado.',
      close: 'Encerrar este pedido: o período volta a ficar travado agora.',
    }[action];
    const ok = await askConfirm({ title: labels[action], message: text, confirmLabel: labels[action], intent: action === 'approve' ? 'default' : 'danger' });
    if (!ok) return;
    setBusy(true);
    try {
      const { response, data } = await call(`/api/ledger/rectifications/${id}`, 'PATCH', { action });
      if (response.ok) {
        setMessage({ kind: 'ok', text: action === 'approve' ? (data.selfApproved ? 'Ciência registrada (autoaprovada: não há outro Venerável/Administrador).' : 'Ciência registrada: a retificação está liberada por 48 horas.') : 'Feito.' });
        router.refresh();
      } else {
        setMessage({ kind: 'error', text: data.error ?? 'Erro ao responder o pedido.' });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Conferência com o banco</h1>
          <p className="mt-1 text-sm text-sand-dark">
            Quando o extrato do sistema bate com o do banco até um dia, o Tesoureiro trava esse período. Depois disso, ninguém lança, edita ou exclui nada com data até esse dia sem o pedido de retificação e a ciência do Venerável Mestre.
          </p>
        </div>

        <Toast message={message} onClose={() => setMessage(null)} />

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Situação do livro</h2>
          {checkpoint ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-sand-light">
                Conferido com o banco até <strong className="text-gold">{day(checkpoint.throughDate)}</strong>
                <span className="text-sand-dark"> — por {checkpoint.confirmedByName}, em {dateTime(checkpoint.createdAt)}.</span>
              </p>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {checkpoint.balances.map((b) => (
                  <li key={b.accountId} className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-3">
                    <p className="text-sm text-sand-light">{b.name}</p>
                    <p className="mt-1 tabular-nums text-gold">{brl(b.informed)}</p>
                  </li>
                ))}
              </ul>
              {drift.length > 0 ? (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                  <p className="font-medium">{rectificationOpen ? 'Retificação em andamento: o saldo difere do conferido.' : 'Atenção: o saldo mudou depois da conferência.'}</p>
                  <ul className="mt-2 space-y-1">
                    {drift.map((d) => (
                      <li key={d.accountId}>{d.name}: conferido {brl(d.informed)} · hoje, nesse dia, {brl(d.calculated)} (diferença {brl(d.calculated - d.informed)})</li>
                    ))}
                  </ul>
                  {rectificationOpen ? <p className="mt-2">Ao terminar, registre uma nova conferência com o saldo do banco.</p> : <p className="mt-2">Algum lançamento com data até {day(checkpoint.throughDate)} foi alterado por um caminho que não passou pela trava. Confira o extrato.</p>}
                </div>
              ) : rectificationOpen ? (
                <p className="text-sm text-amber-300">Há uma retificação aprovada em andamento. Ao terminar, registre uma nova conferência.</p>
              ) : (
                <p className="text-sm text-emerald-300">O saldo calculado continua igual ao conferido.</p>
              )}
              {canDecide ? (
                <button disabled={busy} onClick={() => void undo()} className="text-xs text-rose-300 transition hover:text-rose-200 disabled:opacity-40">Desfazer esta conferência (registrada por engano)</button>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-sand-dark">O livro ainda não foi conferido: qualquer data aceita lançamentos. Registre a primeira conferência abaixo quando o extrato bater com o banco.</p>
          )}
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <FormCard title={checkpoint ? 'Nova conferência' : 'Conferir o livro com o banco'}>
            <form onSubmit={confirmCheckpoint} className="mt-5 space-y-4">
              <Field label="Conferido até o dia (inclusive)">
                <input type="date" value={through} onChange={(e) => setThrough(e.target.value)} max={defaultDate} className={inputClass} required />
              </Field>
              <p className="text-xs text-sand-dark">Digite o saldo que o <strong>banco</strong> mostra no fim desse dia, em cada conta. O sistema só trava se bater, ao centavo, com o que ele calculou.</p>
              {accounts.map((a) => (
                <Field key={a.id} label={`Saldo do banco — ${a.name}`}>
                  <input type="number" inputMode="decimal" step="0.01" value={informed[a.id] ?? ''} onChange={(e) => setInformed({ ...informed, [a.id]: e.target.value })} className={inputClass} required />
                </Field>
              ))}
              <Field label="Observação (opcional)">
                <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="Ex.: conferido com o extrato do Santander de 28/09" />
              </Field>
              {mismatches.length > 0 ? (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                  <p className="font-medium">Não bate:</p>
                  <ul className="mt-1 space-y-1">
                    {mismatches.map((m) => (
                      <li key={m.accountId}>{m.name}: banco {brl(m.informed)} · sistema {brl(m.calculated)} (diferença {brl(m.difference)})</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs">Confira os lançamentos até esse dia (Extratos de contas) e tente de novo.</p>
                </div>
              ) : null}
              <Button type="submit" disabled={busy || accounts.length === 0}>{busy ? 'Conferindo…' : 'Conferir e travar o período'}</Button>
              {accounts.length === 0 ? <p className="text-xs text-sand-dark">Cadastre uma conta bancária ou o Caixa em Cadastros financeiros.</p> : null}
            </form>
          </FormCard>

          <FormCard title="Pedir retificação">
            <form onSubmit={requestRect} className="mt-5 space-y-4">
              <p className="text-xs text-sand-dark">Precisa lançar, corrigir ou excluir algo com data dentro do período conferido? Peça aqui. O Venerável Mestre ou o Administrador dão a ciência; aprovado, vale por 48 horas.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Do dia">
                  <input type="date" value={rect.dateFrom} onChange={(e) => setRect({ ...rect, dateFrom: e.target.value })} className={inputClass} required />
                </Field>
                <Field label="Até o dia">
                  <input type="date" value={rect.dateTo} onChange={(e) => setRect({ ...rect, dateTo: e.target.value })} className={inputClass} required />
                </Field>
              </div>
              <Field label="Motivo">
                <textarea value={rect.reason} onChange={(e) => setRect({ ...rect, reason: e.target.value })} className={inputClass} rows={3} placeholder="Explique o que será corrigido e por quê." required />
              </Field>
              <Button type="submit" disabled={busy || !checkpoint}>{busy ? 'Enviando…' : 'Pedir retificação'}</Button>
              {!checkpoint ? <p className="text-xs text-sand-dark">Sem conferência registrada não há o que retificar.</p> : null}
            </form>
          </FormCard>
        </div>

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Pedidos de retificação</h2>
          <div className="mt-4 space-y-3">
            {rectifications.length === 0 ? (
              <EmptyState title="Nenhum pedido até agora." description="Os pedidos de retificação e a ciência do Venerável Mestre aparecem aqui." />
            ) : rectifications.map((r) => (
              <div key={r.id} className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-sand-light">{day(r.dateFrom)} a {day(r.dateTo)}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${STATUS_CLASS[r.status] ?? ''}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
                </div>
                <p className="mt-1 text-sm text-sand">{r.reason}</p>
                <p className="mt-1 text-xs text-sand-dark">
                  Pedido por {r.requestedByName} em {dateTime(r.requestedAt)}
                  {r.decidedByName ? ` · ${r.status === 'rejected' ? 'não concordou' : 'ciência de'} ${r.decidedByName}${r.decidedAt ? ` em ${dateTime(r.decidedAt)}` : ''}${r.selfApproved ? ' (autoaprovada)' : ''}` : ''}
                  {r.status === 'approved' && r.expiresAt ? ` · vale até ${dateTime(r.expiresAt)}` : ''}
                  {r.usedCount > 0 ? ` · ${r.usedCount} alteração(ões) feita(s)${r.lastUsedAt ? `, a última em ${dateTime(r.lastUsedAt)}` : ''}` : ''}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {r.status === 'pending' && canDecide ? (
                    <>
                      <button disabled={busy} onClick={() => void act(r.id, 'approve')} className="px-1 py-1 text-xs text-emerald-300 transition hover:text-emerald-200 disabled:opacity-40">Concordo</button>
                      <button disabled={busy} onClick={() => void act(r.id, 'reject')} className="px-1 py-1 text-xs text-rose-300 transition hover:text-rose-200 disabled:opacity-40">Não concordo</button>
                    </>
                  ) : null}
                  {(r.status === 'pending' && r.requestedById === userId) || r.status === 'approved' ? (
                    <button disabled={busy} onClick={() => void act(r.id, 'close')} className="px-1 py-1 text-xs text-sand-dark transition hover:text-sand-light disabled:opacity-40">{r.status === 'pending' ? 'Cancelar pedido' : 'Encerrar retificação'}</button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
