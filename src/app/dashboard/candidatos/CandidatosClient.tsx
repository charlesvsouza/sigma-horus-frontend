'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, EmptyState, Field, MaskedInput, inputClass } from '@/components/ui';
import { CANDIDATE_STAGES, CANDIDATE_STAGE_LABEL, closedReasonLabel, type CandidateStage } from '@/lib/candidate';
import { clampDateYear, maskCPF, maskPhone } from '@/lib/masks';
import { formatDateOnly } from '@/lib/date-only';

export interface CandidateRow {
  id: string;
  name: string;
  contact: string;
  isCandidate: boolean;
  stage: CandidateStage;
  stageIndex: number;
  warning: string | null;
  proposer: string | null;
  closedReason: string | null;
  hasAccess: boolean;
  since: string;
  initiationScheduledAt: string | null;
  initiatedAt: string | null;
}

type Tab = 'open' | 'initiated' | 'closed';
const TABS: { key: Tab; label: string }[] = [
  { key: 'open', label: 'Em andamento' },
  { key: 'initiated', label: 'Iniciados' },
  { key: 'closed', label: 'Encerrados' },
];
const tabOf = (r: CandidateRow): Tab => (r.stage === 'initiated' ? 'initiated' : r.stage === 'closed' ? 'closed' : 'open');

const EMPTY = { name: '', email: '', phone: '', cpf: '', proposerId: '', preProposalDate: '' };

export default function CandidatosClient({ rows, brothers }: { rows: CandidateRow[]; brothers: { id: string; name: string }[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('open');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const set = (k: keyof typeof EMPTY, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { open: 0, initiated: 0, closed: 0 };
    for (const r of rows) c[tabOf(r)]++;
    return c;
  }, [rows]);
  const q = search.trim().toLowerCase();
  const visible = rows.filter((r) => tabOf(r) === tab && (!q || r.name.toLowerCase().includes(q) || (r.proposer ?? '').toLowerCase().includes(q)));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await fetch('/api/candidates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setMessage({ kind: 'error', text: data.error ?? 'Erro ao cadastrar o candidato.' }); return; }
    router.push(`/dashboard/candidatos/${data.item.id}`);
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-sand-light">Candidatos</h1>
            <p className="mt-1 max-w-3xl text-sm text-sand-dark">
              Processo de admissão, da pré-proposta à iniciação. O candidato pode ter lançamentos a pagar ou a receber como qualquer obreiro
              (Tesouraria → Contas) e, com o acesso liberado, vê no portal só os próprios débitos e o próprio cadastro.
            </p>
          </div>
          <Button onClick={() => { setCreating((v) => !v); setMessage(null); }}>{creating ? 'Fechar' : '+ Novo candidato'}</Button>
        </div>

        {message ? <Alert intent={message.kind === 'ok' ? 'ok' : 'danger'}>{message.text}</Alert> : null}

        {creating ? (
          <form onSubmit={create} className="space-y-4 rounded-xl border border-white/6 bg-sigma-card p-6">
            <h2 className="text-base font-semibold text-sand-light">Novo candidato</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Nome completo *" className="sm:col-span-2 lg:col-span-1">
                <input required value={form.name} onChange={(e) => set('name', e.target.value)} className={inputClass} />
              </Field>
              <Field label="E-mail (login do portal)">
                <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Telefone">
                <MaskedInput value={form.phone} onChange={(v) => set('phone', v)} mask={maskPhone} className={inputClass} />
              </Field>
              <Field label="CPF">
                <MaskedInput value={form.cpf} onChange={(v) => set('cpf', v)} mask={maskCPF} className={inputClass} />
              </Field>
              <Field label="Proponente (padrinho)">
                <select value={form.proposerId} onChange={(e) => set('proposerId', e.target.value)} className={inputClass}>
                  <option value="">—</option>
                  {brothers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
              <Field label="Pré-proposta recebida em">
                <input type="date" value={form.preProposalDate} onChange={(e) => set('preProposalDate', clampDateYear(e.target.value, form.preProposalDate))} className={inputClass} />
              </Field>
            </div>
            <p className="text-xs text-sand-dark">Os demais dados, as etapas do processo e a pasta de documentos ficam na ficha do candidato, que abre ao salvar.</p>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Cadastrar e abrir a ficha'}</Button>
              <Button type="button" variant="ghost" onClick={() => { setCreating(false); setForm(EMPTY); }}>Cancelar</Button>
            </div>
          </form>
        ) : null}

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Situação do processo" className="flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${tab === t.key ? 'border-gold/60 bg-gold/10 text-gold' : 'border-white/10 text-sand-dark hover:text-sand-light'}`}
                >
                  {t.label} <span className="opacity-70">({counts[t.key]})</span>
                </button>
              ))}
            </div>
            <input aria-label="Buscar candidato" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou proponente…" className={`${inputClass} max-w-xs`} />
          </div>

          <div className="mt-5">
            {visible.length === 0 ? (
              rows.length === 0 ? (
                <EmptyState title="Nenhum candidato cadastrado." description="Cadastre o candidato ao receber a pré-proposta e acompanhe cada etapa até a iniciação." />
              ) : (
                <p className="text-sm text-sand-dark">Nenhum candidato nesta lista{q ? ` para "${search}"` : ''}.</p>
              )
            ) : (
              <ul className="divide-y divide-white/5">
                {visible.map((r) => (
                  <li key={r.id}>
                    <Link href={`/dashboard/candidatos/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 transition-colors hover:bg-white/2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-sand-light">{r.name}</p>
                        <p className="mt-0.5 text-xs text-sand-dark">
                          {r.proposer ? `Proponente: ${r.proposer}` : 'Sem proponente'} · desde {formatDateOnly(r.since)}
                          {r.contact ? ` · ${r.contact}` : ''}
                        </p>
                        {r.warning && r.stage !== 'closed' ? <p className="mt-0.5 text-xs text-amber-300">{r.warning}</p> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {r.stage === 'initiated' ? (
                          <Badge variant="success">Iniciado em {formatDateOnly(r.initiatedAt)}</Badge>
                        ) : r.stage === 'closed' ? (
                          <Badge variant="canceled">{closedReasonLabel(r.closedReason)}</Badge>
                        ) : (
                          <>
                            <span className="text-sand-dark">Etapa {r.stageIndex + 1} de {CANDIDATE_STAGES.length}</span>
                            <Badge variant={r.warning ? 'warning' : 'info'}>{CANDIDATE_STAGE_LABEL[r.stage]}</Badge>
                            {r.initiationScheduledAt ? <Badge variant="pending">Iniciação em {formatDateOnly(r.initiationScheduledAt)}</Badge> : null}
                          </>
                        )}
                        {r.isCandidate && r.hasAccess ? <span className="text-sand-dark" title="Acesso ao portal liberado">· portal</span> : null}
                      </div>
                    </Link>
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
