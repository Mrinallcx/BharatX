import { z } from 'zod';
import { serverEnv } from '@/env/server';
import { findOrgByAdminSecret, findSiteByKey, parseWidgetSitesJson } from '@/lib/widget/embed-config';
import { ingestSite } from '@/lib/widget/rag/ingest';

export const maxDuration = 300;

const bodySchema = z.object({
  siteKey: z.string().min(1).max(128),
  maxPages: z.number().int().min(1).max(1000).optional().default(200),
});

/**
 * Admin trigger to crawl a partner site and index it for RAG.
 *
 * Auth: `Authorization: Bearer <token>` where token is either:
 * - The global `CRON_SECRET` (has access to all orgs)
 * - An org-specific `adminSecret` (only has access to that org's sites)
 */
export async function POST(req: Request) {
  if (!serverEnv.WIDGET_ENABLED) {
    return Response.json({ error: 'Widget not enabled' }, { status: 404 });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const orgs = parseWidgetSitesJson(serverEnv.WIDGET_SITES_JSON);

  const isGlobalAdmin = token === serverEnv.CRON_SECRET;
  const matchedOrg = isGlobalAdmin ? null : findOrgByAdminSecret(orgs, token);

  if (!isGlobalAdmin && !matchedOrg) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { siteKey, maxPages } = parsed.data;
  const pair = findSiteByKey(orgs, siteKey);

  if (!pair) {
    return Response.json({ error: 'Site key not found' }, { status: 404 });
  }

  // Org-scoped admin can only crawl their own sites
  if (matchedOrg && matchedOrg.orgId !== pair.org.orgId) {
    return Response.json({ error: 'Site does not belong to your organisation' }, { status: 403 });
  }

  if (!pair.site.crawlUrl) {
    return Response.json({ error: 'No crawlUrl configured for this siteKey' }, { status: 400 });
  }

  if (!pair.site.ragEnabled) {
    return Response.json({ error: 'RAG is not enabled for this siteKey (set ragEnabled: true)' }, { status: 400 });
  }

  try {
    const result = await ingestSite(siteKey, pair.site.crawlUrl, { maxPages });
    return Response.json({
      ok: true,
      org: pair.org.orgId,
      ...result,
    });
  } catch (e) {
    console.error('[widget/crawl] Ingest failed:', e);
    return Response.json({ error: 'Ingest failed', message: (e as Error).message }, { status: 502 });
  }
}
