import { auth } from '@/lib/auth';
import { normalizeTemplate } from '@/lib/certificate';
import { buildCertificatePdf, ensureIssued, loadCertificateContext, sessionEnded } from '@/lib/certificate-server';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ visitId: string }> };

// PDF do certificado de presença de uma visita.
//  ?preview=1 → prévia (marca d'água, sem número nem QR) — não emite nada.
//  sem preview → emite (número + código, se ainda não tem) e devolve o certificado para baixar
//                (ex.: visitante sem e-mail recebe em mãos).
// ?modelo=classico|pergaminho.
export async function GET(request: Request, { params }: Ctx) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { visitId } = await params;
  const url = new URL(request.url);
  const preview = url.searchParams.get('preview') === '1';
  const template = normalizeTemplate(url.searchParams.get('modelo'));

  const ctx = await loadCertificateContext(lodgeId, visitId);
  if (!ctx) return NextResponse.json({ error: 'Visita não encontrada.' }, { status: 404 });
  if (ctx.visit.visitor.anonymizedAt) return NextResponse.json({ error: 'Os dados deste visitante foram excluídos (LGPD).' }, { status: 409 });
  if (!preview && !sessionEnded(ctx)) return NextResponse.json({ error: 'O certificado só é emitido depois do término da sessão.' }, { status: 409 });

  const issued = preview ? null : await ensureIssued(lodgeId, visitId);
  const pdf = await buildCertificatePdf(ctx, template, issued);
  const name = issued ? `certificado-${issued.number}.pdf` : 'certificado-previa.pdf';
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${preview ? 'inline' : 'attachment'}; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  });
}
