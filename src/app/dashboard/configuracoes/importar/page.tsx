import { auth } from '@/lib/auth';
import { normalizeRole } from '@/lib/rbac';
import ImportarClient from './ImportarClient';

// Server Component: checa só a loja/papel do usuário. A permissão real é
// sempre reconferida no servidor pelas rotas /api/import/*; isto aqui é só a UX.
// Reimportar com a loja já tendo membros é permitido — a rota /api/import/analyze
// classifica cada linha contra o cadastro atual (novo/já existe/ambíguo) e o
// wizard usa isso para nunca duplicar quem já existe.
export default async function ImportarPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = normalizeRole(session?.user?.role);
  const allowed = !!lodgeId && (role === 'admin' || role === 'secretary');

  return <ImportarClient denied={!allowed} />;
}
