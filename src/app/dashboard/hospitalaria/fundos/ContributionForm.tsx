"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, inputClass } from '@/components/ui';
import type { FundPurpose } from '@/lib/funds';

const METHODS = [
  ['cash', 'Dinheiro'],
  ['pix', 'Pix'],
  ['transfer', 'Transferência'],
  ['other', 'Outro'],
] as const;

// Aporte avulso ao fundo: tronco passado em sessão, doação em espécie, Pix direto etc.
// Registra a entrada já recebida no caixa do fundo (POST /api/funds/contributions).
export default function ContributionForm({
  fund, fundLabel, accounts, members, sessions, onClose,
}: {
  fund: FundPurpose;
  fundLabel: string;
  accounts: { id: string; name: string }[];
  members: { id: string; name: string }[];
  sessions: { id: string; label: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState<string>('cash');
  const [origin, setOrigin] = useState<'session' | 'other'>('session');
  const [sessionId, setSessionId] = useState('');
  const [donor, setDonor] = useState<'none' | 'member' | 'name' | 'anonymous'>('none');
  const [memberId, setMemberId] = useState('');
  const [donorName, setDonorName] = useState('');
  const [bankAccountId, setBankAccountId] = useState(accounts[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const isTronco = fund === 'tronco';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    const value = Number(amount.replace(',', '.'));
    if (!value || value <= 0) return setError('Informe um valor maior que zero.');
    if (origin === 'session' && isTronco && !sessionId) return setError('Escolha a sessão em que o tronco foi passado (ou marque "Outra origem").');
    if (donor === 'member' && !memberId) return setError('Escolha o irmão que doou.');
    setSaving(true);
    try {
      const res = await fetch('/api/funds/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fund,
          amount: value,
          date,
          method,
          bankAccountId: bankAccountId || undefined,
          sessionId: isTronco && origin === 'session' ? sessionId : undefined,
          memberId: donor === 'member' ? memberId : undefined,
          donorName: donor === 'name' ? donorName : undefined,
          anonymous: donor === 'anonymous',
          note,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data?.error ?? 'Não foi possível registrar o aporte.');
      setDone('Aporte registrado no caixa do fundo.');
      setAmount('');
      setNote('');
      setDonorName('');
      router.refresh();
    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="fundo-noprint space-y-4 rounded-xl border border-gold/30 bg-sigma-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-sand-light">Registrar aporte — {fundLabel}</h2>
          <p className="mt-1 text-xs text-sand-dark">Entrada já recebida (tronco passado em sessão, dinheiro, Pix ou transferência). Entra no saldo, no extrato e no livro-caixa do fundo.</p>
        </div>
        <button type="button" onClick={onClose} className="text-xs text-sand-dark underline hover:text-gold">Fechar</button>
      </div>

      {error ? <Alert intent="danger">{error}</Alert> : null}
      {done ? <Alert intent="ok">{done}</Alert> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-xs text-sand-dark">Valor (R$)
          <input inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-xs text-sand-dark">Data do recebimento
          <input type="date" required max={today} value={date} onChange={(e) => setDate(e.target.value)} className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-xs text-sand-dark">Forma
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={`mt-1 ${inputClass}`}>
            {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>

      {isTronco ? (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs text-sand-dark">Origem
            <select value={origin} onChange={(e) => setOrigin(e.target.value as 'session' | 'other')} className={`mt-1 ${inputClass}`}>
              <option value="session">Tronco passado em sessão</option>
              <option value="other">Outra origem (avulso)</option>
            </select>
          </label>
          {origin === 'session' ? (
            <label className="text-xs text-sand-dark">Sessão
              <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className={`mt-1 ${inputClass}`}>
                <option value="">Selecione…</option>
                {sessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs text-sand-dark">Quem doou
          <select value={donor} onChange={(e) => setDonor(e.target.value as typeof donor)} className={`mt-1 ${inputClass}`}>
            <option value="none">Não identificado{origin === 'session' && isTronco ? ' (tronco coletivo)' : ''}</option>
            <option value="member">Um irmão da loja</option>
            <option value="name">Outra pessoa / instituição</option>
            <option value="anonymous">Anônimo</option>
          </select>
        </label>
        {donor === 'member' ? (
          <label className="text-xs text-sand-dark">Irmão
            <select value={memberId} onChange={(e) => setMemberId(e.target.value)} className={`mt-1 ${inputClass}`}>
              <option value="">Selecione…</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        ) : null}
        {donor === 'name' ? (
          <label className="text-xs text-sand-dark">Nome
            <input value={donorName} onChange={(e) => setDonorName(e.target.value)} className={`mt-1 ${inputClass}`} />
          </label>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs text-sand-dark">Caixa que recebeu
          <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className={`mt-1 ${inputClass}`}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-sand-dark">Observação (opcional)
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className={`mt-1 ${inputClass}`} />
        </label>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>{saving ? 'Registrando…' : 'Registrar aporte'}</Button>
        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
      </div>
    </form>
  );
}
