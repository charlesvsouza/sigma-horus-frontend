'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, EmptyState, inputClass } from '@/components/ui';
import { brl } from '@/lib/currency';
import { csvRow } from '@/lib/csv';
import { ReportActions, ReportDocument } from '@/components/report/report-document';
import { MEMBER_FILTER_STATUSES, memberStatusLabel } from '@/lib/member-status';
import { BLOCKED_STATUS, buildInstallments, MAX_AGREEMENT_INSTALLMENTS } from '@/lib/member-block';
import Link from 'next/link';
import { formatDateOnly } from '@/lib/date-only';
import { OverdueNoticeDialog } from '@/components/overdue-notice-dialog';

interface LateCharge { fee: number; interest: number; total: number; }
interface Row {
  memberId: string;
  memberName: string;
  memberStatus: string;
  openCount: number;
  totalAmount: number;
  oldestDueDate: string;
  daysOverdue: number;
  art002: boolean;
  lateCharge: LateCharge;
}


function RenegotiateForm({ memberId, onDone }: { memberId: string; onDone: () => void }) {
  const [firstDueDate, setFirstDueDate] = useState('');
  const [applyLateCharge, setApplyLateCharge] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/members/${memberId}/renegotiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstDueDate: firstDueDate || undefined, applyLateCharge }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      // Cobrança antiga no Asaas que não pôde ser cancelada: o operador precisa saber.
      if (data.asaasWarning) window.alert(data.asaasWarning);
      onDone();
    } else setError(data.error ?? 'Erro ao renegociar.');
  }

  return (
    <div className="mt-3 rounded-lg border border-gold/20 bg-gold/5 p-3">
      {error ? <p className="mb-2 text-xs text-rose-300">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-sand-dark">
          1º vencimento
          <input type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} className={`ml-2 ${inputClass}`} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-sand-dark">
          <input type="checkbox" checked={applyLateCharge} onChange={(e) => setApplyLateCharge(e.target.checked)} />
          Incluir multa/juros no total
        </label>
        <button onClick={() => void submit()} disabled={busy} className="rounded-full bg-gold px-4 py-1.5 text-xs font-medium text-sigma-blue-deep hover:bg-gold-light disabled:opacity-40">
          {busy ? 'Gerando…' : 'Confirmar parcelamento'}
        </button>
      </div>
      <p className="mt-2 text-xs text-sand-dark">
        Redistribui o valor em aberto (mensalidades vencidas) nas mesmas contas, com vencimentos mensais a partir da
        data acima. O Art. 002 deixa de contar assim que os vencimentos ficam no futuro.
      </p>
    </div>
  );
}

interface BlockPreview {
  canBlock: boolean;
  reason: string | null;
  daysOverdue: number;
  suggestedFee: number | null;
  debts: { accountId: string | null; title: string; openAmount: number }[];
  debtsTotal: number;
}

const parseMoney = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(/\./g, '').replace(',', '.')));
const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

// Bloqueio do cadastro (comunicado à Potência) + acordo de regularização: o Venerável/Administrador
// marca a caixa, confere o que vai para o acordo, digita a taxa e confirma.
function BlockForm({ memberId, memberName, onDone }: { memberId: string; memberName: string; onDone: () => void }) {
  const [preview, setPreview] = useState<BlockPreview | null>(null);
  const [loadError, setLoadError] = useState('');
  const [kind, setKind] = useState<'' | 'settlement' | 'regularization'>('');
  const [fee, setFee] = useState('');
  const [extra, setExtra] = useState('');
  const [installments, setInstallments] = useState('1');
  const [firstDueDate, setFirstDueDate] = useState(todayIso());
  const [powerProtocol, setPowerProtocol] = useState('');
  const [powerSentAt, setPowerSentAt] = useState('');
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetch(`/api/members/${memberId}/block`)
      .then(async (res) => ({ res, data: await res.json().catch(() => ({})) }))
      .then(({ res, data }) => {
        if (!alive) return;
        if (res.ok) setPreview(data as BlockPreview);
        else setLoadError(data.error ?? 'Não foi possível carregar o acordo.');
      })
      .catch(() => alive && setLoadError('Não foi possível carregar o acordo.'));
    return () => { alive = false; };
  }, [memberId]);

  // Quitação de dívidas não tem taxa de regularização.
  const feeN = kind === 'settlement' ? 0 : parseMoney(fee);
  const extraN = extra.trim() === '' ? 0 : parseMoney(extra);
  const total = preview && Number.isFinite(feeN) && Number.isFinite(extraN) ? Math.round((preview.debtsTotal + feeN + extraN) * 100) / 100 : null;
  const n = Number(installments);
  const schedule = total != null && total > 0 && firstDueDate ? buildInstallments(total, n, new Date(`${firstDueDate}T00:00:00Z`)) : [];

  async function submit() {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/members/${memberId}/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, fee: feeN, extra: extraN, installments: n, firstDueDate, powerProtocol, powerSentAt: powerSentAt || undefined, note, confirm }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      // Cobrança antiga no Asaas que não pôde ser cancelada: quem bloqueou precisa saber.
      if (data.asaasWarning) window.alert(data.asaasWarning);
      onDone();
    } else setError(data.error ?? 'Erro ao bloquear.');
  }

  if (loadError) return <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-200">{loadError}</p>;
  if (!preview) return <p className="mt-3 text-xs text-sand-dark">Carregando o acordo…</p>;
  if (!preview.canBlock) return <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">{preview.reason}</p>;

  return (
    <div className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/5 p-4">
      <p className="text-sm font-medium text-sand-light">Bloquear {memberName} — comunicado à Potência</p>
      <p className="mt-1 text-xs text-sand-dark">
        O irmão deixa de ser convocado e de receber novos débitos. Tudo o que ele deve à loja vai para o acordo. Marque apenas se o comunicado à Potência já foi feito.
      </p>

      <fieldset className="mt-3 rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-3">
        <legend className="px-1 text-xs font-medium text-sand-light">Tipo de acordo *</legend>
        <label className="flex cursor-pointer items-start gap-2 text-xs text-sand">
          <input type="radio" name={`kind-${memberId}`} checked={kind === 'settlement'} onChange={() => setKind('settlement')} className="mt-0.5" />
          <span><strong>Quitação de dívidas com a loja</strong> — sem taxa de regularização. O irmão paga o que deve e segue bloqueado: depois pode pedir o Placet ou regularizar.</span>
        </label>
        <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs text-sand">
          <input type="radio" name={`kind-${memberId}`} checked={kind === 'regularization'} onChange={() => setKind('regularization')} className="mt-0.5" />
          <span><strong>Regularização</strong> — dívidas mais a taxa de regularização (pode ser zero). Pago o acordo, o irmão pode ser liberado.</span>
        </label>
      </fieldset>

      <div className="mt-3 rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-3">
        <p className="text-xs font-medium text-sand-light">O que entra no acordo (dívidas em aberto, pelo saldo)</p>
        <ul className="mt-2 space-y-1 text-xs text-sand-dark">
          {preview.debts.map((d, i) => (
            <li key={d.accountId ?? i} className="flex justify-between gap-3"><span>{d.title}</span><span className="tabular-nums">{brl(d.openAmount)}</span></li>
          ))}
          <li className="flex justify-between gap-3 border-t border-white/10 pt-1 font-medium text-sand-light"><span>Dívidas</span><span className="tabular-nums">{brl(preview.debtsTotal)}</span></li>
        </ul>
      </div>

      {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {kind === 'regularization' ? (
          <label className="text-xs text-sand-dark">Taxa de regularização (R$) *
            <input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" placeholder={preview.suggestedFee != null ? `ex.: ${String(preview.suggestedFee).replace('.', ',')}` : '0,00'} className={`mt-1 ${inputClass}`} />
          </label>
        ) : null}
        <label className="text-xs text-sand-dark">Multa e juros (R$) — opcional
          <input value={extra} onChange={(e) => setExtra(e.target.value)} inputMode="decimal" placeholder="0,00" className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-xs text-sand-dark">Pagamento
          <select value={installments} onChange={(e) => setInstallments(e.target.value)} className={`mt-1 ${inputClass}`}>
            <option value="1">À vista (padrão)</option>
            {Array.from({ length: MAX_AGREEMENT_INSTALLMENTS - 1 }, (_, i) => i + 2).map((k) => <option key={k} value={k}>Em {k} parcelas</option>)}
          </select>
        </label>
        <label className="text-xs text-sand-dark">{n > 1 ? '1º vencimento' : 'Vencimento'}
          <input type="date" value={firstDueDate} min={todayIso()} onChange={(e) => setFirstDueDate(e.target.value)} className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-xs text-sand-dark">Protocolo na Potência
          <input value={powerProtocol} onChange={(e) => setPowerProtocol(e.target.value)} placeholder="nº do ofício (opcional)" className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-xs text-sand-dark">Data do comunicado
          <input type="date" value={powerSentAt} onChange={(e) => setPowerSentAt(e.target.value)} className={`mt-1 ${inputClass}`} />
        </label>
      </div>
      <label className="mt-3 block text-xs text-sand-dark">Observação
        <input value={note} onChange={(e) => setNote(e.target.value)} className={`mt-1 ${inputClass}`} />
      </label>

      <div className="mt-3 rounded-lg border border-gold/20 bg-gold/5 p-3 text-xs text-sand">
        <p>Total do acordo: <strong className="tabular-nums text-gold">{total != null ? brl(total) : '—'}</strong> (sem desconto)</p>
        {schedule.length > 1 ? (
          <ul className="mt-1 text-sand-dark">
            {schedule.map((s) => <li key={s.number}>Parcela {s.number}/{schedule.length}: {brl(s.amount)} em {formatDateOnly(s.dueDate)}</li>)}
          </ul>
        ) : null}
      </div>

      <label className="mt-3 flex items-start gap-2 text-xs text-sand">
        <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5" />
        Confirmo que o comunicado à Potência já foi feito e que o cadastro deste irmão deve ser bloqueado.
      </label>
      <button
        onClick={() => void submit()}
        disabled={busy || !confirm || !kind || !Number.isFinite(feeN) || total == null || total <= 0}
        className="mt-3 rounded-full bg-rose-500 px-5 py-2 text-xs font-medium text-white hover:bg-rose-400 disabled:opacity-40"
      >
        {busy ? 'Bloqueando…' : kind === 'settlement' ? 'Bloquear e montar o acordo de quitação' : 'Bloquear e montar o acordo'}
      </button>
    </div>
  );
}

type AgingBucket = '1-30' | '31-60' | '61-90' | '90+';
const AGING_LABEL: Record<AgingBucket, string> = { '1-30': '1 a 30 dias', '31-60': '31 a 60 dias', '61-90': '61 a 90 dias', '90+': 'Mais de 90 dias' };

// Ordem da lista (tela, CSV e PDF): maior atraso primeiro (padrão — prioriza a cobrança),
// alfabética (conferência/leitura em sessão) ou maior valor em aberto.
type OverdueSort = 'atraso' | 'nome' | 'valor';
const SORT_LABEL: Record<OverdueSort, string> = { atraso: 'Dias de atraso', nome: 'Nome', valor: 'Valor em aberto' };
const COMPARE: Record<OverdueSort, (a: Row, b: Row) => number> = {
  atraso: (a, b) => b.daysOverdue - a.daysOverdue || a.memberName.localeCompare(b.memberName, 'pt-BR'),
  nome: (a, b) => a.memberName.localeCompare(b.memberName, 'pt-BR'),
  valor: (a, b) => b.totalAmount - a.totalAmount || a.memberName.localeCompare(b.memberName, 'pt-BR'),
};

function agingBucketOf(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 30) return '1-30';
  if (daysOverdue <= 60) return '31-60';
  if (daysOverdue <= 90) return '61-90';
  return '90+';
}

type Enquadramento = 'all' | 'art002' | 'below';
const ENQUADRAMENTO_LABEL: Record<Enquadramento, string> = { all: 'Todos em aberto', art002: 'Só enquadrados no Art. 002', below: 'Ainda não enquadrados' };

const num = (n: number) => n.toFixed(2).replace('.', ',');
const todayLabel = () => new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

export default function InadimplenciaClient({
  rows, canRenegotiate, mayBlock, lodgeName, crestUrl, issuedBy,
}: {
  rows: Row[];
  canRenegotiate: boolean;
  mayBlock: boolean;
  lodgeName: string;
  crestUrl: string | null;
  issuedBy?: string | null;
}) {
  const router = useRouter();
  const art002Count = rows.filter((r) => r.art002).length;
  const [renegotiatingId, setRenegotiatingId] = useState<string | null>(null);
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const [agingFilter, setAgingFilter] = useState<AgingBucket | 'all'>('all');
  const [search, setSearch] = useState('');
  const [enquadramento, setEnquadramento] = useState<Enquadramento>('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState<OverdueSort>('atraso');
  const [noticeOpen, setNoticeOpen] = useState(false);

  const buckets: AgingBucket[] = ['1-30', '31-60', '61-90', '90+'];
  const aging = buckets.map((bucket) => {
    const bucketRows = rows.filter((r) => agingBucketOf(r.daysOverdue) === bucket);
    return { bucket, count: bucketRows.length, total: bucketRows.reduce((s, r) => s + r.totalAmount, 0) };
  });

  // Situações cadastrais presentes na lista (o filtro só oferece o que existe).
  const statusesPresent = MEMBER_FILTER_STATUSES.filter((s) => rows.some((r) => r.memberStatus === s.value));

  const q = search.trim().toLocaleLowerCase('pt-BR');
  const visibleRows = rows.filter((r) =>
    (agingFilter === 'all' || agingBucketOf(r.daysOverdue) === agingFilter)
    && (enquadramento === 'all' || (enquadramento === 'art002' ? r.art002 : !r.art002))
    && (!statusFilter || r.memberStatus === statusFilter)
    && (!q || r.memberName.toLocaleLowerCase('pt-BR').includes(q)),
  ).sort(COMPARE[sort]);
  const visibleTotal = visibleRows.reduce((s, r) => s + r.totalAmount, 0);
  const visibleWithCharges = visibleRows.reduce((s, r) => s + r.lateCharge.total, 0);
  const hasFilter = agingFilter !== 'all' || enquadramento !== 'all' || !!statusFilter || !!q;

  function clearFilters() {
    setAgingFilter('all');
    setEnquadramento('all');
    setStatusFilter('');
    setSearch('');
  }

  const filterSummary = [
    enquadramento !== 'all' ? ENQUADRAMENTO_LABEL[enquadramento] : null,
    agingFilter !== 'all' ? AGING_LABEL[agingFilter] : null,
    statusFilter ? `situação: ${memberStatusLabel(statusFilter)}` : null,
    q ? `busca: "${search.trim()}"` : null,
  ].filter(Boolean).join(' · ');

  function exportCsv() {
    const lines = [csvRow(['Membro', 'Situação cadastral', 'Mensalidades em aberto', 'Vencimento mais antigo', 'Dias em atraso', 'Art. 002', 'Valor em aberto', 'Multa', 'Juros', 'Total com encargos'])];
    for (const r of visibleRows) {
      lines.push(csvRow([r.memberName, memberStatusLabel(r.memberStatus), String(r.openCount), formatDateOnly(r.oldestDueDate), String(r.daysOverdue), r.art002 ? 'Sim' : 'Não', num(r.totalAmount), num(r.lateCharge.fee), num(r.lateCharge.interest), num(r.lateCharge.total)]));
    }
    lines.push(csvRow(['Total', '', String(visibleRows.reduce((s, r) => s + r.openCount, 0)), '', '', '', num(visibleTotal), '', '', num(visibleWithCharges)]));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inadimplencia_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Inadimplência — Art. 002</h1>
          <p className="mt-1 text-sm text-sand-dark">
            Mensalidades em aberto por membro. O membro é enquadrado no Art. 002 quando a mensalidade em aberto mais
            antiga passa de 60 dias sem pagamento. O enquadramento é só um aviso: o irmão continua ativo, convocado e recebendo cobrança. Só o
            Venerável ou o Administrador, depois de comunicar a Potência, bloqueia o cadastro — aí nasce o acordo (de quitação das dívidas ou de regularização).
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-white/6 bg-sigma-card p-5">
            <p className="text-sm text-sand-dark">Membros com mensalidade em aberto</p>
            <p className="mt-3 text-2xl font-semibold text-sand-light">{rows.length}</p>
          </div>
          <div className="rounded-xl border border-white/6 bg-sigma-card p-5">
            <p className="text-sm text-sand-dark">Enquadrados no Art. 002 (&gt; 60 dias)</p>
            <p className="mt-3 text-2xl font-semibold text-rose-300">{art002Count}</p>
          </div>
          <div className="rounded-xl border border-white/6 bg-sigma-card p-5">
            <p className="text-sm text-sand-dark">Total em aberto</p>
            <p className="mt-3 text-2xl font-semibold text-gold">{brl(rows.reduce((s, r) => s + r.totalAmount, 0))}</p>
          </div>
        </section>

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Faixas de atraso (aging)</h2>
          <p className="mt-1 text-xs text-sand-dark">Clique numa faixa pra filtrar a lista abaixo por tempo de atraso — ajuda a priorizar a cobrança.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {aging.map((a) => (
              <button
                key={a.bucket}
                onClick={() => setAgingFilter((cur) => (cur === a.bucket ? 'all' : a.bucket))}
                className={`rounded-lg border p-4 text-left transition-colors ${agingFilter === a.bucket ? 'border-gold/50 bg-gold/10' : 'border-white/5 bg-sigma-blue-deep/50 hover:border-white/12'}`}
              >
                <p className="text-xs text-sand-dark">{AGING_LABEL[a.bucket]}</p>
                <p className="mt-2 text-lg font-semibold text-sand-light">{a.count} membro{a.count !== 1 ? 's' : ''}</p>
                <p className="mt-0.5 text-xs tabular-nums text-sand-dark">{brl(a.total)}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-sand-light">Membros em aberto</h2>
            {rows.length > 0 ? (
              <ReportActions disabled={visibleRows.length === 0}>
                <Button type="button" variant="secondary" onClick={exportCsv} disabled={visibleRows.length === 0}>Exportar CSV</Button>
              </ReportActions>
            ) : null}
            {rows.length > 0 && canRenegotiate ? (
              <Button type="button" onClick={() => setNoticeOpen(true)} disabled={visibleRows.length === 0} title="Avisa por e-mail (em massa) ou WhatsApp todos os irmãos da lista atual">Avisar inadimplentes ({visibleRows.length})</Button>
            ) : null}
          </div>

          {rows.length > 0 ? (
            <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
              <label className="text-xs text-sand-dark">Buscar membro
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome do irmão…" className={`mt-1 ${inputClass}`} />
              </label>
              <label className="text-xs text-sand-dark">Enquadramento
                <select value={enquadramento} onChange={(e) => setEnquadramento(e.target.value as Enquadramento)} className={`mt-1 ${inputClass}`}>
                  {(Object.keys(ENQUADRAMENTO_LABEL) as Enquadramento[]).map((k) => <option key={k} value={k}>{ENQUADRAMENTO_LABEL[k]}</option>)}
                </select>
              </label>
              <label className="text-xs text-sand-dark">Situação cadastral
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`mt-1 ${inputClass}`}>
                  <option value="">Todas</option>
                  {statusesPresent.map((s) => <option key={s.value} value={s.value}>{s.short}</option>)}
                </select>
              </label>
              <label className="text-xs text-sand-dark">Ordenar por
                <select value={sort} onChange={(e) => setSort(e.target.value as OverdueSort)} className={`mt-1 ${inputClass}`}>
                  {(Object.keys(SORT_LABEL) as OverdueSort[]).map((k) => <option key={k} value={k}>{SORT_LABEL[k]}</option>)}
                </select>
              </label>
            </div>
          ) : null}
          {hasFilter ? (
            <p className="mt-3 text-xs text-sand-dark">
              {visibleRows.length} de {rows.length} membro{rows.length !== 1 ? 's' : ''} · {brl(visibleTotal)} · {filterSummary}{' '}
              <button onClick={clearFilters} className="text-gold/80 hover:text-gold">— limpar filtros</button>
            </p>
          ) : null}

          <div className="mt-5 space-y-3">
            {rows.length === 0 ? (
              <EmptyState title="Tudo em dia. Nenhum irmão em atraso." description="Todos os membros estão em dia com a mensalidade." />
            ) : visibleRows.length === 0 ? (
              <p className="text-sm text-sand-dark">Nenhum membro com esses filtros.</p>
            ) : visibleRows.map((row) => {
              const hasCharge = row.lateCharge.fee > 0 || row.lateCharge.interest > 0;
              return (
                <div key={row.memberId} className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-sand-light">{row.memberName}</p>
                      <p className="mt-1 text-xs text-sand-dark">
                        {row.openCount} mensalidade{row.openCount > 1 ? 's' : ''} em aberto • vencimento mais antigo em{' '}
                        {formatDateOnly(row.oldestDueDate)} • situação atual: {memberStatusLabel(row.memberStatus)}
                      </p>
                      {hasCharge ? (
                        <p className="mt-1 text-xs text-amber-300/80">
                          Com multa/juros hoje: {brl(row.lateCharge.total)} (multa {brl(row.lateCharge.fee)} + juros {brl(row.lateCharge.interest)})
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-right text-xs text-sand-dark tabular-nums">{brl(row.totalAmount)}</span>
                      <Badge variant={row.art002 ? 'overdue' : 'warning'}>
                        {row.art002 ? `Art. 002 — ${row.daysOverdue} dias` : `${row.daysOverdue} dias em aberto`}
                      </Badge>
                      {row.memberStatus === BLOCKED_STATUS ? (
                        <Link href="/dashboard/acordos" className="rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/20">Bloqueado — ver acordo</Link>
                      ) : (
                        <>
                          {mayBlock && row.art002 && row.memberStatus === 'active' ? (
                            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-rose-200" title="Marque depois de comunicar a Potência">
                              <input
                                type="checkbox"
                                checked={blockingId === row.memberId}
                                onChange={(e) => { setBlockingId(e.target.checked ? row.memberId : null); if (e.target.checked) setRenegotiatingId(null); }}
                              />
                              Bloquear (Potência)
                            </label>
                          ) : null}
                          {canRenegotiate ? (
                            <Button
                              className="px-3! py-1! text-xs"
                              onClick={() => { setRenegotiatingId(renegotiatingId === row.memberId ? null : row.memberId); setBlockingId(null); }}
                            >
                              Negociar
                            </Button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                  {blockingId === row.memberId ? (
                    <BlockForm memberId={row.memberId} memberName={row.memberName} onDone={() => { setBlockingId(null); router.refresh(); }} />
                  ) : null}
                  {renegotiatingId === row.memberId ? (
                    <RenegotiateForm memberId={row.memberId} onDone={() => { setRenegotiatingId(null); router.refresh(); }} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Versão de impressão: só aparece no PDF, com a lista já filtrada. */}
      <ReportDocument
        printOnly
        lodgeName={lodgeName}
        crestUrl={crestUrl}
        title="Relatório de inadimplência — mensalidades (Art. 002)"
        details={[`Posição em ${todayLabel()}`, filterSummary, `Ordenado por: ${SORT_LABEL[sort]}`]}
        issuedBy={issuedBy}
      >
        <table>
          <thead>
            <tr>
              <th>Membro</th>
              <th>Situação</th>
              <th className="num">Qtd.</th>
              <th>Venc. mais antigo</th>
              <th className="num">Dias</th>
              <th>Art. 002</th>
              <th className="num">Em aberto</th>
              <th className="num">Com encargos</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => (
              <tr key={r.memberId}>
                <td>{r.memberName}</td>
                <td>{memberStatusLabel(r.memberStatus)}</td>
                <td className="num">{r.openCount}</td>
                <td>{formatDateOnly(r.oldestDueDate)}</td>
                <td className="num">{r.daysOverdue}</td>
                <td>{r.art002 ? 'Sim' : 'Não'}</td>
                <td className="num">{brl(r.totalAmount)}</td>
                <td className="num">{brl(r.lateCharge.total)}</td>
              </tr>
            ))}
            <tr className="rpt-total">
              <td colSpan={2}>Total — {visibleRows.length} membro{visibleRows.length !== 1 ? 's' : ''}</td>
              <td className="num">{visibleRows.reduce((s, r) => s + r.openCount, 0)}</td>
              <td colSpan={3}>{visibleRows.filter((r) => r.art002).length} enquadrado(s) no Art. 002</td>
              <td className="num">{brl(visibleTotal)}</td>
              <td className="num">{brl(visibleWithCharges)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs">Enquadramento: mensalidade em aberto mais antiga vencida há mais de 60 dias. &quot;Com encargos&quot; inclui multa e juros informativos, calculados na data do relatório.</p>
      </ReportDocument>
      {noticeOpen ? <OverdueNoticeDialog memberIds={visibleRows.map((r) => r.memberId)} onClose={() => setNoticeOpen(false)} /> : null}
    </main>
  );
}
