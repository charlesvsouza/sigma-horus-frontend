// De onde veio a loja (canal de aquisição). Links de divulgação levam utm_source (e
// opcionalmente utm_medium/utm_campaign): ?utm_source=whatsapp&utm_campaign=fundadoras. O site
// guarda o PRIMEIRO canal num cookie por 90 dias; no cadastro ele vai para o Stripe (metadata)
// e fica em Lodge.acquisitionSource ("whatsapp/grupo/fundadoras"). Lógica pura, testável.

export const SOURCE_COOKIE = 'sh_src';
export const SOURCE_COOKIE_DAYS = 90;

const clean = (v: string | null | undefined) =>
  (v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

/** "fonte/meio/campanha" a partir dos parâmetros da URL; null sem utm_source (nem ref). */
export function sourceFromParams(params: URLSearchParams): string | null {
  const source = clean(params.get('utm_source') ?? params.get('ref'));
  if (!source) return null;
  return [source, clean(params.get('utm_medium')), clean(params.get('utm_campaign'))]
    .join('/')
    .replace(/\/+$/, '');
}

/** Valor do cookie de origem no cabeçalho Cookie (já validado); null se ausente/inválido. */
export function sourceFromCookieHeader(header: string | null | undefined): string | null {
  if (!header) return null;
  const hit = header.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${SOURCE_COOKIE}=`));
  if (!hit) return null;
  let value = hit.slice(SOURCE_COOKIE.length + 1);
  try { value = decodeURIComponent(value); } catch { return null; }
  return /^[a-z0-9_-]{1,40}(\/[a-z0-9_-]{0,40}){0,2}$/.test(value) ? value : null;
}
