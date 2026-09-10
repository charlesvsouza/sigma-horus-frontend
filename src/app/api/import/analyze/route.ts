import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import {
  TARGET_FIELDS,
  applyMapping,
  classifyRows,
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
// análise (auto-detecção) quanto nas reanálises seguintes. Quando a loja já
// tem membros, também classifica cada linha (novo/já existe/ambíguo, por CPF —
// ver classifyRows) para a tela de revisão decidir o que entra.
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

  const [rites, powers, existingMembers] = await withTenant(lodgeId, (db) =>
    Promise.all([
      db.rite.findMany({ where: { lodgeId }, select: { id: true, name: true } }),
      db.power.findMany({ where: { lodgeId }, select: { id: true, name: true } }),
      db.member.findMany({ where: { lodgeId }, select: { id: true, cpf: true } }),
    ]),
  );

  const applied = applyMapping(headers, rows, mapping);

  const unmatchedRites = new Set<string>();
  const unmatchedPowers = new Set<string>();
  for (const r of applied.rows) {
    if (r.riteName && !resolveByName(r.riteName, rites).matched) unmatchedRites.add(r.riteName);
    if (r.powerName && !resolveByName(r.powerName, powers).matched) unmatchedPowers.add(r.powerName);
  }

  // Loja já tem membros: classifica cada linha por CPF pra tela de revisão
  // decidir o que é novo, o que já existe (pulado, nunca atualizado) e o que
  // ficou ambíguo (sem CPF em algum dos lados — exige decisão manual).
  const classified = existingMembers.length > 0 ? classifyRows(applied.rows, existingMembers) : null;
  const matchSummary = classified
    ? {
        new: classified.filter((r) => r.matchStatus === 'new').length,
        duplicate: classified.filter((r) => r.matchStatus === 'duplicate').length,
        ambiguous: classified.filter((r) => r.matchStatus === 'ambiguous').length,
      }
    : null;

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
    existingMemberCount: existingMembers.length,
    matchSummary,
    duplicateRows: classified
      ? classified.filter((r) => r.matchStatus === 'duplicate').map((r) => ({ row: r.row, name: String(r.body.name ?? '') }))
      : [],
    ambiguousRows: classified
      ? classified.filter((r) => r.matchStatus === 'ambiguous').map((r) => ({ row: r.row, name: String(r.body.name ?? '') }))
      : [],
  });
}
