import type { Prisma } from '@/generated/prisma/client';

/** Dados da loja para o cabeçalho dos documentos oficiais e quadros de honra. */
export interface Letterhead {
  name: string;
  crestUrl: string | null;
  city: string | null;
  state: string | null;
  riteName: string | null;
  powerName: string | null;
  /** yyyy-mm-dd */
  foundationDate: string | null;
  openingFormula: string | null;
}

export async function getLetterhead(db: Prisma.TransactionClient, lodgeId: string): Promise<Letterhead> {
  const lodge = await db.lodge.findUnique({
    where: { id: lodgeId },
    select: { name: true, crestUrl: true, city: true, state: true, riteName: true, powerName: true, foundationDate: true, openingFormula: true },
  });
  return {
    name: lodge?.name ?? 'Loja',
    crestUrl: lodge?.crestUrl ?? null,
    city: lodge?.city ?? null,
    state: lodge?.state ?? null,
    riteName: lodge?.riteName ?? null,
    powerName: lodge?.powerName ?? null,
    foundationDate: lodge?.foundationDate ? lodge.foundationDate.toISOString().slice(0, 10) : null,
    openingFormula: lodge?.openingFormula?.trim() || null,
  };
}

/** "Oriente de Rio de Janeiro/RJ" — ou null sem cidade cadastrada. */
export function orientOf(l: Pick<Letterhead, 'city' | 'state'>): string | null {
  if (!l.city) return null;
  return `Oriente de ${l.city}${l.state ? `/${l.state}` : ''}`;
}

/** "26 de setembro de 2026" (fuso de Brasília). */
export function longDateBR(d: Date): string {
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'long', year: 'numeric' });
}
