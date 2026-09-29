import { LODGE_MESSAGING_SELECT } from '@/lib/lodge-channels';
import { withTenant } from '@/lib/prisma';
import {
  buildConvocationText, convocationChanged, convocationEligibility, sessionDegrees, type ConvocationEligibility,
} from '@/lib/session-convocation';

// Tudo o que a prévia, o envio e a fila de WhatsApp da convocação precisam, lido numa transação
// curta. O texto sai SEMPRE do que está salvo na sessão (nunca do que está na tela).

export interface ConvocationRecipient { id: string; name: string; email: string | null; phone: string | null }
export interface ConvocationExcluded { id: string; name: string; reason: Exclude<ConvocationEligibility, 'eligible'> }

export async function loadConvocation(lodgeId: string, sessionId: string) {
  const data = await withTenant(lodgeId, async (db) => {
    const meeting = await db.session.findFirst({
      where: { id: sessionId, lodgeId },
      select: {
        id: true, title: true, date: true, endDate: true, type: true, grade: true, degrees: true, agenda: true,
        convocationSentAt: true, convocationText: true,
      },
    });
    if (!meeting) return null;
    const lodge = await db.lodge.findUnique({ where: { id: lodgeId }, select: { ...LODGE_MESSAGING_SELECT } });
    const members = await db.member.findMany({
      where: { lodgeId, status: 'active', deceased: false },
      select: { id: true, name: true, email: true, phone: true, initiationDate: true, elevationDate: true, exaltationDate: true, installationDate: true },
      orderBy: { name: 'asc' },
    });
    return { meeting, lodge, members };
  });
  if (!data) return null;

  const { meeting, lodge, members } = data;
  const degrees = sessionDegrees(meeting);
  const base = buildConvocationText({
    lodgeName: lodge?.name ?? 'loja',
    title: meeting.title,
    date: meeting.date,
    endDate: meeting.endDate,
    type: meeting.type,
    degrees,
    agenda: meeting.agenda,
  });

  const recipients: ConvocationRecipient[] = [];
  const excluded: ConvocationExcluded[] = [];
  for (const m of members) {
    const eligibility = convocationEligibility(m, degrees);
    if (eligibility === 'eligible') recipients.push({ id: m.id, name: m.name, email: m.email, phone: m.phone });
    else excluded.push({ id: m.id, name: m.name, reason: eligibility });
  }

  return {
    meeting,
    lodge,
    degrees,
    base,
    sentText: meeting.convocationText,
    sentAt: meeting.convocationSentAt,
    changed: convocationChanged(base, meeting.convocationText),
    recipients,
    excluded,
  };
}

export type LoadedConvocation = NonNullable<Awaited<ReturnType<typeof loadConvocation>>>;
