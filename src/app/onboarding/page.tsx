"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BRAZILIAN_RITES } from '@/lib/masonic-reference';

const RITE_OPTIONS = BRAZILIAN_RITES.map((r) => ({
  value: r.name,
  label: r.name,
}));

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    slug: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    riteName: 'Rito Escocês Antigo e Aceito (REAA)',
    invite: '',
  });
  const [inviteFromUrl, setInviteFromUrl] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Convite via link (?invite=CODE). Lido do client para dispensar Suspense.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('invite');
    if (code) {
      // Init a partir do parâmetro de URL no cliente (dispensa Suspense);
      // não é fetch-on-mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((f) => ({ ...f, invite: code.trim().toUpperCase() }));
      setInviteFromUrl(true);
    }
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const response = await fetch('/api/lodges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? 'Não foi possível concluir o onboarding.');
      return;
    }

    router.push('/dashboard');
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-sigma-blue-deep px-6 py-16">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(/backgraund_theme.png)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-sigma-blue-deep/90 via-sigma-blue-deep/60 to-sigma-blue-deep/90" />

      <div className="relative z-10 w-full max-w-2xl">
        <div className="animate-slide-up rounded-2xl border border-white/[8%] bg-sigma-blue-dark/80 p-8">
          <p className="text-[0.6rem] uppercase tracking-[0.3em] text-gold/60">
            Sigma Horus
          </p>
          <h1 className="mt-3 text-2xl font-bold text-sand-light">
            Configure sua loja
          </h1>
          <p className="mt-2 text-sm text-sand-dark">
            Esta tela é para quem recebeu um <strong className="text-sand">código de convite</strong>. Informe o código,
            cadastre a loja, escolha o rito e crie o primeiro administrador.
          </p>
          <p className="mt-3 rounded-lg border border-gold/25 bg-gold/[0.06] px-3 py-2 text-xs text-sand-dark">
            Não tem convite? A entrada padrão é pelo plano, com <strong className="text-sand">10 dias de teste grátis</strong>.{' '}
            <Link href="/#planos" className="font-medium text-gold hover:text-gold-light">Escolher um plano e começar →</Link>
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <Input
                label="Código de convite"
                value={form.invite}
                onChange={(e) => setForm({ ...form, invite: e.target.value.toUpperCase() })}
                placeholder="SH-XXXXXXXX"
                readOnly={inviteFromUrl}
                required
              />
              <p className="mt-1.5 text-xs text-sand-dark">
                {inviteFromUrl
                  ? 'Convite aplicado pelo link recebido.'
                  : 'Informe o código de convite recebido para liberar o teste.'}
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <Input
                  label="Nome da loja"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Loja Estrela do Oriente"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <Input
                  label="Slug da loja"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  placeholder="ex: loja-estrela"
                  required
                />
              </div>

              <Input
                label="Nome do administrador"
                value={form.adminName}
                onChange={(e) => setForm({ ...form, adminName: e.target.value })}
                placeholder="Ex: João Silva"
                required
              />

              <Input
                label="E-mail do administrador"
                type="email"
                value={form.adminEmail}
                onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                placeholder="ex: joao@email.com"
                required
              />

              <div className="md:col-span-2">
                <Input
                  label="Senha"
                  type="password"
                  value={form.adminPassword}
                  onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                  placeholder="Mínimo 8 caracteres"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-sand-dark">
                  Rito praticado pela loja
                </label>
                <select
                  value={form.riteName}
                  onChange={(e) => setForm({ ...form, riteName: e.target.value })}
                  className="w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-3 py-2.5 text-sm text-sand-light outline-none transition focus:border-gold/50 focus:ring-1 focus:ring-gold/30"
                  required
                >
                  {RITE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error ? (
              <p className="flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                <svg className="h-3.5 w-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Criando sua loja…' : 'Criar loja e iniciar teste'}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
