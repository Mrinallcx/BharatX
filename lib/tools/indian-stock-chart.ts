import { tool } from 'ai';
import { z } from 'zod';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

type ExchangePref = 'NSE' | 'BSE' | 'auto';

function parseChartRange(timePeriod: string): { period1: Date; interval: '1d' | '1wk' } {
  const t = timePeriod.toLowerCase();
  const now = new Date();

  if (/\b(max|all|maximum|longest)\b/i.test(t)) {
    return { period1: new Date(now.getFullYear() - 15, now.getMonth(), now.getDate()), interval: '1wk' };
  }
  if (/\b5\s*y|five\s*year|5y\b/i.test(t)) {
    return { period1: new Date(now.getFullYear() - 5, now.getMonth(), now.getDate()), interval: '1wk' };
  }
  if (/\b2\s*y|two\s*year|2y\b/i.test(t)) {
    return { period1: new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()), interval: '1wk' };
  }
  if (/\b6\s*mo|six\s*month|half\s*year/i.test(t)) {
    return { period1: new Date(now.getTime() - 180 * 86400000), interval: '1d' };
  }
  if (/\b3\s*mo|three\s*month|quarter/i.test(t)) {
    return { period1: new Date(now.getTime() - 90 * 86400000), interval: '1d' };
  }
  if (/\b1\s*mo|one\s*month|month\b/i.test(t)) {
    return { period1: new Date(now.getTime() - 30 * 86400000), interval: '1d' };
  }
  if (/\bweek|7\s*day/i.test(t)) {
    return { period1: new Date(now.getTime() - 14 * 86400000), interval: '1d' };
  }

  return { period1: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()), interval: '1d' };
}

function looksLikeTicker(s: string): boolean {
  const x = s.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9&.-]{0,14}$/.test(x) && !/\s/.test(x);
}

async function resolveYahooIndianSymbol(
  raw: string,
  prefer: ExchangePref,
): Promise<{ symbol: string; displayName: string } | null> {
  const trimmed = raw.trim();
  const upper = trimmed.toUpperCase();

  if (upper.endsWith('.NS') || upper.endsWith('.BO')) {
    return { symbol: upper, displayName: upper };
  }

  if (looksLikeTicker(trimmed)) {
    const base = upper.replace(/\.(NS|BO)$/i, '');
    const tryNse = `${base}.NS`;
    const tryBse = `${base}.BO`;

    if (prefer === 'BSE') {
      try {
        const c = await yf.chart(tryBse, {
          period1: new Date(Date.now() - 10 * 86400000),
          period2: new Date(),
          interval: '1d',
        });
        if (c.quotes?.length) {
          return { symbol: tryBse, displayName: (c.meta.longName as string) || tryBse };
        }
      } catch {
        /* fall through */
      }
    }

    if (prefer !== 'BSE') {
      try {
        const c = await yf.chart(tryNse, {
          period1: new Date(Date.now() - 10 * 86400000),
          period2: new Date(),
          interval: '1d',
        });
        if (c.quotes?.length) {
          return { symbol: tryNse, displayName: (c.meta.longName as string) || tryNse };
        }
      } catch {
        /* try BSE */
      }
    }

    if (prefer !== 'NSE') {
      try {
        const c = await yf.chart(tryBse, {
          period1: new Date(Date.now() - 10 * 86400000),
          period2: new Date(),
          interval: '1d',
        });
        if (c.quotes?.length) {
          return { symbol: tryBse, displayName: (c.meta.longName as string) || tryBse };
        }
      } catch {
        /* search */
      }
    }
  }

  try {
    const search = await yf.search(trimmed, { quotesCount: 20, newsCount: 0 });
    const raw = search.quotes ?? [];
    const quotes = raw.filter((q) => {
      if (!q || typeof q !== 'object' || !('symbol' in q)) return false;
      const sym = String((q as { symbol?: string }).symbol || '');
      return /\.(NS|BO)$/i.test(sym);
    }) as Array<{ symbol: string; longname?: string; shortname?: string }>;

    if (!quotes.length) return null;

    const nse = quotes.find((q) => q.symbol.toUpperCase().endsWith('.NS'));
    const bse = quotes.find((q) => q.symbol.toUpperCase().endsWith('.BO'));

    const pick =
      prefer === 'BSE' ? bse || nse || quotes[0] : prefer === 'NSE' ? nse || bse || quotes[0] : nse || bse || quotes[0];

    const sym = pick.symbol.toUpperCase();
    const displayName = pick.longname || pick.shortname || sym;
    return { symbol: sym, displayName };
  } catch {
    return null;
  }
}

export const indianStockChartTool = tool({
  description:
    'Get NSE/BSE (Indian) equity prices and historical chart data via Yahoo Finance. Use company names or symbols (e.g. RELIANCE, TCS, HDFC Bank). Prices are in INR. Prefer this tool in Indian Stock Exchange (ISE) mode instead of stock_chart.',
  inputSchema: z.object({
    title: z.string().describe('Short title for the chart panel.'),
    companies: z
      .array(z.string())
      .describe('Indian company names or ticker symbols (NSE/BSE), e.g. "Reliance Industries", "TCS", "INFY".'),
    time_period: z
      .string()
      .describe(
        'Natural language range: e.g. "1 year", "6 months", "3 months", "5 years". Defaults to 1 year of daily data.',
      )
      .default('1 year'),
    exchange: z
      .enum(['auto', 'NSE', 'BSE'])
      .optional()
      .describe('Prefer NSE (.NS) or BSE (.BO) when ambiguous. Default auto prefers NSE.'),
    news_queries: z
      .array(z.string())
      .optional()
      .describe('Optional topics for future news enrichment; currently unused.'),
  }),
  execute: async ({ title, companies, time_period, exchange }) => {
    const prefer: ExchangePref = exchange === 'NSE' ? 'NSE' : exchange === 'BSE' ? 'BSE' : 'auto';
    const { period1, interval } = parseChartRange(time_period || '1 year');
    const period2 = new Date();

    const elements: Array<{ label: string; points: Array<[string, number]>; ticker?: string }> = [];
    const errors: string[] = [];

    for (const company of companies) {
      const resolved = await resolveYahooIndianSymbol(company, prefer);
      if (!resolved) {
        errors.push(`Could not resolve Indian listing for: ${company}`);
        continue;
      }

      try {
        const chart = await yf.chart(resolved.symbol, {
          period1,
          period2,
          interval,
        });

        const points: Array<[string, number]> = (chart.quotes ?? [])
          .map((q) => {
            const d = q.date instanceof Date ? q.date : new Date(q.date as unknown as string);
            const close = q.close != null ? Number(q.close) : NaN;
            return [d.toISOString().slice(0, 10), close] as [string, number];
          })
          .filter(([, c]) => Number.isFinite(c));

        if (!points.length) {
          errors.push(`No price history for ${resolved.symbol}`);
          continue;
        }

        const metaName = (chart.meta?.longName as string) || resolved.displayName;
        const shortSym = resolved.symbol.replace(/\.(NS|BO)$/i, '');
        elements.push({
          label: `${metaName} (${shortSym})`,
          points,
          ticker: shortSym,
        });
      } catch (e) {
        errors.push(`${resolved.symbol}: ${e instanceof Error ? e.message : 'chart failed'}`);
      }
    }

    const chartData = {
      type: 'line' as const,
      title,
      x_label: 'Date',
      y_label: 'Price (INR)',
      x_scale: 'datetime' as const,
      elements,
    };

    const currency_symbols = elements.map(() => 'INR');

    return {
      message:
        elements.length > 0
          ? `Fetched NSE/BSE price history for ${elements.length} listing(s) via Yahoo Finance.${errors.length ? ` Notes: ${errors.join('; ')}` : ''}`
          : `No Indian chart data retrieved.${errors.length ? ` ${errors.join('; ')}` : ''}`,
      chart: chartData,
      currency_symbols,
      news_results: [] as Array<{
        query: string;
        topic: string;
        results: Array<{
          title: string;
          url: string;
          content: string;
          published_date?: string;
          category: string;
          query: string;
        }>;
      }>,
      resolved_companies: elements.map((el) => ({
        name: el.label,
        ticker: el.ticker || el.label,
      })),
      earnings_data: [] as Array<unknown>,
      sec_filings: [] as Array<unknown>,
      company_statistics: {} as Record<string, unknown>,
      balance_sheets: {} as Record<string, unknown[]>,
      income_statements: {} as Record<string, unknown[]>,
      cash_flows: {} as Record<string, unknown[]>,
      dividends_data: {} as Record<string, unknown[]>,
      insider_transactions: {} as Record<string, unknown[]>,
      market_movers: undefined,
    };
  },
});
