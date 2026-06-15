// Search limits for free users
export const SEARCH_LIMITS = {
  DAILY_SEARCH_LIMIT: 5,
  EXTREME_SEARCH_LIMIT: 5,
} as const;

/** Flip to `false` to re-enable each page. */
export const TEMPORARILY_DISABLED_PAGES = {
  lookout: true,
  xql: true,
  settings: true,
} as const;

export function isPageTemporarilyDisabled(pathname: string): boolean {
  if (TEMPORARILY_DISABLED_PAGES.lookout && pathname.startsWith('/lookout')) return true;
  if (TEMPORARILY_DISABLED_PAGES.xql && pathname.startsWith('/xql')) return true;
  if (TEMPORARILY_DISABLED_PAGES.settings && pathname.startsWith('/settings')) return true;
  return false;
}

export const PRICING = {
  PRO_MONTHLY: 15, // USD
  PRO_MONTHLY_INR: 1299, // INR for Indian users
} as const;

export const CURRENCIES = {
  USD: 'USD',
  INR: 'INR',
} as const;

export const SNAPSHOT_NAME = 'bharatx-analysis:1752127473';
