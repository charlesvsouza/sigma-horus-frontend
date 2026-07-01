import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * Exporta todos os dados da loja em formato JSON (portabilidade LGPD).
 * Acessível pelo administrador da loja via dashboard ou endpoint direto.
 * GET /api/lodges/export
 */
export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await withTenant(String(lodgeId), async (db) => {
    const [lodge, members, users, accounts, payments, invoices, documents, sessions, campaigns] =
      await Promise.all([
        db.lodge.findUnique({ where: { id: String(lodgeId) } }),
        db.member.findMany({
          where: { lodgeId: String(lodgeId) },
          include: { relatives: true },
        }),
        db.user.findMany({
          where: { lodgeId: String(lodgeId) },
          select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
        }),
        db.account.findMany({ where: { lodgeId: String(lodgeId) } }),
        db.payment.findMany({ where: { lodgeId: String(lodgeId) } }),
        db.invoice.findMany({ where: { lodgeId: String(lodgeId) } }),
        db.document.findMany({ where: { lodgeId: String(lodgeId) } }),
        db.session.findMany({ where: { lodgeId: String(lodgeId) } }),
        db.campaign.findMany({
          where: { lodgeId: String(lodgeId) },
          include: { donations: true },
        }),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      lodge: {
        id: lodge?.id,
        name: lodge?.name,
        slug: lodge?.slug,
        legalName: lodge?.legalName,
        tradeName: lodge?.tradeName,
        cnpj: lodge?.cnpj,
        email: lodge?.email,
        phone: lodge?.phone,
        riteName: lodge?.riteName,
        powerName: lodge?.powerName,
      },
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        phone: m.phone,
        cpf: m.cpf,
        status: m.status,
        birthDate: m.birthDate,
        initiationDate: m.initiationDate,
        elevationDate: m.elevationDate,
        exaltationDate: m.exaltationDate,
        currentDegree: m.currentDegree,
        relatives: m.relatives,
      })),
      users,
      accounts: accounts.map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        amount: a.amount,
        dueDate: a.dueDate,
        status: a.status,
        memberId: a.memberId,
        chartAccountId: a.chartAccountId,
      })),
      payments: payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        paidAt: p.paidAt,
        method: p.method,
        accountId: p.accountId,
        memberId: p.memberId,
        note: p.note,
      })),
      invoices: invoices.map((i) => ({
        id: i.id,
        number: i.number,
        status: i.status,
        amount: i.amount,
        dueDate: i.dueDate,
        memberId: i.memberId,
        accountId: i.accountId,
      })),
      documents: documents.map((d) => ({
        id: d.id,
        title: d.title,
        kind: d.kind,
        category: d.category,
        fileName: d.fileName,
        mimeType: d.mimeType,
        createdAt: d.createdAt,
      })),
      sessions: sessions.map((s) => ({
        id: s.id,
        title: s.title,
        date: s.date,
        type: s.type,
        grade: s.grade,
      })),
      campaigns: campaigns.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        goalAmount: c.goalAmount,
        fundingSource: c.fundingSource,
        donations: c.donations,
      })),
    };
  });

  return NextResponse.json(data);
}
