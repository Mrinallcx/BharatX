'use client';

import React, { useState, useCallback, memo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import {
  NewTwitterIcon,
  AppleStocksIcon,
  Bitcoin02Icon,
  MicroscopeIcon,
  ArrowRight01Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

interface ExampleItem {
  text: string;
  group?: string;
}

interface Category {
  id: string;
  name: string;
  icon: typeof NewTwitterIcon;
  examples: ExampleItem[];
  badge?: string;
}

const categories: Category[] = [
  {
    id: 'crypto',
    name: 'Crypto',
    icon: Bitcoin02Icon,
    examples: [
      { text: 'What is the current price of Bitcoin?', group: 'crypto' },
      { text: 'Show me Ethereum OHLC chart for the last 30 days', group: 'crypto' },
      { text: 'Top trending cryptocurrencies right now', group: 'crypto' },
      { text: 'Compare Solana vs Ethereum market cap', group: 'crypto' },
    ],
  },
  {
    id: 'stocks',
    name: 'Stocks',
    icon: AppleStocksIcon,
    examples: [
      { text: 'NVIDIA stock price and recent performance', group: 'stocks' },
      { text: 'Compare AAPL vs MSFT stock charts', group: 'stocks' },
      { text: 'Latest Tesla earnings report analysis', group: 'stocks' },
      { text: 'S&P 500 market trend today', group: 'stocks' },
    ],
  },
  {
    id: 'x',
    name: 'X Search',
    icon: NewTwitterIcon,
    examples: [
      { text: 'What is Elon Musk posting about crypto?', group: 'x' },
      { text: 'Latest crypto market sentiment on X', group: 'x' },
      { text: 'Breaking news about Bitcoin regulation', group: 'x' },
      { text: 'What are traders saying about the market?', group: 'x' },
    ],
  },
  {
    id: 'agent-thor',
    name: 'Agent Thor',
    icon: MicroscopeIcon,
    badge: 'Deep research',
    examples: [
      {
        text: 'Full Ethereum investment brief: live price, 1-year OHLC chart, L2 growth, staking yields, regulatory risks, and a clear buy/hold/sell verdict with cited sources',
        group: 'agent-thor',
      },
      {
        text: 'Research NVIDIA end-to-end: stock chart, valuation vs AMD, AI datacenter revenue outlook, and latest analyst revisions — structured report with links',
        group: 'agent-thor',
      },
      {
        text: 'Is Bitcoin still a macro hedge in 2026? Compare BTC vs gold and the S&P 500, ETF flows, and Fed policy impact with a sourced investment view',
        group: 'agent-thor',
      },
    ],
  },
  // Prediction mode hidden from main UI — re-enable with search mode
  // {
  //   id: 'prediction',
  //   name: 'Prediction',
  //   icon: Chart03Icon,
  //   examples: [
  //     { text: 'Will Bitcoin reach $150k by end of 2026?', group: 'prediction' },
  //     { text: 'US presidential election 2028 odds', group: 'prediction' },
  //     { text: 'Will the Fed cut interest rates this year?', group: 'prediction' },
  //     { text: 'Crypto market cap prediction markets', group: 'prediction' },
  //   ],
  // },
  // {
  //   id: 'multi-agent',
  //   name: 'Multi-agent',
  //   icon: AtomicPowerIcon,
  //   examples: [
  //     { text: 'Compare GPT-5 vs Claude 4 vs Gemini 2.5 benchmarks', group: 'multi-agent' },
  //     { text: 'Latest developments in decentralized finance 2026', group: 'multi-agent' },
  //     { text: 'What are traders saying about the next Bitcoin halving?', group: 'multi-agent' },
  //     { text: 'Research the current state of AI regulation worldwide', group: 'multi-agent' },
  //   ],
  //   },
];

interface ExampleCategoriesProps {
  onSelectExample: (text: string, group?: string) => void;
  className?: string;
}

export const ExampleCategories = memo(({ onSelectExample, className }: ExampleCategoriesProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleCategoryClick = useCallback((categoryId: string) => {
    setSelectedCategory((prev) => (prev === categoryId ? null : categoryId));
  }, []);

  const handleExampleSelect = useCallback(
    (text: string, group?: string) => {
      onSelectExample(text, group);
      setSelectedCategory(null);
    },
    [onSelectExample],
  );

  const handleDismiss = useCallback(() => {
    setSelectedCategory(null);
  }, []);

  useEffect(() => {
    if (!selectedCategory) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setSelectedCategory(null);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedCategory(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [selectedCategory]);

  const activeCategory = categories.find((c) => c.id === selectedCategory);

  return (
    <div className={cn('w-full relative', className)}>
      <div
        className={cn(
          'flex items-center justify-center gap-2 flex-wrap transition-opacity duration-150',
          selectedCategory ? 'opacity-0 pointer-events-none' : 'opacity-100',
        )}
      >
        {categories.map((category) => (
          <motion.button
            key={category.id}
            onClick={() => handleCategoryClick(category.id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium',
              'border border-border bg-background text-muted-foreground',
              'hover:bg-secondary hover:text-secondary-foreground hover:border-secondary',
              'transition-colors duration-150',
            )}
            whileTap={{ scale: 0.97 }}
          >
            <HugeiconsIcon icon={category.icon} size={14} strokeWidth={1.5} />
            <span>{category.name}</span>
            {category.badge && (
              <span className="px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide rounded bg-secondary text-secondary-foreground">
                {category.badge}
              </span>
            )}
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {activeCategory && (
          <motion.div
            ref={cardRef}
            key={activeCategory.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-x-0 top-0 z-10 border rounded-md bg-card"
          >
            <button
              onClick={handleDismiss}
              className="flex items-center justify-between w-full px-3 sm:px-4 py-2.5 sm:py-3"
            >
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={activeCategory.icon} size={16} className="sm:size-[18px]" strokeWidth={1.5} />
                <span className="text-sm sm:text-base font-medium">{activeCategory.name}</span>
                {activeCategory.badge && (
                  <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium uppercase tracking-wide rounded bg-secondary text-secondary-foreground">
                    {activeCategory.badge}
                  </span>
                )}
              </div>
              <div
                className={cn(
                  'flex items-center justify-center h-6 w-6 sm:h-7 sm:w-7 rounded-md',
                  'text-muted-foreground',
                  'bg-muted/50',
                )}
              >
                <HugeiconsIcon icon={Cancel01Icon} size={12} className="sm:size-[14px]" strokeWidth={2} />
              </div>
            </button>

            <div className="p-1 sm:p-1.5">
              {activeCategory.examples.map((example) => (
                <button
                  key={example.text}
                  onClick={() => handleExampleSelect(example.text, example.group)}
                  className={cn(
                    'group flex items-center justify-between w-full px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-sm',
                    'text-left text-xs sm:text-sm transition-colors',
                    'text-muted-foreground hover:text-foreground hover:bg-accent',
                  )}
                >
                  <span className="line-clamp-2">{example.text}</span>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    size={12}
                    className="sm:size-[14px] shrink-0 ml-2 opacity-0 -translate-x-1 transition-all group-hover:opacity-50 group-hover:translate-x-0"
                    strokeWidth={2}
                  />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

ExampleCategories.displayName = 'ExampleCategories';
