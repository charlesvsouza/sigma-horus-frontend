import { auth } from '@/lib/auth';
import { requireLodgeAccess } from '@/lib/rbac';
import { loadSessionSheet } from '@/lib/session-sheets-server';
import { ensureSessionQr } from '@/lib/tronco-qr-server';
import SessionSheetClient from '../SessionSheetClient';

// Lista de presença de visitantes (em branco) para os irmãos visitantes preencherem na sessão.
// `?preenchida=1`: a mesma folha com os visitantes já digitados na sessão (para arquivo).
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ preenchida?: string }> }) {
  const { id } = await params;
  const filled = (await searchParams).preenchida === '1';
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
  // QR Pix do Tronco da sessão (Modo Asaas): impresso na folha para o doador escanear. Vale até 00:00 do dia da sessão.
  const qr = await ensureSessionQr(lodgeId, id, 'visitors');
  const troncoQr = qr.state === 'active' && qr.dataUrl && qr.expiresAt ? { dataUrl: qr.dataUrl, expiresAt: qr.expiresAt.toISOString(), identifier: qr.identifier ?? null, provider: qr.provider ?? 'asaas' } : null;
  return <SessionSheetClient kind="visitors" sessionId={id} data={data} issuedBy={session?.user?.name ?? null} filled={filled} troncoQr={filled ? null : troncoQr} />;
}
