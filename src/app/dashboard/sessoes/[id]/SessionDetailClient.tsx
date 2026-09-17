'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SESSION_TYPE_LABEL } from '@/lib/status-labels';
import { Alert, Button, inputClass, useConfirm } from '@/components/ui';

interface Member { id: string; name: string; }
interface SessionInfo {
  id: string; title: string; date: string; endDate?: string | null; type: string; grade?: string | null;
  agenda?: string | null; minutesFileName?: string | null; convocationSentAt?: string | null;
}

export default function SessionDetailClient({
  session,
  members,
  initialAttendance,
}: {
  session: SessionInfo;
  members: Member[];
  initialAttendance: Record<string, string>;
}) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>(initialAttendance);
  const [agenda, setAgenda] = useState(session.agenda ?? '');
  const [minutesFileName, setMinutesFileName] = useState(session.minutesFileName ?? null);
  const [savingAgenda, setSavingAgenda] = useState(false);
  const [uploadingMinutes, setUploadingMinutes] = useState(false);
  const [sendingConvocation, setSendingConvocation] = useState(false);
  const [convocationSentAt, setConvocationSentAt] = useState(session.convocationSentAt);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const endDate = session.endDate ? new Date(session.endDate) : null;
  const sessionEnded = !endDate || new Date() >= endDate;

  async function saveAgenda() {
    setSavingAgenda(true);
    setMessage(null);
    const res = await fetch(`/api/sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agenda }),
    });
    setSavingAgenda(false);
    if (res.ok) {
      setMessage({ kind: 'ok', text: 'Ordem do dia salva.' });
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao salvar.' });
    }
  }

  async function uploadMinutes(file: File) {
    setUploadingMinutes(true);
    setMessage(null);
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`/api/sessions/${session.id}/minutes`, { method: 'POST', body: formData });
    const data = await res.json().catch(() => ({}));
    setUploadingMinutes(false);
    if (res.ok) {
      setMinutesFileName(data.fileName ?? file.name);
      setMessage({ kind: 'ok', text: 'Balaustre enviado.' });
    } else {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao enviar o balaustre.' });
    }
  }

  async function removeMinutes() {
    if (!(await askConfirm({ title: 'Remover balaustre', message: 'Remove o arquivo do balaustre desta sessão.', confirmLabel: 'Remover', intent: 'danger' }))) return;
    setUploadingMinutes(true);
    setMessage(null);
    const res = await fetch(`/api/sessions/${session.id}/minutes`, { method: 'DELETE' });
    setUploadingMinutes(false);
    if (res.ok) {
      setMinutesFileName(null);
      setMessage({ kind: 'ok', text: 'Balaustre removido.' });
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao remover.' });
    }
  }

  async function sendConvocation() {
    const verb = convocationSentAt ? 'reenviar' : 'enviar';
    if (!(await askConfirm({
      title: 'Enviar convocação',
      message: `Deseja ${verb} o chamado desta sessão por e-mail a todos os obreiros ativos?`,
      confirmLabel: 'Enviar',
    }))) return;
    setSendingConvocation(true);
    setMessage(null);
    const res = await fetch(`/api/sessions/${session.id}/convocation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const data = await res.json().catch(() => ({}));
    setSendingConvocation(false);
    if (res.ok) {
      setConvocationSentAt(new Date().toISOString());
      setMessage({ kind: 'ok', text: `Convocação enviada: ${data.stats?.sent ?? 0} enviada(s), ${data.stats?.queued ?? 0} na fila, ${data.stats?.failed ?? 0} falhou(aram).` });
    } else {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao enviar convocação.' });
    }
  }

  async function toggleAttendance(memberId: string) {
    if (!sessionEnded) return;
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

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-sand-light">{session.title}</h1>
            <p className="mt-1 text-sm text-sand-dark">
              {new Date(session.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })}
              {endDate ? ` – ${endDate.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })}` : ''}
              {' • '}{SESSION_TYPE_LABEL[session.type] ?? session.type}
              {session.grade ? ` • Grau: ${session.grade}` : ''}
            </p>
          </div>
          <button onClick={() => router.push('/dashboard/sessoes')} className="text-sm text-gold hover:text-gold-light">Voltar</button>
        </div>

        {message ? <Alert intent={message.kind === 'ok' ? 'ok' : 'danger'}>{message.text}</Alert> : null}

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-sand-light">Convocação (chamado)</h2>
              <p className="mt-1 text-xs text-sand-dark">
                {convocationSentAt ? `Enviada em ${new Date(convocationSentAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : 'Ainda não enviada'} — vai por e-mail a todos os obreiros ativos, com data, hora e ordem do dia.
              </p>
            </div>
            <Button type="button" onClick={sendConvocation} disabled={sendingConvocation}>
              {sendingConvocation ? 'Enviando…' : convocationSentAt ? 'Reenviar convocação' : 'Enviar convocação'}
            </Button>
          </div>

          <div className="mt-5">
            <label className="text-xs font-semibold uppercase tracking-wide text-sand-dark">Ordem do dia (visível ao obreiro)</label>
            <textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} className={`${inputClass} mt-2`} rows={5} placeholder="1. Abertura dos trabalhos&#10;2. Leitura do balaustre anterior&#10;3. ..." />
            <Button type="button" onClick={saveAgenda} disabled={savingAgenda} className="mt-3">{savingAgenda ? 'Salvando…' : 'Salvar ordem do dia'}</Button>
          </div>
        </section>

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Balaustre / Ata</h2>
          <p className="mt-1 text-xs text-sand-dark">
            Importe o balaustre em PDF ou Word — não é digitado no sistema. Depois de enviado, qualquer membro pode
            baixá-lo ao revisitar esta sessão (Secretaria, no portal).
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {minutesFileName ? (
              <a href={`/api/sessions/${session.id}/minutes/download`} className="rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-gold/80 transition-colors hover:border-gold/60 hover:text-gold">
                Baixar {minutesFileName}
              </a>
            ) : (
              <span className="text-sm text-sand-dark">Ainda não enviado.</span>
            )}
            <label className="cursor-pointer rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-sand transition-colors hover:border-white/25">
              {uploadingMinutes ? 'Enviando…' : minutesFileName ? 'Trocar arquivo' : 'Enviar arquivo'}
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                disabled={uploadingMinutes}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadMinutes(f); e.target.value = ''; }}
              />
            </label>
            {minutesFileName ? (
              <button type="button" onClick={() => void removeMinutes()} disabled={uploadingMinutes} className="text-sm text-rose-300/70 transition hover:text-rose-300 disabled:opacity-40">Remover</button>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Registrar presença</h2>
          <p className="mt-1 text-sm text-sand-dark">
            {sessionEnded
              ? 'Clique no membro para marcar presença/ausência.'
              : `Disponível após o término da sessão${endDate ? `, em ${endDate.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })}` : ''}.`}
          </p>
          <div className="mt-5 space-y-2">
            {members.map((member) => {
              const status = attendanceMap[member.id] ?? 'unmarked';
              return (
                <button
                  key={member.id}
                  onClick={() => toggleAttendance(member.id)}
                  disabled={!sessionEnded}
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
