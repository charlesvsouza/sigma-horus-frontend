/**
 * Configura o certificado de presença no MODELO DA LOJA: sobe a arte (JPG/PNG/PDF) para o bucket
 * privado e grava a arte + o layout (onde escrever cada campo) na loja. As posições são medidas na
 * arte (pontos a partir do topo; ver lib/certificate-art.ts) e ficam num JSON em
 * scripts/certificate-layouts/.
 *
 *   --preview <saida.pdf>  só monta um certificado de exemplo com a arte e o layout (sem banco)
 *   --layout-only          grava só o layout (mantém a arte que a loja já enviou pela tela)
 *
 * Simulação por padrão. Para gravar: --yes --confirm-host <host> (e, em loja real protegida,
 * --i-know-this-is-a-real-lodge).
 *
 * Uso (PowerShell, sem DATABASE_URL do ambiente):
 *   node --env-file=.env --import ./test/setup.mjs scripts/setup-certificate-art.ts amm139 --art arte.jpg --layout scripts/certificate-layouts/amm-cdp2026.json --preview exemplo.pdf
 *   node --env-file=.env --import ./test/setup.mjs scripts/setup-certificate-art.ts amm139 --art arte.jpg --layout scripts/certificate-layouts/amm-cdp2026.json --yes --confirm-host <host> --i-know-this-is-a-real-lodge
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { certificateText } from '../src/lib/certificate';
import { artBytesMatch, artDateParts, parseCertificateArtLayout, type CertificateArtType } from '../src/lib/certificate-art';
import { renderArtCertificatePdf } from '../src/lib/certificate-pdf';
import { buildObjectKey, deleteObject, putObject } from '../src/lib/storage';
import { refuseIfProtected } from './protected-lodges';

const argv = process.argv.slice(2);
const VALUE_FLAGS = ['--art', '--layout', '--preview', '--confirm-host'];
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] ?? null : null; };
const slug = argv.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes(argv[i - 1] ?? ''));

const TYPE_BY_EXT: Record<string, CertificateArtType> = { '.jpg': 'jpg', '.jpeg': 'jpg', '.png': 'png', '.pdf': 'pdf' };
const MIME: Record<CertificateArtType, string> = { jpg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' };

async function main() {
  const artPath = opt('--art');
  const layoutPath = opt('--layout');
  const previewPath = opt('--preview');
  const layoutOnly = argv.includes('--layout-only');
  if (!slug || !layoutPath || (!artPath && !layoutOnly)) {
    console.error('Uso: setup-certificate-art.ts <slug> --layout <layout.json> (--art <arte> | --layout-only) [--preview saida.pdf] [--yes --confirm-host <host>]');
    process.exitCode = 1;
    return;
  }

  const layout = parseCertificateArtLayout(JSON.parse(await readFile(layoutPath, 'utf8')));
  if (!layout) { console.error('Layout inválido (precisa de width, height e fields.name).'); process.exitCode = 1; return; }
  console.log(`Layout: ${layout.width}×${layout.height} pt, campos: ${Object.keys(layout.fields).join(', ')}${layout.signatures ? `, assinaturas: ${layout.signatures.map((s) => s.role).join(', ')}` : ''}`);

  let art: { bytes: Uint8Array; type: CertificateArtType } | null = null;
  if (artPath) {
    const type = TYPE_BY_EXT[path.extname(artPath).toLowerCase()];
    const bytes = new Uint8Array(await readFile(artPath));
    if (!type || !artBytesMatch(bytes, type)) { console.error('A arte precisa ser JPG, PNG ou PDF (e o conteúdo conferir com a extensão).'); process.exitCode = 1; return; }
    art = { bytes, type };
    console.log(`Arte: ${artPath} (${type}, ${Math.round(bytes.length / 1024)} KB)`);
  }

  if (previewPath) {
    if (!art) { console.error('--preview precisa de --art.'); process.exitCode = 1; return; }
    const fontDir = path.join(process.cwd(), 'src', 'assets', 'fonts');
    const [title, regular, bold, italic] = await Promise.all(
      ['CinzelDecorative-Bold.ttf', 'CormorantGaramond-Regular.ttf', 'CormorantGaramond-Bold.ttf', 'CormorantGaramond-Italic.ttf'].map((f) => readFile(path.join(fontDir, f))),
    );
    const pdf = await renderArtCertificatePdf({
      art,
      layout,
      values: { name: 'João Batista de Oliveira Albuquerque', lodge: 'Estrela do Oriente nº 1234', ...artDateParts(new Date()) },
      // Caso longo de propósito (Potência, Oriente, sessão de dois graus): testa se cabe na área.
      text: certificateText({
        lodgeName: 'Augusta Respeitável e Benemérita Loja Antônio Monteiro Martins nº 139',
        lodgeOrient: 'Oriente da Barra da Tijuca',
        lodgePower: 'Grande Loja Maçônica do Estado do Rio de Janeiro (GLMERJ)',
        visitorName: 'João Batista de Oliveira Albuquerque',
        visitorDegree: 'Mestre Maçom',
        visitorLodgeName: 'Estrela do Oriente',
        visitorLodgeNumber: '1234',
        visitorOrient: 'Niterói',
        visitorPower: 'Grande Oriente do Brasil (GOB-RJ)',
        sessionTypeLabel: 'Ordinária',
        sessionDateLong: '15 de outubro de 2026',
        attended: [1, 2],
      }),
      placeDate: 'Oriente da Barra da Tijuca, 16 de outubro de 2026.',
      signatures: [{ role: 'venerable', name: 'Nome do Venerável' }, { role: 'secretary', name: 'Nome do Secretário' }, { role: 'chancellor', name: 'Nome do Chanceler' }],
      number: null,
      preview: false,
    }, { title, regular, bold, italic });
    await writeFile(previewPath, pdf);
    console.log(`Exemplo gravado em ${previewPath} (${Math.round(pdf.length / 1024)} KB). Nada foi gravado no banco.`);
    return;
  }

  const { prismaAdmin } = await import('../src/lib/prisma');
  const lodge = await prismaAdmin.lodge.findFirst({ where: { slug }, select: { id: true, name: true, certificateArtKey: true } });
  if (!lodge) { console.error(`Loja "${slug}" não encontrada.`); process.exitCode = 1; return; }
  console.log(`Loja: ${lodge.name}${lodge.certificateArtKey ? ` (arte atual: ${lodge.certificateArtKey})` : ' (sem arte)'}`);

  if (!argv.includes('--yes')) { console.log('Simulação: nada gravado. Para gravar, repita com --yes --confirm-host <host>.'); return; }
  const refusal = refuseIfProtected(slug, argv);
  if (refusal) { console.error(refusal); process.exitCode = 1; return; }
  const host = opt('--confirm-host');
  const dbUrl = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
  if (!host || !dbUrl.includes(host)) { console.error('--confirm-host não confere com o host do banco.'); process.exitCode = 1; return; }

  let newKey: string | null = null;
  if (art) {
    newKey = buildObjectKey(`${lodge.id}.${art.type}`, 'certificate-art');
    if (!(await putObject(newKey, Buffer.from(art.bytes), MIME[art.type]))) { console.error('Storage (R2) não configurado no .env.'); process.exitCode = 1; return; }
    console.log(`Arte enviada: ${newKey}`);
  }
  await prismaAdmin.lodge.update({
    where: { id: lodge.id },
    data: {
      certificateLayout: layout as object,
      ...(art && newKey ? { certificateArtKey: newKey, certificateArtType: art.type } : {}),
    },
  });
  if (newKey && lodge.certificateArtKey) await deleteObject(lodge.certificateArtKey).catch(() => {});
  console.log('Gravado. O "Modelo da loja" já aparece em Social → Certificados de presença.');
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => {
  const { prismaAdmin } = await import('../src/lib/prisma');
  await prismaAdmin.$disconnect().catch(() => {});
});
