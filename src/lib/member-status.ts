// Situações do membro (status), centralizadas para form, listagem e relatórios.
// Inclui as situações maçônicas de afastamento:
//   - Quit Placet: afastamento a pedido do próprio membro
//   - Placet Ex Officio: afastamento por determinação da Loja
//   - Art. 002: afastamento com cobertura de direitos
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
  { value: 'art_002', label: 'Art. 002 (afastamento com cobertura de direitos)', short: 'Art. 002', tone: 'leave' },
  { value: 'suspended', label: 'Suspenso', short: 'Suspenso', tone: 'suspended' },
  { value: 'inactive', label: 'Inativo', short: 'Inativo', tone: 'inactive' },
];

const byValue = new Map(MEMBER_STATUSES.map((s) => [s.value, s]));

export const memberStatusLabel = (value?: string | null) => (value ? byValue.get(value)?.short ?? value : '—');
export const memberStatusFull = (value?: string | null) => (value ? byValue.get(value)?.label ?? value : '—');
export const memberStatusTone = (value?: string | null): StatusTone => (value ? byValue.get(value)?.tone ?? 'inactive' : 'inactive');
