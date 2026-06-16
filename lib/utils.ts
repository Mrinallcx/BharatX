// /lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  GlobalSearchIcon,
  Database02Icon,
  AtomicPowerIcon,
  Bitcoin02Icon,
  MicroscopeIcon,
  NewTwitterIcon,
  RedditIcon,
  YoutubeIcon,
  ChattingIcon,
  AppleStocksIcon,
  ConnectIcon,
  CodeCircleIcon,
  Chart03Icon,
} from '@hugeicons/core-free-icons';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


export type SearchGroupId =
  | 'web'
  | 'x'
  | 'academic'
  | 'youtube'
  | 'reddit'
  | 'stocks'
  | 'chat'
  | 'extreme'
  | 'memory'
  | 'crypto'
  | 'code'
  | 'connectors'
  | 'prediction'
  | 'technical'
  | 'multi-agent'
  | 'agent-thor';

/** Silent default when no specialized search mode is active. */
export const DEFAULT_SEARCH_GROUP = 'chat' as const satisfies SearchGroupId;

// Search provider information for dynamic descriptions
export const searchProviderInfo = {
  parallel: 'Parallel AI',
  exa: 'Exa',
  tavily: 'Tavily',
  firecrawl: 'Firecrawl',
} as const;

export type SearchProvider = keyof typeof searchProviderInfo;

// Function to get dynamic web search description based on selected provider
export function getWebSearchDescription(provider: SearchProvider = 'parallel'): string {
  const providerName = searchProviderInfo[provider];
  return `Search across the entire internet powered by ${providerName}`;
}

// Function to get search groups with dynamic descriptions
export function getSearchGroups(searchProvider: SearchProvider = 'parallel') {
  return [
    {
      id: 'web' as const,
      name: 'Web',
      description: getWebSearchDescription(searchProvider),
      icon: GlobalSearchIcon,
      show: false, // Hidden from picker — switch via mode badges or localStorage
    },
    {
      id: 'chat' as const,
      name: 'Chat',
      description: 'Talk to the model directly.',
      icon: ChattingIcon,
      show: false, // Default mode — hidden from picker; use Stocks/Crypto/etc. badges to switch
    },
    {
      id: 'x' as const,
      name: 'X',
      description: 'Search X posts',
      icon: NewTwitterIcon,
      show: true,
    },
    {
      id: 'stocks' as const,
      name: 'Stocks',
      description: 'Stock and currency information',
      icon: AppleStocksIcon,
      show: true,
    },
    {
      id: 'connectors' as const,
      name: 'Connectors',
      description: 'Search Google Drive, Notion and OneDrive documents',
      icon: ConnectIcon,
      show: true,
      requireAuth: true,
      requirePro: true,
    },
    {
      id: 'code' as const,
      name: 'Code',
      description: 'Get context about languages and frameworks',
      icon: CodeCircleIcon,
      show: true,
    },
    {
      id: 'academic' as const,
      name: 'Academic',
      description: 'Search academic papers powered by Exa',
      icon: MicroscopeIcon,
      show: true,
    },
    {
      id: 'extreme' as const,
      name: 'Extreme',
      description: 'Deep research with multiple sources and analysis',
      icon: AtomicPowerIcon,
      show: true,
      requireAuth: true,
    },
    {
      id: 'memory' as const,
      name: 'Memory',
      description: 'Your personal memory companion',
      icon: Database02Icon,
      show: true,
      requireAuth: true,
    },
    {
      id: 'reddit' as const,
      name: 'Reddit',
      description: 'Search Reddit posts',
      icon: RedditIcon,
      show: true,
    },
    {
      id: 'crypto' as const,
      name: 'Crypto',
      description: 'Cryptocurrency research powered by CoinGecko',
      icon: Bitcoin02Icon,
      show: true,
    },
    {
      id: 'youtube' as const,
      name: 'YouTube',
      description: 'Search YouTube videos powered by Exa',
      icon: YoutubeIcon,
      show: true,
    },
    {
      id: 'prediction' as const,
      name: 'Prediction',
      description: 'Search prediction markets from Polymarket and Kalshi',
      icon: Chart03Icon,
      show: false, // UI disabled — set true to re-enable Prediction mode
    },
    {
      id: 'multi-agent' as const,
      name: 'Agent Loky',
      description: 'High-agency research with xAI web and X search',
      icon: AtomicPowerIcon,
      show: true,
      comingSoon: true,
    },
    {
      id: 'agent-thor' as const,
      name: 'Agent Thor',
      description: 'High-agency web research powered by Kimi',
      icon: MicroscopeIcon,
      show: true,
    },
    {
      id: 'technical' as const,
      name: 'Technical Analysis',
      description: 'Indicator-based analysis for stocks & crypto. Type / to pick indicators',
      icon: Chart03Icon,
      show: true,
    },
  ] as const;
}

export function isSearchGroupComingSoon(groupId: SearchGroupId): boolean {
  const group = getSearchGroups().find((g) => g.id === groupId);
  return Boolean(group && 'comingSoon' in group && group.comingSoon);
}

// Keep the static searchGroups for backward compatibility
export const searchGroups = getSearchGroups();

export type SearchGroup = (typeof searchGroups)[number];

export function invalidateChatsCache() {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('invalidate-chats-cache');
    window.dispatchEvent(event);
  }
}
