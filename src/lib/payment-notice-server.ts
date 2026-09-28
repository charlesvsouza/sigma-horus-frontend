import { logAudit } from '@/lib/audit';
import { isAsaasMode } from '@/lib/collection';
import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';
import { dispatch, EMPTY_CHANNELS } from '@/lib/messaging';
import { sumMoney } from '@/lib/money';
import { canPay, openBalance, PAYMENT_NOTICE_COOLDOWN_MS, PAYMENT_NOTICE_ENTITY } from '@/lib/portal-dues';
import { withTenant } from '@/lib/prisma';
import { buildObjectKey, deleteObject, putObject } from '@/lib/storage';
import { receiptUploadError } from '@/lib/upload-guards';
import { checkReceipt, type ReceiptCheck } from '@/lib/receipt-check';
import { pdfText } from '@/lib/receipt-pdf';

// "Já paguei" (Modo Loja) de UMA ou de VÁRIAS contas (Pix agrupado): o Pix caiu direto na
// conta da loja e o sistema não fica sabendo. Registra um aviso por conta (AuditLog), sobe o
// comprovante (storage privado, a mesma chave em todas) e manda UM e-mail à Tesouraria.
// Não dá baixa em nada.

export type NoticeResult =
  | { ok: true; paidNoticeAt: Date; notified: number; receipt: boolean }
  | { ok: false; status: number; error: string; paidNoticeAt?: Date };

export async function submitPaymentNotice(params: {
  lodgeId: string;
  memberId: string;
  userId: string;
  accountIds: string[];
  note: string;
  file: File | null;
}): Promise<NoticeResult> {
  const { lodgeId, memberId, userId } = params;
  const accountIds = [...new Set(params.accountIds)];
  const note = params.note.trim().slice(0, 300);
  if (accountIds.length === 0) return { ok: false, status: 400, error: 'Nenhuma conta informada.' };
  if (params.file) {
    const invalid = receiptUploadError(params.file);
    if (invalid) return { ok: false, status: 400, error: invalid };
  }

  const ctx = await withTenant(lodgeId, async (db) => {
    const [accounts, lodge, member, last, staff] = await Promise.all([
      db.account.findMany({
        where: { id: { in: accountIds }, lodgeId, memberId },
        select: {
          id: true, title: true, type: true, amount: true, dueDate: true, status: true, memberId: true, approvalStatus: true,
          payments: { select: { amount: true } },
        },
        orderBy: { dueDate: 'asc' },
      }),
      db.lodge.findUnique({ where: { id: lodgeId }, select: { name: true, collectionMode: true, cnpj: true, pixKey: true } }),
      db.member.findUnique({ where: { id: memberId }, select: { name: true } }),
      db.auditLog.findFirst({
        where: { lodgeId, entity: PAYMENT_NOTICE_ENTITY, entityId: { in: accountIds } },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.user.findMany({ where: { lodgeId, role: { in: ['treasurer', 'admin', 'venerable'] }, status: 'active' }, select: { email: true } }),
    ]);
    return { accounts, lodge, member, last, staff };
  });

  const { accounts, lodge, member, last, staff } = ctx;
  if (accounts.length !== accountIds.length || !lodge || !member) return { ok: false, status: 404, error: 'Conta não encontrada.' };
  if (isAsaasMode(lodge)) {
    return { ok: false, status: 409, error: 'Nesta loja o pagamento pelo portal é confirmado automaticamente — não é preciso avisar.' };
  }
  const items = accounts.map((a) => ({ account: a, balance: openBalance(a, a.payments) }));
  if (items.some((i) => !canPay(i.account, memberId, i.balance))) {
    return { ok: false, status: 409, error: accountIds.length > 1 ? 'Alguma das contas não está mais em aberto. Recarregue a página.' : 'Esta conta não está em aberto.' };
  }
  if (last && Date.now() - last.createdAt.getTime() < PAYMENT_NOTICE_COOLDOWN_MS) {
    return { ok: false, status: 429, error: 'Você já avisou a Tesouraria sobre esta conta nas últimas 24 horas.', paidNoticeAt: last.createdAt };
  }

  // Comprovante: sobe antes de registrar (sem o arquivo no storage, o aviso não o cita).
  let receipt: { key: string; name: string; type: string } | null = null;
  let receiptBuffer: Buffer | null = null;
  if (params.file) {
    const key = buildObjectKey(params.file.name, `payment-receipts/${lodgeId}`);
    receiptBuffer = Buffer.from(await params.file.arrayBuffer());
    const ok = await putObject(key, receiptBuffer, params.file.type).catch(() => false);
    if (!ok) return { ok: false, status: 502, error: 'Não foi possível enviar o comprovante. Tente de novo ou avise sem anexo.' };
    receipt = { key, name: params.file.name.slice(0, 120), type: params.file.type };
  }

  const total = sumMoney(items.map((i) => i.balance));
  const group = items.length > 1 ? { groupAccountIds: accountIds, groupTotal: total } : {};

  // Comprovante em PDF: conferido contra o QR que o sistema gerou (txid = conta mais antiga do
  // Pix; no agrupado o valor é o total). Só habilita a baixa de um clique — quem confirma é a Tesouraria.
  let receiptCheck: ReceiptCheck | null = null;
  if (params.file && params.file.type === 'application/pdf') {
    const text = await pdfText(receiptBuffer ?? Buffer.from(await params.file.arrayBuffer()));
    receiptCheck = checkReceipt(text, { txids: items.map((i) => i.account.id), amount: total, lodgeCnpj: lodge.cnpj, lodgePixKey: lodge.pixKey });
  }
  const createdAt = new Date();
  try {
    await withTenant(lodgeId, async (db) => {
      for (const i of items) {
        await logAudit(db, {
          lodgeId,
          userId,
          action: 'CREATE',
          entity: PAYMENT_NOTICE_ENTITY,
          entityId: i.account.id,
          metadata: {
            memberId, amount: i.balance, title: i.account.title, note: note || null, ...group,
            ...(receipt ? { receiptKey: receipt.key, receiptName: receipt.name, receiptType: receipt.type } : {}),
            ...(receiptCheck ? { receiptCheck } : {}),
          },
        });
      }
    });
  } catch (err) {
    if (receipt) await deleteObject(receipt.key).catch(() => {});
    throw err;
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://sigmahorus.com.br').replace(/\/+$/, '');
  const lines = items.map((i) => `- "${i.account.title}" (vencimento ${formatDateOnly(i.account.dueDate)}), ${brl(i.balance)}: ${appUrl}/dashboard/pagamentos?conta=${i.account.id}`);
  const subject = `Aviso de pagamento — ${member.name}`;
  const intro = items.length > 1
    ? `O irmão ${member.name} informou pelo portal que pagou num único Pix de ${brl(total)} as ${items.length} contas abaixo:`
    : `O irmão ${member.name} informou pelo portal que pagou via Pix a conta abaixo:`;
  const text = `${intro}
${lines.join('\n')}${note ? `\n\nObservação do irmão: ${note}` : ''}${receipt ? `\n\nComprovante em anexo (${receipt.name}).${receiptCheck ? ` Conferência automática: ${receiptCheck.status === 'conferido' ? `CONFERIDO — identificador do QR, valor, recebedor (loja) e nº de controle ${receiptCheck.e2e} batem. No topo de Pagamentos, basta clicar em "Confirmar e dar baixa".` : receiptCheck.status === 'ilegivel' ? 'PDF sem texto legível; confira pela imagem.' : 'COM DIVERGÊNCIA — confira antes de dar baixa.'}` : ''}` : ''}

Confira o crédito no extrato da conta da loja e dê a baixa (cada link abre o formulário preenchido).
Este aviso não dá baixa automática. Os avisos pendentes também ficam no topo de Financeiro → Pagamentos.

${lodge.name}`;
  const recipients = [...new Set(staff.map((u) => u.email).filter(Boolean))];
  // O comprovante vai anexado: o Tesoureiro confere direto no e-mail.
  const attachments = receiptBuffer && receipt ? [{ filename: receipt.name, content: receiptBuffer.toString('base64') }] : undefined;
  await Promise.all(recipients.map((to) => dispatch('email', to, subject, text, EMPTY_CHANNELS, { attachments }).catch(() => null)));

  return { ok: true, paidNoticeAt: createdAt, notified: recipients.length, receipt: Boolean(receipt) };
}
