// Documentos da loja: a categoria "Interno Loja" marca documentos de uso da gestão (diretoria/
// secretaria/tesouraria). Eles NÃO aparecem no portal dos irmãos nem podem ser baixados por
// quem tem o papel Membro — mesmo sem membro vinculado (que, no resto, significa "institucional:
// visível a todos").

export const INTERNAL_DOCUMENT_CATEGORY = 'Interno Loja';

// Pasta do candidato (processo de admissão: pré-proposta, sindicância, pareceres…).
// Sigilosa como "Interno Loja": nunca aparece no portal — nem para o candidato, nem
// para ele depois de iniciado, quando a pasta continua ligada ao mesmo cadastro.
export const CANDIDACY_DOCUMENT_CATEGORY = 'Processo de admissão';

export const DOCUMENT_CATEGORY_SUGGESTIONS = ['Institucional', 'Ata', 'Financeiro', 'Geral', INTERNAL_DOCUMENT_CATEGORY];

const RESTRICTED_CATEGORIES = [INTERNAL_DOCUMENT_CATEGORY, CANDIDACY_DOCUMENT_CATEGORY].map((c) => c.toLowerCase());

export const isCandidacyCategory = (category: string | null | undefined) =>
  (category ?? '').trim().toLowerCase() === CANDIDACY_DOCUMENT_CATEGORY.toLowerCase();

/** Fora da lista geral de Documentos: a pasta do candidato só abre na ficha dele (Secretaria → Candidatos). */
export const NOT_CANDIDACY_DOCUMENT = {
  OR: [{ category: null }, { category: { not: CANDIDACY_DOCUMENT_CATEGORY, mode: 'insensitive' as const } }],
};

/** Documento de uso da gestão, fora do portal ("Interno Loja" ou "Processo de admissão"). */
export function isInternalCategory(category: string | null | undefined): boolean {
  return RESTRICTED_CATEGORIES.includes((category ?? '').trim().toLowerCase());
}

/**
 * O irmão (papel Membro) pode ver/baixar este documento? Só os documentos dele ou os
 * institucionais (sem membro) — e nunca os "Interno Loja".
 */
export function memberCanAccessDocument(doc: { memberId: string | null; category: string | null }, memberId: string | null | undefined): boolean {
  if (isInternalCategory(doc.category)) return false;
  if (doc.memberId == null) return true;
  return Boolean(memberId) && doc.memberId === memberId;
}

/** Filtro Prisma que exclui os documentos internos (categoria nula continua valendo). */
export const NOT_INTERNAL_DOCUMENT = {
  OR: [
    { category: null },
    { AND: [INTERNAL_DOCUMENT_CATEGORY, CANDIDACY_DOCUMENT_CATEGORY].map((c) => ({ category: { not: c, mode: 'insensitive' as const } })) },
  ],
};
