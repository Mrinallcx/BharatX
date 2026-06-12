import type { WidgetSiteConfig } from '@/lib/widget/embed-config';
import { isOriginAllowedForCors } from '@/lib/widget/embed-config';

export function corsHeadersForWidget(
  origin: string | null,
  sites: WidgetSiteConfig[],
): Record<string, string> {
  if (!origin || !isOriginAllowedForCors(origin, sites)) {
    return {};
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
