import { attendanceBookRows, type BookRow } from '@/lib/attendance-book';
import { getLetterhead, type Letterhead } from '@/lib/letterhead';
import { symbolicSituation } from '@/lib/masonic-degree';
import { withTenant } from '@/lib/prisma';
import { getReportSignatories } from '@/lib/report-signatories';
import { degreesLabel } from '@/lib/session-convocation';
import { loadConvocation } from '@/lib/session-convocation-server';
import { SESSION_TYPE_LABEL } from '@/lib/status-labels';
import type { Signatory } from '@/components/report/report-document';

// Dados das folhas impressas da sessão (livro de presença e lista de visitantes): papel
// timbrado, escopo da sessão, quem assina (Secretário e Venerável do veneralato da data da
// sessão) e, para o livro, os convocados com cargo e grau.

export interface SessionScope {
  title: string;
  typeLabel: string;
  date: string;
  endDate: string | null;
  degrees: string | null;
  agenda: string | null;
}

export interface SessionSheetData {
  letterhead: Letterhead;
  scope: SessionScope;
  signatures: Signatory[];
  rows: BookRow[];
}

export async function loadSessionSheet(lodgeId: string, sessionId: string): Promise<SessionSheetData | null> {
  const convocation = await loadConvocation(lodgeId, sessionId);
  if (!convocation) return null;
  const { meeting } = convocation;
  const ids = convocation.recipients.map((r) => r.id);

  const data = await withTenant(lodgeId, async (db) => {
    const [letterhead, signatures, term, members] = await Promise.all([
      getLetterhead(db, lodgeId),
      getReportSignatories(db, lodgeId, { at: meeting.date, by: 'secretary' }),
      db.term.findFirst({
        where: { lodgeId, startDate: { lte: meeting.date }, OR: [{ endDate: null }, { endDate: { gte: meeting.date } }] },
        orderBy: { startDate: 'desc' },
        select: { id: true },
      }),
      db.member.findMany({
        where: { lodgeId, id: { in: ids } },
        select: { id: true, name: true, initiationDate: true, elevationDate: true, exaltationDate: true, installationDate: true },
      }),
    ]);
    // Cargos no veneralato que cobre a data da sessão (sem período cadastrado, ninguém vai ao topo).
    const holders = term
      ? await db.memberOffice.findMany({
          where: { lodgeId, termId: term.id, memberId: { in: ids } },
          select: { memberId: true, office: { select: { name: true, order: true } } },
        })
      : [];
    return { letterhead, signatures, members, holders };
  });

  const rows = attendanceBookRows(
    data.members.map((m) => ({
      id: m.id,
      name: m.name,
      degree: symbolicSituation(m),
      offices: data.holders.filter((h) => h.memberId === m.id).map((h) => h.office),
    })),
  );

  return {
    letterhead: data.letterhead,
    signatures: data.signatures,
    rows,
    scope: {
      title: meeting.title,
      typeLabel: SESSION_TYPE_LABEL[meeting.type] ?? meeting.type,
      date: meeting.date.toISOString(),
      endDate: meeting.endDate ? meeting.endDate.toISOString() : null,
      degrees: degreesLabel(convocation.degrees),
      agenda: meeting.agenda?.trim() || null,
    },
  };
}
