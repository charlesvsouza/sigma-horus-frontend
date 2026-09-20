import { auth } from '@/lib/auth';
import { canLodgeAccess } from '@/lib/rbac';
import ImportarFinanceiroClient from './ImportarFinanceiroClient';

// Server Component: só decide se mostra a tela. A permissão real (escrita em Contas) é
// sempre reconferida pelas rotas /api/import/financial/*.
export default async function ImportarFinanceiroPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const allowed = !!lodgeId && (await canLodgeAccess(lodgeId, session?.user?.role, 'accounts', 'write'));

  return <ImportarFinanceiroClient denied={!allowed} />;
}
