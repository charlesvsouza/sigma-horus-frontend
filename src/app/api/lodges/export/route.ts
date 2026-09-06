import { auth } from '@/lib/auth';
import { normalizeRole } from '@/lib/rbac';
import { withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * Backup completo dos dados de UMA loja (autoatendimento do admin) em JSON —
 * cobre todas as tabelas da loja (membros/família, financeiro, sessões,
 * documentos, plano de contas, cargos, permissões etc). Não inclui segredos
 * (senha, chaves de integração) nem dados de outras lojas.
 * GET /api/lodges/export — só o Administrador da própria loja.
 */
export const maxDuration = 60; // lojas grandes podem levar mais que o padrão da função

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = normalizeRole(session?.user?.role);
  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Só o Administrador pode baixar o backup da loja.' }, { status: 403 });
  }

  const id = String(lodgeId);

  // Timeout maior que o padrão (5s): são ~26 consultas em paralelo, todas as
  // tabelas da loja — contra o Railway via proxy, o padrão estoura à toa.
  const data = await withTenant(id, async (db) => {
    const [
      lodge, users, members, chartAccounts, accounts, invoices, payments, assets,
      bankTransactions, documents, messageLogs, sessions, attendances, terms,
      memberOffices, cashCloses, balancetes, budgets, campaigns, campaignDonations,
      rolePermissions, subscription, auditLogs, rites, powers, offices,
    ] = await Promise.all([
      db.lodge.findUnique({ where: { id } }),
      db.user.findMany({ where: { lodgeId: id }, select: { id: true, name: true, email: true, role: true, status: true, memberId: true, mustChangePassword: true, createdAt: true, updatedAt: true } }),
      db.member.findMany({ where: { lodgeId: id }, include: { relatives: true } }),
      db.chartAccount.findMany({ where: { lodgeId: id } }),
      db.account.findMany({ where: { lodgeId: id } }),
      db.invoice.findMany({ where: { lodgeId: id } }),
      db.payment.findMany({ where: { lodgeId: id } }),
      db.asset.findMany({ where: { lodgeId: id } }),
      db.bankTransaction.findMany({ where: { lodgeId: id } }),
      db.document.findMany({ where: { lodgeId: id } }),
      db.messageLog.findMany({ where: { lodgeId: id } }),
      db.session.findMany({ where: { lodgeId: id } }),
      db.attendance.findMany({ where: { lodgeId: id } }),
      db.term.findMany({ where: { lodgeId: id } }),
      db.memberOffice.findMany({ where: { lodgeId: id } }),
      db.cashClose.findMany({ where: { lodgeId: id } }),
      db.balancete.findMany({ where: { lodgeId: id } }),
      db.budget.findMany({ where: { lodgeId: id } }),
      db.campaign.findMany({ where: { lodgeId: id }, include: { donations: true } }),
      db.campaignDonation.findMany({ where: { lodgeId: id } }),
      db.rolePermission.findMany({ where: { lodgeId: id } }),
      db.subscription.findUnique({ where: { lodgeId: id } }),
      db.auditLog.findMany({ where: { lodgeId: id } }),
      db.rite.findMany({ where: { lodgeId: id } }),
      db.power.findMany({ where: { lodgeId: id } }),
      db.office.findMany({ where: { lodgeId: id } }),
    ]);

    // Remove os campos de credenciais/segredos criptografados — sem valor pro
    // admin (só o servidor consegue decifrar) e sem motivo pra sair da loja.
    const {
      asaasApiKeyEnc: _asaas, asaasWebhookToken: _asaasWebhook,
      whatsappTokenEnc: _wa, smsAuthTokenEnc: _sms,
      ...lodgeSafe
    } = lodge ?? {};
    void _asaas; void _asaasWebhook; void _wa; void _sms;

    return {
      lodgeName: lodge?.name ?? 'loja',
      payload: {
        exportedAt: new Date().toISOString(),
        lodge: lodgeSafe,
        users, members, rites, powers, offices, chartAccounts, accounts, invoices,
        payments, assets, bankTransactions, documents, messageLogs, sessions,
        attendances, terms, memberOffices, cashCloses, balancetes, budgets,
        campaigns, campaignDonations, rolePermissions, subscription, auditLogs,
      },
    };
  }, { timeoutMs: 45_000 });

  const slug = data.lodgeName
    .normalize('NFD')
    .split('')
    .filter((ch: string) => { const cp = ch.codePointAt(0) ?? 0; return cp < 0x300 || cp > 0x36f; })
    .join('')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'loja';

  return NextResponse.json(data.payload, {
    headers: { 'Content-Disposition': `attachment; filename="backup-${slug}.json"` },
  });
}
