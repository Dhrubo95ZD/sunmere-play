// Furniture: every piece is built around an item {x, z, ry, w, d, h} in house-local space. Item space has its width
// along x, its depth along z and its front toward +z (into the room); ry turns it like three.js rotation.y.
// Content rules: no bottles, goblets or tapped kegs (storage is crocks, jars, bowls and plain barrels); no instruments,
// pictures, mirrors or text (books and ledgers are blank, papers are plain); nothing animal-like; no crossed members
// (chair backs and racks use upright slats ending at a rail, loom threads stop at the cloth, hafts end at their bar).
import * as THREE from 'three';
import { box, cyl, lathe, lumpy, sphere, cone } from '../kit.js';
import { PI, shade, between, pick } from './parts.js';
import { barrel, crate } from './archetypes.js';

// item space -> house space
export function at(it, x, y, z) { const c = Math.cos(it.ry), s = Math.sin(it.ry); return [it.x + x * c + z * s, y, it.z - x * s + z * c]; }
// a box in item space from extents
export function ib(b, mat, it, x0, y0, z0, x1, y1, z1, c = 0xffffff, o = {}) {
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
  if (w < 1e-4 || h < 1e-4 || d < 1e-4) return;
  b.add(box(w, h, d), mat, { p: at(it, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), r: [o.rx || 0, it.ry + (o.ry || 0), o.rz || 0], uv: 'box', c, ...o.extra });
}
const pot = (r, h) => lathe([[0.001, 0], [r * 0.75, 0], [r, h * 0.35], [r * 0.92, h * 0.7], [r * 0.6, h * 0.88], [r * 0.66, h], [0.001, h * 0.96]], 8);
const bowl = (r) => lathe([[0.001, 0], [r * 0.55, 0], [r, r * 0.55], [r * 0.9, r * 0.6], [0.001, r * 0.2]], 8);
const CLAY = ['#b8643a', '#c87a48', '#8a5a3a', '#a8826a', '#6a7a6a', '#d8c8a8'];
const CLOTHS = ['#4a5a8a', '#8a3a2a', '#d8c8a0', '#5e7a4e', '#a8843a', '#6a4a6a', '#e0d8c8', '#3a5a5a'];
const WOOD = '#a07850', WOOD_D = '#7a5a40', WOOD_L = '#c8a878';

export function crocks(b, it, x, y, z, n, r) { for (let i = 0; i < n; i++) { const s = between(r, 0.7, 1.1); b.add(pot(0.09 * s, 0.22 * s), 'stone', { p: at(it, x + i * 0.2, y, z + (i % 2) * 0.05), c: pick(r, CLAY) }); } }
export function bowls(b, it, x, y, z, n, r) { for (let i = 0; i < n; i++) b.add(bowl(0.1), 'wood', { p: at(it, x + i * 0.22, y, z), c: pick(r, ['#c89a68', '#a07850', '#d8b888']) }); }
function loaf(b, it, x, y, z, ry, c) { ib(b, 'cloth', it, x - 0.14, y, z - 0.08, x + 0.14, y + 0.1, z + 0.08, c, { ry }); ib(b, 'cloth', it, x - 0.11, y + 0.1, z - 0.06, x + 0.11, y + 0.14, z + 0.06, shade(c, 1.12), { ry }); }

// ------------------------------------------------------------------ tables, seats, beds, storage
export function table(b, it, r, { top = WOOD_L, legs = WOOD_D } = {}) {
  const { w, d, h = 0.78 } = it;
  ib(b, 'wood', it, -w / 2, h - 0.05, -d / 2, w / 2, h, d / 2, top);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) ib(b, 'wood', it, sx * (w / 2 - 0.1) - 0.04, 0, sz * (d / 2 - 0.08) - 0.04, sx * (w / 2 - 0.1) + 0.04, h - 0.05, sz * (d / 2 - 0.08) + 0.04, legs);
  ib(b, 'wood', it, -w / 2 + 0.1, h - 0.14, -d / 2 + 0.06, w / 2 - 0.1, h - 0.05, -d / 2 + 0.1, legs);
  ib(b, 'wood', it, -w / 2 + 0.1, h - 0.14, d / 2 - 0.1, w / 2 - 0.1, h - 0.05, d / 2 - 0.06, legs);
}
export function bench(b, it) {
  const { w, d } = it, h = 0.45;
  ib(b, 'wood', it, -w / 2, h - 0.05, -d / 2, w / 2, h, d / 2, WOOD);
  for (const sx of [-1, 1]) ib(b, 'wood', it, sx * (w / 2 - 0.15) - 0.03, 0, -d / 2 + 0.03, sx * (w / 2 - 0.15) + 0.03, h - 0.05, d / 2 - 0.03, WOOD_D);
}
export function stool(b, it) {
  ib(b, 'wood', it, -0.17, 0.42, -0.17, 0.17, 0.47, 0.17, WOOD);
  for (const [x, z] of [[-0.11, -0.1], [0.11, -0.1], [0, 0.12]]) ib(b, 'wood', it, x - 0.025, 0, z - 0.025, x + 0.025, 0.42, z + 0.025, WOOD_D);
}
export function chair(b, it) {
  ib(b, 'wood', it, -0.22, 0.44, -0.2, 0.22, 0.49, 0.22, WOOD);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) ib(b, 'wood', it, sx * 0.18 - 0.025, 0, sz * 0.17 - 0.025, sx * 0.18 + 0.025, 0.44, sz * 0.17 + 0.025, WOOD_D);
  // the back: two posts, a top rail between them and upright slats ending under it
  for (const sx of [-1, 1]) ib(b, 'wood', it, sx * 0.18 - 0.03, 0.49, -0.21, sx * 0.18 + 0.03, 1.02, -0.16, WOOD_D);
  ib(b, 'wood', it, -0.15, 0.92, -0.21, 0.15, 1.0, -0.16, WOOD);
  for (const x of [-0.08, 0, 0.08]) ib(b, 'wood', it, x - 0.02, 0.49, -0.2, x + 0.02, 0.92, -0.17, WOOD);
}
export function bed(b, it, r, accent) {
  const { w, d } = it; // w along the wall (length), d out from it
  ib(b, 'wood', it, -w / 2, 0.12, -d / 2, w / 2, 0.36, d / 2, WOOD_D);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) ib(b, 'wood', it, sx * (w / 2 - 0.05) - 0.05, 0, sz * (d / 2 - 0.05) - 0.05, sx * (w / 2 - 0.05) + 0.05, 0.12, sz * (d / 2 - 0.05) + 0.05, WOOD_D);
  ib(b, 'cloth', it, -w / 2 + 0.05, 0.36, -d / 2 + 0.05, w / 2 - 0.05, 0.47, d / 2 - 0.05, '#e8e0cc');
  ib(b, 'cloth', it, -w / 2 + 0.45, 0.47, -d / 2 + 0.03, w / 2 - 0.04, 0.53, d / 2 - 0.03, accent);
  ib(b, 'cloth', it, -w / 2 + 0.1, 0.47, -d / 2 + 0.15, -w / 2 + 0.42, 0.58, d / 2 - 0.15, '#f0ebe0');
  ib(b, 'wood', it, -w / 2 - 0.02, 0, -d / 2, -w / 2 + 0.06, 0.85, d / 2, WOOD); // headboard
  ib(b, 'wood', it, w / 2 - 0.06, 0, -d / 2, w / 2 + 0.02, 0.6, d / 2, WOOD);
}
export function bunk(b, it, r) {
  const { w, d } = it;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) ib(b, 'wood', it, sx * (w / 2 - 0.05) - 0.05, 0, sz * (d / 2 - 0.05) - 0.05, sx * (w / 2 - 0.05) + 0.05, 1.75, sz * (d / 2 - 0.05) + 0.05, WOOD_D);
  for (const y of [0.3, 1.25]) {
    ib(b, 'wood', it, -w / 2, y, -d / 2, w / 2, y + 0.08, d / 2, WOOD);
    ib(b, 'cloth', it, -w / 2 + 0.06, y + 0.08, -d / 2 + 0.05, w / 2 - 0.06, y + 0.17, d / 2 - 0.05, '#d8d0bc');
    ib(b, 'cloth', it, -w / 2 + 0.5, y + 0.17, -d / 2 + 0.04, w / 2 - 0.06, y + 0.22, d / 2 - 0.04, pick(r, CLOTHS));
  }
  // a ladder at the foot: two rails and rungs between them
  for (const z of [d / 2 - 0.02, d / 2 + 0.3]) void z;
  for (const x of [w / 2 - 0.36, w / 2 - 0.08]) ib(b, 'wood', it, x - 0.02, 0, d / 2 + 0.02, x + 0.02, 1.4, d / 2 + 0.06, WOOD_D);
  for (let i = 1; i < 5; i++) ib(b, 'wood', it, w / 2 - 0.34, i * 0.28 - 0.015, d / 2 + 0.025, w / 2 - 0.1, i * 0.28 + 0.015, d / 2 + 0.055, WOOD);
}
export function sleepBench(b, it, r) {
  const { w, d } = it;
  ib(b, 'wood', it, -w / 2, 0, -d / 2, w / 2, 0.42, d / 2, WOOD_D);
  ib(b, 'cloth', it, -w / 2 + 0.08, 0.42, -d / 2 + 0.05, w / 2 - 0.08, 0.5, d / 2 - 0.05, pick(r, ['#8a6a4a', '#6a5a4a', '#7a6a5a']));
  ib(b, 'cloth', it, -w / 2 + 0.15, 0.5, -d / 2 + 0.08, -w / 2 + 0.5, 0.6, d / 2 - 0.08, '#e8e0cc');
}
export function chest(b, it, r, c = '#8a6040') {
  const { w, d } = it;
  ib(b, 'wood', it, -w / 2, 0, -d / 2, w / 2, 0.45, d / 2, c);
  ib(b, 'wood', it, -w / 2 - 0.02, 0.45, -d / 2 - 0.02, w / 2 + 0.02, 0.55, d / 2 + 0.02, shade(c, 0.9));
  for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) ib(b, 'iron', it, x - 0.03, 0.02, d / 2, x + 0.03, 0.55, d / 2 + 0.025, '#3a3634');
  ib(b, 'iron', it, -0.06, 0.32, d / 2 + 0.02, 0.06, 0.44, d / 2 + 0.04, '#5a5048');
}
export function strongbox(b, it) {
  const { w, d } = it;
  ib(b, 'iron', it, -w / 2, 0, -d / 2, w / 2, 0.5, d / 2, '#5a5a5e');
  for (const y of [0.1, 0.4]) ib(b, 'iron', it, -w / 2 - 0.015, y - 0.03, -d / 2 - 0.015, w / 2 + 0.015, y + 0.03, d / 2 + 0.015, '#3a3a3e');
  ib(b, 'brass', it, -0.07, 0.2, d / 2 + 0.015, 0.07, 0.32, d / 2 + 0.035);
}
// a wall shelf on two uprights; `fill` dresses each board
export function shelf(b, it, r, fill, { boards = 3, h = 1.8, c = WOOD } = {}) {
  const { w, d } = it;
  for (const sx of [-1, 1]) ib(b, 'wood', it, sx * (w / 2 - 0.03) - 0.03, 0, -d / 2, sx * (w / 2 - 0.03) + 0.03, h, d / 2, shade(c, 0.85));
  for (let i = 0; i < boards; i++) {
    const y = 0.35 + i * ((h - 0.45) / Math.max(1, boards - 1));
    ib(b, 'wood', it, -w / 2 + 0.06, y - 0.03, -d / 2, w / 2 - 0.06, y, d / 2, c);
    fill(i, y);
  }
  ib(b, 'wood', it, -w / 2 + 0.06, 0, -d / 2, w / 2 - 0.06, h - 0.1, -d / 2 + 0.02, shade(c, 0.7));
}
export function kitchenShelf(b, it, r) {
  shelf(b, it, r, (i, y) => {
    if (i === 0) crocks(b, it, -it.w / 2 + 0.2, y, 0, Math.floor((it.w - 0.3) / 0.22), r);
    else if (i === 1) bowls(b, it, -it.w / 2 + 0.2, y, 0, Math.floor((it.w - 0.3) / 0.24), r);
    else for (let k = 0; k < Math.floor((it.w - 0.3) / 0.32); k++) loaf(b, it, -it.w / 2 + 0.25 + k * 0.32, y, 0, between(r, -0.2, 0.2), pick(r, ['#c88a40', '#b8783a']));
  });
}
export function clothShelf(b, it, r) {
  shelf(b, it, r, (i, y) => { const n = Math.floor((it.w - 0.2) / 0.26); for (let k = 0; k < n; k++) ib(b, 'cloth', it, -it.w / 2 + 0.12 + k * 0.26, y, -it.d / 2 + 0.04, -it.w / 2 + 0.34 + k * 0.26, y + 0.14 + (k % 2) * 0.05, it.d / 2 - 0.03, pick(r, CLOTHS)); }, { boards: 4 });
}
export function ledgerShelf(b, it, r) {
  // blank books and ledgers: plain spines, no letters
  shelf(b, it, r, (i, y) => { let x = -it.w / 2 + 0.1; while (x < it.w / 2 - 0.14) { const t = between(r, 0.035, 0.07), hh = between(r, 0.22, 0.3); ib(b, 'cloth', it, x, y, -it.d / 2 + 0.05, x + t, y + hh, it.d / 2 - 0.04, pick(r, ['#5a3a2a', '#3a4a5a', '#6a5a3a', '#4a3a3a', '#7a6a4a'])); x += t + 0.006; } }, { boards: 4, h: 1.9 });
}
export function jarShelf(b, it, r) {
  shelf(b, it, r, (i, y) => { const n = Math.floor((it.w - 0.2) / 0.2); for (let k = 0; k < n; k++) { const s = between(r, 0.8, 1.2); b.add(pot(0.07 * s, 0.2 * s), 'stone', { p: at(it, -it.w / 2 + 0.16 + k * 0.2, y, 0), c: pick(r, CLAY) }); } }, { boards: 3 });
}
export function loafShelf(b, it, r) {
  shelf(b, it, r, (i, y) => { const n = Math.floor((it.w - 0.2) / 0.3); for (let k = 0; k < n; k++) loaf(b, it, -it.w / 2 + 0.22 + k * 0.3, y, between(r, -0.04, 0.04), between(r, -0.15, 0.15), pick(r, ['#c88a40', '#b8783a', '#d8a050'])); }, { boards: 4 });
}
export function dresser(b, it, r) {
  const { w, d } = it;
  ib(b, 'wood', it, -w / 2, 0, -d / 2, w / 2, 0.85, d / 2, WOOD);
  ib(b, 'wood', it, -w / 2 - 0.02, 0.85, -d / 2, w / 2 + 0.02, 0.9, d / 2 + 0.03, WOOD_L);
  for (const sx of [-1, 1]) ib(b, 'wood', it, sx * w / 4 - w / 4 + 0.04, 0.1, d / 2, sx * w / 4 + w / 4 - 0.04, 0.75, d / 2 + 0.02, shade(WOOD, 0.85));
  // the rack above: uprights, two shelves and a back board, with bowls and crocks
  const rd = 0.24;
  for (const sx of [-1, 1]) ib(b, 'wood', it, sx * (w / 2 - 0.03) - 0.03, 0.9, -d / 2, sx * (w / 2 - 0.03) + 0.03, 1.95, -d / 2 + rd, WOOD);
  ib(b, 'wood', it, -w / 2 + 0.06, 0.9, -d / 2, w / 2 - 0.06, 1.95, -d / 2 + 0.02, shade(WOOD, 0.75));
  for (const y of [1.3, 1.65]) ib(b, 'wood', it, -w / 2 + 0.06, y - 0.03, -d / 2, w / 2 - 0.06, y, -d / 2 + rd, WOOD);
  ib(b, 'wood', it, -w / 2, 1.95, -d / 2, w / 2, 2.0, -d / 2 + rd + 0.04, WOOD_L);
  bowls(b, it, -w / 2 + 0.2, 1.3, -d / 2 + 0.12, Math.floor((w - 0.3) / 0.24), r);
  crocks(b, it, -w / 2 + 0.2, 1.65, -d / 2 + 0.12, Math.floor((w - 0.3) / 0.22), r);
  crocks(b, it, -w / 2 + 0.25, 0.9, 0.05, 2, r);
}
export function counter(b, it, r, goods = null) {
  const { w, d } = it;
  ib(b, 'wood', it, -w / 2, 0, -d / 2, w / 2, 0.9, d / 2 - 0.05, WOOD_D);
  ib(b, 'wood', it, -w / 2 - 0.03, 0.9, -d / 2 - 0.02, w / 2 + 0.03, 0.96, d / 2 + 0.02, WOOD_L);
  for (let x = -w / 2 + 0.25; x < w / 2 - 0.1; x += 0.5) ib(b, 'wood', it, x - 0.03, 0.05, d / 2 - 0.05, x + 0.03, 0.88, d / 2 - 0.03, shade(WOOD_D, 0.8));
  if (goods) goods(0.96);
}
export function barrelAt(b, it, r) { barrel(b, at(it, 0, 0, 0), 0.3, 0.8, pick(r, ['#a07a50', '#8a6a48', '#9a7048'])); }
export function crates(b, it, r) {
  const n = it.w > 0.9 ? 2 : 1;
  for (let i = 0; i < n; i++) crate(b, at(it, (n === 1 ? 0 : -it.w / 4 + (i * it.w) / 2), 0, 0), Math.min(it.d, 0.55) - i * 0.06, it.ry + between(r, -0.15, 0.15));
  if (r() < 0.5) crate(b, at(it, -it.w / 4 * (n - 1), Math.min(it.d, 0.55), 0), 0.4, it.ry + 0.3);
}
export function sacks(b, it, r, _accent, c = '#c8b088') {
  const n = Math.max(2, Math.round(it.w / 0.38));
  for (let i = 0; i < n; i++) b.add(lumpy(sphere(0.26, 8, 6), 0.05, 2.4, i + 3, { flatBottom: -0.18 }), 'cloth', { p: at(it, -it.w / 2 + 0.2 + i * ((it.w - 0.4) / Math.max(1, n - 1)), 0.2, (i % 2) * 0.06 - 0.03), s: [1, 0.85, 0.8], c: shade(c, between(r, 0.92, 1.06)) });
}
export function rug(b, it, r) {
  const { w, d } = it, base = pick(r, ['#8a3a2a', '#4a5a8a', '#5e7a4e', '#a8843a', '#6a4a3a']), band = pick(r, ['#e0d0a8', '#d8c8a0', '#3a3a3c']);
  ib(b, 'cloth', it, -w / 2, 0, -d / 2, w / 2, 0.02, d / 2, base);
  // a border and plain stripes only (no medallions, stars or crosses)
  ib(b, 'cloth', it, -w / 2 + 0.06, 0.02, -d / 2 + 0.06, w / 2 - 0.06, 0.036, -d / 2 + 0.14, band);
  ib(b, 'cloth', it, -w / 2 + 0.06, 0.02, d / 2 - 0.14, w / 2 - 0.06, 0.036, d / 2 - 0.06, band);
  const n = Math.max(1, Math.round(w / 0.6));
  for (let i = 0; i < n; i++) { const x = -w / 2 + 0.3 + (i * (w - 0.6)) / Math.max(1, n - 1); ib(b, 'cloth', it, x - 0.04, 0.02, -d / 2 + 0.22, x + 0.04, 0.036, d / 2 - 0.22, shade(band, 0.9)); }
}
// bunches of drying herbs hung from a ceiling joist
export function herbs(b, it, r, y = 2.52) {
  for (let i = 0; i < 4; i++) {
    const x = -0.45 + i * 0.3, hh = between(r, 0.28, 0.4);
    ib(b, 'cloth', it, x - 0.004, y - 0.12, -0.004, x + 0.004, y, 0.004, '#c8b890');
    b.add(cone(0.07, hh, 6), 'cloth', { p: at(it, x, y - 0.12 - hh / 2, 0), r: [PI, 0, 0], c: pick(r, ['#6a8a4a', '#8a9a5a', '#5a7a4a', '#9a8a5a']) });
  }
}
// a small square lantern (glass core, plain cage)
export function lantern(b, p, s = 1) {
  b.add(box(0.16 * s, 0.22 * s, 0.16 * s), 'glowYellow', { p: [p[0], p[1] + 0.13 * s, p[2]], uv: 'box', c: 0xffffff });
  b.add(box(0.2 * s, 0.03 * s, 0.2 * s), 'iron', { p: [p[0], p[1] + 0.015 * s, p[2]], uv: 'box', c: '#3a3634' });
  b.add(box(0.2 * s, 0.03 * s, 0.2 * s), 'iron', { p: [p[0], p[1] + 0.255 * s, p[2]], uv: 'box', c: '#3a3634' });
  b.add(box(0.06 * s, 0.06 * s, 0.06 * s), 'iron', { p: [p[0], p[1] + 0.3 * s, p[2]], uv: 'box', c: '#3a3634' });
}

// ------------------------------------------------------------------ trades
export function workbench(b, it, r) {
  const { w, d } = it;
  table(b, { ...it, h: 0.88 }, r, { top: '#b89068', legs: WOOD_D });
  ib(b, 'wood', it, -w / 2 + 0.1, 0.12, -d / 2 + 0.08, w / 2 - 0.1, 0.16, d / 2 - 0.08, WOOD_D); // the low shelf
  ib(b, 'iron', it, w / 2 - 0.25, 0.88, d / 2 - 0.2, w / 2 - 0.05, 1.02, d / 2 + 0.02, '#4a4848'); // a vice
  ib(b, 'wood', it, -0.2, 0.88, -0.05, 0.1, 0.96, 0.03, '#c8a070'); // a plane
  ib(b, 'iron', it, -0.12, 0.96, -0.03, 0.0, 0.98, 0.01, '#6a6866');
  for (let i = 0; i < 3; i++) ib(b, 'wood', it, -w / 2 + 0.2 + i * 0.12, 0.88, 0.08, -w / 2 + 0.24 + i * 0.12, 0.91, 0.3, '#d8b888'); // laths, laid side by side
}
export function worktable(b, it, r, goods) { table(b, { ...it, h: 0.86 }, r); goods(0.86); }
export function desk(b, it, r) {
  const { w, d } = it;
  table(b, { ...it, h: 0.78 }, r, { top: '#8a6040', legs: '#6a4a30' });
  for (let i = 0; i < 3; i++) ib(b, 'cloth', it, -0.2 + i * 0.03, 0.78 + i * 0.004, -0.05 + i * 0.02, 0.1 + i * 0.03, 0.782 + i * 0.004, 0.18 + i * 0.02, '#efe6d2', { ry: 0.08 * i });
  ib(b, 'cloth', it, w / 2 - 0.42, 0.78, -0.12, w / 2 - 0.14, 0.84, 0.08, '#4a3a2a'); // a closed blank book
  b.add(cyl(0.035, 0.04, 0.06, 6), 'iron', { p: at(it, w / 2 - 0.08, 0.81, -d / 2 + 0.12), c: '#2a2a30' }); // an ink pot
  ib(b, 'wood', it, -w / 2 + 0.05, 0.78, -d / 2 + 0.02, -w / 2 + 0.3, 1.02, -d / 2 + 0.2, '#7a5a40'); // a pigeonhole box
}
export function loom(b, it, r) {
  const { w, d } = it, c = '#8a6a48';
  // two side frames (posts), a top beam and a breast beam between them (they end at the posts)
  for (const sx of [-1, 1]) { ib(b, 'wood', it, sx * (w / 2 - 0.05) - 0.05, 0, -d / 2, sx * (w / 2 - 0.05) + 0.05, 1.75, -d / 2 + 0.1, c); ib(b, 'wood', it, sx * (w / 2 - 0.05) - 0.05, 0, d / 2 - 0.1, sx * (w / 2 - 0.05) + 0.05, 0.85, d / 2, c); ib(b, 'wood', it, sx * (w / 2 - 0.05) - 0.04, 0.0, -d / 2 + 0.1, sx * (w / 2 - 0.05) + 0.04, 0.08, d / 2 - 0.1, c); }
  ib(b, 'wood', it, -w / 2 + 0.1, 1.62, -d / 2, w / 2 - 0.1, 1.72, -d / 2 + 0.1, c);
  ib(b, 'wood', it, -w / 2 + 0.1, 0.78, d / 2 - 0.1, w / 2 - 0.1, 0.86, d / 2, c);
  // the cloth woven so far, and the warp threads running up from it to the top beam (threads stop at the cloth)
  const cc = pick(r, CLOTHS);
  b.add(box(w - 0.3, 0.02, d - 0.25), 'cloth', { p: at(it, 0, 0.83, 0.05), r: [-0.45, it.ry, 0], order: 'YXZ', uv: 'box', c: cc });
  for (let i = 0; i < 14; i++) { const x = -w / 2 + 0.18 + (i * (w - 0.36)) / 13; b.add(box(0.008, 0.85, 0.008), 'cloth', { p: at(it, x, 1.25, -d / 2 + 0.12), r: [0.25, it.ry, 0], order: 'YXZ', uv: 'box', c: '#e8e0c8' }); }
  // the weaver's bench in front
  ib(b, 'wood', it, -w / 2 + 0.15, 0.48, d / 2 + 0.25, w / 2 - 0.15, 0.53, d / 2 + 0.5, WOOD);
  for (const sx of [-1, 1]) ib(b, 'wood', it, sx * (w / 2 - 0.25) - 0.03, 0, d / 2 + 0.28, sx * (w / 2 - 0.25) + 0.03, 0.48, d / 2 + 0.47, WOOD_D);
}
export function spoolRack(b, it, r) {
  const { w } = it;
  ib(b, 'wood', it, -w / 2, 0.9, -it.d / 2, w / 2, 1.8, -it.d / 2 + 0.04, WOOD_D);
  for (let row = 0; row < 3; row++) for (let i = 0; i < Math.floor(w / 0.18); i++) {
    const x = -w / 2 + 0.12 + i * 0.18, y = 1.05 + row * 0.28;
    ib(b, 'wood', it, x - 0.01, y - 0.01, -it.d / 2 + 0.04, x + 0.01, y + 0.01, -it.d / 2 + 0.18, '#c8a878');
    b.add(cyl(0.045, 0.045, 0.1, 6), 'cloth', { p: at(it, x, y, -it.d / 2 + 0.12), r: [PI / 2, it.ry, 0], order: 'YXZ', c: pick(r, CLOTHS) });
  }
  ib(b, 'wood', it, -w / 2, 0, -it.d / 2, w / 2, 0.85, it.d / 2, WOOD); // a cupboard under
}
export function kneadTrough(b, it, r) {
  const { w, d } = it;
  for (const sx of [-1, 1]) ib(b, 'wood', it, sx * (w / 2 - 0.1) - 0.04, 0, -d / 2 + 0.06, sx * (w / 2 - 0.1) + 0.04, 0.6, d / 2 - 0.06, WOOD_D);
  ib(b, 'wood', it, -w / 2, 0.6, -d / 2, w / 2, 0.9, d / 2, '#b89068');
  ib(b, 'cloth', it, -w / 2 + 0.06, 0.9, -d / 2 + 0.06, w / 2 - 0.06, 0.92, d / 2 - 0.06, '#efe6d2');
  b.add(lumpy(sphere(0.18, 8, 6), 0.04, 3, 7), 'cloth', { p: at(it, -0.1, 0.95, 0), s: [1.4, 0.45, 1], c: '#f0dcb0' });
}
export function peelRack(b, it, r) {
  const { w } = it;
  ib(b, 'wood', it, -w / 2, 1.9, -it.d / 2, w / 2, 1.98, -it.d / 2 + 0.08, WOOD_D);
  for (let i = 0; i < 3; i++) {
    const x = -w / 2 + 0.2 + i * ((w - 0.4) / 2);
    ib(b, 'wood', it, x - 0.02, 0.62, -it.d / 2 + 0.04, x + 0.02, 1.9, -it.d / 2 + 0.07, '#b89068');
    ib(b, 'wood', it, x - 0.15, 0.18, -it.d / 2 + 0.04, x + 0.15, 0.62, -it.d / 2 + 0.06, '#c8a070');
  }
}
export function oven(b, it, r) {
  const { w, d } = it, c = '#c47a5c';
  ib(b, 'stone', it, -w / 2, 0, -d / 2, w / 2, 1.15, d / 2, c);
  ib(b, 'stoneLarge', it, -w / 2 - 0.04, 1.15, -d / 2 - 0.02, w / 2 + 0.04, 1.25, d / 2 + 0.04, '#d8c8b0');
  // the square mouth: a dark recess and a stone lip under it
  ib(b, 'stoneDark', it, -0.28, 0.45, d / 2 - 0.12, 0.28, 0.85, d / 2 + 0.015, '#201814');
  ib(b, 'stoneLarge', it, -0.36, 0.38, d / 2 - 0.05, 0.36, 0.45, d / 2 + 0.08, '#d8c8b0');
  ib(b, 'iron', it, -0.24, 0.48, d / 2 + 0.02, 0.24, 0.82, d / 2 + 0.035, '#3a3634'); // the iron door leaning aside
  for (let i = 0; i < 4; i++) ib(b, 'beam', it, -w / 2 + 0.1, 1.25 + i * 0.12, -0.25, w / 2 - 0.1, 1.33 + i * 0.12, 0.25, '#c8a070', { ry: i * 0.2 }); // fuel stacked on top
}
export function anvil(b, it) {
  b.add(cyl(0.28, 0.32, 0.5, 8), 'beam', { p: at(it, 0, 0.25, 0), c: '#6a5040' });
  ib(b, 'iron', it, -0.16, 0.5, -0.1, 0.16, 0.66, 0.1, '#3e3e42');
  ib(b, 'iron', it, -0.3, 0.66, -0.13, 0.26, 0.8, 0.13, '#4a4a4e');
  // the horn: a tapered block (no curve)
  b.add(box(0.26, 0.1, 0.12), 'iron', { p: at(it, 0.38, 0.75, 0), r: [0, it.ry, -0.12], uv: 'box', c: '#4a4a4e' });
  ib(b, 'iron', it, -0.12, 0.8, -0.03, 0.12, 0.84, 0.03, '#5a5a5e'); // a bar on the face
}
export function forge(b, it, r) {
  const { w, d } = it;
  ib(b, 'stone', it, -w / 2, 0, -d / 2, w / 2, 0.8, d / 2, '#a8735a');
  ib(b, 'stoneDark', it, -w / 2 + 0.12, 0.8, -d / 2 + 0.1, w / 2 - 0.12, 0.86, d / 2 - 0.12, '#2a2220');
  for (let i = 0; i < 6; i++) b.add(box(0.12, 0.08, 0.1), 'molten', { p: at(it, -w / 2 + 0.3 + (i % 3) * 0.3, 0.88, -0.1 + Math.floor(i / 3) * 0.2), r: [0, i, 0], uv: 'box', c: '#ffffff' });
  // the bellows beside it: two boards and the leather between, a nozzle into the fire
  const bx0 = w / 2 + 0.1;
  b.add(box(0.45, 0.04, 0.7), 'wood', { p: at(it, bx0 + 0.25, 0.62, 0), r: [0, it.ry, 0.12], uv: 'box', c: '#8a6a48' });
  ib(b, 'wood', it, bx0, 0.42, -0.33, bx0 + 0.5, 0.46, 0.33, '#8a6a48');
  ib(b, 'leather', it, bx0 + 0.04, 0.46, -0.3, bx0 + 0.46, 0.6, 0.3, '#6a4a32');
  ib(b, 'iron', it, w / 2 - 0.1, 0.5, -0.04, bx0 + 0.05, 0.56, 0.04, '#3a3634');
}
export function quench(b, it) {
  const { w, d } = it;
  ib(b, 'wood', it, -w / 2, 0, -d / 2, w / 2, 0.6, d / 2, '#6a5040');
  ib(b, 'stoneDark', it, -w / 2 + 0.06, 0.5, -d / 2 + 0.06, w / 2 - 0.06, 0.57, d / 2 - 0.06, '#203038');
  for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) ib(b, 'iron', it, x - 0.03, 0.02, d / 2, x + 0.03, 0.6, d / 2 + 0.02, '#3a3634');
}
export function toolRack(b, it, r) {
  const { w } = it;
  ib(b, 'wood', it, -w / 2, 1.0, -it.d / 2, w / 2, 1.85, -it.d / 2 + 0.04, WOOD_D);
  const n = Math.floor((w - 0.2) / 0.2);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.18 + i * 0.2, L = between(r, 0.35, 0.55);
    // hammers hang head-up from pegs: a haft and a head (a T, never crossed)
    ib(b, 'wood', it, x - 0.015, 1.7 - L, -it.d / 2 + 0.05, x + 0.015, 1.7, -it.d / 2 + 0.08, '#8a6a48');
    ib(b, 'iron', it, x - 0.06, 1.7, -it.d / 2 + 0.045, x + 0.06, 1.76, -it.d / 2 + 0.09, '#4a4a4e');
  }
}
export function barStock(b, it, r) {
  const { w } = it;
  for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) ib(b, 'wood', it, x - 0.04, 0, -it.d / 2, x + 0.04, 1.1, -it.d / 2 + 0.3, WOOD_D);
  for (let i = 0; i < 7; i++) ib(b, 'iron', it, -w / 2 + 0.02, 0.4 + (i % 3) * 0.3, -it.d / 2 + 0.06 + Math.floor(i / 3) * 0.07, w / 2 - 0.02, 0.43 + (i % 3) * 0.3, -it.d / 2 + 0.09 + Math.floor(i / 3) * 0.07, '#5a5a5e');
}
export function weaponRack(b, it, r) {
  const { w } = it;
  ib(b, 'wood', it, -w / 2, 0, -it.d / 2, w / 2, 0.12, it.d / 2, WOOD_D);
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) ib(b, 'wood', it, x - 0.04, 0.12, -it.d / 2, x + 0.04, 1.6, -it.d / 2 + 0.08, WOOD_D);
  ib(b, 'wood', it, -w / 2 + 0.09, 1.45, -it.d / 2, w / 2 - 0.09, 1.55, -it.d / 2 + 0.1, WOOD_D);
  // plain hafts standing in the base and ending under the bar
  const n = Math.floor((w - 0.3) / 0.16);
  for (let i = 0; i < n; i++) { const x = -w / 2 + 0.2 + i * 0.16; b.add(cyl(0.022, 0.022, 1.33, 6), 'wood', { p: at(it, x, 0.12 + 0.665, -it.d / 2 + 0.06), c: '#8a6a48' }); }
}
export function churn(b, it) {
  b.add(cyl(0.16, 0.2, 0.75, 10), 'wood', { p: at(it, 0, 0.375, 0), c: '#b89068' });
  for (const y of [0.15, 0.6]) b.add(cyl(0.2, 0.2, 0.04, 10, 1, true), 'iron', { p: at(it, 0, y, 0), c: '#4a4644' });
  b.add(cyl(0.12, 0.12, 0.03, 10), 'wood', { p: at(it, 0, 0.76, 0), c: '#a07850' });
  b.add(cyl(0.02, 0.02, 0.6, 6), 'wood', { p: at(it, 0, 1.0, 0), c: '#8a6a48' });
}
export function coalBin(b, it, r) {
  const { w, d } = it;
  ib(b, 'wood', it, -w / 2, 0, -d / 2, w / 2, 0.55, d / 2, '#5a4a3c');
  for (let i = 0; i < 7; i++) b.add(box(0.2, 0.12, 0.18), 'iron', { p: at(it, -w / 2 + 0.2 + (i % 4) * 0.22, 0.58, -0.12 + Math.floor(i / 4) * 0.24), r: [0, i, 0.3], uv: 'box', c: '#24221f' });
}
export function gauges(b, it, r) {
  const { w } = it;
  ib(b, 'wood', it, -w / 2, 1.1, -it.d / 2, w / 2, 1.9, -it.d / 2 + 0.04, '#6a5444');
  const n = Math.max(2, Math.floor(w / 0.38));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.22 + i * ((w - 0.44) / Math.max(1, n - 1));
    // square gauges: a brass case, a plain face and an upright needle (no dial marks, no numbers)
    ib(b, 'brass', it, x - 0.13, 1.35, -it.d / 2 + 0.04, x + 0.13, 1.65, -it.d / 2 + 0.12);
    ib(b, 'cloth', it, x - 0.09, 1.39, -it.d / 2 + 0.12, x + 0.09, 1.61, -it.d / 2 + 0.135, '#e8e0c8');
    ib(b, 'iron', it, x - 0.008, 1.43, -it.d / 2 + 0.135, x + 0.008, 1.57, -it.d / 2 + 0.15, '#2a2826');
  }
}
export function pipesWall(b, it, r) {
  const { w } = it;
  for (const [y, s] of [[2.1, 0.07], [2.32, 0.05]]) {
    ib(b, 'brass', it, -w / 2, y - s, -it.d / 2 + 0.04, w / 2, y + s, -it.d / 2 + 0.04 + 2 * s);
    for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) ib(b, 'brass', it, x - s * 1.5, y - s * 1.5, -it.d / 2 + 0.02, x + s * 1.5, y + s * 1.5, -it.d / 2 + 0.06 + 2 * s);
  }
  ib(b, 'brass', it, w / 2 - 0.15 - 0.06, 0.6, -it.d / 2 + 0.04, w / 2 - 0.15 + 0.06, 2.1, -it.d / 2 + 0.16);
  ib(b, 'iron', it, w / 2 - 0.4, 0, -it.d / 2 + 0.02, w / 2, 0.6, -it.d / 2 + 0.4, '#4a4846'); // a valve box at its foot
}
export function hangTools(b, it, r) {
  const { w } = it;
  ib(b, 'wood', it, -w / 2, 1.65, -it.d / 2, w / 2, 1.75, -it.d / 2 + 0.06, WOOD_D);
  // a spade, a rake and a hoe hanging side by side from pegs
  const xs = [-w / 2 + 0.25, 0, w / 2 - 0.25];
  xs.forEach((x, i) => {
    ib(b, 'wood', it, x - 0.017, 0.35, -it.d / 2 + 0.07, x + 0.017, 1.68, -it.d / 2 + 0.1, '#8a6a48');
    if (i === 0) ib(b, 'iron', it, x - 0.11, 0.05, -it.d / 2 + 0.07, x + 0.11, 0.35, -it.d / 2 + 0.09, '#6a6866');
    else if (i === 1) { ib(b, 'iron', it, x - 0.18, 0.3, -it.d / 2 + 0.07, x + 0.18, 0.35, -it.d / 2 + 0.11, '#5a5856'); for (let k = 0; k < 6; k++) ib(b, 'iron', it, x - 0.16 + k * 0.064, 0.2, -it.d / 2 + 0.08, x - 0.148 + k * 0.064, 0.3, -it.d / 2 + 0.1, '#5a5856'); }
    else ib(b, 'iron', it, x - 0.12, 0.3, -it.d / 2 + 0.07, x + 0.02, 0.37, -it.d / 2 + 0.1, '#5a5856');
  });
}
// a decorative stair up to the loft along a wall, behind a rail (its circles keep players off it)
export function stair(b, it, r) {
  const { w, d } = it, n = 12, top = 2.75;
  for (let i = 0; i < n; i++) {
    const x0 = -w / 2 + (i * w) / n, x1 = -w / 2 + ((i + 1) * w) / n;
    ib(b, 'wood', it, x0, ((i + 1) * top) / n - 0.05, -d / 2, x1 + 0.02, ((i + 1) * top) / n, d / 2, WOOD_L);
  }
  // the stringers under the treads (sloped) and a rail on posts on the open side
  b.add(box(Math.hypot(w, top), 0.18, 0.06), 'wood', { p: at(it, 0, top / 2 - 0.08, d / 2 - 0.03), r: [0, it.ry, Math.atan2(top, w)], order: 'YXZ', uv: 'box', c: WOOD_D });
  b.add(box(Math.hypot(w, top), 0.18, 0.06), 'wood', { p: at(it, 0, top / 2 - 0.08, -d / 2 + 0.03), r: [0, it.ry, Math.atan2(top, w)], order: 'YXZ', uv: 'box', c: WOOD_D });
  for (const k of [0.08, 0.5, 0.92]) { const x = -w / 2 + k * w, y = k * top; ib(b, 'wood', it, x - 0.03, y, d / 2 + 0.01, x + 0.03, y + 0.9, d / 2 + 0.07, WOOD_D); }
  b.add(box(Math.hypot(w * 0.84, top * 0.84), 0.06, 0.06), 'wood', { p: at(it, 0, top / 2 + 0.93, d / 2 + 0.04), r: [0, it.ry, Math.atan2(top, w)], order: 'YXZ', uv: 'box', c: WOOD });
}
export { THREE };
