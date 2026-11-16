// The Rainward Gorge (Part Fourteen): the gorge's dressing, built into the world's rainwardGroup (World.buildRainward).
//   the haul road's head (the wagon stand, a loading stage, poles waiting) · the Seedwrights' camp (square huts with flat or
//   single-pitch roofs in the v111/v112 look round a worked square, a fire, seed sacks, drying racks) · the falls pool under
//   the lower falls · the lowest beds on the Gorge Foot's two steps and on the shelf over the river, reached by a flat timber
//   footbridge on square piers · the Seed Terraces (stone retaining walls along every step's front, cut square; seed beds in
//   parallel rows along each step; stone drain channels along the back of each step and down the stair lanes, with solid
//   water wheels in the lane channels; stone steps up the lanes; open seed sheds and drying racks with straight uprights) ·
//   the drain adits in the cliff behind the top steps (square mouths with flat stone lintels, choked with mud) · the Slip (the
//   marked mud lanes with banded posts down both edges, the slips that run down them while it pours, raw mud and stone,
//   buried beds, the Makers' planted timber in straight rows on the ridge, stumps where it has gone down the lanes) · the
//   head of the gorge (the Makers' upper cutting: a square cut into the east wall with a flat lintel, spoil heaps) · the
//   river and both falls, white falls off the north cliff, dripping rock at the cliff feet, ferns in upright banks and tufts,
//   low cloud along the walls · the rain: the slips, the cloud, the falls' mist, the drips and the wheels follow rainLevel()
// Content rules: no domes, arches, spires, crosses, stars, sunbursts or spoked wheels. Roofs are flat or single-pitch; every
// opening is square with a flat lintel; the water wheels are solid discs; beds, poles, channels and timber run parallel
// (never criss-crossed); racks and sheds have straight uprights, never X bracing; ferns are single upright cards in banks and
// tufts (never a rosette from above); seedlings are plain leaf tufts; the timber's crowns are solid tiers; no rainbow over
// the falls; no animals anywhere (a quiet, dripping forest); checked from straight above and from the gorge floor.
import * as THREE from 'three';
import * as P from '../assets/props.js';
import { Builder, box, rbox, cyl, lumpy, sphere } from '../assets/kit.js';
import { addRock, addTuft } from '../assets/trees.js';
import { createChannels, createWaterfall } from '../engine/water.js';
import { G } from '../engine/globals.js';
import { RAINWARD, rainwardHeight, rainwardGap, rainwardPathDist, rainwardGround, riverZ, zOfV, vOf, riverLevel, riverHW, northFoot, terraceAt, terraceLevelAt, slipLane, rainLevel } from '/sunmere-play/shared/rainward.js';
import { NPCS, NODES, OBJECTS, SPAWNS, MOBS } from '/sunmere-play/shared/data.js';
import { mulberry32 } from '/sunmere-play/shared/noise.js';
import { DUNGEONS } from '/sunmere-play/shared/dungeons.js';
import { markDynamic } from './freeze.js';
import { stoneBench, sacks } from './reachLayout.js';
import { texTint, shade } from '../assets/houses/parts.js';

const PI = Math.PI;
const ST = '#8a8c86', ST_D = '#5a5e58', ST_L = '#a8aaa2', PLANK = '#6a563f', IRON = '#34363a', MOSS = '#56704a', MUD = '#6a3e26';
const HW = '#3e2c1e', HSTONE = '#c8c4b6', HPLASTER = ['#e6dccb', '#e2d6c4', '#ddd2bf'];
const res = (b, extra = {}) => ({ builder: b, fires: [], glows: [], lanterns: [], smokes: [], colliders: [], ...extra });
const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _q = new THREE.Quaternion();
function beam(b, a, c, w, mat = 'beam', col = 0xffffff, d = w) {
  _d.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const L = _d.length(); _q.setFromUnitVectors(_up, _d.normalize());
  b.add(box(w, L, d), mat, { p: [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2], q: _q.clone(), c: col });
}
function rightPrism(run, rise, t) { // a right triangle in the local xy plane (0,0)-(run,0)-(run,rise), t thick along z
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(run, 0); sh.lineTo(run, rise); sh.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false }); g.translate(0, 0, -t / 2); return g;
}

// ------------------------------------------------------------------ small kit (local: front faces +z, ground at y 0)
// a Seedwright hut in the v111/v112 look, square in plan: a pale stone plinth band, cream plaster walls in a dark timber
// frame (corner posts, sill and wall plate, upright studs: nothing diagonal or crossing) or dark wet stone with tarred
// corner posts, a single-pitch roof (pent: low over the door at the front, high at the back, of slate or mossy shingle, deep
// eaves with a fascia board, barge boards up both verges, the side walls carried up under it) or a flat roof (a timber band
// under a stone cornice, a flat stack), a square stone chimney stack, a plank door under a flat lintel, square windows with
// light frames, stone sills and a shutter each side.
// o: { w, d, h (the front wall's top), roof 'pent' | 'flat', tile (colour), wall 'plaster' | 'stone', rise (the pent's rise
// front to back), door (offset along the front, or null), chimney (bool), wins { front, back, left, right } }
export function seedHut(seed, o = {}) {
  const b = new Builder(seed);
  const w = o.w ?? 5.4, d = o.d ?? 5.0, h = o.h ?? 2.9, stone = o.wall === 'stone', flat = o.roof === 'flat';
  const wallC = stone ? (o.stoneC || '#7c7e78') : texTint('plaster', HPLASTER[seed % 3]), frameC = stone ? '#2a221a' : HW, winC = stone ? '#e0d6bc' : shade(HW, 1.2);
  const rise = flat ? 0 : (o.rise ?? 1.25), roofMat = o.tile === 'moss' ? 'mossRoof' : 'shingleWood', roofC = o.tile === 'moss' ? texTint('mossRoof', '#6a7a5a') : texTint('shingleWood', o.tile || '#4e5250');
  b.add(box(w + 0.18, 1.75, d + 0.18), 'stoneLarge', { p: [0, -0.325, 0], c: HSTONE });
  b.add(box(w, h - 0.55, d), stone ? 'stone' : 'plaster', { p: [0, 0.55 + (h - 0.55) / 2, 0], c: wallC, us: stone ? 0.45 : 1 });
  // the side walls carried up under the pent (a right triangle on each, high at the back)
  if (!flat) for (const sx of [-1, 1]) b.add(rightPrism(d, rise, 0.2), stone ? 'stone' : 'plaster', { p: [sx * (w / 2 - 0.1), h, d / 2], r: [0, PI / 2, 0], c: wallC, uv: 'box', us: stone ? 0.45 : 1 });
  // the back wall up to the high eave
  if (!flat) b.add(box(w, rise, 0.2), stone ? 'stone' : 'plaster', { p: [0, h + rise / 2, -d / 2 + 0.1], c: wallC, us: stone ? 0.45 : 1 });
  const faces = {
    front: { L: w, f: (t, y, out) => [t, y, d / 2 + out], ry: 0 },
    back: { L: w, f: (t, y, out) => [-t, y, -d / 2 - out], ry: PI },
    right: { L: d, f: (t, y, out) => [w / 2 + out, y, -t], ry: PI / 2 },
    left: { L: d, f: (t, y, out) => [-w / 2 - out, y, t], ry: -PI / 2 },
  };
  const fb = (F, t, y, out, sw, sh, sd, mat, c) => b.add(box(sw, sh, sd), mat, { p: F.f(t, y, out), r: [0, F.ry, 0], c });
  const opens = { front: [], back: [], left: [], right: [] };
  if (o.door !== null) {
    const F = faces.front, t = o.door ?? 0;
    fb(F, t, 1.2, 0.03, 1.36, 2.4, 0.1, 'beam', frameC);
    fb(F, t, 1.13, 0.07, 1.06, 2.16, 0.08, 'wood', PLANK);
    fb(F, t, 2.46, 0.08, 1.7, 0.2, 0.16, 'beam', frameC);
    fb(F, t + 0.3, 1.15, 0.13, 0.08, 0.06, 0.05, 'wIron', IRON);
    b.add(box(1.7, 0.2, 0.8), 'stoneLarge', { p: [t, 0.4, d / 2 + 0.45], c: HSTONE });
    opens.front.push([t, 0.85]);
  }
  const wins = o.wins || { front: o.door === null ? [0] : [(o.door ?? 0) > 0 ? -w / 4 - 0.25 : w / 4 + 0.25], back: [0], left: [0], right: [0] };
  const wy = Math.min(1.7, h - 1.05);
  for (const [k, list] of Object.entries(wins)) for (const t of list || []) {
    const F = faces[k];
    fb(F, t, wy, 0.03, 0.95, 1.05, 0.1, stone ? 'woodLight' : 'beam', winC);
    fb(F, t, wy, 0.06, 0.74, 0.84, 0.06, 'glassWarm');
    fb(F, t, wy - 0.6, 0.1, 1.15, 0.12, 0.2, 'stoneLarge', HSTONE);
    if (stone) fb(F, t, wy + 0.6, 0.06, 1.15, 0.16, 0.14, 'stoneLarge', HSTONE);
    else for (const s of [-1, 1]) fb(F, t + s * 0.74, wy, 0.1, 0.46, 1.0, 0.05, 'wood', o.shutC || '#4e5a46');
    opens[k].push([t, 0.72]);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const ph = h - 0.4 + (sz < 0 ? rise : 0); b.add(box(0.26, ph, 0.26), 'beam', { p: [sx * (w / 2 + 0.01), 0.45 + ph / 2, sz * (d / 2 + 0.01)], c: frameC }); }
  if (!stone) for (const [k, F] of Object.entries(faces)) {
    fb(F, 0, 0.62, 0.04, F.L, 0.16, 0.1, 'beam', frameC);
    fb(F, 0, h - 0.08, 0.04, F.L, 0.18, 0.1, 'beam', frameC);
    const n = Math.max(1, Math.round(F.L / 1.5));
    for (let i = 1; i < n; i++) {
      const t = -F.L / 2 + (i * F.L) / n;
      if (opens[k].some(([c, hw]) => Math.abs(t - c) < hw + 0.62)) continue;
      fb(F, t, (0.7 + h - 0.17) / 2, 0.035, 0.16, h - 0.87, 0.08, 'beam', frameC);
    }
  }
  const smokes = [];
  if (flat) {
    // the flat roof: a timber band, a stone cornice slab with a deep overhang, a low parapet kerb
    b.add(box(w + 0.3, 0.22, d + 0.3), 'beam', { p: [0, h + 0.05, 0], c: frameC });
    b.add(box(w + 0.9, 0.26, d + 0.9), 'stoneLarge', { p: [0, h + 0.29, 0], c: HSTONE });
    for (const sz of [-1, 1]) b.add(box(w + 0.9, 0.24, 0.2), 'stoneLarge', { p: [0, h + 0.54, sz * (d / 2 + 0.35)], c: shade(HSTONE, 0.92) });
    for (const sx of [-1, 1]) b.add(box(0.2, 0.24, d + 0.5), 'stoneLarge', { p: [sx * (w / 2 + 0.35), h + 0.54, 0], c: shade(HSTONE, 0.92) });
    b.add(box(w + 0.5, 0.06, d + 0.5), 'mossRoof', { p: [0, h + 0.45, 0], c: texTint('mossRoof', '#5e6e50') });
  } else {
    // the pent roof: one slab from the low eave over the door up to the high eave at the back, deep eaves all round
    const over = 0.6, verge = 0.4, run = d + over * 2, ang = Math.atan2(rise, d), sl = run / Math.cos(ang), th = 0.16;
    b.add(box(w + verge * 2, th, sl), roofMat, { p: [0, h + rise / 2 + th / 2 / Math.cos(ang) + 0.02, 0], r: [ang, 0, 0], c: roofC, uv: 'box', us: 0.42 });
    const yLo = h - over * Math.tan(ang), yHi = h + rise + over * Math.tan(ang);
    b.add(box(w + verge * 2, 0.34, 0.06), 'woodDark', { p: [0, yLo - 0.06, d / 2 + over - 0.02], c: frameC }); // the fascia over the door
    b.add(box(w + verge * 2, 0.3, 0.06), 'woodDark', { p: [0, yHi - 0.04, -d / 2 - over + 0.02], c: frameC });
    for (const sx of [-1, 1]) beam(b, [sx * (w / 2 + verge - 0.03), yLo - 0.02, d / 2 + over], [sx * (w / 2 + verge - 0.03), yHi - 0.02, -d / 2 - over], 0.07, 'beam', frameC, 0.22);
  }
  if (o.chimney !== false) {
    // a square stone stack up the back wall, a band, a cap slab and one square pot
    const cx = w / 2 - 0.9, top = h + rise + 1.1;
    b.add(box(0.62, top - 0.3, 0.62), 'stoneDark', { p: [cx, (top - 0.3) / 2 + 0.3, -d / 2 + 0.2], c: shade(HSTONE, 0.78) });
    b.add(box(0.74, 0.12, 0.74), 'stoneLarge', { p: [cx, top + 0.02, -d / 2 + 0.2], c: HSTONE });
    b.add(box(0.24, 0.32, 0.24), 'stone', { p: [cx, top + 0.24, -d / 2 + 0.2], c: '#8a6a52' });
    smokes.push({ p: [cx, top + 0.55, -d / 2 + 0.2], opts: { rate: 1.3, life: 4.5, size: 1.0, rise: 1.2, color: 0x8a8a86, opacity: 0.3, spread: 0.25 } });
  }
  return res(b, { smokes, colliders: [{ x: 0, z: 0, hw: w / 2 + 0.15, hd: d / 2 + 0.15 }] });
}
// an open seed shed: square posts on stone footings, a pent roof on plain beams (no braces), shelves of square seed trays
function seedShed(seed, w = 5, d = 3) {
  const b = new Builder(seed), h = 2.5, rise = 0.6;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const ph = h + (sz < 0 ? rise : 0);
    b.add(box(0.22, ph, 0.22), 'beam', { p: [sx * w / 2, ph / 2, sz * d / 2], c: '#4e3e2e' });
    b.add(box(0.42, 0.2, 0.42), 'stoneLarge', { p: [sx * w / 2, 0.06, sz * d / 2], c: ST_L });
  }
  for (const sz of [-1, 1]) b.add(box(w + 0.3, 0.18, 0.18), 'beam', { p: [0, h + (sz < 0 ? rise : 0), sz * d / 2], c: '#4e3e2e' });
  const ang = Math.atan2(rise, d), run = d + 1.0, sl = run / Math.cos(ang);
  b.add(box(w + 0.8, 0.12, sl), 'shingleWood', { p: [0, h + rise / 2 + 0.12, 0], r: [ang, 0, 0], c: texTint('shingleWood', '#4e5250'), uv: 'box', us: 0.42 });
  for (const y of [0.5, 1.1, 1.7]) {
    b.add(box(w - 0.4, 0.06, 0.8), 'wood', { p: [0, y, -d / 2 + 0.5], c: '#8a7054' });
    for (let x = -w / 2 + 0.6; x < w / 2 - 0.4; x += 0.62) { b.add(box(0.5, 0.1, 0.5), 'wood', { p: [x, y + 0.08, -d / 2 + 0.5], c: '#9a7a56' }); b.add(box(0.42, 0.04, 0.42), 'dirtPlain', { p: [x, y + 0.13, -d / 2 + 0.5], c: '#3e3024' }); }
  }
  b.add(box(w * 0.6, 0.8, 0.7), 'woodDark', { p: [w * 0.15, 0.4, d / 2 - 0.6], c: '#4a3a2c' }); // a seed chest
  return res(b, { colliders: [{ x: 0, z: -d / 2 + 0.5, hw: w / 2, hd: 0.55 }, ...[-1, 1].map((sx) => ({ x: sx * w / 2, z: d / 2, r: 0.3 }))] });
}
// a drying rack with straight uprights: square posts on stone footings, a top rail and a lower rail (level beams only), seed
// heads hung over the top rail in straight bundles
function dryRack(seed, L = 4) {
  const b = new Builder(seed), posts = L > 4.6 ? [-L / 2, 0, L / 2] : [-L / 2, L / 2];
  for (const sx of posts) { b.add(box(0.2, 2.2, 0.2), 'beam', { p: [sx, 1.1, 0], c: '#4e3e2e' }); b.add(box(0.42, 0.2, 0.42), 'stoneLarge', { p: [sx, 0.07, 0], c: ST_L }); }
  b.add(box(L + 0.4, 0.15, 0.15), 'beam', { p: [0, 2.1, 0], c: '#4e3e2e' });
  b.add(box(L, 0.12, 0.12), 'beam', { p: [0, 0.6, 0], c: '#4e3e2e' });
  for (let x = -L / 2 + 0.4; x < L / 2 - 0.3; x += 0.42) {
    if (posts.some((p) => Math.abs(p - x) < 0.22)) continue;
    const len = b.r(0.7, 1.0), c = b.r() < 0.5 ? '#9a8a54' : '#7a7a44';
    for (const sz of [-0.06, 0.06]) b.add(box(0.12, len, 0.05), 'straw', { p: [x, 2.1 - len / 2 + 0.04, sz], c });
  }
  return res(b, { colliders: posts.map((x) => ({ x, z: 0, r: 0.3 })) });
}
// a seed bed: a long raised bed edged with planks (along local x), its dark earth, two rows of seedlings as plain leaf tufts
// (a single small card each, at odd turns: never crossed cards, which read as a star from above). kind: 0 tended seedlings,
// 1 young poles (thin stems with a small solid crown), 2 bare earth, 3 gone to weeds and ferns, 4 under a slip's mud
function seedBed(seed, kind = 0, L = 7) {
  const b = new Builder(seed), W = 1.3;
  for (const sz of [-1, 1]) b.add(box(L, 0.24, 0.1), 'wood', { p: [0, 0.12, sz * W / 2], c: kind === 4 ? '#4a3428' : '#5e4c38' });
  for (const sx of [-1, 1]) b.add(box(0.1, 0.24, W), 'wood', { p: [sx * L / 2, 0.12, 0], c: '#5e4c38' });
  b.add(box(L - 0.1, 0.16, W - 0.1), 'dirtPlain', { p: [0, 0.1, 0], c: kind === 4 ? MUD : '#3e3024', uv: 'box' });
  if (kind === 0) for (const sz of [-0.3, 0.3]) for (let x = -L / 2 + 0.35; x < L / 2 - 0.2; x += b.r(0.42, 0.55)) addTuft(b, 'leafTree', [x, 0.18, sz + b.r(-0.05, 0.05)], b.r(0.22, 0.32), b.r(0.18, 0.28), b.r(0, 3.1), b.r() < 0.5 ? '#7aa65a' : '#5e9a4a', 1);
  if (kind === 1) for (const sz of [-0.3, 0.3]) for (let x = -L / 2 + 0.5; x < L / 2 - 0.3; x += b.r(0.85, 1.1)) {
    const H = b.r(0.9, 1.4);
    b.add(cyl(0.015, 0.025, H, 5), 'bark', { p: [x, 0.18 + H / 2, sz], c: '#7a6450' });
    for (let k = 0; k < 2; k++) { const r = 0.2 - k * 0.07; b.add(cyl(r * 0.25, r, 0.26, 7), 'pineSkirt', { p: [x, 0.18 + H * (0.6 + k * 0.22), sz], r: [0, b.r(0, 3), 0], c: '#4e7a44' }); }
  }
  if (kind === 3) for (let i = 0; i < 9; i++) addTuft(b, i % 3 ? 'grassCard' : 'fern', [b.r(-L / 2 + 0.3, L / 2 - 0.3), 0.16, b.r(-0.4, 0.4)], b.r(0.3, 0.55), b.r(0.3, 0.6), b.r(0, 3.1), i % 3 ? '#7a9a5a' : '#5a8a4a', 1);
  if (kind === 4) for (let i = 0; i < 3; i++) b.add(lumpy(sphere(0.5, 8, 5), 0.25, 2, seed + i, { flatBottom: 0 }), 'dirtPlain', { p: [b.r(-L / 2 + 1, L / 2 - 1), 0.12, b.r(-0.3, 0.3)], s: [b.r(1.2, 2.2), 0.35, b.r(0.7, 1.0)], c: MUD, uv: 'box' });
  return { builder: b };
}
// the Makers' planted timber: a tall straight trunk and a crown of solid tiers (stacked seven-sided frustums, each a little
// off the last so from above it is a stepped mass, never a fan of branches)
function timberTree(seed, scale = 1) {
  const b = new Builder(seed), H = b.r(15, 19) * scale;
  b.add(cyl(0.1 * scale, 0.36 * scale, H, 9), 'bark', { p: [0, H / 2 - 0.3, 0], c: '#6e5a48' });
  b.add(cyl(0.42 * scale, 0.5 * scale, 0.7, 9), 'bark', { p: [0, 0.1, 0], c: '#5e4c3c' });
  const n = 5, y0 = H * 0.42;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1), R = (2.5 - 1.75 * k) * scale * b.r(0.92, 1.06), th = (2.4 - 0.6 * k) * scale, y = y0 + i * (H - y0) / n;
    b.add(cyl(R * 0.42, R, th, 7), 'pineSkirt', { p: [b.r(-0.12, 0.12), y + th / 2, b.r(-0.12, 0.12)], r: [0, b.r(0, 6.3), 0], c: i % 2 ? '#3e5e3a' : '#365634', uv: 'box' });
  }
  b.add(cyl(0.05, 0.42 * scale, 1.3 * scale, 7), 'pineSkirt', { p: [0, H + 0.2, 0], c: '#3a5a36', uv: 'box' });
  return { builder: b, collider: { r: 0.45 * scale } };
}
// a stump where a planted tree went down with the slip, and a felled pole lying down the slope (along local x)
function stump(seed) { const b = new Builder(seed); b.add(cyl(0.32, 0.42, 0.6, 9), 'bark', { p: [0, 0.22, 0], c: '#6a5644' }); b.add(cyl(0.3, 0.3, 0.04, 9), 'woodLight', { p: [0, 0.53, 0], c: '#b89a74' }); return { builder: b, collider: { r: 0.45 } }; }
function fallenPole(seed) { const b = new Builder(seed), L = b.r(10, 14); b.add(cyl(0.18, 0.3, L, 9), 'bark', { p: [0, 0.28, 0], r: [0, 0, PI / 2], c: '#6a5644' }); return { builder: b, collider: { r: 0.6 } }; }
// ferns: a bank of single upright cards standing side by side along local x (all near one turn: from above a row of short
// parallel strokes, never a rosette), and a tuft of three single cards spread apart
function fernBank(seed, L = 2.4) {
  const b = new Builder(seed);
  for (let x = -L / 2; x <= L / 2; x += b.r(0.28, 0.4)) addTuft(b, 'fern', [x, 0, b.r(-0.25, 0.25)], b.r(0.6, 0.95), b.r(0.55, 0.95), b.r(-0.3, 0.3), b.r() < 0.5 ? '#5e8a4a' : '#4a7a40', 1);
  return { builder: b };
}
function fernTuft(seed) {
  const b = new Builder(seed);
  for (let i = 0; i < 3; i++) addTuft(b, 'fern', [b.r(-0.5, 0.5), 0, b.r(-0.5, 0.5)], b.r(0.6, 0.9), b.r(0.5, 0.85), b.r(-0.4, 0.4) + i * 0.15, b.r() < 0.5 ? '#5e8a4a' : '#466e3c', 1);
  return { builder: b };
}
function grassTufts(seed) {
  const b = new Builder(seed);
  for (let i = 0; i < 4; i++) addTuft(b, 'grassCard', [b.r(-0.5, 0.5), 0, b.r(-0.5, 0.5)], b.r(0.35, 0.55), b.r(0.3, 0.5), b.r(0, 3.1), i % 2 ? '#6a9a4a' : '#5a8a42', 1);
  return { builder: b };
}
// wet rock: dark mossy stones and boulders
function wetRock(seed, big = false) {
  const b = new Builder(seed);
  for (let i = 0; i < (big ? 2 : 1 + (seed % 3)); i++) addRock(b, [b.r(-0.8, 0.8), 0, b.r(-0.8, 0.8)], big ? [b.r(1.4, 2.4), b.r(0.9, 1.6), b.r(1.2, 2.0)] : [b.r(0.4, 0.9), b.r(0.25, 0.5), b.r(0.4, 0.8)], seed * 5 + i, { moss: 0.75, tint: '#6a6e68' });
  return { builder: b, collider: { r: big ? 2.0 : 0.8 } };
}
// raw mud and stone brought down by a slip: low red-brown lumps and a few grey stones
function mudHeap(seed) {
  const b = new Builder(seed);
  for (let i = 0; i < 4; i++) b.add(lumpy(sphere(0.7, 9, 5), 0.3, 1.8, seed + i, { flatBottom: 0 }), 'dirtPlain', { p: [b.r(-1.2, 1.2), -0.05, b.r(-1.2, 1.2)], s: [b.r(1.2, 2.0), b.r(0.3, 0.55), b.r(1.0, 1.6)], c: b.r() < 0.5 ? MUD : '#5a3622', uv: 'box' });
  for (let i = 0; i < 3; i++) addRock(b, [b.r(-1.4, 1.4), 0, b.r(-1.4, 1.4)], [b.r(0.3, 0.6), b.r(0.2, 0.4), b.r(0.3, 0.5)], seed * 3 + i, { moss: 0, tint: '#8a8680' });
  return { builder: b };
}
// a slip lane's marker: a square post in plain light and dark bands (no marks or numbers), a flat iron cap
function lanePost(seed) {
  const b = new Builder(seed);
  for (let i = 0; i < 4; i++) b.add(box(0.2, 0.45, 0.2), 'wPaint', { p: [0, 0.22 + i * 0.45, 0], c: i % 2 ? '#2e3032' : '#d8d2c4' });
  b.add(box(0.3, 0.07, 0.3), 'wIron', { p: [0, 1.84, 0], c: IRON });
  return { builder: b, collider: { r: 0.25 } };
}
// sawn poles stacked parallel (all one way) on two plain bearers, and a stack of seed sacks
function poleStack(seed, L = 6, n = 6) {
  const b = new Builder(seed);
  for (const sx of [-L / 2 + 0.8, L / 2 - 0.8]) b.add(box(0.24, 0.24, n * 0.3 + 0.4), 'beam', { p: [sx, 0.12, 0], c: '#4e3e2e' });
  for (let r = 0; r < 3; r++) for (let i = 0; i < n - r; i++) b.add(cyl(0.12, 0.13, L + b.r(-0.3, 0.3), 8), 'bark', { p: [b.r(-0.1, 0.1), 0.36 + r * 0.24, (i - (n - r - 1) / 2) * 0.28], r: [0, 0, PI / 2], c: '#8a7058' });
  return res(b, { colliders: [{ x: 0, z: 0, hw: L / 2, hd: n * 0.16 + 0.2 }] });
}
function crateStack(seed) {
  const b = new Builder(seed);
  const cr = (x, y, z, s, r) => { b.add(box(0.7 * s, 0.7 * s, 0.7 * s), 'woodLight', { p: [x, y + 0.35 * s, z], r: [0, r, 0], us: 1.2 }); for (const sy of [-1, 1]) b.add(box(0.74 * s, 0.07 * s, 0.74 * s), 'woodDark', { p: [x, y + 0.35 * s + sy * 0.33 * s, z], r: [0, r, 0] }); };
  cr(0, 0, 0, 1, 0.1); cr(0.78, 0, 0.08, 0.9, -0.1); cr(0.32, 0.7, 0.04, 0.8, 0.15);
  return res(b, { collider: { r: 1.0 } });
}
// a square plank water butt under the eaves (a box tank with plain bands, never a round barrel: a hooped top is a disc in a ring)
function waterButt(seed) {
  const b = new Builder(seed);
  b.add(box(0.9, 1.0, 0.9), 'wood', { p: [0, 0.5, 0], c: '#7a6248' });
  for (const y of [0.25, 0.8]) b.add(box(0.94, 0.07, 0.94), 'wIron', { p: [0, y, 0], c: IRON });
  b.add(box(0.8, 0.02, 0.8), 'wWet', { p: [0, 0.96, 0], c: '#4a5a58' });
  return res(b, { collider: { r: 0.6 } });
}
// a solid water wheel for the lane channels (axle along local x): a disc of planks, an iron tyre, paddles on the rim, a square
// hub on a square axle that runs out one side only (a T from above, never a cross)
function smallWheel(seed, R = 0.9, thick = 0.32) {
  const b = new Builder(seed);
  b.add(cyl(R, R, thick, 28), 'woodDark', { r: [0, 0, PI / 2], c: '#4a3a2c' });
  b.add(cyl(R + 0.04, R + 0.04, thick * 0.5, 28), 'wIron', { r: [0, 0, PI / 2], c: '#34363a' });
  for (let i = 0; i < 10; i++) { const a = (i / 10) * PI * 2, rr = R + 0.12; b.add(box(thick + 0.12, 0.26, 0.05), 'wood', { p: [0, Math.cos(a) * rr, Math.sin(a) * rr], r: [a, 0, 0], c: '#6a5440' }); }
  b.add(box(thick + 0.2, 0.3, 0.3), 'wIron', { c: '#3a3c40' });
  b.add(box(1.2, 0.12, 0.12), 'wIron', { p: [0.6 - thick / 2, 0, 0], c: '#2e3034' });
  return b;
}

// ------------------------------------------------------------------ the area
export function buildRainward(W, S) {
  const R = RAINWARD, T = W.terrain;
  const H = (x, z) => T.height(x, z);
  const put = (key, x, z, r = 0, s = 1, sink = 0.05) => S.place(key, x, H(x, z) - sink, z, r, s);
  const pre = (key, r2) => { if (!S.prefabs.has(key)) S.addPrefab(key, r2); };
  const place = (r2, x, z, ry = 0, yOff = 0) => W.placeObject(r2, x, z, ry, yOff);
  const runtime = (W.rainwardRuntime = []);
  // a result built in world coordinates (walls, lanes, rocks): placeAt files it by its origin, which is outside the box, so it is
  // moved into the gorge's own group (its colliders stay where placeAt put them)
  const placeAbs = (r2, y = 0) => { const o = W.placeAt(r2, 0, y, 0, 0); W.rainwardGroup.add(o); return o; };
  const rng = mulberry32(1500);
  for (let v = 0; v < 5; v++) pre('rgbed' + v, seedBed(1501 + v, v));
  pre('rgbedS', seedBed(1507, 0, 5)); // (a short bed for the shelf's ends)
  for (let v = 0; v < 4; v++) pre('rgtree' + v, timberTree(1511 + v, 0.92 + v * 0.06));
  pre('rgstump', stump(1516)); pre('rgpole', fallenPole(1517));
  for (let v = 0; v < 3; v++) pre('rgfernbank' + v, fernBank(1520 + v, 1.8 + v * 0.6));
  for (let v = 0; v < 3; v++) pre('rgfern' + v, fernTuft(1524 + v));
  for (let v = 0; v < 3; v++) pre('rgtuft' + v, grassTufts(1527 + v));
  for (let v = 0; v < 4; v++) pre('rgrock' + v, wetRock(1530 + v));
  for (let v = 0; v < 2; v++) pre('rgboulder' + v, wetRock(1535 + v, true));
  for (let v = 0; v < 3; v++) pre('rgmud' + v, mudHeap(1538 + v));
  pre('rgpost', lanePost(1541));
  pre('lantern', P.lanternPost(1542, 'yellow'));
  pre('bench', stoneBench(1543)); pre('sacks', sacks(1544)); pre('rgcrates', crateStack(1545)); pre('rgbutt', waterButt(1546));
  pre('rgpoles', poleStack(1547));

  // things the scatter keeps clear of (the people, the doors, the pads, the tracks, the huts)
  const people = [...NPCS, ...NODES, ...OBJECTS].filter((e) => typeof e.x === 'number' && e.x > R.minX && e.x < R.maxX && e.z > R.minZ && e.z < R.maxZ);
  const huts = [];
  const keepClear = (x, z, pad = 0) => {
    if (rainwardPathDist(x, z) < 3.2 + pad) return false;
    for (const Pd of [R.road.pad, R.camp, ...R.adits, R.cutting]) if (Math.max(Math.abs(x - Pd.x), Math.abs(z - Pd.z)) < Pd.s + 2 + pad) return false;
    if (Math.hypot(x - R.grave.x, z - R.grave.z) < 5 + pad || Math.hypot(x - R.caravan.x, z - R.caravan.z) < 5 + pad) return false;
    if (people.some((e) => Math.hypot(e.x - x, e.z - z) < 3 + pad)) return false;
    if (DUNGEONS.some((Dg) => Math.hypot(x - Dg.door.x, z - Dg.door.z) < 9 + pad)) return false;
    for (const [hx, hz, hr] of huts) if (Math.hypot(x - hx, z - hz) < hr + pad) return false;
    for (const L of R.lanes) if (Math.abs(x - L.x) < L.hw + 0.8 + pad && vOf(x, z) > L.v0 - 2 && vOf(x, z) < L.v1 + 2) return false;
    for (const B of R.bridges) if (x > B.x0 - 2 && x < B.x1 + 2 && z > B.z0 - 2 && z < B.z1 + 2) return false;
    return true;
  };

  // ---------------------------------------------------------------- the river, the pool and the falls
  {
    // (in three runs: the falls themselves are the falls' own ribbons, not a steep sheet of river)
    const lines = [[]]; for (let x = R.minX + 2; x <= R.east + 2; x += 2) { if (R.falls.some((F) => x > F.x0 - 1.5 && x < F.x1 + 1.5)) { if (lines[lines.length - 1].length) lines.push([]); continue; } lines[lines.length - 1].push([x, riverZ(x)]); }
    const river = createChannels(W.rainwardTerrain, W.engine.sunDir, lines.filter((l) => l.length > 1), (x) => riverLevel(x) - 0.08, 7.6);
    const u = river.material.uniforms; u.uDeep.value.set('#1a3228'); u.uShallow.value.set('#56745a'); u.uSky.value.set('#aab8b0'); u.uFoam.value.set('#e6ece6');
    river.name = 'rainwardRiver';
    W.rainwardGroup.add(river); runtime.push(river);
    // the two falls over the rock steps, falling west down the gorge (no rainbow: the mist is plain white spray)
    W.rainwardFalls = [];
    for (const F of R.falls) {
      const fall = createWaterfall(W.rainwardTerrain, { x: F.x0 + 0.4, z: riverZ(F.x), top: riverLevel(F.x1 + 1) - 0.1, foot: riverLevel(F.x0 - 1) - 0.1, w: 6.4, ry: -PI / 2, lip: 2.6, mist: 1.2 }); // (stood at the step's foot: the lip runs back up onto the top, so the sheet falls clear of the rock)
      fall.name = 'rainwardFall';
      W.rainwardGroup.add(fall); W.dyn.push(fall); runtime.push(fall); W.rainwardFalls.push(fall);
      // the rock step: dark wet ledges either side of the falls
      const b = new Builder(1550 + F.x);
      for (const sv of [-1, 1]) for (let i = 0; i < 3; i++) addRock(b, [F.x + b.r(-1.5, 1.5), 0, riverZ(F.x) - sv * (riverHW(F.x) + 1.2 + i * 1.4)], [b.r(1.0, 1.8), b.r(1.5, 3.5), b.r(1.0, 1.6)], 1555 + F.x + i * 7 + sv, { moss: 0.5, tint: '#5e625c' });
      placeAbs({ builder: b }, riverLevel(F.x0) - 0.3);
    }
    // white falls off the north cliff, dropping to its foot
    for (const SF of R.sideFalls) {
      const v0 = northFoot(SF.x) + 7, zl = zOfV(SF.x, v0), top = rainwardHeight(SF.x, zl) - 0.8, zf = zOfV(SF.x, northFoot(SF.x) - 1.5), foot = rainwardHeight(SF.x, zf);
      const fall = createWaterfall(W.rainwardTerrain, { x: SF.x, z: zl + 1.5, top, foot, w: 2.2, ry: 0, lip: 1.2, mist: 0.6 });
      fall.name = 'rainwardSideFall';
      W.rainwardGroup.add(fall); W.dyn.push(fall); runtime.push(fall); W.rainwardFalls.push(fall);
      for (let i = 0; i < 5; i++) put('rgrock' + (i % 4), SF.x + (rng() - 0.5) * 6, zf + 1 + rng() * 3, rng() * 6, 1.2, 0.2);
    }
  }

  // ---------------------------------------------------------------- the haul road's head
  {
    const Pd = R.road.pad;
    // a loading stage: a flat plank deck on square posts beside the stand, the wagons' tail at its edge; poles waiting on it
    const b = new Builder(1560), L = 7, D = 3, top = 1.1;
    for (const sx of [-L / 2 + 0.2, 0, L / 2 - 0.2]) for (const sz of [-D / 2 + 0.2, D / 2 - 0.2]) b.add(box(0.28, top, 0.28), 'beam', { p: [sx, top / 2, sz], c: '#4e3e2e' });
    b.add(box(L, 0.16, D), 'wood', { p: [0, top + 0.08, 0], c: '#7a6448' });
    for (const sz of [-D / 2 + 0.2, D / 2 - 0.2]) b.add(box(L + 0.1, 0.22, 0.2), 'beam', { p: [0, top - 0.1, sz], c: '#4e3e2e' });
    for (let i = 0; i < 3; i++) b.add(box(0.9, 0.18, 0.3), 'wood', { p: [-L / 2 - 0.5, 0.2 + i * 0.36, D / 2 - 0.5 - i * 0.02], c: '#6a5440' }); // plank steps up
    place(res(b, { colliders: [{ x: 0, z: 0, hw: L / 2, hd: D / 2 }] }), Pd.x - 1, Pd.z - 6.2, 0, -0.05);
    put('rgpoles', Pd.x + 7.5, Pd.z - 6, 0.02); put('rgcrates', Pd.x - 7.5, Pd.z - 2.5, 0.3); put('sacks', Pd.x - 6, Pd.z + 2, 1.2);
    put('lantern', Pd.x + 4.2, Pd.z + 3.2, 0.2); put('lantern', Pd.x - 4.2, Pd.z - 4.2, 2.4);
    // a plain square signboard post at the road's end (no lettering)
    const sb = new Builder(1561);
    sb.add(box(0.22, 2.2, 0.22), 'beam', { p: [0, 1.1, 0], c: '#4e3e2e' }); sb.add(box(1.3, 0.6, 0.08), 'wood', { p: [0, 1.85, 0.14], c: '#7a6448' });
    place(res(sb, { collider: { r: 0.3 } }), Pd.x + 5, Pd.z - 2, -0.4);
  }

  // ---------------------------------------------------------------- the Seedwrights' camp
  const C = R.camp, face = (x, z) => Math.atan2(C.x - x, C.z - z);
  {
    // four huts round the square (north-west, north-east, west and east), each turned to face the fire; the haul road runs
    // past the square's south side, the spur comes in between the south huts, the graveyard path leaves between the west ones
    const hutAt = [[414, -3000, 5.2, 4.8, { roof: 'pent', tile: 'moss', chimney: true }], [436, -3000, 5.4, 5.0, { roof: 'flat', wall: 'stone', chimney: true, shutC: '#3e3a30' }], [413, -2986, 5.2, 4.8, { roof: 'pent', tile: '#4a4e4c', chimney: true }], [437, -2986, 5.2, 4.8, { roof: 'pent', tile: 'moss', wall: 'stone', chimney: false, shutC: '#4a4436' }]];
    hutAt.forEach(([x, z, w, d, o], i) => { place(seedHut(1570 + i, { w, d, h: 2.9, ...o }), x, z, face(x, z), -0.1); huts.push([x, z, 5]); });
    place(P.campfire(1580), C.x + 0.5, C.z - 0.5, 0);
    put('bench', C.x - 3, C.z + 2, 2.4); put('bench', C.x + 4, C.z - 2.6, -0.9);
    for (const [x, z] of [[425, -3003.5], [419.5, -2979.5], [431.5, -2978.5]]) put('lantern', x, z, face(x, z));
    place(dryRack(1581, 4.5), 420, -3003, 0); place(dryRack(1582, 4), 440.5, -2993, PI / 2);
    place(seedShed(1583, 5, 3), 430, -3003.5, 0);
    put('sacks', 433, -2992, 0.4); put('rgcrates', 432.5, -2980.5, 0.2); put('rgbutt', 417.5, -2983, 0.1);
    { const g = R.grave; put('bench', g.x, g.z - 1.6, 0); put('lantern', g.x + 2.2, g.z - 1.2, 0.4); }
    { const cv = R.caravan; place(P.cart(1584), cv.x + 2.6, cv.z + 2.2, 0.6); put('rgcrates', cv.x + 4.5, cv.z - 1, 0.4); }
  }

  // ---------------------------------------------------------------- the terraces: retaining walls, beds, drains, lanes
  const drainRows = [], drainLanes = [], wheelSpots = [];
  {
    // the retaining walls: along each row's front edge (from the ground below up to a coping 0.25 m over the row) and down both
    // ends of each row (to the stair lane or the slope beside it); dry stone with a flat coping, square at every corner
    R.terraces.forEach((B, bi) => {
      const b = new Builder(1600 + bi), wallC = (i) => ['#7c7e76', '#72746c', '#86887e'][i % 3];
      for (let r = 0; r < B.n; r++) {
        const v = B.v0 + r * B.d, top = B.levels[r] + 0.25;
        // the front wall, in 4 m lengths along x
        for (let x = B.x0; x < B.x1 - 0.01; x += 4) {
          const x1 = Math.min(B.x1, x + 4), xm = (x + x1) / 2, z = zOfV(xm, v - 0.3);
          let lo = Infinity; for (let t = x; t <= x1; t += 1) lo = Math.min(lo, r ? B.levels[r - 1] : rainwardHeight(t, zOfV(t, v - 1.5)));
          if (top - lo < -0.1) continue;
          const hgt = top - lo + 1.6; // (well down into the slope below, so no foot shows where the ground falls away)
          b.add(box(x1 - x + 0.02, hgt, 0.6), 'stone', { p: [xm, top - hgt / 2, z], c: wallC(Math.round(x)), us: 0.55, uv: 'box' });
          b.add(box(x1 - x + 0.06, 0.14, 0.75), 'stoneLarge', { p: [xm, top + 0.05, z + 0.05], c: ST_L });
        }
        // the end walls
        for (const [ex, sx] of [[B.x0, -1], [B.x1, 1]]) {
          const lo = Math.min(rainwardHeight(ex + sx * 1.5, zOfV(ex, v + 1)), rainwardHeight(ex + sx * 1.5, zOfV(ex, v + B.d - 1)));
          const hgt = top - lo + 0.5;
          if (hgt < 0.4) continue;
          b.add(box(0.6, hgt, B.d + 0.02), 'stone', { p: [ex + sx * 0.3, top - hgt / 2, zOfV(ex, v + B.d / 2)], c: wallC(r + bi), us: 0.55, uv: 'box' });
          b.add(box(0.75, 0.14, B.d + 0.06), 'stoneLarge', { p: [ex + sx * 0.32, top + 0.05, zOfV(ex, v + B.d / 2)], c: ST_L });
        }
        // behind the top step: a wall holding the slope above it, from the step up to the ground behind
        if (r === B.n - 1) for (let x = B.x0; x < B.x1 - 0.01; x += 4) {
          const x1 = Math.min(B.x1, x + 4), xm = (x + x1) / 2, z = zOfV(xm, B.v1 + 0.3);
          let hi = -Infinity; for (let t = x; t <= x1; t += 1) hi = Math.max(hi, rainwardHeight(t, zOfV(t, B.v1 + 1.2)));
          const hgt = hi - B.levels[r] + 0.35;
          if (hgt < 0.4) continue;
          b.add(box(x1 - x + 0.02, hgt + 0.3, 0.6), 'stone', { p: [xm, B.levels[r] - 0.3 + (hgt + 0.3) / 2, z], c: wallC(Math.round(x) + 1), us: 0.55, uv: 'box' });
          b.add(box(x1 - x + 0.06, 0.14, 0.75), 'stoneLarge', { p: [xm, B.levels[r] + hgt + 0.05, z - 0.05], c: ST_L });
        }
        // the row's drain channel: a stone trough along the back of the row (north), flowing west to its block's lane
        const dv = v + B.d - 0.9, zc = zOfV((B.x0 + B.x1) / 2, dv), x0 = B.x0 + 0.6, x1 = B.x1 - 0.6, L = x1 - x0, y = B.levels[r];
        for (const s of [-1, 1]) b.add(box(L, 0.36, 0.16), 'stoneLarge', { p: [(x0 + x1) / 2, y + 0.14, zc + s * 0.42], c: ST });
        b.add(box(L, 0.08, 0.7), 'stoneDark', { p: [(x0 + x1) / 2, y + 0.02, zc], c: ST_D });
        if (B.lane != null) drainRows.push([[x1, zc], [B.x0 - 0.2, zc], [B.lane + 0.4, zc]]);
        else drainRows.push([[x1, zc], [x0, zc]]);
      }
      placeAbs({ builder: b });
    });
    // the seed beds in parallel rows along each step (the paint's bed stripes): the Seedwrights keep the Gorge Foot's beds and
    // the lowest steps of the Seed Terraces; above that the beds stand bare or gone to weeds, and the slips have buried the
    // top of the east block
    R.terraces.forEach((B, bi) => {
      for (let r = 0; r < B.n; r++) for (let f = 1.4 + 0.64; f < B.d - 1.8; f += 2.3) {
        const v = B.v0 + r * B.d + f;
        for (let x = B.x0 + 1.6; x + 7 <= B.x1 - 1.2; x += 7.6) {
          const xm = x + 3.5, z = zOfV(xm, v), y = B.levels[r];
          if (people.some((e) => Math.hypot(e.x - xm, e.z - z) < 4.5)) continue;
          let kind;
          const roll = rng();
          if (bi === 0 || r === 0) kind = roll < 0.75 ? 0 : 1;
          else if (r === 1) kind = roll < 0.4 ? 0 : roll < 0.7 ? 1 : 2;
          else if (bi === 3 && r >= 4) kind = roll < 0.75 ? 4 : 3;
          else kind = roll < 0.45 ? 3 : roll < 0.8 ? 2 : 1;
          S.place('rgbed' + kind, xm, y - 0.02, z, 0, 1);
        }
      }
      // an open seed shed at the end of the lowest step of each block and a drying rack beside it
      if (bi > 0) {
        const xs = B.x1 - 1.6, z = zOfV(xs, B.v0 + 3); // (turned along the step, its open front to the beds, past their east end)
        W.placeAt(seedShed(1620 + bi, 4.6, 2.6), xs, B.levels[0], z, -PI / 2);
        W.placeAt(dryRack(1625 + bi, 4), B.x0 + 4, B.levels[1], zOfV(B.x0 + 4, B.v0 + B.d + 1.0), 0);
      }
    });
    // the shelf over the river: beds along it, edged with a stone kerb along the river side
    {
      const Sh = R.shelf, b = new Builder(1630);
      for (let v = Sh.v1 - 1.2 - 0.64; v > Sh.v0 + 1.5; v -= 2.3) for (let x = Sh.x0 + 2.4; x + 7 <= Sh.x1 - 2; x += 7.6) { const k = rng() < 0.8 ? 0 : 1, z = zOfV(x + 3.5, v); if (!people.some((e) => Math.hypot(e.x - x - 3.5, e.z - z) < 2)) S.place('rgbed' + k, x + 3.5, Sh.top - 0.02, z, 0, 1); } // (a bed the Chapter 45 quest buries under mud stands in its own slot)
      for (let x = Sh.x0 + 0.5; x < Sh.x1 - 0.4; x += 4) { const z = zOfV(x + 2, Sh.v1 + 0.2); b.add(box(4.02, 0.9, 0.5), 'stone', { p: [x + 2, Sh.top - 0.25, z], c: '#7c7e76', us: 0.55, uv: 'box' }); }
      placeAbs({ builder: b });
      put('rgbutt', Sh.x0 + 1.5, zOfV(Sh.x0 + 1.5, Sh.v0 + 2), 0.2); put('sacks', Sh.x1 - 1.8, zOfV(Sh.x1 - 1.8, Sh.v0 + 2.2), 0.4);
    }
    // the stair lanes: stone steps up each lane (flat slabs following the slope), and the drain channel down the middle,
    // stepped with small falls, a solid water wheel turning in it at two of the drops
    R.lanes.forEach((L, li) => {
      const b = new Builder(1640 + li), steps = [];
      for (let v = L.v0; v < L.v1; v += 1.6) {
        const z = zOfV(L.x, v), y = rainwardHeight(L.x - 1.2, z);
        for (const sx of L.drain ? [-1.15, 1.15] : [0]) b.add(box(L.drain ? 1.5 : 3.6, 0.2, 1.3), 'stoneLarge', { p: [L.x + sx, y + 0.04, z], c: ['#9a9c94', '#8e9088', '#a2a49a'][Math.round(v) % 3] });
        steps.push([v, z, y]);
      }
      if (L.drain) {
        const pts = [];
        for (let v = L.v1 - 1; v > 2; v -= 1.5) pts.push([L.x, zOfV(L.x, v)]);
        drainLanes.push(pts);
        for (let i = 0; i < pts.length - 1; i++) {
          const [x, z] = pts[i], [, z2] = pts[i + 1], y = rainwardHeight(x, z), y2 = rainwardHeight(x, z2);
          for (const s of [-1, 1]) beam(b, [x + s * 0.4, y + 0.12, z], [x + s * 0.4, y2 + 0.12, z2], 0.14, 'stoneLarge', ST, 0.34);
        }
        for (const v of [44, 76]) wheelSpots.push({ x: L.x, z: zOfV(L.x, v), y: rainwardHeight(L.x, zOfV(L.x, v)) });
      }
      placeAbs({ builder: b });
    });
    // the drains' water: the rows' troughs (level over each row) and the lanes' channels (down the slope)
    const rows = createChannels(W.rainwardTerrain, W.engine.sunDir, drainRows, (x, z) => { const l = terraceLevelAt(x, z); return l === null ? rainwardHeight(x, z) + 0.2 : l + 0.26; }, 0.3);
    const lanes = createChannels(W.rainwardTerrain, W.engine.sunDir, drainLanes, (x, z) => rainwardHeight(x, z) + 0.2, 0.32);
    for (const m of [rows, lanes]) { const u = m.material.uniforms; u.uDeep.value.set('#24382e'); u.uShallow.value.set('#6a8670'); u.uSky.value.set('#b8c4bc'); u.uFoam.value.set('#eef2ee'); m.name = 'rainwardDrains'; W.rainwardGroup.add(m); runtime.push(m); }
    // the wheels: housed in a square stone pit in the lane channel, their axles into a small square gear box on the bank
    const geo = smallWheel(1650).geometries();
    W.rainwardWheels = [];
    for (const Wh of wheelSpots) {
      const g = new THREE.Group();
      for (const { geo: gg, mat } of geo) { const m = new THREE.Mesh(gg, mat); m.castShadow = true; m.receiveShadow = true; g.add(m); }
      g.position.set(Wh.x, Wh.y + 0.75, Wh.z); g.name = 'rainwardWheel';
      markDynamic(g); W.rainwardGroup.add(g); runtime.push(g); W.rainwardWheels.push({ g, a: rng() * 6 });
      const b = new Builder(1651);
      for (const sx of [-1, 1]) b.add(box(0.3, 1.1, 2.4), 'stoneDark', { p: [sx * 0.42, 0.25, 0], c: ST_D });
      b.add(box(0.7, 0.7, 0.7), 'wIron', { p: [1.1, 0.75, 0], c: '#3a3c40' });
      W.placeAt(res(b, { colliders: [{ x: 1.1, z: 0, r: 0.5 }] }), Wh.x, Wh.y, Wh.z, 0);
    }
  }

  // ---------------------------------------------------------------- the bridges: flat timber decks on square piers
  for (const Br of R.bridges) {
    const b = new Builder(1660 + Math.round(Br.x0)), Lz = Br.z1 - Br.z0, Lx = Br.x1 - Br.x0, cx = (Br.x0 + Br.x1) / 2, cz = (Br.z0 + Br.z1) / 2, top = Br.top;
    if (Br.piers) {
      // the footbridge runs along z over the river: planks across, two stringers, square stone piers in the water and on
      // each bank, posts and a single top rail each side (level rails only, no braces)
      b.add(box(Lx, 0.14, Lz + 0.6), 'wood', { p: [0, top - 0.07, 0], c: '#7a6448', us: 1 });
      for (const sx of [-1, 1]) b.add(box(0.24, 0.34, Lz + 0.6), 'beam', { p: [sx * (Lx / 2 - 0.3), top - 0.3, 0], c: '#4e3e2e' });
      for (const t of [-0.5, -0.15, 0.2, 0.5]) { const z = t * Lz, y0 = rainwardHeight(cx, cz + z) - 0.4; b.add(box(Lx - 0.2, top - 0.4 - y0, 0.8), 'stone', { p: [0, (top - 0.4 + y0) / 2, z], c: '#6e706a', us: 0.5, uv: 'box' }); }
      for (const sx of [-1, 1]) { for (let z = -Lz / 2; z <= Lz / 2 + 0.01; z += Lz / 4) b.add(box(0.14, 1.0, 0.14), 'beam', { p: [sx * (Lx / 2 - 0.1), top + 0.5, z], c: '#4e3e2e' }); b.add(box(0.1, 0.12, Lz + 0.2), 'beam', { p: [sx * (Lx / 2 - 0.1), top + 1.0, 0], c: '#5a4a38' }); }
    } else {
      // over a lane's drain: a short plank deck across the road on two square stone sills, a kerb beam each side
      b.add(box(Lx, 0.14, Lz), 'wood', { p: [0, top - 0.07, 0], c: '#7a6448', us: 1 });
      for (const sx of [-1, 1]) b.add(box(0.6, 0.6, Lz + 0.2), 'stoneLarge', { p: [sx * (Lx / 2 - 0.3), top - 0.44, 0], c: ST });
      for (const sz of [-1, 1]) b.add(box(Lx, 0.2, 0.18), 'beam', { p: [0, top + 0.06, sz * (Lz / 2 - 0.1)], c: '#4e3e2e' });
    }
    W.placeAt({ builder: b }, cx, 0, cz, 0);
  }

  // ---------------------------------------------------------------- the drain adits: square mouths in the north cliff
  W.rainwardAdits = [];
  R.adits.forEach((A, i) => {
    const b = new Builder(1670 + i), y = A.flat ?? rainwardHeight(A.x, A.z), mz = A.z - A.s - 0.6; // the mouth's face, at the pad's north edge
    const ow = 3.2, oh = 3.0;
    // the headwall: dressed stone blocks round the opening, set into the cliff; two square jambs and a flat lintel
    b.add(box(10, 7, 2.4), 'stone', { p: [0, 3.5 - 0.6, -1.2], c: '#6a6c66', us: 0.5, uv: 'box' });
    for (const sx of [-1, 1]) b.add(box(0.8, oh + 0.2, 0.7), 'stoneLarge', { p: [sx * (ow / 2 + 0.4), oh / 2, 0.15], c: ST_L });
    b.add(box(ow + 2.2, 0.8, 0.8), 'stoneLarge', { p: [0, oh + 0.4, 0.15], c: ST_L });
    b.add(box(ow + 2.6, 0.2, 0.9), 'stoneLarge', { p: [0, oh + 0.9, 0.15], c: '#9a9c94' });
    b.add(box(ow, oh, 5.5), 'wDark', { p: [0, oh / 2, -2.6], c: '#0e100e' }); // the dark inside
    b.add(box(ow + 0.3, 0.2, 0.6), 'stoneLarge', { p: [0, 0.05, 0.3], c: ST }); // the sill
    // choked: mud and stones heaped in the mouth, a trickle running out of it down a short stone channel
    b.add(lumpy(sphere(1.2, 10, 6), 0.3, 1.6, 1675 + i, { flatBottom: 0 }), 'dirtPlain', { p: [0.2, -0.1, -0.4], s: [1.3, 0.8, 1.1], c: MUD, uv: 'box' });
    for (let k = 0; k < 4; k++) addRock(b, [b.r(-1.2, 1.2), 0, b.r(-0.8, 0.6)], [b.r(0.25, 0.5), b.r(0.2, 0.4), b.r(0.25, 0.45)], 1680 + i * 5 + k, { moss: 0.4, tint: '#7a7a74' });
    for (const s of [-1, 1]) b.add(box(0.16, 0.3, 3.4), 'stoneLarge', { p: [1.3 + s * 0.35, 0.1, 2.2], c: ST });
    b.add(box(0.55, 0.04, 3.4), 'wWet', { p: [1.3, 0.04, 2.2], c: '#3a4a44' });
    W.placeAt(res(b, { colliders: [{ x: 0, z: -1.2, hw: 5, hd: 1.2 }] }), A.x, y, mz, 0);
    W.rainwardAdits.push({ x: A.x, z: mz, y });
    put('lantern', A.x - 4, A.z - 1.5, 0.3);
  });

  // ---------------------------------------------------------------- the head of the gorge: the Makers' upper cutting
  {
    const Cu = R.cutting, y = Cu.flat ?? rainwardHeight(Cu.x, Cu.z), fx = Cu.x + Cu.s + 1.2, b = new Builder(1690);
    // (local +z faces west out of the wall: the object is turned a quarter west) a square cut into the head wall, faced in
    // dressed stone, two square jambs and a deep flat lintel, the dark inside, spoil heaps either side
    const ow = 7, oh = 6.4;
    b.add(box(18, 12, 3), 'stone', { p: [0, 6 - 1, -1.5], c: '#686a64', us: 0.4, uv: 'box' });
    for (const sx of [-1, 1]) b.add(box(1.4, oh + 0.4, 1.2), 'stoneLarge', { p: [sx * (ow / 2 + 0.7), oh / 2, 0.3], c: ST_L });
    b.add(box(ow + 3.6, 1.3, 1.3), 'stoneLarge', { p: [0, oh + 0.65, 0.3], c: ST_L });
    b.add(box(ow + 4.2, 0.3, 1.5), 'stoneLarge', { p: [0, oh + 1.45, 0.3], c: '#9a9c94' });
    b.add(box(ow, oh, 8), 'wDark', { p: [0, oh / 2, -4], c: '#0c0e0c' });
    b.add(box(ow + 0.4, 0.24, 1.0), 'stoneLarge', { p: [0, 0.06, 0.6], c: ST });
    for (const sx of [-1, 1]) b.add(lumpy(sphere(2.2, 10, 6), 0.3, 1.4, 1691 + sx, { flatBottom: 0 }), 'dirtPlain', { p: [sx * 7.5, -0.3, 2.5], s: [1.4, 0.8, 1.6], c: sx < 0 ? '#6a5a4a' : MUD, uv: 'box' });
    W.placeAt(res(b, { colliders: [{ x: 0, z: -1.5, hw: 9, hd: 1.5 }, { x: -7.5, z: 2.5, r: 2.4 }, { x: 7.5, z: 2.5, r: 2.4 }] }), fx, y, Cu.z, -PI / 2);
    W.rainwardCutting = { x: fx, z: Cu.z, y };
    put('lantern', Cu.x + 2, Cu.z - 6, -PI / 2); put('lantern', Cu.x + 2, Cu.z + 6, -PI / 2);
    put('rgpoles', Cu.x - 4, Cu.z - 7.5, PI / 2 + 0.05);
  }

  // ---------------------------------------------------------------- the Slip: marked lanes, mud, stumps, buried ground
  W.rainwardSlips = [];
  {
    R.slips.forEach((L, li) => {
      // the banded posts down both edges, every 8 m (off the road and the river)
      for (let i = 0; i < L.pts.length - 1; i++) {
        const [ax, az] = L.pts[i], [bx, bz] = L.pts[i + 1], len = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / len, nz = (bx - ax) / len;
        for (let t = i ? 4 : 2; t < len; t += 8) for (const s of [-1, 1]) {
          const x = ax + (bx - ax) * t / len + nx * s * (L.hw + 0.9), z = az + (bz - az) * t / len + nz * s * (L.hw + 0.9);
          if (rainwardPathDist(x, z) < 3 || rainwardGap(x, z) > -0.5 || vOf(x, z) < 6) continue;
          put('rgpost', x, z, 0, 1, 0.1);
        }
      }
      // mud and stone heaped at the lane's foot and along it, stumps beside it where the timber went down
      for (let k = 0; k < 7; k++) { const t = rng(), [ax, az] = L.pts[0], [bx, bz] = L.pts[L.pts.length - 1], x = ax + (bx - ax) * t + (rng() - 0.5) * L.hw, z = az + (bz - az) * t; if (rainwardPathDist(x, z) > 3.5 && vOf(x, z) > 6) put('rgmud' + (k % 3), x, z, rng() * 6, 0.8 + rng() * 0.5, 0.15); }
      // the slip itself: a ribbon of running mud down the lane, shown while it pours (its front runs down from the top)
      W.rainwardSlips.push(slipRibbon(L, li));
    });
    for (const m of W.rainwardSlips) { W.rainwardGroup.add(m); runtime.push(m); }
  }

  // ---------------------------------------------------------------- the planted timber, the slopes, the ferns
  {
    // the Makers' planted rows: straight rows along x, staggered; gaps (stumps, a felled pole lying down the slope) where a slip
    // lane runs through. The world boss's beats (the Hill Leveller's path and rainPath, P14.3) are cut clear (stumps): a 13 m
    // machine would otherwise grind through the rows' trunks
    const segD = (x, z, [ax, az], [bx, bz]) => { const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)); return Math.hypot(x - ax - t * dx, z - az - t * dz); };
    const beats = SPAWNS.filter((S) => S.world && MOBS[S.mob]).flatMap((S) => [S.path, S.rainPath].filter((pa) => pa && pa.length > 1 && pa.some(([x, z]) => x > R.minX && x < R.maxX && z > R.minZ && z < R.maxZ)).map((pa) => ({ pa, r: (MOBS[S.mob].radius || 3) + (S.r || 0) + 2.5 })));
    const onBeat = (x, z) => beats.some(({ pa, r }) => pa.some((a, i) => i > 0 && segD(x, z, pa[i - 1], a) < r));
    R.timber.forEach((P2, pi) => {
      let ri = 0;
      for (let v = P2.v0; v <= P2.v1; v += P2.dv, ri++) for (let x = P2.x0 + (ri % 2) * P2.dx / 2; x <= P2.x1; x += P2.dx) {
        const z = zOfV(x, v);
        if (rainwardGap(x, z) > -1.5 || !keepClear(x, z, 0.5)) continue;
        const L = slipLane(x, z);
        if ((L.i >= 0 && L.d < R.slips[L.i].hw + 1.5) || onBeat(x, z)) { if (rng() < 0.35) put('rgstump', x, z, rng() * 6, 1, 0.05); continue; }
        put('rgtree' + Math.floor(rng() * 4), x, z, rng() * 6, 0.9 + rng() * 0.2, 0.15);
      }
    });
    // felled poles lying straight down the slip lanes (along z: the lanes' own run), each well apart
    for (const L of R.slips) for (const t of [0.3, 0.62]) { const [ax, az] = L.pts[0], [bx, bz] = L.pts[L.pts.length - 1], x = ax + (bx - ax) * t + 1.2, z = az + (bz - az) * t; if (rainwardPathDist(x, z) > 7) put('rgpole', x, z, PI / 2 + 0.03, 1, 0.12); } // (lying along z, the lane's own run)
    // timber on the south wall's lower slope across the river (never walked: the backdrop), and on the north slopes
    for (let x = R.minX + 8; x < R.east; x += 7) for (let k = 0; k < 3; k++) {
      const v = -(riverHW(x) + 7 + k * 6 + rng() * 3), xx = x + (rng() - 0.5) * 4, z = zOfV(xx, v), h = rainwardHeight(xx, z);
      if (h - riverLevel(xx) > 26 || (xx > R.shelf.x0 - 4 && xx < R.shelf.x1 + 4 && v > R.shelf.v0 - 4)) continue;
      put('rgtree' + Math.floor(rng() * 4), xx, z, rng() * 6, 0.85 + rng() * 0.25, 0.3);
    }
    // scatter over the walkable side: ferns in banks along the cliff feet, the terrace walls, the river and the lanes; tufts
    // of grass, wet stones, boulders at the cliff feet; nothing on the beds, the tracks, the pads or round the people
    let rs = mulberry32(1);
    const seed = (a, b2) => { rs = mulberry32(Math.imul(a + 41, 73856093) ^ Math.imul(b2 + 43, 19349663) ^ 0x3c1); };
    const pick = (base, n) => base + Math.floor(rs() * n);
    const cell = 4.5;
    for (let iz = 0, gz = R.minZ + 16; gz < R.maxZ - 16; iz++, gz += cell) for (let ix = 0, gx = R.minX + 16; gx < R.maxX - 16; ix++, gx += cell) {
      seed(ix, iz);
      const x = gx + rs() * cell, z = gz + rs() * cell, g = rainwardGap(x, z), v = vOf(x, z);
      if (g > 4 || v < 0 && v > -(riverHW(x) + 1.5)) continue;
      if (g > -1) { // the cliff feet and the south bank: boulders, banks of ferns against the rock (none before the adits or the cutting)
        if ([...R.adits, R.cutting].some((P2) => Math.hypot(x - P2.x, z - P2.z) < P2.s + 9)) continue;
        const roll = rs();
        if (roll < 0.2) put(pick('rgboulder', 2), x, z, rs() * 6, 0.9 + rs() * 0.4, 0.4);
        else if (roll < 0.6) put(pick('rgfernbank', 3), x, z, (rs() - 0.5) * 0.5, 0.9 + rs() * 0.4, 0.05);
        continue;
      }
      if (!keepClear(x, z) || rainwardWaterNear(x, z)) continue;
      const Tr = terraceAt(x, z);
      const roll = rs(), ry = rs() * PI * 2;
      if (Tr && Tr.k > 0.2) {
        // on a step: only along its front (the foot of the wall above) and its ends, never on the beds or the drain
        const f = v - (Tr.B.v0 + Tr.r * Tr.B.d);
        if (f > 0.3 && f < 1.2 && roll < 0.5) put(pick('rgfernbank', 3), x, z, (rs() - 0.5) * 0.2, 0.7 + rs() * 0.3, 0.02);
        continue;
      }
      const gr = rainwardGround(x, z);
      if (gr.mud > 0.4) { if (roll < 0.12) put(pick('rgmud', 3), x, z, ry, 0.6 + rs() * 0.4, 0.1); continue; }
      if (gr.path > 0.5 || gr.cobble > 0.3) continue;
      const nearRiver = Math.abs(v) < riverHW(x) + 6, nearCliff = g > -8;
      if (nearRiver) { if (roll < 0.35) put(pick('rgfernbank', 3), x, z, (rs() - 0.5) * 0.4, 0.8 + rs() * 0.3, 0.02); else if (roll < 0.55) put(pick('rgrock', 4), x, z, ry, 0.9, 0.15); continue; }
      if (nearCliff) { if (roll < 0.4) put(pick('rgfern', 3), x, z, ry, 0.9 + rs() * 0.4, 0.02); else if (roll < 0.6) put(pick('rgrock', 4), x, z, ry, 1.1, 0.15); continue; }
      if (roll < 0.3) put(pick('rgtuft', 3), x, z, ry, 0.9 + rs() * 0.4, 0.02);
      else if (roll < 0.42) put(pick('rgfern', 3), x, z, ry, 0.8 + rs() * 0.4, 0.02);
      else if (roll < 0.47) put(pick('rgrock', 4), x, z, ry, 0.8);
    }
  }
  function rainwardWaterNear(x, z) { return Math.abs(vOf(x, z)) < riverHW(x) + 0.8; }

  // ---------------------------------------------------------------- dripping rock: drops falling off the cliff feet
  {
    const spots = [];
    for (let x = R.minX + 20; x < R.east; x += 9) { const v = northFoot(x) + 1.5, z = zOfV(x + (rng() - 0.5) * 4, v); spots.push([x, rainwardHeight(x, z) + 2.5 + rng() * 3, z, rainwardHeight(x, zOfV(x, v - 2))]); }
    for (const Ad of W.rainwardAdits) spots.push([Ad.x - 1, Ad.y + 3.2, Ad.z + 0.6, Ad.y], [Ad.x + 1.2, Ad.y + 3.2, Ad.z + 0.6, Ad.y]);
    const N = 4, pos = new Float32Array(spots.length * N * 3), geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: '#cfe0e6', size: 0.14, transparent: true, opacity: 0.85, depthWrite: false });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.name = 'rainwardDrips';
    markDynamic(pts); W.rainwardGroup.add(pts); runtime.push(pts);
    W.rainwardDrips = { pts, spots, N, pos };
  }

  // ---------------------------------------------------------------- low cloud along the walls
  {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const x = cv.getContext('2d'), r2 = mulberry32(1700);
    for (let i = 0; i < 16; i++) { const cx = 40 + r2() * 176, cy = 44 + r2() * 40, rr = 22 + r2() * 30, g = x.createRadialGradient(cx, cy, 0, cx, cy, rr); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 128); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const clouds = [];
    for (let i = 0; i < 22; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, color: '#d4dad6', transparent: true, opacity: 0.4, depthWrite: false, fog: true });
      const s = new THREE.Sprite(mat), along = R.minX + 10 + (i / 22) * (R.east - R.minX), north = i % 2 === 0;
      const v = north ? northFoot(along) + 14 + r2() * 10 : -(riverHW(along) + 22 + r2() * 10);
      const base = riverLevel(along) + 22 + r2() * 14;
      s.scale.set(46 + r2() * 30, 16 + r2() * 8, 1);
      s.position.set(along, base, zOfV(along, v));
      s.renderOrder = 4; s.name = 'rainwardCloud';
      markDynamic(s); W.rainwardGroup.add(s); runtime.push(s);
      clouds.push({ s, x0: along, y0: base, sp: 0.6 + r2() * 0.8, ph: r2() * 100 });
    }
    W.rainwardClouds = clouds;
  }

  // ---------------------------------------------------------------- the rain
  // the slips run down their lanes while it pours hard, the cloud thickens and comes down the walls, the falls' mist and the
  // drips quicken, the lane wheels turn faster with the water (all from rainLevel(): the shared world clock)
  {
    const slipK = (lvl) => Math.max(0, Math.min(1, (lvl - R.rain.slip) / (1 - R.rain.slip)));
    W.rainwardTick = (dt, t) => {
      const lvl = rainLevel(), run = slipK(lvl);
      for (const m of W.rainwardSlips) { m.material.uniforms.uRun.value = run; m.visible = run > 0.01; }
      for (const c of W.rainwardClouds) { c.s.material.opacity = 0.32 + 0.4 * lvl; c.s.position.y = c.y0 - 7 * lvl; c.s.position.x = c.x0 + Math.sin(t * 0.01 * c.sp + c.ph) * 8; }
      for (const Wh of W.rainwardWheels) { Wh.a += dt * (0.7 + 2.2 * lvl); Wh.g.rotation.x = Wh.a; }
      for (const f of W.rainwardFalls) if (f.userData.ribbon) f.userData.ribbon.material.opacity = 1;
      const D = W.rainwardDrips, sp = 1 + lvl * 1.5;
      for (let i = 0; i < D.spots.length; i++) {
        const [x, y, z, gy] = D.spots[i], drop = Math.max(0.5, y - gy);
        for (let k = 0; k < D.N; k++) { const p = ((t * 0.55 * sp + k / D.N + i * 0.137) % 1), j = (i * D.N + k) * 3; D.pos[j] = x + (k - 1.5) * 0.25; D.pos[j + 1] = y - p * p * drop; D.pos[j + 2] = z + (k % 2) * 0.2; }
      }
      D.pts.geometry.attributes.position.needsUpdate = true;
    };
    W.rainwardTick(0, 0);
  }
}

// a slip of running mud down a lane: a ribbon over the ground (the lane's width), its s attribute 0 at the top .. 1 at the
// foot; the mud's front runs down as uRun climbs (0 none .. 1 the whole lane running), the mud flowing downhill in streaks
function slipRibbon(L, li) {
  const pos = [], su = [], idx = [];
  const P = L.pts, segs = [];
  let tot = 0; for (let i = 0; i < P.length - 1; i++) { const l = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); segs.push(l); tot += l; }
  let run = 0, prev = -1;
  for (let i = 0; i < P.length - 1; i++) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1], l = segs[i], n = Math.ceil(l / 1.5), nx = -(bz - az) / l, nz = (bx - ax) / l;
    for (let k = i ? 1 : 0; k <= n; k++) {
      const t = k / n, cx = ax + (bx - ax) * t, cz = az + (bz - az) * t, s = (run + l * t) / tot, base = pos.length / 3;
      for (let j = 0; j <= 6; j++) { const u = j / 6 * 2 - 1, x = cx + nx * u * L.hw, z = cz + nz * u * L.hw; pos.push(x, rainwardHeight(x, z) + 0.14, z); su.push(s, u); }
      if (prev >= 0) for (let j = 0; j < 6; j++) { const a = prev + j, c = base + j; idx.push(a, a + 1, c, c, a + 1, c + 1); }
      prev = base;
    }
    run += l;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aSU', new THREE.Float32BufferAttribute(su, 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uRun: { value: 0 }, uSeed: { value: li * 13.7 } }]),
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute vec2 aSU; varying vec2 vSU; varying vec3 vW;
      void main() { vSU = aSU; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime, uRun, uNight, uSeed; varying vec2 vSU; varying vec3 vW;
      float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h1(i), h1(i + vec2(1.0, 0.0)), f.x), mix(h1(i + vec2(0.0, 1.0)), h1(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main() {
        float front = 0.15 + uRun * 0.9;
        if (vSU.x > front) discard;
        float edge = 1.0 - smoothstep(0.5, 1.0, abs(vSU.y) + (n2(vec2(vW.z * 0.4, uSeed)) - 0.5) * 0.3);
        float flow = n2(vec2(vSU.y * 3.0 + uSeed, vW.z * 0.5 - uTime * 2.4)) * 0.6 + n2(vec2(vSU.y * 8.0, vW.z * 1.6 - uTime * 3.6)) * 0.4;
        vec3 c = mix(vec3(0.17, 0.085, 0.045), vec3(0.38, 0.2, 0.11), flow * flow) * (1.0 - 0.6 * uNight);
        c += vec3(0.1, 0.09, 0.08) * smoothstep(0.82, 0.95, flow); // (a wet sheen on the running mud)
        float a = edge * smoothstep(0.0, 0.15, uRun) * 0.9 * (1.0 - 0.6 * smoothstep(front - 0.05, front, vSU.x));
        gl_FragColor = vec4(c, a);
        #include <fog_fragment>
      }`,
  });
  mat.uniforms.uTime = G.time; mat.uniforms.uNight = G.night;
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 2; m.name = 'rainwardSlip'; m.visible = false; m.frustumCulled = false;
  markDynamic(m);
  return m;
}
