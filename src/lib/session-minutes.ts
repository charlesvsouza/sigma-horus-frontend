// Balaustre da sessão por grau (regras puras). A sessão que sobe aos três graus pode ter até três
// balaustres — um para cada grau trabalhado. Só vê/baixa quem tem o grau do balaustre ou superior;
// quem envia documentos (Administrador, Venerável, Secretário) vê todos; o candidato nenhum.

import { DEGREE_NAME, sessionDegrees } from './session-convocation';
import { degreeAllowsDocument, type DocumentViewer } from './documents';

/** Graus em que a sessão pode ter balaustre: os graus trabalhados (ou o 1º, se a sessão não registra graus). */
export function minutesDegrees(session: { degrees?: number[] | null; grade?: string | null }): number[] {
  const d = sessionDegrees(session);
  return d.length > 0 ? d : [1];
}

export const minutesDegreeLabel = (degree: number) => `${degree}º grau (${DEGREE_NAME[degree] ?? '—'})`;

/** Grau do arquivo que está sendo enviado: o informado, ou o único possível; erro se não for um grau da sessão. */
export function resolveMinutesDegree(
  session: { degrees?: number[] | null; grade?: string | null },
  raw: unknown,
): { ok: true; degree: number } | { ok: false; error: string } {
  const allowed = minutesDegrees(session);
  if (raw === undefined || raw === null || raw === '') {
    if (allowed.length === 1) return { ok: true, degree: allowed[0] };
    return { ok: false, error: 'Informe de qual grau é este balaustre.' };
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || !allowed.includes(n)) {
    return { ok: false, error: `Esta sessão trabalha ${allowed.length === 1 ? 'só o' : 'os'} grau${allowed.length === 1 ? '' : 's'} ${allowed.join(', ')}; escolha um deles.` };
  }
  return { ok: true, degree: n };
}

/** A sessão já tem o balaustre de TODOS os graus trabalhados? (aí é trancada automaticamente) */
export function allMinutesUploaded(session: { degrees?: number[] | null; grade?: string | null }, uploadedDegrees: number[]): boolean {
  const have = new Set(uploadedDegrees);
  return minutesDegrees(session).every((d) => have.has(d));
}

const DEGREE_KEY = ['apprentice', 'fellow', 'master'];

/** O espectador pode ver/baixar o balaustre deste grau? */
export function canViewMinutes(degree: number, viewer: DocumentViewer): boolean {
  if (viewer.isCandidate) return false;
  if (viewer.seesAll) return true;
  return degreeAllowsDocument(DEGREE_KEY[degree - 1] ?? 'installed', viewer.rank);
}
