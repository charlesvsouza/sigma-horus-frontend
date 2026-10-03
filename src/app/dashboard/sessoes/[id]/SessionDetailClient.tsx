'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SESSION_TYPE_LABEL } from '@/lib/status-labels';
import { toBRDateTimeLocal } from '@/lib/br-time';
import { degreesLabel } from '@/lib/session-convocation';
import { Alert, Button, Field, inputClass, useConfirm } from '@/components/ui';
import { SessionDegreePicker } from '@/components/session-degree-picker';
import { minutesDegreeLabel } from '@/lib/session-minutes';
import { ConvocationPanel } from './ConvocationPanel';
import { VisitorsPanel, type SessionVisit } from './VisitorsPanel';

interface Member { id: string; name: string; }
interface SessionInfo {
  id: string; title: string; date: string; endDate?: string | null; type: string; degrees: number[];
  agenda?: string | null; minutesDegrees: number[]; minutesFiles: { degree: number; fileName: string }[];
  convocationSentAt?: string | null; convocationSentText: string | null; convocationCurrentText: string; convocationChanged: boolean;
  locked: boolean; lockedAt?: string | null;
}

const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

export default function SessionDetailClient({
  session,
  members,
  visits,
  initialAttendance,
  role,
}: {
  session: SessionInfo;
  members: Member[];
  visits: SessionVisit[];
  initialAttendance: Record<string, string>;
  role: string;
}) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>(initialAttendance);
  const [agenda, setAgenda] = useState(session.agenda ?? '');
  const [savedAgenda, setSavedAgenda] = useState(session.agenda ?? '');
  const [minutesFiles, setMinutesFiles] = useState(session.minutesFiles);
  const [savingAgenda, setSavingAgenda] = useState(false);
  const [uploadingMinutes, setUploadingMinutes] = useState<number | null>(null); // grau em envio/remoção
  const [locked, setLocked] = useState(session.locked);
  const [lockedAt, setLockedAt] = useState(session.lockedAt ?? null);
  const [lockBusy, setLockBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  // Edição dos dados da sessão (título, horário, tipo, graus).
  const [editing, setEditing] = useState(false);
  const [savingData, setSavingData] = useState(false);
  const [dataForm, setDataForm] = useState(() => formFrom(session));

  const canUnlock = role === 'admin' || role === 'venerable';
  const endDate = session.endDate ? new Date(session.endDate) : null;
  const sessionEnded = !endDate || new Date() >= endDate;
  const convoked = !!session.convocationSentAt;
  const agendaDirty = agenda !== savedAgenda;
  const blockedReason = agendaDirty
    ? 'A ordem do dia foi editada e não foi salva. Salve antes de convocar.'
    : editing
      ? 'Salve ou cancele a edição dos dados da sessão antes de convocar.'
      : null;

  function formFrom(s: SessionInfo) {
    return { title: s.title, date: toBRDateTimeLocal(s.date), endDate: s.endDate ? toBRDateTimeLocal(s.endDate) : '', type: s.type, degrees: s.degrees };
  }

  /** Depois de convocada, qualquer alteração deixa os irmãos com a versão antiga — avisa antes. */
  async function confirmChangeAfterConvocation(what: string): Promise<boolean> {
    if (!convoked) return true;
    return askConfirm({
      title: 'Sessão já convocada',
      message: `A convocação foi enviada em ${fmtDateTime(session.convocationSentAt!)}. Ao salvar ${what}, os irmãos ficam com a versão antiga até você enviar a retificação (o sistema mostra a diferença e prepara a mensagem).`,
      confirmLabel: 'Salvar mesmo assim',
    });
  }

  async function toggleLock() {
    const willLock = !locked;
    if (!willLock && !(await askConfirm({
      title: 'Destrancar sessão',
      message: 'Destranca a sessão para permitir edição de novo (agenda, presença, balaustre). Confirma?',
      confirmLabel: 'Destrancar',
    }))) return;

    setLockBusy(true);
    setMessage(null);
    const res = await fetch(`/api/sessions/${session.id}/${willLock ? 'lock' : 'unlock'}`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setLockBusy(false);
    if (res.ok) {
      setLocked(willLock);
      setLockedAt(willLock ? new Date().toISOString() : null);
      setMessage({ kind: 'ok', text: willLock ? 'Sessão trancada.' : 'Sessão destrancada.' });
    } else {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao alterar a trava da sessão.' });
    }
  }

  async function saveData() {
    if (!dataForm.title.trim()) { setMessage({ kind: 'error', text: 'Título é obrigatório.' }); return; }
    if (dataForm.degrees.length === 0) { setMessage({ kind: 'error', text: 'Marque ao menos um grau trabalhado na sessão.' }); return; }
    if (!(await confirmChangeAfterConvocation('os dados da sessão'))) return;
    setSavingData(true);
    setMessage(null);
    const res = await fetch(`/api/sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: dataForm.title, date: dataForm.date, endDate: dataForm.endDate || null, type: dataForm.type, degrees: dataForm.degrees }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingData(false);
    if (res.ok) {
      setEditing(false);
      setMessage({ kind: 'ok', text: convoked ? 'Dados salvos. Envie a retificação da convocação.' : 'Dados da sessão salvos.' });
      router.refresh();
    } else {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao salvar os dados da sessão.' });
    }
  }

  async function saveAgenda() {
    if (!(await confirmChangeAfterConvocation('a ordem do dia'))) return;
    setSavingAgenda(true);
    setMessage(null);
    const res = await fetch(`/api/sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agenda }),
    });
    setSavingAgenda(false);
    if (res.ok) {
      setSavedAgenda(agenda);
      setMessage({ kind: 'ok', text: convoked ? 'Ordem do dia salva. Envie a retificação da convocação.' : 'Ordem do dia salva.' });
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao salvar.' });
    }
  }

  async function uploadMinutes(degree: number, file: File) {
    setUploadingMinutes(degree);
    setMessage(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('degree', String(degree));
    const res = await fetch(`/api/sessions/${session.id}/minutes`, { method: 'POST', body: formData });
    const data = await res.json().catch(() => ({}));
    setUploadingMinutes(null);
    if (res.ok) {
      setMinutesFiles((cur) => [...cur.filter((m) => m.degree !== degree), { degree, fileName: data.fileName ?? file.name }].sort((x, y) => x.degree - y.degree));
      setMessage({ kind: 'ok', text: data.locked ? `Balaustre do ${minutesDegreeLabel(degree)} enviado. Todos os graus têm balaustre: a sessão foi trancada.` : `Balaustre do ${minutesDegreeLabel(degree)} enviado.` });
      router.refresh();
    } else {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao enviar o balaustre.' });
    }
  }

  async function removeMinutes(degree: number) {
    if (!(await askConfirm({ title: 'Remover balaustre', message: `Remove o arquivo do balaustre do ${minutesDegreeLabel(degree)} desta sessão.`, confirmLabel: 'Remover', intent: 'danger' }))) return;
    setUploadingMinutes(degree);
    setMessage(null);
    const res = await fetch(`/api/sessions/${session.id}/minutes?degree=${degree}`, { method: 'DELETE' });
    setUploadingMinutes(null);
    if (res.ok) {
      setMinutesFiles((cur) => cur.filter((m) => m.degree !== degree));
      setMessage({ kind: 'ok', text: 'Balaustre removido.' });
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao remover.' });
    }
  }

  async function toggleAttendance(memberId: string) {
    if (!sessionEnded || locked) return;
    const current = attendanceMap[memberId];
    const nextStatus = current === 'present' ? 'absent' : 'present';
    setAttendanceMap((prev) => ({ ...prev, [memberId]: nextStatus }));
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id, memberId, status: nextStatus }),
    });
    if (!res.ok) {
      setAttendanceMap((prev) => ({ ...prev, [memberId]: current ?? 'unmarked' }));
      const data = await res.json().catch(() => ({}));
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao marcar presença.' });
    }
  }

  const degrees = degreesLabel(session.degrees);

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-sand-light">
              {session.title}
              {locked ? <span className="ml-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300 align-middle">🔒 Trancada</span> : null}
            </h1>
            <p className="mt-1 text-sm text-sand-dark">
              {fmtDateTime(session.date)}
              {endDate ? ` – ${fmtDateTime(session.endDate!)}` : ''}
              {' • '}{SESSION_TYPE_LABEL[session.type] ?? session.type}
              {degrees ? ` • Graus: ${degrees}` : ' • Graus não marcados'}
            </p>
            {locked && lockedAt ? (
              <p className="mt-1 text-xs text-sand-dark/70">Trancada em {new Date(lockedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} — protege os registros contra edição.</p>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            {!locked ? (
              <button type="button" onClick={() => void toggleLock()} disabled={lockBusy} className="text-sm text-sand-dark transition hover:text-sand-light disabled:opacity-40">
                {lockBusy ? 'Trancando…' : '🔒 Trancar sessão'}
              </button>
            ) : canUnlock ? (
              <button type="button" onClick={() => void toggleLock()} disabled={lockBusy} className="text-sm text-gold/80 transition hover:text-gold disabled:opacity-40">
                {lockBusy ? 'Destrancando…' : '🔓 Destrancar sessão'}
              </button>
            ) : null}
            <button onClick={() => router.push('/dashboard/sessoes')} className="text-sm text-gold hover:text-gold-light">Voltar</button>
          </div>
        </div>

        {message ? <Alert intent={message.kind === 'ok' ? 'ok' : 'danger'}>{message.text}</Alert> : null}

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-sand-light">Dados da sessão</h2>
              <p className="mt-1 text-xs text-sand-dark">Título, horário, tipo e graus trabalhados — é daqui que sai o texto da convocação.</p>
            </div>
            {!editing ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => { setDataForm(formFrom(session)); setEditing(true); }} disabled={locked}>Editar</Button>
            ) : null}
          </div>
          {editing ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Título da sessão" className="md:col-span-2">
                  <input value={dataForm.title} onChange={(e) => setDataForm({ ...dataForm, title: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Início">
                  <input type="datetime-local" value={dataForm.date} onChange={(e) => setDataForm({ ...dataForm, date: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Término">
                  <input type="datetime-local" value={dataForm.endDate} onChange={(e) => setDataForm({ ...dataForm, endDate: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Tipo de sessão">
                  <select value={dataForm.type} onChange={(e) => setDataForm({ ...dataForm, type: e.target.value })} className={inputClass}>
                    {Object.entries(SESSION_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
              </div>
              <SessionDegreePicker value={dataForm.degrees} onChange={(d) => setDataForm({ ...dataForm, degrees: d })} />
              <div className="flex gap-2">
                <Button type="button" onClick={() => void saveData()} disabled={savingData}>{savingData ? 'Salvando…' : 'Salvar dados'}</Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={savingData}>Cancelar</Button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Impressos da sessão</h2>
          <p className="mt-1 text-xs text-sand-dark">Para levar à sessão: o livro com os convocados para assinar e a lista em branco para os irmãos visitantes.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={`/dashboard/sessoes/${session.id}/livro`} className="inline-flex items-center rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-gold/80 transition hover:border-gold/60 hover:text-gold">Livro de presença</Link>
            <Link href={`/dashboard/sessoes/${session.id}/lista-visitantes`} className="inline-flex items-center rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-gold/80 transition hover:border-gold/60 hover:text-gold">Lista de visitantes (em branco)</Link>
            {visits.length > 0 ? (
              <Link href={`/dashboard/sessoes/${session.id}/lista-visitantes?preenchida=1`} className="inline-flex items-center rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-gold/80 transition hover:border-gold/60 hover:text-gold">Lista de visitantes (preenchida, para arquivo)</Link>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <ConvocationPanel
            sessionId={session.id}
            sentAt={session.convocationSentAt ?? null}
            changed={session.convocationChanged}
            sentText={session.convocationSentText}
            currentText={session.convocationCurrentText}
            blockedReason={blockedReason}
            onSent={() => router.refresh()}
          />

          <div className="mt-6 border-t border-white/5 pt-5">
            <label className="text-xs font-semibold uppercase tracking-wide text-sand-dark">Ordem do dia (visível ao obreiro e enviada na convocação)</label>
            <textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} disabled={locked} className={`${inputClass} mt-2 disabled:opacity-50`} rows={5} placeholder="1. Abertura dos trabalhos em grau de Aprendiz&#10;2. Leitura do balaustre anterior&#10;3. ..." />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button type="button" onClick={() => void saveAgenda()} disabled={savingAgenda || locked || !agendaDirty}>{savingAgenda ? 'Salvando…' : 'Salvar ordem do dia'}</Button>
              {agendaDirty ? <span className="text-xs text-amber-300">Alterações não salvas.</span> : null}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <VisitorsPanel sessionId={session.id} visits={visits} />
        </section>

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Balaustre / Ata</h2>
          <p className="mt-1 text-xs text-sand-dark">
            Importe o balaustre em PDF ou Word — não é digitado no sistema. {session.minutesDegrees.length > 1
              ? 'A sessão trabalhou mais de um grau: envie um balaustre para cada grau. Cada irmão baixa o do seu grau e o dos graus inferiores (Secretaria, no portal).'
              : 'Depois de enviado, qualquer obreiro pode baixá-lo ao revisitar esta sessão (Secretaria, no portal).'}
            {session.minutesDegrees.length > 1 ? ' Quando todos os graus tiverem balaustre, a sessão é trancada automaticamente.' : ''}
          </p>
          <div className="mt-4 space-y-3">
            {session.minutesDegrees.map((degree) => {
              const file = minutesFiles.find((m) => m.degree === degree);
              const busy = uploadingMinutes === degree;
              return (
                <div key={degree} className="flex flex-wrap items-center gap-3 rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-3">
                  {session.minutesDegrees.length > 1 ? <span className="min-w-44 text-sm font-medium text-sand-light">{minutesDegreeLabel(degree)}</span> : null}
                  {file ? (
                    <a href={`/api/sessions/${session.id}/minutes/download?degree=${degree}`} className="rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-gold/80 transition-colors hover:border-gold/60 hover:text-gold">
                      Baixar {file.fileName}
                    </a>
                  ) : (
                    <span className="text-sm text-sand-dark">Ainda não enviado.</span>
                  )}
                  <label className={`cursor-pointer rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-sand transition-colors hover:border-white/25 ${locked ? 'cursor-not-allowed opacity-40' : ''}`}>
                    {busy ? 'Enviando…' : file ? 'Trocar arquivo' : 'Enviar arquivo'}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      disabled={uploadingMinutes !== null || locked}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadMinutes(degree, f); e.target.value = ''; }}
                    />
                  </label>
                  {file ? (
                    <button type="button" onClick={() => void removeMinutes(degree)} disabled={uploadingMinutes !== null || locked} className="text-sm text-rose-300/70 transition hover:text-rose-300 disabled:opacity-40">Remover</button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Registrar presença</h2>
          <p className="mt-1 text-sm text-sand-dark">
            {locked
              ? 'Sessão trancada — destranque para alterar a presença.'
              : sessionEnded
              ? 'Clique no membro para marcar presença/ausência.'
              : `Disponível após o término da sessão${endDate ? `, em ${fmtDateTime(session.endDate!)}` : ''}.`}
          </p>
          <div className="mt-5 space-y-2">
            {members.map((member) => {
              const status = attendanceMap[member.id] ?? 'unmarked';
              return (
                <button
                  key={member.id}
                  onClick={() => toggleAttendance(member.id)}
                  disabled={!sessionEnded || locked}
                  className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    status === 'present'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                      : status === 'absent'
                      ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                      : 'border-white/5 bg-sigma-blue-deep/50 text-sand hover:border-white/8'
                  }`}
                >
                  <span>{member.name}</span>
                  <span className="text-xs">
                    {status === 'present' ? 'Presente' : status === 'absent' ? 'Ausente' : 'Não marcado'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
