// Cadastro incompleto = irmão ativo sem CPF, e-mail ou data de nascimento. CPF e e-mail são o que permite
// cobrar (e-mail, Asaas) e comunicar; o nascimento alimenta aniversários, benefício por idade e o quadro social; a Secretaria pede o dado pelo WhatsApp (envio manual assistido).
// Quando os três estão preenchidos o irmão deixa de ser "incompleto" e o pedido some sozinho.

export interface RecordFields { cpf?: string | null; email?: string | null; status?: string | null; deceased?: boolean | null; birthDate?: Date | string | null }

export type MissingField = 'CPF' | 'e-mail' | 'data de nascimento';

export function missingRecordFields(m: RecordFields): MissingField[] {
  const missing: MissingField[] = [];
  if (!m.cpf || !m.cpf.replace(/\D/g, '')) missing.push('CPF');
  if (!m.email?.trim()) missing.push('e-mail');
  if (!m.birthDate) missing.push('data de nascimento');
  return missing;
}

/** Só quem está ativo (e vivo) é cobrado e comunicado — os demais não entram na pendência. */
export function isIncompleteRecord(m: RecordFields): boolean {
  return m.status === 'active' && !m.deceased && missingRecordFields(m).length > 0;
}

const joinPt = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`);

/** Texto do pedido (WhatsApp): o irmão responde na própria conversa com o que falta. */
export function recordRequestText(memberName: string, lodgeName: string, missing: MissingField[]): string {
  const first = memberName.trim().split(/\s+/)[0] || 'Irmão';
  return [
    `T.F.A. Irmão ${first}, tudo bem?`,
    '',
    `Aqui é da Secretaria da ${lodgeName}. Para atualizar o seu cadastro e para que as cobranças, lembretes e convocações cheguem até você, precisamos d${missing.length === 1 && missing[0] === 'data de nascimento' ? 'a sua' : 'o seu'} ${joinPt(missing)}.`,
    '',
    `Responda esta mensagem com ${missing.length > 1 ? 'esses dados' : 'esse dado'} e registraremos no sistema. Obrigado!`,
  ].join('\n');
}

export const RECORD_REQUEST_REF_PREFIX = 'cadastro:';
export const recordRequestRef = (memberId: string) => `${RECORD_REQUEST_REF_PREFIX}${memberId}`;

/** E-mail ao irmão: o que falta e onde corrigir (ele mesmo pelo portal, ou a Secretaria). */
export function recordMemberEmail(memberName: string, lodgeName: string, missing: MissingField[], portalUrl: string): { subject: string; text: string } {
  const first = memberName.trim().split(/\s+/)[0] || 'Irmão';
  return {
    subject: `Atualize o seu cadastro — ${lodgeName}`,
    text: [
      `T.F.A. Irmão ${first},`,
      '',
      `O seu cadastro na ${lodgeName} está incompleto: falta ${joinPt(missing)}. Esses dados são essenciais ao funcionamento do sistema (cobranças e convocações, aniversários, benefícios e o quadro da loja).`,
      '',
      `Você mesmo pode completar em ${portalUrl} (Meu cadastro) ou pedir à Secretaria que registre. Leva um minuto.`,
      '',
      'Obrigado!',
    ].join('\n'),
  };
}

export interface RecordGap { name: string; missing: MissingField[]; hasEmail: boolean }

/** E-mail ao Secretário: a lista de quem falta completar e o que falta a cada um. */
export function recordSecretaryEmail(lodgeName: string, gaps: RecordGap[], pageUrl: string): { subject: string; text: string } {
  const lines = gaps.map((g) => `• ${g.name}: falta ${joinPt(g.missing)}${g.hasEmail ? '' : ' (sem e-mail: só pela Secretaria ou WhatsApp)'}`);
  return {
    subject: `${gaps.length} cadastro${gaps.length === 1 ? '' : 's'} incompleto${gaps.length === 1 ? '' : 's'} — ${lodgeName}`,
    text: [
      `Os cadastros abaixo estão incompletos em ${lodgeName}:`,
      '',
      ...lines,
      '',
      `Quem tem e-mail recebe o pedido para completar o próprio cadastro; os demais dependem da Secretaria. Veja a lista, imprima ou peça pelo WhatsApp em ${pageUrl}.`,
    ].join('\n'),
  };
}

export const RECORD_EMAIL_REF_PREFIX = 'cadastro-email:';
export const recordEmailRef = (memberId: string) => `${RECORD_EMAIL_REF_PREFIX}${memberId}`;
