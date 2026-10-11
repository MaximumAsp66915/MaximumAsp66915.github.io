// ONE continuous page: cover, Home, Projects, Experience, CV and Misc are stacked sections of a single scrolling document.
//  - Desktop: the fixed sidebar morphs from a full-screen cover into the docked sidebar as you scroll (scroll-linked, no snap).
//  - Phone: the cover is the first screen and scrolls away; a top bar and a bottom tab bar fade in.
//  - Menu / tabs / dots smooth-scroll to a section and light up the section you are in (scroll-spy).
// Content comes from data.js, effects from fx.js, anonymous events from tracker.js.
(function () {
  "use strict";
  const S = window.SITE, FX = window.FX;
  const $ = (sel, root = document) => root.querySelector(sel);
  const root = document.documentElement, app = $("#app"), side = $("#side");
  const slug = s => String(s).replace(/[^A-Za-z0-9/_.:-]/g, "-").slice(0, 48);
  const track = (type, target, value) => window.Tracker && window.Tracker.event(type, slug(target), value);
  const state = { tag: "all", tech: null, q: "" };
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const mobileMQ = matchMedia("(max-width: 56rem)");
  const isMobile = () => mobileMQ.matches;
  // instant scroll, whatever the CSS says (a smooth reset would fight the finger / wheel momentum)
  const jump = y => { root.style.scrollBehavior = "auto"; window.scrollTo(0, y); root.style.scrollBehavior = ""; };

  const PAGES = {
    home:       { label: "Home",       icon: "🏠", render: renderHome },
    projects:   { label: "Projects",   icon: "🛠️", render: renderProjects },
    experience: { label: "Experience", icon: "💼", render: renderExperience },
    cv:         { label: "CV",         icon: "📄", render: renderCV },
    misc:       { label: "Misc",       icon: "✨", render: renderMisc },
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

  // a "page" is a section of the long page
  function page(id, title, ...kids) {
    return h("section", { class: "page", id, "data-page": id },
      h("h1", { class: "title", tabindex: "-1" }, title),
      h("hr", { class: "rule" }),
      kids);
  }
  const sub = (name, title, ...kids) => h("div", { "data-section": name }, h("h2", { class: "sub reveal" }, title), kids);
  const rv = (el) => { el.classList.add("reveal"); return el; };

  // reveal-on-scroll, count-up, section events: one observer for the whole page; activate(root) registers new elements
  let revealObs = null;
  function activate(rootEl) {
    const items = [...rootEl.querySelectorAll(".reveal, [data-section]")];
    items.filter(e => e.classList.contains("reveal")).forEach((e, i) => e.style.setProperty("--i", String(i % 8)));
    if (!("IntersectionObserver" in window)) { items.forEach(e => e.classList.add("in")); rootEl.querySelectorAll("[data-to]").forEach(FX.count); return; }
    if (!revealObs) revealObs = new IntersectionObserver(entries => entries.forEach(en => {
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

  // re-render one section in place (e.g. Projects after a filter was chosen elsewhere) and scroll to it
  function showProjects() {
    const old = $("#projects"), fresh = PAGES.projects.render();
    old.replaceWith(fresh); activate(fresh);
    scrollToId("projects");
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
        h("button", { class: "chip", type: "button", onclick: () => { state.tag = i.tag; state.tech = null; state.q = ""; track("click", "interest-" + i.tag); showProjects(); } }, i.icon + " " + i.label)))));
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
        h("button", { class: "chip", type: "button", title: "Show projects using " + t, onclick: () => { state.tech = t; state.tag = "all"; state.q = ""; track("click", "tech-" + t); modal.close(); showProjects(); } }, t))),
      p.links.length ? h("div", { class: "actions" }, p.links.map(([label, href, tid], n) => ext(label + " ↗", href, tid, n === 0 ? "btn" : "btn ghost"))) : null,
      h("div", { class: "nav" }, h("button", { type: "button", onclick: () => step(-1) }, "← Previous"), h("button", { type: "button", onclick: () => step(1) }, "Next →"))));
    if (!modal.open) modal.showModal();
    modal.querySelectorAll("[data-to]").forEach(FX.count);
    track("click", "project-" + id);
  }
  modal.addEventListener("click", e => { if (e.target === modal) modal.close(); });
  modal.addEventListener("keydown", e => {
    if (!modal.dataset.id) return; // the privacy notice uses the same dialog
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
          return n ? h("button", { type: "button", class: "chip", onclick: () => { state.tech = t; state.tag = "all"; state.q = ""; track("click", "skill-" + t); showProjects(); } }, t, h("small", {}, "×" + n)) : h("span", { class: "chip static" }, t);
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

  // the privacy notice opens in the shared dialog (footer link / #/privacy)
  function openPrivacy() {
    modal.dataset.id = "";
    modal.replaceChildren(h("div", { class: "sheet" },
      h("button", { class: "close", type: "button", "aria-label": "Close", onclick: () => modal.close() }, "✕"),
      h("h2", {}, "Privacy"),
      h("p", {}, "I count visits anonymously to see which pages and files are useful. Run by Mohammadhossein Sabzalian, ", h("a", { href: "mailto:" + S.email }, S.email), "."),
      h("ul", { class: "points" },
        h("li", {}, "Recorded: page, section and time spent, scroll depth, downloads, link clicks, referring site (domain), device type, and the tag in a link (?ref=)."),
        h("li", {}, "A daily visitor code: a one-way hash of IP and browser plus a secret that changes every day. It can't be reversed or linked across days."),
        h("li", {}, "Never stored: your IP address or browser identifier. No cookies, no local storage, no fingerprinting, no third-party trackers or fonts."),
        h("li", {}, "Do Not Track or Global Privacy Control: nothing is recorded."),
        h("li", {}, "Basis: legitimate interest (GDPR Art. 6(1)(f)). Deleted after 12 months. Daily codes can't be tied to a person, so individual lookup or deletion isn't possible."),
        h("li", {}, "Hosting: GitHub Pages has its own privacy policy."))));
    if (!modal.open) modal.showModal();
    track("click", "privacy");
  }

  // ------------------------------------------------- build the page (always first, so nothing optional can blank it)
  app.replaceChildren(...NAV.map(id => PAGES[id].render()));
  activate(app);

  // --------------------------------------------------- geometry, scroll-linked cover, scroll-spy
  let D = 0, SIDE_PX = 336, vh = innerHeight;      // D = distance (px) over which the desktop cover turns into the sidebar
  const ease = p => p * p * (3 - 2 * p);           // smoothstep
  const invEase = e => 0.5 - Math.sin(Math.asin(1 - 2 * clamp(e)) / 3);
  function measure() {
    vh = innerHeight;
    SIDE_PX = parseFloat(getComputedStyle(root).fontSize) * 21;
    D = isMobile() ? 0 : Math.round(clamp(vh * 0.6, 320, 640));
    root.style.setProperty("--cover", D + "px");
  }
  const barPx = () => (isMobile() ? ($("#bar").offsetHeight || 56) : 0);
  const sectionTop = id => $("#" + id).getBoundingClientRect().top + scrollY;
  const targetY = id => id === "cover" ? 0 : Math.max(0, Math.round(sectionTop(id) - barPx()));

  let navTarget = null;       // while a menu click is scrolling, that section stays highlighted
  let lastActive = null, viewT = 0, viewed = null, particles = null;
  const progress = $("#progress");

  function computeActive() {
    const y = scrollY, room = root.scrollHeight - vh;
    if (navTarget) return navTarget;
    if (y < (isMobile() ? vh * 0.5 : D * 0.5)) return "cover";
    if (room > 0 && y >= room - 4) return NAV[NAV.length - 1];
    const probe = isMobile() ? barPx() + vh * 0.3 : vh * 0.35;
    let act = NAV[0];
    for (const id of NAV) if ($("#" + id).getBoundingClientRect().top <= probe) act = id;
    return act;
  }
  function setActive(id) {
    if (id === lastActive) return;
    lastActive = id;
    const cur = id === "cover" ? null : id;
    document.querySelectorAll("#nav a, #tabs a").forEach(a => a.toggleAttribute("aria-current", false) || (a.dataset.route === cur && a.setAttribute("aria-current", "page")));
    document.querySelectorAll("#pager button").forEach(b => b.toggleAttribute("aria-current", false) || (b.dataset.route === cur && b.setAttribute("aria-current", "page")));
    document.title = (cur ? PAGES[cur].label + " · " : "") + S.name;
    try { history.replaceState(null, "", cur ? "#/" + cur : location.pathname + location.search); } catch (_) { /* file:// etc. */ }
    clearTimeout(viewT);
    viewT = setTimeout(() => { if (viewed !== id) { viewed = id; window.Tracker && window.Tracker.view(id === "cover" ? "cover" : id); } }, 500);
  }

  function update() {
    const y = scrollY, W = root.clientWidth; // visible width (without the scrollbar)
    let e, bo = 0;
    if (!isMobile()) {
      e = ease(clamp(D ? y / D : 1));
      const w = W - (W - SIDE_PX) * e;
      side.style.width = w.toFixed(1) + "px";
      root.style.setProperty("--sw", w.toFixed(1) + "px");
    } else {
      e = clamp(y / (vh * 0.6));
      bo = clamp((y - vh * 0.5) / (vh * 0.5 - barPx())); // fully in exactly when the cover's bottom edge reaches the bar
      side.style.width = "";
      if (particles) (y > vh ? particles.pause() : particles.resume());
    }
    root.style.setProperty("--e", e.toFixed(4));
    root.style.setProperty("--bo", bo.toFixed(3));
    root.classList.toggle("bar-on", bo > 0.05);
    const room = root.scrollHeight - vh;
    progress.style.transform = `scaleX(${room > 0 ? clamp(y / room) : 0})`;
    setActive(computeActive());
  }
  let ticking = false, idleT = 0;
  addEventListener("scroll", () => {
    if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; update(); }); }
    clearTimeout(idleT); idleT = setTimeout(() => { navTarget = null; update(); }, 160);
  }, { passive: true });
  addEventListener("resize", () => { measure(); update(); });
  mobileMQ.addEventListener ? mobileMQ.addEventListener("change", () => { measure(); update(); }) : mobileMQ.addListener(() => { measure(); update(); });

  function scrollToId(id, instant) {
    navTarget = id === "cover" ? null : id;
    const y = targetY(id);
    if (instant || FX.reduce) jump(y); else window.scrollTo({ top: y, behavior: "smooth" });
    update();
  }

  // ------------------------------------------------------------ menu, tabs, dots, in-page links
  function renderNav() {
    $("#nav").replaceChildren(...NAV.map(id => h("a", { href: "#/" + id, "data-route": id }, h("span", { class: "nl" }, PAGES[id].label))));
    $("#tabs").replaceChildren(...NAV.map(id => h("a", { href: "#/" + id, "data-route": id }, h("span", { class: "ni", "aria-hidden": "true" }, PAGES[id].icon), h("span", { class: "nl" }, PAGES[id].label))));
    $("#pager").replaceChildren(...NAV.map(id => h("button", { type: "button", "data-route": id, title: PAGES[id].label, "aria-label": "Go to " + PAGES[id].label, onclick: () => { track("click", "pager-" + id); scrollToId(id); } })));
  }
  renderNav();
  document.addEventListener("click", ev => {
    const a = ev.target.closest('a[href^="#/"]');
    if (!a || ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
    const id = a.getAttribute("href").slice(2);
    ev.preventDefault();
    if (id === "privacy") return openPrivacy();
    if (a.hasAttribute("data-top")) { track("click", "nav-top"); return scrollToId("cover"); }
    if (NAV.includes(id)) { track("click", "nav-" + id); scrollToId(id); }
  });
  document.addEventListener("click", ev => { const a = ev.target.closest("a[data-track]"); if (a) track(a.dataset.track, a.dataset.target || "link"); });
  $("#cue").addEventListener("click", () => { track("click", "cue"); scrollToId("home"); });
  // footer privacy link is plain markup: href="#/privacy" is handled by the delegated click above

  // -------------------------------------------------------------- start position (deep links, reloads)
  try { history.scrollRestoration = "manual"; } catch (_) { /* ignore */ }
  measure();
  const startId = (location.hash.match(/^#\/([a-z]+)/) || [])[1];
  let startY = 0;
  if (startId === "privacy") openPrivacy();
  else if (NAV.includes(startId)) { startY = targetY(startId); }
  jump(startY); update();
  addEventListener("load", () => { // images may have shifted the layout a few px: re-aim once, unless the visitor already scrolled
    measure();
    if (NAV.includes(startId) && scrollY === startY) { startY = targetY(startId); jump(startY); }
    update();
  });
  addEventListener("hashchange", () => { // typed/edited URL or browser buttons
    const id = (location.hash.match(/^#\/([a-z]+)/) || [])[1];
    if (id === "privacy") openPrivacy(); else if (NAV.includes(id) && id !== lastActive) scrollToId(id);
  });

  const safe = (name, fn) => { try { fn(); } catch (e) { console.warn("optional feature failed: " + name, e); } };

  // ---------------------------------------- the edge handle: drag to scrub between the cover and the page (desktop)
  safe("grip", () => {
    const grip = $("#grip");
    let dragging = false;
    grip.addEventListener("pointerdown", e => { dragging = true; navTarget = null; grip.setPointerCapture(e.pointerId); document.body.classList.add("dragging"); e.preventDefault(); });
    grip.addEventListener("pointermove", e => {
      if (!dragging || isMobile()) return;
      const e01 = clamp((root.clientWidth - e.clientX) / (root.clientWidth - SIDE_PX));
      jump(invEase(e01) * D);
    });
    const end = () => { if (dragging) { dragging = false; document.body.classList.remove("dragging"); track("click", "grip-drag"); } };
    grip.addEventListener("pointerup", end); grip.addEventListener("pointercancel", end);
    grip.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); scrollToId(scrollY < D * 0.5 ? "home" : "cover"); }
      else if (e.key === "ArrowLeft") window.scrollBy({ top: D / 8 });
      else if (e.key === "ArrowRight") window.scrollBy({ top: -D / 8 });
    });
  });

  // ---------------------------------------------------------------- sidebar
  $("#tagline").textContent = S.tagline;
  safe("typed", () => FX.typed($("#typed"), S.phrases));
  safe("particles", () => { particles = FX.particles($("#bg"), side); update(); });
  const icon = d => svg("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" }, svg("path", { d }));
  $("#social").append(
    h("a", { href: S.github, target: "_blank", rel: "noopener noreferrer", "aria-label": "GitHub", title: "GitHub", "data-track": "click", "data-target": "gh-profile" },
      icon("M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.7 5.39-5.27 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z")),
    h("button", { type: "button", "aria-label": "Copy email address", title: "Copy email", onclick: copyEmail },
      icon("M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1.2 2 7.8 5.6L19.8 7H4.2ZM4 9.1V17h16V9.1l-8 5.7-8-5.7Z")),
    h("a", { href: S.linkedin, target: "_blank", rel: "noopener noreferrer", "aria-label": "LinkedIn", title: "LinkedIn", "data-track": "click", "data-target": "linkedin" },
      icon("M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4V21H3V9.5Zm6.5 0h3.8v1.6h.06c.53-1 1.83-2 3.77-2 4.03 0 4.77 2.65 4.77 6.1V21h-4v-5c0-1.2-.02-2.73-1.66-2.73-1.67 0-1.92 1.3-1.92 2.65V21h-4V9.5Z")));

  // dark mode: the buttons show the mode you would switch to (🌙 = go dark, ☀️ = go light)
  const themeBtns = [$("#theme"), $("#theme2")].filter(Boolean), mq = matchMedia("(prefers-color-scheme: dark)");
  const isDark = () => root.dataset.theme ? root.dataset.theme === "dark" : mq.matches;
  function syncTheme() {
    themeBtns.forEach(b => {
      b.textContent = isDark() ? "☀️" : "🌙";
      b.setAttribute("aria-label", isDark() ? "Switch to light mode" : "Switch to dark mode");
      b.title = isDark() ? "Light mode" : "Dark mode";
    });
  }
  themeBtns.forEach(b => b.addEventListener("click", () => {
    root.dataset.theme = isDark() ? "light" : "dark"; // deliberately not persisted: nothing is stored on the device
    syncTheme(); track("click", "theme");
  }));
  safe("theme", () => { (mq.addEventListener ? mq.addEventListener.bind(mq, "change") : mq.addListener.bind(mq))(syncTheme); });
  syncTheme();
})();
