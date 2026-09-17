import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import CadastrosClient from './CadastrosClient';

// Server Component: ritos + potências. Plano de contas, clientes/fornecedores
// e contas bancárias/Caixa vivem em Cadastros financeiros (ver
// design_refinado.md, P2 "Cadastros mestre: escopo e dono") — esta página
// gira em torno do recurso RBAC 'members' (Secretaria).
export default async function CadastrosPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const data = lodgeId
    ? await withTenant(String(lodgeId), async (db) => ({
        rites: await db.rite.findMany({ where: { lodgeId: String(lodgeId) }, orderBy: { order: 'asc' } }),
        powers: await db.power.findMany({ where: { lodgeId: String(lodgeId) }, orderBy: { order: 'asc' } }),
      }))
    : { rites: [], powers: [] };

  const rites = data.rites.map((r) => ({ id: r.id, name: r.name, order: r.order }));
  const powers = data.powers.map((p) => ({ id: p.id, name: p.name, order: p.order }));

  return <CadastrosClient rites={rites} powers={powers} />;
}
