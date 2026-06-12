'use client';

import React, { useEffect, useMemo, useState } from 'react';

type TickerItem = {
  id: string;
  label: string;
  symbol: string;
  price: number;
  changePct: number;
  source: 'yahoo' | 'binance';
  delayed?: boolean;
  asOf: string;
};

type TickerApiResponse = {
  success: boolean;
  updatedAt: string;
  items: TickerItem[];
};

const REFRESH_MS = 15_000;

/** Fixed strip height — keep in sync with navbar `top-*` offset. */
export const MARKET_TICKER_HEIGHT_CLASS = 'h-7';

function formatUsdPrice(price: number) {
  if (!Number.isFinite(price)) return '--';

  const abs = Math.abs(price);
  const decimals = abs >= 1000 ? 0 : abs >= 100 ? 2 : abs >= 1 ? 2 : 4;
  return `$${price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function formatChange(changePct: number) {
  if (!Number.isFinite(changePct)) return '--';
  const sign = changePct > 0 ? '+' : '';
  return `${sign}${changePct.toFixed(2)}%`;
}

export function MarketTickerStrip() {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadTicker = async () => {
      try {
        const response = await fetch('/api/market-ticker', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = (await response.json()) as TickerApiResponse;
        if (!mounted || !payload?.success || !Array.isArray(payload.items)) return;
        setItems(payload.items);
      } catch {
        // Leave last successful values on screen.
      } finally {
        if (mounted) {
          setHasLoaded(true);
        }
      }
    };

    loadTicker();
    const timer = window.setInterval(loadTicker, REFRESH_MS);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const loopedItems = useMemo(() => (items.length > 0 ? [...items, ...items] : []), [items]);

  if (!hasLoaded || loopedItems.length === 0) {
    return null;
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-40 w-full overflow-hidden bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60 ${MARKET_TICKER_HEIGHT_CLASS}`}
    >
      <div className="market-ticker-track flex h-full w-max min-w-full items-center gap-8 px-3">
        {loopedItems.map((item, index) => {
          const isPositive = item.changePct >= 0;
          return (
            <div key={`${item.id}-${index}`} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm">
              <span className="font-semibold tracking-tight text-blue-600 dark:text-blue-400">{item.label}</span>
              <span className="text-foreground/90">{formatUsdPrice(item.price)}</span>
              <span className={isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                {formatChange(item.changePct)}
              </span>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .market-ticker-track {
          animation: market-ticker-scroll 40s linear infinite;
          will-change: transform;
        }

        .market-ticker-track:hover {
          animation-play-state: paused;
        }

        @keyframes market-ticker-scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .market-ticker-track {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
