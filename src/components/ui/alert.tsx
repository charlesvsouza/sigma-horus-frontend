import { HTMLAttributes } from 'react';

// Alerta/aviso semântico por intent. Centraliza a cor e o contraste (inclusive a
// legibilidade no tema claro, que vem dos overrides de variável em globals.css),
// evitando a regressão de banners montados com classes Tailwind soltas.
export type AlertIntent = 'info' | 'ok' | 'warn' | 'danger';

const INTENTS: Record<AlertIntent, string> = {
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  ok: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  danger: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
};

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  intent?: AlertIntent;
  /** 'card' (padrão, arredondado) ou 'banner' (faixa de topo, sem cantos). */
  variant?: 'card' | 'banner';
}

export function Alert({ intent = 'info', variant = 'card', className = '', children, ...props }: AlertProps) {
  const shape = variant === 'banner'
    ? 'border-b px-6 py-3 text-center'
    : 'rounded-xl border px-4 py-3';
  return (
    <div
      role={intent === 'danger' || intent === 'warn' ? 'alert' : 'status'}
      className={`text-sm ${shape} ${INTENTS[intent]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
