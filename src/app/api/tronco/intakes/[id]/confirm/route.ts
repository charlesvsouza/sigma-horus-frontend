import { auth } from '@/lib/auth';
import { todayBR } from '@/lib/date-only';
import { withTenant } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { confirmTronco } from '@/lib/tronco-server';
import { NextResponse } from 'next/server';

// Lança no caixa uma entrada do Tronco que estava aguardando (declarada pelo Hospitaleiro ou vinda do QR da sessão).
// Só Tesoureiro, Venerável e Administrador (a regra do cargo fica em confirmTronco).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sub = await requireActiveSubscription(String(lodgeId));
  if (!sub.ok) return NextResponse.json({ error: sub.error }, { status: sub.status });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const bankAccountId = body?.bankAccountId ? String(body.bankAccountId) : null;
  const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.date ?? '')) ? String(body.date) : todayBR().toISOString().slice(0, 10);
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime()) || date.getTime() > todayBR().getTime()) return NextResponse.json({ error: 'A data do recebimento não pode ser futura.' }, { status: 400 });
  const paidAt = date; // dia contábil (só dia), não o instante
  const result = await withTenant(String(lodgeId), (db) =>
    confirmTronco(db, String(lodgeId), id, { id: String(session.user.id), name: String(session.user.name ?? 'Usuário'), role: session.user.role }, { bankAccountId, date, paidAt }),
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, paymentId: result.paymentId });
}
