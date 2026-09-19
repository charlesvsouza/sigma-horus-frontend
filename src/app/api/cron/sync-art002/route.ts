import { syncAllLodgesArt002 } from '@/lib/overdue';
import { NextResponse } from 'next/server';
import { cronAuthorized } from '@/lib/platform-auth';

// Rede de segurança do Art. 002: promove/reverte o status do membro em todas
// as lojas com base na mensalidade em aberto há mais de 60 dias. Os pontos de
// pagamento/exclusão/webhook já sincronizam na hora — este cron cobre o caso
// em que ninguém mexeu na conta e só o tempo fez o membro cruzar o prazo.
// Acionado pelo Vercel Cron (GET, Authorization: Bearer $CRON_SECRET) ou
// manualmente (token = CRON_SECRET ou PLATFORM_OWNER_TOKEN).
const authorized = cronAuthorized;

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await syncAllLodgesArt002());
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await syncAllLodgesArt002());
}
