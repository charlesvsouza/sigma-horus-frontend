// Cadastro incompleto = irmão ativo sem CPF ou sem e-mail. CPF e e-mail são o que permite cobrar
// (e-mail, Asaas) e comunicar; a Secretaria pede o dado pelo WhatsApp (envio manual assistido).
// Quando os dois estão preenchidos o irmão deixa de ser "incompleto" e o pedido some sozinho.

export interface RecordFields { cpf?: string | null; email?: string | null; status?: string | null; deceased?: boolean | null }

export type MissingField = 'CPF' | 'e-mail';

export function missingRecordFields(m: RecordFields): MissingField[] {
  const missing: MissingField[] = [];
  if (!m.cpf || !m.cpf.replace(/\D/g, '')) missing.push('CPF');
  if (!m.email?.trim()) missing.push('e-mail');
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
    `Aqui é da Secretaria da ${lodgeName}. Para atualizar o seu cadastro e para que as cobranças, lembretes e convocações cheguem até você, precisamos do seu ${joinPt(missing)}.`,
    '',
    `Responda esta mensagem com ${missing.length > 1 ? 'esses dados' : 'esse dado'} e registraremos no sistema. Obrigado!`,
  ].join('\n');
}

export const RECORD_REQUEST_REF_PREFIX = 'cadastro:';
export const recordRequestRef = (memberId: string) => `${RECORD_REQUEST_REF_PREFIX}${memberId}`;
