import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { computeAccountStatement, type StatementMovementInput } from '@/lib/financial-accounts';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

const KIND_LABEL: Record<StatementMovementInput['kind'], string> = {
  payment_in: 'Entrada',
  payment_out: 'Saída',
  transfer_in: 'Transferência recebida',
  transfer_out: 'Transferência enviada',
};

// Extrato de uma conta financeira em .xlsx — mesmos dados e mesma matemática
// da tela (computeAccountStatement), só num arquivo Excel de verdade em vez
// de HTML. Usa exceljs (já é dependência do projeto, usado hoje só pra LER
// planilhas na importação de membros — esta é a primeira rota que ESCREVE
// um .xlsx).
export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const from = fromParam ? new Date(`${fromParam}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = toParam ? new Date(`${toParam}T23:59:59`) : now;

  const data = await withTenant(String(lodgeId), async (db) => {
    const [lodge, account, payments, transfers] = await Promise.all([
      db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { name: true } }),
      db.financialAccount.findFirst({ where: { id, lodgeId: String(lodgeId) } }),
      db.payment.findMany({
        where: { lodgeId: String(lodgeId), bankAccountId: id },
        select: {
          amount: true,
          paidAt: true,
          member: { select: { name: true } },
          account: { select: { type: true, title: true, counterpartyName: true } },
        },
      }),
      db.accountTransfer.findMany({
        where: { lodgeId: String(lodgeId), status: 'approved', OR: [{ fromId: id }, { toId: id }] },
        include: { from: { select: { name: true } }, to: { select: { name: true } } },
      }),
    ]);
    return { lodge, account, payments, transfers };
  });

  if (!data.account) return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 });

  const movements: StatementMovementInput[] = [];
  for (const p of data.payments) {
    const isIn = p.account?.type === 'RECEIVABLE';
    movements.push({
      date: p.paidAt,
      kind: isIn ? 'payment_in' : 'payment_out',
      description: p.account?.title ?? 'Pagamento',
      reference: p.member?.name ?? p.account?.counterpartyName ?? null,
      amount: Number(p.amount),
    });
  }
  for (const t of data.transfers) {
    if (t.fromId === id) movements.push({ date: t.date, kind: 'transfer_out', description: `Transferência para ${t.to.name}`, reference: t.note, amount: Number(t.amount) });
    if (t.toId === id) movements.push({ date: t.date, kind: 'transfer_in', description: `Transferência de ${t.from.name}`, reference: t.note, amount: Number(t.amount) });
  }

  const statement = computeAccountStatement(data.account.openingBalance, movements, from, to);

  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sigma Horus';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Extrato');
  sheet.columns = [
    { header: 'Data', key: 'data', width: 12 },
    { header: 'Histórico', key: 'historico', width: 34 },
    { header: 'Referência', key: 'referencia', width: 26 },
    { header: 'Tipo', key: 'tipo', width: 22 },
    { header: 'Valor', key: 'valor', width: 15 },
    { header: 'Saldo', key: 'saldo', width: 15 },
  ];

  sheet.addRow([data.lodge?.name ?? 'Loja']).font = { bold: true, size: 13 };
  sheet.addRow([`Extrato — ${data.account.name}${data.account.bankName ? ` (${data.account.bankName})` : ''}`]).font = { bold: true };
  sheet.addRow([`Período: ${from.toLocaleDateString('pt-BR')} a ${to.toLocaleDateString('pt-BR')}`]);
  sheet.addRow([]);

  const headerRowIdx = sheet.rowCount + 1;
  sheet.addRow(['Data', 'Histórico', 'Referência', 'Tipo', 'Valor', 'Saldo']);
  const headerRow = sheet.getRow(headerRowIdx);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.border = { bottom: { style: 'thin' } };
  });

  sheet.addRow(['', 'Saldo inicial do período', '', '', '', statement.openingBalance]);
  for (const m of statement.movements) {
    sheet.addRow([
      new Date(m.date).toLocaleDateString('pt-BR'),
      m.description,
      m.reference ?? '—',
      KIND_LABEL[m.kind],
      m.signedAmount,
      m.balance,
    ]);
  }
  const totalRow = sheet.addRow(['', 'Saldo final do período', '', '', '', statement.closingBalance]);
  totalRow.font = { bold: true };

  sheet.addRow([]);
  sheet.addRow(['', 'Entradas no período', '', '', statement.totalIn, '']);
  sheet.addRow(['', 'Saídas no período', '', '', -statement.totalOut, '']);

  const brlFormat = '"R$" #,##0.00';
  sheet.getColumn('valor').numFmt = brlFormat;
  sheet.getColumn('saldo').numFmt = brlFormat;

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `extrato-${data.account.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${from.toISOString().slice(0, 10)}-a-${to.toISOString().slice(0, 10)}.xlsx`;

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
