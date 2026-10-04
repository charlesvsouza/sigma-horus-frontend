import type { Prisma } from '@/generated/prisma/client';
import { listAbsenceStreaks } from '@/lib/attendance-streak-server';
import { brl } from '@/lib/currency';
import { formatDateOnly, todayBR } from '@/lib/date-only';
import { getTroncoBalance } from '@/lib/hospitalaria';
import { getLodgeOverdueDuesReport, isArt002Enabled } from '@/lib/overdue';
import { birthdayWithin, type OverviewScope } from '@/lib/overview-roles';
import { loadEndingMothers } from '@/lib/recurring-renewal';
import { STREAK_SESSION_TYPES } from '@/lib/attendance-streak';

type Db = Prisma.TransactionClient;

export type Tone = 'rose' | 'gold' | 'muted' | 'emerald';
export interface OverviewItem { key: string; label: string; value: string | number; href?: string; tone: Tone; hint?: string }
export interface OverviewGroup { title: string; items: OverviewItem[] }

const DAY = 86_400_000;

/**
 * Indicadores da Visão geral (fora a posição financeira) para o escopo do cargo. Cada indicador é só leitura e leva à tela
 * já filtrada quando existe filtro. O saldo do Tronco entra para todos os cargos de gestão (sem doador).
 */
export async function loadOverviewGroups(
  db: Db,
  lodgeId: string,
  scope: OverviewScope,
  links: { fundos: boolean },
  now: Date = new Date(),
): Promise<OverviewGroup[]> {
  const today = todayBR(now);
  const groups: OverviewGroup[] = [];

  // --- Tesouraria operacional / conformidade / visto
  const treasuryItems: OverviewItem[] = [];
  if (scope.treasury) {
    const [unmatched, ending] = await Promise.all([
      db.bankTransaction.count({ where: { lodgeId, status: 'unmatched', amount: { gt: 0 } } }),
      loadEndingMothers(db, lodgeId, now),
    ]);
    treasuryItems.push({ key: 'extrato', label: 'Créditos do extrato sem conciliar', value: unmatched, href: '/dashboard/conciliacao-bancaria', tone: 'gold' });
    treasuryItems.push({ key: 'recorrencias', label: 'Recorrências chegando ao fim', value: ending.length, href: '/dashboard/cobrancas', tone: 'gold' });
  }
  if (scope.approvals) {
    const awaiting = await db.account.count({ where: { lodgeId, type: 'PAYABLE', approvalStatus: 'pending' } });
    treasuryItems.push({ key: 'visto', label: 'Despesas aguardando visto', value: awaiting, href: '/dashboard/contas?tipo=PAYABLE&sit=open', tone: 'gold' });
  }
  if (scope.compliance) {
    const [open, broken, lodge] = await Promise.all([
      db.memberBlock.count({ where: { lodgeId, status: 'open' } }),
      db.memberBlock.count({ where: { lodgeId, status: 'open', brokenAt: { not: null } } }),
      db.lodge.findUnique({ where: { id: lodgeId }, select: { art002Enabled: true } }),
    ]);
    if (isArt002Enabled(lodge)) {
      const rows = await getLodgeOverdueDuesReport(db, lodgeId, now);
      const art002 = rows.filter((r) => r.art002 && r.memberStatus !== 'blocked').length;
      treasuryItems.push({ key: 'art002', label: 'Irmãos no Art. 002 (informativo)', value: art002, href: '/dashboard/relatorios/inadimplencia', tone: 'rose' });
    }
    treasuryItems.push({ key: 'acordos', label: 'Acordos de regularização em andamento', value: open, href: '/dashboard/acordos', tone: 'muted' });
    treasuryItems.push({ key: 'acordos-atrasados', label: 'Acordos com parcela atrasada', value: broken, href: '/dashboard/acordos', tone: 'rose' });
  }
  if (treasuryItems.length > 0) groups.push({ title: 'Tesouraria e conformidade', items: treasuryItems });

  // --- Secretaria
  if (scope.secretariat) {
    const items: OverviewItem[] = [];
    const [next, past, candidates, members] = await Promise.all([
      db.session.findFirst({ where: { lodgeId, date: { gte: now } }, orderBy: { date: 'asc' }, select: { title: true, date: true } }),
      db.session.findMany({
        where: { lodgeId, type: { in: STREAK_SESSION_TYPES }, date: { lt: new Date(now.getTime() - DAY), gte: new Date(now.getTime() - 120 * DAY) } },
        select: { id: true, minutesStorageKey: true, _count: { select: { minutesFiles: true } } },
      }),
      db.candidateProcess.count({ where: { lodgeId, closedAt: null, initiatedAt: null } }),
      db.member.findMany({ where: { lodgeId, status: 'active', deceased: false }, select: { id: true, name: true, email: true, cpf: true, birthDate: true } }),
    ]);
    items.push({ key: 'proxima', label: 'Próxima sessão', value: next ? formatDateOnly(next.date.toISOString()) : '—', href: '/dashboard/sessoes', tone: 'muted', hint: next?.title });
    items.push({ key: 'balaustres', label: 'Balaústres sem arquivo', value: past.filter((s) => !s.minutesStorageKey && s._count.minutesFiles === 0).length, href: '/dashboard/sessoes', tone: 'gold' });
    items.push({ key: 'candidatos', label: 'Candidatos em processo', value: candidates, href: '/dashboard/candidatos', tone: 'muted' });
    items.push({ key: 'cadastros', label: 'Cadastros incompletos (sem CPF ou e-mail)', value: members.filter((m) => !m.cpf || !m.email?.trim()).length, href: '/dashboard/membros', tone: 'gold' });
    const birthdays = members.filter((m) => m.birthDate && birthdayWithin(m.birthDate, today, 7));
    items.push({ key: 'aniversarios', label: 'Aniversariantes nos próximos 7 dias', value: birthdays.length, href: '/dashboard/membros', tone: 'muted', hint: birthdays.slice(0, 3).map((m) => m.name.split(' ')[0]).join(', ') || undefined });
    groups.push({ title: 'Secretaria', items });
  }

  // --- Faltas seguidas (Venerável, Secretário, Hospitaleiro, Administrador)
  if (scope.attendance) {
    const streaks = await listAbsenceStreaks(db, lodgeId, now);
    groups.push({
      title: 'Frequência',
      items: [{
        key: 'faltas', label: 'Irmãos com 3 ou mais faltas seguidas', value: streaks.length, href: '/dashboard/sessoes/frequencia', tone: 'rose',
        hint: streaks.slice(0, 3).map((s) => `${s.memberName.split(' ')[0]} (${s.count})`).join(', ') || undefined,
      }],
    });
  }

  // --- Hospitalaria + Tronco (o saldo é de todos os cargos de gestão)
  const hospItems: OverviewItem[] = [];
  const tronco = await getTroncoBalance(db, lodgeId);
  if (tronco.configured) hospItems.push({ key: 'tronco', label: 'Saldo do Tronco de Solidariedade', value: brl(tronco.balance), href: links.fundos ? '/dashboard/hospitalaria/fundos' : undefined, tone: 'emerald' });
  if (scope.hospitality) {
    const [campaigns, requests] = await Promise.all([
      db.campaign.count({ where: { lodgeId, status: 'active' } }),
      db.hospitalityRequest.count({ where: { lodgeId, status: 'pending' } }),
    ]);
    hospItems.push({ key: 'campanhas', label: 'Campanhas ativas', value: campaigns, href: '/dashboard/hospitalaria/campanhas', tone: 'muted' });
    hospItems.push({ key: 'pedidos', label: 'Pedidos de auxílio aguardando', value: requests, href: '/dashboard/hospitalaria/campanhas', tone: 'gold' });
  }
  if (hospItems.length > 0) groups.push({ title: 'Hospitalaria', items: hospItems });

  // --- Loja (assinatura)
  if (scope.system) {
    const sub = await db.subscription.findUnique({ where: { lodgeId }, select: { status: true, trialEndsAt: true } });
    if (sub) {
      const days = sub.trialEndsAt ? Math.ceil((sub.trialEndsAt.getTime() - now.getTime()) / DAY) : null;
      const trial = sub.status === 'trialing';
      groups.push({
        title: 'Loja',
        items: [{ key: 'assinatura', label: trial ? 'Período de teste' : 'Assinatura', value: trial ? (days !== null && days > 0 ? `${days} dias restantes` : 'encerrado') : sub.status === 'active' ? 'ativa' : sub.status, href: '/dashboard/assinatura', tone: trial && (days === null || days <= 7) ? 'rose' : trial ? 'gold' : 'emerald' }],
      });
    }
  }
  return groups;
}
