// Valores dos relatórios legados: "1.234,56", "(1.234,56)" (negativo), datas
// "dd/mm/aaaa". Funções puras, sem dependência do resto do app.

/** Dinheiro no formato BR já formatado (com vírgula decimal), inclusive entre parênteses. */
export const BR_MONEY = /^\(?-?\d{1,3}(?:\.\d{3})*,\d{2}\)?$|^\(?-?\d+,\d{2}\)?$/;

export function isBrMoney(raw: string | undefined | null): boolean {
  return !!raw && BR_MONEY.test(raw.trim());
}

/** "1.234,56" → 1234.56 · "(9,90)" → -9.9 · "1234.5" → 1234.5 (XLSX numérico) · vazio/ilegível → null. */
export function parseMoney(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || /^-/.test(s);
  const body = s.replace(/[^\d,.]/g, '');
  if (!body) return null;
  const normalized = body.includes(',') ? body.replace(/\./g, '').replace(',', '.') : body;
  const n = Number(normalized);
  if (Number.isNaN(n)) return null;
  return Math.round((negative ? -Math.abs(n) : n) * 100) / 100;
}

/** "14/09/2026" → "2026-09-14" (ISO, sem fuso). Rejeita datas impossíveis. */
export function parseDateIso(raw: string | undefined | null): string | null {
  const m = raw?.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/) ?? raw?.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const br = raw!.includes('/');
  const [y, mo, d] = br ? [Number(m[3]), Number(m[2]), Number(m[1])] : [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function isBrDate(raw: string | undefined | null): boolean {
  return !!raw && /^\d{2}\/\d{2}\/\d{4}$/.test(raw.trim());
}

/** Maiúsculas, sem acento e sem pontuação — chave de comparação de nomes. */
export function normalizeName(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function daysBetweenIso(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

export function addDaysIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
