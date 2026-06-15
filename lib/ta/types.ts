// Shared types for the Technical Analysis feature.
// The server fetches OHLCV, computes indicators here, and the LLM only interprets.

export type AssetType = 'stock' | 'crypto';

export type Timeframe = '1h' | '4h' | '1d' | '1w';

export interface Candle {
  /** epoch milliseconds */
  timestamp: number;
  /** ISO date string */
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** null when the data source does not provide per-bar volume */
  volume: number | null;
}

export type IndicatorDataNeed = 'price' | 'volume' | 'market';
export type IndicatorPhase = 1 | 2 | 3;
export type IndicatorCategory = 'trend' | 'momentum' | 'volatility' | 'volume' | 'support_resistance' | 'market';
export type OverlayKind = 'price' | 'pane';
export type SignalBias = 'bullish' | 'bearish' | 'neutral';

/** A single plottable series aligned 1:1 to the candle array (leading nulls for warm-up). */
export interface IndicatorLine {
  key: string;
  label: string;
  values: (number | null)[];
}

/** A horizontal reference level (pivots, fib retracements, etc.). */
export interface IndicatorLevel {
  label: string;
  value: number;
}

export interface IndicatorResult {
  id: string;
  label: string;
  category: IndicatorCategory;
  /** 'price' = draw on the candlestick pane, 'pane' = separate sub-chart */
  overlay: OverlayKind;
  lines: IndicatorLine[];
  /** latest numeric readings keyed by line/value name */
  latest: Record<string, number | null>;
  /** human-readable interpretation, e.g. "RSI 72 - overbought" */
  signal: string | null;
  bias: SignalBias;
  /** horizontal reference levels for price-overlay structure indicators */
  levels?: IndicatorLevel[];
  note?: string;
}

/** Optional market context passed to Phase 3 (market breadth/macro) indicators. */
export interface MarketContext {
  /** S&P 500 (^GSPC) daily candles, most recent last */
  spx?: Candle[];
  /** CBOE VIX (^VIX) daily candles, most recent last */
  vix?: Candle[];
}

export interface ComputeContext {
  assetType: AssetType;
  timeframe: Timeframe;
  market?: MarketContext;
}

export interface SkippedIndicator {
  id: string;
  label: string;
  reason: string;
}

/** Shape returned by the technical_analysis tool (client-safe, no server imports). */
export interface TechnicalAnalysisOutput {
  success: boolean;
  error?: string;
  symbol?: string;
  displaySymbol?: string;
  assetType?: AssetType;
  timeframe?: Timeframe;
  source?: string;
  hasVolume?: boolean;
  candles?: Candle[];
  indicators?: IndicatorResult[];
  skipped?: SkippedIndicator[];
  marketContextAvailable?: boolean;
  asOf?: string;
  requestedIndicators?: string[];
}
