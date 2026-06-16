// Client-safe shared types for the Stock Finder feature.
// The server screens/ranks stocks here; the LLM only maps intent and interprets,
// and the UI renders `StockFinderOutput` (so this file must not import server-only code).

export type Market = 'US' | 'India';

/**
 * Maps a user's intent to a Yahoo predefined screen (US) or simply scopes the
 * curated universe (India). The actual numeric filtering happens via post-filters.
 */
export type ScreenStrategy =
  | 'value_large' // undervalued large caps
  | 'value_growth' // undervalued growth stocks
  | 'growth_tech' // growth technology stocks
  | 'momentum_up' // day gainers
  | 'momentum_down' // day losers
  | 'active' // most actives
  | 'small_cap' // aggressive small caps
  | 'most_shorted'; // most shorted stocks

export type PriceVs200dma = 'above' | 'below';
export type Near52w = 'high' | 'low';

export interface ScreenCriteria {
  market: Market;
  strategy?: ScreenStrategy;
  /** USD billions for US, INR crore for India (normalized server-side). */
  minMarketCap?: number;
  maxMarketCap?: number;
  minPE?: number;
  maxPE?: number;
  minDividendYield?: number; // percent, e.g. 3 for 3%
  sector?: string;
  minRevenueGrowth?: number; // percent, e.g. 10 for 10%
  priceVs200dma?: PriceVs200dma;
  near52w?: Near52w;
  limit?: number;
}

export interface ScreenerCandidate {
  ticker: string;
  name: string;
  price: number | null;
  currency: string;
  /** Raw market cap in local currency (USD for US, INR for India). */
  marketCap: number | null;
  peTTM: number | null;
  forwardPE: number | null;
  priceToBook: number | null;
  dividendYield: number | null; // percent
  /** Percent of price relative to the 200-day moving average (positive = above). */
  pctVs200dma: number | null;
  /** Percent below the 52-week high (negative = below the high). */
  pctFrom52wHigh: number | null;
  changePct: number | null; // intraday % change
  sector: string | null;
  revenueGrowth: number | null; // percent
  /** Human-readable list of which criteria this candidate satisfied (the "why"). */
  matched: string[];
}

export interface StockFinderOutput {
  success: boolean;
  error?: string;
  market?: Market;
  strategyUsed?: ScreenStrategy;
  criteria?: ScreenCriteria;
  candidates?: ScreenerCandidate[];
  /** Number of names considered before post-filtering. */
  universeSize?: number;
  notes?: string[];
  asOf?: string;
}
