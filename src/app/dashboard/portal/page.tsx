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
}

export default function PortalPage() {
  const [member, setMember] = useState<MemberSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const response = await fetch('/api/members');
      const data = await response.json();
      const first = data.items?.[0] ?? null;
      setMember(first);
      setLoading(false);
    }

    load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Meu portal</h1>
          <p className="mt-3 text-slate-400">Área de visão do obreiro com resumo de cadastro, situação financeira e documentos.</p>
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
                    <p className="mt-2 font-medium text-white">{member.currentDegree ?? 'Não informado'}</p>
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
            <h2 className="text-xl font-semibold">Próximos pontos</h2>
            <ul className="mt-6 space-y-3 text-sm text-slate-300">
              <li className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">Histórico de contas a receber e a pagar</li>
              <li className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">Visualização de documentos e atas</li>
              <li className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">Lembretes de sessões e cobranças</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
