'use client';

import { useState } from 'react';

interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  after?: string | null;
  createdAt: string;
  userId: string | null;
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

export default function AuditoriaClient({ entries }: { entries: AuditEntry[] }) {
  const [filter, setFilter] = useState('');

  const filtered = filter
    ? entries.filter((e) =>
        [e.entity, e.action, entityLabels[e.entity] ?? e.entity, actionLabels[e.action] ?? e.action].some((s) =>
          s.toLowerCase().includes(filter.toLowerCase()),
        ),
      )
    : entries;

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Auditoria</h1>
          <p className="mt-1 text-sm text-sand-dark">Registro de todas as operações realizadas no sistema.</p>
        </div>

        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 ease-out focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
          placeholder="Filtrar por entidade, ação..."
        />

        <div className="overflow-x-auto rounded-xl border border-white/[6%]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/[6%] bg-sigma-card">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-sand-dark">Data</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-sand-dark">Ação</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-sand-dark">Entidade</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-sand-dark">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-white/[5%] transition-colors hover:bg-white/[3%]">
                  <td className="whitespace-nowrap px-4 py-3 text-sand-dark">{new Date(e.createdAt).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${e.action === 'CREATE' ? 'bg-emerald-500/12 text-emerald-300 border border-emerald-500/20' : e.action === 'DELETE' ? 'bg-rose-500/12 text-rose-300 border border-rose-500/20' : 'bg-gold/12 text-gold border border-gold/15'}`}>
                      {actionLabels[e.action] ?? e.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sand">{entityLabels[e.entity] ?? e.entity}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-sand-dark">{e.after ?? '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-sand-dark">
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
