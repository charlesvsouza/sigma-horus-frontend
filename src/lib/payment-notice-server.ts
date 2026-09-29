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
import { checkReceipt, receiptTxids, type ReceiptCheck } from '@/lib/receipt-check';
import { acceptableAmounts, lateChargeConfig } from '@/lib/late-charge';
import { receiptAckMessage } from '@/lib/receipt-ack';
import { pdfText } from '@/lib/receipt-pdf';

// "Já paguei" (Modo Loja) de UMA ou de VÁRIAS contas (Pix agrupado): o Pix caiu direto na
// conta da loja e o sistema não fica sabendo. Registra um aviso por conta (AuditLog), sobe o
// comprovante (storage privado, a mesma chave em todas) e manda UM e-mail à Tesouraria.
// Não dá baixa em nada.
// Também serve à Tesouraria (`registeredBy`): o irmão mandou o comprovante por fora (ex.:
// WhatsApp) e o Tesoureiro/Administrador o registra em nome dele — mesma conferência, mesmo
// quadro de avisos em Pagamentos, sem a carência de 24h; a data do aviso é a da inclusão.

export type NoticeResult =
  | { ok: true; paidNoticeAt: Date; notified: number; receipt: boolean; receiptCheck: ReceiptCheck | null }
  | { ok: false; status: number; error: string; paidNoticeAt?: Date; code?: 'exists' | 'paid-at-required' };

export interface NoticeRegisteredBy { userId: string; name: string; role: string }

export async function submitPaymentNotice(params: {
  lodgeId: string;
  memberId: string;
  userId: string;
  accountIds: string[];
  note: string;
  file: File | null;
  /** Registrado pela Tesouraria em nome do irmão. */
  registeredBy?: NoticeRegisteredBy;
  /** Data do Pix (AAAA-MM-DD) informada por quem registrou — obrigatória se o comprovante não traz data legível. */
  paidAtInformed?: string | null;
  /** Registro pela Tesouraria: avisar o irmão por e-mail (no portal, o irmão é sempre avisado). */
  notifyMember?: boolean;
  /** Já existe aviso desta conta: substitui (o mais recente vale no quadro de Pagamentos). */
  replace?: boolean;
}): Promise<NoticeResult> {
  const { lodgeId, memberId, userId, registeredBy } = params;
  const paidAtInformed = params.paidAtInformed && /^\d{4}-\d{2}-\d{2}$/.test(params.paidAtInformed) ? params.paidAtInformed : null;
  const accountIds = [...new Set(params.accountIds)];
  const note = params.note.trim().slice(0, 300);
  if (accountIds.length === 0) return { ok: false, status: 400, error: 'Nenhuma conta informada.' };
  if (params.file) {
    const invalid = receiptUploadError(params.file);
    if (invalid) return { ok: false, status: 400, error: invalid };
  }

  const ctx = await withTenant(lodgeId, async (db) => {
    const [accounts, lodge, member, last, staff, invoices] = await Promise.all([
      db.account.findMany({
        where: { id: { in: accountIds }, lodgeId, memberId },
        select: {
          id: true, title: true, type: true, amount: true, dueDate: true, status: true, memberId: true, approvalStatus: true,
          payments: { select: { amount: true } },
        },
        orderBy: { dueDate: 'asc' },
      }),
      db.lodge.findUnique({ where: { id: lodgeId }, select: { name: true, collectionMode: true, cnpj: true, pixKey: true, chargeLateFeesOnPix: true, lateFeePercent: true, lateInterestPercentMonth: true } }),
      db.member.findUnique({ where: { id: memberId }, select: { name: true, email: true } }),
      db.auditLog.findFirst({
        where: { lodgeId, entity: PAYMENT_NOTICE_ENTITY, entityId: { in: accountIds } },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.user.findMany({ where: { lodgeId, role: { in: ['treasurer', 'admin', 'venerable'] }, status: 'active' }, select: { id: true, email: true } }),
      db.invoice.findMany({ where: { lodgeId, accountId: { in: accountIds } }, select: { number: true } }),
    ]);
    return { accounts, lodge, member, last, staff, invoices };
  });

  const { accounts, lodge, member, last, staff, invoices } = ctx;
  if (accounts.length !== accountIds.length || !lodge || !member) return { ok: false, status: 404, error: 'Conta não encontrada.' };
  if (isAsaasMode(lodge)) {
    return { ok: false, status: 409, error: 'Nesta loja o pagamento pelo portal é confirmado automaticamente — não é preciso avisar.' };
  }
  const items = accounts.map((a) => ({ account: a, balance: openBalance(a, a.payments) }));
  if (items.some((i) => !canPay(i.account, memberId, i.balance))) {
    return { ok: false, status: 409, error: accountIds.length > 1 ? 'Alguma das contas não está mais em aberto. Recarregue a página.' : 'Esta conta não está em aberto.' };
  }
  if (registeredBy) {
    // Tesouraria: sem carência, mas não sobrepõe um aviso existente sem pedir.
    if (last && !params.replace) {
      return { ok: false, status: 409, code: 'exists', error: 'Já existe um aviso de pagamento desta cobrança.', paidNoticeAt: last.createdAt };
    }
    if (!params.file) return { ok: false, status: 400, error: 'Anexe o comprovante.' };
  } else if (last && Date.now() - last.createdAt.getTime() < PAYMENT_NOTICE_COOLDOWN_MS) {
    return { ok: false, status: 429, error: 'Você já avisou a Tesouraria sobre esta conta nas últimas 24 horas.', paidNoticeAt: last.createdAt };
  }

  const total = sumMoney(items.map((i) => i.balance));
  const txids = receiptTxids(items.map((i) => i.account.id), invoices.map((i) => i.number));
  const fileBuffer = params.file ? Buffer.from(await params.file.arrayBuffer()) : null;

  // Comprovante em PDF: conferido contra o QR que o sistema gerou (txid = id da conta ou nº da
  // cobrança; no agrupado o valor é o total). Só habilita a baixa de um clique — quem confirma é a
  // Tesouraria. Conferido ANTES de subir: a Tesouraria precisa informar a data se ela não for lida.
  let receiptCheck: ReceiptCheck | null = null;
  if (params.file && fileBuffer && params.file.type === 'application/pdf') {
    // Com multa e juros no Pix, aceita também o valor atualizado de qualquer dia desde o vencimento.
    const amounts = acceptableAmounts(items.map((i) => ({ balance: i.balance, dueDate: i.account.dueDate })), lateChargeConfig(lodge));
    receiptCheck = checkReceipt(await pdfText(fileBuffer), { txids, amount: total, amounts, lodgeCnpj: lodge.cnpj, lodgePixKey: lodge.pixKey });
  }
  if (registeredBy && !receiptCheck?.paidAt && !paidAtInformed) {
    return { ok: false, status: 400, code: 'paid-at-required', error: 'Não foi possível ler a data do Pix no comprovante. Informe a data do pagamento.' };
  }

  // Comprovante: sobe antes de registrar (sem o arquivo no storage, o aviso não o cita).
  let receipt: { key: string; name: string; type: string } | null = null;
  const receiptBuffer = fileBuffer;
  if (params.file && receiptBuffer) {
    const key = buildObjectKey(params.file.name, `payment-receipts/${lodgeId}`);
    const ok = await putObject(key, receiptBuffer, params.file.type).catch(() => false);
    if (!ok) return { ok: false, status: 502, error: 'Não foi possível enviar o comprovante. Tente de novo ou avise sem anexo.' };
    receipt = { key, name: params.file.name.slice(0, 120), type: params.file.type };
  }

  const group = items.length > 1 ? { groupAccountIds: accountIds, groupTotal: total } : {};
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
            ...(registeredBy ? { registeredBy, source: 'staff' } : {}),
            ...(paidAtInformed ? { paidAtInformed } : {}),
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
  const intro = registeredBy
    ? `${registeredBy.name} registrou o comprovante que o irmão ${member.name} enviou fora do portal, referente à conta abaixo:`
    : items.length > 1
      ? `O irmão ${member.name} informou pelo portal que pagou num único Pix de ${brl(total)} as ${items.length} contas abaixo:`
      : `O irmão ${member.name} informou pelo portal que pagou via Pix a conta abaixo:`;
  const text = `${intro}
${lines.join('\n')}${note ? `\n\nObservação do irmão: ${note}` : ''}${receipt ? `\n\nComprovante em anexo (${receipt.name}).${receiptCheck ? ` Conferência automática: ${receiptCheck.status === 'conferido' ? `CONFERIDO — identificador do QR, valor, recebedor (loja) e nº de controle ${receiptCheck.e2e} batem. No topo de Pagamentos, basta clicar em "Confirmar e dar baixa".` : receiptCheck.status === 'ilegivel' ? 'PDF sem texto legível; confira pela imagem.' : 'COM DIVERGÊNCIA — confira antes de dar baixa.'}` : ''}` : ''}

Confira o crédito no extrato da conta da loja e dê a baixa (cada link abre o formulário preenchido).
Este aviso não dá baixa automática. Os avisos pendentes também ficam no topo de Financeiro → Pagamentos.

${lodge.name}`;
  // Quem registrou não precisa de e-mail sobre o que acabou de fazer.
  const recipients = [...new Set(staff.filter((u) => u.id !== registeredBy?.userId).map((u) => u.email).filter(Boolean))];
  // O comprovante vai anexado: o Tesoureiro confere direto no e-mail.
  const attachments = receiptBuffer && receipt ? [{ filename: receipt.name, content: receiptBuffer.toString('base64') }] : undefined;
  await Promise.all(recipients.map((to) => dispatch('email', to, subject, text, EMPTY_CHANNELS, { attachments }).catch(() => null)));

  // Protocolo ao irmão com o resultado da análise: sempre no portal; na Tesouraria, se marcado.
  if (member.email && (!registeredBy || params.notifyMember)) {
    const ack = receiptAckMessage({
      memberName: member.name,
      lodgeName: lodge.name,
      items: items.map((i) => ({ title: i.account.title, amount: i.balance })),
      invoiceNumbers: invoices.map((i) => i.number),
      noticeAt: createdAt,
      check: receiptCheck,
      hasReceipt: Boolean(receipt),
      byStaff: Boolean(registeredBy),
    });
    await dispatch('email', member.email, ack.subject, ack.text, EMPTY_CHANNELS).catch(() => null);
  }

  return { ok: true, paidNoticeAt: createdAt, notified: recipients.length, receipt: Boolean(receipt), receiptCheck };
}
