// Single-page site: hash routes, content from data.js, effects from fx.js, anonymous events via tracker.js.
// The side panel starts closed (cover). Picking a menu item opens it; the grip can be dragged to resize or close it.
(function () {
  "use strict";
  const S = window.SITE, FX = window.FX;
  const $ = (sel, root = document) => root.querySelector(sel);
  const body = document.body, root = document.documentElement, app = $("#app");
  const slug = s => String(s).replace(/[^A-Za-z0-9/_.:-]/g, "-").slice(0, 48);
  const track = (type, target, value) => window.Tracker && window.Tracker.event(type, slug(target), value);
  const state = { tag: "all", tech: null, q: "" };
  let lastToggle = 0;            // last time the panel opened/closed or the page changed (cooldown for scroll gestures)
  let enterFrom = "bottom";      // direction the next page slides in from
  let pendingScroll = "top";     // where to land on the next page
  const isClosed = () => body.classList.contains("landing");

  const ROUTES = {
    home:       { label: "Home",       icon: "🏠", render: renderHome },
    projects:   { label: "Projects",   icon: "🛠️", render: renderProjects },
    experience: { label: "Experience", icon: "💼", render: renderExperience },
    cv:         { label: "CV",         icon: "📄", render: renderCV },
    misc:       { label: "Misc",       icon: "✨", render: renderMisc },
    privacy:    { label: "Privacy",    render: renderPrivacy, hidden: true },
  };
  const NAV = ["home", "projects", "experience", "cv", "misc"];

  // ---------------------------------------------------------------- helpers
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(kid));
    }
    return el;
  }
  const NS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs, ...kids) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    kids.flat().forEach(k => el.append(k.nodeType ? k : document.createTextNode(k)));
    return el;
  }
  const ext = (text, href, id, cls) => h("a", { href, class: cls, target: "_blank", rel: "noopener noreferrer", "data-track": "click", "data-target": id }, text);
  const go = route => { location.hash = "#/" + route; };

  function page(name, title, ...kids) {
    return h("div", { class: "pagein" + (enterFrom === "top" ? " from-top" : "") },
      h("div", { class: "crumb" }, h("a", { href: "#/home" }, "Home"), name === "home" ? "" : " / " + ROUTES[name].label),
      h("h1", { class: "title", tabindex: "-1" }, title),
      h("hr", { class: "rule" }),
      kids);
  }
  const sub = (name, title, ...kids) => h("div", { "data-section": name }, h("h2", { class: "sub reveal" }, title), kids);
  const rv = (el) => { el.classList.add("reveal"); return el; };

  // reveal-on-scroll, count-up, section events
  let revealObs = null;
  function activate(rootEl) {
    if (revealObs) revealObs.disconnect();
    const items = [...rootEl.querySelectorAll(".reveal, [data-section]")];
    items.filter(e => e.classList.contains("reveal")).forEach((e, i) => e.style.setProperty("--i", String(i % 8)));
    if (!("IntersectionObserver" in window)) { items.forEach(e => e.classList.add("in")); rootEl.querySelectorAll("[data-to]").forEach(FX.count); return; }
    revealObs = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target;
      el.classList.add("in");
      el.querySelectorAll("[data-to]").forEach(FX.count);
      if (el.dataset.section && window.Tracker) window.Tracker.section(el.dataset.section);
      revealObs.unobserve(el);
    }), { threshold: 0.15 });
    items.forEach(e => revealObs.observe(e));
  }

  const cvDate = S.cvUpdated;

  function copyEmail() {
    const done = () => { FX.toast("Email copied ✉️"); track("click", "email-copy"); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(S.email).then(done, () => { location.href = "mailto:" + S.email; });
    else location.href = "mailto:" + S.email;
  }

  // ------------------------------------------------------------------ pages
  function renderHome() {
    const img = (n) => `assets/img/portrait-${n}`;
    const set = ext_ => [480, 800, 1200, 1500].map(n => `${img(n)}.${ext_} ${n}w`).join(", ");
    return page("home", "Hello 👋",
      h("div", { class: "hero" },
        h("div", { class: "tilt portrait" },
          h("picture", {},
            h("source", { type: "image/webp", srcset: set("webp"), sizes: "(min-width: 40rem) 240px, 70vw" }),
            h("img", { src: img(800) + ".jpg", srcset: set("jpg"), sizes: "(min-width: 40rem) 240px, 70vw", width: 480, height: 600, alt: "Mohammadhossein Sabzalian standing under autumn trees" }))),
        h("div", { class: "about" },
          S.about.map((p, i) => h("p", { class: i === 0 ? "lead" : "" }, p)),
          h("div", { class: "actions" }, h("a", { class: "btn", href: "#/cv" }, "Get my CV"), h("a", { class: "btn ghost", href: "#/projects" }, "See projects")))),
      sub("contact", "Find me", h("div", { class: "chips reveal contact" },
        ext("GitHub", S.github, "gh-profile", "chip"), h("button", { class: "chip", type: "button", onclick: copyEmail }, "Copy email"), ext("LinkedIn", S.linkedin, "linkedin", "chip"))),
      sub("interests", "I like", h("div", { class: "chips reveal" }, S.interests.map(i =>
        h("button", { class: "chip", type: "button", onclick: () => { state.tag = i.tag; state.tech = null; state.q = ""; track("click", "interest-" + i.tag); go("projects"); } }, i.icon + " " + i.label)))));
  }

  function renderProjects() {
    const q = h("input", { class: "search", type: "search", placeholder: "Search projects or tech…", "aria-label": "Search projects", value: state.q });
    const chipBox = h("div", { class: "chips", role: "group", "aria-label": "Filter" });
    const techChip = h("div", { class: "chips", style: "margin-top:.5rem" });
    const count = h("div", { class: "count", role: "status" });
    const empty = h("div", { class: "empty", hidden: true }, "Nothing here yet 🙂 ", h("button", { class: "chip", type: "button", onclick: () => { state.tag = "all"; state.tech = null; state.q = ""; q.value = ""; refresh(); } }, "Reset"));
    const cards = S.projects.map(p => ({ p, el: projectCard(p) }));
    const list = h("div", { class: "projects" }, cards.map(c => c.el));

    function refresh() {
      chipBox.replaceChildren(...["all", "hardware", "embedded", "software", "data"].map(t =>
        h("button", { type: "button", class: "chip", "aria-pressed": String(state.tag === t), onclick: () => { state.tag = t; track("click", "filter-" + t); refresh(); } }, t[0].toUpperCase() + t.slice(1))));
      techChip.replaceChildren(...(state.tech ? [h("button", { type: "button", class: "chip x", onclick: () => { state.tech = null; refresh(); } }, "Tech: " + state.tech)] : []));
      const needle = state.q.trim().toLowerCase();
      let shown = 0;
      cards.forEach(({ p, el }) => {
        const ok = (state.tag === "all" || p.tags.includes(state.tag)) &&
          (!state.tech || p.tech.includes(state.tech)) &&
          (!needle || (p.title + " " + p.line + " " + p.tech.join(" ") + " " + p.tags.join(" ")).toLowerCase().includes(needle));
        const wasHidden = el.classList.contains("hide");
        el.classList.toggle("hide", !ok);
        if (ok) { shown++; if (wasHidden) { el.classList.remove("pagein"); void el.offsetWidth; el.classList.add("pagein"); } }
      });
      count.textContent = `${shown} of ${cards.length}`;
      empty.hidden = shown !== 0;
    }
    let t;
    q.addEventListener("input", () => { state.q = q.value; clearTimeout(t); t = setTimeout(() => track("click", "search"), 800); refresh(); });
    refresh();
    return page("projects", "Projects", q, chipBox, techChip, count, list, empty);
  }
  function projectCard(p) {
    return h("button", { type: "button", class: "tilt pcard reveal", onclick: () => openProject(p.id) },
      h("div", { class: "top" }, h("span", { class: "emoji" }, p.icon), h("div", {}, h("h3", {}, p.title), h("div", { class: "w" }, p.when))),
      h("p", {}, p.line),
      h("div", {}, p.tags.map(t => h("span", { class: "pill " + t }, t))));
  }

  // modal with a small animated overview: flow diagram, key numbers, bullets
  const modal = $("#modal");
  function flowEl(flow) {
    let k = 0;
    const box = h("div", { class: "flow", role: "list", "aria-label": "How it works" });
    flow.forEach((step, i) => {
      if (i) box.append(h("span", { class: "arrow", "aria-hidden": "true", style: `--k:${k++}` }, "→"));
      if (Array.isArray(step)) { const kk = k++; box.append(h("div", { class: "fan" }, step.map(s => h("span", { class: "node", role: "listitem", style: `--k:${kk}` }, s)))); }
      else box.append(h("span", { class: "node", role: "listitem", style: `--k:${k++}` }, step));
    });
    return box;
  }
  function openProject(id) {
    const i = S.projects.findIndex(p => p.id === id), p = S.projects[i];
    const step = d => openProject(S.projects[(i + d + S.projects.length) % S.projects.length].id);
    modal.dataset.id = id;
    modal.replaceChildren(h("div", { class: "sheet" },
      h("button", { class: "close", type: "button", "aria-label": "Close", onclick: () => modal.close() }, "✕"),
      h("div", { class: "muted" }, p.icon + " " + p.when + " · " + p.meta),
      h("h2", {}, p.title),
      flowEl(p.flow),
      p.extras ? h("div", { class: "extras" }, p.extras.map(t => h("span", { class: "pill" }, t))) : null,
      h("div", { class: "facts" }, p.facts.map(([n, label, dec, comma]) =>
        h("div", { class: "fact" }, h("b", { "data-to": n, "data-dec": dec || 0, "data-comma": comma ? "1" : null }, "0"), h("span", {}, label)))),
      h("ul", { class: "points" }, p.points.map(t => h("li", {}, t))),
      h("div", { class: "chips", style: "margin:.6rem 0" }, p.tech.map(t =>
        h("button", { class: "chip", type: "button", title: "Show projects using " + t, onclick: () => { state.tech = t; state.tag = "all"; state.q = ""; track("click", "tech-" + t); modal.close(); if (!isClosed() && currentRoute === "projects") rerender(); else { setOpen(true); go("projects"); } } }, t))),
      p.links.length ? h("div", { class: "actions" }, p.links.map(([label, href, tid], n) => ext(label + " ↗", href, tid, n === 0 ? "btn" : "btn ghost"))) : null,
      h("div", { class: "nav" }, h("button", { type: "button", onclick: () => step(-1) }, "← Previous"), h("button", { type: "button", onclick: () => step(1) }, "Next →"))));
    if (!modal.open) modal.showModal();
    modal.querySelectorAll("[data-to]").forEach(FX.count);
    track("click", "project-" + id);
  }
  modal.addEventListener("click", e => { if (e.target === modal) modal.close(); });
  modal.addEventListener("keydown", e => {
    const i = S.projects.findIndex(p => p.id === modal.dataset.id);
    if (e.key === "ArrowRight") openProject(S.projects[(i + 1) % S.projects.length].id);
    if (e.key === "ArrowLeft") openProject(S.projects[(i - 1 + S.projects.length) % S.projects.length].id);
  });

  function renderExperience() {
    const uses = t => S.projects.filter(p => p.tech.includes(t)).length;
    return page("experience", "Experience",
      h("div", { class: "timeline" }, S.timeline.map(t =>
        rv(h("div", { class: "tl" }, h("span", { class: "when" }, t.icon + " " + t.when), h("b", {}, t.title), h("span", { class: "n" }, t.note))))),
      sub("skills", "Skills", h("p", { class: "muted reveal" }, "Tap a skill to see the projects that use it."),
        S.skills.map(([group, items]) => h("div", { class: "skillgroup reveal" }, h("h3", {}, group), h("div", { class: "chips" }, items.map(t => {
          const n = uses(t);
          return n ? h("button", { type: "button", class: "chip", onclick: () => { state.tech = t; state.tag = "all"; state.q = ""; track("click", "skill-" + t); go("projects"); } }, t, h("small", {}, "×" + n)) : h("span", { class: "chip static" }, t);
        }))))));
  }

  function renderCV() {
    const ln = (k, cls, w) => h("i", { class: "ln " + (cls || ""), style: `--k:${k};width:${w}%` });
    let k = 0;
    const sheet = h("div", { class: "tilt cvsheet", "aria-hidden": "true" },
      h("div", { class: "hd" }, h("img", { src: "assets/img/avatar-128.jpg", alt: "", width: 40, height: 40 }), h("div", { class: "hdl" }, ln(k++, "t", 86), ln(k++, "", 55))),
      [[3, 100], [4, 92], [3, 98]].map(([n, w]) => h("div", { class: "blk" }, ln(k++, "h", 38), Array.from({ length: n }, (_, i) => ln(k++, "", i === n - 1 ? w * .6 : w)))),
      h("div", { class: "stamp" }, "Updated", h("br"), cvDate));
    const btn = h("a", { class: "btn big pulse", href: S.cvFile, download: "Mohammadhossein_Sabzalian_CV.pdf", "data-track": "download", "data-target": "cv" }, "⬇ Download CV");
    btn.addEventListener("click", () => {
      const r = btn.getBoundingClientRect();
      FX.confetti(r.left + r.width / 2, r.top + r.height / 2);
      FX.toast("Enjoy! 🎉");
      sheet.classList.remove("sent"); void sheet.offsetWidth; sheet.classList.add("sent");
      btn.textContent = "✓ Downloaded"; btn.classList.remove("pulse");
      setTimeout(() => { btn.textContent = "⬇ Download CV"; btn.classList.add("pulse"); }, 3000);
    });
    return page("cv", "CV",
      h("div", { class: "cvstage" }, sheet,
        h("div", { class: "cvinfo" },
          h("p", { class: "lead" }, "My CV as a PDF."),
          h("ul", { class: "cvmeta" }, h("li", {}, "🗓 Updated ", h("b", {}, cvDate)), h("li", {}, "📄 " + S.cvMeta)),
          h("div", { class: "actions" }, btn))));
  }

  function renderMisc() {
    return page("misc", "Misc",
      h("p", { class: "lead" }, "Anything that doesn't fit the other pages ends up here."),
      h("p", { class: "muted" }, "More as it comes ✍️"));
  }

  function renderPrivacy() {
    return page("privacy", "Privacy",
      h("p", {}, "I count visits anonymously to see which pages and files are useful. Run by Mohammadhossein Sabzalian, ", h("a", { href: "mailto:" + S.email }, S.email), "."),
      h("ul", { class: "points" },
        h("li", {}, "Recorded: page, section and time spent, scroll depth, downloads, link clicks, referring site (domain), device type, and the tag in a link (?ref=)."),
        h("li", {}, "A daily visitor code: a one-way hash of IP and browser plus a secret that changes every day. It can't be reversed or linked across days."),
        h("li", {}, "Never stored: your IP address or browser identifier. No cookies, no local storage, no fingerprinting, no third-party trackers or fonts."),
        h("li", {}, "Do Not Track or Global Privacy Control: nothing is recorded."),
        h("li", {}, "Basis: legitimate interest (GDPR Art. 6(1)(f)). Deleted after 12 months. Daily codes can't be tied to a person, so individual lookup or deletion isn't possible."),
        h("li", {}, "Hosting: GitHub Pages has its own privacy policy.")));
  }

  // ----------------------------------------------------------------- router
  let currentRoute = null, first = true;
  const routeName = () => { const m = location.hash.match(/^#\/([a-z]+)/); return m && ROUTES[m[1]] ? m[1] : "home"; };

  function renderNav(active) {
    const items = NAV.map((k, n) => h("a", { href: "#/" + k, "data-route": k, style: `--n:${n}`, "aria-current": k === active ? "page" : null },
      h("span", { class: "ni", "aria-hidden": "true" }, ROUTES[k].icon), h("span", { class: "nl" }, ROUTES[k].label)));
    $("#nav").replaceChildren(...items);
    const pager = $("#pager");
    if (pager) pager.replaceChildren(...NAV.map((k, n) => h("button", { type: "button", title: ROUTES[k].label, "aria-label": "Go to " + ROUTES[k].label, "aria-current": k === active ? "page" : null,
      onclick: () => { const cur = NAV.indexOf(currentRoute); enterFrom = n < cur ? "top" : "bottom"; track("click", "pager-" + k); location.hash = "#/" + k; } })));
  }
  function rerender() { app.replaceChildren(ROUTES[currentRoute].render()); activate(app); }
  function navigate() {
    const name = routeName();
    const changed = name !== currentRoute;
    currentRoute = name;
    if (name !== "home") body.classList.remove("landing"); // deep links open the panel
    if (changed) {
      document.title = (name === "home" ? "" : ROUTES[name].label + " · ") + S.name;
      renderNav(name);
      rerender();
      window.scrollTo(0, pendingScroll === "bottom" ? document.documentElement.scrollHeight : 0);
      pendingScroll = "top"; enterFrom = "bottom"; lastToggle = performance.now();
      if (!first && !isClosed()) { const t = $("h1", app); t && t.focus({ preventScroll: true }); }
    }
    first = false;
    window.Tracker && window.Tracker.view(isClosed() ? "cover" : name);
  }

  addEventListener("hashchange", navigate);
  navigate(); // pages render first; everything below is optional polish and can never block them

  const safe = (name, fn) => { try { fn(); } catch (e) { console.warn("optional feature failed: " + name, e); } };

  // ------------------------------------------------- the movable side panel
  function setOpen(open) { body.classList.toggle("landing", !open); lastToggle = performance.now(); }
  function openPanel() {
    if (!isClosed()) return;
    setOpen(true); window.scrollTo(0, 0);
    window.Tracker && currentRoute && window.Tracker.view(currentRoute);
  }
  function closePanel() {
    if (isClosed()) return;
    setOpen(false); root.style.removeProperty("--side");
    window.Tracker && window.Tracker.view("cover");
  }
  // menu: open the panel and show the chosen page (works even when the hash is unchanged)
  $("#side").addEventListener("click", ev => {
    const a = ev.target.closest("a[data-route]");
    if (!a) return;
    ev.preventDefault();
    const r = a.dataset.route;
    if (location.hash === "#/" + r || (r === "home" && !location.hash)) openPanel(); else { setOpen(true); location.hash = "#/" + r; }
  });
  $("#close").addEventListener("click", () => { track("click", "panel-close"); closePanel(); });
  addEventListener("keydown", e => { if (e.key === "Escape" && !modal.open) closePanel(); });

  const grip = $("#grip");
  let drag = null;
  safe("grip", () => {
  grip.addEventListener("pointerdown", e => { drag = { wasClosed: isClosed() }; grip.setPointerCapture(e.pointerId); body.classList.add("dragging"); e.preventDefault(); });
  grip.addEventListener("pointermove", e => {
    if (!drag) return;
    const W = innerWidth;
    if (drag.wasClosed) { if (e.clientX < W * 0.8) { setOpen(true); drag.wasClosed = false; } else return; }
    root.style.setProperty("--side", Math.max(256, Math.min(e.clientX, W * 0.9)) + "px");
  });
  function endDrag(e) {
    if (!drag) return;
    body.classList.remove("dragging");
    if (!drag.wasClosed) {
      if (e.clientX > innerWidth * 0.8) { track("click", "panel-drag-close"); closePanel(); }
      else { root.style.setProperty("--side", Math.max(256, Math.min(e.clientX, innerWidth * 0.6)) + "px"); track("click", "panel-resize"); }
    }
    drag = null;
  }
  grip.addEventListener("pointerup", endDrag); grip.addEventListener("pointercancel", endDrag);
  grip.addEventListener("keydown", e => {
    const cur = parseFloat(getComputedStyle($("#side")).width);
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); isClosed() ? openPanel() : closePanel(); }
    else if (e.key === "ArrowLeft" && !isClosed()) root.style.setProperty("--side", Math.max(256, cur - 32) + "px");
    else if (e.key === "ArrowRight" && !isClosed()) root.style.setProperty("--side", Math.min(innerWidth * 0.6, cur + 32) + "px");
  });
  });

  // scrolling moves through the pages: down on the cover opens Home; down at the bottom of a page goes to the next menu item,
  // up at the top goes to the previous one; up at the top of Home closes the panel. A gesture only counts if it STARTS at the
  // edge, and each gesture triggers at most one move, so trackpad momentum can never skip several pages.
  safe("scroll-pages", () => {
    const now = () => performance.now();
    const atTop = () => scrollY <= 1;
    const atBottom = () => scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
    // a gesture may START within 40 px of an edge (pages that barely overflow count as fitting); the move itself needs the exact edge
    const nearTop = () => scrollY <= 40;
    const nearBottom = () => scrollY + innerHeight >= document.documentElement.scrollHeight - 40;
    // After a page change the REST of the same gesture (trackpad inertia, a finger still moving, a fling) must not scroll the new
    // page: wheel events are cancelled, touchmoves are cancelled, and any scroll that still happens within 900 ms is pulled back to
    // the top. The new page therefore always starts at its top, in both directions.
    let holdUntil = 0, wheelLocked = false, touchLocked = false;
    const hold = () => { holdUntil = now() + 900; };
    addEventListener("scroll", () => { if (now() < holdUntil && scrollY > 0) scrollTo(0, 0); }, { passive: true });
    const openHome = () => {
      if (!isClosed()) return;
      track("click", "scroll-open"); hold();
      if (location.hash === "#/home" || !location.hash) { openPanel(); } else { setOpen(true); location.hash = "#/home"; }
    };
    const step = delta => {
      if (delta < 0 && currentRoute === "home") { track("click", "scroll-close"); hold(); closePanel(); return true; }
      const i = NAV.indexOf(currentRoute), j = i + delta;
      if (i < 0 || j < 0 || j >= NAV.length) return false;
      enterFrom = delta < 0 ? "top" : "bottom"; pendingScroll = "top"; hold();
      track("click", delta < 0 ? "scroll-prev" : "scroll-next");
      location.hash = "#/" + NAV[j];
      return true;
    };
    let lastWheel = 0, acc = 0, startTop = false, startBottom = false, used = false;
    addEventListener("wheel", e => {
      if (e.ctrlKey || modal.open) return; // pinch-zoom and the open modal keep their normal behaviour
      const t = now(), fresh = t - lastWheel > 250; lastWheel = t;
      if (fresh) { acc = 0; used = false; startTop = nearTop(); startBottom = nearBottom(); if (t - lastToggle >= 700) wheelLocked = false; }
      if (wheelLocked) { e.preventDefault(); return; }
      if (used || t - lastToggle < 700) return;
      acc += e.deltaY;
      if (isClosed()) { if (acc > 30) { used = true; wheelLocked = true; openHome(); } return; }
      if (acc > 60 && startBottom && atBottom()) { used = step(1); wheelLocked = used; }
      else if (acc < -60 && startTop && atTop()) { used = step(-1); wheelLocked = used; }
    }, { passive: false });
    let ty = null, tTop = false, tBottom = false;
    addEventListener("touchstart", e => { ty = e.touches[0].clientY; tTop = nearTop(); tBottom = nearBottom(); touchLocked = false; }, { passive: true });
    addEventListener("touchmove", e => {
      if (modal.open) return;
      if (touchLocked) { if (e.cancelable) e.preventDefault(); return; }
      if (ty === null || now() - lastToggle < 700) return;
      const dy = e.touches[0].clientY - ty;
      if (isClosed()) { if (dy < -40) { ty = null; touchLocked = true; openHome(); } return; }
      if (dy < -70 && tBottom && atBottom()) { if (step(1)) { ty = null; touchLocked = true; } }
      else if (dy > 70 && tTop && atTop()) { if (step(-1)) { ty = null; touchLocked = true; } }
    }, { passive: false });
    addEventListener("touchend", () => { ty = null; touchLocked = false; }, { passive: true });
    addEventListener("touchcancel", () => { ty = null; touchLocked = false; }, { passive: true });
    addEventListener("keydown", e => { // keyboard users: scroll keys on the cover open Home too
      if (isClosed() && ["ArrowDown", "PageDown", "End", " "].includes(e.key) && !e.target.closest("button, a, input, textarea, [role=button]")) { e.preventDefault(); openHome(); }
    });
  });

  // ---------------------------------------------------------------- sidebar
  $("#tagline").textContent = S.tagline;
  safe("typed", () => FX.typed($("#typed"), S.phrases));
  safe("particles", () => FX.particles($("#bg"), $("#side")));
  const icon = d => svg("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" }, svg("path", { d }));
  $("#social").append(
    h("a", { href: S.github, target: "_blank", rel: "noopener noreferrer", "aria-label": "GitHub", title: "GitHub", "data-track": "click", "data-target": "gh-profile" },
      icon("M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.7 5.39-5.27 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z")),
    h("button", { type: "button", "aria-label": "Copy email address", title: "Copy email", onclick: copyEmail },
      icon("M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1.2 2 7.8 5.6L19.8 7H4.2ZM4 9.1V17h16V9.1l-8 5.7-8-5.7Z")),
    h("a", { href: S.linkedin, target: "_blank", rel: "noopener noreferrer", "aria-label": "LinkedIn", title: "LinkedIn", "data-track": "click", "data-target": "linkedin" },
      icon("M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4V21H3V9.5Zm6.5 0h3.8v1.6h.06c.53-1 1.83-2 3.77-2 4.03 0 4.77 2.65 4.77 6.1V21h-4v-5c0-1.2-.02-2.73-1.66-2.73-1.67 0-1.92 1.3-1.92 2.65V21h-4V9.5Z")));
  $(".name").dataset.route = "home";

  document.addEventListener("click", ev => { const a = ev.target.closest("a[data-track]"); if (a) track(a.dataset.track, a.dataset.target || "link"); });

  // dark mode: the button shows the mode you would switch to (🌙 = go dark, ☀️ = go light)
  const themeBtn = $("#theme"), mq = matchMedia("(prefers-color-scheme: dark)");
  const isDark = () => root.dataset.theme ? root.dataset.theme === "dark" : mq.matches;
  function syncTheme() {
    themeBtn.textContent = isDark() ? "☀️" : "🌙";
    themeBtn.setAttribute("aria-label", isDark() ? "Switch to light mode" : "Switch to dark mode");
    themeBtn.title = isDark() ? "Light mode" : "Dark mode";
  }
  themeBtn.addEventListener("click", () => {
    root.dataset.theme = isDark() ? "light" : "dark"; // deliberately not persisted: nothing is stored on the device
    syncTheme(); track("click", "theme");
  });
  safe("theme", () => { (mq.addEventListener ? mq.addEventListener.bind(mq, "change") : mq.addListener.bind(mq))(syncTheme); });
  syncTheme();

})();
