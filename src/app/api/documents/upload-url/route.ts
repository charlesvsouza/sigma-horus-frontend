import { auth } from '@/lib/auth';
import { requireLodgeAccess } from '@/lib/rbac';
import { buildObjectKey, buildPublicUrl, DOCUMENT_MIME_TYPES, getPresignedUploadUrl, getR2StorageSettings, lodgeDocumentPrefix } from '@/lib/storage';
import { NextResponse } from 'next/server';

// Passo 1 do upload de documento (ver ./route.ts): gera uma URL assinada pra
// o navegador subir o arquivo DIRETO pro R2, sem passar pela function do
// Vercel — que rejeita corpo de requisição acima de 4,5MB
// (FUNCTION_PAYLOAD_TOO_LARGE), inviável pra atas/PDFs digitalizados.
export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'documents', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => ({}));
  const fileName = String(body?.fileName ?? '').trim();
  const mimeType = String(body?.mimeType ?? '').trim();
  if (!fileName) return NextResponse.json({ error: 'Nome do arquivo é obrigatório.' }, { status: 400 });
  if (fileName.length > 200) return NextResponse.json({ error: 'Nome do arquivo muito longo (máximo 200 caracteres).' }, { status: 400 });
  if (!DOCUMENT_MIME_TYPES.has(mimeType)) {
    return NextResponse.json({ error: 'Tipo de arquivo não aceito. Envie PDF, imagem (PNG, JPG, WebP), Word, Excel, CSV ou texto.' }, { status: 400 });
  }

  const settings = getR2StorageSettings();
  if (!settings.bucket) {
    return NextResponse.json({ error: 'Configuração de storage incompleta.' }, { status: 500 });
  }

  const storageKey = buildObjectKey(fileName, lodgeDocumentPrefix(String(lodgeId)));
  const uploadUrl = await getPresignedUploadUrl(storageKey, mimeType);
  if (!uploadUrl) {
    return NextResponse.json({ error: 'Falha ao gerar link de envio.' }, { status: 500 });
  }

  const publicUrl = buildPublicUrl(storageKey, settings.publicUrl ?? undefined);
  return NextResponse.json({ uploadUrl, storageKey, mimeType, publicUrl });
}
