import fontkit from '@pdf-lib/fontkit';
import { degrees, PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import type { CertificateTemplate } from '@/lib/certificate';

// Diploma do certificado de presença em A4 paisagem, montado no servidor (vai anexo no e-mail).
// Dois modelos com o mesmo layout: Clássico (fundo marfim, moldura dourada dupla) e Pergaminho
// (fundo papiro, moldura sépia). As fontes não têm o "∴": ele é desenhado com três pontos.

export interface CertificateFonts { title: Uint8Array; regular: Uint8Array; bold: Uint8Array; italic: Uint8Array }

export interface CertificatePdfInput {
  template: CertificateTemplate;
  text: { before: string; name: string; after: string };
  openingFormula: string | null;
  /** "Oriente de Rio de Janeiro/RJ, 2 de outubro de 2026." */
  placeDate: string;
  signatures: { role: string; name: string | null }[];
  number: string | null;
  verifyUrl: string | null;
  qrPng: Uint8Array | null;
  crest: { bytes: Uint8Array; type: 'png' | 'jpg' } | null;
  preview: boolean;
}

const W = 841.89;
const H = 595.28;

const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

const PALETTE: Record<CertificateTemplate, { page: RGB; panel: RGB | null; frame: RGB; ink: RGB; accent: RGB; soft: RGB }> = {
  classico: { page: hex('#FFFDF7'), panel: null, frame: hex('#B8962E'), ink: hex('#1E1B16'), accent: hex('#8A6D1E'), soft: hex('#6B6152') },
  pergaminho: { page: hex('#E6D3A3'), panel: hex('#F4E8C8'), frame: hex('#7A5A1E'), ink: hex('#3B2F1E'), accent: hex('#7A5A1E'), soft: hex('#6A5A40') },
};

interface Style { font: PDFFont; size: number; color: RGB }

const TRI = '∴';
/** Largura do "∴" desenhado: um espaço estreito ocupado pelos três pontos. */
const triWidth = (size: number) => size * 0.5;

function wordWidth(word: string, s: Style): number {
  const parts = word.split(TRI);
  return parts.reduce((w, p) => w + (p ? s.font.widthOfTextAtSize(p, s.size) : 0), 0) + (parts.length - 1) * triWidth(s.size);
}

function drawWord(page: PDFPage, word: string, x: number, y: number, s: Style): void {
  const parts = word.split(TRI);
  let cx = x;
  parts.forEach((p, i) => {
    if (p) {
      page.drawText(p, { x: cx, y, font: s.font, size: s.size, color: s.color });
      cx += s.font.widthOfTextAtSize(p, s.size);
    }
    if (i < parts.length - 1) {
      // ∴: dois pontos embaixo, um em cima, na altura das minúsculas.
      const r = s.size * 0.07;
      const w = triWidth(s.size);
      page.drawCircle({ x: cx + w * 0.25, y: y + r, size: r, color: s.color });
      page.drawCircle({ x: cx + w * 0.75, y: y + r, size: r, color: s.color });
      page.drawCircle({ x: cx + w * 0.5, y: y + s.size * 0.42, size: r, color: s.color });
      cx += w;
    }
  });
}

/** Quebra o texto em linhas de até `maxWidth`. */
function wrap(text: string, s: Style, maxWidth: number): string[][] {
  const words = text.split(/\s+/).filter(Boolean);
  const space = s.font.widthOfTextAtSize(' ', s.size);
  const lines: string[][] = [];
  let line: string[] = [];
  let width = 0;
  for (const w of words) {
    const ww = wordWidth(w, s);
    if (line.length > 0 && width + space + ww > maxWidth) {
      lines.push(line);
      line = [];
      width = 0;
    }
    width += (line.length > 0 ? space : 0) + ww;
    line.push(w);
  }
  if (line.length > 0) lines.push(line);
  return lines;
}

/**
 * Quebra balanceada: o mesmo número de linhas da quebra comum, mas estreitando a largura até
 * o limite — evita a última linha com uma palavra só ("Companheiro." sozinho).
 */
function balancedWrap(text: string, s: Style, maxWidth: number): string[][] {
  const base = wrap(text, s, maxWidth);
  if (base.length < 2) return base;
  let best = base;
  for (let w = maxWidth - 8; w > maxWidth * 0.5; w -= 8) {
    const lines = wrap(text, s, w);
    if (lines.length !== base.length) break;
    best = lines;
  }
  return best;
}

/** Desenha o texto centralizado, linha a linha, a partir de `top`. Devolve o y final. */
function drawCentered(page: PDFPage, text: string, s: Style, top: number, maxWidth: number, leading: number): number {
  const space = s.font.widthOfTextAtSize(' ', s.size);
  let y = top;
  for (const l of balancedWrap(text, s, maxWidth)) {
    y -= leading;
    const lw = l.reduce((acc, w, i) => acc + wordWidth(w, s) + (i > 0 ? space : 0), 0);
    let x = (W - lw) / 2;
    for (const w of l) {
      drawWord(page, w, x, y, s);
      x += wordWidth(w, s) + space;
    }
  }
  return y;
}

function drawFrame(page: PDFPage, template: CertificateTemplate): void {
  const p = PALETTE[template];
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: p.page });
  if (p.panel) page.drawRectangle({ x: 16, y: 16, width: W - 32, height: H - 32, color: p.panel });
  page.drawRectangle({ x: 22, y: 22, width: W - 44, height: H - 44, borderColor: p.frame, borderWidth: 2.6 });
  page.drawRectangle({ x: 30, y: 30, width: W - 60, height: H - 60, borderColor: p.frame, borderWidth: 0.8 });
  // Losangos nos cantos da moldura interna.
  for (const [cx, cy] of [[30, 30], [W - 30, 30], [30, H - 30], [W - 30, H - 30]]) {
    page.drawRectangle({ x: cx, y: cy - 6, width: 8.5, height: 8.5, color: p.frame, rotate: degrees(45) });
  }
}

export async function renderCertificatePdf(input: CertificatePdfInput, fonts: CertificateFonts): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Certificado de presença${input.number ? ` ${input.number}` : ''}`);
  doc.setCreator('Sigma Horus');
  const [fTitle, fRegular, fBold, fItalic] = await Promise.all([
    doc.embedFont(fonts.title, { subset: true }),
    doc.embedFont(fonts.regular, { subset: true }),
    doc.embedFont(fonts.bold, { subset: true }),
    doc.embedFont(fonts.italic, { subset: true }),
  ]);
  const page = doc.addPage([W, H]);
  const p = PALETTE[input.template];
  drawFrame(page, input.template);

  let y = H - 46;
  if (input.crest) {
    const img = input.crest.type === 'png' ? await doc.embedPng(input.crest.bytes) : await doc.embedJpg(input.crest.bytes);
    const scale = Math.min(64 / img.height, 64 / img.width);
    const w = img.width * scale;
    const h = img.height * scale;
    page.drawImage(img, { x: (W - w) / 2, y: y - h, width: w, height: h });
    y -= h + 6;
  }
  if (input.openingFormula) {
    y = drawCentered(page, input.openingFormula, { font: fItalic, size: 10, color: p.soft }, y, 600, 12);
    y -= 2;
  }

  // Título.
  const title = 'Certificado de Presença';
  let titleSize = 32;
  while (fTitle.widthOfTextAtSize(title, titleSize) > 640 && titleSize > 20) titleSize -= 1;
  y -= titleSize + 2;
  page.drawText(title, { x: (W - fTitle.widthOfTextAtSize(title, titleSize)) / 2, y, font: fTitle, size: titleSize, color: p.accent });
  y -= 12;
  page.drawLine({ start: { x: W / 2 - 90, y }, end: { x: W / 2 + 90, y }, thickness: 0.8, color: p.frame });
  y -= 10;

  // Texto: antes do nome, o nome em destaque, depois — centralizado na altura entre o título e
  // a linha de local e data (sem deixar um vazio embaixo).
  const body: Style = { font: fRegular, size: 16.5, color: p.ink };
  const leading = 24;
  let nameSize = 28;
  const nameStyle = (size: number): Style => ({ font: fTitle, size, color: p.ink });
  while (wordWidth(input.text.name, nameStyle(nameSize)) > 660 && nameSize > 14) nameSize -= 1;
  const nameLeading = nameSize + 10;
  const blockHeight =
    balancedWrap(input.text.before, body, 640).length * leading + 8 +
    balancedWrap(input.text.name, nameStyle(nameSize), 700).length * nameLeading + 8 +
    balancedWrap(input.text.after, body, 640).length * leading;
  const bottomLimit = 178;
  y -= Math.max(0, (y - bottomLimit - blockHeight) / 2);
  y = drawCentered(page, input.text.before, body, y, 640, leading);
  y = drawCentered(page, input.text.name, nameStyle(nameSize), y - 8, 700, nameLeading);
  y = drawCentered(page, input.text.after, body, y - 8, 640, leading);

  // Local e data.
  const placeY = 150;
  const place = { font: fItalic, size: 13, color: p.ink };
  page.drawText(input.placeDate, { x: W - 70 - fItalic.widthOfTextAtSize(input.placeDate, 13), y: placeY, ...place });

  // Assinaturas (linha, nome, cargo).
  const centers = input.signatures.length === 1 ? [W * 0.6] : [W * 0.47, W * 0.76];
  input.signatures.slice(0, 2).forEach((s, i) => {
    const cx = centers[i];
    page.drawLine({ start: { x: cx - 95, y: 102 }, end: { x: cx + 95, y: 102 }, thickness: 0.7, color: p.ink });
    if (s.name) page.drawText(s.name, { x: cx - fBold.widthOfTextAtSize(s.name, 11.5) / 2, y: 89, font: fBold, size: 11.5, color: p.ink });
    page.drawText(s.role, { x: cx - fItalic.widthOfTextAtSize(s.role, 10.5) / 2, y: s.name ? 77 : 89, font: fItalic, size: 10.5, color: p.soft });
  });

  // Número e verificação pública (QR).
  const small = { font: fRegular, size: 9.5, color: p.soft };
  if (input.qrPng) {
    const qr = await doc.embedPng(input.qrPng);
    page.drawImage(qr, { x: 50, y: 48, width: 66, height: 66 });
  }
  const tx = input.qrPng ? 124 : 50;
  page.drawText(input.number ? `Certificado nº ${input.number}` : 'Número atribuído na emissão', { x: tx, y: 96, ...small, font: fBold });
  if (input.verifyUrl) {
    page.drawText('Verifique a autenticidade em:', { x: tx, y: 83, ...small });
    page.drawText(input.verifyUrl.replace(/^https?:\/\//, ''), { x: tx, y: 71, ...small, size: 8.5 });
  }

  if (input.preview) {
    page.drawText('PRÉVIA', { x: W / 2 - 190, y: H / 2 - 90, font: fTitle, size: 110, color: p.accent, opacity: 0.09, rotate: degrees(18) });
  }

  return doc.save();
}
