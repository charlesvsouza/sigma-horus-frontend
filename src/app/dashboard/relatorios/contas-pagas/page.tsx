import AccountsReportPage from '../AccountsReportPage';

export default function Page({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; personId?: string; text?: string }> }) {
  return <AccountsReportPage variant="contas-pagas" searchParams={searchParams} />;
}
