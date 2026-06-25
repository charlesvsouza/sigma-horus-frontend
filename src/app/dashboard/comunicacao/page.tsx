'use client';

import { useEffect, useState } from 'react';

interface MessageItem {
  id: string;
  title: string;
  channel: string;
  content: string;
  status: string;
  member?: { name: string } | null;
}

export default function ComunicacaoPage() {
  const [items, setItems] = useState<MessageItem[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState('email');
  const [content, setContent] = useState('');
  const [memberId, setMemberId] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const [messagesResponse, membersResponse] = await Promise.all([
      fetch('/api/messages'),
      fetch('/api/members'),
    ]);
    const messagesData = await messagesResponse.json();
    const membersData = await membersResponse.json();
    setItems(messagesData.items ?? []);
    setMembers(membersData.items ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, channel, content, memberId }),
    });
    const data = await response.json();
    if (response.ok) {
      setMessage('Mensagem agendada com sucesso.');
      setTitle('');
      setChannel('email');
      setContent('');
      setMemberId('');
      await load();
    } else {
      setMessage(data.error ?? 'Erro ao registrar comunicação.');
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Comunicação</h1>
          <p className="mt-3 text-slate-400">Crie lembretes, convocações e avisos para membros e gestores da loja.</p>
        </div>

        {message ? <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div> : null}

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Nova comunicação</h2>
          <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Título da mensagem" required />
            <select value={channel} onChange={(event) => setChannel(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3">
              <option value="email">E-mail</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
            </select>
            <select value={memberId} onChange={(event) => setMemberId(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3">
              <option value="">Enviar a todos ou a um membro</option>
              {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
            <textarea value={content} onChange={(event) => setContent(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 md:col-span-2" placeholder="Texto da comunicação" rows={4} />
            <button type="submit" className="rounded-full bg-amber-400 px-5 py-3 font-medium text-slate-950 md:col-span-2">Enviar</button>
          </form>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Histórico</h2>
          <div className="mt-6 space-y-3">
            {items.length === 0 ? <p className="text-sm text-slate-500">Nenhuma comunicação registrada.</p> : items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-slate-400">{item.channel} • {item.member?.name ?? 'Todos'}</p>
                  </div>
                  <p className="text-sm text-slate-500">{item.status}</p>
                </div>
                <p className="mt-2 text-sm text-slate-400">{item.content}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
