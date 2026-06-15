// Client-safe indicator metadata (NO compute logic / no `technicalindicators` import).
// Safe to import into the browser bundle for the slash menu.
import type { IndicatorCategory, IndicatorDataNeed, IndicatorPhase, OverlayKind } from './types';

export interface IndicatorParamSpec {
  key: string;
  label: string;
  default: number;
}

export interface IndicatorDefMeta {
  id: string;
  /** slash trigger label, e.g. "RSI" */
  label: string;
  short: string;
  phase: IndicatorPhase;
  category: IndicatorCategory;
  needs: IndicatorDataNeed;
  overlay: OverlayKind;
  description: string;
  params?: IndicatorParamSpec[];
}

const P = (key: string, label: string, def: number): IndicatorParamSpec => ({ key, label, default: def });

export const MAX_INDICATORS = 5;

export const INDICATOR_DEFS: IndicatorDefMeta[] = [
  // --- Phase 1: trend (price only) ---
  { id: 'sma', label: 'SMA', short: 'Simple Moving Average', phase: 1, category: 'trend', needs: 'price', overlay: 'price', description: 'Average price over N periods.', params: [P('period', 'Period', 20)] },
  { id: 'ema', label: 'EMA', short: 'Exponential Moving Average', phase: 1, category: 'trend', needs: 'price', overlay: 'price', description: 'Weighted average favoring recent prices.', params: [P('period', 'Period', 20)] },
  { id: 'wma', label: 'WMA', short: 'Weighted Moving Average', phase: 1, category: 'trend', needs: 'price', overlay: 'price', description: 'Linearly weighted moving average.', params: [P('period', 'Period', 20)] },
  { id: 'macd', label: 'MACD', short: 'Moving Avg Convergence Divergence', phase: 1, category: 'momentum', needs: 'price', overlay: 'pane', description: 'Trend/momentum via EMA crossovers.', params: [P('fast', 'Fast', 12), P('slow', 'Slow', 26), P('signal', 'Signal', 9)] },
  { id: 'adx', label: 'ADX', short: 'Average Directional Index / DMI', phase: 1, category: 'trend', needs: 'price', overlay: 'pane', description: 'Trend strength with +DI / -DI.', params: [P('period', 'Period', 14)] },
  { id: 'psar', label: 'PSAR', short: 'Parabolic SAR', phase: 1, category: 'trend', needs: 'price', overlay: 'price', description: 'Trailing stop-and-reverse dots.', params: [P('step', 'Step %', 2), P('max', 'Max %', 20)] },
  { id: 'supertrend', label: 'SuperTrend', short: 'SuperTrend', phase: 1, category: 'trend', needs: 'price', overlay: 'price', description: 'ATR-based trend following line.', params: [P('period', 'ATR Period', 10), P('multiplier', 'Multiplier', 3)] },
  { id: 'aroon', label: 'Aroon', short: 'Aroon Up/Down', phase: 1, category: 'trend', needs: 'price', overlay: 'pane', description: 'Time since recent highs/lows.', params: [P('period', 'Period', 25)] },
  { id: 'ichimoku', label: 'Ichimoku', short: 'Ichimoku Cloud', phase: 1, category: 'trend', needs: 'price', overlay: 'price', description: 'Multi-line trend & support/resistance cloud.' },
  { id: 'trix', label: 'TRIX', short: 'Triple EMA Oscillator', phase: 1, category: 'momentum', needs: 'price', overlay: 'pane', description: 'Rate of change of triple-smoothed EMA.', params: [P('period', 'Period', 15)] },

  // --- Phase 1: momentum ---
  { id: 'rsi', label: 'RSI', short: 'Relative Strength Index', phase: 1, category: 'momentum', needs: 'price', overlay: 'pane', description: 'Overbought/oversold momentum (0-100).', params: [P('period', 'Period', 14)] },
  { id: 'stoch', label: 'Stochastic', short: 'Stochastic Oscillator', phase: 1, category: 'momentum', needs: 'price', overlay: 'pane', description: '%K / %D momentum oscillator.', params: [P('period', 'Period', 14), P('signal', 'Signal', 3)] },
  { id: 'stochrsi', label: 'StochRSI', short: 'Stochastic RSI', phase: 1, category: 'momentum', needs: 'price', overlay: 'pane', description: 'Stochastic applied to RSI.', params: [P('period', 'Period', 14)] },
  { id: 'williamsr', label: 'Williams %R', short: 'Williams Percent Range', phase: 1, category: 'momentum', needs: 'price', overlay: 'pane', description: 'Overbought/oversold (-100 to 0).', params: [P('period', 'Period', 14)] },
  { id: 'cci', label: 'CCI', short: 'Commodity Channel Index', phase: 1, category: 'momentum', needs: 'price', overlay: 'pane', description: 'Deviation from average price.', params: [P('period', 'Period', 20)] },
  { id: 'roc', label: 'ROC', short: 'Rate of Change', phase: 1, category: 'momentum', needs: 'price', overlay: 'pane', description: 'Percent price change over N periods.', params: [P('period', 'Period', 12)] },
  { id: 'mom', label: 'Momentum', short: 'Momentum (MOM)', phase: 1, category: 'momentum', needs: 'price', overlay: 'pane', description: 'Absolute price change over N periods.', params: [P('period', 'Period', 10)] },

  // --- Phase 1: volatility ---
  { id: 'bbands', label: 'Bollinger Bands', short: 'Bollinger Bands (+%B, bandwidth)', phase: 1, category: 'volatility', needs: 'price', overlay: 'price', description: 'Volatility bands around an SMA.', params: [P('period', 'Period', 20), P('stdDev', 'Std Dev', 2)] },
  { id: 'atr', label: 'ATR', short: 'Average True Range', phase: 1, category: 'volatility', needs: 'price', overlay: 'pane', description: 'Average volatility magnitude.', params: [P('period', 'Period', 14)] },
  { id: 'keltner', label: 'Keltner', short: 'Keltner Channels', phase: 1, category: 'volatility', needs: 'price', overlay: 'price', description: 'EMA-centered ATR channels.', params: [P('period', 'EMA Period', 20), P('multiplier', 'Multiplier', 2)] },
  { id: 'donchian', label: 'Donchian', short: 'Donchian Channels', phase: 1, category: 'volatility', needs: 'price', overlay: 'price', description: 'Highest high / lowest low channel.', params: [P('period', 'Period', 20)] },

  // --- Phase 1: support / resistance ---
  { id: 'pivots', label: 'Pivot Points', short: 'Standard Pivot Points', phase: 1, category: 'support_resistance', needs: 'price', overlay: 'price', description: 'Pivot with R1-R3 / S1-S3 levels.' },
  { id: 'fib', label: 'Fibonacci', short: 'Fibonacci Retracement', phase: 1, category: 'support_resistance', needs: 'price', overlay: 'price', description: 'Retracement levels from latest swing.', params: [P('period', 'Lookback', 120)] },

  // --- Phase 2: volume ---
  { id: 'obv', label: 'OBV', short: 'On-Balance Volume', phase: 2, category: 'volume', needs: 'volume', overlay: 'pane', description: 'Cumulative volume by price direction.' },
  { id: 'adl', label: 'A/D Line', short: 'Accumulation/Distribution', phase: 2, category: 'volume', needs: 'volume', overlay: 'pane', description: 'Money flow accumulation gauge.' },
  { id: 'cmf', label: 'CMF', short: 'Chaikin Money Flow', phase: 2, category: 'volume', needs: 'volume', overlay: 'pane', description: 'Buying vs selling pressure.', params: [P('period', 'Period', 20)] },
  { id: 'chaikinosc', label: 'Chaikin Osc', short: 'Chaikin Oscillator', phase: 2, category: 'volume', needs: 'volume', overlay: 'pane', description: 'Momentum of the A/D line.' },
  { id: 'vwap', label: 'VWAP', short: 'Volume Weighted Average Price', phase: 2, category: 'volume', needs: 'volume', overlay: 'price', description: 'Average price weighted by volume.' },
  { id: 'mfi', label: 'MFI', short: 'Money Flow Index', phase: 2, category: 'volume', needs: 'volume', overlay: 'pane', description: 'Volume-weighted RSI (0-100).', params: [P('period', 'Period', 14)] },
  { id: 'forceindex', label: 'Force Index', short: 'Force Index (Elder)', phase: 2, category: 'volume', needs: 'volume', overlay: 'pane', description: 'Price change x volume.', params: [P('period', 'Period', 13)] },
  { id: 'eom', label: 'EOM', short: 'Ease of Movement', phase: 2, category: 'volume', needs: 'volume', overlay: 'pane', description: 'Price movement relative to volume.', params: [P('period', 'Period', 14)] },
  { id: 'pvt', label: 'PVT', short: 'Price Volume Trend', phase: 2, category: 'volume', needs: 'volume', overlay: 'pane', description: 'Cumulative volume x % change.' },
  { id: 'vwma', label: 'VWMA', short: 'Volume Weighted Moving Average', phase: 2, category: 'volume', needs: 'volume', overlay: 'price', description: 'Moving average weighted by volume.', params: [P('period', 'Period', 20)] },
  { id: 'volosc', label: 'Volume Osc', short: 'Volume Oscillator', phase: 2, category: 'volume', needs: 'volume', overlay: 'pane', description: 'Short vs long volume EMA spread.', params: [P('short', 'Short', 5), P('long', 'Long', 20)] },

  // --- Phase 3: market / macro (stock-focused) ---
  { id: 'vix', label: 'VIX', short: 'Volatility Index', phase: 3, category: 'market', needs: 'market', overlay: 'pane', description: 'Market fear gauge (CBOE VIX).' },
  { id: 'spx_trend', label: 'S&P 500 Trend', short: 'S&P 500 Market Trend', phase: 3, category: 'market', needs: 'market', overlay: 'pane', description: '50DMA vs 200DMA market regime.' },
  { id: 'beta', label: 'Beta', short: 'Beta vs S&P 500', phase: 3, category: 'market', needs: 'market', overlay: 'pane', description: 'Volatility relative to the market.' },
  { id: 'rel_strength', label: 'Rel Strength', short: 'Relative Strength vs S&P 500', phase: 3, category: 'market', needs: 'market', overlay: 'pane', description: 'Out/under-performance vs market.' },
  { id: 'correlation', label: 'Correlation', short: 'Correlation vs S&P 500', phase: 3, category: 'market', needs: 'market', overlay: 'pane', description: 'Rolling correlation with the market.', params: [P('period', 'Window', 30)] },
];

export const INDICATOR_DEF_MAP: Record<string, IndicatorDefMeta> = Object.fromEntries(INDICATOR_DEFS.map((d) => [d.id, d]));

export const CATEGORY_LABELS: Record<IndicatorCategory, string> = {
  trend: 'Trend',
  momentum: 'Momentum / Oscillators',
  volatility: 'Volatility',
  volume: 'Volume',
  support_resistance: 'Support / Resistance',
  market: 'Market / Macro',
};

export const CATEGORY_ORDER: IndicatorCategory[] = ['trend', 'momentum', 'volatility', 'support_resistance', 'volume', 'market'];

export function getIndicatorMeta(id: string): IndicatorDefMeta | undefined {
  return INDICATOR_DEF_MAP[id];
}
