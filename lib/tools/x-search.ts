import { tool } from 'ai';
import { z } from 'zod';
import { getTweet } from 'react-tweet/api';
import { serverEnv } from '@/env/server';

const XAI_RESPONSES_URL = 'https://api.x.ai/v1/responses';

export const xSearchTool = tool({
  description:
    'Search X (formerly Twitter) posts using xAI X Search with multiple queries for the past 15 days by default otherwise user can specify a date range. Use EITHER includeXHandles OR excludeXHandles — never both (X API constraint). Those fields are for X usernames only (e.g. elonmusk), not generic keywords; put sentiment or topic filters in the query strings instead.',
  inputSchema: z
    .object({
      queries: z.array(z.string()).describe('Array of search queries for X posts. Minimum 1, recommended 3-5.').min(1).max(5),
      startDate: z
        .string()
        .optional()
        .describe(
          'The start date of the search in the format YYYY-MM-DD (always default to 15 days ago if not specified)',
        ),
      endDate: z
        .string()
        .optional()
        .describe('The end date of the search in the format YYYY-MM-DD (default to today if not specified)'),
      includeXHandles: z
        .array(z.string())
        .max(10)
        .optional()
        .describe('X usernames to limit search to (max 10). Mutually exclusive with excludeXHandles in the API.'),
      excludeXHandles: z
        .array(z.string())
        .max(10)
        .optional()
        .describe('X usernames to exclude (max 10). Mutually exclusive with includeXHandles. Not for words like "bullish" — use queries for that.'),
    })
    .transform((data) => {
      const hasInc = Array.isArray(data.includeXHandles) && data.includeXHandles.length > 0;
      const hasExc = Array.isArray(data.excludeXHandles) && data.excludeXHandles.length > 0;
      if (hasInc && hasExc) {
        console.warn(
          '[x_search] Both includeXHandles and excludeXHandles were set; keeping includeXHandles only (API allows one mode).',
        );
        return { ...data, excludeXHandles: undefined };
      }
      return data;
    }),
  execute: async ({
    queries,
    startDate,
    endDate,
    includeXHandles,
    excludeXHandles,
  }) => {
    try {
      const sanitizeHandle = (handle: string) => handle.replace(/^@+/, '').trim();

      const normalizedInclude = Array.isArray(includeXHandles)
        ? includeXHandles.map(sanitizeHandle).filter(Boolean)
        : undefined;
      const normalizedExclude = Array.isArray(excludeXHandles)
        ? excludeXHandles.map(sanitizeHandle).filter(Boolean)
        : undefined;

      const toYMD = (d: Date) => d.toISOString().slice(0, 10);
      const today = new Date();
      const daysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      const effectiveStart = startDate && startDate.trim().length > 0 ? startDate : toYMD(daysAgo);
      const effectiveEnd = endDate && endDate.trim().length > 0 ? endDate : toYMD(today);

      console.log('[X search - queries]:', queries);
      console.log('[X search - includeHandles]:', normalizedInclude, '[excludeHandles]:', normalizedExclude);

      const searchPromises = queries.map(async (query) => {
        try {
          // Build x_search tool config for the Responses API
          const xSearchToolConfig: Record<string, unknown> = { type: 'x_search' };
          if (effectiveStart) xSearchToolConfig.from_date = effectiveStart;
          if (effectiveEnd) xSearchToolConfig.to_date = effectiveEnd;
          if (normalizedInclude?.length) xSearchToolConfig.allowed_x_handles = normalizedInclude;
          if (normalizedExclude?.length) xSearchToolConfig.excluded_x_handles = normalizedExclude;

          const response = await fetch(XAI_RESPONSES_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${serverEnv.XAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'grok-4-fast-non-reasoning',
              input: [
                {
                  role: 'system',
                  content:
                    'You are a helpful assistant that searches for X posts and returns the results in a structured format. Cite sources inline. Go very deep in the search and return the most relevant results.',
                },
                { role: 'user', content: query },
              ],
              tools: [xSearchToolConfig],
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`xAI Responses API error ${response.status}: ${errText}`);
          }

          const data = await response.json();
          console.log(`[X search data for "${query}"]: `, JSON.stringify(data).slice(0, 500));

          // Extract text and URL annotations from the Responses API output
          const messageOutput = data.output?.find((o: any) => o.type === 'message');
          const textContent = messageOutput?.content?.find((c: any) => c.type === 'output_text');
          const text: string = textContent?.text ?? '';
          const annotations: any[] = textContent?.annotations ?? [];

          // Map URL annotations to citations compatible with existing output shape
          const citations = annotations
            .filter((a) => a.url)
            .map((a) => ({ sourceType: 'url' as const, url: a.url as string }));

          // Fetch tweet content for X post URLs
          const tweetFetchPromises = citations
            .filter((c) => /x\.com|twitter\.com/.test(c.url))
            .map(async (c) => {
              try {
                const tweetId = c.url.match(/\/status\/(\d+)/)?.[1] ?? '';
                if (!tweetId) return null;
                const tweetData = await getTweet(tweetId);
                if (!tweetData?.text) return null;
                return { text: tweetData.text, link: c.url };
              } catch (error) {
                console.error(`Error fetching tweet for ${c.url}:`, error);
                return null;
              }
            });

          const tweetResults = await Promise.all(tweetFetchPromises);
          const sources = tweetResults.filter((r) => r !== null);

          return {
            content: text,
            citations,
            sources,
            query,
            dateRange: `${effectiveStart} to ${effectiveEnd}`,
            handles: normalizedInclude || normalizedExclude || [],
          };
        } catch (error) {
          console.error(`X search error for query "${query}":`, error);
          return {
            content: '',
            citations: [],
            sources: [],
            query,
            dateRange: `${effectiveStart} to ${effectiveEnd}`,
            handles: normalizedInclude || normalizedExclude || [],
          };
        }
      });

      const searches = await Promise.all(searchPromises);

      return {
        searches,
        dateRange: `${effectiveStart} to ${effectiveEnd}`,
        handles: normalizedInclude || normalizedExclude || [],
      };
    } catch (error) {
      console.error('X search error:', error);
      throw error;
    }
  },
});
