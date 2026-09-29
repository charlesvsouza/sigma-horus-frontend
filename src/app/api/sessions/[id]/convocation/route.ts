import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { buildLodgeChannels } from '@/lib/lodge-channels';
import { dispatch, sleep, DISPATCH_THROTTLE_MS, type Channel } from '@/lib/messaging';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { convocationMessage, convocationRef, convocationSubject, degreesLabel, stripRectification } from '@/lib/session-convocation';
import { loadConvocation, type LoadedConvocation } from '@/lib/session-convocation-server';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };
const VALID: Channel[] = ['email', 'whatsapp', 'sms'];

// Chamado (convocação) da sessão, em dois passos para não sair nada errado:
//  GET  → prévia: a mensagem exata (gerada do que está SALVO), quem recebe e quem fica de fora.
//  POST → envia, mas só se o texto for o mesmo da prévia (`expectedText`); se a sessão mudou no
//         meio, 409 e o Secretário revisa de novo.
// Depois do primeiro envio, alterar a sessão faz a próxima mensagem sair como RETIFICAÇÃO.
// Convoca pelo menor grau trabalhado (lib/session-convocation). E-mail sempre; WhatsApp/SMS se a
// loja conectou (API). O WhatsApp manual (wa.me) tem fila própria em ./whatsapp.

async function guard() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId || !session?.user?.id) return { ok: false as const, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const access = await requireLodgeAccess(lodgeId, session.user.role, 'members', 'write');
  if (!access.ok) return { ok: false as const, res: NextResponse.json({ error: access.error }, { status: access.status }) };
  return { ok: true as const, lodgeId, userId: session.user.id };
}

/**
 * O que sai agora: 1º envio, retificação (a sessão mudou depois do envio) ou reenvio do mesmo
 * texto. Sessão convocada antes de guardarmos o texto enviado: não há como comparar — reenvio simples.
 */
function nextMessage(c: LoadedConvocation) {
  const kind = !c.sentAt ? 'initial' : c.sentText && c.changed ? 'rectification' : 'resend';
  const text = kind === 'rectification' ? convocationMessage(c.base, true) : kind === 'resend' && c.sentText ? c.sentText : c.base;
  return { kind, text, subject: convocationSubject(c.meeting.title, text !== stripRectification(text)) } as const;
}

export async function GET(_request: Request, { params }: Ctx) {
  const g = await guard();
  if (!g.ok) return g.res;
  const { id } = await params;
  const c = await loadConvocation(g.lodgeId, id);
  if (!c) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 });

  const next = nextMessage(c);
  const warnings: string[] = [];
  if (c.meeting.date.getTime() < Date.now()) warnings.push('A data da sessão já passou.');
  if (!c.meeting.agenda?.trim()) warnings.push('A ordem do dia está vazia.');
  if (c.degrees.length === 0) warnings.push('Nenhum grau marcado: a convocação vai a todos os obreiros ativos.');

  return NextResponse.json({
    kind: next.kind,
    subject: next.subject,
    text: next.text,
    sentText: c.sentText,
    sentAt: c.sentAt?.toISOString() ?? null,
    changed: c.changed,
    degreesLabel: degreesLabel(c.degrees),
    recipients: c.recipients.map((r) => ({ id: r.id, name: r.name, hasEmail: !!r.email, hasPhone: !!r.phone })),
    excluded: c.excluded.map((e) => ({ id: e.id, name: e.name, reason: e.reason })),
    warnings,
  });
}

export async function POST(request: Request, { params }: Ctx) {
  const g = await guard();
  if (!g.ok) return g.res;
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const expectedText = typeof body?.expectedText === 'string' ? body.expectedText : '';
  const requested: Channel[] = Array.isArray(body?.channels) ? body.channels.filter((c: string) => VALID.includes(c as Channel)) : ['email'];
  const channels = requested.length > 0 ? requested : (['email'] as Channel[]);

  const c = await loadConvocation(g.lodgeId, id);
  if (!c) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 });
  const next = nextMessage(c);
  if (!expectedText || expectedText !== next.text) {
    return NextResponse.json({ error: 'A sessão foi alterada depois da prévia. Revise a convocação de novo antes de enviar.' }, { status: 409 });
  }
  if (c.recipients.length === 0) return NextResponse.json({ error: 'Nenhum irmão a convocar para os graus desta sessão.' }, { status: 409 });

  // Reserva o envio antes do laço (comparar-e-gravar): dois cliques ou duas abas não mandam duas
  // vezes, e uma edição concorrente derruba este envio em vez de sair texto velho.
  const claimed = await withTenant(g.lodgeId, (db) => db.session.updateMany({
    where: { id, lodgeId: g.lodgeId, convocationSentAt: c.sentAt, convocationText: c.sentText },
    data: { convocationSentAt: new Date(), convocationSentById: g.userId, convocationText: next.text },
  }));
  if (claimed.count === 0) return NextResponse.json({ error: 'Esta convocação acabou de ser enviada ou alterada por outra pessoa. Atualize a página.' }, { status: 409 });

  // Laço de despacho FORA de transação (transação interativa expira em 5s; dezenas de irmãos ×
  // DISPATCH_THROTTLE_MS passam disso). Cada MessageLog numa transação curta.
  const lodgeChannels = buildLodgeChannels(c.lodge);
  const ref = convocationRef(id);
  const stats = { sent: 0, queued: 0, failed: 0, skipped: 0 };
  let dispatched = 0;
  for (const m of c.recipients) {
    for (const channel of channels) {
      const to = channel === 'email' ? (m.email ?? '') : (m.phone ?? '');
      if (!to) { stats.skipped++; continue; }
      if (dispatched > 0) await sleep(DISPATCH_THROTTLE_MS);
      dispatched++;
      const r = await dispatch(channel, to, next.subject, next.text, lodgeChannels);
      stats[r.status]++;
      await withTenant(g.lodgeId, (db) => db.messageLog.create({
        data: { lodgeId: g.lodgeId, memberId: m.id, channel, title: next.subject, content: next.text, status: r.status, error: r.detail ?? null, ref },
      }));
    }
  }

  await withTenant(g.lodgeId, (db) => logAudit(db, {
    lodgeId: g.lodgeId, userId: g.userId, action: 'UPDATE', entity: 'session-convocacao', entityId: id,
    metadata: { kind: next.kind, channels, recipients: c.recipients.length, excluded: c.excluded.length, degrees: c.degrees, ...stats },
  }));

  return NextResponse.json({ ok: true, kind: next.kind, stats, recipients: c.recipients.length });
}
