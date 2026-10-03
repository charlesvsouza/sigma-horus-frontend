// Documentos da loja. Visibilidade por GRAU: o documento institucional (sem membro) pode exigir um grau
// mínimo — Aprendiz, Companheiro, Mestre ou Mestre Instalado. Quem tem o grau exigido, ou superior,
// vê e baixa; quem está abaixo não vê nem na lista. Sem grau = todos os obreiros. Quem envia documentos
// (Administrador, Venerável, Secretário — permissão documents:write) vê tudo.
//
// "Interno Loja" e "Processo de admissão" são categorias antigas de uso da gestão e continuam
// restritas: não aparecem no portal dos irmãos nem podem ser baixadas por quem tem o papel Membro
// (mesmo sem membro vinculado, que no resto significa "institucional: visível a todos"). "Interno Loja"
// já não é sugerida — o equivalente agora é o grau mínimo —, mas os documentos antigos não foram
// reclassificados sozinhos, para não abrir o que era sigiloso: a Secretaria troca o grau um a um.

import { degreeRank, symbolicSituation, type DegreeSource } from './masonic-degree';

export const INTERNAL_DOCUMENT_CATEGORY = 'Interno Loja';

// Pasta do candidato (processo de admissão: pré-proposta, sindicância, pareceres…).
// Sigilosa como "Interno Loja": nunca aparece no portal — nem para o candidato, nem
// para ele depois de iniciado, quando a pasta continua ligada ao mesmo cadastro.
export const CANDIDACY_DOCUMENT_CATEGORY = 'Processo de admissão';

export const DOCUMENT_CATEGORY_SUGGESTIONS = ['Institucional', 'Ata', 'Financeiro', 'Geral'];

// Grau mínimo para ver o documento (ordem = hierarquia; ver masonic-degree.degreeRank).
export const DOCUMENT_DEGREES = [
  { value: 'apprentice', label: 'Aprendiz', rank: 1 },
  { value: 'fellow', label: 'Companheiro', rank: 2 },
  { value: 'master', label: 'Mestre', rank: 3 },
  { value: 'installed', label: 'Mestre Instalado', rank: 4 },
] as const;
export type DocumentDegree = (typeof DOCUMENT_DEGREES)[number]['value'];

/** Valor válido de grau mínimo, ou null (= sem restrição de grau). */
export function parseDocumentDegree(value: unknown): DocumentDegree | null {
  return DOCUMENT_DEGREES.find((d) => d.value === value)?.value ?? null;
}

export const documentDegreeRank = (value: string | null | undefined): number => DOCUMENT_DEGREES.find((d) => d.value === value)?.rank ?? 0;
export const documentDegreeLabel = (value: string | null | undefined): string | null => DOCUMENT_DEGREES.find((d) => d.value === value)?.label ?? null;

/** O grau do espectador (1–4; 0 = sem grau cadastrado) alcança o grau mínimo do documento? */
export function degreeAllowsDocument(minDegree: string | null | undefined, viewerRank: number): boolean {
  const need = documentDegreeRank(minDegree);
  return need === 0 || viewerRank >= need;
}

/** Grau (1–4) do irmão a partir das datas de evolução do cadastro. */
export const memberDocumentRank = (m: DegreeSource | null | undefined): number => (m ? degreeRank(symbolicSituation(m)) : 0);

export const isCandidacyCategory = (category: string | null | undefined) =>
  (category ?? '').trim().toLowerCase() === CANDIDACY_DOCUMENT_CATEGORY.toLowerCase();

/** Fora da lista geral de Documentos: a pasta do candidato só abre na ficha dele (Secretaria → Candidatos). */
export const NOT_CANDIDACY_DOCUMENT = {
  OR: [{ category: null }, { category: { not: CANDIDACY_DOCUMENT_CATEGORY, mode: 'insensitive' as const } }],
};

const RESTRICTED_CATEGORIES = [INTERNAL_DOCUMENT_CATEGORY, CANDIDACY_DOCUMENT_CATEGORY].map((c) => c.toLowerCase());

/** Documento de uso da gestão, fora do portal ("Interno Loja" ou "Processo de admissão"). */
export function isInternalCategory(category: string | null | undefined): boolean {
  return RESTRICTED_CATEGORIES.includes((category ?? '').trim().toLowerCase());
}

/**
 * O irmão (papel Membro) pode ver/baixar este documento? Só os documentos dele ou os
 * institucionais (sem membro) — nunca os "Interno Loja". Com `viewerRank`, os institucionais
 * também respeitam o grau mínimo.
 */
export function memberCanAccessDocument(
  doc: { memberId: string | null; category: string | null; minDegree?: string | null },
  memberId: string | null | undefined,
  viewerRank?: number,
): boolean {
  if (isInternalCategory(doc.category)) return false;
  if (doc.memberId == null) return viewerRank === undefined || degreeAllowsDocument(doc.minDegree, viewerRank);
  return Boolean(memberId) && doc.memberId === memberId;
}

export interface DocumentViewer {
  /** Quem envia documentos (documents:write) vê tudo. */
  seesAll: boolean;
  /** Candidato (profano em admissão): não vê nenhum documento — só o portal dele (débitos e cadastro). */
  isCandidate: boolean;
  /** Papel Membro: só os próprios e os institucionais. */
  isMemberRole: boolean;
  memberId: string | null;
  /** Grau do espectador (0 = sem grau cadastrado). */
  rank: number;
}

/** Regra única de visibilidade (lista, download e portal). */
export function canViewDocument(doc: { memberId: string | null; category: string | null; minDegree?: string | null }, viewer: DocumentViewer): boolean {
  if (viewer.isCandidate) return false;
  if (viewer.seesAll) return true;
  if (viewer.isMemberRole && !memberCanAccessDocument(doc, viewer.memberId)) return false;
  if (doc.memberId == null && !degreeAllowsDocument(doc.minDegree, viewer.rank)) return false;
  return true;
}

/** Filtro Prisma que exclui os documentos internos (categoria nula continua valendo). */
export const NOT_INTERNAL_DOCUMENT = {
  OR: [
    { category: null },
    { AND: [INTERNAL_DOCUMENT_CATEGORY, CANDIDACY_DOCUMENT_CATEGORY].map((c) => ({ category: { not: c, mode: 'insensitive' as const } })) },
  ],
};
