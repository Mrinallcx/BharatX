import { serverEnv } from '@/env/server';
import { getWidgetRateLimit } from '@/lib/rate-limit';

/**
 * Lightweight health check for monitors. No secrets.
 */
export async function GET() {
  const enabled = serverEnv.WIDGET_ENABLED;
  const ratelimitConfigured = getWidgetRateLimit() !== null;
  return Response.json({
    ok: true,
    widgetEnabled: enabled,
    ratelimitConfigured,
  });
}
