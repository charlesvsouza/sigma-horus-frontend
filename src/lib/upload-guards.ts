// Conferências comuns de upload: tamanho e tipo de imagem. O tipo vem do navegador (não é
// prova do conteúdo), então aqui é lista permitida em vez de "começa com image/" — que
// aceitava, por exemplo, image/svg+xml (script embutido) numa foto de perfil.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/** Mensagem de erro (ou null se ok) para uma foto de perfil. `allowSvg` só para o brasão da loja. */
export function imageUploadError(file: { type: string; size: number }, opts: { allowSvg?: boolean; label?: string } = {}): string | null {
  const label = opts.label ?? 'A imagem';
  const okType = PHOTO_TYPES.has(file.type) || (opts.allowSvg === true && file.type === 'image/svg+xml');
  if (!okType) return `${label} precisa ser PNG, JPG${opts.allowSvg ? ', SVG' : ' ou WebP'}.`;
  if (file.size > MAX_IMAGE_BYTES) return `${label} passa de 5 MB. Reduza o arquivo e tente de novo.`;
  return null;
}
