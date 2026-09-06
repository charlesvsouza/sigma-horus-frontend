import { auth } from '@/lib/auth';
import { normalizeRole } from '@/lib/rbac';
import { withTenant } from '@/lib/prisma';
import ImportarClient from './ImportarClient';

// Server Component: checa a loja do usuário e se ela já tem membros (portão
// de "uma vez só" do wizard de importação). A liberação real é sempre
// reconferida no servidor pelas rotas /api/import/*; isto aqui é só a UX.
export default async function ImportarPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = normalizeRole(session?.user?.role);
  const allowed = !!lodgeId && (role === 'admin' || role === 'secretary');

  if (!allowed) {
    return <ImportarClient denied locked={false} />;
  }

  const memberCount = await withTenant(String(lodgeId), (db) => db.member.count({ where: { lodgeId: String(lodgeId) } }));

  return <ImportarClient denied={false} locked={memberCount > 0} />;
}
