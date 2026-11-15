// Dynamic resolution (phones; off on the desktop) and the thermal governor.
//
// DynRes picks the render pixel ratio inside [min, max] in `step`s from what each drawn frame reports:
//   - drop one step when more than `dropMiss` (10%) of the frames in the last `windowMs` (1 s) missed their slot
//     (interval over 1.5 budgets), unless the frame is clearly CPU-bound (CPU p50 over 85% of budget and the GPU, when
//     measured, under it): fewer pixels would not help then
//   - raise one step after `raiseAfterMs` (4 s) with no misses and the GPU (when measured) under `raiseGpu` (70%) of budget
//   - at most one change every `cooldownMs` (2 s); a drop soon after a raise (within 10 s) doubles the raise wait
//     (up to 32 s), so a scene that sits on the edge settles instead of pumping up and down
// The budget is 1000 / the pacer's effective cap. apply(ratio) does the resize (renderer.setPixelRatio + composer size).
//
// ThermalGovernor turns the Android plugin's reports (PowerManager thermal status 0..6, thermal headroom 0..1+) into one
// `hot` flag: on at status >= MODERATE (2) or headroom > 0.8; off again only after `coolMs` (60 s) below both. While hot
// the game drops one tier (Mobile -> Battery: 30 fps cap, a lower resolution floor).
//
// Pure module: no three, no DOM. Time comes in with each sample (tests use a fake clock).

export const THERMAL = Object.freeze({ NONE: 0, LIGHT: 1, MODERATE: 2, SEVERE: 3, CRITICAL: 4, EMERGENCY: 5, SHUTDOWN: 6 });

const round = (v, step) => Math.round(v / step) * step;
const byNum = (x, y) => x - y;
const fix = (v) => Math.round(v * 1000) / 1000; // keep 0.1 steps free of float noise (0.85000000001)

/**
 * @param {object} o
 * @param {number} [o.min=0.75]   lowest pixel ratio (Battery: 0.65)
 * @param {number} [o.max=1.25]   highest pixel ratio (the preset's QUALITY.pixelRatio)
 * @param {number} [o.initial]    start ratio (default max)
 * @param {number} [o.step=0.1]
 * @param {number} [o.budgetMs=16.67] frame budget; setBudget() when the cap changes
 * @param {(ratio:number)=>void} [o.apply] does the resize
 * @param {boolean} [o.enabled=true]
 */
export class DynRes {
  constructor(o = {}) {
    this.step = o.step ?? 0.1;
    this.min = o.min ?? 0.75;
    this.max = o.max ?? 1.25;
    if (this.min > this.max) this.min = this.max;
    this.dropMiss = o.dropMiss ?? 0.1;
    this.windowMs = o.windowMs ?? 1000;
    this.raiseAfterMs = o.raiseAfterMs ?? 4000;
    this.raiseGpu = o.raiseGpu ?? 0.7;
    this.cpuBound = o.cpuBound ?? 0.85;
    this.cooldownMs = o.cooldownMs ?? 2000;
    this.minFrames = o.minFrames ?? 10; // need this many frames in the window before judging
    this.budgetMs = o.budgetMs ?? 1000 / 60;
    this.apply = o.apply || null;
    this.enabled = o.enabled !== false;
    this.scale = this._clamp(o.initial ?? this.max);
    this._raiseWait = this.raiseAfterMs;
    this._cpu = []; this._gpu = []; // reused every sample (no per-frame garbage on the phone's hot path)
    this.reset();
  }

  _clamp(v) { return fix(Math.min(this.max, Math.max(this.min, v))); }

  /** forget the history (after a teleport, a resume or a cap change) */
  reset(now) {
    this._f = []; // [t, missed(0/1), cpu, gpu] per frame, flattened
    this._lastMissAt = now ?? -Infinity;
    this._clean = now ?? null; // the time the miss-free stretch started
    this._lastChange = this._lastChange ?? -Infinity;
    this._lastRaise = this._lastRaise ?? -Infinity;
  }

  setBudget(ms) { if (ms > 0 && Math.abs(ms - this.budgetMs) > 0.01) { this.budgetMs = ms; this._f = []; } }

  /** change the range (Battery floor 0.65, the thermal tier); the current ratio is clamped and applied if it moved */
  setRange(min, max) {
    if (min != null) this.min = min;
    if (max != null) this.max = max;
    if (this.min > this.max) this.min = this.max;
    const s = this._clamp(this.scale);
    if (s !== this.scale) { this.scale = s; this.apply?.(s); }
    return this.scale;
  }

  /** jump straight to a ratio (clamped); applies it */
  force(ratio, now) {
    const s = this._clamp(ratio);
    if (s !== this.scale) { this.scale = s; this.apply?.(s); }
    this._lastChange = now ?? this._lastChange; this._f = []; this._clean = now ?? null;
    return s;
  }

  setEnabled(on) { this.enabled = !!on; this._f = []; }

  /**
   * one drawn frame.
   * @param {object} s
   * @param {number} s.now        ms
   * @param {number} [s.intervalMs] time since the previous drawn frame (the pacer's dtMs)
   * @param {boolean} [s.missed]  or let DynRes judge from intervalMs (> 1.5 budgets)
   * @param {number} [s.cpuMs]    engine.frame CPU time
   * @param {number} [s.gpuMs]    GPU time when the timer query exists (null / undefined otherwise)
   * @returns {number|null} the new ratio when it changed, else null
   */
  sample(s) {
    if (!this.enabled) return null;
    const t = s.now, B = this.budgetMs;
    const missed = s.missed ?? (s.intervalMs > 0 && s.intervalMs > B * 1.5);
    const f = this._f;
    f.push(t, missed ? 1 : 0, s.cpuMs ?? NaN, s.gpuMs ?? NaN);
    let cut = 0; while (cut < f.length && t - f[cut] > this.windowMs) cut += 4;
    if (cut) { f.copyWithin(0, cut); f.length -= cut; } // (splice would allocate the removed part)
    if (this._clean == null) this._clean = t;
    if (missed) { this._lastMissAt = t; this._clean = t; }
    if (t - this._lastChange < this.cooldownMs) return null;

    const n = f.length / 4;
    if (n < this.minFrames) return null;
    let m = 0; const cpu = this._cpu, gpu = this._gpu; cpu.length = 0; gpu.length = 0;
    for (let i = 0; i < f.length; i += 4) { m += f[i + 1]; if (f[i + 2] === f[i + 2]) cpu.push(f[i + 2]); if (f[i + 3] === f[i + 3]) gpu.push(f[i + 3]); }
    const med = (a) => { if (!a.length) return NaN; a.sort(byNum); return a[a.length >> 1]; };
    const cpu50 = med(cpu), gpu50 = med(gpu);
    const missRate = m / n;

    // drop
    if (missRate > this.dropMiss && this.scale > this.min + 1e-6) {
      const cpuBound = cpu50 > B * this.cpuBound && !(gpu50 > B * this.cpuBound);
      if (!cpuBound) {
        if (t - this._lastRaise < 10000) this._raiseWait = Math.min(32000, this._raiseWait * 2); // it just went up and could not hold
        return this._set(this.scale - this.step, t);
      }
    }
    // raise: needs `raiseAfterMs` of frames with no miss and the GPU (when measured) under raiseGpu of budget
    if (gpu50 > B * this.raiseGpu) this._clean = t;
    if (this.scale < this.max - 1e-6 && t - this._clean >= this._raiseWait && m === 0 && !(gpu50 > B * this.raiseGpu)) {
      this._lastRaise = t;
      return this._set(this.scale + this.step, t);
    }
    // a long calm stretch earns the quick raise back
    if (t - this._lastMissAt > 60000) this._raiseWait = this.raiseAfterMs;
    return null;
  }

  _set(v, t) {
    const s = this._clamp(round(v, this.step / 2));
    if (s === this.scale) return null;
    this.scale = s; this._lastChange = t; this._f = []; this._clean = t;
    this.apply?.(s);
    return s;
  }
}

/**
 * Thermal tiering from the Android plugin's reports.
 * @param {object} [o]
 * @param {number} [o.hotStatus=2]   THERMAL.MODERATE
 * @param {number} [o.hotHeadroom=0.8]
 * @param {number} [o.coolMs=60000]  stay hot this long after the last hot report
 * @param {(hot:boolean, info:object)=>void} [o.onChange]
 */
export class ThermalGovernor {
  constructor(o = {}) {
    this.hotStatus = o.hotStatus ?? THERMAL.MODERATE;
    this.hotHeadroom = o.hotHeadroom ?? 0.8;
    this.coolMs = o.coolMs ?? 60000;
    this.onChange = o.onChange || null;
    this.hot = false; this.status = 0; this.headroom = NaN; this._lastHot = -Infinity;
  }
  /** a report: { status?: 0..6, headroom?: number (NaN / undefined when the device has none) }, at time now (ms) */
  report(r, now) {
    if (r.status != null && r.status >= 0) this.status = r.status;
    if (r.headroom != null) this.headroom = r.headroom;
    const hotNow = this.status >= this.hotStatus || this.headroom > this.hotHeadroom;
    if (hotNow) this._lastHot = now;
    return this.tick(now);
  }
  /** re-check the cool-down without a new report (call from a 1-10 s timer) */
  tick(now) {
    const want = this.status >= this.hotStatus || this.headroom > this.hotHeadroom || now - this._lastHot < this.coolMs;
    if (want !== this.hot) { this.hot = want; this.onChange?.(want, { status: this.status, headroom: this.headroom }); }
    return this.hot;
  }
}
