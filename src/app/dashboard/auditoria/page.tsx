'use client';

import { useEffect, useState } from 'react';

interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  after?: string | null;
  createdAt: string;
  userId: string;
}

const entityLabels: Record<string, string> = {
  account: 'Conta',
  member: 'Membro',
  invoice: 'Fatura',
  payment: 'Pagamento',
  session: 'Sessão',
  office: 'Cargo',
  term: 'Período',
  memberOffice: 'Vinculação',
  cashClose: 'Fechamento',
};

const actionLabels: Record<string, string> = {
  CREATE: 'Criação',
  UPDATE: 'Alteração',
  DELETE: 'Remoção',
};

export default function AuditoriaPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [filter, setFilter] = useState('');

  async function load() {
    const res = await fetch('/api/audit');
    const data = await res.json();
    setEntries(data.items ?? []);
  }

  useEffect(() => { load(); }, []);

  const filtered = filter
    ? entries.filter((e) =>
        [e.entity, e.action, entityLabels[e.entity] ?? e.entity, actionLabels[e.action] ?? e.action].some((s) =>
          s.toLowerCase().includes(filter.toLowerCase()),
        ),
      )
    : entries;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Auditoria</h1>
          <p className="mt-3 text-slate-400">Registro de todas as operações realizadas no sistema.</p>
        </div>

        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3"
          placeholder="Filtrar por entidade, ação..."
        />

        <div className="overflow-x-auto rounded-3xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-slate-900/70">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-400">Data</th>
                <th className="px-4 py-3 font-medium text-slate-400">Ação</th>
                <th className="px-4 py-3 font-medium text-slate-400">Entidade</th>
                <th className="px-4 py-3 font-medium text-slate-400">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-white/5">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-400">{new Date(e.createdAt).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${e.action === 'CREATE' ? 'bg-emerald-500/20 text-emerald-300' : e.action === 'DELETE' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'}`}>
                      {actionLabels[e.action] ?? e.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{entityLabels[e.entity] ?? e.entity}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-slate-500">{e.after ?? '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-slate-500">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
