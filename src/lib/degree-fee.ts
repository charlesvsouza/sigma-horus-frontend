// Taxas de grau (iniciação, elevação, exaltação, filiação e regularização) — regras puras, testáveis sem Prisma.
//
// Decisões do dono (2026-10-02):
//  - valor configurado em Configurações da loja; o plano TRAVA o valor do dia
//    (reajuste depois não cobra diferença);
//  - até 6 cotas no total (1 = à vista); cada cota é uma cobrança comum do irmão;
//  - entrada opcional (decisão de 2026-10-03): entrada + N parcelas — a entrada é a 1ª cota (vence na data
//    da entrada) e as N parcelas dividem o saldo (valor − entrada); a entrada conta como cota (entrada + 5 = 6);
//  - elevação/exaltação antecipadas a partir da 4ª instrução do grau atual
//    (Aprendiz → elevação; Companheiro → exaltação). Iniciação: o candidato.
//    Filiação (2026-10-03: separada da regularização): candidato de filiação (maçom de outra loja);
//    Regularização: obreiro cadastrado que se regulariza (afastado, placet, Art. 002), com valor ABERTO
//    digitado na negociação (não há valor padrão em Configurações). Nenhuma das duas tem a regra da instrução;
//  - a taxa deve estar quitada até a data prevista do evento; quitada antes da
//    data, fica "quitada antecipadamente" (o "crédito" que o irmão vê no portal);
//  - evento que não acontece: a loja devolve o que foi pago;
//  - quem cria/gerencia: Administrador, Venerável e Tesoureiro;
//  - cartão: fora no Modo Loja (Fase 2 trata cartão parcelado no Asaas).

import { symbolicSituation, type DegreeSource } from './masonic-degree';

export type DegreeFeeKind = 'initiation' | 'elevation' | 'exaltation' | 'affiliation' | 'regularization';

export interface DegreeFeeKindDef {
  kind: DegreeFeeKind;
  label: string;          // "Taxa de Exaltação"
  event: string;          // "exaltação"
  /** Valor padrão em Configurações da loja; null = valor aberto, digitado em cada plano (regularização). */
  lodgeField: 'initiationFee' | 'elevationFee' | 'exaltationFee' | 'affiliationFee' | null;
  /** Data do cadastro que marca o evento realizado; null = o sistema não tem como saber (filiação). */
  memberDateField: 'initiationDate' | 'elevationDate' | 'exaltationDate' | null;
  chart: { code: string; name: string; type: 'REVENUE'; category: string };
}

/** Taxa de regularização (Art. 002): categoria própria, separada da filiação (1.1.03). */
export const REGULARIZATION_CHART = { code: '1.1.10', name: 'Taxa de Regularização', type: 'REVENUE' as const, category: 'Receitas Próprias' };

export const DEGREE_FEE_KINDS: DegreeFeeKindDef[] = [
  { kind: 'initiation', label: 'Taxa de Iniciação', event: 'iniciação', lodgeField: 'initiationFee', memberDateField: 'initiationDate', chart: { code: '1.1.02', name: 'Taxa de Iniciação', type: 'REVENUE', category: 'Receitas Próprias' } },
  { kind: 'elevation', label: 'Taxa de Elevação', event: 'elevação', lodgeField: 'elevationFee', memberDateField: 'elevationDate', chart: { code: '1.1.08', name: 'Taxa de Elevação', type: 'REVENUE', category: 'Receitas Próprias' } },
  { kind: 'exaltation', label: 'Taxa de Exaltação', event: 'exaltação', lodgeField: 'exaltationFee', memberDateField: 'exaltationDate', chart: { code: '1.1.09', name: 'Taxa de Exaltação', type: 'REVENUE', category: 'Receitas Próprias' } },
  { kind: 'affiliation', label: 'Taxa de Filiação', event: 'filiação', lodgeField: 'affiliationFee', memberDateField: null, chart: { code: '1.1.03', name: 'Taxa de Filiação', type: 'REVENUE', category: 'Receitas Próprias' } },
  { kind: 'regularization', label: 'Taxa de Regularização', event: 'regularização', lodgeField: null, memberDateField: null, chart: REGULARIZATION_CHART },
];

export const degreeFeeKind = (kind: string | null | undefined) => DEGREE_FEE_KINDS.find((k) => k.kind === kind) ?? null;

/** Devolução quando o evento não acontece (conta a pagar ao irmão, criada sob demanda). */
export const DEGREE_FEE_REFUND_CHART = { code: '2.1.17', name: 'Devolução de Taxas de Grau', type: 'EXPENSE' as const, category: 'Despesas Administrativas' };

export const MAX_INSTALLMENTS = 6;

/** Quem cria e gerencia os planos (decisão do dono — fixo, como canUnlockSession). */
export const canManageDegreeFees = (role: string | null | undefined) => ['admin', 'venerable', 'treasurer'].includes((role ?? '').toLowerCase().trim());

type DateLike = Date | string | null | undefined;
const toDate = (d: DateLike) => (d ? new Date(d) : null);

// ---------------------------------------------------------------------------
// Cotas
// ---------------------------------------------------------------------------

export interface PlannedInstallment { number: number; amount: number; dueDate: Date }

/** Divide em `n` cotas mensais; os centavos que sobram vão para a 1ª cota (o total fecha exato). */
export function splitInstallments(total: number, n: number, firstDueDate: Date): PlannedInstallment[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const rest = cents - base * n;
  const out: PlannedInstallment[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ number: i + 1, amount: (base + (i === 0 ? rest : 0)) / 100, dueDate: addMonths(firstDueDate, i) });
  }
  return out;
}

export interface PlannedCota extends PlannedInstallment { entry: boolean }

/** Valida a entrada: maior que zero, menor que o total, com até 2 casas decimais. */
export function validateDownPayment(total: number, down: number): { ok: true } | { ok: false; error: string } {
  if (!Number.isFinite(down) || down <= 0 || Math.abs(down * 100 - Math.round(down * 100)) > 1e-6) return { ok: false, error: 'Informe a entrada com até 2 casas decimais, maior que zero.' };
  if (Math.round(down * 100) >= Math.round(total * 100)) return { ok: false, error: 'A entrada deve ser menor que o valor da taxa (para pagar tudo de uma vez, use à vista, sem entrada).' };
  return { ok: true };
}

/** Máximo de parcelas depois da entrada: a entrada também é uma cota (entrada + 5 = 6). */
export const maxParcelas = (hasDown: boolean) => (hasDown ? MAX_INSTALLMENTS - 1 : MAX_INSTALLMENTS);

/**
 * Cotas do plano. Sem entrada: valor/n. Com entrada: a entrada é a 1ª cota (vence em `downDueDate`) e o saldo
 * (valor − entrada) é dividido em `n` parcelas mensais a partir de `firstDueDate` (os centavos sobram na 1ª parcela).
 */
export function planCotas(total: number, n: number, firstDueDate: Date, down: number | null = null, downDueDate: Date | null = null): PlannedCota[] {
  if (!down) return splitInstallments(total, n, firstDueDate).map((c) => ({ ...c, entry: false }));
  const balance = (Math.round(total * 100) - Math.round(down * 100)) / 100;
  const parcelas = splitInstallments(balance, n, firstDueDate).map((c) => ({ ...c, number: c.number + 1, entry: false }));
  return [{ number: 1, amount: down, dueDate: downDueDate ?? firstDueDate, entry: true }, ...parcelas];
}

/** Soma meses mantendo o dia do 1º vencimento (31 → 28/fev → 31/mar), limitado ao fim do mês. */
function addMonths(first: Date, months: number): Date {
  const day = first.getUTCDate();
  const next = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

/** Título da cota; `total` = nº de cotas do plano (entrada incluída). */
export const installmentTitle = (def: DegreeFeeKindDef, number: number, total: number, entry = false) =>
  entry ? `${def.label} — entrada` : total === 1 ? `${def.label} (à vista)` : `${def.label} — cota ${number}/${total}`;

// ---------------------------------------------------------------------------
// Elegibilidade
// ---------------------------------------------------------------------------

export interface EligibilityInput extends DegreeSource {
  status?: string | null;
  /** Tipo de admissão do candidato (initiation | affiliation), quando for candidato. */
  admissionKind?: string | null;
}

export function checkEligibility(
  kind: DegreeFeeKind,
  member: EligibilityInput,
  fourthInstructionDate: Date | null,
  today: Date = new Date(),
): { ok: true } | { ok: false; error: string } {
  if (kind === 'initiation') {
    if (member.status !== 'candidate') return { ok: false, error: 'A taxa de iniciação é do candidato: cadastre-o em Secretaria → Candidatos.' };
    if (member.admissionKind === 'affiliation') return { ok: false, error: 'Este candidato é de filiação: use a taxa de filiação / regularização.' };
    return { ok: true };
  }
  if (kind === 'affiliation') {
    // Só o candidato de filiação (maçom de outra loja). Quem já é obreiro e se regulariza usa a taxa de regularização.
    if (member.status !== 'candidate') return { ok: false, error: 'A taxa de filiação é do candidato de filiação (Secretaria → Candidatos). Para obreiro afastado ou no Art. 002, use a taxa de regularização.' };
    if (member.admissionKind !== 'affiliation') return { ok: false, error: 'Este candidato é de iniciação: use a taxa de iniciação. Para filiação, o processo dele deve ser do tipo Filiação.' };
    return { ok: true };
  }
  if (kind === 'regularization') {
    // Obreiro cadastrado que se regulariza (afastado, placet, Art. 002).
    if (member.status === 'candidate') return { ok: false, error: 'A taxa de regularização é do obreiro cadastrado. Candidato paga iniciação ou filiação.' };
    return { ok: true };
  }
  const situation = symbolicSituation(member);
  const needed = kind === 'elevation' ? 'Aprendiz' : 'Companheiro';
  if (member.status === 'candidate' || situation !== needed) {
    return { ok: false, error: `A taxa de ${kind === 'elevation' ? 'elevação' : 'exaltação'} é para ${needed === 'Aprendiz' ? 'Aprendiz' : 'Companheiro'} — confira as datas de iniciação/elevação/exaltação no cadastro do irmão.` };
  }
  if (!fourthInstructionDate || Number.isNaN(fourthInstructionDate.getTime())) {
    return { ok: false, error: `Informe a data da 4ª instrução de ${needed}: o pagamento antecipado só é liberado a partir dela.` };
  }
  if (fourthInstructionDate.getTime() > today.getTime()) {
    return { ok: false, error: 'A 4ª instrução ainda não aconteceu: o pagamento antecipado só é liberado a partir dela.' };
  }
  const since = toDate(kind === 'elevation' ? member.initiationDate : member.elevationDate);
  if (since && fourthInstructionDate.getTime() < since.getTime()) {
    return { ok: false, error: `A data da 4ª instrução é anterior à ${kind === 'elevation' ? 'iniciação' : 'elevação'} do irmão.` };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Situação do plano
// ---------------------------------------------------------------------------

export interface PlanCota { amount: number; dueDate: DateLike; status: string; paid: number }

export type PlanSituation = 'canceled' | 'event_done' | 'paid_waiting' | 'paid' | 'open';

export interface PlanSummary {
  situation: PlanSituation;
  paid: number;
  open: number;
  overdue: number;           // cotas vencidas em aberto
  cotasAfterEvent: number;   // cotas em aberto vencendo depois da data prevista do evento
  eventDoneWithBalance: boolean;
}

export function summarizePlan(
  plan: { status: string; expectedEventDate?: DateLike },
  cotas: PlanCota[],
  eventDone: boolean,
  today: Date = new Date(),
  /** false quando o sistema não detecta o evento (filiação/regularização): quitado = "Quitado", sem "aguardando". */
  tracksEvent = true,
): PlanSummary {
  const cents = (n: number) => Math.round(n * 100);
  let paid = 0, open = 0, overdue = 0, cotasAfterEvent = 0;
  const event = toDate(plan.expectedEventDate);
  const day = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  for (const c of cotas) {
    paid += cents(c.paid);
    const balance = c.status === 'paid' ? 0 : Math.max(0, cents(c.amount) - cents(c.paid));
    open += balance;
    if (balance > 0) {
      const due = toDate(c.dueDate);
      if (due && due.getTime() < day) overdue++;
      if (due && event && due.getTime() > event.getTime()) cotasAfterEvent++;
    }
  }
  const situation: PlanSituation = plan.status === 'canceled' ? 'canceled' : eventDone ? 'event_done' : open === 0 ? (tracksEvent ? 'paid_waiting' : 'paid') : 'open';
  return { situation, paid: paid / 100, open: open / 100, overdue, cotasAfterEvent, eventDoneWithBalance: eventDone && open > 0 && plan.status !== 'canceled' };
}

export const PLAN_SITUATION_LABEL: Record<PlanSituation, string> = {
  canceled: 'Cancelado',
  event_done: 'Evento realizado',
  paid_waiting: 'Quitado — aguardando o evento',
  paid: 'Quitado',
  open: 'Em pagamento',
};

// ---------------------------------------------------------------------------
// Fase 2 — cartão parcelado (Modo Asaas) com repasse da tarifa ao irmão
// ---------------------------------------------------------------------------

export interface CardFees { percentOneTime: number | null; percentInstallment: number | null; fixed: number | null }

/** Referência externa do parcelamento no Asaas: as parcelas repetem a mesma — o webhook acha a cota pelo id da parcela. */
export const DEGREE_FEE_CARD_REF_PREFIX = 'dfp:';
export const isDegreeFeeCardRef = (ref: string | null | undefined) => Boolean(ref && ref.startsWith(DEGREE_FEE_CARD_REF_PREFIX));

/**
 * Valor no cartão para a loja receber a taxa cheia: total = (taxa + fixo) / (1 − %),
 * com a parcela arredondada PARA CIMA no centavo (a loja nunca recebe menos). A tarifa
 * real é a que o Asaas cobrar (lançada na baixa); estes percentuais são os do contrato
 * da loja, informados em Configurações.
 */
export function cardGrossUp(fee: number, installments: number, fees: CardFees): { ok: true; installmentValue: number; total: number; surcharge: number } | { ok: false; error: string } {
  const pct = installments === 1 ? fees.percentOneTime : fees.percentInstallment;
  if (pct == null || !(pct >= 0 && pct < 100)) {
    return { ok: false, error: `Informe a tarifa do cartão ${installments === 1 ? 'à vista' : 'parcelado'} em Configurações da loja → Financeiro.` };
  }
  const fixed = fees.fixed ?? 0;
  const gross = (fee + fixed) / (1 - pct / 100);
  const installmentCents = Math.ceil(Math.round((gross / installments) * 1e6) / 1e4);
  const totalCents = installmentCents * installments;
  return { ok: true, installmentValue: installmentCents / 100, total: totalCents / 100, surcharge: (totalCents - Math.round(fee * 100)) / 100 };
}
