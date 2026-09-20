// Porta de entrada da importação de backup financeiro: recebe os arquivos
// enviados (CSV/XLSX), descobre que relatório cada um é, lê e devolve o que o
// planner precisa. Compartilhado pela API (upload) e pelos scripts (disco).

import { readGrids, UnsupportedFormatError, type Grid } from './grid';
import {
  looksLikeExtrato, looksLikeLedger, parseBalancete, parseExtrato, parseRazao,
} from './reports';
import { looksLikeCounterparties, looksLikeOpenItems, parseCounterparties, parseOpenItems } from './realign';
import type { LegacyFiles } from './planner';

export type FileKind = 'extrato' | 'razao' | 'balancete' | 'clients' | 'suppliers' | 'openItems' | 'forecast' | 'unknown';

export const KIND_LABEL: Record<FileKind, string> = {
  extrato: 'Extrato de conta',
  razao: 'Livro razão',
  balancete: 'Balancete',
  clients: 'Cadastro de clientes',
  suppliers: 'Cadastro de fornecedores',
  openItems: 'Contas a pagar e receber',
  forecast: 'Previsão do fluxo de caixa',
  unknown: 'Não reconhecido',
};

export interface FileReport {
  name: string;
  kind: FileKind;
  status: 'used' | 'ignored' | 'error';
  detail: string;
}

interface Candidate {
  name: string;
  kind: FileKind;
  grids: Grid[];
  isCsv: boolean;
}

export function classify(name: string, grids: Grid[]): FileKind {
  const first = grids[0];
  if (!first) return 'unknown';
  if (looksLikeLedger(first, 'balancete')) return 'balancete';
  if (looksLikeLedger(first, 'razao')) return 'razao';
  if (looksLikeExtrato(first)) return 'extrato';
  if (/Previs[aã]o do Fluxo de Caixa/i.test(name)) return 'forecast';
  if (looksLikeOpenItems(grids)) return 'openItems';
  if (looksLikeCounterparties(grids)) return /fornec/i.test(name) ? 'suppliers' : 'clients';
  return 'unknown';
}

export async function readLegacyFiles(uploads: { name: string; buffer: Buffer }[]): Promise<{ reports: FileReport[]; files: LegacyFiles }> {
  const reports: FileReport[] = [];
  const candidates: Candidate[] = [];

  for (const u of uploads) {
    try {
      const grids = await readGrids(u);
      const kind = classify(u.name, grids);
      if (kind === 'unknown') {
        reports.push({ name: u.name, kind, status: 'error', detail: 'Não reconheci este relatório. Formatos aceitos: extrato de conta, livro razão, balancete, clientes, fornecedores e contas a pagar/receber. Se este é o mesmo relatório convertido de PDF, envie o CSV dele.' });
        continue;
      }
      candidates.push({ name: u.name, kind, grids, isCsv: !/\.xlsx$/i.test(u.name) });
    } catch (e) {
      const msg = e instanceof UnsupportedFormatError ? e.message : 'Não foi possível ler o arquivo (formato inválido ou corrompido).';
      reports.push({ name: u.name, kind: 'unknown', status: 'error', detail: msg });
    }
  }

  // Mesmo relatório em dois formatos: o CSV vem direto do sistema; o XLSX é conversão de PDF
  // (células misturadas) — fica o CSV. Entre iguais, o primeiro.
  candidates.sort((a, b) => Number(b.isCsv) - Number(a.isCsv));
  const chosen = new Map<FileKind, Candidate>();
  for (const c of candidates) {
    if (c.kind === 'forecast') { reports.push({ name: c.name, kind: c.kind, status: 'ignored', detail: 'É uma projeção, não movimento real. Os títulos em aberto vêm de "Contas a pagar e receber".' }); continue; }
    if (chosen.has(c.kind)) {
      reports.push({ name: c.name, kind: c.kind, status: 'ignored', detail: `Repetido — foi usado "${chosen.get(c.kind)!.name}".` });
      continue;
    }
    chosen.set(c.kind, c);
  }

  const files: LegacyFiles = {};
  for (const [kind, c] of chosen) {
    try {
      if (kind === 'extrato') {
        files.extrato = parseExtrato(c.grids[0]);
        reports.push({ name: c.name, kind, status: 'used', detail: `${files.extrato.entries.length} lançamento(s) em ${files.extrato.accounts.length} conta(s).` });
      } else if (kind === 'razao') {
        files.razao = parseRazao(c.grids[0]);
        reports.push({ name: c.name, kind, status: 'used', detail: `${files.razao.entries.length} lançamento(s) com categoria.` });
      } else if (kind === 'balancete') {
        files.balancete = parseBalancete(c.grids[0]);
        reports.push({ name: c.name, kind, status: 'used', detail: `${files.balancete.lines.length} conta(s) do plano, período ${files.balancete.periodFrom ?? '?'} a ${files.balancete.periodTo ?? '?'}.` });
      } else if (kind === 'clients' || kind === 'suppliers') {
        const parsed = parseCounterparties(c.grids);
        if (kind === 'clients') files.clients = parsed; else files.suppliers = parsed;
        reports.push({ name: c.name, kind, status: 'used', detail: `${parsed.rows.length} cadastro(s) (realinhado do PDF).` });
      } else if (kind === 'openItems') {
        files.openItems = parseOpenItems(c.grids);
        reports.push({ name: c.name, kind, status: 'used', detail: `${files.openItems.items.length} título(s) em aberto (realinhado do PDF).` });
      }
    } catch {
      reports.push({ name: c.name, kind, status: 'error', detail: 'Falha ao interpretar o conteúdo do arquivo.' });
    }
  }
  return { reports, files };
}
