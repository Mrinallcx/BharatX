import './globals.css';
import 'katex/dist/katex.min.css';
import 'leaflet/dist/leaflet.css';

import { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro, Inter, Baumans } from 'next/font/google';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Toaster } from '@/components/ui/sonner';
// import { Databuddy } from '@databuddy/sdk';

import { Providers } from './providers';

export const metadata: Metadata = {
  metadataBase: new URL('https://bharat0x.xyz'),
  title: {
    default: 'BharatX - Crafted in Bharat, Calculated for the world',
    template: '%s | BharatX',
  },
  description:
    'Crafted in Bharat, Calculated for the world || India\'s first ever finance AI search engine',
  openGraph: {
    url: 'https://bharat0x.xyz',
    siteName: 'BharatX',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'BharatX - Crafted in Bharat, Calculated for the world',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/twitter-image.png'],
  },
  keywords: [
    'bharat0x.xyz',
    'free ai search',
    'ai search',
    'ai research tool',
    'ai search tool',
    'perplexity ai alternative',
    'perplexity alternative',
    'chatgpt alternative',
    'ai search engine',
    'search engine',
    'bharatx ai',
    'BharatX AI',
    'bharatx AI',
    'BHARATX.AI',
    'bharatx github',
    'ai search engine',
    'BharatX',
    'bharatx',
    'bharatx.app',
    'bharatx ai',
    'bharatx ai app',
    'bharatx',
    'Perplexity alternatives',
    'Perplexity AI alternatives',
    'open source ai search engine',
    'minimalistic ai search engine',
    'minimalistic ai search alternatives',
    'ai search',
    'minimal ai search',
    'minimal ai search alternatives',
    'BharatX',
    'AI Search Engine',
    'search engine',
    'AI',
    'perplexity',
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F9F9F9' },
    { media: '(prefers-color-scheme: dark)', color: '#111111' },
  ],
};

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  preload: true,
  weight: 'variable',
  display: 'swap',
});

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin'],
  variable: '--font-be-vietnam-pro',
  preload: true,
  display: 'swap',
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
});

const baumans = Baumans({
  subsets: ['latin'],
  variable: '--font-baumans',
  preload: true,
  display: 'swap',
  weight: ['400'],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${beVietnamPro.variable} ${baumans.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <NuqsAdapter>
          <Providers>
            <Toaster position="top-center" />
            {children}
          </Providers>
        </NuqsAdapter>
        {/* <Databuddy clientId={process.env.DATABUDDY_CLIENT_ID!} enableBatching={true} trackSessions={true} /> */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
