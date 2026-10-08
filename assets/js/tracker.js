// Client side of the visit logger. Sends anonymous events to our own server.
// Rules: no cookies, no localStorage/sessionStorage, no fingerprinting, honours DNT / Global Privacy Control.
// The server derives a daily-rotating hash from IP + User-Agent; nothing identifying is sent from here.
(function () {
  "use strict";
  const endpoint = (window.SITE_CONFIG || {}).logEndpoint;
  const optedOut = navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true;
  const enabled = Boolean(endpoint) && !optedOut;

  // Diagnostics for local previews only (never runs on the live site): say in the console why nothing might arrive.
  if (["localhost", "127.0.0.1"].includes(location.hostname)) {
    if (!endpoint) console.warn("[visit logging] disabled: no endpoint configured");
    else if (optedOut) console.warn("[visit logging] disabled: your browser sends Do Not Track / Global Privacy Control, so nothing is recorded (by design)");
    else {
      console.info("[visit logging] sending to " + endpoint + " (localhost previews are filed as 'dev' on the server)");
      fetch(endpoint + "/health", { mode: "no-cors", cache: "no-store" }).catch(() =>
        console.warn("[visit logging] cannot reach " + endpoint + ": logger down, port blocked by a firewall, or an extension/VPN blocks it. Try adding ?logger=local to the URL."));
    }
  }

  // ?ref=<tag> identifies a link you handed out (e.g. ?ref=mit-lab-x). Kept in memory only.
  const rawRef = new URLSearchParams(location.search).get("ref");
  const ref = rawRef && /^[A-Za-z0-9_-]{1,32}$/.test(rawRef) ? rawRef : null;

  let referrer = null;
  try {
    const h = document.referrer && new URL(document.referrer).hostname.toLowerCase();
    if (h && h !== location.hostname) referrer = h;
  } catch (_) { /* ignore */ }

  let page = null, idle = false, activeMs = 0, since = null, maxScroll = 0, firstView = true, seen = new Set();

  function send(type, target, value) {
    if (!enabled) return;
    const body = { type, target, ref };
    if (typeof value === "number" && isFinite(value)) body.value = Math.round(value * 10) / 10;
    if (type === "view" && firstView && referrer) body.referrer = referrer;
    // text/plain keeps this a CORS "simple request" (no preflight); the server parses it as JSON.
    const blob = new Blob([JSON.stringify(body)], { type: "text/plain;charset=UTF-8" });
    try {
      if (!(navigator.sendBeacon && navigator.sendBeacon(endpoint + "/e", blob))) {
        fetch(endpoint + "/e", { method: "POST", body: blob, keepalive: true, mode: "cors", credentials: "omit" }).catch(() => {});
      }
    } catch (_) { /* logging must never break the page */ }
  }

  function tick() {
    if (since !== null) { activeMs += performance.now() - since; since = null; }
  }
  function resume() {
    if (document.visibilityState === "visible" && since === null) { since = performance.now(); idle = false; }
  }
  function scrollPct() {
    const el = document.documentElement;
    const room = el.scrollHeight - innerHeight;
    return room <= 0 ? 100 : Math.min(100, Math.round((scrollY / room) * 100));
  }
  function flush() {
    if (!page || idle) return;
    idle = true;
    tick();
    send("dwell", page, activeMs / 1000);
    send("scroll", page, Math.max(maxScroll, scrollPct()));
    activeMs = 0; maxScroll = 0;
  }

  window.Tracker = {
    view(name) {
      flush();
      page = name; seen = new Set(); resume();
      send("view", name);
      firstView = false;
    },
    event(type, target, value) { send(type, target, value); },
    section(name) { if (page && !seen.has(name)) { seen.add(name); send("section", page + ":" + name); } },
  };

  addEventListener("scroll", () => { maxScroll = Math.max(maxScroll, scrollPct()); }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(); else resume();
  });
  addEventListener("pagehide", flush);
})();
