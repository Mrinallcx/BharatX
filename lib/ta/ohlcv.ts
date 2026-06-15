import 'server-only';
import YahooFinance from 'yahoo-finance2';
import type { AssetType, Candle, Timeframe } from './types';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export interface OhlcvResult {
  candles: Candle[];
  resolvedSymbol: string;
  displaySymbol: string;
  assetType: AssetType;
  hasVolume: boolean;
  timeframe: Timeframe;
  source: 'binance' | 'yahoo' | 'coingecko';
}

/** Common coin names/aliases -> Binance base asset. */
const CRYPTO_NAME_MAP: Record<string, string> = {
  bitcoin: 'BTC',
  btc: 'BTC',
  ethereum: 'ETH',
  eth: 'ETH',
  ether: 'ETH',
  solana: 'SOL',
  sol: 'SOL',
  ripple: 'XRP',
  xrp: 'XRP',
  cardano: 'ADA',
  ada: 'ADA',
  dogecoin: 'DOGE',
  doge: 'DOGE',
  polkadot: 'DOT',
  dot: 'DOT',
  chainlink: 'LINK',
  link: 'LINK',
  litecoin: 'LTC',
  ltc: 'LTC',
  avalanche: 'AVAX',
  avax: 'AVAX',
  polygon: 'MATIC',
  matic: 'MATIC',
  'binance coin': 'BNB',
  bnb: 'BNB',
  tron: 'TRX',
  trx: 'TRX',
  shiba: 'SHIB',
  'shiba inu': 'SHIB',
  shib: 'SHIB',
};

const BINANCE_INTERVAL: Record<Timeframe, string> = {
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
  '1w': '1w',
};

/** Yahoo has no native 4h; fall back to daily for stocks. */
const YAHOO_INTERVAL: Record<Timeframe, '60m' | '1d' | '1wk'> = {
  '1h': '60m',
  '4h': '1d',
  '1d': '1d',
  '1w': '1wk',
};

export function cryptoSymbolToBinance(input: string): string {
  const cleaned = input.trim().toLowerCase();
  const mapped = CRYPTO_NAME_MAP[cleaned];
  if (mapped) return `${mapped}USDT`;

  const base = cleaned
    .replace(/[^a-z0-9]/g, '')
    .replace(/usdt$/, '')
    .replace(/usd$/, '')
    .toUpperCase();
  return `${base || 'BTC'}USDT`;
}

async function fetchCryptoOhlcv(symbol: string, timeframe: Timeframe, limit: number): Promise<OhlcvResult | null> {
  const pair = cryptoSymbolToBinance(symbol);
  const interval = BINANCE_INTERVAL[timeframe];
  const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=${interval}&limit=${Math.min(limit, 1000)}`;

  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) return null;

    const rows = (await response.json()) as unknown[];
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const candles: Candle[] = rows.map((row) => {
      const [openTime, open, high, low, close, volume] = row as [number, string, string, string, string, string];
      return {
        timestamp: openTime,
        date: new Date(openTime).toISOString(),
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
        volume: Number(volume),
      };
    });

    return {
      candles,
      resolvedSymbol: pair,
      displaySymbol: pair.replace(/USDT$/, '/USDT'),
      assetType: 'crypto',
      hasVolume: true,
      timeframe,
      source: 'binance',
    };
  } catch (error) {
    console.error('[ta/ohlcv] Binance fetch failed:', error);
    return null;
  }
}

function periodStart(timeframe: Timeframe, limit: number): Date {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  switch (timeframe) {
    case '1h':
      // Yahoo intraday history is limited; cap the look-back window.
      return new Date(now - Math.min(limit, 700) * 60 * 60 * 1000 - 5 * day);
    case '1w':
      return new Date(now - (limit + 10) * 7 * day);
    default:
      return new Date(now - (limit + 10) * day);
  }
}

async function fetchStockOhlcv(symbol: string, timeframe: Timeframe, limit: number): Promise<OhlcvResult | null> {
  const ticker = symbol.trim().toUpperCase();
  const interval = YAHOO_INTERVAL[timeframe];

  try {
    const result = await yf.chart(ticker, {
      period1: periodStart(timeframe, limit),
      interval,
    });

    const quotes = result?.quotes ?? [];
    const candles: Candle[] = quotes
      .filter((q) => q.open != null && q.high != null && q.low != null && q.close != null)
      .map((q) => {
        const timestamp = q.date instanceof Date ? q.date.getTime() : new Date(q.date as unknown as string).getTime();
        return {
          timestamp,
          date: new Date(timestamp).toISOString(),
          open: Number(q.open),
          high: Number(q.high),
          low: Number(q.low),
          close: Number(q.close),
          volume: q.volume != null ? Number(q.volume) : null,
        };
      });

    if (candles.length === 0) return null;

    const trimmed = candles.slice(-limit);
    const hasVolume = trimmed.some((c) => c.volume != null && c.volume > 0);

    return {
      candles: trimmed,
      resolvedSymbol: ticker,
      displaySymbol: ticker,
      assetType: 'stock',
      hasVolume,
      timeframe,
      source: 'yahoo',
    };
  } catch (error) {
    console.error('[ta/ohlcv] Yahoo fetch failed:', error);
    return null;
  }
}

export interface FetchOhlcvOptions {
  symbol: string;
  /** when omitted, crypto is tried first, then stock */
  assetType?: AssetType;
  timeframe: Timeframe;
  limit?: number;
}

export async function fetchOhlcv({ symbol, assetType, timeframe, limit = 300 }: FetchOhlcvOptions): Promise<OhlcvResult | null> {
  if (assetType === 'crypto') {
    return fetchCryptoOhlcv(symbol, timeframe, limit);
  }
  if (assetType === 'stock') {
    return fetchStockOhlcv(symbol, timeframe, limit);
  }

  // Unknown: prefer crypto for short tickers commonly traded on Binance, else try both.
  const crypto = await fetchCryptoOhlcv(symbol, timeframe, limit);
  if (crypto && crypto.candles.length >= 20) return crypto;

  const stock = await fetchStockOhlcv(symbol, timeframe, limit);
  if (stock && stock.candles.length >= 20) return stock;

  return crypto ?? stock;
}
