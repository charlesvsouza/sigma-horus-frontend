// Regras puras do inventário de materiais (ocorrências do Arquiteto).
// Sem acesso a banco — as rotas e a página só aplicam o que estas funções decidem.

export const INCIDENT_KINDS = ['wear', 'damage', 'loss'] as const;
export type IncidentKind = (typeof INCIDENT_KINDS)[number];

export const INCIDENT_STATUSES = ['open', 'written_off', 'replaced', 'dismissed'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const RESOLUTIONS = ['write_off', 'replace', 'dismiss'] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

export const KIND_LABEL: Record<IncidentKind, string> = { wear: 'Desgaste', damage: 'Dano irreversível', loss: 'Perda' };
export const STATUS_LABEL: Record<IncidentStatus, string> = {
  open: 'Pendente',
  written_off: 'Baixa dada',
  replaced: 'Reposto',
  dismissed: 'Dispensado',
};

export function isIncidentKind(v: unknown): v is IncidentKind {
  return typeof v === 'string' && (INCIDENT_KINDS as readonly string[]).includes(v);
}
export function isResolution(v: unknown): v is Resolution {
  return typeof v === 'string' && (RESOLUTIONS as readonly string[]).includes(v);
}

interface IncidentLike { kind: string; status: string; quantity: number }

/**
 * Unidades em "quarentena": dano ou perda AINDA PENDENTES de decisão. Saem do
 * disponível na hora (não dá para emprestar um avental rasgado). Desgaste não
 * tira a unidade de uso — só sinaliza que precisa de reposição.
 */
export function unitsInQuarantine(incidents: IncidentLike[]): number {
  return incidents.reduce(
    (sum, i) => (i.status === 'open' && (i.kind === 'damage' || i.kind === 'loss') ? sum + i.quantity : sum),
    0,
  );
}

/** Disponível para fornecer = cadastrado − emprestado − em quarentena (nunca negativo). */
export function availableUnits(args: { quantity: number; issued: number; quarantined: number }): number {
  return Math.max(0, args.quantity - args.issued - args.quarantined);
}

/** Valida um novo registro de ocorrência contra o estoque cadastrado. */
export function validateReport(args: { quantity: number; materialQuantity: number; quarantined: number }):
  | { ok: true }
  | { ok: false; error: string } {
  const { quantity, materialQuantity, quarantined } = args;
  if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, error: 'Informe uma quantidade inteira maior que zero.' };
  if (quantity > Math.max(0, materialQuantity - quarantined)) {
    return { ok: false, error: `A quantidade excede o que a loja tem cadastrado (${Math.max(0, materialQuantity - quarantined)} sem ocorrência pendente).` };
  }
  return { ok: true };
}

/**
 * Decide o que uma resolução faz com a ocorrência e com a quantidade cadastrada:
 *  - open → write_off:  status written_off, quantidade −q (baixa)
 *  - open → replace:    status replaced,    quantidade 0 (troca 1:1)
 *  - open → dismiss:    status dismissed,   quantidade 0 (falso alarme/reparado)
 *  - written_off → replace: status replaced, quantidade +q (a reposição chegou)
 * Qualquer outra combinação é recusada (ocorrência já encerrada, etc.).
 */
export function planResolution(
  incident: { status: string; quantity: number },
  materialQuantity: number,
  resolution: Resolution,
): { ok: true; status: IncidentStatus; quantityDelta: number } | { ok: false; error: string } {
  if (incident.status === 'open') {
    if (resolution === 'write_off') {
      if (incident.quantity > materialQuantity) {
        return { ok: false, error: 'A baixa é maior que a quantidade cadastrada — ajuste o cadastro antes.' };
      }
      return { ok: true, status: 'written_off', quantityDelta: -incident.quantity };
    }
    if (resolution === 'replace') return { ok: true, status: 'replaced', quantityDelta: 0 };
    return { ok: true, status: 'dismissed', quantityDelta: 0 };
  }
  if (incident.status === 'written_off' && resolution === 'replace') {
    return { ok: true, status: 'replaced', quantityDelta: incident.quantity };
  }
  return { ok: false, error: 'Esta ocorrência já foi encerrada.' };
}

/** Aguardando reposição: baixa dada com reposição solicitada e ainda não reposta. */
export function awaitingReplacement(i: { status: string; requestReplacement: boolean }): boolean {
  return i.status === 'written_off' && i.requestReplacement;
}
