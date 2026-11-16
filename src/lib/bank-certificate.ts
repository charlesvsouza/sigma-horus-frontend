import { X509Certificate, createPrivateKey } from 'node:crypto';

// Certificado dinâmico do banco (Itaú): vale 365 dias; só se renova nos últimos 30 dias (antes disso o banco recusa);
// vencido = refazer o credenciamento do zero (e a API fica fora do ar). Por isso o sistema vigia a data e avisa o Tesoureiro.

export const RENEW_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface CertificateInfo {
  notBefore: Date;
  notAfter: Date;
  /** CN do certificado (para o Itaú, o client_id). */
  commonName: string | null;
}

/** Lê validade e CN de um certificado PEM. Lança erro se não for um certificado válido. */
export function inspectCertificate(certificatePem: string): CertificateInfo {
  const cert = new X509Certificate(certificatePem);
  const cn = cert.subject.split('\n').find((l) => l.startsWith('CN='));
  return { notBefore: new Date(cert.validFrom), notAfter: new Date(cert.validTo), commonName: cn ? cn.slice(3) : null };
}

/** A chave privada é a do certificado? (evita guardar um par trocado e só descobrir na hora de cobrar) */
export function certificateMatchesKey(certificatePem: string, privateKeyPem: string): boolean {
  try {
    return new X509Certificate(certificatePem).checkPrivateKey(createPrivateKey(privateKeyPem));
  } catch {
    return false;
  }
}

export type CertificateStatus = 'ok' | 'renew' | 'expired';

export interface CertificateHealth {
  status: CertificateStatus;
  /** Dias inteiros que faltam (negativo = já venceu). */
  daysLeft: number;
  /** Primeiro dia em que o banco aceita a renovação. */
  renewFrom: Date;
}

export function certificateHealth(notAfter: Date, now: Date = new Date()): CertificateHealth {
  const daysLeft = Math.floor((notAfter.getTime() - now.getTime()) / DAY_MS);
  const renewFrom = new Date(notAfter.getTime() - RENEW_WINDOW_DAYS * DAY_MS);
  const status: CertificateStatus = notAfter.getTime() <= now.getTime() ? 'expired' : daysLeft <= RENEW_WINDOW_DAYS ? 'renew' : 'ok';
  return { status, daysLeft, renewFrom };
}

/** Avisar o Tesoureiro? Dentro dos 30 dias finais (ou vencido), no máximo 1 aviso a cada 7 dias. */
export function shouldAlertCertificate(notAfter: Date, lastAlertedAt: Date | null, now: Date = new Date()): boolean {
  if (certificateHealth(notAfter, now).status === 'ok') return false;
  return !lastAlertedAt || now.getTime() - lastAlertedAt.getTime() >= 7 * DAY_MS;
}
