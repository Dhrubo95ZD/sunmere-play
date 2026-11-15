// v116 Performance readout (Options > Graphics, off by default): a small corner panel that measures the game where it
// runs, so the real phone can be measured, not just the PC's stand-in. Shows fps (the last second), frame time p50 / p95
// over the last ~5 s, the CPU time of a frame, draw calls (camera pass + shadow pass), triangles, the quality preset and
// the render scale (dynamic resolution). "Copy" puts a one-line summary on the clipboard (the Android app: the share
// sheet when a Share plugin is there, else the clipboard). "Bench here" records 20 s while you stand still and shows a
// summary of it (copied the same way).
// Off, it costs nothing: no wrapper is installed and nothing runs. On, it wraps engine.frame and the shadow pass (the
// same counters tools/bench reads: renderer.info with autoReset off for the frame) and redraws the panel twice a second.
import { SETTINGS, QUALITY_PRESETS } from '../engine/settings.js';
import { IS_APP, capPlugin } from '../engine/platform.js';

const N = 2048; // frames kept (a 5 s window at up to ~400 fps)
const BENCH_MS = 20000;

const pct = (arr, n, p) => {
  if (!n) return NaN;
  const a = Array.prototype.slice.call(arr, 0, n).sort((x, y) => x - y);
  return a[Math.min(n - 1, Math.floor(p * (n - 1) + 0.5))];
};
const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : '-');
const kfmt = (v) => (v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? Math.round(v / 1e3) + 'k' : String(Math.round(v)));

export class PerfHud {
  constructor(game, root = document.body) {
    this.g = game; this.root = root; this.on = false; this.el = null;
    // ring of frames: start time, interval, CPU ms, draws (all), shadow draws, triangles (all), shadow triangles, shadow drawn
    this.t = new Float64Array(N); this.iv = new Float32Array(N); this.cpu = new Float32Array(N);
    this.calls = new Float32Array(N); this.sCalls = new Float32Array(N); this.tris = new Float32Array(N); this.sTris = new Float32Array(N); this.sOn = new Uint8Array(N);
    this.i = 0; this.n = 0; this.last = 0; this.bench = null; this.result = null;
  }

  setOn(on) {
    on = !!on;
    if (on === this.on) return;
    this.on = on;
    const eng = this.g.engine, R = eng?.renderer;
    if (!R) return;
    if (on) {
      this.n = 0; this.last = 0;
      this._autoReset = R.info.autoReset;
      R.info.autoReset = false;
      const self = this, orig = eng.frame;
      this._origFrame = orig;
      this._frame = function () {
        if (!self.on) return orig.call(this);
        const t0 = performance.now();
        R.info.reset();
        self._s = 0; self._sT = 0; self._sOn = 0;
        let dt;
        try { dt = orig.call(this); } finally { self.sample(t0, performance.now() - t0, R.info.render); }
        return dt;
      };
      eng.frame = this._frame;
      const sm = R.shadowMap, sr = sm.render;
      this._origShadow = sr;
      this._shadow = function (...a) {
        if (!self.on || !a[0]?.length || !sm.enabled || (!sm.autoUpdate && !sm.needsUpdate)) return sr.apply(this, a);
        const c0 = R.info.render.calls, t0 = R.info.render.triangles;
        try { return sr.apply(this, a); } finally { self._s += R.info.render.calls - c0; self._sT += R.info.render.triangles - t0; self._sOn = 1; }
      };
      sm.render = this._shadow;
      this.build();
      this._tick = setInterval(() => this.draw(), 500);
    } else {
      clearInterval(this._tick);
      // (put back only what is still ours: something wrapped on top of us keeps working, our wrapper then passes through)
      if (eng.frame === this._frame) { if (this._origFrame === Object.getPrototypeOf(eng).frame) delete eng.frame; else eng.frame = this._origFrame; }
      if (R.shadowMap.render === this._shadow) R.shadowMap.render = this._origShadow;
      R.info.autoReset = this._autoReset ?? true;
      this.bench = null;
      this.el?.remove(); this.el = null;
    }
  }

  sample(t0, cpu, info) {
    if (!this.on) return;
    const i = this.i;
    this.t[i] = t0; this.iv[i] = this.last ? t0 - this.last : 0; this.cpu[i] = cpu;
    this.calls[i] = info.calls; this.sCalls[i] = this._s; this.tris[i] = info.triangles; this.sTris[i] = this._sT; this.sOn[i] = this._sOn;
    this.last = t0;
    this.i = (i + 1) % N; this.n = Math.min(N, this.n + 1);
    const B = this.bench;
    if (B) {
      if (t0 < B.t0) return;
      B.iv.push(this.iv[i]); B.cpu.push(cpu); B.calls.push(info.calls - this._s); B.tris.push(info.triangles);
      if (this._sOn) { B.sCalls.push(this._s); B.sN++; }
      B.scale.push(this.g.engine.renderer.getPixelRatio());
      if (t0 - B.t0 >= BENCH_MS) this.finishBench();
    }
  }

  // the frames of the last `ms` (newest first)
  window(ms) {
    const now = performance.now(), out = { iv: [], cpu: [], calls: [], sCalls: [], tris: [], sOnN: 0, n: 0, span: 0 };
    let oldest = now;
    for (let k = 0; k < this.n; k++) {
      const i = (this.i - 1 - k + N) % N;
      if (now - this.t[i] > ms) break;
      oldest = this.t[i];
      out.n++;
      if (this.iv[i] > 0) out.iv.push(this.iv[i]);
      out.cpu.push(this.cpu[i]);
      out.calls.push(this.calls[i] - this.sCalls[i]); out.tris.push(this.tris[i]);
      if (this.sOn[i]) { out.sCalls.push(this.sCalls[i]); out.sOnN++; }
    }
    out.span = now - oldest;
    return out;
  }

  stats() {
    const eng = this.g.engine, R = eng.renderer, w5 = this.window(5000), w1 = this.window(1000);
    const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
    const dr = eng.dynres;
    const label = (QUALITY_PRESETS[SETTINGS.quality]?.label || SETTINGS.quality) + (SETTINGS.battery ? ' + Battery saver' : '');
    return {
      fps: w1.iv.length ? (w1.iv.length * 1000) / w1.iv.reduce((a, b) => a + b, 0) : NaN,
      p50: pct(w5.iv, w5.iv.length, 0.5), p95: pct(w5.iv, w5.iv.length, 0.95),
      cpu50: pct(w5.cpu, w5.cpu.length, 0.5), cpu95: pct(w5.cpu, w5.cpu.length, 0.95),
      main: mean(w5.calls), shadow: mean(w5.sCalls), shadowHz: w5.span > 0 ? (w5.sOnN * 1000) / w5.span : 0,
      tris: mean(w5.tris), preset: label, scale: R.getPixelRatio(), dyn: dr ? `${dr.min.toFixed(2)}-${dr.max.toFixed(2)}` : 'off',
      cap: eng.pacer?.cap ?? null, size: `${R.domElement.width}x${R.domElement.height}`,
    };
  }

  gpuName() {
    if (this._gpu !== undefined) return this._gpu;
    try {
      const gl = this.g.engine.renderer.getContext(), x = gl.getExtension('WEBGL_debug_renderer_info');
      this._gpu = String(x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).replace(/\s+/g, ' ').slice(0, 60);
    } catch { this._gpu = '?'; }
    return this._gpu;
  }

  line(s = this.stats()) {
    return `Sunmere perf: ${f1(s.fps)} fps, frame p50 ${f1(s.p50)} / p95 ${f1(s.p95)} ms, CPU ${f1(s.cpu50)} / ${f1(s.cpu95)} ms, draws ${Math.round(s.main)} + shadow ${Number.isFinite(s.shadow) ? Math.round(s.shadow) : 0} (${Math.round(s.shadowHz)} Hz), tris ${kfmt(s.tris)}, ${s.preset}, scale ${s.scale.toFixed(2)} (dyn ${s.dyn}), ${s.size}, cap ${s.cap || 'none'}, ${this.place()}, ${this.gpuName()}`;
  }
  place() {
    const p = this.g.playerPos?.(), W = this.g.world;
    return p ? `${W?.indoor ? 'indoor ' : ''}${W?.area || 'valley'} @ ${Math.round(p.x)},${Math.round(p.z)}` : '?';
  }

  build() {
    if (this.el) return;
    if (!document.getElementById('perfhud-css')) {
      const st = document.createElement('style'); st.id = 'perfhud-css';
      st.textContent = `.perfhud{position:fixed;left:max(6px,env(safe-area-inset-left));top:44%;z-index:15;max-width:270px;padding:4px 6px;
        background:rgba(12,14,18,.55);color:#e8e2d0;font:10.5px/1.3 ui-monospace,Consolas,monospace;border-radius:5px;pointer-events:none;
        border:1px solid rgba(255,255,255,.12);white-space:pre-wrap;overflow-wrap:anywhere}
        .perfhud b{color:#ffd88a;font-weight:600}.perfhud .ph-row{display:flex;gap:4px;margin-top:4px;pointer-events:auto}
        .perfhud button{font:11px ui-monospace,Consolas,monospace;padding:2px 6px;background:#3a3428;color:#f0e6cc;border:1px solid #6a5c40;border-radius:3px}
        .perfhud .ph-res{white-space:pre-wrap;margin-top:3px;color:#cfe8c0}.perfhud .ph-res:empty{display:none}
        .perfhud textarea{display:block;width:250px;height:64px;margin-top:4px;font:10px ui-monospace,Consolas,monospace;pointer-events:auto}`;
      document.head.appendChild(st);
    }
    const el = (this.el = document.createElement('div'));
    el.className = 'perfhud';
    el.innerHTML = '<div class="ph-txt"></div><div class="ph-res"></div><div class="ph-row"><button data-a="copy">Copy</button><button data-a="bench">Bench here</button></div>';
    for (const ev of ['pointerdown', 'mousedown', 'touchstart', 'click', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation()); // (not a click on the world)
    el.querySelector('[data-a=copy]').onclick = () => this.copy(this.result?.text || this.line());
    el.querySelector('[data-a=bench]').onclick = () => (this.bench ? this.cancelBench() : this.startBench());
    this.root.appendChild(el);
    this.draw();
  }

  draw() {
    if (!this.el) return;
    const s = this.stats();
    const txt = `<b>${f1(s.fps)} fps</b>  frame ${f1(s.p50)}/${f1(s.p95)} ms\nCPU ${f1(s.cpu50)}/${f1(s.cpu95)} ms  ${kfmt(s.tris)} tris\ndraws ${Math.round(s.main)} + shadow ${Number.isFinite(s.shadow) ? Math.round(s.shadow) : 0} @${Math.round(s.shadowHz)}Hz\n${s.preset}, scale ${s.scale.toFixed(2)}${s.dyn === 'off' ? '' : ` (${s.dyn})`}`;
    this.el.querySelector('.ph-txt').innerHTML = txt;
    const B = this.bench, res = this.el.querySelector('.ph-res');
    if (B) res.textContent = `Stand still... ${Math.max(0, Math.ceil((B.t0 + BENCH_MS - performance.now()) / 1000))} s`;
    else res.textContent = this.result ? this.result.short : '';
    this.el.querySelector('[data-a=bench]').textContent = B ? 'Stop' : 'Bench here';
  }

  startBench() {
    const p = this.g.playerPos?.();
    // (half a second in hand, so the tap itself is not measured)
    this.bench = { t0: performance.now() + 500, p0: p ? { x: p.x, z: p.z } : null, iv: [], cpu: [], calls: [], sCalls: [], sN: 0, tris: [], scale: [] };
    this.result = null; this.draw();
  }
  cancelBench() { this.bench = null; this.draw(); }
  finishBench() {
    const B = this.bench; this.bench = null;
    const n = B.iv.length, ms = B.iv.reduce((a, b) => a + b, 0), budget = 1000 / (this.g.engine.pacer?.cap || 60);
    const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
    const p = this.g.playerPos?.(), moved = B.p0 && p ? Math.hypot(p.x - B.p0.x, p.z - B.p0.z) : 0;
    const s = {
      fps: (n * 1000) / ms, p50: pct(B.iv, n, 0.5), p95: pct(B.iv, n, 0.95), p99: pct(B.iv, n, 0.99), worst: Math.max(...B.iv),
      slow: (B.iv.filter((v) => v > budget * 1.5).length / Math.max(1, n)) * 100,
      cpu50: pct(B.cpu, n, 0.5), cpu95: pct(B.cpu, n, 0.95), main: mean(B.calls), shadow: mean(B.sCalls), shadowHz: (B.sN * 1000) / ms,
      tris: mean(B.tris), sMin: Math.min(...B.scale), sMax: Math.max(...B.scale), sAvg: mean(B.scale),
    };
    const preset = (QUALITY_PRESETS[SETTINGS.quality]?.label || SETTINGS.quality) + (SETTINGS.battery ? ' + Battery saver' : '');
    const R = this.g.engine.renderer;
    const text = `Sunmere bench 20 s${moved > 1.5 ? ` (moved ${Math.round(moved)} m)` : ''}: ${f1(s.fps)} fps, frame p50 ${f1(s.p50)} / p95 ${f1(s.p95)} / p99 ${f1(s.p99)} / worst ${f1(s.worst)} ms, ${f1(s.slow)}% slow frames, CPU ${f1(s.cpu50)} / ${f1(s.cpu95)} ms, draws ${Math.round(s.main)} + shadow ${Math.round(s.shadow || 0)} (${Math.round(s.shadowHz)} Hz), tris ${kfmt(s.tris)}, ${preset}, scale ${s.sMin.toFixed(2)}-${s.sMax.toFixed(2)} (avg ${s.sAvg.toFixed(2)}), ${R.domElement.width}x${R.domElement.height}, cap ${this.g.engine.pacer?.cap || 'none'}, ${this.place()}, ${this.gpuName()}`;
    const short = `Bench 20 s${moved > 1.5 ? ' (you moved)' : ''}: ${f1(s.fps)} fps\np95 ${f1(s.p95)} p99 ${f1(s.p99)} ms, ${f1(s.slow)}% slow\nCPU ${f1(s.cpu50)} ms, scale ${s.sAvg.toFixed(2)} (Copy)`;
    this.result = { s, text, short };
    this.draw();
    return this.result;
  }

  async copy(text) {
    const btn = this.el?.querySelector('[data-a=copy]');
    const said = (m) => { if (btn) { btn.textContent = m; setTimeout(() => { if (btn.isConnected) btn.textContent = 'Copy'; }, 1500); } };
    try {
      const share = IS_APP ? capPlugin('Share') : null;
      if (share?.share) { await share.share({ title: 'Sunmere performance', text }); said('Shared'); return 'share'; }
    } catch { /* cancelled or not there: the clipboard */ }
    try { await navigator.clipboard.writeText(text); said('Copied'); return 'clipboard'; } catch { /* older web views */ }
    try {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove();
      if (ok) { said('Copied'); return 'exec'; }
    } catch { /* nothing left */ }
    // (no clipboard here: the text in a box, selected, to copy by hand)
    if (this.el && !this.el.querySelector('textarea')) {
      const ta = document.createElement('textarea'); ta.readOnly = true; ta.value = text;
      this.el.appendChild(ta); ta.focus(); ta.select(); setTimeout(() => ta.remove(), 20000);
    }
    said('Select + copy'); return null;
  }
}
