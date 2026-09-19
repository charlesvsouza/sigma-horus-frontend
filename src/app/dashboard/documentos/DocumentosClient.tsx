'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, EmptyState, FormCard, inputClass, Alert, CollapsibleCard, useConfirm } from '@/components/ui';
import { DOCUMENT_KIND_LABEL } from '@/lib/status-labels';

import { DOCUMENT_CATEGORY_SUGGESTIONS as DOCUMENT_CATEGORIES, isInternalCategory } from '@/lib/documents';

interface DocumentItem {
  id: string;
  title: string;
  kind: string;
  category?: string | null;
  content?: string | null;
  storageKey?: string | null;
  member?: { name: string } | null;
}

export default function DocumentosClient({ items, members }: { items: DocumentItem[]; members: { id: string; name: string }[] }) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('document');
  const [category, setCategory] = useState('');
  const [content, setContent] = useState('');
  const [memberId, setMemberId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function uploadOne(file: File) {
    try {
      // 1) Pede uma URL assinada e sobe o arquivo DIRETO pro R2 (nunca passa
      // pela function do Vercel, que rejeita corpo acima de 4,5MB — inviável
      // pra PDFs/atas digitalizadas maiores que isso).
      const mimeType = file.type || 'application/octet-stream';
      const urlRes = await fetch('/api/documents/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, mimeType }),
      });
      const urlData = await urlRes.json().catch(() => ({}));
      if (!urlRes.ok) return { ok: false, error: urlData.error as string | undefined };

      let putRes: Response;
      try {
        putRes = await fetch(urlData.uploadUrl, { method: 'PUT', headers: { 'Content-Type': mimeType }, body: file });
      } catch {
        // Falha de rede/CORS: o navegador bloqueia o PUT cross-origin antes de
        // gerar uma resposta HTTP de verdade — cai aqui, não no `!putRes.ok`.
        return { ok: false, error: 'O navegador bloqueou o envio direto ao storage — confira se o CORS do bucket R2 inclui exatamente este domínio (https://sigmahorus.com.br) e o método PUT.' };
      }
      if (!putRes.ok) {
        return { ok: false, error: `Falha ao enviar o arquivo para o storage (HTTP ${putRes.status}). Confira a configuração de CORS do bucket.` };
      }

      // 2) Só agora registra os metadados (corpo pequeno) — o arquivo já está no R2.
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Com vários arquivos, o título de cada um vira "Título — nome do arquivo"
          // pra não cadastrar N documentos com o mesmo título e sem distinção na lista.
          title: files.length > 1 ? `${title} — ${file.name}` : title,
          kind,
          category: category || undefined,
          content,
          memberId: memberId || undefined,
          storageKey: urlData.storageKey,
          fileName: file.name,
          mimeType,
          fileUrl: urlData.publicUrl,
        }),
      });
      const data = await response.json().catch(() => ({}));
      return { ok: response.ok, error: data.error as string | undefined };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Erro inesperado ao enviar o arquivo.' };
    }
  }

  async function removeDocument(item: DocumentItem) {
    if (!(await askConfirm({ title: 'Remover documento', message: `Remover "${item.title}"? O arquivo também é apagado do storage. Esta ação não pode ser desfeita.`, confirmLabel: 'Remover', intent: 'danger' }))) return;
    setRemovingId(item.id);
    const res = await fetch(`/api/documents/${item.id}`, { method: 'DELETE' });
    setRemovingId(null);
    if (res.ok) {
      setMessage({ kind: 'ok', text: 'Documento removido.' });
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao remover documento.' });
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (files.length === 0) {
      setMessage({ kind: 'error', text: 'Selecione ao menos um arquivo antes de salvar.' });
      return;
    }

    setSubmitting(true);
    try {
      const results = await Promise.all(files.map(uploadOne));
      const failed = results.filter((r) => !r.ok);

      if (failed.length === 0) {
        setMessage({ kind: 'ok', text: files.length > 1 ? `${files.length} documentos enviados e registrados com sucesso.` : 'Documento enviado e registrado com sucesso.' });
        setTitle('');
        setKind('document');
        setCategory('');
        setContent('');
        setMemberId('');
        setFiles([]);
        router.refresh();
      } else if (failed.length === results.length) {
        setMessage({ kind: 'error', text: failed[0].error ?? 'Erro ao registrar documento.' });
      } else {
        setMessage({ kind: 'error', text: `${results.length - failed.length} de ${results.length} arquivos enviados. ${failed.length} falharam: ${failed[0].error ?? 'erro desconhecido'}.` });
        router.refresh();
      }
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Erro inesperado ao enviar o(s) documento(s).' });
    } finally {
      setSubmitting(false);
    }
  }

  const INPUT = inputClass; // fonte única do design system

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Documentos</h1>
          <p className="mt-1 text-sm text-sand-dark">Centralize atas, prontuários, comprovantes e arquivos da loja.</p>
        </div>

        {message ? <Alert intent={message.kind === 'ok' ? 'ok' : 'danger'}>{message.text}</Alert> : null}

        <div className="grid items-start gap-6 lg:grid-cols-2">
        <FormCard title="Novo documento">
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <input value={title} onChange={(event) => setTitle(event.target.value)} className={INPUT} placeholder="Título" required />
              <select value={kind} onChange={(event) => setKind(event.target.value)} className={INPUT}>
                <option value="document">Documento</option>
                <option value="minutes">Ata</option>
                <option value="certificate">Certificado</option>
                <option value="receipt">Comprovante</option>
              </select>
              <input value={category} onChange={(event) => setCategory(event.target.value)} className={INPUT} placeholder="Categoria (opcional)" list="document-categories" />
              <datalist id="document-categories">
                {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c} />)}
              </datalist>
              {isInternalCategory(category) ? (
                <p className="text-xs text-amber-300 md:col-span-2">Categoria <strong>Interno Loja</strong>: o documento fica só com a gestão da loja — não aparece no portal dos irmãos nem pode ser baixado por eles.</p>
              ) : null}
              <select value={memberId} onChange={(event) => setMemberId(event.target.value)} className={INPUT}>
                <option value="">Vincular a um membro (deixe em branco para documento institucional — visível a todos)</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
              <label className="rounded-lg border border-dashed border-white/8 bg-sigma-blue-deep/60 px-4 py-3 text-sm text-sand md:col-span-2">
                <span className="mb-2 block font-medium text-sand-light">Arquivo(s)</span>
                <input type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} className="w-full" />
                {files.length > 1 ? <span className="mt-2 block text-xs text-sand-dark">{files.length} arquivos selecionados — cada um vira um documento, com o título acima seguido do nome do arquivo.</span> : null}
              </label>
              <textarea value={content} onChange={(event) => setContent(event.target.value)} className={`${INPUT} md:col-span-2`} placeholder="Resumo ou conteúdo do documento" rows={4} />
            </div>
            <Button type="submit" disabled={submitting}>{submitting ? 'Enviando…' : files.length > 1 ? `Enviar ${files.length} documentos` : 'Enviar e salvar documento'}</Button>
          </form>
        </FormCard>

        <CollapsibleCard title="Arquivos e atas" count={items.length}>
          <div className="space-y-3">
            {items.length === 0 ? (
              <EmptyState title="Nenhum documento. O arquivo aguarda." description="Envie atas, comprovantes e certificados; ficam guardados com segurança e acesso por papel." />
            ) : items.map((item) => (
              <div key={item.id} className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-4 transition-colors hover:border-white/8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium text-sand-light">
                      {item.title}
                      {!item.member ? <Badge variant="info">Institucional</Badge> : null}
                    </p>
                    <p className="mt-1 text-xs text-sand-dark">
                      {DOCUMENT_KIND_LABEL[item.kind] ?? item.kind}
                      {item.category ? ` • ${item.category}` : ''}
                      {item.member ? ` • ${item.member.name}` : ''}
                    </p>
                    {item.storageKey ? <a href={`/api/documents/${item.id}/download`} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm text-gold hover:text-gold-light">Abrir arquivo</a> : null}
                  </div>
                  <p className="max-w-2xl text-sm text-sand-dark">{item.content ?? 'Sem resumo.'}</p>
                  <button type="button" onClick={() => void removeDocument(item)} disabled={removingId === item.id} className="text-sm text-rose-300/70 transition hover:text-rose-300 disabled:opacity-40">
                    {removingId === item.id ? 'Removendo…' : 'Remover'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleCard>
        </div>
      </div>
    </main>
  );
}
