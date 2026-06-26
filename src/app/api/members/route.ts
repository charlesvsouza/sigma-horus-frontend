import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) {
    return NextResponse.json({ items: [] });
  }

  const access = await requireLodgeAccess(String(lodgeId), role, 'members', 'read');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const items = await withTenant(String(lodgeId), (db) =>
    db.member.findMany({
      where: { lodgeId: String(lodgeId) },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        gradeName: true,
        rite: { select: { id: true, name: true } },
        power: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    }),
  );

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await requireLodgeAccess(String(lodgeId), role, 'members', 'write');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await request.json();
  const name = String(body?.name ?? '').trim();
  const email = String(body?.email ?? '').trim();
  const phone = String(body?.phone ?? '').trim();
  const status = String(body?.status ?? 'active');
  const riteId = body?.riteId ? String(body.riteId) : null;
  const powerId = body?.powerId ? String(body.powerId) : null;
  const gradeName = body?.gradeName ? String(body.gradeName) : null;
  const birthDate = body?.birthDate ? new Date(body.birthDate) : null;
  const cpf = body?.cpf ? String(body.cpf) : null;
  const rg = body?.rg ? String(body.rg) : null;
  const maritalStatus = body?.maritalStatus ? String(body.maritalStatus) : null;
  const spouseName = body?.spouseName ? String(body.spouseName) : null;
  const spouseBirthDate = body?.spouseBirthDate ? new Date(body.spouseBirthDate) : null;
  const childrenNames = body?.childrenNames ? String(body.childrenNames) : null;
  const fatherName = body?.fatherName ? String(body.fatherName) : null;
  const motherName = body?.motherName ? String(body.motherName) : null;
  const occupation = body?.occupation ? String(body.occupation) : null;
  const nationality = body?.nationality ? String(body.nationality) : null;
  const addressLine = body?.addressLine ? String(body.addressLine) : null;
  const addressNumber = body?.addressNumber ? String(body.addressNumber) : null;
  const complement = body?.complement ? String(body.complement) : null;
  const neighborhood = body?.neighborhood ? String(body.neighborhood) : null;
  const city = body?.city ? String(body.city) : null;
  const state = body?.state ? String(body.state) : null;
  const zipCode = body?.zipCode ? String(body.zipCode) : null;
  const country = body?.country ? String(body.country) : null;
  const initiationDate = body?.initiationDate ? new Date(body.initiationDate) : null;
  const elevationDate = body?.elevationDate ? new Date(body.elevationDate) : null;
  const exaltationDate = body?.exaltationDate ? new Date(body.exaltationDate) : null;
  const initiationLodge = body?.initiationLodge ? String(body.initiationLodge) : null;
  const elevationLodge = body?.elevationLodge ? String(body.elevationLodge) : null;
  const exaltationLodge = body?.exaltationLodge ? String(body.exaltationLodge) : null;
  const initiationDegree = body?.initiationDegree ? String(body.initiationDegree) : null;
  const currentDegree = body?.currentDegree ? String(body.currentDegree) : null;
  const originLodge = body?.originLodge ? String(body.originLodge) : null;
  const masonicNumber = body?.masonicNumber ? String(body.masonicNumber) : null;
  const documents = body?.documents ? String(body.documents) : null;
  const notes = body?.notes ? String(body.notes) : null;

  if (!name) {
    return NextResponse.json({ error: 'Nome do membro é obrigatório.' }, { status: 400 });
  }

  const item = await withTenant(String(lodgeId), async (db) => {
    const created = await db.member.create({
      data: {
        lodgeId: String(lodgeId),
        name,
        email: email || null,
        phone: phone || null,
        status,
        riteId,
        powerId,
        gradeName,
        birthDate,
        cpf,
        rg,
        maritalStatus,
        spouseName,
        spouseBirthDate,
        childrenNames,
        fatherName,
        motherName,
        occupation,
        nationality,
        addressLine,
        addressNumber,
        complement,
        neighborhood,
        city,
        state,
        zipCode,
        country,
        initiationDate,
        elevationDate,
        exaltationDate,
        initiationLodge,
        elevationLodge,
        exaltationLodge,
        initiationDegree,
        currentDegree,
        originLodge,
        masonicNumber,
        documents,
        notes,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        gradeName: true,
        rite: { select: { id: true, name: true } },
        power: { select: { id: true, name: true } },
      },
    });

    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'member', entityId: created.id, metadata: { name } });
    return created;
  });

  return NextResponse.json({ item });
}
