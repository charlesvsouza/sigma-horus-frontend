'use client';

import { useMemo, useState } from 'react';
import { inputClass } from '@/components/ui';
import { brl } from '@/lib/currency';
import {
  AGING_BUCKETS, EMPTY_FILTERS, PERIOD_PRESETS, QUICK_VIEWS, agingFacets, isDefaultFilters, situationFacets, totalsOf,
  type Filters, type FilterAccount, type Situation, type SortKey, type Totals,
} from '@/lib/accounts-filter';
import { formatDateOnly } from '@/lib/date-only';

// Barra de filtros padrão das listas de contas (a receber e a pagar): tipo, situação com contagem e valor,
// faixas de atraso, período com atalhos, pessoa, "mais filtros", vistas rápidas e resumo. A lógica está em
// lib/accounts-filter (testada); aqui só a apresentação. Filtra na hora, sem botão.

export interface FilterOption { id: string; name: string }

const SIT_LABEL: Record<Situation, string> = { all: 'Todas', open: 'Em aberto', overdue: 'Vencidas', upcoming: 'A vencer', paid: 'Pagas' };
const SORT_LABEL: Record<SortKey, string> = { 'due-asc': 'Vencimento (mais antigo)', 'due-desc': 'Vencimento (mais novo)', 'amount-desc': 'Maior valor', person: 'Pessoa (A–Z)' };
const TIPOS: { value: Filters['tipo']; label: string }[] = [{ value: 'all', label: 'Todas' }, { value: 'RECEIVABLE', label: 'A receber' }, { value: 'PAYABLE', label: 'A pagar' }];

const chipBase = 'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors';
const chipOn = 'border-gold/60 bg-gold/10 text-gold';
const chipOff = 'border-white/10 text-sand-dark hover:text-sand-light';

function PersonPicker({ people, value, onPick }: { people: FilterOption[]; value: string; onPick: (id: string) => void }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const selected = people.find((p) => p.id === value);
  const matches = useMemo(() => {
    const q = text.trim().toLowerCase();
    return (q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people).slice(0, 8);
  }, [people, text]);
  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">
        <span className="min-w-0 flex-1 truncate">{selected.name}</span>
        <button type="button" onClick={() => { onPick(''); setText(''); }} aria-label="Tirar o filtro de pessoa" className="shrink-0 px-1 text-sand-dark hover:text-sand-light">✕</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <input
        value={text}
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder="Digite o nome…"
        aria-label="Filtrar por pessoa"
        role="combobox"
        aria-expanded={open}
        aria-controls="filtro-pessoa-lista"
        aria-autocomplete="list"
        className={inputClass}
      />
      {open && matches.length > 0 ? (
        <ul id="filtro-pessoa-lista" role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-white/10 bg-sigma-card py-1 shadow-xl">
          {matches.map((p) => (
            <li key={p.id} role="option" aria-selected={false}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(p.id); setText(''); setOpen(false); }} className="block w-full px-3 py-2 text-left text-sm text-sand hover:bg-white/5">{p.name}</button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function AccountsFilterBar({
  accounts, filters, onChange, today, people, categories, banks,
}: {
  accounts: FilterAccount[];
  filters: Filters;
  onChange: (next: Filters) => void;
  /** Dia civil de Brasília (00:00 UTC). */
  today: Date;
  people: FilterOption[];
  categories: FilterOption[];
  banks: FilterOption[];
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const facets = useMemo(() => situationFacets(accounts, filters, today), [accounts, filters, today]);
  const aging = useMemo(() => agingFacets(accounts, filters, today), [accounts, filters, today]);
  const anyOverdue = aging.some((a) => a.count > 0) || filters.daysMin !== null;
  const activeBucket = AGING_BUCKETS.find((b) => b.min === filters.daysMin && b.max === filters.daysMax)?.key ?? null;
  const moreActive = Boolean(filters.cat || filters.bank || filters.dues || filters.min || filters.max);
  // Aberto à mão ou enquanto houver filtro em uso ali dentro (limpar o último não fecha o painel de repente).
  const [moreOpen, setMoreOpen] = useState(false);

  const chips: { key: string; label: string; clear: Partial<Filters> }[] = [];
  if (filters.daysMin !== null || filters.daysMax !== null) {
    const b = AGING_BUCKETS.find((x) => x.min === filters.daysMin && x.max === filters.daysMax);
    chips.push({ key: 'days', label: b ? `Atraso: ${b.label}` : `Atraso: ${filters.daysMin ?? 1}${filters.daysMax ? ` a ${filters.daysMax}` : '+'} dias`, clear: { daysMin: null, daysMax: null } });
  }
  if (filters.from || filters.to) chips.push({ key: 'period', label: `Vence ${filters.from ? formatDateOnly(filters.from) : 'início'} a ${filters.to ? formatDateOnly(filters.to) : 'sem limite'}`, clear: { from: '', to: '' } });
  if (filters.cat) chips.push({ key: 'cat', label: filters.cat === 'none' ? 'Sem categoria' : `Categoria: ${categories.find((c) => c.id === filters.cat)?.name ?? '—'}`, clear: { cat: '' } });
  if (filters.bank) chips.push({ key: 'bank', label: filters.bank === 'none' ? 'Sem conta bancária' : `Conta: ${banks.find((c) => c.id === filters.bank)?.name ?? '—'}`, clear: { bank: '' } });
  if (filters.dues) chips.push({ key: 'dues', label: 'Só mensalidades', clear: { dues: false } });
  if (filters.min || filters.max) chips.push({ key: 'amount', label: `Valor ${filters.min ? `de ${brl(Number(filters.min.replace(',', '.')) || 0)}` : ''}${filters.max ? ` até ${brl(Number(filters.max.replace(',', '.')) || 0)}` : ''}`.trim(), clear: { min: '', max: '' } });
  if (filters.q) chips.push({ key: 'q', label: `Busca: “${filters.q}”`, clear: { q: '' } });

  return (
    <div className="space-y-4" aria-label="Filtros da lista">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Tipo de conta" className="inline-flex rounded-full border border-white/10 p-0.5">
          {TIPOS.map((t) => (
            <button key={t.value} type="button" aria-pressed={filters.tipo === t.value} onClick={() => set({ tipo: t.value })} className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${filters.tipo === t.value ? 'bg-gold text-sigma-blue-deep' : 'text-sand-dark hover:text-sand-light'}`}>{t.label}</button>
          ))}
        </div>
        <input
          value={filters.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Buscar por título, pessoa, categoria ou descrição…"
          aria-label="Buscar"
          className={`${inputClass} min-w-56 flex-1`}
        />
        <label className="flex items-center gap-2 text-xs text-sand-dark">
          Ordenar por
          <select value={filters.sort} onChange={(e) => set({ sort: e.target.value as SortKey })} className={`${inputClass} w-auto`}>
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => <option key={k} value={k}>{SORT_LABEL[k]}</option>)}
          </select>
        </label>
      </div>

      <div role="group" aria-label="Situação" className="flex flex-wrap gap-2">
        {(['all', 'open', 'overdue', 'upcoming', 'paid'] as Situation[]).map((s) => (
          <button key={s} type="button" aria-pressed={filters.sit === s} onClick={() => set({ sit: s, ...(s !== 'overdue' && s !== 'open' && s !== 'all' ? { daysMin: null, daysMax: null } : {}) })} className={`${chipBase} ${filters.sit === s ? chipOn : chipOff}`}>
            {SIT_LABEL[s]} <span className="tabular-nums opacity-70">{facets[s].count}</span>
            {s !== 'all' && facets[s].count > 0 ? <span className="ml-1.5 tabular-nums opacity-60">· {brl(facets[s].total)}</span> : null}
          </button>
        ))}
      </div>

      {anyOverdue ? (
        <div aria-label="Faixas de atraso" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {aging.map((a) => (
            <button
              key={a.key}
              type="button"
              aria-pressed={activeBucket === a.key}
              onClick={() => (activeBucket === a.key ? set({ daysMin: null, daysMax: null }) : set({ sit: 'overdue', daysMin: a.min, daysMax: a.max }))}
              className={`rounded-lg border p-3 text-left transition-colors ${activeBucket === a.key ? 'border-gold/50 bg-gold/10' : 'border-white/5 bg-sigma-blue-deep/40 hover:border-white/15'}`}
            >
              <p className="text-xs text-sand-dark">{a.label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-sand-light">{a.count}</p>
              <p className="text-xs tabular-nums text-sand-dark">{brl(a.total)}</p>
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[2fr_1.4fr]">
        <div>
          <p className="mb-1.5 text-xs text-sand-dark">Vencimento</p>
          <div className="flex flex-wrap items-center gap-2">
            {PERIOD_PRESETS.map((p) => (
              <button key={p.key} type="button" onClick={() => set(p.apply(today))} className={`${chipBase} ${chipOff}`}>{p.label}</button>
            ))}
            <input type="date" aria-label="Vencimento a partir de" value={filters.from} onChange={(e) => set({ from: e.target.value })} className={`${inputClass} w-auto`} />
            <span className="text-xs text-sand-dark">até</span>
            <input type="date" aria-label="Vencimento até" value={filters.to} onChange={(e) => set({ to: e.target.value })} className={`${inputClass} w-auto`} />
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs text-sand-dark">Pessoa</p>
          <PersonPicker people={people} value={filters.person} onPick={(id) => set({ person: id })} />
        </div>
      </div>

      <details open={moreOpen || moreActive} onToggle={(e) => setMoreOpen((e.currentTarget as HTMLDetailsElement).open)} className="rounded-lg border border-white/6 px-4 py-2">
        <summary className="cursor-pointer text-xs font-medium text-sand-dark hover:text-sand-light">Mais filtros{moreActive ? ' (em uso)' : ''}</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-sand-dark">Categoria
            <select value={filters.cat} onChange={(e) => set({ cat: e.target.value })} className={`mt-1 ${inputClass}`}>
              <option value="">Todas</option>
              <option value="none">Sem categoria</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-xs text-sand-dark">Conta bancária / caixa
            <select value={filters.bank} onChange={(e) => set({ bank: e.target.value })} className={`mt-1 ${inputClass}`}>
              <option value="">Todas</option>
              <option value="none">Sem conta prevista</option>
              {banks.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-xs text-sand-dark">Valor mínimo (R$)
            <input inputMode="decimal" value={filters.min} onChange={(e) => set({ min: e.target.value })} placeholder="0,00" className={`mt-1 ${inputClass}`} />
          </label>
          <label className="text-xs text-sand-dark">Valor máximo (R$)
            <input inputMode="decimal" value={filters.max} onChange={(e) => set({ max: e.target.value })} placeholder="sem limite" className={`mt-1 ${inputClass}`} />
          </label>
          <label className="flex items-center gap-2 text-xs text-sand-dark sm:col-span-2">
            <input type="checkbox" checked={filters.dues} onChange={(e) => set({ dues: e.target.checked })} className="h-4 w-4 accent-gold" />
            Só mensalidades
          </label>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-2" aria-label="Vistas rápidas">
        <span className="text-xs text-sand-dark">Vistas rápidas:</span>
        {QUICK_VIEWS.map((v) => (
          <button key={v.key} type="button" onClick={() => onChange({ ...EMPTY_FILTERS, sort: filters.sort, ...v.apply(today) })} className={`${chipBase} ${chipOff}`}>{v.label}</button>
        ))}
      </div>

      {chips.length > 0 || !isDefaultFilters(filters) ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {chips.map((c) => (
            <span key={c.key} className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-gold">
              {c.label}
              <button type="button" onClick={() => set(c.clear)} aria-label={`Tirar filtro: ${c.label}`} className="px-0.5 text-gold/70 hover:text-gold">✕</button>
            </span>
          ))}
          <button type="button" onClick={() => onChange({ ...EMPTY_FILTERS })} className="font-medium text-gold underline underline-offset-2 hover:text-gold-light">limpar filtros</button>
        </div>
      ) : null}
    </div>
  );
}

/** Resumo do que o filtro mostra: quantidade e valor por tipo, com o que está em aberto separado do já liquidado. */
export function FilterSummary({ rows }: { rows: FilterAccount[] }) {
  const t = totalsOf(rows);
  const part = (label: string, x: Totals, tone: string) => (x.count > 0 ? <> · {label} <strong className={`tabular-nums ${tone}`}>{brl(x.value)}</strong> ({x.count})</> : null);
  return (
    <p className="text-xs text-sand-dark" aria-live="polite">
      <strong className="tabular-nums text-sand-light">{rows.length}</strong> lançamento{rows.length === 1 ? '' : 's'}
      {part('a receber em aberto', t.receivableOpen, 'text-emerald-300')}
      {part('recebido', t.receivableDone, 'text-sand-light')}
      {part('a pagar em aberto', t.payableOpen, 'text-rose-300')}
      {part('pago', t.payableDone, 'text-sand-light')}
      {t.receivableOpen.value > 0 && t.payableOpen.value > 0 ? <> · saldo em aberto <strong className="tabular-nums text-sand-light">{brl(Math.round((t.receivableOpen.value - t.payableOpen.value) * 100) / 100)}</strong></> : null}
    </p>
  );
}
