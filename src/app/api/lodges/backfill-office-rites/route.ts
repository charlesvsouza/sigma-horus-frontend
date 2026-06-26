import { prismaAdmin } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { OFFICES_BY_RITE } from '@/lib/masonic-reference';
import { NextResponse } from 'next/server';

export async function POST() {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (role !== 'admin' && role !== 'venerable') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const stats = { processed: 0, matched: 0, skipped: 0, errors: 0 };

  const lodges = await prismaAdmin.lodge.findMany({ select: { id: true, name: true } });

  for (const lodge of lodges) {
    const rites = await prismaAdmin.rite.findMany({ where: { lodgeId: lodge.id } });
    if (rites.length === 0) continue;

    const riteByName = Object.fromEntries(rites.map((r) => [r.name, r.id]));
    const offices = await prismaAdmin.office.findMany({
      where: { lodgeId: lodge.id, riteId: null },
    });

    for (const office of offices) {
      stats.processed++;

      // Try to match the office name against OFFICES_BY_RITE for each rite.
      let matched = false;
      for (const [riteName, officesData] of Object.entries(OFFICES_BY_RITE)) {
        const riteId = riteByName[riteName];
        if (!riteId) continue;

        const match = officesData.find(
          (o) => o.name.toLowerCase() === office.name.toLowerCase(),
        );
        if (match) {
          await prismaAdmin.office.update({
            where: { id: office.id },
            data: { riteId },
          });
          stats.matched++;
          matched = true;
          break;
        }
      }

      if (!matched) {
        // Fallback: associate with the first rite (typically REAA).
        const defaultRite = rites.find((r) =>
          r.name.includes('Escocês'),
        ) ?? rites[0];
        if (defaultRite) {
          await prismaAdmin.office.update({
            where: { id: office.id },
            data: { riteId: defaultRite.id },
          });
          stats.matched++;
        } else {
          stats.skipped++;
        }
      }
    }
  }

  return NextResponse.json({ ok: true, stats });
}
