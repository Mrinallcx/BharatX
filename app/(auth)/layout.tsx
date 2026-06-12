'use client';

import Link from 'next/link';
import { BharatXLogo } from '@/components/logos/scira-logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {

  return (
    <div className="flex items-center justify-between h-screen bg-background">
      <div className="hidden lg:flex lg:w-1/2 h-full bg-muted/30 flex-col">
        <div className="flex-1 flex flex-col justify-between p-12">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
              <BharatXLogo className="size-8" />
              <span className="text-lg font-medium">BharatX</span>
            </Link>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-semibold text-foreground mb-3">AI Search that actually understands you</h2>
              <p className="text-muted-foreground">Skip the ads. Get real answers. From the latest AI models.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <a href="https://github.com/Mrinallcx/BharatX" target="_blank" className="hover:text-foreground transition-colors">
                Open Source
              </a>
              <span>•</span>
              <span>Live Search</span>
              <span>•</span>
              <span>1M+ Searches served</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Featured on{' '}
              <a
                href="https://vercel.com/blog/ai-sdk-4-1"
                target="_blank"
                className="hover:text-foreground transition-colors"
              >
                Vercel
              </a>{' '}
              •{' '}
              <a
                href="https://github.com/Mrinallcx/BharatX"
                target="_blank"
                className="hover:text-foreground transition-colors"
              >
                #1 Product of the Week on Peerlist
              </a>
            </p>
          </div>
        </div>
      </div>
      <div className="w-full lg:w-1/2 h-full flex flex-col items-center justify-center px-4 md:px-8">{children}</div>
    </div>
  );
}
