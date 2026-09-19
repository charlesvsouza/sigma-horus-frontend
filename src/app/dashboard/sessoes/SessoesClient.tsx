'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, CollapsibleCard, EmptyState, Field, FormCard, inputClass, useConfirm } from '@/components/ui';

interface SessionItem { id: string; title: string; date: string; type: string; grade?: string | null; notes?: string | null; agenda?: string | null; _count: { attendances: number }; }

export default function SessoesClient({ sessions }: { sessions: SessionItem[] }) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', date: '', endDate: '', type: 'ordinary', grade: '', notes: '', agenda: '' });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, grade: form.grade || undefined, notes: form.notes || undefined, agenda: form.agenda || undefined, endDate: form.endDate || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ kind: 'ok', text: 'Sessão criada.' });
        setForm({ title: '', date: '', endDate: '', type: 'ordinary', grade: '', notes: '', agenda: '' });
        router.refresh();
      } else {
        setMessage({ kind: 'error', text: data.error ?? 'Erro.' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string, title: string) {
    if (!(await askConfirm({ title: 'Remover sessão', message: `Remover a sessão "${title}"? Convocações, presenças e o balaustre vinculados são perdidos. Esta ação não pode ser desfeita.`, confirmLabel: 'Remover', intent: 'danger' }))) return;
    const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setMessage({ kind: 'ok', text: 'Sessão removida.' });
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao remover.' });
    }
  }

  const typeLabel: Record<string, string> = { ordinary: 'Ordinária', magnificent: 'Magna', emergency: 'Extraordinária', other: 'Outra' };
  const INPUT = inputClass; // fonte única do design system

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Sessões</h1>
          <p className="mt-1 text-sm text-sand-dark">Cadastre sessões da loja e registre presença dos membros.</p>
        </div>

        {message ? <Alert intent={message.kind === 'ok' ? 'ok' : 'danger'}>{message.text}</Alert> : null}

        <div className="grid items-start gap-6 lg:grid-cols-2">
        <FormCard title="Nova sessão">
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Título da sessão">
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={INPUT} required />
              </Field>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-sand-dark/70">Início</span>
                <input type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={`mt-1.5 ${INPUT}`} required />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-sand-dark/70">Término (a presença só pode ser marcada depois)</span>
                <input type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={`mt-1.5 ${INPUT}`} required />
              </label>
              <Field label="Tipo de sessão">
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={INPUT}>
                  <option value="ordinary">Ordinária</option>
                  <option value="magnificent">Magna</option>
                  <option value="emergency">Extraordinária</option>
                  <option value="other">Outra</option>
                </select>
              </Field>
              <Field label="Grau (opcional)">
                <input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} className={INPUT} />
              </Field>
              <Field label="Ordem do dia (visível ao obreiro na Secretaria)" className="md:col-span-2">
                <textarea value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} className={`${INPUT} md:col-span-2`} rows={3} />
              </Field>
              <Field label="Observações internas (não aparece pro obreiro)" className="md:col-span-2">
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${INPUT} md:col-span-2`} rows={2} />
              </Field>
            </div>
            <Button type="submit" disabled={submitting}>{submitting ? 'Criando…' : 'Criar sessão'}</Button>
          </form>
        </FormCard>

        <CollapsibleCard title="Sessões cadastradas" count={sessions.length}>
          <div className="space-y-3">
            {sessions.length === 0 ? (
              <EmptyState title="O templo aguarda a primeira convocação." description="Cadastre as sessões da loja para registrar presença e acompanhar a frequência dos obreiros." />
            ) : sessions.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-4 transition-colors hover:border-white/8">
                <div>
                  <p className="text-sm font-medium text-sand-light">{s.title}</p>
                  <p className="mt-1 text-xs text-sand-dark">{typeLabel[s.type] ?? s.type} • {s._count.attendances} presentes</p>
                </div>
                <div className="flex items-center gap-4 text-sm text-sand-dark">
                  <Link href={`/dashboard/sessoes/${s.id}`} className="text-gold hover:text-gold-light">Presença</Link>
                  <span>{new Date(s.date).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
                  <button onClick={() => void remove(s.id, s.title)} className="text-rose-300 hover:text-rose-200">Remover</button>
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
