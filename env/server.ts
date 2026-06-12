// https://env.t3.gg/docs/nextjs#create-your-schema
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const serverEnv = createEnv({
  server: {
    XAI_API_KEY: z.string().min(1),
    MOONSHOT_API_KEY: z.string().min(1),
    OPENAI_API_KEY: z.string().min(1),
    ANTHROPIC_API_KEY: z.string().min(1),
    GROQ_API_KEY: z.string().min(1),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
    DAYTONA_API_KEY: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(1),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    TWITTER_CLIENT_ID: z.string().min(1),
    TWITTER_CLIENT_SECRET: z.string().min(1),
    REDIS_URL: z.string().min(1),
    UPSTASH_REDIS_REST_URL: z.string().min(1),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
    ELEVENLABS_API_KEY: z.string().min(1),
    TAVILY_API_KEY: z.string().min(1),
    EXA_API_KEY: z.string().min(1),
    VALYU_API_KEY: z.string().min(1),
    TMDB_API_KEY: z.string().min(1),
    YT_ENDPOINT: z.string().min(1),
    FIRECRAWL_API_KEY: z.string().min(1),
    PARALLEL_API_KEY: z.string().min(1),
    OPENWEATHER_API_KEY: z.string().min(1),
    GOOGLE_MAPS_API_KEY: z.string().min(1),
    AMADEUS_API_KEY: z.string().min(1),
    AMADEUS_API_SECRET: z.string().min(1),
    CRON_SECRET: z.string().min(1),
    BLOB_READ_WRITE_TOKEN: z.string().min(1),
    SMITHERY_API_KEY: z.string().min(1),
    COINGECKO_API_KEY: z.string().min(1),
    QSTASH_TOKEN: z.string().min(1),
    RESEND_API_KEY: z.string().min(1),
    SUPERMEMORY_API_KEY: z.string().min(1),
    ALLOWED_ORIGINS: z.string().optional().default('http://localhost:3000'),
    /** When true, `/api/widget/*` routes are active. */
    WIDGET_ENABLED: z
      .string()
      .optional()
      .default('false')
      .transform((v) => v === 'true' || v === '1'),
    /**
     * JSON array: `[{ "siteKey": "uuid", "hosts": ["localhost", "example.com", "*.vercel.app"] }]`
     * Origins must match one of `hosts` (hostname only, case-insensitive). `*.suffix` matches subdomains.
     */
    WIDGET_SITES_JSON: z.string().optional().default('[]'),
    /** Upstash Vector REST endpoint for widget RAG (optional; RAG disabled if missing). */
    WIDGET_VECTOR_REST_URL: z.string().optional(),
    WIDGET_VECTOR_REST_TOKEN: z.string().optional(),
    MONGODB_URI: z.string().optional().default('mongodb://localhost:27017'),
    MONGODB_DB: z.string().optional().default('groww_market_data'),
  },
  experimental__runtimeEnv: process.env,
});
