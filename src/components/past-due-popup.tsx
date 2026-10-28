'use client';

import { useCallback, useEffect, useState } from 'react';
import { TriangleAlert, X } from 'lucide-react';

const INTERVAL_MS = 10 * 60 * 1000;
const CHECK_MS = 30 * 1000;
const STORAGE_KEY = 'sigma-past-due-popup-at';

interface Props {
  daysLeft: number;
  endsAt: string;
}

function lastShown(): number {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function markShown() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // sem armazenamento (janela privada): o aviso só repete a cada abertura de tela
  }
}

// Aviso da assinatura da plataforma em atraso (dentro dos 30 dias de tolerância). Só a Diretoria vê (o layout decide):
// aparece ao abrir o painel e volta a cada 10 minutos, enquanto a loja não regularizar. O momento do último aviso fica
// no navegador, para trocar de tela não repetir o aviso antes da hora.
export default function PastDuePopup({ daysLeft, endsAt }: Props) {
  const [visible, setVisible] = useState(false);

  const check = useCallback(() => {
    if (Date.now() - lastShown() >= INTERVAL_MS) {
      markShown();
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    check();
    const timer = setInterval(check, CHECK_MS);
    return () => clearInterval(timer);
  }, [check]);

  if (!visible) return null;

  const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date(endsAt));

  return (
    <div
      role="alertdialog"
      aria-label="Assinatura em atraso"
      className="fixed right-5 top-5 z-[100] flex max-w-sm items-start gap-3 rounded-xl border border-amber-300/50 bg-amber-600 px-4 py-3.5 text-sm text-white shadow-2xl shadow-amber-950/40"
    >
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">Assinatura do Sigma Horus em atraso</p>
        <p className="mt-1 text-amber-50">
          O pagamento da assinatura da loja não foi aprovado. Em {daysLeft} {daysLeft === 1 ? 'dia' : 'dias'} (até {date}) o sistema será
          bloqueado para todos, se o pagamento não for regularizado.
        </p>
        <a href="/dashboard/assinatura" className="mt-2 inline-block font-medium underline hover:text-white">
          Regularizar agora
        </a>
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Fechar aviso"
        className="ml-1 shrink-0 rounded-full p-0.5 text-amber-100 transition hover:bg-amber-500/60 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
