'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, EmptyState, inputClass, useConfirm, Toast } from '@/components/ui';
import { VisitorFieldsInputs, visitorFormFrom, type VisitorFormValue } from '@/components/visitor-fields';
import { visitorLodgeLabel } from '@/lib/visitors';

export interface VisitorRow {
  id: string;
  name: string;
  degree: string | null;
  lodgeName: string | null;
  lodgeNumber: string | null;
  orient: string | null;
  powerName: string | null;
  cim: string | null;
  phone: string | null;
  email: string | null;
  consent: boolean;
  visits: { id: string; sessionId: string; title: string; date: string; degree: string | null; certificateSentAt: string | null }[];
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

export default function VisitantesClient({ rows, removed, canEdit }: { rows: VisitorRow[]; removed: number; canEdit: boolean }) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; form: VisitorFormValue } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const q = search.trim().toLowerCase();
  const visible = q
    ? rows.filter((r) => [r.name, r.email, r.lodgeName, r.orient, r.powerName].some((f) => f?.toLowerCase().includes(q)))
    : rows;

  async function save() {
    if (!editing) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/visitors/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing.form) });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setMessage({ kind: 'error', text: data.error ?? 'Erro ao salvar.' }); return; }
    setEditing(null);
    setMessage({ kind: 'ok', text: 'Cadastro atualizado.' });
    router.refresh();
  }

  async function removeData(r: VisitorRow) {
    if (!(await askConfirm({
      title: 'Excluir dados do visitante (LGPD)',
      message: `Apaga nome, e-mail, telefone e demais dados de ${r.name}. As visitas continuam contadas nas sessões, como "Visitante removido". Não tem volta.`,
      confirmLabel: 'Excluir dados',
      intent: 'danger',
    }))) return;
    const res = await fetch(`/api/visitors/${r.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? { kind: 'ok', text: 'Dados do visitante excluídos.' } : { kind: 'error', text: data.error ?? 'Erro ao excluir.' });
    if (res.ok) router.refresh();
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Visitantes</h1>
          <p className="mt-1 max-w-3xl text-sm text-sand-dark">
            Irmãos de outras lojas que visitaram as sessões. Novos visitantes entram pela própria sessão (Sessões → abrir a sessão → Visitantes da sessão);
            aqui você consulta o histórico e corrige o cadastro.{removed > 0 ? ` ${removed} cadastro(s) excluído(s) a pedido (LGPD) não aparecem.` : ''}
          </p>
        </div>

        <Toast message={message} onClose={() => setMessage(null)} />

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-sand-light">Cadastro de visitantes <span className="text-sm font-normal text-sand-dark">({rows.length})</span></h2>
            <input aria-label="Buscar visitante" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, e-mail, loja, Oriente…" className={`${inputClass} max-w-xs`} />
          </div>

          <div className="mt-5">
            {rows.length === 0 ? (
              <EmptyState title="Nenhum irmão visitante cadastrado." description="Os visitantes são cadastrados na sessão em que estiveram, a partir da lista de presença de visitantes." />
            ) : visible.length === 0 ? (
              <p className="text-sm text-sand-dark">Nenhum visitante encontrado para &quot;{search}&quot;.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {visible.map((r) => (
                  <li key={r.id} className="py-3">
                    {editing?.id === r.id ? (
                      <div className="space-y-3 rounded-lg border border-white/8 bg-sigma-blue-deep/50 p-4">
                        <VisitorFieldsInputs value={editing.form} onChange={(form) => setEditing({ id: r.id, form })} />
                        <div className="flex gap-2">
                          <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-sand-light">
                            {r.name}{r.degree ? <span className="ml-2 text-xs font-normal text-sand-dark">{r.degree}</span> : null}
                          </p>
                          <p className="mt-0.5 text-xs text-sand-dark">{visitorLodgeLabel(r) || 'Loja não informada'}{r.cim ? ` · CIM ${r.cim}` : ''}</p>
                          <p className="mt-0.5 text-xs text-sand-dark">
                            {[r.email, r.phone].filter(Boolean).join(' · ') || 'sem contato'}
                            {r.email && !r.consent ? <span className="ml-2 text-amber-300">sem consentimento registrado para o certificado</span> : null}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <button type="button" onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="text-gold transition hover:text-gold-light">
                            {r.visits.length} visita(s)
                          </button>
                          {canEdit ? (
                            <>
                              <button type="button" onClick={() => setEditing({ id: r.id, form: visitorFormFrom(r) })} className="text-sand-dark transition hover:text-sand-light">Editar</button>
                              <button type="button" onClick={() => void removeData(r)} className="text-rose-300 transition hover:text-rose-200">Excluir dados</button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    )}
                    {expanded === r.id ? (
                      <ul className="mt-2 space-y-1 rounded-lg border border-white/5 bg-sigma-blue-deep/40 p-3 text-xs">
                        {r.visits.map((v) => (
                          <li key={v.id} className="flex flex-wrap justify-between gap-2">
                            <Link href={`/dashboard/sessoes/${v.sessionId}`} className="text-sand transition hover:text-gold">{fmtDate(v.date)} — {v.title}{v.degree ? ` (${v.degree})` : ''}</Link>
                            <span className={v.certificateSentAt ? 'text-emerald-300' : 'text-sand-dark'}>
                              {v.certificateSentAt ? `certificado enviado em ${fmtDate(v.certificateSentAt)}` : 'certificado não enviado'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
