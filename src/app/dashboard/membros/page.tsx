"use client";

import { useEffect, useMemo, useState } from 'react';
import { fetchCep, maskCEP, maskCPF, maskPhone, maskRG } from '@/lib/masks';
import { PHILOSOPHICAL_DEGREES, degreeShort, philosophicalDegree, symbolicSituation, timeInOrderLabel } from '@/lib/masonic-degree';
import { MEMBER_STATUSES, memberStatusFull, memberStatusLabel, memberStatusTone } from '@/lib/member-status';
import { Button, inputClass } from '@/components/ui';

interface Option { id: string; name: string; }
type RelativeKind = 'mother' | 'father' | 'spouse' | 'son' | 'daughter' | 'child' | 'other';
interface RelativeData {
  id?: string;
  kind: RelativeKind;
  name: string;
  birthDate?: string | null;
  cpf?: string | null;
  email?: string | null;
  phone?: string | null;
}
interface Member {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status: string;
  gradeName?: string | null;
  riteId?: string | null;
  powerId?: string | null;
  originPowerId?: string | null;
  birthDate?: string | null;
  cpf?: string | null;
  rg?: string | null;
  maritalStatus?: string | null;
  spouseName?: string | null;
  spouseBirthDate?: string | null;
  childrenNames?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  occupation?: string | null;
  nationality?: string | null;
  addressLine?: string | null;
  addressNumber?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  initiationDate?: string | null;
  elevationDate?: string | null;
  exaltationDate?: string | null;
  installationDate?: string | null;
  initiationLodge?: string | null;
  elevationLodge?: string | null;
  exaltationLodge?: string | null;
  installationLodge?: string | null;
  initiationDegree?: string | null;
  currentDegree?: string | null;
  originLodge?: string | null;
  masonicNumber?: string | null;
  documents?: string | null;
  notes?: string | null;
  rite?: Option | null;
  power?: Option | null;
  originPower?: Option | null;
  relatives?: RelativeData[];
}

type FormState = Record<string, string>;

const INPUT = inputClass; // fonte única do design system (src/components/ui/field-styles)

const emptyForm: FormState = {
  name: '', email: '', phone: '', status: 'active', riteId: '', powerId: '', originPowerId: '',
  birthDate: '', cpf: '', rg: '', maritalStatus: '', occupation: '', nationality: '',
  addressLine: '', addressNumber: '', complement: '', neighborhood: '', city: '', state: '',
  zipCode: '', country: '', initiationDate: '', elevationDate: '', exaltationDate: '',
  installationDate: '', initiationLodge: '', elevationLodge: '', exaltationLodge: '',
  installationLodge: '', currentDegree: '', originLodge: '',
  masonicNumber: '', documents: '', notes: '',
};

const dateInput = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

function memberToForm(m: Member): FormState {
  const f: FormState = { ...emptyForm };
  for (const key of Object.keys(emptyForm)) {
    const v = (m as unknown as Record<string, unknown>)[key];
    f[key] = v == null ? '' : String(v);
  }
  f.riteId = m.rite?.id ?? m.riteId ?? '';
  f.powerId = m.power?.id ?? m.powerId ?? '';
  f.originPowerId = m.originPower?.id ?? m.originPowerId ?? '';
  f.birthDate = dateInput(m.birthDate);
  f.spouseBirthDate = dateInput(m.spouseBirthDate);
  f.initiationDate = dateInput(m.initiationDate);
  f.elevationDate = dateInput(m.elevationDate);
  f.exaltationDate = dateInput(m.exaltationDate);
  f.installationDate = dateInput(m.installationDate);
  return f;
}

const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

const TONE_BADGE: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-300',
  leave: 'bg-gold/15 text-gold',
  suspended: 'bg-rose-500/15 text-rose-300',
  inactive: 'bg-white/5 text-sand-dark',
};

// Evolução maçônica concatenada: (Iniciação; Data; Loja) (Elevação; …) (Exaltação; …) (Instalação; …)
function formatEvolution(m: Member): string {
  const stages: [string, string | null | undefined, string | null | undefined][] = [
    ['Iniciação', m.initiationDate, m.initiationLodge],
    ['Elevação', m.elevationDate, m.elevationLodge],
    ['Exaltação', m.exaltationDate, m.exaltationLodge],
    ['Instalação', m.installationDate, m.installationLodge],
  ];
  const parts = stages
    .filter(([, date, lodge]) => date || lodge)
    .map(([label, date, lodge]) => `(${label}; ${date ? new Date(date).toLocaleDateString('pt-BR') : '—'}; ${lodge || '—'})`);
  return parts.length ? parts.join(' ') : 'Sem marcos registrados';
}

const KIND_LABEL: Record<RelativeKind, string> = { mother: 'Mãe', father: 'Pai', spouse: 'Esposa', son: 'Filho', daughter: 'Filha', child: 'Filho(a)', other: 'Dependente' };

// Relatório de membros: visível apenas na impressão (Salvar como PDF).
const REPORT_PRINT_CSS = `
.members-report { display: none; }
@media print {
  @page { size: A4 portrait; margin: 16mm 14mm; }
  body * { visibility: hidden !important; }
  .members-report { display: block !important; position: absolute; left: 0; top: 0; width: 100%; color: #111 !important; background: #fff !important; font-family: Georgia, "Times New Roman", serif !important; }
  .members-report, .members-report * { visibility: visible !important; }
  .members-report h1 { font-size: 15pt; margin: 0 0 2mm; }
  .members-report .sub { color: #444 !important; font-size: 9pt; margin: 0 0 5mm; }
  .members-report table { width: 100%; border-collapse: collapse; }
  .members-report th { border-bottom: 1.5px solid #333; text-transform: uppercase; font-size: 8pt; text-align: left; padding: 3px 6px; }
  .members-report td { border-bottom: 1px solid #ccc; font-size: 9pt; text-align: left; padding: 3px 6px; }
  .members-report tr { break-inside: avoid; page-break-inside: avoid; }
}
`;

export default function MembrosPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [rites, setRites] = useState<Option[]>([]);
  const [powers, setPowers] = useState<Option[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [lodgeName, setLodgeName] = useState('');
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setLoading(true);
    const [membersResponse, ritesResponse, powersResponse, lodgeResponse] = await Promise.all([
      fetch('/api/members'),
      fetch('/api/rites'),
      fetch('/api/powers'),
      fetch('/api/lodge'),
    ]);
    const membersData = await membersResponse.json();
    const ritesData = await ritesResponse.json();
    const powersData = await powersResponse.json();
    const lodgeData = await lodgeResponse.json().catch(() => ({}));
    setMembers(membersData.items ?? []);
    setRites(ritesData.items ?? []);
    setPowers(powersData.items ?? []);
    setLodgeName(lodgeData?.lodge?.name ?? '');
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return members.filter((m) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (!q) return true;
      const byName = m.name.toLowerCase().includes(q);
      const byCpf = digits.length > 0 && (m.cpf ?? '').replace(/\D/g, '').includes(digits);
      const byCim = (m.masonicNumber ?? '').toLowerCase().includes(q);
      return byName || byCpf || byCim;
    });
  }, [members, query, statusFilter]);

  async function createMember(form: FormState, relatives: RelativeData[]) {
    setSaving(true);
    setMessage('');
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, relatives }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setMessage('Membro cadastrado com sucesso.');
      setCreating(false);
      await loadData();
    } else {
      setMessage(data.error ?? 'Erro ao cadastrar membro.');
    }
  }

  async function updateMember(id: string, form: FormState, relatives: RelativeData[]) {
    setSaving(true);
    setMessage('');
    const res = await fetch(`/api/members/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, relatives }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setMessage('Membro atualizado.');
      setEditingId(null);
      await loadData();
    } else {
      setMessage(data.error ?? 'Erro ao atualizar membro.');
    }
  }

  async function backfillRelatives() {
    if (!window.confirm('Migrar os campos antigos de família (mãe/pai/esposa/filhos) para a nova ficha de dependentes? Só afeta membros que ainda não têm familiares cadastrados.')) return;
    setMessage('');
    const res = await fetch('/api/members/backfill-relatives', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      const s = data.stats ?? {};
      setMessage(`Família migrada: ${s.migrated ?? 0} membro(s), ${s.relativesCreated ?? 0} familiar(es) criado(s).`);
      await loadData();
    } else {
      setMessage(data.error ?? 'Erro ao migrar família.');
    }
  }

  async function deleteMember(m: Member) {
    if (!window.confirm(`Excluir definitivamente o cadastro de "${m.name}"? Esta ação não pode ser desfeita.`)) return;
    setMessage('');
    const res = await fetch(`/api/members/${m.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      setMessage('Membro excluído.');
      await loadData();
    } else {
      setMessage(data.error ?? 'Erro ao excluir membro.');
    }
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-sand-light">Membros</h1>
            <p className="mt-1 text-sm text-sand-dark">Perfil do obreiro: dados pessoais, endereço e evolução maçônica.</p>
          </div>
          <button
            onClick={() => { setCreating((v) => !v); setEditingId(null); }}
            className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark"
          >
            {creating ? 'Fechar' : '+ Novo membro'}
          </button>
        </div>

        {message ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div> : null}

        {creating ? (
          <section className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
            <h2 className="text-base font-semibold text-sand-light">Novo membro</h2>
            <MemberForm initial={emptyForm} initialRelatives={[]} rites={rites} powers={powers} saving={saving} submitLabel="Salvar membro" onSubmit={createMember} onCancel={() => setCreating(false)} />
          </section>
        ) : null}

        <section className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-sand-light">Listagem</h2>
              <button onClick={backfillRelatives} title="Migra os campos antigos de família para a nova ficha de dependentes (idempotente)" className="text-xs text-sand-dark underline-offset-2 transition-colors hover:text-gold hover:underline">migrar família antiga</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${INPUT} w-auto`} aria-label="Filtrar por situação">
                <option value="all">Todas as situações</option>
                {MEMBER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.short}</option>)}
              </select>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={`${INPUT} w-auto min-w-[16rem]`}
                placeholder="Buscar por nome, CPF ou CIM…"
                aria-label="Buscar membros"
              />
              <button onClick={() => window.print()} disabled={filtered.length === 0} title="Gera um PDF dos membros conforme o filtro atual de situação/busca" className="rounded-full border border-gold/40 px-4 py-2.5 text-sm font-medium text-gold/80 transition-all hover:border-gold/60 hover:text-gold disabled:opacity-40">Relatório PDF</button>
            </div>
          </div>

          <p className="mt-3 text-xs text-sand-dark">{loading ? 'Carregando…' : `${filtered.length} de ${members.length} membro(s)${statusFilter !== 'all' ? ` · situação: ${memberStatusLabel(statusFilter)}` : ''}`}</p>

          <div className="mt-4 overflow-hidden rounded-lg border border-white/[6%]">
            {/* Cabeçalho */}
            <div className="hidden grid-cols-[1.6fr_0.9fr_0.7fr_0.9fr_1fr_auto] gap-3 border-b border-white/[6%] bg-sigma-blue-deep/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-sand-dark md:grid">
              <span>Nome</span><span>Grau</span><span>Status</span><span>Rito</span><span>Telefone</span><span className="text-right">Ações</span>
            </div>

            {loading ? (
              <p className="px-4 py-6 text-sm text-sand-dark">Carregando…</p>
            ) : filtered.length === 0 ? (
              <p className="px-4 py-6 text-sm text-sand-dark">{members.length === 0 ? 'Nenhum membro cadastrado.' : 'Nenhum membro encontrado para a busca.'}</p>
            ) : (
              filtered.map((m) => {
                const open = expandedId === m.id;
                return (
                  <div key={m.id} className="border-b border-white/[5%] last:border-b-0">
                    {/* Linha compacta */}
                    <button
                      onClick={() => { setExpandedId(open ? null : m.id); setEditingId(null); }}
                      className="grid w-full grid-cols-1 gap-1 px-4 py-3 text-left transition-colors hover:bg-sigma-blue-deep/40 md:grid-cols-[1.6fr_0.9fr_0.7fr_0.9fr_1fr_auto] md:items-center md:gap-3"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-sand-light">
                        <span className={`text-gold transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
                        {m.name}
                      </span>
                      <span className="text-xs text-sand-dark md:text-sm md:text-sand">{degreeShort(m)}</span>
                      <span className="text-xs"><span className={`rounded-full px-2 py-0.5 ${TONE_BADGE[memberStatusTone(m.status)]}`}>{memberStatusLabel(m.status)}</span></span>
                      <span className="text-xs text-sand-dark md:text-sm">{m.rite?.name ?? '—'}</span>
                      <span className="text-xs text-sand-dark md:text-sm">{m.phone || '—'}</span>
                      <span className="hidden text-right text-xs text-gold/70 md:block">{open ? 'fechar' : 'detalhes'}</span>
                    </button>

                    {/* Painel expandido */}
                    {open ? (
                      <div className="border-t border-white/[5%] bg-sigma-blue-deep/30 px-4 py-5">
                        {editingId === m.id ? (
                          <MemberForm initial={memberToForm(m)} initialRelatives={m.relatives ?? []} rites={rites} powers={powers} saving={saving} submitLabel="Salvar alterações" onSubmit={(form, rels) => updateMember(m.id, form, rels)} onCancel={() => setEditingId(null)} />
                        ) : (
                          <div className="space-y-4 text-sm">
                            <div className="grid gap-3 md:grid-cols-2">
                              <Detail label="E-mail" value={m.email} />
                              <Detail label="Telefone" value={m.phone} />
                              <Detail label="CPF" value={m.cpf} />
                              <Detail label="CIM (nº maçônico)" value={m.masonicNumber} />
                              <Detail label="Situação" value={symbolicSituation(m)} />
                              <Detail label="Grau filosófico" value={philosophicalDegree(m) ? `Grau ${philosophicalDegree(m)}` : null} />
                              <Detail label="Tempo de Ordem" value={timeInOrderLabel(m.initiationDate)} />
                              <Detail label="Potência" value={m.power?.name} />
                              <Detail label="Potência de origem" value={m.originPower?.name} />
                              <Detail label="Loja de origem" value={m.originLodge} />
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-gold">Evolução maçônica</p>
                              <p className="mt-1 text-sand">{formatEvolution(m)}</p>
                            </div>
                            {m.relatives && m.relatives.length > 0 ? (
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gold">Família e dependentes</p>
                                <ul className="mt-1 space-y-0.5 text-sand">
                                  {m.relatives.map((r, i) => (
                                    <li key={r.id ?? i}>
                                      <span className="text-sand-dark">{KIND_LABEL[r.kind]}:</span> {r.name}
                                      {r.birthDate ? ` · ${fmtDate(r.birthDate)}` : ''}
                                      {r.phone ? ` · ${r.phone}` : ''}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                            <div className="flex flex-wrap gap-3 pt-1">
                              <button onClick={() => setEditingId(m.id)} className="rounded-full border border-gold/40 px-4 py-2 text-xs font-medium text-gold/80 transition-all hover:border-gold/60 hover:text-gold">Editar</button>
                              <button onClick={() => deleteMember(m)} className="rounded-full border border-rose-500/40 px-4 py-2 text-xs font-medium text-rose-300 transition-all hover:border-rose-500/60 hover:text-rose-200">Excluir cadastro</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Relatório imprimível (Salvar como PDF) — reflete o filtro atual */}
      <style>{REPORT_PRINT_CSS}</style>
      <div className="members-report">
        <h1>{lodgeName || 'Relatório de Membros'}</h1>
        <p className="sub">
          Relatório de Membros — {statusFilter === 'all' ? 'Todas as situações' : memberStatusFull(statusFilter)}
          {query.trim() ? ` · busca: “${query.trim()}”` : ''} · {filtered.length} membro(s) · Emitido em {new Date().toLocaleDateString('pt-BR')}
        </p>
        <table>
          <thead>
            <tr><th>Nome</th><th>Situação</th><th>Grau</th><th>CIM</th><th>Tempo de Ordem</th><th>Telefone</th><th>E-mail</th></tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{memberStatusLabel(m.status)}</td>
                <td>{degreeShort(m)}</td>
                <td>{m.masonicNumber || '—'}</td>
                <td>{timeInOrderLabel(m.initiationDate) || '—'}</td>
                <td>{m.phone || '—'}</td>
                <td>{m.email || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <p className="text-sand-dark"><span className="text-[11px] uppercase tracking-wide text-sand-dark/70">{label}:</span> <span className="text-sand">{value || '—'}</span></p>
  );
}

const emptyRel = (kind: RelativeKind): RelativeData => ({ kind, name: '', birthDate: '', cpf: '', email: '', phone: '' });
const dateVal = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

// Seção colapsável do formulário (disclosure progressivo): núcleo fica aberto,
// o resto recolhe para reduzir a parede de campos.
function Collapsible({ title, defaultOpen = false, badge, children }: { title: string; defaultOpen?: boolean; badge?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-lg border border-white/[6%] bg-sigma-blue-deep/50">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-white/[3%]">
        <span className="flex items-center gap-2">
          <span className={`text-gold transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>▸</span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{title}</span>
          {badge ? <span className="rounded-full bg-gold/[12%] px-2 py-0.5 text-[10px] font-medium text-gold">{badge}</span> : null}
        </span>
        <span className="text-[11px] text-sand-dark/60">{open ? 'recolher' : 'expandir'}</span>
      </button>
      {open ? <div className="border-t border-white/[6%] px-5 pb-5 pt-4">{children}</div> : null}
    </div>
  );
}

function MemberForm({ initial, initialRelatives, rites, powers, saving, submitLabel, onSubmit, onCancel }: {
  initial: FormState;
  initialRelatives: RelativeData[];
  rites: Option[];
  powers: Option[];
  saving: boolean;
  submitLabel: string;
  onSubmit: (form: FormState, relatives: RelativeData[]) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [cepStatus, setCepStatus] = useState('');
  const set = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  // Situação simbólica derivada dos marcos preenchidos no próprio formulário.
  const formSituation = symbolicSituation({
    initiationDate: form.initiationDate || null,
    elevationDate: form.elevationDate || null,
    exaltationDate: form.exaltationDate || null,
    installationDate: form.installationDate || null,
  });

  // Família: slots fixos (mãe/pai/esposa) + dependentes dinâmicos.
  const pick = (kind: RelativeKind): RelativeData => {
    const found = initialRelatives.find((r) => r.kind === kind);
    return found ? { ...found, birthDate: dateVal(found.birthDate) } : emptyRel(kind);
  };
  const [mother, setMother] = useState<RelativeData>(() => pick('mother'));
  const [father, setFather] = useState<RelativeData>(() => pick('father'));
  const [spouse, setSpouse] = useState<RelativeData>(() => pick('spouse'));
  const [dependents, setDependents] = useState<RelativeData[]>(() =>
    initialRelatives
      .filter((r) => !['mother', 'father', 'spouse'].includes(r.kind))
      .map((r) => ({ ...r, birthDate: dateVal(r.birthDate) })),
  );

  const setRel = (setter: React.Dispatch<React.SetStateAction<RelativeData>>) => (field: keyof RelativeData, value: string) =>
    setter((p) => ({ ...p, [field]: value }));
  const setDep = (idx: number, field: keyof RelativeData, value: string) =>
    setDependents((list) => list.map((d, i) => (i === idx ? { ...d, [field]: value } : d)));
  const addDependent = () => setDependents((list) => [...list, emptyRel('son')]);
  const removeDependent = (idx: number) => setDependents((list) => list.filter((_, i) => i !== idx));

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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const relatives = [mother, father, spouse, ...dependents].filter((r) => r.name.trim().length > 0);
    onSubmit(form, relatives);
  }

  // Abre por padrão só as seções que já têm dados (na edição); no cadastro novo
  // tudo recolhe, deixando o núcleo essencial em foco.
  const hasPersonal = !!(initial.birthDate || initial.cpf || initial.rg || initial.maritalStatus || initial.occupation || initial.nationality);
  const hasAddress = !!(initial.zipCode || initial.addressLine || initial.city || initial.neighborhood || initial.state || initial.country || initial.documents);
  const hasEvolution = !!(initial.initiationDate || initial.elevationDate || initial.exaltationDate || initial.installationDate || initial.currentDegree || initial.masonicNumber || initial.notes);
  const hasOrigin = !!(initial.originPowerId || initial.originLodge);

  return (
    <form onSubmit={submit} className="mt-5 space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <input value={form.name} onChange={(e) => set('name', e.target.value)} className={INPUT} placeholder="Nome completo *" required />
        <input value={form.email} onChange={(e) => set('email', e.target.value)} className={INPUT} placeholder="E-mail" />
        <input value={form.phone} onChange={(e) => set('phone', maskPhone(e.target.value))} inputMode="tel" className={INPUT} placeholder="Telefone" />
        <select value={form.status} onChange={(e) => set('status', e.target.value)} className={INPUT}>
          {MEMBER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={form.riteId} onChange={(e) => set('riteId', e.target.value)} className={INPUT}>
          <option value="">Selecione um rito</option>
          {rites.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select value={form.powerId} onChange={(e) => set('powerId', e.target.value)} className={INPUT}>
          <option value="">Potência atual</option>
          {powers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <p className="-mt-2 text-xs text-sand-dark/70">Preencha o essencial acima (só o nome é obrigatório). Os blocos abaixo são opcionais — expanda conforme a necessidade.</p>

      <Collapsible title="Dados pessoais" defaultOpen={hasPersonal}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block"><span className="text-[11px] uppercase tracking-wide text-sand-dark/70">Nascimento</span>
            <input type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} className={INPUT} /></label>
          <input value={form.cpf} onChange={(e) => set('cpf', maskCPF(e.target.value))} inputMode="numeric" className={INPUT} placeholder="CPF" />
          <input value={form.rg} onChange={(e) => set('rg', maskRG(e.target.value))} className={INPUT} placeholder="RG" />
          <select value={form.maritalStatus} onChange={(e) => set('maritalStatus', e.target.value)} className={INPUT}>
            <option value="">Estado civil</option>
            <option value="single">Solteiro</option>
            <option value="married">Casado</option>
            <option value="divorced">Divorciado</option>
            <option value="widowed">Viúvo</option>
          </select>
          <input value={form.occupation} onChange={(e) => set('occupation', e.target.value)} className={INPUT} placeholder="Profissão" />
          <input value={form.nationality} onChange={(e) => set('nationality', e.target.value)} className={INPUT} placeholder="Nacionalidade" />
        </div>
      </Collapsible>

      <Collapsible title="Família e dependentes" defaultOpen={initialRelatives.length > 0} badge={initialRelatives.length ? `${initialRelatives.length} cadastrado(s)` : undefined}>
        <p className="text-xs text-sand-dark/70">Contatos próprios (e-mail e telefone) para felicitações de aniversário pela Secretária/Hospitalária.</p>
        <div className="mt-4 space-y-3">
          {([['Mãe', mother, setMother], ['Pai', father, setFather], ['Esposa', spouse, setSpouse]] as const).map(([label, rel, setter]) => (
            <div key={label} className="grid gap-2 md:grid-cols-[90px_1.6fr_1fr_1.4fr_1.2fr] md:items-center">
              <span className="text-xs font-medium text-sand">{label}</span>
              <input value={rel.name ?? ''} onChange={(e) => setRel(setter)('name', e.target.value)} className={INPUT} placeholder="Nome" />
              <input type="date" value={rel.birthDate ?? ''} onChange={(e) => setRel(setter)('birthDate', e.target.value)} className={INPUT} />
              <input value={rel.email ?? ''} onChange={(e) => setRel(setter)('email', e.target.value)} className={INPUT} placeholder="E-mail" />
              <input value={rel.phone ?? ''} onChange={(e) => setRel(setter)('phone', maskPhone(e.target.value))} inputMode="tel" className={INPUT} placeholder="Telefone" />
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-white/[6%] pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-sand-dark">Dependentes</p>
            <button type="button" onClick={addDependent} className="rounded-full border border-gold/40 px-3 py-1.5 text-xs font-medium text-gold/80 transition-all hover:border-gold/60 hover:text-gold">+ Adicionar dependente</button>
          </div>
          {dependents.length === 0 ? (
            <p className="mt-3 text-xs text-sand-dark/70">Nenhum dependente cadastrado.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {dependents.map((d, i) => (
                <div key={i} className="grid gap-2 md:grid-cols-[110px_1.4fr_1fr_1fr_1.2fr_1.2fr_auto] md:items-center">
                  <select value={d.kind} onChange={(e) => setDep(i, 'kind', e.target.value)} className={INPUT}>
                    <option value="son">Filho</option>
                    <option value="daughter">Filha</option>
                    <option value="other">Outro</option>
                  </select>
                  <input value={d.name ?? ''} onChange={(e) => setDep(i, 'name', e.target.value)} className={INPUT} placeholder="Nome" />
                  <input type="date" value={d.birthDate ?? ''} onChange={(e) => setDep(i, 'birthDate', e.target.value)} className={INPUT} />
                  <input value={d.cpf ?? ''} onChange={(e) => setDep(i, 'cpf', maskCPF(e.target.value))} inputMode="numeric" className={INPUT} placeholder="CPF" />
                  <input value={d.email ?? ''} onChange={(e) => setDep(i, 'email', e.target.value)} className={INPUT} placeholder="E-mail" />
                  <input value={d.phone ?? ''} onChange={(e) => setDep(i, 'phone', maskPhone(e.target.value))} inputMode="tel" className={INPUT} placeholder="Telefone" />
                  <button type="button" onClick={() => removeDependent(i)} aria-label="Remover dependente" className="justify-self-start rounded-full border border-rose-500/40 px-3 py-1.5 text-xs text-rose-300 transition-all hover:border-rose-500/60 hover:text-rose-200 md:justify-self-center">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Collapsible>

      <Collapsible title="Endereço e documentos" defaultOpen={hasAddress}>
        <div className="grid gap-4 md:grid-cols-2">
          <input value={form.addressLine} onChange={(e) => set('addressLine', e.target.value)} className={`${INPUT} md:col-span-2`} placeholder="Endereço" />
          <input value={form.addressNumber} onChange={(e) => set('addressNumber', e.target.value)} className={INPUT} placeholder="Número" />
          <input value={form.complement} onChange={(e) => set('complement', e.target.value)} className={INPUT} placeholder="Complemento" />
          <input value={form.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} className={INPUT} placeholder="Bairro" />
          <input value={form.city} onChange={(e) => set('city', e.target.value)} className={INPUT} placeholder="Cidade" />
          <input value={form.state} onChange={(e) => set('state', e.target.value)} className={INPUT} placeholder="Estado" />
          <div>
            <input value={form.zipCode} onChange={(e) => set('zipCode', maskCEP(e.target.value))} onBlur={(e) => lookupCep(e.target.value)} inputMode="numeric" className={INPUT} placeholder="CEP (preenche o endereço)" />
            {cepStatus ? <p className="mt-1 text-xs text-sand-dark">{cepStatus}</p> : null}
          </div>
          <input value={form.country} onChange={(e) => set('country', e.target.value)} className={INPUT} placeholder="País" />
          <textarea value={form.documents} onChange={(e) => set('documents', e.target.value)} className={`${INPUT} md:col-span-2`} placeholder="Documentos e observações relevantes" rows={3} />
        </div>
      </Collapsible>

      <Collapsible title="Evolução maçônica" defaultOpen={hasEvolution}>
        <div className="space-y-3">
          {([
            ['Iniciação', 'initiationDate', 'initiationLodge'],
            ['Elevação', 'elevationDate', 'elevationLodge'],
            ['Exaltação', 'exaltationDate', 'exaltationLodge'],
            ['Instalação', 'installationDate', 'installationLodge'],
          ] as const).map(([label, dateKey, lodgeKey]) => (
            <div key={dateKey} className="grid gap-3 md:grid-cols-[120px_1fr_1.4fr] md:items-center">
              <span className="text-xs font-medium text-sand">{label}</span>
              <input type="date" value={form[dateKey]} onChange={(e) => set(dateKey, e.target.value)} className={INPUT} />
              <input value={form[lodgeKey]} onChange={(e) => set(lodgeKey, e.target.value)} className={INPUT} placeholder={`Loja de ${label.toLowerCase()}`} />
            </div>
          ))}
          <div className="mt-3 grid gap-4 border-t border-white/[6%] pt-4 md:grid-cols-2">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-sand-dark/70">Situação simbólica (automática)</span>
              <div className={`${INPUT} flex items-center text-sand`}>{formSituation ?? 'Defina os marcos acima'}</div>
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-sand-dark/70">Grau Filosófico atual (REAA)</span>
              <select value={form.currentDegree} onChange={(e) => set('currentDegree', e.target.value)} className={INPUT}>
                <option value="">— (segue a situação simbólica)</option>
                {PHILOSOPHICAL_DEGREES.map((g) => <option key={g} value={String(g)}>Grau {g}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-sand-dark/70">Tempo de Ordem (automático)</span>
              <div className={`${INPUT} flex items-center text-sand`}>{timeInOrderLabel(form.initiationDate) ?? 'Defina a data de iniciação'}</div>
            </label>
            <input value={form.masonicNumber} onChange={(e) => set('masonicNumber', e.target.value)} className={INPUT} placeholder="Número maçônico (CIM)" />
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} className={`${INPUT} md:col-span-2`} placeholder="Observações maçônicas e administrativas" rows={3} />
          </div>
        </div>
      </Collapsible>

      <Collapsible title="Origem" defaultOpen={hasOrigin}>
        <p className="text-xs text-sand-dark/70">Potência e loja de onde o irmão é originário (se diferente da loja atual).</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <select value={form.originPowerId} onChange={(e) => set('originPowerId', e.target.value)} className={INPUT}>
            <option value="">Potência de origem</option>
            {powers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input value={form.originLodge} onChange={(e) => set('originLodge', e.target.value)} className={INPUT} placeholder="Loja de origem" />
        </div>
      </Collapsible>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : submitLabel}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  );
}
