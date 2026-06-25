'use client';

import { useEffect, useState } from 'react';

interface DocumentItem {
  id: string;
  title: string;
  kind: string;
  content?: string | null;
  member?: { name: string } | null;
}

export default function DocumentosPage() {
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('document');
  const [content, setContent] = useState('');
  const [memberId, setMemberId] = useState('');
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [message, setMessage] = useState('');

  async function load() {
    const [documentsResponse, membersResponse] = await Promise.all([
      fetch('/api/documents'),
      fetch('/api/members'),
    ]);
    const documentsData = await documentsResponse.json();
    const membersData = await membersResponse.json();
    setItems(documentsData.items ?? []);
    setMembers(membersData.items ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, kind, content, memberId }),
    });
    const data = await response.json();
    if (response.ok) {
      setMessage('Documento registrado com sucesso.');
      setTitle('');
      setKind('document');
      setContent('');
      setMemberId('');
      await load();
    } else {
      setMessage(data.error ?? 'Erro ao registrar documento.');
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Documentos</h1>
          <p className="mt-3 text-slate-400">Centralize atas, prontuários, comprovantes e arquivos da loja.</p>
        </div>

        {message ? <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div> : null}

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Novo documento</h2>
          <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Título" required />
            <select value={kind} onChange={(event) => setKind(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3">
              <option value="document">Documento</option>
              <option value="minutes">Ata</option>
              <option value="certificate">Certificado</option>
              <option value="receipt">Comprovante</option>
            </select>
            <select value={memberId} onChange={(event) => setMemberId(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3">
              <option value="">Vincular a um membro</option>
              {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
            <textarea value={content} onChange={(event) => setContent(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 md:col-span-2" placeholder="Resumo ou conteúdo do documento" rows={4} />
            <button type="submit" className="rounded-full bg-amber-400 px-5 py-3 font-medium text-slate-950 md:col-span-2">Salvar documento</button>
          </form>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Arquivos e atas</h2>
          <div className="mt-6 space-y-3">
            {items.length === 0 ? <p className="text-sm text-slate-500">Nenhum documento registrado.</p> : items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-slate-400">{item.kind} • {item.member?.name ?? 'Sem vínculo'}</p>
                  </div>
                  <p className="max-w-2xl text-sm text-slate-500">{item.content ?? 'Sem resumo.'}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
