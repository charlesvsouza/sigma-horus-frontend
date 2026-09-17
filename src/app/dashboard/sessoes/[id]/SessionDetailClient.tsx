'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SESSION_TYPE_LABEL } from '@/lib/status-labels';
import { Alert, Button, inputClass, useConfirm } from '@/components/ui';

interface Member { id: string; name: string; }
interface SessionInfo {
  id: string; title: string; date: string; type: string; grade?: string | null;
  agenda?: string | null; minutes?: string | null; convocationSentAt?: string | null;
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
  const [minutes, setMinutes] = useState(session.minutes ?? '');
  const [savingAgenda, setSavingAgenda] = useState(false);
  const [sendingConvocation, setSendingConvocation] = useState(false);
  const [convocationSentAt, setConvocationSentAt] = useState(session.convocationSentAt);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function saveAgenda() {
    setSavingAgenda(true);
    setMessage(null);
    const res = await fetch(`/api/sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agenda, minutes }),
    });
    setSavingAgenda(false);
    if (res.ok) {
      setMessage({ kind: 'ok', text: 'Ordem do dia e balaustre salvos.' });
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao salvar.' });
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
    const current = attendanceMap[memberId];
    const nextStatus = current === 'present' ? 'absent' : 'present';
    setAttendanceMap((prev) => ({ ...prev, [memberId]: nextStatus }));
    await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id, memberId, status: nextStatus }),
    });
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-sand-light">{session.title}</h1>
            <p className="mt-1 text-sm text-sand-dark">
              {new Date(session.date).toLocaleDateString('pt-BR')} • {SESSION_TYPE_LABEL[session.type] ?? session.type}
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
                {convocationSentAt ? `Enviada em ${new Date(convocationSentAt).toLocaleString('pt-BR')}` : 'Ainda não enviada'} — vai por e-mail a todos os obreiros ativos, com data, hora e ordem do dia.
              </p>
            </div>
            <Button type="button" onClick={sendConvocation} disabled={sendingConvocation}>
              {sendingConvocation ? 'Enviando…' : convocationSentAt ? 'Reenviar convocação' : 'Enviar convocação'}
            </Button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-sand-dark">Ordem do dia (visível ao obreiro)</label>
              <textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} className={`${inputClass} mt-2`} rows={5} placeholder="1. Abertura dos trabalhos&#10;2. Leitura do balaustre anterior&#10;3. ..." />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-sand-dark">Balaustre / Ata (visível ao obreiro após publicado)</label>
              <textarea value={minutes} onChange={(e) => setMinutes(e.target.value)} className={`${inputClass} mt-2`} rows={5} placeholder="Preencha após a sessão." />
            </div>
          </div>
          <Button type="button" onClick={saveAgenda} disabled={savingAgenda} className="mt-4">{savingAgenda ? 'Salvando…' : 'Salvar ordem do dia e balaustre'}</Button>
        </section>

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Registrar presença</h2>
          <p className="mt-1 text-sm text-sand-dark">Clique no membro para marcar presença/ausência.</p>
          <div className="mt-5 space-y-2">
            {members.map((member) => {
              const status = attendanceMap[member.id] ?? 'unmarked';
              return (
                <button
                  key={member.id}
                  onClick={() => toggleAttendance(member.id)}
                  className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
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
