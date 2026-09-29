import { DEGREE_NAME, normalizeDegrees } from '@/lib/session-convocation';

// Certificado de presença do irmão visitante: texto, graus em que ele esteve, numeração e
// código de verificação pública. Lógica pura (o PDF é montado em lib/certificate-pdf).

export type CertificateTemplate = 'classico' | 'pergaminho';
export const CERTIFICATE_TEMPLATES: { id: CertificateTemplate; label: string }[] = [
  { id: 'classico', label: 'Clássico (moldura dourada)' },
  { id: 'pergaminho', label: 'Pergaminho' },
];
export function normalizeTemplate(v: unknown): CertificateTemplate {
  return v === 'pergaminho' ? 'pergaminho' : 'classico';
}

const RANK: Record<string, number> = { aprendiz: 1, companheiro: 2, mestre: 3, 'mestre instalado': 3 };

/**
 * Graus da sessão em que o visitante pôde estar: um Aprendiz numa sessão de 1º e 2º grau só
 * participou da parte de Aprendiz. Grau desconhecido (ou filosófico) = todos os da sessão.
 */
export function attendedDegrees(sessionDegrees: number[], visitorDegree: string | null | undefined): number[] {
  const degrees = normalizeDegrees(sessionDegrees);
  const rank = RANK[(visitorDegree ?? '').trim().toLowerCase()] ?? 3;
  const attended = degrees.filter((d) => d <= rank);
  return attended.length > 0 ? attended : degrees;
}

export function attendedDegreesText(degrees: number[]): string | null {
  const names = normalizeDegrees(degrees).map((d) => DEGREE_NAME[d]);
  if (names.length === 0) return null;
  if (names.length === 1) return `nos trabalhos em Grau de ${names[0]}`;
  return `nos trabalhos dos Graus de ${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

export interface CertificateContent {
  /** Loja que emite (nome como cadastrado). */
  lodgeName: string;
  /** "Oriente de Rio de Janeiro/RJ" ou null. */
  lodgeOrient: string | null;
  lodgePower: string | null;
  visitorName: string;
  visitorDegree: string | null;
  visitorLodgeName: string | null;
  visitorLodgeNumber: string | null;
  visitorOrient: string | null;
  visitorPower: string | null;
  sessionTypeLabel: string;
  /** Data da sessão por extenso ("1º de outubro de 2026"). */
  sessionDateLong: string;
  attended: number[];
}

/** Loja do visitante como sai no texto: "Loja Estrela do Sul nº 123" (sem repetir "Loja"/"A.R.L.S."). */
export function visitorLodgePhrase(name: string | null, number: string | null): string | null {
  if (!name && !number) return null;
  if (!name) return `Loja nº ${number}`;
  const hasPrefix = /^(loja|a\.?\s*r\.?\s*l\.?\s*s\.?|arls|a∴)/i.test(name.trim());
  return `${hasPrefix ? '' : 'Loja '}${name.trim()}${number ? ` nº ${number}` : ''}`;
}

/** O texto em três partes: antes do nome, o nome (em destaque) e depois. */
export function certificateText(c: CertificateContent): { before: string; name: string; after: string } {
  const issuer = [c.lodgeName, c.lodgePower ? `(${c.lodgePower})` : null, c.lodgeOrient ? `ao ${c.lodgeOrient}` : null].filter(Boolean).join(', ').replace(', (', ' (');
  const lodge = visitorLodgePhrase(c.visitorLodgeName, c.visitorLodgeNumber);
  const origin = lodge
    ? `do Quadro da ${lodge}${c.visitorOrient ? `, ao Oriente de ${c.visitorOrient}` : ''}${c.visitorPower ? ` (${c.visitorPower})` : ''}`
    : null;
  const degrees = attendedDegreesText(c.attended);
  const after = [
    c.visitorDegree ? `${c.visitorDegree},` : null,
    origin ? `${origin},` : null,
    `esteve presente à Sessão ${c.sessionTypeLabel} realizada em ${c.sessionDateLong}${degrees ? `, ${degrees}` : ''}.`,
  ].filter(Boolean).join(' ');
  // "A∴R∴L∴S∴ Tim Maia" / "A.R.L.S. …" já começam pelo artigo: não sai "A A∴R∴L∴S∴".
  const article = /^a\s*[.∴]/i.test(c.lodgeName.trim()) ? '' : 'A ';
  return { before: `${article}${issuer}, certifica que o Ir∴`, name: c.visitorName, after };
}

/** "CP-2026-0007": sequência por loja e ano, a partir dos números já emitidos. */
export function nextCertificateNumber(existing: (string | null)[], year: number): string {
  const prefix = `CP-${year}-`;
  const max = existing.reduce((m, n) => {
    if (!n?.startsWith(prefix)) return m;
    const seq = Number(n.slice(prefix.length));
    return Number.isInteger(seq) && seq > m ? seq : m;
  }, 0);
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

// Sem letras/números que se confundem (0/O, 1/I/L): o código é digitado de um papel.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Código de verificação "K7Q2-9XMA" a partir de bytes aleatórios. */
export function verificationCode(random: Uint8Array): string {
  const chars = Array.from(random.slice(0, 8), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

/** Normaliza o que o visitante digitou ("k7q29xma", "K7Q2 9XMA") para o formato gravado. */
export function normalizeVerificationCode(raw: string): string | null {
  const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : null;
}

export function verificationUrl(code: string, appUrl: string | undefined = process.env.NEXT_PUBLIC_APP_URL): string {
  return `${(appUrl || 'https://sigmahorus.com.br').replace(/\/+$/, '')}/verificar/${code}`;
}

/** E-mail que leva o certificado anexo. */
export function certificateEmail(i: { visitorName: string; lodgeName: string; sessionTypeLabel: string; sessionDate: string; number: string; url: string }): { subject: string; text: string } {
  return {
    subject: `Certificado de presença — ${i.lodgeName}`,
    text: [
      `Caro Ir.·. ${i.visitorName},`,
      `A ${i.lodgeName} agradece a sua visita à Sessão ${i.sessionTypeLabel} de ${i.sessionDate}. Segue em anexo o seu certificado de presença, nº ${i.number}.`,
      `A autenticidade do certificado pode ser verificada em: ${i.url}`,
      `Fraternalmente,\nSecretaria — ${i.lodgeName}`,
    ].join('\n\n'),
  };
}
