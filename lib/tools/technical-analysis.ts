import { tool } from 'ai';
import { z } from 'zod';
import { fetchOhlcv } from '@/lib/ta/ohlcv';
import { fetchMarketContext } from '@/lib/ta/market-data';
import { defaultParams, getIndicator, MAX_INDICATORS } from '@/lib/ta/registry';
import type { AssetType, IndicatorResult, SkippedIndicator, TechnicalAnalysisOutput, Timeframe } from '@/lib/ta/types';

export interface TechnicalAnalysisConfig {
  /** indicator ids the user selected via the slash menu (deterministic, not model-chosen) */
  indicators: string[];
  timeframe: Timeframe;
}

const TIMEFRAMES: Timeframe[] = ['1h', '4h', '1d', '1w'];

/**
 * Factory tool: closes over the user's slash-selected indicators so the model only
 * has to extract the asset symbol. All math runs server-side; the LLM only interprets.
 */
export function technicalAnalysisTool(config: TechnicalAnalysisConfig) {
  const selected = (config.indicators ?? []).slice(0, MAX_INDICATORS);
  const timeframe: Timeframe = TIMEFRAMES.includes(config.timeframe) ? config.timeframe : '1d';

  return tool({
    description:
      'Run technical analysis on a stock or cryptocurrency. The indicators to compute are pre-selected by the user; you only need to identify the asset symbol from the query (e.g. "AAPL", "Tesla", "BTC", "Ethereum"). All indicator values are computed server-side from OHLCV data - never recompute them yourself, only interpret the returned values and signals.',
    inputSchema: z.object({
      symbol: z
        .string()
        .describe('The asset to analyze - a stock ticker/company (e.g. "AAPL", "Apple") or a crypto symbol/name (e.g. "BTC", "Bitcoin").'),
      assetType: z
        .enum(['stock', 'crypto'])
        .optional()
        .describe('Optional hint. Omit to auto-detect (crypto is tried first, then stock).'),
    }),
    execute: async ({ symbol, assetType }: { symbol: string; assetType?: AssetType }): Promise<TechnicalAnalysisOutput> => {
      console.log('Technical analysis:', { symbol, assetType, indicators: selected, timeframe });

      if (selected.length === 0) {
        return { success: false, error: 'No indicators selected. Use the slash menu to pick up to 5 indicators.' };
      }

      try {
        const ohlcv = await fetchOhlcv({ symbol, assetType, timeframe });
        if (!ohlcv || ohlcv.candles.length < 20) {
          return {
            success: false,
            error: `Could not load enough price data for "${symbol}". Check the symbol and try again.`,
            requestedIndicators: selected,
          };
        }

        const { candles, hasVolume } = ohlcv;

        const needsMarket = selected.some((id) => getIndicator(id)?.needs === 'market');
        const market = needsMarket ? await fetchMarketContext(timeframe, candles.length) : undefined;
        const marketContextAvailable = Boolean(market?.spx?.length || market?.vix?.length);

        const indicators: IndicatorResult[] = [];
        const skipped: SkippedIndicator[] = [];

        for (const id of selected) {
          const def = getIndicator(id);
          if (!def) {
            skipped.push({ id, label: id, reason: 'Unknown indicator' });
            continue;
          }
          if (def.needs === 'volume' && !hasVolume) {
            skipped.push({ id, label: def.label, reason: 'No per-bar volume available for this asset/timeframe' });
            continue;
          }
          if (def.needs === 'market' && !marketContextAvailable) {
            skipped.push({ id, label: def.label, reason: 'Market reference data (S&P 500 / VIX) unavailable' });
            continue;
          }
          try {
            indicators.push(def.compute(candles, defaultParams(def), { assetType: ohlcv.assetType, timeframe, market }));
          } catch (err) {
            console.error(`[technical-analysis] compute failed for ${id}:`, err);
            skipped.push({ id, label: def.label, reason: 'Calculation error' });
          }
        }

        // Trim candles and indicator series consistently so the chart aligns by index.
        const MAX_BARS = 200;
        const trimmedCandles = candles.slice(-MAX_BARS);
        if (candles.length > MAX_BARS) {
          for (const ind of indicators) {
            for (const ln of ind.lines) {
              ln.values = ln.values.slice(-MAX_BARS);
            }
          }
        }

        return {
          success: true,
          symbol: ohlcv.resolvedSymbol,
          displaySymbol: ohlcv.displaySymbol,
          assetType: ohlcv.assetType,
          timeframe,
          source: ohlcv.source,
          hasVolume,
          candles: trimmedCandles,
          indicators,
          skipped,
          marketContextAvailable,
          asOf: new Date().toISOString(),
          requestedIndicators: selected,
        };
      } catch (error) {
        console.error('[technical-analysis] error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error running technical analysis',
          requestedIndicators: selected,
        };
      }
    },
  });
}
