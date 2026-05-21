/**
 * BharatX embeddable page Q&A widget (IIFE → public/widget/v1.js).
 * Build: pnpm run build:widget
 *
 * Design: mirrors BharatX main app — #FF5F00 accent, muted surfaces,
 * orange-tinted user bubbles, full-width assistant prose, bounce-dot loader.
 */

export interface BharatXWidgetInit {
  siteKey: string;
  apiBase?: string;
  selector?: string;
  position?: 'bottom-right' | 'bottom-left';
}

const MAX_CHARS = 24_000;
const DEBOUNCE_MS = 750;
const MAX_STORED_MESSAGES = 20;

const SUGGESTED_PROMPTS = [
  'What is this page about?',
  'Summarize in 3 bullets',
  'What assets are mentioned?',
] as const;

const apiBaseFromEmbedScript = (() => {
  const el = document.currentScript as HTMLScriptElement | null;
  return el?.getAttribute('data-api-base')?.trim() ?? '';
})();

function normalizeApiBase(url: string): string {
  return url.replace(/\/+$/, '');
}

function resolveApiBase(explicit?: string): string {
  if (explicit && explicit.trim()) return normalizeApiBase(explicit.trim());
  if (apiBaseFromEmbedScript) return normalizeApiBase(apiBaseFromEmbedScript);
  const cur = document.currentScript as HTMLScriptElement | null;
  const fromAttr = cur?.getAttribute('data-api-base');
  if (fromAttr?.trim()) return normalizeApiBase(fromAttr.trim());
  return '';
}

function extractPageText(selector?: string): string {
  let el: Element | null = null;
  if (selector) {
    try { el = document.querySelector(selector); } catch { el = null; }
  }
  if (!el) {
    el =
      document.querySelector('main') ||
      document.querySelector('[role="main"]') ||
      document.querySelector('article') ||
      document.body;
  }
  if (!el) return '';
  return ((el as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);
}

type ChatMsg = { role: 'user' | 'assistant'; content: string };

export type PanelEls = {
  panel: HTMLDivElement;
  status: HTMLDivElement;
  messagesScroll: HTMLDivElement;
  messagesInner: HTMLDivElement;
  input: HTMLTextAreaElement;
  sendBtn: HTMLButtonElement;
  closePanel: () => void;
  openPanel: () => void;
};

let lastTrigger = 0;
let inFlightAbort: AbortController | null = null;

function svg(inner: string, size = 20): SVGSVGElement {
  const d = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`,
    'image/svg+xml',
  );
  return d.documentElement as unknown as SVGSVGElement;
}

/* ── Styles (matches BharatX main app light mode) ── */

function injectStyles(root: ShadowRoot): void {
  const s = document.createElement('style');
  s.textContent = `
    :host { all: initial; }

    /* ───── Foundation ───── */
    .bxw-wrap {
      position: relative;
      font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #1a1a1a;
      pointer-events: none;
    }

    /* ───── Launcher pill ───── */
    .bxw-launcher {
      pointer-events: auto;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: 999px;
      border: none;
      background: #FF5F00;
      color: #fff;
      font-weight: 600;
      font-size: 14px;
      box-shadow: 0 4px 20px rgba(255, 95, 0, 0.35), 0 1px 3px rgba(0,0,0,0.08);
      outline: none;
      transition: background 0.15s, box-shadow 0.15s;
    }
    .bxw-launcher:hover { background: #ea580c; }
    .bxw-launcher:focus-visible { box-shadow: 0 0 0 3px rgba(255, 95, 0, 0.4); }
    .bxw-launcher-icon { display: flex; }

    /* ───── Panel ───── */
    .bxw-panel {
      pointer-events: auto;
      position: absolute;
      bottom: 58px;
      width: min(420px, calc(100vw - 24px));
      max-height: min(85vh, 600px);
      display: flex;
      flex-direction: column;
      background: #f9f9f9;
      border: 1px solid #e5e5e5;
      border-radius: 16px;
      box-shadow: 0 24px 48px rgba(0,0,0,0.12), 0 8px 16px rgba(0,0,0,0.06);
      overflow: hidden;
    }
    .bxw-panel.bxw-right { right: 0; left: auto; }
    .bxw-panel.bxw-left  { left: 0;  right: auto; }
    .bxw-hidden { display: none !important; }

    /* ───── Header (matches BharatX navbar bg) ───── */
    .bxw-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: #f9f9f9;
      border-bottom: 1px solid #ebebeb;
      flex-shrink: 0;
    }
    .bxw-brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .bxw-brand-logo {
      width: 28px;
      height: 28px;
      border-radius: 8px;
    }
    .bxw-brand-text {
      font-weight: 700;
      font-size: 15px;
      color: #1a1a1a;
      letter-spacing: -0.01em;
    }
    .bxw-close-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: #888;
      cursor: pointer;
    }
    .bxw-close-btn:hover { background: #ebebeb; color: #333; }
    .bxw-close-btn:focus-visible { outline: 2px solid #FF5F00; outline-offset: 2px; }

    /* ───── Status ───── */
    .bxw-status {
      font-size: 12px;
      color: #888;
      padding: 8px 16px 0;
      flex-shrink: 0;
    }
    .bxw-status.bxw-err { color: #dc2626; }

    /* ───── Message scroll area ───── */
    .bxw-scroll {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 16px;
      min-height: 0;
    }
    .bxw-scroll::-webkit-scrollbar { width: 5px; }
    .bxw-scroll::-webkit-scrollbar-thumb { background: #d4d4d4; border-radius: 5px; }
    .bxw-scroll::-webkit-scrollbar-track { background: transparent; }

    .bxw-thread {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* ───── User bubble (orange-tinted like BharatX bg-accent/80) ───── */
    .bxw-row { display: flex; width: 100%; }
    .bxw-row-user { justify-content: flex-end; }
    .bxw-row-assistant { justify-content: flex-start; }

    .bxw-bubble {
      font-size: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .bxw-bubble-user {
      max-width: 85%;
      padding: 10px 16px;
      border-radius: 16px;
      border-bottom-right-radius: 4px;
      background: rgba(255, 95, 0, 0.12);
      color: #1a1a1a;
    }

    /* ───── Assistant (full-width prose — no box, like BharatX main chat) ───── */
    .bxw-bubble-assistant {
      width: 100%;
      padding: 0;
      color: #333;
    }

    /* Separator between assistant blocks in a long thread */
    .bxw-row-assistant + .bxw-row-user { margin-top: 4px; }
    .bxw-row-user + .bxw-row-assistant {
      padding-top: 8px;
      border-top: 1px solid #ebebeb;
    }

    /* ───── Loading dots (BharatX bounce pattern) ───── */
    .bxw-dots {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 6px 0;
    }
    .bxw-dots span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #999;
      animation: bxwBounce 1.4s ease-in-out infinite both;
    }
    .bxw-dots span:nth-child(2) { animation-delay: 0.16s; }
    .bxw-dots span:nth-child(3) { animation-delay: 0.32s; }
    @keyframes bxwBounce {
      0%, 80%, 100% { transform: translateY(0); opacity: 0.3; }
      40% { transform: translateY(-6px); opacity: 1; }
    }

    /* ───── Suggestion chips ───── */
    .bxw-suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 0 16px 12px;
      flex-shrink: 0;
    }
    .bxw-chip {
      font: inherit;
      font-size: 12px;
      line-height: 1.4;
      color: #555;
      background: #fff;
      border: 1px solid #e5e5e5;
      border-radius: 999px;
      padding: 6px 14px;
      cursor: pointer;
      text-align: left;
      transition: border-color 0.12s, background 0.12s;
    }
    .bxw-chip:hover { background: #fafafa; border-color: #FF5F00; color: #FF5F00; }
    .bxw-chip:focus-visible { outline: 2px solid #FF5F00; outline-offset: 2px; }
    .bxw-chip:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ───── Composer (matches BharatX muted input + orange glow) ───── */
    .bxw-composer-area {
      padding: 0 16px 12px;
      flex-shrink: 0;
    }
    .bxw-composer {
      position: relative;
      display: flex;
      align-items: flex-end;
      gap: 10px;
      padding: 6px 6px 6px 14px;
      background: #ebebeb;
      border: 1px solid transparent;
      border-radius: 16px;
      transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
    }
    .bxw-composer:focus-within {
      background: #fff;
      border-color: rgba(255, 95, 0, 0.5);
      box-shadow: 0 0 0 3px rgba(255, 95, 0, 0.08);
    }
    .bxw-input {
      flex: 1;
      min-height: 40px;
      max-height: 110px;
      resize: none;
      border: none;
      background: transparent;
      padding: 8px 0;
      font: inherit;
      font-size: 14px;
      color: #1a1a1a;
      outline: none;
    }
    .bxw-input::placeholder { color: #999; }
    .bxw-send {
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 50%;
      background: #FF5F00;
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.12s;
    }
    .bxw-send:hover:not(:disabled) { background: #e65500; }
    .bxw-send:focus-visible { outline: 2px solid #FF5F00; outline-offset: 2px; }
    .bxw-send:disabled { opacity: 0.3; cursor: not-allowed; background: #ccc; }

    /* ───── Footer ───── */
    .bxw-foot {
      font-size: 11px;
      color: #aaa;
      padding: 8px 16px 10px;
      border-top: 1px solid #ebebeb;
      flex-shrink: 0;
      text-align: center;
    }
    .bxw-foot a { color: #FF5F00; font-weight: 500; text-decoration: none; }
    .bxw-foot a:hover { text-decoration: underline; }
  `;
  root.appendChild(s);
}

/* ── Panel construction ── */

function syncSendState(input: HTMLTextAreaElement, sendBtn: HTMLButtonElement, chips: HTMLButtonElement[]): void {
  const busy = sendBtn.getAttribute('data-bxw-loading') === '1';
  const hasText = input.value.trim().length > 0;
  sendBtn.disabled = busy || !hasText;
  for (const c of chips) c.disabled = busy;
}

function createPanel(position: 'bottom-right' | 'bottom-left'): PanelEls {
  const panel = document.createElement('div');
  panel.className = `bxw-panel ${position === 'bottom-left' ? 'bxw-left' : 'bxw-right'} bxw-hidden`;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'BharatX page assistant');

  // Header
  const header = document.createElement('div');
  header.className = 'bxw-header';

  const brand = document.createElement('div');
  brand.className = 'bxw-brand';
  const logo = document.createElement('img');
  logo.className = 'bxw-brand-logo';
  logo.alt = 'BharatX';
  logo.src = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="8" fill="%23FF5F00"/><text x="50%" y="54%" dominant-baseline="central" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="22" fill="white">B</text></svg>',
  );
  const brandLabel = document.createElement('span');
  brandLabel.className = 'bxw-brand-text';
  brandLabel.textContent = 'BharatX';
  brand.appendChild(logo);
  brand.appendChild(brandLabel);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'bxw-close-btn';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.appendChild(svg('<path d="M18 6L6 18M6 6l12 12"/>', 18));

  header.appendChild(brand);
  header.appendChild(closeBtn);

  // Status
  const status = document.createElement('div');
  status.className = 'bxw-status bxw-hidden';

  // Scrollable thread
  const messagesScroll = document.createElement('div');
  messagesScroll.className = 'bxw-scroll';
  const messagesInner = document.createElement('div');
  messagesInner.className = 'bxw-thread';
  messagesScroll.appendChild(messagesInner);

  // Suggestions
  const suggestions = document.createElement('div');
  suggestions.className = 'bxw-suggestions';
  suggestions.setAttribute('aria-label', 'Suggested questions');
  const chips: HTMLButtonElement[] = [];
  for (const label of SUGGESTED_PROMPTS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'bxw-chip';
    chip.textContent = label;
    suggestions.appendChild(chip);
    chips.push(chip);
  }

  // Composer
  const composerArea = document.createElement('div');
  composerArea.className = 'bxw-composer-area';
  const composer = document.createElement('div');
  composer.className = 'bxw-composer';
  const input = document.createElement('textarea');
  input.className = 'bxw-input';
  input.rows = 1;
  input.setAttribute('aria-label', 'Your question');
  input.placeholder = 'Ask about this page\u2026';
  const sendBtn = document.createElement('button');
  sendBtn.type = 'button';
  sendBtn.className = 'bxw-send';
  sendBtn.setAttribute('aria-label', 'Send');
  sendBtn.appendChild(svg('<path d="M12 19V5M5 12l7-7 7 7"/>', 18));
  composer.appendChild(input);
  composer.appendChild(sendBtn);
  composerArea.appendChild(composer);

  // Footer
  const foot = document.createElement('div');
  foot.className = 'bxw-foot';
  foot.innerHTML =
    'Answers based on this page only &middot; <a href="https://bharat0x.xyz" target="_blank" rel="noopener noreferrer">Powered by BharatX</a>';

  // Assemble
  panel.appendChild(header);
  panel.appendChild(status);
  panel.appendChild(messagesScroll);
  panel.appendChild(suggestions);
  panel.appendChild(composerArea);
  panel.appendChild(foot);

  // State helpers
  const setLoading = (on: boolean) => {
    sendBtn.setAttribute('data-bxw-loading', on ? '1' : '0');
    syncSendState(input, sendBtn, chips);
  };

  input.addEventListener('input', () => syncSendState(input, sendBtn, chips));
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      input.value = chip.textContent ?? '';
      input.focus();
      syncSendState(input, sendBtn, chips);
    });
  }
  syncSendState(input, sendBtn, chips);

  const closePanel = () => {
    if (inFlightAbort) { inFlightAbort.abort(); inFlightAbort = null; }
    setLoading(false);
    panel.classList.add('bxw-hidden');
    status.classList.add('bxw-hidden');
    status.textContent = '';
    status.classList.remove('bxw-err');
  };

  const openPanel = () => {
    panel.classList.remove('bxw-hidden');
    input.focus();
  };

  closeBtn.addEventListener('click', closePanel);
  (panel as HTMLDivElement & { __bxwSetLoading?: (v: boolean) => void }).__bxwSetLoading = setLoading;

  return { panel, status, messagesScroll, messagesInner, input, sendBtn, closePanel, openPanel };
}

/* ── Helpers ── */

function scrollEnd(el: HTMLElement): void {
  el.scrollTop = el.scrollHeight;
}

function mountDots(bubble: HTMLElement): void {
  bubble.textContent = '';
  const wrap = document.createElement('span');
  wrap.className = 'bxw-dots';
  wrap.setAttribute('role', 'status');
  wrap.setAttribute('aria-label', 'Generating');
  for (let i = 0; i < 3; i++) wrap.appendChild(document.createElement('span'));
  bubble.appendChild(wrap);
}

function appendBubble(
  thread: HTMLDivElement,
  scroller: HTMLElement,
  role: 'user' | 'assistant',
  text: string,
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = `bxw-row bxw-row-${role}`;
  const div = document.createElement('div');
  div.className = `bxw-bubble bxw-bubble-${role}`;
  div.textContent = text;
  row.appendChild(div);
  thread.appendChild(row);
  scrollEnd(scroller);
  return div;
}

/* ── State ── */

let active: {
  siteKey: string;
  apiBase: string;
  selector?: string;
  panelEls: PanelEls;
  history: ChatMsg[];
} | null = null;

function trimHistory(h: ChatMsg[]): ChatMsg[] {
  return h.length <= MAX_STORED_MESSAGES ? h : h.slice(-MAX_STORED_MESSAGES);
}

function setPanelLoading(panel: HTMLDivElement, on: boolean): void {
  const fn = (panel as HTMLDivElement & { __bxwSetLoading?: (v: boolean) => void }).__bxwSetLoading;
  if (fn) fn(on);
}

/* ── Send ── */

async function sendUserMessage(text: string): Promise<void> {
  if (!active) return;
  const { siteKey, apiBase, selector, panelEls } = active;
  const { panel, status, messagesScroll, messagesInner, input } = panelEls;

  const now = Date.now();
  if (now - lastTrigger < DEBOUNCE_MS) return;
  lastTrigger = now;

  const trimmed = text.trim();
  if (!trimmed) return;

  if (inFlightAbort) { inFlightAbort.abort(); inFlightAbort = null; }
  status.classList.add('bxw-hidden');
  status.classList.remove('bxw-err');

  const content = extractPageText(selector);
  const pageUrl = window.location.href;
  const docTitle = document.title || '';

  if (content.length < 80) {
    status.classList.remove('bxw-hidden');
    status.classList.add('bxw-err');
    status.textContent = 'Not enough text on this page to provide answers.';
    return;
  }

  appendBubble(messagesInner, messagesScroll, 'user', trimmed);
  active.history = trimHistory([...active.history, { role: 'user', content: trimmed }]);

  input.value = '';
  setPanelLoading(panel, true);
  input.disabled = true;

  const assistantBubble = appendBubble(messagesInner, messagesScroll, 'assistant', '');
  mountDots(assistantBubble);
  scrollEnd(messagesScroll);

  const ac = new AbortController();
  inFlightAbort = ac;

  try {
    const res = await fetch(`${apiBase}/api/widget/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteKey, pageUrl, title: docTitle, pageContent: content, messages: active.history }),
      credentials: 'omit',
      signal: ac.signal,
    });

    const ct = res.headers.get('content-type') || '';

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      assistantBubble.parentElement?.remove();
      active.history = trimHistory(active.history.slice(0, -1));
      status.classList.remove('bxw-hidden');
      status.classList.add('bxw-err');
      status.textContent = data.message || data.error || `Request failed (${res.status})`;
      return;
    }

    if (!res.body || !ct.includes('text/plain')) {
      assistantBubble.textContent = 'Unexpected response from server.';
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let acc = '';
    let started = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      acc += decoder.decode(value, { stream: true });
      if (!started && acc.length > 0) { started = true; assistantBubble.textContent = ''; }
      assistantBubble.textContent = acc;
      scrollEnd(messagesScroll);
    }

    const reply = acc.trim();
    if (reply) {
      active.history = trimHistory([...active.history, { role: 'assistant', content: reply }]);
    } else {
      assistantBubble.textContent = '(No reply)';
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      assistantBubble.textContent = '(Stopped)';
      return;
    }
    assistantBubble.parentElement?.remove();
    active.history = trimHistory(active.history.slice(0, -1));
    status.classList.remove('bxw-hidden');
    status.classList.add('bxw-err');
    status.textContent = 'Network error. Try again.';
  } finally {
    input.disabled = false;
    setPanelLoading(panel, false);
    if (inFlightAbort === ac) inFlightAbort = null;
    input.focus();
  }
}

/* ── Public API ── */

export function init(opts: BharatXWidgetInit): void {
  if (!opts.siteKey) { console.error('[BharatXWidget] siteKey is required'); return; }
  const apiBase = resolveApiBase(opts.apiBase);
  if (!apiBase) { console.error('[BharatXWidget] apiBase is required (pass init({ apiBase }) or data-api-base on the script tag)'); return; }

  const position = opts.position === 'bottom-left' ? 'bottom-left' : 'bottom-right';

  const host = document.createElement('div');
  host.style.setProperty('position', 'fixed', 'important');
  host.style.setProperty('z-index', '2147483647', 'important');
  host.style.setProperty('isolation', 'isolate', 'important');
  host.style.setProperty('pointer-events', 'none', 'important');
  if (position === 'bottom-left') {
    host.style.setProperty('left', '16px', 'important');
    host.style.setProperty('right', 'auto', 'important');
  } else {
    host.style.setProperty('right', '16px', 'important');
    host.style.setProperty('left', 'auto', 'important');
  }
  host.style.setProperty('bottom', '16px', 'important');

  const shadow = host.attachShadow({ mode: 'open' });
  injectStyles(shadow);

  const wrap = document.createElement('div');
  wrap.className = 'bxw-wrap';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'bxw-launcher';
  btn.setAttribute('aria-label', 'Open BharatX page assistant');
  const launcherIcon = document.createElement('span');
  launcherIcon.className = 'bxw-launcher-icon';
  launcherIcon.appendChild(svg('<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/>', 18));
  btn.appendChild(launcherIcon);
  const launcherLabel = document.createElement('span');
  launcherLabel.textContent = 'Ask AI';
  btn.appendChild(launcherLabel);

  const panelEls = createPanel(position);
  wrap.appendChild(btn);
  wrap.appendChild(panelEls.panel);
  shadow.appendChild(wrap);

  const history: ChatMsg[] = [];

  btn.addEventListener('click', () => panelEls.openPanel());
  panelEls.sendBtn.addEventListener('click', () => void sendUserMessage(panelEls.input.value));
  panelEls.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendUserMessage(panelEls.input.value); }
  });

  document.body.appendChild(host);
  active = { siteKey: opts.siteKey, apiBase, selector: opts.selector, panelEls, history };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panelEls.panel.classList.contains('bxw-hidden')) panelEls.closePanel();
  });
}

export function summarize(opts?: Partial<Pick<BharatXWidgetInit, 'selector'>>): void {
  if (!active) { console.warn('[BharatXWidget] init() must be called first'); return; }
  if (opts?.selector !== undefined) active.selector = opts.selector;
  active.panelEls.openPanel();
  void sendUserMessage('Please summarize this page in plain text for a general reader (a few short paragraphs).');
}
