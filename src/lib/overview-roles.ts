// Visão geral por cargo — regras puras. Decisão do dono (2026-10-04): a Visão geral é para quem gere a loja
// (Administrador, Venerável, Tesoureiro, Secretário, Hospitaleiro), cada um com os indicadores da SUA área, sempre
// de acordo com as permissões. O obreiro comum e o candidato só têm o "Meu portal" (que é a página inicial deles).

export type OverviewRole = 'admin' | 'venerable' | 'treasurer' | 'secretary' | 'hospitaller';

export const OVERVIEW_ROLES: OverviewRole[] = ['admin', 'venerable', 'treasurer', 'secretary', 'hospitaller'];

export function overviewRole(role: string | null | undefined): OverviewRole | null {
  const r = (role ?? '').toLowerCase().trim();
  return (OVERVIEW_ROLES as string[]).includes(r) ? (r as OverviewRole) : null;
}

export interface OverviewScope {
  /** Posição financeira e pendências de Contas/Cobranças (exige também ler Contas). */
  finance: boolean;
  /** Tesouraria operacional: extrato por conciliar, recorrências terminando. */
  treasury: boolean;
  /** Art. 002 (informativo) e acordos de regularização. */
  compliance: boolean;
  /** Despesas aguardando o visto do Venerável. */
  approvals: boolean;
  /** Sessões, balaústres, candidatos, cadastros, aniversariantes. */
  secretariat: boolean;
  /** Faltas seguidas. */
  attendance: boolean;
  /** Campanhas e pedidos de auxílio. */
  hospitality: boolean;
  /** Assinatura da loja. */
  system: boolean;
}

/** O que cada cargo vê na Visão geral. O saldo do Tronco é de todos (sem identificar doador). */
export function overviewScope(role: string | null | undefined): OverviewScope | null {
  switch (overviewRole(role)) {
    case 'admin': return { finance: true, treasury: true, compliance: true, approvals: true, secretariat: true, attendance: true, hospitality: true, system: true };
    case 'venerable': return { finance: true, treasury: false, compliance: true, approvals: true, secretariat: true, attendance: true, hospitality: true, system: false };
    case 'treasurer': return { finance: true, treasury: true, compliance: true, approvals: false, secretariat: false, attendance: false, hospitality: false, system: false };
    case 'secretary': return { finance: false, treasury: false, compliance: false, approvals: false, secretariat: true, attendance: true, hospitality: false, system: false };
    case 'hospitaller': return { finance: false, treasury: false, compliance: false, approvals: false, secretariat: false, attendance: true, hospitality: true, system: false };
    default: return null;
  }
}

/** Itens do menu "Visão geral": os cargos de gestão; obreiro comum e candidato ficam só com o portal. */
export const OVERVIEW_NAV_ROLES: string[] = [...OVERVIEW_ROLES];

/** Aniversário (dia/mês) dentro dos próximos `days` dias, contando hoje. `today` = dia civil de Brasília (00:00 UTC). */
export function birthdayWithin(birthDate: Date, today: Date, days = 7): boolean {
  const m = birthDate.getUTCMonth();
  const d = birthDate.getUTCDate();
  for (let i = 0; i <= days; i++) {
    const t = new Date(today.getTime() + i * 86_400_000);
    if (t.getUTCMonth() === m && t.getUTCDate() === d) return true;
  }
  return false;
}
