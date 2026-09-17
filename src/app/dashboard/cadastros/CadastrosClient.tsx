"use client";

import { useState } from 'react';
import { Alert, CollapsibleCard, useConfirm } from '@/components/ui';
import { useRouter } from 'next/navigation';

interface Item { id: string; name: string; order: number; }

function InlineEdit({ value, onSave, onCancel }: { value: string; onSave: (v: string) => Promise<void>; onCancel: () => void }) {
  const [edit, setEdit] = useState(value);
  const [saving, setSaving] = useState(false);
  return (
    <form onSubmit={async (e) => { e.preventDefault(); setSaving(true); await onSave(edit); setSaving(false); }} className="flex gap-2 flex-1">
      <input
        value={edit} onChange={(e) => setEdit(e.target.value)}
        className="flex-1 rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-3 py-1.5 text-sm text-sand-light outline-none focus:border-gold/50"
        autoFocus
      />
      <button type="submit" disabled={saving || !edit.trim()} className="text-xs text-gold hover:text-gold-light disabled:opacity-40">Salvar</button>
      <button type="button" onClick={onCancel} className="text-xs text-sand-dark hover:text-sand">Cancelar</button>
    </form>
  );
}

export default function CadastrosClient({ rites, powers }: { rites: Item[]; powers: Item[] }) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [riteName, setRiteName] = useState('');
  const [powerName, setPowerName] = useState('');
  const [editingRite, setEditingRite] = useState<string | null>(null);
  const [editingPower, setEditingPower] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [seeding, setSeeding] = useState(false);

  async function seedDefaults() {
    setSeeding(true);
    setMessage(null);
    const res = await fetch('/api/lodges/seed-defaults', { method: 'POST' });
    const data = await res.json();
    setSeeding(false);
    if (res.ok) {
      const s = data.seeded ?? {};
      setMessage({ kind: 'ok', text: `Dados padrão populados: ${s.rites ?? 0} ritos, ${s.powers ?? 0} potências, ${s.chartAccounts ?? 0} contas do plano (em Cadastros financeiros).` });
      router.refresh();
    } else {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao popular dados padrão.' });
    }
  }

  async function createRite(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/rites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: riteName, order: 1 }),
    });
    const data = await response.json();
    if (response.ok) {
      setMessage({ kind: 'ok', text: 'Rito criado com sucesso.' });
      setRiteName('');
      router.refresh();
    } else {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao criar rito.' });
    }
  }

  async function createPower(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/powers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: powerName, order: 1 }),
    });
    const data = await response.json();
    if (response.ok) {
      setMessage({ kind: 'ok', text: 'Potência criada com sucesso.' });
      setPowerName('');
      router.refresh();
    } else {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao criar potência.' });
    }
  }

  async function renameRite(id: string, name: string) {
    const res = await fetch(`/api/rites/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    setEditingRite(null);
    if (res.ok) {
      setMessage({ kind: 'ok', text: 'Rito atualizado.' });
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setMessage({ kind: 'error', text: d.error ?? 'Erro ao renomear rito.' });
    }
  }

  async function renamePower(id: string, name: string) {
    const res = await fetch(`/api/powers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    setEditingPower(null);
    if (res.ok) {
      setMessage({ kind: 'ok', text: 'Potência atualizada.' });
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setMessage({ kind: 'error', text: d.error ?? 'Erro ao renomear potência.' });
    }
  }

  async function removeRite(id: string) {
    if (!(await askConfirm({ title: 'Remover rito', message: 'Remover este rito?', confirmLabel: 'Remover', intent: 'danger' }))) return;
    const res = await fetch(`/api/rites/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setMessage({ kind: 'ok', text: 'Rito removido.' });
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setMessage({ kind: 'error', text: d.error ?? 'Erro ao remover rito.' });
    }
  }

  async function removePower(id: string) {
    if (!(await askConfirm({ title: 'Remover potência', message: 'Remover esta potência?', confirmLabel: 'Remover', intent: 'danger' }))) return;
    const res = await fetch(`/api/powers/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setMessage({ kind: 'ok', text: 'Potência removida.' });
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setMessage({ kind: 'error', text: d.error ?? 'Erro ao remover potência.' });
    }
  }

  const INPUT = "flex-1 rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 ease-out focus:border-gold/50 focus:ring-2 focus:ring-gold/20";
  const ADD_BTN = "rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark";

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-sand-light">Cadastros mestre</h1>
            <p className="mt-1 text-sm text-sand-dark">Ritos e potências da sua loja.</p>
          </div>
          <button
            onClick={seedDefaults}
            disabled={seeding}
            title="Preenche ritos, potências e o plano de contas (em Cadastros financeiros) com os dados padrão da Maçonaria brasileira (não duplica)"
            className="rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-gold/80 transition-all duration-200 ease-out hover:border-gold/60 hover:text-gold disabled:opacity-50"
          >
            {seeding ? 'Populando…' : 'Popular dados padrão (Brasil)'}
          </button>
        </div>

        {message ? <Alert intent={message.kind === 'ok' ? 'ok' : 'danger'}>{message.text}</Alert> : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <CollapsibleCard title="Ritos" count={rites.length} defaultOpen={rites.length <= 10}>
            <form onSubmit={createRite} className="flex gap-3">
              <input value={riteName} onChange={(event) => setRiteName(event.target.value)} className={INPUT} placeholder="Nome do rito" />
              <button type="submit" className={ADD_BTN}>Adicionar</button>
            </form>
            {rites.length === 0 ? (
              <p className="mt-4 text-sm text-sand-dark">Nenhum rito cadastrado.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {rites.map((rite) => (
                  <li key={rite.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-2.5 text-sm text-sand-light hover:border-white/[8%]">
                    {editingRite === rite.id ? (
                      <InlineEdit value={rite.name} onSave={(v) => renameRite(rite.id, v)} onCancel={() => setEditingRite(null)} />
                    ) : (
                      <>
                        <span className="flex-1">{rite.name}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <button onClick={() => setEditingRite(rite.id)} className="text-xs text-sand-dark hover:text-gold">Editar</button>
                          <button onClick={() => removeRite(rite.id)} className="text-xs text-rose-300/70 hover:text-rose-300">Remover</button>
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CollapsibleCard>

          <CollapsibleCard title="Potências" count={powers.length} defaultOpen={powers.length <= 10}>
            <form onSubmit={createPower} className="flex gap-3">
              <input value={powerName} onChange={(event) => setPowerName(event.target.value)} className={INPUT} placeholder="Nome da potência (com sigla do estado)" />
              <button type="submit" className={ADD_BTN}>Adicionar</button>
            </form>
            {powers.length === 0 ? (
              <p className="mt-4 text-sm text-sand-dark">Nenhuma potência cadastrada.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {powers.map((power) => (
                  <li key={power.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-2.5 text-sm text-sand-light hover:border-white/[8%]">
                    {editingPower === power.id ? (
                      <InlineEdit value={power.name} onSave={(v) => renamePower(power.id, v)} onCancel={() => setEditingPower(null)} />
                    ) : (
                      <>
                        <span className="flex-1">{power.name}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <button onClick={() => setEditingPower(power.id)} className="text-xs text-sand-dark hover:text-gold">Editar</button>
                          <button onClick={() => removePower(power.id)} className="text-xs text-rose-300/70 hover:text-rose-300">Remover</button>
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CollapsibleCard>
        </div>
      </div>
    </main>
  );
}
