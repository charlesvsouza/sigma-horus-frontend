'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { Alert, Badge, Button, Field, MaskedInput, inputClass, useConfirm } from '@/components/ui';
import {
  CANDIDATE_STAGES, CANDIDATE_STAGE_LABEL, CLOSED_REASONS, OPINIONS, closedReasonLabel, deriveStage, opinionLabel,
} from '@/lib/candidate';
import { CANDIDACY_DOCUMENT_CATEGORY } from '@/lib/documents';
import { clampDateYear, fetchCep, maskCEP, maskCPF, maskPhone, maskRG } from '@/lib/masks';
import { formatDateOnly } from '@/lib/date-only';

interface Inquirer { id: string; memberId: string; opinion: string | null; reportedAt: string | null; member: { id: string; name: string } }
interface Process {
  proposerId: string | null; preProposalDate: string | null; proposalReadingDate: string | null;
  inquiryOpenedAt: string | null; inquiryDeadline: string | null; inquiryClosedAt: string | null; inquiryResult: string | null;
  ballotDate: string | null; ballotResult: string | null;
  potencySentAt: string | null; potencyApprovedAt: string | null; potencyReference: string | null;
  initiationScheduledAt: string | null; initiatedAt: string | null;
  closedAt: string | null; closedReason: string | null; notes: string | null;
  proposer: { id: string; name: string } | null;
  inquirers: Inquirer[];
}
interface Candidate {
  id: string; name: string; status: string; email: string | null; phone: string | null; cpf: string | null; rg: string | null;
  birthDate: string | null; maritalStatus: string | null; occupation: string | null; nationality: string | null;
  addressLine: string | null; addressNumber: string | null; complement: string | null; neighborhood: string | null;
  city: string | null; state: string | null; zipCode: string | null; country: string | null;
  candidateProcess: Process | null;
  user: { id: string; status: string; mustChangePassword: boolean } | null;
}
interface DocItem { id: string; title: string; fileName: string | null; createdAt: string }

const PERSONAL_KEYS = ['name', 'email', 'phone', 'cpf', 'rg', 'birthDate', 'maritalStatus', 'occupation', 'nationality', 'zipCode', 'addressLine', 'addressNumber', 'complement', 'neighborhood', 'city', 'state', 'country'] as const;
const PROCESS_KEYS = ['proposerId', 'preProposalDate', 'proposalReadingDate', 'inquiryOpenedAt', 'inquiryDeadline', 'inquiryClosedAt', 'inquiryResult', 'ballotDate', 'ballotResult', 'potencySentAt', 'potencyApprovedAt', 'potencyReference', 'initiationScheduledAt', 'notes'] as const;
type ProcKey = (typeof PROCESS_KEYS)[number];
const DATE_KEYS = new Set(['birthDate', 'preProposalDate', 'proposalReadingDate', 'inquiryOpenedAt', 'inquiryDeadline', 'inquiryClosedAt', 'ballotDate', 'potencySentAt', 'potencyApprovedAt', 'initiationScheduledAt']);

const dateVal = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');
const toForm = <K extends string>(keys: readonly K[], src: Record<string, unknown>) =>
  Object.fromEntries(keys.map((k) => [k, DATE_KEYS.has(k) ? dateVal(src[k] as string | null) : String(src[k] ?? '')])) as Record<K, string>;
const today = () => new Date().toISOString().slice(0, 10);

type Msg = { kind: 'ok' | 'error'; text: string } | null;
type Refresh = 'all' | { proc?: ProcKey[]; personal?: boolean; inquirers?: boolean };

export default function FichaCandidatoClient({ id, brothers, lodgeName }: { id: string; brothers: { id: string; name: string }[]; lodgeName: string }) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [item, setItem] = useState<Candidate | null>(null);
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [loadError, setLoadError] = useState('');
  const [personal, setPersonal] = useState<Record<string, string>>({});
  const [proc, setProc] = useState<Record<ProcKey, string>>({} as Record<ProcKey, string>);
  const [inquirers, setInquirers] = useState<{ memberId: string; opinion: string; reportedAt: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Msg>(null);
  const [initiation, setInitiation] = useState({ date: today(), lodge: lodgeName });
  const [closing, setClosing] = useState<{ reason: string; date: string } | null>(null);
  const [upload, setUpload] = useState<{ title: string; file: File | null }>({ title: '', file: null });
  const [cepStatus, setCepStatus] = useState('');

  // `refresh` diz quais formulários voltam ao que está gravado: 'all' só na
  // abertura; depois de salvar uma etapa, só as chaves dela — assim o que já foi
  // digitado (e ainda não salvo) nas outras etapas não é apagado pelo recarregamento.
  // `isActive`: o efeito de abertura descarta a resposta de um carregamento já
  // cancelado (efeito repetido) — senão ela chegaria depois e zeraria o que a
  // pessoa já começou a digitar.
  const load = useCallback(async (refresh: Refresh = 'all', isActive: () => boolean = () => true) => {
    const res = await fetch(`/api/candidates/${id}`);
    const data = await res.json().catch(() => ({}));
    if (!isActive()) return;
    if (!res.ok) { setLoadError(data.error ?? 'Não foi possível carregar a ficha.'); return; }
    const c = data.item as Candidate;
    setItem(c);
    setDocuments(data.documents ?? []);
    const all = refresh === 'all';
    const only = refresh === 'all' ? {} : refresh;
    if (all || only.personal) setPersonal(toForm(PERSONAL_KEYS, c as unknown as Record<string, unknown>));
    if (c.candidateProcess) {
      const fresh = toForm(PROCESS_KEYS, c.candidateProcess as unknown as Record<string, unknown>);
      if (all) setProc(fresh);
      else if (only.proc?.length) setProc((prev) => ({ ...prev, ...Object.fromEntries(only.proc!.map((k) => [k, fresh[k]])) }));
      if (all || only.inquirers) setInquirers(c.candidateProcess.inquirers.map((i) => ({ memberId: i.memberId, opinion: i.opinion ?? '', reportedAt: dateVal(i.reportedAt) })));
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load('all', () => active);
    return () => { active = false; };
  }, [load]);

  const notify = (kind: 'ok' | 'error', text: string) => { setMessage({ kind, text }); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  async function send(key: string, url: string, method: string, body?: unknown, okText?: string, refresh: Refresh = {}) {
    setBusy(key);
    setMessage(null);
    const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setBusy(null); notify('error', data.error ?? 'Não foi possível salvar.'); return null; }
    await load(refresh);
    setBusy(null);
    if (okText) notify('ok', okText);
    return data;
  }

  const saveProcess = (key: string, keys: ProcKey[], label: string) =>
    send(key, `/api/candidates/${id}`, 'PATCH', Object.fromEntries(keys.map((k) => [k, proc[k] ?? ''])), `${label}: salvo.`, { proc: keys });

  if (loadError) return <main className="min-h-screen px-6 py-10"><Alert intent="danger">{loadError}</Alert></main>;
  if (!item || !item.candidateProcess) return <main className="min-h-screen px-6 py-10"><p className="text-sm text-sand-dark">Carregando…</p></main>;

  const p = item.candidateProcess;
  const info = deriveStage(p);
  const locked = info.stage === 'initiated' || info.stage === 'closed';
  const setP = (k: ProcKey, v: string) => setProc((prev) => ({ ...prev, [k]: v }));
  const setPe = (k: string, v: string) => setPersonal((prev) => ({ ...prev, [k]: v }));
  const dateInput = (k: ProcKey, label: string) => (
    <Field label={label}>
      <input type="date" disabled={locked} value={proc[k] ?? ''} onChange={(e) => setP(k, clampDateYear(e.target.value, proc[k] ?? ''))} className={inputClass} />
    </Field>
  );
  const stageSave = (key: string, keys: ProcKey[], label: string, extra?: () => Promise<unknown>) =>
    locked ? null : (
      <div className="mt-4">
        <Button type="button" size="sm" disabled={busy !== null} onClick={async () => { if (extra && (await extra()) === null) return; await saveProcess(key, keys, label); }}>
          {busy === key ? 'Salvando…' : `Salvar ${label.toLowerCase()}`}
        </Button>
      </div>
    );
  const inquirerIds = new Set(inquirers.map((i) => i.memberId));
  const inquirerChoices = brothers.filter((b) => b.id !== p.proposerId && b.id !== proc.proposerId);

  async function grantAccess() {
    if (!item?.email) { notify('error', 'Cadastre o e-mail do candidato (Dados pessoais) antes de liberar o acesso.'); return; }
    if (!(await askConfirm({
      title: item.user ? 'Gerar nova senha do portal' : 'Liberar acesso ao portal',
      message: `${item.name} recebe por e-mail (${item.email}) uma senha provisória. No portal ele vê apenas os próprios débitos, o próprio cadastro e paga o que deve à Loja.`,
      confirmLabel: item.user ? 'Gerar nova senha' : 'Liberar acesso',
    }))) return;
    const data = await send('access', `/api/members/${id}/grant-access`, 'POST');
    if (data) {
      notify('ok', data.emailStatus === 'sent'
        ? `Acesso liberado. Senha provisória enviada para ${item.email}.`
        : `Acesso liberado. E-mail não enviado — senha provisória: ${data.tempPassword} (repasse ao candidato).`);
    }
  }

  async function initiate() {
    if (!initiation.date) { notify('error', 'Informe a data da iniciação.'); return; }
    const noPotency = !p.potencyApprovedAt;
    if (!(await askConfirm({
      title: 'Registrar iniciação',
      message: `${item!.name} passa a obreiro ATIVO (Aprendiz), iniciado em ${formatDateOnly(initiation.date)}${initiation.lodge ? ` na ${initiation.lodge}` : ''}. ${item!.user ? 'O acesso dele ao sistema passa de candidato para obreiro. ' : ''}Cobranças e pagamentos continuam no mesmo cadastro.${noPotency ? '\n\nAtenção: a autorização da Potência não foi registrada.' : ''}`,
      confirmLabel: 'Registrar iniciação',
    }))) return;
    await send('initiate', `/api/candidates/${id}/initiate`, 'POST', { initiatedAt: initiation.date, initiationLodge: initiation.lodge }, 'Iniciação registrada. O cadastro agora está em Membros.');
  }

  async function closeProcess() {
    if (!closing?.reason) { notify('error', 'Escolha o motivo do encerramento.'); return; }
    const ok = await send('close', `/api/candidates/${id}/close`, 'POST', { reason: closing.reason, closedAt: closing.date }, 'Processo encerrado.');
    if (ok) setClosing(null);
  }

  async function reopen() {
    if (!(await askConfirm({ title: 'Reabrir processo', message: 'O processo volta à etapa em que parou e o acesso do candidato ao portal (se houver) volta a funcionar.', confirmLabel: 'Reabrir' }))) return;
    await send('reopen', `/api/candidates/${id}/close`, 'DELETE', undefined, 'Processo reaberto.');
  }

  async function remove() {
    if (!(await askConfirm({ title: 'Excluir candidato', message: `Excluir ${item!.name} e o processo? Só é possível sem lançamentos, pagamentos ou documentos — com histórico, encerre o processo.`, confirmLabel: 'Excluir', intent: 'danger' }))) return;
    setBusy('delete');
    const res = await fetch(`/api/candidates/${id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { notify('error', data.error ?? 'Não foi possível excluir.'); return; }
    router.push('/dashboard/candidatos');
  }

  async function lookupCep(value: string) {
    setCepStatus('');
    const address = await fetchCep(value);
    if (!address) { if (value.replace(/\D/g, '').length === 8) setCepStatus('CEP não encontrado.'); return; }
    setPersonal((prev) => ({ ...prev, zipCode: address.cep, addressLine: address.logradouro || prev.addressLine, neighborhood: address.bairro || prev.neighborhood, city: address.cidade || prev.city, state: address.uf || prev.state }));
    setCepStatus('Endereço preenchido pelo CEP.');
  }

  async function uploadDocument() {
    const file = upload.file;
    if (!file) { notify('error', 'Escolha o arquivo.'); return; }
    setBusy('upload');
    setMessage(null);
    try {
      const mimeType = file.type || 'application/octet-stream';
      const urlRes = await fetch('/api/documents/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name, mimeType }) });
      const urlData = await urlRes.json().catch(() => ({}));
      if (!urlRes.ok) throw new Error(urlData.error ?? 'Falha ao preparar o envio.');
      const put = await fetch(urlData.uploadUrl, { method: 'PUT', headers: { 'Content-Type': mimeType }, body: file }).catch(() => null);
      if (!put?.ok) throw new Error('Falha ao enviar o arquivo para o storage.');
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: upload.title.trim() || file.name, kind: 'document', category: CANDIDACY_DOCUMENT_CATEGORY, memberId: id,
          storageKey: urlData.storageKey, fileName: file.name, mimeType, fileUrl: urlData.publicUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Falha ao registrar o documento.');
      setUpload({ title: '', file: null });
      notify('ok', 'Documento guardado na pasta do candidato.');
      await load({});
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Erro ao enviar o documento.');
    } finally {
      setBusy(null);
    }
  }

  async function removeDocument(d: DocItem) {
    if (!(await askConfirm({ title: 'Remover documento', message: `Remover "${d.title}"? O arquivo também é apagado do storage.`, confirmLabel: 'Remover', intent: 'danger' }))) return;
    await send(`doc-${d.id}`, `/api/documents/${d.id}`, 'DELETE', undefined, 'Documento removido.');
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link href="/dashboard/candidatos" className="text-xs text-gold hover:text-gold-light">← Candidatos</Link>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-sand-light">{item.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {info.stage === 'initiated' ? <Badge variant="success">Iniciado em {formatDateOnly(p.initiatedAt)}</Badge>
                  : info.stage === 'closed' ? <Badge variant="canceled">{closedReasonLabel(p.closedReason)} em {formatDateOnly(p.closedAt)}</Badge>
                  : <Badge variant={info.warning ? 'warning' : 'info'}>{CANDIDATE_STAGE_LABEL[info.stage]}</Badge>}
                {item.user ? <span className="text-sand-dark">Portal: {item.user.status === 'active' ? (item.user.mustChangePassword ? 'acesso liberado, aguardando o 1º login' : 'acesso ativo') : 'acesso desativado'}</span> : <span className="text-sand-dark">Sem acesso ao portal</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {item.status === 'candidate' && info.stage !== 'closed' ? (
                <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => void grantAccess()}>{item.user ? 'Nova senha do portal' : 'Liberar acesso ao portal'}</Button>
              ) : null}
              {info.stage === 'closed' ? (
                <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => void reopen()}>Reabrir processo</Button>
              ) : info.stage !== 'initiated' ? (
                <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => setClosing(closing ? null : { reason: '', date: today() })}>Encerrar processo</Button>
              ) : (
                <Link href="/dashboard/membros" className="rounded-full border border-gold/40 px-4 py-2 text-xs font-medium text-gold/80 hover:text-gold">Ver em Membros</Link>
              )}
              {item.status === 'candidate' ? <Button variant="danger" size="sm" disabled={busy !== null} onClick={() => void remove()}>Excluir</Button> : null}
            </div>
          </div>
        </div>

        {message ? <Alert intent={message.kind === 'ok' ? 'ok' : 'danger'}>{message.text}</Alert> : null}
        {info.warning && !locked ? <Alert intent="warn">{info.warning} Decida se o processo segue ou se deve ser encerrado.</Alert> : null}

        {closing ? (
          <div className="rounded-xl border border-white/6 bg-sigma-card p-6">
            <h2 className="text-base font-semibold text-sand-light">Encerrar processo sem iniciação</h2>
            <p className="mt-1 text-xs text-sand-dark">A ficha, a pasta de documentos e o financeiro ficam guardados; o acesso do candidato ao portal é desativado. Dá para reabrir depois.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Motivo">
                <select value={closing.reason} onChange={(e) => setClosing({ ...closing, reason: e.target.value })} className={inputClass}>
                  <option value="">Escolha…</option>
                  {CLOSED_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </Field>
              <Field label="Data">
                <input type="date" value={closing.date} onChange={(e) => setClosing({ ...closing, date: clampDateYear(e.target.value, closing.date) })} className={inputClass} />
              </Field>
            </div>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="danger" disabled={busy !== null} onClick={() => void closeProcess()}>{busy === 'close' ? 'Encerrando…' : 'Encerrar processo'}</Button>
              <Button size="sm" variant="ghost" onClick={() => setClosing(null)}>Cancelar</Button>
            </div>
          </div>
        ) : null}

        {/* Linha do tempo do processo */}
        <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="Etapas do processo">
          {CANDIDATE_STAGES.map((s, i) => {
            const done = info.stage === 'initiated' || (info.index > i && info.stage !== 'closed');
            const current = info.index === i && !locked;
            return (
              <li key={s.key} aria-current={current ? 'step' : undefined} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${current ? 'border-gold/60 bg-gold/10 text-gold' : done ? 'border-emerald-500/25 text-emerald-300' : 'border-white/8 text-sand-dark'}`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${done ? 'border-emerald-400/50' : 'border-current'}`}>
                  {done ? <Check className="h-3 w-3" aria-hidden="true" /> : i + 1}
                </span>
                {s.label}
              </li>
            );
          })}
        </ol>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          {/* Coluna do processo */}
          <div className="space-y-6">
            <Stage n={1} title="Pré-proposta" hint="Recebimento da pré-proposta e o obreiro que apresenta o candidato.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Proponente (padrinho)">
                  <select disabled={locked} value={proc.proposerId ?? ''} onChange={(e) => setP('proposerId', e.target.value)} className={inputClass}>
                    <option value="">—</option>
                    {brothers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    {p.proposer && !brothers.some((b) => b.id === p.proposer!.id) ? <option value={p.proposer.id}>{p.proposer.name}</option> : null}
                  </select>
                </Field>
                {dateInput('preProposalDate', 'Pré-proposta recebida em')}
              </div>
              {stageSave('s1', ['proposerId', 'preProposalDate'], 'Pré-proposta')}
            </Stage>

            <Stage n={2} title="Leitura da proposta" hint="Proposta formal lida em sessão.">
              <div className="grid gap-4 sm:grid-cols-2">{dateInput('proposalReadingDate', 'Lida em sessão em')}</div>
              {stageSave('s2', ['proposalReadingDate'], 'Leitura')}
            </Stage>

            <Stage n={3} title="Sindicância" hint="Sigilosa: só Administrador, Venerável e Secretaria veem os sindicantes e os pareceres.">
              <div className="grid gap-4 sm:grid-cols-3">
                {dateInput('inquiryOpenedAt', 'Aberta em')}
                {dateInput('inquiryDeadline', 'Prazo')}
                {dateInput('inquiryClosedAt', 'Concluída em')}
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Sindicantes</p>
                {inquirers.length === 0 ? <p className="text-xs text-sand-dark">Nenhum sindicante nomeado.</p> : null}
                {inquirers.map((inq, idx) => (
                  <div key={inq.memberId} className="grid items-end gap-3 rounded-lg border border-white/5 bg-sigma-blue-deep/40 p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
                    <p className="text-sm text-sand-light">{brothers.find((b) => b.id === inq.memberId)?.name ?? p.inquirers.find((x) => x.memberId === inq.memberId)?.member.name ?? '—'}</p>
                    <Field label="Parecer">
                      <select disabled={locked} value={inq.opinion} onChange={(e) => setInquirers((l) => l.map((x, i) => (i === idx ? { ...x, opinion: e.target.value } : x)))} className={inputClass}>
                        <option value="">{opinionLabel(null)}</option>
                        {OPINIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Data do parecer">
                      <input type="date" disabled={locked} value={inq.reportedAt} onChange={(e) => setInquirers((l) => l.map((x, i) => (i === idx ? { ...x, reportedAt: clampDateYear(e.target.value, x.reportedAt) } : x)))} className={inputClass} />
                    </Field>
                    {locked ? <span /> : <button type="button" onClick={() => setInquirers((l) => l.filter((_, i) => i !== idx))} className="pb-2 text-xs text-rose-300 hover:text-rose-200">Remover</button>}
                  </div>
                ))}
                {locked ? null : (
                  <select
                    aria-label="Nomear sindicante"
                    value=""
                    onChange={(e) => { if (e.target.value) setInquirers((l) => [...l, { memberId: e.target.value, opinion: '', reportedAt: '' }]); }}
                    className={`${inputClass} max-w-sm`}
                  >
                    <option value="">+ Nomear sindicante…</option>
                    {inquirerChoices.filter((b) => !inquirerIds.has(b.id)).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                )}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Field label="Resultado da sindicância">
                  <select disabled={locked} value={proc.inquiryResult ?? ''} onChange={(e) => setP('inquiryResult', e.target.value)} className={inputClass}>
                    <option value="">Em andamento</option>
                    {OPINIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              </div>
              {stageSave('s3', ['inquiryOpenedAt', 'inquiryDeadline', 'inquiryClosedAt', 'inquiryResult'], 'Sindicância', () =>
                send('s3', `/api/candidates/${id}/inquirers`, 'PUT', { inquirers }, undefined, { inquirers: true }))}
            </Stage>

            <Stage n={4} title="Escrutínio" hint="Votação em sessão. Só com o escrutínio aprovado a iniciação pode ser registrada.">
              <div className="grid gap-4 sm:grid-cols-2">
                {dateInput('ballotDate', 'Realizado em')}
                <Field label="Resultado">
                  <select disabled={locked} value={proc.ballotResult ?? ''} onChange={(e) => setP('ballotResult', e.target.value)} className={inputClass}>
                    <option value="">—</option>
                    <option value="approved">Aprovado</option>
                    <option value="rejected">Reprovado</option>
                  </select>
                </Field>
              </div>
              {stageSave('s4', ['ballotDate', 'ballotResult'], 'Escrutínio')}
            </Stage>

            <Stage n={5} title="Autorização da Potência" hint="Processo enviado à Potência e autorização (placet) recebida.">
              <div className="grid gap-4 sm:grid-cols-3">
                {dateInput('potencySentAt', 'Enviado em')}
                {dateInput('potencyApprovedAt', 'Autorizado em')}
                <Field label="Nº do processo / placet">
                  <input disabled={locked} value={proc.potencyReference ?? ''} onChange={(e) => setP('potencyReference', e.target.value)} className={inputClass} />
                </Field>
              </div>
              {stageSave('s5', ['potencySentAt', 'potencyApprovedAt', 'potencyReference'], 'Autorização')}
            </Stage>

            <Stage n={6} title="Iniciação" hint="Marque a data e, depois da cerimônia, registre a iniciação: o candidato vira obreiro ativo (Aprendiz).">
              <div className="grid gap-4 sm:grid-cols-2">{dateInput('initiationScheduledAt', 'Data marcada')}</div>
              {stageSave('s6', ['initiationScheduledAt'], 'Data marcada')}
              {item.status === 'candidate' && !locked ? (
                <div className="mt-5 rounded-lg border border-gold/25 bg-gold/5 p-4">
                  <p className="text-sm font-medium text-sand-light">Registrar iniciação</p>
                  {p.ballotResult !== 'approved' ? <p className="mt-1 text-xs text-amber-300">Disponível depois do escrutínio aprovado.</p> : null}
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Field label="Iniciado em">
                      <input type="date" value={initiation.date} onChange={(e) => setInitiation({ ...initiation, date: clampDateYear(e.target.value, initiation.date) })} className={inputClass} />
                    </Field>
                    <Field label="Loja da iniciação">
                      <input value={initiation.lodge} onChange={(e) => setInitiation({ ...initiation, lodge: e.target.value })} className={inputClass} />
                    </Field>
                  </div>
                  <div className="mt-3">
                    <Button size="sm" disabled={busy !== null || p.ballotResult !== 'approved'} onClick={() => void initiate()}>{busy === 'initiate' ? 'Registrando…' : 'Registrar iniciação'}</Button>
                  </div>
                </div>
              ) : null}
            </Stage>

            <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
              <h2 className="text-base font-semibold text-sand-light">Observações do processo</h2>
              <textarea disabled={locked} rows={4} value={proc.notes ?? ''} onChange={(e) => setP('notes', e.target.value)} className={`${inputClass} mt-3`} />
              {stageSave('notes', ['notes'], 'Observações')}
            </section>
          </div>

          {/* Coluna do cadastro e da pasta */}
          <div className="space-y-6">
            <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
              <h2 className="text-base font-semibold text-sand-light">Dados pessoais</h2>
              {item.status !== 'candidate' ? (
                <p className="mt-2 text-sm text-sand-dark">Iniciado: o cadastro agora é editado em Membros.</p>
              ) : (
                <form
                  className="mt-4 space-y-4"
                  onSubmit={(e) => { e.preventDefault(); void send('personal', `/api/candidates/${id}`, 'PATCH', personal, 'Dados pessoais salvos.', { personal: true }); }}
                >
                  <Field label="Nome completo *"><input required value={personal.name ?? ''} onChange={(e) => setPe('name', e.target.value)} className={inputClass} /></Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="E-mail (login do portal)"><input type="email" value={personal.email ?? ''} onChange={(e) => setPe('email', e.target.value)} className={inputClass} /></Field>
                    <Field label="Telefone"><MaskedInput value={personal.phone ?? ''} onChange={(v) => setPe('phone', v)} mask={maskPhone} className={inputClass} /></Field>
                    <Field label="CPF"><MaskedInput value={personal.cpf ?? ''} onChange={(v) => setPe('cpf', v)} mask={maskCPF} className={inputClass} /></Field>
                    <Field label="RG"><MaskedInput value={personal.rg ?? ''} onChange={(v) => setPe('rg', v)} mask={maskRG} className={inputClass} /></Field>
                    <Field label="Nascimento"><input type="date" value={personal.birthDate ?? ''} onChange={(e) => setPe('birthDate', clampDateYear(e.target.value, personal.birthDate ?? ''))} className={inputClass} /></Field>
                    <Field label="Estado civil"><input value={personal.maritalStatus ?? ''} onChange={(e) => setPe('maritalStatus', e.target.value)} className={inputClass} /></Field>
                    <Field label="Profissão"><input value={personal.occupation ?? ''} onChange={(e) => setPe('occupation', e.target.value)} className={inputClass} /></Field>
                    <Field label="Nacionalidade"><input value={personal.nationality ?? ''} onChange={(e) => setPe('nationality', e.target.value)} className={inputClass} /></Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="CEP">
                      <MaskedInput value={personal.zipCode ?? ''} onChange={(v) => { setPe('zipCode', v); if (v.replace(/\D/g, '').length === 8) void lookupCep(v); }} mask={maskCEP} className={inputClass} />
                    </Field>
                    <Field label="Número"><input value={personal.addressNumber ?? ''} onChange={(e) => setPe('addressNumber', e.target.value)} className={inputClass} /></Field>
                    <Field label="Logradouro" className="sm:col-span-2"><input value={personal.addressLine ?? ''} onChange={(e) => setPe('addressLine', e.target.value)} className={inputClass} /></Field>
                    <Field label="Complemento"><input value={personal.complement ?? ''} onChange={(e) => setPe('complement', e.target.value)} className={inputClass} /></Field>
                    <Field label="Bairro"><input value={personal.neighborhood ?? ''} onChange={(e) => setPe('neighborhood', e.target.value)} className={inputClass} /></Field>
                    <Field label="Cidade"><input value={personal.city ?? ''} onChange={(e) => setPe('city', e.target.value)} className={inputClass} /></Field>
                    <Field label="UF"><input value={personal.state ?? ''} onChange={(e) => setPe('state', e.target.value)} className={inputClass} /></Field>
                  </div>
                  {cepStatus ? <p className="text-xs text-sand-dark">{cepStatus}</p> : null}
                  <Button type="submit" size="sm" disabled={busy !== null}>{busy === 'personal' ? 'Salvando…' : 'Salvar dados pessoais'}</Button>
                </form>
              )}
            </section>

            <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
              <h2 className="text-base font-semibold text-sand-light">Pasta do candidato</h2>
              <p className="mt-1 text-xs text-sand-dark">
                Pré-proposta, proposta, pareceres da sindicância, certidões e demais documentos — nos modelos da sua Potência, digitalizados.
                Sigilosa: não aparece no portal (nem depois da iniciação) e só a gestão da loja abre.
              </p>
              {locked && item.status !== 'candidate' ? null : (
                <div className="mt-4 space-y-3">
                  <Field label="Título (ex.: Parecer do sindicante, Certidão criminal)">
                    <input value={upload.title} onChange={(e) => setUpload({ ...upload, title: e.target.value })} className={inputClass} />
                  </Field>
                  <input type="file" aria-label="Arquivo" onChange={(e) => setUpload({ ...upload, file: e.target.files?.[0] ?? null })} className="block w-full text-xs text-sand-dark file:mr-3 file:rounded-full file:border file:border-gold/40 file:bg-transparent file:px-4 file:py-2 file:text-xs file:text-gold" />
                  <Button size="sm" disabled={busy !== null || !upload.file} onClick={() => void uploadDocument()}>{busy === 'upload' ? 'Enviando…' : 'Guardar na pasta'}</Button>
                </div>
              )}
              <ul className="mt-5 divide-y divide-white/5">
                {documents.length === 0 ? <li className="text-sm text-sand-dark">Nenhum documento na pasta.</li> : documents.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-sand-light">{d.title}</p>
                      <p className="text-xs text-sand-dark">{new Date(d.createdAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}{d.fileName && d.fileName !== d.title ? ` · ${d.fileName}` : ''}</p>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <a href={`/api/documents/${d.id}/download`} target="_blank" rel="noreferrer" className="text-gold hover:text-gold-light">Abrir</a>
                      <button type="button" disabled={busy !== null} onClick={() => void removeDocument(d)} className="text-rose-300 hover:text-rose-200">Remover</button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
              <h2 className="text-base font-semibold text-sand-light">Financeiro</h2>
              <p className="mt-1 text-xs text-sand-dark">
                Taxa de iniciação e demais valores: a Tesouraria lança em <strong className="text-sand">Contas</strong> (ou emite em Cobranças) escolhendo
                {' '}<strong className="text-sand">{item.name}</strong> como sacado — igual a qualquer obreiro. Com o acesso liberado, o candidato vê e paga pelo portal.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function Stage({ n, title, hint, children }: { n: number; title: string; hint: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
      <h2 className="text-base font-semibold text-sand-light"><span className="mr-2 text-gold">{n}.</span>{title}</h2>
      <p className="mt-1 text-xs text-sand-dark">{hint}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}
