'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, inputClass } from '@/components/ui';
import ThemeToggle from '@/components/theme-toggle';
import { fetchCep, maskCEP, maskCNPJ, maskPhone } from '@/lib/masks';
import { BRAZILIAN_RITES, BRAZILIAN_POWERS } from '@/lib/masonic-reference';

type LodgeForm = Record<string, string>;

const EMPTY: LodgeForm = {
  name: '', legalName: '', tradeName: '', cnpj: '', email: '', phone: '',
  addressLine: '', addressNumber: '', neighborhood: '', city: '', state: '', zipCode: '',
  bankName: '', bankAgency: '', bankAccount: '', pixKey: '',
  riteName: '', powerName: '', sessionWeekdays: '', sessionFrequency: 'weekly',
};

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const FREQUENCIES = [
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'monthly', label: 'Mensal' },
];
const INPUT_CLASS = `mt-1.5 ${inputClass}`; // fonte única do design system

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
  const [seeding, setSeeding] = useState(false);
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

  function toggleWeekday(idx: number) {
    const cur = new Set((form.sessionWeekdays || '').split(',').filter(Boolean));
    const key = String(idx);
    if (cur.has(key)) cur.delete(key);
    else cur.add(key);
    set('sessionWeekdays', [...cur].map(Number).sort((a, b) => a - b).join(','));
  }

  async function seedOffices() {
    if (!form.riteName) {
      setMessage({ kind: 'error', text: 'Escolha o rito antes de aplicar os cargos.' });
      return;
    }
    setSeeding(true);
    setMessage(null);
    // Garante o rito salvo antes de semear os cargos.
    await fetch('/api/lodge', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const res = await fetch('/api/lodges/seed-offices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ riteName: form.riteName }),
    });
    const data = await res.json();
    setSeeding(false);
    if (res.ok) {
      setMessage({ kind: 'ok', text: `Cargos do rito aplicados: ${data.seeded.created} criados, ${data.seeded.skipped} já existiam.` });
    } else {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao aplicar os cargos.' });
    }
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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-sand-light">Configurações da loja</h1>
            <p className="mt-1 text-sm text-sand-dark">Dados cadastrais, fiscais e bancários da loja (pessoa jurídica sem fins lucrativos). Usados em cobranças, recibos e relatórios.</p>
          </div>
          <Link href="/dashboard/configuracoes/permissoes" className="rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-gold/80 transition-all duration-200 ease-out hover:border-gold/60 hover:text-gold">
            Permissões por cargo →
          </Link>
        </div>

        {message ? (
          <div className={`rounded-xl border px-4 py-3 text-sm ${message.kind === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-200'}`}>{message.text}</div>
        ) : null}

        <form onSubmit={save} className="space-y-6">
          <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
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

          <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
            <h2 className="text-base font-semibold text-sand-light">Loja maçônica</h2>
            <p className="mt-1 text-sm text-sand-dark">Rito praticado e potência (obediência). O rito define os cargos da loja.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-sand-dark/70">Rito</span>
                <select value={form.riteName} onChange={(e) => set('riteName', e.target.value)} className={INPUT_CLASS}>
                  <option value="">Selecione o rito</option>
                  {BRAZILIAN_RITES.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-sand-dark/70">Potência</span>
                <select value={form.powerName} onChange={(e) => set('powerName', e.target.value)} className={INPUT_CLASS}>
                  <option value="">Selecione a potência</option>
                  {BRAZILIAN_POWERS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={seedOffices} disabled={seeding || !form.riteName} className="rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-gold/80 transition-all duration-200 ease-out hover:border-gold/60 hover:text-gold disabled:opacity-40">
                {seeding ? 'Aplicando…' : 'Aplicar cargos deste rito'}
              </button>
              <span className="text-xs text-sand-dark">Adiciona os cargos do rito que ainda não existem (não remove os atuais).</span>
            </div>
          </section>

          <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
            <h2 className="text-base font-semibold text-sand-light">Sessões</h2>
            <p className="mt-1 text-sm text-sand-dark">Dias da semana e periodicidade padrão das sessões da loja.</p>
            <div className="mt-5 space-y-5">
              <div>
                <span className="text-xs uppercase tracking-wide text-sand-dark/70">Dias da semana</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {WEEKDAYS.map((d, i) => {
                    const active = (form.sessionWeekdays || '').split(',').filter(Boolean).includes(String(i));
                    return (
                      <button
                        type="button"
                        key={d}
                        onClick={() => toggleWeekday(i)}
                        className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${active ? 'border-gold/50 bg-gold/15 text-gold' : 'border-white/10 text-sand-dark hover:text-sand-light'}`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="block max-w-xs">
                <span className="text-xs uppercase tracking-wide text-sand-dark/70">Periodicidade</span>
                <select value={form.sessionFrequency} onChange={(e) => set('sessionFrequency', e.target.value)} className={INPUT_CLASS}>
                  {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
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

          <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
            <h2 className="text-base font-semibold text-sand-light">Dados bancários</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Banco" value={form.bankName} onChange={(v) => set('bankName', v)} />
              <Field label="Agência" value={form.bankAgency} onChange={(v) => set('bankAgency', v)} />
              <Field label="Conta" value={form.bankAccount} onChange={(v) => set('bankAccount', v)} />
              <Field label="Chave PIX" value={form.pixKey} onChange={(v) => set('pixKey', v)} />
            </div>
          </section>

          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar dados da loja'}
          </Button>
        </form>

        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Aparência</h2>
          <p className="mt-1 text-sm text-sand-dark">Escolha o tema da interface. A preferência fica salva neste navegador e vale para todas as telas.</p>
          <div className="mt-5">
            <ThemeToggle />
          </div>
        </section>
      </div>
    </main>
  );
}
