'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Member { id: string; name: string; }
interface SessionInfo { id: string; title: string; date: string; type: string; grade?: string | null; }

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
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>(initialAttendance);

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
              {new Date(session.date).toLocaleDateString('pt-BR')} • {session.type}
              {session.grade ? ` • Grau: ${session.grade}` : ''}
            </p>
          </div>
          <button onClick={() => router.push('/dashboard/sessoes')} className="text-sm text-gold hover:text-gold-light">Voltar</button>
        </div>

        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
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
                      : 'border-white/[5%] bg-sigma-blue-deep/50 text-sand hover:border-white/[8%]'
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
