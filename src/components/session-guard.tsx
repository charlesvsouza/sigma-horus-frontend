'use client';

import { signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { ACTIVITY_KEY, isIdle, isNearExpiry, minutesLeft, shouldHeartbeat } from '@/lib/session-idle';

// Expiração da sessão por inatividade (30 min). Fica no painel: mede a atividade (compartilhada entre abas), renova
// a sessão no servidor enquanto a pessoa usa, avisa 2 minutos antes de cair e desconecta ao passar do tempo.
// Também confere a sessão ao voltar para a aba e ao acordar o computador. A seta Voltar do navegador (página vinda do
// cache) já é tratada em DashboardShell, que recarrega a página para o servidor revalidar a sessão.

const LOGIN_EXPIRED = '/login?expirada=1';

function readActivity(): number {
  try {
    const v = Number(localStorage.getItem(ACTIVITY_KEY));
    return Number.isFinite(v) && v > 0 ? v : Date.now();
  } catch {
    return Date.now();
  }
}

function writeActivity(now: number) {
  try { localStorage.setItem(ACTIVITY_KEY, String(now)); } catch { /* sem armazenamento: vale só nesta aba */ }
}

export function SessionGuard() {
  const last = useRef(0);
  const lastBeat = useRef(0);
  const lastWrite = useRef(0);
  const leaving = useRef(false);
  const [warn, setWarn] = useState<number | null>(null);

  useEffect(() => {
    const now0 = Date.now();
    last.current = readActivity();
    lastBeat.current = now0;
    // Ao abrir o painel agora, a pessoa acabou de agir.
    if (isIdle(last.current, now0)) last.current = now0;
    writeActivity(last.current);

    function leave() {
      if (leaving.current) return;
      leaving.current = true;
      void signOut({ callbackUrl: LOGIN_EXPIRED });
    }

    async function sessionAlive(): Promise<boolean> {
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store', credentials: 'same-origin' });
        if (!res.ok) return true; // erro de rede/servidor: não derruba por engano
        const data = await res.json().catch(() => null);
        return Boolean(data?.user);
      } catch {
        return true;
      }
    }

    async function check(renew: boolean) {
      const now = Date.now();
      // A atividade pode ter sido em outra aba.
      last.current = Math.max(last.current, readActivity());
      if (isIdle(last.current, now)) return leave();
      if (renew && shouldHeartbeat(last.current, lastBeat.current, now)) {
        lastBeat.current = now;
        if (!(await sessionAlive())) return leave();
      }
      setWarn(isNearExpiry(last.current, now) ? minutesLeft(last.current, now) : null);
    }

    function activity() {
      const now = Date.now();
      last.current = now;
      setWarn(null);
      if (now - lastWrite.current > 15_000) { lastWrite.current = now; writeActivity(now); }
    }

    // Voltou para a aba ou o computador acordou: confere na hora.
    async function recheck() {
      const now = Date.now();
      last.current = Math.max(last.current, readActivity());
      if (isIdle(last.current, now)) return leave();
      if (!(await sessionAlive())) return leave();
      lastBeat.current = now;
      setWarn(isNearExpiry(last.current, now) ? minutesLeft(last.current, now) : null);
    }
    const onVisible = () => { if (document.visibilityState === 'visible') void recheck(); };

    const events: (keyof WindowEventMap)[] = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove', 'click'];
    for (const ev of events) window.addEventListener(ev, activity, { passive: true });
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    // A cada 30 s: confere o tempo ocioso, mostra o aviso e renova a sessão a cada 5 min enquanto há atividade.
    const timer = window.setInterval(() => void check(true), 30_000);

    return () => {
      for (const ev of events) window.removeEventListener(ev, activity);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.clearInterval(timer);
    };
  }, []);

  if (warn === null) return null;
  return (
    <div role="alert" className="rpt-noprint fixed inset-x-0 bottom-4 z-[100] mx-auto flex w-[min(92vw,34rem)] items-start gap-3 rounded-xl border border-amber-500/40 bg-sigma-blue-deep/95 px-4 py-3 text-sm text-amber-200 shadow-xl">
      <span className="flex-1">Sua sessão vai expirar por inatividade em cerca de {warn} minuto{warn === 1 ? '' : 's'}. Mexa na tela para continuar conectado.</span>
    </div>
  );
}
