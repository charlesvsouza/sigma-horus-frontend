import { auth } from '@/lib/auth';
import { requireLodgeAccess } from '@/lib/rbac';
import { loadSessionSheet } from '@/lib/session-sheets-server';
import SessionSheetClient from '../SessionSheetClient';

// Lista de presença de visitantes (em branco) para os irmãos visitantes preencherem na sessão.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const denied = (text: string) => (
    <main className="min-h-screen px-6 py-10">
      <p className="text-sm text-sand-dark">{text}</p>
    </main>
  );
  if (!lodgeId) return denied('Sessão expirada.');
  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'members', 'read');
  if (!access.ok) return denied('Acesso restrito à Secretaria.');

  const data = await loadSessionSheet(lodgeId, id);
  if (!data) return denied('Sessão não encontrada.');
  return <SessionSheetClient kind="visitors" sessionId={id} data={data} issuedBy={session?.user?.name ?? null} />;
}
