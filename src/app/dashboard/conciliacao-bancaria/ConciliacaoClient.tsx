'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState, FilePicker, FormCard, Toast, useConfirm } from '@/components/ui';
import { brl } from '@/lib/currency';
import { formatDayMixed } from '@/lib/date-only';

interface MatchedPayment { id: string; amount: number; paidAt: string; accountTitle: string | null; }
interface BankTx { id: string; date: string; description: string; amount: number; status: string; matchedPayment: MatchedPayment | null; }
interface Candidate { id: string; amount: number; paidAt: string; account: { title: string } | null; member: { name: string } | null; }

const fmt = (d: string) => formatDayMixed(d);

interface Bank { id: string; name: string; isDefault: boolean }
interface AgreementSuggestion { memberId: string; memberName: string; label: string; remaining: number; amountMatch: 'exact' | 'partial'; nameMatch: 'strong' | 'weak' | 'none' }
interface Suggestion { accountId: string; title: string; memberName: string | null; balance: number; dueDate: string; amountMatch: 'exact' | 'partial'; nameMatch: 'strong' | 'weak' | 'none' }

const CONFIDENCE: Record<string, string> = { 'exact-strong': 'Valor e nome conferem', 'exact-weak': 'Valor confere; nome parcial', 'exact-none': 'Valor confere', 'partial-strong': 'Nome confere; valor parcial', 'partial-weak': 'Nome parcial; valor parcial', 'partial-none': 'Valor parcial' };

// Baixa assistida (Modo Loja): propõe a cobrança em aberto que o crédito provavelmente quitou, por valor e
// nome do pagador. Quem confirma é a Tesouraria — nada é baixado sem o clique.
function SettlePicker({ bankTxId, description, banks, onDone, onError }: { bankTxId: string; description: string; banks: Bank[]; onDone: () => void; onError: (text: string) => void }) {
  const askConfirm = useConfirm();
  const [data, setData] = useState<{ suggestions: Suggestion[]; agreements?: AgreementSuggestion[] } | null>(null);
  const [loadError, setLoadError] = useState('');
  const [bankId, setBankId] = useState(banks.find((b) => b.isDefault)?.id ?? banks[0]?.id ?? '');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/bank-reconciliation/${bankTxId}/suggestions`)
      .then(async (res) => ({ res, json: await res.json().catch(() => ({})) }))
      .then(({ res, json }) => { if (!alive) return; if (res.ok) setData(json); else setLoadError(json.error ?? 'Não foi possível buscar sugestões.'); })
      .catch(() => alive && setLoadError('Não foi possível buscar sugestões.'));
    return () => { alive = false; };
  }, [bankTxId]);

  // Só "valor e nome conferem" é um palpite forte. Os demais pedem confirmação que cita o nome divergente:
  // dar baixa na cobrança do irmão errado desfaz-se só estornando o pagamento.
  async function settle(s: Suggestion) {
    const strong = s.amountMatch === 'exact' && s.nameMatch === 'strong';
    if (!strong && !(await askConfirm({
      title: 'Conferir antes de dar baixa',
      message: `O extrato diz "${description}", mas a cobrança é de ${s.memberName ?? 'outro irmão'} (${(CONFIDENCE[s.amountMatch + '-' + s.nameMatch] ?? '').toLowerCase()}). Confirma que este crédito pagou esta cobrança?`,
      confirmLabel: 'Sim, dar baixa',
    }))) return;
    const accountId = s.accountId;
    setBusy(accountId);
    const res = await fetch(`/api/bank-reconciliation/${bankTxId}/settle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId, bankAccountId: bankId }) });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) onDone(); else onError(json.error ?? 'Erro ao dar baixa.');
  }

  async function settleAgreement(a: AgreementSuggestion) {
    const strong = a.amountMatch === 'exact' && a.nameMatch === 'strong';
    if (!strong && !(await askConfirm({
      title: 'Conferir antes de dar baixa',
      message: `O extrato diz "${description}", mas o acordo é de ${a.memberName} (${(CONFIDENCE[a.amountMatch + '-' + a.nameMatch] ?? '').toLowerCase()}). Confirma que este crédito pagou ${a.label.toLowerCase()} do acordo dele?`,
      confirmLabel: 'Sim, dar baixa',
    }))) return;
    setBusy(`acordo-${a.memberId}`);
    const res = await fetch(`/api/bank-reconciliation/${bankTxId}/settle-agreement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: a.memberId, bankAccountId: bankId }) });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) onDone(); else onError(json.error ?? 'Erro ao dar baixa no acordo.');
  }

  if (loadError) return <p className="mt-2 text-xs text-rose-300">{loadError}</p>;
  if (!data) return <p className="mt-2 text-xs text-sand-dark">Buscando cobranças em aberto…</p>;
  const agreements = data.agreements ?? [];
  if (data.suggestions.length === 0 && agreements.length === 0) return <p className="mt-2 text-xs text-sand-dark">Nenhuma cobrança em aberto com esse valor ou nome. Lance a baixa em Pagamentos e vincule manualmente.</p>;

  return (
    <div className="mt-3 rounded-lg border border-gold/20 bg-gold/5 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-sand-dark">
        <label htmlFor={`bank-${bankTxId}`}>Conta que recebeu:</label>
        <select id={`bank-${bankTxId}`} value={bankId} onChange={(e) => setBankId(e.target.value)} className="rounded-lg border border-white/8 bg-sigma-blue-deep/60 px-2.5 py-1.5 text-xs text-sand-light outline-none focus:border-gold/50">
          {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <ul className="mt-2 space-y-2">
        {agreements.map((a) => {
          const strong = a.amountMatch === 'exact' && a.nameMatch === 'strong';
          return (
            <li key={`acordo-${a.memberId}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-3 py-2">
              <div className="text-sm">
                <p className="font-medium text-sand-light">{a.memberName} · Acordo — {a.label}</p>
                <p className="text-xs text-sand-dark">Saldo do acordo {brl(a.remaining)} · <span className={a.amountMatch === 'exact' && a.nameMatch !== 'none' ? 'text-emerald-300' : 'text-amber-300'}>{CONFIDENCE[`${a.amountMatch}-${a.nameMatch}`] ?? ''}</span></p>
              </div>
              <button
                type="button"
                onClick={() => void settleAgreement(a)}
                disabled={busy !== null || !bankId}
                className={`rounded-full px-4 py-1.5 text-xs font-medium disabled:opacity-40 ${strong ? 'bg-gold text-sigma-blue-deep hover:bg-gold-light' : 'border border-white/15 text-sand-light hover:border-white/30'}`}
              >
                {busy === `acordo-${a.memberId}` ? 'Dando baixa…' : strong ? 'Dar baixa no acordo e conciliar' : 'Conferir e dar baixa no acordo'}
              </button>
            </li>
          );
        })}
        {data.suggestions.map((s) => {
          const strong = s.amountMatch === 'exact' && s.nameMatch === 'strong';
          return (
          <li key={s.accountId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-3 py-2">
            <div className="text-sm">
              <p className="font-medium text-sand-light">{s.memberName ?? '—'} · {s.title}</p>
              <p className="text-xs text-sand-dark">Saldo {brl(s.balance)} · venc. {fmt(s.dueDate)} · <span className={s.amountMatch === 'exact' && s.nameMatch !== 'none' ? 'text-emerald-300' : 'text-amber-300'}>{CONFIDENCE[`${s.amountMatch}-${s.nameMatch}`]}</span></p>
            </div>
            <button
              type="button"
              onClick={() => void settle(s)}
              disabled={busy !== null || !bankId}
              className={`rounded-full px-4 py-1.5 text-xs font-medium disabled:opacity-40 ${strong ? 'bg-gold text-sigma-blue-deep hover:bg-gold-light' : 'border border-white/15 text-sand-light hover:border-white/30'}`}
            >
              {busy === s.accountId ? 'Dando baixa…' : strong ? 'Dar baixa e conciliar' : 'Conferir e dar baixa'}
            </button>
          </li>
          );
        })}
      </ul>
    </div>
  );
}

function MatchPicker({ bankTxId, onDone }: { bankTxId: string; onDone: () => void }) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/bank-reconciliation/${bankTxId}/candidates`);
    const data = await res.json().catch(() => ({}));
    setCandidates(data.items ?? []);
    setLoading(false);
  }

  async function pick(paymentId: string) {
    await fetch(`/api/bank-reconciliation/${bankTxId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId }),
    });
    onDone();
  }

  if (candidates === null) {
    return (
      <button onClick={load} disabled={loading} className="text-xs text-gold/80 hover:text-gold">
        {loading ? 'Buscando…' : 'Vincular manualmente'}
      </button>
    );
  }

  if (candidates.length === 0) {
    return <p className="text-xs text-sand-dark">Nenhum pagamento próximo encontrado (±15 dias, mesma direção).</p>;
  }

  return (
    <div className="mt-2 space-y-1.5">
      {candidates.map((c) => (
        <button
          key={c.id}
          onClick={() => void pick(c.id)}
          className="block w-full rounded-lg border border-white/6 bg-sigma-blue-deep/50 px-3 py-2 text-left text-xs text-sand hover:border-gold/40"
        >
          {brl(c.amount)} • {fmt(c.paidAt)} • {c.account?.title ?? '—'} {c.member ? `• ${c.member.name}` : ''}
        </button>
      ))}
    </div>
  );
}

export default function ConciliacaoClient({ items, banks, canSettle }: { items: BankTx[]; banks: Bank[]; canSettle: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState('');

  async function handleFile(file: File) {
    setImporting(true);
    setMessage(null);
    const content = await file.text();
    const res = await fetch('/api/bank-reconciliation/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const data = await res.json().catch(() => ({}));
    setImporting(false);
    if (res.ok) {
      setMessage({ kind: 'ok', text: `Extrato importado: ${data.parsed} linha(s) lida(s), ${data.imported} nova(s), ${data.duplicates} já existiam, ${data.autoMatched} conciliada(s) automaticamente.` });
      router.refresh();
    } else {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao importar o extrato.' });
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function ignore(id: string) {
    await fetch(`/api/bank-reconciliation/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ignored' }),
    });
    router.refresh();
  }

  async function undo(id: string) {
    await fetch(`/api/bank-reconciliation/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    router.refresh();
  }

  const unmatchedCount = items.filter((i) => i.status === 'unmatched').length;

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Conciliação bancária</h1>
          <p className="mt-1 text-sm text-sand-dark">Importe o extrato do banco (OFX ou CSV) e concilie com os pagamentos já lançados no sistema.</p>
        </div>

        <Toast message={message} onClose={() => setMessage(null)} />

        <div className="grid items-start gap-6 lg:grid-cols-2">
        <FormCard title="Importar extrato" description="Arquivo OFX (exportado pelo internet banking) ou CSV com colunas Data/Descrição/Valor.">
          <div className="mt-4">
            <FilePicker
              inputRef={fileRef}
              ariaLabel="Arquivo do extrato (OFX ou CSV)"
              accept=".ofx,.csv,text/plain"
              disabled={importing}
              fileNames={importFileName ? [importFileName] : []}
              onFiles={(files) => { const f = files[0]; if (f) { setImportFileName(f.name); void handleFile(f); } }}
            />
            {importing ? <p className="mt-2 text-xs text-sand-dark">Importando…</p> : null}
          </div>
        </FormCard>

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-sand-light">Lançamentos importados</h2>
            {unmatchedCount > 0 ? <span className="text-xs text-amber-300">{unmatchedCount} sem conciliar</span> : null}
          </div>
          <div className="mt-5 space-y-3">
            {items.length === 0 ? (
              <EmptyState title="A prova dos nove ainda não começou." description="Importe um arquivo OFX ou CSV para começar a conciliar." />
            ) : items.map((tx) => (
              <div key={tx.id} className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-sand-light">{tx.description}</p>
                    <p className="mt-1 text-xs text-sand-dark">{fmt(tx.date)} • {tx.amount >= 0 ? 'Crédito' : 'Débito'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`tabular-nums text-sm font-semibold ${tx.amount >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{brl(tx.amount)}</span>
                    {tx.status === 'matched' ? (
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-300">Conciliado</span>
                    ) : tx.status === 'ignored' ? (
                      <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-0.5 text-xs text-sand-dark">Ignorado</span>
                    ) : (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-300">Sem conciliar</span>
                    )}
                  </div>
                </div>

                {tx.status === 'matched' && tx.matchedPayment ? (
                  <p className="mt-2 text-xs text-sand-dark">
                    Vinculado a: {tx.matchedPayment.accountTitle ?? '—'} — {brl(tx.matchedPayment.amount)} em {fmt(tx.matchedPayment.paidAt)}{' '}
                    <button onClick={() => void undo(tx.id)} className="ml-2 text-rose-300/70 hover:text-rose-300">Desfazer</button>
                  </p>
                ) : tx.status === 'ignored' ? (
                  <button onClick={() => void undo(tx.id)} className="mt-2 text-xs text-sand-dark hover:text-sand-light">Reabrir</button>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {canSettle && tx.amount > 0 && banks.length > 0 ? (
                      <button onClick={() => setSettlingId(settlingId === tx.id ? null : tx.id)} className="text-xs font-medium text-gold hover:text-gold-light">{settlingId === tx.id ? 'Fechar sugestões' : 'Sugerir cobrança'}</button>
                    ) : null}
                    {pickingId === tx.id ? null : (
                      <button onClick={() => setPickingId(tx.id)} className="text-xs text-gold/80 hover:text-gold">Vincular manualmente</button>
                    )}
                    <button onClick={() => void ignore(tx.id)} className="text-xs text-sand-dark hover:text-sand-light">Ignorar</button>
                  </div>
                )}
                {settlingId === tx.id ? <SettlePicker bankTxId={tx.id} description={tx.description} banks={banks} onDone={() => { setSettlingId(null); setMessage({ kind: 'ok', text: 'Baixa registrada e linha do extrato conciliada.' }); router.refresh(); }} onError={(text) => setMessage({ kind: 'error', text })} /> : null}
                {pickingId === tx.id ? <MatchPicker bankTxId={tx.id} onDone={() => { setPickingId(null); router.refresh(); }} /> : null}
              </div>
            ))}
          </div>
        </section>
        </div>
      </div>
    </main>
  );
}
