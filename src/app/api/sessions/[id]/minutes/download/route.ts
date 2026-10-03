import { auth } from '@/lib/auth';
import { loadDocumentViewer } from '@/lib/documents-server';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { canViewMinutes } from '@/lib/session-minutes';
import { getPresignedDownloadUrl } from '@/lib/storage';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

// Download do balaustre por membro da loja — gate por "portal" (não "members"), que é o resource que o
// papel member realmente tem (mesmo padrão de /api/portal/agenda). Um balaustre por grau (?degree=1|2|3):
// cada irmão baixa o do grau dele ou de grau inferior; quem envia documentos vê todos; candidato nenhum.
export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'portal', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const degreeParam = new URL(request.url).searchParams.get('degree');

  const found = await withTenant(String(lodgeId), async (db) => ({
    files: await db.sessionMinutes.findMany({ where: { sessionId: id, lodgeId: String(lodgeId) }, select: { degree: true, storageKey: true }, orderBy: { degree: 'asc' } }),
    viewer: await loadDocumentViewer(db, String(lodgeId), session),
  }));

  // Ata é do obreiro: o candidato (profano) não a baixa; cada um só vê o balaustre do seu grau para baixo.
  const visible = found.files.filter((f) => canViewMinutes(f.degree, found.viewer));
  const chosen = degreeParam ? visible.find((f) => f.degree === Number(degreeParam)) : visible.length === 1 ? visible[0] : undefined;

  if (!chosen) {
    // Sem ?degree e com vários balaustres: diz qual escolher, em vez de adivinhar.
    if (!degreeParam && visible.length > 1) {
      return NextResponse.json({ error: 'Esta sessão tem balaustres de mais de um grau. Informe o grau (?degree=1, 2 ou 3).', degrees: visible.map((f) => f.degree) }, { status: 400 });
    }
    return NextResponse.json({ error: 'Balaustre não encontrado.' }, { status: 404 });
  }

  const url = await getPresignedDownloadUrl(chosen.storageKey);
  if (!url) {
    return NextResponse.json({ error: 'Storage indisponível.' }, { status: 503 });
  }

  return NextResponse.redirect(url);
}
