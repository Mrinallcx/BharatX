import { describe, expect, it } from 'vitest';

import {
  assertHttpsPageUrl,
  findSiteByKey,
  findSiteForKey,
  getAllSites,
  getHostnameFromOriginHeader,
  isHostnameAllowed,
  isOriginAllowedForCors,
  parseWidgetSitesJson,
  resolveRequestHostname,
  type WidgetOrg,
} from '@/lib/widget/embed-config';

const orgJson = JSON.stringify([
  {
    orgId: 'lcx',
    name: 'LCX',
    apiKey: 'bxw-lcx-key-12345678',
    sites: [
      { siteKey: 'lcx-main', hosts: ['lcx.com'], crawlUrl: 'https://lcx.com', ragEnabled: true },
      { siteKey: 'lcx-exchange', hosts: ['exchange.lcx.com'] },
    ],
  },
  {
    orgId: 'toto',
    name: 'Toto Finance',
    apiKey: 'bxw-toto-key-87654321',
    sites: [
      { siteKey: 'toto-main', hosts: ['totofinance.xyz', 'localhost'], crawlUrl: 'https://totofinance.co', ragEnabled: true },
    ],
  },
]);

describe('parseWidgetSitesJson (org format)', () => {
  it('parses org-based JSON', () => {
    const orgs = parseWidgetSitesJson(orgJson);
    expect(orgs).toHaveLength(2);
    expect(orgs[0]!.orgId).toBe('lcx');
    expect(orgs[0]!.sites).toHaveLength(2);
    expect(orgs[1]!.orgId).toBe('toto');
    expect(orgs[1]!.sites[0]!.ragEnabled).toBe(true);
  });

  it('skips invalid entries', () => {
    expect(parseWidgetSitesJson('not json')).toEqual([]);
    expect(parseWidgetSitesJson('[]')).toEqual([]);
  });
});

describe('parseWidgetSitesJson (legacy flat format)', () => {
  it('wraps legacy flat sites into orgs', () => {
    const j = JSON.stringify([{ siteKey: 'abc123456789', hosts: ['example.com'] }]);
    const orgs = parseWidgetSitesJson(j);
    expect(orgs).toHaveLength(1);
    expect(orgs[0]!.orgId).toBe('abc123456789');
    expect(orgs[0]!.apiKey).toBe('abc123456789');
    expect(orgs[0]!.sites[0]!.siteKey).toBe('abc123456789');
  });
});

describe('getAllSites', () => {
  it('flattens all sites across orgs', () => {
    const orgs = parseWidgetSitesJson(orgJson);
    const sites = getAllSites(orgs);
    expect(sites).toHaveLength(3);
  });
});

describe('findSiteByKey', () => {
  const orgs = parseWidgetSitesJson(orgJson);

  it('finds site in correct org', () => {
    const pair = findSiteByKey(orgs, 'lcx-main');
    expect(pair).not.toBeNull();
    expect(pair!.org.orgId).toBe('lcx');
    expect(pair!.site.siteKey).toBe('lcx-main');
  });

  it('finds site in second org', () => {
    const pair = findSiteByKey(orgs, 'toto-main');
    expect(pair).not.toBeNull();
    expect(pair!.org.orgId).toBe('toto');
  });

  it('returns null for unknown key', () => {
    expect(findSiteByKey(orgs, 'nonexistent')).toBeNull();
  });
});

describe('findSiteForKey (backward compat)', () => {
  it('works with orgs array', () => {
    const orgs = parseWidgetSitesJson(orgJson);
    const site = findSiteForKey(orgs, 'lcx-exchange');
    expect(site).not.toBeNull();
    expect(site!.siteKey).toBe('lcx-exchange');
  });

  it('works with flat sites array', () => {
    const sites = [{ siteKey: 'key-one-uuid-12', hosts: ['a.com'] }];
    expect(findSiteForKey(sites, 'key-one-uuid-12')).toEqual(sites[0]);
  });

  it('returns null for wrong key', () => {
    const sites = [{ siteKey: 'key-one-uuid-12', hosts: ['a.com'] }];
    expect(findSiteForKey(sites, 'key-two-uuid-12')).toBeNull();
  });
});

describe('isHostnameAllowed', () => {
  it('matches exact', () => {
    expect(isHostnameAllowed('Foo.COM', ['foo.com'])).toBe(true);
    expect(isHostnameAllowed('evil.com', ['foo.com'])).toBe(false);
  });

  it('matches wildcard', () => {
    expect(isHostnameAllowed('app.vercel.app', ['*.vercel.app'])).toBe(true);
    expect(isHostnameAllowed('vercel.app', ['*.vercel.app'])).toBe(true);
  });
});

describe('getHostnameFromOriginHeader', () => {
  it('parses origin', () => {
    expect(getHostnameFromOriginHeader('https://sub.example.com:3000')).toBe('sub.example.com');
  });

  it('returns null for bad input', () => {
    expect(getHostnameFromOriginHeader(null)).toBeNull();
    expect(getHostnameFromOriginHeader('null')).toBeNull();
  });
});

describe('resolveRequestHostname', () => {
  it('prefers Origin', () => {
    expect(resolveRequestHostname('https://a.com', 'https://b.com/page')).toBe('a.com');
  });

  it('falls back to Referer', () => {
    expect(resolveRequestHostname(null, 'https://b.com/page')).toBe('b.com');
  });
});

describe('isOriginAllowedForCors', () => {
  const sites = [
    { siteKey: 'k1', hosts: ['localhost', '127.0.0.1'] },
    { siteKey: 'k2', hosts: ['partner.example'] },
  ];

  it('allows if any site lists host', () => {
    expect(isOriginAllowedForCors('http://localhost:3000', sites)).toBe(true);
    expect(isOriginAllowedForCors('https://partner.example', sites)).toBe(true);
  });

  it('denies unknown', () => {
    expect(isOriginAllowedForCors('https://evil.com', sites)).toBe(false);
  });
});

describe('assertHttpsPageUrl', () => {
  it('accepts http(s)', () => {
    expect(assertHttpsPageUrl('https://x.com/p?q=1')?.hostname).toBe('x.com');
  });

  it('rejects javascript:', () => {
    expect(assertHttpsPageUrl('javascript:alert(1)')).toBeNull();
  });
});
