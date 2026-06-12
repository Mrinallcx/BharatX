"use strict";var BharatXWidget=(()=>{var M=Object.defineProperty;var I=Object.getOwnPropertyDescriptor;var R=Object.getOwnPropertyNames;var G=Object.prototype.hasOwnProperty;var O=(t,e)=>{for(var n in e)M(t,n,{get:e[n],enumerable:!0})},j=(t,e,n,o)=>{if(e&&typeof e=="object"||typeof e=="function")for(let r of R(e))!G.call(t,r)&&r!==n&&M(t,r,{get:()=>e[r],enumerable:!(o=I(e,r))||o.enumerable});return t};var q=t=>j(M({},"__esModule",{value:!0}),t);var Z={};O(Z,{init:()=>J,summarize:()=>Q});var U=["What is this page about?","Summarize in 3 bullets","What assets are mentioned?"],H=document.currentScript?.getAttribute("data-api-base")?.trim()??"";function B(t){return t.replace(/\/+$/,"")}function $(t){if(t&&t.trim())return B(t.trim());if(H)return B(H);let n=document.currentScript?.getAttribute("data-api-base");return n?.trim()?B(n.trim()):""}function K(t){let e=null;if(t)try{e=document.querySelector(t)}catch{e=null}return e||(e=document.querySelector("main")||document.querySelector('[role="main"]')||document.querySelector("article")||document.body),e?(e.innerText||"").replace(/\s+/g," ").trim().slice(0,24e3):""}var X=0,g=null;function A(t,e=20){return new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg" width="${e}" height="${e}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${t}</svg>`,"image/svg+xml").documentElement}function W(t){let e=document.createElement("style");e.textContent=`
    :host { all: initial; }

    /* \u2500\u2500\u2500\u2500\u2500 Foundation \u2500\u2500\u2500\u2500\u2500 */
    .bxw-wrap {
      position: relative;
      font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #1a1a1a;
      pointer-events: none;
    }

    /* \u2500\u2500\u2500\u2500\u2500 Launcher pill \u2500\u2500\u2500\u2500\u2500 */
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

    /* \u2500\u2500\u2500\u2500\u2500 Panel \u2500\u2500\u2500\u2500\u2500 */
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

    /* \u2500\u2500\u2500\u2500\u2500 Header (matches BharatX navbar bg) \u2500\u2500\u2500\u2500\u2500 */
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

    /* \u2500\u2500\u2500\u2500\u2500 Status \u2500\u2500\u2500\u2500\u2500 */
    .bxw-status {
      font-size: 12px;
      color: #888;
      padding: 8px 16px 0;
      flex-shrink: 0;
    }
    .bxw-status.bxw-err { color: #dc2626; }

    /* \u2500\u2500\u2500\u2500\u2500 Message scroll area \u2500\u2500\u2500\u2500\u2500 */
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

    /* \u2500\u2500\u2500\u2500\u2500 User bubble (orange-tinted like BharatX bg-accent/80) \u2500\u2500\u2500\u2500\u2500 */
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

    /* \u2500\u2500\u2500\u2500\u2500 Assistant (full-width prose \u2014 no box, like BharatX main chat) \u2500\u2500\u2500\u2500\u2500 */
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

    /* \u2500\u2500\u2500\u2500\u2500 Loading dots (BharatX bounce pattern) \u2500\u2500\u2500\u2500\u2500 */
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

    /* \u2500\u2500\u2500\u2500\u2500 Suggestion chips \u2500\u2500\u2500\u2500\u2500 */
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

    /* \u2500\u2500\u2500\u2500\u2500 Composer (matches BharatX muted input + orange glow) \u2500\u2500\u2500\u2500\u2500 */
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

    /* \u2500\u2500\u2500\u2500\u2500 Footer \u2500\u2500\u2500\u2500\u2500 */
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
  `,t.appendChild(e)}function k(t,e,n){let o=e.getAttribute("data-bxw-loading")==="1",r=t.value.trim().length>0;e.disabled=o||!r;for(let i of n)i.disabled=o}function V(t){let e=document.createElement("div");e.className=`bxw-panel ${t==="bottom-left"?"bxw-left":"bxw-right"} bxw-hidden`,e.setAttribute("role","dialog"),e.setAttribute("aria-modal","true"),e.setAttribute("aria-label","BharatX page assistant");let n=document.createElement("div");n.className="bxw-header";let o=document.createElement("div");o.className="bxw-brand";let r=document.createElement("img");r.className="bxw-brand-logo",r.alt="BharatX",r.src="data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="8" fill="%23FF5F00"/><text x="50%" y="54%" dominant-baseline="central" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="22" fill="white">B</text></svg>');let i=document.createElement("span");i.className="bxw-brand-text",i.textContent="BharatX",o.appendChild(r),o.appendChild(i);let a=document.createElement("button");a.type="button",a.className="bxw-close-btn",a.setAttribute("aria-label","Close"),a.appendChild(A('<path d="M18 6L6 18M6 6l12 12"/>',18)),n.appendChild(o),n.appendChild(a);let p=document.createElement("div");p.className="bxw-status bxw-hidden";let x=document.createElement("div");x.className="bxw-scroll";let l=document.createElement("div");l.className="bxw-thread",x.appendChild(l);let h=document.createElement("div");h.className="bxw-suggestions",h.setAttribute("aria-label","Suggested questions");let d=[];for(let w of U){let m=document.createElement("button");m.type="button",m.className="bxw-chip",m.textContent=w,h.appendChild(m),d.push(m)}let y=document.createElement("div");y.className="bxw-composer-area";let v=document.createElement("div");v.className="bxw-composer";let c=document.createElement("textarea");c.className="bxw-input",c.rows=1,c.setAttribute("aria-label","Your question"),c.placeholder="Ask about this page\u2026";let s=document.createElement("button");s.type="button",s.className="bxw-send",s.setAttribute("aria-label","Send"),s.appendChild(A('<path d="M12 19V5M5 12l7-7 7 7"/>',18)),v.appendChild(c),v.appendChild(s),y.appendChild(v);let f=document.createElement("div");f.className="bxw-foot",f.innerHTML='Answers based on this page only &middot; <a href="https://bharat0x.xyz" target="_blank" rel="noopener noreferrer">Powered by BharatX</a>',e.appendChild(n),e.appendChild(p),e.appendChild(x),e.appendChild(h),e.appendChild(y),e.appendChild(f);let u=w=>{s.setAttribute("data-bxw-loading",w?"1":"0"),k(c,s,d)};c.addEventListener("input",()=>k(c,s,d));for(let w of d)w.addEventListener("click",()=>{c.value=w.textContent??"",c.focus(),k(c,s,d)});k(c,s,d);let E=()=>{g&&(g.abort(),g=null),u(!1),e.classList.add("bxw-hidden"),p.classList.add("bxw-hidden"),p.textContent="",p.classList.remove("bxw-err")},S=()=>{e.classList.remove("bxw-hidden"),c.focus()};return a.addEventListener("click",E),e.__bxwSetLoading=u,{panel:e,status:p,messagesScroll:x,messagesInner:l,input:c,sendBtn:s,closePanel:E,openPanel:S}}function T(t){t.scrollTop=t.scrollHeight}function Y(t){t.textContent="";let e=document.createElement("span");e.className="bxw-dots",e.setAttribute("role","status"),e.setAttribute("aria-label","Generating");for(let n=0;n<3;n++)e.appendChild(document.createElement("span"));t.appendChild(e)}function _(t,e,n,o){let r=document.createElement("div");r.className=`bxw-row bxw-row-${n}`;let i=document.createElement("div");return i.className=`bxw-bubble bxw-bubble-${n}`,i.textContent=o,r.appendChild(i),t.appendChild(r),T(e),i}var b=null;function L(t){return t.length<=20?t:t.slice(-20)}function D(t,e){let n=t.__bxwSetLoading;n&&n(e)}async function F(t){if(!b)return;let{siteKey:e,apiBase:n,selector:o,panelEls:r}=b,{panel:i,status:a,messagesScroll:p,messagesInner:x,input:l}=r,h=Date.now();if(h-X<750)return;X=h;let d=t.trim();if(!d)return;g&&(g.abort(),g=null),a.classList.add("bxw-hidden"),a.classList.remove("bxw-err");let y=K(o),v=window.location.href,c=document.title||"";if(y.length<80){a.classList.remove("bxw-hidden"),a.classList.add("bxw-err"),a.textContent="Not enough text on this page to provide answers.";return}_(x,p,"user",d),b.history=L([...b.history,{role:"user",content:d}]),l.value="",D(i,!0),l.disabled=!0;let s=_(x,p,"assistant","");Y(s),T(p);let f=new AbortController;g=f;try{let u=await fetch(`${n}/api/widget/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteKey:e,pageUrl:v,title:c,pageContent:y,messages:b.history}),credentials:"omit",signal:f.signal}),E=u.headers.get("content-type")||"";if(!u.ok){let C=await u.json().catch(()=>({}));s.parentElement?.remove(),b.history=L(b.history.slice(0,-1)),a.classList.remove("bxw-hidden"),a.classList.add("bxw-err"),a.textContent=C.message||C.error||`Request failed (${u.status})`;return}if(!u.body||!E.includes("text/plain")){s.textContent="Unexpected response from server.";return}let S=u.body.getReader(),w=new TextDecoder,m="",P=!1;for(;;){let{done:C,value:z}=await S.read();if(C)break;m+=w.decode(z,{stream:!0}),!P&&m.length>0&&(P=!0,s.textContent=""),s.textContent=m,T(p)}let N=m.trim();N?b.history=L([...b.history,{role:"assistant",content:N}]):s.textContent="(No reply)"}catch(u){if(u.name==="AbortError"){s.textContent="(Stopped)";return}s.parentElement?.remove(),b.history=L(b.history.slice(0,-1)),a.classList.remove("bxw-hidden"),a.classList.add("bxw-err"),a.textContent="Network error. Try again."}finally{l.disabled=!1,D(i,!1),g===f&&(g=null),l.focus()}}function J(t){if(!t.siteKey){console.error("[BharatXWidget] siteKey is required");return}let e=$(t.apiBase);if(!e){console.error("[BharatXWidget] apiBase is required (pass init({ apiBase }) or data-api-base on the script tag)");return}let n=t.position==="bottom-left"?"bottom-left":"bottom-right",o=document.createElement("div");o.style.setProperty("position","fixed","important"),o.style.setProperty("z-index","2147483647","important"),o.style.setProperty("isolation","isolate","important"),o.style.setProperty("pointer-events","none","important"),n==="bottom-left"?(o.style.setProperty("left","16px","important"),o.style.setProperty("right","auto","important")):(o.style.setProperty("right","16px","important"),o.style.setProperty("left","auto","important")),o.style.setProperty("bottom","16px","important");let r=o.attachShadow({mode:"open"});W(r);let i=document.createElement("div");i.className="bxw-wrap";let a=document.createElement("button");a.type="button",a.className="bxw-launcher",a.setAttribute("aria-label","Open BharatX page assistant");let p=document.createElement("span");p.className="bxw-launcher-icon",p.appendChild(A('<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/>',18)),a.appendChild(p);let x=document.createElement("span");x.textContent="Ask AI",a.appendChild(x);let l=V(n);i.appendChild(a),i.appendChild(l.panel),r.appendChild(i);let h=[];a.addEventListener("click",()=>l.openPanel()),l.sendBtn.addEventListener("click",()=>void F(l.input.value)),l.input.addEventListener("keydown",d=>{d.key==="Enter"&&!d.shiftKey&&(d.preventDefault(),F(l.input.value))}),document.body.appendChild(o),b={siteKey:t.siteKey,apiBase:e,selector:t.selector,panelEls:l,history:h},document.addEventListener("keydown",d=>{d.key==="Escape"&&!l.panel.classList.contains("bxw-hidden")&&l.closePanel()})}function Q(t){if(!b){console.warn("[BharatXWidget] init() must be called first");return}t?.selector!==void 0&&(b.selector=t.selector),b.panelEls.openPanel(),F("Please summarize this page in plain text for a general reader (a few short paragraphs).")}return q(Z);})();
