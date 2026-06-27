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
