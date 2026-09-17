'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { Alert, Button, EmptyState, inputClass, useConfirm } from '@/components/ui';

interface AutoEntry { id: string; kind: 'auto'; name: string; photoUrl: string | null; periodLabel: string; sortDate: string; termTitle: string; }
interface ManualEntry { id: string; kind: 'manual'; name: string; photoUrl: string | null; periodLabel: string; sortDate: string; notes: string | null; }
type Entry = AutoEntry | ManualEntry;

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 16mm 14mm; }
  body * { visibility: hidden !important; }
  .gv-print, .gv-print * { visibility: visible !important; }
  .gv-print { position: absolute; left: 0; top: 0; width: 100%; color: #111 !important; background: #fff !important; font-family: Georgia, "Times New Roman", serif !important; font-size: 9.5pt; }
  .gv-noprint { display: none !important; }
  .gv-print h1, .gv-print h2 { color: #111 !important; }
  .gv-print .card { border: 1px solid #ccc !important; break-inside: avoid; page-break-inside: avoid; }
}
`;

export default function GaleriaVeneraveisClient({
  lodgeName, crestUrl, automatic, manual, canManage,
}: {
  lodgeName: string;
  crestUrl: string | null;
  automatic: AutoEntry[];
  manual: ManualEntry[];
  canManage: boolean;
}) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', periodLabel: '', sortDate: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const entries = useMemo<Entry[]>(
    () => [...automatic, ...manual].sort((a, b) => new Date(a.sortDate).getTime() - new Date(b.sortDate).getTime()),
    [automatic, manual],
  );

  async function createEntry(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/venerable-gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ kind: 'error', text: data.error ?? 'Erro ao adicionar entrada.' });
        return;
      }
      setForm({ name: '', periodLabel: '', sortDate: '', notes: '' });
      setShowForm(false);
      setMessage({ kind: 'ok', text: 'Entrada adicionada.' });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(entryId: string, file: File) {
    setUploadingId(entryId);
    setMessage(null);
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`/api/venerable-gallery/${entryId}/photo`, { method: 'POST', body: formData });
    const data = await res.json().catch(() => ({}));
    setUploadingId(null);
    if (!res.ok) {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao enviar a foto.' });
      return;
    }
    router.refresh();
  }

  async function removeEntry(entryId: string, name: string) {
    if (!(await askConfirm({ title: 'Remover entrada', message: `Remover "${name}" da galeria? Esta ação não pode ser desfeita.`, confirmLabel: 'Remover', intent: 'danger' }))) return;
    const res = await fetch(`/api/venerable-gallery/${entryId}`, { method: 'DELETE' });
    if (res.ok) {
      setMessage({ kind: 'ok', text: 'Entrada removida.' });
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao remover.' });
    }
  }

  const INPUT = inputClass;

  return (
    <main className="min-h-screen px-6 py-12">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="gv-noprint">
          <h1 className="font-display text-2xl font-bold text-sand-light">Galeria de Veneráveis</h1>
          <p className="mt-1 text-sm text-sand-dark">Mural com todos os Veneráveis da história da loja, na linha do tempo.</p>
        </div>

        {message ? <div className="gv-noprint"><Alert intent={message.kind === 'ok' ? 'ok' : 'danger'}>{message.text}</Alert></div> : null}

        {canManage ? (
          <div className="gv-noprint flex flex-wrap items-center gap-3">
            <button onClick={() => window.print()} className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">
              Salvar como PDF
            </button>
            <Button variant="secondary" onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancelar' : '+ Adicionar Venerável antigo'}</Button>
          </div>
        ) : entries.length > 0 ? (
          <div className="gv-noprint">
            <button onClick={() => window.print()} className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">
              Salvar como PDF
            </button>
          </div>
        ) : null}

        {showForm ? (
          <form onSubmit={createEntry} className="gv-noprint space-y-4 rounded-xl border border-white/6 bg-sigma-card p-6">
            <p className="text-xs text-sand-dark">Para Veneráveis antigos que a loja não tem cadastrados como membro (atas antigas, placas na parede). A foto pode ser enviada depois de criar a entrada.</p>
            <div className="grid gap-4 md:grid-cols-2">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={INPUT} placeholder="Nome completo" required />
              <input value={form.periodLabel} onChange={(e) => setForm({ ...form, periodLabel: e.target.value })} className={INPUT} placeholder="Período (ex: 1985–1987)" required />
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-sand-dark/70">Data de referência (só para ordenar na linha do tempo)</span>
                <input type="date" value={form.sortDate} onChange={(e) => setForm({ ...form, sortDate: e.target.value })} className={`mt-1.5 ${INPUT}`} required />
              </label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={INPUT} placeholder="Observações (opcional)" />
            </div>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Adicionar'}</Button>
          </form>
        ) : null}

        {entries.length === 0 ? (
          <EmptyState title="Nenhum Venerável na galeria ainda." description="Assim que houver cargos de Venerável Mestre vinculados em Veneralato, eles aparecem aqui automaticamente." />
        ) : (
          <section className="rounded-xl border border-white/6 bg-sigma-card p-6 gv-print">
            <header className="mb-6 text-center">
              {crestUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={crestUrl} alt="" className="mx-auto mb-2 h-14 w-14 object-contain" />
              ) : null}
              <h1 className="text-lg font-bold text-sand-light">{lodgeName}</h1>
              <h2 className="mt-0.5 text-sm text-sand-dark">Galeria de Veneráveis</h2>
            </header>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {entries.map((entry) => (
                <div key={entry.id} className="card flex flex-col items-center gap-2 rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-4 text-center">
                  {entry.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entry.photoUrl} alt={entry.name} className="h-20 w-20 rounded-full border border-white/8 object-cover" />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-white/15 text-sand-dark/50">
                      <UserRound className="h-9 w-9" />
                    </div>
                  )}
                  <p className="text-sm font-semibold text-sand-light">{entry.name}</p>
                  <p className="text-xs text-sand-dark">{entry.periodLabel}</p>
                  {entry.kind === 'manual' && canManage ? (
                    <div className="gv-noprint flex items-center gap-2">
                      <label className="cursor-pointer text-[11px] text-gold/80 transition hover:text-gold">
                        {uploadingId === entry.id ? 'Enviando…' : entry.photoUrl ? 'Trocar foto' : 'Enviar foto'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingId === entry.id}
                          onChange={(ev) => { const f = ev.target.files?.[0]; if (f) void uploadPhoto(entry.id, f); ev.target.value = ''; }}
                        />
                      </label>
                      <button onClick={() => void removeEntry(entry.id, entry.name)} className="text-[11px] text-rose-300/70 transition hover:text-rose-300">Remover</button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
