'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, CollapsibleCard, EmptyState, FormCard, inputClass, Alert, useConfirm } from '@/components/ui';
import { MATERIAL_CATEGORIES } from '@/lib/masonic-reference';
import { symbolicSituation, isEligibleForDegree, type SymbolicSituation } from '@/lib/masonic-degree';

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
  status: string;
  issuedAt: string;
  notes: string | null;
  material: { id: string; name: string };
  member: { id: string; name: string };
}

const DEGREE_OPTIONS: SymbolicSituation[] = ['Aprendiz', 'Companheiro', 'Mestre', 'Mestre Instalado'];
const INPUT_CLASS = inputClass;

const POSSE_PRINT_CSS = `
@media print {
  @page { size: A4; margin: 16mm 14mm; }
  body * { visibility: hidden !important; }
  .posse-print, .posse-print * { visibility: visible !important; }
  .posse-print { position: absolute; left: 0; top: 0; width: 100%; color: #111 !important; background: #fff !important; font-family: Georgia, "Times New Roman", serif !important; font-size: 9.5pt; }
  .posse-noprint { display: none !important; }
  .posse-print h1, .posse-print h2, .posse-print h3 { color: #111 !important; }
  .posse-print table { width: 100%; border-collapse: collapse; }
  .posse-print th, .posse-print td { border-bottom: 1px solid #ddd; padding: 3px 6px; text-align: left; }
  .posse-print th { text-transform: uppercase; font-size: 8pt; border-bottom: 1.5px solid #333; }
}
`;

export default function MaterialsClient({ lodgeName, crestUrl, materials, loans, members, rites }: { lodgeName: string; crestUrl: string | null; materials: MaterialItem[]; loans: LoanItem[]; members: MemberOption[]; rites: RiteOption[] }) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const emptyForm = { name: '', category: '', requiredDegree: '', quantity: '1', riteId: '', notes: '' };
  const [form, setForm] = useState(emptyForm);

  const emptyLoanForm = { materialId: '', memberId: '', quantity: '1', notes: '' };
  const [loanForm, setLoanForm] = useState(emptyLoanForm);
  const [loanSubmitting, setLoanSubmitting] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);

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
        body: JSON.stringify({ ...loanForm, quantity: Number(loanForm.quantity) }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ kind: 'ok', text: 'Fornecimento registrado.' });
        setLoanForm(emptyLoanForm);
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

  const q = search.trim().toLowerCase();
  const filtered = q ? materials.filter((m) => m.name.toLowerCase().includes(q) || m.category?.toLowerCase().includes(q)) : materials;
  const availableForLoan = materials.filter((m) => m.active && m.availableQuantity > 0);

  const loansByMember = useMemo(() => {
    const groups = new Map<string, { memberId: string; memberName: string; items: LoanItem[] }>();
    for (const loan of loans) {
      const g = groups.get(loan.member.id) ?? { memberId: loan.member.id, memberName: loan.member.name, items: [] };
      g.items.push(loan);
      groups.set(loan.member.id, g);
    }
    return [...groups.values()].sort((a, b) => a.memberName.localeCompare(b.memberName));
  }, [loans]);

  return (
    <main className="min-h-screen px-6 py-12">
      <style dangerouslySetInnerHTML={{ __html: POSSE_PRINT_CSS }} />
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-sand-light">Materiais e patrimônio</h1>
            <p className="mt-1 text-sm text-sand-dark">
              Inventário de uso geral da loja — mobiliário, ornamentos, indumentária, alfaias e rituais — com controle de
              fornecimento a membros por grau.
            </p>
          </div>
          <button
            onClick={seedDefaults}
            disabled={seeding}
            title="Preenche o catálogo com um checklist padrão de materiais (não duplica os já cadastrados)"
            className="rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-gold/80 transition-all duration-200 ease-out hover:border-gold/60 hover:text-gold disabled:opacity-50"
          >
            {seeding ? 'Carregando…' : 'Carregar lista padrão'}
          </button>
        </div>

        {message ? <Alert intent={message.kind === 'ok' ? 'ok' : 'danger'}>{message.text}</Alert> : null}

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <FormCard
            title={editingId ? 'Editar material' : 'Novo material'}
            headerAction={editingId ? <button type="button" onClick={cancelEdit} className="rounded text-xs text-sand-dark outline-none hover:text-sand focus-visible:ring-2 focus-visible:ring-gold/60">Cancelar edição</button> : undefined}
          >
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <input aria-label="Nome do material" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={INPUT_CLASS} placeholder="Nome do material" required />
                <input aria-label="Categoria" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={INPUT_CLASS} placeholder="Categoria" list="material-categories" />
                <datalist id="material-categories">{MATERIAL_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
                <input aria-label="Quantidade" type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={INPUT_CLASS} placeholder="Quantidade" required />
                <select aria-label="Grau exigido" value={form.requiredDegree} onChange={(e) => setForm({ ...form, requiredDegree: e.target.value })} className={INPUT_CLASS}>
                  <option value="">Sem grau exigido</option>
                  {DEGREE_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <select aria-label="Rito" value={form.riteId} onChange={(e) => setForm({ ...form, riteId: e.target.value })} className={`${INPUT_CLASS} md:col-span-2`}>
                  <option value="">Genérico (qualquer rito)</option>
                  {rites.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <textarea aria-label="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${INPUT_CLASS} md:col-span-2`} placeholder="Observações" rows={2} />
              </div>
              <Button type="submit" disabled={submitting}>{submitting ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Cadastrar material'}</Button>
            </form>
          </FormCard>

          <CollapsibleCard
            title="Catálogo de materiais"
            count={materials.length}
            defaultOpen
            headerAction={materials.length > 0 ? <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou categoria…" className={`${INPUT_CLASS} max-w-xs`} /> : undefined}
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
                      {material.category ? <span className="ml-2 rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold">{material.category}</span> : null}
                      {material.requiredDegree ? <span className="ml-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-300">{material.requiredDegree}</span> : null}
                    </p>
                    <p className="mt-1 text-xs text-sand-dark">
                      {material.quantity} em estoque · {material.availableQuantity} disponível{material.availableQuantity !== 1 ? 'is' : ''}
                      {material.rite ? ` • ${material.rite.name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => startEdit(material)} className="text-xs text-gold/70 transition hover:text-gold">Editar</button>
                    <button onClick={() => toggleActive(material)} className="text-xs text-sand-dark hover:text-sand-light">{material.active ? 'Inativar' : 'Ativar'}</button>
                    <button onClick={() => void handleDelete(material.id)} className="text-xs text-rose-300/60 transition hover:text-rose-300">Remover</button>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleCard>
        </div>

        <CollapsibleCard title="Fornecimento de materiais" count={loans.length} defaultOpen={loans.length > 0}>
          <form onSubmit={handleLoanSubmit} className="mb-5 grid gap-4 rounded-lg border border-white/6 bg-sigma-blue-deep/50 p-4 md:grid-cols-2">
            <select aria-label="Material" value={loanForm.materialId} onChange={(e) => setLoanForm({ ...loanForm, materialId: e.target.value })} className={INPUT_CLASS} required>
              <option value="">Material</option>
              {availableForLoan.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.availableQuantity} disponível)</option>)}
            </select>
            <select aria-label="Membro" value={loanForm.memberId} onChange={(e) => setLoanForm({ ...loanForm, memberId: e.target.value })} className={INPUT_CLASS} required>
              <option value="">Membro</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <input aria-label="Quantidade" type="number" min="1" value={loanForm.quantity} onChange={(e) => setLoanForm({ ...loanForm, quantity: e.target.value })} className={INPUT_CLASS} placeholder="Quantidade" required />
            <input aria-label="Observação" value={loanForm.notes} onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })} className={INPUT_CLASS} placeholder="Observação (opcional)" />
            {!loanEligibility ? (
              <p className="text-xs text-rose-300 md:col-span-2">
                Este membro ainda não atingiu o grau exigido ({selectedLoanMaterial?.requiredDegree}) para este material.
              </p>
            ) : null}
            <div className="md:col-span-2">
              <Button type="submit" disabled={loanSubmitting || availableForLoan.length === 0}>{loanSubmitting ? 'Registrando…' : 'Registrar fornecimento'}</Button>
            </div>
          </form>

          <div className="space-y-3">
            {loans.length === 0 ? (
              <EmptyState title="Nada saiu do inventário ainda." description="Materiais emitidos a membros (ex.: rituais) aparecem aqui até serem devolvidos." />
            ) : loans.map((loan) => (
              <div key={loan.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-4">
                <div>
                  <p className="text-sm font-medium text-sand-light">{loan.member.name} — {loan.material.name} ({loan.quantity})</p>
                  <p className="mt-1 text-xs text-sand-dark">desde {new Date(loan.issuedAt).toLocaleDateString('pt-BR')}{loan.notes ? ` • ${loan.notes}` : ''}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button disabled={decidingId === loan.id} onClick={() => void decideLoan(loan.id, 'returned')} className="text-xs text-emerald-300/80 transition hover:text-emerald-300 disabled:opacity-40">Marcar como devolvido</button>
                  <button disabled={decidingId === loan.id} onClick={() => void decideLoan(loan.id, 'lost')} className="text-xs text-rose-300/60 transition hover:text-rose-300 disabled:opacity-40">Marcar como extraviado</button>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleCard>

        <CollapsibleCard title="Materiais em posse por obreiro" count={loansByMember.length} defaultOpen={false}>
          <div className="posse-noprint mb-4">
            <button onClick={() => window.print()} disabled={loansByMember.length === 0} className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark disabled:opacity-40">
              Salvar como PDF
            </button>
          </div>

          <div className="posse-print space-y-6">
            <header className="mb-2 hidden text-center print:block">
              {crestUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={crestUrl} alt="" className="mx-auto mb-2 h-14 w-14 object-contain" />
              ) : null}
              <h1 className="text-lg font-bold text-sand-light">{lodgeName}</h1>
              <h2 className="mt-0.5 text-sm text-sand-dark">Materiais em posse por obreiro</h2>
              <p className="mt-0.5 text-xs text-sand-dark">Emitido em {new Date().toLocaleDateString('pt-BR')}</p>
            </header>

            {loansByMember.length === 0 ? (
              <p className="text-sm text-sand-dark">Nenhum material em posse de obreiros no momento.</p>
            ) : loansByMember.map((group) => (
              <div key={group.memberId}>
                <h3 className="text-sm font-semibold text-sand-light">{group.memberName}</h3>
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-sand-dark/70">
                      <th className="border-b border-white/10 px-2 py-1.5">Material</th>
                      <th className="border-b border-white/10 px-2 py-1.5 text-right">Qtd.</th>
                      <th className="border-b border-white/10 px-2 py-1.5">Desde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((loan) => (
                      <tr key={loan.id}>
                        <td className="border-b border-white/5 px-2 py-1.5 text-sand">{loan.material.name}</td>
                        <td className="border-b border-white/5 px-2 py-1.5 text-right tabular-nums text-sand">{loan.quantity}</td>
                        <td className="border-b border-white/5 px-2 py-1.5 text-sand-dark">{new Date(loan.issuedAt).toLocaleDateString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </CollapsibleCard>
      </div>
    </main>
  );
}
