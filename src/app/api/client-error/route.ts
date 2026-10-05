import { recordError } from '@/lib/error-monitor';
import { limitByIp } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';

// Falhas de tela reportadas pelo navegador (app/error.tsx e global-error.tsx). Pública de propósito
// (a tela quebrada pode estar sem sessão), por isso: limite por IP, corpo pequeno e só texto — o
// registro agrupa por impressão digital, então não cresce com repetição.
export async function POST(request: Request) {
  const limited = await limitByIp(request, 'client-error', 20, 60 * 60 * 1000);
  if (limited) return limited;
  const raw = await request.text().catch(() => '');
  if (raw.length > 8000) return NextResponse.json({ ok: false }, { status: 413 });
  let body: { message?: unknown; stack?: unknown; digest?: unknown; path?: unknown } = {};
  try { body = JSON.parse(raw); } catch { /* corpo inválido: registra como erro sem mensagem */ }
  await recordError({
    source: 'client',
    route: typeof body.path === 'string' ? body.path : '/',
    message: typeof body.message === 'string' ? body.message : '(sem mensagem)',
    stack: typeof body.stack === 'string' ? body.stack : null,
    digest: typeof body.digest === 'string' ? body.digest.slice(0, 80) : null,
  });
  return NextResponse.json({ ok: true });
}
