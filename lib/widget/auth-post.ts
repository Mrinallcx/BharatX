import { serverEnv } from '@/env/server';
import { getClientIdentifier, limitWidgetRequest } from '@/lib/rate-limit';
import { corsHeadersForWidget } from '@/lib/widget/cors';
import {
  findSiteByKey,
  getAllSites,
  isHostnameAllowed,
  parseWidgetSitesJson,
  resolveRequestHostname,
  type OrgSitePair,
} from '@/lib/widget/embed-config';

export function jsonWidgetResponse(
  data: unknown,
  status: number,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...cors,
    },
  });
}

export function widgetOptionsResponse(req: Request): Response {
  if (!serverEnv.WIDGET_ENABLED) {
    return new Response(null, { status: 404 });
  }
  const orgs = parseWidgetSitesJson(serverEnv.WIDGET_SITES_JSON);
  const allSites = getAllSites(orgs);
  const origin = req.headers.get('origin');
  const cors = corsHeadersForWidget(origin, allSites);
  if (!cors['Access-Control-Allow-Origin']) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers: cors });
}

export type WidgetPostAuthOk = {
  cors: Record<string, string>;
  resolved: OrgSitePair;
};

export async function authenticateWidgetPost(
  req: Request,
  siteKey: string,
): Promise<{ ok: true; data: WidgetPostAuthOk } | { ok: false; response: Response }> {
  if (!serverEnv.WIDGET_ENABLED) {
    return { ok: false, response: new Response(null, { status: 404 }) };
  }

  const orgs = parseWidgetSitesJson(serverEnv.WIDGET_SITES_JSON);
  const allSites = getAllSites(orgs);
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const cors = corsHeadersForWidget(origin, allSites);

  const pair = findSiteByKey(orgs, siteKey);
  if (!pair) {
    return { ok: false, response: jsonWidgetResponse({ error: 'Unauthorized' }, 401, cors) };
  }

  const requestHost = resolveRequestHostname(origin, referer);
  if (!requestHost || !isHostnameAllowed(requestHost, pair.site.hosts)) {
    return {
      ok: false,
      response: jsonWidgetResponse(
        { error: 'Origin not allowed for this site key' },
        403,
        cors,
      ),
    };
  }

  const ip = getClientIdentifier(req);
  const { success: rateOk } = await limitWidgetRequest(`widget:${pair.org.orgId}:${ip}`);
  if (!rateOk) {
    return { ok: false, response: jsonWidgetResponse({ error: 'Too many requests' }, 429, cors) };
  }

  return { ok: true, data: { cors, resolved: pair } };
}
