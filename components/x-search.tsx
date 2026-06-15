/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { XLogoIcon } from '@phosphor-icons/react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const Icons = {
  Messages: ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  ExternalLink: ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
    </svg>
  ),
  ChevronDown: ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
};

interface Citation {
  url: string;
  title: string;
  description?: string;
  tweet_id?: string;
  author?: string;
  created_at?: string;
}

interface Source {
  text: string;
  link: string;
  title?: string;
}

interface XSearchQueryResult {
  content: string;
  citations: Citation[];
  sources: Source[];
  query: string;
  dateRange: string;
  handles: string[];
}

interface XSearchResponse {
  searches: XSearchQueryResult[];
  dateRange: string;
  handles: string[];
}

interface XSearchArgs {
  queries?: (string | undefined)[] | string | null;
  startDate?: string;
  endDate?: string;
  includeXHandles?: string[];
  excludeXHandles?: string[];
  postFavoritesCount?: number;
  postViewCount?: number;
  maxResults?: (number | undefined)[] | number | null;
}

interface XPost {
  tweet_id: string;
  url: string;
  text: string;
  handle: string;
}

interface XSearchProps {
  result: XSearchResponse;
  args: XSearchArgs;
  isLoadingMore?: boolean;
}

const XSearchLoadingState = () => {
  return (
    <div className="w-full my-2 border border-border/60 rounded-lg overflow-hidden bg-card/50">
      <div className="px-3 py-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-muted animate-pulse">
            <XLogoIcon className="h-3 w-3 text-muted-foreground" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="h-3 w-24 bg-muted rounded animate-pulse" />
            <div className="h-2 w-36 bg-muted/60 rounded animate-pulse" />
          </div>
        </div>
      </div>
      <div className="p-2.5 space-y-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="p-2 border border-border/60 rounded animate-pulse">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className="h-5 w-5 bg-muted rounded-full" />
                <div className="h-2.5 w-20 bg-muted rounded" />
              </div>
              <div className="space-y-1">
                <div className="h-2 w-full bg-muted rounded" />
                <div className="h-2 w-2/3 bg-muted rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function formatDateRangeLabel(dateRange: string) {
  const [startRaw, endRaw] = dateRange.split(' to ').map((part) => part?.trim());
  const formatPart = (value?: string) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const start = formatPart(startRaw);
  const end = formatPart(endRaw);

  if (start && end) return `${start} - ${end}`;
  if (start) return start;
  if (end) return end;
  return 'Recent posts';
}

function extractHandle(url: string, title?: string) {
  const fromUrl = url.match(/x\.com\/([^/]+)/i)?.[1] ?? url.match(/twitter\.com\/([^/]+)/i)?.[1];
  if (fromUrl && fromUrl !== 'i') return `@${fromUrl}`;
  if (title?.startsWith('@')) return title;
  return title || 'X post';
}

function XPostCard({ post, compact = false }: { post: XPost; compact?: boolean }) {
  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'block rounded-lg border border-border/60 bg-background hover:bg-accent/20 transition-colors',
        compact ? 'p-2.5 min-h-[140px]' : 'p-3',
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1 rounded bg-black dark:bg-white flex-shrink-0">
          <XLogoIcon className="h-2.5 w-2.5 text-white dark:text-black" />
        </div>
        <span className="text-[11px] font-medium text-foreground truncate">{post.handle}</span>
      </div>
      <p className={cn('text-foreground/90 leading-snug whitespace-pre-wrap', compact ? 'text-[11px] line-clamp-5' : 'text-xs line-clamp-6')}>
        {post.text || 'Open post on X'}
      </p>
      <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
        View on X
        <Icons.ExternalLink className="h-2.5 w-2.5" />
      </p>
    </a>
  );
}

function buildPosts(searches: XSearchQueryResult[]): XPost[] {
  const seen = new Set<string>();
  const posts: XPost[] = [];

  for (const search of searches) {
    const sourcesByLink = new Map(search.sources.map((source) => [source.link, source]));

    for (const citation of search.citations) {
      const url = typeof citation === 'string' ? citation : citation.url;
      if (!url || (!url.includes('x.com') && !url.includes('twitter.com'))) continue;

      const tweetId = url.match(/\/status\/(\d+)/)?.[1];
      if (!tweetId || seen.has(tweetId)) continue;

      const source = sourcesByLink.get(url);
      const title = typeof citation === 'object' ? citation.title : '';
      const text = source?.text?.trim() || (typeof citation === 'object' ? citation.description : '') || title || '';

      seen.add(tweetId);
      posts.push({
        tweet_id: tweetId,
        url,
        text,
        handle: extractHandle(url, source?.title || title),
      });
    }
  }

  return posts;
}

const XSearch: React.FC<XSearchProps> = ({ result, isLoadingMore = false }) => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const openAllPosts = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setIsExpanded(true);
    setIsSheetOpen(true);
  }, []);

  if (!result) {
    return <XSearchLoadingState />;
  }

  const posts = useMemo(() => buildPosts(result.searches), [result.searches]);
  const displayedPosts = useMemo(() => posts.slice(0, 3), [posts]);
  const remainingPosts = useMemo(() => posts.slice(3), [posts]);
  const dateRangeLabel = formatDateRangeLabel(result.dateRange);

  const allCitations = result.searches.flatMap((search) => search.citations);
  const nonTweetCitations = allCitations.filter((citation) => {
    const url = typeof citation === 'string' ? citation : citation.url;
    return url && !url.includes('x.com') && !url.includes('twitter.com');
  });

  return (
    <div className="w-full my-2">
      <div className="border border-border/40 rounded-lg overflow-hidden bg-card">
        <div className="w-full px-3 py-2 flex items-center justify-between hover:bg-accent/20 transition-colors group">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 min-w-0 flex-1 text-left"
          >
            <div className="p-1 rounded bg-black dark:bg-white flex-shrink-0">
              <XLogoIcon className="h-3 w-3 text-white dark:text-black" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-xs text-foreground">X Search</h3>
              <p className="text-[10px] text-muted-foreground/80 truncate">
                {posts.length} posts • {dateRangeLabel}
                {isLoadingMore ? ' • loading more…' : ''}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-2 flex-shrink-0">
            {result.searches.length > 1 && (
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-muted/50 text-muted-foreground">
                {result.searches.length} queries
              </span>
            )}
            {posts.length > 0 && (
              <button
                type="button"
                onClick={openAllPosts}
                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                View all
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? 'Collapse X search results' : 'Expand X search results'}
              className="p-0.5 rounded hover:bg-accent/40 transition-colors"
            >
              <Icons.ChevronDown
                className={cn(
                  'h-3 w-3 text-muted-foreground/60 transition-transform duration-200 group-hover:text-muted-foreground',
                  isExpanded && 'rotate-180',
                )}
              />
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-border/40">
            {result.searches.length > 0 && (
              <div className="px-2.5 py-1.5 flex gap-1 overflow-x-auto no-scrollbar bg-transparent">
                {result.searches.map((search, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] shrink-0 bg-background border border-border/40 text-foreground/90"
                  >
                    {search.query}
                  </span>
                ))}
              </div>
            )}

            {posts.length > 0 ? (
              <div className="px-2.5 pb-2.5">
                <div className="flex gap-2.5 overflow-x-auto no-scrollbar">
                  {displayedPosts.map((post, index) => (
                    <motion.div
                      key={post.tweet_id}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.03 }}
                      className="flex-shrink-0 w-[260px] sm:w-[300px]"
                    >
                      <XPostCard post={post} compact />
                    </motion.div>
                  ))}

                  {remainingPosts.length > 0 && (
                    <button
                      type="button"
                      onClick={openAllPosts}
                      className="flex-shrink-0 w-[260px] sm:w-[300px] min-h-[160px] border border-dashed border-border/60 dark:border-2 dark:border-solid dark:border-border rounded-lg flex flex-col items-center justify-center hover:border-border dark:hover:border-border hover:bg-accent/20 transition-colors group"
                    >
                      <div className="p-2 rounded-full bg-muted/50 mb-2 group-hover:bg-muted transition-colors">
                        <Icons.Messages className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="font-medium text-xs text-foreground">+{remainingPosts.length} more</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">View all posts</p>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 px-4">
                <div className="inline-flex p-2 rounded-full bg-muted/50 mb-2">
                  <Icons.Messages className="h-4 w-4 text-muted-foreground/60" />
                </div>
                <p className="text-xs text-muted-foreground/80">No posts found for this search</p>
              </div>
            )}

            {nonTweetCitations.length > 0 && (
              <div className="border-t border-border/40 px-2.5 py-2">
                <h4 className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider mb-1.5">
                  Sources
                </h4>
                <div className="space-y-0.5">
                  {nonTweetCitations.slice(0, 3).map((citation, index) => {
                    const url = typeof citation === 'string' ? citation : citation.url;
                    const title = typeof citation === 'object' ? citation.title : url;
                    return (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 py-1.5 px-2 rounded hover:bg-accent/20 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-foreground/90 truncate leading-tight">{title}</p>
                        </div>
                        <Icons.ExternalLink className="h-2.5 w-2.5 text-muted-foreground/50 group-hover:text-muted-foreground flex-shrink-0 transition-colors" />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {posts.length > 0 && (
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetContent side="right" className="w-full sm:w-[480px] md:w-[550px] sm:max-w-[90vw] p-0">
            <div className="flex flex-col h-full bg-background">
              <SheetHeader className="px-4 py-3 border-b border-border/40">
                <SheetTitle className="flex items-center gap-2 text-sm">
                  <div className="p-1 rounded bg-black dark:bg-white">
                    <XLogoIcon className="h-3 w-3 text-white dark:text-black" />
                  </div>
                  <span>All Posts ({posts.length})</span>
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto p-3">
                <div className="space-y-3 max-w-full sm:max-w-[520px] mx-auto">
                  {posts.map((post, index) => (
                    <motion.div
                      key={post.tweet_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.015 }}
                    >
                      <XPostCard post={post} />
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
};

export default XSearch;
