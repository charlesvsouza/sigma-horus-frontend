import { wantsFullHistory } from '@/lib/list-window';
import ContasView from './ContasView';

export default async function ContasPage({ searchParams }: { searchParams: Promise<{ historico?: string }> }) {
  const sp = await searchParams;
  return <ContasView fullHistory={wantsFullHistory(sp.historico)} />;
}
