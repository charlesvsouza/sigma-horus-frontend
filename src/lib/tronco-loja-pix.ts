// Tronco no Modo Loja (e doações pequenas no Asaas): Pix da CHAVE DA LOJA (BR Code estático), sem provedor no meio. Decisão do dono
// (2026-10-04): o QR das listas de presença também existe no Modo Loja — é o QR da loja com um IDENTIFICADOR da sessão, para o
// Tesoureiro monitorar a conta e ver quanto foi aportado, e depois lançar no Tronco manualmente.
//
// Limites honestos do Pix estático: não expira (o identificador vale para sempre) e o banco da loja decide se mostra o
// identificador (txid) no extrato. Por isso o sistema também procura o identificador na descrição dos créditos importados
// (OFX) e o Tesoureiro sempre confere o total antes de lançar.

import { createHash } from 'node:crypto';

const BASE32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** `n` caracteres estáveis (sem I, O, 0, 1) derivados de um texto. */
function stable(text: string, n: number): string {
  const h = createHash('sha256').update(text).digest();
  return Array.from({ length: n }, (_, i) => BASE32[h[i] % BASE32.length]).join('');
}

/**
 * Identificador (txid do Pix, só letras e números) do QR de uma sessão e origem: TR + M|V + 8 caracteres da sessão.
 * Ex.: TRMK7Q2X9ZB. É o mesmo toda vez que a folha é aberta, e é o que o Tesoureiro procura no extrato.
 */
export function sessionTxid(sessionId: string, source: 'members' | 'visitors'): string {
  return `TR${source === 'members' ? 'M' : 'V'}${stable(`tronco-sessao:${sessionId}`, 8)}`;
}

/** txid da doação avulsa de um irmão pelo portal: TRP + os 8 caracteres do DNA (TR-XXXX-XXXX). */
export function donationTxid(dna: string): string | null {
  const m = /^TR-([A-Z0-9]{4})-([A-Z0-9]{4})$/.exec(dna);
  return m ? `TRP${m[1]}${m[2]}` : null;
}

const squash = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** O identificador aparece na descrição do crédito do extrato (ignorando espaços, hífens e caixa)? */
export function identifierInText(description: string, identifier: string): boolean {
  const id = squash(identifier);
  return id.length >= 6 && squash(description).includes(id);
}
