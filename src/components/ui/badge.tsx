import { HTMLAttributes } from 'react';

type BadgeVariant =
  | 'paid'
  | 'pending'
  | 'overdue'
  | 'billed'
  | 'canceled'
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
  paid:    { container: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/20',    dot: 'bg-emerald-400' },
  success: { container: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/20',    dot: 'bg-emerald-400' },
  pending: { container: 'bg-gold/10 text-gold border-gold/15',                         dot: 'bg-gold' },
  warning: { container: 'bg-gold/10 text-gold border-gold/15',                         dot: 'bg-gold' },
  overdue: { container: 'bg-rose-500/12 text-rose-300 border-rose-500/20',             dot: 'bg-rose-400' },
  error:   { container: 'bg-rose-500/12 text-rose-300 border-rose-500/20',             dot: 'bg-rose-400' },
  billed:  { container: 'bg-sky-500/12 text-sky-200 border-sky-500/20',                dot: 'bg-sky-300' },
  info:    { container: 'bg-sky-500/12 text-sky-200 border-sky-500/20',                dot: 'bg-sky-300' },
  canceled:{ container: 'bg-white/[8%] text-sand-dark border-white/[10%]',             dot: 'bg-sand-dark' },
};

function Badge({ variant = 'info', dot = false, className = '', children, ...props }: BadgeProps) {
  const style = variantStyles[variant];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.container} ${className}`}
      {...props}
    >
      {dot ? <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} /> : null}
      {children}
    </span>
  );
}

export { Badge, type BadgeVariant };
