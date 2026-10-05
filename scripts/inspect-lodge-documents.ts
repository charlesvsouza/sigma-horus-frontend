/**
 * SOMENTE LEITURA. Lista os documentos cadastrados na plataforma (metadados) e, com --save <pasta>,
 * baixa do storage os que casam com o filtro de título (regimento, regulamento, estatuto...).
 * Uso: env -u DATABASE_URL -u APP_DATABASE_URL npx tsx --env-file=.env scripts/inspect-lodge-documents.ts [slug] [--save pasta]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { prismaAdmin } from '../src/lib/prisma';
import { getObjectBuffer } from '../src/lib/storage';

async function main() {
  const args = process.argv.slice(2);
  const saveIdx = args.indexOf('--save');
  const saveDir = saveIdx >= 0 ? args[saveIdx + 1] : null;
  const slug = args.find((a, i) => !a.startsWith('--') && i !== saveIdx + 1);
  const lodges = await prismaAdmin.lodge.findMany({ where: slug ? { slug } : {}, select: { id: true, name: true, slug: true } });
  for (const lodge of lodges) {
    const docs = await prismaAdmin.document.findMany({
      where: { lodgeId: lodge.id, memberId: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true, kind: true, category: true, minDegree: true, fileName: true, mimeType: true, storageKey: true, content: true, createdAt: true },
    });
    console.log(`\n=== ${lodge.name} (${lodge.slug}): ${docs.length} documento(s) institucional(is)`);
    for (const d of docs) {
      console.log(`${d.createdAt.toISOString().slice(0, 10)} | ${d.category ?? '-'} | grau ${d.minDegree ?? 'todos'} | ${d.title} | ${d.fileName ?? '-'} | ${d.mimeType ?? '-'} | ${d.storageKey ? 'arquivo' : d.content ? 'texto' : 'vazio'}`);
      if (saveDir && d.storageKey) {
        const buf = await getObjectBuffer(d.storageKey);
        if (!buf) { console.log('   (não encontrado no storage)'); continue; }
        mkdirSync(saveDir, { recursive: true });
        const out = join(saveDir, `${lodge.slug}__${d.id}__${(d.fileName ?? 'doc').replace(/[^\w.\-]+/g, '_')}`);
        writeFileSync(out, buf);
        console.log(`   salvo: ${out} (${buf.length} bytes)`);
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prismaAdmin.$disconnect());
