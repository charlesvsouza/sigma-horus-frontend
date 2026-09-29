// Irmãos visitantes (Secretaria): validação do cadastro, rótulos e anonimização (LGPD).
// Dados de não membro — só o necessário para o certificado de presença, com consentimento.

export const VISITOR_DEGREES = ['Aprendiz', 'Companheiro', 'Mestre', 'Mestre Instalado'] as const;

export interface VisitorFields {
  name: string;
  degree: string | null;
  lodgeName: string | null;
  lodgeNumber: string | null;
  orient: string | null;
  powerName: string | null;
  cim: string | null;
  phone: string | null;
  email: string | null;
}

const text = (v: unknown, max: number): string | null => {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
  return s ? s : null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Normaliza e valida o que veio do formulário. Erro em texto para a tela. */
export function parseVisitorFields(body: Record<string, unknown>): { ok: true; fields: VisitorFields } | { ok: false; error: string } {
  const name = text(body.name, 120);
  if (!name) return { ok: false, error: 'Informe o nome do irmão visitante.' };
  const email = text(body.email, 160)?.toLowerCase() ?? null;
  if (email && !EMAIL_RE.test(email)) return { ok: false, error: 'E-mail inválido. Confira a grafia (o certificado é enviado para ele).' };
  const degree = text(body.degree, 40);
  return {
    ok: true,
    fields: {
      name,
      degree,
      lodgeName: text(body.lodgeName, 120),
      lodgeNumber: text(body.lodgeNumber, 20),
      orient: text(body.orient, 80),
      powerName: text(body.powerName, 80),
      cim: text(body.cim, 30),
      phone: text(body.phone, 30),
      email,
    },
  };
}

/** "Estrela do Sul nº 123 · Oriente de Niterói · GOB" — o que houver. */
export function visitorLodgeLabel(v: Pick<VisitorFields, 'lodgeName' | 'lodgeNumber' | 'orient' | 'powerName'>): string {
  const lodge = v.lodgeName ? `${v.lodgeName}${v.lodgeNumber ? ` nº ${v.lodgeNumber}` : ''}` : v.lodgeNumber ? `Loja nº ${v.lodgeNumber}` : null;
  return [lodge, v.orient ? `Oriente de ${v.orient}` : null, v.powerName].filter(Boolean).join(' · ');
}

/** Exclusão a pedido (LGPD): apaga os dados pessoais e mantém a visita para a contagem. */
export function anonymizedVisitor(now: Date = new Date()): VisitorFields & { consentAt: null; anonymizedAt: Date } {
  return {
    name: 'Visitante removido', degree: null, lodgeName: null, lodgeNumber: null, orient: null,
    powerName: null, cim: null, phone: null, email: null, consentAt: null, anonymizedAt: now,
  };
}
