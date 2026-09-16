import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import CadastrosClient from './CadastrosClient';

// Server Component: ritos + potências + plano de contas no servidor.
export default async function CadastrosPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const data = lodgeId
    ? await withTenant(String(lodgeId), async (db) => ({
        rites: await db.rite.findMany({ where: { lodgeId: String(lodgeId) }, orderBy: { order: 'asc' } }),
        powers: await db.power.findMany({ where: { lodgeId: String(lodgeId) }, orderBy: { order: 'asc' } }),
        chartAccounts: await db.chartAccount.findMany({ where: { lodgeId: String(lodgeId) }, orderBy: { code: 'asc' } }),
        counterparties: await db.counterparty.findMany({ where: { lodgeId: String(lodgeId) }, orderBy: { name: 'asc' } }),
        financialAccounts: await db.financialAccount.findMany({ where: { lodgeId: String(lodgeId) }, orderBy: [{ active: 'desc' }, { name: 'asc' }] }),
      }))
    : { rites: [], powers: [], chartAccounts: [], counterparties: [], financialAccounts: [] };

  const rites = data.rites.map((r) => ({ id: r.id, name: r.name, order: r.order }));
  const powers = data.powers.map((p) => ({ id: p.id, name: p.name, order: p.order }));
  const chartAccounts = data.chartAccounts.map((c) => ({ id: c.id, code: c.code, name: c.name, type: c.type, category: c.category ?? null }));
  const counterparties = data.counterparties.map((c) => ({
    id: c.id, kind: c.kind, name: c.name, legalName: c.legalName ?? null, document: c.document ?? null,
    isCompany: c.isCompany, email: c.email ?? null, phone: c.phone ?? null, city: c.city ?? null, state: c.state ?? null,
  }));
  const financialAccounts = data.financialAccounts.map((f) => ({
    id: f.id, name: f.name, kind: f.kind, bankName: f.bankName ?? null, isInvestment: f.isInvestment,
    agency: f.agency ?? null, accountNumber: f.accountNumber ?? null, active: f.active,
  }));

  return <CadastrosClient rites={rites} powers={powers} chartAccounts={chartAccounts} counterparties={counterparties} financialAccounts={financialAccounts} />;
}
