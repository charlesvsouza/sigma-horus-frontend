import { decryptSecret, encryptSecret } from '@/lib/crypto';

// Credenciais da loja para a API de um banco (Itaú): client_id, client_secret, certificado e chave privada.
// Equivalem a senha da conta: ficam SEMPRE cifradas no banco de dados (AES-256-GCM, lib/crypto) e só são abertas
// no servidor, na hora de chamar o banco. Nunca devolver nenhum desses valores para o navegador.

export interface BankCredentials {
  clientId: string;
  clientSecret: string;
  /** Certificado (.crt) em PEM. */
  certificatePem: string;
  /** Chave privada do certificado (.key) em PEM. */
  privateKeyPem: string;
}

export interface SealedBankCredentials {
  clientIdEnc: string;
  clientSecretEnc: string;
  certificateEnc: string;
  privateKeyEnc: string;
}

export function sealBankCredentials(c: BankCredentials): SealedBankCredentials {
  return {
    clientIdEnc: encryptSecret(c.clientId.trim()),
    clientSecretEnc: encryptSecret(c.clientSecret.trim()),
    certificateEnc: encryptSecret(c.certificatePem.trim()),
    privateKeyEnc: encryptSecret(c.privateKeyPem.trim()),
  };
}

/** Abre as credenciais; null se faltar qualquer uma ou não decifrar (ex.: dado corrompido). */
export function openBankCredentials(row: Partial<Record<keyof SealedBankCredentials, string | null>> | null | undefined): BankCredentials | null {
  if (!row) return null;
  const clientId = decryptSecret(row.clientIdEnc);
  const clientSecret = decryptSecret(row.clientSecretEnc);
  const certificatePem = decryptSecret(row.certificateEnc);
  const privateKeyPem = decryptSecret(row.privateKeyEnc);
  if (!clientId || !clientSecret || !certificatePem || !privateKeyPem) return null;
  return { clientId, clientSecret, certificatePem, privateKeyPem };
}

/** Só o essencial para a tela mostrar "configurado" sem expor nada (últimos 4 do client_id). */
export function bankCredentialsHint(row: { clientIdEnc?: string | null } | null | undefined): string | null {
  const id = decryptSecret(row?.clientIdEnc);
  return id ? `••••${id.slice(-4)}` : null;
}
