// Trees: structural generation (trunk, roots, branches) + card canopies with three-level wind.
import * as THREE from 'three';
import { Builder, tube, card, bbCard, ico, cyl, cone, lumpy, sphereNormals, rgb, lerp, sstep, clamp, V3, twist, taper, noise3 } from './kit.js';

// ---------- shared helpers ----------
const UP = V3(0, 1, 0);

// Vertex colours on textured surfaces are multipliers around 1.0 (the texture carries the albedo).
const MOSS_MUL = [0.85, 1.55, 0.55];
function barkColor(tint = '#ffffff', mossAmt = 0.5, groundDark = 1.2) {
  const t = rgb(tint);
  return (x, y, z, nx, ny) => {
    const ao = lerp(0.6, 1.08, sstep(-0.2, groundDark, y));
    const mk = sstep(0.35, 0.9, ny) * mossAmt;
    return [lerp(t[0], MOSS_MUL[0], mk) * ao, lerp(t[1], MOSS_MUL[1], mk) * ao, lerp(t[2], MOSS_MUL[2], mk) * ao];
  };
}

// trunk bend amplitude grows with the square of height
const bendAmp = (H, k) => (y) => k * Math.pow(clamp(y / H, 0, 1.4), 2) * H;

// A leafy cluster made of oriented cards around `c`.
export function leafCluster(b, mat, c, R, n, opts) {
  const { canopyC, tintLo, tintHi, yLo, yHi, wind, size = 1.25, upBias = 0.7, flutter = 0.05, segs = 2, core = null, coreK = 0.6 } = opts;
  const lo = rgb(tintLo), hi = rgb(tintHi);
  if (core) {
    // solid leaf-mass core so the canopy never reads as see-through
    const cg = lumpy(ico(R * coreK, 2), R * 0.16, 1.1 / R, Math.round(c.x * 13 + c.z * 7));
    const cw = wind(c);
    b.add(cg, core, {
      p: [c.x, c.y, c.z], uv: 'box', us: 0.5,
      c: (x, y, z, nx, ny) => {
        const k = clamp((ny * 0.5 + 0.5) * 0.55 + sstep(yLo, yHi, y) * 0.45, 0, 1) * 0.85;
        return [lerp(lo[0], hi[0], k), lerp(lo[1], hi[1], k), lerp(lo[2], hi[2], k)];
      },
      w: [cw[0], cw[1], 0.01, 0],
    });
  }
  for (let i = 0; i < n; i++) {
    // card centre on the outer shell of the cluster (upper half favoured so tops read fullest)
    const dir = V3(b.r(-1, 1), b.r(-0.55, 1) + upBias * 0.25, b.r(-1, 1)).normalize();
    const rr = R * b.r(0.55, 0.95);
    const pc = c.clone().addScaledVector(dir, rr);
    // shading normal: cluster sphere blended with the whole canopy sphere
    const nrm = pc.clone().sub(c).normalize().multiplyScalar(0.6).add(pc.clone().sub(canopyC).normalize().multiplyScalar(0.4)).normalize();
    const s = R * size * b.r(0.8, 1.15);
    const cw = wind(pc);
    const k = 0.5 + sstep(yLo, yHi, pc.y) * 0.32 + clamp(nrm.y * 0.5 + 0.5, 0, 1) * 0.18;
    const col = [lerp(lo[0], hi[0], k), lerp(lo[1], hi[1], k), lerp(lo[2], hi[2], k)];
    // depth pull: brighter (outer, upper) cards always draw over darker inner ones, so turning the camera never swaps them
    b.add(bbCard(pc, s, b.r(-0.35, 0.35), nrm, (k - 0.5) * R * 1.4), mat, { uv: 'keep', c: col, w: [cw[0], cw[1], flutter, 0] });
  }
}

export function rockGeo(seed, sx = 1, sy = 0.7, sz = 1, detail = 2) {
  const g = lumpy(ico(1, detail), 0.28, 1.3, seed, { flatBottom: -0.35 });
  g.scale(sx, sy, sz);
  return g;
}

export function addRock(b, p, scale, seed, { mat = 'rock', moss = 0.6, tint = '#ffffff', rot = 0 } = {}) {
  const t = rgb(tint), m = MOSS_MUL;
  b.add(rockGeo(seed, scale[0], scale[1], scale[2]), mat, {
    p, r: [0, rot, 0], uv: 'box',
    c: (x, y, z, nx, ny) => {
      const k = sstep(0.55, 0.95, ny) * moss;
      const ao = lerp(0.62, 1.12, sstep(p[1] - scale[1] * 0.3, p[1] + scale[1] * 0.6, y));
      return [lerp(t[0], m[0], k) * ao, lerp(t[1], m[1], k) * ao, lerp(t[2], m[2], k) * ao];
    },
  });
}

// crossed grass/plant cards with flutter at the top
export function addTuft(b, mat, p, w, h, rot = 0, tint = 0xffffff, n = 3) {
  const tt = rgb(tint);
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI;
    b.add(card(w, h, 1, 2), mat, {
      p: [p[0], p[1] + h / 2 - 0.02, p[2]], r: [0, a, 0], uv: 'keep',
      normals: (geo) => { const nr = geo.attributes.normal; for (let k = 0; k < nr.count; k++) nr.setXYZ(k, 0, 1, 0); },
      c: (x, y) => { const k = lerp(0.55, 1.05, sstep(p[1], p[1] + h, y)); return [tt[0] * k, tt[1] * k, tt[2] * k]; },
      w: (x, y) => { const k = sstep(p[1], p[1] + h, y); return [0, k * 0.06, k * 0.05, 0]; },
    });
  }
}

// buttress roots spreading from a trunk into the ground
function roots(b, mat, n, rTrunk, H, colorFn, seed = 0, { spread = 2.6, thick = 0.38 } = {}) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + b.r(-0.3, 0.3);
    const d = V3(Math.cos(a), 0, Math.sin(a));
    const L = spread * b.r(0.75, 1.2);
    const startY = b.r(0.5, 1.0);
    const side = V3(-d.z, 0, d.x).multiplyScalar(b.r(-0.25, 0.25));
    const pts = [
      d.clone().multiplyScalar(rTrunk * 0.45).setY(startY + 0.5),
      d.clone().multiplyScalar(rTrunk * 0.9).setY(startY * 0.75),
      d.clone().multiplyScalar(rTrunk + L * 0.35).add(side).setY(0.14),
      d.clone().multiplyScalar(rTrunk + L * 0.7).add(side.clone().multiplyScalar(2)).setY(-0.02),
      d.clone().multiplyScalar(rTrunk + L).add(side.clone().multiplyScalar(3)).setY(-0.45),
    ];
    const t0 = thick * b.r(0.85, 1.2);
    // flattened profile: wide at the trunk, thinning into the soil
    const g = tube(pts, (t) => t0 * Math.pow(1 - t, 0.7) * 0.9 + t0 * 0.18, 9, 18, { capEnd: false });
    b.add(g, mat, { uv: 'keep', us: [1, 1], c: colorFn });
  }
}

// ======================================================================
// OAK — broad, gnarled, mossy
// ======================================================================
export function oak(seed = 1, { scale = 1 } = {}) {
  const b = new Builder(seed * 101 + 7);
  const H = 4.6 * scale;
  const rBase = 0.82 * scale;
  const bark = barkColor('#fff6ea', 0.6, 1.4);
  const amp = bendAmp(H * 2.2, 0.05);
  const trunkW = (x, y, z) => [amp(y), 0, 0, 0];

  // trunk
  const lean = V3(b.r(-0.3, 0.3), 0, b.r(-0.3, 0.3));
  const trunkPts = [
    V3(0, -0.3, 0),
    V3(lean.x * 0.3, H * 0.3, lean.z * 0.3),
    V3(lean.x * 0.8 + b.r(-0.2, 0.2), H * 0.65, lean.z * 0.8),
    V3(lean.x, H, lean.z),
  ];
  const trunkTop = trunkPts[3];
  b.add(tube(trunkPts, (t) => rBase * (1 + 0.55 * Math.pow(Math.max(0, 1 - t / 0.16), 2)) * lerp(1, 0.62, t), 14, 18), 'bark', { uv: 'keep', c: bark, w: trunkW });
  roots(b, 'bark', 7, rBase, H, bark, seed, { spread: 2.4 * scale, thick: 0.42 * scale });

  // branches
  const canopyC = V3(trunkTop.x, H + 2.4 * scale, trunkTop.z);
  const clusters = [];
  const nMain = 5;
  for (let i = 0; i < nMain; i++) {
    const a = (i / nMain) * Math.PI * 2 + b.r(-0.4, 0.4);
    const d = V3(Math.cos(a), 0, Math.sin(a));
    const L = b.r(3.0, 4.2) * scale;
    const start = trunkPts[2].clone().lerp(trunkTop, b.r(0.3, 1));
    const pts = [
      start,
      start.clone().addScaledVector(d, L * 0.35).add(V3(0, L * 0.38, 0)),
      start.clone().addScaledVector(d, L * 0.7).add(V3(b.r(-0.4, 0.4), L * 0.55, b.r(-0.4, 0.4))),
      start.clone().addScaledVector(d, L).add(V3(0, L * 0.62, 0)),
    ];
    const r0 = rBase * 0.42;
    const sway = (x, y, z) => { const dd = Math.hypot(x - start.x, z - start.z); return [amp(y), 0.1 * sstep(0.3, L, dd) * scale, 0, 0]; };
    b.add(tube(pts, (t) => lerp(r0, r0 * 0.28, t), 9, 12), 'bark', { uv: 'keep', c: bark, w: sway });
    clusters.push({ c: pts[3].clone().add(V3(0, 0.5, 0)), R: b.r(1.7, 2.2) * scale });
    clusters.push({ c: pts[2].clone().add(V3(0, 0.6, 0)), R: b.r(1.4, 1.8) * scale });
    // sub-branches
    for (let k = 0; k < 2; k++) {
      const s0 = pts[1].clone().lerp(pts[2], b.r(0.2, 0.9));
      const sd = d.clone().applyAxisAngle(UP, (k ? 1 : -1) * b.r(0.6, 1.1));
      const sl = b.r(1.4, 2.2) * scale;
      const sp = [s0, s0.clone().addScaledVector(sd, sl * 0.55).add(V3(0, sl * 0.25, 0)), s0.clone().addScaledVector(sd, sl).add(V3(0, sl * 0.5, 0))];
      b.add(tube(sp, (t) => lerp(r0 * 0.4, 0.04, t), 6, 6), 'bark', { uv: 'keep', c: bark, w: sway });
      clusters.push({ c: sp[2].clone().add(V3(0, 0.3, 0)), R: b.r(1.2, 1.6) * scale });
    }
    // hanging moss under the main branch
    for (let m = 0; m < 2; m++) {
      const mp = pts[1].clone().lerp(pts[3], b.r(0.2, 0.8));
      const mh = b.r(1.1, 1.9) * scale;
      b.add(card(0.45 * scale, mh, 1, 4), 'moss', {
        p: [mp.x, mp.y - mh / 2 + 0.05, mp.z], r: [0, b.r(0, 3.14), 0], uv: 'keep',
        c: (x, y) => { const k = lerp(0.7, 1, sstep(mp.y - mh, mp.y, y)); return [0.9 * k, 0.95 * k, 0.75 * k]; },
        w: (x, y) => { const k = sstep(mp.y, mp.y - mh, y); return [amp(mp.y), 0.08 + k * 0.12, 0.02 * k, 0]; },
      });
    }
  }
  // crown top fill
  clusters.push({ c: canopyC.clone(), R: 2.4 * scale });
  clusters.push({ c: canopyC.clone().add(V3(b.r(-1, 1), 1.0 * scale, b.r(-1, 1))), R: 1.8 * scale });

  const yLo = H - 0.5, yHi = H + 5.5 * scale;
  for (const cl of clusters) {
    const sway = (p) => [amp(p.y), 0.1 * sstep(0.5, 4.5, Math.hypot(p.x - trunkTop.x, p.z - trunkTop.z)) * scale, 0, 0];
    leafCluster(b, b.r() < 0.35 ? 'leafOakYoung' : 'leafOak', cl.c, cl.R, Math.round(7 + cl.R * 3.5), {
      canopyC, tintLo: '#a4ac8c', tintHi: '#ffffff', yLo, yHi, wind: sway, size: 1.45, upBias: 0.8, core: 'coreOak',
    });
  }

  // base dressing: rocks, ferns, flowers
  for (let i = 0; i < 3; i++) {
    const a = b.r(0, 6.28), d = b.r(1.6, 2.8) * scale;
    addRock(b, [Math.cos(a) * d, 0.0, Math.sin(a) * d], [b.r(0.4, 0.75), b.r(0.3, 0.5), b.r(0.4, 0.7)], seed * 13 + i, { rot: b.r(0, 6) });
  }
  for (let i = 0; i < 5; i++) {
    const a = b.r(0, 6.28), d = b.r(1.2, 3.2) * scale;
    addTuft(b, i % 2 ? 'fern' : 'grassCard', [Math.cos(a) * d, 0, Math.sin(a) * d], b.r(0.8, 1.3), b.r(0.5, 0.8), b.r(0, 3));
  }
  return { builder: b, collider: { r: rBase * 1.1 }, height: H + 5 * scale };
}

// One drooping conifer tier: a jagged skirt from the trunk to a pointed rim.
function pineSkirt(b, yTop, R, h, seed, amp, scale) {
  const N = 22; // angular segments (rim alternates tip / notch)
  const rings = [
    [0.1, 0.0], [0.5, 0.12], [0.8, 0.34], [0.93, 0.66], [1.0, 1.0],
  ];
  const pos = [], uv = [], idx = [];
  const rep = Math.max(2, Math.round((2 * Math.PI * R) / 2.4));
  const jit = (a, j) => 1 + (noise3(Math.cos(a) * 2, Math.sin(a) * 2, j, seed) - 0.5) * 0.18;
  for (let j = 0; j < rings.length; j++) {
    const [rk, yk] = rings[j];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const tip = j === rings.length - 1 ? (i % 2 === 0 ? 1 : 0.8) : 1;
      const r = R * rk * tip * jit(a, j);
      const droop = j === rings.length - 1 && i % 2 === 1 ? h * 0.22 : 0;
      const y = yTop - h * yk + droop;
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
      uv.push((i / N) * rep, 1 - (j / (rings.length - 1)) * (h / 2.2));
    }
  }
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < N; i++) {
    const a = j * (N + 1) + i, c = a + N + 1;
    idx.push(a, a + 1, c, a + 1, c + 1, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  b.add(g, 'pineSkirt', {
    uv: 'keep',
    c: (x, y, z) => {
      const rr = Math.hypot(x, z) / R;
      const k = lerp(0.42, 1.12, Math.pow(clamp(rr, 0, 1), 0.9));
      const tipK = sstep(0.8, 1.0, rr);
      return [k * lerp(1, 1.12, tipK), k * lerp(1, 1.1, tipK), k * lerp(1, 0.85, tipK)];
    },
    w: (x, y, z) => { const rr = clamp(Math.hypot(x, z) / R, 0, 1); return [amp(y), 0.07 * rr * scale, 0.012 * rr, 0]; },
  });
}

// ======================================================================
// PINE — stacked drooping tiers of needles
// ======================================================================
export function pine(seed = 1, { scale = 1 } = {}) {
  const b = new Builder(seed * 37 + 3);
  const H = b.r(9.0, 11.0) * scale;
  const r0 = 0.34 * scale;
  const bark = barkColor('#f4e2d8', 0.2, 1.2);
  const amp = bendAmp(H, 0.045);
  b.add(tube([V3(0, -0.3, 0), V3(b.r(-0.08, 0.08), H * 0.5, b.r(-0.08, 0.08)), V3(0, H * 0.97, 0)], (t) => lerp(r0 * 1.25, 0.05, t) * (1 + 0.55 * Math.pow(Math.max(0, 1 - t / 0.07), 2)), 10, 16), 'barkDark',
    { uv: 'keep', c: bark, w: (x, y) => [amp(y), 0, 0, 0] });
  roots(b, 'barkDark', 5, r0, H, bark, seed, { spread: 1.2 * scale, thick: 0.22 * scale });

  const tiers = 6;
  const baseY = 2.0 * scale;
  const h0 = 1.8 * scale;
  const spacing = (H - (baseY + h0)) / (tiers - 1);
  for (let t = 0; t < tiers; t++) {
    const k = t / (tiers - 1);
    const R = lerp(3.5, 1.05, Math.pow(k, 0.8)) * scale * b.r(0.94, 1.06);
    const h = lerp(1.8, 1.05, k) * scale;
    const yTop = baseY + h0 + t * spacing;
    pineSkirt(b, yTop, R, h, seed * 11 + t, amp, scale);
    // spiky tufts along the drooping rim break up the silhouette
    const n = Math.round(lerp(11, 4, k));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + b.r(-0.25, 0.25) + t;
      const rr = R * b.r(0.78, 0.95);
      const y = yTop - h * lerp(0.34, 0.8, (rr / R - 0.78) / 0.17) + 0.12 * scale;
      const pc = V3(Math.cos(a) * rr, y, Math.sin(a) * rr);
      const nrm = V3(Math.cos(a), 0.7, Math.sin(a)).normalize();
      b.add(bbCard(pc, R * b.r(0.42, 0.55), b.r(-0.35, 0.35), nrm), 'pineClump', { uv: 'keep', c: [0.95, 0.95, 0.92], w: [amp(y), 0.07 * scale, 0.03, 0] });
    }
  }
  // leader tip
  const tipY = H + 0.2 * scale;
  b.add(bbCard(V3(0, tipY + 0.4 * scale, 0), 1.1 * scale, 0, V3(0, 1, 0)), 'pineClump', { uv: 'keep', c: [1.1, 1.1, 1.05], w: [amp(tipY), 0.03, 0.03, 0] });
  b.add(cone(0.35 * scale, 1.4 * scale, 8), 'pineSkirt', { p: [0, tipY + 0.3 * scale, 0], uv: 'box', us: 0.6, c: [0.9, 0.95, 0.85], w: [amp(tipY), 0.02, 0, 0] });

  for (let i = 0; i < 2; i++) {
    const a = b.r(0, 6.28), d = b.r(1.4, 2.4) * scale;
    addRock(b, [Math.cos(a) * d, 0, Math.sin(a) * d], [b.r(0.35, 0.6), b.r(0.25, 0.4), b.r(0.35, 0.55)], seed * 7 + i);
  }
  addTuft(b, 'fern', [b.r(-1, 1), 0, b.r(1.2, 1.8)], 1.0, 0.6, b.r(0, 3));
  return { builder: b, collider: { r: r0 * 1.6 }, height: H };
}

// ======================================================================
// LILAC — twisted violet trunk, umbrella of lilac florets, crystals at its feet
// ======================================================================
export function crystalCluster(b, p, scale, mat = 'crystalPurple', seed = 1, n = 5) {
  const rng = new Builder(seed);
  for (let i = 0; i < n; i++) {
    const h = scale * rng.r(0.5, 1.2) * (i === 0 ? 1.4 : 1);
    const rad = scale * rng.r(0.09, 0.16) * (i === 0 ? 1.3 : 1);
    const tilt = i === 0 ? rng.r(-0.1, 0.1) : rng.r(0.3, 0.75);
    const a = rng.r(0, Math.PI * 2);
    const g = cyl(rad, rad, h, 6, 1);
    g.translate(0, h / 2, 0);
    const tip = cone(rad, rad * 2.2, 6);
    tip.translate(0, h + rad * 1.1, 0);
    const off = i === 0 ? [0, 0] : [Math.cos(a) * scale * 0.12, Math.sin(a) * scale * 0.12];
    const o = {
      p: [p[0] + off[0], p[1] - 0.05, p[2] + off[1]], r: [Math.sin(a) * tilt, a, Math.cos(a) * tilt], order: 'YXZ', flat: true,
      c: (x, y, z, nx, ny) => { const k = 0.8 + ny * 0.3 + Math.abs(nx) * 0.1; return [k, k, k]; },
    };
    b.add(g, mat, o);
    b.add(tip, mat, o);
  }
}

export function lilac(seed = 1, { scale = 1 } = {}) {
  const b = new Builder(seed * 53 + 11);
  const H = 3.8 * scale;
  const bark = barkColor('#ffffff', 0.15, 1);
  const amp = bendAmp(H * 2, 0.05);
  // two twisted strands wrapped around each other
  for (let s = 0; s < 2; s++) {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, a = t * Math.PI * 2.2 + s * Math.PI;
      const rr = 0.22 * scale * (1 - t * 0.3);
      const bendx = Math.sin(t * 2.4) * 0.7 * scale;
      pts.push(V3(Math.cos(a) * rr + bendx, t * H - (i === 0 ? 0.3 : 0), Math.sin(a) * rr));
    }
    b.add(tube(pts, (t) => lerp(0.34, 0.2, t) * scale * (1 + 0.6 * Math.pow(Math.max(0, 1 - t / 0.12), 2)), 9, 26), 'barkPurple', { uv: 'keep', c: bark, w: (x, y) => [amp(y), 0, 0, 0] });
  }
  roots(b, 'barkPurple', 5, 0.4 * scale, H, bark, seed, { spread: 1.5 * scale, thick: 0.24 * scale });
  const top = V3(Math.sin(2.4) * 0.7 * scale, H, 0);
  const canopyC = top.clone().add(V3(0, 1.6 * scale, 0));
  const clusters = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + b.r(-0.3, 0.3);
    const d = V3(Math.cos(a), 0, Math.sin(a));
    const L = b.r(2.0, 3.0) * scale;
    const pts = [top.clone().add(V3(0, -0.4, 0)), top.clone().addScaledVector(d, L * 0.45).add(V3(0, L * 0.45, 0)), top.clone().addScaledVector(d, L).add(V3(0, L * 0.35, 0))];
    b.add(tube(pts, (t) => lerp(0.15 * scale, 0.04, t), 7, 9), 'barkPurple', { uv: 'keep', c: bark, w: (x, y, z) => [amp(y), 0.09 * sstep(0, L, Math.hypot(x - top.x, z - top.z)), 0, 0] });
    clusters.push({ c: pts[2].clone().add(V3(0, 0.25, 0)), R: b.r(1.2, 1.6) * scale });
    clusters.push({ c: pts[1].clone().add(V3(0, 0.55, 0)), R: b.r(1.0, 1.3) * scale });
  }
  clusters.push({ c: canopyC.clone(), R: 1.6 * scale });
  for (const cl of clusters) {
    const sway = (p) => [amp(p.y), 0.09 * sstep(0.3, 3, Math.hypot(p.x - top.x, p.z - top.z)), 0, 0];
    leafCluster(b, 'leafLilac', cl.c, cl.R, Math.round(7 + cl.R * 3.5), { canopyC, tintLo: '#8a7a9a', tintHi: '#ffffff', yLo: H, yHi: H + 3.5 * scale, wind: sway, size: 1.45, upBias: 0.9, core: 'coreLilac' });
  }
  // fallen blossoms + crystals
  crystalCluster(b, [1.2 * scale, 0, 0.8 * scale], 0.9 * scale, 'crystalPurple', seed * 3 + 1, 6);
  crystalCluster(b, [-1.0 * scale, 0, 1.1 * scale], 0.6 * scale, 'crystalPurple', seed * 3 + 2, 4);
  crystalCluster(b, [0.2 * scale, 0, -1.3 * scale], 0.5 * scale, 'crystalPurple', seed * 3 + 3, 3);
  for (let i = 0; i < 2; i++) addRock(b, [b.r(-1.6, 1.6), 0, b.r(-1.6, 1.6)], [0.4, 0.3, 0.45], seed * 5 + i, { moss: 0.3 });
  return { builder: b, collider: { r: 0.7 * scale }, height: H + 3 * scale, glows: [{ p: [1.2 * scale, 0.7 * scale, 0.8 * scale], color: 0xb070ff, size: 2.4 }] };
}

// ======================================================================
// PALM — ringed curved trunk and drooping fronds
// ======================================================================
function frond(b, base, dir, L, W, droop, seed, amp) {
  // spine curve rising then drooping
  const side = V3(0, 1, 0).cross(dir).normalize();
  const segs = 12;
  const pos = [], uv = [], idx = [];
  const spine = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = base.clone().addScaledVector(dir, L * t).add(V3(0, Math.sin(t * Math.PI * 0.6) * L * 0.35 - t * t * droop * L, 0));
    spine.push(p);
  }
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = W * Math.sin(Math.PI * Math.min(1, t * 1.08 + 0.05));
    const p = spine[i];
    // V-fold: edges dip below the spine
    for (let j = 0; j < 3; j++) {
      const s = j - 1;
      const q = p.clone().addScaledVector(side, s * w).add(V3(0, -Math.abs(s) * w * 0.45, 0));
      pos.push(q.x, q.y, q.z);
      uv.push(t, j / 2);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < 2; j++) {
    const a = i * 3 + j, c = a + 3;
    idx.push(a, c, a + 1, c, c + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  b.add(g, 'leafPalm', {
    uv: 'keep',
    normals: sphereNormals(base.clone().add(V3(0, -1.5, 0)), 0.5),
    c: (x, y, z) => { const d = Math.hypot(x - base.x, z - base.z) / L; const k = 0.9 + d * 0.3; return [k, k, k * 0.95]; },
    w: (x, y, z) => { const d = clamp(Math.hypot(x - base.x, z - base.z) / L, 0, 1); return [amp(base.y), 0.16 * d * d, 0.05 * d, 0.0]; },
  });
}

export function palm(seed = 1, { scale = 1 } = {}) {
  const b = new Builder(seed * 71 + 5);
  const H = b.r(6.0, 7.5) * scale;
  const amp = bendAmp(H, 0.06);
  const curve = V3(b.r(0.8, 1.6), 0, b.r(-0.6, 0.6)).multiplyScalar(scale);
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    pts.push(V3(curve.x * t * t, t * H - (i === 0 ? 0.3 : 0), curve.z * t * t));
  }
  const bark = barkColor('#ffffff', 0, 1);
  const trunk = tube(pts, (t) => lerp(0.32, 0.22, t) * scale * (1 + 0.4 * Math.pow(Math.max(0, 1 - t / 0.1), 2)), 10, 30);
  b.add(trunk, 'barkPalm', { uv: 'keep', c: bark, w: (x, y) => [amp(y), 0, 0, 0] });
  // ring collars (overlapping scale bands)
  const curveObj = trunk.userData.curve;
  for (let i = 1; i < 16; i++) {
    const t = i / 16, p = curveObj.getPointAt(t), tan = curveObj.getTangentAt(t);
    const r = lerp(0.34, 0.24, t) * scale;
    const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), tan);
    const g = cyl(r * 1.08, r * 0.96, 0.16 * scale, 10, 1, true);
    b.add(g, 'barkPalm', { q, p: [p.x, p.y, p.z], uv: 'keep', us: [2, 0.3], c: (x, y) => { const k = lerp(0.6, 1, sstep(p.y - 0.08, p.y + 0.08, y)); return [0.95 * k, 0.85 * k, 0.7 * k]; }, w: (x, y) => [amp(y), 0, 0, 0] });
  }
  const top = curveObj.getPointAt(1);
  // crown husk
  b.add(lumpy(ico(0.38 * scale, 1), 0.06, 4, seed), 'barkPalm', { p: [top.x, top.y + 0.1, top.z], uv: 'box', c: '#9a8058', w: [amp(H), 0, 0, 0] });
  // coconuts
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    b.add(lumpy(ico(0.16 * scale, 1), 0.02, 6, seed + i), 'woodDark', { p: [top.x + Math.cos(a) * 0.28 * scale, top.y - 0.15 * scale, top.z + Math.sin(a) * 0.28 * scale], uv: 'box', c: '#8a6a3a', w: [amp(H), 0.01, 0, 0] });
  }
  const nF = 10;
  for (let i = 0; i < nF; i++) {
    const a = (i / nF) * Math.PI * 2 + b.r(-0.2, 0.2);
    const dir = V3(Math.cos(a), b.r(-0.05, 0.25), Math.sin(a)).normalize();
    frond(b, top.clone().add(V3(0, 0.25 * scale, 0)), dir, b.r(3.0, 3.8) * scale, 1.0 * scale, b.r(0.55, 0.9), seed + i, amp);
  }
  // young upright fronds
  for (let i = 0; i < 3; i++) {
    const a = b.r(0, 6.28);
    frond(b, top.clone().add(V3(0, 0.3 * scale, 0)), V3(Math.cos(a) * 0.4, 1, Math.sin(a) * 0.4).normalize(), 1.9 * scale, 0.6 * scale, 0.2, seed + 20 + i, amp);
  }
  // sand mound, rocks, dry grass
  addRock(b, [0.9 * scale, 0, 0.6 * scale], [0.55, 0.4, 0.5], seed * 3, { mat: 'rockSand', moss: 0, tint: '#ffffff' });
  addRock(b, [-0.7 * scale, 0, -0.5 * scale], [0.4, 0.5, 0.35], seed * 3 + 1, { mat: 'rockSand', moss: 0, tint: '#f4ece0' });
  addTuft(b, 'grassCard', [0.4, 0, -0.9], 1.0, 0.6, 0.5, '#e8d890');
  addTuft(b, 'grassCard', [-1.0, 0, 0.6], 0.8, 0.5, 1.5, '#e8d890');
  return { builder: b, collider: { r: 0.4 * scale }, height: H + 1.5 };
}

// ======================================================================
// GLOWBARK — golden luminous tree with hanging lanterns
// ======================================================================
export function glowbark(seed = 1, { scale = 1 } = {}) {
  const b = new Builder(seed * 91 + 13);
  const H = 4.2 * scale;
  const bark = barkColor('#ffffff', 0.1, 1);
  const amp = bendAmp(H * 2, 0.05);
  const strands = 3;
  for (let s = 0; s < strands; s++) {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, a = t * Math.PI * 1.6 + (s / strands) * Math.PI * 2;
      const rr = 0.26 * scale * (1 - t * 0.4);
      pts.push(V3(Math.cos(a) * rr + Math.sin(t * 2) * 0.4 * scale, t * H - (i === 0 ? 0.3 : 0), Math.sin(a) * rr));
    }
    b.add(tube(pts, (t) => lerp(0.28, 0.14, t) * scale * (1 + 0.7 * Math.pow(Math.max(0, 1 - t / 0.14), 2)), 8, 26), 'barkGold', { uv: 'keep', c: bark, w: (x, y) => [amp(y), 0, 0, 0] });
  }
  // luminous sap vein spiralling up the trunk
  const vein = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14, a = t * Math.PI * 3.2;
    const rr = 0.42 * scale * (1 - t * 0.45) + 0.05;
    vein.push(V3(Math.cos(a) * rr + Math.sin(t * 2) * 0.4 * scale, t * H * 0.85 + 0.05, Math.sin(a) * rr));
  }
  b.add(tube(vein, 0.035 * scale, 5, 40), 'glowGreen', { uv: 'keep', c: 0xffffff, w: (x, y) => [amp(y), 0, 0, 0] });
  roots(b, 'barkGold', 6, 0.42 * scale, H, bark, seed, { spread: 1.7 * scale, thick: 0.25 * scale });
  const top = V3(Math.sin(2) * 0.4 * scale, H, 0);
  const canopyC = top.clone().add(V3(0, 1.7 * scale, 0));
  const clusters = [], lanterns = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + b.r(-0.3, 0.3);
    const d = V3(Math.cos(a), 0, Math.sin(a));
    const L = b.r(2.2, 3.0) * scale;
    const pts = [top.clone().add(V3(0, -0.5, 0)), top.clone().addScaledVector(d, L * 0.5).add(V3(0, L * 0.4, 0)), top.clone().addScaledVector(d, L).add(V3(0, L * 0.25, 0))];
    b.add(tube(pts, (t) => lerp(0.14 * scale, 0.035, t), 7, 9), 'barkGold', { uv: 'keep', c: bark, w: (x, y, z) => [amp(y), 0.09 * sstep(0, L, Math.hypot(x - top.x, z - top.z)), 0, 0] });
    clusters.push({ c: pts[2].clone().add(V3(0, 0.3, 0)), R: b.r(1.2, 1.6) * scale });
    clusters.push({ c: pts[1].clone().add(V3(0, 0.6, 0)), R: b.r(1.0, 1.3) * scale });
    if (i % 2 === 0) lanterns.push({ p: pts[1].clone().lerp(pts[2], 0.6).toArray(), len: b.r(0.7, 1.2) * scale, color: i % 4 === 0 ? 'green' : 'yellow' });
  }
  clusters.push({ c: canopyC.clone(), R: 1.7 * scale });
  for (const cl of clusters) {
    const sway = (p) => [amp(p.y), 0.09 * sstep(0.3, 3, Math.hypot(p.x - top.x, p.z - top.z)), 0, 0];
    leafCluster(b, 'leafGlow', cl.c, cl.R, Math.round(7 + cl.R * 3.5), { canopyC, tintLo: '#b0aa80', tintHi: '#ffffff', yLo: H, yHi: H + 3.5 * scale, wind: sway, size: 1.45, upBias: 0.9, core: 'coreGlow' });
  }
  crystalCluster(b, [1.0 * scale, 0, -0.9 * scale], 0.55 * scale, 'crystalGreen', seed + 1, 4);
  for (let i = 0; i < 6; i++) {
    const a = b.r(0, 6.28), d = b.r(1.0, 2.6) * scale;
    addTuft(b, i % 2 ? 'grassCard' : 'lavender', [Math.cos(a) * d, 0, Math.sin(a) * d], b.r(0.6, 0.9), b.r(0.45, 0.7), b.r(0, 3));
  }
  return { builder: b, collider: { r: 0.6 * scale }, height: H + 3.5 * scale, lanterns, glows: [{ p: [0, 1.4, 0], color: 0x9ae86a, size: 3.0 }, { p: [canopyC.x, canopyC.y, canopyC.z], color: 0xfff0a0, size: 7.0, intensity: 0.35 }] };
}

// ======================================================================
// BUSHES
// ======================================================================
export function bush(seed = 1, { kind = 'green', scale = 1 } = {}) {
  const b = new Builder(seed * 17 + 1);
  const R = 0.75 * scale;
  const mat = kind === 'red' ? 'bushRed' : 'bushGreen';
  const c0 = V3(0, R * 0.7, 0);
  for (let i = 0; i < 3; i++) {
    const c = c0.clone().add(V3(b.r(-0.3, 0.3), b.r(-0.1, 0.2), b.r(-0.3, 0.3)).multiplyScalar(scale));
    leafCluster(b, mat, c, R * b.r(0.75, 1), 7, {
      canopyC: c0.clone().add(V3(0, -0.2, 0)), tintLo: '#7a8a60', tintHi: '#ffffff', yLo: 0, yHi: R * 1.8,
      wind: (p) => [0.02, 0.03, 0, 0], size: 1.45, upBias: 0.6, flutter: 0.03, core: 'coreBush', coreK: 0.62,
    });
  }
  // a few twigs at the base
  for (let i = 0; i < 4; i++) {
    const a = b.r(0, 6.28);
    b.add(tube([V3(0, -0.1, 0), V3(Math.cos(a) * 0.25, 0.35, Math.sin(a) * 0.25).multiplyScalar(scale)], 0.03 * scale, 4, 2), 'bark', { uv: 'keep', c: '#806048' });
  }
  return { builder: b, collider: null, height: R * 1.8 };
}

export function fernPlant(seed = 1, { scale = 1 } = {}) {
  const b = new Builder(seed * 29 + 3);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + b.r(-0.2, 0.2);
    const L = b.r(0.9, 1.25) * scale;
    const dir = V3(Math.cos(a), 0, Math.sin(a));
    // arched frond: a card bent along its length
    const g = card(L, L * 0.38, 6, 1);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k) + L / 2; // 0..L
      p.setY(k, p.getY(k));
      p.setZ(k, Math.sin((x / L) * Math.PI * 0.9) * L * 0.45 - (x / L) * (x / L) * L * 0.25);
    }
    g.translate(L / 2, 0, 0);
    g.computeVertexNormals();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + 0.25, -a, 0, 'YXZ'));
    b.add(g, 'fern', {
      q, p: [0, 0.05, 0], uv: 'keep',
      normals: (geo) => { const nr = geo.attributes.normal; for (let k = 0; k < nr.count; k++) nr.setXYZ(k, 0, 1, 0); },
      c: (x, y, z) => { const k = 0.65 + sstep(0, L, Math.hypot(x, z)) * 0.45; return [k, k, k]; },
      w: (x, y, z) => { const d = sstep(0, L, Math.hypot(x, z)); return [0, 0.06 * d, 0.03 * d, 0]; },
    });
  }
  return { builder: b, collider: null, height: 0.8 * scale };
}
