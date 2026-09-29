import { compareOffices } from '@/lib/office-order';

// Livro de presença (impresso) de uma sessão: os convocados pelos graus da sessão, com linha
// de assinatura. Ordem decidida pelo dono: primeiro quem tem cargo no veneralato da sessão, na
// ordem ritualística (Venerável, Vigilantes, Orador, Secretário…); depois os demais, alfabética.

export interface BookMember {
  id: string;
  name: string;
  /** Situação simbólica (Aprendiz, Companheiro, Mestre, Mestre Instalado) ou null sem marcos. */
  degree: string | null;
  offices: { name: string; order: number }[];
}

export interface BookRow {
  n: number;
  name: string;
  degree: string;
  office: string;
}

/** Linhas em branco no fim do livro (irmão que chegou sem estar na lista) e na lista de visitantes. */
export const BOOK_BLANK_ROWS = 6;
export const VISITOR_BLANK_ROWS = 12;

export function attendanceBookRows(members: BookMember[]): BookRow[] {
  const withOffices = members.map((m) => ({ ...m, offices: [...m.offices].sort(compareOffices) }));
  const sorted = withOffices.sort((a, b) => {
    const ao = a.offices[0];
    const bo = b.offices[0];
    if (ao && bo) return compareOffices(ao, bo) || a.name.localeCompare(b.name, 'pt-BR');
    if (ao) return -1;
    if (bo) return 1;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
  return sorted.map((m, i) => ({
    n: i + 1,
    name: m.name,
    degree: m.degree ?? '—',
    office: m.offices.map((o) => o.name).join(', '),
  }));
}
