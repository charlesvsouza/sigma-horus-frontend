'use client';

import { DEGREE_NAME, SESSION_DEGREES } from '@/lib/session-convocation';

// Graus trabalhados na sessão (checkbox). A sessão abre no menor marcado e pode subir conforme
// a ordem do dia; a convocação vai a quem já alcançou o menor grau.
export function SessionDegreePicker({ value, onChange, disabled }: { value: number[]; onChange: (degrees: number[]) => void; disabled?: boolean }) {
  function toggle(d: number) {
    onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b));
  }
  const opening = value.length > 0 ? Math.min(...value) : null;
  return (
    <fieldset disabled={disabled}>
      <legend className="text-xs uppercase tracking-wide text-sand-dark/70">Graus trabalhados</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {SESSION_DEGREES.map((d) => (
          <label key={d} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${value.includes(d) ? 'border-gold/50 bg-gold/10 text-sand-light' : 'border-white/10 text-sand'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
            <input type="checkbox" checked={value.includes(d)} onChange={() => toggle(d)} className="accent-gold" />
            {d}º grau — {DEGREE_NAME[d]}
          </label>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-sand-dark">
        {opening === null
          ? 'Marque ao menos um. A sessão abre no menor grau marcado.'
          : opening === 1
            ? 'Abre em Aprendiz: a convocação vai a todos os obreiros ativos.'
            : `Abre em ${DEGREE_NAME[opening]}: a convocação vai a ${opening === 2 ? 'Companheiros e Mestres' : 'Mestres'}.`}
      </p>
    </fieldset>
  );
}
