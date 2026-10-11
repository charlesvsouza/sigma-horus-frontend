import { auth } from '@/lib/auth';
import { proofPrefix } from '@/lib/payment-proof';
import { requireLodgeAccess } from '@/lib/rbac';
import { buildObjectKey, putObject } from '@/lib/storage';
import { receiptUploadError } from '@/lib/upload-guards';
import { NextResponse } from 'next/server';

// Sobe o comprovante de pagamento de uma despesa ANTES da baixa (multipart `file`: PDF ou foto até 4 MB).
// Devolve a referência (key, name, type) que a baixa leva em proofKey/proofName/proofType. Nada é gravado no banco
// aqui: o arquivo só passa a valer quando a baixa o registra (lib/payment-proof.ts).
export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId || !session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const memberId = session.user.memberId ? String(session.user.memberId) : null;
  const access = await requireLodgeAccess(lodgeId, session.user.role, 'accounts', 'write', memberId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Anexe o comprovante (PDF ou foto).' }, { status: 400 });
  const invalid = receiptUploadError(file);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const key = buildObjectKey(file.name, proofPrefix(lodgeId).replace(/\/$/, ''));
  const ok = await putObject(key, Buffer.from(await file.arrayBuffer()), file.type).catch(() => false);
  if (!ok) return NextResponse.json({ error: 'Não foi possível enviar o comprovante. Tente de novo.' }, { status: 502 });
  return NextResponse.json({ proof: { key, name: file.name.slice(0, 120), type: file.type } });
}
