import { cleanMessage, cleanStack, fingerprint, isNoise, normalizeRoute, shouldAlert, type ErrorSource } from '@/lib/error-monitor-core';
import { dispatch, EMPTY_CHANNELS } from '@/lib/messaging';
import { prismaAdmin } from '@/lib/prisma';
import { SITE_URL } from '@/lib/seo';

// Registro de erros em produção: um ErrorEvent por impressão digital, com contagem. Avisa o dono por
// e-mail (ERROR_ALERT_EMAIL) quando o erro é novo, volta depois de resolvido ou segue ocorrendo (1/dia).
// NUNCA lança: monitorar não pode derrubar a requisição que já falhou. Não grava corpo, cabeçalhos nem
// cookies — só rota (sem query), método, mensagem (1ª linha) e pilha.

export interface ErrorReport {
  source: ErrorSource;
  route: string;
  method?: string | null;
  message: unknown;
  stack?: unknown;
  digest?: string | null;
}

export async function recordError(report: ErrorReport, now: Date = new Date()): Promise<void> {
  try {
    const message = cleanMessage(report.message);
    if (isNoise(message, report.digest)) return;
    const route = normalizeRoute(report.route);
    const fp = fingerprint(report.source, route, message);
    const existing = await prismaAdmin.errorEvent.findUnique({ where: { fingerprint: fp }, select: { id: true, lastAlertedAt: true, resolvedAt: true } });
    const alert = shouldAlert(existing, now);
    if (existing) {
      await prismaAdmin.errorEvent.update({
        where: { fingerprint: fp },
        data: { count: { increment: 1 }, lastSeenAt: now, resolvedAt: null, digest: report.digest ?? undefined, ...(alert ? { lastAlertedAt: now } : {}) },
      });
    } else {
      await prismaAdmin.errorEvent
        .create({ data: { fingerprint: fp, source: report.source, route, method: report.method ?? null, message, stack: cleanStack(report.stack), digest: report.digest ?? null, firstSeenAt: now, lastSeenAt: now, lastAlertedAt: now } })
        // Duas requisições com o mesmo erro novo ao mesmo tempo: a segunda só conta.
        .catch(() => prismaAdmin.errorEvent.update({ where: { fingerprint: fp }, data: { count: { increment: 1 }, lastSeenAt: now } }));
    }
    if (alert) await sendAlert({ source: report.source, route, method: report.method ?? null, message, isNew: !existing, reopened: Boolean(existing?.resolvedAt) });
  } catch (err) {
    console.error('[error-monitor] falha ao registrar erro', err);
  }
}

async function sendAlert(a: { source: ErrorSource; route: string; method: string | null; message: string; isNew: boolean; reopened: boolean }): Promise<void> {
  const to = process.env.ERROR_ALERT_EMAIL?.trim();
  if (!to) return;
  const kind = a.isNew ? 'Erro novo' : a.reopened ? 'Erro voltou' : 'Erro continua';
  const where = `${a.source === 'client' ? 'tela' : 'servidor'}${a.method ? ` ${a.method}` : ''} ${a.route}`;
  const body = [
    `${kind} no Sigma Horus (${where}).`,
    '',
    `Mensagem: ${a.message}`,
    '',
    `Detalhes, pilha e contagem em ${SITE_URL}/plataforma/erros (informe o token da plataforma).`,
    a.isNew ? '' : 'Este aviso se repete no máximo 1 vez por dia por tipo de erro.',
  ].join('\n');
  await dispatch('email', to, `[Sigma Horus] ${kind}: ${a.route}`, body, EMPTY_CHANNELS).catch(() => null);
}
