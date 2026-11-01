import { decideAutoEmit, type AutoEmitCandidate } from '@/lib/asaas-auto-emit-rules';

// Emissão em lote no Asaas (Cobranças → "Emitir em lote no Asaas"): regras puras, testáveis sem Prisma.
// Diferente da emissão automática da manhã (só quem vence em até 5 dias), o lote pega TODA cobrança em
// aberto ainda não emitida — inclusive vencida. Emitir atraso em lote é decisão da Tesouraria, por isso
// só acontece depois da conferência da lista. Nada é cancelado nem recriado: a cobrança continua a mesma
// (mesmo número e vencimento no sistema); o Asaas recebe a data de hoje quando ela já venceu.

export const MAX_BATCH_PER_CALL = 10;

export type BatchSkipReason = 'no-member' | 'agreement' | 'card' | 'paid' | 'no-cpf';

export interface BatchCandidate extends AutoEmitCandidate {
  hasMember: boolean;
  /** A dívida está num acordo aberto: acordo nunca vai pelo Asaas. */
  inAgreement: boolean;
  /** Cota de parcelamento no cartão (taxa de grau): paga pelo link do cartão. */
  cardPlan: boolean;
}

export type BatchDecision = { emit: true; value: number } | { emit: false; reason: BatchSkipReason };

export function decideBatchEmit(c: BatchCandidate): BatchDecision {
  if (!c.hasMember) return { emit: false, reason: 'no-member' };
  if (c.inAgreement) return { emit: false, reason: 'agreement' };
  if (c.cardPlan) return { emit: false, reason: 'card' };
  return decideAutoEmit(c);
}

export const BATCH_SKIP_LABEL: Record<BatchSkipReason, string> = {
  'no-member': 'Sem irmão vinculado',
  agreement: 'Dívida em acordo (acordo não vai pelo Asaas)',
  card: 'Cota de taxa de grau no cartão',
  paid: 'Já quitada',
  'no-cpf': 'Irmão sem CPF no cadastro (o Asaas exige)',
};
