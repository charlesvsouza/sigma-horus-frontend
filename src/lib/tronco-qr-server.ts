import type { Prisma } from '@/generated/prisma/client';
import QRCode from 'qrcode';
import { createStaticPixQrCode, getActivePixAddressKey, listPaymentsByPixQrCode } from '@/lib/asaas';
import { buildLodgeAsaasConfig } from '@/lib/asaas-config';
import { feeFromNet, isAsaasMode } from '@/lib/collection';
import { prismaAdmin, withTenant } from '@/lib/prisma';
import {
  QR_PAID_STATUSES, asaasExpiration, qrDescription, qrExpiryFor, qrExternalReference, qrState, type QrSource, type QrState,
} from '@/lib/tronco-qr';
import { buildPixPayload } from '@/lib/pix';
import { sessionTxid } from '@/lib/tronco-loja-pix';
import { generateTroncoCode } from '@/lib/tronco-session';

type Db = Prisma.TransactionClient;

export interface SessionQrView {
  state: QrState | 'unavailable';
  reason?: string;
  /** Copia e cola (EMV) do QR. */
  payload?: string;
  /** PNG em data URL, pronto para <img>. */
  dataUrl?: string;
  expiresAt?: Date;
  /** Modo Loja: txid do Pix (o que o Tesoureiro procura no extrato). */
  identifier?: string | null;
  provider?: 'asaas' | 'lodge';
}

/**
 * QR Pix estático do Tronco de uma sessão e origem. Cria no Asaas na primeira vez (a loja precisa estar no Modo Asaas, com a
 * chave conectada e uma chave Pix ativa) e reaproveita nas seguintes. Sessão que já passou da validade não ganha QR novo.
 */
export async function ensureSessionQr(lodgeId: string, sessionId: string, source: QrSource, now: Date = new Date()): Promise<SessionQrView> {
  const ctx = await withTenant(lodgeId, async (db) => ({
    lodge: await db.lodge.findUnique({ where: { id: lodgeId }, select: { collectionMode: true, asaasApiKeyEnc: true, asaasEnv: true, pixKey: true, tradeName: true, name: true, city: true } }),
    session: await db.session.findFirst({ where: { id: sessionId, lodgeId }, select: { id: true, title: true, date: true } }),
    qr: await db.troncoSessionQr.findUnique({ where: { sessionId_source: { sessionId, source } } }),
  }));
  if (!ctx.session) return { state: 'unavailable', reason: 'Sessão não encontrada.' };
  const render = async (payload: string, expiresAt: Date, extra: { identifier?: string | null; provider?: string } = {}): Promise<SessionQrView> => ({
    state: qrState(expiresAt, now), payload, expiresAt, dataUrl: await QRCode.toDataURL(payload, { margin: 1, width: 240 }),
    identifier: extra.identifier ?? null, provider: extra.provider === 'lodge' ? 'lodge' : 'asaas',
  });
  if (ctx.qr) return render(ctx.qr.payload, ctx.qr.expiresAt, { identifier: ctx.qr.identifier, provider: ctx.qr.provider });

  const expiresAt = qrExpiryFor(ctx.session.date);
  if (qrState(expiresAt, now) === 'expired') return { state: 'expired', expiresAt };
  const config = isAsaasMode(ctx.lodge) ? buildLodgeAsaasConfig(ctx.lodge) : null;

  // Modo Loja (ou Asaas sem a chave conectada): Pix estático da CHAVE DA LOJA, com o identificador da sessão no txid. Não vence
  // no banco (o QR vale para sempre); o Tesoureiro monitora a conta pelo identificador e lança no Tronco manualmente.
  if (!config) {
    if (!ctx.lodge?.pixKey?.trim()) return { state: 'unavailable', reason: 'Cadastre a chave Pix da loja em Configurações para gerar o QR do Tronco.' };
    const identifier = sessionTxid(sessionId, source);
    const payload = buildPixPayload({ key: ctx.lodge.pixKey, name: ctx.lodge.tradeName || ctx.lodge.name, city: ctx.lodge.city, txid: identifier });
    try {
      await withTenant(lodgeId, (db) => db.troncoSessionQr.create({ data: { lodgeId, sessionId, source, provider: 'lodge', identifier, asaasQrId: `loja:${identifier}`, payload, expiresAt } }));
    } catch {
      const other = await withTenant(lodgeId, (db) => db.troncoSessionQr.findUnique({ where: { sessionId_source: { sessionId, source } } }));
      if (other) return render(other.payload, other.expiresAt, { identifier: other.identifier, provider: other.provider });
    }
    return render(payload, expiresAt, { identifier, provider: 'lodge' });
  }

  try {
    const addressKey = await getActivePixAddressKey(config);
    if (!addressKey) return { state: 'unavailable', reason: 'A conta do Asaas não tem chave Pix ativa.' };
    const created = await createStaticPixQrCode(config, {
      addressKey, description: qrDescription(ctx.session, source), expirationDate: asaasExpiration(expiresAt), externalReference: qrExternalReference(lodgeId, sessionId, source),
    });
    try {
      await withTenant(lodgeId, (db) => db.troncoSessionQr.create({ data: { lodgeId, sessionId, source, asaasQrId: created.id, payload: created.payload, expiresAt } }));
    } catch {
      // Duas aberturas ao mesmo tempo: a outra gravou primeiro; usa a dela.
      const other = await withTenant(lodgeId, (db) => db.troncoSessionQr.findUnique({ where: { sessionId_source: { sessionId, source } } }));
      if (other) return render(other.payload, other.expiresAt, { identifier: other.identifier, provider: other.provider });
      throw new Error('qr duplicado e não encontrado');
    }
    return render(created.payload, expiresAt, { provider: 'asaas' });
  } catch (err) {
    console.error('tronco qr: falha ao criar o QR no Asaas', { lodgeId, sessionId, err });
    return { state: 'unavailable', reason: 'Não foi possível gerar o QR agora (Asaas indisponível).' };
  }
}

export interface QrPaymentLike { id: string; status: string; value: number; netValue?: number | null }

/** Registra um pagamento recebido pelo QR como entrada pendente do Tronco (idempotente pelo id do pagamento no Asaas). */
export async function ingestQrPayment(
  db: Db,
  qr: { lodgeId: string; sessionId: string; source: string },
  payment: QrPaymentLike,
): Promise<'created' | 'exists' | 'skipped'> {
  if (!QR_PAID_STATUSES.includes(payment.status) || !(payment.value > 0)) return 'skipped';
  const exists = await db.troncoIntake.findUnique({ where: { externalRef: payment.id }, select: { id: true } });
  if (exists) return 'exists';
  const fee = feeFromNet(payment.value, payment.netValue ?? null);
  await db.troncoIntake.create({
    data: {
      lodgeId: qr.lodgeId, sessionId: qr.sessionId, source: qr.source, channel: 'pix_qr', amount: payment.value, status: 'pending',
      code: generateTroncoCode(), externalRef: payment.id, fee: fee != null && fee > 0 ? fee : null,
      note: 'Pix recebido pelo QR da sessão', declaredByName: 'Asaas (QR da sessão)',
    },
  });
  return 'created';
}

/** Conferência com o Asaas: puxa os pagamentos dos QR da loja que o webhook possa ter perdido. */
export async function reconcileLodgeQrs(lodgeId: string, now: Date = new Date()): Promise<{ qrs: number; created: number }> {
  const since = new Date(now.getTime() - 3 * 86_400_000);
  const ctx = await withTenant(lodgeId, async (db) => ({
    lodge: await db.lodge.findUnique({ where: { id: lodgeId }, select: { asaasApiKeyEnc: true, asaasEnv: true } }),
    qrs: await db.troncoSessionQr.findMany({ where: { lodgeId, provider: 'asaas', expiresAt: { gte: since } } }),
  }));
  const config = buildLodgeAsaasConfig(ctx.lodge);
  if (!config || ctx.qrs.length === 0) return { qrs: ctx.qrs.length, created: 0 };
  let created = 0;
  for (const qr of ctx.qrs) {
    const payments = await listPaymentsByPixQrCode(config, qr.asaasQrId);
    await withTenant(lodgeId, async (db) => {
      for (const p of payments) {
        if ((await ingestQrPayment(db, qr, { id: p.id, status: p.status, value: Number(p.value), netValue: p.netValue ?? null })) === 'created') created++;
      }
    });
  }
  return { qrs: ctx.qrs.length, created };
}

/** Cron diário: confere os QR de todas as lojas com QR recente. */
export async function reconcileAllTroncoQrs(now: Date = new Date()): Promise<{ lodges: number; created: number }> {
  const since = new Date(now.getTime() - 3 * 86_400_000);
  const lodges = await prismaAdmin.troncoSessionQr.findMany({ where: { provider: 'asaas', expiresAt: { gte: since } }, select: { lodgeId: true }, distinct: ['lodgeId'] });
  let created = 0;
  for (const { lodgeId } of lodges) {
    try { created += (await reconcileLodgeQrs(lodgeId, now)).created; } catch (err) { console.error('tronco qr: falha ao conferir', { lodgeId, err }); }
  }
  return { lodges: lodges.length, created };
}
