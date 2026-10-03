import { PutObjectCommand } from '@aws-sdk/client-s3';
import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { lockKey } from '@/lib/locks';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { allMinutesUploaded, resolveMinutesDegree } from '@/lib/session-minutes';
import { buildObjectKey, deleteObject, getR2Client, getR2StorageSettings } from '@/lib/storage';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

// Balaustre/ata da sessão: importado como arquivo (PDF/Word), não digitado no sistema — UM POR GRAU
// trabalhado (a sessão que sobe aos três graus pode ter até três). Vai pro bucket PRIVADO de
// Documentos (nunca público) — o membro baixa por URL assinada de curta duração (ver ./download/route.ts),
// e só o balaustre do grau dele ou de grau inferior.
const ALLOWED_MIME = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

const LOCKED = 'Sessão trancada — peça ao Venerável ou Administrador para destrancar.';

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: 'Envie o arquivo como formulário (multipart).' }, { status: 400 });
  const file = formData.get('file');
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: 'Selecione um arquivo.' }, { status: 400 });
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: 'O balaustre precisa ser um PDF ou Word (.pdf, .doc, .docx).' }, { status: 400 });
  }

  // Confere a sessão e o grau ANTES de subir o arquivo (não deixa objeto órfão no storage).
  const target = await withTenant(String(lodgeId), (db) => db.session.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { degrees: true, grade: true, locked: true } }));
  if (!target) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 });
  if (target.locked) return NextResponse.json({ error: LOCKED }, { status: 423 });
  const resolved = resolveMinutesDegree(target, formData.get('degree'));
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });
  const degree = resolved.degree;

  const settings = getR2StorageSettings();
  const client = getR2Client(settings);
  if (!client || !settings.bucket) {
    return NextResponse.json({ error: 'Configuração de storage incompleta.' }, { status: 500 });
  }

  const storageKey = buildObjectKey(file.name, 'session-minutes');

  try {
    await client.send(new PutObjectCommand({
      Bucket: settings.bucket,
      Key: storageKey,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type,
    }));
  } catch (error) {
    console.error('R2 upload failed (session minutes)', error);
    return NextResponse.json({ error: 'Falha ao enviar o arquivo para o storage.' }, { status: 500 });
  }

  const outcome = await withTenant(String(lodgeId), async (db) => {
    await lockKey(db, `session-minutes:${id}`);
    const current = await db.session.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { degrees: true, grade: true, locked: true, minutesFiles: { select: { degree: true, storageKey: true } } } });
    if (!current) return { missing: true } as const;
    if (current.locked) return { locked: true } as const;

    const previousKey = current.minutesFiles.find((m) => m.degree === degree)?.storageKey ?? null;
    await db.sessionMinutes.upsert({
      where: { sessionId_degree: { sessionId: id, degree } },
      create: { lodgeId: String(lodgeId), sessionId: id, degree, storageKey, fileName: file.name, mimeType: file.type, uploadedById: session!.user.id },
      update: { storageKey, fileName: file.name, mimeType: file.type, uploadedById: session!.user.id },
    });

    // Com o balaustre de TODOS os graus trabalhados, a sessão tranca sozinha — protege os registros
    // (presença, agenda, os balaustres) contra edição; só Administrador/Venerável destranca (./../unlock).
    const degreesDone = [...new Set([...current.minutesFiles.map((m) => m.degree), degree])];
    const lockNow = allMinutesUploaded(current, degreesDone);
    if (lockNow) {
      await db.session.update({ where: { id }, data: { locked: true, lockedAt: new Date(), lockedById: session!.user.id } });
    }
    await logAudit(db, { lodgeId: String(lodgeId), userId: session!.user.id, action: 'UPDATE', entity: 'session', entityId: id, metadata: { field: 'minutes', degree, autoLocked: lockNow } });
    return { ok: true, previousKey, autoLocked: lockNow } as const;
  });

  if (!('ok' in outcome)) {
    await deleteObject(storageKey).catch(() => {});
    return 'missing' in outcome
      ? NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 })
      : NextResponse.json({ error: LOCKED }, { status: 423 });
  }
  if (outcome.previousKey) {
    await deleteObject(outcome.previousKey).catch(() => {});
  }

  return NextResponse.json({ ok: true, degree, fileName: file.name, locked: outcome.autoLocked });
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const degreeParam = new URL(request.url).searchParams.get('degree');

  const outcome = await withTenant(String(lodgeId), async (db) => {
    const current = await db.session.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { degrees: true, grade: true, locked: true } });
    if (!current) return { missing: true } as const;
    if (current.locked) return { locked: true } as const;
    const resolved = resolveMinutesDegree(current, degreeParam);
    if (!resolved.ok) return { invalid: resolved.error } as const;
    const existing = await db.sessionMinutes.findUnique({ where: { sessionId_degree: { sessionId: id, degree: resolved.degree } }, select: { storageKey: true } });
    if (!existing) return { none: true } as const;
    await db.sessionMinutes.delete({ where: { sessionId_degree: { sessionId: id, degree: resolved.degree } } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session!.user.id, action: 'UPDATE', entity: 'session', entityId: id, metadata: { field: 'minutes', degree: resolved.degree, removed: true } });
    return { ok: true, key: existing.storageKey } as const;
  });

  if ('missing' in outcome) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 });
  if ('locked' in outcome) return NextResponse.json({ error: LOCKED }, { status: 423 });
  if ('invalid' in outcome) return NextResponse.json({ error: outcome.invalid }, { status: 400 });
  if ('none' in outcome) return NextResponse.json({ error: 'Não há balaustre deste grau.' }, { status: 404 });

  await deleteObject(outcome.key).catch(() => {});
  return NextResponse.json({ ok: true });
}
