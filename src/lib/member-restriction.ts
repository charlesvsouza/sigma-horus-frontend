// Restrição do cadastro com motivo — regras puras (sem banco).
//
// Base normativa: Regulamento Geral e Código Disciplinar da GLMERJ (documentos da própria loja).
// Cada motivo carrega o artigo, o que corta e o que a Loja precisa registrar. O irmão sempre vê o motivo.
//
// Alcance (scope):
//  - total        : o cadastro sai de convocação, presença, cobrança nova e mensagens (Member.status muda).
//  - convocation  : só convocação e aviso de faltas (licença) — o irmão segue ativo, com cobrança e acesso.
//  - none         : só registro/aviso (pendência de cadastro, advertência/censura) — nada é cortado.
//
// O bloqueio do Art. 002 (status 'blocked' + acordo) continua à parte (lib/member-block).

import { degreeRank, type SymbolicSituation } from './masonic-degree';

export type RestrictionScope = 'total' | 'convocation' | 'none';
export type RestrictionStatus = 'active' | 'ended';

export interface RestrictionKindDef {
  value: string;
  label: string;
  article: string; // fonte normativa (texto mostrado ao irmão e nos relatórios)
  summary: string; // o que é, em uma frase
  scope: RestrictionScope;
  /** Situação do cadastro enquanto a restrição vale (só scope total). */
  status?: 'quit_placet' | 'placet_ex_officio' | 'suspended' | 'inactive';
  /** Exige dívida zerada no ato (quitação à vista ou acordo antes do pedido). */
  requiresDebtClear?: boolean;
  /** Exige estar em dia (licença: RG 176). */
  requiresUpToDate?: boolean;
  /** Exige a data da deliberação da Loja (voto/ata). */
  requiresDeliberation?: boolean;
  /** Exige motivo/descrição escrita. */
  requiresReason?: boolean;
  /** Exige data prevista de retorno/fim. */
  requiresEnd?: boolean;
  /** Prazo máximo do fim previsto, em meses, contado do início. */
  maxMonths?: number;
  /** Pede destino (loja/Potência de filiação). */
  asksDestination?: boolean;
  /** Pede o nº de registro na Grande Loja (protocolo). */
  asksProtocol?: boolean;
  /** Menor/maior grau (posto simbólico) que pode receber o motivo. */
  minDegree?: 'Aprendiz' | 'Companheiro' | 'Mestre';
  maxDegree?: 'Aprendiz' | 'Companheiro' | 'Mestre';
}

export const RESTRICTION_KINDS: RestrictionKindDef[] = [
  {
    value: 'quit_placet', label: 'Quit Placet', article: 'Regulamento Geral, arts. 147 j e 153',
    summary: 'Afastamento a pedido do Mestre, para deixar a Loja ou filiar-se a outra. Exige as pendências quitadas e registro na Grande Loja.',
    scope: 'total', status: 'quit_placet', requiresDebtClear: true, asksDestination: true, asksProtocol: true, minDegree: 'Mestre',
  },
  {
    value: 'degree_certificate', label: 'Certificado de grau', article: 'Regulamento Geral, arts. 147 j, 148 e 171',
    summary: 'Afastamento a pedido do Aprendiz ou Companheiro, para filiar-se a outra loja ou Potência. Exige as pendências quitadas.',
    scope: 'total', status: 'quit_placet', requiresDebtClear: true, asksDestination: true, asksProtocol: true, maxDegree: 'Companheiro',
  },
  {
    value: 'temporary_leave', label: 'Licença temporária', article: 'Regulamento Geral, arts. 147 j e 176 a 179',
    summary: 'Afastamento por até 6 meses (prorrogável) para quem está em dia. Dispensa só a frequência e os cargos; a cobrança segue.',
    scope: 'convocation', requiresUpToDate: true, requiresReason: true, requiresEnd: true, maxMonths: 6,
  },
  {
    value: 'placet_ex_officio', label: 'Placet de ofício', article: 'Regulamento Geral, art. 154',
    summary: 'Desligamento por decisão da Loja: proposta de três Mestres, defesa em 10 dias e voto secreto.',
    scope: 'total', status: 'placet_ex_officio', requiresDeliberation: true, requiresReason: true,
  },
  {
    value: 'rights_coverage', label: 'Cobertura de direitos por mora', article: 'Regulamento Geral, art. 151 §§ 2º e 3º',
    summary: 'Decretada pela Loja após 3 meses de mora e novo aviso de mais 3 meses. O irmão evita a cobertura saldando o débito.',
    scope: 'total', status: 'suspended', requiresDeliberation: true,
  },
  {
    value: 'irregular_dues', label: 'Irregular por mensalidade', article: 'Regulamento Geral, arts. 143 § único d, 145 e 146 § 1º',
    summary: 'Declarado irregular por 6 meses consecutivos sem contribuir. Suspende todos os direitos; a Loja não pode negar a regularização se ele pagar os atrasados.',
    scope: 'total', status: 'suspended', requiresDeliberation: true,
  },
  {
    value: 'disciplinary_suspension', label: 'Suspensão disciplinar', article: 'Código Disciplinar, art. 7º e',
    summary: 'Pena de suspensão de até dois anos, aplicada em processo disciplinar com defesa.',
    scope: 'total', status: 'suspended', requiresDeliberation: true, requiresReason: true, requiresEnd: true, maxMonths: 24,
  },
  {
    value: 'absence_elimination', label: 'Eliminação por ausência', article: 'Regulamento Geral, art. 150 § 2º',
    summary: 'Aprendiz ou Companheiro sem comparecer por seis meses seguidos, sem justificativa. Retorna por reabilitação.',
    scope: 'total', status: 'inactive', requiresDeliberation: true, maxDegree: 'Companheiro',
  },
  {
    value: 'elimination', label: 'Eliminação do quadro', article: 'Regulamento Geral, arts. 150 e 151 § 5º; Código Disciplinar, art. 7º f',
    summary: 'Eliminação do quadro de obreiros por perda de direitos, doze meses de mora ou pena disciplinar.',
    scope: 'total', status: 'inactive', requiresDeliberation: true, requiresReason: true,
  },
  {
    value: 'expulsion', label: 'Expulsão', article: 'Código Disciplinar, art. 7º g',
    summary: 'Pena máxima, aplicada em processo disciplinar. Registrada pela Loja conforme a decisão da Justiça Maçônica.',
    scope: 'total', status: 'inactive', requiresDeliberation: true, requiresReason: true, asksProtocol: true,
  },
  {
    value: 'warning', label: 'Advertência ou censura', article: 'Código Disciplinar, art. 7º a a d',
    summary: 'Advertência verbal ou escrita, censura particular ou pública. Fica registrada; nada é cortado.',
    scope: 'none', requiresReason: true,
  },
  {
    value: 'registry_pending', label: 'Pendência de cadastro/migração', article: 'Migração do sistema anterior',
    summary: 'Inconsistência a corrigir na migração dos dados. Avisa o irmão e a Secretaria; nada é cortado.',
    scope: 'none', requiresReason: true,
  },
];

const byKind = new Map(RESTRICTION_KINDS.map((k) => [k.value, k]));
export const restrictionKind = (value: string | null | undefined) => (value ? byKind.get(value) ?? null : null);
export const restrictionLabel = (value: string | null | undefined) => restrictionKind(value)?.label ?? (value || '—');

export const SCOPE_LABEL: Record<RestrictionScope, string> = {
  total: 'Total — fora de convocação, cobrança nova e mensagens',
  convocation: 'Parcial — só convocação e frequência',
  none: 'Só registro — nada é cortado',
};

/** Só o Venerável, o Administrador e o Secretário aplicam e encerram restrições. */
export function canManageRestrictions(role: string | null | undefined): boolean {
  const r = (role ?? '').toLowerCase().trim();
  return r === 'admin' || r === 'venerable' || r === 'secretary';
}

export interface RestrictionInput {
  kind: string;
  startedAt: Date;
  deliberatedAt: Date | null;
  expectedEndAt: Date | null;
  reason: string;
  destination: string;
  protocol: string;
}

export type RestrictionCheck = { ok: true; def: RestrictionKindDef } | { ok: false; error: string };

const addMonths = (d: Date, months: number) => {
  const out = new Date(d.getTime());
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
};

/** Valida o pedido contra o motivo escolhido (campos exigidos, prazo, grau, situação do cadastro). */
export function checkRestriction(
  input: RestrictionInput,
  ctx: { memberStatus: string; degree: SymbolicSituation | null; openDebt: number; overdueDebt: number; hasActiveOfKind: boolean },
): RestrictionCheck {
  const def = restrictionKind(input.kind);
  if (!def) return { ok: false, error: 'Motivo desconhecido.' };
  if (ctx.memberStatus === 'blocked') return { ok: false, error: 'Este irmão está bloqueado por comunicado à Potência (Art. 002). Libere-o pelo acordo antes de registrar outra restrição.' };
  if (ctx.memberStatus === 'candidate') return { ok: false, error: 'Este cadastro é de um candidato: o processo de admissão tem fluxo próprio.' };
  if (def.scope === 'total' && ctx.memberStatus !== 'active') {
    return { ok: false, error: 'Só é possível aplicar uma restrição total a um irmão com situação "Ativo". Encerre a situação atual antes.' };
  }
  if (ctx.hasActiveOfKind) return { ok: false, error: `Já existe "${def.label}" em vigor para este irmão.` };

  if (def.minDegree && ctx.degree && degreeRank(ctx.degree) < degreeRank(def.minDegree)) {
    return { ok: false, error: `${def.label} vale para Mestre. Para Aprendiz e Companheiro use "Certificado de grau".` };
  }
  if (def.maxDegree && ctx.degree && degreeRank(ctx.degree) > degreeRank(def.maxDegree)) {
    return { ok: false, error: `${def.label} vale só para Aprendiz e Companheiro. Para Mestre use o motivo correspondente.` };
  }
  if (def.requiresDeliberation && !input.deliberatedAt) return { ok: false, error: 'Informe a data da deliberação da Loja.' };
  if (def.requiresReason && input.reason.trim().length < 5) return { ok: false, error: 'Descreva o motivo (mínimo de 5 caracteres).' };
  if (def.requiresEnd && !input.expectedEndAt) return { ok: false, error: 'Informe a data prevista de fim.' };
  if (input.expectedEndAt) {
    if (input.expectedEndAt.getTime() <= input.startedAt.getTime()) return { ok: false, error: 'A data de fim deve ser depois do início.' };
    if (def.maxMonths && input.expectedEndAt.getTime() > addMonths(input.startedAt, def.maxMonths).getTime()) {
      return { ok: false, error: `O prazo máximo de ${def.label} é de ${def.maxMonths} meses.` };
    }
  }
  if (def.requiresDebtClear && ctx.openDebt > 0.004) {
    return { ok: false, error: 'O irmão tem pendências em aberto. Elas devem ser pagas no ato do pedido ou ajustadas em acordo (Tesouraria → Acordos) antes de registrar.' };
  }
  if (def.requiresUpToDate && ctx.overdueDebt > 0.004) {
    return { ok: false, error: 'A licença vale só para quem está em dia com a Tesouraria (art. 176). Há pendências vencidas.' };
  }
  return { ok: true, def };
}

/** Situação do cadastro que o motivo impõe (null = não muda a situação). */
export const restrictionTargetStatus = (kind: string): string | null => restrictionKind(kind)?.status ?? null;

// Datas da restrição são "só dia" (meia-noite UTC), como o resto do sistema.
const fmtDay = (value: Date | string) => {
  const d = new Date(value);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
};

/** Texto curto para selo/aviso: "Licença temporária até 05/04/2027". */
export function restrictionBadge(r: { kind: string; expectedEndAt?: Date | string | null }): string {
  const label = restrictionLabel(r.kind);
  return r.expectedEndAt ? `${label} até ${fmtDay(r.expectedEndAt)}` : label;
}

/** Texto do aviso que o irmão vê no portal. */
export function restrictionNotice(r: { kind: string; reason?: string | null; expectedEndAt?: Date | string | null }): string {
  const def = restrictionKind(r.kind);
  const lead = def?.scope === 'total'
    ? `Seu cadastro está com a situação "${restrictionLabel(r.kind)}".`
    : def?.scope === 'convocation'
      ? `Você está em ${restrictionLabel(r.kind).toLowerCase()}: fica dispensado da frequência e dos cargos.`
      : `Há um registro em seu cadastro: ${restrictionLabel(r.kind)}.`;
  const parts = [lead];
  if (def) parts.push(`Base: ${def.article}.`);
  if (r.reason?.trim()) parts.push(`Motivo: ${r.reason.trim()}`);
  if (r.expectedEndAt) parts.push(`Previsto até ${fmtDay(r.expectedEndAt)}.`);
  parts.push('Em caso de dúvida, procure a Secretaria ou o Venerável Mestre.');
  return parts.join(' ');
}
