import type { Prisma } from '@/generated/prisma/client';
import { officeRank } from '@/lib/office-order';
import type { Signatory } from '@/components/report/report-document';

// Posições de officeRank() (lib/office-order): 1 = Venerável Mestre, 5 = Secretário, 6 = Tesoureiro.
const RANK_VENERAVEL = 1;
const RANK_SECRETARIO = 5;
const RANK_TESOUREIRO = 6;

/** Minúsculo e sem acento, para casar nomes de cargo ("Arquiteto", "ARQUITETO"). */
const plain = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Titulares dos cargos no veneralato que cobre `at` — ou, sem data, no veneralato em exercício. */
async function termHolders(db: Prisma.TransactionClient, lodgeId: string, at?: Date) {
  const term =
    (at
      ? await db.term.findFirst({
          where: { lodgeId, startDate: { lte: at }, OR: [{ endDate: null }, { endDate: { gte: at } }] },
          orderBy: { startDate: 'desc' },
          select: { id: true },
        })
      : null) ??
    (await db.term.findFirst({ where: { lodgeId, status: { not: 'closed' } }, orderBy: { startDate: 'desc' }, select: { id: true } }));

  return term
    ? db.memberOffice.findMany({
        where: { lodgeId, termId: term.id },
        select: { office: { select: { name: true } }, member: { select: { name: true } } },
      })
    : [];
}

/**
 * Quem assina a prestação de contas: Tesoureiro e Venerável Mestre do veneralato que
 * cobre a data `at` (fim do período do relatório) — ou, sem data, do veneralato em
 * exercício. Cargo vago = linha em branco, para assinar à mão.
 * `withFinanceCommittee` acrescenta a linha da Comissão de Finanças (parecer).
 * `by: 'secretary'` troca o Tesoureiro pelo Secretário (documentos do quadro social).
 */
export async function getReportSignatories(
  db: Prisma.TransactionClient,
  lodgeId: string,
  opts: { at?: Date; withFinanceCommittee?: boolean; by?: 'treasurer' | 'secretary' } = {},
): Promise<Signatory[]> {
  const { at, withFinanceCommittee = false, by = 'treasurer' } = opts;
  const holders = await termHolders(db, lodgeId, at);
  const nameFor = (rank: number) => holders.find((h) => officeRank(h.office.name) === rank)?.member.name ?? null;

  const list: Signatory[] = [
    by === 'secretary'
      ? { role: 'Secretário', name: nameFor(RANK_SECRETARIO) }
      : { role: 'Tesoureiro', name: nameFor(RANK_TESOUREIRO) },
    { role: 'Venerável Mestre', name: nameFor(RANK_VENERAVEL) },
  ];
  if (withFinanceCommittee) list.push({ role: 'Comissão de Finanças', name: null });
  return list;
}

/** Termo de responsabilidade de materiais: assinam, pela loja, o Secretário e o Arquiteto em exercício. */
export async function getMaterialsSignatories(db: Prisma.TransactionClient, lodgeId: string): Promise<Signatory[]> {
  const holders = await termHolders(db, lodgeId);
  const architect = holders.find((h) => plain(h.office.name).includes('arquiteto'))?.member.name ?? null;
  return [
    { role: 'Secretário', name: holders.find((h) => officeRank(h.office.name) === RANK_SECRETARIO)?.member.name ?? null },
    { role: 'Arquiteto', name: architect },
  ];
}

/**
 * Chanceler do veneralato que cobre `at` — assina o certificado de presença quando a arte da loja
 * traz a linha "Chanceler". Cargo vago = linha em branco.
 */
export async function getChancellorSignatory(db: Prisma.TransactionClient, lodgeId: string, at?: Date): Promise<Signatory> {
  const holders = await termHolders(db, lodgeId, at);
  return { role: 'Chanceler', name: holders.find((h) => plain(h.office.name).includes('chanceler'))?.member.name ?? null };
}
