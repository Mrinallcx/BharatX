import { tool } from 'ai';
import { z } from 'zod';
import { screenStocks } from '@/lib/screener/screen';
import type { StockFinderOutput } from '@/lib/screener/types';

/**
 * Discovery + ranking tool. The LLM maps the user's natural-language criteria to this
 * structured schema; all screening, filtering and ranking run server-side in
 * `screenStocks`. The model never invents tickers or numbers — it only interprets the
 * returned candidate table.
 */
export const stockFinderTool = tool({
  description:
    'Find and rank stocks that match the user\'s criteria. Returns a ranked table of candidates with key metrics. Map the user\'s intent to a strategy and numeric filters; never invent tickers or metrics — only interpret the returned data.',
  inputSchema: z.object({
    market: z
      .enum(['US', 'India'])
      .default('US')
      .describe('Which market to screen. Use "India" for NSE/Indian stocks, otherwise "US".'),
    strategy: z
      .enum([
        'value_large',
        'value_growth',
        'growth_tech',
        'momentum_up',
        'momentum_down',
        'active',
        'small_cap',
        'most_shorted',
      ])
      .optional()
      .describe(
        'Best-matching screen for the user intent: value_large (undervalued large caps), value_growth (undervalued growth), growth_tech (growth technology), momentum_up (today\'s gainers), momentum_down (today\'s losers), active (most active), small_cap (aggressive small caps), most_shorted. For US, this selects the predefined universe; for India it only affects ranking.',
      ),
    minMarketCap: z
      .number()
      .optional()
      .describe('Minimum market cap. Units: USD billions for US (e.g. 50 = $50B); INR crore for India (e.g. 50000 = ₹50,000 cr).'),
    maxMarketCap: z
      .number()
      .optional()
      .describe('Maximum market cap. Same units as minMarketCap (USD billions for US, INR crore for India).'),
    minPE: z.number().optional().describe('Minimum trailing P/E ratio.'),
    maxPE: z.number().optional().describe('Maximum trailing P/E ratio.'),
    minDividendYield: z.number().optional().describe('Minimum dividend yield in percent (e.g. 3 = 3%).'),
    sector: z
      .string()
      .optional()
      .describe('Sector filter (e.g. "Technology", "Healthcare", "Financial Services"). Matched against company sector.'),
    minRevenueGrowth: z.number().optional().describe('Minimum year-over-year revenue growth in percent (e.g. 10 = 10%).'),
    priceVs200dma: z
      .enum(['above', 'below'])
      .optional()
      .describe('Require price to be above or below its 200-day moving average.'),
    near52w: z
      .enum(['high', 'low'])
      .optional()
      .describe('Require price to be near its 52-week high or low (within ~5%).'),
    limit: z.number().int().optional().default(10).describe('Maximum number of candidates to return (1-25).'),
  }),
  execute: async (criteria): Promise<StockFinderOutput> => {
    console.log('Stock Finder criteria:', criteria);
    try {
      return await screenStocks(criteria);
    } catch (error) {
      console.error('[stock-finder] tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error while screening stocks.',
      };
    }
  },
});
