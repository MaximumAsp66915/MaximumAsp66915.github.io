// Client side of the visit logger. Sends anonymous events to our own server.
// Rules: no cookies, no localStorage/sessionStorage, no fingerprinting, honours DNT / Global Privacy Control.
// The server derives a daily-rotating hash from IP + User-Agent; nothing identifying is sent from here.
(function () {
  "use strict";
  const endpoint = (window.SITE_CONFIG || {}).logEndpoint;
  const optedOut = navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true;
  const enabled = Boolean(endpoint) && !optedOut;

  // Diagnostics: always on localhost, and on any host with ?debug=1 in the URL. Says (console + a small badge) whether this
  // browser will send statistics, and if not, why. Never runs for normal visitors.
  if (["localhost", "127.0.0.1"].includes(location.hostname) || /[?&]debug=1\b/.test(location.search)) {
    const say = (ok, text) => {
      (ok ? console.info : console.warn)("[visit logging] " + text);
      const show = () => {
        let b = document.getElementById("vl-debug");
        if (!b) { b = document.createElement("div"); b.id = "vl-debug"; b.style.cssText = "cursor:pointer;position:fixed;left:8px;bottom:calc(8px + env(safe-area-inset-bottom));z-index:99999;max-width:90vw;font:12px/1.4 system-ui,sans-serif;padding:6px 10px;border-radius:8px;color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.4)"; document.body.append(b); }
        b.style.background = ok ? "#1f6a5f" : "#8e3556"; b.textContent = "visit logging: " + text; b.title = "tap to dismiss"; b.onclick = () => b.remove();
        clearTimeout(b._t); if (ok && /^ON/.test(text)) b._t = setTimeout(() => b.remove(), 5000); // good news disappears by itself
      };
      document.body ? show() : addEventListener("DOMContentLoaded", show);
    };
    if (!endpoint) say(false, "disabled, no endpoint configured");
    else if (optedOut) say(false, "OFF in this browser: it sends Do Not Track / Global Privacy Control, so nothing is recorded (by design)");
    else {
      say(true, "will send to " + endpoint + " ...checking");
      fetch(endpoint + "/health", { mode: "no-cors", cache: "no-store" }).then(
        () => say(true, "ON, logger reachable (" + endpoint + ")"),
        () => say(false, "logger NOT reachable from this browser: an ad/tracker blocker, VPN/DNS filter or firewall is blocking " + endpoint));
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
