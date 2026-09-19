import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { findClosedTermForDate } from '@/lib/term-lock';
import { FUND_LABELS, findFundAccount, isFundPurpose } from '@/lib/funds';
import { isValidMoney, round2 } from '@/lib/money';
import { parseBRDateTimeLocal } from '@/lib/br-time';
import { todayBR } from '@/lib/date-only';
import { NextResponse } from 'next/server';

const METHODS: Record<string, string> = { cash: 'Dinheiro', pix: 'Pix', transfer: 'Transferência', other: 'Outro' };

// Aporte ao fundo (Tronco de Beneficência ou Doações e Contribuições): entrada avulsa
// registrada pela Tesouraria/Hospitalaria — dinheiro do tronco passado na sessão, doação
// em espécie, Pix direto na conta etc. Cria a receita já baixada (Account + Payment) no
// caixa do fundo, no mesmo formato das doações de campanha, para entrar no saldo, no
// extrato do fundo, no livro-caixa e no DRE.
export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Tesoureiro (accounts:write) ou Hospitaleiro/Venerável/Secretário (campaigns:write).
  const [byAccounts, byCampaigns] = await Promise.all([
    requireLodgeAccess(String(lodgeId), role, 'accounts', 'write'),
    requireLodgeAccess(String(lodgeId), role, 'campaigns', 'write'),
  ]);
  if (!byAccounts.ok && !byCampaigns.ok) {
    return NextResponse.json({ error: byCampaigns.error }, { status: byCampaigns.status });
  }

  const body = await request.json().catch(() => ({}));
  const fund = body?.fund;
  const rawAmount = Number(body?.amount ?? 0);
  const amount = round2(rawAmount);
  const dateStr = String(body?.date ?? '');
  const method = String(body?.method ?? 'cash');
  const sessionId = body?.sessionId ? String(body.sessionId) : null;
  const memberId = body?.memberId ? String(body.memberId) : null;
  const donorName = String(body?.donorName ?? '').trim() || null;
  const anonymous = Boolean(body?.anonymous);
  const bankAccountId = body?.bankAccountId ? String(body.bankAccountId) : null;
  const note = String(body?.note ?? '').trim() || null;

  if (!isFundPurpose(fund)) return NextResponse.json({ error: 'Fundo inválido.' }, { status: 400 });
  // round2 sozinho aceitaria 1,234 e gravaria 1,23 em silêncio: rejeita o valor com mais de 2 casas.
  if (rawAmount !== amount || !isValidMoney(amount)) return NextResponse.json({ error: 'Informe um valor maior que zero, com até 2 casas decimais.' }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return NextResponse.json({ error: 'Informe a data do aporte.' }, { status: 400 });
  if (!METHODS[method]) return NextResponse.json({ error: 'Forma de recebimento inválida.' }, { status: 400 });

  const dueDate = new Date(dateStr); // data "só dia" (00:00 UTC), como as demais contas
  if (Number.isNaN(dueDate.getTime())) return NextResponse.json({ error: 'Data inválida.' }, { status: 400 });
  if (dueDate.getTime() > todayBR().getTime()) return NextResponse.json({ error: 'A data do aporte não pode ser futura.' }, { status: 400 });
  const paidAt = dateStr === todayBR().toISOString().slice(0, 10) ? new Date() : parseBRDateTimeLocal(`${dateStr}T12:00:00`);

  const result = await withTenant(String(lodgeId), async (db) => {
    const lid = String(lodgeId);

    const locked = await findClosedTermForDate(db, lid, dueDate);
    if (locked) return { error: 'locked' as const, title: locked.title };

    // Categoria de receita do fundo (o Tronco cai na marcada como solidariedade).
    const chart =
      (await db.chartAccount.findFirst({ where: { lodgeId: lid, type: 'REVENUE', fundPurpose: fund }, orderBy: { code: 'asc' }, select: { id: true } })) ??
      (fund === 'tronco' ? await db.chartAccount.findFirst({ where: { lodgeId: lid, type: 'REVENUE', isSolidarity: true }, select: { id: true } }) : null);
    if (!chart) return { error: 'no_chart' as const };

    // Caixa: o escolhido (precisa ser da loja e ativo) ou o caixa padrão do fundo.
    let caixaId: string | null = null;
    if (bankAccountId) {
      const ba = await db.financialAccount.findFirst({ where: { id: bankAccountId, lodgeId: lid, active: true }, select: { id: true } });
      if (!ba) return { error: 'bad_bank' as const };
      caixaId = ba.id;
    } else {
      caixaId = (await findFundAccount(db, lid, fund))?.id ?? null;
    }
    if (!caixaId) return { error: 'no_caixa' as const };

    let member: { id: string; name: string } | null = null;
    if (memberId) {
      member = await db.member.findFirst({ where: { id: memberId, lodgeId: lid }, select: { id: true, name: true } });
      if (!member) return { error: 'bad_member' as const };
    }

    let sessionRow: { id: string } | null = null;
    if (sessionId) {
      sessionRow = await db.session.findFirst({ where: { id: sessionId, lodgeId: lid }, select: { id: true } });
      if (!sessionRow) return { error: 'bad_session' as const };
    }

    const display = anonymous ? 'Doação anônima' : member?.name ?? donorName ?? (sessionRow ? 'Tronco passado em sessão' : 'Doador não identificado');
    const title = `Aporte — ${FUND_LABELS[fund]}`;
    const detail = [METHODS[method], note].filter(Boolean).join(' · ');

    const account = await db.account.create({
      data: {
        lodgeId: lid,
        type: 'RECEIVABLE',
        title,
        amount,
        dueDate,
        status: 'paid',
        chartAccountId: chart.id,
        bankAccountId: caixaId,
        sessionId: sessionRow?.id ?? null,
        description: display,
      },
    });
    const payment = await db.payment.create({
      data: {
        lodgeId: lid,
        accountId: account.id,
        // Doação anônima não amarra o nome do irmão ao pagamento.
        memberId: anonymous ? null : member?.id ?? null,
        bankAccountId: caixaId,
        amount,
        paidAt,
        method: 'donation',
        note: detail || display,
      },
    });
    await logAudit(db, {
      lodgeId: lid,
      userId: session.user.id,
      action: 'CREATE',
      entity: 'fund-contribution',
      entityId: payment.id,
      metadata: { fund, amount, method, sessionId: sessionRow?.id ?? null, accountId: account.id },
    });
    return { ok: true as const, paymentId: payment.id };
  });

  if ('error' in result) {
    switch (result.error) {
      case 'locked':
        return NextResponse.json({ error: `Período encerrado (${result.title}). Não é possível lançar com data dentro de um veneralato já fechado.` }, { status: 409 });
      case 'no_chart':
        return NextResponse.json({ error: 'Categoria do fundo não encontrada: use "Atualizar plano de contas" em Cadastros.' }, { status: 400 });
      case 'no_caixa':
        return NextResponse.json({ error: 'Este fundo ainda não tem caixa. Crie em Cadastros financeiros ou use "Atualizar plano de contas".' }, { status: 400 });
      case 'bad_bank':
        return NextResponse.json({ error: 'Conta bancária/caixa inválida ou inativa.' }, { status: 400 });
      case 'bad_member':
        return NextResponse.json({ error: 'Irmão não encontrado.' }, { status: 404 });
      case 'bad_session':
        return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 });
    }
  }
  return NextResponse.json({ ok: true, paymentId: result.paymentId });
}
