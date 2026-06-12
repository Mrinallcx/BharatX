import YahooFinance from 'yahoo-finance2';

type InstrumentSource = 'yahoo' | 'binance';

type InstrumentSpec = {
  id: string;
  label: string;
  symbol: string;
  source: InstrumentSource;
  currency?: string;
};

type TickerRow = {
  id: string;
  label: string;
  symbol: string;
  price: number;
  changePct: number;
  source: InstrumentSource;
  delayed?: boolean;
  asOf: string;
};

type RawTickerRow = TickerRow & { currency?: string };

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

/** Yahoo `INR=X` / `JPY=X` = units of local currency per 1 USD */
async function fetchUsdPerLocalCurrency(symbol: 'INR=X' | 'JPY=X'): Promise<number | null> {
  try {
    const quote = await yf.quote(symbol);
    const rate = Number(quote.regularMarketPrice);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

function toUsd(price: number, currency: string | undefined, fx: { inrPerUsd: number | null; jpyPerUsd: number | null }): number {
  if (!Number.isFinite(price)) return price;
  if (!currency || currency === 'USD') return price;
  if (currency === 'INR' && fx.inrPerUsd) return price / fx.inrPerUsd;
  if (currency === 'JPY' && fx.jpyPerUsd) return price / fx.jpyPerUsd;
  return price;
}

const DEFAULT_INSTRUMENTS: InstrumentSpec[] = [
  // India
  { id: 'nse-reliance', label: 'RELIANCE', symbol: 'RELIANCE.NS', source: 'yahoo', currency: 'INR' },
  { id: 'nse-tcs', label: 'TCS', symbol: 'TCS.NS', source: 'yahoo', currency: 'INR' },
  { id: 'nse-hdfcbank', label: 'HDFCBANK', symbol: 'HDFCBANK.NS', source: 'yahoo', currency: 'INR' },
  // US and global
  { id: 'us-aapl', label: 'AAPL', symbol: 'AAPL', source: 'yahoo', currency: 'USD' },
  { id: 'us-nvda', label: 'NVDA', symbol: 'NVDA', source: 'yahoo', currency: 'USD' },
  { id: 'jp-sony', label: 'SONY', symbol: '6758.T', source: 'yahoo', currency: 'JPY' },
  // Crypto
  { id: 'cr-btc', label: 'BTC', symbol: 'BTCUSDT', source: 'binance', currency: 'USD' },
  { id: 'cr-eth', label: 'ETH', symbol: 'ETHUSDT', source: 'binance', currency: 'USD' },
  { id: 'cr-sol', label: 'SOL', symbol: 'SOLUSDT', source: 'binance', currency: 'USD' },
];

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

async function fetchYahooTicker(spec: InstrumentSpec): Promise<RawTickerRow | null> {
  try {
    const quote = await yf.quote(spec.symbol);
    const price = Number(quote.regularMarketPrice ?? quote.postMarketPrice ?? quote.preMarketPrice);
    const changePct = Number(quote.regularMarketChangePercent ?? 0);
    const marketTime =
      (isFiniteNumber(quote.regularMarketTime) ? quote.regularMarketTime : null) ??
      (isFiniteNumber(quote.postMarketTime) ? quote.postMarketTime : null) ??
      (isFiniteNumber(quote.preMarketTime) ? quote.preMarketTime : null);
    const asOf = marketTime ? new Date(marketTime * 1000).toISOString() : new Date().toISOString();

    if (!Number.isFinite(price)) return null;

    return {
      id: spec.id,
      label: spec.label,
      symbol: spec.symbol,
      price,
      changePct,
      currency: spec.currency,
      source: 'yahoo',
      delayed: quote.marketState === 'CLOSED' || quote.marketState === 'POST' || quote.marketState === 'PRE',
      asOf,
    };
  } catch {
    return null;
  }
}

async function fetchBinanceTicker(spec: InstrumentSpec): Promise<RawTickerRow | null> {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(spec.symbol)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return null;

    const data = (await response.json()) as { lastPrice?: string; priceChangePercent?: string; closeTime?: number };
    const price = Number(data.lastPrice);
    const changePct = Number(data.priceChangePercent ?? 0);
    if (!Number.isFinite(price)) return null;

    return {
      id: spec.id,
      label: spec.label,
      symbol: spec.symbol,
      price,
      changePct,
      currency: 'USD',
      source: 'binance',
      delayed: false,
      asOf: data.closeTime ? new Date(data.closeTime).toISOString() : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function loadOneTicker(spec: InstrumentSpec): Promise<RawTickerRow | null> {
  return spec.source === 'yahoo' ? fetchYahooTicker(spec) : fetchBinanceTicker(spec);
}

function normalizeToUsd(row: RawTickerRow, fx: { inrPerUsd: number | null; jpyPerUsd: number | null }): TickerRow {
  const { currency, ...rest } = row;
  return {
    ...rest,
    price: toUsd(row.price, currency, fx),
  };
}

export async function GET() {
  const [inrPerUsd, jpyPerUsd, settled] = await Promise.all([
    fetchUsdPerLocalCurrency('INR=X'),
    fetchUsdPerLocalCurrency('JPY=X'),
    Promise.allSettled(DEFAULT_INSTRUMENTS.map((instrument) => loadOneTicker(instrument))),
  ]);

  const fx = { inrPerUsd, jpyPerUsd };
  const items = settled
    .filter((entry): entry is PromiseFulfilledResult<RawTickerRow | null> => entry.status === 'fulfilled')
    .map((entry) => entry.value)
    .filter((item): item is RawTickerRow => item !== null)
    .map((item) => normalizeToUsd(item, fx));

  return Response.json(
    {
      success: true,
      updatedAt: new Date().toISOString(),
      items,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20',
      },
    },
  );
}
