import { extractText, getDocumentProxy } from 'unpdf';

/**
 * Texto de um comprovante em PDF (comprovantes de app de banco são PDFs com texto). PDF
 * escaneado/imagem devolve texto vazio — a conferência marca como ilegível. Nunca lança:
 * falha de leitura não pode impedir o "Já paguei".
 */
export async function pdfText(buffer: Buffer, maxPages = 3): Promise<string> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    if (pdf.numPages > maxPages) return '';
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join('\n') : text;
  } catch {
    return '';
  }
}
