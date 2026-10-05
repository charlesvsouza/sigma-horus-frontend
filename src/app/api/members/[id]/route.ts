import { auth } from '@/lib/auth';
import { CANDIDATE_STATUS } from '@/lib/candidate';
import { logAudit } from '@/lib/audit';
import { MEMBER_LIST_INCLUDE, parseMemberFields, parseRelatives, parseSelfEditFields, validateMemberFields, validateRelatives } from '@/lib/member-fields';
import { parseDateInput } from '@/lib/date-only';
import { withTenant, prismaAdmin } from '@/lib/prisma';
import { adminEmails, memberEmailIsAdminMessage, normalizeEmail } from '@/lib/admin-policy';
import { isValidCPF, maskCPF, onlyDigits } from '@/lib/masks';
import { canGrantDuesBenefit } from '@/lib/dues-benefit';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Self-edit: o obreiro pode editar o PRÓPRIO cadastro, mesmo sem permissão
  // geral de members:write — mas só contato/endereço/família
  // (parseSelfEditFields), nunca os campos completos de parseMemberFields:
  // esse último sempre preenche TODAS as chaves (inclusive com default/null
  // quando ausentes do body), o que sob o ramo self-edit apagaria nome, CPF,
  // rito/potência, grau e status do próprio membro — ou pior, um body
  // malicioso poderia setar esses campos de propósito. O papel/cargo de
  // permissão e o cargo maçônico só são definidos pelo Administrador.
  // Quem TEM members:write (Venerável, Secretário…) edita o próprio cadastro
  // completo pela tela de Membros: antes o ramo self-edit valia para qualquer
  // um editando a si mesmo e descartava em silêncio nascimento, RG, profissão
  // etc. — o form respondia "Membro atualizado" e os campos voltavam vazios.
  const access = await requireLodgeAccess(String(lodgeId), role, 'members', 'write');
  const isSelf = !access.ok && session?.user?.memberId === id;
  if (!access.ok && !isSelf) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => undefined);
  if (body === undefined) return NextResponse.json({ error: 'Corpo da requisição inválido: envie um JSON válido.' }, { status: 400 });
  const relatives = parseRelatives(body);
  const relativesError = validateRelatives(relatives);
  if (relativesError) {
    return NextResponse.json({ error: relativesError }, { status: 400 });
  }

  // Um e-mail, um papel: o e-mail do Administrador não pode virar e-mail de cadastro de obreiro.
  // Só conta quando o e-mail MUDA (quem já tinha o mesmo e-mail antes da regra não fica travado).
  const incomingEmail = normalizeEmail(isSelf ? parseSelfEditFields(body).email : parseMemberFields(body).email);
  if (incomingEmail) {
    const current = await prismaAdmin.member.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { email: true } });
    if (current && normalizeEmail(current.email) !== incomingEmail && (await adminEmails(String(lodgeId))).includes(incomingEmail)) {
      return NextResponse.json({ error: memberEmailIsAdminMessage() }, { status: 409 });
    }
  }

  if (isSelf) {
    const fields = parseSelfEditFields(body);
    // CPF: o irmão só PREENCHE o que está vazio (nunca troca um CPF já cadastrado) — é o dado que a cobrança exige.
    const rawCpf = typeof (body as { cpf?: unknown })?.cpf === 'string' ? String((body as { cpf: string }).cpf) : '';
    const cpfDigits = onlyDigits(rawCpf);
    const outcome = await withTenant(String(lodgeId), async (db) => {
      const existing = await db.member.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { id: true, cpf: true, birthDate: true } });
      if (!existing) return { notFound: true } as const;
      let cpfData: { cpf?: string } = {};
      if (cpfDigits && !onlyDigits(existing.cpf ?? '')) {
        if (!isValidCPF(cpfDigits)) return { error: 'CPF inválido. Confira os 11 dígitos.' } as const;
        const others = await db.member.findMany({ where: { lodgeId: String(lodgeId), id: { not: id }, cpf: { not: null } }, select: { cpf: true } });
        if (others.some((o) => onlyDigits(o.cpf ?? '') === cpfDigits)) return { error: 'Este CPF já está cadastrado para outro irmão. Procure a Secretaria.' } as const;
        cpfData = { cpf: maskCPF(cpfDigits) };
      }
      // Nascimento: como o CPF, o irmão só PREENCHE o que está vazio (corrigir um já cadastrado é com a Secretaria).
      let birthData: { birthDate?: Date } = {};
      const rawBirth = typeof (body as { birthDate?: unknown })?.birthDate === 'string' ? String((body as { birthDate: string }).birthDate) : '';
      if (rawBirth && !existing.birthDate) {
        const parsed = parseDateInput(rawBirth, { minYear: 1900 });
        if (!parsed || parsed.getTime() > Date.now()) return { error: 'Data de nascimento inválida. Confira o dia, o mês e o ano.' } as const;
        birthData = { birthDate: parsed };
      }
      const updated = await db.member.update({
        where: { id },
        data: {
          ...fields,
          ...cpfData,
          ...birthData,
          relatives: { deleteMany: {}, create: relatives.map((r) => ({ lodgeId: String(lodgeId), ...r })) },
        },
        include: MEMBER_LIST_INCLUDE,
      });
      await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'member', entityId: id, metadata: { selfEdit: true, ...(cpfData.cpf ? { cpfFilled: true } : {}), ...(birthData.birthDate ? { birthDateFilled: true } : {}) } });
      return { item: updated } as const;
    });
    if ('notFound' in outcome) return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });
    if ('error' in outcome) return NextResponse.json({ error: outcome.error }, { status: 400 });
    return NextResponse.json({ item: outcome.item });
  }

  const fields = parseMemberFields(body);
  const previous = await prismaAdmin.member.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { status: true } });
  const validationError = validateMemberFields(fields, previous?.status);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const item = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.member.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { id: true, status: true, duesExempt: true, duesPotencyOnly: true, duesPotencyReason: true } });
    if (!existing) return null;
    // Candidato se edita na ficha dele (Secretaria → Candidatos) e só vira obreiro pela iniciação.
    if (existing.status === CANDIDATE_STATUS) return 'candidate' as const;
    // Bloqueado só sai do bloqueio pelo acordo quitado (Tesouraria → Acordos de regularização), nunca pela edição.
    if (existing.status === 'blocked') fields.status = 'blocked';
    // Restrição total em vigor (Quit Placet, suspensão...): a situação só muda ao encerrá-la no cadastro do irmão, com o motivo.
    if (fields.status !== existing.status && (await db.memberRestriction.count({ where: { lodgeId: String(lodgeId), memberId: id, status: 'active', scope: 'total' } })) > 0) fields.status = existing.status;
    // Benefício de mensalidade: só o Venerável e o Administrador concedem ou retiram; os demais preservam o que está gravado.
    if (!canGrantDuesBenefit(role)) Object.assign(fields, { duesExempt: existing.duesExempt, duesPotencyOnly: existing.duesPotencyOnly, duesPotencyReason: existing.duesPotencyReason });
    const benefitChanged = fields.duesExempt !== existing.duesExempt || fields.duesPotencyOnly !== existing.duesPotencyOnly || fields.duesPotencyReason !== existing.duesPotencyReason;

    // Replace-all dos familiares: apaga os atuais e recria a partir do form.
    const updated = await db.member.update({
      where: { id },
      data: {
        ...fields,
        relatives: {
          deleteMany: {},
          create: relatives.map((r) => ({ lodgeId: String(lodgeId), ...r })),
        },
      },
      include: MEMBER_LIST_INCLUDE,
    });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'member', entityId: id, metadata: { name: fields.name, ...(benefitChanged ? { duesBenefit: { exempt: fields.duesExempt, potencyOnly: fields.duesPotencyOnly, reason: fields.duesPotencyReason } } : {}) } });
    return updated;
  });

  if (!item) return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });
  if (item === 'candidate') return NextResponse.json({ error: 'Este cadastro é de um candidato: edite-o em Secretaria → Candidatos.' }, { status: 409 });
  return NextResponse.json({ item });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const result = await withTenant(String(lodgeId), async (db) => {
    const member = await db.member.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { id: true, name: true } });
    if (!member) return { status: 404 as const };

    // Guarda: não excluir membro com histórico financeiro ou documentos (evita
    // perder rastreabilidade e deixar objetos órfãos no R2). Nesse caso, inativar.
    const [invoices, payments, documents] = await Promise.all([
      db.invoice.count({ where: { memberId: id } }),
      db.payment.count({ where: { memberId: id } }),
      db.document.count({ where: { memberId: id } }),
    ]);
    if (invoices > 0 || payments > 0 || documents > 0) {
      return { status: 409 as const, blocked: { invoices, payments, documents } };
    }

    await db.member.delete({ where: { id } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'DELETE', entity: 'member', entityId: id, metadata: { name: member.name } });
    return { status: 200 as const };
  });

  if (result.status === 404) return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });
  if (result.status === 409) {
    return NextResponse.json(
      {
        error: 'Este membro possui histórico financeiro ou documentos e não pode ser excluído. Inative o cadastro em vez de excluir.',
        details: result.blocked,
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
