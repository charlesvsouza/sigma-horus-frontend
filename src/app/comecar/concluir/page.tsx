'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BRAZILIAN_RITES } from '@/lib/masonic-reference';
import { PLANS } from '@/lib/plans';
import { validateLodgeSignup } from '@/lib/validation';
import { Button, Input, inputClass, inputBase, inputBorderError } from '@/components/ui';

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

function Concluir() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get('session_id') ?? '';

  const [summary, setSummary] = useState<{ email: string | null; plan: string; interval: string; trialEndsAt: string | null; alreadyUsed: boolean } | null>(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({ name: '', slug: '', adminName: '', adminEmail: '', adminPassword: '', riteName: 'Rito Escocês Antigo e Aceito (REAA)' });
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Página pública/transitória pós-checkout: o resumo depende do session_id do
    // redirect do Stripe (não é dado de dashboard). Carga sob demanda aceitável.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!sessionId) { setLoadError('Link inválido: faltou a referência do pagamento.'); return; }
    fetch(`/api/signup/complete?session_id=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setLoadError(d.error); return; }
        setSummary(d);
        if (d.email) setForm((f) => ({ ...f, adminEmail: d.email }));
      })
      .catch(() => setLoadError('Não foi possível carregar os dados do pagamento.'));
  }, [sessionId]);

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v, ...(k === 'name' && !slugTouched ? { slug: slugify(v) } : {}) }));
    setErrors((e) => (e[k] ? { ...e, [k]: '' } : e));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const errs = validateLodgeSignup(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    const res = await fetch('/api/signup/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, sessionId }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) router.push('/login?cadastro=ok');
    else setError(data.error ?? 'Erro ao concluir o cadastro.');
  }

  const planName = summary ? (PLANS[summary.plan as keyof typeof PLANS]?.name ?? summary.plan) : '';
  const trialDate = summary?.trialEndsAt ? new Date(summary.trialEndsAt).toLocaleDateString('pt-BR') : null;

  if (loadError) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
        {loadError} <Link href="/#planos" className="font-medium underline">Voltar aos planos</Link>
      </div>
    );
  }
  if (summary?.alreadyUsed) {
    return (
      <div className="rounded-xl border border-gold/30 bg-gold/10 p-6 text-sm text-gold">
        Este pagamento já criou uma loja. <Link href="/login" className="font-medium underline">Fazer login</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {summary ? (
        <div className="rounded-xl border border-gold/25 bg-gold/[8%] px-4 py-3 text-sm text-gold">
          Plano <strong>{planName}</strong> {summary.interval === 'year' ? 'anual' : 'mensal'} · teste grátis{trialDate ? ` até ${trialDate}` : ''}. A cobrança só ocorre ao fim do teste, se não cancelar.
        </div>
      ) : (
        <p className="text-sm text-sand-dark">Carregando dados do pagamento…</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nome da loja *" error={errors.name} />
        <div className="space-y-1.5">
          <input value={form.slug} onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)); }} className={errors.slug ? `${inputBase} ${inputBorderError}` : inputClass} placeholder="Endereço (slug) *" />
          {errors.slug ? <p className="text-xs text-rose-300">{errors.slug}</p> : null}
        </div>
        <Input value={form.adminName} onChange={(e) => set('adminName', e.target.value)} placeholder="Seu nome *" error={errors.adminName} />
        <Input type="email" value={form.adminEmail} onChange={(e) => set('adminEmail', e.target.value)} placeholder="Seu e-mail *" error={errors.adminEmail} />
        <Input type="password" value={form.adminPassword} onChange={(e) => set('adminPassword', e.target.value)} placeholder="Senha *" error={errors.adminPassword} />
        <select value={form.riteName} onChange={(e) => set('riteName', e.target.value)} className={inputClass}>
          {BRAZILIAN_RITES.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
        </select>
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <Button type="submit" disabled={saving || !summary} className="w-full justify-center">
        {saving ? 'Criando sua loja…' : 'Concluir e acessar'}
      </Button>
      <p className="text-center text-xs text-sand-dark/70">O rito define os cargos da loja; você pode trocar depois nas configurações.</p>
    </form>
  );
}

export default function ConcluirPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Quase lá</h1>
          <p className="mt-1 text-sm text-sand-dark">Pagamento confirmado. Crie o acesso da sua loja para começar o teste.</p>
        </div>
        <Suspense fallback={<p className="text-sm text-sand-dark">Carregando…</p>}>
          <Concluir />
        </Suspense>
      </div>
    </main>
  );
}
