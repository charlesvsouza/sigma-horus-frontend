// Assinatura digital do Termo de acordo de regularização (regras puras). Ao clicar em "Assinar", o
// sistema grava uma marca: quem assinou, quando, o hash (SHA-256) do conteúdo do acordo naquele momento e
// um código de verificação. O hash permite provar depois que o acordo assinado não foi alterado.

import { createHash, randomBytes } from 'node:crypto';

export type AgreementParty = 'venerable' | 'treasurer' | 'member';

export const AGREEMENT_PARTIES: { party: AgreementParty; label: string }[] = [
  { party: 'venerable', label: 'Venerável Mestre' },
  { party: 'treasurer', label: 'Tesoureiro' },
  { party: 'member', label: 'Irmão' },
];

export const partyLabel = (party: string) => AGREEMENT_PARTIES.find((p) => p.party === party)?.label ?? party;

/**
 * Em nome de que parte o usuário assina? Venerável e Administrador assinam pela Loja como Venerável; o
 * Tesoureiro como Tesoureiro; e o próprio irmão do acordo (e só ele) como Irmão. Qualquer outro: não assina.
 */
export function partyForSigner(role: string | null | undefined, isOwnMember: boolean): AgreementParty | null {
  const r = (role ?? '').toLowerCase().trim();
  if (r === 'admin' || r === 'venerable') return 'venerable';
  if (r === 'treasurer') return 'treasurer';
  if (r === 'member' && isOwnMember) return 'member';
  return null;
}

export interface AgreementContent {
  blockId: string;
  memberId: string;
  memberName: string;
  total: number;
  regularizationFee: number;
  extraCharge: number;
  installments: number;
  firstDueDate: Date;
  items: { kind: string; title: string; openAmount: number; sortOrder: number }[];
}

/** Texto canônico do acordo (o que foi acordado, sem o andamento dos pagamentos): base do hash. */
export function canonicalAgreement(c: AgreementContent): string {
  const items = [...c.items].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)).map((i) => `${i.kind}|${i.title}|${i.openAmount.toFixed(2)}`);
  return [
    'termo-acordo-regularizacao/v1',
    c.blockId, c.memberId, c.memberName,
    c.total.toFixed(2), c.regularizationFee.toFixed(2), c.extraCharge.toFixed(2),
    String(c.installments), c.firstDueDate.toISOString().slice(0, 10),
    ...items,
  ].join('\n');
}

export const hashAgreement = (c: AgreementContent): string => createHash('sha256').update(canonicalAgreement(c), 'utf8').digest('hex');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0, 1 (confundem na leitura)

/** Código público de verificação: AC-XXXX-XXXX. */
export function generateSignatureCode(): string {
  const bytes = randomBytes(8);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return `AC-${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

/** Aceita o código digitado/colado (minúsculo, sem hífen) e devolve o formato canônico, ou null. */
export function normalizeSignatureCode(raw: string): string | null {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = /^AC([A-Z0-9]{8})$/.exec(s);
  return m ? `AC-${m[1].slice(0, 4)}-${m[1].slice(4)}` : null;
}
