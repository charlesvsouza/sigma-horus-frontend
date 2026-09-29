import { degreeRank, symbolicSituation, type DegreeSource } from '@/lib/masonic-degree';
import { SESSION_TYPE_LABEL } from '@/lib/status-labels';

// Convocação (chamado) da sessão: graus trabalhados, quem é convocado e o texto enviado.
// A sessão abre no menor grau marcado e pode subir conforme a ordem do dia — por isso a
// convocação vai a quem já alcançou o MENOR grau (sessão que abre em Aprendiz convoca todos).

export const SESSION_DEGREES = [1, 2, 3] as const;
export const DEGREE_NAME: Record<number, string> = { 1: 'Aprendiz', 2: 'Companheiro', 3: 'Mestre' };

/** Lista de graus válida: só 1–3, sem repetição, em ordem. */
export function normalizeDegrees(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const set = new Set<number>();
  for (const v of value) {
    const n = Number(v);
    if (Number.isInteger(n) && n >= 1 && n <= 3) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

/** Sessões antigas guardavam o grau em texto livre ("3", "Mestre", "1º e 2º"): melhor esforço. */
export function legacyGradeDegrees(grade: string | null | undefined): number[] {
  const g = (grade ?? '').toLowerCase();
  if (!g.trim()) return [];
  const found: number[] = [];
  for (const m of g.matchAll(/[1-3]/g)) found.push(Number(m[0]));
  if (g.includes('aprendiz')) found.push(1);
  if (g.includes('companheiro')) found.push(2);
  if (/mestre/.test(g)) found.push(3);
  return normalizeDegrees(found);
}

export function sessionDegrees(session: { degrees?: number[] | null; grade?: string | null }): number[] {
  const own = normalizeDegrees(session.degrees ?? []);
  return own.length > 0 ? own : legacyGradeDegrees(session.grade);
}

/** "Aprendiz", "Aprendiz e Companheiro", "Aprendiz, Companheiro e Mestre"; null sem graus. */
export function degreesLabel(degrees: number[]): string | null {
  const names = normalizeDegrees(degrees).map((d) => DEGREE_NAME[d]);
  if (names.length === 0) return null;
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

/** Grau em que a sessão abre (o menor marcado); sem grau marcado, vale como Aprendiz. */
export function openingDegree(degrees: number[]): number {
  const list = normalizeDegrees(degrees);
  return list.length > 0 ? list[0] : 1;
}

export type ConvocationEligibility = 'eligible' | 'below' | 'no-degree';

/**
 * Sessão que abre em Aprendiz convoca todo obreiro ativo. Acima disso, só quem já alcançou o
 * grau de abertura (Mestre Instalado conta como Mestre); sem marcos de evolução no cadastro,
 * fica de fora e aparece na prévia para o Secretário corrigir.
 */
export function convocationEligibility(member: DegreeSource, degrees: number[]): ConvocationEligibility {
  const minimum = openingDegree(degrees);
  if (minimum <= 1) return 'eligible';
  const rank = degreeRank(symbolicSituation(member));
  if (rank === 0) return 'no-degree';
  return rank >= minimum ? 'eligible' : 'below';
}

export interface ConvocationSessionData {
  lodgeName: string;
  title: string;
  date: Date | string;
  endDate?: Date | string | null;
  type: string;
  degrees: number[];
  agenda?: string | null;
}

const TZ = 'America/Sao_Paulo';

function whenLine(date: Date, endDate: Date | null): string {
  const start = date.toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short', timeZone: TZ });
  if (!endDate) return `Data e hora: ${start}.`;
  const sameDay = date.toLocaleDateString('pt-BR', { timeZone: TZ }) === endDate.toLocaleDateString('pt-BR', { timeZone: TZ });
  const end = sameDay
    ? endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
    : endDate.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: TZ });
  return `Data e hora: ${start} (término previsto: ${end}).`;
}

/** Texto-base da convocação, gerado só do que está SALVO na sessão. */
export function buildConvocationText(s: ConvocationSessionData): string {
  const degrees = degreesLabel(s.degrees);
  return [
    `Meus irmãos, fica convocada a sessão "${s.title.trim()}" da ${s.lodgeName}.`,
    [
      whenLine(new Date(s.date), s.endDate ? new Date(s.endDate) : null),
      `Tipo: ${SESSION_TYPE_LABEL[s.type] ?? s.type}.`,
      degrees ? `Graus trabalhados: ${degrees}.` : null,
    ].filter(Boolean).join('\n'),
    s.agenda?.trim() ? `Ordem do dia:\n${s.agenda.trim()}` : null,
    'Contamos com a presença de todos. Fraternalmente.',
  ].filter(Boolean).join('\n\n');
}

export const RECTIFICATION_HEADER = 'RETIFICAÇÃO — esta mensagem substitui a convocação enviada anteriormente.';

export function convocationMessage(base: string, rectification: boolean): string {
  return rectification ? `${RECTIFICATION_HEADER}\n\n${base}` : base;
}

export function convocationSubject(title: string, rectification: boolean): string {
  return `${rectification ? 'Retificação da convocação' : 'Convocação'}: ${title.trim()}`;
}

export function stripRectification(text: string): string {
  return text.startsWith(`${RECTIFICATION_HEADER}\n\n`) ? text.slice(RECTIFICATION_HEADER.length + 2) : text;
}

/** A sessão mudou depois do último envio? (compara o texto que sairia hoje com o enviado) */
export function convocationChanged(currentBase: string, sentText: string | null | undefined): boolean {
  return !!sentText && stripRectification(sentText) !== currentBase;
}

export function convocationRef(sessionId: string): string {
  return `session-convocation:${sessionId}`;
}
