// Small props from the concept sheet and village dressing.
import * as THREE from 'three';
import { Builder, rbox, box, cyl, cone, sphere, torus, lathe, extrude, card, lumpy, ico, V3, sstep } from './kit.js';
import { addRock, addTuft, crystalCluster } from './trees.js';
import { lanternBuilder } from './dynamic.js';
import { modelSlot, tripoEnabled } from './tripoModels.js';

const PI = Math.PI;

// lantern on a post with a curved arm
export function lanternPost(seed = 1, color = 'yellow') {
  const b = new Builder(seed);
  b.add(rbox(0.5, 0.35, 0.5, 0.06), 'stoneLarge', { p: [0, 0.15, 0], c: 0xffffff });
  b.add(cyl(0.07, 0.09, 3.0, 8), 'iron', { p: [0, 1.8, 0], c: 0xffffff });
  for (const y of [0.6, 3.2]) b.add(torus(0.09, 0.025, 6, 12), 'gold', { p: [0, y, 0], r: [PI / 2, 0, 0], c: 0xffffff });
  const pts = [V3(0, 3.2, 0), V3(0.1, 3.5, 0), V3(0.45, 3.55, 0), V3(0.7, 3.4, 0)];
  b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.035, 6), 'iron', { uv: 'keep', c: 0xffffff });
  b.add(sphere(0.07, 8, 6), 'gold', { p: [0, 3.32, 0], c: 0xffffff });
  return { builder: b, collider: { r: 0.3 }, lanterns: [{ p: [0.7, 3.38, 0], len: 0.22, color, scale: 1.4 }] };
}

export function signpost(seed = 2) {
  const b = new Builder(seed);
  b.add(cyl(0.09, 0.11, 2.6, 8), 'beam', { p: [0, 1.3, 0], c: 0xffffff });
  b.add(cone(0.12, 0.25, 8), 'gold', { p: [0, 2.72, 0], c: 0xffffff });
  // two arrow boards at different heights, about 126 degrees apart: from above a wide V, never a cross or an X
  const arrow = (len) => { const s = new THREE.Shape(); s.moveTo(0, -0.14); s.lineTo(len, -0.14); s.lineTo(len + 0.22, 0); s.lineTo(len, 0.14); s.lineTo(0, 0.14); s.closePath(); return s; };
  b.add(extrude(arrow(0.9), 0.07, 0.015, 4), 'woodLight', { p: [0.08, 2.15, 0], r: [0, 0.3, 0], c: 0xffffff, us: 1.2, boxuv: true });
  b.add(extrude(arrow(0.8), 0.07, 0.015, 4), 'woodLight', { p: [0, 1.65, 0], r: [0, 0.3 + 2.2, 0], c: '#e8d0b0', us: 1.2, boxuv: true });
  // (no grass tuft at the foot: its crossed cards read as an X from straight above)
  return { builder: b, collider: { r: 0.25 } };
}

export function fence(seed = 3, len = 3) {
  const b = new Builder(seed);
  const n = Math.max(2, Math.round(len / 1.5) + 1);
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (i * len) / (n - 1);
    b.add(rbox(0.22, 0.32, 0.22, 0.03), 'stoneLarge', { p: [x, 0.12, 0], c: 0xffffff });
    b.add(box(0.15, 1.1, 0.15), 'beam', { p: [x, 0.75, 0], c: 0xffffff });
    b.add(cone(0.12, 0.2, 4), 'gold', { p: [x, 1.4, 0], r: [0, PI / 4, 0], c: 0xffffff });
  }
  for (const y of [0.55, 1.0]) b.add(box(len, 0.1, 0.07), 'woodLight', { p: [0, y, 0.04], c: 0xffffff, us: 1 });
  // diamond medallion on the middle rail
  b.add(rbox(0.28, 0.28, 0.05, 0.02), 'gold', { p: [0, 0.78, 0.08], r: [0, 0, PI / 4], c: 0xffffff });
  return { builder: b };
}

export function well(seed = 4) {
  const b = new Builder(seed);
  b.add(lathe([[0.95, 0], [1.0, 0.1], [1.0, 0.8], [0.95, 0.9], [0.75, 0.9], [0.75, 0.0]], 20), 'stone', { c: '#f0e8d8', uv: 'box', us: 0.6 });
  b.add(cyl(0.74, 0.74, 0.05, 20), 'wellWater', { p: [0, 0.4, 0], c: 0xffffff });
  for (const sx of [-1, 1]) b.add(box(0.16, 1.9, 0.16), 'beam', { p: [sx * 0.85, 1.6, 0], c: 0xffffff });
  b.add(cyl(0.07, 0.07, 1.9, 8), 'beam', { p: [0, 2.2, 0], r: [0, 0, PI / 2], c: 0xffffff });
  // (RF.1) a straight gable roof: the ridge runs along the axle, two flat pitches and closed gable ends, so from straight
  // above it is a plain rectangle with one ridge line (the old four-sided pyramid drew an X of hip lines)
  const rw = 1.0, rh = 0.62, rl = 2.4, rs = Math.hypot(rw, rh), ra = Math.atan2(rh, rw);
  for (const sz of [-1, 1]) b.add(box(rl, 0.08, rs + 0.12), 'shingleWood', { p: [0, 2.55 + rh / 2, sz * rw / 2], r: [sz * ra, 0, 0], c: 0xffffff });
  const gab = new THREE.Shape(); gab.moveTo(-rw, 0); gab.lineTo(rw, 0); gab.lineTo(0, rh); gab.closePath();
  for (const sx of [-1, 1]) b.add(new THREE.ShapeGeometry(gab), 'beam', { p: [sx * 1.0, 2.55, 0], r: [0, sx * PI / 2, 0], c: 0xffffff });
  b.add(box(rl + 0.1, 0.1, 0.1), 'beam', { p: [0, 2.55 + rh + 0.03, 0], c: 0xffffff });
  b.add(cyl(0.012, 0.012, 1.3, 4), 'leather', { p: [0, 1.55, 0], c: '#c8b890' });
  b.add(lathe([[0.001, 0], [0.13, 0], [0.15, 0.22], [0.001, 0.22]], 10), 'wood', { p: [0, 0.85, 0], c: 0xffffff });
  return { builder: b, collider: { r: 1.05 } };
}

export function marketStall(seed = 5, color = '#3a5a9a') {
  const b = new Builder(seed);
  b.add(rbox(2.4, 0.9, 1.0, 0.04), 'wood', { p: [0, 0.45, 0], c: 0xffffff, us: 1 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(cyl(0.05, 0.05, 2.4, 8), 'woodDark', { p: [sx * 1.15, 1.2, sz * 0.5], c: 0xffffff });
  for (let i = 0; i < 4; i++) {
    const g = card(0.62, 1.4, 1, 4);
    b.add(g, 'clothWind', { p: [-0.93 + i * 0.62, 2.35, -0.05], r: [-PI / 2 + 0.25, 0, 0], uv: 'keep', c: i % 2 ? color : '#efe2c4', w: (x, y, z) => [0, 0, 0, 0.05 * sstep(-0.6, 0.6, z)] });
  }
  // produce: baskets of fruit (colored lumps), bread loaves
  for (let i = 0; i < 4; i++) {
    const x = -0.9 + i * 0.6;
    b.add(cyl(0.22, 0.18, 0.18, 12), 'wood', { p: [x, 0.98, 0.05], c: '#c8a070' });
    for (let k = 0; k < 6; k++) b.add(sphere(0.07, 8, 6), 'cloth', { p: [x + Math.cos(k) * 0.1, 1.1 + (k % 2) * 0.05, 0.05 + Math.sin(k) * 0.1], c: ['#d84a3a', '#e8b030', '#8ac040', '#c86a2a'][i] });
  }
  if (!tripoEnabled()) return { builder: b, collider: { r: 1.2 } };
  // the Tripo market stall (as village2.js marketStreet): the built one is its stand-in; the awning takes the colour
  // (a masked tint: only its red texels, above the goods), a red stall keeps the model's own red
  const red = new THREE.Color(color).r > 0.5 && new THREE.Color(color).b < 0.3;
  const tint = red ? null : { c: color, k: 0.9, b: 1.05, above: 0.455, red: true };
  return { builder: new Builder(seed), dynamics: [modelSlot('stall', { s: 4.1, fallback: b.build(), tint })], collider: { r: 1.5 } };
}

export function haystack(seed = 6) {
  const b = new Builder(seed);
  b.add(lumpy(sphere(1.0, 16, 10), 0.08, 3, seed), 'mossRoof', { p: [0, 0.6, 0], s: [1.1, 0.9, 1.1], c: '#ffe8a0', uv: 'box', us: 0.6 });
  for (let i = 0; i < 10; i++) addTuft(b, 'grassCard', [Math.cos(i) * 0.9, 0, Math.sin(i) * 0.9], 0.7, 0.5, i, '#f0e090', 2);
  return { builder: b, collider: { r: 1.0 } };
}

// a block of wheat rows
export function wheatField(seed = 7, w = 10, d = 8) {
  const b = new Builder(seed);
  for (let z = -d / 2; z < d / 2; z += 0.9) {
    b.add(box(w, 0.12, 0.5), 'cobble', { p: [0, 0.02, z], c: '#8a6a40', us: 0.6 });
    for (let x = -w / 2 + 0.4; x < w / 2; x += 0.55) { const ox = x + b.r(-0.1, 0.1), hh = b.r(0.75, 1.0), ry = b.r(-0.06, 0.06); for (const dz of [-0.1, 0.1]) addTuft(b, 'grassCard', [ox, 0, z + dz], 0.6, hh, ry, '#ffe890', 1); } // (RF.5) parallel cards along the row, never criss-crossed
  }
  // a low fence at the edge
  return { builder: b };
}

export function cart(seed = 8) {
  const b = new Builder(seed);
  b.add(rbox(2.2, 0.15, 1.2, 0.03), 'wood', { p: [0, 0.75, 0], c: 0xffffff, us: 1 });
  for (const sz of [-1, 1]) b.add(box(2.2, 0.45, 0.08), 'woodLight', { p: [0, 1.0, sz * 0.58], c: 0xffffff });
  for (const sx of [-1, 1]) b.add(box(0.08, 0.45, 1.2), 'woodLight', { p: [sx * 1.08, 1.0, 0], c: 0xffffff });
  for (const sz of [-1, 1]) {
    b.add(cyl(0.48, 0.48, 0.1, 16), 'woodDark', { p: [0.3, 0.48, sz * 0.7], r: [PI / 2, 0, 0], c: 0xffffff });
    b.add(torus(0.48, 0.03, 5, 18), 'iron', { p: [0.3, 0.48, sz * 0.72], c: 0xffffff });
  }
  b.add(cyl(0.04, 0.04, 1.8, 6), 'beam', { p: [-1.8, 0.62, 0.25], r: [0, 0, PI / 2 - 0.15], c: 0xffffff });
  b.add(cyl(0.04, 0.04, 1.8, 6), 'beam', { p: [-1.8, 0.62, -0.25], r: [0, 0, PI / 2 - 0.15], c: 0xffffff });
  for (let i = 0; i < 3; i++) b.add(sphere(0.25, 10, 8), 'cloth', { p: [0.5 - i * 0.55, 1.05, 0], s: [1, 0.8, 1], c: '#d8c8a0' });
  return { builder: b, collider: { r: 1.2 } };
}

export function waystone(seed = 9) {
  const b = new Builder(seed);
  const g = lumpy(ico(0.8, 2), 0.12, 1.6, seed, { flatBottom: -0.5 });
  g.scale(0.9, 1.6, 0.7);
  b.add(g, 'rock', { p: [0, 0.75, 0], uv: 'box', c: (x, y, z, nx, ny) => { const m = sstep(0.6, 0.95, ny) * 0.6; return [1 - m * 0.15, 1 + m * 0.5, 1 - m * 0.45]; } });
  // a plain brass way-marker plate (adversarial review: the glowing inlay read as a magic rune stone)
  b.add(rbox(0.36, 0.36, 0.06, 0.02), 'gold', { p: [0, 1.2, 0.5], r: [0, 0, PI / 4], c: 0xffffff });
  b.add(rbox(0.18, 0.18, 0.07, 0.01), 'iron', { p: [0, 1.2, 0.52], r: [0, 0, PI / 4], c: '#5a4a38' });
  for (let i = 0; i < 4; i++) addRock(b, [Math.cos(i * 1.7) * 1.0, 0, Math.sin(i * 1.7) * 0.9], [0.3, 0.2, 0.3], seed + i);
  addTuft(b, 'lavender', [0.7, 0, 0.6], 0.8, 0.6, 0);
  return { builder: b, collider: { r: 0.8 } };
}

export function bench(seed = 10) {
  const b = new Builder(seed);
  b.add(box(1.8, 0.1, 0.45), 'woodLight', { p: [0, 0.48, 0], c: 0xffffff, us: 1.2 });
  b.add(box(1.8, 0.35, 0.06), 'woodLight', { p: [0, 0.78, -0.22], r: [-0.15, 0, 0], c: 0xffffff, us: 1.2 });
  for (const sx of [-0.75, 0.75]) b.add(rbox(0.12, 0.48, 0.45, 0.02), 'iron', { p: [sx, 0.24, 0], c: 0xffffff });
  return { builder: b, collider: { r: 0.6 } };
}

export function giantMushrooms(seed = 11) {
  const b = new Builder(seed);
  for (let i = 0; i < 3; i++) {
    const s = [1.6, 1.1, 0.8][i], x = [0, 1.1, -0.9][i], z = [0, 0.6, 0.7][i];
    b.add(cyl(0.12 * s, 0.18 * s, 1.0 * s, 10), 'plaster', { p: [x, 0.5 * s, z], c: '#f8f0e0' });
    b.add(lathe([[0.001, 0], [0.65 * s, 0.02], [0.6 * s, 0.22 * s], [0.38 * s, 0.4 * s], [0.001, 0.46 * s]], 18), 'cloth', { p: [x, 0.95 * s, z], c: '#e8783a' });
    for (let k = 0; k < 5; k++) { const a = b.r(0, 6.28), d = b.r(0.1, 0.36); b.add(sphere(0.06 * s, 6, 5), 'plaster', { p: [x + Math.cos(a) * d * s, (1.4 - 0.15 * d / 0.38) * s, z + Math.sin(a) * d * s], s: [1, 0.5, 1], c: '#fff8e8' }); } // (RF.5) spots scattered, not a ring round the cap's centre
  }
  return { builder: b, collider: { r: 0.8 } };
}

export function crystals(seed = 12, mat = 'crystalTeal') {
  const b = new Builder(seed);
  crystalCluster(b, [0, 0, 0], 1.1, mat, seed, 7);
  for (let i = 0; i < 3; i++) addRock(b, [Math.cos(i * 2.1) * 0.9, 0, Math.sin(i * 2.1) * 0.9], [0.35, 0.25, 0.35], seed + i, { moss: 0.3 });
  const color = { crystalTeal: 0x40e0d0, crystalPurple: 0xb070ff, crystalGreen: 0x8ee84a }[mat];
  return { builder: b, collider: { r: 0.7 }, glows: [{ p: [0, 0.8, 0], color, size: 2.6, intensity: 0.5 }] };
}

export function raiderTent(seed = 13, big = 1, col = ['#8a3a2a', '#6a2a1e', '#a85a3a', '#5a2218']) {
  // a ridge tent: two sloped canvas panels over a ridge pole, closed at the back, open at the front. From straight above it
  // reads as a plain rectangle with one ridge line (a round bell tent read as a disc in a ring or a star, content rules)
  const b = new Builder(seed);
  const R = 2.2 * big, H = 2.5 * big, W = R * 0.95, L = R * 2.1;
  const slope = Math.atan2(H, W), sl = Math.hypot(H, W);
  for (const sx of [-1, 1]) {
    b.add(box(sl, 0.05, L), 'cloth', { p: [sx * W / 2, H / 2, 0], r: [0, 0, sx * -slope + (sx > 0 ? 0 : 0)], c: col[0] });
    b.add(box(sl * 0.06, 0.07, L + 0.04), 'cloth', { p: [sx * (W - sl * 0.03 * Math.cos(slope)), 0.05 + sl * 0.03 * Math.sin(slope), 0], r: [0, 0, sx * -slope], c: '#e8d8b4' }); // cream hem
  }
  // patched panels on the canvas
  for (let i = 0; i < 3; i++) { const sx = i % 2 ? 1 : -1, t = b.r(0.3, 0.7), z = (i - 1) * L * 0.3 + b.r(-L * 0.05, L * 0.05); /* (review) apart along the ridge: two overlapping patches drew a stepped cross */ b.add(box(sl * 0.22, 0.06, 0.6 * big), 'cloth', { p: [sx * W * (1 - t), H * t + 0.03, z], r: [0, 0, sx * -slope], c: i % 2 ? col[1] : col[2] }); }
  // the end walls: the back closed, the front a dark open door with one flap tied back
  const tri = new THREE.Shape(); tri.moveTo(-W, 0); tri.lineTo(W, 0); tri.lineTo(0, H); tri.closePath();
  b.add(new THREE.ShapeGeometry(tri), 'cloth', { p: [0, 0, -L / 2], r: [0, PI, 0], c: col[1] });
  b.add(new THREE.ShapeGeometry(tri), 'cloth', { p: [0, 0, -L / 2 + 0.02], c: col[1] });
  const door = new THREE.Shape(); door.moveTo(-W * 0.55, 0); door.lineTo(W * 0.55, 0); door.lineTo(0, H * 0.82); door.closePath();
  b.add(new THREE.ShapeGeometry(door), 'woodDark', { p: [0, 0.01, L / 2 - 0.05], c: '#1a0e08' });
  b.add(new THREE.PlaneGeometry(0.7 * big, 1.6 * big), 'cloth', { p: [0.75 * big, 0.8 * big, L / 2 + 0.05], r: [0, -0.7, 0.1], c: col[3] });
  // ridge pole and its two uprights
  b.add(cyl(0.05, 0.05, L + 0.5, 6), 'woodDark', { p: [0, H + 0.04, 0], r: [PI / 2, 0, 0], c: 0xffffff });
  for (const sz of [-1, 1]) b.add(cyl(0.05, 0.05, H + 0.35, 6), 'woodDark', { p: [0, (H + 0.35) / 2, sz * (L / 2 + 0.2)], c: 0xffffff });
  // guy ropes: one off each end of the ridge, along its line, and two on one side (never an even fan)
  for (const [tx, tz, sx2, sz2] of [[0, L / 2 + 0.2, 0, L / 2 + 1.6], [0, -L / 2 - 0.2, 0, -L / 2 - 1.6], [W * 0.5, L * 0.3, W + 1.0, L * 0.34], [-W * 0.5, -L * 0.25, -W - 1.0, -L * 0.3]]) {
    const top = V3(tx, tx ? H * 0.5 : H + 0.3, tz), stake = V3(sx2, 0.05, sz2);
    const mid = top.clone().lerp(stake, 0.5), len = top.distanceTo(stake);
    const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), stake.clone().sub(top).normalize());
    b.add(cyl(0.012, 0.012, len, 4), 'leather', { p: [mid.x, mid.y, mid.z], q, c: '#c8b090' });
    b.add(cyl(0.03, 0.02, 0.4, 5), 'woodDark', { p: [stake.x, 0.1, stake.z], c: 0xffffff });
  }
  crateMini(b, W + 0.5, 0.3);
  b.add(cyl(0.18, 0.18, 1.1, 10), 'cloth', { p: [-W - 0.4, 0.18, L * 0.3], r: [0, 0.6, Math.PI / 2], c: '#a89070' });
  return { builder: b, collider: { r: R * 0.9 } };
}

// the chief's pavilion: an open canopy on poles over rugs and a chest
export function chiefPavilion(seed = 19) {
  const b = new Builder(seed);
  for (const [x, z] of [[-3, -2.4], [3, -2.4], [-3, 2.4], [3, 2.4]]) {
    b.add(cyl(0.09, 0.1, 3.4, 8), 'woodDark', { p: [x, 1.7, z], c: 0xffffff });
    b.add(sphere(0.12, 8, 6), 'gold', { p: [x, 3.5, z], c: 0xffffff });
  }
  for (let i = 0; i < 5; i++) {
    const g = card(1.3, 5.6, 2, 6);
    b.add(g, 'clothWind', { p: [-2.6 + i * 1.3, 3.25, 0], r: [-Math.PI / 2, 0, 0], uv: 'keep', c: i % 2 ? '#e8d8b4' : '#8a2a1e', w: (x, y, z) => [0, 0, 0, 0.06 * (1 - Math.abs(z) / 2.8)] });
  }
  for (let i = 0; i < 12; i++) b.add(sphere(0.22, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 'cloth', { p: [-3 + i * 0.55, 3.05, 2.8], s: [1.2, 1, 0.3], c: i % 2 ? '#8a2a1e' : '#e8d8b4' });
  b.add(box(5.2, 0.04, 3.6), 'carpetRed', { p: [0, 0.03, 0], c: 0xffffff, uv: 'keep', us: [1, 1] });
  b.add(rbox(1.0, 0.6, 0.6, 0.05), 'woodDark', { p: [0, 0.3, -1.6], c: 0xffffff, us: 1 });
  b.add(box(1.04, 0.08, 0.64), 'gold', { p: [0, 0.45, -1.6], c: 0xffffff });
  for (const x of [-1.6, 1.6]) b.add(cyl(0.35, 0.3, 0.25, 12), 'cloth', { p: [x, 0.13, 0.8], c: '#5a3a6a' });
  for (const [x, z] of [[-3.6, 0], [3.6, 0]]) { b.add(cyl(0.05, 0.06, 4.2, 8), 'woodDark', { p: [x, 2.1, z], c: 0xffffff }); b.add(card(0.8, 1.6, 4, 8), 'bannerRed', { p: [x, 3.1, z + 0.03], uv: 'keep', c: 0xffffff, w: (xx, y) => [0, 0.02, 0, 0.12 * Math.max(0, (3.9 - y) / 1.6)] }); }
  return { builder: b, colliders: [{ x: 0, z: -1.6, hw: 0.6, hd: 0.4 }, { x: -3, z: -2.4, r: 0.2 }, { x: 3, z: -2.4, r: 0.2 }, { x: -3, z: 2.4, r: 0.2 }, { x: 3, z: 2.4, r: 0.2 }] };
}

// broken sandstone column (desert ruins)
export function brokenColumn(seed = 20) {
  const b = new Builder(seed);
  const h = b.r(1.2, 3.4);
  b.add(rbox(1.3, 0.4, 1.3, 0.05), 'sandstone', { p: [0, 0.2, 0], c: '#fff0dc' });
  b.add(cyl(0.45, 0.5, h, 14, 3), 'sandstone', { p: [0, 0.4 + h / 2, 0], c: '#fff4e4', us: 0.5 });
  for (let i = 0; i < 3; i++) b.add(torus(0.48, 0.03, 4, 16), 'sandstone', { p: [0, 0.5 + i * h * 0.3, 0], r: [Math.PI / 2, 0, 0], c: '#f0dcbc' });
  // the fallen top lies beside it
  b.add(cyl(0.45, 0.45, b.r(0.8, 1.6), 14), 'sandstone', { p: [1.3, 0.45, 0.4], r: [0, b.r(0, 3), Math.PI / 2], order: 'YXZ', c: '#f8e8d0', us: 0.5 });
  b.add(rbox(1.2, 0.35, 1.2, 0.05), 'sandstone', { p: [-0.9, 0.12, 1.1], r: [0.2, 0.5, 0.1], c: '#f0e0c8' });
  return { builder: b, collider: { r: 0.8 } };
}

function crateMini(b, x, z) { b.add(rbox(0.6, 0.6, 0.6, 0.03), 'woodDark', { p: [x, 0.3, z], c: 0xffffff, us: 1.2 }); }

export function campfire(seed = 14) {
  const b = new Builder(seed);
  // (RF.5) two short straight rows of stones either side of the fire and three logs side by side: a ring of stones round
  // the glowing fire read as a disc inside a ring from above; no ring, cross or radiating spokes
  for (let i = 0; i < 8; i++) { const sz = i < 4 ? -1 : 1, x = -0.75 + (i % 4) * 0.5 + b.r(-0.08, 0.08); addRock(b, [x, 0, sz * b.r(0.62, 0.72)], [b.r(0.16, 0.26), b.r(0.12, 0.18), b.r(0.15, 0.24)], seed + i, { moss: 0 }); }
  for (const [x, z, ry, rz] of [[-0.06, -0.16, 0.3, 0.1], [0.0, 0.0, 0.38, 0.18], [0.06, 0.16, 0.24, 0.08]]) /* three logs laid side by side, never crossed */ b.add(cyl(0.06, 0.07, b.r(0.7, 0.95), 6), 'beam', { p: [x, 0.14, z], r: [PI / 2, ry + b.r(-0.2, 0.2), rz], c: '#4a2a14' });
  // (no spit: its crossbar over the logs drew a cross from above)
  return { builder: b, collider: { r: 0.8 }, fires: [{ p: [0, 0.12, 0], scale: 0.9 }] };
}

export function crateStack(seed = 15) {
  const b = new Builder(seed);
  const cr = (x, y, z, s, r) => {
    b.add(rbox(0.7 * s, 0.7 * s, 0.7 * s, 0.03), 'woodLight', { p: [x, y + 0.35 * s, z], r: [0, r, 0], c: 0xffffff, us: 1.2 });
    for (const sy of [-1, 1]) b.add(box(0.74 * s, 0.07 * s, 0.74 * s), 'woodDark', { p: [x, y + 0.35 * s + sy * 0.33 * s, z], r: [0, r, 0], c: 0xffffff });
  };
  cr(0, 0, 0, 1, 0.1); cr(0.75, 0, 0.1, 0.9, -0.2); cr(0.3, 0.7, 0.05, 0.8, 0.5);
  b.add(lathe([[0.001, 0], [0.26, 0], [0.32, 0.2], [0.33, 0.4], [0.32, 0.6], [0.26, 0.8], [0.001, 0.8]], 14), 'wood', { p: [-0.8, 0, 0.3], c: 0xffffff, uv: 'box', us: 1.4 });
  for (const y of [0.12, 0.4, 0.68]) b.add(torus(0.31, 0.018, 5, 18), 'iron', { p: [-0.8, y, 0.3], r: [PI / 2, 0, 0], c: 0xffffff });
  // a hank of rope laid flat: three straight lengths side by side, no tie across them (a flat coil read as a ring or a
  // crescent from above when the snow covered part of it; content rules)
  for (const [dz, L] of [[-0.11, 0.62], [0, 0.7], [0.11, 0.58]]) b.add(cyl(0.055, 0.055, L, 7), 'leather', { p: [0.2, 0.055, 0.8 + dz], r: [0, 0, PI / 2], c: '#c8b080' });
  return { builder: b, collider: { r: 1.0 } };
}
