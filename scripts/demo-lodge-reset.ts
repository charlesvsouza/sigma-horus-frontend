/**
 * Prepara a loja de DEMONSTRAÇÃO (Tim Maia, slug "horus-reaa") para apresentações e vídeos:
 * APAGA os dados de uso da loja (membros não ligados a login, lançamentos, pagamentos, sessões,
 * auditoria…) e recria tudo com dados FICTÍCIOS — irmãos sem e-mail nem telefone (a rotina diária
 * nunca envia nada a ninguém), CPFs inventados, valores redondos e uma chave Pix inexistente.
 *
 * Mantém: a loja, os logins (Administrador e o obreiro ligado), plano de contas, ritos, Potências,
 * cargos, permissões e as contas bancárias (renomeadas e com saldo fictício).
 *
 * Só funciona na horus-reaa (recusa qualquer outra). Simulação por padrão; para gravar:
 *   env -u DATABASE_URL -u APP_DATABASE_URL node --env-file=.env --import ./test/setup.mjs \
 *     scripts/demo-lodge-reset.ts --yes --confirm-host kodama.proxy.rlwy.net
 */
import { prismaAdmin } from '../src/lib/prisma';

const SLUG = 'horus-reaa';
const argv = process.argv.slice(2);
const YES = argv.includes('--yes');
const confirmHost = argv[argv.indexOf('--confirm-host') + 1];
const DEMO_PIX = 'demonstracao@sigmahorus.com.br';
const YEAR = 2026;
const LAST_MONTH = 9; // setembro/2026: mês corrente da demonstração

// PRNG determinístico: a demonstração sai igual toda vez.
let seed = 139;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

function fakeCpf(): string {
  const n = Array.from({ length: 9 }, () => Math.floor(rnd() * 10));
  const dv = (len: number) => {
    const s = n.slice(0, len).reduce((acc, v, i) => acc + v * (len + 1 - i), 0);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  n.push(dv(9));
  n.push(dv(10));
  const d = n.join('');
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

const NAMES = [
  'Antônio Carlos Figueiredo', 'Bruno Henrique Tavares', 'Carlos Eduardo Monteiro', 'Daniel Rocha Vasconcelos',
  'Eduardo Martins Leal', 'Fábio Augusto Pereira', 'Gustavo Lima Barreto', 'Henrique Sampaio Neves',
  'Igor Nascimento Prado', 'João Batista Coutinho', 'Leonardo Farias Dantas', 'Marcelo Antunes Queiroz',
  'Nelson Ribeiro Guimarães', 'Otávio Mendes Brandão', 'Pedro Luís Cardoso', 'Rafael Teixeira Moura',
  'Rodrigo Almeida Siqueira', 'Sérgio Paulo Fontes', 'Thiago Correia Lacerda', 'Vinícius Rezende Castro',
  'Wagner Sales Bittencourt', 'Alexandre Pinto Moraes', 'Cláudio Freitas Aragão', 'Márcio Viana Loureiro',
  'Roberto Cunha Albuquerque',
];
const PORTAL_MEMBER_NAME = 'Paulo Henrique Andrade'; // o obreiro do login de demonstração

async function main() {
  const host = (() => { try { return new URL(process.env.DATABASE_URL ?? '').hostname; } catch { return ''; } })();
  const lodge = await prismaAdmin.lodge.findUnique({ where: { slug: SLUG }, select: { id: true, name: true } });
  if (!lodge) throw new Error(`Loja ${SLUG} não encontrada.`);
  const lodgeId = lodge.id;

  const [users, rite, power, offices, charts, fins, term] = await Promise.all([
    prismaAdmin.user.findMany({ where: { lodgeId }, select: { id: true, email: true, role: true, memberId: true } }),
    prismaAdmin.rite.findFirst({ where: { lodgeId, name: { contains: 'REAA' } }, select: { id: true } }),
    prismaAdmin.power.findFirst({ where: { lodgeId, name: { contains: 'GLMERJ' } }, select: { id: true } }),
    prismaAdmin.office.findMany({ where: { lodgeId }, select: { id: true, name: true } }),
    prismaAdmin.chartAccount.findMany({ where: { lodgeId, active: true }, select: { id: true, code: true, name: true, type: true, isDues: true } }),
    prismaAdmin.financialAccount.findMany({ where: { lodgeId }, select: { id: true, name: true, kind: true } }),
    prismaAdmin.term.findFirst({ where: { lodgeId, status: 'active' }, select: { id: true, title: true } }),
  ]);
  const keepMemberIds = users.map((u) => u.memberId).filter((m): m is string => Boolean(m));
  const chart = (code: string) => {
    const c = charts.find((x) => x.code === code);
    if (!c) throw new Error(`Categoria ${code} não existe na loja.`);
    return c;
  };
  const dues = charts.find((c) => c.isDues) ?? chart('1.1.01');
  const initiationFee = charts.find((c) => /inicia/i.test(c.name) && c.type === 'REVENUE');
  const bank = fins.find((f) => f.kind === 'bank' && !/invest/i.test(f.name)) ?? fins.find((f) => f.kind === 'bank');
  const invest = fins.find((f) => f.kind === 'bank' && f.id !== bank?.id);
  const cash = fins.find((f) => f.kind === 'cash');
  if (!bank || !cash || !term) throw new Error('A loja precisa de uma conta bancária, do Caixa e de um veneralato ativo.');

  const wipeCounts = {
    auditLog: await prismaAdmin.auditLog.count({ where: { lodgeId } }),
    member: await prismaAdmin.member.count({ where: { lodgeId, id: { notIn: keepMemberIds } } }),
    account: await prismaAdmin.account.count({ where: { lodgeId } }),
    payment: await prismaAdmin.payment.count({ where: { lodgeId } }),
    invoice: await prismaAdmin.invoice.count({ where: { lodgeId } }),
    counterparty: await prismaAdmin.counterparty.count({ where: { lodgeId } }),
  };
  console.log(`Loja: ${lodge.name} (${SLUG}) · banco: ${host}`);
  console.log('Logins mantidos:', users.map((u) => `${u.email} [${u.role}${u.memberId ? ', ligado a membro' : ''}]`).join('; '));
  console.log('Vai apagar (principais):', wipeCounts, '+ familiares, sessões, presenças, cargos exercidos, documentos, campanhas, avisos, balancetes…');
  console.log(`Vai criar: ${NAMES.length + keepMemberIds.length} irmãos fictícios, mensalidades jan–${String(LAST_MONTH).padStart(2, '0')}/${YEAR}, despesas, sessões e cargos do veneralato ${term.title}.`);
  console.log(`Pix da loja → ${DEMO_PIX} (inexistente) · contas bancárias com nomes e saldos fictícios · assinatura em teste até 31/12/2027.`);
  if (!YES) { console.log('\n[SIMULAÇÃO] nada foi gravado. Para gravar: --yes --confirm-host <host do banco>.'); return; }
  if (!confirmHost || !host.includes(confirmHost)) throw new Error(`--confirm-host não confere com o banco atual (${host}).`);

  // ── 1) Limpeza (filhos antes dos pais) ───────────────────────────────────
  await prismaAdmin.$transaction(async (tx) => {
    const w = { lodgeId };
    await tx.auditLog.deleteMany({ where: w });
    await tx.messageLog.deleteMany({ where: w });
    await tx.attendance.deleteMany({ where: w });
    await tx.session.deleteMany({ where: w });
    await tx.memberOffice.deleteMany({ where: w });
    await tx.bankTransaction.deleteMany({ where: w });
    await tx.payment.deleteMany({ where: w });
    await tx.invoice.deleteMany({ where: w });
    await tx.materialLoan.deleteMany({ where: w });
    await tx.materialIncident.deleteMany({ where: w });
    await tx.account.deleteMany({ where: w });
    await tx.accountTransfer.deleteMany({ where: w });
    await tx.asset.deleteMany({ where: w });
    await tx.balancete.deleteMany({ where: w });
    await tx.budget.deleteMany({ where: w });
    await tx.cashClose.deleteMany({ where: w });
    await tx.campaignDonation.deleteMany({ where: w });
    await tx.campaign.deleteMany({ where: w });
    await tx.document.deleteMany({ where: w });
    await tx.hospitalityRequest.deleteMany({ where: w });
    await tx.venerableGalleryEntry.deleteMany({ where: w });
    await tx.counterparty.deleteMany({ where: w });
    await tx.relative.deleteMany({ where: w });
    await tx.member.deleteMany({ where: { lodgeId, id: { notIn: keepMemberIds } } });
  }, { timeout: 180_000, maxWait: 20_000 });
  console.log('Limpeza concluída.');

  // ── 2) Loja, contas bancárias e assinatura ───────────────────────────────
  await prismaAdmin.lodge.update({
    where: { id: lodgeId },
    data: { pixKey: DEMO_PIX, bankName: 'Banco Exemplo', bankAgency: '0001', bankAccount: '12345-6', collectionMode: 'lodge', asaasAutoEmit: false },
  });
  await prismaAdmin.financialAccount.update({ where: { id: bank.id }, data: { name: 'Banco Exemplo — conta corrente', bankName: 'Banco Exemplo', agency: '0001', accountNumber: '12345-6', openingBalance: 8500, isDefault: true } });
  if (invest) await prismaAdmin.financialAccount.update({ where: { id: invest.id }, data: { name: 'Banco Exemplo — aplicação', openingBalance: 20000, isInvestment: true, isDefault: false } });
  await prismaAdmin.financialAccount.update({ where: { id: cash.id }, data: { openingBalance: 350, isDefault: false } });
  await prismaAdmin.subscription.upsert({
    where: { lodgeId },
    update: { status: 'trialing', trialEndsAt: day(2027, 12, 31) },
    create: { lodgeId, status: 'trialing', plan: 'loja', trialEndsAt: day(2027, 12, 31) },
  });

  // ── 3) Irmãos fictícios ──────────────────────────────────────────────────
  type Seed = { id: string; name: string; late: 'none' | 'one' | 'three' | 'portal' };
  const members: Seed[] = [];
  const degreeFor = (i: number) => {
    // 3 Aprendizes, 3 Companheiros, o resto Mestres (2 Mestres Instalados).
    const initiated = i < 3 ? day(YEAR, 3, 14 + i) : i < 6 ? day(2025, 4, 10 + i) : day(2008 + (i % 14), 1 + (i % 11), 5 + (i % 20));
    const elevated = i < 3 ? null : i < 6 ? day(2026, 2, 12) : new Date(initiated.getTime() + 400 * 86_400_000);
    const exalted = i < 6 ? null : new Date(initiated.getTime() + 800 * 86_400_000);
    const installed = i === 6 || i === 7 ? new Date(initiated.getTime() + 3000 * 86_400_000) : null;
    return { initiationDate: initiated, elevationDate: elevated, exaltationDate: exalted, installationDate: installed };
  };
  for (const [i, name] of NAMES.entries()) {
    const m = await prismaAdmin.member.create({
      data: {
        lodgeId, name, status: 'active', cpf: fakeCpf(), riteId: rite?.id ?? null, powerId: power?.id ?? null,
        city: 'Rio de Janeiro', state: 'RJ', country: 'Brasil', occupation: pick(['Engenheiro', 'Advogado', 'Médico', 'Professor', 'Comerciante', 'Contador', 'Servidor público', 'Empresário']),
        birthDate: day(1955 + (i % 35), 1 + (i % 12), 1 + (i % 27)), duesExempt: i === 20, ...degreeFor(i),
      },
      select: { id: true, name: true },
    });
    members.push({ ...m, late: i === 9 ? 'three' : i === 14 || i === 17 ? 'one' : 'none' });
  }
  for (const id of keepMemberIds) {
    await prismaAdmin.member.update({
      where: { id },
      data: { name: PORTAL_MEMBER_NAME, cpf: fakeCpf(), status: 'active', riteId: rite?.id ?? null, powerId: power?.id ?? null, city: 'Rio de Janeiro', state: 'RJ', duesExempt: false, ...degreeFor(10) },
    });
    members.push({ id, name: PORTAL_MEMBER_NAME, late: 'portal' });
  }
  // Irmão com 3 mensalidades em atraso (>60 dias): enquadrado no Art. 002.
  const art = members.find((m) => m.late === 'three');
  if (art) await prismaAdmin.member.update({ where: { id: art.id }, data: { status: 'art_002' } });

  // ── 4) Veneralato: cargos ────────────────────────────────────────────────
  const officeId = (name: string) => offices.find((o) => o.name === name)?.id;
  const holders: [string, number][] = [['Venerável Mestre', 6], ['1º Vigilante', 7], ['2º Vigilante', 8], ['Orador', 11], ['Secretário', 12], ['Tesoureiro', 13], ['Chanceler', 15], ['Hospitaleiro', 16]];
  for (const [office, idx] of holders) {
    const oid = officeId(office);
    if (oid && members[idx]) await prismaAdmin.memberOffice.create({ data: { lodgeId, memberId: members[idx].id, officeId: oid, termId: term.id } });
  }

  // ── 5) Financeiro ────────────────────────────────────────────────────────
  let seq = 0;
  const number = (m: number) => `COB-${YEAR}${String(m).padStart(2, '0')}-${String(++seq).padStart(4, '0')}`;
  const method = () => pick(['pix', 'pix', 'pix', 'pix', 'manual', 'manual', 'cash']);
  const payDay = (due: Date) => new Date(due.getTime() + Math.floor(rnd() * 8 - 3) * 86_400_000 + 15 * 3_600_000);

  for (const m of members) {
    if (members.indexOf(m) === 20) continue; // remido: não paga mensalidade
    for (let month = 1; month <= LAST_MONTH; month++) {
      const due = day(YEAR, month, 10);
      const open =
        (m.late === 'three' && month >= LAST_MONTH - 2) ||
        (m.late === 'one' && month === LAST_MONTH) ||
        (m.late === 'portal' && month >= LAST_MONTH - 1);
      const account = await prismaAdmin.account.create({
        data: { lodgeId, type: 'RECEIVABLE', title: dues.name, amount: 110, dueDate: due, memberId: m.id, chartAccountId: dues.id, isDues: true, status: open ? 'pending' : 'paid' },
        select: { id: true },
      });
      await prismaAdmin.invoice.create({ data: { lodgeId, accountId: account.id, memberId: m.id, number: number(month), amount: 110, dueDate: due, status: open ? 'pending' : 'paid' } });
      if (!open) {
        const how = method();
        await prismaAdmin.payment.create({ data: { lodgeId, accountId: account.id, memberId: m.id, amount: 110, paidAt: payDay(due), method: how, bankAccountId: how === 'cash' ? cash.id : bank.id } });
      }
    }
  }
  // Taxa de iniciação dos três Aprendizes.
  if (initiationFee) {
    for (const m of members.slice(0, 3)) {
      const due = day(YEAR, 3, 10);
      const a = await prismaAdmin.account.create({ data: { lodgeId, type: 'RECEIVABLE', title: initiationFee.name, amount: 600, dueDate: due, memberId: m.id, chartAccountId: initiationFee.id, status: 'paid' }, select: { id: true } });
      await prismaAdmin.payment.create({ data: { lodgeId, accountId: a.id, memberId: m.id, amount: 600, paidAt: payDay(due), method: 'pix', bankAccountId: bank.id } });
    }
  }
  // Venda de rituais (1.2.04): duas pagas, uma em aberto.
  const sale = chart('1.2.04');
  for (const [i, m] of members.slice(0, 3).entries()) {
    const due = day(YEAR, 4, 15);
    const paid = i < 2;
    const a = await prismaAdmin.account.create({ data: { lodgeId, type: 'RECEIVABLE', title: `${sale.name} — Ritual de Aprendiz`, amount: 85, dueDate: due, memberId: m.id, chartAccountId: sale.id, status: paid ? 'paid' : 'pending' }, select: { id: true } });
    if (paid) await prismaAdmin.payment.create({ data: { lodgeId, accountId: a.id, memberId: m.id, amount: 85, paidAt: payDay(due), method: 'pix', bankAccountId: bank.id } });
  }
  // Despesas mensais (a de energia de setembro fica em aberto).
  const expenses: [string, string, (m: number) => number, number][] = [
    ['2.1.05', 'Imobiliária Exemplo Ltda', () => 900, 5],
    ['2.1.01', 'Companhia de Energia (exemplo)', (m) => 150 + ((m * 37) % 70), 20],
    ['2.1.13', 'Companhia de Águas (exemplo)', (m) => 60 + ((m * 13) % 30), 18],
    ['2.1.09', 'Provedor de Internet (exemplo)', () => 99.9, 15],
  ];
  for (let month = 1; month <= LAST_MONTH; month++) {
    for (const [code, who, amountOf, dueDay] of expenses) {
      const c = chart(code);
      const due = day(YEAR, month, dueDay);
      const open = code === '2.1.01' && month === LAST_MONTH;
      const amount = Math.round(amountOf(month) * 100) / 100;
      const a = await prismaAdmin.account.create({ data: { lodgeId, type: 'PAYABLE', title: c.name, amount, dueDate: due, chartAccountId: c.id, counterpartyName: who, status: open ? 'pending' : 'paid' }, select: { id: true } });
      if (!open) await prismaAdmin.payment.create({ data: { lodgeId, accountId: a.id, amount, paidAt: new Date(due.getTime() - 86_400_000), method: 'pix', bankAccountId: bank.id } });
    }
    if (month % 3 === 0) {
      const c = chart('2.1.15');
      const due = day(YEAR, month, 25);
      const a = await prismaAdmin.account.create({ data: { lodgeId, type: 'PAYABLE', title: c.name, amount: 780, dueDate: due, chartAccountId: c.id, counterpartyName: 'Grande Loja (contribuição trimestral)', status: 'paid' }, select: { id: true } });
      await prismaAdmin.payment.create({ data: { lodgeId, accountId: a.id, amount: 780, paidAt: due, method: 'manual', bankAccountId: bank.id } });
    }
  }

  // ── 6) Sessões quinzenais (fev–set) com presença ─────────────────────────
  for (let month = 2; month <= LAST_MONTH; month++) {
    for (const d of [8, 22]) {
      const s = await prismaAdmin.session.create({
        data: { lodgeId, title: d === 8 ? 'Sessão Ordinária' : 'Sessão de Instrução', date: new Date(Date.UTC(YEAR, month - 1, d, 22, 30)), type: 'ordinary', grade: 'Aprendiz' },
        select: { id: true },
      });
      await prismaAdmin.attendance.createMany({
        data: members.map((m) => ({ lodgeId, sessionId: s.id, memberId: m.id, status: rnd() < (m.late === 'three' ? 0.35 : 0.85) ? 'present' : 'absent' })),
      });
    }
  }

  console.log(`Demonstração pronta: ${members.length} irmãos, ${seq} mensalidades, despesas jan–${LAST_MONTH}/${YEAR}, 16 sessões.`);
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prismaAdmin.$disconnect());
