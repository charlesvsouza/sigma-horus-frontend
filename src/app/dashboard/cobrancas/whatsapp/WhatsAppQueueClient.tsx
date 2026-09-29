'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, EmptyState, inputClass } from '@/components/ui';
import { fetchWhatsAppShare, WhatsAppSendDialog, type WhatsAppShare } from '@/components/whatsapp-send-dialog';
import type { ChargeUrgency } from '@/lib/charge-notice';
import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';

export interface QueueRow {
  id: string;
  number: string;
  title: string;
  memberName: string;
  hasPhone: boolean;
  balance: number;
  dueDate: string;
  urgency: ChargeUrgency;
  lastSentAt: string | null;
}

type Filter = 'all' | 'dueSoon' | 'overdue';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todas em aberto' },
  { id: 'dueSoon', label: 'A vencer (3 dias)' },
  { id: 'overdue', label: 'Vencidas' },
];

const URGENCY_ORDER: Record<ChargeUrgency, number> = { overdue: 0, dueSoon: 1, later: 2 };

function sentLabel(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function WhatsAppQueueClient({ rows, hasPixKey }: { rows: QueueRow[]; hasPixKey: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [hideSent, setHideSent] = useState(true);
  const [search, setSearch] = useState('');
  const [share, setShare] = useState<WhatsAppShare | null>(null);
  const [loadingId, setLoadingId] = useState('');
  const [error, setError] = useState('');
  // Marcação imediata ao abrir o WhatsApp (o router.refresh traz a data do servidor em seguida).
  const [sentNow, setSentNow] = useState<Record<string, string>>({});

  const withSent = rows.map((r) => ({ ...r, lastSentAt: sentNow[r.id] ?? r.lastSentAt }));
  const count = (f: Filter) => withSent.filter((r) => f === 'all' || r.urgency === f).length;
  const q = search.trim().toLowerCase();
  const visible = withSent
    .filter((r) => filter === 'all' || r.urgency === filter)
    .filter((r) => !hideSent || !r.lastSentAt)
    .filter((r) => !q || r.memberName.toLowerCase().includes(q) || r.number.toLowerCase().includes(q))
    .sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] || a.dueDate.localeCompare(b.dueDate) || a.memberName.localeCompare(b.memberName));
  const hiddenSent = withSent.filter((r) => (filter === 'all' || r.urgency === filter) && r.lastSentAt).length;

  async function open(id: string) {
    setLoadingId(id);
    setError('');
    const result = await fetchWhatsAppShare(id);
    setLoadingId('');
    if (result.ok) setShare(result.share);
    else setError(result.error);
  }

  function markSent(id: string) {
    setSentNow((prev) => ({ ...prev, [id]: new Date().toISOString() }));
    router.refresh();
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Envio pelo WhatsApp</h1>
          <p className="mt-1 max-w-3xl text-sm text-sand-dark">
            Cobranças em aberto, irmão por irmão. &quot;Enviar&quot; abre a conversa no WhatsApp com a mensagem e o Pix copia e cola prontos — você só aperta Enviar,
            do seu número. O Pix cai direto na conta da loja; a baixa continua em Pagamentos.
          </p>
          <Link href="/dashboard/cobrancas" className="mt-2 inline-block text-xs text-gold transition hover:text-gold-light">← Voltar para Cobranças</Link>
        </div>

        {!hasPixKey ? <Alert intent="warn">A loja não tem chave Pix cadastrada: as mensagens vão com os dados bancários. Cadastre a chave em Configurações da loja para enviar o Pix pronto.</Alert> : null}
        {error ? <Alert intent="danger">{error}</Alert> : null}

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar cobranças">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs transition ${filter === f.id ? 'border-gold/60 bg-gold/10 text-gold' : 'border-white/10 text-sand-dark hover:text-sand-light'}`}
                >
                  {f.label} <span className="tabular-nums">({count(f.id)})</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-sand">
                <input type="checkbox" checked={hideSent} onChange={(e) => setHideSent(e.target.checked)} className="accent-gold" />
                Ocultar as já enviadas{hiddenSent > 0 && hideSent ? ` (${hiddenSent})` : ''}
              </label>
              <input aria-label="Buscar irmão ou cobrança" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar irmão ou cobrança…" className={`${inputClass} max-w-xs`} />
            </div>
          </div>

          <div className="mt-5">
            {rows.length === 0 ? (
              <EmptyState title="Nenhuma cobrança em aberto." description="Quando houver cobranças pendentes de irmãos, elas aparecem aqui para envio." />
            ) : visible.length === 0 ? (
              <p className="text-sm text-sand-dark">Nada a enviar neste filtro{hideSent && hiddenSent > 0 ? ' — todas já foram enviadas (desmarque "Ocultar as já enviadas" para reenviar)' : ''}.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-white/8 text-left text-xs text-sand-dark">
                      <th className="py-2 pr-3 font-medium">Irmão</th>
                      <th className="py-2 pr-3 font-medium">Cobrança</th>
                      <th className="py-2 pr-3 text-right font-medium">Saldo</th>
                      <th className="py-2 pr-3 font-medium">Vencimento</th>
                      <th className="py-2 pr-3 font-medium">Último envio</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => (
                      <tr key={r.id} className="border-b border-white/5 last:border-0">
                        <td className="py-3 pr-3 text-sand-light">
                          {r.memberName}
                          {!r.hasPhone ? <span className="ml-2 text-xs text-amber-300">sem celular</span> : null}
                        </td>
                        <td className="py-3 pr-3 text-xs text-sand-dark">
                          <span className="text-sand">{r.number}</span>
                          {r.title ? <span className="block">{r.title}</span> : null}
                        </td>
                        <td className="py-3 pr-3 text-right tabular-nums text-sand">{brl(r.balance)}</td>
                        <td className={`py-3 pr-3 text-xs ${r.urgency === 'overdue' ? 'text-rose-300' : r.urgency === 'dueSoon' ? 'text-amber-300' : 'text-sand-dark'}`}>
                          {formatDateOnly(r.dueDate)}
                          {r.urgency === 'overdue' ? ' · vencida' : r.urgency === 'dueSoon' ? ' · a vencer' : ''}
                        </td>
                        <td className="py-3 pr-3 text-xs text-sand-dark">{r.lastSentAt ? sentLabel(r.lastSentAt) : '—'}</td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => void open(r.id)}
                            disabled={loadingId === r.id}
                            className="rounded-full border border-emerald-400/40 px-3 py-1 text-xs font-medium text-emerald-300 transition hover:border-emerald-300/70 hover:text-emerald-200 disabled:opacity-40"
                          >
                            {loadingId === r.id ? 'Preparando…' : r.lastSentAt ? 'Reenviar' : 'Enviar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
      {share ? <WhatsAppSendDialog key={share.invoiceId} share={share} onClose={() => setShare(null)} onSent={markSent} /> : null}
    </main>
  );
}
