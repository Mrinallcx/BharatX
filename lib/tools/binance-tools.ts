import { tool } from 'ai';
import { z } from 'zod';

// Binance 24hr ticker statistics
export const binanceTickerTool = tool({
  description: 'Get 24-hour ticker price change statistics for a trading pair on Binance. Returns price, volume, and percentage changes.',
  inputSchema: z.object({
    symbol: z.string().describe('Trading pair symbol (e.g., BTCUSDT, ETHUSDT, BNBBTC)'),
  }),
  execute: async ({ symbol }: { symbol: string }) => {
    console.log('Fetching Binance ticker for:', symbol);

    try {
      const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`);

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        symbol: data.symbol,
        price: parseFloat(data.lastPrice),
        priceChange: parseFloat(data.priceChange),
        priceChangePercent: parseFloat(data.priceChangePercent),
        highPrice: parseFloat(data.highPrice),
        lowPrice: parseFloat(data.lowPrice),
        volume: parseFloat(data.volume),
        quoteVolume: parseFloat(data.quoteVolume),
        openPrice: parseFloat(data.openPrice),
        prevClosePrice: parseFloat(data.prevClosePrice),
        bidPrice: parseFloat(data.bidPrice),
        askPrice: parseFloat(data.askPrice),
        count: data.count,
        source: 'Binance API',
        url: `https://www.binance.com/en/trade/${symbol}`,
      };
    } catch (error) {
      console.error('Binance ticker error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        symbol,
      };
    }
  },
});

// Binance Kline/Candlestick data
export const binanceKlineTool = tool({
  description: 'Get candlestick/Kline data for a trading pair on Binance. Returns OHLC data for charting.',
  inputSchema: z.object({
    symbol: z.string().describe('Trading pair symbol (e.g., BTCUSDT, ETHUSDT)'),
    interval: z.enum(['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M']).optional().describe('Kline interval (default: 1d)'),
    limit: z.number().optional().describe('Number of data points to return (default: 100, max: 1000)'),
  }),
  execute: async ({ 
    symbol, 
    interval = '1d', 
    limit = 100 
  }: { 
    symbol: string; 
    interval?: string; 
    limit?: number | null;
  }) => {
    console.log('Fetching Binance klines for:', symbol, interval);

    try {
      const params = new URLSearchParams({
        symbol: symbol.toUpperCase(),
        interval,
        limit: (limit || 100).toString(),
      });

      const response = await fetch(`https://api.binance.com/api/v3/klines?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
      }

      const klines = await response.json();

      // Format kline data: [Open time, Open, High, Low, Close, Volume, ...]
      const formattedData = klines.map((kline: any[]) => ({
        timestamp: kline[0],
        date: new Date(kline[0]).toISOString(),
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5]),
        quoteVolume: parseFloat(kline[7]),
        trades: kline[8],
      }));

      const lastCandle = formattedData[formattedData.length - 1];
      const firstCandle = formattedData[0];
      const periodPriceChange = lastCandle && firstCandle ? lastCandle.close - firstCandle.open : 0;
      const periodPriceChangePercent = firstCandle?.open ? ((periodPriceChange / firstCandle.open) * 100) : 0;

      const intervalLabels: Record<string, string> = {
        '1m': 'minute', '3m': '3-minute', '5m': '5-minute', '15m': '15-minute',
        '30m': '30-minute', '1h': 'hourly', '2h': '2-hour', '4h': '4-hour',
        '6h': '6-hour', '8h': '8-hour', '12h': '12-hour', '1d': 'daily',
        '3d': '3-day', '1w': 'weekly', '1M': 'monthly',
      };
      const candleCount = formattedData.length;
      const intervalLabel = intervalLabels[interval] || interval;
      const startDate = firstCandle ? new Date(firstCandle.timestamp).toISOString().split('T')[0] : '';
      const endDate = lastCandle ? new Date(lastCandle.timestamp).toISOString().split('T')[0] : '';
      const periodDescription = `${candleCount} ${intervalLabel} candles from ${startDate} to ${endDate}`;

      return {
        success: true,
        symbol: symbol.toUpperCase(),
        interval,
        candleCount,
        periodDescription,
        startDate,
        endDate,
        currentPrice: lastCandle?.close || 0,
        periodPriceChange: parseFloat(periodPriceChange.toFixed(2)),
        periodPriceChangePercent: parseFloat(periodPriceChangePercent.toFixed(2)),
        periodHigh: Math.max(...formattedData.map((d: any) => d.high)),
        periodLow: Math.min(...formattedData.map((d: any) => d.low)),
        note: `Price change, high, and low are for the FULL chart period (${periodDescription}), NOT 24-hour values. Use the binance_ticker tool for 24-hour statistics.`,
        vsCurrency: 'usd',
        chart: {
          title: `${symbol.toUpperCase()} Candlestick Chart`,
          type: 'candlestick',
          data: formattedData,
          elements: formattedData,
          x_scale: 'datetime',
          y_scale: 'linear',
        },
        source: 'Binance API',
        url: `https://www.binance.com/en/trade/${symbol.toUpperCase()}`,
      };
    } catch (error) {
      console.error('Binance kline error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        symbol,
      };
    }
  },
});

// Binance orderbook (market depth)
export const binanceOrderbookTool = tool({
  description: 'Get orderbook (market depth) data for a trading pair on Binance. Returns bids and asks with price and quantity levels.',
  inputSchema: z.object({
    symbol: z.string().describe('Trading pair symbol (e.g., BTCUSDT, ETHUSDT)'),
    limit: z.number().optional().describe('Number of price levels to return (default: 100, valid: 5, 10, 20, 50, 100, 500, 1000, 5000)'),
  }),
  execute: async ({ 
    symbol, 
    limit = 100 
  }: { 
    symbol: string; 
    limit?: number | null;
  }) => {
    console.log('Fetching Binance orderbook for:', symbol);

    try {
      // Validate limit
      const validLimits = [5, 10, 20, 50, 100, 500, 1000, 5000];
      const validLimit = validLimits.includes(limit || 100) ? (limit || 100) : 100;

      const params = new URLSearchParams({
        symbol: symbol.toUpperCase(),
        limit: validLimit.toString(),
      });

      const response = await fetch(`https://api.binance.com/api/v3/depth?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Format orderbook data
      const bids = data.bids.map((bid: [string, string]) => ({
        price: parseFloat(bid[0]),
        quantity: parseFloat(bid[1]),
      }));

      const asks = data.asks.map((ask: [string, string]) => ({
        price: parseFloat(ask[0]),
        quantity: parseFloat(ask[1]),
      }));

      // Calculate spread
      const bestBid = bids[0]?.price || 0;
      const bestAsk = asks[0]?.price || 0;
      const spread = bestAsk - bestBid;
      const spreadPercent = bestBid > 0 ? ((spread / bestBid) * 100).toFixed(4) : '0.0000';

      return {
        success: true,
        symbol: symbol.toUpperCase(),
        bids: bids,
        asks: asks,
        bestBid: bestBid,
        bestAsk: bestAsk,
        spread: spread,
        spreadPercent: `${spreadPercent}%`,
        lastUpdateId: data.lastUpdateId,
        source: 'Binance API',
        url: `https://www.binance.com/en/trade/${symbol.toUpperCase()}`,
      };
    } catch (error) {
      console.error('Binance orderbook error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        symbol,
      };
    }
  },
});

// Binance exchange info (get all trading pairs)
export const binanceExchangeInfoTool = tool({
  description: 'Get exchange information including all available trading pairs, symbols, and filters on Binance.',
  inputSchema: z.object({
    symbol: z.string().optional().describe('Specific trading pair symbol to get info for (optional)'),
  }),
  execute: async ({ symbol }: { symbol?: string | null }) => {
    console.log('Fetching Binance exchange info');

    try {
      const url = symbol 
        ? `https://api.binance.com/api/v3/exchangeInfo?symbol=${symbol.toUpperCase()}`
        : 'https://api.binance.com/api/v3/exchangeInfo';

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        symbols: data.symbols?.map((s: any) => ({
          symbol: s.symbol,
          baseAsset: s.baseAsset,
          quoteAsset: s.quoteAsset,
          status: s.status,
          filters: s.filters,
        })) || [],
        source: 'Binance API',
        url: 'https://www.binance.com/en/exchange',
      };
    } catch (error) {
      console.error('Binance exchange info error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
});

