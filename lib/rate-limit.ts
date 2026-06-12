import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Create a new ratelimiter that allows 3 requests per day for unauthenticated users
export const unauthenticatedRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, '1 d'), // 3 requests per 1 day
  analytics: true,
  prefix: '@upstash/ratelimit:unauth',
});

// Helper function to get IP address from request
export function getClientIdentifier(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] ?? realIp ?? 'unknown';
  return `ip:${ip}`;
}

let widgetRateLimitInstance: Ratelimit | null | undefined;

/** Lazy Upstash limiter for embed widget; `null` if Redis env is unusable (dev / misconfig). */
export function getWidgetRateLimit(): Ratelimit | null {
  if (widgetRateLimitInstance !== undefined) return widgetRateLimitInstance;
  try {
    widgetRateLimitInstance = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      analytics: true,
      prefix: '@upstash/ratelimit:widget',
    });
  } catch (e) {
    console.warn('[widget] Upstash ratelimit unavailable; allowing requests', e);
    widgetRateLimitInstance = null;
  }
  return widgetRateLimitInstance;
}

export async function limitWidgetRequest(
  identifier: string,
): Promise<{ success: boolean; remaining?: number }> {
  const rl = getWidgetRateLimit();
  if (!rl) return { success: true };
  try {
    const result = await rl.limit(identifier);
    return { success: result.success, remaining: result.remaining };
  } catch (e) {
    console.warn('[widget] Upstash ratelimit request failed; allowing request', e);
    return { success: true };
  }
}

