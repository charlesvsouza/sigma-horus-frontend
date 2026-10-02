'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { degreeShort } from '@/lib/masonic-degree';
import { clampDateYear, fetchCep, maskCEP, maskPhone } from '@/lib/masks';
import { ACCOUNT_STATUS_LABEL, DOCUMENT_KIND_LABEL } from '@/lib/status-labels';
import { Alert, Button, MaskedInput, inputClass } from '@/components/ui';
import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';
import { ReportDocument } from '@/components/report/report-document';
import { PendenciasCard, type CollectionInfo } from './PendenciasCard';
import { CpfLookupCard } from './CpfLookupCard';

interface MemberSummary {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status: string;
  currentDegree?: string | null;
  originLodge?: string | null;
  initiationDate?: string | null;
  elevationDate?: string | null;
  exaltationDate?: string | null;
  installationDate?: string | null;
  gradeName?: string | null;
  photoUrl?: string | null;
  addressLine?: string | null;
  addressNumber?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  relatives?: RelativeData[];
}

interface AccountItem {
  id: string;
  title: string;
  type: string;
  amount: number;
  dueDate: string;
  status: string;
  /** pending | paid | overdue — o vencido é calculado pelo vencimento (a conta só guarda pending/paid). */
  effectiveStatus: 'paid' | 'overdue' | 'pending';
  /** Saldo em aberto (desconta pagamentos parciais). */
  balance: number;
  /** Pode ser paga pelo portal (conta "Devo", do próprio irmão, aprovada, em aberto). */
  payable: boolean;
  paidNoticeAt?: string | null;
  payments: { id: string; amount: number; paidAt: string; method: string }[];
  chartAccount?: { name: string; category: string | null } | null;
}

interface DocumentItem {
  id: string;
  title: string;
  kind: string;
  category?: string | null;
  createdAt: string;
}

type RelativeKind = 'mother' | 'father' | 'spouse' | 'son' | 'daughter' | 'child' | 'other';
interface RelativeData {
  id?: string;
  kind: RelativeKind;
  name: string;
  birthDate?: string | null;
  cpf?: string | null;
  email?: string | null;
  phone?: string | null;
  deceased?: boolean;
}

const emptyRel = (kind: RelativeKind): RelativeData => ({ kind, name: '', birthDate: '', cpf: '', email: '', phone: '', deceased: false });
const dateVal = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

interface EditForm {
  email: string;
  phone: string;
  zipCode: string;
  addressLine: string;
  addressNumber: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
}

// Formulário de auto-edição do obreiro (contato + endereço + família) — só
// esses campos; nome, CPF, rito/potência, grau e status ficam intocados,
// só o Administrador/Secretaria mexe neles (ver manual, cap. 10).
function SelfEditForm({ member, onSaved, onCancel }: { member: MemberSummary; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<EditForm>({
    email: member.email ?? '',
    phone: member.phone ?? '',
    zipCode: member.zipCode ?? '',
    addressLine: member.addressLine ?? '',
    addressNumber: member.addressNumber ?? '',
    complement: member.complement ?? '',
    neighborhood: member.neighborhood ?? '',
    city: member.city ?? '',
    state: member.state ?? '',
    country: member.country ?? '',
  });
  const [cepStatus, setCepStatus] = useState('');
  const set = (field: keyof EditForm, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const initialRelatives = member.relatives ?? [];
  const pick = (kind: RelativeKind): RelativeData => {
    const found = initialRelatives.find((r) => r.kind === kind);
    return found ? { ...found, birthDate: dateVal(found.birthDate) } : emptyRel(kind);
  };
  const [mother, setMother] = useState<RelativeData>(() => pick('mother'));
  const [father, setFather] = useState<RelativeData>(() => pick('father'));
  const [spouse, setSpouse] = useState<RelativeData>(() => pick('spouse'));
  const [dependents, setDependents] = useState<RelativeData[]>(() =>
    initialRelatives.filter((r) => !['mother', 'father', 'spouse'].includes(r.kind)).map((r) => ({ ...r, birthDate: dateVal(r.birthDate) })),
  );
  const setRel = (setter: React.Dispatch<React.SetStateAction<RelativeData>>) => (field: keyof RelativeData, value: string | boolean) =>
    setter((p) => ({ ...p, [field]: value }) as RelativeData);
  const setDep = (idx: number, field: keyof RelativeData, value: string | boolean) =>
    setDependents((list) => list.map((d, i) => (i === idx ? ({ ...d, [field]: value } as RelativeData) : d)));
  const addDependent = () => setDependents((list) => [...list, emptyRel('son')]);
  const removeDependent = (idx: number) => setDependents((list) => list.filter((_, i) => i !== idx));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function lookupCep(value: string) {
    setCepStatus('');
    const address = await fetchCep(value);
    if (!address) {
      if (value.replace(/\D/g, '').length === 8) setCepStatus('CEP não encontrado.');
      return;
    }
    setForm((p) => ({
      ...p,
      zipCode: address.cep,
      addressLine: address.logradouro || p.addressLine,
      neighborhood: address.bairro || p.neighborhood,
      city: address.cidade || p.city,
      state: address.uf || p.state,
    }));
    setCepStatus('Endereço preenchido pelo CEP.');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const relatives = [mother, father, spouse, ...dependents].filter((r) => r.name.trim().length > 0);
    const res = await fetch(`/api/members/${member.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, relatives }),
    });
    setSaving(false);
    if (res.ok) {
      onSaved();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Erro ao salvar.');
    }
  }

  const relInputs = (rel: RelativeData, setter: (field: keyof RelativeData, value: string | boolean) => void, label: string) => (
    <div className="grid gap-3 sm:grid-cols-2">
      <input value={rel.name} onChange={(e) => setter('name', e.target.value)} className={inputClass} placeholder={`Nome (${label})`} />
      <input type="date" value={rel.birthDate ?? ''} onChange={(e) => setter('birthDate', clampDateYear(e.target.value, rel.birthDate ?? ''))} className={inputClass} />
      <input value={rel.email ?? ''} onChange={(e) => setter('email', e.target.value)} className={inputClass} placeholder="E-mail" />
      <input value={rel.phone ?? ''} onChange={(e) => setter('phone', e.target.value)} className={inputClass} placeholder="Telefone" />
      <label className="flex items-center gap-2 text-xs text-sand-dark sm:col-span-2" title="Não recebe felicitação de aniversário automática">
        <input type="checkbox" checked={rel.deceased === true} onChange={(e) => setter('deceased', e.target.checked)} />
        Falecido(a)
      </label>
    </div>
  );

  return (
    <form onSubmit={submit} className="mt-5 space-y-6">
      {error ? <Alert intent="danger">{error}</Alert> : null}

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Contato</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input value={form.email} onChange={(e) => set('email', e.target.value)} className={inputClass} placeholder="E-mail" type="email" />
          <MaskedInput value={form.phone} onChange={(v) => set('phone', v)} mask={maskPhone} className={inputClass} placeholder="Telefone" />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Endereço</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <MaskedInput
            value={form.zipCode}
            onChange={(v) => { set('zipCode', v); if (v.replace(/\D/g, '').length === 8) lookupCep(v); }}
            mask={maskCEP}
            className={inputClass}
            placeholder="CEP"
          />
          <input value={form.addressLine} onChange={(e) => set('addressLine', e.target.value)} className={inputClass} placeholder="Logradouro" />
          <input value={form.addressNumber} onChange={(e) => set('addressNumber', e.target.value)} className={inputClass} placeholder="Número" />
          <input value={form.complement} onChange={(e) => set('complement', e.target.value)} className={inputClass} placeholder="Complemento" />
          <input value={form.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} className={inputClass} placeholder="Bairro" />
          <input value={form.city} onChange={(e) => set('city', e.target.value)} className={inputClass} placeholder="Cidade" />
          <input value={form.state} onChange={(e) => set('state', e.target.value)} className={inputClass} placeholder="Estado" />
          <input value={form.country} onChange={(e) => set('country', e.target.value)} className={inputClass} placeholder="País" />
        </div>
        {cepStatus ? <p className="mt-2 text-xs text-sand-dark">{cepStatus}</p> : null}
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Família</h3>
        <div className="mt-3 space-y-4">
          {relInputs(mother, setRel(setMother), 'mãe')}
          {relInputs(father, setRel(setFather), 'pai')}
          {relInputs(spouse, setRel(setSpouse), 'cônjuge')}
          {dependents.map((dep, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1">{relInputs(dep, (f, v) => setDep(i, f, v), 'dependente')}</div>
              <button type="button" onClick={() => removeDependent(i)} className="mt-1 text-xs text-rose-300/70 hover:text-rose-300">Remover</button>
            </div>
          ))}
          <button type="button" onClick={addDependent} className="text-xs text-gold hover:text-gold-light">+ Adicionar dependente</button>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  );
}

const TYPE_FILTER_LABEL: Record<string, string> = { all: 'Tudo', RECEIVABLE: 'Devo', PAYABLE: 'A Loja me deve' };
const STATUS_FILTER_LABEL: Record<string, string> = { all: 'Qualquer status', pending: 'Pendente', paid: 'Pago', overdue: 'Vencido' };

export default function PortalPage() {
  const [member, setMember] = useState<MemberSummary | null>(null);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [institutionalDocuments, setInstitutionalDocuments] = useState<DocumentItem[]>([]);
  const [lodge, setLodge] = useState<{ name: string; crestUrl: string | null } | null>(null);
  const [collection, setCollection] = useState<CollectionInfo | null>(null);
  const [canLookupCpf, setCanLookupCpf] = useState(false);
  const [summary, setSummary] = useState({ totalReceivables: 0, totalPayables: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'RECEIVABLE' | 'PAYABLE'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');
  const [extratoOpen, setExtratoOpen] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  // Candidato (profano em admissão): só débitos e cadastro — sem grau, declaração e documentos.
  const [isCandidate, setIsCandidate] = useState(false);

  const filteredAccounts = accounts
    .filter((a) => typeFilter === 'all' || a.type === typeFilter)
    .filter((a) => statusFilter === 'all' || a.effectiveStatus === statusFilter);
  const payableAccounts = accounts.filter((a) => a.payable);
  const filteredTotal = filteredAccounts.reduce((sum, a) => sum + (a.type === 'RECEIVABLE' ? Number(a.amount) : -Number(a.amount)), 0);

  async function load() {
    setLoadError('');
    try {
      const response = await fetch('/api/portal');
      if (!response.ok) throw new Error('Falha ao carregar o portal.');
      const data = await response.json();
      setMember(data.member ?? null);
      setAccounts(data.accounts ?? []);
      setDocuments(data.documents ?? []);
      setInstitutionalDocuments(data.institutionalDocuments ?? []);
      setLodge(data.lodge ?? null);
      setCollection(data.collection ?? null);
      setCanLookupCpf(Boolean(data.canLookupCpf));
      setIsCandidate(Boolean(data.isCandidate));
      setSummary(data.summary ?? { totalReceivables: 0, totalPayables: 0, overdue: 0 });
    } catch {
      setLoadError('Não foi possível carregar seus dados. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  // A foto é o único dado do cadastro (além de contato/endereço/família) que o obreiro troca sozinho;
  // o restante é da Secretaria. A rota confere que o membro da sessão é o dono da foto.
  async function sendPhoto(file: File) {
    if (!member) return;
    setPhotoBusy(true);
    setSavedMessage('');
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`/api/members/${member.id}/photo`, { method: 'POST', body: formData });
    const data = await res.json().catch(() => ({}));
    setPhotoBusy(false);
    if (!res.ok) { setLoadError(data.error ?? 'Erro ao enviar a foto.'); return; }
    setLoadError('');
    setSavedMessage('Foto atualizada.');
    void load();
  }

  async function removePhoto() {
    if (!member) return;
    setPhotoBusy(true);
    setSavedMessage('');
    const res = await fetch(`/api/members/${member.id}/photo`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    setPhotoBusy(false);
    if (!res.ok) { setLoadError(data.error ?? 'Erro ao remover a foto.'); return; }
    setLoadError('');
    setSavedMessage('Foto removida.');
    void load();
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Meu portal</h1>
          <p className="mt-1 text-sm text-sand-dark">
            {isCandidate
              ? 'Área do candidato: seus dados cadastrais e os valores devidos à Loja, que você pode pagar por aqui.'
              : 'Área de visão do obreiro com resumo de cadastro, situação financeira e documentos recentes.'}
          </p>
        </div>

        {savedMessage ? <Alert intent="ok">{savedMessage}</Alert> : null}
        {loadError ? (
          <Alert intent="danger">
            {loadError}{' '}
            <button onClick={() => void load()} className="underline hover:no-underline">Tentar de novo</button>
          </Alert>
        ) : null}

        {!loading && member ? (
          <PendenciasCard accounts={payableAccounts} collection={collection} onChanged={() => void load()} />
        ) : null}
        {!loading && !member && !loadError && canLookupCpf ? <CpfLookupCard /> : null}

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-white/6 bg-sigma-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-sand-light">{isCandidate ? 'Meu cadastro' : 'Resumo do obreiro'}</h2>
              {!loading && member && !editing ? (
                <button onClick={() => setEditing(true)} className="text-xs text-gold hover:text-gold-light">Editar meus dados</button>
              ) : null}
            </div>
            {loading ? (
              <p className="mt-6 text-sm text-sand-dark">Carregando...</p>
            ) : member ? (
              <>
              <div className="mt-5 flex flex-wrap items-center gap-4">
                {member.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={member.photoUrl} alt={`Foto de ${member.name}`} className="h-20 w-20 rounded-full border border-white/8 bg-sigma-blue-deep/60 object-cover" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-white/15 text-sand-dark/50">
                    <UserRound className="h-8 w-8" aria-hidden="true" />
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer rounded-full border border-gold/40 px-4 py-2 text-xs font-medium text-gold/80 transition-colors hover:border-gold/60 hover:text-gold">
                    {photoBusy ? 'Enviando…' : member.photoUrl ? 'Trocar minha foto' : 'Enviar minha foto'}
                    <input type="file" accept="image/*" className="hidden" disabled={photoBusy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendPhoto(f); e.target.value = ''; }} />
                  </label>
                  {member.photoUrl ? (
                    <button type="button" onClick={() => void removePhoto()} disabled={photoBusy} className="text-xs text-rose-300/70 transition hover:text-rose-300 disabled:opacity-40">Remover</button>
                  ) : null}
                </div>
              </div>
              {editing ? (
                <SelfEditForm
                  member={member}
                  onCancel={() => setEditing(false)}
                  onSaved={() => { setEditing(false); setSavedMessage('Dados atualizados com sucesso.'); load(); }}
                />
              ) : (
                <div className="mt-5 space-y-4 text-sm text-sand">
                  <div className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-gold">{isCandidate ? 'Candidato' : 'Membro'}</p>
                    <p className="mt-2 text-lg font-semibold text-sand-light">{member.name}</p>
                    <p className="mt-1">{member.email ?? 'E-mail não informado'}</p>
                    <p>{member.phone ?? 'Telefone não informado'}</p>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-gold">Endereço</p>
                    <p className="mt-2">
                      {[member.addressLine, member.addressNumber].filter(Boolean).join(', ') || 'Não informado'}
                      {member.complement ? ` — ${member.complement}` : ''}
                    </p>
                    <p>{[member.neighborhood, member.city, member.state].filter(Boolean).join(' — ')}</p>
                    <p>{[member.zipCode, member.country].filter(Boolean).join(' · ')}</p>
                  </div>
                  {isCandidate ? null : <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-gold">Grau atual</p>
                      <p className="mt-2 font-medium text-sand-light">{degreeShort(member)}</p>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-gold">Loja de origem</p>
                      <p className="mt-2 font-medium text-sand-light">{member.originLodge ?? 'Não informada'}</p>
                    </div>
                  </div>}
                </div>
              )}
              </>
            ) : (
              <p className="mt-6 text-sm text-sand-dark">Nenhum membro encontrado para este usuário.</p>
            )}
          </div>

          <div className="rounded-xl border border-white/6 bg-sigma-card p-6">
            <h2 className="text-base font-semibold text-sand-light">Resumo financeiro</h2>
            {loading ? (
              <p className="mt-6 text-sm text-sand-dark">Carregando...</p>
            ) : (
              <div className="mt-5 space-y-3 text-sm text-sand">
                <div className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-gold">O que devo</p>
                  <p className="mt-2 text-xl font-semibold text-sand-light">{brl(summary.totalReceivables)}</p>
                </div>
                <div className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-gold">A Loja me deve</p>
                  <p className="mt-2 text-xl font-semibold text-sand-light">{brl(summary.totalPayables)}</p>
                </div>
                <div className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-gold">Vencido</p>
                  <p className={`mt-2 text-xl font-semibold ${summary.overdue > 0 ? 'text-rose-300' : 'text-sand-light'}`}>{brl(summary.overdue)}</p>
                </div>
                {member ? (
                  <Link href="/dashboard/portal/historico" className="flex items-center justify-between rounded-lg border border-gold/25 px-4 py-3 text-sm font-medium text-gold transition-colors hover:border-gold/50 hover:text-gold-light">
                    Meu histórico de pagamentos
                    <span aria-hidden="true">→</span>
                  </Link>
                ) : null}
                {member && !isCandidate ? (
                  <Link href="/dashboard/portal/declaracao" className="flex items-center justify-between rounded-lg border border-gold/25 px-4 py-3 text-sm font-medium text-gold transition-colors hover:border-gold/50 hover:text-gold-light">
                    Declaração de regularidade
                    <span aria-hidden="true">→</span>
                  </Link>
                ) : null}
              </div>
            )}
          </div>
        </section>

        <section className={isCandidate ? 'grid gap-6' : 'grid gap-6 lg:grid-cols-2'}>
          <div className="rounded-xl border border-white/6 bg-sigma-card p-6">
            <button
              type="button"
              onClick={() => setExtratoOpen((v) => !v)}
              aria-expanded={extratoOpen}
              aria-controls="extrato-content"
              className="flex w-full items-center justify-between gap-3 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              <div>
                <h2 className="text-base font-semibold text-sand-light">Meu extrato</h2>
                <p className="mt-0.5 text-xs text-sand-dark">{accounts.length} registro{accounts.length !== 1 ? 's' : ''}</p>
              </div>
              <svg className={`h-4 w-4 shrink-0 text-sand-dark transition-transform duration-200 ${extratoOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {extratoOpen ? (
              <div id="extrato-content">
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <select aria-label="Filtrar por tipo" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} className="rounded-lg border border-white/8 bg-sigma-blue-deep/60 px-2.5 py-1.5 text-xs text-sand-light outline-none focus:border-gold/50">
                    <option value="all">Tudo</option>
                    <option value="RECEIVABLE">Devo</option>
                    <option value="PAYABLE">A Loja me deve</option>
                  </select>
                  <select aria-label="Filtrar por situação" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="rounded-lg border border-white/8 bg-sigma-blue-deep/60 px-2.5 py-1.5 text-xs text-sand-light outline-none focus:border-gold/50">
                    <option value="all">Qualquer status</option>
                    <option value="pending">Pendente</option>
                    <option value="paid">Pago</option>
                    <option value="overdue">Vencido</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    disabled={filteredAccounts.length === 0}
                    title="Gera um PDF do extrato conforme o filtro atual"
                    className="rounded-lg border border-gold/40 px-2.5 py-1.5 text-xs font-medium text-gold/80 transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-40"
                  >
                    Relatório PDF
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {(() => {
                    if (accounts.length === 0) return <p className="text-sm text-sand-dark">Nenhuma conta vinculada.</p>;
                    if (filteredAccounts.length === 0) return <p className="text-sm text-sand-dark">Nenhum lançamento para este filtro.</p>;
                    return filteredAccounts.map((account) => (
                      <div key={account.id} className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-4 text-sm text-sand">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-sand-light">{account.title}</p>
                            <p className="text-sand-dark">
                              {account.type === 'RECEIVABLE' ? 'Devo' : 'A Loja me deve'} • {formatDateOnly(account.dueDate)}
                            </p>
                            {account.chartAccount ? (
                              <p className="mt-0.5 text-xs text-gold/80">{account.chartAccount.category ? `${account.chartAccount.category} — ` : ''}{account.chartAccount.name}</p>
                            ) : null}
                          </div>
                          <p className="font-semibold text-sand-light">{brl(account.amount)}</p>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <p className={`text-xs uppercase tracking-[0.25em] ${account.effectiveStatus === 'overdue' ? 'text-rose-300' : 'text-sand-dark'}`}>{account.paidNoticeAt && account.effectiveStatus !== 'paid' ? 'Aguardando confirmação da Tesouraria' : ACCOUNT_STATUS_LABEL[account.effectiveStatus] ?? account.status}</p>
                          {account.payments.length > 0 ? (
                            <div className="flex flex-wrap gap-3">
                              {account.payments.map((p, i) => (
                                <a key={p.id} href={`/dashboard/pagamentos/${p.id}/recibo`} target="_blank" rel="noreferrer" className="text-xs text-gold hover:text-gold-light">
                                  Recibo{account.payments.length > 1 ? ` ${i + 1}` : ''} · {brl(p.amount)}
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            ) : null}
          </div>

          {isCandidate ? null : <>
          <div className="rounded-xl border border-white/6 bg-sigma-card p-6">
            <h2 className="text-base font-semibold text-sand-light">Documentos recentes</h2>
            <div className="mt-5 space-y-3">
              {documents.length === 0 ? <p className="text-sm text-sand-dark">Nenhum documento registrado.</p> : documents.map((document) => (
                <div key={document.id} className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-4 text-sm text-sand">
                  <p className="font-medium text-sand-light">{document.title}</p>
                  <p className="mt-1 text-sand-dark">{DOCUMENT_KIND_LABEL[document.kind] ?? document.kind} • {new Date(document.createdAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
                  <a href={`/api/documents/${document.id}/download`} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs text-gold hover:text-gold-light">Abrir arquivo</a>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/6 bg-sigma-card p-6">
            <h2 className="text-base font-semibold text-sand-light">Documentos da Loja</h2>
            <p className="mt-0.5 text-xs text-sand-dark">Regimento, regulamento, constituição e outros documentos institucionais.</p>
            <div className="mt-5 space-y-3">
              {institutionalDocuments.length === 0 ? <p className="text-sm text-sand-dark">Nenhum documento institucional publicado ainda.</p> : institutionalDocuments.map((document) => (
                <div key={document.id} className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-4 text-sm text-sand">
                  <p className="font-medium text-sand-light">{document.title}</p>
                  <p className="mt-1 text-sand-dark">{document.category || (DOCUMENT_KIND_LABEL[document.kind] ?? document.kind)} • {new Date(document.createdAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
                  <a href={`/api/documents/${document.id}/download`} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs text-gold hover:text-gold-light">Abrir arquivo</a>
                </div>
              ))}
            </div>
          </div>
          </>}
        </section>
      </div>

      {/* Relatório imprimível (Salvar como PDF) — reflete o filtro atual */}
      <ReportDocument
        printOnly
        lodgeName={lodge?.name ?? 'Loja'}
        crestUrl={lodge?.crestUrl ?? null}
        title={`${isCandidate ? 'Extrato' : 'Extrato do irmão'} — ${member?.name ?? ''}`}
        details={[TYPE_FILTER_LABEL[typeFilter], STATUS_FILTER_LABEL[statusFilter], `${filteredAccounts.length} lançamento(s)`]}
        issuedBy={member?.name ?? null}
      >
        <table>
          <thead>
            <tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Status</th><th className="num">Valor</th></tr>
          </thead>
          <tbody>
            {filteredAccounts.map((account) => (
              <tr key={account.id}>
                <td>{formatDateOnly(account.dueDate)}</td>
                <td>{account.title}</td>
                <td>{account.chartAccount ? `${account.chartAccount.category ? account.chartAccount.category + ' — ' : ''}${account.chartAccount.name}` : '—'}</td>
                <td>{account.type === 'RECEIVABLE' ? 'Devo' : 'A Loja me deve'}</td>
                <td>{account.paidNoticeAt && account.effectiveStatus !== 'paid' ? 'Aguardando confirmação da Tesouraria' : ACCOUNT_STATUS_LABEL[account.effectiveStatus] ?? account.status}</td>
                <td className="num">{brl(account.amount)}</td>
              </tr>
            ))}
            <tr className="rpt-total">
              <td colSpan={5}>Saldo do filtro (o que devo − o que a Loja me deve)</td>
              <td className="num">{brl(filteredTotal)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-4 text-xs text-sand-dark">Documento informativo, gerado pelo próprio {isCandidate ? 'candidato' : 'irmão'} no portal. Não substitui o recibo de pagamento emitido pela Tesouraria.</p>
      </ReportDocument>
    </main>
  );
}
