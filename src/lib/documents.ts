// Documentos da loja: a categoria "Interno Loja" marca documentos de uso da gestão (diretoria/
// secretaria/tesouraria). Eles NÃO aparecem no portal dos irmãos nem podem ser baixados por
// quem tem o papel Membro — mesmo sem membro vinculado (que, no resto, significa "institucional:
// visível a todos").

export const INTERNAL_DOCUMENT_CATEGORY = 'Interno Loja';

export const DOCUMENT_CATEGORY_SUGGESTIONS = ['Institucional', 'Ata', 'Financeiro', 'Geral', INTERNAL_DOCUMENT_CATEGORY];

export function isInternalCategory(category: string | null | undefined): boolean {
  return (category ?? '').trim().toLowerCase() === INTERNAL_DOCUMENT_CATEGORY.toLowerCase();
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
  OR: [{ category: null }, { category: { not: INTERNAL_DOCUMENT_CATEGORY, mode: 'insensitive' as const } }],
};
