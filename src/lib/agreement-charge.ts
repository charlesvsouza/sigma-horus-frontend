// Cobrança das parcelas do acordo (quitação ou regularização) — sempre pelo Pix da chave da loja,
// qualquer que seja o modo de recebimento da loja (modo híbrido: o acordo nunca passa pelo Asaas).
// Quem gera e envia é o Tesoureiro, o Venerável ou o Administrador; a baixa continua manual
// ("Registrar pagamento do acordo"). Nada é gravado por parcela: valor e identificador saem do
// calendário do acordo e do que já foi pago. Regras puras (sem banco).

import { createHash } from 'node:crypto';
import { nameMatch, type AmountMatch, type NameMatch } from './bank-suggest';
import { brl } from './currency';
import { formatDateOnly } from './date-only';
import { CHARGE_NOTICE_SIGNOFF } from './charge-notice';
import { agreementKindLabel, buildInstallments, isSettlementKind } from './member-block';
import { round2 } from './money';

/** Quem gera/envia a cobrança do acordo (a baixa tem regra própria, em recordAgreementPayment). */
export function canHandleAgreementCharge(role: string | null | undefined): boolean {
  const r = (role ?? '').toLowerCase().trim();
  return r === 'admin' || r === 'venerable' || r === 'treasurer';
}

/** Alvo da cobrança: o número de uma parcela ou "balance" (quitar o saldo todo do acordo de uma vez). */
export type ChargeTarget = number | 'balance';

export function parseChargeTarget(raw: unknown): ChargeTarget | null {
  if (raw === 'balance') return 'balance';
  const n = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  return Number.isInteger(n) && n >= 1 ? n : null;
}

export interface AgreementChargeBlock {
  id: string;
  kind: string;
  total: number;
  installments: number;
  firstDueDate: Date;
  paid: number;
  remaining: number;
}

export interface ParcelCharge {
  /** Número da parcela; 0 = saldo todo. */
  number: number;
  target: ChargeTarget;
  /** Valor do Pix: o que ainda falta desta parcela (ou o saldo todo), nunca acima do saldo do acordo. */
  amount: number;
  /** Valor previsto da parcela no calendário. */
  scheduled: number;
  dueDate: Date;
  late: boolean;
}

/**
 * Cobranças possíveis hoje: uma por parcela com algo em aberto e, havendo saldo, a de "quitar o saldo".
 * O que já foi pago cobre as parcelas em ordem (a mesma regra da situação do acordo): cada Pix cobra só o
 * que ainda falta DAQUELA parcela, e a soma das parcelas é o saldo do acordo. Para pôr tudo em dia de uma
 * vez existe o Pix do saldo.
 */
export function chargeableParcels(block: AgreementChargeBlock, today: Date): ParcelCharge[] {
  if (block.remaining <= 0) return [];
  const out: ParcelCharge[] = [];
  let before = 0; // soma das parcelas anteriores
  for (const p of buildInstallments(block.total, block.installments, block.firstDueDate)) {
    const covered = Math.min(p.amount, Math.max(0, round2(block.paid - before)));
    before = round2(before + p.amount);
    const open = round2(p.amount - covered);
    if (open <= 0.004) continue; // já coberta
    out.push({ number: p.number, target: p.number, amount: round2(Math.min(open, block.remaining)), scheduled: p.amount, dueDate: p.dueDate, late: p.dueDate.getTime() < today.getTime() });
  }
  return out;
}

export function balanceCharge(block: AgreementChargeBlock, today: Date): ParcelCharge | null {
  if (block.remaining <= 0) return null;
  const last = buildInstallments(block.total, block.installments, block.firstDueDate).at(-1)!;
  return { number: 0, target: 'balance', amount: round2(block.remaining), scheduled: round2(block.remaining), dueDate: last.dueDate, late: last.dueDate.getTime() < today.getTime() };
}

/** Cobrança escolhida (parcela ou saldo) ou null se já não existe (parcela já coberta, acordo quitado). */
export function pickCharge(block: AgreementChargeBlock, target: ChargeTarget, today: Date): ParcelCharge | null {
  if (target === 'balance') return balanceCharge(block, today);
  return chargeableParcels(block, today).find((c) => c.number === target) ?? null;
}

/**
 * Identificador do Pix (até 25 alfanuméricos): derivado do acordo, do alvo e do valor — o mesmo Pix
 * sempre sai igual, e um valor diferente (pagamento no meio) gera outro identificador.
 * Se aparece no extrato depende do banco.
 */
export function agreementTxid(blockId: string, target: ChargeTarget, amount: number): string {
  const hash = createHash('sha256').update(`acordo:${blockId}:${target}:${Math.round(amount * 100)}`).digest('hex').slice(0, 18).toUpperCase();
  return `ACD${hash}`;
}

export interface AgreementMessageInput {
  memberName: string;
  kind: string;
  charge: ParcelCharge;
  installments: number;
  pixCopyPaste?: string | null;
  instructions?: string | null;
}

/** Texto único do aviso (WhatsApp e e-mail). O Pix copia e cola vai numa linha própria, sem formatação. */
export function agreementChargeMessage(input: AgreementMessageInput): string {
  const { charge } = input;
  const valor = brl(charge.amount);
  const data = formatDateOnly(charge.dueDate);
  const acordo = isSettlementKind(input.kind) ? 'acordo de quitação de dívidas' : 'acordo de regularização';
  let lead: string;
  if (charge.target === 'balance') {
    lead = `Caro irmão ${input.memberName}, segue a cobrança para quitar de uma só vez o saldo do ${acordo} firmado com a Loja, no valor de ${valor}.`;
  } else if (charge.late) {
    lead = `Caro irmão ${input.memberName}, consta em aberto a parcela ${charge.number}/${input.installments} do ${acordo} firmado com a Loja, no valor de ${valor}, vencida em ${data}. Por gentileza, regularize.`;
  } else {
    lead = `Caro irmão ${input.memberName}, segue a cobrança da parcela ${charge.number}/${input.installments} do ${acordo} firmado com a Loja, no valor de ${valor}, com vencimento em ${data}.`;
  }
  const parts = [lead];
  if (input.pixCopyPaste) {
    parts.push('Para pagar, copie o código abaixo e cole no app do seu banco em "Pix copia e cola":', input.pixCopyPaste);
  } else if (input.instructions) {
    parts.push(`Como pagar:\n${input.instructions}`);
  }
  parts.push('Depois de pagar, responda esta mensagem com o comprovante.', CHARGE_NOTICE_SIGNOFF);
  return parts.join('\n\n');
}

export function agreementChargeSubject(kind: string, charge: ParcelCharge, installments: number): string {
  const label = agreementKindLabel(kind);
  return charge.target === 'balance' ? `${label} — quitação do saldo` : `${label} — parcela ${charge.number}/${installments}`;
}

// ── Sugestão de baixa pelo extrato ──────────────────────────────────────────────

export interface AgreementSuggestion {
  memberId: string;
  memberName: string;
  /** Do que se trata: "Parcela 2/3", "Quitação do saldo do acordo" ou "Pagamento parcial do acordo". */
  label: string;
  remaining: number;
  amountMatch: AmountMatch;
  nameMatch: NameMatch;
  score: number;
}

const TOL = 0.005;

/**
 * Para um crédito do extrato, os acordos em aberto que ele provavelmente pagou: o valor bate com uma parcela (ou com o
 * saldo todo) = exato; senão, só entra se o nome do pagador conferir e o valor couber no saldo do acordo (parcial).
 * Mesma régua da sugestão de contas avulsas — quem confirma é a Tesouraria.
 */
export function suggestAgreementMatches(
  line: { amount: number; description: string },
  blocks: { memberId: string; memberName: string; block: AgreementChargeBlock }[],
  today: Date,
  limit = 3,
): AgreementSuggestion[] {
  const out: AgreementSuggestion[] = [];
  for (const { memberId, memberName, block } of blocks) {
    if (block.remaining + TOL < line.amount) continue;
    const parcels = chargeableParcels(block, today);
    const exactParcel = parcels.find((c) => Math.abs(c.amount - line.amount) <= TOL);
    const exactBalance = Math.abs(block.remaining - line.amount) <= TOL;
    const amountMatch: AmountMatch = exactParcel || exactBalance ? 'exact' : 'partial';
    const name = nameMatch(line.description, memberName);
    if (amountMatch === 'partial' && name === 'none') continue;
    const label = exactParcel ? `Parcela ${exactParcel.number}/${block.installments}` : exactBalance ? 'Quitação do saldo do acordo' : 'Pagamento parcial do acordo';
    out.push({ memberId, memberName, label, remaining: round2(block.remaining), amountMatch, nameMatch: name, score: (amountMatch === 'exact' ? 100 : 30) + (name === 'strong' ? 60 : name === 'weak' ? 20 : 0) });
  }
  return out.sort((x, y) => y.score - x.score || x.memberName.localeCompare(y.memberName, 'pt-BR')).slice(0, limit);
}

// ── "Já paguei" do irmão (AuditLog, sem migration) ───────────────────────────────

export const AGREEMENT_NOTICE_ENTITY = 'agreement-payment-notice';
export const AGREEMENT_NOTICE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// ── Registro dos envios (MessageLog, sem migration) ─────────────────────────────

export const AGREEMENT_MESSAGE_REF_PREFIX = 'acordo:';
export const AGREEMENT_WHATSAPP_CHANNEL = 'whatsapp-manual';

/** ref do MessageLog: acordo:<blockId>:<alvo> — agrupa os envios de uma parcela. */
export function agreementMessageRef(blockId: string, target: ChargeTarget): string {
  return `${AGREEMENT_MESSAGE_REF_PREFIX}${blockId}:${target}`;
}

export function agreementLogTitle(channel: 'whatsapp' | 'email', charge: ParcelCharge, installments: number): string {
  const what = charge.target === 'balance' ? 'saldo do acordo' : `parcela ${charge.number}/${installments} do acordo`;
  return channel === 'whatsapp' ? `WhatsApp: ${what}` : `E-mail: ${what}`;
}

/** Último envio confirmado e, se houver, abertura no WhatsApp sem confirmação, por alvo. */
export function sendMarksByTarget(logs: { ref: string | null; channel: string; status: string; createdAt: Date }[], blockId: string): Map<string, { sentAt: Date | null; openedAt: Date | null; emailedAt: Date | null }> {
  const prefix = `${AGREEMENT_MESSAGE_REF_PREFIX}${blockId}:`;
  const out = new Map<string, { sentAt: Date | null; openedAt: Date | null; emailedAt: Date | null }>();
  for (const log of [...logs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
    if (!log.ref?.startsWith(prefix)) continue;
    const target = log.ref.slice(prefix.length);
    const cur = out.get(target) ?? { sentAt: null, openedAt: null, emailedAt: null };
    if (log.channel === 'email') {
      if (log.status === 'sent' && !cur.emailedAt) cur.emailedAt = log.createdAt;
    } else if (log.status === 'sent') {
      if (!cur.sentAt) cur.sentAt = log.createdAt;
    } else if (log.status === 'handed-off' && !cur.sentAt && !cur.openedAt) {
      cur.openedAt = log.createdAt;
    }
    out.set(target, cur);
  }
  return out;
}
