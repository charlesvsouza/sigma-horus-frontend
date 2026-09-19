import { PutObjectCommand } from '@aws-sdk/client-s3';
import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { buildObjectKey, deleteObject, getR2Client, getR2StorageSettings } from '@/lib/storage';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

// Balaustre/ata da sessão: importado como arquivo (PDF/Word), não digitado no
// sistema. Vai pro bucket PRIVADO de Documentos (nunca público) — o membro
// baixa por URL assinada de curta duração (ver ./download/route.ts).
const ALLOWED_MIME = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

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

  const previous = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.session.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { minutesStorageKey: true, locked: true } });
    if (!existing) return undefined;
    if (existing.locked) return { locked: true as const };
    // Salvar o balaustre tranca a sessão automaticamente — protege os registros
    // (presença, agenda, o próprio balaustre) contra edição a partir daqui;
    // só Administrador/Venerável destranca (ver ./../unlock/route.ts).
    await db.session.update({
      where: { id },
      data: { minutesStorageKey: storageKey, minutesFileName: file.name, minutesMimeType: file.type, locked: true, lockedAt: new Date(), lockedById: session!.user.id },
    });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session!.user.id, action: 'UPDATE', entity: 'session', entityId: id, metadata: { field: 'minutes', autoLocked: true } });
    return existing;
  });

  if (previous === undefined) {
    await deleteObject(storageKey).catch(() => {});
    return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 });
  }
  if ('locked' in previous && previous.locked) {
    await deleteObject(storageKey).catch(() => {});
    return NextResponse.json({ error: 'Sessão trancada — peça ao Venerável ou Administrador para destrancar.' }, { status: 423 });
  }
  if (previous?.minutesStorageKey) {
    await deleteObject(previous.minutesStorageKey).catch(() => {});
  }

  return NextResponse.json({ ok: true, fileName: file.name });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const previous = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.session.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { minutesStorageKey: true, locked: true } });
    if (!existing) return undefined;
    if (existing.locked) return { locked: true as const };
    await db.session.update({ where: { id }, data: { minutesStorageKey: null, minutesFileName: null, minutesMimeType: null } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session!.user.id, action: 'UPDATE', entity: 'session', entityId: id, metadata: { field: 'minutes', removed: true } });
    return existing;
  });

  if (previous === undefined) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 });
  if ('locked' in previous && previous.locked) {
    return NextResponse.json({ error: 'Sessão trancada — peça ao Venerável ou Administrador para destrancar.' }, { status: 423 });
  }
  if (previous?.minutesStorageKey) {
    await deleteObject(previous.minutesStorageKey).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
