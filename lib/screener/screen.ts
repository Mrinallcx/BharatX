import 'server-only';
import YahooFinance from 'yahoo-finance2';
import { Redis } from '@upstash/redis';
import type {
  Market,
  ScreenCriteria,
  ScreenStrategy,
  ScreenerCandidate,
  StockFinderOutput,
} from './types';
import { INDIA_UNIVERSE, US_FALLBACK_UNIVERSE } from './universe';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const STRATEGY_TO_SCRID = {
  value_large: 'undervalued_large_caps',
  value_growth: 'undervalued_growth_stocks',
  growth_tech: 'growth_technology_stocks',
  momentum_up: 'day_gainers',
  momentum_down: 'day_losers',
  active: 'most_actives',
  small_cap: 'aggressive_small_caps',
  most_shorted: 'most_shorted_stocks',
} as const satisfies Record<ScreenStrategy, string>;

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;
const QUOTE_BATCH_SIZE = 25;
const ENRICH_SHORTLIST = 25;
const CACHE_TTL_SECONDS = 600;

/** Yahoo screener / quote rows expose far more fields than we read; this is the safe subset. */
interface RawQuote {
  symbol?: string;
  longName?: string;
  shortName?: string;
  displayName?: string;
  currency?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  marketCap?: number;
  trailingPE?: number;
  forwardPE?: number;
  priceToBook?: number;
  dividendYield?: number;
  trailingAnnualDividendYield?: number;
  twoHundredDayAverage?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

interface Row extends ScreenerCandidate {
  fiftyTwoWeekLow: number | null;
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

const pct = (v: number | null): number | null => (v == null ? null : v * 100);

/**
 * Yahoo's `dividendYield` (from quote/screener) is already expressed as a percentage
 * (e.g. 2.62 = 2.62%), whereas `trailingAnnualDividendYield` is a fraction (0.0262).
 * Prefer the former; fall back to scaling the latter.
 */
function normalizeDividendYield(q: RawQuote): number | null {
  const direct = num(q.dividendYield);
  if (direct != null) return direct;
  const trailing = num(q.trailingAnnualDividendYield);
  return trailing == null ? null : trailing * 100;
}

function toRow(q: RawQuote): Row | null {
  const ticker = q.symbol?.trim();
  if (!ticker) return null;

  const price = num(q.regularMarketPrice);
  const twoHundred = num(q.twoHundredDayAverage);
  const high52 = num(q.fiftyTwoWeekHigh);

  return {
    ticker,
    name: q.longName || q.displayName || q.shortName || ticker,
    price,
    currency: q.currency || 'USD',
    marketCap: num(q.marketCap),
    peTTM: num(q.trailingPE),
    forwardPE: num(q.forwardPE),
    priceToBook: num(q.priceToBook),
    dividendYield: normalizeDividendYield(q),
    pctVs200dma:
      price != null && twoHundred != null && twoHundred !== 0
        ? ((price - twoHundred) / twoHundred) * 100
        : null,
    pctFrom52wHigh:
      price != null && high52 != null && high52 !== 0 ? ((price - high52) / high52) * 100 : null,
    changePct: num(q.regularMarketChangePercent),
    sector: null,
    revenueGrowth: null,
    fiftyTwoWeekLow: num(q.fiftyTwoWeekLow),
    matched: [],
  };
}

/** Threshold scaling: criteria are USD billions (US) or INR crore (India). */
function marketCapThreshold(value: number, market: Market): number {
  return market === 'India' ? value * 1e7 : value * 1e9;
}

function capLabel(value: number, market: Market): string {
  return market === 'India' ? `₹${value} cr` : `$${value}B`;
}

/**
 * Evaluate a row against the criteria. Returns the matched-criteria labels when the row
 * qualifies, or `null` when it should be excluded. A null field that a filter needs
 * excludes the row (we cannot verify the condition).
 */
function evaluate(row: Row, criteria: ScreenCriteria): string[] | null {
  const matched: string[] = [];
  const { market } = criteria;

  if (criteria.minMarketCap != null) {
    if (row.marketCap == null || row.marketCap < marketCapThreshold(criteria.minMarketCap, market)) return null;
    matched.push(`Market cap ≥ ${capLabel(criteria.minMarketCap, market)}`);
  }
  if (criteria.maxMarketCap != null) {
    if (row.marketCap == null || row.marketCap > marketCapThreshold(criteria.maxMarketCap, market)) return null;
    matched.push(`Market cap ≤ ${capLabel(criteria.maxMarketCap, market)}`);
  }
  if (criteria.minPE != null) {
    if (row.peTTM == null || row.peTTM < criteria.minPE) return null;
    matched.push(`P/E ≥ ${criteria.minPE}`);
  }
  if (criteria.maxPE != null) {
    if (row.peTTM == null || row.peTTM > criteria.maxPE) return null;
    matched.push(`P/E ≤ ${criteria.maxPE}`);
  }
  if (criteria.minDividendYield != null) {
    if (row.dividendYield == null || row.dividendYield < criteria.minDividendYield) return null;
    matched.push(`Div yield ≥ ${criteria.minDividendYield}%`);
  }
  if (criteria.priceVs200dma != null) {
    if (row.pctVs200dma == null) return null;
    if (criteria.priceVs200dma === 'above' && row.pctVs200dma <= 0) return null;
    if (criteria.priceVs200dma === 'below' && row.pctVs200dma >= 0) return null;
    matched.push(`Price ${criteria.priceVs200dma} 200DMA`);
  }
  if (criteria.near52w != null) {
    if (criteria.near52w === 'high') {
      if (row.pctFrom52wHigh == null || row.pctFrom52wHigh < -5) return null;
      matched.push('Near 52w high');
    } else {
      if (row.price == null || row.fiftyTwoWeekLow == null || row.fiftyTwoWeekLow === 0) return null;
      const pctFromLow = ((row.price - row.fiftyTwoWeekLow) / row.fiftyTwoWeekLow) * 100;
      if (pctFromLow > 5) return null;
      matched.push('Near 52w low');
    }
  }

  return matched;
}

/** Sort the qualifying rows: most criteria matched first, then a strategy-appropriate tiebreak. */
function rankRows(rows: Row[], strategy: ScreenStrategy | undefined): Row[] {
  const byMatched = (a: Row, b: Row) => b.matched.length - a.matched.length;

  const tiebreak = (a: Row, b: Row): number => {
    switch (strategy) {
      case 'value_large':
      case 'value_growth':
        return (a.peTTM ?? Infinity) - (b.peTTM ?? Infinity); // cheapest first
      case 'momentum_up':
      case 'active':
      case 'growth_tech':
      case 'small_cap':
        return (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity); // strongest first
      case 'momentum_down':
        return (a.changePct ?? Infinity) - (b.changePct ?? Infinity); // weakest first
      default:
        return (b.marketCap ?? -Infinity) - (a.marketCap ?? -Infinity); // largest first
    }
  };

  return [...rows].sort((a, b) => byMatched(a, b) || tiebreak(a, b));
}

async function fetchUsRows(strategy: ScreenStrategy): Promise<{ rows: Row[]; universeSize: number }> {
  const scrIds = STRATEGY_TO_SCRID[strategy];
  let quotes: RawQuote[] = [];
  try {
    const result = (await yf.screener(
      { scrIds, count: 100, region: 'US', lang: 'en-US' },
      undefined,
      { validateResult: false },
    )) as { quotes?: RawQuote[] } | undefined;
    quotes = Array.isArray(result?.quotes) ? result!.quotes! : [];
  } catch (err) {
    console.warn('[stock-finder] US screener failed:', (err as Error).message);
  }

  if (quotes.length === 0) {
    return fetchQuoteRows(US_FALLBACK_UNIVERSE);
  }
  const rows = quotes.map(toRow).filter((r): r is Row => r !== null);
  return { rows, universeSize: rows.length };
}

async function fetchQuoteRows(symbols: string[]): Promise<{ rows: Row[]; universeSize: number }> {
  const rows: Row[] = [];
  for (let i = 0; i < symbols.length; i += QUOTE_BATCH_SIZE) {
    const batch = symbols.slice(i, i + QUOTE_BATCH_SIZE);
    try {
      const result = (await yf.quote(batch, {}, { validateResult: false })) as RawQuote[] | RawQuote | undefined;
      const arr = Array.isArray(result) ? result : result ? [result] : [];
      for (const q of arr) {
        const row = toRow(q);
        if (row) rows.push(row);
      }
    } catch (err) {
      console.warn('[stock-finder] quote batch failed:', (err as Error).message);
    }
  }
  return { rows, universeSize: rows.length };
}

/** Enrich the shortlist with sector + revenue growth (not present on screener/quote rows). */
async function enrichRows(rows: Row[]): Promise<void> {
  await Promise.allSettled(
    rows.map(async (row) => {
      try {
        const summary = (await yf.quoteSummary(
          row.ticker,
          { modules: ['summaryProfile', 'financialData'] },
          { validateResult: false },
        )) as
          | { summaryProfile?: { sector?: string }; financialData?: { revenueGrowth?: number } }
          | undefined;
        row.sector = summary?.summaryProfile?.sector ?? null;
        row.revenueGrowth = pct(num(summary?.financialData?.revenueGrowth));
      } catch {
        // leave sector/revenueGrowth as null
      }
    }),
  );
}

function getRedis(): Redis | null {
  try {
    return Redis.fromEnv();
  } catch {
    return null;
  }
}

function cacheKey(criteria: ScreenCriteria): string {
  return `stock-finder:${JSON.stringify(criteria)}`;
}

export async function screenStocks(input: ScreenCriteria): Promise<StockFinderOutput> {
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const market: Market = input.market === 'India' ? 'India' : 'US';
  const strategy: ScreenStrategy | undefined = input.strategy;
  const criteria: ScreenCriteria = { ...input, market, limit };

  const redis = getRedis();
  const key = cacheKey(criteria);
  if (redis) {
    try {
      const cached = await redis.get<StockFinderOutput>(key);
      if (cached) return cached;
    } catch (err) {
      console.warn('[stock-finder] cache read failed:', (err as Error).message);
    }
  }

  const notes: string[] = [];
  const wantsEnrichment = input.sector != null || input.minRevenueGrowth != null;

  let universeSize = 0;
  let rows: Row[] = [];
  try {
    if (market === 'India') {
      const fetched = await fetchQuoteRows(INDIA_UNIVERSE);
      rows = fetched.rows;
      universeSize = fetched.universeSize;
      if (strategy) notes.push('India screens the curated Nifty 100 universe; strategy is used only for ranking.');
    } else {
      const effectiveStrategy = strategy ?? 'value_large';
      const fetched = await fetchUsRows(effectiveStrategy);
      rows = fetched.rows;
      universeSize = fetched.universeSize;
      if (!strategy) notes.push('No strategy specified; defaulted to undervalued large caps.');
    }
  } catch (err) {
    console.error('[stock-finder] screening failed:', err);
    return { success: false, error: 'Failed to load market data. Please try again.' };
  }

  if (rows.length === 0) {
    return { success: false, error: 'No market data was available for this screen. Please try again.' };
  }

  // Enrich BEFORE filtering only when a sector/revenue-growth filter is requested,
  // limiting cost by ranking first and enriching the top slice.
  if (wantsEnrichment) {
    const preRanked = rankRows(rows, strategy).slice(0, ENRICH_SHORTLIST);
    await enrichRows(preRanked);
    rows = preRanked;
  }

  const qualifying: Row[] = [];
  for (const row of rows) {
    const matched = evaluate(row, criteria);
    if (matched == null) continue;

    if (input.sector != null) {
      if (!row.sector || row.sector.toLowerCase() !== input.sector.toLowerCase()) continue;
      matched.push(`Sector: ${row.sector}`);
    }
    if (input.minRevenueGrowth != null) {
      if (row.revenueGrowth == null || row.revenueGrowth < input.minRevenueGrowth) continue;
      matched.push(`Revenue growth ≥ ${input.minRevenueGrowth}%`);
    }

    row.matched = matched;
    qualifying.push(row);
  }

  const ranked = rankRows(qualifying, strategy).slice(0, limit);

  // Enrich the final shortlist for display context if we haven't already.
  if (!wantsEnrichment && ranked.length > 0) {
    await enrichRows(ranked);
  }

  const candidates: ScreenerCandidate[] = ranked.map(({ fiftyTwoWeekLow: _omit, ...rest }) => rest);

  const output: StockFinderOutput = {
    success: true,
    market,
    strategyUsed: strategy ?? (market === 'US' ? 'value_large' : undefined),
    criteria,
    candidates,
    universeSize,
    notes,
    asOf: new Date().toISOString(),
  };

  if (candidates.length === 0) {
    output.error = 'No stocks in the screened universe matched all of your criteria. Try relaxing the filters.';
  }

  if (redis) {
    try {
      await redis.set(key, output, { ex: CACHE_TTL_SECONDS });
    } catch (err) {
      console.warn('[stock-finder] cache write failed:', (err as Error).message);
    }
  }

  return output;
}
