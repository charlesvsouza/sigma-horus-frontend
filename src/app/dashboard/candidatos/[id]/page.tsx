import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { canLodgeAccess } from '@/lib/rbac';
import FichaCandidatoClient from './FichaCandidatoClient';

// Ficha do candidato: dados pessoais, etapas do processo, sindicantes, pasta de
// documentos (sigilosa), acesso ao portal e o registro da iniciação.
export default async function FichaCandidatoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const denied = (text: string) => (
    <main className="min-h-screen px-6 py-10">
      <p className="text-sm text-sand-dark">{text}</p>
    </main>
  );
  if (!lodgeId) return denied('Sessão expirada.');
  if (!(await canLodgeAccess(lodgeId, session?.user?.role, 'members', 'write'))) return denied('Acesso restrito ao Administrador, ao Venerável e à Secretaria.');

  const { brothers, lodgeName } = await withTenant(lodgeId, async (db) => ({
    brothers: await db.member.findMany({ where: { lodgeId, status: 'active' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    lodgeName: (await db.lodge.findUnique({ where: { id: lodgeId }, select: { name: true } }))?.name ?? '',
  }));

  return <FichaCandidatoClient id={id} brothers={brothers} lodgeName={lodgeName} />;
}
