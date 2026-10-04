import { redirect } from 'next/navigation';

// "Contas a pagar" agora é a própria lista de Contas com o filtro aplicado (e o botão
// Relatório / Imprimir): uma tela só. Os endereços antigos continuam funcionando — os parâmetros viram filtros.
export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; personId?: string; text?: string; sort?: string }> }) {
  const sp = await searchParams;
  const p = new URLSearchParams({ tipo: 'PAYABLE', sit: 'open' });
  if (sp.from) p.set('de', sp.from);
  if (sp.to) p.set('ate', sp.to);
  if (sp.personId) p.set('pessoa', sp.personId);
  if (sp.text) p.set('q', sp.text);
  if (sp.sort === 'nome') p.set('ord', 'person');
  redirect(`/dashboard/contas?${p.toString()}`);
}
