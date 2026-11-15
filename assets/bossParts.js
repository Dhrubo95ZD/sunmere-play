// Hero detailing kit for the boss machines: layered armour plates with trim lips and bolt rows, louvred furnace vents,
// solid flywheels with an offset bolt plate, piston sleeves, square stacks with flat hoods, and a tread unit whose
// track runs actually crawl. Every piece is added to a Builder so the boss still merges per material.
// Content rules: no spokes, no eyes-and-mouth layouts, no domes, rings round a head, stars or radiating patterns.
import * as THREE from 'three';
import { Builder, box, rbox, cyl, lathe, gear, rgb } from './kit.js';

export const PI = Math.PI;
export const sub = (fn, seed = 1) => { const s = new Builder(seed); fn(s); return s; };
export const part = (fn, seed = 1) => sub(fn, seed).build();
export const pivot = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

// per-vertex wear: soft streaky darkening with a slight warm/cool drift
export function wear(base, amt = 0.22, seed = 0) {
  const c0 = rgb(base);
  return (x, y, z) => {
    const n = 0.5 + 0.5 * Math.sin(x * 9.1 + z * 6.3 + seed) * Math.sin(y * 7.7 - x * 3.1 + seed * 1.7);
    const g = 0.5 + 0.5 * Math.sin(x * 2.3 - y * 1.7 + z * 2.9 + seed * 0.7);
    const k = 1 - amt * (n * 0.7 + g * 0.3), w = 1 + (n - 0.5) * amt * 0.3;
    return [c0[0] * k * w, c0[1] * k, c0[2] * k / w];
  };
}
// grime that pools low on a part (soot and oil), on top of the streaks
export function grime(base, y0, y1, amt = 0.25, seed = 0) {
  const f = wear(base, amt, seed);
  return (x, y, z) => { const c = f(x, y, z), t = Math.max(0, Math.min(1, (y - y0) / (y1 - y0 || 1))), k = 0.62 + 0.38 * t; return [c[0] * k, c[1] * k, c[2] * k]; };
}

// bevelled solid disc on the y axis: wheels, flywheels and hub caps are always solid, never spoked
export const bdisc = (r, w, e = Math.min(r * 0.14, w * 0.3), seg = 24) => lathe([[0.001, -w / 2], [r - e, -w / 2], [r, -w / 2 + e], [r, w / 2 - e], [r - e, w / 2], [0.001, w / 2]], seg);

const AX = { x: [0, 0, PI / 2], y: [0, 0, 0], z: [PI / 2, 0, 0] };
export function bolt(b, mat, p, r = 0.03, axis = 'z', c = 0xffffff) { b.add(cyl(r, r, r * 0.9, 6), mat, { p, r: AX[axis], c }); }
export function bolts(b, mat, a, z, n, r = 0.03, axis = 'z', c = 0xffffff) {
  for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1); bolt(b, mat, [a[0] + (z[0] - a[0]) * t, a[1] + (z[1] - a[1]) * t, a[2] + (z[2] - a[2]) * t], r, axis, c); }
}

// An armour plate facing +z, centred on the origin: a bevelled slab, a raised inner panel, trim lips top and bottom
// carrying bolt rows. Place it with b.addBuilder(plate(...), { p, r }).
export function plate(w, h, d, o = {}) {
  const { mat = 'wPaint', c = 0xffffff, c2 = null, trim = 'wIron', trimC = 0xffffff, boltMat = 'wBrass', boltC = 0xffffff, seed = 1, lips = true, inset = true, sideLips = false } = o;
  const br = o.br ?? Math.min(0.05, Math.max(0.016, Math.min(w, h) * 0.035));
  return sub((b) => {
    b.add(rbox(w, h, d, Math.min(d * 0.45, 0.07, w * 0.2, h * 0.2), 1), mat, { c });
    if (inset) b.add(rbox(w * 0.78, h * 0.56, d * 0.5, Math.min(d * 0.22, 0.035), 1), mat, { p: [0, 0, d * 0.5], c: c2 ?? c });
    if (lips) {
      const lh = Math.max(0.035, h * 0.1);
      for (const sy of [-1, 1]) {
        const y = sy * (h / 2 - lh / 2);
        b.add(rbox(w * 1.01, lh, d * 1.4, Math.min(lh * 0.3, d * 0.3), 1), trim, { p: [0, y, d * 0.2], c: trimC });
        const n = Math.max(2, Math.round(w / Math.max(0.1, br * 7)));
        bolts(b, boltMat, [-w / 2 + br * 2.4, y, d * 0.9 + br * 0.4], [w / 2 - br * 2.4, y, d * 0.9 + br * 0.4], n, br, 'z', boltC);
      }
    }
    if (sideLips) {
      const lw = Math.max(0.035, w * 0.07);
      for (const sx of [-1, 1]) b.add(rbox(lw, h * 0.8, d * 1.25, Math.min(lw * 0.3, d * 0.3), 1), trim, { p: [sx * (w / 2 - lw / 2), 0, d * 0.15], c: trimC });
    }
  }, seed);
}

// A furnace vent facing +z: a dark frame, a glowing bed behind, and horizontal louvres (one grille, never paired with lamps)
export function vent(w, h, o = {}) {
  const { frame = 'wDark', frameC = 0xffffff, glow = 'wGlowOrange', n = Math.max(3, Math.round(h / 0.11)), depth = 0.12, seed = 2 } = o;
  return sub((b) => {
    const fw = Math.max(0.05, Math.min(w, h) * 0.1);
    b.add(rbox(w, fw, depth, fw * 0.3, 1), frame, { p: [0, h / 2 - fw / 2, 0], c: frameC });
    b.add(rbox(w, fw, depth, fw * 0.3, 1), frame, { p: [0, -h / 2 + fw / 2, 0], c: frameC });
    for (const sx of [-1, 1]) b.add(rbox(fw, h, depth, fw * 0.3, 1), frame, { p: [sx * (w / 2 - fw / 2), 0, 0], c: frameC });
    b.add(box(w - fw * 1.6, h - fw * 1.6, 0.02), glow, { p: [0, 0, -depth * 0.25], c: 0xffffff });
    const ih = h - fw * 2;
    for (let i = 0; i < n; i++) b.add(box(w - fw * 2, Math.min(0.05, ih / n * 0.42), depth * 0.5), frame, { p: [0, -ih / 2 + (i + 0.5) * ih / n, depth * 0.05], r: [0.55, 0, 0], c: frameC });
  }, seed);
}

// A solid flywheel on the x axis: one plain bevelled disc with a square bolt plate off-centre on each face and nothing
// at its centre (a raised inner disc and a round hub read as a disc in a ring, an eye, and over a lit slot a face), so the
// turn shows without any spoke pattern. Never spoked.
export function flywheel(r, w, o = {}) {
  const { mat = 'wIron', c = '#8a8278', hub = 'wBrass', hubC = 0xffffff, seed = 3 } = o;
  return sub((b) => {
    b.add(bdisc(r, w, Math.min(r * 0.1, w * 0.3), 28), mat, { r: [0, 0, PI / 2], c });
    for (const sx of [-1, 1]) {
      b.add(rbox(w * 0.2, r * 0.32, r * 0.32, Math.min(r * 0.03, w * 0.08)), hub, { p: [sx * w * 0.6, r * 0.58, 0], c: hubC });
      bolts(b, hub, [sx * w * 0.72, r * 0.58, -r * 0.09], [sx * w * 0.72, r * 0.58, r * 0.09], 2, r * 0.03, 'x', hubC);
    }
  }, seed);
}

// A square stack with banding and a flat raised hood (from above it is a square, never a ring)
export function stack(w, h, o = {}) {
  const { mat = 'wDark', c = '#3a3434', trim = 'wIron', trimC = '#6a6460', seed = 4 } = o;
  return sub((b) => {
    b.add(rbox(w, h, w, w * 0.08), mat, { p: [0, h / 2, 0], c: wear(c, 0.3, seed) });
    for (const y of [0.18, 0.62]) b.add(rbox(w * 1.12, h * 0.06, w * 1.12, w * 0.03, 1), trim, { p: [0, h * y, 0], c: trimC });
    b.add(rbox(w * 1.2, h * 0.08, w * 1.2, w * 0.04, 1), trim, { p: [0, h * 0.97, 0], c: trimC });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(w * 0.08, w * 0.35, w * 0.08), trim, { p: [sx * w * 0.5, h + w * 0.18, sz * w * 0.5], c: trimC });
    b.add(rbox(w * 1.35, w * 0.08, w * 1.35, w * 0.03, 1), trim, { p: [0, h + w * 0.38, 0], c: trimC });
  }, seed);
}

// A piston sleeve on the y axis (rod not included: give the rod its own pivot so it slides)
export function sleeve(r, h, o = {}) {
  const { mat = 'wIron', c = '#7a7672', trim = 'wBrass', trimC = 0xffffff, seed = 5 } = o;
  return sub((b) => {
    b.add(cyl(r, r, h, 12), mat, { c });
    for (const y of [-h / 2 + r * 0.3, h / 2 - r * 0.3]) b.add(cyl(r * 1.25, r * 1.25, r * 0.5, 12), trim, { p: [0, y, 0], c: trimC });
  }, seed);
}

// Tread unit: a side frame with armoured skirts, solid toothed sprockets at each end, solid road wheels between, and
// top and bottom track runs on their own pivots so the links crawl. Returns { wheels, runs, pitch }.
export function heroTreads(parent, o = {}) {
  const { gauge = 2, len = 4, h = 1, tw = 0.5, link = 'wIron', linkC = '#7a746c', frame = 'wDark', paint = 'wPaint', paintC = '#5a5a60', trim = 'wBrass', road = 2, seed = 70 } = o;
  const r = h / 2, pitch = Math.max(0.12, h * 0.16), n = Math.ceil(len / pitch);
  const wheels = [], runs = [];
  for (const sx of [-1, 1]) {
    const side = pivot(parent, sx * gauge / 2, 0, 0);
    side.add(part((b) => {
      // inner frame plate and the curved end guides
      b.add(rbox(tw * 0.3, h * 0.55, len, 0.04), frame, { p: [-sx * tw * 0.1, r, 0], c: 0xffffff });
      // armoured skirt over the upper run's outer face: a riveted plate with a trim lip
      b.addBuilder(plate(len * 0.94, h * 0.42, tw * 0.12, { mat: paint, c: wear(paintC, 0.3, seed), trim: 'wIron', trimC: '#5a5650', boltMat: trim, seed }), { p: [sx * (tw / 2 + 0.03), h * 0.8, 0], r: [0, sx * PI / 2, 0] });
      for (const ez of [-1, 1]) {
        // a stepped end guard over each sprocket
        b.add(rbox(tw * 1.05, h * 0.12, r * 1.3, 0.03), paint, { p: [0, h + h * 0.05, ez * (len / 2 - r * 0.2)], r: [ez * 0.35, 0, 0], c: wear(paintC, 0.3, seed + 1) });
      }
    }, seed));
    // track runs: flat links with a raised grouser each
    for (const [y, dir] of [[0.035 * h * 2, 1], [h - 0.035 * h * 2, -1]]) {
      const run = pivot(side, 0, y, 0);
      run.add(part((b) => {
        for (let i = 0; i < n; i++) {
          const z = -len / 2 + r * 0.6 + (i + 0.5) * ((len - r * 1.2) / n);
          if (Math.abs(z) > len / 2 - r * 0.6) continue;
          b.add(box(tw, h * 0.07, pitch * 0.82), link, { p: [0, 0, z], c: wear(linkC, 0.3, i) });
          if (dir > 0 || i % 2) b.add(box(tw * 0.92, h * 0.05, pitch * 0.18), link, { p: [0, dir * -h * 0.05, z], c: '#5a5650' });
        }
      }, seed + 2));
      runs.push({ run, dir, span: (len - r * 1.2) / n });
    }
    // end sprockets: solid toothed discs, the links wrap round them
    for (const ez of [-1, 1]) {
      const sp = pivot(side, 0, r, ez * (len / 2 - r * 0.62));
      sp.add(part((b) => {
        b.add(gear(12, r * 0.86, r * 1.0, tw * 0.9, { hole: 0, bevel: 0 }), link, { r: [0, PI / 2, 0], c: '#6a6460' });
        b.add(bdisc(r * 0.42, tw * 1.1, r * 0.06, 16), link, { r: [0, 0, PI / 2], c: '#9a8a6a' });
        b.add(rbox(tw * 1.16, r * 0.3, r * 0.2, 0.02), link, { p: [0, r * 0.32, 0], c: '#b09a60' });
      }, seed + 3));
      wheels.push(sp);
    }
    // road wheels between, partly behind the skirt
    for (let i = 0; i < road; i++) {
      const z = (-len / 2 + r * 1.6) + (i + 0.5) * ((len - r * 3.2) / road);
      const rw = pivot(side, 0, r * 0.62, z);
      rw.add(part((b) => {
        b.add(bdisc(r * 0.55, tw * 0.8, r * 0.06, 18), link, { r: [0, 0, PI / 2], c: '#5a5650' });
        b.add(rbox(tw * 0.9, r * 0.18, r * 0.14, 0.02), link, { p: [0, r * 0.3, 0], c: '#a89060' });
      }, seed + 4));
      wheels.push(rw);
    }
  }
  return { wheels, runs, pitch };
}
// crawl the track runs by a travelled distance: the bottom run moves back against the hull, the top run forward
export function crawl(runs, dist) {
  for (const R of runs) { const m = ((dist % R.span) + R.span) % R.span; R.run.position.z = R.dir > 0 ? -m : m - R.span; }
}
