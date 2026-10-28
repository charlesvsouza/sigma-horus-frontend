'use client';

import { ReactNode } from 'react';
import { signOut } from 'next-auth/react';

// Tela única de uma loja sem assinatura vigente: só a escolha do plano e o Sair. Sem menu, para não deixar
// ninguém navegando por telas que o servidor não vai mostrar.
export default function SubscriptionLockedShell({ lodgeName, userName, children }: { lodgeName: string; userName: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-sigma-blue-deep">
      <header className="flex items-center justify-between gap-4 border-b border-white/6 px-5 py-3 lg:px-8">
        <div className="min-w-0">
          <p className="text-[0.6rem] uppercase tracking-[0.3em] text-gold/60">Sigma Horus</p>
          <p className="truncate text-sm font-medium text-sand-light">{lodgeName}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-sand-dark sm:block">{userName}</span>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="rounded-full border border-white/8 px-3.5 py-1.5 text-xs text-sand/60 transition hover:border-rose-500/30 hover:text-rose-300"
          >
            Sair
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
