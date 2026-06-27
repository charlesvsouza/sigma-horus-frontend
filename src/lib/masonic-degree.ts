// Lógica de grau maçônico, compartilhada por Membros e Portal (puro, sem deps).
//
// Situação simbólica é DERIVADA dos marcos de evolução (não se digita):
//   tem instalação → Mestre Instalado
//   tem exaltação  → Mestre
//   tem elevação   → Companheiro
//   tem iniciação  → Aprendiz
// Grau Filosófico (REAA 4–33) é opcional e fica em `currentDegree`.

export interface DegreeSource {
  initiationDate?: string | Date | null;
  elevationDate?: string | Date | null;
  exaltationDate?: string | Date | null;
  installationDate?: string | Date | null;
  currentDegree?: string | null; // grau filosófico (4–33) ou legado textual
  gradeName?: string | null;     // legado
}

export type SymbolicSituation = 'Aprendiz' | 'Companheiro' | 'Mestre' | 'Mestre Instalado';

export function symbolicSituation(m: DegreeSource): SymbolicSituation | null {
  if (m.installationDate) return 'Mestre Instalado';
  if (m.exaltationDate) return 'Mestre';
  if (m.elevationDate) return 'Companheiro';
  if (m.initiationDate) return 'Aprendiz';
  return null;
}

// Graus filosóficos válidos do REAA.
export const PHILOSOPHICAL_DEGREES = Array.from({ length: 30 }, (_, i) => i + 4); // 4..33

// Extrai o grau filosófico numérico (4–33) de `currentDegree`, se houver.
export function philosophicalDegree(m: DegreeSource): number | null {
  const raw = (m.currentDegree ?? '').trim();
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 4 && n <= 33 ? n : null;
}

// Rótulo curto para listas: grau filosófico se houver, senão a situação simbólica.
export function degreeShort(m: DegreeSource): string {
  const phil = philosophicalDegree(m);
  if (phil) return `Grau ${phil}`;
  const sit = symbolicSituation(m);
  if (sit) return sit;
  // Fallback p/ dados legados (currentDegree textual ou gradeName).
  return (m.currentDegree && !/^\d+$/.test(m.currentDegree) ? m.currentDegree : null) || m.gradeName || '—';
}

// ---------- Tempo de Ordem (antiguidade maçônica) ----------
// Tempo desde a iniciação. Base para mensagens automáticas de aniversário de
// iniciação e jubileus (5, 10, 25 anos…) — ver Fase 7 (Comunicação).

const toDate = (d?: string | Date | null): Date | null => {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

// Anos completos desde a iniciação até a data de referência (default: hoje).
export function yearsInOrder(initiationDate?: string | Date | null, ref: Date = new Date()): number | null {
  const start = toDate(initiationDate);
  if (!start || start > ref) return null;
  let years = ref.getFullYear() - start.getFullYear();
  const m = ref.getMonth() - start.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < start.getDate())) years--;
  return years < 0 ? null : years;
}

// Rótulo legível do Tempo de Ordem, ex.: "12 anos e 3 meses".
export function timeInOrderLabel(initiationDate?: string | Date | null, ref: Date = new Date()): string | null {
  const start = toDate(initiationDate);
  if (!start || start > ref) return null;
  let months = (ref.getFullYear() - start.getFullYear()) * 12 + (ref.getMonth() - start.getMonth());
  if (ref.getDate() < start.getDate()) months--;
  if (months < 0) return null;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0 && rem === 0) return 'menos de 1 mês';
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'ano' : 'anos'}`);
  if (rem > 0) parts.push(`${rem} ${rem === 1 ? 'mês' : 'meses'}`);
  return parts.join(' e ');
}

// Marcos comemorativos de tempo de Ordem (anos). Base para os disparos da Fase 7.
export const TENURE_MILESTONES = [1, 5, 10, 15, 20, 25, 30, 40, 50, 60];

// Se a próxima efeméride de iniciação (no ano de `ref`) cair num marco, retorna
// o nº de anos do marco; senão null. Usado pelas mensagens automáticas.
export function tenureMilestoneForYear(initiationDate?: string | Date | null, ref: Date = new Date()): number | null {
  const start = toDate(initiationDate);
  if (!start) return null;
  const years = ref.getFullYear() - start.getFullYear();
  return TENURE_MILESTONES.includes(years) ? years : null;
}
