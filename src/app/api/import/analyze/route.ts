import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import {
  TARGET_FIELDS,
  applyMapping,
  detectMapping,
  parseSpreadsheet,
  resolveByName,
  scoreMapping,
  type FieldMapping,
} from '@/lib/member-import';
import { NextResponse } from 'next/server';

// Passo 1 do wizard de importação (somente leitura — não grava nada). Recebe o
// arquivo e, opcionalmente, um mapeamento já ajustado pelo admin (para
// recalcular a % depois de um ajuste manual). Reaproveitado tanto na 1ª
// análise (auto-detecção) quanto nas reanálises seguintes.
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

  if (isPlatform && overrideLodgeId) {
    lodgeId = overrideLodgeId;
  } else if (session?.user?.lodgeId) {
    lodgeId = String(session.user.lodgeId);
    const access = await requireLodgeAccess(lodgeId, role, 'import', 'read');
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  }

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: 'Envie um arquivo CSV ou Excel (.xlsx).' }, { status: 400 });
  }

  const memberCount = await withTenant(lodgeId, (db) => db.member.count({ where: { lodgeId } }));
  if (memberCount > 0 && !isPlatform) {
    return NextResponse.json(
      { error: 'A importação inicial não está mais disponível: esta loja já possui membros cadastrados.', locked: true },
      { status: 403 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { headers, rows } = await parseSpreadsheet({ name: file.name, type: file.type, buffer });
  if (headers.length === 0) {
    return NextResponse.json({ error: 'Não foi possível ler nenhuma coluna neste arquivo.' }, { status: 400 });
  }

  let mapping: FieldMapping;
  try {
    mapping = mappingRaw ? (JSON.parse(String(mappingRaw)) as FieldMapping) : detectMapping(headers);
  } catch {
    return NextResponse.json({ error: 'Mapeamento inválido.' }, { status: 400 });
  }

  const { score, matchedCount, totalCount } = scoreMapping(mapping.fields);

  if (mapping.nameIndex == null) {
    return NextResponse.json({
      aborted: true,
      headers,
      mapping,
      score: 0,
      matchedCount,
      totalCount,
      totalRows: rows.length,
      abortReason:
        'Não foi possível identificar a coluna com o nome do membro. Selecione manualmente a coluna correta acima ou envie um arquivo diferente para uma nova análise.',
      targetFields: TARGET_FIELDS.map(({ field, label, tier }) => ({ field, label, tier })),
    });
  }

  const [rites, powers] = await withTenant(lodgeId, (db) =>
    Promise.all([
      db.rite.findMany({ where: { lodgeId }, select: { id: true, name: true } }),
      db.power.findMany({ where: { lodgeId }, select: { id: true, name: true } }),
    ]),
  );

  const applied = applyMapping(headers, rows, mapping);

  const unmatchedRites = new Set<string>();
  const unmatchedPowers = new Set<string>();
  for (const r of applied.rows) {
    if (r.riteName && !resolveByName(r.riteName, rites).matched) unmatchedRites.add(r.riteName);
    if (r.powerName && !resolveByName(r.powerName, powers).matched) unmatchedPowers.add(r.powerName);
  }

  return NextResponse.json({
    aborted: false,
    headers,
    mapping,
    score,
    matchedCount,
    totalCount,
    totalRows: applied.totalRows,
    importableRows: applied.importableRows,
    rowIssues: applied.rowIssues,
    preview: applied.rows.slice(0, 10).map((r) => ({ row: r.row, name: String(r.body.name ?? '') })),
    riteOptions: rites,
    powerOptions: powers,
    unmatchedRites: [...unmatchedRites],
    unmatchedPowers: [...unmatchedPowers],
    targetFields: TARGET_FIELDS.map(({ field, label, tier }) => ({ field, label, tier })),
  });
}
