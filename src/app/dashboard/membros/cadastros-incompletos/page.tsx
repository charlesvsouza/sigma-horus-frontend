import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { getReportSignatories } from '@/lib/report-signatories';
import IncompleteClient from './IncompleteClient';

// CPF e e-mail são obrigatórios na prática: sem eles não há cobrança por e-mail nem emissão no Asaas.
// Mesma regra do indicador "Cadastros incompletos" da Visão geral (ativos, não falecidos).
export default async function IncompleteRecordsPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return <main className="min-h-screen px-6 py-10"><p className="text-sm text-sand-dark">Sessão expirada.</p></main>;
  const access = await requireLodgeAccess(String(lodgeId), role, 'members', 'read');
  if (!access.ok) return <main className="min-h-screen px-6 py-10"><p className="text-sm text-sand-dark">Acesso negado.</p></main>;

  const data = await withTenant(String(lodgeId), async (db) => {
    const [lodge, members, signatures] = await Promise.all([
      db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { name: true, crestUrl: true } }),
      db.member.findMany({
        where: { lodgeId: String(lodgeId), status: 'active', deceased: false },
        select: { id: true, name: true, cpf: true, email: true, phone: true },
        orderBy: { name: 'asc' },
      }),
      getReportSignatories(db, String(lodgeId), { by: 'secretary' }),
    ]);
    return { lodge, members, signatures };
  });

  const rows = data.members
    .map((m) => ({ id: m.id, name: m.name, noCpf: !m.cpf, noEmail: !m.email?.trim(), phone: m.phone?.trim() || null }))
    .filter((m) => m.noCpf || m.noEmail);

  return (
    <IncompleteClient
      lodgeName={data.lodge?.name ?? 'Loja'}
      crestUrl={data.lodge?.crestUrl ?? null}
      issuedBy={session?.user?.name ?? null}
      signatures={data.signatures}
      total={data.members.length}
      rows={rows}
    />
  );
}
