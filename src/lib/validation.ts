// Validadores puros para validação inline de formulários (heurística de
// prevenção de erro). Cada função retorna a mensagem de erro ou undefined.
// Puros e testáveis (ver validation.test.ts).

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
export const isSlug = (v: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.trim());

export function required(v: string, label = 'Campo'): string | undefined {
  return v.trim() ? undefined : `${label} é obrigatório.`;
}

export function email(v: string): string | undefined {
  if (!v.trim()) return 'Informe o e-mail.';
  return isEmail(v) ? undefined : 'E-mail inválido.';
}

export function slug(v: string): string | undefined {
  if (!v.trim()) return 'Informe o endereço (slug).';
  if (v.trim().length < 3) return 'O slug precisa de ao menos 3 caracteres.';
  return isSlug(v) ? undefined : 'Use apenas letras minúsculas, números e hífen (ex.: loja-estrela).';
}

export function minLen(v: string, n: number, label = 'Campo'): string | undefined {
  return v.length >= n ? undefined : `${label} precisa de ao menos ${n} caracteres.`;
}

/** Remove chaves com valor undefined, deixando só os erros reais. */
export function compact(errors: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(errors)) if (v) out[k] = v;
  return out;
}

/** Erros do cadastro de loja (self-service e convite compartilham os campos). */
export function validateLodgeSignup(f: {
  name: string; slug: string; adminName: string; adminEmail: string; adminPassword: string;
}): Record<string, string> {
  return compact({
    name: required(f.name, 'O nome da loja'),
    slug: slug(f.slug),
    adminName: required(f.adminName, 'O nome do administrador'),
    adminEmail: email(f.adminEmail),
    adminPassword: minLen(f.adminPassword, 8, 'A senha'),
  });
}
