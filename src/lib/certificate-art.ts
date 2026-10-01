// Certificado de presença no MODELO DA LOJA: a arte que a loja já usa (com texto, moldura,
// selo e assinaturas desenhados) vira o fundo, e o sistema só escreve por cima, nas linhas em
// branco, o nome do Irmão, a Loja dele e o dia/mês/ano da sessão. Lógica pura: o layout (onde
// fica cada linha) e os valores; o PDF é montado em lib/certificate-pdf.
//
// Sem número nem QR impressos (decisão do dono, 2026-09-30): a arte não tem espaço e, para essa
// finalidade, a verificação não é necessária. O número continua sendo gerado para controle.

/** Uma linha em branco da arte: o texto sai centrado entre x0 e x1, logo acima da linha y. */
export interface ArtField {
  x0: number;
  x1: number;
  /** Altura da linha, em pontos, a partir do TOPO da página (como se mede na arte). */
  y: number;
  /** Tamanho da letra; encolhe sozinho se o texto não couber. */
  size: number;
}

export type ArtSignatureRole = 'venerable' | 'secretary';

export interface CertificateArtLayout {
  /** Página em pontos (A4 paisagem = 842 × 596); a arte é esticada para ela. */
  width: number;
  height: number;
  /** Cor do texto escrito por cima ("#1c2949"). */
  ink: string;
  fields: {
    name: ArtField;
    lodge?: ArtField;
    day?: ArtField;
    month?: ArtField;
    year?: ArtField;
  };
  /**
   * Nome de quem assina, em cima da linha de assinatura — só para arte SEM os nomes impressos.
   * Assinam o Venerável e o Secretário do veneralato da data da sessão.
   */
  signatures?: (ArtField & { role: ArtSignatureRole })[];
}

export type CertificateArtType = 'jpg' | 'png' | 'pdf';

export function normalizeArtType(v: unknown): CertificateArtType | null {
  return v === 'jpg' || v === 'png' || v === 'pdf' ? v : null;
}

const isNum = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

function parseField(raw: unknown, width: number, height: number): ArtField | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Record<string, unknown>;
  if (!isNum(f.x0, 0, width) || !isNum(f.x1, 0, width) || !isNum(f.y, 0, height) || !isNum(f.size, 4, 72)) return null;
  if (f.x1 - f.x0 < 10) return null;
  return { x0: f.x0, x1: f.x1, y: f.y, size: f.size };
}

/** Layout gravado na loja (JSON) → layout válido, ou null (aí o modelo da loja não aparece). */
export function parseCertificateArtLayout(raw: unknown): CertificateArtLayout | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isNum(r.width, 100, 3000) || !isNum(r.height, 100, 3000)) return null;
  const ink = typeof r.ink === 'string' && /^#[0-9a-f]{6}$/i.test(r.ink) ? r.ink : '#1c2949';
  const rawFields = (r.fields && typeof r.fields === 'object' ? r.fields : {}) as Record<string, unknown>;
  const name = parseField(rawFields.name, r.width, r.height);
  if (!name) return null;
  const fields: CertificateArtLayout['fields'] = { name };
  for (const key of ['lodge', 'day', 'month', 'year'] as const) {
    const f = parseField(rawFields[key], r.width, r.height);
    if (f) fields[key] = f;
  }
  const signatures = Array.isArray(r.signatures)
    ? r.signatures.flatMap((s) => {
        const f = parseField(s, r.width as number, r.height as number);
        const role = (s as Record<string, unknown>)?.role;
        return f && (role === 'venerable' || role === 'secretary') ? [{ ...f, role: role as ArtSignatureRole }] : [];
      })
    : [];
  return { width: r.width, height: r.height, ink, fields, ...(signatures.length ? { signatures } : {}) };
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Dia, mês por extenso e ano da sessão no calendário de Brasília ("aos 1º dias do mês de outubro de 2026"). */
export function artDateParts(date: Date): { day: string; month: string; year: string } {
  const br = new Date(date.getTime() - 3 * 60 * 60 * 1000); // Brasília, sem horário de verão
  const d = br.getUTCDate();
  return { day: d === 1 ? '1º' : String(d), month: MONTHS[br.getUTCMonth()], year: String(br.getUTCFullYear()) };
}

// A arte já traz o título da loja antes da linha ("da A∴R∴L∴M∴ ____"): tira o que repetiria.
const LODGE_PREFIX =
  /^(augusta\s+e\s+respeit[aá]vel\s+(benfeitora\s+)?loja(\s+(simb[oó]lica|ma[cç][oô]nica))?\s+|a\s*[.∴:·]\s*(r\s*[.∴:·]\s*)?(b\s*[.∴:·]\s*)?l\s*[.∴:·]\s*([sm]\s*[.∴:·]\s*)?|arl[sm]\s+|loja\s+)/i;

/** Linha da Loja do visitante: "Estrela do Oriente nº 1234" (sem "Loja", "A∴R∴L∴S∴"…). */
export function artLodgeLine(name: string | null | undefined, number: string | null | undefined): string | null {
  const n = (name ?? '').trim().replace(LODGE_PREFIX, '').trim();
  const num = (number ?? '').trim();
  if (!n && !num) return null;
  if (!n) return `nº ${num}`;
  return num ? `${n} nº ${num}` : n;
}

/** Cargo do signatário (como vem de getReportSignatories) → papel no layout. */
export function signatureRoleOf(role: string): ArtSignatureRole | null {
  const r = role.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  if (r.includes('veneravel')) return 'venerable';
  if (r.includes('secretari')) return 'secretary';
  return null;
}

/** Mensagem de erro (ou null) para o arquivo da arte: JPG, PNG ou PDF de até 4 MB (limite do Vercel). */
export const MAX_ART_BYTES = 4 * 1024 * 1024;
export function artUploadError(file: { type: string; size: number }): { error: string } | { type: CertificateArtType } {
  const type = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : file.type === 'application/pdf' ? 'pdf' : null;
  if (!type) return { error: 'A arte precisa ser JPG, PNG ou PDF.' };
  if (file.size > MAX_ART_BYTES) return { error: 'A arte passa de 4 MB. Exporte em JPG (cerca de 200 dpi) e tente de novo.' };
  return { type };
}

/** Os primeiros bytes batem com o tipo declarado? (o tipo vem do navegador, não é prova). */
export function artBytesMatch(bytes: Uint8Array, type: CertificateArtType): boolean {
  if (type === 'png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (type === 'jpg') return bytes[0] === 0xff && bytes[1] === 0xd8;
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
}
