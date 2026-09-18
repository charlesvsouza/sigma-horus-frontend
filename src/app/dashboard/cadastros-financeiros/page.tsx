import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import CadastrosFinanceirosClient from './CadastrosFinanceirosClient';

// Server Component: plano de contas, clientes/fornecedores e contas
// bancárias/Caixa — desmembrado de Cadastros mestre (ver design_refinado.md,
// P2 "Cadastros mestre: escopo e dono"). Gira em torno do recurso RBAC
// 'accounts' (Tesouraria), diferente de Ritos/Potências ('members', Secretaria).
export default async function CadastrosFinanceirosPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const data = lodgeId
    ? await withTenant(String(lodgeId), async (db) => ({
        chartAccounts: await db.chartAccount.findMany({ where: { lodgeId: String(lodgeId) }, orderBy: { code: 'asc' } }),
        counterparties: await db.counterparty.findMany({ where: { lodgeId: String(lodgeId) }, orderBy: { name: 'asc' } }),
        financialAccounts: await db.financialAccount.findMany({ where: { lodgeId: String(lodgeId) }, orderBy: [{ active: 'desc' }, { name: 'asc' }] }),
      }))
    : { chartAccounts: [], counterparties: [], financialAccounts: [] };

  const chartAccounts = data.chartAccounts.map((c) => ({ id: c.id, code: c.code, name: c.name, type: c.type, category: c.category ?? null }));
  const counterparties = data.counterparties.map((c) => ({
    id: c.id, kind: c.kind, name: c.name, legalName: c.legalName ?? null, document: c.document ?? null,
    isCompany: c.isCompany, email: c.email ?? null, phone: c.phone ?? null, city: c.city ?? null, state: c.state ?? null,
  }));
  const financialAccounts = data.financialAccounts.map((f) => ({
    id: f.id, name: f.name, kind: f.kind, bankName: f.bankName ?? null, isInvestment: f.isInvestment,
    agency: f.agency ?? null, accountNumber: f.accountNumber ?? null, active: f.active,
    openingBalance: f.openingBalance, purpose: f.purpose,
  }));

  return <CadastrosFinanceirosClient chartAccounts={chartAccounts} counterparties={counterparties} financialAccounts={financialAccounts} />;
}
