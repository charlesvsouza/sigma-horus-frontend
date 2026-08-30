import { syncAllLodgesArt002 } from '@/lib/overdue';
import { NextResponse } from 'next/server';

// Rede de segurança do Art. 002: promove/reverte o status do membro em todas
// as lojas com base na mensalidade em aberto há mais de 60 dias. Os pontos de
// pagamento/exclusão/webhook já sincronizam na hora — este cron cobre o caso
// em que ninguém mexeu na conta e só o tempo fez o membro cruzar o prazo.
// Acionado pelo Vercel Cron (GET, Authorization: Bearer $CRON_SECRET) ou
// manualmente (token = CRON_SECRET ou PLATFORM_OWNER_TOKEN).
function authorized(request: Request): boolean {
  const header = request.headers.get('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const qs = new URL(request.url).searchParams.get('token') ?? '';
  const accepted = [process.env.CRON_SECRET, process.env.PLATFORM_OWNER_TOKEN].filter(Boolean) as string[];
  return accepted.some((t) => t === bearer || t === qs);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await syncAllLodgesArt002());
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await syncAllLodgesArt002());
}
