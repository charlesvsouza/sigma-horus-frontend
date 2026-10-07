import { alertAbsenceStreaks } from '@/lib/attendance-streak-server';
import { todayBR } from '@/lib/date-only';
import { alertIncompleteRecords } from '@/lib/incomplete-record-server';
import { alertBrokenAgreements } from '@/lib/member-block-server';
import { alertLedgerDrift } from '@/lib/ledger-drift-server';
import { reconcileAllTroncoQrs } from '@/lib/tronco-qr-server';
import { runDailyNotifications } from '@/lib/notifications';
import { NextResponse } from 'next/server';
import { cronAuthorized } from '@/lib/platform-auth';

// Gatilhos diários: aniversariantes (obreiro + família), jubileus e lembretes de
// cobrança, e o alerta de acordo de regularização quebrado (parcela vencida e não paga). Acionado pelo Vercel Cron (GET, Authorization: Bearer $CRON_SECRET)
// ou manualmente (token = CRON_SECRET ou PLATFORM_OWNER_TOKEN).
const authorized = cronAuthorized;

async function run() {
  const notifications = await runDailyNotifications();
  const agreements = await alertBrokenAgreements().catch((err) => {
    console.error('acordos de regularização: falha no alerta diário', err);
    return null;
  });
  // Saldo calculado até o dia conferido com o banco mudou depois da conferência: avisa a Tesouraria e o Venerável.
  const ledgerDrift = await alertLedgerDrift().catch((err) => {
    console.error('conferência com o banco: falha no alerta diário', err);
    return null;
  });
  // 3 ou mais faltas seguidas: e-mail ao Venerável e ao Hospitaleiro (uma vez por sequência).
  const absences = await alertAbsenceStreaks().catch((err) => {
    console.error('faltas seguidas: falha no alerta diário', err);
    return null;
  });
  // Confere os QR Pix do Tronco das sessões recentes (pagamentos que o webhook possa ter perdido).
  const troncoQr = await reconcileAllTroncoQrs().catch((err) => {
    console.error('tronco qr: falha na conferência diária', err);
    return null;
  });
  // Segunda-feira (Brasília): resumo ao Secretário + pedido ao irmão para completar o cadastro (CPF, e-mail, nascimento).
  const isMonday = todayBR().getUTCDay() === 1;
  const records = isMonday
    ? await alertIncompleteRecords().catch((err) => {
        console.error('cadastros incompletos: falha no aviso semanal', err);
        return null;
      })
    : null;
  return { ...notifications, agreements, ledgerDrift, absences, troncoQr, records };
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await run());
}
