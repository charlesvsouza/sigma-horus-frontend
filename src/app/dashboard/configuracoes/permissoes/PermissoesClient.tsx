'use client';

import Link from 'next/link';
import { useState } from 'react';

type Matrix = Record<string, Record<string, Record<string, boolean>>>;

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  venerable: 'Venerável',
  treasurer: 'Tesoureiro',
  secretary: 'Secretário',
  member: 'Membro',
};

const RESOURCE_LABELS: Record<string, string> = {
  members: 'Membros',
  documents: 'Documentos',
  messages: 'Comunicação',
  accounts: 'Financeiro',
  portal: 'Portal',
};

const ACTION_LABELS: Record<string, string> = { read: 'Ver', write: 'Editar' };

interface Props {
  initialMatrix: Matrix;
  roles: string[];
  resources: string[];
  actions: string[];
  initialCustomized: boolean;
  denied: boolean;
}

export default function PermissoesClient({ initialMatrix, roles, resources, actions, initialCustomized, denied }: Props) {
  const [matrix, setMatrix] = useState<Matrix>(initialMatrix);
  const [customized, setCustomized] = useState(initialCustomized);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(
    denied ? { kind: 'error', text: 'Sem permissão para gerenciar permissões.' } : null,
  );

  function toggle(role: string, resource: string, action: string) {
    if (role === 'admin') return; // admin é sempre total — não editável
    setMatrix((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [resource]: { ...prev[role]?.[resource], [action]: !prev[role]?.[resource]?.[action] },
      },
    }));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch('/api/permissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matrix }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setMatrix(data.matrix ?? matrix);
      setCustomized(true);
      setMessage({ kind: 'ok', text: 'Permissões salvas para esta loja.' });
    } else {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao salvar permissões.' });
    }
  }

  function discard() {
    setMatrix(initialMatrix);
    setMessage(null);
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-sand-light">Permissões por cargo</h1>
            <p className="mt-1 text-sm text-sand-dark">
              Defina o que cada papel pode <strong>ver</strong> e <strong>editar</strong> em cada módulo.
              {customized ? ' Esta loja usa permissões personalizadas.' : ' Esta loja usa os padrões do sistema (ainda não personalizados).'}
            </p>
          </div>
          <Link href="/dashboard/configuracoes" className="text-sm text-gold hover:text-gold-light">← Configurações</Link>
        </div>

        {message ? (
          <div className={`rounded-xl border px-4 py-3 text-sm ${message.kind === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-200'}`}>{message.text}</div>
        ) : null}

        {denied || roles.length === 0 ? null : (
          <>
            <div className="overflow-x-auto rounded-xl border border-white/[6%] bg-sigma-card">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/[6%]">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase text-sand-dark">Módulo</th>
                    {roles.map((role) => (
                      <th key={role} className="px-4 py-3 text-center text-xs font-semibold uppercase text-sand-dark">
                        {ROLE_LABELS[role] ?? role}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resources.map((resource) => (
                    actions.map((action) => (
                      <tr key={`${resource}:${action}`} className="border-b border-white/[5%]">
                        <td className="whitespace-nowrap px-4 py-3 text-sand">
                          {RESOURCE_LABELS[resource] ?? resource}
                          <span className="ml-2 text-xs text-sand-dark">{ACTION_LABELS[action] ?? action}</span>
                        </td>
                        {roles.map((role) => {
                          const checked = Boolean(matrix?.[role]?.[resource]?.[action]);
                          const locked = role === 'admin';
                          return (
                            <td key={role} className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={locked}
                                onChange={() => toggle(role, resource, action)}
                                title={locked ? 'O administrador sempre tem acesso total' : undefined}
                                className="h-4 w-4 accent-gold disabled:opacity-50"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="rounded-full bg-gold px-6 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark disabled:opacity-40"
              >
                {saving ? 'Salvando…' : 'Salvar permissões'}
              </button>
              <button
                onClick={discard}
                disabled={saving}
                className="rounded-full border border-white/[8%] px-5 py-2.5 text-sm text-sand transition-colors hover:border-white/20"
              >
                Descartar alterações
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
