# How the BharatX embed widget works

A short technical overview for developers.

## Overview

A partner site loads **`/widget/v1.js`** from your BharatX app. That script adds a floating **Ask about page** button and a small chat panel (inside a **shadow DOM** so CSS does not clash). When the user sends a message, the browser sends **visible page text** plus **chat history** to your server; the server runs an **LLM** and streams the reply back as **plain text**. The partner does not implement their own AI API.

## Main components

| Part | Purpose |
|------|--------|
| **`widget/v1.js`** | IIFE bundle exposing `window.BharatXWidget.init()` and `.summarize()`. |
| **Partner page** | Loads the script, sets `data-api-base` (or passes `apiBase`), calls `init({ siteKey, selector? })`. |
| **`POST /api/widget/chat`** | Validates the request, builds the prompt, streams the model response. |
| **`POST /api/widget/summarize`** | Optional JSON “summary only” endpoint (legacy / integrations). |
| **Environment** | `WIDGET_ENABLED`, `WIDGET_SITES_JSON` — maps **`siteKey`** → allowed **hostnames**. |

## Request flow

1. **Script load** — Browser downloads `v1.js` from your domain. `data-api-base` is read when the script runs so the API origin is known even if `init()` runs later on `DOMContentLoaded`.

2. **`init()`** — Creates a fixed-position host element, **`attachShadow({ mode: 'open' })`**, injects styles, button, and chat UI. Appends the host to **`document.body`**.

3. **User sends a message** — The widget:
   - Collects text from **`selector`** if set, else `main` → `[role=main]` → `article` → `body` (`innerText`, trimmed, length-capped on the client).
   - Sends **`POST /api/widget/chat`** with JSON: `siteKey`, `pageUrl`, `title`, `pageContent`, `messages` (user/assistant turns).

4. **Server** — Parses and validates the body, then:
   - **CORS**: `Access-Control-Allow-Origin` reflects a permitted `Origin`.
   - **Auth**: `siteKey` must exist in `WIDGET_SITES_JSON`; the request’s hostname (from `Origin` or `Referer`) must match that entry’s **`hosts`** list.
   - **Rate limit**: Upstash Redis per `siteKey` + IP (if configured; failures can fail open).
   - **Model**: Builds a **system** prompt that includes the page text inside delimiters and marks it **untrusted** (prompt-injection mitigation). Calls **`streamText`** with the configured widget model alias.

5. **Response** — **`200`** with **`text/plain`** body streamed in chunks. Errors are **JSON** with a non-2xx status.

6. **Client** — Reads the stream with `fetch` + `ReadableStream`, updates the assistant bubble as chunks arrive.

## Security (short)

- **`siteKey`** is an embed identifier; access control is the **hostname allowlist**, not secrecy of the key alone.
- Widget `fetch` uses **`credentials: 'omit'`** (no cookies to your API from the embed call).
- Page content is **untrusted**; the system prompt instructs the model not to obey instructions inside the scraped block (best-effort).

## What the model “sees”

- Only the **text you send** in `pageContent` for that request and the **conversation messages**.
- **Not** the rest of the site, **not** chart graphics/canvas unless the same information exists as **text in the DOM**.

## Related docs

- **[widget.md](./widget.md)** — Env shape, embed snippet, CSP, troubleshooting.
