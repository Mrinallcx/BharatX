import { tool } from 'ai';
import { z } from 'zod';
import { serverEnv } from '@/env/server';

const GROWW_BASE_URL = 'https://api.groww.in/v1';
const DEFAULT_API_VERSION = serverEnv.GROWW_API_VERSION || '1.0';

const exchangeSchema = z.enum(['NSE', 'BSE', 'NFO', 'MCX', 'CDS']);
const segmentSchema = z.enum(['CASH', 'FNO', 'COMMODITY', 'CURRENCY']);

function resolveGrowwToken(inputToken?: string | null): string | null {
  return inputToken?.trim() || serverEnv.GROWW_ACCESS_TOKEN?.trim() || null;
}

async function fetchGroww(endpoint: string, params: URLSearchParams, accessToken: string) {
  const url = `${GROWW_BASE_URL}${endpoint}?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-API-VERSION': DEFAULT_API_VERSION,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Groww API error: ${response.status} ${response.statusText}${body ? ` | ${body}` : ''}`);
  }

  return response.json();
}

type CandlePoint = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

function toFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asArrayOfUnknown(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function maybeCandleTuple(row: unknown): CandlePoint | null {
  if (!Array.isArray(row) || row.length < 5) return null;
  const ts = toFiniteNumber(row[0]);
  const open = toFiniteNumber(row[1]);
  const high = toFiniteNumber(row[2]);
  const low = toFiniteNumber(row[3]);
  const close = toFiniteNumber(row[4]);
  const volume = toFiniteNumber(row[5]);
  if (ts === null || open === null || high === null || low === null || close === null) return null;
  return { timestamp: ts, open, high, low, close, volume: volume ?? undefined };
}

function maybeCandleObject(row: unknown): CandlePoint | null {
  if (!row || typeof row !== 'object') return null;
  const obj = row as Record<string, unknown>;
  const ts = toFiniteNumber(obj.timestamp ?? obj.time ?? obj.t ?? obj.date ?? obj.datetime);
  const open = toFiniteNumber(obj.open ?? obj.o);
  const high = toFiniteNumber(obj.high ?? obj.h);
  const low = toFiniteNumber(obj.low ?? obj.l);
  const close = toFiniteNumber(obj.close ?? obj.c);
  const volume = toFiniteNumber(obj.volume ?? obj.v);
  if (ts === null || open === null || high === null || low === null || close === null) return null;
  return { timestamp: ts, open, high, low, close, volume: volume ?? undefined };
}

function extractCandles(raw: unknown): CandlePoint[] {
  const roots: unknown[] = [];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    roots.push(obj.data, obj.candles, obj.results, obj.items, obj.values, obj);
  } else {
    roots.push(raw);
  }

  const candidates: unknown[][] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      candidates.push(node);
      for (const child of node) walk(child);
      return;
    }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      for (const value of Object.values(obj)) walk(value);
    }
  };
  roots.forEach(walk);

  for (const list of candidates) {
    const parsed = list
      .map((row) => maybeCandleTuple(row) || maybeCandleObject(row))
      .filter((candle): candle is CandlePoint => candle !== null)
      .sort((a, b) => a.timestamp - b.timestamp);
    if (parsed.length >= 20) return parsed;
  }

  return [];
}

function linearRegressionNext(closes: number[], horizonDays: number): number {
  const n = closes.length;
  const meanX = (n - 1) / 2;
  const meanY = closes.reduce((sum, y) => sum + y, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - meanX;
    numerator += dx * (closes[i] - meanY);
    denominator += dx * dx;
  }
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = meanY - slope * meanX;
  const predictionAtIndex = n - 1 + horizonDays;
  return Math.max(0, intercept + slope * predictionAtIndex);
}

function computeVolatility(closes: number[]): number {
  if (closes.length < 3) return 0;
  const logReturns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] <= 0 || closes[i] <= 0) continue;
    logReturns.push(Math.log(closes[i] / closes[i - 1]));
  }
  if (logReturns.length < 2) return 0;
  const mean = logReturns.reduce((sum, r) => sum + r, 0) / logReturns.length;
  const variance = logReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (logReturns.length - 1);
  return Math.sqrt(Math.max(0, variance));
}

export const growwQuoteTool = tool({
  description:
    'Get live market quote snapshot from Groww Trade API for Indian markets (NSE/BSE/F&O/commodities). Returns LTP, OHLC, change, depth and volume fields when available.',
  inputSchema: z.object({
    exchange: exchangeSchema.describe('Exchange code (e.g., NSE, BSE, NFO, MCX, CDS)'),
    segment: segmentSchema.describe('Market segment (CASH for stocks/index, FNO for derivatives, COMMODITY, CURRENCY)'),
    trading_symbol: z.string().describe('Trading symbol recognized by Groww (e.g., NIFTY, RELIANCE, BANKNIFTY)'),
    accessToken: z
      .string()
      .optional()
      .describe('Optional Groww bearer token. If omitted, server uses GROWW_ACCESS_TOKEN from environment.'),
  }),
  execute: async ({
    exchange,
    segment,
    trading_symbol,
    accessToken,
  }: {
    exchange: 'NSE' | 'BSE' | 'NFO' | 'MCX' | 'CDS';
    segment: 'CASH' | 'FNO' | 'COMMODITY' | 'CURRENCY';
    trading_symbol: string;
    accessToken?: string | null;
  }) => {
    const token = resolveGrowwToken(accessToken);
    if (!token) {
      return {
        success: false,
        error:
          'Missing Groww access token. Pass `accessToken` in tool input or set GROWW_ACCESS_TOKEN in server environment.',
      };
    }

    try {
      const params = new URLSearchParams({
        exchange,
        segment,
        trading_symbol,
      });
      const data = await fetchGroww('/live-data/quote', params, token);

      return {
        success: true,
        exchange,
        segment,
        trading_symbol,
        data,
        source: 'Groww Trade API',
        apiVersion: DEFAULT_API_VERSION,
        endpoint: `${GROWW_BASE_URL}/live-data/quote`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Groww API error',
        exchange,
        segment,
        trading_symbol,
      };
    }
  },
});

export const growwHistoricalCandleTool = tool({
  description:
    'Get historical candle (OHLCV) data from Groww Trade API over a time range. Useful for charts and trend analysis.',
  inputSchema: z.object({
    exchange: exchangeSchema.describe('Exchange code (e.g., NSE, BSE, NFO, MCX, CDS)'),
    segment: segmentSchema.describe('Market segment (CASH, FNO, COMMODITY, CURRENCY)'),
    trading_symbol: z.string().describe('Trading symbol recognized by Groww'),
    start_time: z
      .string()
      .describe('Range start time in Groww accepted format (typically epoch millis/seconds as string).'),
    end_time: z
      .string()
      .describe('Range end time in Groww accepted format (typically epoch millis/seconds as string).'),
    interval_in_minutes: z
      .number()
      .optional()
      .describe('Optional candle interval in minutes. If omitted, Groww default interval is used.'),
    accessToken: z
      .string()
      .optional()
      .describe('Optional Groww bearer token. If omitted, server uses GROWW_ACCESS_TOKEN from environment.'),
  }),
  execute: async ({
    exchange,
    segment,
    trading_symbol,
    start_time,
    end_time,
    interval_in_minutes,
    accessToken,
  }: {
    exchange: 'NSE' | 'BSE' | 'NFO' | 'MCX' | 'CDS';
    segment: 'CASH' | 'FNO' | 'COMMODITY' | 'CURRENCY';
    trading_symbol: string;
    start_time: string;
    end_time: string;
    interval_in_minutes?: number | null;
    accessToken?: string | null;
  }) => {
    const token = resolveGrowwToken(accessToken);
    if (!token) {
      return {
        success: false,
        error:
          'Missing Groww access token. Pass `accessToken` in tool input or set GROWW_ACCESS_TOKEN in server environment.',
      };
    }

    try {
      const params = new URLSearchParams({
        exchange,
        segment,
        trading_symbol,
        start_time,
        end_time,
      });
      if (interval_in_minutes) {
        params.set('interval_in_minutes', String(interval_in_minutes));
      }

      const data = await fetchGroww('/historical/candle/range', params, token);

      return {
        success: true,
        exchange,
        segment,
        trading_symbol,
        start_time,
        end_time,
        interval_in_minutes: interval_in_minutes ?? null,
        data,
        source: 'Groww Trade API',
        apiVersion: DEFAULT_API_VERSION,
        endpoint: `${GROWW_BASE_URL}/historical/candle/range`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Groww API error',
        exchange,
        segment,
        trading_symbol,
      };
    }
  },
});

export const growwPriceForecastTool = tool({
  description:
    'Generate a data-driven price projection for a stock/instrument using historical Groww candles. Returns base, bullish, and bearish scenarios for the requested horizon.',
  inputSchema: z.object({
    exchange: exchangeSchema.describe('Exchange code (e.g., NSE, BSE, NFO, MCX, CDS)'),
    segment: segmentSchema.describe('Market segment (CASH, FNO, COMMODITY, CURRENCY)'),
    trading_symbol: z.string().describe('Trading symbol recognized by Groww'),
    lookback_days: z.number().optional().describe('Historical lookback window in days (default: 365, max: 3650)'),
    horizon_days: z.number().optional().describe('Forecast horizon in days (default: 30, max: 365)'),
    interval_in_minutes: z.number().optional().describe('Candle interval in minutes. Default: 1440 (daily candles).'),
    accessToken: z
      .string()
      .optional()
      .describe('Optional Groww bearer token. If omitted, server uses GROWW_ACCESS_TOKEN from environment.'),
  }),
  execute: async ({
    exchange,
    segment,
    trading_symbol,
    lookback_days = 365,
    horizon_days = 30,
    interval_in_minutes = 1440,
    accessToken,
  }: {
    exchange: 'NSE' | 'BSE' | 'NFO' | 'MCX' | 'CDS';
    segment: 'CASH' | 'FNO' | 'COMMODITY' | 'CURRENCY';
    trading_symbol: string;
    lookback_days?: number | null;
    horizon_days?: number | null;
    interval_in_minutes?: number | null;
    accessToken?: string | null;
  }) => {
    const token = resolveGrowwToken(accessToken);
    if (!token) {
      return {
        success: false,
        error:
          'Missing Groww access token. Pass `accessToken` in tool input or set GROWW_ACCESS_TOKEN in server environment.',
      };
    }

    const safeLookback = Math.max(30, Math.min(3650, Number(lookback_days || 365)));
    const safeHorizon = Math.max(1, Math.min(365, Number(horizon_days || 30)));
    const safeInterval = Math.max(1, Number(interval_in_minutes || 1440));
    console.log('[groww_price_forecast] request params', {
      exchange,
      segment,
      trading_symbol,
      lookback_days: safeLookback,
      horizon_days: safeHorizon,
      interval_in_minutes: safeInterval,
    });

    try {
      const endMs = Date.now();
      const startMs = endMs - safeLookback * 24 * 60 * 60 * 1000;
      const params = new URLSearchParams({
        exchange,
        segment,
        trading_symbol,
        start_time: String(startMs),
        end_time: String(endMs),
        interval_in_minutes: String(safeInterval),
      });

      const raw = await fetchGroww('/historical/candle/range', params, token);
      const candles = extractCandles(raw);
      console.log('[groww_price_forecast] candles extracted', {
        trading_symbol,
        candlesAnalyzed: candles.length,
      });

      if (candles.length < 20) {
        return {
          success: false,
          error: 'Not enough historical candles returned to compute a reliable forecast (minimum 20 required).',
          exchange,
          segment,
          trading_symbol,
          candlesFound: candles.length,
        };
      }

      const closes = candles.map((c) => c.close);
      const currentPrice = closes[closes.length - 1];
      const startPrice = closes[0];

      const baseForecast = linearRegressionNext(closes, safeHorizon);
      const dailyVolatility = computeVolatility(closes);
      const horizonSigma = dailyVolatility * Math.sqrt(safeHorizon);

      const bullishForecast = Math.max(0, baseForecast * Math.exp(horizonSigma));
      const bearishForecast = Math.max(0, baseForecast * Math.exp(-horizonSigma));

      const expectedReturnPct = currentPrice > 0 ? ((baseForecast - currentPrice) / currentPrice) * 100 : 0;
      const historicalReturnPct = startPrice > 0 ? ((currentPrice - startPrice) / startPrice) * 100 : 0;

      return {
        success: true,
        exchange,
        segment,
        trading_symbol,
        lookback_days: safeLookback,
        horizon_days: safeHorizon,
        interval_in_minutes: safeInterval,
        candlesAnalyzed: candles.length,
        currentPrice,
        startPrice,
        historicalReturnPct: Number(historicalReturnPct.toFixed(2)),
        forecast: {
          method: 'linear_regression_with_volatility_bands',
          targetDate: new Date(endMs + safeHorizon * 24 * 60 * 60 * 1000).toISOString(),
          basePrice: Number(baseForecast.toFixed(2)),
          bullishPrice: Number(bullishForecast.toFixed(2)),
          bearishPrice: Number(bearishForecast.toFixed(2)),
          expectedReturnPct: Number(expectedReturnPct.toFixed(2)),
          dailyVolatility: Number(dailyVolatility.toFixed(6)),
        },
        series: candles.map((c) => ({
          timestamp: c.timestamp,
          date: new Date(c.timestamp).toISOString(),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume ?? null,
        })),
        source: 'Groww Trade API',
        apiVersion: DEFAULT_API_VERSION,
        endpoint: `${GROWW_BASE_URL}/historical/candle/range`,
        disclaimer:
          'Forecast is model-based and uncertain. For educational/informational use only, not investment advice.',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Groww API error',
        exchange,
        segment,
        trading_symbol,
      };
    }
  },
});
