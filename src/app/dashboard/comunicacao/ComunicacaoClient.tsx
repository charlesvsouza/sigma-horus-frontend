'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, EmptyState, FormCard, inputClass, Alert, CollapsibleCard } from '@/components/ui';
import { MESSAGE_STATUS_LABEL } from '@/lib/status-labels';

interface MessageItem {
  id: string;
  title: string;
  channel: string;
  content: string;
  status: string;
  error: string | null;
  createdAt: string;
  member?: { name: string } | null;
}

const CHANNEL_LABEL: Record<string, string> = { email: 'E-mail', whatsapp: 'WhatsApp', sms: 'SMS' };

export default function ComunicacaoClient({ items, members }: { items: MessageItem[]; members: { id: string; name: string }[] }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState('email');
  const [content, setContent] = useState('');
  const [memberId, setMemberId] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, channel, content, memberId }),
      });
      const data = await response.json();
      if (response.ok) {
        const s = data.stats as { sent: number; queued: number; failed: number; skipped: number } | undefined;
        const parts: string[] = [];
        if (s) {
          if (s.sent) parts.push(`${s.sent} enviada${s.sent > 1 ? 's' : ''}`);
          if (s.queued) parts.push(`${s.queued} na fila (canal não conectado nesta loja)`);
          if (s.failed) parts.push(`${s.failed} falhou/falharam`);
          if (s.skipped) parts.push(`${s.skipped} sem contato cadastrado`);
        }
        setMessage({ kind: s?.failed || s?.queued ? 'error' : 'ok', text: parts.length ? parts.join(', ') + '.' : 'Mensagem enviada com sucesso.' });
        setTitle('');
        setChannel('email');
        setContent('');
        setMemberId('');
        router.refresh();
      } else {
        setMessage({ kind: 'error', text: data.error ?? 'Erro ao registrar comunicação.' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const INPUT = inputClass; // fonte única do design system

  const q = search.trim().toLowerCase();
  const filteredItems = q
    ? items.filter((item) => item.title.toLowerCase().includes(q) || item.member?.name.toLowerCase().includes(q) || item.channel.toLowerCase().includes(q))
    : items;

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Comunicação</h1>
          <p className="mt-1 text-sm text-sand-dark">Crie lembretes, convocações e avisos para membros e gestores da loja.</p>
        </div>

        {message ? <Alert intent={message.kind === 'ok' ? 'ok' : 'danger'}>{message.text}</Alert> : null}

        <div className="grid items-start gap-6 lg:grid-cols-2">
        <FormCard title="Nova comunicação">
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <input value={title} onChange={(event) => setTitle(event.target.value)} className={INPUT} placeholder="Título da mensagem" required />
              <select value={channel} onChange={(event) => setChannel(event.target.value)} className={INPUT}>
                <option value="email">E-mail</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
              </select>
              <select value={memberId} onChange={(event) => setMemberId(event.target.value)} className={`${INPUT} md:col-span-2`}>
                <option value="">Enviar a todos ou a um membro</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
              <textarea value={content} onChange={(event) => setContent(event.target.value)} className={`${INPUT} md:col-span-2`} placeholder="Texto da comunicação" rows={4} />
            </div>
            <Button type="submit" disabled={submitting}>{submitting ? 'Enviando…' : 'Enviar'}</Button>
          </form>
        </FormCard>

        <CollapsibleCard
          title="Histórico"
          count={items.length}
          headerAction={items.length > 0 ? <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título, membro ou canal…" className={`${INPUT} max-w-56`} /> : undefined}
        >
          <div className="max-h-128 space-y-3 overflow-y-auto pr-1">
            {items.length === 0 ? (
              <EmptyState title="Os arautos ainda não partiram." description="As mensagens enviadas aos membros aparecem aqui. O envio externo (WhatsApp/e-mail) chega na Fase 7." />
            ) : filteredItems.length === 0 ? (
              <p className="text-sm text-sand-dark">Nenhuma mensagem encontrada para &quot;{search}&quot;.</p>
            ) : filteredItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-4 transition-colors hover:border-white/8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-sand-light">{item.title}</p>
                    <p className="mt-1 text-xs text-sand-dark">
                      {CHANNEL_LABEL[item.channel] ?? item.channel} • {item.member?.name ?? 'Todos'} • {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <p className={`text-sm ${item.status === 'sent' ? 'text-sand-dark' : item.status === 'failed' ? 'text-rose-300' : 'text-amber-300'}`} title={item.error ?? undefined}>
                    {MESSAGE_STATUS_LABEL[item.status] ?? item.status}
                  </p>
                </div>
                <p className="mt-2 text-sm text-sand">{item.content}</p>
                {item.error ? <p className="mt-1.5 text-xs text-sand-dark/70">Motivo: {item.error}</p> : null}
              </div>
            ))}
          </div>
        </CollapsibleCard>
        </div>
      </div>
    </main>
  );
}
