// The Cinder Reach (Part Ten): the island's dressing, built into the world's reachGroup (World.buildReach).
//   the landing pier and the steam ship at its berth · Ashfall Landing camp (ash-grey stone, square towers, flat roofs,
//   brass pipework) · scatter: black-sand boulders, basalt columns, cooling lava with glowing seams, ash drifts, slag ·
//   the Makers' old works on the plateau, half buried in ash, their furnaces still warm · steam off the cinder cone
// Content rules: no domes, arches, spires, crosses, stars, sunbursts or spoked wheels. Every roof is flat; checked from above.
import * as P from '../assets/props.js';
import { workTent } from '../assets/quarry.js';
import * as D from '../assets/dressing.js';
import { Builder, box, rbox, cyl, lumpy, sphere, ico, taper } from '../assets/kit.js';
import { addRock } from '../assets/trees.js';
import { buildSteamship } from '../assets/steamship.js';
import { REACH, reachHeight, reachShore, reachPathDist, reachZone } from '/sunmere-play/shared/reach.js';
import { mulberry32 } from '/sunmere-play/shared/noise.js';
import { DUNGEONS } from '/sunmere-play/shared/dungeons.js';

const PI = Math.PI;
const res = (b, extra = {}) => ({ builder: b, fires: [], glows: [], lanterns: [], smokes: [], colliders: [], ...extra });
const ASH = '#a29d96', ASH_D = '#6e6a64', ASH_L = '#bdb7ae', BRASS = '#d0a456';

// ------------------------------------------------------------------ building kit (local: front faces +z, ground at y 0)
// a brass pipe from a to b ([x, y, z]), with flanges at both ends
export function pipe(b, a, c, r = 0.09, mat = 'wBrass') {
  const dx = c[0] - a[0], dy = c[1] - a[1], dz = c[2] - a[2], L = Math.hypot(dx, dy, dz);
  if (L < 1e-3) return;
  const mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
  // cylinders run along y: tip them onto the segment's direction
  const yaw = Math.atan2(dx, dz), pitch = Math.acos(Math.max(-1, Math.min(1, dy / L)));
  b.add(cyl(r, r, L, 10), mat, { p: mid, r: [pitch, yaw, 0], order: 'YXZ' });
  for (const e of [a, c]) b.add(cyl(r * 1.55, r * 1.55, 0.07, 10), mat, { p: e, r: [pitch, yaw, 0], order: 'YXZ' });
}
// rectangular window with a stone frame, a lintel and warm glass (never arched)
export function windowBox(b, x, y, z, ry, w = 0.9, h = 1.2) {
  const fx = Math.sin(ry), fz = Math.cos(ry);
  b.add(box(w + 0.24, h + 0.24, 0.14), 'stoneDark', { p: [x, y, z], r: [0, ry, 0], c: ASH_D });
  b.add(box(w, h, 0.06), 'glassWarm', { p: [x + fx * 0.05, y, z + fz * 0.05], r: [0, ry, 0] });
  b.add(box(w * 0.08, h, 0.08), 'wIron', { p: [x + fx * 0.09, y, z + fz * 0.09], r: [0, ry, 0], c: '#3a3836' });
  b.add(box(w + 0.5, 0.2, 0.3), 'stoneLarge', { p: [x + fx * 0.08, y + h / 2 + 0.22, z + fz * 0.08], r: [0, ry, 0], c: ASH_L });
  b.add(box(w + 0.3, 0.1, 0.3), 'stoneLarge', { p: [x + fx * 0.08, y - h / 2 - 0.14, z + fz * 0.08], r: [0, ry, 0], c: ASH_L });
}
// a block of ash-grey stone: plinth down into the ground (hides slopes), corner quoins, a flat roof behind a parapet,
// windows, a timber door, brass downpipes and a run of pipe under the cornice; options add a chimney stack
export function stoneBlock(seed, { w = 8, d = 6, h = 4.2, plinth = 2, chimney = 0, door = 1.3, wins = 2, sideWins = 1, pipes = true, tint = ASH } = {}) {
  const b = new Builder(seed);
  b.add(box(w, h + plinth, d), 'stone', { p: [0, (h - plinth) / 2, 0], c: tint, us: 0.45, ao: { y0: -0.2, y1: 2.4, min: 0.7 } });
  b.add(box(w + 0.34, 0.8 + plinth, d + 0.34), 'stoneDark', { p: [0, 0.4 - plinth / 2, 0], c: ASH_D });
  // quoins: alternating long and short stones up each corner
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let y = 0.9, i = 0; y < h - 0.3; y += 0.55, i++) {
    const lx = i % 2 ? 0.7 : 0.42, lz = i % 2 ? 0.42 : 0.7;
    b.add(rbox(lx, 0.5, lz, 0.03), 'stoneLarge', { p: [sx * (w / 2 - lx / 2 + 0.06), y, sz * (d / 2 - lz / 2 + 0.06)], c: ASH_L });
  }
  // cornice, parapet and the flat roof
  b.add(box(w + 0.44, 0.26, d + 0.44), 'stoneDark', { p: [0, h, 0], c: ASH_D });
  for (const sz of [-1, 1]) b.add(box(w + 0.44, 0.6, 0.3), 'stone', { p: [0, h + 0.43, sz * (d / 2 + 0.07)], c: tint });
  for (const sx of [-1, 1]) b.add(box(0.3, 0.6, d + 0.44), 'stone', { p: [sx * (w / 2 + 0.07), h + 0.43, 0], c: tint });
  b.add(box(w + 0.5, 0.1, 0.36), 'stoneLarge', { p: [0, h + 0.77, d / 2 + 0.07], c: ASH_L });
  b.add(box(w + 0.5, 0.1, 0.36), 'stoneLarge', { p: [0, h + 0.77, -d / 2 - 0.07], c: ASH_L });
  b.add(box(w - 0.2, 0.12, d - 0.2), 'slate', { p: [0, h + 0.16, 0], c: '#5a5854' });
  // a square roof hatch and a vent box
  b.add(box(1.0, 0.4, 1.0), 'woodDark', { p: [-w * 0.25, h + 0.4, -d * 0.2], c: '#6a5a4a' });
  b.add(box(0.7, 0.6, 0.7), 'wIron', { p: [w * 0.22, h + 0.5, -d * 0.18], c: '#4a4846' });
  // the door, with a brass kick plate and a plain stone hood
  if (door) {
    b.add(box(door + 0.36, 2.55, 0.16), 'stoneDark', { p: [0, 1.27, d / 2 + 0.02], c: ASH_D });
    b.add(box(door, 2.3, 0.1), 'woodDark', { p: [0, 1.15, d / 2 + 0.08], c: '#7a6450' });
    b.add(box(door, 0.22, 0.04), 'wBrass', { p: [0, 0.2, d / 2 + 0.14] });
    b.add(box(door + 0.9, 0.16, 0.7), 'stoneLarge', { p: [0, 2.68, d / 2 + 0.3], c: ASH_L });
    b.add(box(door + 0.5, 0.22, 0.9), 'stoneDark', { p: [0, 0.1, d / 2 + 0.45], c: ASH_D }); // step
  }
  // windows: the front either side of the door, the sides
  for (let i = 0; i < wins; i++) {
    const x = (wins === 1 ? 0.6 : (i / (wins - 1) - 0.5)) * (w - 2.6);
    if (door && Math.abs(x) < door) continue;
    windowBox(b, x, 2.0, d / 2 + 0.02, 0);
  }
  for (const sx of [-1, 1]) for (let i = 0; i < sideWins; i++) windowBox(b, sx * (w / 2 + 0.02), 2.0, (sideWins === 1 ? 0 : (i / (sideWins - 1) - 0.5) * (d - 2.4)), sx * PI / 2, 0.8, 1.1);
  if (pipes) {
    // a downpipe at a back corner and a run along the side under the cornice, into the ground
    const px = w / 2 + 0.22, pz = -d / 2 + 0.6;
    pipe(b, [px, h - 0.25, pz], [px, -0.2, pz], 0.1);
    pipe(b, [px, h - 0.4, pz], [px, h - 0.4, d / 2 - 0.8], 0.08);
    pipe(b, [px, h - 0.4, d / 2 - 0.8], [px, 0.6, d / 2 - 0.8], 0.08);
    for (let y = 0.8; y < h - 0.4; y += 1.1) b.add(box(0.12, 0.08, 0.3), 'wIron', { p: [px - 0.1, y, pz], c: '#3a3836' });
    // a brass gauge box by the door
    b.add(box(0.36, 0.46, 0.14), 'wBrass', { p: [door ? door / 2 + 0.7 : 1, 1.6, d / 2 + 0.08] });
    b.add(box(0.24, 0.24, 0.04), 'wDark', { p: [door ? door / 2 + 0.7 : 1, 1.66, d / 2 + 0.16], c: '#e8e0c8' });
  }
  const smokes = [];
  if (chimney) {
    // a square stack at the back, brass-banded, with an iron cap slab
    const cx = -w / 2 + 1.0, cz = -d / 2 + 1.0;
    b.add(box(1.2, chimney + 1, 1.2), 'stone', { p: [cx, h + chimney / 2, cz], c: tint });
    for (const y of [h + 0.9, h + chimney - 0.4]) b.add(box(1.32, 0.18, 1.32), 'wBrass', { p: [cx, y, cz] });
    b.add(box(1.5, 0.14, 1.5), 'wIron', { p: [cx, h + chimney + 0.55, cz], c: '#3a3836' });
    for (const [ox, oz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) b.add(box(0.14, 0.42, 0.14), 'wIron', { p: [cx + ox, h + chimney + 0.3, cz + oz], c: '#3a3836' });
    smokes.push({ p: [cx, h + chimney + 0.9, cz], opts: { rate: 2.2, life: 5, size: 1.3, rise: 1.6, color: 0x6a6460, opacity: 0.4, spread: 0.3 } });
  }
  return res(b, { smokes, colliders: [{ x: 0, z: 0, hw: w / 2 + 0.2, hd: d / 2 + 0.2 }] });
}

// a square watchtower: four storeys of ash stone, slit windows, a flat lookout behind square merlons, a brass signal lamp box
export function squareTower(seed, s = 4.4, h = 11, tint = ASH) {
  const b = new Builder(seed);
  b.add(box(s, h + 2, s), 'stone', { p: [0, h / 2 - 1, 0], c: tint, us: 0.45, ao: { y0: -0.2, y1: 3, min: 0.7 } });
  b.add(box(s + 0.5, 2.8, s + 0.5), 'stoneDark', { p: [0, -0.4, 0], c: ASH_D });
  for (const y of [3.6, 7.2]) b.add(box(s + 0.24, 0.22, s + 0.24), 'stoneLarge', { p: [0, y, 0], c: ASH_L });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let y = 1.4, i = 0; y < h - 0.3; y += 0.6, i++) {
    const lx = i % 2 ? 0.7 : 0.42, lz = i % 2 ? 0.42 : 0.7;
    b.add(rbox(lx, 0.55, lz, 0.03), 'stoneLarge', { p: [sx * (s / 2 - lx / 2 + 0.06), y, sz * (s / 2 - lz / 2 + 0.06)], c: ASH_L });
  }
  // slit windows up every face
  for (let f = 0; f < 4; f++) {
    const ry = f * PI / 2, fx = Math.sin(ry), fz = Math.cos(ry);
    for (const y of [5.2, 8.8]) {
      b.add(box(0.5, 1.3, 0.12), 'stoneDark', { p: [fx * (s / 2 + 0.02), y, fz * (s / 2 + 0.02)], r: [0, ry, 0], c: ASH_D });
      b.add(box(0.28, 1.05, 0.06), 'glassWarm', { p: [fx * (s / 2 + 0.06), y, fz * (s / 2 + 0.06)], r: [0, ry, 0] });
    }
  }
  b.add(box(1.4, 2.4, 0.1), 'woodDark', { p: [0, 1.2, s / 2 + 0.05], c: '#7a6450' });
  b.add(box(2.0, 0.2, 0.7), 'stoneLarge', { p: [0, 2.55, s / 2 + 0.3], c: ASH_L });
  // lookout: a wider slab on corbels, square merlons, a flat iron roof on four square posts, the lamp box
  b.add(box(s + 1.0, 0.4, s + 1.0), 'stoneDark', { p: [0, h, 0], c: ASH_D });
  for (let f = 0; f < 4; f++) for (let i = -2; i <= 2; i++) {
    const along = i * (s + 0.6) / 5, out = (s + 1.0) / 2 - 0.15;
    const [x, z] = f % 2 ? [f === 1 ? out : -out, along] : [along, f === 0 ? out : -out];
    b.add(box(f % 2 ? 0.3 : 0.62, i % 2 ? 0.5 : 0.95, f % 2 ? 0.62 : 0.3), 'stone', { p: [x, h + 0.2 + (i % 2 ? 0.25 : 0.47), z], c: tint });
    if (i === -2 || i === 2) continue;
    b.add(box(0.4, 0.5, 0.4), 'stoneDark', { p: [x * 0.92, h - 0.45, z * 0.92], c: ASH_D }); // corbels
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.22, 2.2, 0.22), 'wIron', { p: [sx * (s / 2 - 0.2), h + 1.3, sz * (s / 2 - 0.2)], c: '#3a3836' });
  b.add(box(s + 0.2, 0.16, s + 0.2), 'wIron', { p: [0, h + 2.45, 0], c: '#444240' });
  b.add(box(0.9, 0.9, 0.9), 'wBrass', { p: [0, h + 1.0, 0] });
  b.add(box(0.7, 0.62, 0.92), 'wGlowAmber', { p: [0, h + 1.05, 0] });
  // a brass pipe up one face to the lamp (the lamp burns oil pumped from below)
  pipe(b, [s / 2 + 0.2, 0.2, -s / 2 + 0.5], [s / 2 + 0.2, h - 0.3, -s / 2 + 0.5], 0.09);
  return res(b, { glows: [{ p: [0, h + 1.05, 0], color: 0xffb060, size: 3.2, intensity: 0.6 }], colliders: [{ x: 0, z: 0, hw: s / 2 + 0.3, hd: s / 2 + 0.3 }] });
}

// a square cistern with an iron grate and a brass hand pump (the camp's water, carried over on the ship)
export function cistern(seed) {
  const b = new Builder(seed);
  b.add(box(2.6, 1.4, 2.6), 'stone', { p: [0, 0.3, 0], c: ASH });
  b.add(box(2.9, 0.22, 2.9), 'stoneLarge', { p: [0, 1.05, 0], c: ASH_L });
  b.add(box(2.1, 0.06, 2.1), 'wIron', { p: [0, 1.1, 0], c: '#2e2c2a' });
  for (let i = -3; i <= 3; i++) b.add(box(0.06, 0.08, 2.1), 'wIron', { p: [i * 0.3, 1.14, 0], c: '#4a4846' });
  pipe(b, [1.1, 1.1, 1.1], [1.1, 2.2, 1.1], 0.09);
  b.add(box(0.3, 0.5, 0.3), 'wBrass', { p: [1.1, 2.3, 1.1] });
  b.add(box(0.9, 0.06, 0.08), 'wBrass', { p: [1.5, 2.5, 1.1], r: [0, 0, -0.35] });
  pipe(b, [1.1, 2.15, 1.1], [1.1, 2.15, 1.7], 0.06);
  b.add(box(0.6, 0.4, 0.6), 'wood', { p: [1.1, 0.2, 1.9], c: '#8a6a4a' }); // a bucket stand
  return res(b, { colliders: [{ x: 0, z: 0, hw: 1.5, hd: 1.5 }] });
}

// a square iron water tank on four legs with a ladder and an outlet pipe
export function tank(seed) {
  const b = new Builder(seed);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.22, 3.4, 0.22), 'wIron', { p: [sx * 1.2, 1.1, sz * 1.2], c: '#3a3836' });
  for (const y of [0.8, 2.0]) { b.add(box(2.6, 0.1, 0.1), 'wIron', { p: [0, y, 1.2], c: '#3a3836' }); b.add(box(2.6, 0.1, 0.1), 'wIron', { p: [0, y, -1.2], c: '#3a3836' }); }
  b.add(box(3.0, 2.0, 3.0), 'wIronW', { p: [0, 3.8, 0], c: '#5a5652' });
  for (const y of [3.1, 3.8, 4.5]) b.add(box(3.06, 0.08, 3.06), 'wBrass', { p: [0, y, 0] });
  b.add(box(3.1, 0.08, 3.1), 'wIron', { p: [0, 4.84, 0], c: '#3a3836' });
  for (let y = 0.4; y < 4.8; y += 0.4) b.add(box(0.5, 0.05, 0.05), 'wIron', { p: [0, y, 1.55], c: '#3a3836' });
  for (const sx of [-0.25, 0.25]) b.add(box(0.05, 4.8, 0.05), 'wIron', { p: [sx, 2.4, 1.55], c: '#3a3836' });
  pipe(b, [-1.5, 3.0, 0], [-1.5, 0.1, 0], 0.1);
  return res(b, { colliders: [{ x: 0, z: 0, hw: 1.6, hd: 1.6 }] });
}

// a pipe run on square trestles between two ground points (world x, z), at height y
function pipeRun(seed, len, y = 2.2) {
  const b = new Builder(seed);
  pipe(b, [-len / 2, y, 0], [len / 2, y, 0], 0.12);
  pipe(b, [-len / 2, y, 0.45], [len / 2, y, 0.45], 0.08, 'wCopper');
  for (let x = -len / 2 + 0.5; x <= len / 2 - 0.4; x += 3.5) {
    for (const z of [-0.3, 0.75]) b.add(box(0.16, y + 0.8, 0.16), 'wIron', { p: [x, (y - 0.8) / 2, z], c: '#3a3836' });
    b.add(box(0.2, 0.14, 1.3), 'wIron', { p: [x, y - 0.18, 0.22], c: '#3a3836' });
    b.add(box(0.5, 0.3, 1.4), 'stoneDark', { p: [x, -0.05, 0.22], c: ASH_D });
  }
  return res(b);
}

// a timber porch on square posts (flat), in front of a door
export function porch(seed, w = 4, d = 2.4, h = 2.8) {
  const b = new Builder(seed);
  b.add(box(w, 0.14, d), 'wood', { p: [0, h, d / 2], c: '#8a7058' });
  for (const sx of [-1, 1]) b.add(box(0.18, h, 0.18), 'woodDark', { p: [sx * (w / 2 - 0.15), h / 2, d - 0.15], c: 0xffffff });
  b.add(box(w, 0.18, 0.14), 'woodDark', { p: [0, h - 0.12, d - 0.15], c: 0xffffff });
  b.add(box(w, 0.12, d), 'wood', { p: [0, 0.06, d / 2], c: '#9a8064' });
  return res(b);
}

// a bench of stone blocks and a timber seat
export function stoneBench(seed) {
  const b = new Builder(seed);
  for (const sx of [-0.7, 0.7]) b.add(box(0.4, 0.45, 0.45), 'stoneDark', { p: [sx, 0.22, 0], c: ASH_D });
  b.add(box(1.9, 0.1, 0.5), 'wood', { p: [0, 0.5, 0], c: '#8a7058' });
  return res(b, { collider: { r: 0.8 } });
}

export function sacks(seed) {
  const b = new Builder(seed);
  for (let i = 0; i < 5; i++) b.add(lumpy(sphere(0.38, 10, 8), 0.05, 2, seed + i, { flatBottom: 0 }), 'cloth', { p: [b.r(-0.6, 0.6), i > 2 ? 0.45 : 0.02, b.r(-0.4, 0.4)], s: [1, 0.72, 0.8], r: [0, b.r(0, 3), 0], c: '#b8a888', uv: 'box' });
  return res(b, { collider: { r: 0.8 } });
}

// ------------------------------------------------------------------ scatter prefabs
function basalt(seed, tint = '#3c3836') {
  const b = new Builder(seed);
  const n = 1 + (seed % 3);
  for (let i = 0; i < n; i++) {
    const s = i === 0 ? 1 : 0.5;
    addRock(b, [i ? b.r(-1, 1) : 0, 0, i ? b.r(-1, 1) : 0], [b.r(0.8, 1.5) * s, b.r(0.5, 0.9) * s, b.r(0.8, 1.4) * s], seed * 7 + i, { mat: 'basalt', moss: 0, tint });
  }
  return { builder: b, collider: { r: 1.1 } };
}
// a cluster of basalt columns: plain square blocks of dark rock, set close, cut flat at different heights
function columns(seed) {
  const b = new Builder(seed);
  const n = 5 + (seed % 5);
  for (let i = 0; i < n; i++) {
    const a = b.r(0, PI * 2), d = Math.sqrt(b.r(0, 1)) * 1.6, w = b.r(0.55, 0.85), h = b.r(1.2, 4.6) * (1 - d * 0.25);
    b.add(rbox(w, h + 1, w, 0.04), 'basalt', { p: [Math.cos(a) * d, (h - 1) / 2, Math.sin(a) * d], r: [b.r(-0.04, 0.04), b.r(0, 1.2), b.r(-0.04, 0.04)], c: (x, y) => (y > h - 1.3 ? [0.07, 0.065, 0.062] : [0.045, 0.042, 0.04]), uv: 'box' });
  }
  return { builder: b, collider: { r: 1.7 } };
}
// cooling lava: dark glassy flow lobes with glowing heat showing in the cracks between them
export function lava(seed) {
  const b = new Builder(seed);
  const n = 3 + (seed % 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2 + b.r(-0.3, 0.3), d = i ? b.r(0.9, 1.6) : 0;
    b.add(lumpy(ico(1, 2), 0.22, 1.8, seed * 5 + i, { flatBottom: 0 }), 'lavaCrust', { p: [Math.cos(a) * d, -0.05, Math.sin(a) * d], s: [b.r(1.1, 1.7), b.r(0.35, 0.6), b.r(1.0, 1.5)], r: [0, b.r(0, 3), 0], c: '#ffffff', uv: 'box' });
  }
  for (let i = 0; i < n + 2; i++) {
    const a = b.r(0, PI * 2), d = b.r(0.3, 1.5);
    b.add(box(b.r(0.6, 1.4), 0.12, b.r(0.06, 0.12)), 'molten', { p: [Math.cos(a) * d, 0.12, Math.sin(a) * d], r: [0, b.r(0, PI), 0] });
  }
  return { builder: b, collider: { r: 1.6 } };
}
// an ash drift: a low soft mound of grey ash
function drift(seed) {
  const b = new Builder(seed);
  b.add(lumpy(sphere(1.6, 14, 8), 0.25, 1.2, seed, { flatBottom: 0 }), 'rock', { s: [b.r(1.1, 1.8), 0.3, b.r(0.8, 1.2)], c: '#86827c', uv: 'box' });
  return { builder: b };
}
// a heap of slag: dark, rust-streaked clinker
function slag(seed) {
  const b = new Builder(seed);
  b.add(lumpy(sphere(1.3, 12, 9), 0.35, 1.8, seed, { flatBottom: 0 }), 'rock', { s: [1.2, 0.62, 1], c: '#3e322c', uv: 'box' });
  for (let i = 0; i < 6; i++) addRock(b, [b.r(-1.3, 1.3), 0, b.r(-1, 1)], [b.r(0.2, 0.45), b.r(0.15, 0.3), b.r(0.2, 0.4)], seed * 11 + i, { mat: 'rock', moss: 0, tint: i % 2 ? '#5a4234' : '#36302c' });
  return { builder: b, collider: { r: 1.5 } };
}

// ------------------------------------------------------------------ the Makers' old works (local, around a pad centre)
// a big riveted boiler drum lying on its side, half sunk in ash
function boiler(b, x, y, z, ry, L = 6, r = 1.4) {
  const fx = Math.sin(ry), fz = Math.cos(ry);
  b.add(cyl(r, r, L, 20), 'wIronW', { p: [x, y, z], r: [PI / 2, ry, 0], order: 'YXZ', c: '#5e5650' });
  for (let i = 0; i <= 4; i++) { const t = (i / 4 - 0.5) * (L - 0.3); b.add(cyl(r + 0.05, r + 0.05, 0.14, 20), 'wRust', { p: [x + fx * t, y, z + fz * t], r: [PI / 2, ry, 0], order: 'YXZ', c: '#8a5a3a' }); }
  for (const s of [-1, 1]) b.add(cyl(r * 0.92, r * 0.92, 0.2, 20), 'wIron', { p: [x + fx * s * L / 2, y, z + fz * s * L / 2], r: [PI / 2, ry, 0], order: 'YXZ', c: '#3e3a36' });
  b.add(box(0.7, 0.9, 0.7), 'wIron', { p: [x, y + r + 0.3, z], c: '#3e3a36' }); // a square manhole housing on top
}
// a square brick stack, brass banded
function stack(b, x, y, z, s = 2.4, h = 14) {
  b.add(box(s, h, s), 'stoneDark', { p: [x, y + h / 2 - 1, z], c: '#5e5650', us: 0.5 });
  for (let k = 0.2; k < 1; k += 0.25) b.add(box(s + 0.12, 0.22, s + 0.12), 'wBrass', { p: [x, y + h * k, z], c: '#9a7a40' });
  b.add(box(s + 0.4, 0.5, s + 0.4), 'stoneDark', { p: [x, y + h - 1, z], c: '#4a4440' });
}
// a broken wall run of dark stone along x, its top uneven
function wallRun(b, x, y, z, ry, len, h) {
  const n = Math.round(len / 1.3), fx = Math.cos(ry), fz = -Math.sin(ry);
  for (let i = 0; i < n; i++) {
    const t = -len / 2 + (i + 0.5) * (len / n), top = h * (0.3 + 0.7 * Math.abs(Math.sin(i * 1.9 + x)));
    b.add(box(len / n - 0.05, top + 1, 0.9), 'stoneDark', { p: [x + fx * t, y + top / 2 - 0.5, z + fz * t], r: [0, ry, 0], c: '#6a6460', us: 0.5 });
  }
}
// pipes lying half buried, in short broken lengths
function buriedPipe(b, x, y, z, ry, len, r = 0.35) {
  const fx = Math.sin(ry), fz = Math.cos(ry);
  b.add(cyl(r, r, len, 14), 'wBrass', { p: [x, y + r * 0.2, z], r: [PI / 2, ry, 0], order: 'YXZ', c: '#8a6a3a' });
  for (const s of [-1, 1]) b.add(cyl(r * 1.4, r * 1.4, 0.16, 14), 'wBrass', { p: [x + fx * s * len / 2, y + r * 0.2, z + fz * s * len / 2], r: [PI / 2, ry, 0], order: 'YXZ', c: '#7a5a30' });
}
// a furnace mouth in a stone block: the glow of the fire that still burns inside
function furnace(b, glows, smokes, x, y, z, ry) {
  const fx = Math.sin(ry), fz = Math.cos(ry);
  b.add(box(4.4, 3.6, 3.6), 'stoneDark', { p: [x, y + 1.3, z], r: [0, ry, 0], c: '#5a5450' });
  b.add(box(4.7, 0.4, 3.9), 'wIron', { p: [x, y + 3.2, z], r: [0, ry, 0], c: '#3a3634' });
  b.add(box(1.6, 1.1, 0.2), 'wIron', { p: [x + fx * 1.82, y + 1.0, z + fz * 1.82], r: [0, ry, 0], c: '#2a2624' });
  b.add(box(1.3, 0.8, 0.12), 'wGlowOrange', { p: [x + fx * 1.9, y + 1.0, z + fz * 1.9], r: [0, ry, 0] });
  glows.push({ p: [x + fx * 2.3, y + 1.0, z + fz * 2.3], color: 0xff7a28, size: 3.6, intensity: 0.7 });
  smokes.push({ p: [x - fx * 0.8, y + 3.6, z - fz * 0.8], opts: { rate: 1.6, life: 5, size: 1.4, rise: 1.4, color: 0x5a5450, opacity: 0.35, spread: 0.4 } });
}
// pad 1: the furnace hall (walls, a tall stack, boilers, the furnace still alight)
function worksHall(seed) {
  const b = new Builder(seed), glows = [], smokes = [];
  wallRun(b, 0, 0, -6, 0, 16, 4.5); wallRun(b, -8, 0, 0, PI / 2, 11, 3.5); wallRun(b, 8, 0, 1, PI / 2, 9, 2.6); wallRun(b, -4, 0, 6, 0, 7, 1.8);
  stack(b, 5.5, 0, -4, 2.4, 15);
  smokes.push({ p: [5.5, 14.5, -4], opts: { rate: 2.5, life: 6, size: 2.2, rise: 1.8, color: 0x5a5652, opacity: 0.35, spread: 0.5 } });
  furnace(b, glows, smokes, -2.5, 0, -2.5, 0);
  boiler(b, 2.5, 0.5, 3.5, PI / 2 + 0.15, 6.5, 1.35);
  boiler(b, -6.5, 0.2, 8, 0.4, 5, 1.1);
  buriedPipe(b, 0, 0, 9, PI / 2 - 0.2, 7); buriedPipe(b, 9, 0, -5, 0.1, 5, 0.3);
  return res(b, { glows, smokes, colliders: [{ x: 0, z: -6, hw: 8, hd: 0.6 }, { x: -8, z: 0, hw: 0.6, hd: 5.5 }, { x: 8, z: 1, hw: 0.6, hd: 4.5 }, { x: -4, z: 6, hw: 3.5, hd: 0.6 }, { x: 5.5, z: -4, hw: 1.4, hd: 1.4 }, { x: -2.5, z: -2.5, hw: 2.3, hd: 1.9 }, { x: 2.5, z: 3.5, hw: 3.3, hd: 1.4, rot: 0.15 }] });
}
// pad 2: the engine pit (a great beam-engine housing, its piston cylinders and rods, a fallen gantry, tipped carts)
function worksEngine(seed) {
  const b = new Builder(seed), glows = [], smokes = [];
  b.add(box(7, 5, 5), 'stoneDark', { p: [0, 1.5, 0], c: '#5e5852', us: 0.5 });
  b.add(box(7.4, 0.4, 5.4), 'wIron', { p: [0, 4.1, 0], c: '#3a3634' });
  for (const sx of [-2, 0, 2]) {
    b.add(cyl(0.9, 0.9, 3.6, 16), 'wIron', { p: [sx, 6, 0], c: '#4e4a46' });
    b.add(cyl(1.0, 1.0, 0.2, 16), 'wBrass', { p: [sx, 7.9, 0], c: '#9a7a40' });
    b.add(cyl(0.16, 0.16, 2.6 + (sx + 2) * 0.4, 8), 'wSteel', { p: [sx, 8.6 + (sx + 2) * 0.2, 0] });
  }
  // the beam, broken and lying across the housing
  b.add(box(10, 0.7, 0.8), 'wIron', { p: [1, 9.6, 0.2], r: [0, 0.1, -0.12], c: '#4a4440' });
  // the gantry: square frames tipped over into the ash
  for (let i = 0; i < 3; i++) {
    const z = 5 + i * 2.2;
    b.add(box(0.3, 5, 0.3), 'wIron', { p: [-5, 1.2, z], r: [0.5, 0, 0], c: '#3e3a36' });
    b.add(box(0.3, 5, 0.3), 'wIron', { p: [-1, 1.2, z], r: [0.5, 0, 0], c: '#3e3a36' });
    b.add(box(4.3, 0.3, 0.3), 'wIron', { p: [-3, 3.0, z + 1.2], c: '#3e3a36' });
  }
  furnace(b, glows, smokes, 5.5, 0, -4.5, -PI / 2);
  buriedPipe(b, 3, 0, 5, 0.3, 6, 0.4);
  b.add(box(3, 1.4, 2.2), 'wIron', { p: [-5.5, 0.4, -4], r: [0.1, 0.4, 0.15], c: '#4a4440' }); // a sunken tender box
  return res(b, { glows, smokes, colliders: [{ x: 0, z: 0, hw: 3.7, hd: 2.7 }, { x: 5.5, z: -4.5, hw: 1.9, hd: 2.3 }, { x: -5.5, z: -4, hw: 1.6, hd: 1.3 }] });
}
// pad 3: the ore hoppers (square bins on legs, a conveyor ramp down into the ash, slag on every side)
function worksHoppers(seed) {
  const b = new Builder(seed), glows = [], smokes = [];
  for (const [x, z] of [[-3, -2], [2, -2.5]]) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.3, 5, 0.3), 'wIron', { p: [x + sx * 1.3, 1.5, z + sz * 1.3], c: '#3e3a36' });
    b.add(taper(box(3.4, 2.4, 3.4), 1, 1, 'y').translate(0, 0, 0), 'wIronW', { p: [x, 4.6, z], c: '#5e5650' });
    b.add(taper(box(3.4, 1.6, 3.4), 0.3, 0.3, 'y').rotateX(PI), 'wIronW', { p: [x, 2.6, z], c: '#56504a' });
    b.add(box(3.6, 0.16, 3.6), 'wBrass', { p: [x, 5.85, z], c: '#9a7a40' });
    b.add(lumpy(sphere(1.4, 10, 8), 0.3, 2, x * 7, { flatBottom: 0 }), 'rock', { p: [x, 5.6, z], s: [1, 0.4, 1], c: '#4a3a30', uv: 'box' });
  }
  // the conveyor: a long tilted frame with square rollers, running down into the ash
  b.add(box(1.6, 0.3, 11), 'wIron', { p: [-0.5, 2.6, 6], r: [0.42, 0, 0], c: '#3e3a36' });
  for (let i = 0; i < 9; i++) b.add(box(1.4, 0.18, 0.18), 'wBrass', { p: [-0.5, 2.6 + 2.3 - i * 0.55, 6 - 5 + i * 1.2], c: '#8a6a3a' });
  furnace(b, glows, smokes, 6, 0, 3, -PI / 2 - 0.3);
  return res(b, { glows, smokes, colliders: [{ x: -3, z: -2, hw: 1.8, hd: 1.8 }, { x: 2, z: -2.5, hw: 1.8, hd: 1.8 }, { x: 6, z: 3, hw: 2.2, hd: 2.2 }] });
}

// a steam vent: a ring of cracked rock and a slow white plume (heat in the ground, nothing more)
function vent(seed, big = 1) {
  const b = new Builder(seed);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2 + b.r(-0.3, 0.3); addRock(b, [Math.cos(a) * 0.9 * big, 0, Math.sin(a) * 0.9 * big], [0.4 * big, 0.3 * big, 0.35 * big], seed * 3 + i, { mat: 'rock', moss: 0, tint: '#5a4e44' }); }
  b.add(box(0.5 * big, 0.06, 0.3 * big), 'molten', { p: [0, 0.05, 0] });
  return res(b, { smokes: [{ p: [0, 0.4, 0], opts: { rate: 2.4 * big, life: 4.5, size: 1.4 * big, rise: 1.5, color: 0xd8d4ce, opacity: 0.3, spread: 0.4 * big } }] });
}

// ------------------------------------------------------------------ the island
// the crew's stolen launch, hauled up on the black sand for Edric to mend: a plain clinker hull, two thwarts, oars
// stowed along the side, a patch of new planks on the holed strake (no mast)
function launch(seed) {
  const b = new Builder(seed);
  for (let i = 0; i < 4; i++) {
    const y = 0.13 + i * 0.15, w = 0.5 + i * 0.09, L = 3.4 + i * 0.25;
    for (const s of [-1, 1]) b.add(rbox(L, 0.24, 0.1, 0.02), 'wood', { p: [0, y, s * w], c: i === 2 && s > 0 ? '#c8a070' : '#6a4a30', us: 1 });
  }
  b.add(rbox(3.4, 0.26, 1.05, 0.06), 'wood', { p: [0, 0.13, 0], c: '#4a3420' }); // the bottom boards, closed up to the first strake
  b.add(rbox(0.14, 0.62, 1.4, 0.02), 'wood', { p: [2.05, 0.38, 0], c: '#5a3e26' });
  b.add(rbox(0.12, 0.5, 1.2, 0.02), 'wood', { p: [-1.95, 0.34, 0], c: '#5a3e26' });
  for (const x of [-0.6, 0.6]) b.add(box(0.22, 0.05, 1.3), 'wood', { p: [x, 0.45, 0], c: '#7a5a38' });
  for (const z of [-0.45, -0.3]) b.add(cyl(0.03, 0.03, 2.6, 6), 'wood', { p: [0.1, 0.52, z], r: [0, 0, Math.PI / 2], c: '#8a6a44' });
  return { builder: b, collider: { r: 2.2 } };
}

export function buildReach(W, S) {
  const T = W.terrain;
  const put = (key, x, z, r = 0, s = 1, sink = 0.05) => S.place(key, x, T.height(x, z) - sink, z, r, s);
  const pre = (key, r2) => { if (!S.prefabs.has(key)) S.addPrefab(key, r2); };
  for (let v = 0; v < 4; v++) pre('basalt' + v, basalt(v + 51));
  for (let v = 0; v < 2; v++) pre('boulder' + v, basalt(v + 61, '#5a5550'));
  for (let v = 0; v < 3; v++) pre('columns' + v, columns(v + 71));
  for (let v = 0; v < 3; v++) pre('lava' + v, lava(v + 81));
  for (let v = 0; v < 3; v++) pre('drift' + v, drift(v + 91));
  for (let v = 0; v < 2; v++) pre('slag' + v, slag(v + 97));
  pre('lantern', P.lanternPost(301, 'yellow'));
  pre('crates', P.crateStack(302));
  pre('sacks', sacks(303));
  pre('bench', stoneBench(304));
  pre('rail', D.railTrack(305, 10));
  pre('cart', D.mineCart(306));

  // ---------------------------------------------------------------- the pier and the ship
  {
    const Pi = REACH.pier, top = Pi.top, L = Pi.x1 - Pi.x0, zc = (Pi.z0 + Pi.z1) / 2;
    const pier = new Builder(310);
    pier.add(box(L, 0.16, 4.8), 'wood', { p: [L / 2, top - 0.08, 0], c: '#a08a6a', us: 1 });
    for (let x = 1; x < L; x += 4) for (const sz of [-2.3, 2.3]) pier.add(cyl(0.16, 0.18, 9, 8), 'woodDark', { p: [x, top - 4.6, sz], c: 0xffffff });
    // rails: the north rail has a gap for the gangway at x 405..409
    pier.add(box(L, 0.12, 0.14), 'woodDark', { p: [L / 2, top + 0.55, 2.35], c: 0xffffff });
    for (const [a, z] of [[0, 405 - Pi.x0], [409 - Pi.x0, L]]) pier.add(box(z - a, 0.12, 0.14), 'woodDark', { p: [(a + z) / 2, top + 0.55, -2.35], c: 0xffffff });
    for (let x = 2; x < L; x += 4) for (const sz of [-2.35, 2.35]) if (!(sz < 0 && x + Pi.x0 > 404 && x + Pi.x0 < 410)) pier.add(cyl(0.06, 0.06, 0.6, 6), 'woodDark', { p: [x, top + 0.28, sz], c: 0xffffff });
    W.placeAt(res(pier), Pi.x0, 0, zc, 0);
    // the steam ship lies along the north side of the pier, bow out to sea; ship space for ry -pi/2: x = world z - SZ, z = SX - world x
    const SX = REACH.berth.x, SZ = REACH.berth.z, loc = (wx, y, wz) => [wz - SZ, y, SX - wx];
    const ship = buildSteamship({ gangway: loc(407, top, -1200.6), bollards: [loc(410.4, top, -1201.75), loc(399.7, top, -1201.75)], ropes: [[-16.0, 0], [-12.6, 0], [-1.0, 1], [14.2, 1]], iceBow: true });
    // the armoured ice bow shows once Chapter 33 has fitted it (m_c33_refit; game.js sets it from your quests)
    ship.userData.iceBow.visible = false;
    W.reachIceBow = ship.userData.iceBow;
    const obj = W.placeAt({ builder: new Builder(1), dynamics: [ship], colliders: [{ x: 0, z: 0, hw: 3.95, hd: 17.2 }, { x: 5.25, z: -14.4, r: 0.3 }, { x: 5.25, z: -3.7, r: 0.3 }] }, SX, 0, SZ, -PI / 2);
    obj.name = 'reachShip';
    W.reachShip = obj;
    // the pier end: lamps, a crate stack, coils of rope, the harbour master's desk at its root
    for (const x of [396, 414, 428]) S.place('lantern', x, top, zc + 2.1, PI, 0.9);
    S.place('crates', 425, top, zc + 1.4, 0.3, 0.85);
    S.place('sacks', 418, top, zc + 1.5, 1.2, 0.8);
    const desk = new Builder(311);
    desk.add(box(1.6, 1.0, 0.7), 'woodDark', { p: [0, 0.5, 0], c: '#7a6450' });
    desk.add(box(1.8, 0.08, 0.9), 'wood', { p: [0, 1.04, 0], c: '#9a8064' });
    desk.add(box(0.5, 0.06, 0.36), 'cloth', { p: [0.3, 1.1, 0], c: '#e8dcc0' });
    W.placeAt(res(desk, { collider: { r: 0.9 } }), 430.6, top, -1197.6, 0);
  }

  // ---------------------------------------------------------------- Ashfall Landing camp
  const C = REACH.camp, cy = (x, z) => T.height(x, z);
  const place = (r2, x, z, ry = 0, yOff = 0) => W.placeObject(r2, x, z, ry, yOff);
  // the paved square in the middle: a cistern and benches; lamps round it (off the road, which runs east-west)
  place(cistern(320), C.x, C.z - 4.5, 0);
  for (const a of [0.55, 1.57, 2.6, 3.7, 4.71, 5.75]) put('lantern', C.x + Math.cos(a) * 10.5, C.z + Math.sin(a) * 10.5, a + PI);
  put('bench', C.x - 4, C.z + 6, PI); put('bench', C.x + 4, C.z + 6, PI);
  // buildings round the square (fronts toward it)
  // the harbour office (with its porch), the storehouse, the bunkhouse, the workshop and the pump house: enterable works
  // houses now (shared/houses.js rc_*), built with the old sizes
  W.buildHouses('reach');
  place(squareTower(324), 480, -1214, -0.2); // the watchtower over the road east
  place(tank(327), 480, -1184, 0.1);
  place(pipeRun(328, 9.5, 2.6), 474.5, -1185.2, 0);
  // stores about the camp
  for (const [x, z, r] of [[458, -1215.5, 0.3], [472, -1215.6, 1.2], [437, -1205, 0.8], [469, -1186.5, 2.0], [446, -1215, 0.5]]) put('crates', x, z, r);
  for (const [x, z, r] of [[461, -1215.2, 1.1], [468.5, -1215.4, 2.6], [455, -1190, 0.4]]) put('sacks', x, z, r);
  // the caravan stop: a loaded cart and crates by Munir
  { const c = REACH.caravan; place(P.cart(330), c.x - 1.8, c.z - 1.2, 0.5); put('crates', c.x + 3.4, c.z - 0.6, 0.7); put('sacks', c.x + 2.6, c.z + 1.6, 1.9); }
  // where the fallen wake: a quiet bench and a lamp at the north edge of the camp
  { const g = REACH.grave; put('bench', g.x, g.z - 1.6, 0); put('lantern', g.x + 2.2, g.z - 1.2, 0.4); }
  // low ash-stone walls framing the camp on its north and south sides, open to the road and the beach
  {
    const wall = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), b = new Builder(Math.round(x0 * 3 + z0));
      b.add(box(len, 1.2, 0.6), 'stone', { p: [0, 0.3, 0], c: ASH }); b.add(box(len + 0.1, 0.16, 0.76), 'stoneLarge', { p: [0, 0.96, 0], c: ASH_L });
      for (let t = -len / 2; t <= len / 2 + 0.01; t += len / Math.max(1, Math.round(len / 4))) b.add(box(0.8, 1.6, 0.8), 'stoneDark', { p: [t, 0.5, 0], c: ASH_D });
      W.placeObject(res(b, { colliders: [{ x: 0, z: 0, hw: len / 2, hd: 0.4 }] }), (x0 + x1) / 2, (z0 + z1) / 2, -Math.atan2(z1 - z0, x1 - x0));
    };
    wall(449, -1228, 476, -1228); wall(476, -1228, 487, -1220); wall(449, -1174, 458, -1174); wall(472, -1174, 486, -1178);
  }

  // ---------------------------------------------------------------- the old works on the plateau
  const [W1, W2, W3] = REACH.works;
  place(worksHall(340), W1.x, W1.z, 0.3, -0.6);
  place(worksEngine(341), W2.x, W2.z, -0.4, -0.4);
  place(worksHoppers(342), W3.x, W3.z, 0.9, -0.3);
  // rails and tipped carts between them, half sunk; slag and ash heaped on everything
  for (const [x, z, r] of [[586, -1196, 0.25], [596, -1208, 0.1], [584, -1246, 0.6]]) put('rail', x, z, r, 1, 0.12);
  for (const [x, z, r] of [[588, -1199, 1.4], [597, -1212, 2.4], [583, -1250, 0.4]]) S.place('cart', x, T.height(x, z) - 0.5, z, r, 1);
  {
    const rng = mulberry32(343);
    for (const Wk of REACH.works) for (let i = 0; i < 9; i++) {
      const a = rng() * PI * 2, d = Wk.r * (0.55 + rng() * 0.6), x = Wk.x + Math.cos(a) * d, z = Wk.z + Math.sin(a) * d;
      put(rng() < 0.55 ? 'drift' + (i % 3) : 'slag' + (i % 2), x, z, rng() * 6, 0.8 + rng() * 0.6, 0.2);
    }
  }
  // steam vents on the plateau and on the cinder cone (heat in the ground), the cone's crater breathing slowly
  for (const [x, z, k] of [[620, -1180, 1], [632, -1236, 0.8], [560, -1232, 0.7], [606, -1150, 1], [600, -1120, 1.2], [628, -1140, 0.9], [612, -1132, 2.2]]) if (T.height(x, z) > 1.5) place(vent(350 + x, k), x, z, 0, -0.1); // never out in the sea (the cone's spot is offshore for now)

  // ---------------------------------------------------------------- scatter over the island
  {
    let rng = mulberry32(1);
    const seed = (a, b2) => { rng = mulberry32(Math.imul(a + 11, 73856093) ^ Math.imul(b2 + 17, 19349663) ^ 0x5ea); };
    const pick = (base, n) => base + Math.floor(rng() * n);
    const keep = (x, z, pad = 0) => {
      if (Math.hypot(x - C.x, z - C.z) < C.r + 6 + pad) return false;
      if (reachPathDist(x, z) < 4.5 + pad) return false;
      for (const Wk of REACH.works) if (Math.hypot(x - Wk.x, z - Wk.z) < Wk.r * 1.25 + pad) return false;
      for (const Dg of DUNGEONS) if (Math.hypot(x - Dg.door.x, z - Dg.door.z) < 10 + pad) return false; // dungeon doors on the island (the Ore Galleries)
      if (x < REACH.pier.x1 + 8 && Math.abs(z - (REACH.pier.z0 + REACH.pier.z1) / 2) < 14) return false;
      return true;
    };
    const R = REACH, cell = 5.5;
    for (let iz = 0, gz = R.minZ + 14; gz < R.maxZ - 14; iz++, gz += cell) for (let ix = 0, gx = R.minX + 14; gx < R.maxX - 14; ix++, gx += cell) {
      seed(ix, iz);
      const x = gx + rng() * cell, z = gz + rng() * cell, s = reachShore(x, z), h = reachHeight(x, z);
      if (s > -1 || !keep(x, z)) continue;
      const roll = rng(), zone = reachZone(x, z), ex = 0.85 + rng() * 0.5, ry = rng() * PI * 2;
      const nx = reachHeight(x + 1, z) - reachHeight(x - 1, z), nz = reachHeight(x, z + 1) - reachHeight(x, z - 1), slope = Math.hypot(nx, nz) / 2;
      if (h < 1.8) { if (roll < 0.05) put(pick('basalt', 4), x, z, ry, ex * 0.8); continue; } // the black beach: the odd dark boulder
      // the sea cliffs under the plateau: stands of basalt columns along the edge
      if (s > -12 && h > 6) { if (roll < 0.4) put(pick('columns', 3), x, z, ry, ex, 0.6); else if (roll < 0.55) put(pick('basalt', 4), x, z, ry, ex); continue; }
      if (slope > 0.5) { if (roll < 0.22) put(pick('columns', 3), x, z, ry, ex * 0.9, 0.8); else if (roll < 0.3) put(pick('basalt', 4), x, z, ry, ex); continue; }
      if (zone === 'ashfall') {
        if (roll < 0.08) put(pick('drift', 3), x, z, ry, ex, 0.15);
        else if (roll < 0.12) put(pick('boulder', 2), x, z, ry, ex * 0.8);
        else if (roll < 0.15) put(pick('basalt', 4), x, z, ry, ex);
        else if (roll < 0.16) put(pick('columns', 3), x, z, ry, ex * 0.8, 0.8);
      } else if (zone === 'slagterraces') {
        if (roll < 0.08) put(pick('slag', 2), x, z, ry, ex, 0.15);
        else if (roll < 0.13) put(pick('drift', 3), x, z, ry, ex, 0.15);
        else if (roll < 0.18) put(pick('basalt', 4), x, z, ry, ex);
        else if (roll < 0.2) put(pick('columns', 3), x, z, ry, ex * 0.9, 0.8);
      } else {
        // the Old Works plateau: cooling lava lobes, columns and rubble, ash in the lee of everything
        const cone = Math.hypot(x - R.cone.x, z - R.cone.z) < R.cone.r * 0.35;
        if (cone) { if (roll < 0.06) put(pick('basalt', 4), x, z, ry, ex); continue; }
        if (roll < 0.1) put(pick('lava', 3), x, z, ry, ex, 0.1);
        else if (roll < 0.15) put(pick('basalt', 4), x, z, ry, ex);
        else if (roll < 0.19) put(pick('columns', 3), x, z, ry, ex, 0.8);
        else if (roll < 0.22) put(pick('drift', 3), x, z, ry, ex, 0.15);
      }
    }
    // small stones everywhere above the waterline
    for (let i = 0; i < 700; i++) {
      seed(901, i);
      const x = R.minX + 20 + rng() * (R.maxX - R.minX - 40), z = R.minZ + 20 + rng() * (R.maxZ - R.minZ - 40);
      if (reachShore(x, z) > -3 || !keep(x, z, -2)) continue;
      put(pick('basalt', 4), x, z, rng() * 6, 0.25 + rng() * 0.35);
    }
    // along the tracks: a stone or a heap now and then, so the road never crosses bare ground
    for (const [pi, path] of R.paths.entries()) {
      seed(950, pi);
      for (let i = 0; i < path.length - 1; i++) {
        const [ax, az] = path[i], [bx, bz] = path[i + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
        for (let t = rng() * 6; t < L; t += 5 + rng() * 6) for (const side of [-1, 1]) {
          const off = 5.2 + rng() * 2.5, x = ax + (bx - ax) * (t / L) + nx * off * side, z = az + (bz - az) * (t / L) + nz * off * side;
          if (Math.hypot(x - C.x, z - C.z) < C.r + 2 || reachShore(x, z) > -3 || rng() > 0.45) continue;
          put(rng() < 0.6 ? pick('basalt', 4) : pick('drift', 3), x, z, rng() * 6, 0.45 + rng() * 0.4, 0.1);
        }
      }
    }
  }

  // Corbin's crew camp at the head of the north track, and their launch on the beach where Edric mends it
  pre('crewtent', workTent(611, '#8a8070'));
  pre('handcart', P.cart(612));
  pre('campfire', P.campfire(613));
  pre('launch', launch(614));
  put('crewtent', 543, -1256, 2.4, 0.9);
  put('crewtent', 553, -1257, 3.6, 0.9);
  put('handcart', 545, -1268, 0.4, 1);
  put('crates', 551, -1268, 1.2, 0.9);
  put('campfire', 547, -1259.5, 0, 0.9);
  put('launch', 432, -1220, 2.7, 1, 0.15);
}
