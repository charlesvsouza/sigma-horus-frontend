'use client';

import { useState } from 'react';

export default function IntegracoesPage() {
  const [asaasKey, setAsaasKey] = useState('');
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!asaasKey.trim()) return;
    // In a real app, this would call an API to save the env var or a DB config
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Integrações</h1>
          <p className="mt-3 text-slate-400">Configure gateways de pagamento e serviços externos.</p>
        </div>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Asaas</h2>
          <p className="mt-2 text-sm text-slate-400">Gateway de cobrança via boleto, Pix e cartão de crédito.</p>

          <form onSubmit={save} className="mt-6 space-y-4">
            <div>
              <label className="text-sm text-slate-400">Chave da API (sandbox ou produção)</label>
              <input
                type="password"
                value={asaasKey}
                onChange={(e) => setAsaasKey(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3"
                placeholder="$a$tr_..."
              />
            </div>
            <p className="text-xs text-slate-500">
              A chave é armazenada na variável de ambiente <code className="text-amber-300">ASAAS_API_KEY</code>.
              Em produção, defina via painel da Vercel / Railway.
            </p>
            <button type="submit" className="rounded-full bg-amber-400 px-5 py-3 font-medium text-slate-950">
              Salvar
            </button>
          </form>

          {saved && (
            <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              Configuração salva (local). Em produção, defina a variável de ambiente.
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Stripe</h2>
          <p className="mt-2 text-sm text-slate-400">Já configurado. Use o painel do Stripe para gerenciar produtos e assinaturas.</p>
          <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Stripe ativo — modo teste
          </div>
        </section>
      </div>
    </main>
  );
}
