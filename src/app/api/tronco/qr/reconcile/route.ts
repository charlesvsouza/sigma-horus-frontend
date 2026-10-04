import { auth } from '@/lib/auth';
import { reconcileLodgeQrs } from '@/lib/tronco-qr-server';
import { canConfirmTronco } from '@/lib/tronco-session';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { NextResponse } from 'next/server';

// "Atualizar do Asaas": confere os QR Pix das sessões recentes e traz os pagamentos que o aviso (webhook) não entregou.
// Só quem confirma o Tronco (Tesoureiro, Venerável, Administrador).
export async function POST() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canConfirmTronco(session.user.role)) return NextResponse.json({ error: 'Só o Tesoureiro, o Venerável e o Administrador atualizam o Tronco.' }, { status: 403 });
  const sub = await requireActiveSubscription(String(lodgeId));
  if (!sub.ok) return NextResponse.json({ error: sub.error }, { status: sub.status });
  try {
    return NextResponse.json({ ok: true, ...(await reconcileLodgeQrs(String(lodgeId))) });
  } catch (err) {
    console.error('tronco qr: falha ao atualizar do Asaas', err);
    return NextResponse.json({ error: 'Não foi possível consultar o Asaas agora. Tente de novo em instantes.' }, { status: 502 });
  }
}
