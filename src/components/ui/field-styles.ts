// Classe canônica de campo (input/select/textarea) — fonte ÚNICA do design system.
// Usada pelo componente <Input> e por grids densos que usam <input>/<select> direto
// (ex.: formulário de membro), evitando deriva de estilo entre telas.

export const inputBase =
  'w-full rounded-lg bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 ease-out disabled:opacity-40 disabled:cursor-not-allowed';

export const inputBorder = 'border border-white/[8%] focus:border-gold/50 focus:ring-2 focus:ring-gold/20';
export const inputBorderError = 'border border-rose-500/50 ring-2 ring-rose-500/20';

/** Campo padrão (estado normal). */
export const inputClass = `${inputBase} ${inputBorder}`;
