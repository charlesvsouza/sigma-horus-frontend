import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import QRCode from 'qrcode';
import {
  attendedDegrees, certificateText, nextCertificateNumber, verificationCode, verificationUrl, type CertificateTemplate,
} from '@/lib/certificate';
import {
  artDateParts, artLodgeLine, normalizeArtType, parseCertificateArtLayout, signatureRoleOf, type ArtSignatureRole,
} from '@/lib/certificate-art';
import { renderArtCertificatePdf, renderCertificatePdf, type CertificateFonts } from '@/lib/certificate-pdf';
import { getLetterhead, longDateBR, orientOf } from '@/lib/letterhead';
import { lockKey } from '@/lib/locks';
import { withTenant } from '@/lib/prisma';
import { getChancellorSignatory, getReportSignatories } from '@/lib/report-signatories';
import { getObjectBuffer } from '@/lib/storage';
import { sessionDegrees } from '@/lib/session-convocation';
import { SESSION_TYPE_LABEL } from '@/lib/status-labels';

// Certificado de presença no servidor: dados da visita, emissão (número + código, uma vez só)
// e o PDF. As fontes vêm de src/assets/fonts (incluídas no bundle via next.config).

const FONT_DIR = path.join(process.cwd(), 'src', 'assets', 'fonts');
let fontsCache: Promise<CertificateFonts> | null = null;

function loadFonts(): Promise<CertificateFonts> {
  fontsCache ??= Promise.all(
    ['CinzelDecorative-Bold.ttf', 'CormorantGaramond-Regular.ttf', 'CormorantGaramond-Bold.ttf', 'CormorantGaramond-Italic.ttf']
      .map((f) => readFile(path.join(FONT_DIR, f))),
  ).then(([title, regular, bold, italic]) => ({ title, regular, bold, italic }));
  return fontsCache;
}

/** Brasão da loja (URL pública do storage). Falhou = certificado sem brasão, não sem certificado. */
async function fetchCrest(url: string | null): Promise<{ bytes: Uint8Array; type: 'png' | 'jpg' } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return { bytes, type: 'png' };
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return { bytes, type: 'jpg' };
    return null; // WebP/SVG: o pdf-lib não embute
  } catch {
    return null;
  }
}

/** Arte da loja pronta para uso (arquivo + layout válidos), ou null — aí o modelo da loja não aparece. */
export function lodgeArtOf(lodge: { certificateArtKey: string | null; certificateArtType: string | null; certificateLayout: unknown } | null) {
  const type = normalizeArtType(lodge?.certificateArtType);
  const layout = parseCertificateArtLayout(lodge?.certificateLayout);
  return lodge?.certificateArtKey && type && layout ? { key: lodge.certificateArtKey, type, layout } : null;
}

// A arte não muda entre um certificado e outro (trocar a arte gera chave nova): fica em memória
// enquanto a função estiver quente, para "Enviar pendentes" não baixar o arquivo a cada visitante.
const artCache = new Map<string, Promise<Uint8Array | null>>();
function loadArt(key: string): Promise<Uint8Array | null> {
  let p = artCache.get(key);
  if (!p) {
    p = getObjectBuffer(key).then((b) => (b ? new Uint8Array(b) : null)).catch(() => null);
    artCache.set(key, p);
    p.then((b) => { if (!b) artCache.delete(key); });
  }
  return p;
}

export class CertificateArtUnavailable extends Error {}

export async function loadCertificateContext(lodgeId: string, visitId: string) {
  return withTenant(lodgeId, async (db) => {
    const visit = await db.sessionVisitor.findFirst({
      where: { id: visitId, lodgeId },
      select: {
        id: true, degreeAtVisit: true, certificateNumber: true, certificateCode: true, certificateSentAt: true, certificateStatus: true,
        session: { select: { id: true, title: true, date: true, endDate: true, type: true, degrees: true, grade: true } },
        visitor: {
          select: {
            name: true, degree: true, lodgeName: true, lodgeNumber: true, orient: true, powerName: true, email: true, consentAt: true, anonymizedAt: true,
          },
        },
      },
    });
    if (!visit) return null;
    const [letterhead, signatures, chancellor, lodge] = await Promise.all([
      getLetterhead(db, lodgeId),
      getReportSignatories(db, lodgeId, { at: visit.session.date, by: 'secretary' }),
      getChancellorSignatory(db, lodgeId, visit.session.date),
      db.lodge.findUnique({ where: { id: lodgeId }, select: { certificateArtKey: true, certificateArtType: true, certificateLayout: true } }),
    ]);
    return { visit, letterhead, signatures, chancellor, art: lodgeArtOf(lodge) };
  });
}

export type CertificateContext = NonNullable<Awaited<ReturnType<typeof loadCertificateContext>>>;

/** A sessão já terminou? (certificado só depois dela). Sem término, vale o início. */
export function sessionEnded(ctx: CertificateContext, now: Date = new Date()): boolean {
  return (ctx.visit.session.endDate ?? ctx.visit.session.date).getTime() <= now.getTime();
}

/**
 * Emite (se ainda não tem): número CP-AAAA-NNNN sequencial por loja/ano e código de verificação
 * único. Trava por loja para duas emissões simultâneas não pegarem o mesmo número.
 */
export async function ensureIssued(lodgeId: string, visitId: string): Promise<{ number: string; code: string }> {
  return withTenant(lodgeId, async (db) => {
    await lockKey(db, `certificate-number:${lodgeId}`);
    const visit = await db.sessionVisitor.findFirst({ where: { id: visitId, lodgeId }, select: { certificateNumber: true, certificateCode: true } });
    if (visit?.certificateNumber && visit.certificateCode) return { number: visit.certificateNumber, code: visit.certificateCode };
    const year = new Date().getFullYear();
    const existing = await db.sessionVisitor.findMany({ where: { lodgeId, certificateNumber: { startsWith: `CP-${year}-` } }, select: { certificateNumber: true } });
    const number = nextCertificateNumber(existing.map((e) => e.certificateNumber), year);
    // Código novo, conferido na própria loja (o RLS só enxerga ela). Colisão com outra loja —
    // 31^8 combinações, praticamente impossível — viola o @unique e a emissão falha sem gravar.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = verificationCode(randomBytes(8));
      const clash = await db.sessionVisitor.findFirst({ where: { certificateCode: code }, select: { id: true } });
      if (clash) continue;
      await db.sessionVisitor.update({ where: { id: visitId }, data: { certificateNumber: number, certificateCode: code } });
      return { number, code };
    }
    throw new Error('Não foi possível gerar um código de verificação único.');
  });
}

export async function buildCertificatePdf(
  ctx: CertificateContext,
  template: CertificateTemplate,
  issued: { number: string; code: string } | null,
): Promise<Uint8Array> {
  const { visit, letterhead } = ctx;
  const v = visit.visitor;

  const text = certificateText({
    lodgeName: letterhead.name,
    lodgeOrient: orientOf(letterhead),
    lodgePower: letterhead.powerName,
    visitorName: v.name,
    visitorDegree: visit.degreeAtVisit ?? v.degree,
    visitorLodgeName: v.lodgeName,
    visitorLodgeNumber: v.lodgeNumber,
    visitorOrient: v.orient,
    visitorPower: v.powerName,
    sessionTypeLabel: SESSION_TYPE_LABEL[visit.session.type] ?? visit.session.type,
    sessionDateLong: longDateBR(visit.session.date),
    attended: attendedDegrees(sessionDegrees(visit.session), visit.degreeAtVisit ?? v.degree),
  });
  const orient = orientOf(letterhead);
  const placeDate = `${orient ? `${orient}, ` : ''}${longDateBR(new Date())}.`;

  // Modelo da loja: a arte é o fundo. Com área de texto (arte sem o miolo), o texto completo do
  // sistema; sem ela, só as linhas em branco da arte. Sem número nem QR impressos.
  if (template === 'loja') {
    if (!ctx.art) throw new CertificateArtUnavailable('A loja ainda não tem a arte do certificado configurada.');
    const [fonts, bytes] = await Promise.all([loadFonts(), loadArt(ctx.art.key)]);
    if (!bytes) throw new CertificateArtUnavailable('Não foi possível carregar a arte do certificado. Tente de novo.');
    return renderArtCertificatePdf({
      art: { bytes, type: ctx.art.type },
      layout: ctx.art.layout,
      values: { name: v.name, lodge: artLodgeLine(v.lodgeName, v.lodgeNumber), ...artDateParts(visit.session.date) },
      text,
      placeDate,
      // O Chanceler só entra aqui: a arte diz qual cargo assina em cada linha.
      signatures: [...ctx.signatures, ctx.chancellor].flatMap((s) => {
        const role = signatureRoleOf(s.role);
        return role ? [{ role: role as ArtSignatureRole, name: s.name ?? null }] : [];
      }),
      number: issued?.number ?? null,
      preview: !issued,
    }, fonts);
  }

  const url = issued ? verificationUrl(issued.code) : null;
  const [fonts, crest, qrPng] = await Promise.all([
    loadFonts(),
    fetchCrest(letterhead.crestUrl),
    url ? QRCode.toBuffer(url, { margin: 0, width: 240, errorCorrectionLevel: 'M' }) : Promise.resolve(null),
  ]);
  return renderCertificatePdf({
    template,
    text,
    openingFormula: letterhead.openingFormula,
    placeDate,
    signatures: ctx.signatures.map((s) => ({ role: s.role, name: s.name ?? null })),
    number: issued?.number ?? null,
    verifyUrl: url,
    qrPng: qrPng ? new Uint8Array(qrPng) : null,
    crest,
    preview: !issued,
  }, fonts);
}
