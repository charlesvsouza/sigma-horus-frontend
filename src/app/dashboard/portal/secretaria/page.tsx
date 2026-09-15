'use client';

import { useEffect, useMemo, useState } from 'react';
import { SESSION_TYPE_LABEL } from '@/lib/status-labels';

interface SessionItem {
  id: string;
  title: string;
  date: string;
  type: string;
  grade: string | null;
  agenda: string | null;
  minutes: string | null;
  convocationSentAt: string | null;
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_LABELS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function SecretariaPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selected, setSelected] = useState<SessionItem | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/portal/agenda');
      const data = await res.json();
      setSessions(data.items ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const now = new Date();
  const upcoming = useMemo(() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return sessions.filter((s) => new Date(s.date) >= today).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);
  const next = upcoming[0] ?? null;

  const weeks = useMemo(() => {
    const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(firstOfMonth);
    start.setDate(start.getDate() - start.getDay()); // volta até domingo
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [cursor]);

  const sessionsOn = (day: Date) => sessions.filter((s) => sameDay(new Date(s.date), day));

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Secretaria</h1>
          <p className="mt-1 text-sm text-sand-dark">Agenda de sessões, ordem do dia e balaustres.</p>
        </div>

        {next ? (
          <section className="rounded-xl border border-gold/30 bg-gold/[6%] p-6">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-gold">Próxima convocação</p>
            <h2 className="mt-2 text-lg font-semibold text-sand-light">{next.title}</h2>
            <p className="mt-1 text-sm text-sand">
              {new Date(next.date).toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' })} · {SESSION_TYPE_LABEL[next.type] ?? next.type}
            </p>
            {next.agenda ? (
              <div className="mt-3 rounded-lg border border-white/[6%] bg-sigma-blue-deep/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-sand-dark">Ordem do dia</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-sand">{next.agenda}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-sand-dark">Ordem do dia ainda não divulgada.</p>
            )}
          </section>
        ) : !loading ? (
          <p className="text-sm text-sand-dark">Nenhuma sessão futura agendada.</p>
        ) : null}

        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))} className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-sand-dark hover:text-sand-light">← Mês anterior</button>
            <h2 className="text-base font-semibold text-sand-light">{MONTH_LABELS[cursor.getMonth()]} de {cursor.getFullYear()}</h2>
            <button type="button" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))} className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-sand-dark hover:text-sand-light">Mês seguinte →</button>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-sand-dark">
            {WEEKDAY_LABELS.map((w) => <div key={w} className="py-1">{w}</div>)}
          </div>
          <div className="mt-1 space-y-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.map((day) => {
                  const inMonth = day.getMonth() === cursor.getMonth();
                  const items = sessionsOn(day);
                  const isToday = sameDay(day, now);
                  return (
                    <div
                      key={day.toISOString()}
                      className={`min-h-[72px] rounded-lg border p-1.5 text-left ${inMonth ? 'border-white/[6%] bg-sigma-blue-deep/40' : 'border-white/[3%] bg-transparent opacity-40'} ${isToday ? 'ring-1 ring-gold/50' : ''}`}
                    >
                      <p className={`text-[11px] ${inMonth ? 'text-sand-dark' : 'text-sand-dark/50'}`}>{day.getDate()}</p>
                      <div className="mt-1 space-y-1">
                        {items.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSelected(s)}
                            className="block w-full truncate rounded bg-gold/15 px-1.5 py-0.5 text-left text-[11px] font-medium text-gold hover:bg-gold/25"
                            title={s.title}
                          >
                            {new Date(s.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} {s.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        {selected ? (
          <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-sand-light">{selected.title}</h2>
                <p className="mt-1 text-sm text-sand-dark">
                  {new Date(selected.date).toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' })} · {SESSION_TYPE_LABEL[selected.type] ?? selected.type}
                </p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-xs text-sand-dark hover:text-sand-light">Fechar</button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gold">Ordem do dia</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-sand">{selected.agenda || 'Não divulgada.'}</p>
              </div>
              <div className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gold">Balaustre / Ata</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-sand">{selected.minutes || 'Ainda não publicado.'}</p>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
