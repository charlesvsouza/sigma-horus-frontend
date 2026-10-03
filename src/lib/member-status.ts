// Situações do membro (status), centralizadas para form, listagem e relatórios.
// Inclui as situações maçônicas de afastamento:
//   - Quit Placet: afastamento a pedido do próprio membro
//   - Placet Ex Officio: afastamento por determinação da Loja
//   - Bloqueado: comunicado à Potência pelo Art. 002 (ato manual do Venerável; ver lib/member-block)
// `active` é o único considerado "regular" (ex.: cobrança em massa de ativos).

export type StatusTone = 'active' | 'leave' | 'suspended' | 'inactive';

export interface MemberStatusDef {
  value: string;
  label: string; // rótulo completo (form/relatório)
  short: string; // rótulo curto (badge/lista)
  tone: StatusTone;
}

export const MEMBER_STATUSES: MemberStatusDef[] = [
  { value: 'active', label: 'Ativo', short: 'Ativo', tone: 'active' },
  { value: 'quit_placet', label: 'Quit Placet (afastamento a pedido do membro)', short: 'Quit Placet', tone: 'leave' },
  { value: 'placet_ex_officio', label: 'Placet Ex Officio (afastamento por determinação da Loja)', short: 'Placet Ex Officio', tone: 'leave' },
  { value: 'suspended', label: 'Suspenso', short: 'Suspenso', tone: 'suspended' },
  { value: 'inactive', label: 'Inativo', short: 'Inativo', tone: 'inactive' },
];

// Candidato (profano em admissão — lib/candidate.ts) fica FORA de MEMBER_STATUSES:
// não é opção do formulário de membro nem filtro do cadastro; só ganha rótulo.
const CANDIDATE_STATUS_DEF: MemberStatusDef = { value: 'candidate', label: 'Candidato (em processo de admissão)', short: 'Candidato', tone: 'inactive' };

// Bloqueado = comunicado à Potência (Art. 002): só nasce pelo bloqueio em Tesouraria → Acordos de
// regularização (lib/member-block). Não é opção do formulário; aparece só como rótulo e no filtro.
export const BLOCKED_STATUS_DEF: MemberStatusDef = { value: 'blocked', label: 'Bloqueado (comunicado à Potência)', short: 'Bloqueado — Potência', tone: 'suspended' };
export const MEMBER_FILTER_STATUSES: MemberStatusDef[] = [...MEMBER_STATUSES, BLOCKED_STATUS_DEF];

// 'art_002' foi uma situação gravada; hoje o Art. 002 é só o enquadramento calculado (nada é gravado).
// O rótulo fica para registros antigos que ainda a tenham.
const LEGACY_ART_002_DEF: MemberStatusDef = { value: 'art_002', label: 'Art. 002 (situação antiga)', short: 'Art. 002', tone: 'leave' };

const byValue = new Map([...MEMBER_STATUSES, BLOCKED_STATUS_DEF, LEGACY_ART_002_DEF, CANDIDATE_STATUS_DEF].map((s) => [s.value, s]));

export const memberStatusLabel = (value?: string | null) => (value ? byValue.get(value)?.short ?? value : '—');
export const memberStatusFull = (value?: string | null) => (value ? byValue.get(value)?.label ?? value : '—');
export const memberStatusTone = (value?: string | null): StatusTone => (value ? byValue.get(value)?.tone ?? 'inactive' : 'inactive');
