'use client';

import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ScreenerCandidate, StockFinderOutput } from '@/lib/screener/types';

type SortKey = 'rank' | 'marketCap' | 'peTTM' | 'dividendYield' | 'pctVs200dma';

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$',
  INR: '₹',
  EUR: '€',
  GBP: '£',
};

function symbolFor(currency: string): string {
  return CURRENCY_SYMBOL[currency] ?? '';
}

function fmtPrice(value: number | null, currency: string): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${symbolFor(currency)}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/** Market cap: USD uses B/T, INR uses Cr (crore = 1e7). */
function fmtMarketCap(value: number | null, currency: string): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const sym = symbolFor(currency);
  if (currency === 'INR') {
    const cr = value / 1e7;
    // Non-breaking spaces keep "2.05L Cr" on a single line.
    if (cr >= 1e5) return `${sym}${(cr / 1e5).toFixed(2)}L\u00A0Cr`;
    return `${sym}${cr.toLocaleString(undefined, { maximumFractionDigits: 0 })}\u00A0Cr`;
  }
  if (value >= 1e12) return `${sym}${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${sym}${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${sym}${(value / 1e6).toFixed(2)}M`;
  return `${sym}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtNum(value: number | null, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

function fmtPct(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

function pctClass(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'text-muted-foreground';
  if (value > 0) return 'text-green-600 dark:text-green-400';
  if (value < 0) return 'text-red-600 dark:text-red-400';
  return 'text-muted-foreground';
}

const STRATEGY_LABEL: Record<string, string> = {
  value_large: 'undervalued large caps',
  value_growth: 'undervalued growth',
  growth_tech: 'growth technology',
  momentum_up: "today's gainers",
  momentum_down: "today's losers",
  active: 'most active',
  small_cap: 'aggressive small caps',
  most_shorted: 'most shorted',
};

function sortCandidates(rows: ScreenerCandidate[], key: SortKey, dir: 1 | -1): ScreenerCandidate[] {
  if (key === 'rank') return rows;
  const get = (r: ScreenerCandidate): number | null => {
    switch (key) {
      case 'marketCap':
        return r.marketCap;
      case 'peTTM':
        return r.peTTM;
      case 'dividendYield':
        return r.dividendYield;
      case 'pctVs200dma':
        return r.pctVs200dma;
      default:
        return null;
    }
  };
  return [...rows].sort((a, b) => {
    const av = get(a);
    const bv = get(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return (av - bv) * dir;
  });
}

export function StockFinder({ result }: { result: StockFinderOutput }) {
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [collapsed, setCollapsed] = useState(false);

  const candidates = useMemo(
    () => sortCandidates(result.candidates ?? [], sortKey, sortDir),
    [result.candidates, sortKey, sortDir],
  );

  if (!result.success && (!result.candidates || result.candidates.length === 0)) {
    return (
      <Card className="overflow-hidden border-border/60 p-4">
        <p className="text-sm text-muted-foreground">{result.error ?? 'No matching stocks were found.'}</p>
      </Card>
    );
  }

  const strategyText = result.strategyUsed ? STRATEGY_LABEL[result.strategyUsed] ?? result.strategyUsed : null;

  const toggleSort = (key: SortKey) => {
    if (key === 'rank') {
      setSortKey('rank');
      return;
    }
    if (sortKey === key) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(-1);
    }
  };

  const SortHeader = ({ label, k, className }: { label: string; k: SortKey; className?: string }) => (
    <th className={cn('px-2.5 py-2 font-medium whitespace-nowrap', className)}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
      >
        {label}
        {sortKey === k && k !== 'rank' && <span className="text-[9px]">{sortDir === 1 ? '▲' : '▼'}</span>}
      </button>
    </th>
  );

  return (
    <Card className="overflow-hidden border-border/60">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted/60"
      >
        <div>
          <h3 className="text-sm font-semibold text-foreground">Stock Finder</h3>
          <p className="text-xs text-muted-foreground">
            {result.market ?? 'US'}
            {strategyText ? ` · ${strategyText}` : ''}
            {candidates.length > 0 ? ` · ${candidates.length} matches` : ''}
          </p>
        </div>
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn('shrink-0 text-muted-foreground transition-transform duration-200', collapsed ? '' : 'rotate-180')}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {!collapsed && (candidates.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          {result.error ?? 'No stocks in the screened universe matched all of your criteria.'}
        </p>
      ) : (
        <div className="overflow-x-auto [scrollbar-width:thin]">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="border-b border-border/60 bg-muted/20 text-left text-[11px] text-muted-foreground">
                <th className="px-2.5 py-2 font-medium whitespace-nowrap">#</th>
                <th className="px-2.5 py-2 font-medium whitespace-nowrap">Ticker</th>
                <th className="px-2.5 py-2 font-medium">Company</th>
                <th className="px-2.5 py-2 font-medium text-right whitespace-nowrap">Price</th>
                <SortHeader label="Mkt Cap" k="marketCap" className="text-right" />
                <SortHeader label="P/E" k="peTTM" className="text-right" />
                <SortHeader label="Div %" k="dividendYield" className="text-right" />
                <SortHeader label="200DMA" k="pctVs200dma" className="text-right" />
                <th className="px-2.5 py-2 font-medium whitespace-nowrap">Why</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c, i) => (
                <tr key={c.ticker} className="border-b border-border/40 last:border-0 align-middle">
                  <td className="px-2.5 py-2 text-[11px] text-muted-foreground tabular-nums">
                    {sortKey === 'rank' ? i + 1 : ''}
                  </td>
                  <td className="px-2.5 py-2 whitespace-nowrap">
                    <span className="font-semibold text-foreground">{c.ticker.replace('.NS', '')}</span>
                    {c.changePct != null && (
                      <span className={cn('ml-1.5 text-[10px]', pctClass(c.changePct))}>{fmtPct(c.changePct)}</span>
                    )}
                  </td>
                  <td className="px-2.5 py-2 text-xs text-foreground/80 max-w-[150px]">
                    <span className="block truncate" title={c.name}>{c.name}</span>
                    {c.sector && <span className="block truncate text-[10px] text-muted-foreground">{c.sector}</span>}
                  </td>
                  <td className="px-2.5 py-2 text-right font-mono text-xs whitespace-nowrap">{fmtPrice(c.price, c.currency)}</td>
                  <td className="px-2.5 py-2 text-right font-mono text-xs whitespace-nowrap">{fmtMarketCap(c.marketCap, c.currency)}</td>
                  <td className="px-2.5 py-2 text-right font-mono text-xs whitespace-nowrap">{fmtNum(c.peTTM)}</td>
                  <td className="px-2.5 py-2 text-right font-mono text-xs whitespace-nowrap">
                    {c.dividendYield != null ? `${c.dividendYield.toFixed(2)}%` : '—'}
                  </td>
                  <td className={cn('px-2.5 py-2 text-right font-mono text-xs whitespace-nowrap', pctClass(c.pctVs200dma))}>
                    {fmtPct(c.pctVs200dma)}
                  </td>
                  <td className="px-2.5 py-2 text-[10px] text-muted-foreground whitespace-nowrap">
                    {c.matched.length > 0 ? c.matched.join(' · ') : 'Ranked by strategy'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {!collapsed && result.notes && result.notes.length > 0 && (
        <p className="border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
          {result.notes.join(' ')}
        </p>
      )}
      {!collapsed && (
        <p className="border-t border-border/60 px-4 py-2 text-[10px] text-muted-foreground">
          Screen matches, not buy/sell recommendations. Information only, not financial advice.
        </p>
      )}
    </Card>
  );
}

export default StockFinder;
