# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commands

**Package manager**: pnpm (required — do not use npm or yarn)

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (http://localhost:3000)
pnpm build            # Production build
pnpm start            # Start production server
pnpm lint             # ESLint (next/core-web-vitals)
pnpm fix              # Prettier auto-format
pnpm knip             # Detect unused exports/dependencies
```

**Database (Drizzle Kit)**:
```bash
pnpm drizzle-kit generate   # Generate migration files from schema changes
pnpm drizzle-kit migrate    # Apply migrations to the database
pnpm drizzle-kit push       # Push schema directly (dev only, no migration file)
pnpm drizzle-kit studio     # Open Drizzle Studio UI
```

There are no automated tests in this repository.

## Environment Setup

Copy `.env` to `.env.local` and fill in keys. All server-side env vars are validated at build time via `@t3-oss/env-nextjs` in `env/server.ts` — the app will fail to start if any required variable is missing. The full list of required keys is defined there (XAI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, DATABASE_URL, REDIS_URL, and many more).

## Architecture

### Request Flow

All AI interactions go through `app/api/search/route.ts` (POST). The frontend sends `{ messages, model, group, id, ... }` and receives a streamed UI message response. The route:
1. Validates the user (guest users are allowed with full access)
2. Resolves the search group config (`getGroupConfig(group)`) to determine which tools are active
3. Calls Vercel AI SDK's `streamText` with the appropriate model, system prompt, and tools
4. After a tool call completes, `prepareStep` disables further tool calls so the model produces a final answer (max 5 steps via `stopWhen: stepCountIs(5)`)
5. Reasoning content is stripped between steps for non-reasoning models to prevent SDK errors

### AI Provider Layer (`ai/providers.ts`)

All models are accessed through a single `bharatX` custom provider (Vercel AI SDK `customProvider`). Internal model aliases (`bharatx-grok-4-fast`, `bharatx-gpt5`, etc.) map to the actual provider/model. Use `bharatX.languageModel('bharatx-...')` everywhere — never import providers directly in route handlers.

The `models` array in `ai/providers.ts` defines UI metadata (label, reasoning support, vision, PDF, category). Helper functions like `hasReasoningSupport()`, `hasPdfSupport()`, `supportsExtremeMode()` query this array.

### Search Groups

Defined in `lib/utils.ts` as `SearchGroupId`: `web | x | academic | youtube | reddit | stocks | chat | extreme | memory | crypto | code | connectors | binance`. Each group activates a subset of tools. The group config (system prompt + active tools list) is fetched via `getGroupConfig()` in `app/actions.ts`.

### Tools (`lib/tools/`)

Each tool is a separate file. They are all re-exported from `lib/tools/index.ts` and registered in `app/api/search/route.ts`. To add a new tool: create a file in `lib/tools/`, export it from `index.ts`, and add it to the `tools` object in the search route. Memory tools (`search_memories`, `add_memory`) and `connectors_search` are only registered when the user is authenticated.

### Database (`lib/db/`)

- **Schema**: `lib/db/schema.ts` — tables: `user`, `session`, `account`, `verification`, `chat`, `message`, `stream`, `subscription`, `payment`, `extremeSearchUsage`, `messageUsage`, `customInstructions`, `lookout`
- **Queries**: `lib/db/queries.ts` — all DB operations, marked `server-only`
- **ORM**: Drizzle with Neon serverless PostgreSQL (`@neondatabase/serverless`)
- Many queries use `.$withCache()` for Neon query caching

### Authentication (`lib/auth.ts`)

Better Auth with Drizzle adapter. Social providers: GitHub, Google, Twitter, Microsoft. Payment integrations: Polar and DodoPayments (both optional — only initialized when their respective env vars are present). Auth routes handled at `app/api/auth/`.

### Frontend State

- `contexts/user-context.tsx`: React context providing `user`, `isProUser`, `subscriptionData` app-wide
- `components/chat-interface.tsx`: Main chat UI using Vercel AI SDK's `useChat` hook + `useReducer` via `components/chat-state.ts`
- `components/data-stream-provider.tsx`: Context for sharing the AI data stream to child components (tool result renderers)
- User preferences (selected model, search group, search provider) are persisted in `localStorage` via `hooks/use-local-storage.tsx`

### Lookout Feature

Scheduled/recurring searches backed by Upstash QStash. Schema in `lookout` table. API routes under `app/api/lookout/`. Server actions in `app/actions.ts`.

### Rate Limiting

Upstash Redis + `@upstash/ratelimit`. Utilities in `lib/rate-limit.ts`. Currently, all limits are bypassed (`shouldBypassRateLimits` always returns `true`), but the infrastructure is in place.

## Code Style

- Prettier: `singleQuote`, `semi`, `trailingComma: "all"`, `printWidth: 120`, `tabWidth: 2`
- `console.log` statements are stripped in production builds (except `console.error`) via Next.js compiler config
- Env vars must always be accessed through `serverEnv` (from `env/server.ts`) or `clientEnv` (from `env/client.ts`), never directly via `process.env` in application code
