import { auth } from '@/lib/auth';
import { parseMemberFields, type MemberFields } from '@/lib/member-fields';
import { canLodgeAccess, requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Processo de admissão: cadastro, condução e iniciação são de quem edita
// membros (Administrador, Venerável, Secretário — members:write). Ler exige o
// mesmo: sindicância e pareceres são sigilosos, então o Tesoureiro (que só LÊ
// membros) não vê a ficha do processo — ele enxerga o candidato só como
// sacado nas telas da Tesouraria.
export async function candidateAccess(mode: 'read' | 'write') {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!session?.user || !lodgeId) return { ok: false as const, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  // members:write também para LER (ver o parágrafo acima) — mas a leitura não
  // passa pela trava de assinatura vencida, que requireLodgeAccess aplica à escrita.
  if (mode === 'read') {
    if (!(await canLodgeAccess(String(lodgeId), session.user.role, 'members', 'write'))) {
      return { ok: false as const, res: NextResponse.json({ error: 'Acesso negado.' }, { status: 403 }) };
    }
    return { ok: true as const, session, lodgeId: String(lodgeId) };
  }
  const access = await requireLodgeAccess(String(lodgeId), session.user.role, 'members', 'write');
  if (!access.ok) return { ok: false as const, res: NextResponse.json({ error: access.error }, { status: access.status }) };
  return { ok: true as const, session, lodgeId: String(lodgeId) };
}

// Dados pessoais do candidato editáveis na ficha (sem campos maçônicos). As
// observações ficam no processo (CandidateProcess.notes), não no cadastro.
export const CANDIDATE_FIELDS = [
  'name', 'email', 'phone', 'cpf', 'rg', 'birthDate', 'maritalStatus', 'occupation', 'nationality',
  'addressLine', 'addressNumber', 'complement', 'neighborhood', 'city', 'state', 'zipCode', 'country',
] as const satisfies readonly (keyof MemberFields)[];

/** Só as chaves de CANDIDATE_FIELDS presentes no body (PATCH parcial). */
export function parseCandidateFields(body: Record<string, unknown>): Partial<MemberFields> {
  const full = parseMemberFields(body);
  const out: Record<string, unknown> = {};
  for (const key of CANDIDATE_FIELDS) if (Object.prototype.hasOwnProperty.call(body, key)) out[key] = full[key];
  return out as Partial<MemberFields>;
}

export const CANDIDATE_INCLUDE = {
  candidateProcess: {
    include: {
      proposer: { select: { id: true, name: true } },
      inquirers: { include: { member: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' as const } },
    },
  },
  user: { select: { id: true, status: true, mustChangePassword: true } },
} as const;
