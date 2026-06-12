import {
  AtomicPowerIcon,
  GlobalSearchIcon,
  MicroscopeIcon,
  YoutubeIcon,
  RedditIcon,
  Github01Icon,
  AppleStocksIcon,
  NewTwitterIcon,
  Chart03Icon,
} from '@hugeicons/core-free-icons';

// Search modes available for lookouts (non-auth-required modes only)
export const LOOKOUT_SEARCH_MODES = [
  { value: 'extreme', label: 'Extreme', icon: AtomicPowerIcon, description: 'Deep research with multiple sources' },
  { value: 'web', label: 'Web', icon: GlobalSearchIcon, description: 'Search across the web' },
  { value: 'academic', label: 'Academic', icon: MicroscopeIcon, description: 'Search academic papers' },
  { value: 'youtube', label: 'YouTube', icon: YoutubeIcon, description: 'Search YouTube videos' },
  { value: 'reddit', label: 'Reddit', icon: RedditIcon, description: 'Search Reddit posts' },
  { value: 'github', label: 'GitHub', icon: Github01Icon, description: 'Search GitHub repositories' },
  { value: 'stocks', label: 'Stocks', icon: AppleStocksIcon, description: 'Stock information' },
  { value: 'x', label: 'X', icon: NewTwitterIcon, description: 'Search X posts' },
  { value: 'finagent', label: 'FinAgent', icon: Chart03Icon, description: 'Crypto · Stocks · Prediction markets · On-chain' },
] as const;

export type LookoutSearchMode = (typeof LOOKOUT_SEARCH_MODES)[number]['value'];

export const frequencyOptions = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export const timezoneOptions = [
  // UTC
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },

  // North America
  { value: 'America/New_York', label: 'Eastern Time (New York)' },
  { value: 'America/Chicago', label: 'Central Time (Chicago)' },
  { value: 'America/Denver', label: 'Mountain Time (Denver)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska Time (Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (Honolulu)' },
  { value: 'America/Toronto', label: 'Eastern Time (Toronto)' },
  { value: 'America/Vancouver', label: 'Pacific Time (Vancouver)' },
  { value: 'America/Mexico_City', label: 'Central Time (Mexico City)' },

  // Europe
  { value: 'Europe/London', label: 'Greenwich Mean Time (London)' },
  { value: 'Europe/Paris', label: 'Central European Time (Paris)' },
  { value: 'Europe/Berlin', label: 'Central European Time (Berlin)' },
  { value: 'Europe/Rome', label: 'Central European Time (Rome)' },
  { value: 'Europe/Madrid', label: 'Central European Time (Madrid)' },
  { value: 'Europe/Amsterdam', label: 'Central European Time (Amsterdam)' },
  { value: 'Europe/Brussels', label: 'Central European Time (Brussels)' },
  { value: 'Europe/Vienna', label: 'Central European Time (Vienna)' },
  { value: 'Europe/Zurich', label: 'Central European Time (Zurich)' },
  { value: 'Europe/Stockholm', label: 'Central European Time (Stockholm)' },
  { value: 'Europe/Helsinki', label: 'Eastern European Time (Helsinki)' },
  { value: 'Europe/Moscow', label: 'Moscow Standard Time (Moscow)' },
  { value: 'Europe/Istanbul', label: 'Turkey Time (Istanbul)' },
  { value: 'Europe/Athens', label: 'Eastern European Time (Athens)' },

  // Asia
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (Tokyo)' },
  { value: 'Asia/Shanghai', label: 'China Standard Time (Shanghai)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong Time (Hong Kong)' },
  { value: 'Asia/Singapore', label: 'Singapore Standard Time (Singapore)' },
  { value: 'Asia/Seoul', label: 'Korea Standard Time (Seoul)' },
  { value: 'Asia/Bangkok', label: 'Indochina Time (Bangkok)' },
  { value: 'Asia/Jakarta', label: 'Western Indonesia Time (Jakarta)' },
  { value: 'Asia/Manila', label: 'Philippine Standard Time (Manila)' },
  { value: 'Asia/Kuala_Lumpur', label: 'Malaysia Time (Kuala Lumpur)' },
  { value: 'Asia/Taipei', label: 'Taipei Standard Time (Taipei)' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (Kolkata/Mumbai)' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (Dubai)' },
  { value: 'Asia/Riyadh', label: 'Arabia Standard Time (Riyadh)' },
  { value: 'Asia/Tehran', label: 'Iran Standard Time (Tehran)' },
  { value: 'Asia/Jerusalem', label: 'Israel Standard Time (Jerusalem)' },

  // Australia & Oceania
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (Sydney)' },
  { value: 'Australia/Melbourne', label: 'Australian Eastern Time (Melbourne)' },
  { value: 'Australia/Brisbane', label: 'Australian Eastern Time (Brisbane)' },
  { value: 'Australia/Perth', label: 'Australian Western Time (Perth)' },
  { value: 'Australia/Adelaide', label: 'Australian Central Time (Adelaide)' },
  { value: 'Australia/Darwin', label: 'Australian Central Time (Darwin)' },
  { value: 'Pacific/Auckland', label: 'New Zealand Time (Auckland)' },
  { value: 'Pacific/Fiji', label: 'Fiji Time (Fiji)' },

  // Africa
  { value: 'Africa/Cairo', label: 'Eastern European Time (Cairo)' },
  { value: 'Africa/Johannesburg', label: 'South Africa Standard Time (Johannesburg)' },
  { value: 'Africa/Lagos', label: 'West Africa Time (Lagos)' },
  { value: 'Africa/Nairobi', label: 'East Africa Time (Nairobi)' },
  { value: 'Africa/Casablanca', label: 'Western European Time (Casablanca)' },

  // South America
  { value: 'America/Sao_Paulo', label: 'Brasilia Time (São Paulo)' },
  { value: 'America/Buenos_Aires', label: 'Argentina Time (Buenos Aires)' },
  { value: 'America/Santiago', label: 'Chile Time (Santiago)' },
  { value: 'America/Lima', label: 'Peru Time (Lima)' },
  { value: 'America/Bogota', label: 'Colombia Time (Bogotá)' },
  { value: 'America/Caracas', label: 'Venezuela Time (Caracas)' },
];

export const allExampleLookouts = [
  // EXTREME MODE
  {
    title: 'Daily AI News Digest',
    prompt: 'Summarize the most important AI & Tech developments from the past 24 hours, including new product launches, funding rounds, and breakthrough research papers. Focus on practical applications and industry impact.',
    frequency: 'daily',
    time: '09:00',
    timezone: 'America/New_York',
    searchMode: 'extreme',
  },
  {
    title: 'Weekly Startup Funding Roundup',
    prompt: 'Compile a detailed report of all significant startup funding rounds from the past week. Include Series A, B, C rounds and notable seed funding. Focus on emerging sectors like AI, fintech, healthtech, and climate tech.',
    frequency: 'weekly',
    time: '11:00',
    timezone: 'America/Los_Angeles',
    dayOfWeek: '1',
    searchMode: 'extreme',
  },
  // WEB MODE
  {
    title: 'Daily Tech Acquisitions & Mergers',
    prompt: 'Monitor and report on any technology company acquisitions, mergers, or strategic partnerships announced in the past 24 hours.',
    frequency: 'daily',
    time: '14:00',
    timezone: 'Europe/Berlin',
    searchMode: 'web',
  },
  {
    title: 'Weekly Cybersecurity Incidents',
    prompt: 'Compile a comprehensive report of significant cybersecurity incidents, breaches, and vulnerabilities discovered in the past week.',
    frequency: 'weekly',
    time: '15:30',
    timezone: 'UTC',
    dayOfWeek: '3',
    searchMode: 'web',
  },
  // ACADEMIC MODE
  {
    title: 'Weekly Machine Learning Research',
    prompt: 'Find and summarize the most impactful machine learning papers published this week. Cover topics like large language models, computer vision, reinforcement learning, and AI safety.',
    frequency: 'weekly',
    time: '10:00',
    timezone: 'America/New_York',
    dayOfWeek: '1',
    searchMode: 'academic',
  },
  // YOUTUBE MODE
  {
    title: 'Weekly Tech YouTube Roundup',
    prompt: 'Find the most popular and informative tech YouTube videos from the past week. Include product reviews, tutorials, and tech news coverage.',
    frequency: 'weekly',
    time: '18:00',
    timezone: 'America/New_York',
    dayOfWeek: '6',
    searchMode: 'youtube',
  },
  // REDDIT MODE
  {
    title: 'Daily Reddit Tech Discussions',
    prompt: 'Monitor top discussions from r/technology, r/programming, and r/startups from the past 24 hours. Summarize trending topics and popular opinions.',
    frequency: 'daily',
    time: '21:00',
    timezone: 'America/Los_Angeles',
    searchMode: 'reddit',
  },
  // GITHUB MODE
  {
    title: 'Weekly Trending GitHub Repos',
    prompt: 'Find the most starred and trending GitHub repositories from the past week. Include new developer tools, open source projects, and interesting libraries.',
    frequency: 'weekly',
    time: '10:00',
    timezone: 'UTC',
    dayOfWeek: '1',
    searchMode: 'github',
  },
  // STOCKS MODE
  {
    title: 'Daily Stock Market Summary',
    prompt: "Provide a comprehensive summary of today's stock market performance. Include major index movements (S&P 500, NASDAQ, DOW), notable earnings, and market-moving events.",
    frequency: 'daily',
    time: '16:30',
    timezone: 'America/New_York',
    searchMode: 'stocks',
  },
  {
    title: 'Weekly Large-Cap Watch',
    prompt:
      'Summarize recent price action for AAPL, MSFT, and NVDA. Note day change, recent trend from the chart, and key levels. Keep citations to data shown in the tool output.',
    frequency: 'weekly',
    time: '09:30',
    timezone: 'America/New_York',
    dayOfWeek: '1',
    searchMode: 'stocks',
  },
  // FINAGENT MODE
  {
    title: 'Daily Crypto Intelligence Brief',
    prompt: 'Run a comprehensive daily crypto intelligence report. Fetch live prices and 24h OHLC data for BTC, ETH, SOL, and BNB. Check prediction markets for active crypto-related events. Search X/Twitter for top trending crypto narratives. Write a structured brief with current prices, key prediction market odds, top social narratives, and a risk-on/risk-off signal.',
    frequency: 'daily',
    time: '08:00',
    timezone: 'America/New_York',
    searchMode: 'finagent',
  },
  {
    title: 'Weekly Crypto + Macro Fusion Report',
    prompt: 'Generate a weekly crypto and macro fusion report. Fetch BTC, ETH, SOL weekly performance. Get USD/JPY, DXY-proxy, and gold price for macro backdrop. Query prediction markets for Fed rate decisions and crypto regulation events. Synthesize into a weekly brief.',
    frequency: 'weekly',
    time: '09:00',
    timezone: 'America/New_York',
    dayOfWeek: '1',
    searchMode: 'finagent',
  },
  {
    title: 'Weekly Prediction Market Opportunities',
    prompt: 'Identify the highest-value prediction market opportunities this week. Search Polymarket and Kalshi for active markets related to crypto, macro, and geopolitical events. For each top opportunity, fetch relevant price data and run expected value calculations.',
    frequency: 'weekly',
    time: '08:00',
    timezone: 'America/New_York',
    dayOfWeek: '1',
    searchMode: 'finagent',
  },
  // X MODE
  {
    title: 'Daily Tech Twitter Highlights',
    prompt: 'Curate the most engaging and informative posts from Tech Twitter/X in the past 24 hours. Include viral threads, hot takes from industry leaders, and product announcements.',
    frequency: 'daily',
    time: '19:00',
    timezone: 'America/Los_Angeles',
    searchMode: 'x',
  },
];

// Function to get 3 random examples using Fisher-Yates shuffle
export function getRandomExamples(count: number = 3) {
  const shuffled = [...allExampleLookouts];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}

export const exampleLookouts = getRandomExamples(3);

export const LOOKOUT_LIMITS = {
  TOTAL_LOOKOUTS: 10,
  DAILY_LOOKOUTS: 5,
} as const;

export const DEFAULT_FORM_VALUES = {
  FREQUENCY: 'daily',
  TIME: '09:00',
  TIMEZONE: 'UTC',
  DAY_OF_WEEK: '0',
  SEARCH_MODE: 'extreme',
} as const;

export const dayOfWeekOptions = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];
