# BharatX embed: page assistant widget

Third-party sites can add an **Ask about page** control that sends visible page text to BharatX and supports **multi-turn Q&A** grounded in the current page. A legacy **summarize** API remains for JSON integrations. Integrators do **not** expose their own API.

## Pre-registered example (Toto + localhost)

Use this for **local two-port testing** and as a template for **www.totofinance.xyz** once the same env is on production.

1. Copy **[widget-register-toto.env.example](widget-register-toto.env.example)** into your `.env.local` and restart the dev server.
2. Open **[widget-embed-snippet-toto.html](widget-embed-snippet-toto.html)** from **another** local port (see comments in that file), or paste the production block (commented at bottom) on Toto with your real BharatX domain.

**Embed `siteKey` (must match env):** `bxw-embed-7c2a9f1e-b4d3-4e8a-9c2f-toto-2026`

## Server configuration

Set in your environment (e.g. `.env`):

| Variable | Description |
|----------|-------------|
| `WIDGET_ENABLED` | `true` to enable `/api/widget/*`. |
| `WIDGET_SITES_JSON` | JSON array of allowed embeds (see below). |

### `WIDGET_SITES_JSON` shape

```json
[
  {
    "siteKey": "your-public-uuid-or-secret-string-min-8-chars",
    "hosts": ["localhost", "127.0.0.1", "www.partner.com", "*.vercel.app"]
  }
]
```

- **siteKey**: Public identifier included in the widget init (treat as revocable if leaked).
- **hosts**: Allowed **hostnames** only (no scheme/port). Requests must send an `Origin` or `Referer` whose host matches one entry. Use `*.suffix` to allow subdomains and the apex `suffix`.

### Example (local dev)

```env
WIDGET_ENABLED=true
WIDGET_SITES_JSON=[{"siteKey":"dev-widget-key-001","hosts":["localhost","127.0.0.1"]}]
```

## Endpoints

- `POST /api/widget/chat` — body JSON `{ siteKey, pageUrl, title?, pageContent, messages: [{ role: "user" | "assistant", content }] }`. Response body is a **streaming** `text/plain` reply (UTF-8 chunks). Validation or upstream errors return JSON `{ error, message? }` with a non-2xx status. The model only uses `pageContent` and prior `messages` as context (not whole-site crawl).
- `POST /api/widget/summarize` — body JSON `{ siteKey, pageUrl, title?, content, task?: "summarize" | "bullets" }`. Response `{ summary: string }` or `{ error, message? }`.
- `GET /api/widget/health` — `{ ok, widgetEnabled, ratelimitConfigured }`.
- `OPTIONS /api/widget/chat` and `OPTIONS /api/widget/summarize` — CORS preflight.

Rate limit: **60 requests / minute / siteKey / IP** (Upstash), when Redis env is available. In development, if Upstash fails to initialize, limits are skipped with a console warning.

## Embed snippet

1. Build the script (runs automatically before `next build`, or run `pnpm run build:widget`):

   Output: `/public/widget/v1.js` → served as `https://YOUR_DOMAIN/widget/v1.js`.

2. On your site:

```html
<script
  src="https://YOUR_DOMAIN/widget/v1.js"
  defer
  data-api-base="https://YOUR_DOMAIN"
></script>
<script>
  document.addEventListener('DOMContentLoaded', function () {
    if (window.BharatXWidget && window.BharatXWidget.init) {
      window.BharatXWidget.init({
        siteKey: 'your-site-key-from-WIDGET_SITES_JSON',
        // apiBase optional if data-api-base is on the script tag
        // selector: '#article', // optional main content selector
      });
    }
  });
</script>
```

### Content Security Policy

Allow loading and API calls:

- `script-src` — your BharatX origin hosting `v1.js`.
- `connect-src` — same origin as `apiBase` (the app serving `/api/widget/chat` and `/api/widget/summarize`).

Example:

```
Content-Security-Policy: script-src 'self' https://bharat0x.xyz; connect-src 'self' https://bharat0x.xyz;
```

Adjust `'self'` vs explicit host to match where the parent page is hosted.

## Privacy (text for your policy)

Suggested disclosure for integrators:

> This page uses BharatX to answer questions about visible content. When you use the assistant, extracted text from this page and its URL may be sent to BharatX’s servers for processing. See [BharatX privacy policy](https://bharat0x.xyz/privacy-policy).

## Production operations

- Watch structured logs for `siteKey`, hostname, and 429s. **Per-key spend alerts** and admin dashboards are not included in v1; add monitoring on your side (e.g. budget alarms on the LLM provider).

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| CORS error | Host not listed under `hosts` for that `siteKey`, or wrong `apiBase`. |
| 401 Unauthorized | Wrong `siteKey` or key not in `WIDGET_SITES_JSON`. |
| 403 Origin not allowed | `Origin`/`Referer` hostname missing or not allowlisted. |
| 429 Too many requests | Rate limit; wait or raise limits in code/Redis. |
| Empty / short content | SPA not rendered yet; use `selector` or call `BharatXWidget.summarize()` after navigation. |
| Button missing | Script blocked by CSP or `init` not run. |
| Stream shows JSON error | Usually 4xx/5xx; parse as JSON only when `Content-Type` is not `text/plain`. |

## Subresource Integrity (optional)

After each release, generate a hash for `v1.js` and publish:

```bash
openssl dgst -sha384 -binary public/widget/v1.js | openssl base64 -A
```

Use `integrity="sha384-…"` on the script tag (update when `v1.js` changes).

## Trading, charts, and DEX pages

The widget only sends **visible text** from the DOM (`innerText` of `main` / your `selector`). It does **not** see chart pixels, canvas, or WebGL.

- **What works today:** headings, labels, legend copy, table rows, tooltips that exist as text in the DOM, aria-labels, and any narrative next to the chart.
- **What does not work:** interpreting candlesticks, indicators, or live price action unless that information is **also** present as text/numbers in the page (e.g. “Last: 1.234”, “24h change: -2%”).
- **Ways to improve later (product/engineering):**
  - **Structured context:** partner passes optional JSON (e.g. OHLCV snapshot, pair, timeframe) in a `data-bxw-context` attribute or small script that the widget reads—would require a widget + API extension.
  - **Vision:** send a chart screenshot to a vision-capable model (higher cost/latency, privacy review).
  - **Accessibility:** ensure key metrics and chart summaries are in the DOM or `aria-live` regions so they are included in `pageContent`.

Chat answers are tuned by default for **short, synthesized** replies (not long page dumps); users can ask for more detail in follow-ups.

## SPA follow-up

After client-side route changes, call:

```js
window.BharatXWidget.summarize();
```

Opens the chat panel and sends a built-in “summarize this page” prompt (requires `init` once first).
