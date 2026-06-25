'use client';

import { useEffect, useState } from 'react';

interface MemberSummary {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status: string;
  currentDegree?: string | null;
  originLodge?: string | null;
  initiationDate?: string | null;
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
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Meu portal</h1>
          <p className="mt-3 text-slate-400">Área de visão do obreiro com resumo de cadastro, situação financeira e documentos recentes.</p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Resumo do obreiro</h2>
            {loading ? (
              <p className="mt-6 text-sm text-slate-500">Carregando...</p>
            ) : member ? (
              <div className="mt-6 space-y-4 text-sm text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-amber-300">Membro</p>
                  <p className="mt-2 text-lg font-semibold text-white">{member.name}</p>
                  <p className="mt-1">{member.email ?? 'E-mail não informado'}</p>
                  <p>{member.phone ?? 'Telefone não informado'}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-amber-300">Grau atual</p>
                    <p className="mt-2 font-medium text-white">{member.currentDegree ?? member.gradeName ?? 'Não informado'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-amber-300">Loja de origem</p>
                    <p className="mt-2 font-medium text-white">{member.originLodge ?? 'Não informada'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-6 text-sm text-slate-500">Nenhum membro encontrado para este usuário.</p>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Resumo financeiro</h2>
            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-amber-300">A receber</p>
                <p className="mt-2 text-xl font-semibold text-white">R$ {summary.totalReceivables.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-amber-300">A pagar</p>
                <p className="mt-2 text-xl font-semibold text-white">R$ {summary.totalPayables.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-amber-300">Pendentes</p>
                <p className="mt-2 text-xl font-semibold text-white">R$ {summary.pending.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Últimas contas</h2>
            <div className="mt-6 space-y-3">
              {accounts.length === 0 ? <p className="text-sm text-slate-500">Nenhuma conta vinculada.</p> : accounts.map((account) => (
                <div key={account.id} className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 text-sm text-slate-300">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{account.title}</p>
                      <p className="text-slate-400">{account.type === 'RECEIVABLE' ? 'Receber' : 'Pagar'} • {new Date(account.dueDate).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <p className="font-semibold text-white">R$ {Number(account.amount).toFixed(2)}</p>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.25em] text-slate-500">{account.status}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Documentos recentes</h2>
            <div className="mt-6 space-y-3">
              {documents.length === 0 ? <p className="text-sm text-slate-500">Nenhum documento registrado.</p> : documents.map((document) => (
                <div key={document.id} className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 text-sm text-slate-300">
                  <p className="font-medium text-white">{document.title}</p>
                  <p className="mt-1 text-slate-400">{document.kind} • {new Date(document.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
