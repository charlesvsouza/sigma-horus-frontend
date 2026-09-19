'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, inputClass } from '@/components/ui';

export interface CollectionProps {
  mode: 'lodge' | 'asaas';
  settlementAccountId: string;
  billingType: 'PIX' | 'BOLETO';
  asaasConnected: boolean;
  hasPaymentData: boolean; // chave Pix / dados bancários da loja cadastrados
  accounts: { id: string; name: string }[]; // contas correntes elegíveis ao repasse
}

function Option({ value, current, onSelect, title, children }: { value: 'lodge' | 'asaas'; current: 'lodge' | 'asaas'; onSelect: (v: 'lodge' | 'asaas') => void; title: string; children: React.ReactNode }) {
  return (
    <label className={`block cursor-pointer rounded-lg border p-4 transition-colors ${current === value ? 'border-gold/60 bg-gold/5' : 'border-white/8 hover:border-white/20'}`}>
      <span className="flex items-center gap-3">
        <input type="radio" name="collectionMode" checked={current === value} onChange={() => onSelect(value)} className="accent-gold" />
        <span className="text-sm font-semibold text-sand-light">{title}</span>
      </span>
      <span className="mt-2 block pl-7 text-xs leading-relaxed text-sand-dark">{children}</span>
    </label>
  );
}

// "Recebimento das cobranças": a loja escolhe como recebe — direto na sua conta (Modo Loja)
// ou pelo Asaas (Modo Asaas). O dinheiro sempre é lançado na conta corrente da loja.
export default function CollectionSettings({ mode: initialMode, settlementAccountId, billingType, asaasConnected, hasPaymentData, accounts }: CollectionProps) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [settlement, setSettlement] = useState(settlementAccountId);
  const [billing, setBilling] = useState(billingType);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const dirty = mode !== initialMode || settlement !== settlementAccountId || billing !== billingType;

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch('/api/lodge/collection', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectionMode: mode, asaasSettlementAccountId: settlement || null, asaasBillingType: billing }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMsg({ kind: 'error', text: data.error ?? 'Não foi possível salvar.' });
      return;
    }
    const extra = data.openAsaasCharges > 0 ? ` Atenção: ${data.openAsaasCharges} cobrança(s) já emitida(s) no Asaas continuam valendo até serem pagas.` : '';
    setMsg({ kind: 'ok', text: `Modo de recebimento salvo.${extra}` });
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
      <h2 className="text-base font-semibold text-sand-light">Recebimento das cobranças</h2>
      <p className="mt-1 text-sm text-sand-dark">
        Como a loja recebe as mensalidades e demais cobranças. É uma escolha da loja e pode ser mudada quando quiser (vale para as
        cobranças novas). Em qualquer modo, o valor é lançado na <strong>conta corrente da loja</strong>.
      </p>

      <div className="mt-5 space-y-3">
        <Option value="lodge" current={mode} onSelect={setMode} title="Modo Loja — receber direto na conta da loja">
          Os irmãos pagam por Pix (chave da loja) ou depósito/TED, direto na conta da loja, sem intermediário e sem tarifas do sistema.
          As cobranças e lembretes mostram a chave Pix e os dados bancários cadastrados em <em>Dados bancários</em> acima. A baixa é feita pelo
          Tesoureiro (Pagamentos).
          {!hasPaymentData ? <span className="mt-1 block text-amber-300">Cadastre a chave Pix e/ou os dados bancários da loja para que os irmãos saibam onde pagar.</span> : null}
        </Option>
        <Option value="asaas" current={mode} onSelect={setMode} title="Modo Asaas — receber pelo Asaas">
          A cobrança é emitida no Asaas (<strong>Pix ou boleto — cartão fica fora</strong>) e o irmão paga pelo link. O Asaas confirma e o sistema dá
          a baixa sozinho; o valor é <strong>repassado manualmente</strong> pelo Tesoureiro, no painel do Asaas, para a conta corrente escolhida abaixo.
          A <strong>tarifa</strong> do Asaas é lançada como despesa (valor real) e <strong>absorvida pela loja</strong>.
          {!asaasConnected ? (
            <span className="mt-1 block text-amber-300">O Asaas ainda não está conectado — conecte em <Link href="/dashboard/integracoes" className="underline">Integrações</Link>.</span>
          ) : null}
        </Option>
      </div>

      {mode === 'asaas' ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-sand-dark">
            Conta corrente que recebe o repasse
            <select value={settlement} onChange={(e) => setSettlement(e.target.value)} className={`mt-1.5 ${inputClass}`} aria-label="Conta de repasse">
              <option value="">Selecione a conta corrente</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {accounts.length === 0 ? (
              <span className="mt-1 block text-xs text-amber-300">
                Nenhuma conta corrente cadastrada — crie em <Link href="/dashboard/cadastros-financeiros" className="underline">Cadastros financeiros</Link>.
              </span>
            ) : null}
          </label>
          <label className="block text-sm text-sand-dark">
            Método emitido no Asaas
            <select value={billing} onChange={(e) => setBilling(e.target.value as 'PIX' | 'BOLETO')} className={`mt-1.5 ${inputClass}`} aria-label="Método de cobrança">
              <option value="PIX">Pix (cai na hora)</option>
              <option value="BOLETO">Boleto (cai no mesmo dia ou no dia seguinte)</option>
            </select>
          </label>
        </div>
      ) : null}

      {msg ? <Alert intent={msg.kind === 'ok' ? 'ok' : 'danger'} className="mt-4">{msg.text}</Alert> : null}

      <div className="mt-5">
        <Button type="button" onClick={save} disabled={saving || !dirty}>{saving ? 'Salvando…' : 'Salvar modo de recebimento'}</Button>
      </div>
    </section>
  );
}
