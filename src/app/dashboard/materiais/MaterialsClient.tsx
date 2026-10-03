'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, CollapsibleCard, EmptyState, Field, FormCard, inputClass, useConfirm, Toast } from '@/components/ui';
import { MATERIAL_CATEGORIES } from '@/lib/masonic-reference';
import { symbolicSituation, isEligibleForDegree, type SymbolicSituation } from '@/lib/masonic-degree';
import { INCIDENT_KINDS, KIND_LABEL, STATUS_LABEL, awaitingReplacement, type IncidentKind, type IncidentStatus, type Resolution } from '@/lib/inventory';
import { flushSync } from 'react-dom';
import { ReportActions, ReportDocument, type Signatory } from '@/components/report/report-document';
import { OfficialDocument } from '@/components/report/official-document';
import type { Letterhead } from '@/lib/letterhead';
import { brl } from '@/lib/currency';
import { deliveryStatement, isSupplyKind, needsCatalogManager, SUPPLY_KIND_LABEL, SUPPLY_KINDS, type SupplyKind } from '@/lib/material-supply';

interface RiteOption { id: string; name: string; }
interface MemberOption {
  id: string;
  name: string;
  initiationDate?: string | null;
  elevationDate?: string | null;
  exaltationDate?: string | null;
  installationDate?: string | null;
}
interface MaterialItem {
  id: string;
  name: string;
  category: string | null;
  requiredDegree: string | null;
  quantity: number;
  availableQuantity: number;
  notes: string | null;
  active: boolean;
  rite: RiteOption | null;
}
interface LoanItem {
  id: string;
  quantity: number;
  kind: string;
  unitPrice: number | null;
  status: string;
  issuedAt: string;
  notes: string | null;
  material: { id: string; name: string };
  member: { id: string; name: string };
}

interface IncidentItem {
  id: string;
  materialId: string;
  materialName: string;
  kind: string;
  quantity: number;
  requestReplacement: boolean;
  status: string;
  notes: string | null;
  reportedByName: string | null;
  reportedAt: string;
  resolvedByName: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  open: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  written_off: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  replaced: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  dismissed: 'border-white/10 bg-white/5 text-sand-dark',
};
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

const DEGREE_OPTIONS: SymbolicSituation[] = ['Aprendiz', 'Companheiro', 'Mestre', 'Mestre Instalado'];
const INPUT_CLASS = inputClass;

const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const asKind = (k: string): SupplyKind => (isSupplyKind(k) ? k : 'loan');
const kindLabel = (l: { kind: string }) => SUPPLY_KIND_LABEL[asKind(l.kind)];
const SUPPLY_HINT: Record<SupplyKind, string> = {
  loan: 'Material da loja, fica com o obreiro sob Termo de responsabilidade e volta quando solicitado.',
  potencia: 'Material enviado pela Potência (ex.: rituais): sem custo para a loja e para o obreiro, é dele e não volta. Não usa o estoque da loja.',
  sale: 'O obreiro compra da loja: a unidade sai do estoque e a Tesouraria recebe uma conta a receber (1.2.04 Venda de Materiais e Paramentos).',
  donation: 'A loja presenteia o obreiro: a unidade sai do estoque, sem custo para ele.',
};

interface Props {
  letterhead: Letterhead;
  /** Quem assina o termo pela loja (Secretário e Arquiteto em exercício). */
  signatures: Signatory[];
  issuedBy?: string | null;
  materials: MaterialItem[];
  loans: LoanItem[];
  incidents: IncidentItem[];
  /** Cadastro (criar/editar/remover materiais) e decisão sobre baixa/reposição. */
  canManageCatalog: boolean;
  /** Operação do inventário: registrar ocorrências e fornecer/receber materiais. */
  canOperate: boolean;
  members: MemberOption[];
  rites: RiteOption[];
}

export default function MaterialsClient({ letterhead, signatures, issuedBy, materials, loans, incidents, canManageCatalog, canOperate, members, rites }: Props) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const emptyForm = { name: '', category: '', requiredDegree: '', quantity: '1', riteId: '', notes: '' };
  const [form, setForm] = useState(emptyForm);

  const emptyLoanForm = { kind: 'loan' as SupplyKind, materialId: '', memberId: '', quantity: '1', notes: '', unitPrice: '', dueDate: todayISO() };
  const [loanForm, setLoanForm] = useState(emptyLoanForm);
  const [converting, setConverting] = useState<{ id: string; kind: SupplyKind; unitPrice: string; dueDate: string } | null>(null);
  const [loanSubmitting, setLoanSubmitting] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const emptyIncidentForm = { materialId: '', kind: 'damage' as IncidentKind, quantity: '1', requestReplacement: true, notes: '' };
  const [incidentForm, setIncidentForm] = useState(emptyIncidentForm);
  const [incidentSubmitting, setIncidentSubmitting] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [showAllIncidents, setShowAllIncidents] = useState(false);

  function startEdit(material: MaterialItem) {
    setEditingId(material.id);
    setForm({
      name: material.name,
      category: material.category ?? '',
      requiredDegree: material.requiredDegree ?? '',
      quantity: String(material.quantity),
      riteId: material.rite?.id ?? '',
      notes: material.notes ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...form, quantity: Number(form.quantity) };
      const response = await fetch(editingId ? `/api/materials/${editingId}` : '/api/materials', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ kind: 'ok', text: editingId ? 'Material atualizado.' : 'Material cadastrado.' });
        cancelEdit();
        router.refresh();
      } else {
        setMessage({ kind: 'error', text: data.error ?? 'Erro ao salvar.' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(material: MaterialItem) {
    await fetch(`/api/materials/${material.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !material.active }),
    });
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!(await askConfirm({ title: 'Remover material', message: 'Remove este item do inventário. Se já houver fornecimento registrado, use "Inativar" em vez de excluir.', confirmLabel: 'Remover', intent: 'danger' }))) return;
    const response = await fetch(`/api/materials/${id}`, { method: 'DELETE' });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      router.refresh();
    } else {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao remover.' });
    }
  }

  async function seedDefaults() {
    setSeeding(true);
    setMessage(null);
    const response = await fetch('/api/materials/seed-defaults', { method: 'POST' });
    const data = await response.json();
    setSeeding(false);
    if (response.ok) {
      setMessage({ kind: 'ok', text: `Lista padrão carregada: ${data.created} novo(s), ${data.skipped} já existiam.` });
      router.refresh();
    } else {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao carregar lista padrão.' });
    }
  }

  const selectedLoanMaterial = materials.find((m) => m.id === loanForm.materialId);
  const selectedLoanMember = members.find((m) => m.id === loanForm.memberId);
  const loanEligibility =
    selectedLoanMaterial?.requiredDegree && selectedLoanMember
      ? isEligibleForDegree(symbolicSituation(selectedLoanMember), selectedLoanMaterial.requiredDegree)
      : true;

  async function handleLoanSubmit(event: FormEvent) {
    event.preventDefault();
    setLoanSubmitting(true);
    try {
      const response = await fetch('/api/material-loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...loanForm,
          quantity: Number(loanForm.quantity),
          unitPrice: loanForm.kind === 'sale' ? Number(loanForm.unitPrice) : undefined,
          dueDate: loanForm.kind === 'sale' ? loanForm.dueDate : undefined,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ kind: 'ok', text: loanForm.kind === 'sale' ? 'Venda registrada. A conta a receber foi lançada na Tesouraria.' : 'Fornecimento registrado.' });
        setLoanForm({ ...emptyLoanForm, kind: loanForm.kind });
        router.refresh();
      } else {
        setMessage({ kind: 'error', text: data.error ?? 'Erro ao registrar fornecimento.' });
      }
    } finally {
      setLoanSubmitting(false);
    }
  }

  async function decideLoan(id: string, status: 'returned' | 'lost') {
    if (status === 'lost') {
      const loan = loans.find((l) => l.id === id);
      const ok = await askConfirm({
        title: 'Marcar como extraviado',
        message: loan ? `Marcar "${loan.material.name}" (${loan.quantity}) fornecido a ${loan.member.name} como extraviado? O item sai do controle de fornecimento ativo.` : 'Marcar este fornecimento como extraviado?',
        confirmLabel: 'Marcar como extraviado',
        intent: 'danger',
      });
      if (!ok) return;
    }
    setDecidingId(id);
    try {
      const response = await fetch(`/api/material-loans/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ kind: 'ok', text: status === 'returned' ? 'Marcado como devolvido.' : 'Marcado como extraviado.' });
        router.refresh();
      } else {
        setMessage({ kind: 'error', text: data.error ?? 'Erro ao atualizar.' });
      }
    } finally {
      setDecidingId(null);
    }
  }

  async function convertLoan() {
    if (!converting) return;
    setDecidingId(converting.id);
    try {
      const response = await fetch(`/api/material-loans/${converting.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: converting.kind,
          unitPrice: converting.kind === 'sale' ? Number(converting.unitPrice) : undefined,
          dueDate: converting.kind === 'sale' ? converting.dueDate : undefined,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ kind: 'ok', text: `Modalidade alterada para "${SUPPLY_KIND_LABEL[converting.kind]}".` });
        setConverting(null);
        router.refresh();
      } else {
        setMessage({ kind: 'error', text: data.error ?? 'Erro ao alterar a modalidade.' });
      }
    } finally {
      setDecidingId(null);
    }
  }

  async function handleIncidentSubmit(event: FormEvent) {
    event.preventDefault();
    setIncidentSubmitting(true);
    try {
      const response = await fetch('/api/material-incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...incidentForm, quantity: Number(incidentForm.quantity) }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setMessage({ kind: 'ok', text: incidentForm.requestReplacement ? 'Ocorrência registrada. Administrador, Venerável e Secretário foram avisados da reposição.' : 'Ocorrência registrada.' });
        setIncidentForm(emptyIncidentForm);
        router.refresh();
      } else {
        setMessage({ kind: 'error', text: data.error ?? 'Erro ao registrar ocorrência.' });
      }
    } finally {
      setIncidentSubmitting(false);
    }
  }

  async function resolveIncident(incident: IncidentItem, resolution: Resolution) {
    const units = `${incident.quantity} ${incident.quantity === 1 ? 'unidade' : 'unidades'} de "${incident.materialName}"`;
    const texts: Record<Resolution, { title: string; message: string; label: string; intent?: 'danger' }> = {
      write_off: { title: 'Dar baixa', message: `Dar baixa em ${units}? A quantidade cadastrada diminui.`, label: 'Dar baixa', intent: 'danger' },
      replace: incident.status === 'written_off'
        ? { title: 'Reposição recebida', message: `A reposição de ${units} chegou? A quantidade cadastrada volta a aumentar.`, label: 'Marcar como reposto' }
        : { title: 'Trocar item', message: `Registrar a troca de ${units}? A quantidade cadastrada não muda.`, label: 'Registrar troca' },
      dismiss: { title: 'Dispensar ocorrência', message: `Dispensar a ocorrência de ${units}? Nada muda no estoque e a unidade volta a ficar disponível.`, label: 'Dispensar' },
    };
    const t = texts[resolution];
    if (!(await askConfirm({ title: t.title, message: t.message, confirmLabel: t.label, intent: t.intent }))) return;
    setResolvingId(incident.id);
    try {
      const response = await fetch(`/api/material-incidents/${incident.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setMessage({ kind: 'ok', text: 'Ocorrência atualizada.' });
        router.refresh();
      } else {
        setMessage({ kind: 'error', text: data.error ?? 'Erro ao atualizar a ocorrência.' });
      }
    } finally {
      setResolvingId(null);
    }
  }

  function startIncident(materialId: string) {
    setIncidentForm({ ...emptyIncidentForm, materialId });
    document.getElementById('ocorrencias')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const pendingIncidents = incidents.filter((i) => i.status === 'open' || awaitingReplacement(i));
  const visibleIncidents = showAllIncidents ? incidents : pendingIncidents;
  const lossSummary = useMemo(() => {
    const map = new Map<string, { name: string; wear: number; damage: number; loss: number }>();
    for (const i of incidents) {
      if (i.status === 'dismissed') continue;
      const row = map.get(i.materialId) ?? { name: i.materialName, wear: 0, damage: 0, loss: 0 };
      if (i.kind === 'wear' || i.kind === 'damage' || i.kind === 'loss') row[i.kind] += i.quantity;
      map.set(i.materialId, row);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [incidents]);

  const q = search.trim().toLowerCase();
  const filtered = q ? materials.filter((m) => m.name.toLowerCase().includes(q) || m.category?.toLowerCase().includes(q)) : materials;
  const availableForLoan = materials.filter((m) => m.active && m.availableQuantity > 0);

  // Empréstimos em aberto (voltam à loja) × entregas em definitivo (o material é do obreiro).
  const activeLoans = loans.filter((l) => l.kind === 'loan');
  // O Arquiteto não vê venda/doação: são de quem cuida do cadastro (valores e baixa).
  const allowedKinds = SUPPLY_KINDS.filter((k) => canManageCatalog || !needsCatalogManager(k));
  const deliveries = loans.filter((l) => l.kind !== 'loan');
  // Potência não depende do estoque da loja: qualquer material ativo do catálogo serve.
  const supplyOptions = loanForm.kind === 'potencia' ? materials.filter((m) => m.active) : availableForLoan;

  const loansByMember = useMemo(() => {
    const groups = new Map<string, { memberId: string; memberName: string; loans: LoanItem[]; deliveries: LoanItem[] }>();
    for (const loan of loans) {
      const g = groups.get(loan.member.id) ?? { memberId: loan.member.id, memberName: loan.member.name, loans: [], deliveries: [] };
      (loan.kind === 'loan' ? g.loans : g.deliveries).push(loan);
      groups.set(loan.member.id, g);
    }
    return [...groups.values()].sort((a, b) => a.memberName.localeCompare(b.memberName));
  }, [loans]);

  // Controle por material: quantos emprestados, cedidos pela Potência, vendidos e doados.
  const supplySummary = useMemo(() => {
    const rows = new Map<string, Record<SupplyKind, number> & { name: string }>();
    for (const l of loans) {
      const row = rows.get(l.material.id) ?? { name: l.material.name, loan: 0, potencia: 0, sale: 0, donation: 0 };
      row[asKind(l.kind)] += l.quantity;
      rows.set(l.material.id, row);
    }
    return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [loans]);

  // O que vai para o papel: a lista (padrão) ou os termos de responsabilidade
  // (de todos os obreiros ou de um só). Troca, imprime e volta para a lista.
  const [printMode, setPrintMode] = useState<{ kind: 'list' } | { kind: 'docs'; doc: 'responsibility' | 'delivery'; memberId: string | null }>({ kind: 'list' });
  function printDocs(doc: 'responsibility' | 'delivery', memberId: string | null) {
    flushSync(() => setPrintMode({ kind: 'docs', doc, memberId }));
    window.print();
    setPrintMode({ kind: 'list' });
  }
  const printGroups = printMode.kind === 'docs'
    ? loansByMember.filter((g) => (!printMode.memberId || g.memberId === printMode.memberId) && (printMode.doc === 'responsibility' ? g.loans : g.deliveries).length > 0)
    : [];

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-sand-light">Materiais e patrimônio</h1>
            <p className="mt-1 text-sm text-sand-dark">
              Inventário de uso geral da loja — mobiliário, ornamentos, indumentária, alfaias e rituais — com controle de
              fornecimento a membros por grau{canManageCatalog ? '' : ' e registro de desgaste, danos e perdas'}.
            </p>
          </div>
          {canManageCatalog ? <button
            onClick={seedDefaults}
            disabled={seeding}
            title="Preenche o catálogo com um checklist padrão de materiais (não duplica os já cadastrados)"
            className="rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-gold/80 transition-all duration-200 ease-out hover:border-gold/60 hover:text-gold disabled:opacity-50"
          >
            {seeding ? 'Carregando…' : 'Carregar lista padrão'}
          </button> : null}
        </div>

        <Toast message={message} onClose={() => setMessage(null)} />

        <div className={`grid items-start gap-6 ${canManageCatalog ? 'lg:grid-cols-2' : ''}`}>
          {canManageCatalog ? <FormCard
            title={editingId ? 'Editar material' : 'Novo material'}
            headerAction={editingId ? <button type="button" onClick={cancelEdit} className="rounded text-xs text-sand-dark outline-none hover:text-sand focus-visible:ring-2 focus-visible:ring-gold/60">Cancelar edição</button> : undefined}
          >
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nome do material">
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={INPUT_CLASS} required />
                </Field>
                <Field label="Categoria">
                  <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={INPUT_CLASS} list="material-categories" />
                </Field>
                <datalist id="material-categories">{MATERIAL_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
                <Field label="Quantidade">
                  <input type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={INPUT_CLASS} required />
                </Field>
                <Field label="Grau exigido">
                  <select value={form.requiredDegree} onChange={(e) => setForm({ ...form, requiredDegree: e.target.value })} className={INPUT_CLASS}>
                    <option value="">Sem grau exigido</option>
                    {DEGREE_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Rito" className="md:col-span-2">
                  <select value={form.riteId} onChange={(e) => setForm({ ...form, riteId: e.target.value })} className={`${INPUT_CLASS} md:col-span-2`}>
                    <option value="">Genérico (qualquer rito)</option>
                    {rites.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </Field>
                <Field label="Observações" className="md:col-span-2">
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${INPUT_CLASS} md:col-span-2`} rows={2} />
                </Field>
              </div>
              <Button type="submit" disabled={submitting}>{submitting ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Cadastrar material'}</Button>
            </form>
          </FormCard> : null}

          <CollapsibleCard
            title="Catálogo de materiais"
            count={materials.length}
            defaultOpen
            headerAction={materials.length > 0 ? <input aria-label="Buscar por nome ou categoria" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou categoria…" className={`${INPUT_CLASS} max-w-xs`} /> : undefined}
          >
            <div className="space-y-3">
              {materials.length === 0 ? (
                <EmptyState title="O inventário e as alfaias da Loja aguardam registro." description="Cadastre manualmente ou clique em Carregar lista padrão." />
              ) : filtered.length === 0 ? (
                <p className="text-sm text-sand-dark">Nenhum material encontrado para &quot;{search}&quot;.</p>
              ) : filtered.map((material) => (
                <div key={material.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-4 transition-colors hover:border-white/8 ${!material.active ? 'opacity-50' : ''}`}>
                  <div>
                    <p className="text-sm font-medium text-sand-light">
                      {material.name}
                      {material.category ? <span className="ml-2 rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">{material.category}</span> : null}
                      {material.requiredDegree ? <span className="ml-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-300">{material.requiredDegree}</span> : null}
                    </p>
                    <p className="mt-1 text-xs text-sand-dark">
                      {material.quantity} em estoque · {material.availableQuantity} disponível{material.availableQuantity !== 1 ? 'is' : ''}
                      {material.rite ? ` • ${material.rite.name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {canOperate ? <button onClick={() => startIncident(material.id)} className="text-xs px-1 py-1 text-amber-300 transition hover:text-amber-200">Registrar ocorrência</button> : null}
                    {canManageCatalog ? <>
                      <button onClick={() => startEdit(material)} className="text-xs px-1 py-1 text-gold transition hover:text-gold-light">Editar</button>
                      <button onClick={() => toggleActive(material)} className="text-xs text-sand-dark hover:text-sand-light">{material.active ? 'Inativar' : 'Ativar'}</button>
                      <button onClick={() => void handleDelete(material.id)} className="text-xs px-1 py-1 text-rose-300 transition hover:text-rose-200">Remover</button>
                    </> : null}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleCard>
        </div>

        <div id="ocorrencias" className="scroll-mt-6">
          <CollapsibleCard title="Ocorrências de inventário" count={pendingIncidents.length} defaultOpen={canOperate || pendingIncidents.length > 0}>
            <p className="mb-4 text-xs text-sand-dark">
              Desgaste, dano irreversível ou perda de materiais da loja. Unidades com dano ou perda pendentes saem do disponível até a decisão;
              a baixa e a reposição são decididas por quem cuida do cadastro.
            </p>

            {canOperate ? (
              <form onSubmit={handleIncidentSubmit} className="mb-5 grid gap-4 rounded-lg border border-white/6 bg-sigma-blue-deep/50 p-4 md:grid-cols-2">
                <Field label="Material">
                  <select value={incidentForm.materialId} onChange={(e) => setIncidentForm({ ...incidentForm, materialId: e.target.value })} className={INPUT_CLASS} required>
                    <option value="">Selecione…</option>
                    {materials.filter((m) => m.active).map((m) => <option key={m.id} value={m.id}>{m.name} ({m.quantity} cadastrado{m.quantity !== 1 ? 's' : ''})</option>)}
                  </select>
                </Field>
                <Field label="Ocorrência">
                  <select value={incidentForm.kind} onChange={(e) => setIncidentForm({ ...incidentForm, kind: e.target.value as IncidentKind })} className={INPUT_CLASS}>
                    {INCIDENT_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                  </select>
                </Field>
                <Field label="Quantidade afetada">
                  <input type="number" min="1" value={incidentForm.quantity} onChange={(e) => setIncidentForm({ ...incidentForm, quantity: e.target.value })} className={INPUT_CLASS} required />
                </Field>
                <Field label="Observação">
                  <input value={incidentForm.notes} onChange={(e) => setIncidentForm({ ...incidentForm, notes: e.target.value })} className={INPUT_CLASS} placeholder="O que aconteceu? (opcional)" />
                </Field>
                <label className="flex items-center gap-2 text-sm text-sand md:col-span-2">
                  <input type="checkbox" checked={incidentForm.requestReplacement} onChange={(e) => setIncidentForm({ ...incidentForm, requestReplacement: e.target.checked })} className="h-4 w-4 accent-gold" />
                  Solicitar reposição (avisa por e-mail o Administrador, o Venerável e o Secretário)
                </label>
                <div className="md:col-span-2">
                  <Button type="submit" disabled={incidentSubmitting || materials.length === 0}>{incidentSubmitting ? 'Registrando…' : 'Registrar ocorrência'}</Button>
                </div>
              </form>
            ) : null}

            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-sand-dark">{showAllIncidents ? 'Histórico completo' : 'Pendentes de decisão ou de reposição'}</p>
              <button type="button" onClick={() => setShowAllIncidents(!showAllIncidents)} className="text-xs text-gold transition hover:text-gold-light">
                {showAllIncidents ? 'Ver só pendentes' : 'Ver histórico completo'}
              </button>
            </div>

            <div className="space-y-3">
              {visibleIncidents.length === 0 ? (
                <EmptyState title={showAllIncidents ? 'Nenhuma ocorrência registrada.' : 'Nada pendente no inventário.'} description="Desgaste, danos e perdas registrados aparecem aqui." />
              ) : visibleIncidents.map((i) => (
                <div key={i.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-sand-light">
                      {i.materialName} — {KIND_LABEL[i.kind as IncidentKind] ?? i.kind} ({i.quantity})
                      <span className={`ml-2 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[i.status] ?? STATUS_BADGE.dismissed}`}>{STATUS_LABEL[i.status as IncidentStatus] ?? i.status}</span>
                      {awaitingReplacement(i) ? <span className="ml-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300">Aguardando reposição</span> : i.requestReplacement && i.status === 'open' ? <span className="ml-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300">Reposição solicitada</span> : null}
                    </p>
                    <p className="mt-1 text-xs text-sand-dark">
                      {i.reportedByName ?? 'Arquiteto'} em {fmtDate(i.reportedAt)}{i.notes ? ` • ${i.notes}` : ''}
                    </p>
                    {i.resolvedAt ? <p className="mt-0.5 text-xs text-sand-dark">Decidido por {i.resolvedByName ?? '—'} em {fmtDate(i.resolvedAt)}{i.resolutionNotes ? ` • ${i.resolutionNotes}` : ''}</p> : null}
                  </div>
                  {canManageCatalog && (i.status === 'open' || i.status === 'written_off') ? (
                    <div className="flex flex-wrap items-center gap-3">
                      {i.status === 'open' ? <button disabled={resolvingId === i.id} onClick={() => void resolveIncident(i, 'write_off')} className="text-xs px-1 py-1 text-rose-300 transition hover:text-rose-200 disabled:opacity-40">Dar baixa</button> : null}
                      <button disabled={resolvingId === i.id} onClick={() => void resolveIncident(i, 'replace')} className="text-xs px-1 py-1 text-emerald-300 transition hover:text-emerald-200 disabled:opacity-40">{i.status === 'written_off' ? 'Marcar como reposto' : 'Trocar (repor)'}</button>
                      {i.status === 'open' ? <button disabled={resolvingId === i.id} onClick={() => void resolveIncident(i, 'dismiss')} className="text-xs px-1 py-1 text-sand-dark transition hover:text-sand-light disabled:opacity-40">Dispensar</button> : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {lossSummary.length > 0 ? (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-sand-light">O que a loja perde ao longo do tempo</h3>
                <p className="mt-1 text-xs text-sand-dark">Unidades por material, somando todas as ocorrências não dispensadas.</p>
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-sand-dark/70">
                      <th className="border-b border-white/10 px-2 py-1.5">Material</th>
                      <th className="border-b border-white/10 px-2 py-1.5 text-right">Desgaste</th>
                      <th className="border-b border-white/10 px-2 py-1.5 text-right">Dano</th>
                      <th className="border-b border-white/10 px-2 py-1.5 text-right">Perda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lossSummary.map((row) => (
                      <tr key={row.name}>
                        <td className="border-b border-white/5 px-2 py-1.5 text-sand">{row.name}</td>
                        <td className="border-b border-white/5 px-2 py-1.5 text-right tabular-nums text-sand">{row.wear}</td>
                        <td className="border-b border-white/5 px-2 py-1.5 text-right tabular-nums text-sand">{row.damage}</td>
                        <td className="border-b border-white/5 px-2 py-1.5 text-right tabular-nums text-sand">{row.loss}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CollapsibleCard>
        </div>

        {canOperate ? <CollapsibleCard title="Fornecimento de materiais" count={activeLoans.length} defaultOpen={activeLoans.length > 0}>
          <form onSubmit={handleLoanSubmit} className="mb-5 grid gap-4 rounded-lg border border-white/6 bg-sigma-blue-deep/50 p-4 md:grid-cols-2">
            <Field label="Modalidade">
              <select value={loanForm.kind} onChange={(e) => setLoanForm({ ...loanForm, kind: e.target.value as SupplyKind, materialId: '' })} className={INPUT_CLASS}>
                {allowedKinds.map((k) => <option key={k} value={k}>{k === 'potencia' && letterhead.powerName ? `Cedido pela Potência (${letterhead.powerName})` : SUPPLY_KIND_LABEL[k]}</option>)}
              </select>
            </Field>
            <Field label="Material">
              <select value={loanForm.materialId} onChange={(e) => setLoanForm({ ...loanForm, materialId: e.target.value })} className={INPUT_CLASS} required>
                <option value="">Selecione…</option>
                {supplyOptions.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}{loanForm.kind === 'potencia' ? '' : ` (${m.availableQuantity} disponível)`}</option>
                ))}
              </select>
            </Field>
            <Field label="Membro">
              <select value={loanForm.memberId} onChange={(e) => setLoanForm({ ...loanForm, memberId: e.target.value })} className={INPUT_CLASS} required>
                <option value="">Selecione…</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
            <Field label="Quantidade">
              <input type="number" min="1" value={loanForm.quantity} onChange={(e) => setLoanForm({ ...loanForm, quantity: e.target.value })} className={INPUT_CLASS} required />
            </Field>
            {loanForm.kind === 'sale' ? (
              <>
                <Field label="Valor unitário (R$)">
                  <input type="number" min="0.01" step="0.01" value={loanForm.unitPrice} onChange={(e) => setLoanForm({ ...loanForm, unitPrice: e.target.value })} className={INPUT_CLASS} required />
                </Field>
                <Field label="Vencimento da cobrança">
                  <input type="date" value={loanForm.dueDate} onChange={(e) => setLoanForm({ ...loanForm, dueDate: e.target.value })} className={INPUT_CLASS} required />
                </Field>
              </>
            ) : null}
            <Field label="Observação">
              <input value={loanForm.notes} onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })} className={INPUT_CLASS} placeholder="Observação (opcional)" />
            </Field>
            <p className="text-xs text-sand-dark md:col-span-2">{SUPPLY_HINT[loanForm.kind]}</p>
            {!loanEligibility ? (
              <p className="text-xs text-rose-300 md:col-span-2">
                Este membro ainda não atingiu o grau exigido ({selectedLoanMaterial?.requiredDegree}) para este material.
              </p>
            ) : null}
            <div className="md:col-span-2">
              <Button type="submit" disabled={loanSubmitting || supplyOptions.length === 0}>{loanSubmitting ? 'Registrando…' : 'Registrar fornecimento'}</Button>
            </div>
          </form>

          <div className="space-y-3">
            {activeLoans.length === 0 ? (
              <EmptyState title="Nenhum empréstimo em aberto." description="Materiais da loja emprestados a obreiros aparecem aqui até serem devolvidos. Entregas em definitivo (Potência, venda, doação) ficam em Materiais em posse por obreiro." />
            ) : activeLoans.map((loan) => (
              <div key={loan.id} className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-sand-light">{loan.member.name} — {loan.material.name} ({loan.quantity})</p>
                    <p className="mt-1 text-xs text-sand-dark">emprestado desde {fmtDate(loan.issuedAt)}{loan.notes ? ` • ${loan.notes}` : ''}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button disabled={decidingId === loan.id} onClick={() => void decideLoan(loan.id, 'returned')} className="text-xs px-1 py-1 text-emerald-300 transition hover:text-emerald-200 disabled:opacity-40">Marcar como devolvido</button>
                    <button disabled={decidingId === loan.id} onClick={() => void decideLoan(loan.id, 'lost')} className="text-xs px-1 py-1 text-rose-300 transition hover:text-rose-200 disabled:opacity-40">Marcar como extraviado</button>
                    <button disabled={decidingId === loan.id} onClick={() => setConverting(converting?.id === loan.id ? null : { id: loan.id, kind: 'potencia', unitPrice: '', dueDate: todayISO() })} className="text-xs px-1 py-1 text-gold/80 transition hover:text-gold disabled:opacity-40">Alterar modalidade</button>
                  </div>
                </div>
                {converting?.id === loan.id ? (
                  <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-gold/20 bg-gold/5 p-3">
                    <label className="text-xs text-sand-dark">Passa a ser
                      <select value={converting.kind} onChange={(e) => setConverting({ ...converting, kind: e.target.value as SupplyKind })} className={`mt-1 block ${INPUT_CLASS}`}>
                        {allowedKinds.filter((k) => k !== 'loan').map((k) => <option key={k} value={k}>{SUPPLY_KIND_LABEL[k]}</option>)}
                      </select>
                    </label>
                    {converting.kind === 'sale' ? (
                      <>
                        <label className="text-xs text-sand-dark">Valor unitário (R$)
                          <input type="number" min="0.01" step="0.01" value={converting.unitPrice} onChange={(e) => setConverting({ ...converting, unitPrice: e.target.value })} className={`mt-1 block w-32 ${INPUT_CLASS}`} />
                        </label>
                        <label className="text-xs text-sand-dark">Vencimento
                          <input type="date" value={converting.dueDate} onChange={(e) => setConverting({ ...converting, dueDate: e.target.value })} className={`mt-1 block ${INPUT_CLASS}`} />
                        </label>
                      </>
                    ) : null}
                    <Button type="button" disabled={decidingId === loan.id} onClick={() => void convertLoan()}>Confirmar</Button>
                    <p className="w-full text-xs text-sand-dark">{SUPPLY_HINT[converting.kind]} O material deixa de ser empréstimo e passa a ser do obreiro.</p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </CollapsibleCard> : null}

        <CollapsibleCard title="Materiais em posse por obreiro" count={loansByMember.length} defaultOpen={false}>
          <div className="mb-4">
            <ReportActions disabled={loansByMember.length === 0}>
              <Button type="button" variant="secondary" disabled={!loansByMember.some((g) => g.loans.length > 0)} onClick={() => printDocs('responsibility', null)}>Termos de responsabilidade</Button>
              <Button type="button" variant="secondary" disabled={!loansByMember.some((g) => g.deliveries.length > 0)} onClick={() => printDocs('delivery', null)}>Termos de entrega</Button>
            </ReportActions>
            <p className="mt-2 text-xs text-sand-dark">
              <strong>Termo de responsabilidade</strong>: material emprestado pela loja, que volta. <strong>Termo de entrega</strong>:
              material que passou a ser do obreiro (cedido pela Potência, comprado ou doado pela loja).
            </p>
          </div>

          {supplySummary.length > 0 ? (
            <div className="mb-6 overflow-x-auto">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-sand-dark">Resumo por material</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-sand-dark/70">
                    <th className="border-b border-white/10 px-2 py-1.5">Material</th>
                    {SUPPLY_KINDS.map((k) => <th key={k} className="border-b border-white/10 px-2 py-1.5 text-right">{k === 'loan' ? 'Emprestados' : SUPPLY_KIND_LABEL[k]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {supplySummary.map((row) => (
                    <tr key={row.name}>
                      <td className="border-b border-white/5 px-2 py-1.5 text-sand">{row.name}</td>
                      {SUPPLY_KINDS.map((k) => <td key={k} className="border-b border-white/5 px-2 py-1.5 text-right tabular-nums text-sand">{row[k] || '—'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="space-y-6">
            {loansByMember.length === 0 ? (
              <p className="text-sm text-sand-dark">Nenhum material em posse de obreiros no momento.</p>
            ) : loansByMember.map((group) => (
              <div key={group.memberId}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-sand-light">{group.memberName}</h3>
                  <div className="flex gap-3">
                    {group.loans.length > 0 ? <button type="button" onClick={() => printDocs('responsibility', group.memberId)} className="text-xs text-gold/80 transition hover:text-gold">Termo de responsabilidade</button> : null}
                    {group.deliveries.length > 0 ? <button type="button" onClick={() => printDocs('delivery', group.memberId)} className="text-xs text-gold/80 transition hover:text-gold">Termo de entrega</button> : null}
                  </div>
                </div>
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-sand-dark/70">
                      <th className="border-b border-white/10 px-2 py-1.5">Material</th>
                      <th className="border-b border-white/10 px-2 py-1.5">Modalidade</th>
                      <th className="border-b border-white/10 px-2 py-1.5 text-right">Qtd.</th>
                      <th className="border-b border-white/10 px-2 py-1.5">Desde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...group.loans, ...group.deliveries].map((loan) => (
                      <tr key={loan.id}>
                        <td className="border-b border-white/5 px-2 py-1.5 text-sand">{loan.material.name}</td>
                        <td className="border-b border-white/5 px-2 py-1.5 text-sand-dark">{kindLabel(loan)}</td>
                        <td className="border-b border-white/5 px-2 py-1.5 text-right tabular-nums text-sand">{loan.quantity}</td>
                        <td className="border-b border-white/5 px-2 py-1.5 text-sand-dark">{fmtDate(loan.issuedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {printMode.kind === 'list' ? (
            <ReportDocument
              printOnly
              lodgeName={letterhead.name}
              crestUrl={letterhead.crestUrl}
              title="Materiais em posse por obreiro"
              details={[`${loansByMember.length} obreiro(s)`, `${activeLoans.length} empréstimo(s) em aberto`, `${deliveries.length} entrega(s) em definitivo`]}
              issuedBy={issuedBy}
            >
              <table>
                <thead>
                  <tr><th>Obreiro</th><th>Material</th><th>Modalidade</th><th className="num">Qtd.</th><th>Desde</th></tr>
                </thead>
                <tbody>
                  {loansByMember.flatMap((group) => [...group.loans, ...group.deliveries].map((loan, i) => (
                    <tr key={loan.id}>
                      <td>{i === 0 ? group.memberName : ''}</td>
                      <td>{loan.material.name}</td>
                      <td>{kindLabel(loan)}</td>
                      <td className="num">{loan.quantity}</td>
                      <td>{fmtDate(loan.issuedAt)}</td>
                    </tr>
                  )))}
                  <tr className="rpt-total">
                    <td colSpan={3}>Total</td>
                    <td className="num">{loans.reduce((sum, l) => sum + l.quantity, 0)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </ReportDocument>
          ) : (
            // Um termo por obreiro, cada um na sua página.
            <div className="rpt-doc hidden">
              {printGroups.map((group, i) => {
                const items = printMode.doc === 'responsibility' ? group.loans : group.deliveries;
                return (
                  <OfficialDocument
                    key={group.memberId}
                    printOnly
                    withPrintCss={i === 0}
                    pageBreakBefore={i > 0}
                    letterhead={letterhead}
                    title={printMode.doc === 'responsibility' ? 'Termo de responsabilidade' : 'Termo de entrega'}
                    subtitle={printMode.doc === 'responsibility' ? 'Guarda de materiais da loja' : 'Materiais de propriedade do obreiro'}
                    issuedBy={issuedBy}
                    signatures={[{ role: printMode.doc === 'responsibility' ? 'Obreiro responsável' : 'Obreiro', name: group.memberName }, ...signatures]}
                  >
                    {printMode.doc === 'responsibility' ? (
                      <p className="text-justify leading-relaxed">
                        Eu, <strong>{group.memberName}</strong>, declaro ter recebido de <strong>{letterhead.name}</strong>, em
                        caráter de empréstimo, os materiais relacionados abaixo, comprometendo-me a zelar por sua guarda e
                        conservação, a devolvê-los quando solicitado ou ao deixar o cargo, e a comunicar à loja qualquer dano
                        ou extravio.
                      </p>
                    ) : (
                      <p className="text-justify leading-relaxed">
                        Eu, <strong>{group.memberName}</strong>, declaro ter recebido, por intermédio de <strong>{letterhead.name}</strong>,
                        os materiais relacionados abaixo, que passam a ser de <strong>minha propriedade</strong>, conforme a
                        origem indicada em cada item. Por não serem empréstimo, não há obrigação de devolução à loja.
                      </p>
                    )}
                    <table className="mt-5">
                      <thead>
                        {printMode.doc === 'responsibility' ? (
                          <tr><th>Material</th><th className="num">Qtd.</th><th>Recebido em</th></tr>
                        ) : (
                          <tr><th>Material</th><th className="num">Qtd.</th><th>Origem</th><th className="num">Valor</th><th>Entregue em</th></tr>
                        )}
                      </thead>
                      <tbody>
                        {items.map((loan) => (
                          printMode.doc === 'responsibility' ? (
                            <tr key={loan.id}>
                              <td>{loan.material.name}</td>
                              <td className="num">{loan.quantity}</td>
                              <td>{fmtDate(loan.issuedAt)}</td>
                            </tr>
                          ) : (
                            <tr key={loan.id}>
                              <td>{loan.material.name}</td>
                              <td className="num">{loan.quantity}</td>
                              <td>{deliveryStatement(asKind(loan.kind), letterhead.powerName)}</td>
                              <td className="num">{loan.kind === 'sale' && loan.unitPrice != null ? brl(loan.unitPrice * loan.quantity) : 'Sem custo'}</td>
                              <td>{fmtDate(loan.issuedAt)}</td>
                            </tr>
                          )
                        ))}
                      </tbody>
                    </table>
                  </OfficialDocument>
                );
              })}
            </div>
          )}
        </CollapsibleCard>
      </div>
    </main>
  );
}
