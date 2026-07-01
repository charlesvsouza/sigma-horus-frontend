interface MiniBarProps {
  value: number;
  total: number;
  color?: string;
  label?: string;
}

export function MiniBar({ value, total, color = 'var(--sigma-gold)', label }: MiniBarProps) {
  if (total <= 0) return null;
  const pct = Math.min((value / total) * 100, 100);
  return (
    <div className="flex items-center gap-3">
      {label ? <span className="w-20 text-xs text-sand-dark shrink-0">{label}</span> : null}
      <div className="flex-1 h-2 rounded-full bg-white/[5%] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-24 text-xs tabular-nums text-right text-sand">{value.toFixed(2)}</span>
    </div>
  );
}
