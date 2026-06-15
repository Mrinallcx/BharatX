import {
  SMA,
  EMA,
  WMA,
  MACD,
  RSI,
  Stochastic,
  StochasticRSI,
  WilliamsR,
  CCI,
  ROC,
  BollingerBands,
  ATR,
  ADX,
  PSAR,
  TRIX,
  KeltnerChannels,
  OBV,
  ADL,
  MFI,
  VWAP,
  ForceIndex,
} from 'technicalindicators';
import type { Candle, ComputeContext, IndicatorLine, IndicatorResult, SignalBias } from './types';

export type ComputeFn = (candles: Candle[], params: Record<string, number>, ctx: ComputeContext) => IndicatorResult;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const closes = (c: Candle[]) => c.map((x) => x.close);
const highs = (c: Candle[]) => c.map((x) => x.high);
const lows = (c: Candle[]) => c.map((x) => x.low);
const vols = (c: Candle[]) => c.map((x) => x.volume ?? 0);

function round(v: number | null | undefined, d = 2): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

/** Pad a (shorter) indicator output with leading nulls so it aligns 1:1 with candles. */
function alignRight<T>(values: T[], n: number): (T | null)[] {
  if (values.length >= n) return values.slice(values.length - n);
  return [...new Array<T | null>(n - values.length).fill(null), ...values];
}

function lastDefined<T>(values: (T | null)[]): T | null {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] != null) return values[i] as T;
  }
  return null;
}

function line(key: string, label: string, values: (number | null)[]): IndicatorLine {
  return { key, label, values };
}

/** Wilder-smoothed ATR aligned to the candle array (leading nulls during warm-up). */
function atrSeries(candles: Candle[], period: number): (number | null)[] {
  const n = candles.length;
  const tr: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      tr[i] = candles[i].high - candles[i].low;
    } else {
      const h = candles[i].high;
      const l = candles[i].low;
      const pc = candles[i - 1].close;
      tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    }
  }
  const out: (number | null)[] = new Array(n).fill(null);
  if (n < period) return out;
  let atr = tr.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  out[period] = atr;
  for (let i = period + 1; i < n; i++) {
    atr = (atr * (period - 1) + tr[i]) / period;
    out[i] = atr;
  }
  return out;
}

function smaArray(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

// ---------------------------------------------------------------------------
// trend
// ---------------------------------------------------------------------------

function movingAverage(
  id: string,
  label: string,
  kind: 'sma' | 'ema' | 'wma',
): ComputeFn {
  return (candles, params) => {
    const period = params.period || 20;
    const values = closes(candles);
    const calc = kind === 'sma' ? SMA : kind === 'ema' ? EMA : WMA;
    const raw = calc.calculate({ period, values });
    const aligned = alignRight(raw, candles.length);
    const latest = lastDefined(aligned);
    const price = candles[candles.length - 1].close;
    const bias: SignalBias = latest == null ? 'neutral' : price > latest ? 'bullish' : 'bearish';
    return {
      id,
      label: `${label} (${period})`,
      category: 'trend',
      overlay: 'price',
      lines: [line(id, `${label}${period}`, aligned)],
      latest: { value: round(latest) },
      signal: latest == null ? null : `Price ${price > latest ? 'above' : 'below'} ${label}${period} (${round(latest)})`,
      bias,
    };
  };
}

const computeMacd: ComputeFn = (candles, params) => {
  const fast = params.fast || 12;
  const slow = params.slow || 26;
  const signal = params.signal || 9;
  const raw = MACD.calculate({
    values: closes(candles),
    fastPeriod: fast,
    slowPeriod: slow,
    signalPeriod: signal,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const macdLine = alignRight(raw.map((r) => r.MACD ?? null), candles.length);
  const signalLine = alignRight(raw.map((r) => r.signal ?? null), candles.length);
  const histLine = alignRight(raw.map((r) => r.histogram ?? null), candles.length);
  const m = lastDefined(macdLine);
  const s = lastDefined(signalLine);
  const h = lastDefined(histLine);
  const bias: SignalBias = m == null || s == null ? 'neutral' : m > s ? 'bullish' : 'bearish';
  return {
    id: 'macd',
    label: 'MACD',
    category: 'momentum',
    overlay: 'pane',
    lines: [line('macd', 'MACD', macdLine), line('signal', 'Signal', signalLine), line('hist', 'Histogram', histLine)],
    latest: { macd: round(m, 4), signal: round(s, 4), histogram: round(h, 4) },
    signal:
      m == null || s == null
        ? null
        : `MACD ${round(m, 4)} ${m > s ? 'above' : 'below'} signal ${round(s, 4)} - ${bias} momentum`,
    bias,
  };
};

const computeAdx: ComputeFn = (candles, params) => {
  const period = params.period || 14;
  const raw = ADX.calculate({ high: highs(candles), low: lows(candles), close: closes(candles), period });
  const adx = alignRight(raw.map((r) => r.adx ?? null), candles.length);
  const pdi = alignRight(raw.map((r) => r.pdi ?? null), candles.length);
  const mdi = alignRight(raw.map((r) => r.mdi ?? null), candles.length);
  const a = lastDefined(adx);
  const p = lastDefined(pdi);
  const m = lastDefined(mdi);
  const strong = a != null && a >= 25;
  const bias: SignalBias = p == null || m == null ? 'neutral' : !strong ? 'neutral' : p > m ? 'bullish' : 'bearish';
  return {
    id: 'adx',
    label: 'ADX / DMI',
    category: 'trend',
    overlay: 'pane',
    lines: [line('adx', 'ADX', adx), line('pdi', '+DI', pdi), line('mdi', '-DI', mdi)],
    latest: { adx: round(a), pdi: round(p), mdi: round(m) },
    signal: a == null ? null : `ADX ${round(a)} (${strong ? 'trending' : 'weak/ranging'}), ${p! > m! ? '+DI > -DI' : '-DI > +DI'}`,
    bias,
  };
};

const computePsar: ComputeFn = (candles, params) => {
  const step = params.step ? params.step / 100 : 0.02;
  const max = params.max ? params.max / 100 : 0.2;
  const raw = PSAR.calculate({ high: highs(candles), low: lows(candles), step, max });
  const aligned = alignRight(raw, candles.length);
  const sar = lastDefined(aligned);
  const price = candles[candles.length - 1].close;
  const bias: SignalBias = sar == null ? 'neutral' : price > sar ? 'bullish' : 'bearish';
  return {
    id: 'psar',
    label: 'Parabolic SAR',
    category: 'trend',
    overlay: 'price',
    lines: [line('psar', 'PSAR', aligned)],
    latest: { value: round(sar) },
    signal: sar == null ? null : `SAR ${round(sar)} ${price > sar ? 'below price (uptrend)' : 'above price (downtrend)'}`,
    bias,
  };
};

const computeSupertrend: ComputeFn = (candles, params) => {
  const period = params.period || 10;
  const mult = params.multiplier || 3;
  const atr = atrSeries(candles, period);
  const n = candles.length;
  const st: (number | null)[] = new Array(n).fill(null);
  const dir: (number | null)[] = new Array(n).fill(null);
  let finalUpper = 0;
  let finalLower = 0;
  let trendUp = true;
  for (let i = 0; i < n; i++) {
    const a = atr[i];
    if (a == null) continue;
    const hl2 = (candles[i].high + candles[i].low) / 2;
    const basicUpper = hl2 + mult * a;
    const basicLower = hl2 - mult * a;
    const prevClose = candles[i - 1]?.close ?? candles[i].close;
    finalUpper = basicUpper < finalUpper || prevClose > finalUpper || finalUpper === 0 ? basicUpper : finalUpper;
    finalLower = basicLower > finalLower || prevClose < finalLower || finalLower === 0 ? basicLower : finalLower;
    const close = candles[i].close;
    if (trendUp) {
      if (close < finalLower) trendUp = false;
    } else if (close > finalUpper) {
      trendUp = true;
    }
    st[i] = trendUp ? finalLower : finalUpper;
    dir[i] = trendUp ? 1 : -1;
  }
  const value = lastDefined(st);
  const d = lastDefined(dir);
  const bias: SignalBias = d == null ? 'neutral' : d > 0 ? 'bullish' : 'bearish';
  return {
    id: 'supertrend',
    label: 'SuperTrend',
    category: 'trend',
    overlay: 'price',
    lines: [line('supertrend', 'SuperTrend', st)],
    latest: { value: round(value), direction: d },
    signal: value == null ? null : `SuperTrend ${round(value)} - ${d! > 0 ? 'bullish (support)' : 'bearish (resistance)'}`,
    bias,
  };
};

const computeAroon: ComputeFn = (candles, params) => {
  const period = params.period || 25;
  const n = candles.length;
  const up: (number | null)[] = new Array(n).fill(null);
  const down: (number | null)[] = new Array(n).fill(null);
  for (let i = period; i < n; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    let hhIdx = i;
    let llIdx = i;
    for (let j = i - period; j <= i; j++) {
      if (candles[j].high >= hh) {
        hh = candles[j].high;
        hhIdx = j;
      }
      if (candles[j].low <= ll) {
        ll = candles[j].low;
        llIdx = j;
      }
    }
    up[i] = ((period - (i - hhIdx)) / period) * 100;
    down[i] = ((period - (i - llIdx)) / period) * 100;
  }
  const u = lastDefined(up);
  const dn = lastDefined(down);
  const bias: SignalBias = u == null || dn == null ? 'neutral' : u > dn ? 'bullish' : 'bearish';
  return {
    id: 'aroon',
    label: 'Aroon',
    category: 'trend',
    overlay: 'pane',
    lines: [line('up', 'Aroon Up', up), line('down', 'Aroon Down', down)],
    latest: { up: round(u), down: round(dn) },
    signal: u == null ? null : `Aroon Up ${round(u)} / Down ${round(dn)} - ${bias}`,
    bias,
  };
};

const computeIchimoku: ComputeFn = (candles) => {
  const conv = 9;
  const base = 26;
  const span = 52;
  const n = candles.length;
  const donchian = (idx: number, p: number): number | null => {
    if (idx < p - 1) return null;
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = idx - p + 1; j <= idx; j++) {
      hh = Math.max(hh, candles[j].high);
      ll = Math.min(ll, candles[j].low);
    }
    return (hh + ll) / 2;
  };
  const conversion: (number | null)[] = new Array(n).fill(null);
  const baseLine: (number | null)[] = new Array(n).fill(null);
  const spanA: (number | null)[] = new Array(n).fill(null);
  const spanB: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    conversion[i] = donchian(i, conv);
    baseLine[i] = donchian(i, base);
    const c = conversion[i];
    const b = baseLine[i];
    spanA[i] = c != null && b != null ? (c + b) / 2 : null;
    spanB[i] = donchian(i, span);
  }
  const price = candles[n - 1].close;
  const a = lastDefined(spanA);
  const bb = lastDefined(spanB);
  const cloudTop = a != null && bb != null ? Math.max(a, bb) : null;
  const cloudBottom = a != null && bb != null ? Math.min(a, bb) : null;
  const bias: SignalBias =
    cloudTop == null ? 'neutral' : price > cloudTop ? 'bullish' : cloudBottom != null && price < cloudBottom ? 'bearish' : 'neutral';
  return {
    id: 'ichimoku',
    label: 'Ichimoku Cloud',
    category: 'trend',
    overlay: 'price',
    lines: [
      line('conversion', 'Conversion', conversion),
      line('base', 'Base', baseLine),
      line('spanA', 'Span A', spanA),
      line('spanB', 'Span B', spanB),
    ],
    latest: { conversion: round(lastDefined(conversion)), base: round(lastDefined(baseLine)), spanA: round(a), spanB: round(bb) },
    signal: cloudTop == null ? null : `Price ${bias === 'bullish' ? 'above' : bias === 'bearish' ? 'below' : 'inside'} the cloud`,
    bias,
  };
};

const computeTrix: ComputeFn = (candles, params) => {
  const period = params.period || 15;
  const raw = TRIX.calculate({ values: closes(candles), period });
  const aligned = alignRight(raw, candles.length);
  const v = lastDefined(aligned);
  const bias: SignalBias = v == null ? 'neutral' : v > 0 ? 'bullish' : 'bearish';
  return {
    id: 'trix',
    label: 'TRIX',
    category: 'momentum',
    overlay: 'pane',
    lines: [line('trix', 'TRIX', aligned)],
    latest: { value: round(v, 4) },
    signal: v == null ? null : `TRIX ${round(v, 4)} - ${v > 0 ? 'positive (bullish)' : 'negative (bearish)'}`,
    bias,
  };
};

// ---------------------------------------------------------------------------
// momentum / oscillators
// ---------------------------------------------------------------------------

const computeRsi: ComputeFn = (candles, params) => {
  const period = params.period || 14;
  const raw = RSI.calculate({ values: closes(candles), period });
  const aligned = alignRight(raw, candles.length);
  const v = lastDefined(aligned);
  const bias: SignalBias = v == null ? 'neutral' : v >= 70 ? 'bearish' : v <= 30 ? 'bullish' : 'neutral';
  const state = v == null ? '' : v >= 70 ? 'overbought' : v <= 30 ? 'oversold' : 'neutral';
  return {
    id: 'rsi',
    label: `RSI (${period})`,
    category: 'momentum',
    overlay: 'pane',
    lines: [line('rsi', 'RSI', aligned)],
    latest: { value: round(v) },
    signal: v == null ? null : `RSI ${round(v)} - ${state}`,
    bias,
  };
};

const computeStoch: ComputeFn = (candles, params) => {
  const period = params.period || 14;
  const signalPeriod = params.signal || 3;
  const raw = Stochastic.calculate({ high: highs(candles), low: lows(candles), close: closes(candles), period, signalPeriod });
  const k = alignRight(raw.map((r) => r.k ?? null), candles.length);
  const d = alignRight(raw.map((r) => r.d ?? null), candles.length);
  const kv = lastDefined(k);
  const dv = lastDefined(d);
  const bias: SignalBias = kv == null ? 'neutral' : kv >= 80 ? 'bearish' : kv <= 20 ? 'bullish' : 'neutral';
  return {
    id: 'stoch',
    label: 'Stochastic',
    category: 'momentum',
    overlay: 'pane',
    lines: [line('k', '%K', k), line('d', '%D', d)],
    latest: { k: round(kv), d: round(dv) },
    signal: kv == null ? null : `%K ${round(kv)} / %D ${round(dv)} - ${kv >= 80 ? 'overbought' : kv <= 20 ? 'oversold' : 'neutral'}`,
    bias,
  };
};

const computeStochRsi: ComputeFn = (candles, params) => {
  const period = params.period || 14;
  const raw = StochasticRSI.calculate({
    values: closes(candles),
    rsiPeriod: period,
    stochasticPeriod: period,
    kPeriod: 3,
    dPeriod: 3,
  });
  const k = alignRight(raw.map((r) => r.k ?? null), candles.length);
  const d = alignRight(raw.map((r) => r.d ?? null), candles.length);
  const kv = lastDefined(k);
  const dv = lastDefined(d);
  const bias: SignalBias = kv == null ? 'neutral' : kv >= 80 ? 'bearish' : kv <= 20 ? 'bullish' : 'neutral';
  return {
    id: 'stochrsi',
    label: 'Stochastic RSI',
    category: 'momentum',
    overlay: 'pane',
    lines: [line('k', '%K', k), line('d', '%D', d)],
    latest: { k: round(kv), d: round(dv) },
    signal: kv == null ? null : `StochRSI %K ${round(kv)} - ${kv >= 80 ? 'overbought' : kv <= 20 ? 'oversold' : 'neutral'}`,
    bias,
  };
};

const computeWilliamsR: ComputeFn = (candles, params) => {
  const period = params.period || 14;
  const raw = WilliamsR.calculate({ high: highs(candles), low: lows(candles), close: closes(candles), period });
  const aligned = alignRight(raw, candles.length);
  const v = lastDefined(aligned);
  const bias: SignalBias = v == null ? 'neutral' : v >= -20 ? 'bearish' : v <= -80 ? 'bullish' : 'neutral';
  return {
    id: 'williamsr',
    label: 'Williams %R',
    category: 'momentum',
    overlay: 'pane',
    lines: [line('williamsr', '%R', aligned)],
    latest: { value: round(v) },
    signal: v == null ? null : `%R ${round(v)} - ${v >= -20 ? 'overbought' : v <= -80 ? 'oversold' : 'neutral'}`,
    bias,
  };
};

const computeCci: ComputeFn = (candles, params) => {
  const period = params.period || 20;
  const raw = CCI.calculate({ high: highs(candles), low: lows(candles), close: closes(candles), period });
  const aligned = alignRight(raw, candles.length);
  const v = lastDefined(aligned);
  const bias: SignalBias = v == null ? 'neutral' : v >= 100 ? 'bullish' : v <= -100 ? 'bearish' : 'neutral';
  return {
    id: 'cci',
    label: 'CCI',
    category: 'momentum',
    overlay: 'pane',
    lines: [line('cci', 'CCI', aligned)],
    latest: { value: round(v) },
    signal: v == null ? null : `CCI ${round(v)} - ${v >= 100 ? 'strong up' : v <= -100 ? 'strong down' : 'neutral'}`,
    bias,
  };
};

const computeRoc: ComputeFn = (candles, params) => {
  const period = params.period || 12;
  const raw = ROC.calculate({ values: closes(candles), period });
  const aligned = alignRight(raw, candles.length);
  const v = lastDefined(aligned);
  const bias: SignalBias = v == null ? 'neutral' : v > 0 ? 'bullish' : 'bearish';
  return {
    id: 'roc',
    label: 'Rate of Change',
    category: 'momentum',
    overlay: 'pane',
    lines: [line('roc', 'ROC', aligned)],
    latest: { value: round(v) },
    signal: v == null ? null : `ROC ${round(v)}% - ${v > 0 ? 'rising' : 'falling'}`,
    bias,
  };
};

const computeMomentum: ComputeFn = (candles, params) => {
  const period = params.period || 10;
  const n = candles.length;
  const out: (number | null)[] = new Array(n).fill(null);
  for (let i = period; i < n; i++) out[i] = candles[i].close - candles[i - period].close;
  const v = lastDefined(out);
  const bias: SignalBias = v == null ? 'neutral' : v > 0 ? 'bullish' : 'bearish';
  return {
    id: 'mom',
    label: 'Momentum',
    category: 'momentum',
    overlay: 'pane',
    lines: [line('mom', 'MOM', out)],
    latest: { value: round(v) },
    signal: v == null ? null : `Momentum ${round(v)} - ${v > 0 ? 'positive' : 'negative'}`,
    bias,
  };
};

// ---------------------------------------------------------------------------
// volatility
// ---------------------------------------------------------------------------

const computeBbands: ComputeFn = (candles, params) => {
  const period = params.period || 20;
  const stdDev = params.stdDev || 2;
  const raw = BollingerBands.calculate({ period, values: closes(candles), stdDev });
  const upper = alignRight(raw.map((r) => r.upper ?? null), candles.length);
  const middle = alignRight(raw.map((r) => r.middle ?? null), candles.length);
  const lower = alignRight(raw.map((r) => r.lower ?? null), candles.length);
  const pb = alignRight(raw.map((r) => r.pb ?? null), candles.length);
  const u = lastDefined(upper);
  const l = lastDefined(lower);
  const m = lastDefined(middle);
  const pbv = lastDefined(pb);
  const bandwidth = u != null && l != null && m ? ((u - l) / m) * 100 : null;
  const price = candles[candles.length - 1].close;
  const bias: SignalBias = u == null || l == null ? 'neutral' : price >= u ? 'bearish' : price <= l ? 'bullish' : 'neutral';
  return {
    id: 'bbands',
    label: 'Bollinger Bands',
    category: 'volatility',
    overlay: 'price',
    lines: [line('upper', 'Upper', upper), line('middle', 'Middle', middle), line('lower', 'Lower', lower)],
    latest: { upper: round(u), middle: round(m), lower: round(l), percentB: round(pbv, 3), bandwidth: round(bandwidth) },
    signal:
      u == null ? null : `Price ${price >= u ? 'at/above upper' : price <= l! ? 'at/below lower' : 'within'} bands, %B ${round(pbv, 2)}`,
    bias,
  };
};

const computeAtr: ComputeFn = (candles, params) => {
  const period = params.period || 14;
  const raw = ATR.calculate({ high: highs(candles), low: lows(candles), close: closes(candles), period });
  const aligned = alignRight(raw, candles.length);
  const v = lastDefined(aligned);
  const price = candles[candles.length - 1].close;
  const pct = v != null && price ? (v / price) * 100 : null;
  return {
    id: 'atr',
    label: 'ATR',
    category: 'volatility',
    overlay: 'pane',
    lines: [line('atr', 'ATR', aligned)],
    latest: { value: round(v), percent: round(pct) },
    signal: v == null ? null : `ATR ${round(v)} (${round(pct)}% of price)`,
    bias: 'neutral',
  };
};

const computeKeltner: ComputeFn = (candles, params) => {
  const maPeriod = params.period || 20;
  const atrPeriod = params.atrPeriod || 10;
  const multiplier = params.multiplier || 2;
  const raw = KeltnerChannels.calculate({
    high: highs(candles),
    low: lows(candles),
    close: closes(candles),
    maPeriod,
    atrPeriod,
    multiplier,
    useSMA: false,
  });
  const upper = alignRight(raw.map((r) => r.upper ?? null), candles.length);
  const middle = alignRight(raw.map((r) => r.middle ?? null), candles.length);
  const lower = alignRight(raw.map((r) => r.lower ?? null), candles.length);
  const u = lastDefined(upper);
  const l = lastDefined(lower);
  const price = candles[candles.length - 1].close;
  const bias: SignalBias = u == null || l == null ? 'neutral' : price >= u ? 'bullish' : price <= l ? 'bearish' : 'neutral';
  return {
    id: 'keltner',
    label: 'Keltner Channels',
    category: 'volatility',
    overlay: 'price',
    lines: [line('upper', 'Upper', upper), line('middle', 'Middle', middle), line('lower', 'Lower', lower)],
    latest: { upper: round(u), middle: round(lastDefined(middle)), lower: round(l) },
    signal: u == null ? null : `Price ${price >= u ? 'above upper (breakout)' : price <= l! ? 'below lower' : 'within'} channel`,
    bias,
  };
};

const computeDonchian: ComputeFn = (candles, params) => {
  const period = params.period || 20;
  const n = candles.length;
  const upper: (number | null)[] = new Array(n).fill(null);
  const lower: (number | null)[] = new Array(n).fill(null);
  const middle: (number | null)[] = new Array(n).fill(null);
  for (let i = period - 1; i < n; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      hh = Math.max(hh, candles[j].high);
      ll = Math.min(ll, candles[j].low);
    }
    upper[i] = hh;
    lower[i] = ll;
    middle[i] = (hh + ll) / 2;
  }
  const u = lastDefined(upper);
  const l = lastDefined(lower);
  const price = candles[n - 1].close;
  const bias: SignalBias = u == null ? 'neutral' : price >= u ? 'bullish' : price <= l! ? 'bearish' : 'neutral';
  return {
    id: 'donchian',
    label: 'Donchian Channels',
    category: 'volatility',
    overlay: 'price',
    lines: [line('upper', 'Upper', upper), line('middle', 'Middle', middle), line('lower', 'Lower', lower)],
    latest: { upper: round(u), middle: round(lastDefined(middle)), lower: round(l) },
    signal: u == null ? null : `Price ${price >= u ? 'at upper (breakout)' : price <= l! ? 'at lower (breakdown)' : 'within'} range`,
    bias,
  };
};

// ---------------------------------------------------------------------------
// support / resistance
// ---------------------------------------------------------------------------

const computePivots: ComputeFn = (candles) => {
  const prev = candles[candles.length - 2] ?? candles[candles.length - 1];
  const p = (prev.high + prev.low + prev.close) / 3;
  const r1 = 2 * p - prev.low;
  const s1 = 2 * p - prev.high;
  const r2 = p + (prev.high - prev.low);
  const s2 = p - (prev.high - prev.low);
  const r3 = prev.high + 2 * (p - prev.low);
  const s3 = prev.low - 2 * (prev.high - p);
  const price = candles[candles.length - 1].close;
  const bias: SignalBias = price > p ? 'bullish' : price < p ? 'bearish' : 'neutral';
  return {
    id: 'pivots',
    label: 'Pivot Points',
    category: 'support_resistance',
    overlay: 'price',
    lines: [],
    latest: { pivot: round(p), r1: round(r1), s1: round(s1), r2: round(r2), s2: round(s2) },
    levels: [
      { label: 'R3', value: round(r3)! },
      { label: 'R2', value: round(r2)! },
      { label: 'R1', value: round(r1)! },
      { label: 'P', value: round(p)! },
      { label: 'S1', value: round(s1)! },
      { label: 'S2', value: round(s2)! },
      { label: 'S3', value: round(s3)! },
    ],
    signal: `Price ${price > p ? 'above' : 'below'} pivot ${round(p)} (R1 ${round(r1)} / S1 ${round(s1)})`,
    bias,
  };
};

const computeFib: ComputeFn = (candles, params) => {
  const lookback = params.period || Math.min(candles.length, 120);
  const window = candles.slice(-lookback);
  let hh = -Infinity;
  let ll = Infinity;
  let hhIdx = 0;
  let llIdx = 0;
  window.forEach((c, i) => {
    if (c.high > hh) {
      hh = c.high;
      hhIdx = i;
    }
    if (c.low < ll) {
      ll = c.low;
      llIdx = i;
    }
  });
  const uptrend = llIdx < hhIdx;
  const diff = hh - ll;
  const ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const levels = ratios.map((r) => ({
    label: `${(r * 100).toFixed(1)}%`,
    value: round(uptrend ? hh - diff * r : ll + diff * r)!,
  }));
  const price = candles[candles.length - 1].close;
  return {
    id: 'fib',
    label: 'Fibonacci Retracement',
    category: 'support_resistance',
    overlay: 'price',
    lines: [],
    latest: { high: round(hh), low: round(ll) },
    levels,
    signal: `${uptrend ? 'Up' : 'Down'}-swing ${round(ll)} -> ${round(hh)}; price ${round(price)}`,
    bias: 'neutral',
    note: 'Retracement levels from the most recent swing high/low in the window.',
  };
};

// ---------------------------------------------------------------------------
// volume (phase 2)
// ---------------------------------------------------------------------------

const computeObv: ComputeFn = (candles) => {
  const raw = OBV.calculate({ close: closes(candles), volume: vols(candles) });
  const aligned = alignRight(raw, candles.length);
  const v = lastDefined(aligned);
  const prevIdx = aligned.length - 2;
  const prev = prevIdx >= 0 ? aligned[prevIdx] : null;
  const bias: SignalBias = v == null || prev == null ? 'neutral' : v > prev ? 'bullish' : v < prev ? 'bearish' : 'neutral';
  return {
    id: 'obv',
    label: 'On-Balance Volume',
    category: 'volume',
    overlay: 'pane',
    lines: [line('obv', 'OBV', aligned)],
    latest: { value: round(v, 0) },
    signal: v == null ? null : `OBV ${round(v, 0)} - ${bias === 'bullish' ? 'accumulation' : bias === 'bearish' ? 'distribution' : 'flat'}`,
    bias,
  };
};

function adlSeries(candles: Candle[]): (number | null)[] {
  const raw = ADL.calculate({ high: highs(candles), low: lows(candles), close: closes(candles), volume: vols(candles) });
  return alignRight(raw, candles.length);
}

const computeAdl: ComputeFn = (candles) => {
  const aligned = adlSeries(candles);
  const v = lastDefined(aligned);
  const prev = aligned[aligned.length - 2] ?? null;
  const bias: SignalBias = v == null || prev == null ? 'neutral' : v > prev ? 'bullish' : 'bearish';
  return {
    id: 'adl',
    label: 'Accumulation/Distribution',
    category: 'volume',
    overlay: 'pane',
    lines: [line('adl', 'A/D Line', aligned)],
    latest: { value: round(v, 0) },
    signal: v == null ? null : `A/D line ${bias === 'bullish' ? 'rising (accumulation)' : 'falling (distribution)'}`,
    bias,
  };
};

const computeCmf: ComputeFn = (candles, params) => {
  const period = params.period || 20;
  const n = candles.length;
  const mfv: number[] = candles.map((c) => {
    const range = c.high - c.low;
    const mult = range === 0 ? 0 : ((c.close - c.low) - (c.high - c.close)) / range;
    return mult * (c.volume ?? 0);
  });
  const out: (number | null)[] = new Array(n).fill(null);
  for (let i = period - 1; i < n; i++) {
    let sumMfv = 0;
    let sumVol = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumMfv += mfv[j];
      sumVol += candles[j].volume ?? 0;
    }
    out[i] = sumVol === 0 ? 0 : sumMfv / sumVol;
  }
  const v = lastDefined(out);
  const bias: SignalBias = v == null ? 'neutral' : v > 0.05 ? 'bullish' : v < -0.05 ? 'bearish' : 'neutral';
  return {
    id: 'cmf',
    label: 'Chaikin Money Flow',
    category: 'volume',
    overlay: 'pane',
    lines: [line('cmf', 'CMF', out)],
    latest: { value: round(v, 3) },
    signal: v == null ? null : `CMF ${round(v, 3)} - ${bias === 'bullish' ? 'buying pressure' : bias === 'bearish' ? 'selling pressure' : 'neutral'}`,
    bias,
  };
};

function emaOf(values: (number | null)[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let ema: number | null = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) continue;
    ema = ema == null ? v : v * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

const computeChaikinOsc: ComputeFn = (candles) => {
  const adl = adlSeries(candles);
  const fast = emaOf(adl, 3);
  const slow = emaOf(adl, 10);
  const out = adl.map((_, i) => (fast[i] != null && slow[i] != null ? (fast[i] as number) - (slow[i] as number) : null));
  const v = lastDefined(out);
  const bias: SignalBias = v == null ? 'neutral' : v > 0 ? 'bullish' : 'bearish';
  return {
    id: 'chaikinosc',
    label: 'Chaikin Oscillator',
    category: 'volume',
    overlay: 'pane',
    lines: [line('chaikinosc', 'Chaikin Osc', out)],
    latest: { value: round(v, 0) },
    signal: v == null ? null : `Chaikin Osc ${round(v, 0)} - ${v > 0 ? 'bullish' : 'bearish'}`,
    bias,
  };
};

const computeVwap: ComputeFn = (candles) => {
  const raw = VWAP.calculate({ high: highs(candles), low: lows(candles), close: closes(candles), volume: vols(candles) });
  const aligned = alignRight(raw, candles.length);
  const v = lastDefined(aligned);
  const price = candles[candles.length - 1].close;
  const bias: SignalBias = v == null ? 'neutral' : price > v ? 'bullish' : 'bearish';
  return {
    id: 'vwap',
    label: 'VWAP',
    category: 'volume',
    overlay: 'price',
    lines: [line('vwap', 'VWAP', aligned)],
    latest: { value: round(v) },
    signal: v == null ? null : `Price ${price > v ? 'above' : 'below'} VWAP ${round(v)}`,
    bias,
  };
};

const computeMfi: ComputeFn = (candles, params) => {
  const period = params.period || 14;
  const raw = MFI.calculate({ high: highs(candles), low: lows(candles), close: closes(candles), volume: vols(candles), period });
  const aligned = alignRight(raw, candles.length);
  const v = lastDefined(aligned);
  const bias: SignalBias = v == null ? 'neutral' : v >= 80 ? 'bearish' : v <= 20 ? 'bullish' : 'neutral';
  return {
    id: 'mfi',
    label: 'Money Flow Index',
    category: 'volume',
    overlay: 'pane',
    lines: [line('mfi', 'MFI', aligned)],
    latest: { value: round(v) },
    signal: v == null ? null : `MFI ${round(v)} - ${v >= 80 ? 'overbought' : v <= 20 ? 'oversold' : 'neutral'}`,
    bias,
  };
};

const computeForceIndex: ComputeFn = (candles, params) => {
  const period = params.period || 13;
  const raw = ForceIndex.calculate({ close: closes(candles), volume: vols(candles), period });
  const aligned = alignRight(raw, candles.length);
  const v = lastDefined(aligned);
  const bias: SignalBias = v == null ? 'neutral' : v > 0 ? 'bullish' : 'bearish';
  return {
    id: 'forceindex',
    label: 'Force Index',
    category: 'volume',
    overlay: 'pane',
    lines: [line('forceindex', 'Force Index', aligned)],
    latest: { value: round(v, 0) },
    signal: v == null ? null : `Force Index ${round(v, 0)} - ${v > 0 ? 'buyers in control' : 'sellers in control'}`,
    bias,
  };
};

const computeEom: ComputeFn = (candles, params) => {
  const period = params.period || 14;
  const n = candles.length;
  const emv: (number | null)[] = new Array(n).fill(null);
  for (let i = 1; i < n; i++) {
    const hl2 = (candles[i].high + candles[i].low) / 2;
    const prevHl2 = (candles[i - 1].high + candles[i - 1].low) / 2;
    const moved = hl2 - prevHl2;
    const range = candles[i].high - candles[i].low;
    const vol = candles[i].volume ?? 0;
    const boxRatio = vol === 0 || range === 0 ? 0 : vol / 1_000_000 / range;
    emv[i] = boxRatio === 0 ? 0 : moved / boxRatio;
  }
  const smoothed = smaArray(emv.map((x) => x ?? 0), period).map((x, i) => (i < period ? null : x));
  const v = lastDefined(smoothed);
  const bias: SignalBias = v == null ? 'neutral' : v > 0 ? 'bullish' : 'bearish';
  return {
    id: 'eom',
    label: 'Ease of Movement',
    category: 'volume',
    overlay: 'pane',
    lines: [line('eom', 'EOM', smoothed)],
    latest: { value: round(v, 2) },
    signal: v == null ? null : `EOM ${round(v, 2)} - price moving ${v > 0 ? 'up easily' : 'down easily'}`,
    bias,
  };
};

const computePvt: ComputeFn = (candles) => {
  const n = candles.length;
  const out: (number | null)[] = new Array(n).fill(null);
  let pvt = 0;
  out[0] = 0;
  for (let i = 1; i < n; i++) {
    const prevClose = candles[i - 1].close;
    const change = prevClose === 0 ? 0 : (candles[i].close - prevClose) / prevClose;
    pvt += change * (candles[i].volume ?? 0);
    out[i] = pvt;
  }
  const v = lastDefined(out);
  const prev = out[n - 2] ?? null;
  const bias: SignalBias = v == null || prev == null ? 'neutral' : v > prev ? 'bullish' : 'bearish';
  return {
    id: 'pvt',
    label: 'Price Volume Trend',
    category: 'volume',
    overlay: 'pane',
    lines: [line('pvt', 'PVT', out)],
    latest: { value: round(v, 0) },
    signal: v == null ? null : `PVT ${bias === 'bullish' ? 'rising' : 'falling'}`,
    bias,
  };
};

const computeVwma: ComputeFn = (candles, params) => {
  const period = params.period || 20;
  const n = candles.length;
  const out: (number | null)[] = new Array(n).fill(null);
  for (let i = period - 1; i < n; i++) {
    let pv = 0;
    let vol = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const v = candles[j].volume ?? 0;
      pv += candles[j].close * v;
      vol += v;
    }
    out[i] = vol === 0 ? null : pv / vol;
  }
  const v = lastDefined(out);
  const price = candles[n - 1].close;
  const bias: SignalBias = v == null ? 'neutral' : price > v ? 'bullish' : 'bearish';
  return {
    id: 'vwma',
    label: `VWMA (${period})`,
    category: 'volume',
    overlay: 'price',
    lines: [line('vwma', `VWMA${period}`, out)],
    latest: { value: round(v) },
    signal: v == null ? null : `Price ${price > v ? 'above' : 'below'} VWMA ${round(v)}`,
    bias,
  };
};

const computeVolOsc: ComputeFn = (candles, params) => {
  const shortP = params.short || 5;
  const longP = params.long || 20;
  const volume = vols(candles).map((v) => v as number | null);
  const shortEma = emaOf(volume, shortP);
  const longEma = emaOf(volume, longP);
  const out = volume.map((_, i) =>
    shortEma[i] != null && longEma[i] != null && (longEma[i] as number) !== 0
      ? (((shortEma[i] as number) - (longEma[i] as number)) / (longEma[i] as number)) * 100
      : null,
  );
  const v = lastDefined(out);
  const bias: SignalBias = v == null ? 'neutral' : v > 0 ? 'bullish' : 'bearish';
  return {
    id: 'volosc',
    label: 'Volume Oscillator',
    category: 'volume',
    overlay: 'pane',
    lines: [line('volosc', 'Vol Osc %', out)],
    latest: { value: round(v) },
    signal: v == null ? null : `Volume oscillator ${round(v)}% - ${v > 0 ? 'rising volume' : 'falling volume'}`,
    bias,
  };
};

// ---------------------------------------------------------------------------
// market / macro (phase 3) - stock-focused, uses ctx.market
// ---------------------------------------------------------------------------

function dailyReturns(values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) out.push(values[i - 1] === 0 ? 0 : (values[i] - values[i - 1]) / values[i - 1]);
  return out;
}

function alignByDate(asset: Candle[], market: Candle[]): { a: number[]; b: number[] } {
  const map = new Map<string, number>();
  market.forEach((c) => map.set(c.date.slice(0, 10), c.close));
  const a: number[] = [];
  const b: number[] = [];
  asset.forEach((c) => {
    const key = c.date.slice(0, 10);
    const m = map.get(key);
    if (m != null) {
      a.push(c.close);
      b.push(m);
    }
  });
  return { a, b };
}

const computeVix: ComputeFn = (_candles, _params, ctx) => {
  const vix = ctx.market?.vix;
  if (!vix || vix.length === 0) {
    return { id: 'vix', label: 'VIX', category: 'market', overlay: 'pane', lines: [], latest: { value: null, average20: null }, signal: 'VIX data unavailable', bias: 'neutral' };
  }
  const v = vix[vix.length - 1].close;
  const sma = smaArray(vix.map((c) => c.close), Math.min(20, vix.length - 1));
  const avg = lastDefined(sma);
  const bias: SignalBias = v >= 25 ? 'bearish' : v <= 15 ? 'bullish' : 'neutral';
  const regime = v >= 25 ? 'high fear' : v <= 15 ? 'complacency/calm' : 'normal';
  return {
    id: 'vix',
    label: 'Volatility Index (VIX)',
    category: 'market',
    overlay: 'pane',
    lines: [line('vix', 'VIX', alignRight(vix.map((c) => c.close), vix.length))],
    latest: { value: round(v), average20: round(avg) },
    signal: `VIX ${round(v)} - ${regime} (20d avg ${round(avg)})`,
    bias,
  };
};

const computeSpxTrend: ComputeFn = (_candles, _params, ctx) => {
  const spx = ctx.market?.spx;
  if (!spx || spx.length < 60) {
    return { id: 'spx_trend', label: 'S&P 500 Trend', category: 'market', overlay: 'pane', lines: [], latest: { price: null, sma50: null, sma200: null }, signal: 'S&P 500 data unavailable', bias: 'neutral' };
  }
  const close = spx.map((c) => c.close);
  const sma50 = lastDefined(smaArray(close, 50));
  const sma200 = lastDefined(smaArray(close, Math.min(200, close.length - 1)));
  const price = close[close.length - 1];
  const bias: SignalBias = sma50 != null && sma200 != null ? (sma50 > sma200 && price > sma50 ? 'bullish' : sma50 < sma200 ? 'bearish' : 'neutral') : 'neutral';
  return {
    id: 'spx_trend',
    label: 'S&P 500 Market Trend',
    category: 'market',
    overlay: 'pane',
    lines: [],
    latest: { price: round(price), sma50: round(sma50), sma200: round(sma200) },
    signal: `S&P 500 ${round(price)} - 50DMA ${round(sma50)} vs 200DMA ${round(sma200)} (${bias} regime)`,
    bias,
  };
};

const computeBeta: ComputeFn = (candles, params, ctx) => {
  const spx = ctx.market?.spx;
  if (!spx) return { id: 'beta', label: 'Beta vs S&P 500', category: 'market', overlay: 'pane', lines: [], latest: { value: null }, signal: 'Market data unavailable', bias: 'neutral' };
  const { a, b } = alignByDate(candles, spx);
  if (a.length < 30) return { id: 'beta', label: 'Beta vs S&P 500', category: 'market', overlay: 'pane', lines: [], latest: { value: null }, signal: 'Not enough overlapping data', bias: 'neutral' };
  const ra = dailyReturns(a);
  const rb = dailyReturns(b);
  const meanA = ra.reduce((x, y) => x + y, 0) / ra.length;
  const meanB = rb.reduce((x, y) => x + y, 0) / rb.length;
  let cov = 0;
  let varB = 0;
  for (let i = 0; i < ra.length; i++) {
    cov += (ra[i] - meanA) * (rb[i] - meanB);
    varB += (rb[i] - meanB) ** 2;
  }
  const beta = varB === 0 ? null : cov / varB;
  return {
    id: 'beta',
    label: 'Beta vs S&P 500',
    category: 'market',
    overlay: 'pane',
    lines: [],
    latest: { value: round(beta, 2) },
    signal: beta == null ? null : `Beta ${round(beta, 2)} - ${beta > 1.1 ? 'more volatile than market' : beta < 0.9 ? 'less volatile than market' : 'tracks market'}`,
    bias: 'neutral',
  };
};

const computeRelStrength: ComputeFn = (candles, _params, ctx) => {
  const spx = ctx.market?.spx;
  if (!spx) return { id: 'rel_strength', label: 'Relative Strength vs S&P 500', category: 'market', overlay: 'pane', lines: [], latest: { changePercent: null }, signal: 'Market data unavailable', bias: 'neutral' };
  const map = new Map<string, number>();
  spx.forEach((c) => map.set(c.date.slice(0, 10), c.close));
  const ratio: (number | null)[] = candles.map((c) => {
    const m = map.get(c.date.slice(0, 10));
    return m && m !== 0 ? c.close / m : null;
  });
  const valid = ratio.filter((x): x is number => x != null);
  if (valid.length < 5) return { id: 'rel_strength', label: 'Relative Strength vs S&P 500', category: 'market', overlay: 'pane', lines: [], latest: { changePercent: null }, signal: 'Not enough overlapping data', bias: 'neutral' };
  const first = valid[0];
  const last = valid[valid.length - 1];
  const change = first === 0 ? 0 : ((last - first) / first) * 100;
  const bias: SignalBias = change > 0 ? 'bullish' : change < 0 ? 'bearish' : 'neutral';
  return {
    id: 'rel_strength',
    label: 'Relative Strength vs S&P 500',
    category: 'market',
    overlay: 'pane',
    lines: [line('rs', 'Asset/SPX', ratio)],
    latest: { changePercent: round(change) },
    signal: `${change >= 0 ? 'Outperforming' : 'Underperforming'} S&P 500 by ${round(Math.abs(change))}% over window`,
    bias,
  };
};

const computeCorrelation: ComputeFn = (candles, params, ctx) => {
  const spx = ctx.market?.spx;
  if (!spx) return { id: 'correlation', label: 'Correlation vs S&P 500', category: 'market', overlay: 'pane', lines: [], latest: { value: null }, signal: 'Market data unavailable', bias: 'neutral' };
  const { a, b } = alignByDate(candles, spx);
  const window = params.period || 30;
  if (a.length < window + 1) return { id: 'correlation', label: 'Correlation vs S&P 500', category: 'market', overlay: 'pane', lines: [], latest: { value: null }, signal: 'Not enough overlapping data', bias: 'neutral' };
  const ra = dailyReturns(a).slice(-window);
  const rb = dailyReturns(b).slice(-window);
  const meanA = ra.reduce((x, y) => x + y, 0) / ra.length;
  const meanB = rb.reduce((x, y) => x + y, 0) / rb.length;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < ra.length; i++) {
    cov += (ra[i] - meanA) * (rb[i] - meanB);
    varA += (ra[i] - meanA) ** 2;
    varB += (rb[i] - meanB) ** 2;
  }
  const corr = varA === 0 || varB === 0 ? null : cov / Math.sqrt(varA * varB);
  return {
    id: 'correlation',
    label: 'Correlation vs S&P 500',
    category: 'market',
    overlay: 'pane',
    lines: [],
    latest: { value: round(corr, 2) },
    signal: corr == null ? null : `${window}d correlation ${round(corr, 2)} - ${corr > 0.5 ? 'moves with market' : corr < -0.2 ? 'moves against market' : 'weak link'}`,
    bias: 'neutral',
  };
};

// ---------------------------------------------------------------------------
// registry of compute functions keyed by indicator id
// ---------------------------------------------------------------------------

export const COMPUTE_FNS: Record<string, ComputeFn> = {
  sma: movingAverage('sma', 'SMA', 'sma'),
  ema: movingAverage('ema', 'EMA', 'ema'),
  wma: movingAverage('wma', 'WMA', 'wma'),
  macd: computeMacd,
  adx: computeAdx,
  psar: computePsar,
  supertrend: computeSupertrend,
  aroon: computeAroon,
  ichimoku: computeIchimoku,
  trix: computeTrix,
  rsi: computeRsi,
  stoch: computeStoch,
  stochrsi: computeStochRsi,
  williamsr: computeWilliamsR,
  cci: computeCci,
  roc: computeRoc,
  mom: computeMomentum,
  bbands: computeBbands,
  atr: computeAtr,
  keltner: computeKeltner,
  donchian: computeDonchian,
  pivots: computePivots,
  fib: computeFib,
  obv: computeObv,
  adl: computeAdl,
  cmf: computeCmf,
  chaikinosc: computeChaikinOsc,
  vwap: computeVwap,
  mfi: computeMfi,
  forceindex: computeForceIndex,
  eom: computeEom,
  pvt: computePvt,
  vwma: computeVwma,
  volosc: computeVolOsc,
  vix: computeVix,
  spx_trend: computeSpxTrend,
  beta: computeBeta,
  rel_strength: computeRelStrength,
  correlation: computeCorrelation,
};
