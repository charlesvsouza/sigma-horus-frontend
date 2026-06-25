'use client';

import { useEffect, useState } from 'react';
import { fetchCep, maskCEP, maskCNPJ, maskPhone } from '@/lib/masks';

type LodgeForm = Record<string, string>;

const EMPTY: LodgeForm = {
  name: '', legalName: '', tradeName: '', cnpj: '', email: '', phone: '',
  addressLine: '', addressNumber: '', neighborhood: '', city: '', state: '', zipCode: '',
  bankName: '', bankAgency: '', bankAccount: '', pixKey: '',
};

function Field({ label, value, onChange, ...rest }: { label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-sand-dark/70">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 ease-out focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
        {...rest}
      />
    </label>
  );
}

export default function ConfiguracoesPage() {
  const [form, setForm] = useState<LodgeForm>(EMPTY);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [cepStatus, setCepStatus] = useState('');

  async function load() {
    const res = await fetch('/api/lodge');
    if (res.ok) {
      const data = await res.json();
      if (data.lodge) {
        const entries = Object.entries(data.lodge as Record<string, unknown>).map(([k, v]) => [k, (v ?? '') as string] as const);
        setForm({ ...EMPTY, ...Object.fromEntries(entries) });
      }
    }
  }

  useEffect(() => { load(); }, []);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function lookupCep(value: string) {
    setCepStatus('');
    const address = await fetchCep(value);
    if (!address) return;
    setForm((prev) => ({
      ...prev,
      zipCode: address.cep,
      addressLine: address.logradouro || prev.addressLine,
      neighborhood: address.bairro || prev.neighborhood,
      city: address.cidade || prev.city,
      state: address.uf || prev.state,
    }));
    setCepStatus('Endereço preenchido pelo CEP.');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await fetch('/api/lodge', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    setSaving(false);
    setMessage(res.ok ? { kind: 'ok', text: 'Dados da loja salvos.' } : { kind: 'error', text: data.error ?? 'Erro ao salvar.' });
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-sand-light">Configurações da loja</h1>
          <p className="mt-1 text-sm text-sand-dark">Dados cadastrais, fiscais e bancários da loja (pessoa jurídica sem fins lucrativos). Usados em cobranças, recibos e relatórios.</p>
        </div>

        {message ? (
          <div className={`rounded-xl border px-4 py-3 text-sm ${message.kind === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-200'}`}>{message.text}</div>
        ) : null}

        <form onSubmit={save} className="space-y-6">
          <section className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
            <h2 className="text-base font-semibold text-sand-light">Identificação</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Nome da loja" value={form.name} onChange={(v) => set('name', v)} required />
              <Field label="Razão social" value={form.legalName} onChange={(v) => set('legalName', v)} />
              <Field label="Nome fantasia" value={form.tradeName} onChange={(v) => set('tradeName', v)} />
              <Field label="CNPJ" value={form.cnpj} onChange={(v) => set('cnpj', maskCNPJ(v))} inputMode="numeric" placeholder="00.000.000/0000-00" />
              <Field label="E-mail" value={form.email} onChange={(v) => set('email', v)} type="email" />
              <Field label="Telefone" value={form.phone} onChange={(v) => set('phone', maskPhone(v))} inputMode="tel" />
            </div>
          </section>

          <section className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
            <h2 className="text-base font-semibold text-sand-light">Endereço</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <Field label="CEP" value={form.zipCode} onChange={(v) => set('zipCode', maskCEP(v))} onBlur={(e) => lookupCep((e.target as HTMLInputElement).value)} inputMode="numeric" />
                {cepStatus ? <p className="mt-1 text-xs text-sand-dark">{cepStatus}</p> : null}
              </div>
              <Field label="Logradouro" value={form.addressLine} onChange={(v) => set('addressLine', v)} />
              <Field label="Número" value={form.addressNumber} onChange={(v) => set('addressNumber', v)} />
              <Field label="Bairro" value={form.neighborhood} onChange={(v) => set('neighborhood', v)} />
              <Field label="Cidade" value={form.city} onChange={(v) => set('city', v)} />
              <Field label="UF" value={form.state} onChange={(v) => set('state', v)} maxLength={2} />
            </div>
          </section>

          <section className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
            <h2 className="text-base font-semibold text-sand-light">Dados bancários</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Banco" value={form.bankName} onChange={(v) => set('bankName', v)} />
              <Field label="Agência" value={form.bankAgency} onChange={(v) => set('bankAgency', v)} />
              <Field label="Conta" value={form.bankAccount} onChange={(v) => set('bankAccount', v)} />
              <Field label="Chave PIX" value={form.pixKey} onChange={(v) => set('pixKey', v)} />
            </div>
          </section>

          <button type="submit" disabled={saving} className="rounded-full bg-gold px-6 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark disabled:opacity-40">
            {saving ? 'Salvando…' : 'Salvar dados da loja'}
          </button>
        </form>
      </div>
    </main>
  );
}
