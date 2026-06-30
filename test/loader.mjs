// Loader de testes (node:test): resolve o alias "@/..." → src/... e adiciona
// resolução de extensão (.ts/.tsx/index) para imports sem extensão, para que os
// testes possam importar módulos da app que usam o alias do tsconfig.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(process.cwd(), 'src');
const EXTS = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx', '/index.js'];
const HAS_EXT = /\.(ts|tsx|js|mjs|cjs|json|node)$/;

function firstExisting(base) {
  for (const ext of EXTS) {
    const cand = base + ext;
    if (existsSync(cand)) return cand;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  // Alias do tsconfig: "@/..." → src/...
  if (specifier.startsWith('@/')) {
    const fsPath = firstExisting(path.join(SRC, specifier.slice(2)));
    if (fsPath) return { url: pathToFileURL(fsPath).href, shortCircuit: true };
  }
  // Imports relativos sem extensão (ex.: o Prisma client gerado importa "./enums").
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !HAS_EXT.test(specifier) && context.parentURL?.startsWith('file:')) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const fsPath = firstExisting(path.resolve(parentDir, specifier));
    if (fsPath) return { url: pathToFileURL(fsPath).href, shortCircuit: true };
  }
  return next(specifier, context);
}
