'use client';

import { useEffect, useState } from 'react';
import { degreeShort } from '@/lib/masonic-degree';

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
}

interface AccountItem {
  id: string;
  title: string;
  type: string;
  amount: number;
  dueDate: string;
  status: string;
}

interface DocumentItem {
  id: string;
  title: string;
  kind: string;
  createdAt: string;
}

export default function PortalPage() {
  const [member, setMember] = useState<MemberSummary | null>(null);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [summary, setSummary] = useState({ totalReceivables: 0, totalPayables: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const response = await fetch('/api/portal');
      const data = await response.json();
      setMember(data.member ?? null);
      setAccounts(data.accounts ?? []);
      setDocuments(data.documents ?? []);
      setSummary(data.summary ?? { totalReceivables: 0, totalPayables: 0, pending: 0 });
      setLoading(false);
    }

    load();
  }, []);

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-sand-light">Meu portal</h1>
          <p className="mt-1 text-sm text-sand-dark">Área de visão do obreiro com resumo de cadastro, situação financeira e documentos recentes.</p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
            <h2 className="text-base font-semibold text-sand-light">Resumo do obreiro</h2>
            {loading ? (
              <p className="mt-6 text-sm text-sand-dark">Carregando...</p>
            ) : member ? (
              <div className="mt-5 space-y-4 text-sm text-sand">
                <div className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-gold">Membro</p>
                  <p className="mt-2 text-lg font-semibold text-sand-light">{member.name}</p>
                  <p className="mt-1">{member.email ?? 'E-mail não informado'}</p>
                  <p>{member.phone ?? 'Telefone não informado'}</p>
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
            ) : (
              <p className="mt-6 text-sm text-sand-dark">Nenhum membro encontrado para este usuário.</p>
            )}
          </div>

          <div className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
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
          <div className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
            <h2 className="text-base font-semibold text-sand-light">Últimas contas</h2>
            <div className="mt-5 space-y-3">
              {accounts.length === 0 ? <p className="text-sm text-sand-dark">Nenhuma conta vinculada.</p> : accounts.map((account) => (
                <div key={account.id} className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-4 text-sm text-sand">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-sand-light">{account.title}</p>
                      <p className="text-sand-dark">{account.type === 'RECEIVABLE' ? 'Receber' : 'Pagar'} • {new Date(account.dueDate).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <p className="font-semibold text-sand-light">R$ {Number(account.amount).toFixed(2)}</p>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.25em] text-sand-dark">{account.status}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
            <h2 className="text-base font-semibold text-sand-light">Documentos recentes</h2>
            <div className="mt-5 space-y-3">
              {documents.length === 0 ? <p className="text-sm text-sand-dark">Nenhum documento registrado.</p> : documents.map((document) => (
                <div key={document.id} className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-4 text-sm text-sand">
                  <p className="font-medium text-sand-light">{document.title}</p>
                  <p className="mt-1 text-sand-dark">{document.kind} • {new Date(document.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
