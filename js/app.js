/* Absorption coefficient of lead for gamma radiation: lesson app (no dependencies) */
(function () {
  'use strict';

  /* tutorial clock: virtual milliseconds that stop while paused and run faster at higher speed */
  const TC = { speed: 1, paused: false, base: 0, at: performance.now() };
  function tnow() { const n = performance.now(); if (!TC.paused) TC.base += (n - TC.at) * TC.speed; TC.at = n; return TC.base; }
  function tcSet(o) { tnow(); Object.assign(TC, o); }

  /* =====================================================================
     1. CONSTANTS + HELPERS
     ===================================================================== */
  const MU = 1.20;          // cm^-1, example value for 662 keV photons in lead (hidden in the practical)
  const BG_RATE = 24;       // counts/min, true mean background at the operating voltage
  const I0_RATE = 3388;     // counts/min from the source alone, no absorber, at the operating voltage
  const V_START = 380, V_PLATEAU = 450, V_TOP = 620, V_MAX = 800, V_OP = 500;
  /* Worked example (all one-minute counts) */
  const EX = {
    bg: [24, 27, 21], i0: [3410, 3381, 3445],
    rows: [
      { x: 0.2, r: [2712, 2655, 2685] }, { x: 0.4, r: [2098, 2151, 2117] }, { x: 0.6, r: [1702, 1648, 1681] },
      { x: 0.8, r: [1341, 1298, 1312] }, { x: 1.0, r: [1029, 1062, 1038] }
    ]
  };
  EX.IBG = EX.bg.reduce((a, b) => a + b, 0) / 3;
  EX.I0av = EX.i0.reduce((a, b) => a + b, 0) / 3;
  EX.I0 = EX.I0av - EX.IBG;
  EX.rows.forEach(r => { r.av = r.r.reduce((a, b) => a + b, 0) / 3; r.I = r.av - EX.IBG; r.q = EX.I0 / r.I; r.ln = Math.log(r.q); });

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, x, y, s, attrs) { const t = el('text', Object.assign({ x, y }, attrs || {}), parent); t.textContent = s; return t; }
  /* text with a subscript part, e.g. sub(g, x, y, 'I', '0', ' / I', attrs) */
  function tsub(parent, x, y, parts, attrs) {
    const t = el('text', Object.assign({ x, y }, attrs || {}), parent);
    parts.forEach(p => {
      if (typeof p === 'string') { const s = el('tspan', null, t); s.textContent = p; }
      else { const s = el('tspan', { 'baseline-shift': p.sup ? 'super' : 'sub', 'font-size': '72%' }, t); s.textContent = p.sub || p.sup; }
    });
    return t;
  }
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function svgPoint(svg, e) {
    const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  }
  function parseNum(s) { if (s == null) return NaN; s = String(s).trim().replace(',', '.').replace(/\s/g, '').replace('−', '-'); if (!s) return NaN; return Number(s); }
  const near = (a, b, tol) => isFinite(a) && isFinite(b) && b !== 0 && Math.abs(a - b) / Math.abs(b) <= tol;
  const fmt = (v, d) => (Math.abs(v) < 1e-12 ? 0 : v).toFixed(d);
  const fmtAvg = v => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(1));
  const F_HEAD = 'Epilogue, system-ui, sans-serif', F_MONO = 'Overpass Mono, ui-monospace, monospace', F_BODY = 'Albert Sans, system-ui, sans-serif', F_HAND = 'Schoolbell, cursive';
  const C = { ink: '#22262b', ink2: '#3b4148', muted: '#6b7179', lead: '#636b75', lead2: '#434a53', lead3: '#9aa1a9', amber: '#c98a10', amber2: '#8f5f08', amber3: '#e5b14e', paper: '#fdfcf8', line: '#e4e0d6', line2: '#cec8bb', good: '#2b7a70', bad: '#b4462f' };

  /* seeded random numbers (the tutorial uses a fixed seed so every playback speed gives the same counts) */
  function mulberry32(a) {
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function poisson(lam, rnd) {
    if (lam <= 0) return 0;
    if (lam < 40) { const L = Math.exp(-lam); let k = 0, p = 1; do { k++; p *= rnd(); } while (p > L); return k - 1; }
    let u = 0, v = 0; while (u === 0) u = rnd(); v = rnd();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return Math.max(0, Math.round(lam + Math.sqrt(lam) * z));
  }
  /* GM tube response: no counts below the starting voltage, a gentle plateau, then continuous discharge */
  function efficiency(V) {
    if (V < V_START) return 0;
    if (V < V_PLATEAU) { const k = (V - V_START) / (V_PLATEAU - V_START); return 0.98 * Math.pow(k, 1.6); }
    return 1 + 0.0004 * (V - V_OP);
  }
  function discharge(V) { return V <= V_TOP ? 0 : 6000 * Math.pow((V - V_TOP) / 20, 2); }
  function trueRate(V, srcIn, x) { return efficiency(V) * (BG_RATE + (srcIn ? I0_RATE * Math.exp(-MU * x) : 0)) + discharge(V); }

  /* shared gradients */
  function defsFor(svg, id) {
    const d = svg.querySelector('defs') || el('defs', null, svg);
    function lin(name, stops, x2, y2) {
      const g = el('linearGradient', { id: `${id}-${name}`, x1: 0, y1: 0, x2: x2 || 0, y2: y2 == null ? 1 : y2 }, d);
      stops.forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, g));
    }
    lin('lead', [[0, '#8b929a'], [.35, '#b9bec4'], [.7, '#80878f'], [1, '#5d646c']], 1, 0);
    lin('leadv', [[0, '#a3a9b0'], [.5, '#7a818a'], [1, '#585f67']]);
    lin('pot', [[0, '#5c636b'], [.3, '#8d949c'], [.55, '#6e757d'], [1, '#474d55']], 1, 0);
    lin('steel', [[0, '#f2f3f4'], [.5, '#c7cbd0'], [1, '#9097a0']]);
    lin('tube', [[0, '#eef0f2'], [.35, '#ffffff'], [.6, '#d4d8dc'], [1, '#9aa1a9']]);
    lin('case', [[0, '#f4f2ec'], [1, '#dcd7cc']]);
    lin('panel', [[0, '#3a4048'], [1, '#2a2f35']]);
    lin('lcd', [[0, '#e9ecd9'], [1, '#d5dac0']]);
    lin('bench', [[0, '#e8e4db'], [1, '#d9d3c7']]);
    lin('wood', [[0, '#cfc6b5'], [1, '#b4a993']]);
    lin('knob', [[0, '#5d646c'], [1, '#2c3137']]);
    const sh = el('filter', { id: `${id}-sh`, x: '-20%', y: '-20%', width: '140%', height: '160%' }, d);
    el('feDropShadow', { dx: 0, dy: 3, stdDeviation: 3, 'flood-color': '#2a2620', 'flood-opacity': .2 }, sh);
    const gl = el('filter', { id: `${id}-glow`, x: '-100%', y: '-100%', width: '300%', height: '300%' }, d);
    el('feGaussianBlur', { stdDeviation: 3 }, gl);
    return d;
  }

  /* =====================================================================
     2. BACKGROUND: photon tracks fading exponentially through layered slabs
     ===================================================================== */
  (function background() {
    const cv = $('bg'), ctx = cv.getContext('2d');
    let W = 0, H = 0, dpr = 1, slabs = [], photons = [], marks = [];
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const u = Math.max(40, W / 22);
      slabs = [
        { x: W * .30, w: u * .7, mu: .010 }, { x: W * .30 + u * 1.15, w: u * .9, mu: .010 },
        { x: W * .62, w: u * 1.1, mu: .012 }, { x: W * .62 + u * 1.5, w: u * .6, mu: .012 }
      ];
    }
    function spawn() {
      const y = Math.random() * H;
      photons.push({ x: -10, y, vx: 1, vy: (Math.random() - .5) * .08, sp: 70 + Math.random() * 40, trail: [], a: 1, alive: true, life: 0 });
    }
    function inSlab(x) { for (const s of slabs) if (x >= s.x && x <= s.x + s.w) return s; return null; }
    let last = performance.now(), acc = 0;
    function step(now) {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      acc += dt;
      if (acc > .22) { acc = 0; if (photons.length < 34) spawn(); }
      ctx.clearRect(0, 0, W, H);
      // slabs: faint lead sheets with a soft edge
      slabs.forEach(s => {
        const g = ctx.createLinearGradient(s.x, 0, s.x + s.w, 0);
        g.addColorStop(0, 'rgba(99,107,117,.07)'); g.addColorStop(.5, 'rgba(99,107,117,.045)'); g.addColorStop(1, 'rgba(99,107,117,.08)');
        ctx.fillStyle = g; ctx.fillRect(s.x, 0, s.w, H);
        ctx.strokeStyle = 'rgba(67,74,83,.08)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(s.x + .5, 0); ctx.lineTo(s.x + .5, H); ctx.moveTo(s.x + s.w - .5, 0); ctx.lineTo(s.x + s.w - .5, H); ctx.stroke();
      });
      // the exponential envelope of the beam
      ctx.beginPath();
      let I = 1;
      for (let x = 0; x <= W; x += 6) {
        const s = inSlab(x); if (s) I *= Math.exp(-s.mu * 6 * 1.6);
        const y = H * .9 - (H * .16) * I;
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = 'rgba(201,138,16,.12)'; ctx.lineWidth = 1.4; ctx.setLineDash([5, 6]); ctx.stroke(); ctx.setLineDash([]);
      // photons
      photons.forEach(p => {
        p.life += dt;
        if (p.alive) {
          const dx = p.vx * p.sp * dt, dy = p.vy * p.sp * dt;
          p.x += dx; p.y += dy;
          const s = inSlab(p.x);
          if (s) {
            p.a *= Math.exp(-s.mu * Math.abs(dx) * .35);
            if (Math.random() < s.mu * Math.abs(dx)) {
              if (Math.random() < .62) { p.alive = false; marks.push({ x: p.x, y: p.y, t: 0 }); }
              else { const ang = (Math.random() - .5) * 2.2; const c = Math.cos(ang), sn = Math.sin(ang); const vx = p.vx * c - p.vy * sn, vy = p.vx * sn + p.vy * c; p.vx = vx; p.vy = vy; p.sp *= .8; p.a *= .8; }
            }
          }
          p.trail.push([p.x, p.y]); if (p.trail.length > 46) p.trail.shift();
          if (p.x > W + 20 || p.y < -20 || p.y > H + 20 || p.x < -30) p.alive = false;
        } else if (p.trail.length) p.trail.shift();
        if (p.trail.length > 1) {
          for (let i = 1; i < p.trail.length; i++) {
            const k = i / p.trail.length;
            ctx.strokeStyle = `rgba(67,74,83,${(.16 * k * p.a).toFixed(3)})`; ctx.lineWidth = 1.1;
            ctx.beginPath(); ctx.moveTo(p.trail[i - 1][0], p.trail[i - 1][1]); ctx.lineTo(p.trail[i][0], p.trail[i][1]); ctx.stroke();
          }
          if (p.alive) { const h = p.trail[p.trail.length - 1]; ctx.fillStyle = `rgba(201,138,16,${(.35 * p.a).toFixed(3)})`; ctx.beginPath(); ctx.arc(h[0], h[1], 1.8, 0, 6.283); ctx.fill(); }
        }
      });
      photons = photons.filter(p => p.alive || p.trail.length > 0);
      marks.forEach(m => {
        m.t += dt; const k = m.t / 1.6;
        ctx.strokeStyle = `rgba(201,138,16,${(.22 * (1 - k)).toFixed(3)})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(m.x, m.y, 2 + 9 * k, 0, 6.283); ctx.stroke();
      });
      marks = marks.filter(m => m.t < 1.6);
    }
    function frame(now) { step(now); if (!reduced) requestAnimationFrame(frame); }
    window.addEventListener('resize', size);
    size();
    if (reduced) { for (let i = 0; i < 400; i++) step(last + 50 * i); } else requestAnimationFrame(frame);
  })();

  /* =====================================================================
     3. NAVIGATION + PROGRESS RAIL
     ===================================================================== */
  const views = Array.from(document.querySelectorAll('.view'));
  const ids = views.map(v => v.id.replace('view-', ''));
  const nav = $('rail-nav'), railFill = $('rail-fill'), railMark = $('rail-mark'), btnPrev = $('btn-prev');
  const items = views.map((v, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'rail-item';
    b.innerHTML = `<span>${v.dataset.title}</span>`;
    b.addEventListener('click', () => goTo(i, true));
    nav.appendChild(b);
    return b;
  });
  let current = -1;
  const onEnter = {}, onLeave = {};
  function fillRail() {
    const it = items[current]; if (!it) return;
    const mobile = window.matchMedia('(max-width:980px)').matches;
    const gauge = railFill.parentElement;
    if (mobile) {
      gauge.style.setProperty('--fillw', ((current + .5) / items.length * 100) + '%');
      railFill.style.height = ''; railMark.style.top = '';
    } else {
      const tb = gauge.getBoundingClientRect(), ib = it.getBoundingClientRect();
      const y = clamp(ib.top + ib.height / 2 - tb.top, 0, 2000);
      railFill.style.height = y + 'px'; railMark.style.top = y + 'px';
    }
  }
  function goTo(i, push) {
    i = clamp(i, 0, views.length - 1);
    if (i === current) return;
    if (current >= 0 && onLeave[ids[current]]) onLeave[ids[current]]();
    current = i;
    views.forEach((v, k) => v.classList.toggle('active', k === i));
    items.forEach((b, k) => {
      b.classList.toggle('current', k === i); b.classList.toggle('done', k < i);
      if (k === i) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    btnPrev.hidden = i === 0;
    document.querySelector('.stage-top').style.maxWidth = views[i].querySelector('.sheet.wide') ? '1260px' : '';
    requestAnimationFrame(() => {
      fillRail();
      if (window.matchMedia('(max-width:980px)').matches) items[i].scrollIntoView({ block: 'nearest', inline: 'center' });
    });
    if (push && location.hash !== '#' + ids[i]) history.pushState(null, '', '#' + ids[i]);
    window.scrollTo({ top: 0 });
    document.title = views[i].dataset.title + ' · Gamma absorption';
    if (onEnter[ids[i]]) onEnter[ids[i]]();
  }
  window.addEventListener('resize', () => requestAnimationFrame(fillRail));
  btnPrev.addEventListener('click', () => goTo(current - 1, true));
  document.querySelectorAll('[data-next]').forEach(b => b.addEventListener('click', () => goTo(current + 1, true)));
  function fromHash() { const k = ids.indexOf(location.hash.replace('#', '')); return k < 0 ? 0 : k; }
  window.addEventListener('popstate', () => goTo(fromHash(), false));
  window.addEventListener('hashchange', () => goTo(fromHash(), false));

  /* =====================================================================
     4. CUSTOM CURSOR: a tiny GM probe whose window marks the hotspot
     ===================================================================== */
  const cur = $('cursor');
  let cursorOn = false;
  if (window.matchMedia('(pointer:fine)').matches) {
    window.addEventListener('mousemove', e => {
      if (!cursorOn) { document.body.classList.add('has-cursor'); cursorOn = true; }
      cur.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
      cur.classList.remove('hidden');
      const t = e.target && e.target.closest ? e.target : null;
      const grab = t && t.closest('.drag, .gh');
      const hot = t && t.closest('button:not(:disabled), a, select, label, input[type=range], .live');
      cur.classList.toggle('grab', !!grab);
      cur.classList.toggle('hot', !!hot && !grab);
    }, { passive: true });
    document.addEventListener('mouseleave', () => cur.classList.add('hidden'));
    window.addEventListener('blur', () => cur.classList.add('hidden'));
  }
  let lastCursorTick = 0;
  function cursorTick() {
    if (!cursorOn) return;
    const n = performance.now(); if (n - lastCursorTick < 90) return; lastCursorTick = n;
    cur.classList.remove('tick'); void cur.offsetWidth; cur.classList.add('tick');
  }

  /* =====================================================================
     5. SHARED DRAWINGS: source, tongs, lead pot, GM tube, stand, plates, scaler
     ===================================================================== */
  function trefoil(g, cx, cy, r, fill, bg) {
    const t = el('g', { transform: `translate(${cx} ${cy})` }, g);
    if (bg) el('circle', { r: r * 1.15, fill: bg }, t);
    for (let k = 0; k < 3; k++) {
      const a0 = (-90 + k * 120 - 30) * Math.PI / 180, a1 = (-90 + k * 120 + 30) * Math.PI / 180, ri = r * .3;
      el('path', { d: `M${ri * Math.cos(a0)} ${ri * Math.sin(a0)} L${r * Math.cos(a0)} ${r * Math.sin(a0)} A${r} ${r} 0 0 1 ${r * Math.cos(a1)} ${r * Math.sin(a1)} L${ri * Math.cos(a1)} ${ri * Math.sin(a1)} A${ri} ${ri} 0 0 0 ${ri * Math.cos(a0)} ${ri * Math.sin(a0)} Z`, fill }, t);
    }
    el('circle', { r: r * .18, fill }, t);
    return t;
  }
  function drawSource(g, id) {
    el('line', { x1: 0, y1: -14, x2: 0, y2: -50, stroke: '#7d848c', 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
    el('circle', { cx: 0, cy: -54, r: 5.5, fill: `url(#${id}-steel)`, stroke: '#6b727a', 'stroke-width': 1.2 }, g);
    el('rect', { x: -8, y: -15, width: 16, height: 30, rx: 3.5, fill: `url(#${id}-steel)`, stroke: '#6b727a', 'stroke-width': 1.2 }, g);
    el('rect', { x: 5, y: -10, width: 4, height: 20, rx: 1.5, fill: C.amber, stroke: C.amber2, 'stroke-width': .8 }, g);
    trefoil(g, -1, 0, 4.6, '#3b4148');
  }
  function drawTongs(g) {
    const s = { fill: 'none', stroke: '#7a8189', 'stroke-width': 4.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    const hl = { fill: 'none', stroke: '#e6e8ea', 'stroke-width': 1.3, 'stroke-linecap': 'round' };
    el('path', Object.assign({ d: 'M2 -4 C-14 -10 -40 -8 -62 -3 L-150 -13' }, s), g);
    el('path', Object.assign({ d: 'M2 4 C-14 10 -40 8 -62 3 L-150 13' }, s), g);
    el('path', Object.assign({ d: 'M-70 -4 L-148 -13' }, hl), g);
    el('path', { d: 'M2 -4 l5 3 M2 4 l5 -3', fill: 'none', stroke: '#5f666e', 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
    el('rect', { x: -160, y: -18, width: 26, height: 10, rx: 4, fill: C.amber, stroke: C.amber2, 'stroke-width': 1 }, g);
    el('rect', { x: -160, y: 8, width: 26, height: 10, rx: 4, fill: C.amber, stroke: C.amber2, 'stroke-width': 1 }, g);
    el('circle', { cx: -62, cy: 0, r: 4, fill: '#5f666e' }, g);
  }
  /* lead source container: back (the dark well) and front (thick walls) as separate groups */
  function drawPot(back, front, cx, baseY, id) {
    const w = 104, h = 96, top = baseY - h;
    el('ellipse', { cx, cy: baseY, rx: w / 2 + 6, ry: 7, fill: 'rgba(40,36,28,.14)' }, back);
    el('rect', { x: cx - w / 2, y: top, width: w, height: h, rx: 10, fill: `url(#${id}-pot)`, stroke: '#3f454c', 'stroke-width': 1.4 }, back);
    el('ellipse', { cx, cy: top + 2, rx: w / 2 - 1, ry: 9, fill: '#7b828a', stroke: '#3f454c', 'stroke-width': 1.2 }, back);
    el('ellipse', { cx, cy: top + 3, rx: 18, ry: 5, fill: '#23272c' }, back);
    el('path', { d: `M${cx - w / 2} ${top + 2} L${cx - w / 2} ${baseY - 10} Q${cx - w / 2} ${baseY} ${cx - w / 2 + 10} ${baseY} L${cx + w / 2 - 10} ${baseY} Q${cx + w / 2} ${baseY} ${cx + w / 2} ${baseY - 10} L${cx + w / 2} ${top + 2} A${w / 2} 9 0 0 1 ${cx - w / 2} ${top + 2} Z`, fill: `url(#${id}-pot)`, stroke: '#3f454c', 'stroke-width': 1.4 }, front);
    el('path', { d: `M${cx - 18} ${top + 3} A18 5 0 0 0 ${cx + 18} ${top + 3}`, fill: 'none', stroke: '#5d646c', 'stroke-width': 1.2 }, front);
    el('rect', { x: cx - 30, y: top + 30, width: 60, height: 40, rx: 6, fill: '#f3d48a', stroke: C.amber2, 'stroke-width': 1 }, front);
    trefoil(front, cx, top + 46, 10, '#2c3137');
    txt(front, cx, top + 66, 'Cs-137', { 'text-anchor': 'middle', 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 8.5, fill: '#2c3137' });
    return { top, w, h };
  }
  function drawTube(g, wx, cy, len, id) {
    const r = 16;
    el('rect', { x: wx + len, y: cy - 6, width: 18, height: 12, rx: 2, fill: '#55606a', stroke: '#3a4149' }, g);
    el('rect', { x: wx, y: cy - r, width: len, height: 2 * r, rx: 5, fill: `url(#${id}-tube)`, stroke: '#7d858d', 'stroke-width': 1.3, filter: `url(#${id}-sh)` }, g);
    el('rect', { x: wx + len - 46, y: cy - r, width: 46, height: 2 * r, rx: 5, fill: '#4b525a' }, g);
    el('rect', { x: wx + len - 50, y: cy - r, width: 5, height: 2 * r, fill: C.amber }, g);
    el('rect', { x: wx - 4, y: cy - r + 1, width: 10, height: 2 * r - 2, rx: 3, fill: '#5f666e', stroke: '#3a4149' }, g);
    for (let k = -2; k <= 2; k++) el('line', { x1: wx - 3, y1: cy + k * 5.5, x2: wx + 5, y2: cy + k * 5.5, stroke: '#2b2f35', 'stroke-width': 1.2 }, g);
    const win = el('ellipse', { cx: wx - 2, cy, rx: 6, ry: r - 2, fill: C.amber3, opacity: 0, filter: `url(#${id}-glow)` }, g);
    if (len >= 150) txt(g, wx + 20, cy + 5, 'GM tube', { 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 13, fill: '#4b525a', 'letter-spacing': '.04em' });
    return { win };
  }
  function drawStand(g, x, yTop, yBase, id) {
    el('rect', { x: x - 26, y: yBase - 12, width: 52, height: 12, rx: 3, fill: '#5b626a', stroke: '#3f454c' }, g);
    el('rect', { x: x - 4, y: yTop, width: 8, height: yBase - 12 - yTop, fill: `url(#${id}-lead)`, stroke: '#5b626a', 'stroke-width': .8 }, g);
  }
  function drawPlate(g, w, h, id) {
    el('rect', { x: 0, y: 0, width: w, height: h, rx: 1.5, fill: `url(#${id}-lead)`, stroke: '#4b525a', 'stroke-width': 1 }, g);
    el('line', { x1: Math.min(2, w / 3), y1: 3, x2: Math.min(2, w / 3), y2: h - 3, stroke: 'rgba(255,255,255,.45)', 'stroke-width': 1 }, g);
  }
  function drawTrack(g, x1, x2, y, id) {
    el('rect', { x: x1, y, width: x2 - x1, height: 14, rx: 3, fill: '#6a7179', stroke: '#454c54' }, g);
    el('rect', { x: x1 + 4, y: y + 2, width: x2 - x1 - 8, height: 3, fill: 'rgba(255,255,255,.25)' }, g);
    for (let x = x1 + 10; x <= x2 - 10; x += 19) el('line', { x1: x, y1: y + 8, x2: x, y2: y + 13, stroke: 'rgba(255,255,255,.4)', 'stroke-width': 1 }, g);
  }
  function lcdText(g, x, y, s, size, anchor) {
    return txt(g, x, y, s, { 'font-family': F_MONO, 'font-weight': 600, 'font-size': size, fill: '#2a3020', 'text-anchor': anchor || 'end' });
  }
  /* scaler unit with displays, a count lamp, an HV knob and three buttons */
  function drawScaler(g, x, y, id, o) {
    o = o || {};
    const w = 430, h = 236, R = {};
    el('rect', { x, y: y + h - 4, width: w, height: 10, rx: 4, fill: 'rgba(40,36,28,.15)' }, g);
    el('rect', { x, y, width: w, height: h, rx: 14, fill: `url(#${id}-case)`, stroke: '#a59f92', 'stroke-width': 1.4, filter: `url(#${id}-sh)` }, g);
    el('rect', { x: x + 12, y: y + 12, width: w - 24, height: h - 24, rx: 9, fill: `url(#${id}-panel)` }, g);
    txt(g, x + 26, y + 34, 'GM SCALER', { 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 12, fill: '#d9d4c8', 'letter-spacing': '.18em' });
    // counts display
    el('rect', { x: x + 24, y: y + 44, width: 240, height: 64, rx: 6, fill: `url(#${id}-lcd)`, stroke: '#14181c', 'stroke-width': 2 }, g);
    txt(g, x + 32, y + 58, 'COUNTS', { 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 9, fill: '#5b6150', 'letter-spacing': '.12em' });
    R.count = lcdText(g, x + 256, y + 98, '000000', 38);
    // time and HV displays
    el('rect', { x: x + 24, y: y + 118, width: 116, height: 40, rx: 5, fill: `url(#${id}-lcd)`, stroke: '#14181c', 'stroke-width': 2 }, g);
    txt(g, x + 30, y + 130, 'TIME s', { 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 8, fill: '#5b6150', 'letter-spacing': '.1em' });
    R.time = lcdText(g, x + 134, y + 151, '0 / 60', 17);
    el('rect', { x: x + 148, y: y + 118, width: 116, height: 40, rx: 5, fill: `url(#${id}-lcd)`, stroke: '#14181c', 'stroke-width': 2 }, g);
    txt(g, x + 154, y + 130, 'HV', { 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 8, fill: '#5b6150', 'letter-spacing': '.1em' });
    R.hvBox = g.lastChild.previousSibling;
    R.hv = lcdText(g, x + 258, y + 151, '0 V', 17);
    R.mode = txt(g, x + 24, y + 176, 'preset 60 s', { 'font-family': F_BODY, 'font-size': 11.5, fill: '#bdb7aa' });
    // count lamp
    el('circle', { cx: x + 290, cy: y + 58, r: 8, fill: '#5d4310', stroke: '#14181c', 'stroke-width': 1.5 }, g);
    R.led = el('circle', { cx: x + 290, cy: y + 58, r: 7, fill: '#ffcc55', opacity: 0 }, g);
    txt(g, x + 304, y + 62, 'count', { 'font-family': F_BODY, 'font-size': 10.5, fill: '#bdb7aa' });
    // HV knob
    const kx = x + 352, ky = y + 106, kr = 30;
    R.kx = kx; R.ky = ky; R.kr = kr;
    for (let v = 0; v <= V_MAX; v += 50) {
      const a = (-225 + v / V_MAX * 270) * Math.PI / 180, long = v % 200 === 0;
      el('line', { x1: kx + Math.cos(a) * (kr + 6), y1: ky + Math.sin(a) * (kr + 6), x2: kx + Math.cos(a) * (kr + (long ? 13 : 10)), y2: ky + Math.sin(a) * (kr + (long ? 13 : 10)), stroke: v > V_TOP ? '#e07a5f' : (v >= V_PLATEAU && v <= 600 ? C.amber3 : '#9b958a'), 'stroke-width': long ? 2 : 1.2 }, g);
      if (long) txt(g, kx + Math.cos(a) * (kr + 25), ky + Math.sin(a) * (kr + 25) + 4, String(v), { 'text-anchor': 'middle', 'font-family': F_MONO, 'font-size': 9.5, fill: '#bdb7aa' });
    }
    R.knob = el('g', { class: 'knob-t live', tabindex: o.live ? 0 : null }, g);
    el('circle', { cx: kx, cy: ky, r: kr + 4, fill: 'transparent' }, R.knob);
    el('circle', { cx: kx, cy: ky, r: kr, fill: `url(#${id}-knob)`, stroke: '#14181c', 'stroke-width': 1.5 }, R.knob);
    for (let k = 0; k < 18; k++) { const a = k / 18 * 6.283; el('line', { x1: kx + Math.cos(a) * (kr - 1), y1: ky + Math.sin(a) * (kr - 1), x2: kx + Math.cos(a) * (kr - 5), y2: ky + Math.sin(a) * (kr - 5), stroke: 'rgba(255,255,255,.18)', 'stroke-width': 1.2 }, R.knob); }
    R.ptr = el('line', { x1: kx, y1: ky, x2: kx, y2: ky - kr + 7, stroke: C.amber3, 'stroke-width': 3.2, 'stroke-linecap': 'round' }, R.knob);
    el('circle', { cx: kx, cy: ky, r: 7, fill: '#4b525a' }, R.knob);
    el('circle', { class: 'focus-ring', cx: kx, cy: ky, r: kr + 8, fill: 'none', stroke: C.amber3, 'stroke-width': 2.5 }, R.knob);
    txt(g, kx, ky + kr + 30, 'HIGH VOLTAGE', { 'text-anchor': 'middle', 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 8.5, fill: '#bdb7aa', 'letter-spacing': '.12em' });
    // buttons
    function sbtn(bx, label, col) {
      const b = el('g', { class: 'sbtn live', role: o.live ? 'button' : null, tabindex: o.live ? 0 : null, 'aria-label': o.live ? label : null }, g);
      const face = el('g', { class: 'sbtn-face' }, b);
      el('rect', { x: bx, y: y + 186, width: 78, height: 30, rx: 7, fill: col, stroke: '#14181c', 'stroke-width': 1.5 }, face);
      txt(face, bx + 39, y + 206, label, { 'text-anchor': 'middle', 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 12.5, fill: '#fff', 'letter-spacing': '.06em' });
      el('rect', { class: 'focus-ring', x: bx - 4, y: y + 182, width: 86, height: 38, rx: 9, fill: 'none', stroke: C.amber3, 'stroke-width': 2.5 }, b);
      return b;
    }
    R.start = sbtn(x + 24, 'START', '#2b7a70');
    R.stop = sbtn(x + 110, 'STOP', '#a5442f');
    R.reset = sbtn(x + 196, 'RESET', '#5b626a');
    // GM input socket
    el('circle', { cx: x + 404, cy: y + 30, r: 7, fill: '#9aa1a9', stroke: '#14181c', 'stroke-width': 1.4 }, g);
    el('circle', { cx: x + 404, cy: y + 30, r: 2.5, fill: '#2a2f35' }, g);
    txt(g, x + 392, y + 34, 'GM', { 'text-anchor': 'end', 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 9, fill: '#bdb7aa' }, g);
    R.setV = function (v) {
      const a = -135 + v / V_MAX * 270;
      R.ptr.setAttribute('transform', `rotate(${a} ${kx} ${ky})`);
      R.hv.textContent = Math.round(v) + ' V';
    };
    R.setV(o.v || 0);
    if (o.count != null) R.count.textContent = String(o.count).padStart(6, '0');
    if (o.time) R.time.textContent = o.time;
    return R;
  }
  function wave(g, x1, y1, x2, y2, lam, amp, attrs) {
    const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L, n = Math.max(8, Math.round(L / 2));
    let d = '';
    for (let i = 0; i <= n; i++) {
      const s = i / n * L, off = Math.sin(s / lam * 2 * Math.PI) * amp * Math.min(1, s / 10, (L - s) / 10);
      const px = x1 + ux * s - uy * off, py = y1 + uy * s + ux * off;
      d += (i ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1);
    }
    return el('path', Object.assign({ d, fill: 'none', stroke: C.amber, 'stroke-width': 2, 'stroke-linecap': 'round' }, attrs || {}), g);
  }
  function arrowHead(g, x, y, ang, col, s) {
    s = s || 8;
    const a1 = ang + 2.6, a2 = ang - 2.6;
    return el('path', { d: `M${x} ${y} L${x + Math.cos(a1) * s} ${y + Math.sin(a1) * s} L${x + Math.cos(a2) * s} ${y + Math.sin(a2) * s} Z`, fill: col }, g);
  }
  function arrowDefs(svg, id, col) {
    const d = svg.querySelector('defs') || el('defs', null, svg);
    const m = el('marker', { id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, d);
    el('path', { d: 'M0 0 L10 5 L0 10 Z', fill: col }, m);
  }

  /* =====================================================================
     6. GRAPH: ln(I0/I) on y against x on x (upright labels, positive ticks)
     ===================================================================== */
  function makePlot(svg, o) {
    const W = o.W || 720, H = o.H || 440, L = o.L || 86, R = o.R || 30, T = o.T || 56, B = o.B || 64;
    const P = { L, T, w: W - L - R, h: H - T - B, xmax: o.xmax || 1.2, ymax: o.ymax || 1.6 };
    P.X = v => L + v / P.xmax * P.w;
    P.Y = v => T + P.h - v / P.ymax * P.h;
    P.ix = px => (px - L) / P.w * P.xmax;
    P.iy = py => (T + P.h - py) / P.h * P.ymax;
    const g = el('g', null, svg);
    P.root = g;
    const grid = el('g', null, g);
    const xs = o.xstep || 0.1, ys = o.ystep || 0.1;
    for (let v = 0; v <= P.xmax + 1e-9; v += xs / 2) { const major = Math.abs(v / xs - Math.round(v / xs)) < 1e-6; el('line', { x1: P.X(v), y1: T, x2: P.X(v), y2: T + P.h, stroke: major ? '#ebe7de' : '#f4f2ec', 'stroke-width': 1 }, grid); }
    for (let v = 0; v <= P.ymax + 1e-9; v += ys / 2) { const major = Math.abs(v / ys - Math.round(v / ys)) < 1e-6; el('line', { x1: L, y1: P.Y(v), x2: L + P.w, y2: P.Y(v), stroke: major ? '#ebe7de' : '#f4f2ec', 'stroke-width': 1 }, grid); }
    el('line', { x1: L, y1: T + P.h, x2: L + P.w + 10, y2: T + P.h, stroke: C.ink2, 'stroke-width': 1.6 }, g);
    el('line', { x1: L, y1: T + P.h, x2: L, y2: T - 12, stroke: C.ink2, 'stroke-width': 1.6 }, g);
    const xl = o.xlab || 0.2, yl = o.ylab || 0.2;
    for (let v = 0; v <= P.xmax + 1e-9; v += xl) { el('line', { x1: P.X(v), y1: T + P.h, x2: P.X(v), y2: T + P.h + 6, stroke: C.ink2 }, g); txt(g, P.X(v), T + P.h + 24, fmt(v, 1), { 'text-anchor': 'middle', 'font-family': F_MONO, 'font-size': 14, fill: C.ink2 }); }
    for (let v = 0; v <= P.ymax + 1e-9; v += yl) { el('line', { x1: L - 6, y1: P.Y(v), x2: L, y2: P.Y(v), stroke: C.ink2 }, g); txt(g, L - 10, P.Y(v) + 5, fmt(v, 1), { 'text-anchor': 'end', 'font-family': F_MONO, 'font-size': 14, fill: C.ink2 }); }
    tsub(g, L - 8, T - 24, o.ylabel || ['ln(I', { sub: '0' }, ' / I)'], { 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 16, fill: C.ink });
    txt(g, L + P.w, T + P.h + 50, 'x (cm)', { 'text-anchor': 'end', 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 16, fill: C.ink });
    P.lineG = el('g', null, g); P.ptG = el('g', null, g); P.topG = el('g', null, g);
    P.points = function (pts, n) {
      P.ptG.innerHTML = '';
      pts.slice(0, n == null ? pts.length : n).forEach(p => {
        el('circle', { cx: P.X(p.x), cy: P.Y(p.y), r: 6, fill: '#fff', stroke: C.lead2, 'stroke-width': 2 }, P.ptG);
        el('path', { d: `M${P.X(p.x) - 3.5} ${P.Y(p.y)} h7 M${P.X(p.x)} ${P.Y(p.y) - 3.5} v7`, stroke: C.lead2, 'stroke-width': 1.5 }, P.ptG);
      });
    };
    /* best-fit line through two points with a slope triangle */
    P.line = function (A, Bp, tri) {
      P.lineG.innerHTML = '';
      if (!A || !Bp || Math.abs(Bp.x - A.x) < 1e-6) return;
      const m = (Bp.y - A.y) / (Bp.x - A.x), c = A.y - m * A.x;
      let x0 = 0, x1 = P.xmax;
      let y0 = m * x0 + c, y1 = m * x1 + c;
      // clip to the plotting box
      const clipY = (yy) => clamp(yy, 0, P.ymax);
      if (y0 < 0 || y0 > P.ymax) { x0 = (clipY(y0) - c) / m; y0 = clipY(y0); }
      if (y1 < 0 || y1 > P.ymax) { x1 = (clipY(y1) - c) / m; y1 = clipY(y1); }
      el('line', { x1: P.X(x0), y1: P.Y(y0), x2: P.X(x1), y2: P.Y(y1), stroke: C.amber, 'stroke-width': 2.4, 'stroke-linecap': 'round' }, P.lineG);
      if (tri) {
        const ax = P.X(A.x), ay = P.Y(A.y), bx = P.X(Bp.x), by = P.Y(Bp.y);
        el('path', { d: `M${ax} ${ay} L${bx} ${ay} L${bx} ${by}`, fill: 'none', stroke: C.lead, 'stroke-width': 1.6, 'stroke-dasharray': '6 4' }, P.lineG);
        tsub(P.lineG, (ax + bx) / 2, ay + 22, ['Δx = ' + fmt(Math.abs(Bp.x - A.x), 2) + ' cm'], { 'text-anchor': 'middle', 'font-family': F_MONO, 'font-size': 13.5, fill: C.lead2 });
        txt(P.lineG, bx + 10, (ay + by) / 2 + 5, 'Δy = ' + fmt(Math.abs(Bp.y - A.y), 2), { 'font-family': F_MONO, 'font-size': 13.5, fill: C.lead2 });
      }
    };
    return P;
  }

  /* =====================================================================
     7. AIM: hero (photons thinning through lead) and medical icons
     ===================================================================== */
  (function aim() {
    const svg = $('aim-hero'); defsFor(svg, 'ah');
    el('rect', { x: 0, y: 238, width: 800, height: 62, fill: 'url(#ah-bench)' }, svg);
    el('line', { x1: 0, y1: 238, x2: 800, y2: 238, stroke: '#cfc8ba' }, svg);
    const cy = 150;
    // source on a stand
    drawStand(svg, 70, cy + 14, 240, 'ah');
    const sg = el('g', { transform: `translate(70 ${cy})` }, svg); drawSource(sg, 'ah');
    // three slabs of increasing thickness
    const slabs = [{ x: 250, w: 14 }, { x: 400, w: 22 }, { x: 556, w: 30 }];
    slabs.forEach(s => {
      const g = el('g', { transform: `translate(${s.x} ${cy - 66})` }, svg); drawPlate(g, s.w, 132, 'ah');
      el('rect', { x: s.x - 8, y: cy + 66, width: s.w + 16, height: 8, rx: 2, fill: '#6a7179' }, svg);
      el('rect', { x: s.x + s.w / 2 - 3, y: cy + 74, width: 6, height: 240 - cy - 74, fill: '#8a9199' }, svg);
    });
    // tube
    drawStand(svg, 720, cy + 16, 240, 'ah');
    const T = drawTube(svg, 668, cy, 120, 'ah');
    // photons
    const dots = [], layer = el('g', null, svg);
    const lanes = 9;
    for (let i = 0; i < 26; i++) {
      const c = el('circle', { r: 3, fill: C.amber, opacity: 0 }, layer);
      dots.push({ c, x: 90 - Math.random() * 600, lane: (Math.random() * lanes | 0), stop: null, t: 0 });
    }
    function reset(d) {
      d.x = 84; d.lane = Math.random() * lanes | 0; d.t = 0; d.stop = null;
      // pick the slab where it is absorbed (or none), exponential odds per slab
      for (const s of slabs) if (Math.random() > Math.exp(-s.w * .03)) { d.stop = s.x + Math.random() * s.w; break; }
    }
    dots.forEach(reset); dots.forEach((d, i) => { d.x = 84 - i * 25; });
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (current === 0) {
        dots.forEach(d => {
          const y = cy - 48 + d.lane * 12;
          if (d.stop != null && d.x >= d.stop) { d.t += dt; d.c.setAttribute('opacity', Math.max(0, .9 - d.t * 2)); d.c.setAttribute('r', 3 + d.t * 8); if (d.t > .45) reset(d); return; }
          d.x += 170 * dt;
          if (d.x > 668) { T.win.setAttribute('opacity', .7); setTimeout(() => T.win.setAttribute('opacity', 0), 90); reset(d); return; }
          d.c.setAttribute('cx', d.x.toFixed(1)); d.c.setAttribute('cy', y); d.c.setAttribute('r', 3); d.c.setAttribute('opacity', d.x < 84 ? 0 : .85);
        });
      }
      if (!reduced) requestAnimationFrame(frame);
    }
    if (reduced) { dots.forEach(d => { d.x = 100 + Math.random() * 540; d.c.setAttribute('cx', d.x); d.c.setAttribute('cy', cy - 48 + d.lane * 12); d.c.setAttribute('opacity', .8); }); }
    else requestAnimationFrame(frame);
    txt(svg, 70, 266, 'source', { 'text-anchor': 'middle', 'font-family': F_BODY, 'font-size': 14, fill: C.muted });
    txt(svg, 418, 266, 'lead of increasing thickness x', { 'text-anchor': 'middle', 'font-family': F_BODY, 'font-size': 14, fill: C.muted });
    txt(svg, 728, 266, 'detector', { 'text-anchor': 'middle', 'font-family': F_BODY, 'font-size': 14, fill: C.muted });

    // medical icons
    const i1 = $('med-ic-1');
    el('circle', { cx: 40, cy: 38, r: 28, fill: '#f6f4ee', stroke: C.lead, 'stroke-width': 5 }, i1);
    el('circle', { cx: 40, cy: 38, r: 16, fill: '#fff', stroke: C.line2, 'stroke-width': 1.5 }, i1);
    el('rect', { x: 8, y: 34, width: 64, height: 8, rx: 4, fill: C.amber }, i1);
    el('rect', { x: 14, y: 70, width: 52, height: 5, rx: 2.5, fill: C.lead3 }, i1);
    const i2 = $('med-ic-2');
    [['#e8e3d8', 10], ['#c9c2b3', 26], ['#8f969e', 42], ['#c9c2b3', 58]].forEach(([c, x]) => el('rect', { x, y: 12, width: 14, height: 56, rx: 3, fill: c, stroke: '#a59f92', 'stroke-width': .8 }, i2));
    el('path', { d: 'M4 40 H76', stroke: C.amber, 'stroke-width': 2.4, 'stroke-dasharray': '5 3' }, i2);
    const i3 = $('med-ic-3');
    el('path', { d: 'M18 10 h44 v14 h-44z', fill: C.lead, stroke: C.lead2 }, i3);
    el('path', { d: 'M32 24 L40 52 L48 24 Z', fill: 'rgba(201,138,16,.35)' }, i3);
    el('ellipse', { cx: 40, cy: 60, rx: 26, ry: 9, fill: '#efece5', stroke: C.lead3, 'stroke-width': 1.5 }, i3);
    el('circle', { cx: 40, cy: 58, r: 5, fill: C.amber }, i3);
  })();

  /* =====================================================================
     8. THEORY: interactions, attenuation explorer, GM tube, plateau, counts
     ===================================================================== */
  (function theory() {
    // --- interaction diagrams
    function atom(g, cx, cy, shells) {
      shells.forEach(r => el('circle', { cx, cy, r, fill: 'none', stroke: '#d8d3c8', 'stroke-width': 1.3 }, g));
      el('circle', { cx, cy, r: 9, fill: C.lead, stroke: C.lead2 }, g);
      txt(g, cx, cy + 4, '+', { 'text-anchor': 'middle', 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 12, fill: '#fff' });
    }
    function electron(g, x, y, lab, col) {
      el('circle', { cx: x, cy: y, r: 5.5, fill: col || '#5b7fa6' }, g);
      txt(g, x, y + 3.5, lab || '−', { 'text-anchor': 'middle', 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 9, fill: '#fff' });
    }
    const pe = $('int-pe');
    atom(pe, 140, 78, [24, 44]);
    wave(pe, 12, 78, 112, 78, 12, 5);
    txt(pe, 14, 62, 'γ', { 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 16, fill: C.amber2 });
    electron(pe, 116, 78);
    el('path', { d: 'M150 54 L206 20', stroke: '#5b7fa6', 'stroke-width': 2, 'stroke-dasharray': '4 3' }, pe);
    arrowHead(pe, 210, 18, Math.atan2(-34, 56), '#5b7fa6');
    electron(pe, 196, 26);
    txt(pe, 120, 140, 'photon absorbed, electron ejected', { 'text-anchor': 'middle', 'font-family': F_BODY, 'font-size': 12, fill: C.muted });
    const co = $('int-co');
    atom(co, 120, 96, [20, 38]);
    wave(co, 12, 58, 114, 58, 12, 5);
    txt(co, 14, 42, 'γ', { 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 16, fill: C.amber2 });
    electron(co, 120, 58);
    wave(co, 128, 54, 222, 18, 18, 5, { stroke: '#d9a43a' });
    arrowHead(co, 225, 17, Math.atan2(-36, 94), '#d9a43a');
    txt(co, 196, 46, "γ′", { 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 14, fill: C.amber2 });
    el('path', { d: 'M126 62 L208 112', stroke: '#5b7fa6', 'stroke-width': 2, 'stroke-dasharray': '4 3' }, co);
    arrowHead(co, 212, 115, Math.atan2(50, 82), '#5b7fa6');
    txt(co, 120, 142, 'photon scattered with less energy', { 'text-anchor': 'middle', 'font-family': F_BODY, 'font-size': 12, fill: C.muted });
    const pp = $('int-pp');
    el('circle', { cx: 130, cy: 78, r: 14, fill: C.lead, stroke: C.lead2 }, pp);
    txt(pp, 130, 83, 'N', { 'text-anchor': 'middle', 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 12, fill: '#fff' });
    wave(pp, 12, 70, 112, 70, 12, 5);
    txt(pp, 14, 54, 'γ', { 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 16, fill: C.amber2 });
    el('path', { d: 'M114 70 Q170 50 214 22', fill: 'none', stroke: '#5b7fa6', 'stroke-width': 2 }, pp);
    el('path', { d: 'M114 70 Q170 96 214 118', fill: 'none', stroke: '#b4462f', 'stroke-width': 2 }, pp);
    electron(pp, 214, 22, '−'); electron(pp, 214, 118, '+', '#b4462f');
    txt(pp, 196, 14, 'e⁻', { 'font-family': F_BODY, 'font-size': 11, fill: C.muted });
    txt(pp, 168, 136, 'e⁺', { 'font-family': F_BODY, 'font-size': 11, fill: C.muted });
    txt(pp, 70, 140, 'needs E > 1.022 MeV', { 'text-anchor': 'middle', 'font-family': F_BODY, 'font-size': 12, fill: C.muted });

    // --- attenuation explorer
    const as = $('att-svg'); defsFor(as, 'at');
    const slider = $('att-x'), xv = $('att-xv'), out = $('att-out');
    const beam = el('g', null, as), slabG = el('g', null, as);
    const P = makePlot(as, { W: 640, H: 300, L: 352, R: 22, T: 50, B: 54, xmax: 2, ymax: 1, xstep: .25, ystep: .1, xlab: .5, ylab: .2, ylabel: ['I / I', { sub: '0' }] });
    let d = '';
    for (let i = 0; i <= 80; i++) { const x = i / 40; d += (i ? 'L' : 'M') + P.X(x) + ' ' + P.Y(Math.exp(-MU * x)); }
    el('path', { d, fill: 'none', stroke: C.amber, 'stroke-width': 2.4 }, P.lineG);
    const mk = el('circle', { r: 6, fill: C.amber, stroke: '#fff', 'stroke-width': 2 }, P.topG);
    const hvlx = Math.log(2) / MU;
    el('path', { d: `M${P.X(0)} ${P.Y(.5)} H${P.X(hvlx)} V${P.Y(0)}`, fill: 'none', stroke: C.lead3, 'stroke-dasharray': '4 4', 'stroke-width': 1.4 }, P.lineG);
    txt(P.lineG, P.X(hvlx) + 6, P.Y(.5) - 8, 'HVL', { 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 13, fill: C.lead2 });
    el('rect', { x: 0, y: 0, width: 290, height: 300, fill: '#fbfaf7' }, beam);
    const sg = el('g', { transform: 'translate(30 150)' }, beam); drawSource(sg, 'at');
    const tubeG = el('g', null, beam); drawTube(tubeG, 222, 150, 46, 'at');
    function upd() {
      const x = +slider.value, f = Math.exp(-MU * x);
      xv.textContent = x.toFixed(2) + ' cm';
      slabG.innerHTML = '';
      const w = Math.max(0, x * 40);
      if (w > 0) { const g = el('g', { transform: `translate(${140 - w / 2} 70)` }, slabG); drawPlate(g, w, 160, 'at'); }
      beam.querySelectorAll('.ray').forEach(r => r.remove());
      const n = 11, pass = Math.round(n * f);
      const order = [5, 4, 6, 3, 7, 2, 8, 1, 9, 0, 10];
      const passSet = new Set(order.slice(0, pass));
      for (let i = 0; i < n; i++) {
        const y = 100 + i * 10, ok = passSet.has(i);
        const xs = 140 - w / 2;
        el('line', { class: 'ray', x1: 44, y1: y, x2: ok ? 214 : xs + (w ? 4 : 0), y2: y, stroke: C.amber, 'stroke-width': 1.8, opacity: ok ? .9 : .55 }, beam);
        if (!ok) el('circle', { class: 'ray', cx: xs + 4, cy: y, r: 2.5, fill: C.bad, opacity: .7 }, beam);
      }
      mk.setAttribute('cx', P.X(x)); mk.setAttribute('cy', P.Y(f));
      out.innerHTML = `I / I<sub>0</sub> = e<sup>−μx</sup> = e<sup>−${MU.toFixed(2)} × ${x.toFixed(2)}</sup> = <b>${f.toFixed(3)}</b><br>about <b>${(f * 100).toFixed(1)}%</b> of the photons get through<br>ln(I<sub>0</sub>/I) = μx = <b>${(MU * x).toFixed(3)}</b>${Math.abs(x - 0.6) < 0.03 ? '<br><span class="tag amber">close to one half-value layer</span>' : ''}`;
    }
    slider.addEventListener('input', upd); upd();

    // --- GM tube cross-section
    const gs = $('gm-svg'); arrowDefs(gs, 'gm-ar', C.lead2);
    el('rect', { x: 70, y: 50, width: 300, height: 110, rx: 14, fill: '#f7f5f0', stroke: C.lead, 'stroke-width': 4 }, gs);
    el('rect', { x: 64, y: 62, width: 10, height: 86, rx: 3, fill: C.amber3, stroke: C.amber2 }, gs);
    el('line', { x1: 90, y1: 105, x2: 392, y2: 105, stroke: C.amber2, 'stroke-width': 2.2 }, gs);
    wave(gs, 10, 82, 120, 92, 10, 4);
    txt(gs, 12, 70, 'γ', { 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 16, fill: C.amber2 });
    el('path', { d: 'M122 92 L170 100', stroke: '#5b7fa6', 'stroke-width': 1.6, 'marker-end': 'url(#gm-ar)' }, gs);
    for (let i = 0; i < 18; i++) { const a = Math.random() * 6.283, r = 3 + Math.random() * 12; el('circle', { cx: 230 + Math.cos(a) * r * 2.2, cy: 105 + Math.sin(a) * r * .55, r: 2, fill: '#5b7fa6', opacity: .75 }, gs); }
    txt(gs, 230, 84, 'avalanche', { 'text-anchor': 'middle', 'font-family': F_BODY, 'font-size': 13, fill: C.ink2 });
    txt(gs, 69, 182, 'thin window', { 'text-anchor': 'middle', 'font-family': F_BODY, 'font-size': 13, fill: C.ink2 });
    txt(gs, 220, 40, 'metal wall (cathode), gas inside', { 'text-anchor': 'middle', 'font-family': F_BODY, 'font-size': 13, fill: C.ink2 });
    txt(gs, 330, 128, 'wire anode', { 'text-anchor': 'middle', 'font-family': F_BODY, 'font-size': 13, fill: C.ink2 });
    el('path', { d: 'M392 105 H420 V150', fill: 'none', stroke: C.lead2, 'stroke-width': 1.6 }, gs);
    el('rect', { x: 400, y: 150, width: 46, height: 34, rx: 5, fill: '#2f343a' }, gs);
    txt(gs, 423, 172, '+HV', { 'text-anchor': 'middle', 'font-family': F_MONO, 'font-size': 12, fill: '#f3d48a' });
    txt(gs, 423, 204, 'to scaler', { 'text-anchor': 'middle', 'font-family': F_BODY, 'font-size': 12, fill: C.muted });

    // --- plateau
    const ps = $('pl-svg'), pv = $('pl-v'), pvv = $('pl-vv'), po = $('pl-out');
    const pL = 70, pR = 20, pT = 40, pB = 50, pw = 640 - pL - pR, ph = 300 - pT - pB, Vmin = 300, Vmax = 700, Rmax = 5000;
    const PX = v => pL + (v - Vmin) / (Vmax - Vmin) * pw, PY = r => pT + ph - Math.min(r, Rmax) / Rmax * ph;
    [[Vmin, V_START, 'no counts', '#f1efe9'], [V_START, V_PLATEAU, 'rising', '#f7f0e0'], [V_PLATEAU, 600, 'plateau', '#eef5f2'], [600, V_TOP, '', '#f7f0e0'], [V_TOP, Vmax, 'discharge', '#f8e5df']].forEach(([a, b, lab, col]) => {
      el('rect', { x: PX(a), y: pT, width: PX(b) - PX(a), height: ph, fill: col }, ps);
      if (lab) txt(ps, (PX(a) + PX(b)) / 2, pT + 18, lab, { 'text-anchor': 'middle', 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 12.5, fill: C.ink2 });
    });
    el('line', { x1: pL, y1: pT + ph, x2: pL + pw, y2: pT + ph, stroke: C.ink2, 'stroke-width': 1.5 }, ps);
    el('line', { x1: pL, y1: pT + ph, x2: pL, y2: pT - 8, stroke: C.ink2, 'stroke-width': 1.5 }, ps);
    for (let v = Vmin; v <= Vmax; v += 100) { el('line', { x1: PX(v), y1: pT + ph, x2: PX(v), y2: pT + ph + 5, stroke: C.ink2 }, ps); txt(ps, PX(v), pT + ph + 20, String(v), { 'text-anchor': 'middle', 'font-family': F_MONO, 'font-size': 12.5, fill: C.ink2 }); }
    for (let r = 0; r <= Rmax; r += 1000) { el('line', { x1: pL - 5, y1: PY(r), x2: pL, y2: PY(r), stroke: C.ink2 }, ps); txt(ps, pL - 8, PY(r) + 4, String(r), { 'text-anchor': 'end', 'font-family': F_MONO, 'font-size': 12, fill: C.ink2 }); }
    txt(ps, pL - 6, pT - 16, 'counts/min', { 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 13, fill: C.ink });
    txt(ps, pL + pw, pT + ph + 42, 'tube voltage (V)', { 'text-anchor': 'end', 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 13, fill: C.ink });
    let dp = '';
    for (let v = Vmin; v <= Vmax; v += 2) { const r = trueRate(v, true, 0); dp += (v === Vmin ? 'M' : 'L') + PX(v).toFixed(1) + ' ' + PY(r).toFixed(1); if (r > Rmax) break; }
    el('path', { d: dp, fill: 'none', stroke: C.amber, 'stroke-width': 2.6, 'stroke-linejoin': 'round' }, ps);
    const pm = el('circle', { r: 6.5, fill: C.amber, stroke: '#fff', 'stroke-width': 2 }, ps);
    const pml = el('line', { y1: pT, y2: pT + ph, stroke: C.lead2, 'stroke-dasharray': '3 4' }, ps);
    function pupd() {
      const v = +pv.value, r = trueRate(v, true, 0);
      pvv.textContent = v + ' V';
      pm.setAttribute('cx', PX(v)); pm.setAttribute('cy', PY(r)); pml.setAttribute('x1', PX(v)); pml.setAttribute('x2', PX(v));
      let tag;
      if (v < V_START) tag = '<span class="tag">below the starting voltage: no counts</span>';
      else if (v < V_PLATEAU) tag = '<span class="tag amber">rising: the rate depends strongly on voltage</span>';
      else if (v <= 600) tag = '<span class="tag good">on the plateau: a good operating voltage</span>';
      else if (v <= V_TOP) tag = '<span class="tag amber">end of the plateau</span>';
      else tag = '<span class="tag bad">continuous discharge: can damage the tube</span>';
      po.innerHTML = `Source with no absorber<br>count rate ≈ <b>${r > 99999 ? '> 99999' : Math.round(r)}</b> counts/min<br>${tag}`;
    }
    pv.addEventListener('input', pupd); pupd();

    // --- Poisson dot plot
    const pos = $('po-svg'), poOut = $('po-out');
    const lo = 2500, hi = 2880, mean = trueRate(V_OP, true, 0.2);
    const qL = 30, qR = 30, qw = 640 - qL - qR, base = 170;
    const QX = v => qL + (v - lo) / (hi - lo) * qw;
    el('rect', { x: QX(mean - Math.sqrt(mean)), y: 20, width: QX(mean + Math.sqrt(mean)) - QX(mean - Math.sqrt(mean)), height: base - 20, fill: 'rgba(201,138,16,.08)' }, pos);
    el('line', { x1: qL, y1: base, x2: qL + qw, y2: base, stroke: C.ink2, 'stroke-width': 1.4 }, pos);
    for (let v = lo; v <= hi; v += 40) { el('line', { x1: QX(v), y1: base, x2: QX(v), y2: base + 5, stroke: C.ink2 }, pos); txt(pos, QX(v), base + 20, String(v), { 'text-anchor': 'middle', 'font-family': F_MONO, 'font-size': 11.5, fill: C.ink2 }); }
    el('line', { x1: QX(mean), y1: 16, x2: QX(mean), y2: base, stroke: C.amber, 'stroke-width': 1.6, 'stroke-dasharray': '5 4' }, pos);
    txt(pos, QX(mean) + 6, 28, 'true mean', { 'font-family': F_BODY, 'font-size': 12, fill: C.amber2 });
    txt(pos, QX(mean + Math.sqrt(mean)) + 4, base - 8, '±√N', { 'font-family': F_MONO, 'font-size': 12, fill: C.amber2 });
    txt(pos, qL + qw, base + 40, 'counts in one minute', { 'text-anchor': 'end', 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 12.5, fill: C.ink });
    const dotG = el('g', null, pos);
    let vals = [];
    const bins = {};
    function addCount() {
      const n = poisson(mean, Math.random); vals.push(n);
      const b = Math.round((clamp(n, lo, hi) - lo) / 8);
      bins[b] = (bins[b] || 0) + 1;
      el('circle', { cx: QX(lo + b * 8), cy: base - 6 - (bins[b] - 1) * 9, r: 4, fill: C.lead, opacity: .85 }, dotG);
    }
    function poUpd() {
      if (!vals.length) { poOut.innerHTML = 'No counts yet.'; return; }
      const m = vals.reduce((a, b) => a + b, 0) / vals.length;
      const sd = vals.length > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / (vals.length - 1)) : 0;
      poOut.innerHTML = `${vals.length} count${vals.length > 1 ? 's' : ''}, last <b>${vals[vals.length - 1]}</b><br>mean <b>${m.toFixed(0)}</b>${vals.length > 1 ? `, spread <b>±${sd.toFixed(0)}</b> (√N ≈ ${Math.sqrt(mean).toFixed(0)})` : ''}`;
    }
    $('po-add').addEventListener('click', () => { addCount(); poUpd(); });
    $('po-ten').addEventListener('click', () => { for (let i = 0; i < 10; i++) addCount(); poUpd(); });
    $('po-clear').addEventListener('click', () => { vals = []; for (const k in bins) delete bins[k]; dotG.innerHTML = ''; poUpd(); });
    poUpd();
  })();

  /* =====================================================================
     9. METHOD: apparatus and step figures
     ===================================================================== */
  function benchScene(svg, o) {
    o = o || {};
    defsFor(svg, o.id);
    const id = o.id;
    el('rect', { x: 0, y: 330, width: 1000, height: 50, fill: `url(#${id}-bench)` }, svg);
    el('line', { x1: 0, y1: 330, x2: 1000, y2: 330, stroke: '#cfc8ba' }, svg);
    const beamY = 200;
    drawTrack(svg, 170, 600, 300, id);
    const pb = el('g', null, svg), srcL = el('g', null, svg), pf = el('g', null, svg);
    drawPot(pb, pf, 82, 330, id);
    drawStand(svg, 250, beamY + 16, 300, id);
    el('rect', { x: 236, y: beamY + 12, width: 28, height: 8, rx: 2, fill: '#5b626a' }, svg);
    // absorber slot
    el('rect', { x: 340, y: 120, width: 6, height: 180, fill: '#7a8189' }, svg);
    el('rect', { x: 424, y: 120, width: 6, height: 180, fill: '#7a8189' }, svg);
    el('rect', { x: 336, y: 284, width: 98, height: 8, rx: 2, fill: '#5b626a' }, svg);
    const t = o.x || 0;
    if (t > 0) { const w = t * 50, g = el('g', { transform: `translate(${385 - w / 2} 150)` }, svg); drawPlate(g, w, 134, id); txt(svg, 385, 108, 'x = ' + t.toFixed(1) + ' cm', { 'text-anchor': 'middle', 'font-family': F_MONO, 'font-size': 18, fill: C.ink2 }); }
    drawStand(svg, 590, beamY + 16, 300, id);
    drawTube(svg, 520, beamY, 130, id);
    el('path', { d: `M668 ${beamY} C720 ${beamY} 720 120 ${662 + 404 * .78} ${150 + 30 * .78}`, fill: 'none', stroke: '#2f343a', 'stroke-width': 3 }, svg);
    const sc = el('g', { transform: 'translate(662 150) scale(.78)' }, svg);
    const S = drawScaler(sc, 0, 0, id, { v: o.v == null ? 500 : o.v, count: o.count, time: o.time });
    const src = el('g', null, o.src === 'holder' ? svg : srcL);
    src.setAttribute('transform', o.src === 'holder' ? `translate(250 ${beamY})` : 'translate(82 270)');
    drawSource(src, id);
    if (o.src === 'holder') el('line', { x1: 262, y1: beamY, x2: 512, y2: beamY, stroke: C.amber, 'stroke-width': 1.6, 'stroke-dasharray': '6 6', opacity: .7 }, svg);
    if (o.ring) el('rect', { x: o.ring[0], y: o.ring[1], width: o.ring[2], height: o.ring[3], rx: 14, fill: 'none', stroke: C.amber, 'stroke-width': 3, 'stroke-dasharray': '8 5' }, svg);
    if (o.label) txt(svg, o.label[0], o.label[1], o.label[2], { 'text-anchor': 'middle', 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 18, fill: C.amber2 });
    return S;
  }
  function formulaCard(svg, lines) {
    el('rect', { x: 40, y: 30, width: 920, height: 320, rx: 22, fill: '#fbf8f1', stroke: C.line2 }, svg);
    lines.forEach((ln, i) => {
      const t = tsub(svg, 500, 110 + i * 70, ln.parts, { 'text-anchor': 'middle', 'font-family': ln.mono ? F_MONO : F_HEAD, 'font-weight': ln.bold ? 700 : 500, 'font-size': ln.size || 34, fill: ln.col || C.ink });
      return t;
    });
  }
  (function method() {
    const grid = $('app-grid');
    const items = [
      ['GM tube on a stand', 'detects each gamma photon as one pulse', '0 0 300 150', s => { defsFor(s, 'a1'); drawStand(s, 160, 92, 140, 'a1'); drawTube(s, 70, 76, 170, 'a1'); }],
      ['Counter (scaler)', 'high-voltage supply, timer and count display', '0 0 450 250', s => { defsFor(s, 'a2'); drawScaler(s, 10, 6, 'a2', { v: 500, count: 3410, time: '60 / 60' }); }],
      ['Gamma source', 'sealed Cs-137 in a lead container', '0 0 300 150', s => { defsFor(s, 'a3'); const b = el('g', null, s), m = el('g', null, s), f = el('g', null, s); drawPot(b, f, 150, 140, 'a3'); const sg = el('g', { transform: 'translate(150 82)' }, m); drawSource(sg, 'a3'); }],
      ['Tongs', 'the source is always handled with tongs', '0 0 300 150', s => { const g = el('g', { transform: 'translate(240 75) rotate(-10)' }, s); drawTongs(g); defsFor(s, 'a4'); const sg = el('g', { transform: 'translate(240 129)' }, s); drawSource(sg, 'a4'); }],
      ['Lead absorbers', 'sheets of known thickness, in cm', '0 0 300 150', s => { defsFor(s, 'a5'); [[.1, 36], [.2, 104], [.4, 168], [.5, 236]].forEach(([t, x]) => { const g = el('g', { transform: `translate(${x} 18)` }, s); drawPlate(g, t * 50, 96, 'a5'); txt(s, x + t * 25, 136, t.toFixed(1) + ' cm', { 'text-anchor': 'middle', 'font-family': F_MONO, 'font-size': 13, fill: C.ink2 }); }); }],
      ['Holder, slot and track', 'source and tube a fixed distance apart, absorber midway', '0 0 300 150', s => { defsFor(s, 'a6'); drawTrack(s, 20, 280, 118, 'a6'); drawStand(s, 50, 76, 118, 'a6'); el('rect', { x: 130, y: 30, width: 4, height: 88, fill: '#7a8189' }, s); el('rect', { x: 166, y: 30, width: 4, height: 88, fill: '#7a8189' }, s); el('path', { d: 'M50 22 H250', stroke: C.lead, 'stroke-width': 1.4, 'marker-start': 'url(#a6-ar)', 'marker-end': 'url(#a6-ar)' }, s); arrowDefs(s, 'a6-ar', C.lead); txt(s, 150, 16, 'fixed distance', { 'text-anchor': 'middle', 'font-family': F_BODY, 'font-size': 13, fill: C.muted }); drawStand(s, 250, 78, 118, 'a6'); el('rect', { x: 226, y: 62, width: 60, height: 18, rx: 4, fill: '#d4d8dc', stroke: '#7d858d' }, s); }]
    ];
    items.forEach(([name, sub, vb, f]) => {
      const d = document.createElement('div'); d.className = 'app-item';
      const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', vb); s.setAttribute('aria-hidden', 'true');
      d.appendChild(s); f(s);
      const sp = document.createElement('span'); sp.textContent = name; d.appendChild(sp);
      const sm = document.createElement('small'); sm.textContent = sub; d.appendChild(sm);
      grid.appendChild(d);
    });

    const fig = $('step-fig'), cap = $('step-cap');
    const steps = Array.from(document.querySelectorAll('#steps .step'));
    function newSvg(vb) { fig.innerHTML = ''; const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', vb || '0 0 1000 380'); s.setAttribute('role', 'img'); fig.appendChild(s); return s; }
    const caps = [
      'The tube plugs into the GM socket of the scaler, which supplies the high voltage and counts the pulses.',
      'Turn the HV knob up slowly. Counting starts near 400 V and levels off on the plateau; about 500 V is used.',
      'With the source shut in its lead container, the tube counts only the background, a few tens per minute.',
      'Lifted with tongs into the holder, the source faces the tube. No absorber yet: this gives I0av.',
      'Removing the background leaves the count rate due to the source alone.',
      'Lead sheets stand in the slot midway between source and tube. Thicker lead, fewer counts.',
      'Each average has the same background removed.',
      'ln(I0/I) grows in proportion to the thickness.',
      'ln(I0/I) on the y-axis, x on the x-axis.',
      'The slope of the best straight line is μ, about 1.20 cm⁻¹ in the example.'
    ];
    function pick(i) {
      steps.forEach((b, k) => b.setAttribute('aria-pressed', k === i ? 'true' : 'false'));
      const vbs = ['480 70 520 300', '640 130 360 222', '0 70 1000 300', '0 70 1000 300', null, '0 70 1000 300'];
      const s = newSvg(vbs[i]); const id = 'st' + i;
      cap.textContent = caps[i].replace('I0av', 'I₀av').replace('ln(I0/I)', 'ln(I₀/I)');
      if (i === 0) benchScene(s, { id, src: 'pot', v: 0, ring: [640, 126, 356, 64] });
      else if (i === 1) benchScene(s, { id, src: 'pot', v: 500, ring: [880, 168, 112, 116], count: 0 });
      else if (i === 2) benchScene(s, { id, src: 'pot', v: 500, count: 24, time: '60 / 60', ring: [22, 210, 120, 130] });
      else if (i === 3) benchScene(s, { id, src: 'holder', v: 500, count: 3410, time: '60 / 60', ring: [220, 130, 60, 110] });
      else if (i === 4) formulaCard(s, [
        { parts: ['I', { sub: '0' }, ' = I', { sub: '0av' }, ' − I', { sub: 'BG' }], bold: true, size: 40 },
        { parts: ['= 3412 − 24'], mono: true, size: 32, col: C.ink2 },
        { parts: ['= 3388 counts/min'], mono: true, size: 32, col: C.amber2 }]);
      else if (i === 5) benchScene(s, { id, src: 'holder', v: 500, count: 1702, time: '60 / 60', x: 0.6, ring: [326, 92, 118, 210] });
      else if (i === 6) formulaCard(s, [
        { parts: ['I = I', { sub: 'av' }, ' − I', { sub: 'BG' }], bold: true, size: 40 },
        { parts: ['x = 0.6 cm:  1677 − 24'], mono: true, size: 30, col: C.ink2 },
        { parts: ['= 1653 counts/min'], mono: true, size: 32, col: C.amber2 }]);
      else if (i === 7) formulaCard(s, [
        { parts: ['ln(I', { sub: '0' }, ' / I)'], bold: true, size: 40 },
        { parts: ['= ln(3388 ÷ 1653) = ln(2.050)'], mono: true, size: 28, col: C.ink2 },
        { parts: ['= 0.718'], mono: true, size: 32, col: C.amber2 }]);
      else {
        s.setAttribute('viewBox', '0 0 720 440');
        const P = makePlot(s, { xmax: 1.2, ymax: 1.6 });
        P.points(EX.rows.map(r => ({ x: r.x, y: r.ln })));
        if (i === 9) {
          P.line({ x: .1, y: .12 }, { x: .9, y: 1.08 }, true);
          tsub(P.topG, P.X(.12), P.Y(1.42), ['μ = 0.96 ÷ 0.80 = 1.20 cm', { sup: '−1' }], { 'font-family': F_MONO, 'font-weight': 600, 'font-size': 19, fill: C.amber2 });
        }
      }
    }
    steps.forEach((b, i) => b.addEventListener('click', () => pick(i)));
    pick(0);
  })();

  /* =====================================================================
     10. RESULTS: example table and graph
     ===================================================================== */
  (function results() {
    const tb = document.querySelector('#res-table tbody');
    EX.rows.forEach((r, i) => {
      const tr = document.createElement('tr');
      [i + 1, r.x.toFixed(1), r.r[0], r.r[1], r.r[2], fmtAvg(r.av), fmtAvg(r.I), r.q.toFixed(3), r.ln.toFixed(3)].forEach(v => { const td = document.createElement('td'); td.textContent = v; tr.appendChild(td); });
      tb.appendChild(tr);
    });
    const P = makePlot($('res-graph'), { xmax: 1.2, ymax: 1.6 });
    P.points(EX.rows.map(r => ({ x: r.x, y: +r.ln.toFixed(3) })));
    const A = { x: .1, y: .12 }, B = { x: .9, y: 1.08 };
    P.line(A, B, true);
    [A, B].forEach((p, k) => {
      el('circle', { cx: P.X(p.x), cy: P.Y(p.y), r: 5, fill: C.amber, stroke: '#fff', 'stroke-width': 1.5 }, P.topG);
      tsub(P.topG, P.X(p.x) + (k ? -12 : 12), P.Y(p.y) + (k ? -12 : 24), [`(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`], { 'text-anchor': k ? 'end' : 'start', 'font-family': F_MONO, 'font-size': 13.5, fill: C.amber2 });
    });
    tsub(P.topG, P.X(.08), P.Y(1.45), ['slope μ = 0.96 ÷ 0.80 = 1.20 cm', { sup: '−1' }], { 'font-family': F_MONO, 'font-weight': 600, 'font-size': 17, fill: C.amber2 });
  })();

  /* =====================================================================
     11. MCQs: one numbered list, shuffled choices
     ===================================================================== */
  const MCQ = [
    { q: 'Gamma rays are best described as…', a: 'high-energy photons emitted by unstable nuclei', o: ['fast electrons emitted by nuclei', 'helium nuclei', 'slow neutrons'],
      hint: 'They carry no charge and no mass.', ex: 'Gamma rays are electromagnetic radiation: high-energy photons from nuclear transitions.' },
    { q: 'Which interaction removes a gamma photon completely, giving all its energy to an inner electron?', a: 'photoelectric effect', o: ['Compton scattering', 'pair production', 'reflection'],
      hint: 'In one of them the photon disappears and a single electron is ejected.', ex: 'In the photoelectric effect the photon is absorbed and an electron is ejected.' },
    { q: 'In Compton scattering the photon…', a: 'gives part of its energy to an electron and carries on at an angle', o: ['is absorbed completely', 'turns into an electron–positron pair', 'gains energy from the electron'],
      hint: 'The photon survives, but with less energy.', ex: 'The photon shares its energy with an outer electron and is scattered with a longer wavelength.' },
    { q: 'Pair production needs a photon energy of at least…', a: '1.022 MeV', o: ['0.511 MeV', '0.662 MeV', '13.6 eV'],
      hint: 'Two particles, each of rest energy 0.511 MeV, must be created.', ex: '2 × 0.511 MeV = 1.022 MeV, so pair production cannot happen for the 662 keV photons of Cs-137.' },
    { q: 'Charged particles such as alpha and beta particles differ from gamma rays because they…', a: 'lose energy continuously by ionisation and have a definite range', o: ['pass through lead without any loss', 'are never stopped by matter', 'only interact once and then vanish'],
      hint: 'Think about the electric force on electrons along the path.', ex: 'A charged particle ionises atoms all along its track and stops after a definite range; gamma photons are attenuated exponentially.' },
    { q: 'The intensity of a narrow gamma beam after a thickness x of absorber is…', a: 'I = I₀ e^(−μx)', o: ['I = I₀ − μx', 'I = I₀ / x²', 'I = I₀ e^(+μx)'],
      hint: 'Each layer removes the same fraction.', ex: 'Equal fractions removed per layer give an exponential fall: I = I₀ e^(−μx).' },
    { q: 'The unit of the linear absorption coefficient μ, with x in cm, is…', a: 'cm⁻¹', o: ['cm', 'counts/min', 'cm²/g'],
      hint: 'μx must have no unit.', ex: 'μx is a pure number, so μ is in cm⁻¹ when x is in cm.' },
    { q: 'To get a straight line whose slope is μ, the graph should plot…', a: 'ln(I₀/I) on the y-axis against x on the x-axis', o: ['x on the y-axis against ln(I₀/I) on the x-axis', 'I on the y-axis against x on the x-axis', 'I₀/I on the y-axis against ln x'],
      hint: 'ln(I₀/I) = μx has the form y = mx.', ex: 'With y = ln(I₀/I) and x the thickness, the slope is μ. Swapping the axes gives 1/μ.' },
    { q: 'The half-value layer of an absorber is…', a: 'the thickness that halves the intensity, HVL = 0.693/μ', o: ['half the thickness of the thickest sheet', 'the thickness that stops all the photons', 'μ divided by 2'],
      hint: 'Put I = I₀/2 into I = I₀ e^(−μx).', ex: 'e^(−μx) = 1/2 gives x = ln 2 / μ = 0.693/μ.' },
    { q: 'With μ = 1.20 cm⁻¹ for lead, the half-value layer is about…', a: '0.58 cm', o: ['1.73 cm', '0.83 cm', '0.25 cm'],
      hint: 'HVL = 0.693 ÷ μ.', ex: '0.693 ÷ 1.20 ≈ 0.58 cm of lead halves the count rate.' },
    { q: 'Why is the background count measured and subtracted?', a: 'so that I₀ and I describe the source alone', o: ['to make the counts larger', 'because the tube only works after warming up', 'to cancel the dead time of the tube'],
      hint: 'The tube counts cosmic rays and natural radioactivity too.', ex: 'Background is present in every reading, so it is removed to leave the counts due to the source.' },
    { q: 'Background is measured with…', a: 'the source shut in its lead container', o: ['the source in the holder and no absorber', 'the thickest lead in the slot', 'the tube switched off'],
      hint: 'Only the surroundings should be counted.', ex: 'With the source shielded in its container, the tube counts only the background.' },
    { q: 'The operating voltage of the GM tube is chosen…', a: 'on the plateau, where the count rate hardly changes with voltage', o: ['just above the starting voltage', 'as high as the supply allows', 'where the count rate is largest'],
      hint: 'A small drift in voltage should not change the counts.', ex: 'On the plateau (about 500 V here) the count rate is almost independent of small voltage changes.' },
    { q: 'If the tube voltage is raised well above the plateau…', a: 'the tube goes into continuous discharge and can be damaged', o: ['the tube stops counting', 'the count rate falls to the background', 'μ becomes larger'],
      hint: 'Look at the far right of the plateau curve.', ex: 'Beyond the plateau the gas discharges continuously; the count races up and the tube can be damaged.' },
    { q: 'Repeated one-minute counts of about 2700 differ by roughly…', a: '±52, because the spread is about √N', o: ['±1, because the counter is digital', '±2700', 'nothing; repeated counts are identical'],
      hint: 'Radioactive decay is random (Poisson).', ex: '√2700 ≈ 52, so single counts scatter by about ±52; averaging three reduces the scatter.' },
    { q: 'I₀av = 3412 counts/min and I_BG = 24 counts/min. I₀ is…', a: '3388 counts/min', o: ['3436 counts/min', '3412 counts/min', '142 counts/min'],
      hint: 'Subtract, do not add.', ex: 'I₀ = 3412 − 24 = 3388 counts/min.' },
    { q: 'I₀ = 3388 and I = 1653 counts/min. ln(I₀/I) is about…', a: '0.718', o: ['0.312', '−0.718', '2.050'],
      hint: 'Divide first, then take the natural logarithm.', ex: '3388 ÷ 1653 = 2.050 and ln(2.050) = 0.718. 0.312 is log₁₀; −0.718 has the ratio upside down.' },
    { q: 'Using log₁₀ instead of ln for every point makes the slope…', a: '2.303 times too small', o: ['2.303 times too large', 'negative', 'unchanged'],
      hint: 'ln y = 2.303 log₁₀ y.', ex: 'Every log₁₀ value is ln/2.303, so the slope and μ come out 2.303 times too small.' },
    { q: 'Two points on the best-fit line are (0.10, 0.12) and (0.90, 1.08). μ is…', a: '1.20 cm⁻¹', o: ['0.83 cm⁻¹', '0.96 cm⁻¹', '1.08 cm⁻¹'],
      hint: 'Slope = (y₂ − y₁) ÷ (x₂ − x₁).', ex: '(1.08 − 0.12) ÷ (0.90 − 0.10) = 0.96 ÷ 0.80 = 1.20 cm⁻¹. 0.83 is the slope upside down.' },
    { q: 'Lead is used for gamma shielding mainly because it…', a: 'is dense and has a high atomic number', o: ['is a good electrical conductor', 'is magnetic', 'absorbs light well'],
      hint: 'Think about electrons per centimetre and the photoelectric effect.', ex: 'High density and Z = 82 give many electrons per cm and a strong photoelectric effect, so μ is large.' },
    { q: 'Which is the safest way to handle the gamma source?', a: 'with tongs, briefly, held away from the body and pointed away from people', o: ['with bare fingers, quickly', 'held close to the tube by hand', 'left out of its container between readings'],
      hint: 'Time, distance, shielding.', ex: 'Tongs increase distance, short handling cuts time, and the lead container shields between readings.' }
  ];
  (function mcq() {
    const list = $('mcq-list'), score = $('mcq-score');
    let solved = 0;
    function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    function updScore() { score.textContent = `${solved} of ${MCQ.length} correct`; }
    function render() {
      solved = 0; list.innerHTML = '';
      MCQ.forEach((m, qi) => {
        const li = document.createElement('li'); li.className = 'mcq';
        const opts = shuffle([m.a].concat(m.o));
        li.innerHTML = `<p class="mcq-q"><span class="mcq-n">${qi + 1}.</span><span></span></p><div class="mcq-opts"></div><div class="mcq-fb" aria-live="polite"></div>`;
        li.querySelector('.mcq-q span:last-child').textContent = m.q;
        const box = li.querySelector('.mcq-opts'), fb = li.querySelector('.mcq-fb');
        opts.forEach(o => {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'opt'; b.textContent = o;
          b.addEventListener('click', () => {
            if (li.classList.contains('solved')) return;
            if (o === m.a) {
              b.classList.remove('wrong'); b.classList.add('right'); li.classList.add('solved');
              box.querySelectorAll('.opt').forEach(x => { x.disabled = true; x.classList.remove('wrong'); });
              fb.className = 'mcq-fb show explain'; fb.textContent = m.ex;
              solved++; updScore();
            } else {
              b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong');
              fb.className = 'mcq-fb show hint'; fb.textContent = 'Not quite. ' + m.hint;
            }
          });
          box.appendChild(b);
        });
        list.appendChild(li);
      });
      updScore();
    }
    $('mcq-reset').addEventListener('click', render);
    render();
  })();

  /* =====================================================================
     12. PRACTICAL: bench, source and tongs, lead sheets, scaler, counting
     ===================================================================== */
  const tut = { on: false, cancel: false, skip: false };
  (function practical() {
    const svg = $('rig'); defsFor(svg, 'rg');
    const BEAM = 250, HOLD_X = 290, SLOT_X = 470, WIN_X = 660, PLATE_H = 116, STACK_TOP = 188, RACK_TOP = 414, PX_CM = 50;
    const POT_X = 90, POT_SRC = { x: POT_X, y: 262 }, HOLD = { x: HOLD_X, y: BEAM };
    const TONGS_REST = { x: 222, y: 382 };
    const SLOT_XS = n => 70 + (n - 1) * 68;
    // bench and back wall
    el('rect', { x: 0, y: 0, width: 1000, height: 330, fill: 'rgba(255,255,255,.35)' }, svg);
    el('rect', { x: 0, y: 330, width: 1000, height: 330, fill: 'url(#rg-bench)' }, svg);
    el('line', { x1: 0, y1: 330, x2: 1000, y2: 330, stroke: '#cbc4b5', 'stroke-width': 1.5 }, svg);
    drawTrack(svg, 160, 880, 318, 'rg');
    const potBack = el('g', null, svg), srcPotLayer = el('g', null, svg), potFront = el('g', null, svg);
    drawPot(potBack, potFront, POT_X, 330, 'rg');
    txt(svg, POT_X, 352, 'lead container', { 'text-anchor': 'middle', 'font-family': F_BODY, 'font-size': 13, fill: C.muted });
    // fixed distance
    arrowDefs(svg, 'rg-ar', C.lead3);
    el('line', { x1: HOLD_X, y1: 128, x2: WIN_X, y2: 128, stroke: C.lead3, 'stroke-width': 1.3, 'marker-start': 'url(#rg-ar)', 'marker-end': 'url(#rg-ar)' }, svg);
    el('line', { x1: HOLD_X, y1: 120, x2: HOLD_X, y2: 200, stroke: C.lead3, 'stroke-dasharray': '3 4' }, svg);
    el('line', { x1: WIN_X, y1: 120, x2: WIN_X, y2: 228, stroke: C.lead3, 'stroke-dasharray': '3 4' }, svg);
    txt(svg, (HOLD_X + WIN_X) / 2, 118, 'fixed source-to-tube distance', { 'text-anchor': 'middle', 'font-family': F_BODY, 'font-size': 13, fill: C.muted });
    // source holder
    drawStand(svg, HOLD_X, BEAM + 18, 318, 'rg');
    el('path', { d: `M${HOLD_X - 16} ${BEAM + 10} h32 v10 h-32z`, fill: '#5b626a', stroke: '#3f454c' }, svg);
    const holdGhost = el('rect', { x: HOLD_X - 10, y: BEAM - 17, width: 20, height: 34, rx: 4, fill: 'none', stroke: C.lead3, 'stroke-dasharray': '4 3', 'stroke-width': 1.4, 'pointer-events': 'none' }, svg);
    txt(svg, HOLD_X, 352, 'source holder', { 'text-anchor': 'middle', 'font-family': F_BODY, 'font-size': 13, fill: C.muted });
    // absorber slot
    el('rect', { x: SLOT_X - 48, y: 176, width: 6, height: 142, fill: '#7a8189', stroke: '#5b626a', 'stroke-width': .6 }, svg);
    el('rect', { x: SLOT_X + 42, y: 176, width: 6, height: 142, fill: '#7a8189', stroke: '#5b626a', 'stroke-width': .6 }, svg);
    el('rect', { x: SLOT_X - 52, y: 304, width: 104, height: 8, rx: 2, fill: '#5b626a' }, svg);
    const slotHi = el('rect', { x: SLOT_X - 60, y: 168, width: 120, height: 152, rx: 10, fill: 'rgba(201,138,16,.08)', stroke: C.amber, 'stroke-width': 2, 'stroke-dasharray': '6 4', opacity: 0, 'pointer-events': 'none' }, svg);
    const xLab = txt(svg, SLOT_X, 162, 'x = 0.00 cm', { 'text-anchor': 'middle', 'font-family': F_MONO, 'font-weight': 600, 'font-size': 17, fill: C.ink2 });
    txt(svg, SLOT_X, 352, 'absorber slot (midway)', { 'text-anchor': 'middle', 'font-family': F_BODY, 'font-size': 13, fill: C.muted });
    const stackLayer = el('g', null, svg);
    // beam guide
    const beamLine = el('line', { x1: HOLD_X + 12, y1: BEAM, x2: WIN_X - 6, y2: BEAM, stroke: C.amber, 'stroke-width': 1.5, 'stroke-dasharray': '6 6', opacity: 0, 'pointer-events': 'none' }, svg);
    // tube on its stand
    drawStand(svg, 770, BEAM + 18, 318, 'rg');
    el('rect', { x: 756, y: BEAM + 12, width: 28, height: 10, rx: 2, fill: '#5b626a' }, svg);
    const TB = drawTube(svg, WIN_X, BEAM, 180, 'rg');
    txt(svg, 760, 352, 'GM tube', { 'text-anchor': 'middle', 'font-family': F_BODY, 'font-size': 13, fill: C.muted });
    const photonLayer = el('g', { 'pointer-events': 'none' }, svg);
    // rack of lead sheets
    el('rect', { x: 28, y: 516, width: 488, height: 64, rx: 8, fill: 'url(#rg-wood)', stroke: '#9b907b', filter: 'url(#rg-sh)' }, svg);
    for (let n = 1; n <= 7; n++) {
      el('rect', { x: SLOT_XS(n) - 22, y: 520, width: 44, height: 12, rx: 3, fill: '#8e846f' }, svg);
      el('circle', { cx: SLOT_XS(n), cy: 556, r: 11, fill: '#fdfcf8', stroke: '#9b907b' }, svg);
      txt(svg, SLOT_XS(n), 561, String(n), { 'text-anchor': 'middle', 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 13, fill: C.ink2 });
    }
    txt(svg, 272, 604, 'rack of lead sheets: each sheet returns to its own numbered slot', { 'text-anchor': 'middle', 'font-family': F_BODY, 'font-size': 13, fill: C.muted });
    const rackLayer = el('g', null, svg);
    // cable and scaler
    el('path', { d: 'M858 250 C 950 250, 990 330, 954 424', fill: 'none', stroke: '#2f343a', 'stroke-width': 3.2, 'stroke-linecap': 'round' }, svg);
    const SC = drawScaler(svg, 550, 405, 'rg', { live: true, v: 0 });
    SC.knob.setAttribute('role', 'slider'); SC.knob.setAttribute('aria-label', 'High-voltage knob'); SC.knob.setAttribute('aria-valuemin', '0'); SC.knob.setAttribute('aria-valuemax', String(V_MAX));
    const srcTop = el('g', null, svg), dragLayer = el('g', null, svg);
    const tongs = el('g', { 'pointer-events': 'none' }, svg); drawTongs(tongs);
    const hiRing = el('rect', { rx: 14, fill: 'none', stroke: C.amber, 'stroke-width': 3, opacity: 0, 'pointer-events': 'none' }, svg);

    /* ---------- source ---------- */
    const SRC = { g: el('g', { class: 'drag', tabindex: 0, role: 'button', 'aria-label': 'Gamma source: drag with the tongs between its container and the holder' }, srcPotLayer), loc: 'pot', x: POT_SRC.x, y: POT_SRC.y };
    el('rect', { x: -16, y: -66, width: 32, height: 90, fill: 'transparent' }, SRC.g);
    drawSource(SRC.g, 'rg');
    el('rect', { class: 'focus-ring', x: -14, y: -64, width: 28, height: 84, rx: 7, fill: 'none', stroke: C.amber, 'stroke-width': 2.2 }, SRC.g);
    function placeSrc() { SRC.g.setAttribute('transform', `translate(${SRC.x.toFixed(1)} ${SRC.y.toFixed(1)})`); }
    let tongsOn = false;
    function placeTongs() {
      if (tongsOn) tongs.setAttribute('transform', `translate(${SRC.x.toFixed(1)} ${(SRC.y - 54).toFixed(1)}) rotate(35)`);
      else tongs.setAttribute('transform', `translate(${TONGS_REST.x} ${TONGS_REST.y})`);
    }

    /* ---------- lead sheets ---------- */
    const THK = [0.1, 0.2, 0.2, 0.2, 0.2, 0.2, 0.5];
    const PLATES = THK.map((t, i) => {
      const p = { n: i + 1, t, w: Math.max(5, t * PX_CM), loc: 'rack', x: 0, y: 0 };
      p.g = el('g', { class: 'drag', tabindex: 0, role: 'button', 'aria-label': `Lead sheet ${p.n}, ${t.toFixed(1)} cm` }, rackLayer);
      el('rect', { x: -8, y: -4, width: p.w + 16, height: PLATE_H + 8, fill: 'transparent' }, p.g);
      drawPlate(p.g, p.w, PLATE_H, 'rg');
      el('rect', { class: 'focus-ring', x: -5, y: -5, width: p.w + 10, height: PLATE_H + 10, rx: 4, fill: 'none', stroke: C.amber, 'stroke-width': 2.2 }, p.g);
      p.lab = txt(rackLayer, SLOT_XS(p.n), 640, t.toFixed(1) + ' cm', { 'text-anchor': 'middle', 'font-family': F_MONO, 'font-size': 13, fill: C.ink2 });
      p.home = () => ({ x: SLOT_XS(p.n) - p.w / 2, y: RACK_TOP });
      const h = p.home(); p.x = h.x; p.y = h.y;
      return p;
    });
    PLATES.forEach(p => txt(rackLayer, SLOT_XS(p.n), 624, '#' + p.n, { 'text-anchor': 'middle', 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 11, fill: C.muted }));
    function placePlate(p) { p.g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`); }

    /* ---------- state ---------- */
    const st = { V: 0, stack: [], counting: false, run: null, lastRun: null, mode: 30, sound: false, region: null, rng: Math.random };
    const stackX = () => +st.stack.reduce((a, n) => a + THK[n - 1], 0).toFixed(2);
    function stackSlots() { const W = st.stack.reduce((a, n) => a + PLATES[n - 1].w, 0); let x = SLOT_X - W / 2; return st.stack.map(n => { const p = PLATES[n - 1], o = { p, x, y: STACK_TOP }; x += p.w; return o; }); }
    function layoutStack(except) { stackSlots().forEach(o => { if (o.p === except) return; o.p.x = o.x; o.p.y = o.y; placePlate(o.p); }); }
    const msgEl = $('rig-msg');
    function say(t, cls) { msgEl.textContent = t; msgEl.className = 'rig-msg' + (cls ? ' ' + cls : ''); }
    const DEFAULT_MSG = 'Turn the HV knob up slowly to about 500 V. Count the background with the source in its container, then move the source to its holder with the tongs.';
    function configKey() { if (SRC.loc === 'pot') return 'bg'; if (SRC.loc === 'holder') { const x = stackX(); return x === 0 ? 'i0' : 'x' + x.toFixed(2); } return null; }
    function keyName(k) { return k === 'bg' ? 'background' : k === 'i0' ? 'no absorber (x = 0)' : `x = ${(+k.slice(1)).toFixed(2)} cm`; }
    function regionOf(V) { return V < V_START ? 'off' : V < V_PLATEAU ? 'rise' : V <= 600 ? 'plateau' : V <= V_TOP ? 'top' : 'discharge'; }
    function updStatus() {
      const x = stackX(), reg = regionOf(st.V);
      const regTxt = { off: 'below the starting voltage', rise: 'below the plateau', plateau: 'on the plateau', top: 'top of the plateau', discharge: 'continuous discharge' }[reg];
      $('status').innerHTML = `Source: <b>${SRC.loc === 'pot' ? 'in its container' : SRC.loc === 'holder' ? 'in the holder' : 'in the tongs'}</b><br>Absorber: <b>x = ${x.toFixed(2)} cm</b>${st.stack.length ? ' (sheets ' + st.stack.map(n => '#' + n).join(', ') + ')' : ''}<br>HV: <b>${st.V} V</b>, ${regTxt}`;
      xLab.textContent = `x = ${x.toFixed(2)} cm`;
      holdGhost.setAttribute('opacity', SRC.loc === 'holder' ? 0 : 1);
      beamLine.setAttribute('opacity', SRC.loc === 'holder' ? .55 : 0);
      SC.mode.textContent = st.mode === 1 ? 'preset 60 s, real time' : `preset 60 s, fast ×${st.mode} (${60 / st.mode} s)`;
      updTarget();
    }

    /* ---------- HV ---------- */
    function setV(v, quiet) {
      v = clamp(Math.round(v / 10) * 10, 0, V_MAX);
      if (st.counting && v !== st.V) { say('The HV stays fixed while counting. Wait for the count to finish, or press STOP.', 'warn'); return; }
      st.V = v; SC.setV(v); SC.knob.setAttribute('aria-valuenow', v);
      const reg = regionOf(v);
      SC.hvBox.setAttribute('fill', reg === 'discharge' ? '#f1b9a8' : 'url(#rg-lcd)');
      SC.hvBox.classList.toggle('hv-warn', reg === 'discharge');
      if (!quiet && (reg !== st.region || reg === 'off')) {
        if (reg === 'off') say(v === 0 ? 'HV at 0 V.' : `HV ${v} V: below the starting voltage, the tube does not count yet. Keep turning slowly.`);
        else if (reg === 'rise') say(`HV ${v} V: counting starts, but the rate still rises steeply with voltage. Keep going to the plateau.`, 'warn');
        else if (reg === 'plateau') say(`HV ${v} V: on the plateau, where the count rate hardly changes with voltage. About 500 V is the operating voltage.`, 'ok');
        else if (reg === 'top') say(`HV ${v} V: the end of the plateau. Do not go higher; about 500 V is safer.`, 'warn');
        else say(`Warning: at ${v} V the tube is above the plateau and goes into continuous discharge. The count races up and the tube can be damaged. Turn the HV back down to about 500 V.`, 'bad');
      }
      st.region = reg;
      updStatus();
    }
    function knobAngle(e) {
      const p = svgPoint(svg, e); let a = Math.atan2(p.y - SC.ky, p.x - SC.kx) * 180 / Math.PI + 90;
      if (a > 180) a -= 360;
      return clamp((a + 135) / 270 * V_MAX, 0, V_MAX);
    }
    SC.knob.addEventListener('pointerdown', e => {
      if (tut.on) return;
      e.preventDefault(); SC.knob.setPointerCapture(e.pointerId); SC.knob.focus({ preventScroll: true });
      let lastV = st.V;
      const mv = ev => { let v = knobAngle(ev); if (Math.abs(v - lastV) > 400) return; lastV = v; setV(v); };
      const up = () => { SC.knob.removeEventListener('pointermove', mv); SC.knob.removeEventListener('pointerup', up); SC.knob.removeEventListener('pointercancel', up); };
      SC.knob.addEventListener('pointermove', mv); SC.knob.addEventListener('pointerup', up); SC.knob.addEventListener('pointercancel', up);
    });
    SC.knob.addEventListener('wheel', e => { if (tut.on) return; e.preventDefault(); setV(st.V + (e.deltaY < 0 ? 10 : -10)); }, { passive: false });
    SC.knob.addEventListener('keydown', e => {
      if (tut.on) return;
      const d = { ArrowUp: 10, ArrowRight: 10, ArrowDown: -10, ArrowLeft: -10, PageUp: 50, PageDown: -50 }[e.key];
      if (d) { e.preventDefault(); setV(st.V + d); }
    });
    document.querySelectorAll('[data-hv]').forEach(b => b.addEventListener('click', () => setV(st.V + +b.dataset.hv)));
    const selMode = $('c-mode');
    selMode.addEventListener('change', () => { if (st.counting) { selMode.value = String(st.mode); say('The count time cannot change during a count.', 'warn'); return; } st.mode = +selMode.value; updStatus(); });

    /* ---------- sound ---------- */
    let actx = null, lastClick = 0;
    const btnSound = $('c-sound');
    btnSound.addEventListener('click', () => {
      st.sound = !st.sound; btnSound.setAttribute('aria-pressed', st.sound ? 'true' : 'false');
      if (st.sound && !actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { actx = null; } }
      if (actx && actx.state === 'suspended') actx.resume();
    });
    function clickSound() {
      if (!st.sound || !actx || TC.paused) return;
      const n = performance.now(); if (n - lastClick < 28) return; lastClick = n;
      const len = Math.floor(actx.sampleRate * .004), buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const s = actx.createBufferSource(), g = actx.createGain(); g.gain.value = .35; s.buffer = buf; s.connect(g); g.connect(actx.destination); s.start();
    }

    /* ---------- counting ---------- */
    let flashT = 0;
    function flash() {
      SC.led.setAttribute('opacity', 1); TB.win.setAttribute('opacity', .8); flashT = performance.now();
      clickSound(); cursorTick();
    }
    let runResolve = null;
    const runsLog = [];
    function showCount(n) { SC.count.textContent = String(Math.min(999999, n)).padStart(6, '0'); }
    function startCount() {
      if (st.counting) { say('A count is already running.', 'warn'); return null; }
      const key = configKey();
      if (!key) { say('Put the source in its holder or back in its container before counting.', 'warn'); return null; }
      const x = stackX(), lam = trueRate(st.V, SRC.loc === 'holder', x);
      const N = poisson(lam, st.rng);
      const dur = 60000 / st.mode;
      let arr = null;
      if (N <= 9000) { arr = new Float64Array(N); for (let i = 0; i < N; i++) arr[i] = Math.random(); arr.sort(); }
      st.run = { key, V: st.V, x, N, mode: st.mode, t0: tnow(), dur, arr, idx: 0, shown: 0, complete: false, recorded: false, stoppedAt: null };
      st.counting = true; st.lastRun = null;
      showCount(0); SC.time.textContent = '0 / 60';
      say(st.V < V_START ? `Counting at ${st.V} V… the tube is below its starting voltage, so nothing registers.` : `Counting for 60 s: ${keyName(key)}.`, st.V < V_START ? 'warn' : '');
      requestAnimationFrame(tick);
      return new Promise(res => { runResolve = res; });
    }
    function tick() {
      const r = st.run; if (!r || !st.counting) return;
      const p = Math.min(1, (tnow() - r.t0) / r.dur);
      let n;
      if (r.arr) { while (r.idx < r.arr.length && r.arr[r.idx] <= p) r.idx++; n = r.idx; }
      else n = Math.round(r.N * p);
      if (p >= 1) n = r.N;
      if (n > r.shown) flash();
      r.shown = n; showCount(n);
      SC.time.textContent = Math.floor(p * 60 + 1e-9) + ' / 60';
      // photons crossing the bench while counting with the source out
      if (SRC.loc === 'holder' && !reduced && Math.random() < .5) spawnPhoton();
      if (p >= 1) { finishRun(); return; }
      requestAnimationFrame(tick);
    }
    function finishRun() {
      const r = st.run; st.counting = false; r.complete = true; st.lastRun = r; runsLog.push(r);
      SC.time.textContent = '60 / 60';
      if (r.V > V_TOP) say(`${r.N} counts: the tube was in continuous discharge at ${r.V} V. This is not a real count; turn the HV back to about 500 V.`, 'bad');
      else if (r.V < V_PLATEAU) say(`${r.N} counts in 60 s at ${r.V} V. Below the plateau the count depends on voltage; raise the HV to about 500 V first.`, 'warn');
      else say(`Count complete: ${r.N} counts in 60 s (${keyName(r.key)}). Record it, or count again.`, 'ok');
      updTarget();
      if (runResolve) { const f = runResolve; runResolve = null; f(r); }
    }
    function stopCount() {
      if (!st.counting) { say('No count is running.'); return; }
      const r = st.run; st.counting = false; r.stoppedAt = Math.floor((tnow() - r.t0) / r.dur * 60);
      st.lastRun = r;
      say(`Count stopped at ${r.stoppedAt} s with ${r.shown} counts. A count per minute needs the full 60 s: press RESET, then START.`, 'warn');
      updTarget();
      if (runResolve) { const f = runResolve; runResolve = null; f(r); }
    }
    function resetScaler() {
      if (st.counting) { say('Stop the count before resetting.', 'warn'); return; }
      showCount(0); SC.time.textContent = '0 / 60'; st.lastRun = null; updTarget();
    }
    function bindBtn(b, f) { b.addEventListener('click', () => { if (!tut.on) f(); }); b.addEventListener('keydown', e => { if (!tut.on && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); f(); } }); }
    bindBtn(SC.start, startCount); bindBtn(SC.stop, stopCount); bindBtn(SC.reset, resetScaler);
    (function fade() {
      const n = performance.now();
      if (flashT && n - flashT > 45) { SC.led.setAttribute('opacity', 0); TB.win.setAttribute('opacity', 0); flashT = 0; }
      requestAnimationFrame(fade);
    })();
    const photons = [];
    function spawnPhoton() {
      if (photons.length > 14) return;
      const y = BEAM + (Math.random() - .5) * 18, x = stackX();
      const stopAt = Math.random() > Math.exp(-MU * x) ? SLOT_X - x * PX_CM / 2 + Math.random() * x * PX_CM : null;
      photons.push({ x: HOLD_X + 10, y, stopAt, c: el('circle', { r: 2.6, cx: HOLD_X + 10, cy: y, fill: C.amber, opacity: .85 }, photonLayer), t: tnow() });
    }
    (function movePhotons() {
      const n = tnow();
      for (let i = photons.length - 1; i >= 0; i--) {
        const p = photons[i], x = HOLD_X + 10 + (n - p.t) * .5;
        if ((p.stopAt != null && x >= p.stopAt) || x >= WIN_X || !st.counting) { p.c.remove(); photons.splice(i, 1); continue; }
        p.c.setAttribute('cx', x.toFixed(1));
      }
      requestAnimationFrame(movePhotons);
    })();

    /* ---------- dragging: source with tongs, lead sheets ---------- */
    function tween(o, x, y, ms, place) {
      const x0 = o.x, y0 = o.y, t0 = tnow();
      return new Promise(res => {
        (function f() {
          let k = ms > 0 ? Math.min(1, (tnow() - t0) / ms) : 1; if (tut.on && tut.skip) k = 1;
          if (tut.on && tut.cancel) k = 1;
          const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          o.x = x0 + (x - x0) * e; o.y = y0 + (y - y0) * e; place(o);
          if (k < 1) requestAnimationFrame(f); else res();
        })();
      });
    }
    const srcPlace = () => { placeSrc(); placeTongs(); };
    function setSrcLoc(loc) {
      SRC.loc = loc;
      (loc === 'pot' ? srcPotLayer : srcTop).appendChild(SRC.g);
      updStatus();
    }
    async function moveSource(to, ms) {
      const tgt = to === 'holder' ? HOLD : POT_SRC;
      SRC.loc = 'drag'; srcTop.appendChild(SRC.g); tongsOn = true;
      await tween(SRC, SRC.x, Math.min(SRC.y, 190), ms * .35, srcPlace);
      await tween(SRC, tgt.x, Math.min(tgt.y, 190), ms * .4, srcPlace);
      await tween(SRC, tgt.x, tgt.y, ms * .25, srcPlace);
      tongsOn = false; placeTongs(); setSrcLoc(to);
    }
    let drag = null;
    function busyMsg() { say('Wait for the count to finish (or press STOP) before moving anything on the bench.', 'warn'); }
    SRC.g.addEventListener('pointerdown', e => {
      if (tut.on || drag) return;
      e.preventDefault();
      if (st.counting) { busyMsg(); return; }
      const p = svgPoint(svg, e);
      drag = { kind: 'src', from: SRC.loc, dx: SRC.x - p.x, dy: SRC.y - p.y, moved: false, id: e.pointerId };
      SRC.loc = 'drag'; srcTop.appendChild(SRC.g); tongsOn = true; srcPlace();
      svg.setPointerCapture(e.pointerId);
      say('Holding the source in the tongs, at arm\'s length. Place it in the holder, or back in its lead container.');
    });
    PLATES.forEach(pl => {
      pl.g.addEventListener('pointerdown', e => {
        if (tut.on || drag) return;
        e.preventDefault();
        if (st.counting) { busyMsg(); return; }
        const p = svgPoint(svg, e);
        drag = { kind: 'plate', pl, from: pl.loc, dx: pl.x - p.x, dy: pl.y - p.y, id: e.pointerId };
        if (pl.loc === 'stack') { st.stack = st.stack.filter(n => n !== pl.n); layoutStack(); updStatus(); }
        pl.loc = 'drag'; dragLayer.appendChild(pl.g);
        slotHi.setAttribute('opacity', 1);
        svg.setPointerCapture(e.pointerId);
      });
      pl.g.addEventListener('keydown', e => {
        if (tut.on || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        if (st.counting) { busyMsg(); return; }
        if (pl.loc === 'rack') addToStack(pl, true); else if (pl.loc === 'stack') sendHome(pl, true);
      });
    });
    SRC.g.addEventListener('keydown', e => {
      if (tut.on || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      if (st.counting) { busyMsg(); return; }
      if (SRC.loc === 'pot') moveSource('holder', 900).then(() => say('Source in the holder, facing the tube.', 'ok'));
      else if (SRC.loc === 'holder') moveSource('pot', 900).then(() => say('Source back in its lead container.', 'ok'));
    });
    svg.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const p = svgPoint(svg, e);
      if (drag.kind === 'src') { SRC.x = clamp(p.x + drag.dx, 20, 980); SRC.y = clamp(p.y + drag.dy, 70, 640); srcPlace(); }
      else { const pl = drag.pl; pl.x = clamp(p.x + drag.dx, 0, 1000 - pl.w); pl.y = clamp(p.y + drag.dy, 20, 640 - PLATE_H); placePlate(pl); }
    });
    function addToStack(pl, animate) {
      st.stack.push(pl.n); pl.loc = 'stack'; stackLayer.appendChild(pl.g);
      const o = stackSlots().find(s => s.p === pl);
      const done = () => { layoutStack(); updStatus(); };
      layoutStack(pl);
      if (animate) return tween(pl, o.x, o.y, 420, placePlate).then(done);
      pl.x = o.x; pl.y = o.y; placePlate(pl); done(); return Promise.resolve();
    }
    function sendHome(pl, animate) {
      st.stack = st.stack.filter(n => n !== pl.n); layoutStack();
      pl.loc = 'anim'; dragLayer.appendChild(pl.g);
      const h = pl.home();
      return tween(pl, h.x, h.y, animate ? 480 : 0, placePlate).then(() => { pl.loc = 'rack'; rackLayer.appendChild(pl.g); updStatus(); });
    }
    function endDrag(e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const d = drag; drag = null;
      slotHi.setAttribute('opacity', 0);
      if (d.kind === 'src') {
        const nearH = Math.hypot(SRC.x - HOLD.x, SRC.y - HOLD.y) < 75, nearP = Math.hypot(SRC.x - POT_SRC.x, SRC.y - POT_SRC.y) < 85;
        if (nearH) { tween(SRC, HOLD.x, HOLD.y, 160, srcPlace).then(() => { tongsOn = false; placeTongs(); setSrcLoc('holder'); say('Source in the holder, facing the tube at the fixed distance. Count I₀ with no absorber, then add lead sheets.', 'ok'); }); }
        else if (nearP) { tween(SRC, POT_SRC.x, POT_SRC.y, 160, srcPlace).then(() => { tongsOn = false; placeTongs(); setSrcLoc('pot'); say('Source back in its lead container: shielded.', 'ok'); }); }
        else {
          const back = d.from === 'holder' ? HOLD : POT_SRC;
          say('The source goes only into its holder or back into its own lead container. It has been returned to where it came from.', 'warn');
          tween(SRC, back.x, back.y, 420, srcPlace).then(() => { tongsOn = false; placeTongs(); setSrcLoc(d.from); });
        }
        return;
      }
      const pl = d.pl, cx = pl.x + pl.w / 2, cy = pl.y + PLATE_H / 2;
      if (cx > SLOT_X - 80 && cx < SLOT_X + 80 && cy > 140 && cy < 340) { addToStack(pl, true); say(`Sheet #${pl.n} (${pl.t.toFixed(1)} cm) is in the slot. x = ${(stackX() + pl.t * 0).toFixed(2)} cm.`); return; }
      let nearest = null, best = 1e9;
      if (cy > 380) PLATES.forEach(q => { const dd = Math.abs(SLOT_XS(q.n) - cx); if (dd < best) { best = dd; nearest = q.n; } });
      if (nearest && nearest !== pl.n && best < 34) say(`Sheet #${pl.n} belongs in slot ${pl.n}, so it goes back there.`, 'warn');
      else if (cy > 380 || d.from === 'stack') say(`Sheet #${pl.n} is back in slot ${pl.n}.`);
      else say(`Sheet #${pl.n} returns to its own slot ${pl.n}. Drop sheets into the absorber slot to add lead.`);
      sendHome(pl, true);
    }
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);

    /* ---------- observation data ---------- */
    const D = { bg: [NaN, NaN, NaN], bgAvg: NaN, i0: [NaN, NaN, NaN], i0Avg: NaN, rows: [] };
    const hist = [];
    const recMsg = $('rec-msg');
    function rsay(t, cls) { recMsg.textContent = t; recMsg.className = 'rec-msg' + (cls ? ' ' + cls : ''); }
    const mean3 = a => a.every(isFinite) ? (a[0] + a[1] + a[2]) / 3 : NaN;
    function derived() {
      const IBG = D.bgAvg, I0 = D.i0Avg - IBG;
      return { IBG, I0, rows: D.rows.map(r => { const I = r.avg - IBG, q = I0 / I; return { x: r.x, I, q, ln: (isFinite(q) && q > 0) ? Math.log(q) : NaN }; }) };
    }
    function blockFor(k) { return k === 'bg' ? { arr: D.bg, avgKey: 'bgAvg' } : k === 'i0' ? { arr: D.i0, avgKey: 'i0Avg' } : null; }
    function targetOf(run) {
      if (!run) return null;
      if (run.key === 'bg' || run.key === 'i0') { const b = blockFor(run.key), i = b.arr.findIndex(v => !isFinite(v)); return { key: run.key, i, full: i < 0 }; }
      const x = +run.key.slice(1); const ri = D.rows.findIndex(r => Math.abs(r.x - x) < 1e-6);
      if (ri < 0) return { key: run.key, row: -1, i: 0, full: D.rows.length >= 8 };
      const i = D.rows[ri].r.findIndex(v => !isFinite(v)); return { key: run.key, row: ri, i, full: i < 0 };
    }
    function updTarget() {
      const r = st.lastRun, tg = $('rec-target');
      if (!r || !r.complete || r.recorded) { tg.textContent = r && r.recorded ? 'recorded; start a new count' : 'waiting for a full count'; $('btn-rec').disabled = !(r && !r.recorded); return; }
      $('btn-rec').disabled = false;
      const t = targetOf(r);
      tg.textContent = t.full ? `${keyName(r.key)}: three readings already` : `goes to ${keyName(r.key)}, reading ${t.i + 1}`;
    }
    function record() {
      const r = st.lastRun;
      if (!r) { rsay('No finished count to record. Press START on the scaler first.', 'warn'); return false; }
      if (r.recorded) { rsay('That count is already in the table. Start a new count.', 'warn'); return false; }
      if (!r.complete) { rsay(`The count stopped at ${r.stoppedAt} s, so it is not a count per minute. Reset and count the full 60 s.`, 'warn'); return false; }
      if (r.V < V_PLATEAU) { rsay(`This count was taken at ${r.V} V, below the plateau. Raise the HV to about 500 V and count again.`, 'warn'); return false; }
      if (r.V > V_TOP) { rsay(`At ${r.V} V the tube was discharging continuously, so this is not a valid count. Turn the HV down to about 500 V.`, 'bad'); return false; }
      const t = targetOf(r);
      if (t.full) { rsay(`Three readings for ${keyName(r.key)} are already recorded. Delete one to replace it, or change the set-up.`, 'warn'); return false; }
      let filledAvg = false;
      if (r.key === 'bg' || r.key === 'i0') {
        const b = blockFor(r.key); b.arr[t.i] = r.N;
        if (b.arr.every(isFinite) && !isFinite(D[b.avgKey])) { D[b.avgKey] = mean3(b.arr); filledAvg = true; }
        hist.push({ key: r.key, i: t.i, filledAvg });
      } else {
        let ri = t.row;
        if (ri < 0) { D.rows.push({ x: r.x, r: [NaN, NaN, NaN], avg: NaN }); D.rows.sort((a, b) => a.x - b.x); ri = D.rows.findIndex(q => Math.abs(q.x - r.x) < 1e-6); }
        const row = D.rows[ri]; row.r[t.i] = r.N;
        if (row.r.every(isFinite) && !isFinite(row.avg)) { row.avg = mean3(row.r); filledAvg = true; }
        hist.push({ key: r.key, x: r.x, i: t.i, filledAvg });
      }
      r.recorded = true;
      rsay(`Recorded ${r.N} counts/min as ${keyName(r.key)}, reading ${t.i + 1}${filledAvg ? '; the average is filled in' : ''}.`, 'ok');
      renderTable(r.key);
      updTarget();
      return true;
    }
    $('btn-rec').addEventListener('click', record);
    $('btn-undo').addEventListener('click', () => {
      const h = hist.pop();
      if (!h) { rsay('Nothing to delete.'); return; }
      if (h.key === 'bg' || h.key === 'i0') { const b = blockFor(h.key); b.arr[h.i] = NaN; if (h.filledAvg) D[b.avgKey] = NaN; }
      else { const ri = D.rows.findIndex(q => Math.abs(q.x - h.x) < 1e-6); if (ri >= 0) { const row = D.rows[ri]; row.r[h.i] = NaN; if (h.filledAvg) row.avg = NaN; if (!row.r.some(isFinite) && !isFinite(row.avg)) D.rows.splice(ri, 1); } }
      rsay('Last reading deleted.');
      renderTable();
    });
    const cellMsgEl = document.createElement('p'); cellMsgEl.className = 'cell-msg'; cellMsgEl.setAttribute('aria-live', 'polite');
    $('tbl-panel').appendChild(cellMsgEl);
    function cellMsg(t) { cellMsgEl.textContent = t || ''; }
    function cellInput(k, i, val, label) {
      const inp = document.createElement('input');
      inp.className = 'cell' + (i === 'avg' ? ' avg' : ''); inp.dataset.k = k; inp.dataset.i = i; inp.inputMode = i === 'avg' ? 'decimal' : 'numeric'; inp.autocomplete = 'off';
      inp.setAttribute('aria-label', label);
      inp.value = isFinite(val) ? (i === 'avg' ? fmtAvg(val) : String(val)) : '';
      return inp;
    }
    function validateCell(inp) {
      const k = inp.dataset.k, i = inp.dataset.i, v = parseNum(inp.value);
      inp.classList.remove('flag', 'okf');
      let arr, setter;
      if (k === 'bg' || k === 'i0') { const b = blockFor(k); arr = b.arr; setter = val => { if (i === 'avg') D[b.avgKey] = val; else b.arr[+i] = val; }; }
      else { const row = D.rows[+k.slice(3)]; arr = row.r; setter = val => { if (i === 'avg') row.avg = val; else row.r[+i] = val; }; }
      if (inp.value.trim() === '') { setter(NaN); cellMsg(''); refreshDerived(); return; }
      if (!isFinite(v) || v < 0) { inp.classList.add('flag'); cellMsg('Counts are positive numbers.'); setter(NaN); refreshDerived(); return; }
      setter(v);
      if (i === 'avg') {
        const m = mean3(arr);
        if (!isFinite(m)) { inp.classList.add('flag'); cellMsg('Fill all three readings first; the average is (I₁ + I₂ + I₃) ÷ 3.'); }
        else if (Math.abs(v - m) > 0.6) { inp.classList.add('flag'); cellMsg('That average does not match the three readings. Add them and divide by 3.'); }
        else { inp.classList.add('okf'); cellMsg(''); }
      } else {
        const key = k === 'bg' || k === 'i0' ? k : 'x' + D.rows[+k.slice(3)].x.toFixed(2);
        const seen = runsLog.some(r => r.key === key && r.N === v);
        if (!Number.isInteger(v)) { inp.classList.add('flag'); cellMsg('A count is a whole number.'); }
        else if (!seen) { inp.classList.add('flag'); cellMsg(`No completed 60 s count of ${v} for ${keyName(key)}. Check the scaler display.`); }
        else { inp.classList.add('okf'); cellMsg(''); }
      }
      refreshDerived();
    }
    function refreshDerived() {
      const dv = derived();
      $('i0-val').textContent = isFinite(dv.I0) ? fmtAvg(dv.I0) : '—';
      D.rows.forEach((r, ri) => {
        const tr = document.querySelector(`#p-tbody tr[data-ri="${ri}"]`); if (!tr) return;
        const c = tr.querySelectorAll('td.calc-c'), q = dv.rows[ri];
        c[0].textContent = isFinite(q.I) ? fmtAvg(q.I) : '—';
        c[1].textContent = isFinite(q.q) ? q.q.toFixed(3) : '—';
        c[2].textContent = isFinite(q.ln) ? q.ln.toFixed(3) : '—';
      });
      updRows(); drawGraph();
    }
    function renderTable(freshKey) {
      ['bg', 'i0'].forEach(k => {
        const b = blockFor(k);
        document.querySelectorAll(`#${k}-row input.cell`).forEach(inp => { const i = inp.dataset.i; const v = i === 'avg' ? D[b.avgKey] : b.arr[+i]; inp.value = isFinite(v) ? (i === 'avg' ? fmtAvg(v) : String(v)) : ''; inp.classList.remove('flag', 'okf'); });
        if (freshKey === k) { const tr = $(k + '-row'); tr.classList.remove('fresh'); void tr.offsetWidth; tr.classList.add('fresh'); }
      });
      const tb = $('p-tbody'); tb.innerHTML = '';
      if (!D.rows.length) { const tr = document.createElement('tr'); tr.className = 'empty'; tr.innerHTML = '<td colspan="9">Rows appear here as counts with lead in the slot are recorded.</td>'; tb.appendChild(tr); }
      D.rows.forEach((r, ri) => {
        const tr = document.createElement('tr'); tr.dataset.ri = ri;
        if (freshKey === 'x' + r.x.toFixed(2)) tr.className = 'fresh';
        const td0 = document.createElement('td'); td0.textContent = ri + 1; tr.appendChild(td0);
        const td1 = document.createElement('td'); td1.textContent = r.x.toFixed(2); tr.appendChild(td1);
        [0, 1, 2, 'avg'].forEach(i => { const td = document.createElement('td'); td.appendChild(cellInput('row' + ri, i, i === 'avg' ? r.avg : r.r[i], `Row ${ri + 1} ${i === 'avg' ? 'average' : 'reading ' + (i + 1)}`)); tr.appendChild(td); });
        for (let k = 0; k < 3; k++) { const td = document.createElement('td'); td.className = 'calc-c'; tr.appendChild(td); }
        tb.appendChild(tr);
      });
      refreshDerived();
    }
    document.querySelector('.prac-lower').addEventListener('change', e => { if (e.target.classList && e.target.classList.contains('cell')) validateCell(e.target); });

    /* ---------- graph with two draggable handles ---------- */
    const gsvg = $('p-graph'), gRead = $('g-read');
    const H = { A: { x: 0.10, y: 0.30 }, B: { x: 1.00, y: 0.70 } };
    let GP = null, gN = null;
    function graphPoints() { const dv = derived(); return dv.rows.filter(r => isFinite(r.ln)).map(r => ({ x: r.x, y: r.ln })); }
    function originSlope(pts) { const sxy = pts.reduce((a, p) => a + p.x * p.y, 0), sxx = pts.reduce((a, p) => a + p.x * p.x, 0); return sxx > 0 ? sxy / sxx : NaN; }
    function drawGraph() {
      const pts = graphPoints();
      const mx = Math.max(0, ...pts.map(p => p.x)), my = Math.max(0, ...pts.map(p => p.y));
      const xmax = Math.max(1.2, Math.ceil((mx + .15) * 5) / 5), ymax = Math.max(1.6, Math.ceil((my + .25) * 5) / 5);
      gsvg.innerHTML = '';
      GP = makePlot(gsvg, { W: 720, H: 460, xmax, ymax });
      gsvg.dataset.xmax = xmax; gsvg.dataset.ymax = ymax;
      H.A.x = clamp(H.A.x, 0, xmax); H.B.x = clamp(H.B.x, 0, xmax); H.A.y = clamp(H.A.y, 0, ymax); H.B.y = clamp(H.B.y, 0, ymax);
      GP.points(pts, gN);
      if (!pts.length) txt(GP.topG, GP.X(xmax / 2), GP.Y(ymax / 2), 'points appear as ln(I₀/I) values are worked out', { 'text-anchor': 'middle', 'font-family': F_BODY, 'font-style': 'italic', 'font-size': 16, fill: C.muted });
      GP.line(H.A, H.B, true);
      ['A', 'B'].forEach((k, i) => {
        const h = el('g', { class: 'gh', tabindex: 0, role: 'slider', 'aria-label': `Line point ${i + 1}` }, GP.topG);
        el('circle', { cx: GP.X(H[k].x), cy: GP.Y(H[k].y), r: 16, fill: 'transparent' }, h);
        el('circle', { cx: GP.X(H[k].x), cy: GP.Y(H[k].y), r: 9, fill: '#fff', stroke: C.amber, 'stroke-width': 3 }, h);
        el('circle', { cx: GP.X(H[k].x), cy: GP.Y(H[k].y), r: 3, fill: C.amber2 }, h);
        txt(GP.topG, GP.X(H[k].x) + (i ? -14 : 14), GP.Y(H[k].y) - 14, i ? '2' : '1', { 'text-anchor': i ? 'end' : 'start', 'font-family': F_HEAD, 'font-weight': 700, 'font-size': 14, fill: C.amber2 });
        h.addEventListener('pointerdown', e => {
          if (tut.on) return;
          e.preventDefault(); gsvg.setPointerCapture(e.pointerId);
          gDrag = { k, id: e.pointerId };
        });
        h.addEventListener('keydown', e => {
          if (tut.on) return;
          const d = { ArrowUp: [0, .01], ArrowDown: [0, -.01], ArrowLeft: [-.01, 0], ArrowRight: [.01, 0] }[e.key];
          if (!d) return; e.preventDefault();
          H[k].x = +clamp(H[k].x + d[0], 0, GP.xmax).toFixed(2); H[k].y = +clamp(H[k].y + d[1], 0, GP.ymax).toFixed(2);
          drawGraph(); const n = gsvg.querySelectorAll('.gh')[i]; if (n) n.focus();
        });
      });
      const dx = H.B.x - H.A.x, dy = H.B.y - H.A.y;
      gRead.innerHTML = `point 1 (x₁, y₁) = (<b>${H.A.x.toFixed(2)}</b>, <b>${H.A.y.toFixed(2)}</b>) · point 2 (x₂, y₂) = (<b>${H.B.x.toFixed(2)}</b>, <b>${H.B.y.toFixed(2)}</b>)<br>slope = ${dy.toFixed(2)} ÷ ${dx.toFixed(2)}` + (Math.abs(dx) > 1e-6 ? ` = <b>${(dy / dx).toFixed(2)} cm<sup>−1</sup></b>` : '');
    }
    let gDrag = null;
    gsvg.addEventListener('pointermove', e => {
      if (!gDrag || e.pointerId !== gDrag.id) return;
      const p = svgPoint(gsvg, e);
      H[gDrag.k].x = +clamp(GP.ix(p.x), 0, GP.xmax).toFixed(2); H[gDrag.k].y = +clamp(GP.iy(p.y), 0, GP.ymax).toFixed(2);
      drawGraph();
    });
    const gEnd = e => { if (gDrag && e.pointerId === gDrag.id) gDrag = null; };
    gsvg.addEventListener('pointerup', gEnd); gsvg.addEventListener('pointercancel', gEnd);
    $('g-reset').addEventListener('click', () => { H.A = { x: 0.10, y: 0.30 }; H.B = { x: 1.00, y: 0.70 }; drawGraph(); });

    /* ---------- calculation and check ---------- */
    const inBg = $('in-bg'), inI0 = $('in-i0'), inLn = $('in-ln'), inMu = $('in-mu'), inHvl = $('in-hvl'), selRow = $('in-row'), chk = $('check-msg');
    const calcIns = [inBg, inI0, inLn, inMu, inHvl];
    function updRows() {
      const dv = derived(), keep = selRow.value;
      selRow.innerHTML = '';
      dv.rows.forEach((r, i) => { if (!isFinite(r.ln)) return; const o = document.createElement('option'); o.value = String(i); o.textContent = `${i + 1} (x = ${r.x.toFixed(2)} cm)`; selRow.appendChild(o); });
      if (!selRow.options.length) { const o = document.createElement('option'); o.value = ''; o.textContent = '—'; selRow.appendChild(o); }
      if ([...selRow.options].some(o => o.value === keep)) selRow.value = keep;
    }
    function mark(inp, ok) { inp.classList.toggle('okf', !!ok); inp.classList.toggle('flag', !ok); }
    function check() {
      const dv = derived(), notes = [], good = [];
      calcIns.forEach(i => i.classList.remove('flag', 'okf'));
      const vBg = parseNum(inBg.value), vI0 = parseNum(inI0.value), vLn = parseNum(inLn.value), vMu = parseNum(inMu.value), vH = parseNum(inHvl.value);
      const bgM = mean3(D.bg);
      // background
      if (!isFinite(bgM)) notes.push('Record three background counts first (source in its container).');
      else if (!isFinite(vBg)) { notes.push('Enter the background average I_BG.'); mark(inBg, false); }
      else if (Math.abs(vBg - bgM) <= 0.6) { mark(inBg, true); good.push('I_BG'); }
      else { mark(inBg, false); notes.push('I_BG is the mean of the three background readings: add them and divide by 3.'); }
      // I0
      const i0avM = mean3(D.i0), i0ref = i0avM - (isFinite(vBg) ? vBg : bgM);
      if (!isFinite(i0avM)) notes.push('Record three counts with the source in the holder and no absorber.');
      else if (!isFinite(vI0)) { notes.push('Enter I₀.'); mark(inI0, false); }
      else if (Math.abs(vI0 - i0ref) <= 1) { mark(inI0, true); good.push('I₀'); }
      else if (Math.abs(vI0 - i0avM) <= 1) { mark(inI0, false); notes.push('That is I₀av. The background has not been subtracted: I₀ = I₀av − I_BG.'); }
      else if (Math.abs(vI0 - (i0avM + bgM)) <= 1) { mark(inI0, false); notes.push('The background is added instead of subtracted.'); }
      else { mark(inI0, false); notes.push('Check I₀: the average with no absorber minus the background.'); }
      // ln for a row
      const ri = selRow.value === '' ? -1 : +selRow.value, row = dv.rows[ri];
      if (!row || !isFinite(row.ln)) notes.push('Record a row with lead in the slot (three counts and the average) to work out ln(I₀/I).');
      else if (!isFinite(vLn)) { notes.push('Enter ln(I₀/I) for the chosen row.'); mark(inLn, false); }
      else {
        const lnRef = row.ln, rawAv = D.rows[ri].avg, lnNoBg = Math.log((D.i0Avg) / rawAv);
        if (Math.abs(vLn - lnRef) <= 0.006) { mark(inLn, true); good.push('ln(I₀/I)'); }
        else if (Math.abs(vLn + lnRef) <= 0.006) { mark(inLn, false); notes.push('The logarithm is negative: the ratio is upside down. Use I₀ ÷ I, the larger count on top.'); }
        else if (Math.abs(vLn - lnRef / Math.LN10) <= 0.004) { mark(inLn, false); notes.push('That looks like log₁₀. Use the natural logarithm ln, which is 2.303 times larger.'); }
        else if (Math.abs(vLn - lnNoBg) <= 0.003) { mark(inLn, false); notes.push('The background seems to be left in. Use I₀ = I₀av − I_BG and I = I_av − I_BG.'); }
        else { mark(inLn, false); notes.push(`Check ln(I₀/I) for row ${ri + 1}: divide I₀ by I, then take ln.`); }
      }
      // slope
      const pts = graphPoints(), ref = originSlope(pts);
      if (pts.length < 3) notes.push('Plot at least three rows to draw a reliable line.');
      else if (!isFinite(vMu)) { notes.push('Enter the slope μ from two points on the line.'); mark(inMu, false); }
      else {
        if (near(vMu, ref, .10)) { mark(inMu, true); good.push('μ'); }
        else if (vMu < 0) { mark(inMu, false); notes.push('The slope is negative. ln(I₀/I) rises with x, so the ratio or the order of the points is upside down.'); }
        else if (near(1 / vMu, ref, .10)) { mark(inMu, false); notes.push('The slope is upside down: it is rise over run, (y₂ − y₁) ÷ (x₂ − x₁), with ln(I₀/I) on the y-axis.'); }
        else if (near(vMu * Math.LN10, ref, .10)) { mark(inMu, false); notes.push('The slope is about 2.303 times too small, as if log₁₀ were used. Use ln.'); }
        else { mark(inMu, false); notes.push('The slope does not follow the points. Move the two handles onto a line that passes close to all the points and near the origin, and use points far apart.'); }
        const lineM = (H.B.y - H.A.y) / (H.B.x - H.A.x);
        if (isFinite(lineM) && !near(lineM, ref, .12)) notes.push('The line on the graph does not yet fit the points well; drag the handles so the points scatter evenly about it.');
      }
      // HVL
      const muUse = isFinite(vMu) && vMu > 0 ? vMu : ref;
      if (!isFinite(vH)) { if (isFinite(ref)) { notes.push('Enter the half-value layer.'); mark(inHvl, false); } }
      else if (isFinite(muUse) && near(vH, Math.LN2 / muUse, .03)) { mark(inHvl, true); good.push('HVL'); }
      else if (isFinite(muUse) && near(vH, muUse / Math.LN2, .03)) { mark(inHvl, false); notes.push('HVL is upside down: HVL = 0.693 ÷ μ, in cm.'); }
      else if (isFinite(muUse) && near(vH, muUse * Math.LN2, .03)) { mark(inHvl, false); notes.push('Divide 0.693 by μ rather than multiplying.'); }
      else if (isFinite(muUse) && near(vH, Math.log10(2) / muUse, .03)) { mark(inHvl, false); notes.push('Use ln 2 = 0.693, not log₁₀ 2 = 0.301.'); }
      else { mark(inHvl, false); notes.push('Check the half-value layer: HVL = 0.693 ÷ μ.'); }
      if (!notes.length) {
        const dev = Math.abs(vMu - MU) / MU;
        chk.className = 'check-msg ok';
        chk.innerHTML = `All five steps check out. μ ≈ <b>${vMu.toFixed(2)} cm<sup>−1</sup></b> and HVL ≈ <b>${vH.toFixed(2)} cm</b>. ` + (dev <= .1 ? 'This agrees, within the random scatter of the counts, with the value for 662 keV gamma rays in lead used in this simulation.' : 'Random scatter in the counts moves the result a little from run to run; more or longer counts reduce it.');
      } else {
        chk.className = 'check-msg nudge';
        chk.innerHTML = (good.length ? `Correct so far: ${good.join(', ')}.` : 'A few things to look at:') + '<ul>' + notes.map(n => `<li>${n}</li>`).join('') + '</ul>';
      }
    }
    $('btn-check').addEventListener('click', check);
    calcIns.forEach(i => i.addEventListener('input', () => i.classList.remove('flag', 'okf')));

    /* ---------- start over ---------- */
    function resetAll() {
      if (st.counting) { st.counting = false; if (runResolve) { const f = runResolve; runResolve = null; f(null); } }
      drag = null; gDrag = null; slotHi.setAttribute('opacity', 0);
      st.run = null; st.lastRun = null; runsLog.length = 0;
      D.bg = [NaN, NaN, NaN]; D.bgAvg = NaN; D.i0 = [NaN, NaN, NaN]; D.i0Avg = NaN; D.rows = []; hist.length = 0;
      st.stack = [];
      PLATES.forEach(p => { p.loc = 'rack'; rackLayer.appendChild(p.g); const h = p.home(); p.x = h.x; p.y = h.y; placePlate(p); });
      SRC.x = POT_SRC.x; SRC.y = POT_SRC.y; tongsOn = false; setSrcLoc('pot'); placeSrc(); placeTongs();
      st.region = null; setV(0, true);
      showCount(0); SC.time.textContent = '0 / 60';
      H.A = { x: 0.10, y: 0.30 }; H.B = { x: 1.00, y: 0.70 }; gN = null;
      calcIns.forEach(i => { i.value = ''; i.classList.remove('flag', 'okf'); });
      ['w-bg', 'w-i0', 'w-ln', 'w-mu', 'w-hvl'].forEach(k => { $(k).textContent = ''; });
      chk.className = 'check-msg'; chk.textContent = ''; rsay(''); cellMsg('');
      hiSvg(null);
      renderTable(); updStatus();
      say(DEFAULT_MSG);
    }
    $('btn-reset').addEventListener('click', resetAll);

    /* ---------- tutorial ---------- */
    function hiSvg(kind) {
      if (!kind) { hiRing.setAttribute('opacity', 0); return; }
      const box = {
        knob: [SC.kx - 52, SC.ky - 52, 104, 104], start: [566, 584, 94, 42], pot: [26, 186, 128, 160], holder: [HOLD_X - 42, BEAM - 84, 84, 132],
        slot: [SLOT_X - 64, 146, 128, 178], rack: [22, 400, 500, 252], scaler: [544, 398, 442, 250]
      }[kind];
      hiRing.setAttribute('x', box[0]); hiRing.setAttribute('y', box[1]); hiRing.setAttribute('width', box[2]); hiRing.setAttribute('height', box[3]);
      hiRing.setAttribute('opacity', 1);
    }
    const btnPause = $('tut-pause'), selSpeed = $('tut-speed');
    let pausedAnims = [];
    function setPaused(p) {
      tcSet({ paused: p });
      btnPause.classList.toggle('paused', p); btnPause.setAttribute('aria-pressed', p ? 'true' : 'false');
      btnPause.querySelector('.tl').textContent = p ? 'Resume' : 'Pause';
      btnPause.title = p ? 'Resume (Space)' : 'Pause (Space)';
      document.body.classList.toggle('tut-paused', p);
      if (p) { pausedAnims = document.getAnimations().filter(a => a.playState === 'running'); pausedAnims.forEach(a => a.pause()); }
      else { pausedAnims.forEach(a => { try { a.play(); } catch (_) { /* finished */ } }); pausedAnims = []; }
    }
    function resetPlayback() { setPaused(false); tcSet({ speed: 1 }); selSpeed.value = '1'; }
    btnPause.addEventListener('click', () => { if (tut.on) setPaused(!TC.paused); });
    selSpeed.addEventListener('change', () => { tcSet({ speed: +selSpeed.value || 1 }); });
    document.addEventListener('keydown', e => {
      if (!tut.on || e.code !== 'Space' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.closest && e.target.closest('input, select, textarea, button, a, [role="button"], [role="slider"], [tabindex]')) return;
      e.preventDefault(); setPaused(!TC.paused);
    });
    function tScroll(y) {
      return new Promise(res => {
        const y0 = window.scrollY, t0 = tnow(), ms = Math.min(900, 250 + Math.abs(y - y0) * .5);
        (function f() {
          if (tut.cancel) return res();
          let k = Math.min(1, (tnow() - t0) / ms); if (tut.skip) k = 1;
          const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          window.scrollTo({ top: y0 + (y - y0) * e, behavior: 'instant' });
          if (k < 1) requestAnimationFrame(f); else res();
        })();
      });
    }
    const bar = $('tut-bar'), tTitle = $('tut-title'), tText = $('tut-text'), tF = $('tut-f'), btnTut = $('tut-start');
    const STOP = new Error('tutorial-stop');
    function wait(ms) {
      return new Promise((res, rej) => {
        const t0 = tnow();
        (function chkW() { if (tut.cancel) return rej(STOP); if (tut.skip || tnow() - t0 >= ms) return res(); setTimeout(chkW, 25); })();
      });
    }
    function step(title, text, f) { tut.skip = false; tTitle.textContent = title; tText.textContent = text; tF.innerHTML = f || ''; }
    let hiEls = [];
    function hi(...els) { hiEls.forEach(e => e.classList.remove('tut-hi')); hiEls = els.filter(Boolean); hiEls.forEach(e => e.classList.add('tut-hi')); }
    async function scrollToEl(elm, top) {
      const r = elm.getBoundingClientRect();
      const y = top ? window.scrollY + r.top - 70 : window.scrollY + r.top - Math.max(60, (window.innerHeight - Math.min(r.height, window.innerHeight - 220)) / 2 - 80);
      await tScroll(Math.max(0, y));
      await wait(500);
    }
    async function typeInto(inp, value, perChar) {
      inp.focus({ preventScroll: true });
      inp.value = '';
      for (const ch of String(value)) { inp.value += ch; inp.dispatchEvent(new Event('input', { bubbles: true })); await wait(perChar || 90); }
      inp.blur();
    }
    async function ramp(v0, v1, ms) {
      const t0 = tnow();
      for (;;) {
        if (tut.cancel) throw STOP;
        let k = Math.min(1, (tnow() - t0) / ms); if (tut.skip) k = 1;
        setV(v0 + (v1 - v0) * k);
        if (k >= 1) break;
        await sleep(30);
      }
    }
    function waitRun(pr) {
      return new Promise((res, rej) => {
        let done = false;
        pr.then(r => { done = true; res(r); });
        (function c() {
          if (done) return;
          if (tut.cancel) { if (st.counting) { st.counting = false; runResolve = null; } return rej(STOP); }
          if (tut.skip && st.counting && st.run) st.run.dur = 1;
          setTimeout(c, 25);
        })();
      });
    }
    async function countAndRecord(title, text) {
      step(title, text, '');
      hiSvg('start'); await wait(450);
      const pr = startCount(); hiSvg('scaler');
      const r = await waitRun(pr);
      tF.innerHTML = `${r.N} counts in 60 s`;
      await wait(350);
      hi($('btn-rec')); record(); await wait(500); hi();
      return r;
    }
    async function tutorial() {
      tut.on = true; tut.cancel = false; document.body.classList.add('tut-on'); bar.hidden = false; btnTut.disabled = true;
      try {
        resetAll();
        st.rng = mulberry32(20261011);
        st.mode = 30; selMode.value = '30'; updStatus();
        const rig = $('rig-frame'), tbl = $('tbl-panel'), graph = $('graph-panel'), calc = $('calc-panel');
        await scrollToEl(rig);
        step('Raise the high voltage', 'The HV knob is turned up slowly. Below about 380 V the tube does not count; the rate rises, then levels off on the plateau.', '');
        hiSvg('knob'); await wait(600);
        await ramp(0, 500, 3400);
        step('Operating voltage', 'About 500 V sits in the middle of the plateau, where a small drift in voltage hardly changes the count rate.', 'HV = 500 V');
        await wait(1800);
        step('Compressed counting time', 'Each count is a full 60 s on the scaler clock, run 30 times faster here. The display still gives counts per minute.', 'count time: 60 s, fast ×30');
        hi($('c-mode')); await wait(2000); hi();
        for (let k = 1; k <= 3; k++) await countAndRecord(`Background, count ${k} of 3`, k === 1 ? 'The source stays shut in its lead container, so the tube counts only the background.' : 'Another one-minute background count. Random decay makes each count a little different.');
        await scrollToEl(tbl, true); hi($('bg-block'));
        const bgM = mean3(D.bg);
        step('Average background', 'The three background counts are averaged.', `I<sub>BG</sub> = (${D.bg.join(' + ')}) ÷ 3 = ${fmtAvg(bgM)} counts/min`);
        await wait(2800); hi();
        await scrollToEl(rig);
        step('Source to the holder', 'With the tongs, at arm\'s length and pointed away from people, the source goes from its container into the holder, facing the tube.', '');
        hiSvg('pot'); await wait(700); hiSvg(null);
        await moveSource('holder', 2600);
        hiSvg('holder'); await wait(900);
        for (let k = 1; k <= 3; k++) await countAndRecord(`No absorber, count ${k} of 3`, k === 1 ? 'Nothing in the absorber slot: this gives I₀av.' : 'Repeat the count with no absorber.');
        await scrollToEl(tbl, true); hi($('i0-block'));
        const i0M = mean3(D.i0);
        step('I₀ without background', 'Average the three counts, then subtract the background.', `I<sub>0</sub> = ${fmtAvg(i0M)} − ${fmtAvg(bgM)} = ${fmtAvg(i0M - bgM)} counts/min`);
        await wait(3000); hi();
        const order = [2, 3, 4, 5, 6];
        for (let j = 0; j < order.length; j++) {
          await scrollToEl(rig);
          const pl = PLATES[order[j] - 1];
          step('Add lead', j === 0 ? `Sheet #${pl.n}, 0.2 cm thick, goes into the slot midway between source and tube.` : `Sheet #${pl.n} (0.2 cm) is added to the stack.`, `x = ${(stackX() + pl.t).toFixed(2)} cm`);
          hiSvg('rack'); await wait(600); hiSvg('slot');
          pl.loc = 'anim'; dragLayer.appendChild(pl.g);
          await tween(pl, pl.x, 150, 500, placePlate);
          await addToStack(pl, true);
          await wait(500);
          const x = stackX();
          for (let k = 1; k <= 3; k++) await countAndRecord(`x = ${x.toFixed(2)} cm, count ${k} of 3`, k === 1 ? 'Three one-minute counts with this thickness of lead.' : 'Repeat the count.');
          await scrollToEl(tbl, true);
          const ri = D.rows.findIndex(r => Math.abs(r.x - x) < 1e-6), row = D.rows[ri], dv = derived().rows[ri];
          const tr = document.querySelector(`#p-tbody tr[data-ri="${ri}"]`);
          if (tr) { hi(tr); tr.querySelectorAll('td.calc-c').forEach(td => td.classList.add('hl')); }
          step(`Row ${ri + 1}: I and ln(I₀/I)`, 'The average has the background removed, then the ratio and its natural logarithm are worked out.', `I = ${fmtAvg(row.avg)} − ${fmtAvg(bgM)} = ${fmtAvg(dv.I)} · ln(${fmtAvg(i0M - bgM)} ÷ ${fmtAvg(dv.I)}) = ln(${dv.q.toFixed(3)}) = ${dv.ln.toFixed(3)}`);
          await wait(j === 0 ? 3400 : 2200);
          if (tr) tr.querySelectorAll('td.calc-c').forEach(td => td.classList.remove('hl'));
          hi();
        }
        await scrollToEl(rig);
        step('Source back in its container', 'Counting is done, so the source returns to its lead container straight away.', '');
        await moveSource('pot', 2200); await wait(500);
        await scrollToEl(graph, true); hi(gsvg);
        step('Plot the graph', 'ln(I₀/I) goes on the y-axis and x on the x-axis, one point per row.', '');
        for (let n = 1; n <= D.rows.length; n++) { gN = n; drawGraph(); await wait(650); }
        gN = null; drawGraph();
        const pts = graphPoints(), m = originSlope(pts), xs = Math.max(...pts.map(p => p.x));
        const A1 = { x: 0.10, y: +(0.10 * m).toFixed(2) }, B1 = { x: +xs.toFixed(2), y: +(xs * m).toFixed(2) };
        step('Best-fit line', 'A straight line through the origin region, with the points scattered evenly about it. Two points far apart on the line give the slope.', '');
        const A0 = { x: H.A.x, y: H.A.y }, B0 = { x: H.B.x, y: H.B.y }, t0 = tnow();
        for (;;) {
          if (tut.cancel) throw STOP;
          let k = Math.min(1, (tnow() - t0) / 1800); if (tut.skip) k = 1;
          const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          H.A.x = +(A0.x + (A1.x - A0.x) * e).toFixed(2); H.A.y = +(A0.y + (A1.y - A0.y) * e).toFixed(2);
          H.B.x = +(B0.x + (B1.x - B0.x) * e).toFixed(2); H.B.y = +(B0.y + (B1.y - B0.y) * e).toFixed(2);
          drawGraph();
          if (k >= 1) break;
          await sleep(30);
        }
        const mu = +((H.B.y - H.A.y) / (H.B.x - H.A.x)).toFixed(2), hvl = +(0.693 / mu).toFixed(2);
        tF.innerHTML = `slope = (${H.B.y.toFixed(2)} − ${H.A.y.toFixed(2)}) ÷ (${H.B.x.toFixed(2)} − ${H.A.x.toFixed(2)}) = ${mu.toFixed(2)} cm<sup>−1</sup>`;
        hi($('g-read')); await wait(3000); hi();
        await scrollToEl(calc, true);
        step('Background', 'Mean of the three background counts.', `I<sub>BG</sub> = ${fmtAvg(bgM)} counts/min`);
        hi($('cr-bg')); $('w-bg').textContent = `= (${D.bg.join(' + ')}) ÷ 3 = ${fmtAvg(bgM)}`;
        await typeInto(inBg, fmtAvg(bgM)); await wait(800);
        step('I₀', 'The no-absorber average minus the background.', `I<sub>0</sub> = ${fmtAvg(i0M)} − ${fmtAvg(bgM)} = ${fmtAvg(i0M - bgM)}`);
        hi($('cr-i0')); $('w-i0').textContent = `= ${fmtAvg(i0M)} − ${fmtAvg(bgM)} = ${fmtAvg(i0M - bgM)}`;
        await typeInto(inI0, fmtAvg(i0M - bgM)); await wait(800);
        const dvr = derived().rows, r3 = Math.min(2, dvr.length - 1);
        selRow.value = String(r3);
        step('ln(I₀/I) for one row', `Row ${r3 + 1}, x = ${dvr[r3].x.toFixed(2)} cm: natural logarithm of the ratio.`, `ln(${fmtAvg(i0M - bgM)} ÷ ${fmtAvg(dvr[r3].I)}) = ln(${dvr[r3].q.toFixed(3)}) = ${dvr[r3].ln.toFixed(3)}`);
        hi($('cr-ln')); $('w-ln').textContent = `= ln(${fmtAvg(i0M - bgM)} ÷ ${fmtAvg(dvr[r3].I)}) = ${dvr[r3].ln.toFixed(3)}`;
        await typeInto(inLn, dvr[r3].ln.toFixed(3)); await wait(800);
        step('Slope μ', 'Rise over run between the two points on the line.', `μ = (${H.B.y.toFixed(2)} − ${H.A.y.toFixed(2)}) ÷ (${H.B.x.toFixed(2)} − ${H.A.x.toFixed(2)}) = ${mu.toFixed(2)} cm<sup>−1</sup>`);
        hi($('cr-mu')); $('w-mu').textContent = `= (${H.B.y.toFixed(2)} − ${H.A.y.toFixed(2)}) ÷ (${H.B.x.toFixed(2)} − ${H.A.x.toFixed(2)}) = ${mu.toFixed(2)}`;
        await typeInto(inMu, mu.toFixed(2)); await wait(800);
        step('Half-value layer', 'HVL = ln 2 ÷ μ.', `HVL = 0.693 ÷ ${mu.toFixed(2)} = ${hvl.toFixed(2)} cm`);
        hi($('cr-hvl')); $('w-hvl').textContent = `= 0.693 ÷ ${mu.toFixed(2)} = ${hvl.toFixed(2)}`;
        await typeInto(inHvl, hvl.toFixed(2)); await wait(800);
        hi($('btn-check')); await wait(600); check(); hi(chk);
        step('Done', `μ ≈ ${mu.toFixed(2)} cm⁻¹ and HVL ≈ ${hvl.toFixed(2)} cm. Start over to take the readings by hand.`, '');
        await wait(4500);
      } catch (e) {
        if (e !== STOP) throw e;
      } finally {
        if (st.counting) { st.counting = false; runResolve = null; }
        tut.on = false; tut.skip = false; resetPlayback(); hi(); hiSvg(null); st.rng = Math.random; gN = null;
        if (SRC.loc === 'drag') { tongsOn = false; SRC.x = POT_SRC.x; SRC.y = POT_SRC.y; placeSrc(); placeTongs(); setSrcLoc('pot'); }
        PLATES.forEach(p => { if (p.loc === 'anim') { p.loc = 'rack'; rackLayer.appendChild(p.g); const h = p.home(); p.x = h.x; p.y = h.y; placePlate(p); } });
        drawGraph(); updStatus();
        document.body.classList.remove('tut-on'); bar.hidden = true; btnTut.disabled = false;
      }
    }
    btnTut.addEventListener('click', () => { if (!tut.on) tutorial(); });
    $('tut-stop').addEventListener('click', () => { tut.cancel = true; });
    $('tut-skip').addEventListener('click', () => { tut.skip = true; });

    PLATES.forEach(placePlate); placeSrc(); placeTongs();
    resetAll();
  })();

  /* =====================================================================
     13. OPTIONAL EXTRAS: opens upward, closes ~500 ms after the pointer leaves
     ===================================================================== */
  (function extras() {
    const box = $('extras'), btn = $('extras-toggle');
    let t = null, openedAt = 0;
    const open = () => { clearTimeout(t); if (!box.classList.contains('open')) openedAt = Date.now(); box.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); };
    const close = () => { clearTimeout(t); box.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); };
    const later = () => { clearTimeout(t); t = setTimeout(close, 500); };
    box.addEventListener('mouseenter', open);
    box.addEventListener('mouseleave', later);
    btn.addEventListener('click', () => {
      if (!box.classList.contains('open')) open();
      else if (Date.now() - openedAt > 350) close();
    });
    box.addEventListener('focusin', open);
    box.addEventListener('focusout', e => { if (!box.contains(e.relatedTarget)) later(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  })();

  goTo(fromHash(), false);
})();
