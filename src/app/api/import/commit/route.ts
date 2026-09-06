import { PutObjectCommand } from '@aws-sdk/client-s3';
import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { parseMemberFields } from '@/lib/member-fields';
import {
  applyMapping,
  parseSpreadsheet,
  resolveByName,
  scoreMapping,
  type FieldMapping,
} from '@/lib/member-import';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { backfillMemberRelatives } from '@/lib/relatives-backfill';
import { buildObjectKey, getR2Client, getR2StorageSettings } from '@/lib/storage';
import { NextResponse } from 'next/server';

// Passo final do wizard de importação — a ÚNICA rota que grava dados. Reexecuta
// o parsing/mapeamento no servidor (não confia nas linhas já transformadas
// que o navegador possa ter enviado) e faz valer o portão de "uma vez só":
// só roda se a loja ainda não tiver nenhum membro, exceto quando acionada
// pelo dono da plataforma (x-platform-token) para uma nova migração pontual.
function platformAuthorized(request: Request): boolean {
  const token = process.env.PLATFORM_OWNER_TOKEN;
  if (!token) return false;
  const header = request.headers.get('x-platform-token') ?? '';
  return header.length > 0 && header === token;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file');
  const mappingRaw = formData.get('mapping');
  const overrideLodgeId = formData.get('lodgeId') ? String(formData.get('lodgeId')) : null;

  const session = await auth();
  const role = session?.user?.role;
  const isPlatform = platformAuthorized(request);
  let lodgeId: string | null = null;
  let userId: string | null = null;

  if (isPlatform && overrideLodgeId) {
    lodgeId = overrideLodgeId;
    userId = 'platform-owner';
  } else if (session?.user?.lodgeId) {
    lodgeId = String(session.user.lodgeId);
    userId = session.user.id;
    const access = await requireLodgeAccess(lodgeId, role, 'import', 'write');
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  }

  if (!lodgeId || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: 'Envie um arquivo CSV ou Excel (.xlsx).' }, { status: 400 });
  }
  if (!mappingRaw) {
    return NextResponse.json({ error: 'Mapeamento de colunas ausente.' }, { status: 400 });
  }

  let mapping: FieldMapping;
  try {
    mapping = JSON.parse(String(mappingRaw)) as FieldMapping;
  } catch {
    return NextResponse.json({ error: 'Mapeamento inválido.' }, { status: 400 });
  }
  if (mapping.nameIndex == null) {
    return NextResponse.json({ error: 'Selecione a coluna de nome antes de confirmar a importação.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { headers, rows } = await parseSpreadsheet({ name: file.name, type: file.type, buffer });
  const applied = applyMapping(headers, rows, mapping);

  if (applied.importableRows === 0) {
    return NextResponse.json({ error: 'Nenhuma linha válida para importar (nenhuma tem nome preenchido).' }, { status: 400 });
  }

  const finalLodgeId = lodgeId;
  const finalUserId = userId;

  const result = await withTenant(finalLodgeId, async (db) => {
    const existingCount = await db.member.count({ where: { lodgeId: finalLodgeId } });
    if (existingCount > 0 && !isPlatform) {
      return null; // sinaliza "locked" para o caller, sem lançar (mantém a transação limpa)
    }

    const [rites, powers] = await Promise.all([
      db.rite.findMany({ where: { lodgeId: finalLodgeId }, select: { id: true, name: true } }),
      db.power.findMany({ where: { lodgeId: finalLodgeId }, select: { id: true, name: true } }),
    ]);

    const data = applied.rows.map((r) => {
      const body: Record<string, unknown> = { ...r.body };
      if (r.riteName) {
        const match = resolveByName(r.riteName, rites);
        if (match.id) body.riteId = match.id;
      }
      if (r.powerName) {
        const match = resolveByName(r.powerName, powers);
        if (match.id) body.powerId = match.id;
      }
      return { lodgeId: finalLodgeId, ...parseMemberFields(body) };
    });

    const created = await db.member.createMany({ data });
    const relatives = await backfillMemberRelatives(db, finalLodgeId);

    await logAudit(db, {
      lodgeId: finalLodgeId,
      userId: finalUserId,
      action: 'CREATE',
      entity: 'member',
      entityId: 'import',
      metadata: {
        fileName: file.name,
        totalRows: applied.totalRows,
        imported: created.count,
        skippedRows: applied.rowIssues.filter((i) => i.severity === 'error').length,
        warnings: applied.rowIssues.filter((i) => i.severity === 'warning').length,
        score: scoreMapping(mapping.fields).score,
        relativesCreated: relatives.relativesCreated,
        byPlatformOwner: isPlatform,
      },
    });

    return { imported: created.count, relativesCreated: relatives.relativesCreated };
  });

  if (result === null) {
    return NextResponse.json(
      { error: 'A importação inicial já foi utilizada para esta loja. Contate o suporte para uma nova migração.', locked: true },
      { status: 403 },
    );
  }

  // Guarda o arquivo original no R2 para auditoria (melhor esforço — não
  // derruba a importação, que já foi gravada com sucesso, se o storage falhar).
  let storageKey: string | null = null;
  const settings = getR2StorageSettings();
  const client = getR2Client(settings);
  if (client && settings.bucket) {
    try {
      storageKey = buildObjectKey(file.name, `imports/${finalLodgeId}`);
      await client.send(new PutObjectCommand({
        Bucket: settings.bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream',
      }));
    } catch (error) {
      console.error('R2 import backup upload failed', error);
      storageKey = null;
    }
  }

  return NextResponse.json({
    ok: true,
    stats: {
      totalRows: applied.totalRows,
      imported: result.imported,
      skippedRows: applied.rowIssues.filter((i) => i.severity === 'error').length,
      warnings: applied.rowIssues.filter((i) => i.severity === 'warning').length,
    },
    relativesCreated: result.relativesCreated,
    storageKey,
  });
}
