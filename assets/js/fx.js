// Visual effects only (no tracking, no storage). Everything degrades to static when prefers-reduced-motion is set.
(function () {
  "use strict";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const FX = (window.FX = { reduce });

  // ---- typed line ---------------------------------------------------------
  FX.typed = function (el, phrases) {
    if (reduce) { el.textContent = phrases[0]; return; }
    let i = 0, n = 0, del = false;
    (function step() {
      const word = phrases[i];
      n += del ? -1 : 1;
      el.textContent = word.slice(0, n);
      let wait = del ? 35 : 80;
      if (!del && n === word.length) { del = true; wait = 1400; }
      else if (del && n === 0) { del = false; i = (i + 1) % phrases.length; wait = 300; }
      setTimeout(step, wait);
    })();
  };

  // ---- particle network in the sidebar -----------------------------------
  FX.particles = function (canvas, host) {
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, dpr = 1, pts = [], mouse = { x: -999, y: -999 }, running = true, frame = 0, color = "255,255,255";
    function size() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = host.clientWidth; h = host.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(70, Math.round((w * h) / 14000));
      while (pts.length < count) pts.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, r: 1 + Math.random() * 2 });
      pts.length = count;
    }
    new ResizeObserver(size).observe(host);
    host.addEventListener("pointermove", e => { const r = host.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    host.addEventListener("pointerleave", () => { mouse.x = mouse.y = -999; });
    document.addEventListener("visibilitychange", () => { running = document.visibilityState === "visible"; if (running) loop(); });
    function loop() {
      if (!running) return;
      if (++frame % 120 === 1) color = css("--particle") || color;
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        if (!reduce) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
          if (d < 130) { p.vx += (dx / d) * .06; p.vy += (dy / d) * .06; }
          p.vx *= .985; p.vy *= .985;
          p.x += p.vx + (Math.random() - .5) * .03; p.y += p.vy + (Math.random() - .5) * .03;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
        }
        ctx.fillStyle = `rgba(${color},.7)`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      }
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d < 110) { ctx.strokeStyle = `rgba(${color},${(1 - d / 110) * .35})`; ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke(); }
      }
      if (!reduce) requestAnimationFrame(loop);
    }
    size(); loop();
  };

  // ---- confetti ----------------------------------------------------------
  FX.confetti = function (x, y) {
    if (reduce) return;
    const c = document.getElementById("confetti"), ctx = c.getContext("2d");
    c.width = innerWidth; c.height = innerHeight;
    const colors = [css("--accent"), css("--accent2"), css("--sun"), css("--rose"), "#ffffff"];
    const bits = Array.from({ length: 110 }, () => {
      const a = Math.random() * 6.283, s = 4 + Math.random() * 9;
      return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 5, g: .25 + Math.random() * .15, w: 5 + Math.random() * 6, h: 3 + Math.random() * 4, r: Math.random() * 6, vr: (Math.random() - .5) * .4, col: colors[(Math.random() * colors.length) | 0], life: 1 };
    });
    (function frame() {
      ctx.clearRect(0, 0, c.width, c.height);
      let alive = false;
      for (const b of bits) {
        b.vy += b.g; b.vx *= .99; b.x += b.vx; b.y += b.vy; b.r += b.vr; b.life -= .008;
        if (b.life > 0 && b.y < c.height + 20) {
          alive = true; ctx.save(); ctx.globalAlpha = Math.max(b.life, 0); ctx.translate(b.x, b.y); ctx.rotate(b.r);
          ctx.fillStyle = b.col; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore();
        }
      }
      if (alive) requestAnimationFrame(frame); else ctx.clearRect(0, 0, c.width, c.height);
    })();
  };

  // ---- count-up ----------------------------------------------------------
  FX.count = function (el) {
    const to = parseFloat(el.dataset.to), dec = +el.dataset.dec || 0, pre = el.dataset.prefix || "", suf = el.dataset.suffix || "";
    const fmt = v => pre + (el.dataset.comma ? v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec)) + suf;
    if (reduce) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = 1100;
    (function step(now) {
      const k = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(to * e);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
    setTimeout(() => { el.textContent = fmt(to); }, dur + 150); // rAF pauses in background tabs; always land on the real value
    el.dataset.counted = "1";
  };

  // ---- toast -------------------------------------------------------------
  let toastTimer;
  FX.toast = function (msg) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  };

  // ---- tilt + spotlight on cards (delegated) ------------------------------
  let raf = 0;
  document.addEventListener("pointermove", e => {
    if (reduce || e.pointerType === "touch") return;
    const el = e.target.closest && e.target.closest(".tilt");
    if (!el) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty("--x", x * 100 + "%"); el.style.setProperty("--y", y * 100 + "%");
      el.style.setProperty("--rx", ((.5 - y) * 7).toFixed(2) + "deg"); el.style.setProperty("--ry", ((x - .5) * 9).toFixed(2) + "deg");
    });
  });
  document.addEventListener("pointerout", e => {
    const el = e.target.closest && e.target.closest(".tilt");
    if (el && !el.contains(e.relatedTarget)) { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); }
  });

  // ---- scroll progress ---------------------------------------------------
  const bar = document.getElementById("progress");
  addEventListener("scroll", () => {
    const el = document.documentElement, room = el.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${room > 0 ? scrollY / room : 0})`;
  }, { passive: true });
})();
