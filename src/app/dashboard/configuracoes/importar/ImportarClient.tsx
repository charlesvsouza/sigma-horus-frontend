'use client';

import Link from 'next/link';
import { UploadCloud } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { Alert, Badge, Button, Card, CardDescription, CardTitle, EmptyState, inputClass } from '@/components/ui';

interface TargetFieldMeta { field: string; label: string; tier: 1 | 2 | 3; }
interface RowIssue { row: number; field?: string; severity: 'error' | 'warning'; message: string; }
interface NamedOption { id: string; name: string; }

interface Mapping {
  nameIndex: number | null;
  riteIndex: number | null;
  powerIndex: number | null;
  fields: Record<string, number>;
}

interface AnalyzeResult {
  aborted: boolean;
  headers: string[];
  mapping: Mapping;
  score: number;
  matchedCount: number;
  totalCount: number;
  totalRows: number;
  importableRows?: number;
  abortReason?: string;
  rowIssues?: RowIssue[];
  preview?: { row: number; name: string }[];
  riteOptions?: NamedOption[];
  powerOptions?: NamedOption[];
  unmatchedRites?: string[];
  unmatchedPowers?: string[];
  targetFields: TargetFieldMeta[];
}

interface CommitResult {
  ok: boolean;
  stats: { totalRows: number; imported: number; skippedRows: number; warnings: number };
  relativesCreated: number;
}

const TIER_LABEL: Record<number, string> = { 1: 'Essenciais', 2: 'Maçônicos', 3: 'Pessoais / endereço' };

function slotForIndex(mapping: Mapping, idx: number): string {
  if (mapping.nameIndex === idx) return '__name';
  if (mapping.riteIndex === idx) return '__rite';
  if (mapping.powerIndex === idx) return '__power';
  const found = Object.entries(mapping.fields).find(([, v]) => v === idx);
  return found ? found[0] : '__ignore';
}

function setSlot(mapping: Mapping, idx: number, slot: string): Mapping {
  const next: Mapping = {
    nameIndex: mapping.nameIndex === idx ? null : mapping.nameIndex,
    riteIndex: mapping.riteIndex === idx ? null : mapping.riteIndex,
    powerIndex: mapping.powerIndex === idx ? null : mapping.powerIndex,
    fields: Object.fromEntries(Object.entries(mapping.fields).filter(([, v]) => v !== idx)),
  };
  if (slot === '__name') next.nameIndex = idx;
  else if (slot === '__rite') next.riteIndex = idx;
  else if (slot === '__power') next.powerIndex = idx;
  else if (slot !== '__ignore') next.fields[slot] = idx;
  return next;
}

function scoreIntent(score: number): 'ok' | 'warn' | 'danger' {
  if (score >= 80) return 'ok';
  if (score >= 50) return 'warn';
  return 'danger';
}

export default function ImportarClient({ denied, locked }: { denied: boolean; locked: boolean }) {
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (denied) {
    return <Alert intent="danger">Sem permissão para acessar a importação de cadastros.</Alert>;
  }

  if (locked) {
    return (
      <Alert intent="info">
        A importação inicial não está mais disponível: esta loja já possui membros cadastrados. Isso evita duplicar ou
        sobrescrever dados. Para uma nova migração, entre em contato com o suporte da SigmaHorus.
      </Alert>
    );
  }

  async function runAnalysis(targetFile: File, mapping?: Mapping) {
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', targetFile);
      if (mapping) formData.append('mapping', JSON.stringify(mapping));
      const res = await fetch('/api/import/analyze', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Falha ao analisar o arquivo.');
        setBusy(false);
        return;
      }
      setAnalysis(data as AnalyzeResult);
      setStep('review');
    } catch {
      setError('Falha ao analisar o arquivo. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    if (!chosen) return;
    setFile(chosen);
    setCommitResult(null);
    void runAnalysis(chosen);
  }

  function updateMapping(idx: number, slot: string) {
    if (!analysis) return;
    const nextMapping = setSlot(analysis.mapping, idx, slot);
    setAnalysis({ ...analysis, mapping: nextMapping });
    if (file) void runAnalysis(file, nextMapping);
  }

  async function handleCommit() {
    if (!file || !analysis) return;
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mapping', JSON.stringify(analysis.mapping));
      const res = await fetch('/api/import/commit', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Falha ao confirmar a importação.');
        setBusy(false);
        return;
      }
      setCommitResult(data as CommitResult);
      setStep('done');
    } catch {
      setError('Falha ao confirmar a importação. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStep('upload');
    setFile(null);
    setAnalysis(null);
    setCommitResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Importar cadastro de membros</CardTitle>
        <CardDescription>
          Migre os membros de outro sistema (planilha CSV ou Excel) para o SigmaHorus. Disponível apenas uma vez, antes
          do primeiro membro ser cadastrado nesta loja.
        </CardDescription>
      </Card>

      {error ? <Alert intent="danger">{error}</Alert> : null}

      {step === 'upload' ? (
        <Card>
          <EmptyState
            icon={<UploadCloud className="h-7 w-7" strokeWidth={1.5} />}
            title="Nenhum arquivo selecionado"
            description={
              busy
                ? 'Analisando o arquivo…'
                : 'Aceita CSV ou Excel (.xlsx). Para garantir 100% de compatibilidade, baixe nosso modelo e preencha nele — ou envie o export do seu sistema atual e ajuste o mapeamento na próxima etapa.'
            }
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a href="/api/import/template">
                  <Button variant="secondary" type="button">Baixar modelo CSV</Button>
                </a>
                <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                  {busy ? 'Analisando…' : 'Selecionar arquivo'}
                </Button>
              </div>
            }
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={handleFileChange}
          />
        </Card>
      ) : null}

      {step === 'review' && analysis ? (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Compatibilidade: {analysis.score}%</CardTitle>
              <CardDescription>
                {analysis.matchedCount} de {analysis.totalCount} campos reconhecidos · {analysis.totalRows} linha(s) no
                arquivo
                {typeof analysis.importableRows === 'number' ? ` · ${analysis.importableRows} serão importadas` : ''}
              </CardDescription>
            </div>
            <Badge variant={analysis.score >= 80 ? 'success' : analysis.score >= 50 ? 'warning' : 'error'}>
              {analysis.score}% compatível
            </Badge>
          </Card>

          {analysis.aborted ? (
            <Alert intent="danger">
              {analysis.abortReason ?? 'Não foi possível identificar a coluna de nome. Ajuste o mapeamento abaixo.'}
            </Alert>
          ) : analysis.score < 100 ? (
            <Alert intent={scoreIntent(analysis.score)}>
              Nem todos os campos foram reconhecidos. A importação pode prosseguir, mas confira manualmente os dados
              que ficaram de fora depois de concluir.
            </Alert>
          ) : null}

          <Card className="space-y-3">
            <CardTitle>Mapeamento das colunas</CardTitle>
            <CardDescription>Para cada coluna do arquivo, escolha a que campo do SigmaHorus ela corresponde.</CardDescription>
            <div className="overflow-x-auto rounded-xl border border-white/[6%]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/[6%] bg-sigma-card">
                  <tr>
                    <th className="px-3 py-3 text-xs font-semibold uppercase text-sand-dark">Coluna do arquivo</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase text-sand-dark">Campo no SigmaHorus</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.headers.map((header, idx) => (
                    <tr key={idx} className="border-b border-white/[5%] transition-colors last:border-0 hover:bg-white/[3%]">
                      <td className="px-3 py-3 text-sand-light">{header || `Coluna ${idx + 1}`}</td>
                      <td className="px-3 py-3">
                        <select
                          className={inputClass}
                          value={slotForIndex(analysis.mapping, idx)}
                          onChange={(e) => updateMapping(idx, e.target.value)}
                          disabled={busy}
                        >
                          <option value="__ignore">Ignorar esta coluna</option>
                          <option value="__name">Nome (obrigatório)</option>
                          <option value="__rite">Rito</option>
                          <option value="__power">Potência</option>
                          {[1, 2, 3].map((tier) => (
                            <optgroup key={tier} label={TIER_LABEL[tier]}>
                              {analysis.targetFields.filter((f) => f.tier === tier).map((f) => (
                                <option key={f.field} value={f.field}>{f.label}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {analysis.rowIssues && analysis.rowIssues.length > 0 ? (
            <Card className="space-y-2">
              <CardTitle>Pontos para revisar ({analysis.rowIssues.length})</CardTitle>
              <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
                {analysis.rowIssues.slice(0, 50).map((issue, i) => (
                  <li key={i} className={issue.severity === 'error' ? 'text-rose-300' : 'text-gold'}>
                    Linha {issue.row}: {issue.message}
                  </li>
                ))}
              </ul>
              {analysis.rowIssues.length > 50 ? (
                <p className="text-xs text-sand-dark">e mais {analysis.rowIssues.length - 50} linha(s)…</p>
              ) : null}
            </Card>
          ) : null}

          {(analysis.unmatchedRites?.length || analysis.unmatchedPowers?.length) ? (
            <Alert intent="warn">
              {analysis.unmatchedRites?.length ? (
                <p>Ritos não encontrados na loja (ficarão em branco): {analysis.unmatchedRites.join(', ')}.</p>
              ) : null}
              {analysis.unmatchedPowers?.length ? (
                <p>Potências não encontradas na loja (ficarão em branco): {analysis.unmatchedPowers.join(', ')}.</p>
              ) : null}
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" type="button" onClick={reset} disabled={busy}>
              Escolher outro arquivo
            </Button>
            <Button type="button" onClick={handleCommit} disabled={busy || analysis.aborted || analysis.mapping.nameIndex == null}>
              {busy ? 'Processando…' : 'Confirmar importação'}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'done' && commitResult ? (
        <div className="space-y-4">
          <Alert intent="ok">Importação concluída.</Alert>
          <Card className="space-y-2">
            <CardTitle>Resumo</CardTitle>
            <ul className="text-sm text-sand-light">
              <li>{commitResult.stats.imported} membro(s) importado(s)</li>
              <li>{commitResult.stats.skippedRows} linha(s) ignorada(s) (sem nome)</li>
              <li>{commitResult.stats.warnings} aviso(s) para revisão manual</li>
              <li>{commitResult.relativesCreated} familiar(es) reconhecido(s) automaticamente</li>
            </ul>
          </Card>
          <Link href="/dashboard/membros">
            <Button type="button">Ver membros importados</Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
