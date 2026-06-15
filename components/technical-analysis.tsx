'use client';

import React, { useMemo } from 'react';
import ReactECharts, { type EChartsOption } from 'echarts-for-react';
import { useTheme } from 'next-themes';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { IndicatorResult, SignalBias, TechnicalAnalysisOutput } from '@/lib/ta/types';

const OVERLAY_PALETTE = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6', '#a855f7', '#f97316'];
const PANE_PALETTE = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b'];

function biasClasses(bias: SignalBias): string {
  switch (bias) {
    case 'bullish':
      return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
    case 'bearish':
      return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
    default:
      return 'text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800';
  }
}

function fmt(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (abs >= 1) return value.toFixed(2);
  return value.toFixed(4);
}

function latestText(ind: IndicatorResult): string {
  const entries = Object.entries(ind.latest).filter(([, v]) => v != null);
  if (entries.length === 0) return '—';
  return entries.map(([k, v]) => `${k}: ${fmt(v as number)}`).join('  ·  ');
}

function PaneChart({ indicator, isDark }: { indicator: IndicatorResult; isDark: boolean }) {
  const option = useMemo<EChartsOption>(() => {
    const len = indicator.lines[0]?.values.length ?? 0;
    const x = Array.from({ length: len }, (_, i) => i);
    return {
      animation: false,
      grid: { left: 44, right: 12, top: 24, bottom: 20 },
      tooltip: { trigger: 'axis' },
      legend: { show: indicator.lines.length > 1, top: 0, textStyle: { color: isDark ? '#a3a3a3' : '#525252', fontSize: 10 } },
      xAxis: { type: 'category', data: x, show: false, boundaryGap: false },
      yAxis: {
        type: 'value',
        scale: true,
        axisLabel: { color: isDark ? '#737373' : '#525252', fontSize: 10 },
        splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' } },
      },
      series: indicator.lines.map((ln, i) => ({
        name: ln.label,
        type: 'line',
        data: ln.values,
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 1.5, color: PANE_PALETTE[i % PANE_PALETTE.length] },
        itemStyle: { color: PANE_PALETTE[i % PANE_PALETTE.length] },
      })),
    };
  }, [indicator, isDark]);

  return (
    <div className="rounded-lg border border-border/60 p-2">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-xs font-medium text-foreground">{indicator.label}</span>
        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', biasClasses(indicator.bias))}>{indicator.bias}</span>
      </div>
      <ReactECharts option={option} style={{ height: 110, width: '100%' }} notMerge lazyUpdate />
    </div>
  );
}

export function TechnicalAnalysis({ result }: { result: TechnicalAnalysisOutput }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const candles = result.candles ?? [];
  const indicators = result.indicators ?? [];

  const priceOverlays = useMemo(() => indicators.filter((i) => i.overlay === 'price'), [indicators]);
  const paneIndicators = useMemo(() => indicators.filter((i) => i.overlay === 'pane' && i.lines.length > 0), [indicators]);

  const mainOption = useMemo<EChartsOption>(() => {
    const dates = candles.map((c) => new Date(c.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    const ohlc = candles.map((c) => [c.open, c.close, c.low, c.high]);

    const overlaySeries: NonNullable<EChartsOption['series']> = [];
    let colorIdx = 0;
    const levelData: { yAxis: number; name: string }[] = [];

    for (const ind of priceOverlays) {
      for (const ln of ind.lines) {
        overlaySeries.push({
          name: `${ind.label} ${ln.label}`,
          type: 'line',
          data: ln.values,
          showSymbol: false,
          connectNulls: false,
          lineStyle: { width: 1.4, color: OVERLAY_PALETTE[colorIdx % OVERLAY_PALETTE.length] },
          itemStyle: { color: OVERLAY_PALETTE[colorIdx % OVERLAY_PALETTE.length] },
        });
        colorIdx++;
      }
      for (const lvl of ind.levels ?? []) {
        if (lvl.value != null && Number.isFinite(lvl.value)) levelData.push({ yAxis: lvl.value, name: lvl.label });
      }
    }

    return {
      animation: false,
      grid: { left: 56, right: 16, top: 16, bottom: 28 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: {
        show: overlaySeries.length > 0,
        top: 0,
        type: 'scroll',
        textStyle: { color: isDark ? '#a3a3a3' : '#525252', fontSize: 10 },
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: true,
        axisLabel: { color: isDark ? '#737373' : '#525252', fontSize: 10 },
        axisLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' } },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLabel: { color: isDark ? '#737373' : '#525252', fontSize: 10 },
        splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' } },
      },
      dataZoom: [
        { type: 'inside', start: 50, end: 100 },
        { type: 'slider', start: 50, end: 100, height: 16, bottom: 4 },
      ],
      series: [
        {
          name: result.displaySymbol ?? result.symbol ?? 'Price',
          type: 'candlestick',
          data: ohlc,
          itemStyle: {
            color: '#22c55e',
            color0: '#ef4444',
            borderColor: '#22c55e',
            borderColor0: '#ef4444',
          },
          markLine:
            levelData.length > 0
              ? {
                  symbol: 'none',
                  silent: true,
                  lineStyle: { color: isDark ? '#737373' : '#a3a3a3', type: 'dashed', width: 1 },
                  label: { formatter: '{b}', fontSize: 9, color: isDark ? '#a3a3a3' : '#525252' },
                  data: levelData.map((l) => ({ yAxis: l.yAxis, name: l.name })),
                }
              : undefined,
        },
        ...overlaySeries,
      ],
    };
  }, [candles, priceOverlays, isDark, result.displaySymbol, result.symbol]);

  if (!result.success) {
    return (
      <Card className="my-4 border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
        <p className="text-sm font-medium text-red-700 dark:text-red-400">Technical analysis failed</p>
        <p className="mt-1 text-sm text-red-600 dark:text-red-400/80">{result.error ?? 'Unknown error'}</p>
      </Card>
    );
  }

  return (
    <Card className="my-4 overflow-hidden p-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-foreground">{result.displaySymbol ?? result.symbol}</span>
          <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {result.assetType}
          </span>
          <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{result.timeframe}</span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {indicators.length} indicator{indicators.length === 1 ? '' : 's'} · {result.source}
        </span>
      </div>

      {/* Main candlestick chart with price overlays */}
      {candles.length > 0 && (
        <div className="px-2 pt-2">
          <ReactECharts option={mainOption} style={{ height: 320, width: '100%' }} notMerge lazyUpdate />
        </div>
      )}

      {/* Oscillator / volume panes */}
      {paneIndicators.length > 0 && (
        <div className="grid grid-cols-1 gap-2 px-3 pb-1 pt-2 sm:grid-cols-2">
          {paneIndicators.map((ind) => (
            <PaneChart key={ind.id} indicator={ind} isDark={isDark} />
          ))}
        </div>
      )}

      {/* Snapshot table */}
      {indicators.length > 0 && (
        <div className="px-3 pb-3 pt-2">
          <div className="overflow-hidden rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Indicator</th>
                  <th className="px-3 py-2 font-medium">Latest</th>
                  <th className="px-3 py-2 font-medium">Signal</th>
                </tr>
              </thead>
              <tbody>
                {indicators.map((ind) => (
                  <tr key={ind.id} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={cn('h-2 w-2 rounded-full', biasClasses(ind.bias).split(' ').find((c) => c.startsWith('bg-')))} />
                        <span className="font-medium text-foreground">{ind.label}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{latestText(ind)}</td>
                    <td className="px-3 py-2 text-xs text-foreground/80">{ind.signal ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Skipped indicators */}
          {result.skipped && result.skipped.length > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Skipped: {result.skipped.map((s) => `${s.label} (${s.reason})`).join('; ')}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

export default TechnicalAnalysis;
