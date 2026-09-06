'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, EmptyState, FormCard, inputClass, Alert, CollapsibleCard } from '@/components/ui';

interface MessageItem {
  id: string;
  title: string;
  channel: string;
  content: string;
  status: string;
  member?: { name: string } | null;
}

export default function ComunicacaoClient({ items, members }: { items: MessageItem[]; members: { id: string; name: string }[] }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState('email');
  const [content, setContent] = useState('');
  const [memberId, setMemberId] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
        setMessage({ kind: 'ok', text: 'Mensagem agendada com sucesso.' });
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

        <CollapsibleCard title="Histórico" count={items.length}>
          <div className="space-y-3">
            {items.length === 0 ? (
              <EmptyState title="Nenhuma comunicação registrada" description="As mensagens enviadas aos membros aparecem aqui. O envio externo (WhatsApp/e-mail) chega na Fase 7." />
            ) : items.map((item) => (
              <div key={item.id} className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-4 transition-colors hover:border-white/[8%]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-sand-light">{item.title}</p>
                    <p className="mt-1 text-xs text-sand-dark">{item.channel} • {item.member?.name ?? 'Todos'}</p>
                  </div>
                  <p className="text-sm text-sand-dark">{item.status}</p>
                </div>
                <p className="mt-2 text-sm text-sand">{item.content}</p>
              </div>
            ))}
          </div>
        </CollapsibleCard>
        </div>
      </div>
    </main>
  );
}
