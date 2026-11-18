// The Rime Steps (Part Eleven): the glacier valley's dressing, built into the world's rimeGroup (World.buildRime).
//   the landing pier and the steam ship at its berth · the Icefall Landing camp (cold grey stone sluice houses with flat roofs,
//   timber sheds and porches, a square watchtower) · the footbridges and the stone kerbs of the ramps · the Makers' mills on
//   the Flume Works, their timber flumes on trestles and their water wheels locked in ice · the frozen falls on the terrace
//   faces · the dam (a long stone wall, square sluice towers at the outlets, frozen spill down its face) and the ice sheet of
//   the lake behind it, the glacier's seracs at its head · floes in the sea · snow, ice and rock scatter
// Content rules: no domes, arches, spires, crosses, stars, sunbursts or spoked wheels. Every roof is flat; every water wheel
// is a solid disc with paddle boards on its rim (no spokes); checked from straight above.
import * as THREE from 'three';
import * as P from '../assets/props.js';
import { Builder, box, rbox, cyl, lumpy, sphere, ico, taper } from '../assets/kit.js';
import { addRock } from '../assets/trees.js';
import { buildSteamship } from '../assets/steamship.js';
import { getMat } from '../engine/materials.js';
import { RIME, rimeHeight, rimeShore, rimePathDist, rimeZone, rimeChannel } from '/sunmere-play/shared/rime.js';
import { mulberry32 } from '/sunmere-play/shared/noise.js';
import { DUNGEONS } from '/sunmere-play/shared/dungeons.js';
import { stoneBlock, squareTower, porch, cistern, tank, stoneBench, sacks, pipe } from './reachLayout.js';

const PI = Math.PI;
// the valley's stone has moss in its joints; up here the same blocks are bare and frost-grey
const COLD = { stone: 'stoneCold', stoneDark: 'stoneColdDark', stoneLarge: 'stoneColdLarge' };
export function cold(r) {
  const P0 = r.builder?.parts;
  if (!P0) return r;
  for (const [from, to] of Object.entries(COLD)) { const L = P0.get(from); if (!L) continue; P0.delete(from); P0.set(to, (P0.get(to) || []).concat(L)); }
  return r;
}
let W_ = null;
const placeAt = (r, ...a) => W_.placeAt(cold(r), ...a);
const placeObj = (r, ...a) => W_.placeObject(cold(r), ...a);
const res = (b, extra = {}) => ({ builder: b, fires: [], glows: [], lanterns: [], smokes: [], colliders: [], ...extra });
const ST = '#a6abb2', ST_D = '#6c727a', ST_L = '#c6cace', TIMBER = '#6a5038', TIMBER_D = '#4a3826', SNOW = '#f2f6fa';

// ------------------------------------------------------------------ small kit (local: front faces +z, ground at y 0)
// a slab of packed snow on a flat roof (inside its parapet), with a soft lip
export function roofSnow(b, w, d, y) {
  b.add(rbox(w, 0.28, d, 0.12), 'snowPack', { p: [0, y + 0.14, 0], c: SNOW });
}
// a row of icicles hanging from a straight edge (from a to b, at height y), tapered ice
export function icicles(b, ax, az, bx, bz, y, n, maxL = 0.9) {
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, L = b.r(0.25, maxL);
    b.add(cyl(0.07, 0.005, L, 5), 'ice', { p: [ax + (bx - ax) * t + b.r(-0.08, 0.08), y - L / 2, az + (bz - az) * t + b.r(-0.08, 0.08)], c: '#ffffff' });
  }
}
// a cold-stone sluice house: the Reach's stone block in the valley's grey, with snow on the roof and icicles along the eaves
export function sluiceHouse(seed, o = {}) {
  const r = stoneBlock(seed, { tint: ST, pipes: false, ...o });
  const b = r.builder, w = o.w ?? 8, d = o.d ?? 6, h = o.h ?? 4.2;
  roofSnow(b, w - 0.3, d - 0.3, h + 0.22);
  icicles(b, -w / 2 - 0.2, d / 2 + 0.28, w / 2 + 0.2, d / 2 + 0.28, h - 0.15, Math.round(w * 1.6));
  icicles(b, -w / 2 - 0.2, -d / 2 - 0.28, w / 2 + 0.2, -d / 2 - 0.28, h - 0.15, Math.round(w * 1.2));
  // a timber gallery rail along the roof and a square vent stack, iron banded
  b.add(box(0.8, 1.6, 0.8), 'stoneDark', { p: [w / 2 - 1, h + 0.9, -d / 2 + 1], c: ST_D });
  b.add(box(1.0, 0.16, 1.0), 'wIron', { p: [w / 2 - 1, h + 1.75, -d / 2 + 1], c: '#3a3c40' });
  return r;
}
// a timber lean-to shed: four square posts, plank walls on three sides, a flat plank roof under snow
export function timberShed(seed, w = 5, d = 3.4, h = 2.8) {
  const b = new Builder(seed);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.24, h, 0.24), 'beam', { p: [sx * (w / 2 - 0.12), h / 2, sz * (d / 2 - 0.12)], c: 0xffffff });
  b.add(box(w, h * 0.85, 0.12), 'woodDark', { p: [0, h * 0.42, -d / 2 + 0.1], c: TIMBER });
  for (const sx of [-1, 1]) b.add(box(0.12, h * 0.85, d), 'woodDark', { p: [sx * (w / 2 - 0.1), h * 0.42, 0], c: TIMBER });
  b.add(box(w + 0.5, 0.18, d + 0.6), 'wood', { p: [0, h + 0.09, 0.1], c: '#7a6048' });
  roofSnow(b, w + 0.3, d + 0.4, h + 0.18);
  icicles(b, -w / 2, d / 2 + 0.38, w / 2, d / 2 + 0.38, h, Math.round(w * 1.4), 0.6);
  // firewood stacked inside, a tool rack
  for (let i = 0; i < 4; i++) b.add(box(w * 0.7, 0.32, 0.6), 'beam', { p: [0, 0.16 + i * 0.32, -d / 2 + 0.5], c: '#8a6a48' });
  return res(b, { colliders: [{ x: 0, z: -0.4, hw: w / 2, hd: d / 2 - 0.3 }] });
}

// a solid water wheel: a disc of planks behind iron straps (parallel, never radiating), an iron tyre round the rim, paddle
// boards standing out round the rim, a square hub block on the axle. Axle along local x, centred at the origin.
function waterWheel(seed, R = 3.2, thick = 0.6, nPad = 16, iced = 0) {
  const b = new Builder(seed);
  b.add(cyl(R, R, thick, 36), 'woodDark', { r: [0, 0, PI / 2], c: '#5e4630' });
  b.add(cyl(R + 0.08, R + 0.08, thick * 0.55, 36), 'wIron', { r: [0, 0, PI / 2], c: '#3c3e42' });
  // straps straight across both faces (parallel bands, like a barrel head)
  for (const sx of [-1, 1]) for (const zz of [-R * 0.55, 0, R * 0.55]) {
    const half = Math.sqrt(Math.max(0, R * R - zz * zz)) * 0.96;
    b.add(box(0.06, half * 2, 0.2), 'wIron', { p: [sx * (thick / 2 + 0.02), 0, zz], c: '#3a3c40' });
  }
  // paddle boards on the rim
  for (let i = 0; i < nPad; i++) {
    const a = (i / nPad) * PI * 2, rr = R + 0.32;
    b.add(box(thick + 0.3, 0.7, 0.1), 'wood', { p: [0, Math.cos(a) * rr, Math.sin(a) * rr], r: [a, 0, 0], c: '#7a5e40' });
  }
  // the hub: a square iron block through which the square axle runs
  b.add(box(thick + 0.5, 0.8, 0.8), 'wIron', { c: '#44464a' });
  b.add(box(thick + 2.6, 0.36, 0.36), 'wIron', { c: '#3a3c40' });
  if (iced) {
    // ice caked on the lower paddles and hanging from the rim
    for (let i = 0; i < 7; i++) { const a = PI + (i / 6 - 0.5) * 1.6; b.add(lumpy(ico(0.5, 1), 0.2, 2, seed + i, { flatBottom: 0 }), 'ice', { p: [0, Math.cos(a) * (R + 0.2), Math.sin(a) * (R + 0.2)], s: [1.6, 0.8, 1.1], c: '#ffffff' }); }
    for (let i = 0; i < 9; i++) { const a = (i / 9 - 0.5) * 1.4 + PI / 2, L = b.r(0.3, 1.1); b.add(cyl(0.07, 0.005, L, 5), 'ice', { p: [b.r(-0.2, 0.2), Math.sin(a) * R * 0.2 - L / 2 + R * 0.1, Math.cos(a) * R], c: '#ffffff' }); }
  }
  return b;
}

// a timber flume on square trestles along a world polyline [[x, z], ...] from y0 to y1 (the trough's floor), as a local
// builder whose origin is the first point (place it there at y 0). The trough is frozen solid: ice in it and hanging off it.
function flume(seed, pts, y0, y1, groundAt) {
  const b = new Builder(seed), [ox, oz] = pts[0];
  let total = 0; const segL = [];
  for (let i = 0; i < pts.length - 1; i++) { const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); segL.push(L); total += L; }
  let s0 = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = segL[i], ry = Math.atan2(bx - ax, bz - az);
    const ya = y0 + (y1 - y0) * (s0 / total), yb = y0 + (y1 - y0) * ((s0 + L) / total);
    const mx = (ax + bx) / 2 - ox, mz = (az + bz) / 2 - oz, my = (ya + yb) / 2, pitch = Math.atan2(ya - yb, L);
    // the trough: a plank floor and two plank sides, an ice fill
    b.add(box(1.3, 0.12, L + 0.1), 'wood', { p: [mx, my, mz], r: [pitch, ry, 0], order: 'YXZ', c: '#7a5e42' });
    for (const sd of [-1, 1]) b.add(box(0.12, 0.7, L + 0.1), 'woodDark', { p: [mx + Math.cos(ry) * sd * 0.65, my + 0.35, mz - Math.sin(ry) * sd * 0.65], r: [pitch, ry, 0], order: 'YXZ', c: TIMBER });
    b.add(box(1.1, 0.4, L), 'iceBlue', { p: [mx, my + 0.25, mz], r: [pitch, ry, 0], order: 'YXZ', c: '#ffffff' });
    // trestles every 3.2 m: two square legs, a cap beam, a cross brace, footing stones
    for (let t = 1.2; t < L - 0.4; t += 3.2) {
      const k = t / L, x = ax + (bx - ax) * k, z = az + (bz - az) * k, y = ya + (yb - ya) * k, g = groundAt(x, z), hgt = y - g;
      if (hgt < 0.3) continue;
      const lx = x - ox, lz = z - oz, cx = Math.cos(ry), cz = -Math.sin(ry);
      for (const sd of [-1, 1]) b.add(box(0.22, hgt + 0.6, 0.22), 'beam', { p: [lx + cx * sd * 0.75, g + (hgt - 0.6) / 2, lz + cz * sd * 0.75], c: 0xffffff });
      b.add(box(1.9, 0.2, 0.26), 'beam', { p: [lx, y - 0.16, lz], r: [0, ry, 0], c: 0xffffff });
      if (hgt > 2.4) b.add(box(0.12, Math.hypot(1.5, hgt * 0.6), 0.14), 'beam', { p: [lx, g + hgt * 0.45, lz], r: [0, ry, Math.atan2(1.5, hgt * 0.6)], order: 'YXZ', c: 0xffffff });
      if (hgt > 5) b.add(box(1.7, 0.16, 0.2), 'beam', { p: [lx, g + hgt * 0.5, lz], r: [0, ry, 0], c: 0xffffff });
      b.add(box(2.0, 0.5, 0.7), 'stoneDark', { p: [lx, g + 0.05, lz], r: [0, ry, 0], c: ST_D });
    }
    // icicles off the trough's underside
    for (let t = 0.6; t < L; t += 1.3) { const k = t / L, lx = ax + (bx - ax) * k - ox, lz = az + (bz - az) * k - oz, y = ya + (yb - ya) * k, Ln = b.r(0.3, 1.2); b.add(cyl(0.08, 0.005, Ln, 5), 'ice', { p: [lx + b.r(-0.5, 0.5), y - 0.1 - Ln / 2, lz], c: '#ffffff' }); }
    s0 += L;
  }
  return b;
}

// a Makers' mill on a levelled pad: a stone house with a flat roof, its solid wheel on the east side under the end of the
// flume, half buried in a mound of ice and old snow
function mill(seed, flip = false) {
  const b = new Builder(seed);
  const h = sluiceHouse(seed + 1, { w: 7, d: 6, h: 4.8, wins: 2, sideWins: 1, door: 1.3 });
  b.addBuilder(h.builder, { r: [0, flip ? PI : 0, 0] }); // its door faces the spur track in from the main road
  b.addBuilder(waterWheel(seed + 2, 3.2, 0.6, 16, 1), { p: [4.4, 2.6, 0] });
  // the axle bearings: square stone piers either side of the wheel
  for (const x of [3.65, 5.15]) b.add(box(0.5, 2.8, 0.9), 'stoneDark', { p: [x, 1.2, 0], c: ST_D });
  // the wheel pit's stone walls and the ice that fills it
  for (const sz of [-1, 1]) b.add(box(2.6, 1.0, 0.5), 'stoneDark', { p: [4.4, 0.2, sz * 3.9], c: ST_D });
  b.add(lumpy(sphere(2.4, 14, 8), 0.3, 1.4, seed + 3, { flatBottom: 0 }), 'ice', { p: [4.6, -0.2, 0], s: [1.2, 0.55, 1.9], c: '#ffffff', uv: 'box' });
  b.add(lumpy(sphere(2.0, 12, 8), 0.3, 1.4, seed + 4, { flatBottom: 0 }), 'snowPack', { p: [-1.5, -0.3, -3.6], s: [2.2, 0.7, 1.1], c: SNOW, uv: 'box' });
  // a gear housing on the house's east wall where the axle goes in (a square iron box)
  b.add(box(0.6, 1.4, 1.4), 'wIron', { p: [3.3, 2.6, 0], c: '#4a4c50' });
  return res(b, { colliders: [{ x: 0, z: 0, hw: 3.7, hd: 3.2 }, { x: 4.6, z: 0, hw: 1.4, hd: 3.9 }] });
}

// an outlet sluice at the dam's foot, astride a channel head: two square stone piers, a flat stone lintel (no arch) with an
// iron gate raised in its guides, a flat roof with a winch house; ice spilling out under the gate and hanging off the lintel
function sluiceTower(seed) {
  const b = new Builder(seed), glows = [];
  for (const sz of [-1, 1]) {
    b.add(box(2.6, 11, 2.6), 'stone', { p: [0, 4.5, sz * 3.6], c: ST, us: 0.45, ao: { y0: -1, y1: 3, min: 0.7 } });
    for (const y of [3.2, 6.4]) b.add(box(2.8, 0.22, 2.8), 'stoneLarge', { p: [0, y, sz * 3.6], c: ST_L });
    b.add(box(0.5, 1.2, 0.12), 'stoneDark', { p: [-1.32, 7.8, sz * 3.6], c: ST_D });
  }
  // the lintel and the gate frame
  b.add(box(2.8, 1.4, 4.8), 'stoneLarge', { p: [0, 6.0, 0], c: ST_L });
  for (const sz of [-1, 1]) b.add(box(0.3, 5.4, 0.3), 'wIron', { p: [-0.4, 2.6, sz * 2.2], c: '#3a3c40' });
  b.add(box(0.2, 2.6, 4.2), 'wIron', { p: [-0.4, 3.9, 0], c: '#4a4c52' });
  for (let i = -3; i <= 3; i++) b.add(box(0.26, 2.6, 0.1), 'wIron', { p: [-0.5, 3.9, i * 0.6], c: '#36383c' });
  // roof slab over both piers, a low square parapet, the winch house and its chain drum (a short solid drum)
  b.add(box(3.4, 0.4, 10.4), 'stoneDark', { p: [0, 10.1, 0], c: ST_D });
  for (const sz of [-1, 1]) b.add(box(3.4, 0.6, 0.3), 'stone', { p: [0, 10.6, sz * 5.05], c: ST });
  for (const sx of [-1, 1]) b.add(box(0.3, 0.6, 10.4), 'stone', { p: [sx * 1.55, 10.6, 0], c: ST });
  b.add(box(2.2, 1.8, 2.6), 'stone', { p: [0, 11.2, 0], c: ST });
  b.add(box(2.6, 0.2, 3.0), 'stoneDark', { p: [0, 12.2, 0], c: ST_D });
  b.add(cyl(0.45, 0.45, 2.0, 16), 'wIron', { p: [-1.3, 10.9, 0], r: [PI / 2, 0, 0], c: '#3a3c40' });
  roofSnow(b, 2.9, 9.8, 10.3);
  b.add(box(0.7, 0.5, 0.6), 'wGlowAmber', { p: [-1.3, 9.0, 2.2] });
  glows.push({ p: [-1.8, 9.0, 2.2], color: 0xffb060, size: 2.4, intensity: 0.5 });
  // frozen spill: a tongue of ice out under the gate, icicles off the lintel
  b.add(lumpy(sphere(1.6, 12, 8), 0.25, 1.6, seed + 5, { flatBottom: 0 }), 'iceBlue', { p: [-1.6, 0.0, 0], s: [1.8, 0.6, 1.3], c: '#ffffff', uv: 'box' });
  icicles(b, -1.45, -2.3, -1.45, 2.3, 5.3, 14, 1.6);
  return res(b, { glows, colliders: [{ x: 0, z: -3.6, hw: 1.4, hd: 1.4 }, { x: 0, z: 3.6, hw: 1.4, hd: 1.4 }] });
}

// a wheel-hammer house on the Dam Crown: a stone house, a great solid wheel on its north wall half sunk in ice, a trip
// hammer (a timber beam on a square trestle, an iron head over an anvil block) locked fast in the frost
function hammerWorks(seed) {
  const b = new Builder(seed);
  const h = sluiceHouse(seed + 1, { w: 9, d: 7, h: 5.4, wins: 3, sideWins: 1, door: 2.0, chimney: 0 });
  b.addBuilder(h.builder);
  b.addBuilder(waterWheel(seed + 2, 4.2, 0.8, 20, 1), { p: [0, 2.2, -4.8], r: [0, PI / 2, 0] });
  b.add(box(1.0, 3.4, 0.6), 'stoneDark', { p: [0, 0.6, -6.3], c: ST_D }); // the outer bearing pier on the axle
  b.add(lumpy(sphere(3, 14, 8), 0.3, 1.3, seed + 3, { flatBottom: 0 }), 'ice', { p: [0, -0.4, -5.2], s: [1.6, 0.6, 1.1], c: '#ffffff', uv: 'box' });
  // the trip hammer beside the house (east)
  for (const sz of [-1, 1]) b.add(box(0.4, 3.2, 0.4), 'beam', { p: [6.8, 1.6, sz * 0.8], c: 0xffffff });
  b.add(box(0.5, 0.4, 2.2), 'beam', { p: [6.8, 3.2, 0], c: 0xffffff });
  b.add(box(6.0, 0.45, 0.45), 'beam', { p: [6.4, 3.0, 0], r: [0, 0, -0.12], c: '#6a4e34' });
  b.add(box(1.0, 1.2, 1.0), 'wIron', { p: [9.2, 2.5, 0], c: '#3e4044' });
  b.add(box(1.6, 1.0, 1.4), 'stoneDark', { p: [9.2, 0.4, 0], c: ST_D });
  b.add(lumpy(sphere(1.4, 10, 8), 0.3, 1.6, seed + 4, { flatBottom: 0 }), 'snowPack', { p: [8.4, 0, 1.2], s: [1.6, 0.5, 1], c: SNOW, uv: 'box' });
  return res(b, { colliders: [{ x: 0, z: 0, hw: 4.7, hd: 3.7 }, { x: 0, z: -5.2, hw: 4.6, hd: 1.3 }, { x: 8, z: 0, hw: 2, hd: 1.2 }] });
}

// the buried works: a fallen square sluice frame, a solid wheel lying tipped in the ice, a gear box, a run of iron pipe
function buriedWorks(seed) {
  const b = new Builder(seed);
  b.add(lumpy(sphere(5, 16, 9), 0.25, 1.1, seed, { flatBottom: 0 }), 'ice', { p: [0, -1.4, 0], s: [1.4, 0.5, 1.1], c: '#ffffff', uv: 'box' });
  b.addBuilder(waterWheel(seed + 1, 3.4, 0.6, 16, 0), { p: [-1.5, 0.9, 0.5], r: [0.25, 0.4, 1.15] });
  for (const sx of [-1, 1]) b.add(box(0.5, 6, 0.5), 'stoneDark', { p: [3.5 + sx * 1.6, 1.4, -2.5], r: [0, 0, 0.35], c: ST_D });
  b.add(box(4.2, 0.6, 0.6), 'stoneLarge', { p: [4.7, 4.0, -2.5], r: [0, 0, 0.35], c: ST_L });
  b.add(box(2.2, 1.6, 1.8), 'wIron', { p: [2.6, 0.2, 2.6], r: [0.1, 0.5, 0.12], c: '#44464a' });
  for (const [x, z, ry] of [[-4, -3, 0.5], [5.5, 2.5, -0.3]]) { b.add(cyl(0.45, 0.45, 5, 14), 'wIron', { p: [x, 0.1, z], r: [PI / 2, ry, 0], order: 'YXZ', c: '#4a4c50' }); }
  b.add(lumpy(sphere(2.4, 12, 8), 0.3, 1.4, seed + 7, { flatBottom: 0 }), 'snowPack', { p: [-3.5, -0.2, 3], s: [1.4, 0.45, 1], c: SNOW, uv: 'box' });
  return res(b, { colliders: [{ x: -1.2, z: 0.4, r: 3.4 }, { x: 3.5, z: -2.5, hw: 2.2, hd: 0.8 }, { x: 2.6, z: 2.6, r: 1.4 }] });
}

// a footbridge over a channel: a plank deck on two squared beams, stone abutments, plain timber rails on square posts
function footbridge(seed, hl, hw) {
  const b = new Builder(seed), L = hl * 2, W = hw * 2;
  b.add(box(L, 0.14, W), 'wood', { p: [0, -0.07, 0], c: '#8a6e50', us: 1 });
  for (const sz of [-1, 1]) b.add(box(L + 0.6, 0.4, 0.3), 'beam', { p: [0, -0.34, sz * (hw - 0.3)], c: 0xffffff });
  for (const sx of [-1, 1]) b.add(box(1.4, 2.2, W + 0.6), 'stoneDark', { p: [sx * (hl - 0.2), -1.4, 0], c: ST_D });
  for (const sz of [-1, 1]) {
    for (let x = -hl + 0.3; x <= hl - 0.25; x += (L - 0.6) / 3) b.add(box(0.16, 1.1, 0.16), 'beam', { p: [x, 0.5, sz * (hw - 0.1)], c: 0xffffff });
    b.add(box(L - 0.4, 0.12, 0.14), 'beam', { p: [0, 1.0, sz * (hw - 0.1)], c: 0xffffff });
    b.add(box(L - 0.4, 0.08, 0.16), 'snowPack', { p: [0, 1.1, sz * (hw - 0.1)], c: SNOW });
  }
  icicles(b, -hl + 1.2, -hw + 0.3, hl - 1.2, -hw + 0.3, -0.5, 10, 0.7);
  return res(b, { colliders: [] });
}

// ------------------------------------------------------------------ scatter prefabs
export function frostRock(seed, tint = '#4e5258') {
  const b = new Builder(seed);
  const n = 1 + (seed % 3);
  for (let i = 0; i < n; i++) {
    const s = i === 0 ? 1 : 0.55, px = i ? b.r(-1, 1) : 0, pz = i ? b.r(-1, 1) : 0, sy = b.r(0.5, 0.9) * s;
    addRock(b, [px, 0, pz], [b.r(0.8, 1.5) * s, sy, b.r(0.8, 1.4) * s], seed * 7 + i, { mat: 'rock', moss: 0, tint });
    b.add(lumpy(sphere(0.7 * s, 10, 6, 0, PI * 2, 0, PI / 2), 0.15, 2, seed * 3 + i, { flatBottom: 0 }), 'snowPack', { p: [px, sy * 0.95, pz], s: [1.3, 0.35, 1.2], c: SNOW, uv: 'box' });
  }
  return { builder: b, collider: { r: 1.1 } };
}
export function iceBlock(seed) {
  const b = new Builder(seed);
  const n = 1 + (seed % 3);
  for (let i = 0; i < n; i++) {
    const s = i ? 0.55 : 1;
    b.add(lumpy(ico(1, 1), 0.12, 1.4, seed * 5 + i, { flatBottom: 0 }), i % 2 ? 'ice' : 'iceBlue', { p: [i ? b.r(-1, 1) : 0, 0.3 * s, i ? b.r(-1, 1) : 0], s: [b.r(0.9, 1.4) * s, b.r(0.8, 1.6) * s, b.r(0.8, 1.2) * s], r: [b.r(-0.3, 0.3), b.r(0, 3), b.r(-0.3, 0.3)], c: '#ffffff', flat: true });
  }
  return { builder: b, collider: { r: 1.2 } };
}
// a leaning slab of lake ice pushed up on edge (pressure ridges)
export function iceSlab(seed) {
  const b = new Builder(seed);
  for (let i = 0; i < 3; i++) b.add(box(b.r(1.2, 2.4), 0.3, b.r(0.9, 1.6)), i % 2 ? 'ice' : 'iceBlue', { p: [i * 1.1 - 1.1, 0.25, b.r(-0.3, 0.3)], r: [b.r(-0.5, 0.5), b.r(-0.4, 0.4), b.r(0.4, 0.9) * (i % 2 ? 1 : -1)], c: '#ffffff' });
  return { builder: b, collider: { r: 1.4 } };
}
export function drift(seed) {
  const b = new Builder(seed);
  b.add(lumpy(sphere(1.6, 14, 8), 0.22, 1.2, seed, { flatBottom: 0 }), 'snowPack', { s: [b.r(1.1, 1.9), 0.32, b.r(0.8, 1.2)], c: SNOW, uv: 'box' });
  return { builder: b };
}
function floe(seed) {
  const b = new Builder(seed);
  b.add(lumpy(cyl(1.6, 1.4, 0.5, 9), 0.25, 1.2, seed, { flatBottom: 0 }), 'ice', { p: [0, 0.05, 0], s: [b.r(1, 1.8), 1, b.r(0.8, 1.3)], c: '#ffffff', flat: true });
  b.add(lumpy(cyl(1.3, 1.3, 0.12, 9), 0.2, 1.4, seed + 1, { flatBottom: 0 }), 'snowPack', { p: [0, 0.33, 0], s: [b.r(0.9, 1.5), 1, b.r(0.7, 1.1)], c: SNOW });
  return { builder: b };
}
function shingle(seed) {
  const b = new Builder(seed);
  for (let i = 0; i < 5; i++) addRock(b, [b.r(-1, 1), 0, b.r(-1, 1)], [b.r(0.2, 0.4), b.r(0.12, 0.22), b.r(0.2, 0.35)], seed * 11 + i, { mat: 'rock', moss: 0, tint: i % 2 ? '#7a7c80' : '#5e6066' });
  return { builder: b };
}
// a serac: a tall blocky tower of glacier ice
function serac(seed) {
  const b = new Builder(seed);
  const n = 2 + (seed % 3);
  for (let i = 0; i < n; i++) b.add(lumpy(taper(new THREE.BoxGeometry(b.r(2, 3.6), b.r(4, 9), b.r(2, 3.4), 3, 6, 3), b.r(0.55, 0.85), b.r(0.55, 0.85), 'y'), 0.55, 0.9, seed * 3 + i, { flatBottom: 0 }), i === 1 ? 'iceBlue' : 'ice', { p: [b.r(-1.6, 1.6), 0.5, b.r(-1.6, 1.6)], r: [b.r(-0.12, 0.12), b.r(0, 3), b.r(-0.12, 0.12)], c: '#ffffff', flat: true });
  return { builder: b, collider: { r: 2.6 } };
}

// ------------------------------------------------------------------ the area
export function buildRime(W, S) {
  W_ = W;
  const T = W.terrain;
  const H = (x, z) => T.height(x, z);
  const put = (key, x, z, r = 0, s = 1, sink = 0.05) => S.place(key, x, H(x, z) - sink, z, r, s);
  const pre = (key, r2) => { if (!S.prefabs.has(key)) S.addPrefab(key, r2); };
  for (let v = 0; v < 4; v++) pre('frock' + v, frostRock(v + 151));
  for (let v = 0; v < 2; v++) pre('fboulder' + v, frostRock(v + 161, '#6a6e74'));
  for (let v = 0; v < 3; v++) pre('iceblock' + v, iceBlock(v + 171));
  for (let v = 0; v < 2; v++) pre('iceslab' + v, iceSlab(v + 176));
  for (let v = 0; v < 3; v++) pre('sdrift' + v, drift(v + 181));
  for (let v = 0; v < 3; v++) pre('floe' + v, floe(v + 186));
  for (let v = 0; v < 2; v++) pre('shingle' + v, shingle(v + 191));
  for (let v = 0; v < 3; v++) pre('serac' + v, serac(v + 194));
  pre('lantern', P.lanternPost(401, 'yellow'));
  pre('crates', P.crateStack(402));
  pre('sacks', sacks(403));
  pre('bench', stoneBench(404));
  const place = (r2, x, z, ry = 0, yOff = 0) => placeObj(r2, x, z, ry, yOff);

  // ---------------------------------------------------------------- the pier and the ship
  {
    const Pi = RIME.pier, top = Pi.top, L = Pi.x1 - Pi.x0, zc = (Pi.z0 + Pi.z1) / 2;
    const pier = new Builder(410);
    pier.add(box(L, 0.16, 4.8), 'wood', { p: [L / 2, top - 0.08, 0], c: '#9a8a74', us: 1 });
    pier.add(box(L, 0.06, 4.6), 'snowPack', { p: [L / 2, top + 0.02, 0], s: [1, 1, 0.25], c: SNOW }); // a strip of old snow down the middle
    for (let x = 1; x < L; x += 4) for (const sz of [-2.3, 2.3]) pier.add(cyl(0.16, 0.18, 9, 8), 'woodDark', { p: [x, top - 4.6, sz], c: 0xffffff });
    // ice collars on the piles at the waterline
    for (let x = 1; x < L - 6; x += 4) for (const sz of [-2.3, 2.3]) pier.add(lumpy(cyl(0.42, 0.5, 0.35, 8), 0.1, 2, x * 3 + (sz > 0 ? 1 : 0), { flatBottom: 0 }), 'ice', { p: [x, 0.05, sz], c: '#ffffff' });
    pier.add(box(L, 0.12, 0.14), 'woodDark', { p: [L / 2, top + 0.55, 2.35], c: 0xffffff });
    for (const [a, z] of [[0, 405 - Pi.x0], [409 - Pi.x0, L]]) pier.add(box(z - a, 0.12, 0.14), 'woodDark', { p: [(a + z) / 2, top + 0.55, -2.35], c: 0xffffff });
    for (let x = 2; x < L; x += 4) for (const sz of [-2.35, 2.35]) if (!(sz < 0 && x + Pi.x0 > 404 && x + Pi.x0 < 410)) pier.add(cyl(0.06, 0.06, 0.6, 6), 'woodDark', { p: [x, top + 0.28, sz], c: 0xffffff });
    placeAt(res(pier), Pi.x0, 0, zc, 0);
    // the steam ship along the pier's north side, bow out to sea (as on the Reach; ship space x = world z - SZ, z = SX - world x)
    const SX = RIME.berth.x, SZ = RIME.berth.z, loc = (wx, y, wz) => [wz - SZ, y, SX - wx];
    const ship = buildSteamship({ gangway: loc(407, top, zc - 0.6), bollards: [loc(410.4, top, zc - 1.75), loc(399.7, top, zc - 1.75)], ropes: [[-16.0, 0], [-12.6, 0], [-1.0, 1], [14.2, 1]], iceBow: true }); // only the refitted ship gets this far north
    const obj = placeAt({ builder: new Builder(1), dynamics: [ship], colliders: [{ x: 0, z: 0, hw: 3.95, hd: 17.2 }, { x: 5.25, z: -14.4, r: 0.3 }, { x: 5.25, z: -3.7, r: 0.3 }] }, SX, 0, SZ, -PI / 2);
    obj.name = 'rimeShip';
    W.rimeShip = obj;
    for (const x of [396, 414, 428]) S.place('lantern', x, top, zc + 2.1, PI, 0.9);
    S.place('crates', 424, top, zc + 1.4, 0.3, 0.85);
    S.place('sacks', 417, top, zc + 1.5, 1.2, 0.8);
    const desk = new Builder(411);
    desk.add(box(1.6, 1.0, 0.7), 'woodDark', { p: [0, 0.5, 0], c: '#7a6450' });
    desk.add(box(1.8, 0.08, 0.9), 'wood', { p: [0, 1.04, 0], c: '#9a8064' });
    desk.add(box(0.5, 0.06, 0.36), 'cloth', { p: [0.3, 1.1, 0], c: '#e8dcc0' });
    placeAt(res(desk, { collider: { r: 0.9 } }), 430.6, top, zc + 2.4, 0);
  }

  // ---------------------------------------------------------------- the Icefall Landing camp
  const C = RIME.camp;
  const face = (x, z) => Math.atan2(C.x - x, C.z - z); // turn a front (+z) toward the square
  place(cistern(420), C.x, C.z - 4.5, 0);
  for (const a of [-150, -40, 47, 125, -3]) { const r = a * PI / 180; put('lantern', C.x + Math.cos(r) * 10.5, C.z + Math.sin(r) * 10.5, -r); }
  put('bench', C.x - 4, C.z + 6, PI); put('bench', C.x + 4, C.z + 6, PI);
  // the harbour office, the storehouse, the bunkhouse and the workshop: enterable works houses (shared/houses.js rm_*)
  W.buildHouses('rime');
  { const x = 472.7, z = -1658.5, t = squareTower(424, 4.4, 11, ST); roofSnow(t.builder, 4.6, 4.6, 11.05); place(t, x, z, face(x, z)); } // the watchtower over the road east
  place(tank(427), 469.5, -1665, 0.2);
  place(timberShed(428, 5, 3.4, 2.8), 435.5, -1640, PI); // a woodshed by the pier road
  for (const [x, z, r] of [[438, -1662, 0.3], [446.5, -1666, 1.2], [472, -1668, 2.0], [458, -1631, 0.4], [442, -1635, 2.6]]) put('crates', x, z, r);
  for (const [x, z, r] of [[440.5, -1664, 1.1], [460, -1628, 2.6]]) put('sacks', x, z, r);
  { const c = RIME.caravan; place(P.cart(430), c.x - 1.8, c.z - 1.2, 0.5); put('crates', c.x + 3.4, c.z - 0.6, 0.7); put('sacks', c.x + 2.6, c.z + 1.6, 1.9); }
  { const g = RIME.grave; put('bench', g.x, g.z - 1.6, 0); put('lantern', g.x + 2.2, g.z - 1.2, 0.4); }
  // snow banked against the camp's north and south edges, shovelled off the square
  for (const [x, z, r, s] of [[452, -1672, 0.2, 1.3], [470, -1671, 2.4, 1.1], [445, -1628, 1.0, 1.2], [474, -1630, 0.6, 1.0], [436, -1640, 1.9, 0.9]]) put('sdrift' + (Math.round(x) % 3), x, z, r, s, 0.25);
  // a low cold-stone wind wall on the north and south of the camp, open to the road
  {
    const wall = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), b = new Builder(Math.round(x0 * 3 + z0));
      b.add(box(len, 1.2, 0.6), 'stone', { p: [0, 0.3, 0], c: ST }); b.add(box(len + 0.1, 0.16, 0.76), 'stoneLarge', { p: [0, 0.96, 0], c: ST_L });
      b.add(box(len, 0.14, 0.6), 'snowPack', { p: [0, 1.1, 0], c: SNOW });
      for (let t = -len / 2; t <= len / 2 + 0.01; t += len / Math.max(1, Math.round(len / 4))) b.add(box(0.8, 1.6, 0.8), 'stoneDark', { p: [t, 0.5, 0], c: ST_D });
      placeObj(res(b, { colliders: [{ x: 0, z: 0, hw: len / 2, hd: 0.4 }] }), (x0 + x1) / 2, (z0 + z1) / 2, -Math.atan2(z1 - z0, x1 - x0));
    };
    wall(436, -1673, 448, -1675); wall(476, -1673, 484, -1665); wall(436, -1627, 448, -1624); wall(476, -1627, 484, -1634);
  }

  // ---------------------------------------------------------------- footbridges and ramp kerbs
  for (const [i, B] of RIME.bridges.entries()) placeAt(footbridge(440 + i, B.hl, B.hw), B.x, B.top, B.z, Math.atan2(-B.uz, B.ux));
  for (const [ri, R] of RIME.ramps.entries()) {
    if (ri === 3) continue; // the short step down off the crest onto the ice
    const [ox, oz] = R[0], b = new Builder(450 + ri);
    for (let i = 0; i < R.length - 1; i++) {
      const [ax, az] = R[i], [bx, bz] = R[i + 1], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, ry = Math.atan2(ux, uz);
      for (let t = 0.8; t < L - 0.5; t += 1.7) for (const sd of [-1, 1]) {
        if (ri === 2 && sd > 0) continue; // the dam face is that side
        const x = ax + ux * t - uz * sd * 3.1, z = az + uz * t + ux * sd * 3.1, y = H(x, z);
        b.add(rbox(0.6, 0.7, 1.5, 0.05), 'stoneDark', { p: [x - ox, y + 0.15, z - oz], r: [0, ry, 0], c: ST_D });
        b.add(box(0.5, 0.08, 1.4), 'snowPack', { p: [x - ox, y + 0.54, z - oz], r: [0, ry, 0], c: SNOW });
      }
    }
    placeAt(res(b), ox, 0, oz, 0);
  }

  // ---------------------------------------------------------------- the frozen falls where the channels cross the faces
  for (const [ci, Ch] of RIME.channels.entries()) {
    const pts = [];
    for (let i = 0; i < Ch.length - 1; i++) {
      const [ax, az] = Ch[i], [bx, bz] = Ch[i + 1], L = Math.hypot(bx - ax, bz - az);
      for (let t = 0; t < L; t += 0.8) { const x = ax + (bx - ax) * (t / L), z = az + (bz - az) * (t / L), ux = (bx - ax) / L, uz = (bz - az) / L; pts.push([x, z, ux, uz]); }
    }
    // runs of steep samples: one curtain of ice per run
    let run = [];
    const flush = () => {
      if (run.length < 4) { run = []; return; }
      const [ox, oz] = run[0], b = new Builder(460 + ci * 10 + Math.round(ox));
      for (const [x, z, ux, uz] of run) {
        for (let k = -2.4; k <= 2.4; k += 0.75) {
          // a draped sheet of ice (flattened lumps lying on the slope) with icicle columns standing out of it
          const px = x - uz * k + b.r(-0.3, 0.3), pz = z + ux * k + b.r(-0.3, 0.3), g = H(px, pz);
          b.add(lumpy(ico(0.7, 1), 0.25, 2.2, Math.round(px * 13 + pz * 7), { flatBottom: 0 }), Math.abs(k) < 1.0 && b.r() < 0.5 ? 'iceBlue' : 'ice', { p: [px - ox, g - 0.1, pz - oz], s: [b.r(0.9, 1.4), b.r(0.4, 0.8), b.r(0.9, 1.4)], r: [0, b.r(0, 3), 0], c: '#ffffff' });
          if (b.r() < 0.45) { const Ln = b.r(0.8, 2.6) * (1 - Math.abs(k) / 4); b.add(cyl(b.r(0.08, 0.2), 0.01, Ln, 7), 'ice', { p: [px - ox + b.r(-0.3, 0.3), g + Ln / 2 - 0.2, pz - oz + b.r(-0.3, 0.3)], r: [b.r(-0.1, 0.1), 0, b.r(-0.1, 0.1)], c: '#ffffff' }); }
        }
        if (b.r() < 0.35) b.add(lumpy(ico(0.8, 1), 0.2, 1.6, Math.round(x * 7), { flatBottom: 0 }), 'ice', { p: [x - ox, H(x, z) - 0.2, z - oz], s: [1.6, 0.7, 1.4], c: '#ffffff' });
      }
      placeAt(res(b), ox, 0, oz, 0);
      run = [];
    };
    for (const pt of pts) {
      const [x, z, ux, uz] = pt, dh = Math.abs(rimeHeight(x + ux * 0.8, z + uz * 0.8) - rimeHeight(x - ux * 0.8, z - uz * 0.8)) / 1.6;
      if (x < RIME.dam.x - 6 && dh > 0.35) run.push(pt); else flush();
    }
    flush();
  }

  // ---------------------------------------------------------------- the mills on the Flume Works and their flumes
  {
    const [Wn, Ws] = RIME.works;
    place(mill(470), Wn.x, Wn.z, 0, -0.1);
    place(mill(480, true), Ws.x, Ws.z, 0, -0.1);
    // the flumes take water off the channels up on the Dam Crown and run down over the face on trestles to each wheel's top
    const fl = (seed, pts, wz) => {
      const y0 = H(pts[0][0], pts[0][1]) + 1.0, y1 = H(548, wz) + 6.9;
      placeAt(res(flume(seed, pts, y0, y1, H)), pts[0][0], 0, pts[0][1], 0);
      // the intake: a small stone sluice box on the channel bank
      const b = new Builder(seed + 1);
      b.add(box(2.4, 1.8, 2.4), 'stone', { p: [0, 0.4, 0], c: ST }); b.add(box(2.7, 0.2, 2.7), 'stoneLarge', { p: [0, 1.35, 0], c: ST_L });
      b.add(box(1.8, 0.2, 1.8), 'snowPack', { p: [0, 1.55, 0], c: SNOW });
      placeObj(res(b, { collider: { r: 1.5 } }), pts[0][0], pts[0][1], 0, -0.2);
    };
    fl(490, [[585, -1693.5], [552.4, -1687], [552.4, -1679.6]], Wn.z);
    fl(495, [[585, -1607.8], [552.4, -1613], [552.4, -1620.4]], Ws.z);
    // snow drifts and ice about the pads
    const rng = mulberry32(497);
    for (const Wk of RIME.works) for (let i = 0; i < 7; i++) {
      const a = rng() * PI * 2, d = Wk.r * (0.75 + rng() * 0.5), x = Wk.x + Math.cos(a) * d, z = Wk.z + Math.sin(a) * d;
      if (Math.abs(x - 552) < 3 || rimePathDist(x, z) < 3.2) continue; // (RF.7 review) never on the mill tracks (one ice block stood on the re-routed north one)
      put(rng() < 0.6 ? 'sdrift' + (i % 3) : 'iceblock' + (i % 3), x, z, rng() * 6, 0.7 + rng() * 0.5, 0.2);
    }
  }

  // ---------------------------------------------------------------- the Dam Crown: the works, the dam, its sluices, the lake
  place(hammerWorks(500), 589.5, -1627, PI / 2 + 0.1, -0.2);
  place(buriedWorks(505), 589, -1686, 0.3, 0);
  {
    const D = RIME.dam, ox = D.x, oz = (D.z0 + D.z1) / 2, b = new Builder(510), cols = [];
    const gapW = (z) => z > -1644 && z < -1638; // the ramp's top onto the crest
    const gapE = (z) => z > -1655 && z < -1649; // (RF.7) the step down onto the ice, 11 m north of the way up (no + across the crest)
    const seg = 3;
    for (let z = D.z0; z < D.z1 - 0.01; z += seg) {
      const zc = z + seg / 2, lz = zc - oz;
      // the downstream (west) face: from below the tread up to just under the crest, dressed stone
      const g = Math.min(H(597, z), H(597, z + seg)), bot = Math.min(g, 36) - 2.5;
      if (!gapW(zc)) b.add(box(0.9, D.crest - 0.2 - bot, seg + 0.02), 'stone', { p: [-3.05, (D.crest - 0.2 + bot) / 2, lz], c: ST, us: 0.4, ao: { y0: bot, y1: bot + 4, min: 0.7 } });
      // the upstream (east) face against the ice
      if (!gapE(zc)) b.add(box(0.9, 4.0, seg + 0.02), 'stone', { p: [3.05, D.crest - 2.2, lz], c: ST, us: 0.4 });
      // parapets with coping, snow along their tops
      for (const sd of [-1, 1]) {
        if (sd < 0 ? gapW(zc) : gapE(zc)) continue;
        b.add(box(0.5, 0.9, seg + 0.02), 'stone', { p: [sd * 2.75, D.crest + 0.35, lz], c: ST });
        b.add(box(0.7, 0.14, seg + 0.04), 'stoneLarge', { p: [sd * 2.75, D.crest + 0.86, lz], c: ST_L });
        b.add(box(0.5, 0.1, seg), 'snowPack', { p: [sd * 2.75, D.crest + 0.98, lz], c: SNOW });
      }
      // string courses on the west face
      if (!gapW(zc)) for (const y of [D.crest - 1.4, D.crest - 4.6]) if (y > bot + 0.5) b.add(box(1.1, 0.2, seg + 0.04), 'stoneLarge', { p: [-3.1, y, lz], c: ST_L });
    }
    // square buttresses down the west face (not where the ramp climbs against it)
    for (let z = D.z0 + 6; z < D.z1 - 4; z += 10) {
      if (z > -1675 && z < -1636) continue;
      const g = H(596.5, z) - 2;
      b.add(box(1.4, D.crest + 0.9 - g, 1.6), 'stoneDark', { p: [-4.1, (D.crest + 0.9 + g) / 2, z - oz], c: ST_D, us: 0.45 });
      b.add(box(1.6, 0.16, 1.8), 'snowPack', { p: [-4.1, D.crest + 0.98, z - oz], c: SNOW });
      cols.push({ x: -4.1, z: z - oz, hw: 0.8, hd: 0.9 });
    }
    // the crest's colliders: both parapets, broken where the ramps come on
    for (const [sd, g0, g1] of [[-1, -1644, -1638], [1, -1655, -1649]]) {
      cols.push({ x: sd * 2.75, z: (D.z0 + g0) / 2 - oz, hw: 0.3, hd: (g0 - D.z0) / 2 });
      cols.push({ x: sd * 2.75, z: (g1 + D.z1) / 2 - oz, hw: 0.3, hd: (D.z1 - g1) / 2 });
    }
    // frozen spill down the west face: curtains of ice from under the coping to the tread, mounds of ice at the foot
    for (const zs of [-1704, -1686, -1679, -1626, -1618, -1600]) {
      for (let k = 0; k < 9; k++) {
        const z = zs + b.r(-1.6, 1.6), L = b.r(2.5, D.crest - 35);
        b.add(cyl(b.r(0.18, 0.36), 0.02, L, 6), k % 3 ? 'ice' : 'iceBlue', { p: [-3.55 - b.r(0, 0.25), D.crest - 0.4 - L / 2, z - oz], c: '#ffffff' });
      }
      b.add(lumpy(ico(1.3, 1), 0.25, 1.5, Math.round(-zs), { flatBottom: 0 }), 'iceBlue', { p: [-4.2, H(596, zs) - 0.3, zs - oz], s: [1.4, 0.8, 1.8], c: '#ffffff' });
    }
    placeAt(res(b, { colliders: cols }), ox, 0, oz, 0);
    // square towers at the dam's two ends, on the crest past the end of the walk
    for (const [z, sd] of [[-1710.5, 1], [-1593.5, -1]]) { const t = squareTower(515 + sd, 5, 8, ST); roofSnow(t.builder, 5.2, 5.2, 8.05); placeAt(t, ox, D.crest - 0.4, z, sd > 0 ? 0 : PI); }
    // the outlet sluices at the two channel heads, against the dam's foot
    for (const [ci, Ch] of RIME.channels.entries()) {
      const [x, z] = Ch[0], y = Math.max(H(x - 0.5, z - 3.6), H(x - 0.5, z + 3.6)) - 1.2;
      placeAt(sluiceTower(520 + ci), x - 0.5, y, z, 0);
    }
  }
  // the ice sheet of the lake: a glassy skin over the terrain's ice (behind the dam, up to the glacier); the ground's own ice
  // paint shows through it, the sky glints off it
  {
    const D = RIME.dam, x0 = RIME.lake.x0 - 0.6, x1 = RIME.glacier + 8, z0 = D.z0 - 12, z1 = D.z1 + 12;
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 1, 1); g.rotateX(-PI / 2);
    const m = new THREE.MeshStandardMaterial({ color: 0xbfe0f4, roughness: 0.22, metalness: 0.0, transparent: true, opacity: 0.32, depthWrite: false, envMapIntensity: 1.3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    const sheet = new THREE.Mesh(g, m);
    sheet.position.set((x0 + x1) / 2, RIME.lake.ice + 0.03, (z0 + z1) / 2);
    sheet.renderOrder = 3; sheet.name = 'rimeIceSheet';
    W.rimeGroup.add(sheet);
    // pressure ridges and snow on the ice
    const rng = mulberry32(530);
    for (let i = 0; i < 70; i++) {
      const x = RIME.lake.x0 + 4 + rng() * (RIME.glacier - RIME.lake.x0 - 6), z = RIME.axis.z - 52 + rng() * 104;
      if (Math.abs(H(x, z) - RIME.lake.ice) > 0.3 || (Math.abs(z + 1652) < 4 && x < 618)) continue;
      if (DUNGEONS.some((Dg) => Math.hypot(x - Dg.door.x, z - Dg.door.z) < 10)) continue; // keep the Sluice Galleries' gatehouse clear
      const k = rng();
      S.place(k < 0.4 ? 'iceslab' + (i % 2) : k < 0.75 ? 'sdrift' + (i % 3) : 'iceblock' + (i % 3), x, RIME.lake.ice - 0.1, z, rng() * 6, 0.6 + rng() * 0.6);
    }
    // the glacier's snout: seracs where the ice of the lake meets the glacier
    for (let z = RIME.axis.z - 56; z < RIME.axis.z + 56; z += 5.5 + rng() * 3) {
      const x = RIME.glacier + 1 + rng() * 5;
      if (H(x, z) > 70) continue;
      // sunk to the lowest of the slope and the lake ice, so none hangs over the lake
      S.place('serac' + Math.floor(rng() * 3), x, Math.min(H(x - 3, z), H(x - 1.5, z), H(x, z), H(x, z - 2.5), H(x, z + 2.5), RIME.lake.ice) - 2.2, z, rng() * 6, 0.8 + rng() * 0.6);
    }
  }

  // ---------------------------------------------------------------- floes in the sea
  {
    const rng = mulberry32(540);
    for (let i = 0; i < 420; i++) {
      const x = RIME.minX - 60 + rng() * (RIME.maxX - RIME.minX + 120), z = RIME.minZ - 60 + rng() * (RIME.maxZ - RIME.minZ + 120);
      const s = rimeShore(x, z);
      if (s < 4 || s > 90 || rng() > 1.2 - s / 80) continue;
      if (x < 440 && Math.abs(z - RIME.berth.z) < 22) continue; // keep the ship's lane and the berth clear
      S.place('floe' + (i % 3), x, -0.12, z, rng() * 6, 0.6 + rng() * 1.1);
    }
  }

  // ---------------------------------------------------------------- scatter over the valley
  {
    let rng = mulberry32(1);
    const seed = (a, b2) => { rng = mulberry32(Math.imul(a + 19, 73856093) ^ Math.imul(b2 + 23, 19349663) ^ 0x71e); };
    const pick = (base, n) => base + Math.floor(rng() * n);
    const R = RIME;
    const keep = (x, z, pad = 0) => {
      if (Math.hypot(x - C.x, z - C.z) < C.r + 4 + pad) return false;
      if (rimePathDist(x, z) < 4.5 + pad) return false;
      if (rimeChannel(x, z).d < 4 + pad) return false;
      for (const Wk of R.works) if (Math.hypot(x - Wk.x, z - Wk.z) < Wk.r * 1.4 + pad) return false;
      for (const [wx, wz, wr] of [[589.5, -1627, 12], [589, -1686, 9], [585, -1693.5, 4], [585, -1607.8, 4]]) if (Math.hypot(x - wx, z - wz) < wr + pad) return false;
      for (const Rm of R.ramps) for (let i = 0; i < Rm.length - 1; i++) { const [ax, az] = Rm[i], [bx, bz] = Rm[i + 1], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); if (Math.hypot(ax + dx * t - x, az + dz * t - z) < 5 + pad) return false; }
      if (Math.abs(x - R.dam.x) < 9 + pad && z > R.dam.z0 - 6 && z < R.dam.z1 + 6) return false;
      if (x > R.lake.x0 - 2) return false; // the lake and glacier are dressed above
      if (x < R.pier.x1 + 8 && Math.abs(z - (R.pier.z0 + R.pier.z1) / 2) < 12) return false;
      return true;
    };
    const cell = 5.5;
    for (let iz = 0, gz = R.minZ + 14; gz < R.maxZ - 14; iz++, gz += cell) for (let ix = 0, gx = R.minX + 14; gx < R.maxX - 14; ix++, gx += cell) {
      seed(ix, iz);
      const x = gx + rng() * cell, z = gz + rng() * cell, s = rimeShore(x, z), h = rimeHeight(x, z);
      if (s > -1 || !keep(x, z)) continue;
      const roll = rng(), zone = rimeZone(x, z), ex = 0.85 + rng() * 0.5, ry = rng() * PI * 2;
      const nx = rimeHeight(x + 1, z) - rimeHeight(x - 1, z), nz = rimeHeight(x, z + 1) - rimeHeight(x, z - 1), slope = Math.hypot(nx, nz) / 2;
      if (h < 2.2) { if (roll < 0.1) put(pick('shingle', 2), x, z, ry, ex); else if (roll < 0.15) put(pick('frock', 4), x, z, ry, ex * 0.8); else if (roll < 0.19) put(pick('iceblock', 3), x, z, ry, ex * 0.7, 0.2); continue; } // the shingle strand
      // the walls and the sea cliffs: frost-bitten rock with snow on its ledges
      if (slope > 0.6) { if (roll < 0.2) put(pick('frock', 4), x, z, ry, ex * 1.3, 0.4); else if (roll < 0.26) put(pick('fboulder', 2), x, z, ry, ex); continue; }
      if (zone === 'icefall') {
        if (roll < 0.07) put(pick('sdrift', 3), x, z, ry, ex, 0.2);
        else if (roll < 0.11) put(pick('frock', 4), x, z, ry, ex);
        else if (roll < 0.13) put(pick('fboulder', 2), x, z, ry, ex * 0.9);
        else if (roll < 0.14) put(pick('iceblock', 3), x, z, ry, ex * 0.7, 0.2);
      } else if (zone === 'flumeworks') {
        if (roll < 0.08) put(pick('sdrift', 3), x, z, ry, ex, 0.2);
        else if (roll < 0.12) put(pick('iceblock', 3), x, z, ry, ex * 0.8, 0.2);
        else if (roll < 0.16) put(pick('frock', 4), x, z, ry, ex);
      } else {
        if (roll < 0.1) put(pick('iceblock', 3), x, z, ry, ex, 0.2);
        else if (roll < 0.17) put(pick('sdrift', 3), x, z, ry, ex * 1.1, 0.2);
        else if (roll < 0.21) put(pick('frock', 4), x, z, ry, ex);
      }
    }
    // small stones and snow tufts everywhere above the waterline
    for (let i = 0; i < 600; i++) {
      seed(907, i);
      const x = R.minX + 20 + rng() * (R.maxX - R.minX - 40), z = R.minZ + 20 + rng() * (R.maxZ - R.minZ - 40);
      if (rimeShore(x, z) > -3 || !keep(x, z, -2)) continue;
      put(rng() < 0.6 ? pick('frock', 4) : pick('sdrift', 3), x, z, rng() * 6, 0.25 + rng() * 0.35, 0.08);
    }
    // the tracks: a stone or a drift by the wayside now and then
    for (const [pi, path] of R.paths.entries()) {
      if (pi === 5) continue; // the dam crest
      seed(951, pi);
      for (let i = 0; i < path.length - 1; i++) {
        const [ax, az] = path[i], [bx, bz] = path[i + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
        for (let t = rng() * 6; t < L; t += 5 + rng() * 6) for (const side of [-1, 1]) {
          const off = 5.2 + rng() * 2.5, x = ax + (bx - ax) * (t / L) + nx * off * side, z = az + (bz - az) * (t / L) + nz * off * side;
          if (Math.hypot(x - C.x, z - C.z) < C.r + 2 || rimeShore(x, z) > -3 || rng() > 0.45 || !keep(x, z, -4)) continue;
          put(rng() < 0.5 ? pick('frock', 4) : pick('sdrift', 3), x, z, rng() * 6, 0.45 + rng() * 0.4, 0.1);
        }
      }
    }
  }
}
