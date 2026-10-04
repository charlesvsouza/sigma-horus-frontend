import { auth } from '@/lib/auth';
import { isValidMoney } from '@/lib/money';
import { withTenant } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { activeSessionFor } from '@/lib/tronco-session';
import { NextResponse } from 'next/server';

const MAX_PENDING_PER_MEMBER = 5;

// "Já doei": o irmão avisa que fez o Pix da doação ao Tronco (chave da loja, com o DNA no txid). Vira uma entrada AGUARDANDO
// confirmação, ligada à sessão em curso; o Tesoureiro, o Venerável ou o Administrador confere no extrato e lança no caixa.
export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const memberId = session?.user?.memberId;
  if (!lodgeId || !memberId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sub = await requireActiveSubscription(String(lodgeId));
  if (!sub.ok) return NextResponse.json({ error: sub.error }, { status: sub.status });

  const body = await request.json().catch(() => ({}));
  const code = String(body?.code ?? '');
  const amount = Number(body?.amount ?? 0);
  if (!/^TR-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(code)) return NextResponse.json({ error: 'Código da doação inválido. Gere o Pix de novo.' }, { status: 400 });
  if (!isValidMoney(amount)) return NextResponse.json({ error: 'Valor inválido.' }, { status: 400 });

  const result = await withTenant(String(lodgeId), async (db) => {
    const member = await db.member.findFirst({ where: { id: String(memberId), lodgeId: String(lodgeId) }, select: { name: true } });
    if (!member) return { error: 'Cadastro de membro não encontrado.', status: 404 } as const;
    const pending = await db.troncoIntake.count({ where: { lodgeId: String(lodgeId), declaredById: String(session.user.id), status: 'pending' } });
    if (pending >= MAX_PENDING_PER_MEMBER) return { error: `Você já tem ${pending} doações aguardando confirmação da Tesouraria. Aguarde a conferência antes de avisar outra.`, status: 429 } as const;
    const nearby = await db.session.findMany({
      where: { lodgeId: String(lodgeId), date: { gte: new Date(Date.now() - 36 * 3_600_000), lte: new Date(Date.now() + 36 * 3_600_000) } },
      select: { id: true, title: true, date: true, endDate: true },
    });
    const active = activeSessionFor(nearby, new Date());
    try {
      await db.troncoIntake.create({
        data: {
          lodgeId: String(lodgeId), sessionId: active?.id ?? null, source: 'members', channel: 'pix_portal', amount, status: 'pending', code,
          note: 'Doação pelo portal (Pix da chave da loja) — aviso \"Já doei\"', declaredById: String(session.user.id), declaredByName: member.name,
        },
      });
    } catch {
      return { error: 'Esta doação já foi avisada.', status: 409 } as const;
    }
    return { ok: true, session: active?.title ?? null } as const;
  });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, session: result.session });
}
