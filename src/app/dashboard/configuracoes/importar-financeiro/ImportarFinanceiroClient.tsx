'use client';

import { UploadCloud } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Alert, Badge, Button, Card, CardDescription, CardTitle, EmptyState, Field, inputClass, useConfirm } from '@/components/ui';

interface FileReport { name: string; kind: string; kindLabel: string; status: 'used' | 'ignored' | 'error'; detail: string; }
interface Check { label: string; ok: boolean; detail: string; }
interface Category { key: string; count: number; total: number; suggestedCode: string | null; how: string; chosenCode: string | null; }
interface ChartOption { code: string; name: string; type: string; }
interface Summary {
  transactions: number; receipts: number; payments: number; transfers: number; openItems: number; openItemsTotal: number;
  counterparties: number; withoutCategory: number; withoutCategoryTotal: number; memberLinks: number;
}
interface FinAccount { name: string; kind: string; isInvestment: boolean; openingBalance: number; existingId: string | null; }
interface Analysis {
  reports: FileReport[];
  summary: Summary;
  checks: Check[];
  warnings: string[];
  warningsTotal: number;
  categories: Category[];
  chartOptions: ChartOption[];
  financialAccounts: FinAccount[];
  counterparties: { name: string; kind: string; document: string | null }[];
  uncategorizedSample: { date: string; type: string; amount: number; name: string; title: string }[];
  balancete: { periodFrom: string; periodTo: string; totalReceivables: number; totalPayables: number; netBalance: number; lines: number } | null;
  existingBatches: string[];
}
interface CommitResult {
  batchId: string; financialAccountsCreated: number; openingBalancesSet: number; counterparties: number; transactions: number;
  openItems: number; transfers: number; balancete: boolean; notes: string[];
}

const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dateBr = (iso: string) => iso.split('-').reverse().join('/');

export default function ImportarFinanceiroClient({ denied }: { denied: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [busy, setBusy] = useState(false); // gravando ou desfazendo
  const [analyzing, setAnalyzing] = useState(false); // lendo e conferindo os arquivos
  const [error, setError] = useState<string | null>(null);
  const [undoneMsg, setUndoneMsg] = useState<string | null>(null);
  const askConfirm = useConfirm();
  const inflight = useRef<AbortController | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { inflight.current?.abort(); if (debounce.current) clearTimeout(debounce.current); }, []);
  const [memberMatching, setMemberMatching] = useState<'none' | 'exact' | 'fuzzy'>('exact');
  const [openingAsBalance, setOpeningAsBalance] = useState(true);
  const [includeOpen, setIncludeOpen] = useState(true);
  const [overrides, setOverrides] = useState<Record<string, string | null>>({});
  const [acceptFailed, setAcceptFailed] = useState(false);
  const [allowRepeat, setAllowRepeat] = useState(false);

  if (denied) {
    return (
      <Card>
        <CardTitle>Importar backup financeiro</CardTitle>
        <CardDescription>Só quem lança movimento financeiro (Administrador e Tesoureiro) pode importar o backup financeiro da loja.</CardDescription>
      </Card>
    );
  }

  const optionsJson = (next?: Record<string, string | null>) =>
    JSON.stringify({ memberMatching, categoryOverrides: next ?? overrides, openingEntriesAsOpeningBalance: openingAsBalance, includeOpenItems: includeOpen });

  function buildForm(list: File[], next?: Record<string, string | null>) {
    const fd = new FormData();
    for (const f of list) fd.append('files', f);
    fd.append('options', optionsJson(next));
    return fd;
  }

  // Cada análise reenvia e relê os arquivos: a mais recente cancela a anterior, para que uma resposta
  // atrasada nunca sobrescreva a tela com dados de uma escolha antiga.
  async function analyze(list: File[], next?: Record<string, string | null>) {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch('/api/import/financial/analyze', { method: 'POST', body: buildForm(list, next), signal: controller.signal });
      const data = await res.json();
      if (controller.signal.aborted) return;
      if (!res.ok) {
        setError(data?.error ?? 'Não foi possível analisar os arquivos.');
        if (data?.reports) setAnalysis(null);
        return;
      }
      setAnalysis(data as Analysis);
    } catch {
      if (!controller.signal.aborted) setError('Não foi possível analisar os arquivos. Verifique a conexão e tente de novo.');
    } finally {
      if (inflight.current === controller) setAnalyzing(false);
    }
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    if (list.length === 0) return;
    setFiles(list);
    setResult(null);
    setUndoneMsg(null);
    setOverrides({});
    setAcceptFailed(false);
    void analyze(list, {});
  }

  function changeCategory(key: string, code: string) {
    const next = { ...overrides, [key]: code === '' ? null : code };
    setOverrides(next);
    // Várias trocas seguidas viram uma só análise.
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void analyze(files, next), 450);
  }

  async function commit() {
    setBusy(true);
    setError(null);
    try {
      const fd = buildForm(files);
      if (acceptFailed) fd.append('acceptFailedChecks', 'true');
      if (allowRepeat) fd.append('allowRepeat', 'true');
      const res = await fetch('/api/import/financial/commit', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data?.error ?? 'Falha ao importar.'); return; }
      setResult(data as CommitResult);
      setAnalysis(null);
    } catch {
      setError('Falha ao importar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  async function undo(batchId: string) {
    const ok = await askConfirm({
      title: `Desfazer o lote ${batchId}?`,
      message: 'Remove tudo o que este lote importou: lançamentos, pagamentos, transferências, clientes e fornecedores e o balancete. O que foi digitado à mão não é tocado.',
      confirmLabel: 'Desfazer lote',
      intent: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/import/financial/undo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batchId }) });
      const data = await res.json();
      if (!res.ok) { setError(data?.error ?? 'Falha ao desfazer.'); return; }
      setResult(null);
      setAnalysis(null);
      setFiles([]);
      setError(null);
      setUndoneMsg(`Lote ${batchId} desfeito: ${data.removed.accounts} conta(s), ${data.removed.transfers} transferência(s), ${data.removed.counterparties} cadastro(s) e ${data.removed.balancetes} balancete(s) removidos.`);
    } finally {
      setBusy(false);
    }
  }

  const failed = analysis?.checks.filter((c) => !c.ok) ?? [];
  const usable = analysis?.reports.some((r) => r.status === 'used');
  const canCommit = !!analysis && usable && !busy && !analyzing && (failed.length === 0 || acceptFailed) && (analysis.existingBatches.length === 0 || allowRepeat);

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Importar backup financeiro</CardTitle>
        <CardDescription>
          Traga o histórico de outro sistema (extrato, livro razão, balancete, clientes, fornecedores e contas a pagar/receber, em CSV ou
          Excel .xlsx). Nada é gravado antes da conferência: o sistema soma tudo e compara com os totais que o próprio relatório declara.
          Cada importação vira um lote que pode ser desfeito.
        </CardDescription>
      </Card>

      <p className="sr-only" role="status" aria-live="polite">{analyzing ? 'Lendo e conferindo os arquivos…' : ''}</p>
      {error ? <Alert intent="danger">{error}</Alert> : null}
      {undoneMsg ? <Alert intent="ok">{undoneMsg}</Alert> : null}

      {result ? (
        <Card className="space-y-3">
          <CardTitle>Importação concluída (lote {result.batchId})</CardTitle>
          <ul className="grid gap-1 text-sm text-sand-light sm:grid-cols-2">
            <li>{result.transactions} lançamento(s) realizado(s) com pagamento</li>
            <li>{result.openItems} conta(s) em aberto</li>
            <li>{result.transfers} transferência(s) entre contas</li>
            <li>{result.counterparties} cliente(s)/fornecedor(es)</li>
            <li>{result.financialAccountsCreated} conta(s) financeira(s) criada(s) · {result.openingBalancesSet} saldo(s) inicial(is)</li>
            <li>{result.balancete ? 'Balancete arquivado em Relatórios → Balancetes periódicos' : 'Sem balancete novo'}</li>
          </ul>
          {result.notes.length > 0 ? (
            <Alert intent="warn">
              <ul className="list-disc pl-5 text-sm">{result.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </Alert>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" type="button" onClick={() => { setResult(null); setFiles([]); if (inputRef.current) inputRef.current.value = ''; }}>Importar outros arquivos</Button>
            <Button variant="danger" type="button" disabled={busy} onClick={() => void undo(result.batchId)}>Desfazer este lote</Button>
          </div>
        </Card>
      ) : null}

      {!result ? (
        <Card>
          <EmptyState
            icon={<UploadCloud className="h-7 w-7" strokeWidth={1.5} />}
            title={files.length ? `${files.length} arquivo(s) selecionado(s)` : 'Nenhum arquivo selecionado'}
            description={analyzing && !analysis ? 'Lendo e conferindo os arquivos…' : 'Selecione de uma vez todos os relatórios do backup, em CSV ou Excel (.xlsx). Se o mesmo relatório vier nos dois formatos, o CSV é o usado. Arquivos .xls antigos precisam ser salvos como .xlsx ou CSV.'}
            action={<Button type="button" onClick={() => inputRef.current?.click()} disabled={busy || analyzing}>{files.length ? 'Trocar arquivos' : 'Selecionar arquivos'}</Button>}
          />
          <input ref={inputRef} type="file" multiple accept=".csv,.xlsx,.xls" className="hidden" onChange={onPick} />
        </Card>
      ) : null}

      {analysis && !result ? (
        <>
          <Card className="space-y-3">
            <CardTitle>Arquivos lidos</CardTitle>
            <ul className="space-y-1 text-sm">
              {analysis.reports.map((r, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <Badge variant={r.status === 'used' ? 'success' : r.status === 'ignored' ? 'canceled' : 'error'}>{r.kindLabel}</Badge>
                  <span className="text-sand-light">{r.name}</span>
                  <span className="text-xs text-sand-dark">— {r.detail}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="space-y-3">
            <CardTitle>Conferência de totais</CardTitle>
            <CardDescription>Cada linha compara o que foi lido dos arquivos com o que o próprio relatório declara.</CardDescription>
            <ul className="space-y-1.5 text-sm">
              {analysis.checks.map((c, i) => (
                <li key={i} className="flex flex-wrap items-start gap-2">
                  <Badge variant={c.ok ? 'success' : 'error'}>{c.ok ? 'Confere' : 'Diverge'}</Badge>
                  <span className="text-sand-light">{c.label}</span>
                  <span className="text-xs text-sand-dark">{c.detail}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="space-y-3">
            <CardTitle>O que será importado</CardTitle>
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <Stat label="Lançamentos realizados" value={`${analysis.summary.transactions}`} sub={`${analysis.summary.receipts} entradas · ${analysis.summary.payments} saídas`} />
              <Stat label="Contas em aberto" value={`${analysis.summary.openItems}`} sub={money(analysis.summary.openItemsTotal)} />
              <Stat label="Transferências entre contas" value={`${analysis.summary.transfers}`} />
              <Stat label="Clientes e fornecedores" value={`${analysis.summary.counterparties}`} />
              <Stat label="Sem categoria" value={`${analysis.summary.withoutCategory}`} sub={money(analysis.summary.withoutCategoryTotal)} />
              <Stat label="Ligados a membros" value={`${analysis.summary.memberLinks}`} />
            </div>
            {analysis.financialAccounts.length > 0 ? (
              <div className="text-sm text-sand-light">
                <p className="mb-1 text-xs uppercase text-sand-dark">Contas financeiras</p>
                <ul className="space-y-0.5">
                  {analysis.financialAccounts.map((a) => (
                    <li key={a.name}>
                      {a.name} {a.existingId ? '(já existe)' : '(será criada)'} · saldo inicial {money(a.openingBalance)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {analysis.balancete ? (
              <p className="text-sm text-sand-light">
                Balancete arquivado: {dateBr(analysis.balancete.periodFrom)} a {dateBr(analysis.balancete.periodTo)} · entradas {money(analysis.balancete.totalReceivables)} · saídas {money(analysis.balancete.totalPayables)} · saldo {money(analysis.balancete.netBalance)} ({analysis.balancete.lines} contas do plano).
              </p>
            ) : null}
          </Card>

          <Card className="space-y-3">
            <CardTitle>Opções</CardTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Field label="Vincular nomes aos membros da loja">
                  <select className={inputClass} value={memberMatching} disabled={busy} onChange={(e) => { const v = e.target.value as 'none' | 'exact' | 'fuzzy'; setMemberMatching(v); }}>
                    <option value="exact">Só nome idêntico (recomendado)</option>
                    <option value="fuzzy">Também nome abreviado ou cortado (conferir depois)</option>
                    <option value="none">Não vincular — tudo vira cliente ou fornecedor</option>
                  </select>
                </Field>
                <p className="mt-1.5 text-xs text-sand-dark">
                  Mensalidade em aberto vinculada a um membro conta no Art. 002 (mais de 60 dias) e pode mudar a situação dele.
                </p>
              </div>
              <div className="space-y-2 text-sm text-sand-light">
                <label className="flex items-center gap-2 py-1"><input type="checkbox" className="h-4 w-4 accent-gold" checked={openingAsBalance} onChange={(e) => setOpeningAsBalance(e.target.checked)} /> &quot;Abertura de saldo&quot; vira saldo inicial da conta (não receita)</label>
                <label className="flex items-center gap-2 py-1"><input type="checkbox" className="h-4 w-4 accent-gold" checked={includeOpen} onChange={(e) => setIncludeOpen(e.target.checked)} /> Importar contas a pagar/receber em aberto</label>
              </div>
            </div>
            <Button variant="secondary" type="button" disabled={busy || analyzing} onClick={() => void analyze(files)}>{analyzing ? 'Conferindo…' : 'Reaplicar opções'}</Button>
          </Card>

          {analysis.categories.length > 0 ? (
            <Card className="space-y-3">
              <CardTitle>Categorias</CardTitle>
              <CardDescription>Como cada categoria do sistema antigo vira uma categoria do plano de contas da loja. A sugestão pode ser trocada; &quot;sem categoria&quot; deixa o lançamento para classificar depois.</CardDescription>
              <div className="overflow-x-auto rounded-xl border border-white/6">
                <table className="w-full text-left text-sm max-md:block">
                  <thead className="border-b border-white/6 bg-sigma-card max-md:hidden">
                    <tr>
                      <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase text-sand-dark">Categoria no sistema antigo</th>
                      <th scope="col" className="px-3 py-3 text-right text-xs font-semibold uppercase text-sand-dark">Lançamentos</th>
                      <th scope="col" className="px-3 py-3 text-right text-xs font-semibold uppercase text-sand-dark">Total</th>
                      <th scope="col" className="px-3 py-3 text-xs font-semibold uppercase text-sand-dark">Categoria no Sigma Horus</th>
                    </tr>
                  </thead>
                  <tbody className="max-md:block">
                    {analysis.categories.map((c) => (
                      <tr key={c.key} className="border-b border-white/5 last:border-0 max-md:block max-md:space-y-1 max-md:p-3">
                        <td className="px-3 py-2 text-sand-light max-md:block max-md:p-0 max-md:font-medium">{c.key}</td>
                        <td className="px-3 py-2 text-right max-md:block max-md:p-0 max-md:text-left max-md:text-xs max-md:text-sand-dark"><span className="md:hidden">{c.count} lançamento(s) · {money(c.total)}</span><span className="max-md:hidden">{c.count}</span></td>
                        <td className="hidden px-3 py-2 text-right md:table-cell">{money(c.total)}</td>
                        <td className="px-3 py-2 max-md:block max-md:p-0">
                          <select className={inputClass} value={c.chosenCode ?? ''} disabled={busy} onChange={(e) => changeCategory(c.key, e.target.value)} aria-label={`Categoria para ${c.key}`}>
                            <option value="">Sem categoria</option>
                            {analysis.chartOptions.map((o) => <option key={o.code} value={o.code}>{o.code} — {o.name}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          {analysis.uncategorizedSample.length > 0 ? (
            <Card className="space-y-2">
              <CardTitle>Lançamentos que ficarão sem categoria ({analysis.summary.withoutCategory})</CardTitle>
              <CardDescription>Entram no sistema com valor, data e contraparte corretos; o tesoureiro escolhe a categoria depois em Contas → Editar.</CardDescription>
              <ul className="max-h-56 space-y-0.5 overflow-y-auto text-xs text-sand-dark">
                {analysis.uncategorizedSample.map((t, i) => (
                  <li key={i}>{dateBr(t.date)} · {t.type === 'RECEIVABLE' ? 'entrada' : 'saída'} · {money(t.amount)} · {t.name || t.title}</li>
                ))}
              </ul>
            </Card>
          ) : null}

          {analysis.warnings.length > 0 ? (
            <Alert intent="warn">
              <p className="mb-1 text-sm font-medium">Avisos ({analysis.warningsTotal})</p>
              <ul className="max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs">{analysis.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </Alert>
          ) : null}

          <Card className="space-y-3">
            {failed.length > 0 ? (
              <Alert intent="danger">
                {failed.length} conferência(s) não fecharam. Recomendo não importar até entender a diferença.
                <label className="mt-2 flex items-center gap-2 py-1 text-sm"><input type="checkbox" className="h-4 w-4 accent-gold" checked={acceptFailed} onChange={(e) => setAcceptFailed(e.target.checked)} /> Entendi e quero importar mesmo assim</label>
              </Alert>
            ) : (
              <Alert intent="ok">Todos os totais conferem com os relatórios de origem.</Alert>
            )}
            {analysis.existingBatches.length > 0 ? (
              <Alert intent="warn">
                Esta loja já tem uma importação anterior (lote {analysis.existingBatches.join(', ')}). Importar de novo duplicaria o histórico.
                <label className="mt-2 flex items-center gap-2 py-1 text-sm"><input type="checkbox" className="h-4 w-4 accent-gold" checked={allowRepeat} onChange={(e) => setAllowRepeat(e.target.checked)} /> Importar de novo mesmo assim</label>
              </Alert>
            ) : null}
            <Button type="button" disabled={!canCommit} onClick={() => void commit()}>{busy ? 'Importando…' : 'Confirmar e importar'}</Button>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/6 p-3">
      <p className="text-xs uppercase text-sand-dark">{label}</p>
      <p className="mt-1 text-lg text-sand-light">{value}</p>
      {sub ? <p className="text-xs text-sand-dark">{sub}</p> : null}
    </div>
  );
}
