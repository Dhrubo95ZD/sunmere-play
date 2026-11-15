// Procedural hand-painted textures. Every texture is painted on a canvas at load time:
// colour (sRGB) plus an optional height layer that is turned into a normal map.
import * as THREE from 'three';
import { mulberry32, hash2 } from '/sunmere-play/shared/noise.js';

// ---------- colour helpers ----------
export function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------- periodic noise for tileable textures ----------
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
function pnoise(x, y, p, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = fade(x - ix), fy = fade(y - iy);
  const m = (v) => ((v % p) + p) % p;
  const a = hash2(m(ix), m(iy), seed), b = hash2(m(ix + 1), m(iy), seed);
  const c = hash2(m(ix), m(iy + 1), seed), d = hash2(m(ix + 1), m(iy + 1), seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
// u,v in [0,1); base period p cells
export function pfbm(u, v, p, oct = 4, seed = 0) {
  let s = 0, amp = 0.5, n = 0, per = p;
  for (let i = 0; i < oct; i++) {
    s += pnoise(u * per, v * per, per, seed + i * 13) * amp;
    n += amp; amp *= 0.5; per *= 2;
  }
  return s / n;
}

// ---------- painter ----------
class Painter {
  constructor(w, h = w, seed = 1, { height = false, alpha = false } = {}) {
    this.w = w; this.h = h;
    this.rng = mulberry32(seed);
    this.c = document.createElement('canvas');
    this.c.width = w; this.c.height = h;
    this.x = this.c.getContext('2d', { willReadFrequently: true });
    if (height) {
      this.hc = document.createElement('canvas');
      this.hc.width = w; this.hc.height = h;
      this.hx = this.hc.getContext('2d', { willReadFrequently: true });
      this.hx.fillStyle = '#808080';
      this.hx.fillRect(0, 0, w, h);
    }
    if (!alpha) { this.x.fillStyle = '#808080'; this.x.fillRect(0, 0, w, h); }
  }
  r(a = 0, b = 1) { return a + (b - a) * this.rng(); }
  pick(arr) { return arr[(this.rng() * arr.length) | 0]; }
  // per pixel fill: fn(u, v) -> [r,g,b] or [r,g,b,h]
  pixels(fn) {
    const { w, h } = this;
    const img = this.x.getImageData(0, 0, w, h);
    const himg = this.hx ? this.hx.getImageData(0, 0, w, h) : null;
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = fn(x / w, y / h, x, y);
        const i = (y * w + x) * 4;
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c.length > 4 ? c[4] : 255;
        if (himg && c.length > 3) { const hv = c[3] * 255; himg.data[i] = himg.data[i + 1] = himg.data[i + 2] = hv; himg.data[i + 3] = 255; }
      }
    }
    this.x.putImageData(img, 0, 0);
    if (himg) this.hx.putImageData(himg, 0, 0);
  }
  // draw fn at (x,y) and its wrapped copies so shapes tile seamlessly
  wrap(x, y, rad, fn) {
    const { w, h } = this;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const px = x + dx * w, py = y + dy * h;
      if (px + rad < 0 || px - rad > w || py + rad < 0 || py - rad > h) continue;
      fn(px, py);
    }
  }
  ellipse(ctx, x, y, rx, ry, rot, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
    ctx.fill();
  }
  blob(x, y, rx, ry, rot, color, a = 1, hval = null, wrap = true) {
    const draw = (px, py) => {
      this.ellipse(this.x, px, py, rx, ry, rot, css(color, a));
      if (this.hx && hval !== null) this.ellipse(this.hx, px, py, rx, ry, rot, `rgba(${hval},${hval},${hval},${a})`);
    };
    if (wrap) this.wrap(x, y, Math.max(rx, ry), draw); else draw(x, y);
  }
  line(x0, y0, x1, y1, width, color, a = 1, hval = null, wrap = true) {
    const draw = (ox, oy) => {
      for (const [ctx, col] of [[this.x, css(color, a)], [this.hx, hval !== null ? `rgba(${hval},${hval},${hval},${a})` : null]]) {
        if (!ctx || !col) continue;
        ctx.strokeStyle = col; ctx.lineWidth = width; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x0 + ox, y0 + oy); ctx.lineTo(x1 + ox, y1 + oy); ctx.stroke();
      }
    };
    if (!wrap) { draw(0, 0); return; }
    const rad = Math.hypot(x1 - x0, y1 - y0) + width;
    this.wrap(x0, y0, rad, (px, py) => draw(px - x0, py - y0));
  }
  blur(px) {
    const t = document.createElement('canvas');
    t.width = this.w; t.height = this.h;
    const tx = t.getContext('2d');
    tx.filter = `blur(${px}px)`;
    // draw tiled 3x3 so the blur wraps
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) tx.drawImage(this.c, dx * this.w, dy * this.h);
    this.x.clearRect(0, 0, this.w, this.h);
    this.x.drawImage(t, 0, 0);
  }
  texture({ repeat = true, srgb = true, mips = true } = {}) {
    const t = new THREE.CanvasTexture(this.c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.generateMipmaps = mips;
    t.needsUpdate = true;
    return t;
  }
  normalMap(strength = 2, repeat = true) {
    if (!this.hx) return null;
    const { w, h } = this;
    const src = this.hx.getImageData(0, 0, w, h).data;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const out = ctx.createImageData(w, h);
    const H = (x, y) => src[((((y % h) + h) % h) * w + (((x % w) + w) % w)) * 4] / 255;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      let nx = -dx, ny = dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * w + x) * 4;
      out.data[i] = (nx / l * 0.5 + 0.5) * 255;
      out.data[i + 1] = (ny / l * 0.5 + 0.5) * 255;
      out.data[i + 2] = (nz / l * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
    const t = new THREE.CanvasTexture(c);
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  }
}

const cache = new Map();
function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

// =====================================================================
// GROUND
// =====================================================================
function grassBlades(p, n, palette, len = [3, 9], width = [0.8, 1.8], hv = true) {
  for (let i = 0; i < n; i++) {
    const x = p.r(0, p.w), y = p.r(0, p.h);
    const blades = 3 + (p.rng() * 5) | 0;
    const base = p.pick(palette);
    for (let b = 0; b < blades; b++) {
      const a = -Math.PI / 2 + p.r(-1.1, 1.1);
      const L = p.r(len[0], len[1]);
      const col = mix(base, p.pick(palette), p.r(0, 0.5));
      p.line(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, p.r(width[0], width[1]), col, p.r(0.55, 0.95), hv ? (150 + p.r(0, 100)) | 0 : null);
    }
  }
}

export function grassTex() {
  return cached('grass', () => {
    const S = 1024, p = new Painter(S, S, 11, { height: true });
    const dark = hex('#56702c'), base = hex('#7f9a3c'), light = hex('#a9b955'), yel = hex('#c6bc62');
    p.pixels((u, v) => {
      const n = pfbm(u, v, 14, 4, 3), m = pfbm(u, v, 8, 3, 9);
      let c = mix(dark, base, sstep(0.25, 0.7, n));
      c = mix(c, yel, sstep(0.55, 0.8, m) * 0.3);
      return [...c, n * 0.4];
    });
    grassBlades(p, 2600, [dark, shade(dark, 0.8), base], [4, 10], [1, 2]);
    grassBlades(p, 2200, [base, light, yel], [3, 8], [0.8, 1.6]);
    grassBlades(p, 500, [hex('#d4d278'), light], [2, 5], [0.6, 1.2]);
    return { map: p.texture(), normalMap: p.normalMap(1.5) };
  });
}

export function lushTex() {
  return cached('lush', () => {
    const S = 1024, p = new Painter(S, S, 12, { height: true });
    const dark = hex('#2f6a2e'), base = hex('#4f9a3a'), light = hex('#8fca52'), teal = hex('#3d8c63');
    p.pixels((u, v) => {
      const n = pfbm(u, v, 14, 4, 33), m = pfbm(u, v, 8, 3, 7);
      let c = mix(dark, base, sstep(0.3, 0.7, n));
      c = mix(c, teal, sstep(0.5, 0.8, m) * 0.4);
      return [...c, n * 0.4];
    });
    grassBlades(p, 2600, [dark, base, teal], [4, 11], [1, 2]);
    grassBlades(p, 2000, [base, light], [3, 8], [0.8, 1.6]);
    // small flower clusters
    const flowers = [hex('#a57ee0'), hex('#f3eedc'), hex('#ffd36a'), hex('#e48fc0')];
    for (let i = 0; i < 160; i++) {
      const x = p.r(0, S), y = p.r(0, S), col = p.pick(flowers);
      for (let k = 0; k < 6; k++) {
        const fx = x + p.r(-10, 10), fy = y + p.r(-10, 10);
        p.blob(fx + 1, fy + 1.5, 3, 2.6, 0, shade(dark, 0.6), 0.5);
        p.blob(fx, fy, 2.6, 2.2, 0, col, 1, 230);
        p.blob(fx - 0.7, fy - 0.7, 1.1, 1, 0, mix(col, [255, 255, 255], 0.5), 1);
      }
    }
    return { map: p.texture(), normalMap: p.normalMap(1.5) };
  });
}

export function forestFloorTex() {
  return cached('forest', () => {
    const S = 1024, p = new Painter(S, S, 14, { height: true });
    const dark = hex('#3b4f22'), base = hex('#5d6f2c'), litter = hex('#7a5a30'), light = hex('#8c9a40');
    p.pixels((u, v) => {
      const n = pfbm(u, v, 12, 4, 51), m = pfbm(u, v, 10, 3, 2);
      let c = mix(dark, base, sstep(0.3, 0.7, n));
      c = mix(c, litter, sstep(0.55, 0.75, m) * 0.5);
      return [...c, n * 0.5];
    });
    // fallen leaves
    const lcols = [hex('#8a5a2a'), hex('#a8743a'), hex('#6e4a22'), hex('#9a8a3a')];
    for (let i = 0; i < 900; i++) {
      const x = p.r(0, S), y = p.r(0, S), r = p.r(3, 6), rot = p.r(0, 6.28), c = p.pick(lcols);
      p.blob(x + 1, y + 1.5, r, r * 0.5, rot, shade(dark, 0.6), 0.5, 90);
      p.blob(x, y, r, r * 0.5, rot, c, 0.95, 180);
    }
    grassBlades(p, 1600, [dark, base, light], [4, 10], [1, 1.8]);
    return { map: p.texture(), normalMap: p.normalMap(2) };
  });
}

export function dirtTex() {
  return cached('dirt', () => {
    const S = 1024, p = new Painter(S, S, 21, { height: true });
    const dark = hex('#6b4f30'), base = hex('#9a7a4c'), light = hex('#c2a374'), red = hex('#8e5f38');
    p.pixels((u, v) => {
      const n = pfbm(u, v, 14, 5, 61), m = pfbm(u, v, 8, 3, 71);
      let c = mix(dark, base, sstep(0.2, 0.75, n));
      c = mix(c, red, sstep(0.5, 0.8, m) * 0.3);
      c = mix(c, light, sstep(0.68, 0.85, n) * 0.6);
      return [...c, n * 0.6];
    });
    // tracks: soft streaks
    for (let i = 0; i < 260; i++) {
      const x = p.r(0, S), y = p.r(0, S), L = p.r(20, 60);
      p.line(x, y, x + p.r(-6, 6), y + L, p.r(2, 5), p.rng() < 0.5 ? shade(base, 0.8) : light, 0.18, null);
    }
    // pebbles with painted light
    const pc = [hex('#b9a88c'), hex('#a0937c'), hex('#cbbb9b'), hex('#8c7f6c')];
    for (let i = 0; i < 700; i++) {
      const x = p.r(0, S), y = p.r(0, S), r = p.r(2, 7), rot = p.r(0, 3), c = p.pick(pc);
      p.blob(x + r * 0.3, y + r * 0.45, r * 1.05, r * 0.8, rot, shade(dark, 0.55), 0.6, 60);
      p.blob(x, y, r, r * 0.75, rot, c, 1, 220);
      p.blob(x - r * 0.3, y - r * 0.3, r * 0.45, r * 0.3, rot, mix(c, [255, 250, 235], 0.5), 0.8, 255);
    }
    return { map: p.texture(), normalMap: p.normalMap(3) };
  });
}

export function sandTex() {
  return cached('sand', () => {
    const S = 1024, p = new Painter(S, S, 31, { height: true });
    const dark = hex('#c49b5f'), base = hex('#e0bf86'), light = hex('#f3dcaa');
    p.pixels((u, v) => {
      const n = pfbm(u, v, 12, 4, 81);
      const warp = pfbm(u, v, 3, 2, 82) * 6.0;
      const rip = Math.sin((v * 40 + u * 5 + warp * 1.6) * Math.PI * 2) * 0.5 + 0.5;
      // fine wind ripples that fade in and out in patches, so they read as texture and never as printed stripes
      const ripK = sstep(0.4, 0.75, pfbm(u, v, 4, 3, 83)) * 0.6;
      let c = mix(dark, base, sstep(0.15, 0.8, n));
      c = mix(c, light, Math.pow(rip, 5) * 0.22 * ripK);
      c = mix(c, shade(dark, 0.97), Math.pow(1 - rip, 6) * 0.14 * ripK);
      c = mix(c, hex('#f0d29a'), sstep(0.6, 0.8, pfbm(u, v, 6, 3, 84)) * 0.35);
      return [...c, rip * 0.18 * ripK + n * 0.35];
    });
    for (let i = 0; i < 2600; i++) {
      const x = p.r(0, S), y = p.r(0, S);
      p.blob(x, y, p.r(0.6, 1.5), p.r(0.6, 1.3), 0, p.rng() < 0.5 ? hex('#a87f4c') : hex('#fff1cf'), 0.7);
    }
    return { map: p.texture(), normalMap: p.normalMap(2) };
  });
}

export function rockTex() {
  return cached('rock', () => {
    const S = 1024, p = new Painter(S, S, 41, { height: true });
    const dark = hex('#5d5952'), base = hex('#8d887d'), light = hex('#bdb6a5'), warm = hex('#9a8a72');
    p.pixels((u, v) => {
      const n = pfbm(u, v, 4, 5, 91), m = pfbm(u, v, 8, 3, 92);
      let c = mix(dark, base, sstep(0.3, 0.7, n));
      c = mix(c, warm, sstep(0.5, 0.8, m) * 0.35);
      c = mix(c, light, sstep(0.62, 0.8, n) * 0.5);
      return [...c, n];
    });
    // facets: angular light planes
    for (let i = 0; i < 90; i++) {
      const x = p.r(0, S), y = p.r(0, S), r = p.r(20, 70), rot = p.r(0, 3.14);
      p.blob(x, y, r, r * 0.35, rot, light, 0.12, 200);
      p.blob(x + 6, y + 10, r, r * 0.3, rot, dark, 0.12, 70);
    }
    // cracks
    for (let i = 0; i < 70; i++) {
      let x = p.r(0, S), y = p.r(0, S), a = p.r(0, 6.28);
      for (let s = 0; s < 8; s++) {
        const nx = x + Math.cos(a) * 14, ny = y + Math.sin(a) * 14;
        p.line(x, y, nx, ny, p.r(1, 2.4), shade(dark, 0.55), 0.8, 20);
        p.line(x + 1.5, y + 1.5, nx + 1.5, ny + 1.5, 1, light, 0.35, null);
        x = nx; y = ny; a += p.r(-0.7, 0.7);
      }
    }
    return { map: p.texture(), normalMap: p.normalMap(3) };
  });
}

// Voronoi cobblestones
function voronoiStones(p, cells, gap, colors, seed, { round = 0.7, moss = 0, mortar = '#4e463a' } = {}) {
  const S = p.w, pts = [];
  const rng = mulberry32(seed);
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
    pts.push([(i + 0.15 + rng() * 0.7) / cells, (j + 0.15 + rng() * 0.7) / cells, rng()]);
  }
  const ptAt = (i, j) => {
    const ii = ((i % cells) + cells) % cells, jj = ((j % cells) + cells) % cells;
    const q = pts[jj * cells + ii];
    return [q[0] + Math.floor(i / cells), q[1] + Math.floor(j / cells), q[2]];
  };
  const mossC = hex('#5f7a2a');
  p.pixels((u, v) => {
    const ci = Math.floor(u * cells), cj = Math.floor(v * cells);
    let f1 = 9, f2 = 9, id = 0, cx = 0, cy = 0;
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      const q = ptAt(ci + di, cj + dj);
      const qx = q[0] + (ci + di - (((ci + di) % cells) + cells) % cells) / cells * 0;
      const dx = (q[0] - u) * cells, dy = (q[1] - v) * cells;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < f1) { f2 = f1; f1 = d; id = q[2]; cx = dx; cy = dy; } else if (d < f2) f2 = d;
    }
    const edge = (f2 - f1) * 0.5; // distance to border in cell units
    const n = pfbm(u, v, 8, 3, seed + 5);
    const c0 = colors[Math.floor(id * colors.length)];
    const inside = sstep(gap, gap + 0.08, edge);
    const bevel = sstep(gap, gap + round * 0.35, edge);
    // light from top-left on the bevel
    const lit = clamp01(0.5 + (cx * 0.6 + cy * 0.8) * 0.35);
    let c = mix(c0, shade(c0, 0.75), (1 - bevel) * (1 - lit) * 0.8);
    c = mix(c, mix(c0, [255, 245, 225], 0.35), (1 - bevel) * lit * 0.7);
    c = mix(c, shade(c, 0.85 + n * 0.3), 0.6);
    const gapC = moss > 0 ? mix(hex(mortar), mossC, sstep(0.4, 0.7, n) * moss) : hex(mortar);
    c = mix(gapC, c, inside);
    return [...c, inside * (0.55 + bevel * 0.45) * (0.85 + n * 0.15)];
  });
}

// large, irregular dressed flagstones (the Deepway floor): few big slabs, a narrow dark joint, a slight tint spread
export function flagstoneTex() {
  return cached('flagstone', () => {
    const p = new Painter(1024, 1024, 63, { height: true });
    voronoiStones(p, 11, 0.022, [hex('#8e887a'), hex('#857f72'), hex('#948d7e'), hex('#7d776b'), hex('#8a8476'), hex('#918a7b')], 63, { round: 0.25, moss: 0.04, mortar: '#3a352d' });
    return { map: p.texture(), normalMap: p.normalMap(3) };
  });
}

export function cobbleTex() {
  return cached('cobble', () => {
    const p = new Painter(1024, 1024, 51, { height: true });
    // finer, calmer cobbles: more and smaller stones, a narrow dark mortar, a tight tint range, only a hint of moss
    voronoiStones(p, 28, 0.042, [hex('#a59d8d'), hex('#9b9384'), hex('#aca391'), hex('#968e7f'), hex('#a29786'), hex('#a99e8b'), hex('#9e9585')], 51, { moss: 0.25, mortar: '#3e372e' });
    return { map: p.texture(), normalMap: p.normalMap(4) };
  });
}

export function cloudTex() {
  return cached('cloud', () => {
    const p = new Painter(256, 256, 61);
    p.pixels((u, v) => {
      const n = pfbm(u, v, 3, 5, 99);
      const c = sstep(0.42, 0.72, n) * 255;
      return [c, c, c];
    });
    const t = p.texture({ srgb: false });
    return t;
  });
}

// =====================================================================
// BUILDING MATERIALS
// =====================================================================
export function planksTex(key = 'wood', { base = '#8a5a32', boards = 6, vertical = true } = {}) {
  return cached('planks:' + key, () => {
    const S = 512, p = new Painter(S, S, 70 + key.length, { height: true });
    const b0 = hex(base), dark = shade(b0, 0.55), light = mix(b0, [255, 230, 190], 0.3);
    const bw = 1 / boards;
    const tints = Array.from({ length: boards }, () => p.r(0.82, 1.12));
    const cuts = Array.from({ length: boards }, () => p.r(0, 1));
    p.pixels((u0, v0) => {
      const u = vertical ? u0 : v0, v = vertical ? v0 : u0;
      const bi = Math.floor(u / bw), fu = (u - bi * bw) / bw;
      const warp = pfbm(u * 0.5, v, 4, 3, 7 + bi) * 3;
      const grain = Math.sin((fu * 7 + warp * 2.5) * Math.PI) * 0.5 + 0.5;
      const fine = pfbm(u * 6, v * 0.6, 8, 3, 17 + bi);
      let c = shade(b0, tints[bi]);
      c = mix(c, dark, Math.pow(grain, 4) * 0.45 + fine * 0.15);
      // painted bevel: light left edge, dark right edge
      c = mix(c, light, sstep(0.18, 0.0, fu) * 0.55);
      c = mix(c, dark, sstep(0.82, 1.0, fu) * 0.6);
      // board end cut
      const dv = Math.abs(((v - cuts[bi]) % 1 + 1) % 1);
      const cut = sstep(0.012, 0.0, Math.min(dv, 1 - dv));
      c = mix(c, shade(dark, 0.6), cut);
      const gap = sstep(0.035, 0.0, Math.min(fu, 1 - fu));
      c = mix(c, shade(dark, 0.45), gap);
      const hgt = (1 - gap) * (1 - cut) * (0.6 + 0.3 * (1 - Math.pow(grain, 4))) + 0.1 * sstep(0.2, 0, fu);
      return [...c, hgt];
    });
    // knots
    for (let i = 0; i < 9; i++) {
      const x = p.r(0, S), y = p.r(0, S), r = p.r(4, 9);
      for (let k = 3; k >= 0; k--) p.blob(x, y, r * (1 + k * 0.5), r * (0.6 + k * 0.35), 0, k % 2 ? dark : shade(b0, 0.8), 0.35, 70 + k * 30);
      p.blob(x, y, r * 0.6, r * 0.45, 0, shade(dark, 0.6), 0.9, 40);
    }
    // nails
    for (let i = 0; i < boards; i++) for (const yy of [0.12, 0.88]) {
      const x = (i + 0.5) / boards * S, y = yy * S + p.r(-4, 4);
      p.blob(x, y, 3, 3, 0, hex('#3a3430'), 1, 255);
      p.blob(x - 1, y - 1, 1.2, 1.2, 0, hex('#9a948a'), 1);
    }
    return { map: p.texture(), normalMap: p.normalMap(3) };
  });
}

export function stoneBrickTex(key = 'stone', { base = '#b8ae9c', rows = 8, mortar = '#6f675a', moss = 0.2, block = 1 } = {}) {
  return cached('brick:' + key, () => {
    const S = 512, p = new Painter(S, S, 90 + key.length * 7, { height: true });
    const b0 = hex(base), mort = hex(mortar), light = mix(b0, [255, 248, 230], 0.45), dark = shade(b0, 0.7);
    const mossC = hex('#5f7a2a');
    const rh = 1 / rows;
    const rowBricks = [];
    for (let r = 0; r < rows; r++) {
      const bricks = [];
      let x = r % 2 ? -0.5 / (3 * block) : 0;
      while (x < 1) { const w = (p.r(0.7, 1.3) / (3 * block)); bricks.push([x, Math.min(x + w, 1 + 0.0001), p.r(0.85, 1.12), p.r(0, 1)]); x += w; }
      // close the row seamlessly
      bricks[bricks.length - 1][1] = 1 + (bricks[0][0] < 0 ? bricks[0][0] : 0);
      rowBricks.push(bricks);
    }
    p.pixels((u, v) => {
      const ri = Math.min(rows - 1, Math.floor(v / rh)), fv = (v - ri * rh) / rh;
      const row = rowBricks[ri];
      let b = row[0];
      let uu = u;
      for (const br of row) { if (u >= br[0] && u < br[1]) { b = br; break; } if (u - 1 >= br[0] && u - 1 < br[1]) { b = br; uu = u - 1; break; } }
      const fu = (uu - b[0]) / (b[1] - b[0]);
      const ex = Math.min(fu, 1 - fu) * (b[1] - b[0]) * 3 * block, ey = Math.min(fv, 1 - fv);
      const e = Math.min(ex, ey);
      const n = pfbm(u, v, 8, 4, 31);
      const chip = pfbm(u, v, 24, 2, 41);
      const g = 0.07 + chip * 0.05;
      const inside = sstep(g, g + 0.04, e);
      let c = shade(b0, b[2]);
      c = mix(c, dark, n * 0.35);
      // painted top-left light on every block
      c = mix(c, light, sstep(0.3, 0.05, fv) * sstep(g + 0.1, g, e) * 0.0 + sstep(0.25, 0.0, ey) * (fv < 0.5 ? 0.5 : 0) + sstep(0.2, 0, ex) * (fu < 0.5 ? 0.25 : 0));
      c = mix(c, shade(c, 0.72), sstep(0.25, 0, ey) * (fv > 0.5 ? 0.6 : 0));
      let mc = mix(mort, shade(mort, 0.8), n);
      mc = mix(mc, mossC, sstep(0.55, 0.75, pfbm(u, v, 5, 3, 77)) * moss * 1.6);
      c = mix(mc, c, inside);
      if (moss > 0) c = mix(c, mossC, sstep(0.7, 0.85, pfbm(u, v, 4, 3, 78)) * moss * sstep(0.4, 1, fv) * inside);
      return [...c, inside * (0.6 + 0.4 * sstep(0, 0.3, e)) * (0.85 + n * 0.15)];
    });
    return { map: p.texture(), normalMap: p.normalMap(4) };
  });
}

export function shinglesTex(key = 'slate', { base = '#3e5c9a', rows = 10, round = true } = {}) {
  return cached('shingle:' + key, () => {
    const S = 512, p = new Painter(S, S, 120 + key.length, { height: true });
    const b0 = hex(base), dark = shade(b0, 0.5), light = mix(b0, [235, 240, 255], 0.35);
    const cols = 6;
    const tint = Array.from({ length: rows * cols * 2 }, () => p.r(0.85, 1.15));
    p.pixels((u, v) => {
      const ri = Math.floor(v * rows), fv = v * rows - ri;
      const off = ri % 2 ? 0.5 : 0;
      const cu = u * cols + off, ci = Math.floor(cu), fu = cu - ci;
      // tile shape: rounded bottom edge
      const dx = (fu - 0.5) * 2;
      const bottom = round ? 1 - 0.28 * dx * dx : 1;
      const inTile = fv < bottom ? 1 : 0;
      const t = tint[(ri * cols + ((ci % cols) + cols) % cols) % tint.length];
      const n = pfbm(u, v, 10, 3, 3);
      let c = shade(b0, t * (0.75 + 0.45 * fv)); // darker under the row above
      c = mix(c, light, sstep(0.75, 0.95, fv / bottom) * 0.5 * (1 - Math.abs(dx)));
      c = mix(c, dark, sstep(0.88, 0.97, Math.abs(dx)) * 0.7);
      c = mix(c, shade(c, 0.85), n * 0.5);
      // overlap shadow from the row below's top (this is the next row)
      if (!inTile) c = mix(shade(b0, 0.45), dark, 0.5);
      return [...c, inTile ? 0.3 + 0.6 * fv : 0.15];
    });
    return { map: p.texture(), normalMap: p.normalMap(4) };
  });
}

export function mossRoofTex() {
  return cached('mossroof', () => {
    const S = 512, p = new Painter(S, S, 131, { height: true });
    const wood = hex('#7a5532'), mossD = hex('#4f6a22'), moss = hex('#6f8a2e'), mossL = hex('#a5b848');
    const rows = 8, cols = 5;
    p.pixels((u, v) => {
      const ri = Math.floor(v * rows), fv = v * rows - ri;
      const off = ri % 2 ? 0.5 : 0;
      const cu = u * cols + off, fu = cu - Math.floor(cu);
      const edge = Math.min(fu, 1 - fu);
      const n = pfbm(u, v, 6, 4, 5);
      let c = mix(shade(wood, 0.6), wood, fv);
      c = mix(c, shade(wood, 0.5), sstep(0.06, 0.0, edge));
      const m = sstep(0.32, 0.6, pfbm(u, v, 5, 4, 9) + fv * 0.1);
      let mc = mix(mossD, moss, n);
      mc = mix(mc, mossL, sstep(0.6, 0.85, pfbm(u, v, 9, 3, 13)) * 0.8);
      c = mix(c, mc, m);
      return [...c, 0.25 + fv * 0.5 + m * 0.3];
    });
    // moss tufts
    for (let i = 0; i < 1400; i++) {
      const x = p.r(0, S), y = p.r(0, S), r = p.r(2, 6);
      p.blob(x + 1, y + 2, r, r * 0.8, 0, shade(mossD, 0.6), 0.4, 80);
      p.blob(x, y, r, r * 0.8, 0, p.pick([moss, mossL, mossD]), 0.9, 200);
      p.blob(x - r * 0.3, y - r * 0.35, r * 0.4, r * 0.3, 0, mix(mossL, [255, 255, 200], 0.4), 0.7, 240);
    }
    return { map: p.texture(), normalMap: p.normalMap(3) };
  });
}

// a thatched roof: courses of straw laid down the slope (v runs up it). (v112) Each course ends in ragged butt ends: bundles
// of straw cut at different lengths with single straws hanging lower still, lit at their tips; under them a dark gap where
// the course below sits in their shadow, darkening again toward the top of each course under the next one's fringe; the
// straws as fine streaks down the slope (no stamped pattern, no rings)
export function thatchTex() {
  return cached('thatch', () => {
    const S = 512, p = new Painter(S, S, 137, { height: true });
    const b0 = hex('#c9a65a'), dark = hex('#6e5528'), gap = hex('#3a2a14'), lit = hex('#f0d894'), old = hex('#8f8460');
    const rows = 6, NB = 15, NS = 160, jit = Array.from({ length: rows }, () => p.r(0, 1));
    p.pixels((u, v) => {
      const ri = Math.floor(v * rows), fv = v * rows - ri;
      const bi = Math.floor(u * NB + Math.floor(jit[ri] * NB)) % NB, si = Math.floor(u * NS) % NS;
      const bundle = hash2(bi, ri, 51), straw1 = hash2(si, ri, 53), tone = hash2(bi, ri, 57), clump = hash2(Math.floor(u * 64) % 64, ri, 55);
      // each bundle cut to its own length, its end jagged in small clumps of straw with stray straws hanging past it
      // (no rounded scallops: those read as fish scales)
      const rag = 0.1 + 0.05 * pfbm(u, jit[ri], 4, 2, 21 + ri) + bundle * 0.22 + clump * 0.1 - Math.pow(straw1, 4) * 0.14 + straw1 * 0.04;
      const e = fv - rag; // < 0: below this course's straw ends, the course below in its shadow
      const warp = pfbm(u, v, 4, 3, 7) * 0.7;
      const straw = Math.pow(Math.sin((u * 56 + warp + jit[ri] * 9 + bundle * 3) * Math.PI * 2) * 0.5 + 0.5, 1.6);
      const fine = (Math.sin((u * 150 + warp * 1.3 + jit[ri] * 5) * Math.PI * 2) * 0.5 + 0.5) * sstep(0.2, 0.7, pfbm(u, v, 24, 2, 31));
      const n = pfbm(u, v, 8, 3, 11);
      let c, h;
      if (e < 0) {
        // the gap: darkest right under the straw ends, the course below's straws faintly showing
        c = mix(gap, dark, sstep(0.04, 0.3, -e) * 0.4);
        c = shade(c, 0.85 + straw * 0.2);
        h = 0.08 + straw * 0.06;
      } else {
        c = mix(b0, lit, sstep(0.12, 0.0, e) * (0.45 + bundle * 0.25)); // the lit cut ends
        c = mix(c, dark, sstep(0.45, 1.0, fv) * 0.55); // toward the top of the course, in the shade of the one above
        c = shade(c, (0.76 + straw * 0.22 + fine * 0.08) * (0.86 + tone * 0.26)); // (each bundle its own shade of straw)
        h = 0.45 + straw * 0.25 + (1 - fv) * 0.3;
      }
      c = mix(c, old, sstep(0.55, 0.85, pfbm(u, v, 3, 3, 17)) * 0.3); // weathered patches
      c = mix(c, shade(c, 0.88), n * 0.4);
      return [...c, h];
    });
    return { map: p.texture(), normalMap: p.normalMap(3.5) };
  });
}

export function barkTex(key = 'bark', { base = '#86603c', light = '#c49a64' } = {}) {
  return cached('bark:' + key, () => {
    const S = 512, p = new Painter(S, S, 140 + key.length, { height: true });
    const b0 = hex(base), dark = shade(b0, 0.45), lit = hex(light);
    p.pixels((u, v) => {
      const warp = pfbm(u, v * 0.5, 4, 4, 3) * 2.2;
      const r = Math.abs(Math.sin((u * 9 + warp) * Math.PI)); // 9 ridges around
      const fib = pfbm(u * 2, v * 0.3, 16, 3, 9);
      const ridge = Math.pow(r, 0.6);
      let c = mix(dark, b0, ridge);
      c = mix(c, lit, sstep(0.75, 1, ridge) * (0.4 + fib * 0.6) * 0.8);
      c = mix(c, shade(c, 0.8), fib * 0.4);
      // horizontal breaks in ridges
      const brk = sstep(0.82, 0.9, pfbm(u, v * 3, 12, 2, 19));
      c = mix(c, dark, brk * 0.6);
      return [...c, ridge * (1 - brk * 0.6)];
    });
    return { map: p.texture(), normalMap: p.normalMap(5) };
  });
}

export function plasterTex() {
  return cached('plaster', () => {
    const S = 512, p = new Painter(S, S, 151, { height: true });
    const b0 = hex('#e9dcc0'), dark = hex('#c9b693'), warm = hex('#f4ead2');
    p.pixels((u, v) => {
      const n = pfbm(u, v, 5, 5, 3), m = pfbm(u, v, 14, 2, 4);
      let c = mix(dark, b0, sstep(0.2, 0.6, n));
      c = mix(c, warm, sstep(0.6, 0.8, n) * 0.6);
      c = mix(c, shade(c, 0.93), m * 0.4);
      return [...c, n * 0.5 + m * 0.2];
    });
    return { map: p.texture(), normalMap: p.normalMap(1.5) };
  });
}

export function sandstoneTex() {
  return stoneBrickTex('sandstone', { base: '#d8bd8a', rows: 5, mortar: '#9c8158', moss: 0, block: 0.7 });
}

export function clothTex() {
  return cached('cloth', () => {
    const S = 256, p = new Painter(S, S, 161, { height: true });
    p.pixels((u, v, x, y) => {
      const weave = ((x >> 1) + (y >> 1)) % 2 ? 1 : 0.95;
      const n = pfbm(u, v, 4, 4, 6);
      const fold = Math.sin((u * 3 + pfbm(u, v, 2, 2, 8) * 2) * Math.PI * 2) * 0.5 + 0.5;
      const k = (0.8 + n * 0.2) * weave * (0.88 + fold * 0.12);
      const c = 235 * k;
      return [c, c, c, fold * 0.5 + weave * 0.1];
    });
    return { map: p.texture(), normalMap: p.normalMap(1.5) };
  });
}

export function metalTex() {
  return cached('metal', () => {
    const S = 256, p = new Painter(S, S, 171, { height: true });
    p.pixels((u, v) => {
      const brushed = pfbm(u * 0.2, v * 6, 8, 3, 2);
      const n = pfbm(u, v, 4, 3, 3);
      const k = 0.9 + brushed * 0.07 + n * 0.05;
      const c = 235 * k;
      return [c, c, c, n * 0.3];
    });
    for (let i = 0; i < 25; i++) {
      const x = p.r(0, S), y = p.r(0, S), a = p.r(0, 3.14), L = p.r(4, 20);
      p.line(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, 0.6, [255, 255, 255], 0.2, 160);
    }
    return { map: p.texture(), normalMap: p.normalMap(1) };
  });
}

export function leatherTex() {
  return cached('leather', () => {
    const S = 256, p = new Painter(S, S, 181, { height: true });
    p.pixels((u, v) => {
      const n = pfbm(u, v, 6, 4, 9), cr = pfbm(u, v, 20, 2, 10);
      const k = 0.75 + n * 0.25 - sstep(0.6, 0.7, cr) * 0.1;
      const c = 235 * k;
      return [c, c, c, n * 0.4 + cr * 0.2];
    });
    return { map: p.texture(), normalMap: p.normalMap(1.2) };
  });
}

// Ring mail: 8 x 8 interlocking rings per tile, alternate rows offset by half a ring (bright steel, dark gaps)
export function mailTex() {
  return cached('mail', () => {
    const S = 128, N = 8, cell = S / N, R = cell * 0.46, W = cell * 0.16;
    const p = new Painter(S, S, 191, { height: true });
    p.pixels((u, v, x, y) => {
      let best = 0;
      for (let dj = -1; dj <= 1; dj++) {
        const j = Math.floor(y / cell) + dj, off = (((j % 2) + 2) % 2) * cell * 0.5;
        for (let di = -1; di <= 1; di++) {
          const i = Math.floor((x - off) / cell) + di;
          const cx = i * cell + off + cell / 2, cy = j * cell + cell / 2;
          const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.15);
          const k = 1 - clamp01(Math.abs(d - R) / W);
          best = Math.max(best, k * k * (3 - 2 * k));
        }
      }
      const c = 70 + best * 175;
      return [c, c, c * 1.02, best * 0.9];
    });
    return { map: p.texture(), normalMap: p.normalMap(2.2) };
  });
}

// Long carpet: u across, v along. Blue field with gold diamond border.
export function carpetTex(base = '#2e4a92') {
  return cached('carpet:' + base, () => {
    const W = 256, H = 512, p = new Painter(W, H, 191, { height: true });
    const b0 = hex(base), gold = hex('#d6a640'), dark = shade(b0, 0.6);
    p.pixels((u, v) => {
      const n = pfbm(u, v, 6, 3, 2);
      const eu = Math.min(u, 1 - u);
      let c = shade(b0, 0.9 + n * 0.2);
      if (eu < 0.18) {
        c = shade(b0, 0.75);
        if (eu > 0.03 && eu < 0.05) c = gold;
        if (eu > 0.15 && eu < 0.165) c = gold;
        const dv = ((v * 16) % 1) - 0.5, du = (eu - 0.1) / 0.05;
        if (Math.abs(dv) * 2 + Math.abs(du) < 0.9) c = mix(gold, [255, 230, 150], 0.2);
      } else {
        const dv = ((v * 5) % 1) - 0.5, du = (u - 0.5) * 2.2;
        const d = Math.abs(dv) * 2 + Math.abs(du);
        if (d < 0.5 && d > 0.36) c = gold;
        if (d < 0.18) c = shade(gold, 0.85);
      }
      return [...mix(c, dark, n * 0.15), 0.5];
    });
    return { map: p.texture(), normalMap: p.normalMap(1) };
  });
}

// Market canopy cloth: wide stripes running across u, sun-faded with a visible weave
export function stripeTex(a = '#a8322a', b = '#efe2c4', n = 8) {
  return cached('stripe:' + a + b + n, () => {
    const S = 256, p = new Painter(S, S, 211, { height: true });
    const A = hex(a), B = hex(b);
    p.pixels((u, v, x, y) => {
      const weave = ((x >> 1) + (y >> 1)) % 2 ? 1 : 0.93;
      const nn = pfbm(u, v, 4, 4, 12);
      const f = (u * n) % 1, band = Math.floor(u * n) % 2;
      const seam = Math.abs(f - 0.5) > 0.46 ? 0.82 : 1;
      const c = shade(band ? A : B, (0.84 + nn * 0.2) * weave * seam);
      return [...c, nn * 0.4 + weave * 0.15 + (seam < 1 ? 0.3 : 0)];
    });
    return { map: p.texture(), normalMap: p.normalMap(1.2) };
  });
}

// Archery target face: painted straw boss with coloured scoring rings (plain rings only)
export function targetTex() {
  return cached('target', () => {
    const S = 256, p = new Painter(S, S, 221, { height: true });
    const rings = [hex('#f2ead6'), hex('#2a2622'), hex('#3a6ab8'), hex('#c23a2a'), hex('#e8b830')];
    p.pixels((u, v) => {
      const r = Math.hypot(u - 0.5, v - 0.5) * 2;
      const straw = pfbm(u * 3, v * 3, 10, 3, 14);
      if (r > 1) { const c = shade(hex('#c8a858'), 0.7 + straw * 0.4); return [...c, straw]; }
      const i = Math.min(4, Math.floor((1 - r) * 5));
      const edge = Math.abs(((1 - r) * 5) % 1 - 0.5) > 0.45 ? 0.75 : 1;
      const c = shade(rings[i], (0.82 + straw * 0.22) * edge);
      return [...c, straw * 0.5];
    });
    return { map: p.texture(), normalMap: p.normalMap(1) };
  });
}

// Banners: emblem on coloured cloth with a gold border. kind: 'sun' | 'leaf' | 'diamond' | 'tower'
export function bannerTex(kind = 'sun', base = '#2e4a92') {
  return cached('banner:' + kind + base, () => {
    const W = 256, H = 512, p = new Painter(W, H, 201, { height: true, alpha: true });
    const b0 = hex(base), gold = hex('#e0ad45'), goldL = hex('#ffe08a'), goldD = hex('#8a5e1c');
    const x = p.x;
    // cloth with swallow-tail-free pointed bottom
    x.save();
    x.beginPath();
    x.moveTo(0, 0); x.lineTo(W, 0); x.lineTo(W, H * 0.82); x.lineTo(W / 2, H); x.lineTo(0, H * 0.82); x.closePath();
    x.clip();
    const grd = x.createLinearGradient(0, 0, W, 0);
    grd.addColorStop(0, css(shade(b0, 0.75))); grd.addColorStop(0.5, css(b0)); grd.addColorStop(1, css(shade(b0, 0.7)));
    x.fillStyle = grd; x.fillRect(0, 0, W, H);
    // border
    x.strokeStyle = css(gold); x.lineWidth = 14;
    x.beginPath(); x.moveTo(7, 0); x.lineTo(7, H * 0.82 - 4); x.lineTo(W / 2, H - 10); x.lineTo(W - 7, H * 0.82 - 4); x.lineTo(W - 7, 0); x.stroke();
    x.strokeStyle = css(goldD); x.lineWidth = 3;
    x.beginPath(); x.moveTo(18, 0); x.lineTo(18, H * 0.82 - 10); x.lineTo(W / 2, H - 26); x.lineTo(W - 18, H * 0.82 - 10); x.lineTo(W - 18, 0); x.stroke();
    // emblem
    const cx = W / 2, cy = H * 0.42;
    const goldGrad = (r) => { const g = x.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r); g.addColorStop(0, css(goldL)); g.addColorStop(0.6, css(gold)); g.addColorStop(1, css(goldD)); return g; };
    if (kind === 'sun') {
      // Sunmere crest: a plain heater shield with a level band (no boss, no disc in a ring, no rays)
      x.fillStyle = goldGrad(80);
      x.beginPath(); x.moveTo(cx - 56, cy - 66); x.lineTo(cx + 56, cy - 66); x.lineTo(cx + 56, cy + 6);
      x.quadraticCurveTo(cx + 52, cy + 58, cx, cy + 84); x.quadraticCurveTo(cx - 52, cy + 58, cx - 56, cy + 6); x.closePath(); x.fill();
      x.strokeStyle = css(goldD); x.lineWidth = 4; x.stroke();
      x.fillStyle = css(b0); x.fillRect(cx - 54, cy - 14, 108, 20);
      x.fillStyle = css(goldL); x.fillRect(cx - 54, cy - 16, 108, 3);
      x.fillStyle = css(gold); x.fillRect(cx - 70, cy + 106, 140, 8);
    } else if (kind === 'leaf') {
      x.fillStyle = goldGrad(70);
      x.beginPath(); x.moveTo(cx, cy - 78);
      x.bezierCurveTo(cx + 62, cy - 40, cx + 50, cy + 40, cx, cy + 70);
      x.bezierCurveTo(cx - 50, cy + 40, cx - 62, cy - 40, cx, cy - 78); x.fill();
      x.strokeStyle = css(goldD); x.lineWidth = 4;
      x.beginPath(); x.moveTo(cx, cy - 60); x.lineTo(cx, cy + 90); x.stroke();
      x.lineWidth = 2.5;
      for (let i = 0; i < 5; i++) {
        const yy = cy - 40 + i * 20;
        x.beginPath(); x.moveTo(cx, yy + 8); x.quadraticCurveTo(cx + 18, yy, cx + 34 - i * 4, yy - 10); x.stroke();
        x.beginPath(); x.moveTo(cx, yy + 8); x.quadraticCurveTo(cx - 18, yy, cx - 34 + i * 4, yy - 10); x.stroke();
      }
    } else if (kind === 'diamond') {
      x.fillStyle = goldGrad(70);
      x.beginPath(); x.moveTo(cx, cy - 70); x.lineTo(cx + 46, cy); x.lineTo(cx, cy + 70); x.lineTo(cx - 46, cy); x.closePath(); x.fill();
      x.fillStyle = css(b0);
      x.beginPath(); x.moveTo(cx, cy - 40); x.lineTo(cx + 26, cy); x.lineTo(cx, cy + 40); x.lineTo(cx - 26, cy); x.closePath(); x.fill();
      x.fillStyle = css(goldL);
      x.beginPath(); x.moveTo(cx, cy - 16); x.lineTo(cx + 10, cy); x.lineTo(cx, cy + 16); x.lineTo(cx - 10, cy); x.closePath(); x.fill();
    } else if (kind === 'tower') {
      x.fillStyle = goldGrad(70);
      x.fillRect(cx - 30, cy - 40, 60, 100);
      for (let i = 0; i < 3; i++) x.fillRect(cx - 38 + i * 30, cy - 62, 16, 26);
      x.fillRect(cx - 40, cy - 44, 80, 10);
      x.fillStyle = css(b0);
      x.beginPath(); x.arc(cx, cy + 40, 13, Math.PI, 0); x.lineTo(cx + 13, cy + 60); x.lineTo(cx - 13, cy + 60); x.fill();
      x.fillRect(cx - 5, cy - 20, 10, 18);
    }
    // painted fold shading
    for (let i = 0; i < 5; i++) {
      const fx = (i + 0.5) / 5 * W + p.r(-10, 10);
      const g = x.createLinearGradient(fx - 26, 0, fx + 26, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.16)'); g.addColorStop(1, 'rgba(255,255,255,0.0)');
      x.fillStyle = g; x.fillRect(fx - 26, 0, 52, H);
    }
    x.restore();
    return { map: p.texture({ repeat: false }) };
  });
}

// =====================================================================
// FOLIAGE CARDS (alpha)
// =====================================================================
function leafShape(ctx, x, y, len, wid, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.45, -wid, len, 0);
  ctx.quadraticCurveTo(len * 0.45, wid, 0, 0);
  ctx.fill();
  ctx.restore();
}

// Leaf clump card. palette: [dark, mid, light, highlight]
export function leafCardTex(key, palette, { leaves = 230, size = [26, 46], round = true } = {}) {
  return cached('leafcard:' + key, () => {
    const S = 512, p = new Painter(S, S, 211 + key.length * 3, { alpha: true });
    const pal = palette.map(hex);
    const x = p.x;
    const cx = S / 2, cy = S / 2;
    // back-to-front layers: inner/back leaves darker
    for (let layer = 0; layer < 4; layer++) {
      const n = leaves * (layer === 0 ? 0.35 : 0.22);
      for (let i = 0; i < n; i++) {
        const a = p.r(0, Math.PI * 2);
        const rr = Math.sqrt(p.rng()) * (round ? S * 0.4 : S * 0.46) * (1 - layer * 0.05);
        const lx = cx + Math.cos(a) * rr, ly = cy + Math.sin(a) * rr * (round ? 1 : 0.85);
        const len = p.r(size[0], size[1]) * (1 - layer * 0.06);
        const rot = Math.atan2(ly - cy, lx - cx) + p.r(-0.9, 0.9);
        // light comes from the upper left: leaves there are brighter
        const litK = clamp01(0.5 - ((lx - cx) * 0.6 + (ly - cy) * 0.8) / S + layer * 0.16 + p.r(-0.15, 0.15));
        let col = litK < 0.33 ? mix(pal[0], pal[1], litK * 3) : litK < 0.66 ? mix(pal[1], pal[2], (litK - 0.33) * 3) : mix(pal[2], pal[3], (litK - 0.66) * 3);
        x.fillStyle = css(shade(pal[0], 0.55), 0.55);
        leafShape(x, lx + 2, ly + 3, len, len * 0.32, rot);
        x.fillStyle = css(col);
        leafShape(x, lx, ly, len, len * 0.3, rot);
        // midrib + tip highlight
        x.strokeStyle = css(shade(col, 0.75), 0.8); x.lineWidth = 1.1;
        x.beginPath(); x.moveTo(lx, ly); x.lineTo(lx + Math.cos(rot) * len * 0.85, ly + Math.sin(rot) * len * 0.85); x.stroke();
        x.fillStyle = css(mix(col, pal[3], 0.6), 0.6);
        leafShape(x, lx + Math.cos(rot) * len * 0.35, ly + Math.sin(rot) * len * 0.35, len * 0.5, len * 0.12, rot);
      }
    }
    return { map: p.texture({ repeat: false }) };
  });
}

// Painted foliage clump card: a puffy silhouette (union of domes) shaded only radially
// (scene light provides direction through the card's sphere normals), leafy outline and
// interior leaf strokes. palette: [deep, dark, mid, light, highlight]
export function clumpCardTex(key, palette, { lobes = 7, leafLen = [22, 40], strokes = 520, seed = 0, floret = false, needles = false } = {}) {
  return cached('clump:' + key, () => {
    const S = 512, p = new Painter(S, S, 401 + key.length * 11 + seed, { alpha: true });
    const pal = palette.map(hex);
    const circles = [];
    for (let i = 0; i < lobes; i++) {
      const a = (i / lobes) * Math.PI * 2 + p.r(-0.3, 0.3);
      const rr = i === 0 ? 0 : p.r(70, 120);
      circles.push([S / 2 + Math.cos(a) * rr, S / 2 + Math.sin(a) * rr, i === 0 ? 120 : p.r(62, 92)]);
    }
    const H = (x, y) => {
      let h = 0;
      for (const [cx, cy, r] of circles) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2;
        if (d2 < r * r) h = Math.max(h, Math.sqrt(r * r - d2) / 120);
      }
      return h;
    };
    const ramp = (k) => {
      k = clamp01(k);
      const seg = k * (pal.length - 1), i = Math.min(pal.length - 2, Math.floor(seg));
      return mix(pal[i], pal[i + 1], seg - i);
    };
    // lit from the upper left (matches the sun for camera-facing cards)
    const L = [-0.55, -0.62, 0.56];
    const lit = (x, y) => {
      const e = 3;
      const nx = (H(x - e, y) - H(x + e, y)) * 22, ny = (H(x, y - e) - H(x, y + e)) * 22;
      const l = Math.hypot(nx, ny, 1);
      return clamp01((nx * L[0] + ny * L[1] + L[2]) / l);
    };
    const shadeAt = (x, y) => { const h = H(x, y); return 0.16 + lit(x, y) * 0.62 + Math.pow(h, 0.5) * 0.16; };
    p.pixels((u, v, x, y) => {
      const h = H(x, y);
      if (h <= 0) return [0, 0, 0, 0, 0];
      const n = pfbm(u, v, 10, 3, 5 + seed);
      const k = shadeAt(x, y) + (n - 0.5) * 0.22;
      const c = ramp(k);
      return [...c, 0, 255];
    });
    const x = p.x;
    // interior leaf strokes following the local shade
    for (let i = 0; i < strokes; i++) {
      const px = p.r(0, S), py = p.r(0, S);
      const h = H(px, py);
      if (h <= 0.05) continue;
      const len = p.r(leafLen[0], leafLen[1]) * 0.75;
      const rot = p.r(0, Math.PI * 2);
      const k = clamp01(shadeAt(px, py) + p.r(-0.18, 0.22));
      if (needles) {
        const col = ramp(k), dk = ramp(k - 0.3);
        for (let f = 0; f < 7; f++) {
          const a = Math.PI / 2 + p.r(-1.0, 1.0), nl = len * p.r(0.6, 1.0);
          p.line(px + 1, py + 1.5, px + 1 + Math.cos(a) * nl, py + 1.5 + Math.sin(a) * nl, 1.8, dk, 0.5, null, false);
          p.line(px, py, px + Math.cos(a) * nl, py + Math.sin(a) * nl, 1.5, col, 1, null, false);
        }
      } else if (floret) {
        const r = len * 0.2;
        p.blob(px + 1.2, py + 1.8, r * 1.1, r, 0, shade(ramp(k - 0.25), 0.9), 0.6, null, false);
        p.blob(px, py, r, r * 0.92, 0, ramp(k), 1, null, false);
        p.blob(px - r * 0.3, py - r * 0.35, r * 0.4, r * 0.36, 0, ramp(k + 0.2), 0.9, null, false);
      } else {
        x.fillStyle = css(shade(ramp(k - 0.22), 0.9), 0.6);
        leafShape(x, px + 1.5, py + 2, len, len * 0.32, rot);
        x.fillStyle = css(ramp(k));
        leafShape(x, px, py, len, len * 0.3, rot);
      }
    }
    // leafy outline: leaves sticking out of the silhouette
    for (let i = 0; i < 360; i++) {
      const ci = circles[(p.rng() * circles.length) | 0];
      const a = p.r(0, Math.PI * 2);
      const ex = ci[0] + Math.cos(a) * ci[2], ey = ci[1] + Math.sin(a) * ci[2];
      if (H(ex + Math.cos(a) * 4, ey + Math.sin(a) * 4) > 0.02) continue; // inside another lobe
      const len = p.r(leafLen[0], leafLen[1]);
      const rot = a + p.r(-0.6, 0.6);
      const k = clamp01(shadeAt(ex - Math.cos(a) * 8, ey - Math.sin(a) * 8) + p.r(-0.15, 0.15));
      if (needles) {
        const nl = len * 0.9;
        for (let f = 0; f < 4; f++) {
          const aa = a + p.r(-0.5, 0.5);
          p.line(ex - Math.cos(a) * 6, ey - Math.sin(a) * 6, ex + Math.cos(aa) * nl, ey + Math.sin(aa) * nl, 1.6, ramp(k - 0.1), 1, null, false);
        }
        continue;
      }
      if (floret) {
        const r = len * 0.22;
        p.blob(ex, ey, r, r * 0.92, 0, ramp(k), 1, null, false);
        p.blob(ex - r * 0.3, ey - r * 0.35, r * 0.4, r * 0.36, 0, ramp(k + 0.25), 0.9, null, false);
        continue;
      }
      x.fillStyle = css(ramp(k - 0.15));
      leafShape(x, ex - Math.cos(a) * len * 0.35, ey - Math.sin(a) * len * 0.35, len, len * 0.32, rot);
      x.strokeStyle = css(ramp(k - 0.35), 0.7); x.lineWidth = 1;
      x.beginPath(); x.moveTo(ex - Math.cos(a) * len * 0.3, ey - Math.sin(a) * len * 0.3); x.lineTo(ex + Math.cos(rot) * len * 0.55, ey + Math.sin(rot) * len * 0.55); x.stroke();
    }
    return { map: p.texture({ repeat: false }) };
  });
}

// Tileable needle texture for conifer skirts: u around the tier, v down the slope (top -> rim).
export function needleTex() {
  return cached('needles', () => {
    const S = 512, p = new Painter(S, S, 451, { height: true });
    const pal = [hex('#173322'), hex('#24472c'), hex('#356036'), hex('#5a8640'), hex('#9cb455')];
    p.pixels((u, v) => {
      const n = pfbm(u, v, 6, 4, 2);
      return [...mix(pal[0], pal[1], n), n * 0.4];
    });
    // overlapping fronds of needles hanging down the slope
    for (let i = 0; i < 520; i++) {
      const x0 = p.r(0, S), y0 = p.r(0, S), L = p.r(40, 90);
      const tipBright = p.r(0.4, 1);
      for (let k = 0; k < 18; k++) {
        const t = k / 18;
        const px = x0 + p.r(-3, 3), py = y0 + t * L;
        for (const sd of [-1, 1]) {
          const nl = (1 - t * 0.5) * p.r(8, 14);
          const col = mix(pal[2], pal[3 + (t > 0.6 ? 1 : 0)], t * tipBright);
          p.line(px, py, px + sd * nl * 0.8, py + nl * 0.75, 1.6, col, 0.95, (120 + t * 120) | 0);
        }
      }
      p.line(x0, y0, x0, y0 + L, 1.4, hex('#3a2a1a'), 0.6, 90);
    }
    return { map: p.texture(), normalMap: p.normalMap(2) };
  });
}

// Opaque tileable leaf mass for canopy cores.
export function leafMassTex(key, palette) {
  return cached('leafmass:' + key, () => {
    const S = 512, p = new Painter(S, S, 431 + key.length, { height: true });
    const pal = palette.map(hex);
    p.pixels((u, v) => {
      const n = pfbm(u, v, 6, 4, 3);
      return [...mix(pal[0], pal[1], n), n];
    });
    for (let i = 0; i < 2600; i++) {
      const px = p.r(0, S), py = p.r(0, S), len = p.r(14, 26), rot = p.r(0, 6.28);
      const col = mix(pal[p.rng() < 0.5 ? 1 : 2], pal[3], p.r(0, 0.6));
      const draw = (ox, oy) => {
        p.x.fillStyle = css(shade(pal[0], 0.8), 0.6); leafShape(p.x, ox + 1.5, oy + 2, len, len * 0.32, rot);
        p.x.fillStyle = css(col); leafShape(p.x, ox, oy, len, len * 0.3, rot);
        p.hx.fillStyle = 'rgba(220,220,220,1)'; leafShape(p.hx, ox, oy, len, len * 0.3, rot);
      };
      p.wrap(px, py, len, draw);
    }
    return { map: p.texture(), normalMap: p.normalMap(2) };
  });
}

// Flower-cluster card made of small round florets (lilac / wisteria style).
export function blossomCardTex(key, palette, { clusters = 70 } = {}) {
  return cached('blossom:' + key, () => {
    const S = 512, p = new Painter(S, S, 233 + key.length, { alpha: true });
    const pal = palette.map(hex);
    const cx = S / 2, cy = S / 2;
    // a few leaves underneath
    const leafPal = [hex('#3d5a24'), hex('#5f7f32')];
    for (let i = 0; i < 60; i++) {
      const a = p.r(0, 6.28), rr = Math.sqrt(p.rng()) * S * 0.38;
      const lx = cx + Math.cos(a) * rr, ly = cy + Math.sin(a) * rr;
      p.x.fillStyle = css(p.pick(leafPal));
      leafShape(p.x, lx, ly, p.r(20, 34), 8, Math.atan2(ly - cy, lx - cx) + p.r(-0.6, 0.6));
    }
    for (let i = 0; i < clusters; i++) {
      const a = p.r(0, 6.28), rr = Math.sqrt(p.rng()) * S * 0.38;
      const bx = cx + Math.cos(a) * rr, by = cy + Math.sin(a) * rr;
      const litK = clamp01(0.5 - ((bx - cx) * 0.6 + (by - cy) * 0.8) / S + p.r(-0.2, 0.2));
      const cr = p.r(14, 26);
      for (let k = 0; k < 16; k++) {
        const fa = p.r(0, 6.28), fr = Math.sqrt(p.rng()) * cr;
        const fx = bx + Math.cos(fa) * fr, fy = by + Math.sin(fa) * fr;
        const kk = clamp01(litK + (fy < by ? 0.2 : -0.1) + p.r(-0.1, 0.1));
        const col = kk < 0.5 ? mix(pal[0], pal[1], kk * 2) : mix(pal[1], pal[2], (kk - 0.5) * 2);
        p.blob(fx + 1.5, fy + 2, 5.5, 5, 0, shade(pal[0], 0.5), 0.5, null, false);
        p.blob(fx, fy, 5, 4.6, 0, col, 1, null, false);
        p.blob(fx - 1.4, fy - 1.6, 2, 1.8, 0, mix(col, [255, 255, 255], 0.55), 0.85, null, false);
      }
    }
    return { map: p.texture({ repeat: false }) };
  });
}

// Pine branch card: twig down the middle (u=0.5) with needles. Card is drawn pointing right.
export function pineCardTex() {
  return cached('pinecard', () => {
    const W = 512, H = 256, p = new Painter(W, H, 241, { alpha: true });
    const pal = [hex('#1f3f2a'), hex('#2f5a33'), hex('#4f7f3c'), hex('#8fae5a')];
    const x = p.x;
    const twigs = [[10, H / 2, W - 20, H / 2, 0]];
    for (let i = 0; i < 9; i++) {
      const tx = 40 + i * 50, side = i % 2 ? 1 : -1;
      twigs.push([tx, H / 2, tx + 90, H / 2 + side * p.r(50, 90), 1]);
    }
    for (const [x0, y0, x1, y1, lvl] of twigs) {
      const L = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0);
      const steps = L / 3;
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t;
        const nl = (lvl ? 26 : 34) * (1 - t * 0.55);
        for (const side of [-1, 1]) {
          const na = a + side * (0.9 + p.r(-0.2, 0.2)) - 0.25;
          const litK = clamp01((side < 0 ? 0.7 : 0.35) + p.r(-0.25, 0.25) - lvl * 0.05);
          const col = litK < 0.5 ? mix(pal[0], pal[1], litK * 2) : mix(pal[1], pal[2], (litK - 0.5) * 2);
          x.strokeStyle = css(col); x.lineWidth = 2.2; x.lineCap = 'round';
          x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(na) * nl, py + Math.sin(na) * nl); x.stroke();
          if (p.rng() < 0.25) {
            x.strokeStyle = css(pal[3], 0.8); x.lineWidth = 1.2;
            x.beginPath(); x.moveTo(px + Math.cos(na) * nl * 0.5, py + Math.sin(na) * nl * 0.5); x.lineTo(px + Math.cos(na) * nl, py + Math.sin(na) * nl); x.stroke();
          }
        }
      }
      x.strokeStyle = css(hex('#5a3d24')); x.lineWidth = lvl ? 3 : 5;
      x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
    }
    return { map: p.texture({ repeat: false }) };
  });
}

// Palm frond: spine along the card length (left->right), dense overlapping leaflets both sides.
export function palmCardTex() {
  return cached('palmcard', () => {
    const W = 512, H = 256, p = new Painter(W, H, 251, { alpha: true });
    const pal = [hex('#3e5a1a'), hex('#5f8226'), hex('#8aa834'), hex('#b8c84c'), hex('#e4e08a')];
    const x = p.x;
    const N = 64;
    // back layer (darker, underside) then front layer
    for (const layer of [0, 1]) {
      for (let i = 0; i < N; i++) {
        const t = i / N, sx = 14 + t * (W - 34);
        const len = (Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.04)) * 112 + 14) * (layer ? 1 : 0.92);
        for (const side of [-1, 1]) {
          const ang = side * (0.62 + p.r(-0.08, 0.08)) + (layer ? 0 : side * 0.08);
          const k = layer ? (side < 0 ? p.r(0.55, 1) : p.r(0.3, 0.7)) : p.r(0.05, 0.35);
          const seg = k * (pal.length - 1), ii = Math.min(pal.length - 2, Math.floor(seg));
          const col = mix(pal[ii], pal[ii + 1], seg - ii);
          x.fillStyle = css(col);
          leafShape(x, sx, H / 2, len, Math.max(5, len * 0.11), ang);
          if (layer) {
            x.strokeStyle = css(mix(col, pal[4], 0.5), 0.55); x.lineWidth = 1;
            x.beginPath(); x.moveTo(sx, H / 2); x.lineTo(sx + Math.cos(ang) * len * 0.9, H / 2 + Math.sin(ang) * len * 0.9); x.stroke();
          }
        }
      }
    }
    x.strokeStyle = css(hex('#7a6a30')); x.lineWidth = 5; x.lineCap = 'round';
    x.beginPath(); x.moveTo(8, H / 2); x.lineTo(W - 12, H / 2); x.stroke();
    x.strokeStyle = css(hex('#c8b870'), 0.7); x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(8, H / 2 - 1.5); x.lineTo(W - 12, H / 2 - 1.5); x.stroke();
    return { map: p.texture({ repeat: false }) };
  });
}

// Grass tuft card: blades rising from the bottom centre.
export function grassCardTex(key = 'grass', palette = ['#3f5f22', '#6f9230', '#a9c050', '#dce27e'], { blades = 70, h = 0.95 } = {}) {
  return cached('grasscard:' + key, () => {
    const W = 256, H = 256, p = new Painter(W, H, 261 + key.length, { alpha: true });
    const pal = palette.map(hex);
    const x = p.x;
    for (let i = 0; i < blades; i++) {
      const bx = W / 2 + p.r(-W * 0.36, W * 0.36);
      const tip = [bx + p.r(-50, 50), H * (1 - h * p.r(0.45, 1))];
      const wBase = p.r(4, 8);
      const g = x.createLinearGradient(0, H, 0, tip[1]);
      const k = p.rng();
      g.addColorStop(0, css(pal[0]));
      g.addColorStop(0.5, css(mix(pal[1], pal[2], k)));
      g.addColorStop(1, css(mix(pal[2], pal[3], k)));
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(bx - wBase, H);
      x.quadraticCurveTo(bx - wBase * 0.3 + (tip[0] - bx) * 0.3, (H + tip[1]) / 2, tip[0], tip[1]);
      x.quadraticCurveTo(bx + wBase * 0.3 + (tip[0] - bx) * 0.3, (H + tip[1]) / 2, bx + wBase, H);
      x.fill();
    }
    return { map: p.texture({ repeat: false }) };
  });
}

// Ripe wheat card: golden stalks topped with plump grain heads.
export function wheatCardTex() {
  return cached('wheatcard', () => {
    const W = 256, H = 256, p = new Painter(W, H, 267, { alpha: true });
    const x = p.x;
    for (let i = 0; i < 34; i++) {
      const bx = W / 2 + p.r(-100, 100), top = p.r(18, 80), lean = p.r(-22, 22);
      const k = p.rng();
      x.strokeStyle = css(mix(hex('#a88a3a'), hex('#e8cc6a'), k)); x.lineWidth = 2.2;
      x.beginPath(); x.moveTo(bx - lean * 0.3, H); x.quadraticCurveTo(bx, H * 0.55, bx + lean, top + 30); x.stroke();
      // grain head: stacked kernels along the tip
      for (let g = 0; g < 9; g++) {
        const t = g / 9;
        const gx = bx + lean * (1 - t * 0.05), gy = top + 30 - t * 34;
        const col = mix(hex('#c89a3a'), hex('#fff0a8'), Math.min(1, k * 0.6 + t * 0.5));
        for (const sd of [-1, 1]) p.blob(gx + sd * 3.2, gy, 3.4, 5.2, sd * 0.5, col, 1, null, false);
      }
      // awns
      x.strokeStyle = css(hex('#f6e8b0'), 0.7); x.lineWidth = 0.8;
      for (let a = 0; a < 5; a++) { x.beginPath(); x.moveTo(bx + lean, top + 2); x.lineTo(bx + lean + p.r(-10, 10), top - p.r(8, 20)); x.stroke(); }
    }
    return { map: p.texture({ repeat: false }) };
  });
}

// Meadow flowers card: round-petal daisies and buttercups on thin stems.
export function flowerCardTex() {
  return cached('flowercard', () => {
    const W = 256, H = 256, p = new Painter(W, H, 265, { alpha: true });
    const x = p.x;
    const stems = hex('#4f6e26');
    for (let i = 0; i < 26; i++) {
      const bx = W / 2 + p.r(-90, 90), by = p.r(70, 200);
      x.strokeStyle = css(stems); x.lineWidth = 2;
      x.beginPath(); x.moveTo(W / 2 + p.r(-25, 25), H); x.quadraticCurveTo(bx, (H + by) / 2 + 20, bx, by); x.stroke();
      // leaf on the stem
      x.fillStyle = css(hex('#6a8f30'));
      leafShape(x, bx + p.r(-6, 6), (H + by) / 2 + 20, 18, 6, p.r(-2.6, -0.5));
    }
    const heads = [];
    for (let i = 0; i < 26; i++) heads.push([W / 2 + p.r(-90, 90), p.r(70, 200)]);
    for (const [bx, by] of heads) {
      const white = p.rng() < 0.6;
      const pc = white ? hex('#f6f2e4') : hex('#ffd24a');
      const r = p.r(5, 8);
      // petals as a soft ring of round dots, centre disc
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        p.blob(bx + Math.cos(a) * r * 0.9, by + Math.sin(a) * r * 0.55, r * 0.55, r * 0.38, a, shade(pc, k < 5 ? 0.85 : 1), 1, null, false);
      }
      p.blob(bx, by, r * 0.45, r * 0.32, 0, white ? hex('#f0b830') : hex('#c87a20'), 1, null, false);
    }
    return { map: p.texture({ repeat: false }) };
  });
}

// Fern frond card (left->right).
export function fernCardTex() {
  return cached('ferncard', () => {
    const W = 512, H = 192, p = new Painter(W, H, 271, { alpha: true });
    const pal = [hex('#2f5524'), hex('#4f7f30'), hex('#8db04a'), hex('#c5d870')];
    const x = p.x;
    for (let i = 0; i < 34; i++) {
      const t = i / 34, sx = 16 + t * (W - 40), len = Math.sin(Math.PI * Math.min(1, 0.15 + t)) * 78 + 6;
      for (const side of [-1, 1]) {
        const col = side < 0 ? mix(pal[1], pal[2], p.r(0.3, 1)) : mix(pal[0], pal[1], p.r(0.4, 1));
        x.fillStyle = css(col);
        x.beginPath();
        x.moveTo(sx, H / 2);
        x.quadraticCurveTo(sx + len * 0.35, H / 2 + side * len * 0.75, sx + len * 0.45, H / 2 + side * len * 0.95);
        x.quadraticCurveTo(sx + len * 0.12, H / 2 + side * len * 0.5, sx + 9, H / 2);
        x.fill();
      }
    }
    x.strokeStyle = css(hex('#4a5a24')); x.lineWidth = 3; x.lineCap = 'round';
    x.beginPath(); x.moveTo(8, H / 2); x.lineTo(W - 16, H / 2); x.stroke();
    return { map: p.texture({ repeat: false }) };
  });
}

// Hanging moss strands.
export function mossStrandTex() {
  return cached('moss', () => {
    const W = 128, H = 512, p = new Painter(W, H, 281, { alpha: true });
    const pal = [hex('#55702a'), hex('#7a9038'), hex('#a3b456')];
    const x = p.x;
    for (let i = 0; i < 40; i++) {
      const sx = p.r(10, W - 10), L = p.r(H * 0.4, H * 0.98);
      x.strokeStyle = css(p.pick(pal), 0.9); x.lineWidth = p.r(2, 5); x.lineCap = 'round';
      x.beginPath(); x.moveTo(sx, 0);
      x.bezierCurveTo(sx + p.r(-14, 14), L * 0.3, sx + p.r(-14, 14), L * 0.7, sx + p.r(-8, 8), L);
      x.stroke();
    }
    return { map: p.texture({ repeat: false }) };
  });
}

// Ivy / vine clump for walls and roofs.
export function ivyCardTex() {
  return leafCardTex('ivy', ['#2f4d1f', '#4c7228', '#79a038', '#b6cf62'], { leaves: 260, size: [16, 26] });
}

// Lavender spikes card.
export function lavenderCardTex() {
  return cached('lavender', () => {
    const W = 256, H = 256, p = new Painter(W, H, 291, { alpha: true });
    const x = p.x;
    const stems = hex('#55702a'), pal = [hex('#5e3d9a'), hex('#8a63cf'), hex('#b897ef')];
    for (let i = 0; i < 18; i++) {
      const bx = W / 2 + p.r(-80, 80), top = p.r(20, 90), lean = p.r(-30, 30);
      x.strokeStyle = css(stems); x.lineWidth = 2.5;
      x.beginPath(); x.moveTo(W / 2 + p.r(-20, 20), H); x.quadraticCurveTo(bx, H * 0.6, bx + lean, top); x.stroke();
      for (let k = 0; k < 14; k++) {
        const t = k / 14;
        const fx = bx + lean * (1 - t * 0.6) * 0.9, fy = top + t * 70;
        const col = mix(pal[2], pal[0], t);
        p.blob(fx + p.r(-3, 3), fy, 4.5 - t * 1.5, 3.5, 0, col, 1, null, false);
      }
    }
    return { map: p.texture({ repeat: false }) };
  });
}

// Water normal map (tileable)
export function waterNormalTex() {
  return cached('waternormal', () => {
    const S = 256, p = new Painter(S, S, 301, { height: true });
    p.pixels((u, v) => {
      const n = pfbm(u, v, 4, 4, 5) * 0.6 + pfbm(u, v, 9, 3, 6) * 0.4;
      return [128, 128, 128, n];
    });
    return p.normalMap(4);
  });
}

// Waterfall streaks: u across, v along flow.
export function waterfallTex() {
  return cached('waterfall', () => {
    const W = 256, H = 512, p = new Painter(W, H, 311, { alpha: true });
    p.pixels((u, v) => {
      const s = pfbm(u * 1, v * 0.08, 24, 3, 7);
      const s2 = pfbm(u, v * 0.2, 48, 2, 8);
      const k = sstep(0.35, 0.8, s * 0.7 + s2 * 0.4);
      const a = 120 + k * 135;
      const c = mix(hex('#5fb6c9'), [250, 255, 255], k);
      return [...c, 0, a];
    });
    return p.texture();
  });
}

// Soft radial glow sprite
export function glowTex() {
  return cached('glow', () => {
    const S = 128, c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

// Soft puff for smoke / steam / dust
export function puffTex() {
  return cached('puff', () => {
    const S = 128, p = new Painter(S, S, 321, { alpha: true });
    p.pixels((u, v) => {
      const d = Math.hypot(u - 0.5, v - 0.5) * 2;
      const n = pfbm(u, v, 4, 4, 3);
      const a = clamp01((1 - d) * 1.6 - 0.25 + (n - 0.5) * 0.9);
      const c = 210 + n * 45;
      return [c, c, c, 0, a * 255];
    });
    return p.texture({ repeat: false });
  });
}

// Gear-tooth friendly brass texture is metalTex tinted. Flame sprite for fires:
export function flameTex() {
  return cached('flame', () => {
    const S = 128, p = new Painter(S, S, 331, { alpha: true });
    p.pixels((u, v) => {
      const dx = (u - 0.5) * 2, dy = 1 - v;
      const w = (1 - dy) * 0.75 + 0.05;
      const n = pfbm(u, v, 3, 3, 9);
      const d = Math.abs(dx) / Math.max(0.05, w * (0.8 + n * 0.4));
      const a = clamp01(1 - d) * clamp01(dy * 3) * clamp01((1 - dy) * 1.2 + 0.2);
      const core = clamp01(1 - d * 1.6);
      const c = mix(hex('#ff7a1a'), hex('#fff2b0'), core);
      return [...c, 0, a * 255];
    });
    return p.texture({ repeat: false });
  });
}
