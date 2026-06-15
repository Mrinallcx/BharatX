import 'server-only';
import YahooFinance from 'yahoo-finance2';
import type { Candle, MarketContext, Timeframe } from './types';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

async function fetchIndexDaily(symbol: string, limit: number): Promise<Candle[] | undefined> {
  try {
    const day = 24 * 60 * 60 * 1000;
    const result = await yf.chart(symbol, {
      period1: new Date(Date.now() - (limit + 20) * day),
      interval: '1d',
    });

    const quotes = result?.quotes ?? [];
    const candles: Candle[] = quotes
      .filter((q) => q.close != null)
      .map((q) => {
        const timestamp = q.date instanceof Date ? q.date.getTime() : new Date(q.date as unknown as string).getTime();
        return {
          timestamp,
          date: new Date(timestamp).toISOString(),
          open: Number(q.open ?? q.close),
          high: Number(q.high ?? q.close),
          low: Number(q.low ?? q.close),
          close: Number(q.close),
          volume: q.volume != null ? Number(q.volume) : null,
        };
      });

    return candles.length ? candles.slice(-limit) : undefined;
  } catch (error) {
    console.error(`[ta/market-data] failed to fetch ${symbol}:`, error);
    return undefined;
  }
}

/**
 * Phase 3 light macro overlay: VIX + S&P 500 daily series.
 * Always daily regardless of the asset timeframe (macro context, not per-bar overlay).
 */
export async function fetchMarketContext(_timeframe: Timeframe, limit = 300): Promise<MarketContext> {
  const [spx, vix] = await Promise.all([fetchIndexDaily('^GSPC', limit), fetchIndexDaily('^VIX', limit)]);
  return { spx, vix };
}
