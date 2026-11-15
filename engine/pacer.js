// Frame pacing on requestAnimationFrame: a frame-rate cap (30 / 60 / 90 / 120 / unlimited) that keeps frames even, plus
// the visibility rules (stop drawing while hidden, an optional lower cap while the window is unfocused).
//
// How it paces: every rAF tick is a candidate; a tick draws only when at least one cap interval (minus a little slack for
// rAF jitter) has passed since the last drawn frame. The "last" time advances by whole intervals, so the average rate is
// exact and frames stay on vsync. A cap that does not divide the display's refresh rate would alternate 1 and 2 vsyncs
// (uneven), so the cap snaps to the nearest whole divisor of the refresh rate (90 on a 144 Hz monitor runs every 2nd
// vsync, 72 fps; capLabel() reports "~72"). A cap at or above the refresh rate draws on every tick.
//
// Pure module: no three, no DOM at import time. Every clock / rAF / document hook can be injected (tests use a fake clock).
//
//   const pacer = createPacer({ cap: 60, onFrame: (now, dtMs, info) => engine.frame() });
//   pacer.start();  pacer.setCap(30);  pacer.stats();  pacer.stop();

export const FPS_CAPS = Object.freeze([30, 60, 90, 120, 0]); // 0 = unlimited (no skipping; uncapped needs vsync off)
// common panel / monitor rates; a measured rate within 4% snaps to one of these
export const COMMON_HZ = Object.freeze([24, 30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 160, 165, 170, 175, 180, 200, 240, 280, 300, 360, 480, 500]);

// normalise a saved / UI value to a supported cap: 30 | 60 | 90 | 120 | 0 (unlimited); anything else falls back to `fallback`
export function normalizeCap(v, fallback = 60) {
  const n = +v;
  if (v === 'unlimited' || v === Infinity || n === 0) return 0;
  return FPS_CAPS.includes(n) ? n : fallback;
}

// snap a measured refresh rate (Hz) to a common panel rate when it is within 4%
export function snapHz(hz) {
  if (!(hz > 0) || !isFinite(hz)) return 0;
  let best = 0, bd = Infinity;
  for (const c of COMMON_HZ) { const d = Math.abs(hz - c) / c; if (d < bd) { bd = d; best = c; } }
  return bd <= 0.04 ? best : Math.round(hz);
}

// the rate a cap really runs at on a `hz` display: hz / round(hz / cap), at most hz; 0 (unlimited) or an unknown hz -> the cap
export function effectiveCap(cap, hz) {
  if (!cap) return hz > 0 ? hz : 0; // unlimited: as fast as rAF fires
  if (!(hz > 0)) return cap;
  if (cap >= hz - 0.5) return hz;
  const div = Math.max(1, Math.round(hz / cap));
  return hz / div;
}

// what the options should show for a cap on this display: "60", "~72" (snapped), "Unlimited"
export function capLabel(cap, hz) {
  if (!cap) return 'Unlimited';
  const e = effectiveCap(cap, hz);
  return Math.abs(e - cap) < 0.5 ? String(cap) : '~' + Math.round(e);
}

const realNow = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

/**
 * @param {object} o
 * @param {number} [o.cap=60]          30 | 60 | 90 | 120 | 0 (unlimited)
 * @param {(now:number, dtMs:number, info:object)=>void} [o.onFrame]  called on every drawn frame; dtMs = time since the last drawn frame
 * @param {number} [o.blurCap=0]       cap while the window is unfocused (desktop: 30); 0 = no change. Never above `cap`.
 * @param {boolean} [o.pauseHidden=true] stop the rAF loop while hidden (resumes on visibilitychange / visibilityChanged())
 * @param {()=>boolean} [o.isHidden]  the hidden test (default document.hidden)
 * @param {number} [o.refreshHz=0]     a known refresh rate (Android plugin / Electron screen); 0 = measure it from rAF
 * @param {number} [o.slackMs=1.5]     how early a tick may come and still draw (clamped to 40% of a vsync interval)
 * @param {()=>void} [o.onResume]      called when drawing resumes after being hidden (reset the frame timer there)
 * @param {(state:{hidden:boolean, focused:boolean})=>void} [o.onVisibility] called when hidden / focus changes
 * injection for tests: o.now, o.raf, o.caf, o.doc (document-like: hidden, hasFocus(), addEventListener), o.win (blur/focus events)
 */
export function createPacer(o = {}) {
  const now = o.now || realNow;
  const raf = o.raf || ((f) => globalThis.requestAnimationFrame(f));
  const caf = o.caf || ((id) => globalThis.cancelAnimationFrame?.(id));
  const doc = o.doc !== undefined ? o.doc : globalThis.document;
  const win = o.win !== undefined ? o.win : (typeof window !== 'undefined' ? window : null);
  const pauseHidden = o.pauseHidden !== false;
  // hidden test: document.hidden by default. Electron with backgroundThrottling:false always reports "visible", so the
  // desktop passes its own (minimised state pushed from the main process) and calls visibilityChanged()
  const isHidden = o.isHidden || (() => !!doc?.hidden);
  let onFrame = o.onFrame || null;
  let cap = normalizeCap(o.cap ?? 60);
  let blurCap = normalizeCap(o.blurCap || 0, 0);
  let slack = o.slackMs ?? 1.5;
  let knownHz = o.refreshHz > 0 ? o.refreshHz : 0;

  let running = false, rafId = 0, last = -1, lastTick = -1, prevWork = 0, focused = true;
  // refresh estimation: raw rAF tick intervals (drawn or skipped), a low percentile = the vsync interval even while the
  // game itself is too slow to make every vsync
  const RING = 120; const ring = new Float64Array(RING); let ringN = 0, ringI = 0, sinceEst = 0, estHz = 0;
  // stats over the last second of drawn frames
  const drawn = []; let dHead = 0, ticks = 0, skipped = 0, draws = 0, misses = 0;

  const hz = () => knownHz || estHz;
  const activeCap = () => {
    let c = cap;
    if (!focused && blurCap) c = c ? Math.min(c, blurCap) : blurCap;
    return c;
  };
  // the interval between drawn frames (ms); 0 = draw every tick
  const interval = () => {
    const c = activeCap(), h = hz();
    if (!c) return 0;
    const e = effectiveCap(c, h);
    if (h > 0 && e >= h - 0.5) return 0;
    return 1000 / e;
  };
  const slackMs = () => { const h = hz(); return h > 0 ? Math.min(slack, 400 / h) : slack; };

  function estimate() {
    if (ringN < 20) return;
    const a = Array.from(ring.subarray(0, ringN)).sort((x, y) => x - y);
    const p10 = a[Math.floor(a.length * 0.1)];
    if (!(p10 > 0.5)) return;
    // the median of the cluster around the fast end: rAF jitter spreads single intervals both ways
    const c = a.filter((x) => x >= p10 * 0.5 && x <= p10 * 1.5);
    const h = snapHz(1000 / c[c.length >> 1]);
    // only move on a real change (>5%), so the snapped cap never flaps
    if (!estHz || Math.abs(h - estHz) / estHz > 0.05) estHz = h;
  }

  function tick(t) {
    if (!running) return;
    rafId = 0;
    if (pauseHidden && isHidden()) { running = false; return; } // resumed by visibilitychange
    rafId = raf(tick);
    t = typeof t === 'number' && t > 0 ? t : now();
    ticks++;
    if (lastTick >= 0) {
      const d = t - lastTick;
      // only intervals the display set count toward the refresh estimate: after a long frame the next tick waits for the
      // page, not the panel (a game drawing 30 fps on a 60 Hz panel must not read as a 30 Hz panel)
      if (d > 0 && d < 250 && prevWork < d * 0.5) { ring[ringI] = d; ringI = (ringI + 1) % RING; ringN = Math.min(RING, ringN + 1); if (++sinceEst >= 30) { sinceEst = 0; estimate(); } }
    }
    lastTick = t; prevWork = 0;
    const T = interval();
    if (last >= 0 && T > 0 && t - last < T - slackMs()) { skipped++; return; }
    const dt = last >= 0 ? t - last : 0;
    if (last < 0 || T <= 0) last = t;
    else {
      last += T;
      if (t - last > T || last > t + slackMs()) last = t; // fell behind (a long frame or a stall): restart the grid here
    }
    draws++;
    const budget = T > 0 ? T : (hz() > 0 ? 1000 / hz() : 0);
    const missed = budget > 0 && dt > budget * 1.5;
    if (missed) misses++;
    drawn.push(t, missed ? 1 : 0);
    while (drawn.length - dHead > 2 && t - drawn[dHead] > 1000) dHead += 2;
    if (dHead > 512) { drawn.copyWithin(0, dHead); drawn.length -= dHead; dHead = 0; } // compact now and then (no per-frame splice garbage)
    const w0 = now();
    try { onFrame?.(t, dt, { missed, budgetMs: budget, cap: activeCap() }); } finally { prevWork = now() - Math.min(w0, t); }
  }

  function resume() {
    if (running) return;
    running = true; last = -1; lastTick = -1;
    o.onResume?.();
    rafId = raf(tick);
  }

  const onVis = () => {
    if (pauseHidden && !isHidden() && api.wanted) resume();
    o.onVisibility?.({ hidden: isHidden(), focused });
  };
  const onBlur = () => { focused = false; last = -1; o.onVisibility?.({ hidden: isHidden(), focused }); };
  const onFocus = () => { focused = true; last = -1; o.onVisibility?.({ hidden: isHidden(), focused }); };
  let hooked = false;
  function hook() {
    if (hooked) return; hooked = true;
    try { doc?.addEventListener?.('visibilitychange', onVis); } catch { /* no document */ }
    try { win?.addEventListener?.('blur', onBlur); win?.addEventListener?.('focus', onFocus); } catch { /* no window */ }
    try { if (doc?.hasFocus) focused = !!doc.hasFocus(); } catch { /* assume focused */ }
  }
  function unhook() {
    if (!hooked) return; hooked = false;
    try { doc?.removeEventListener?.('visibilitychange', onVis); } catch { /* */ }
    try { win?.removeEventListener?.('blur', onBlur); win?.removeEventListener?.('focus', onFocus); } catch { /* */ }
  }

  const api = {
    wanted: false,
    /** begin the loop (idempotent); while hidden it waits for the page to come back */
    start(cb) {
      if (cb) onFrame = cb;
      api.wanted = true; hook();
      if (pauseHidden && isHidden()) return api;
      resume();
      return api;
    },
    /** re-check isHidden() (call after the platform reports minimise / restore); resumes a paused loop */
    visibilityChanged() { onVis(); return api; },
    /** stop the loop and drop the listeners */
    stop() { api.wanted = false; running = false; if (rafId) caf(rafId); rafId = 0; unhook(); return api; },
    /** 30 | 60 | 90 | 120 | 0 (unlimited); takes effect on the next tick */
    setCap(c) { cap = normalizeCap(c, cap); last = -1; return api; },
    /** cap while unfocused (0 = off) */
    setBlurCap(c) { blurCap = normalizeCap(c || 0, 0); return api; },
    /** a refresh rate reported by the platform (Android plugin / Electron); 0 = go back to measuring */
    setRefreshHz(h) { knownHz = h > 0 ? h : 0; last = -1; return api; },
    get cap() { return cap; },
    get running() { return running; },
    get focused() { return focused; },
    /** the refresh rate in use (known or measured; 0 = not known yet) */
    get refreshHz() { return hz(); },
    /** the rate the cap really runs at (after the divisor snap and the unfocused cap); 0 = unlimited and refresh not known */
    get effective() { return effectiveCap(activeCap(), hz()); },
    /** the frame budget in ms (1000 / effective), 0 when unknown */
    get budgetMs() { const e = effectiveCap(activeCap(), hz()); return e > 0 ? 1000 / e : 0; },
    label(c = cap) { return capLabel(c, hz()); },
    /** last second: fps (drawn), missRate (share of drawn frames that came >1.5 budgets after the previous), totals */
    stats() {
      let n = 0, m = 0; for (let i = dHead; i < drawn.length; i += 2) { n++; m += drawn[i + 1]; }
      const span = n > 1 ? drawn[drawn.length - 2] - drawn[dHead] : 0;
      return { fps: span > 0 ? ((n - 1) * 1000) / span : 0, missRate: n ? m / n : 0, refreshHz: hz(), effective: api.effective, cap, focused, ticks, draws, skipped, misses };
    },
  };
  return api;
}
