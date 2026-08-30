'use client';

import { useEffect, useState } from 'react';
import { TriangleAlert, X } from 'lucide-react';

const VISIBLE_MS = 10_000;

interface Props {
  daysOverdue: number;
}

// Aviso da regra do Art. 002 (60 dias de mensalidade em aberto): aparece por
// 10s a cada acesso ao dashboard, enquanto o membro logado estiver enquadrado.
// Some sozinho ao expirar o timer; volta a aparecer no próximo acesso porque a
// checagem é recalculada a cada carregamento (dashboard/layout.tsx), não fica
// numa flag de "já vi" salva no navegador — o aviso só deixa de existir quando
// a pendência é paga ou excluída (ver lib/overdue.ts).
export default function Art002Alert({ daysOverdue }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="alert"
      className="fixed right-5 top-5 z-[100] flex max-w-sm items-start gap-3 rounded-xl border border-rose-400/40 bg-rose-600 px-4 py-3.5 text-sm text-white shadow-2xl shadow-rose-950/40"
    >
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">Situação financeira — Art. 002</p>
        <p className="mt-1 text-rose-50">
          Sua mensalidade está em aberto há {daysOverdue} dias, ultrapassando o prazo de 60 dias previsto no
          regimento. Procure o tesoureiro ou o venerável mestre para regularizar.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Fechar aviso"
        className="ml-1 shrink-0 rounded-full p-0.5 text-rose-100 transition hover:bg-rose-500/60 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
