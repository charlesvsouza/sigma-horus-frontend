'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, Card, EmptyState, Field, FilePicker, Toast, inputClass, useConfirm, type ToastMessage } from '@/components/ui';
import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';
import { MAX_REIMBURSEMENT_FILES, REIMBURSEMENT_LABEL, REIMBURSEMENT_TONE, isReimbursementStatus } from '@/lib/reimbursement';
import type { BankOption, ChartOption, ReimbursementFileView, ReimbursementView } from '@/lib/reimbursement-view';

interface MemberOption { id: string; name: string }
type Mode = 'staff' | 'portal';

const MAX_BYTES = 4 * 1024 * 1024;
const OK_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const todayInBrazil = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

async function call(url: string, init?: RequestInit): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, init);
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: 'Sem conexão. Verifique a internet e tente de novo.' } };
  }
}
const jsonInit = (method: string, body: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const errorOf = (d: Record<string, unknown>, fallback: string) => (typeof d.error === 'string' ? d.error : fallback);

function fileProblem(f: File): string | null {
  if (!OK_TYPES.includes(f.type)) return `"${f.name}": envie foto (PNG, JPG, WebP) ou PDF.`;
  if (f.size > MAX_BYTES) return `"${f.name}" passa de 4 MB. Reduza o arquivo ou tire a foto em resolução menor.`;
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Formulário do pedido (novo, rascunho ou devolvido). Cria o rascunho, sobe os anexos um a um e só então envia: o
// pedido não vale sem ao menos 1 arquivo da nota ou do recibo.
// ---------------------------------------------------------------------------------------------------------------------
function ReimbursementForm({ charts, members, existing, onClose, onResult }: {
  charts: ChartOption[]; members?: MemberOption[]; existing?: ReimbursementView; onClose: () => void; onResult: (m: ToastMessage) => void;
}) {
  const router = useRouter();
  const staff = Boolean(members);
  const [draftId, setDraftId] = useState<string | null>(existing?.id ?? null);
  const [memberId, setMemberId] = useState('');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [vendorName, setVendorName] = useState(existing?.vendorName ?? '');
  const [amount, setAmount] = useState(existing ? String(existing.amount).replace('.', ',') : '');
  const [expenseDate, setExpenseDate] = useState(existing?.expenseDate ?? todayInBrazil());
  const [chartAccountId, setChartAccountId] = useState(existing?.chartAccountId ?? '');
  const [saved, setSaved] = useState<ReimbursementFileView[]>(existing?.files ?? []);
  const [pending, setPending] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const total = saved.length + pending.length;

  function pick(files: File[]) {
    setError('');
    const room = MAX_REIMBURSEMENT_FILES - total;
    if (files.length > room) { setError(`Cada pedido aceita até ${MAX_REIMBURSEMENT_FILES} arquivos (já há ${total}).`); return; }
    const bad = files.map(fileProblem).find(Boolean);
    if (bad) { setError(bad); return; }
    setPending((p) => [...p, ...files]);
  }

  async function removeSaved(f: ReimbursementFileView) {
    if (!draftId) return;
    const r = await call(`/api/reimbursements/${draftId}/files/${f.id}`, { method: 'DELETE' });
    if (r.ok) setSaved((s) => s.filter((x) => x.id !== f.id));
    else setError(errorOf(r.data, 'Não foi possível remover o arquivo.'));
  }

  async function submit() {
    setError('');
    if (staff && !draftId && !memberId) { setError('Escolha o irmão que será reembolsado.'); return; }
    if (staff && !chartAccountId) { setError('Escolha a categoria do gasto.'); return; }
    if (total < 1) { setError('Anexe a nota ou o recibo (ao menos 1 arquivo). Sem ele o pedido não é enviado.'); return; }
    setBusy(true);
    try {
      const fields = { description, vendorName, amount, expenseDate, chartAccountId };
      let id = draftId;
      if (!id) {
        const created = await call('/api/reimbursements', jsonInit('POST', { ...fields, ...(staff ? { memberId } : {}) }));
        if (!created.ok) { setError(errorOf(created.data, 'Não foi possível criar o pedido.')); return; }
        id = String(created.data.id);
        setDraftId(id);
      } else {
        const edited = await call(`/api/reimbursements/${id}`, jsonInit('PATCH', fields));
        if (!edited.ok) { setError(errorOf(edited.data, 'Não foi possível salvar as alterações.')); return; }
      }
      for (const file of [...pending]) {
        const fd = new FormData();
        fd.append('file', file);
        const up = await call(`/api/reimbursements/${id}/files`, { method: 'POST', body: fd });
        if (!up.ok) { setError(`${errorOf(up.data, 'Falha ao enviar o arquivo.')} O pedido ficou salvo como rascunho — tente enviar de novo.`); return; }
        setPending((p) => p.filter((x) => x !== file));
        setSaved((s) => [...s, up.data.file as ReimbursementFileView]);
      }
      const sent = await call(`/api/reimbursements/${id}/submit`, { method: 'POST' });
      if (!sent.ok) { setError(`${errorOf(sent.data, 'Não foi possível enviar o pedido.')} Ele ficou salvo como rascunho.`); return; }
      const label = typeof sent.data.statusLabel === 'string' ? sent.data.statusLabel : 'enviado';
      onResult({ kind: 'ok', text: `Pedido enviado — ${label}.${typeof sent.data.warning === 'string' ? ` ${sent.data.warning}` : ''}` });
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card variant="elevated" className="space-y-4">
      <h2 className="text-base font-semibold text-sand-light">{existing ? 'Corrigir pedido de reembolso' : 'Novo pedido de reembolso'}</h2>
      <p className="text-xs text-sand-dark">Um pedido para cada nota ou recibo. Anexe de 1 a {MAX_REIMBURSEMENT_FILES} arquivos (foto ou PDF, até 4 MB cada) — se a nota tem várias páginas, anexe todas.</p>
      {existing?.reviewNote ? <Alert intent="warn"><strong>A Tesouraria devolveu para correção:</strong> {existing.reviewNote}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {staff && !existing ? (
          <Field label="Irmão a ser reembolsado" className="sm:col-span-2">
            <select className={inputClass} value={memberId} onChange={(e) => setMemberId(e.target.value)} disabled={Boolean(draftId)}>
              <option value="">Escolha o irmão…</option>
              {members!.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
        ) : null}
        <Field label="O que foi comprado e para quê" className="sm:col-span-2">
          <input className={inputClass} value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: 2 barris de chope para o jantar ritualístico" />
        </Field>
        <Field label="Valor da nota (R$)">
          <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="780,00" />
        </Field>
        <Field label="Data do gasto">
          <input className={inputClass} type="date" max={todayInBrazil()} value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
        </Field>
        <Field label="Estabelecimento (opcional)">
          <input className={inputClass} value={vendorName} maxLength={120} onChange={(e) => setVendorName(e.target.value)} placeholder="Nome na nota" />
        </Field>
        <Field label={staff ? 'Categoria do gasto' : 'Categoria do gasto (opcional — a Tesouraria confirma)'}>
          <select className={inputClass} value={chartAccountId} onChange={(e) => setChartAccountId(e.target.value)}>
            <option value="">{staff ? 'Escolha a categoria…' : 'Não sei — a Tesouraria escolhe'}</option>
            {charts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-sand-dark">Nota ou recibo ({total} de {MAX_REIMBURSEMENT_FILES})</p>
        <ul className="space-y-1 text-sm">
          {saved.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/8 px-3 py-1.5">
              <a className="min-w-0 truncate text-gold hover:underline" href={`/api/reimbursements/${draftId}/files/${f.id}`} target="_blank" rel="noreferrer">{f.name}</a>
              <Button type="button" size="sm" variant="ghost" onClick={() => void removeSaved(f)} disabled={busy}>Remover</Button>
            </li>
          ))}
          {pending.map((f) => (
            <li key={`${f.name}-${f.size}`} className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-white/15 px-3 py-1.5">
              <span className="min-w-0 truncate text-sand-light">{f.name} <span className="text-xs text-sand-dark">(será enviado)</span></span>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPending((p) => p.filter((x) => x !== f))} disabled={busy}>Tirar</Button>
            </li>
          ))}
        </ul>
        {total < MAX_REIMBURSEMENT_FILES ? (
          <FilePicker ariaLabel="Anexar nota ou recibo" accept="image/png,image/jpeg,image/webp,application/pdf" multiple disabled={busy} buttonLabel="Anexar arquivo" emptyLabel="" fileNames={[]} onFiles={pick} />
        ) : null}
      </div>

      {error ? <Alert intent="danger">{error}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void submit()} disabled={busy}>{busy ? 'Enviando…' : 'Enviar pedido'}</Button>
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Fechar</Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Um pedido: dados, anexos e as ações que cabem ao usuário logado (calculadas no servidor em `can`).
// ---------------------------------------------------------------------------------------------------------------------
function ReimbursementItem({ item, mode, charts, banks, members, onResult }: {
  item: ReimbursementView; mode: Mode; charts: ChartOption[]; banks: BankOption[]; members?: MemberOption[]; onResult: (m: ToastMessage) => void;
}) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [chart, setChart] = useState(item.chartAccountId ?? '');
  const [approved, setApproved] = useState('');
  const [bank, setBank] = useState(banks.find((b) => b.isDefault)?.id ?? '');
  const [paidAt, setPaidAt] = useState(todayInBrazil());
  const [method, setMethod] = useState('pix');
  const [proof, setProof] = useState<File | null>(null);

  const status = isReimbursementStatus(item.status) ? item.status : 'cancelled';
  const { can } = item;

  async function run(url: string, init: RequestInit, okText: string) {
    setBusy(true);
    setError('');
    const r = await call(url, init);
    setBusy(false);
    if (!r.ok) { setError(errorOf(r.data, 'Não foi possível concluir a ação.')); return; }
    onResult({ kind: 'ok', text: okText });
    setNote(''); setApproved('');
    router.refresh();
  }

  async function cancel() {
    const draft = status === 'draft';
    if (!(await askConfirm({ title: draft ? 'Excluir rascunho' : 'Cancelar pedido', message: draft ? 'O rascunho e os arquivos anexados serão apagados.' : 'O pedido será cancelado e sairá da fila. Isso não pode ser desfeito.', confirmLabel: draft ? 'Excluir' : 'Cancelar pedido', intent: 'danger' }))) return;
    await run(`/api/reimbursements/${item.id}`, { method: 'DELETE' }, draft ? 'Rascunho excluído.' : 'Pedido cancelado.');
  }

  async function pay() {
    if (!proof) { setError('Anexe o comprovante do pagamento (PDF ou foto).'); return; }
    const problem = fileProblem(proof);
    if (problem) { setError(problem); return; }
    const fd = new FormData();
    fd.append('bankAccountId', bank);
    fd.append('paidAt', paidAt);
    fd.append('method', method);
    fd.append('file', proof);
    await run(`/api/reimbursements/${item.id}/pay`, { method: 'POST', body: fd }, 'Reembolso pago e lançado no extrato.');
  }

  if (editing) {
    return <ReimbursementForm charts={charts} members={members} existing={item} onClose={() => setEditing(false)} onResult={onResult} />;
  }

  const amountText = item.approvedAmount != null && item.approvedAmount !== item.amount ? `${brl(item.approvedAmount)} (nota de ${brl(item.amount)})` : brl(item.approvedAmount ?? item.amount);

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="wrap-break-word text-base font-semibold text-sand-light">{item.description}</h3>
          <p className="mt-0.5 text-xs text-sand-dark">
            {mode === 'staff' ? <>{item.memberName} · </> : null}gasto de {formatDateOnly(item.expenseDate)}
            {item.vendorName ? ` · ${item.vendorName}` : ''}
            {item.chartLabel ? ` · ${item.chartLabel}` : ''}
          </p>
          {mode === 'staff' && item.requestedVia === 'staff' ? <p className="text-xs text-sand-dark">Digitado por {item.requestedByName}{item.implicitApproval ? ' — autorização implícita' : ''}</p> : null}
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-sand-light">{amountText}</p>
          <Badge variant={REIMBURSEMENT_TONE[status]}>{REIMBURSEMENT_LABEL[status]}</Badge>
        </div>
      </div>

      {item.files.length > 0 ? (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {item.files.map((f) => <a key={f.id} className="text-gold hover:underline" href={`/api/reimbursements/${item.id}/files/${f.id}`} target="_blank" rel="noreferrer">{f.name}</a>)}
        </p>
      ) : null}
      {status === 'returned' && item.reviewNote ? <Alert intent="warn"><strong>Devolvido pela Tesouraria:</strong> {item.reviewNote}</Alert> : null}
      {status === 'rejected' && item.decisionNote ? <Alert intent="danger"><strong>Motivo da rejeição:</strong> {item.decisionNote}</Alert> : null}
      {status === 'approved' && item.decisionNote ? <p className="text-xs text-sand-dark">Observação do Venerável: {item.decisionNote}</p> : null}
      {status === 'paid' && item.paidAt ? <p className="text-xs text-sand-dark">Pago em {formatDateOnly(item.paidAt)}.</p> : null}
      {can.decide && (item.memberStatus === 'blocked' || item.openDebt > 0) ? (
        <Alert intent="warn">
          {item.memberStatus === 'blocked' ? 'Este irmão está bloqueado (acordo de regularização). ' : ''}
          {item.openDebt > 0 ? `Há ${brl(item.openDebt)} em aberto com a loja.` : ''}
        </Alert>
      ) : null}

      {/* Tesouraria confere a nota */}
      {can.review ? (
        <div className="space-y-2 rounded-lg border border-white/8 p-3">
          <p className="text-xs text-sand-dark">Confira a nota ou o recibo, confirme a categoria do gasto e peça a liberação ao Venerável — ou devolva ao irmão para corrigir.</p>
          <Field label="Categoria do gasto">
            <select className={inputClass} value={chart} onChange={(e) => setChart(e.target.value)}>
              <option value="">Escolha a categoria…</option>
              {charts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Observação (para devolver, explique o que corrigir)">
            <textarea className={inputClass} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={busy || !chart} onClick={() => void run(`/api/reimbursements/${item.id}/review`, jsonInit('POST', { action: 'forward', chartAccountId: chart, note }), 'Enviado ao Venerável para liberação.')}>Pedir liberação ao Venerável</Button>
            <Button type="button" size="sm" variant="secondary" disabled={busy || note.trim().length < 3} onClick={() => void run(`/api/reimbursements/${item.id}/review`, jsonInit('POST', { action: 'return', note }), 'Pedido devolvido ao irmão.')}>Devolver ao irmão</Button>
          </div>
        </div>
      ) : null}

      {/* Venerável decide */}
      {can.decide ? (
        <div className="space-y-2 rounded-lg border border-white/8 p-3">
          <p className="text-xs text-sand-dark">Autorize (a conta a pagar nasce já com os dados do pedido) ou rejeite informando o motivo. Para autorizar valor menor que o da nota, informe o valor e o motivo.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label={`Valor autorizado (nota: ${brl(item.amount)})`}>
              <input className={inputClass} inputMode="decimal" value={approved} onChange={(e) => setApproved(e.target.value)} placeholder={String(item.amount).replace('.', ',')} />
            </Field>
            <Field label="Motivo / observação" className="sm:col-span-2">
              <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => void run(`/api/reimbursements/${item.id}/decide`, jsonInit('POST', { action: 'approve', approvedAmount: approved || undefined, note }), 'Reembolso autorizado: a conta a pagar foi criada.')}>Autorizar</Button>
            <Button type="button" size="sm" variant="danger" disabled={busy || note.trim().length < 3} onClick={() => void run(`/api/reimbursements/${item.id}/decide`, jsonInit('POST', { action: 'reject', note }), 'Reembolso rejeitado; o irmão verá o motivo.')}>Rejeitar</Button>
          </div>
        </div>
      ) : null}
      {status === 'awaiting_vm' && !can.decide && mode === 'staff' ? <p className="text-xs text-sand-dark">Quem decide é o Venerável (ou o Administrador); quem pediu não decide sobre o próprio pedido.</p> : null}

      {/* Tesouraria devolve o dinheiro e registra o pagamento */}
      {can.pay ? (
        <div className="space-y-2 rounded-lg border border-white/8 p-3">
          <p className="text-xs text-sand-dark">Devolva o valor ao irmão e registre aqui: conta que pagou, data e o comprovante (obrigatório). A conta a pagar só vira &quot;paga&quot; com isso.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Conta que pagou">
              <select className={inputClass} value={bank} onChange={(e) => setBank(e.target.value)}>
                <option value="">Escolha…</option>
                {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Data do pagamento">
              <input className={inputClass} type="date" max={todayInBrazil()} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </Field>
            <Field label="Forma">
              <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="pix">Pix</option>
                <option value="transfer">Transferência</option>
                <option value="cash">Dinheiro</option>
                <option value="manual">Outra</option>
              </select>
            </Field>
          </div>
          <FilePicker ariaLabel="Comprovante do pagamento" accept="image/png,image/jpeg,image/webp,application/pdf" disabled={busy} buttonLabel="Anexar comprovante" emptyLabel="Nenhum comprovante" fileNames={proof ? [proof.name] : []} onFiles={(f) => setProof(f[0] ?? null)} />
          <Button type="button" size="sm" disabled={busy || !bank || !proof} onClick={() => void pay()}>Registrar pagamento</Button>
        </div>
      ) : null}

      {error ? <Alert intent="danger">{error}</Alert> : null}
      {(can.edit || can.cancel) ? (
        <div className="flex flex-wrap gap-2">
          {can.edit ? <Button type="button" size="sm" onClick={() => setEditing(true)}>{status === 'draft' ? 'Continuar e enviar' : 'Corrigir e reenviar'}</Button> : null}
          {can.cancel ? <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void cancel()}>{status === 'draft' ? 'Excluir rascunho' : 'Cancelar pedido'}</Button> : null}
        </div>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Quadro: "Esperando você" · "Em andamento" · "Encerrados", mais o botão de novo pedido.
// ---------------------------------------------------------------------------------------------------------------------
type Tab = 'acao' | 'andamento' | 'encerrados';
const CLOSED = ['paid', 'rejected', 'cancelled'];

export default function ReimbursementBoard({ items, charts, banks, members, mode }: {
  items: ReimbursementView[]; charts: ChartOption[]; banks: BankOption[]; members?: MemberOption[]; mode: Mode;
}) {
  const [message, setMessage] = useState<ToastMessage>(null);
  const [creating, setCreating] = useState(false);
  const needsMe = (i: ReimbursementView) => i.can.edit || i.can.review || i.can.decide || i.can.pay;
  const groups: Record<Tab, ReimbursementView[]> = {
    acao: items.filter(needsMe),
    andamento: items.filter((i) => !CLOSED.includes(i.status)),
    encerrados: items.filter((i) => CLOSED.includes(i.status)),
  };
  const [tab, setTab] = useState<Tab>(groups.acao.length > 0 ? 'acao' : 'andamento');
  const labels: Record<Tab, string> = { acao: 'Esperando você', andamento: 'Em andamento', encerrados: 'Encerrados' };
  const shown = groups[tab];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Situação dos pedidos" className="flex flex-wrap gap-2">
          {(Object.keys(labels) as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors pointer-coarse:min-h-11 ${tab === t ? 'border-gold/50 bg-gold/10 text-gold' : 'border-white/10 text-sand hover:bg-white/5'}`}
            >
              {labels[t]} ({groups[t].length})
            </button>
          ))}
        </div>
        {!creating ? <Button type="button" onClick={() => setCreating(true)}>Pedir reembolso</Button> : null}
      </div>

      {creating ? <ReimbursementForm charts={charts} members={members} onClose={() => setCreating(false)} onResult={setMessage} /> : null}

      {shown.length === 0 ? (
        <EmptyState
          title={tab === 'acao' ? 'Nada esperando você' : tab === 'andamento' ? 'Nenhum pedido em andamento' : 'Nenhum pedido encerrado'}
          description={mode === 'portal' ? 'Pagou algo pela loja do próprio bolso? Peça o reembolso anexando a nota ou o recibo.' : 'Os pedidos de reembolso dos irmãos aparecem aqui.'}
        />
      ) : (
        <div className="space-y-3">
          {shown.map((i) => <ReimbursementItem key={`${i.id}-${i.status}`} item={i} mode={mode} charts={charts} banks={banks} members={members} onResult={setMessage} />)}
        </div>
      )}
      <Toast message={message} onClose={() => setMessage(null)} />
    </div>
  );
}
