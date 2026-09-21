import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { canLodgeAccess, requireLodgeAccess } from '@/lib/rbac';
import { degreeShort } from '@/lib/masonic-degree';
import ComposicaoClient from './ComposicaoClient';

// Composição da loja: todos os obreiros que desempenham cargos no período
// escolhido (por padrão, o veneralato em exercício), com o(s) cargo(s) de cada
// um, grau e contato — e os cargos ainda sem titular. Complementa o Quadro da
// Gestão (que é o mural com fotos, um cartão por cargo).
export default async function ComposicaoPage({ searchParams }: { searchParams: Promise<{ termo?: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) {
    return (
      <main className="min-h-screen px-6 py-10">
        <p className="text-sm text-sand-dark">Sessão expirada.</p>
      </main>
    );
  }

  const access = await requireLodgeAccess(String(lodgeId), role, 'social', 'read');
  if (!access.ok) {
    return (
      <main className="min-h-screen px-6 py-10">
        <p className="text-sm text-sand-dark">Acesso negado.</p>
      </main>
    );
  }

  const { termo } = await searchParams;
  // Telefone e e-mail são dado de cadastro: só quem lê Membros os recebe.
  const canSeeContacts = await canLodgeAccess(String(lodgeId), role, 'members', 'read');
  const canManage = await canLodgeAccess(String(lodgeId), role, 'members', 'write');

  const data = await withTenant(String(lodgeId), async (db) => {
    const [lodge, terms] = await Promise.all([
      db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { name: true, crestUrl: true } }),
      db.term.findMany({
        where: { lodgeId: String(lodgeId) },
        select: { id: true, title: true, startDate: true, endDate: true, status: true },
        orderBy: { startDate: 'desc' },
      }),
    ]);

    // Período pedido na URL (se for da loja) → o em exercício → o mais recente.
    const selected = terms.find((t) => t.id === termo) ?? terms.find((t) => t.status === 'active') ?? terms[0] ?? null;
    if (!selected) return { lodge, terms, selected: null, holders: [], vacant: [] };

    const holders = await db.memberOffice.findMany({
      where: { lodgeId: String(lodgeId), termId: selected.id },
      include: {
        office: { select: { id: true, name: true, order: true } },
        member: {
          select: {
            id: true, name: true, photoUrl: true, phone: true, email: true, status: true,
            initiationDate: true, elevationDate: true, exaltationDate: true, installationDate: true,
            currentDegree: true, gradeName: true,
          },
        },
      },
    });
    const vacant = await db.office.findMany({
      where: { lodgeId: String(lodgeId), id: { notIn: holders.map((h) => h.officeId) } },
      select: { id: true, name: true, order: true, rite: { select: { name: true } } },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
    return { lodge, terms, selected, holders, vacant };
  });

  // Um obreiro pode acumular cargos: agrupa por membro, com os cargos em ordem
  // hierárquica; a lista sai na ordem do cargo mais alto de cada um.
  const byMember = new Map<string, { id: string; name: string; photoUrl: string | null; phone: string | null; email: string | null; status: string; degree: string; offices: { id: string; name: string; order: number }[] }>();
  for (const h of data.holders) {
    const m = h.member;
    const row = byMember.get(m.id) ?? {
      id: m.id,
      name: m.name,
      photoUrl: m.photoUrl,
      phone: canSeeContacts ? m.phone : null,
      email: canSeeContacts ? m.email : null,
      status: m.status,
      degree: degreeShort(m),
      offices: [],
    };
    row.offices.push(h.office);
    byMember.set(m.id, row);
  }
  const members = [...byMember.values()]
    .map((m) => ({ ...m, offices: [...m.offices].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.offices[0].order - b.offices[0].order || a.name.localeCompare(b.name));

  return (
    <ComposicaoClient
      lodgeName={data.lodge?.name ?? 'Loja'}
      crestUrl={data.lodge?.crestUrl ?? null}
      terms={data.terms.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        startDate: t.startDate.toISOString(),
        endDate: t.endDate ? t.endDate.toISOString() : null,
      }))}
      selectedTermId={data.selected?.id ?? null}
      members={members}
      showContacts={canSeeContacts}
      canManage={canManage}
      vacant={data.vacant.map((o) => ({ id: o.id, name: o.name, riteName: o.rite?.name ?? null }))}
    />
  );
}
