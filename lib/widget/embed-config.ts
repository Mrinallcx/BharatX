import { timingSafeEqual } from 'node:crypto';

// ── Types ──

export type WidgetSiteConfig = {
  siteKey: string;
  hosts: string[];
  crawlUrl?: string;
  ragEnabled?: boolean;
};

export type WidgetOrg = {
  orgId: string;
  name: string;
  apiKey: string;
  /** Server-side secret for admin operations (crawl trigger, etc.). Never exposed client-side. */
  adminSecret?: string;
  sites: WidgetSiteConfig[];
};

/** Resolved pair returned by lookup helpers. */
export type OrgSitePair = { org: WidgetOrg; site: WidgetSiteConfig };

// ── Parsing ──

function parseSite(raw: unknown): WidgetSiteConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const siteKey = o.siteKey;
  const hosts = o.hosts;
  if (typeof siteKey !== 'string' || siteKey.length < 1) return null;
  if (!Array.isArray(hosts) || hosts.length === 0) return null;
  const cleaned = hosts
    .filter((h): h is string => typeof h === 'string' && h.trim().length > 0)
    .map((h) => h.trim());
  if (cleaned.length === 0) return null;
  return {
    siteKey,
    hosts: cleaned,
    crawlUrl: typeof o.crawlUrl === 'string' && o.crawlUrl.trim() ? o.crawlUrl.trim() : undefined,
    ragEnabled: o.ragEnabled === true,
  };
}

function parseOrg(raw: unknown): WidgetOrg | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const orgId = o.orgId;
  const name = o.name;
  const apiKey = o.apiKey;
  const sitesRaw = o.sites;

  if (typeof orgId !== 'string' || orgId.length < 1) return null;
  if (typeof name !== 'string') return null;
  if (typeof apiKey !== 'string' || apiKey.length < 8) return null;
  if (!Array.isArray(sitesRaw) || sitesRaw.length === 0) return null;

  const sites: WidgetSiteConfig[] = [];
  for (const s of sitesRaw) {
    const parsed = parseSite(s);
    if (parsed) sites.push(parsed);
  }
  if (sites.length === 0) return null;

  const adminSecret = typeof o.adminSecret === 'string' && o.adminSecret.trim() ? o.adminSecret.trim() : undefined;

  return { orgId, name, apiKey, adminSecret, sites };
}

/**
 * Parse `WIDGET_SITES_JSON`.
 *
 * Supports two formats:
 * - **Org-based** (new): `[{ orgId, name, apiKey, sites: [...] }]`
 * - **Legacy flat** (old): `[{ siteKey, hosts, ... }]` — auto-wrapped into a single unnamed org.
 */
export function parseWidgetSitesJson(json: string): WidgetOrg[] {
  try {
    const data = JSON.parse(json) as unknown;
    if (!Array.isArray(data)) return [];

    // Detect format: if first item has `orgId`, treat as org-based
    if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null && 'orgId' in data[0]) {
      const orgs: WidgetOrg[] = [];
      for (const item of data) {
        const org = parseOrg(item);
        if (org) orgs.push(org);
      }
      return orgs;
    }

    // Legacy flat format: wrap each site into its own org using siteKey as apiKey
    const orgs: WidgetOrg[] = [];
    for (const item of data) {
      const site = parseSite(item);
      if (!site) continue;
      orgs.push({
        orgId: site.siteKey,
        name: site.siteKey,
        apiKey: site.siteKey,
        sites: [site],
      });
    }
    return orgs;
  } catch {
    return [];
  }
}

// ── Helpers: flatten for CORS + lookup ──

/** Get all sites across all orgs (for CORS preflight). */
export function getAllSites(orgs: WidgetOrg[]): WidgetSiteConfig[] {
  return orgs.flatMap((o) => o.sites);
}

/**
 * Find the org + site matching a given `apiKey` + `siteKey`.
 * Uses constant-time comparison for the apiKey.
 */
export function findOrgAndSite(orgs: WidgetOrg[], apiKey: string, siteKey: string): OrgSitePair | null {
  const keyBuf = Buffer.from(apiKey, 'utf8');
  for (const org of orgs) {
    if (org.apiKey.length !== apiKey.length) continue;
    const orgKeyBuf = Buffer.from(org.apiKey, 'utf8');
    if (orgKeyBuf.length !== keyBuf.length) continue;
    if (!timingSafeEqual(orgKeyBuf, keyBuf)) continue;

    for (const site of org.sites) {
      if (site.siteKey === siteKey) return { org, site };
    }
  }
  return null;
}

/**
 * Find an org by its `adminSecret`. Used for server-side admin auth (crawl triggers, etc.).
 * Returns `null` if no org matches or if the org has no `adminSecret` set.
 */
export function findOrgByAdminSecret(orgs: WidgetOrg[], secret: string): WidgetOrg | null {
  const secretBuf = Buffer.from(secret, 'utf8');
  for (const org of orgs) {
    if (!org.adminSecret) continue;
    if (org.adminSecret.length !== secret.length) continue;
    const orgBuf = Buffer.from(org.adminSecret, 'utf8');
    if (orgBuf.length !== secretBuf.length) continue;
    if (timingSafeEqual(orgBuf, secretBuf)) return org;
  }
  return null;
}

/**
 * Find org + site by siteKey alone (used when client only sends siteKey).
 * Falls back to matching apiKey === siteKey for legacy format.
 */
export function findSiteByKey(orgs: WidgetOrg[], siteKey: string): OrgSitePair | null {
  const keyBuf = Buffer.from(siteKey, 'utf8');
  for (const org of orgs) {
    for (const site of org.sites) {
      if (site.siteKey.length !== siteKey.length) continue;
      const siteBuf = Buffer.from(site.siteKey, 'utf8');
      if (siteBuf.length !== keyBuf.length) continue;
      if (timingSafeEqual(siteBuf, keyBuf)) return { org, site };
    }
    // Legacy: apiKey === siteKey
    if (org.apiKey.length === siteKey.length) {
      const orgBuf = Buffer.from(org.apiKey, 'utf8');
      if (orgBuf.length === keyBuf.length && timingSafeEqual(orgBuf, keyBuf)) {
        if (org.sites.length > 0) return { org, site: org.sites[0]! };
      }
    }
  }
  return null;
}

/** For backward compatibility — find site config by siteKey. */
export function findSiteForKey(sites: WidgetSiteConfig[], siteKey: string): WidgetSiteConfig | null;
export function findSiteForKey(orgs: WidgetOrg[], siteKey: string): WidgetSiteConfig | null;
export function findSiteForKey(input: WidgetSiteConfig[] | WidgetOrg[], siteKey: string): WidgetSiteConfig | null {
  if (input.length === 0) return null;
  // Detect if input is orgs or sites
  if ('orgId' in input[0]!) {
    const pair = findSiteByKey(input as WidgetOrg[], siteKey);
    return pair?.site ?? null;
  }
  // Legacy flat sites
  const buf = Buffer.from(siteKey, 'utf8');
  for (const s of input as WidgetSiteConfig[]) {
    if (s.siteKey.length !== siteKey.length) continue;
    const candidate = Buffer.from(s.siteKey, 'utf8');
    if (candidate.length !== buf.length) continue;
    if (timingSafeEqual(candidate, buf)) return s;
  }
  return null;
}

// ── Hostname utilities ──

export function normalizeHostname(host: string): string {
  return host.trim().toLowerCase().replace(/^\[|\]$/g, '');
}

export function isHostnameAllowed(hostname: string, hosts: string[]): boolean {
  const h = normalizeHostname(hostname);
  if (!h) return false;
  for (const raw of hosts) {
    const pattern = raw.trim().toLowerCase();
    if (!pattern) continue;
    if (pattern.startsWith('*.')) {
      const root = pattern.slice(2);
      if (!root) continue;
      if (h === root) return true;
      if (h.endsWith('.' + root)) return true;
      continue;
    }
    if (h === pattern) return true;
  }
  return false;
}

export function hostnameFromUrlString(urlStr: string): string | null {
  try {
    const u = new URL(urlStr);
    return u.hostname || null;
  } catch {
    return null;
  }
}

export function getHostnameFromOriginHeader(origin: string | null): string | null {
  if (!origin || origin === 'null') return null;
  return hostnameFromUrlString(origin);
}

export function getHostnameFromReferrerHeader(referer: string | null): string | null {
  if (!referer) return null;
  return hostnameFromUrlString(referer);
}

export function resolveRequestHostname(origin: string | null, referer: string | null): string | null {
  return getHostnameFromOriginHeader(origin) ?? getHostnameFromReferrerHeader(referer);
}

export function isOriginAllowedForCors(origin: string | null, sites: WidgetSiteConfig[]): boolean {
  const host = getHostnameFromOriginHeader(origin);
  if (!host) return false;
  for (const s of sites) {
    if (isHostnameAllowed(host, s.hosts)) return true;
  }
  return false;
}

export function assertHttpsPageUrl(pageUrl: string): URL | null {
  try {
    const u = new URL(pageUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u;
  } catch {
    return null;
  }
}
