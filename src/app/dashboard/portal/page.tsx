'use client';

import { useEffect, useState } from 'react';
import { degreeShort } from '@/lib/masonic-degree';
import { fetchCep, maskCEP, maskPhone } from '@/lib/masks';
import { ACCOUNT_STATUS_LABEL, DOCUMENT_KIND_LABEL } from '@/lib/status-labels';
import { Alert, Button, inputClass } from '@/components/ui';

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
      <input type="date" value={rel.birthDate ?? ''} onChange={(e) => setter('birthDate', e.target.value)} className={inputClass} />
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
          <input value={form.phone} onChange={(e) => set('phone', maskPhone(e.target.value))} className={inputClass} placeholder="Telefone" />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Endereço</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            value={form.zipCode}
            onChange={(e) => { const v = maskCEP(e.target.value); set('zipCode', v); if (v.replace(/\D/g, '').length === 8) lookupCep(v); }}
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

// Relatório do extrato: visível apenas na impressão (Salvar como PDF),
// reflete o filtro de tipo/status selecionado no card — mesmo padrão do
// relatório de membros (dashboard/membros) e do recibo de pagamento.
const EXTRATO_PRINT_CSS = `
.extrato-report { display: none; }
@media print {
  @page { size: A4 portrait; margin: 16mm 14mm; }
  body * { visibility: hidden !important; }
  .extrato-report { display: block !important; position: absolute; left: 0; top: 0; width: 100%; color: #111 !important; background: #fff !important; font-family: Georgia, "Times New Roman", serif !important; }
  .extrato-report, .extrato-report * { visibility: visible !important; }
  .extrato-report h1 { font-size: 15pt; margin: 0 0 2mm; letter-spacing: 0.02em; border-bottom: 2px solid #C9A227; padding-bottom: 2.5mm; }
  .extrato-report .sub { color: #444 !important; font-size: 9pt; margin: 2mm 0 5mm; }
  .extrato-report table { width: 100%; border-collapse: collapse; }
  .extrato-report th { border-bottom: 1.5px solid #333; text-transform: uppercase; font-size: 8pt; text-align: left; padding: 3px 6px; }
  .extrato-report td { border-bottom: 1px solid #ccc; font-size: 9pt; text-align: left; padding: 3px 6px; }
  .extrato-report tr { break-inside: avoid; page-break-inside: avoid; }
  .extrato-report .total { text-align: right; font-weight: bold; margin-top: 3mm; font-size: 10pt; }
}
`;

const TYPE_FILTER_LABEL: Record<string, string> = { all: 'Tudo', RECEIVABLE: 'A receber', PAYABLE: 'A pagar' };
const STATUS_FILTER_LABEL: Record<string, string> = { all: 'Qualquer status', pending: 'Pendente', paid: 'Pago', overdue: 'Vencido' };

export default function PortalPage() {
  const [member, setMember] = useState<MemberSummary | null>(null);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [institutionalDocuments, setInstitutionalDocuments] = useState<DocumentItem[]>([]);
  const [lodge, setLodge] = useState<{ name: string; crestUrl: string | null } | null>(null);
  const [summary, setSummary] = useState({ totalReceivables: 0, totalPayables: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'RECEIVABLE' | 'PAYABLE'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');
  const [extratoOpen, setExtratoOpen] = useState(false);

  const filteredAccounts = accounts
    .filter((a) => typeFilter === 'all' || a.type === typeFilter)
    .filter((a) => statusFilter === 'all' || a.status === statusFilter);
  const filteredTotal = filteredAccounts.reduce((sum, a) => sum + (a.type === 'RECEIVABLE' ? Number(a.amount) : -Number(a.amount)), 0);

  async function load() {
    const response = await fetch('/api/portal');
    const data = await response.json();
    setMember(data.member ?? null);
    setAccounts(data.accounts ?? []);
    setDocuments(data.documents ?? []);
    setInstitutionalDocuments(data.institutionalDocuments ?? []);
    setLodge(data.lodge ?? null);
    setSummary(data.summary ?? { totalReceivables: 0, totalPayables: 0, pending: 0 });
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Meu portal</h1>
          <p className="mt-1 text-sm text-sand-dark">Área de visão do obreiro com resumo de cadastro, situação financeira e documentos recentes.</p>
        </div>

        {savedMessage ? <Alert intent="ok">{savedMessage}</Alert> : null}

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-sand-light">Resumo do obreiro</h2>
              {!loading && member && !editing ? (
                <button onClick={() => setEditing(true)} className="text-xs text-gold hover:text-gold-light">Editar meus dados</button>
              ) : null}
            </div>
            {loading ? (
              <p className="mt-6 text-sm text-sand-dark">Carregando...</p>
            ) : member ? (
              editing ? (
                <SelfEditForm
                  member={member}
                  onCancel={() => setEditing(false)}
                  onSaved={() => { setEditing(false); setSavedMessage('Dados atualizados com sucesso.'); load(); }}
                />
              ) : (
                <div className="mt-5 space-y-4 text-sm text-sand">
                  <div className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-gold">Membro</p>
                    <p className="mt-2 text-lg font-semibold text-sand-light">{member.name}</p>
                    <p className="mt-1">{member.email ?? 'E-mail não informado'}</p>
                    <p>{member.phone ?? 'Telefone não informado'}</p>
                  </div>
                  <div className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-gold">Endereço</p>
                    <p className="mt-2">
                      {[member.addressLine, member.addressNumber].filter(Boolean).join(', ') || 'Não informado'}
                      {member.complement ? ` — ${member.complement}` : ''}
                    </p>
                    <p>{[member.neighborhood, member.city, member.state].filter(Boolean).join(' — ')}</p>
                    <p>{[member.zipCode, member.country].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-gold">Grau atual</p>
                      <p className="mt-2 font-medium text-sand-light">{degreeShort(member)}</p>
                    </div>
                    <div className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-gold">Loja de origem</p>
                      <p className="mt-2 font-medium text-sand-light">{member.originLodge ?? 'Não informada'}</p>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <p className="mt-6 text-sm text-sand-dark">Nenhum membro encontrado para este usuário.</p>
            )}
          </div>

          <div className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
            <h2 className="text-base font-semibold text-sand-light">Resumo financeiro</h2>
            <div className="mt-5 space-y-3 text-sm text-sand">
              <div className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-gold">A receber</p>
                <p className="mt-2 text-xl font-semibold text-sand-light">R$ {summary.totalReceivables.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-gold">A pagar</p>
                <p className="mt-2 text-xl font-semibold text-sand-light">R$ {summary.totalPayables.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-gold">Pendentes</p>
                <p className="mt-2 text-xl font-semibold text-sand-light">R$ {summary.pending.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
            <button
              type="button"
              onClick={() => setExtratoOpen((v) => !v)}
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
              <>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} className="rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-2.5 py-1.5 text-xs text-sand-light outline-none focus:border-gold/50">
                    <option value="all">Tudo</option>
                    <option value="RECEIVABLE">A receber</option>
                    <option value="PAYABLE">A pagar</option>
                  </select>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-2.5 py-1.5 text-xs text-sand-light outline-none focus:border-gold/50">
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
                      <div key={account.id} className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-4 text-sm text-sand">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-sand-light">{account.title}</p>
                            <p className="text-sand-dark">
                              {account.type === 'RECEIVABLE' ? 'A receber' : 'A pagar'} • {new Date(account.dueDate).toLocaleDateString('pt-BR')}
                            </p>
                            {account.chartAccount ? (
                              <p className="mt-0.5 text-xs text-gold/80">{account.chartAccount.category ? `${account.chartAccount.category} — ` : ''}{account.chartAccount.name}</p>
                            ) : null}
                          </div>
                          <p className="font-semibold text-sand-light">R$ {Number(account.amount).toFixed(2)}</p>
                        </div>
                        <p className="mt-2 text-xs uppercase tracking-[0.25em] text-sand-dark">{ACCOUNT_STATUS_LABEL[account.status] ?? account.status}</p>
                      </div>
                    ));
                  })()}
                </div>
              </>
            ) : null}
          </div>

          <div className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
            <h2 className="text-base font-semibold text-sand-light">Documentos recentes</h2>
            <div className="mt-5 space-y-3">
              {documents.length === 0 ? <p className="text-sm text-sand-dark">Nenhum documento registrado.</p> : documents.map((document) => (
                <div key={document.id} className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-4 text-sm text-sand">
                  <p className="font-medium text-sand-light">{document.title}</p>
                  <p className="mt-1 text-sand-dark">{DOCUMENT_KIND_LABEL[document.kind] ?? document.kind} • {new Date(document.createdAt).toLocaleDateString('pt-BR')}</p>
                  <a href={`/api/documents/${document.id}/download`} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs text-gold hover:text-gold-light">Abrir arquivo</a>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
            <h2 className="text-base font-semibold text-sand-light">Documentos da Loja</h2>
            <p className="mt-0.5 text-xs text-sand-dark">Regimento, regulamento, constituição e outros documentos institucionais.</p>
            <div className="mt-5 space-y-3">
              {institutionalDocuments.length === 0 ? <p className="text-sm text-sand-dark">Nenhum documento institucional publicado ainda.</p> : institutionalDocuments.map((document) => (
                <div key={document.id} className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-4 text-sm text-sand">
                  <p className="font-medium text-sand-light">{document.title}</p>
                  <p className="mt-1 text-sand-dark">{document.category || (DOCUMENT_KIND_LABEL[document.kind] ?? document.kind)} • {new Date(document.createdAt).toLocaleDateString('pt-BR')}</p>
                  <a href={`/api/documents/${document.id}/download`} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs text-gold hover:text-gold-light">Abrir arquivo</a>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Relatório imprimível (Salvar como PDF) — reflete o filtro atual */}
      <style>{EXTRATO_PRINT_CSS}</style>
      <div className="extrato-report">
        {lodge?.crestUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lodge.crestUrl} alt="" style={{ display: 'block', height: 56, width: 56, objectFit: 'contain', margin: '0 auto 6px' }} />
        ) : null}
        <h1>{lodge?.name ? `${lodge.name} — ` : ''}Meu extrato — {member?.name ?? ''}</h1>
        <p className="sub">
          {TYPE_FILTER_LABEL[typeFilter]} · {STATUS_FILTER_LABEL[statusFilter]}
          {' · '}{filteredAccounts.length} lançamento(s) · Emitido em {new Date().toLocaleDateString('pt-BR')}
        </p>
        <table>
          <thead>
            <tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Status</th><th>Valor</th></tr>
          </thead>
          <tbody>
            {filteredAccounts.map((account) => (
              <tr key={account.id}>
                <td>{new Date(account.dueDate).toLocaleDateString('pt-BR')}</td>
                <td>{account.title}</td>
                <td>{account.chartAccount ? `${account.chartAccount.category ? account.chartAccount.category + ' — ' : ''}${account.chartAccount.name}` : '—'}</td>
                <td>{account.type === 'RECEIVABLE' ? 'A receber' : 'A pagar'}</td>
                <td>{ACCOUNT_STATUS_LABEL[account.status] ?? account.status}</td>
                <td>R$ {Number(account.amount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="total">Saldo do filtro (a receber − a pagar): R$ {filteredTotal.toFixed(2)}</p>
      </div>
    </main>
  );
}
