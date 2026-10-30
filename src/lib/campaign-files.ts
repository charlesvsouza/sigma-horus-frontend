// Documentos que formalizam o pedido de uma campanha (laudo, orçamento, ofício…): PDF ou foto, opcionais.
import { receiptUploadError } from '@/lib/upload-guards';

export const MAX_CAMPAIGN_FILES = 5;

/** Mensagem de erro (ou null se ok): mesmo limite de tipo e tamanho dos comprovantes (4 MB). */
export function campaignFileError(file: { type: string; size: number }): string | null {
  return receiptUploadError(file)?.replace('O comprovante precisa ser', 'O documento precisa ser').replace('O comprovante passa', 'O documento passa') ?? null;
}
