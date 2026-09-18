import { auth } from '@/lib/auth';
import { buildAccountsReport } from '@/lib/accounts-report';
import { loadAccountsReportRows, type AccountsReportVariant } from '@/lib/accounts-report-data';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

const VARIANTS: AccountsReportVariant[] = ['contas-a-receber', 'contas-a-pagar', 'contas-recebidas', 'contas-pagas'];

const TITLE: Record<AccountsReportVariant, string> = {
  'contas-a-receber': 'Contas a receber',
  'contas-a-pagar': 'Contas a pagar',
  'contas-recebidas': 'Contas recebidas',
  'contas-pagas': 'Contas pagas',
};

const DATE_LABEL: Record<AccountsReportVariant, string> = {
  'contas-a-receber': 'Vencimento',
  'contas-a-pagar': 'Vencimento',
  'contas-recebidas': 'Recebimento',
  'contas-pagas': 'Pagamento',
};

// Export .xlsx dos 4 relatórios de Contas — mesmos dados e mesma lógica de
// filtro da tela (buildAccountsReport), num arquivo Excel de verdade. Mesmo
// padrão de api/financial-accounts/[id]/statement/xlsx/route.ts.
export async function GET(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { searchParams } = new URL(request.url);
  const variant = searchParams.get('variant') as AccountsReportVariant | null;
  if (!variant || !VARIANTS.includes(variant)) {
    return NextResponse.json({ error: 'Relatório inválido.' }, { status: 400 });
  }

  const now = new Date();
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const from = fromParam ? new Date(`${fromParam}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = toParam ? new Date(`${toParam}T23:59:59`) : now;
  const personId = searchParams.get('personId') || null;
  const text = searchParams.get('text') || undefined;

  const data = await withTenant(String(lodgeId), async (db) => {
    const [lodge, rowsInput] = await Promise.all([
      db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { name: true } }),
      loadAccountsReportRows(db, String(lodgeId), variant, role),
    ]);
    return { lodge, rowsInput };
  });

  const report = buildAccountsReport(data.rowsInput, { from, to, personId, text });

  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sigma Horus';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(TITLE[variant]);
  sheet.columns = [
    { header: DATE_LABEL[variant], key: 'data', width: 14 },
    { header: 'Nome', key: 'nome', width: 28 },
    { header: 'Descrição', key: 'descricao', width: 34 },
    { header: 'Categoria', key: 'categoria', width: 24 },
    { header: 'Valor', key: 'valor', width: 15 },
  ];

  sheet.addRow([data.lodge?.name ?? 'Loja']).font = { bold: true, size: 13 };
  sheet.addRow([TITLE[variant]]).font = { bold: true };
  sheet.addRow([`Período: ${from.toLocaleDateString('pt-BR')} a ${to.toLocaleDateString('pt-BR')}`]);
  sheet.addRow([]);

  const headerRowIdx = sheet.rowCount + 1;
  sheet.addRow([DATE_LABEL[variant], 'Nome', 'Descrição', 'Categoria', 'Valor']);
  const headerRow = sheet.getRow(headerRowIdx);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => { cell.border = { bottom: { style: 'thin' } }; });

  for (const r of report.rows) {
    sheet.addRow([new Date(r.date).toLocaleDateString('pt-BR'), r.personName ?? '—', r.description, r.category ?? '—', r.amount]);
  }
  const totalRow = sheet.addRow(['', '', '', 'Total do período', report.total]);
  totalRow.font = { bold: true };

  sheet.getColumn('valor').numFmt = '"R$" #,##0.00';

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `${variant}-${from.toISOString().slice(0, 10)}-a-${to.toISOString().slice(0, 10)}.xlsx`;

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
