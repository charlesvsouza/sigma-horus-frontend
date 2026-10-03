import { wantsFullHistory } from '@/lib/list-window';
import ContasView from '../ContasView';

// "Lançamento" no menu: a tela de contas a receber e a pagar com o formulário já aberto.
export default async function LancamentoPage({ searchParams }: { searchParams: Promise<{ historico?: string }> }) {
  const sp = await searchParams;
  return <ContasView startWithForm fullHistory={wantsFullHistory(sp.historico)} basePath="/dashboard/contas/lancamento" />;
}
