'use client';

import { useEffect, useState } from 'react';
import { Button, EmptyState, inputClass } from '@/components/ui';

interface DocumentItem {
  id: string;
  title: string;
  kind: string;
  content?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  storageKey?: string | null;
  member?: { name: string } | null;
}

export default function DocumentosPage() {
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('document');
  const [content, setContent] = useState('');
  const [memberId, setMemberId] = useState('');
  const [file, setFile] = useState<File | null>(null);
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

    if (!file) {
      setMessage('Selecione um arquivo antes de salvar.');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('kind', kind);
    formData.append('content', content);
    if (memberId) formData.append('memberId', memberId);
    formData.append('file', file);

    const response = await fetch('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();
    if (response.ok) {
      setMessage('Documento enviado e registrado com sucesso.');
      setTitle('');
      setKind('document');
      setContent('');
      setMemberId('');
      setFile(null);
      await load();
    } else {
      setMessage(data.error ?? 'Erro ao registrar documento.');
    }
  }

  const INPUT = inputClass; // fonte única do design system

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-sand-light">Documentos</h1>
          <p className="mt-1 text-sm text-sand-dark">Centralize atas, prontuários, comprovantes e arquivos da loja.</p>
        </div>

        {message ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div> : null}

        <section className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
          <h2 className="text-base font-semibold text-sand-light">Novo documento</h2>
          <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
            <input value={title} onChange={(event) => setTitle(event.target.value)} className={INPUT} placeholder="Título" required />
            <select value={kind} onChange={(event) => setKind(event.target.value)} className={INPUT}>
              <option value="document">Documento</option>
              <option value="minutes">Ata</option>
              <option value="certificate">Certificado</option>
              <option value="receipt">Comprovante</option>
            </select>
            <select value={memberId} onChange={(event) => setMemberId(event.target.value)} className={INPUT}>
              <option value="">Vincular a um membro</option>
              {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
            <label className="rounded-lg border border-dashed border-white/[8%] bg-sigma-blue-deep/60 px-4 py-3 text-sm text-sand md:col-span-2">
              <span className="mb-2 block font-medium text-sand-light">Arquivo</span>
              <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="w-full" />
            </label>
            <textarea value={content} onChange={(event) => setContent(event.target.value)} className={`${INPUT} md:col-span-2`} placeholder="Resumo ou conteúdo do documento" rows={4} />
            <Button type="submit" className="md:col-span-2">Enviar e salvar documento</Button>
          </form>
        </section>

        <section className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
          <h2 className="text-base font-semibold text-sand-light">Arquivos e atas</h2>
          <div className="mt-5 space-y-3">
            {items.length === 0 ? (
              <EmptyState title="Nenhum documento registrado" description="Envie atas, comprovantes e certificados; ficam guardados com segurança e acesso por papel." />
            ) : items.map((item) => (
              <div key={item.id} className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-4 transition-colors hover:border-white/[8%]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-sand-light">{item.title}</p>
                    <p className="mt-1 text-xs text-sand-dark">{item.kind} • {item.member?.name ?? 'Sem vínculo'}</p>
                    {item.storageKey ? <a href={`/api/documents/${item.id}/download`} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm text-gold hover:text-gold-light">Abrir arquivo</a> : null}
                  </div>
                  <p className="max-w-2xl text-sm text-sand-dark">{item.content ?? 'Sem resumo.'}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
