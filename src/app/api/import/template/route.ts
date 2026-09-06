import { TARGET_FIELDS } from '@/lib/member-import';
import { NextResponse } from 'next/server';

// Modelo CSV com os cabeçalhos exatos reconhecidos pelo wizard — usar este
// arquivo garante 100% de compatibilidade, sem depender da detecção automática.
export async function GET() {
  const headers = ['Nome', 'Rito', 'Potência', ...TARGET_FIELDS.map((f) => f.label)];
  const example = ['João da Silva', 'REAA', 'GOB', ...TARGET_FIELDS.map(() => '')];

  const csv = [headers, example].map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const body = String.fromCharCode(0xfeff) + csv;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="modelo-importacao-membros.csv"',
    },
  });
}
