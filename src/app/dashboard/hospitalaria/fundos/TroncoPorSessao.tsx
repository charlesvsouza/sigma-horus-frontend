'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, inputClass } from '@/components/ui';
import { brl } from '@/lib/currency';
import { TRONCO_CHANNEL_LABEL, type TroncoChannel } from '@/lib/tronco-session';

export interface TroncoSessionItem { sessionId: string; title: string | null; date: string | null; confirmed: number; pending: number; members: number; visitors: number; mixed: number }
export interface PendingIntake { id: string; code: string; amount: number; channel: string; sessionLabel: string | null; declaredBy: string | null; declaredAt: string }

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');

// Tronco de Solidariedade por sessão (sem doador): o confirmado, o que ainda aguarda lançamento e a divisão por origem.
// Todos os cargos que abrem o fundo veem os totais; lançar no caixa ou recusar é do Tesoureiro, do Venerável e do Administrador.
export default function TroncoPorSessao({
  sessions, pending, accounts, canConfirm,
}: {
  sessions: TroncoSessionItem[];
  pending: PendingIntake[];
  accounts: { id: string; name: string; isDefault: boolean }[];
  canConfirm: boolean;
}) {
  const router = useRouter();
  const [bank, setBank] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const defaultBank = (accounts.find((a) => a.isDefault) ?? accounts[0])?.id ?? '';
  const total = sessions.reduce((s, r) => s + r.confirmed, 0);

  async function act(id: string, kind: 'confirm' | 'reject') {
    setBusy(id);
    setMessage(null);
    const body = kind === 'confirm' ? { bankAccountId: bank[id] ?? defaultBank } : { reason: reason[id] ?? '' };
    const res = await fetch(`/api/tronco/intakes/${id}/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setMessage({ kind: 'error', text: data.error ?? 'Não foi possível concluir.' }); return; }
    setMessage({ kind: 'ok', text: kind === 'confirm' ? 'Lançado no caixa.' : 'Entrada recusada.' });
    router.refresh();
  }

  return (
    <section aria-labelledby="tronco-sessao" className="mx-auto max-w-6xl space-y-4 px-6 pb-12">
      <div className="rounded-xl border border-white/6 bg-sigma-card p-6">
        <h2 id="tronco-sessao" className="text-base font-semibold text-sand-light">Tronco por sessão</h2>
        <p className="mt-1 text-xs text-sand-dark">Quanto entrou no Tronco em cada sessão, sem identificar doadores. Soma lançada: <strong className="tabular-nums text-gold">{brl(total)}</strong>.</p>
        {message ? <div className="mt-3"><Alert intent={message.kind === 'ok' ? 'ok' : 'danger'}>{message.text}</Alert></div> : null}

        {sessions.length === 0 ? (
          <p className="mt-4 text-sm text-sand-dark">Nenhuma entrada ligada a uma sessão ainda. Ao registrar um aporte, escolha a sessão em que o tronco foi passado.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-sand-dark/70">
                  <th className="border-b border-white/10 px-2 py-2">Sessão</th>
                  <th className="border-b border-white/10 px-2 py-2 text-right">Lançado</th>
                  <th className="border-b border-white/10 px-2 py-2 text-right">Obreiros</th>
                  <th className="border-b border-white/10 px-2 py-2 text-right">Visitantes</th>
                  <th className="border-b border-white/10 px-2 py-2 text-right">Sem divisão</th>
                  <th className="border-b border-white/10 px-2 py-2 text-right">Aguardando</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((r) => (
                  <tr key={r.sessionId}>
                    <td className="border-b border-white/5 px-2 py-2 text-sand">{fmtDate(r.date)} — {r.title ?? 'Sessão'}</td>
                    <td className="border-b border-white/5 px-2 py-2 text-right tabular-nums text-sand-light">{brl(r.confirmed)}</td>
                    <td className="border-b border-white/5 px-2 py-2 text-right tabular-nums text-sand-dark">{brl(r.members)}</td>
                    <td className="border-b border-white/5 px-2 py-2 text-right tabular-nums text-sand-dark">{brl(r.visitors)}</td>
                    <td className="border-b border-white/5 px-2 py-2 text-right tabular-nums text-sand-dark">{brl(r.mixed)}</td>
                    <td className={`border-b border-white/5 px-2 py-2 text-right tabular-nums ${r.pending > 0 ? 'text-amber-300' : 'text-sand-dark/50'}`}>{brl(r.pending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pending.length > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
          <h3 className="text-sm font-semibold text-amber-200">Entradas aguardando confirmação ({pending.length})</h3>
          <p className="mt-1 text-xs text-sand-dark">{canConfirm ? 'Confira o valor e lance no caixa (escolhendo a conta que recebeu), ou recuse com o motivo.' : 'Só o Tesoureiro, o Venerável e o Administrador confirmam.'}</p>
          <ul className="mt-3 divide-y divide-white/5">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-sand-light"><span className="tabular-nums">{brl(p.amount)}</span> <span className="font-mono text-xs text-sand-dark">{p.code}</span></p>
                  <p className="text-xs text-sand-dark">{TRONCO_CHANNEL_LABEL[p.channel as TroncoChannel] ?? p.channel}{p.sessionLabel ? ` · ${p.sessionLabel}` : ''}{p.declaredBy ? ` · declarada por ${p.declaredBy}` : ''} · {fmtDate(p.declaredAt)}</p>
                </div>
                {canConfirm ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <select aria-label={`Conta que recebeu — ${p.code}`} value={bank[p.id] ?? defaultBank} onChange={(e) => setBank((b) => ({ ...b, [p.id]: e.target.value }))} className={`${inputClass} w-auto`}>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <Button size="sm" disabled={busy === p.id} onClick={() => void act(p.id, 'confirm')}>{busy === p.id ? '…' : 'Lançar no caixa'}</Button>
                    <input aria-label={`Motivo da recusa — ${p.code}`} value={reason[p.id] ?? ''} onChange={(e) => setReason((r) => ({ ...r, [p.id]: e.target.value }))} placeholder="Motivo para recusar" className={`${inputClass} w-44`} />
                    <Button size="sm" variant="ghost" disabled={busy === p.id || !(reason[p.id] ?? '').trim()} onClick={() => void act(p.id, 'reject')}>Recusar</Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
