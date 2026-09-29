import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { certificateEmail, normalizeTemplate, verificationUrl } from '@/lib/certificate';
import { buildCertificatePdf, ensureIssued, loadCertificateContext, sessionEnded } from '@/lib/certificate-server';
import { longDateBR } from '@/lib/letterhead';
import { buildLodgeChannels } from '@/lib/lodge-channels';
import { dispatch } from '@/lib/messaging';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { SESSION_TYPE_LABEL } from '@/lib/status-labels';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ visitId: string }> };

// Envia o certificado de presença por e-mail, em PDF anexo, ao irmão visitante. Só depois da
// sessão, com e-mail e consentimento registrados. Reenviar pede `resend: true` (a tela confirma).
export async function POST(request: Request, { params }: Ctx) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId || !session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(lodgeId, session.user.role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { visitId } = await params;
  const body = await request.json().catch(() => ({}));
  const template = normalizeTemplate(body?.modelo);

  const ctx = await loadCertificateContext(lodgeId, visitId);
  if (!ctx) return NextResponse.json({ error: 'Visita não encontrada.' }, { status: 404 });
  const v = ctx.visit.visitor;
  if (v.anonymizedAt) return NextResponse.json({ error: 'Os dados deste visitante foram excluídos (LGPD).' }, { status: 409 });
  if (!sessionEnded(ctx)) return NextResponse.json({ error: 'O certificado só é enviado depois do término da sessão.' }, { status: 409 });
  if (!v.email) return NextResponse.json({ error: 'Visitante sem e-mail: baixe o PDF e entregue em mãos.' }, { status: 409 });
  if (!v.consentAt) return NextResponse.json({ error: 'Sem consentimento registrado para o envio. Confirme na lista de presença e marque na sessão.' }, { status: 409 });
  if (ctx.visit.certificateSentAt && body?.resend !== true) {
    return NextResponse.json({ error: 'O certificado já foi enviado. Confirme para reenviar.', code: 'already-sent' }, { status: 409 });
  }

  const issued = await ensureIssued(lodgeId, visitId);
  const pdf = await buildCertificatePdf(ctx, template, issued);
  const mail = certificateEmail({
    visitorName: v.name,
    lodgeName: ctx.letterhead.name,
    sessionTypeLabel: SESSION_TYPE_LABEL[ctx.visit.session.type] ?? ctx.visit.session.type,
    sessionDate: longDateBR(ctx.visit.session.date),
    number: issued.number,
    url: verificationUrl(issued.code),
  });
  const result = await dispatch('email', v.email, mail.subject, mail.text, buildLodgeChannels({ name: ctx.letterhead.name, crestUrl: ctx.letterhead.crestUrl }), {
    attachments: [{ filename: `certificado-${issued.number}.pdf`, content: Buffer.from(pdf).toString('base64') }],
  });

  const status = result.status === 'sent' ? 'sent' : result.status === 'queued' ? 'queued' : 'failed';
  await withTenant(lodgeId, async (db) => {
    await db.sessionVisitor.update({
      where: { id: visitId },
      data: { certificateStatus: status, ...(status === 'failed' ? {} : { certificateSentAt: new Date() }) },
    });
    await db.messageLog.create({
      data: { lodgeId, channel: 'email', title: mail.subject, content: mail.text, status: result.status, error: result.detail ?? null, ref: `certificate:${visitId}` },
    });
    await logAudit(db, { lodgeId, userId: session.user.id, action: 'CREATE', entity: 'certificate', entityId: visitId, metadata: { number: issued.number, template, status } });
  });

  if (status === 'failed') return NextResponse.json({ error: result.detail ?? 'Falha ao enviar o e-mail. Tente de novo.' }, { status: 502 });
  return NextResponse.json({ success: true, number: issued.number, status });
}
