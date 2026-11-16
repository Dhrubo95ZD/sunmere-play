// Tidewater Sound (Part Thirteen): the inlet's dressing, built into the world's tidewaterGroup (World.buildTidewater).
//   the timber quay at the head of the Sound and the ice-bow ship at its berth (it rides up and down on the tide) · the
//   Tidewrights' camp (tarred timber huts with flat roofs round a worked square, a fire, rope hanks drying on rails) · the tar
//   yards (open square tar pans over brick hearths, tar barrels lying in rows, a tarring trough) · the Makers' ropewalk (a
//   long open shed along the shore, strands laid out its length on square stake frames, the jack at one end and the traveller
//   at the other) · the Tide Mills (square stone mill houses with flat roofs, each with a solid undershot wheel in its creek
//   that turns while the tide runs and stops at slack water, the frame saw and its log bed, the sluice of the square log pond
//   above, logs floating in it, timber stacked parallel) · the mud flats (stranded logs, old channel posts, a sunk scow) · the
//   Sea Gate (a barrage of square stone piers across the mouth, its gates hung half open and one jammed, the crest walk out to
//   the jammed bay, square flat-roofed gatehouses at both ends) · the Makers' planted rows on the headland and the south
//   ridge (straight rows of timber, dead grey poles where the salt has reached them) · the square tide-mark tower · tide
//   gauges at the quay and the gate · the tide itself: the sea sheet rises and falls with tideLevel() every frame
// Content rules: no domes, arches, spires, crosses, stars, sunbursts or spoked wheels. Every roof is flat; every opening is
// square with a flat lintel; the mill wheels are solid discs; timber lies parallel (never criss-crossed); trestles and saw
// frames have straight legs; rope lies in straight hanks or coils on their sides (never a ring from above); no animals on
// the shore; checked from straight above and from the sea.
import * as THREE from 'three';
import * as P from '../assets/props.js';
import { Builder, box, rbox, cyl, lumpy, sphere, ico } from '../assets/kit.js';
import { addRock, addTuft, pine, bush } from '../assets/trees.js';
import { buildSteamship } from '../assets/steamship.js';
import { createSea } from '../engine/water.js';
import { TIDEWATER, tidewaterHeight, tidewaterShore, tidewaterPathDist, tidewaterZone, tidewaterCreek, tidewaterGap, tideLevel, soundNorthZ, soundSouthZ, soundAxisZ, saltK, rowsK, foreW, tidewaterGround, SHINGLE } from '/sunmere-play/shared/tidewater.js';
import { NPCS, NODES, OBJECTS } from '/sunmere-play/shared/data.js';
import { mulberry32 } from '/sunmere-play/shared/noise.js';
import { DUNGEONS } from '/sunmere-play/shared/dungeons.js';
import { markDynamic } from './freeze.js';
import { stoneBlock, stoneBench, sacks } from './reachLayout.js';
import { texTint, shade } from '../assets/houses/parts.js';

const PI = Math.PI;
const ST = '#9a9890', ST_D = '#64625c', ST_L = '#bab6aa', TAR = '#2e2a26', TAR_L = '#4a423a', PLANK = '#6e5a44', IRON = '#34363a', BRICK = '#5e534a';
const res = (b, extra = {}) => ({ builder: b, fires: [], glows: [], lanterns: [], smokes: [], colliders: [], ...extra });
const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _q = new THREE.Quaternion();
function beam(b, a, c, w, mat = 'beam', col = 0xffffff) {
  _d.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const L = _d.length(); _q.setFromUnitVectors(_up, _d.normalize());
  b.add(box(w, L, w), mat, { p: [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2], q: _q.clone(), c: col });
}
// a rope strand from a to c (local), round and thin
function strand(b, a, c, r = 0.05, col = '#8a7656') {
  _d.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const L = _d.length(); _q.setFromUnitVectors(_up, _d.normalize());
  b.add(cyl(r, r, L, 6), 'cloth', { p: [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2], q: _q.clone(), c: col });
}

// ------------------------------------------------------------------ small kit (local: front faces +z, ground at y 0)
// a Tidewright hut: a low stone plinth, a frame of square posts, tarred plank walls, a flat roof of tarred boards with a deep
// eave, a plank door in the front, square shuttered windows on the sides, a square iron stack
export function hut(seed, w = 5.4, d = 4.2, h = 2.9) {
  const b = new Builder(seed);
  b.add(box(w + 0.3, 0.9, d + 0.3), 'stoneDark', { p: [0, -0.15, 0], c: ST_D });
  b.add(box(w, h, d), 'woodDark', { p: [0, h / 2 + 0.25, 0], c: TAR_L, us: 0.6 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.26, h + 0.1, 0.26), 'beam', { p: [sx * (w / 2 + 0.02), h / 2 + 0.3, sz * (d / 2 + 0.02)], c: '#6a5a48' });
  for (const sz of [-1, 1]) b.add(box(w + 0.1, 0.2, 0.2), 'beam', { p: [0, h + 0.2, sz * (d / 2 + 0.03)], c: '#6a5a48' });
  b.add(box(w + 0.9, 0.16, d + 1.1), 'woodDark', { p: [0, h + 0.4, 0.15], c: TAR });
  b.add(box(w + 0.95, 0.24, 0.12), 'woodDark', { p: [0, h + 0.32, d / 2 + 0.7], c: '#3a3430' }); // fascia
  // the door and its frame (square, a flat lintel), a step
  b.add(box(1.3, 2.25, 0.12), 'beam', { p: [0, 1.38, d / 2 + 0.04], c: '#5a4a3a' });
  b.add(box(1.05, 2.05, 0.1), 'wood', { p: [0, 1.3, d / 2 + 0.08], c: PLANK });
  b.add(box(0.5, 0.06, 0.04), 'wIron', { p: [0.2, 1.3, d / 2 + 0.15], c: IRON });
  b.add(box(1.6, 0.18, 0.8), 'stoneLarge', { p: [0, 0.2, d / 2 + 0.45], c: ST_L });
  // a window in each side wall (one, never a pair), its shutter half closed
  for (const sx of [-1, 1]) {
    b.add(box(0.12, 0.9, 0.9), 'beam', { p: [sx * (w / 2 + 0.04), 1.9, -0.3], c: '#5a4a3a' });
    b.add(box(0.06, 0.7, 0.7), 'glassWarm', { p: [sx * (w / 2 + 0.08), 1.9, -0.3] });
    b.add(box(0.08, 0.78, 0.4), 'wood', { p: [sx * (w / 2 + 0.12), 1.9, -0.52], c: PLANK });
  }
  // the square iron stack at the back, and a square plank water box
  b.add(box(0.42, 1.3, 0.42), 'wIron', { p: [w / 2 - 0.8, h + 1.0, -d / 2 + 0.7], c: IRON });
  b.add(box(0.6, 0.1, 0.6), 'wIron', { p: [w / 2 - 0.8, h + 1.68, -d / 2 + 0.7], c: '#2a2c30' });
  b.add(box(0.9, 0.8, 0.9), 'woodDark', { p: [-w / 2 - 0.1, 0.65, -d / 2 + 0.2], c: TAR_L });
  return res(b, { smokes: [{ p: [w / 2 - 0.8, h + 1.9, -d / 2 + 0.7], opts: { rate: 1.6, life: 4.5, size: 1.0, rise: 1.4, color: 0x8a8682, opacity: 0.32, spread: 0.25 } }], colliders: [{ x: 0, z: 0, hw: w / 2 + 0.25, hd: d / 2 + 0.25 }] });
}
// (dressing pass) a Tidewright house in the v111/v112 look: a pale stone plinth band, cream plaster walls in a dark timber
// frame (corner posts, sill and wall plate, upright studs: no braces, nothing diagonal or crossing) or sooty stone with dark
// tarred corner posts, a gabled roof of straw thatch (with a rolled straw lip along the eaves) or of flat clay/slate tiles
// (with deep eaves, a fascia board and barge boards), the gable triangles with a tie beam, a small square slatted vent and
// an upright stud each side, a square stone chimney stack with one square pot on the ridge, a plank door under a flat
// lintel, square windows with light frames, sills and a shutter each side. Local: front (the door) faces +z, ground y 0.
// o: { w, d, h (wall top), roof 'thatch' | 'tile', tile (colour), wall 'plaster' | 'stone', pitch, ridgeZ (the ridge runs
// along z, the gables front and back), door (offset of the door along the front, or null for none), chimney (-1 | 0 | 1:
// which end of the ridge), wins { front, back, left, right: offsets along each face, seen from outside } }
const HW = '#4a3220', HSTONE = '#d4ccbe', HTHATCH = '#96723f', HPLASTER = ['#ece2d2', '#e8dccb', '#e4d8c6'];
function gablePrism(base, rise, t) {
  const sh = new THREE.Shape(); sh.moveTo(-base / 2, 0); sh.lineTo(base / 2, 0); sh.lineTo(0, rise); sh.lineTo(-base / 2, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false }); g.translate(0, 0, -t / 2); return g;
}
export function yardHouse(seed, o = {}) {
  const b = new Builder(seed);
  const w = o.w ?? 6, d = o.d ?? 4.6, h = o.h ?? 3.1, thatch = o.roof === 'thatch', stone = o.wall === 'stone', rz = !!o.ridgeZ;
  const pitch = o.pitch ?? (thatch ? 0.78 : 0.62), th = thatch ? 0.44 : 0.16, over = thatch ? 0.58 : 0.52, verge = thatch ? 0.48 : 0.42;
  const wallC = stone ? (o.stoneC || '#8e8a82') : texTint('plaster', HPLASTER[seed % 3]), frameC = stone ? '#2e241c' : HW, winC = stone ? '#e2d6bc' : shade(HW, 1.15);
  const roofMat = thatch ? 'thatch' : 'shingleWood', roofC = thatch ? texTint('thatch', HTHATCH) : texTint('shingleWood', o.tile || '#5a5652');
  // the plinth band and the walls
  b.add(box(w + 0.18, 1.75, d + 0.18), 'stoneLarge', { p: [0, -0.325, 0], c: HSTONE }); // (deep enough for a sloping site)
  b.add(box(w, h - 0.55, d), stone ? 'stone' : 'plaster', { p: [0, 0.55 + (h - 0.55) / 2, 0], c: wallC, us: stone ? 0.45 : 1 });
  // faces: (along offset t, height y, out from the wall) -> position and turn, seen from outside, t to the right
  const faces = {
    front: { L: w, f: (t, y, out) => [t, y, d / 2 + out], ry: 0 },
    back: { L: w, f: (t, y, out) => [-t, y, -d / 2 - out], ry: PI },
    right: { L: d, f: (t, y, out) => [w / 2 + out, y, -t], ry: PI / 2 },
    left: { L: d, f: (t, y, out) => [-w / 2 - out, y, t], ry: -PI / 2 },
  };
  const fb = (F, t, y, out, sw, sh, sd, mat, c) => b.add(box(sw, sh, sd), mat, { p: F.f(t, y, out), r: [0, F.ry, 0], c });
  const gableFaces = rz ? ['front', 'back'] : ['left', 'right'];
  const opens = { front: [], back: [], left: [], right: [] };
  // the door (square, a flat lintel), its frame and a stone step
  if (o.door !== null) {
    const F = faces.front, t = o.door ?? 0;
    fb(F, t, 1.2, 0.03, 1.36, 2.4, 0.1, 'beam', frameC);
    fb(F, t, 1.13, 0.07, 1.06, 2.16, 0.08, 'wood', PLANK);
    fb(F, t, 2.46, 0.08, 1.7, 0.2, 0.16, 'beam', frameC);
    fb(F, t + 0.3, 1.15, 0.13, 0.08, 0.06, 0.05, 'wIron', IRON);
    b.add(box(1.7, 0.2, 0.8), 'stoneLarge', { p: [t, 0.4, d / 2 + 0.45], c: HSTONE });
    opens.front.push([t, 0.85]);
  }
  // windows: a light frame, the glass (dark by day, lit at dusk: game.js), a stone sill, a shutter each side
  const wins = o.wins || { front: o.door === null ? [0] : [(o.door ?? 0) > 0 ? -w / 4 - 0.2 : w / 4 + 0.2], back: [w > 6.5 ? -w / 4 : 0], left: [0], right: [0] };
  const wy = Math.min(1.75, h - 1.05);
  for (const [k, list] of Object.entries(wins)) for (const t of list || []) {
    const F = faces[k];
    fb(F, t, wy, 0.03, 1.0, 1.1, 0.1, stone ? 'woodLight' : 'beam', winC);
    fb(F, t, wy, 0.06, 0.78, 0.88, 0.06, 'glassWarm');
    fb(F, t, wy - 0.62, 0.1, 1.2, 0.12, 0.2, 'stoneLarge', HSTONE);
    if (stone) fb(F, t, wy + 0.62, 0.06, 1.2, 0.16, 0.14, 'stoneLarge', HSTONE);
    else for (const s of [-1, 1]) fb(F, t + s * 0.78, wy, 0.1, 0.48, 1.06, 0.05, 'wood', o.shutC || '#56604e');
    opens[k].push([t, 0.75]);
  }
  // the frame: corner posts, sill beam and wall plate round all four faces, upright studs between the openings (plaster);
  // dark tarred corner posts only on stone
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.26, h - 0.4, 0.26), 'beam', { p: [sx * (w / 2 + 0.01), 0.45 + (h - 0.4) / 2, sz * (d / 2 + 0.01)], c: frameC });
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
  // the roof: two slabs from the eaves up to the ridge
  const span = rz ? w : d, len = rz ? d : w, half = span / 2, rise = half * Math.tan(pitch), hs = half + over, sl = hs / Math.cos(pitch);
  const yR = h + rise, yE = h - over * Math.tan(pitch), lift = th / 2 / Math.cos(pitch);
  for (const s of [-1, 1]) {
    const c = s * hs / 2, y = (yR + yE) / 2 + lift;
    if (!rz) b.add(box(len + verge * 2, th, sl), roofMat, { p: [0, y, c], r: [s * pitch, 0, 0], c: roofC, uv: 'box', us: thatch ? 0.32 : 0.42 });
    else b.add(box(sl, th, len + verge * 2), roofMat, { p: [c, y, 0], r: [0, 0, -s * pitch], c: roofC, uv: 'box', us: thatch ? 0.32 : 0.42 });
    // the eave: a rolled straw lip (thatch) or a deep fascia board (tiles)
    const ex = s * (hs - 0.05), ey = yE + 0.02;
    if (thatch) b.add(cyl(0.27, 0.27, len + verge * 2 + 0.2, 10), 'thatch', { p: rz ? [ex, ey, 0] : [0, ey, ex], r: rz ? [PI / 2, 0, 0] : [0, 0, PI / 2], c: shade(roofC, 0.92) });
    else b.add(box(rz ? 0.06 : len + verge * 2, th + 0.22, rz ? len + verge * 2 : 0.06), 'woodDark', { p: rz ? [ex + s * 0.03, ey - 0.06, 0] : [0, ey - 0.06, ex + s * 0.03], c: frameC });
  }
  // the ridge cap
  b.add(box(rz ? (thatch ? 0.42 : 0.26) : len + verge * 2, thatch ? 0.26 : 0.14, rz ? len + verge * 2 : (thatch ? 0.42 : 0.26)), thatch ? 'thatch' : 'shingleWood', { p: [0, yR + th / Math.cos(pitch) - 0.02, 0], c: shade(roofC, thatch ? 0.8 : 0.72) });
  // the gables: the triangle walls, barge boards up both verges, a tie beam, the vent and two studs
  for (const k of gableFaces) {
    const F = faces[k], sg = k === 'front' || k === 'right' ? 1 : -1;
    const g = gablePrism(span, rise, 0.2);
    b.add(g, stone ? 'stone' : 'plaster', { p: rz ? [0, h, sg * (d / 2 - 0.1)] : [sg * (w / 2 - 0.1), h, 0], r: [0, rz ? 0 : PI / 2, 0], c: wallC, uv: 'box', us: stone ? 0.45 : 1 });
    fb(F, 0, h + 0.04, 0.05, span, 0.2, 0.12, 'beam', frameC);
    const vy = h + rise * 0.55, vs = 0.26;
    if (rise > 1.1) {
      fb(F, 0, vy, 0.05, vs * 2, vs * 2, 0.06, 'beam', frameC);
      fb(F, 0, vy, 0.085, vs * 2 - 0.12, vs * 2 - 0.12, 0.01, 'beam', '#1e1812');
      for (let i = 0; i < 3; i++) fb(F, 0, vy - vs + 0.13 + i * 0.13, 0.1, vs * 2 - 0.12, 0.05, 0.04, 'beam', shade(frameC, 1.25));
      for (const s of [-1, 1]) { const t = s * (vs + 0.55), top = h + rise * (1 - Math.abs(t) / half) - 0.06; if (top - h > 0.5) fb(F, t, (h + 0.14 + top) / 2, 0.05, 0.14, top - h - 0.14, 0.06, 'beam', frameC); }
    }
    if (!thatch) for (const s of [-1, 1]) { // the barge boards, sloped along each verge
      const t0 = s * (half + over), y0 = yE - 0.04, t1 = 0, y1 = yR - 0.04, P0 = F.f(t0, y0, verge - 0.02), P1 = F.f(t1, y1, verge - 0.02);
      beam(b, P0, P1, 0.07, 'beam', frameC);
    }
  }
  // the square chimney stack on the ridge (stone, a band, a cap slab and one square pot)
  const smokes = [];
  if (o.chimney) {
    const a = o.chimney * len * 0.3, cw = 0.6, top = yR + th + 0.9, p = (y) => (rz ? [0, y, a] : [a, y, 0]);
    b.add(box(cw, top - (yR - 0.6), cw), 'stoneDark', { p: p((top + yR - 0.6) / 2), c: shade(HSTONE, 0.8) });
    b.add(box(cw + 0.08, 0.1, cw + 0.08), 'stoneLarge', { p: p(top - 0.3), c: shade(HSTONE, 1.0) });
    b.add(box(cw + 0.16, 0.12, cw + 0.16), 'stoneLarge', { p: p(top + 0.06), c: shade(HSTONE, 1.04) });
    b.add(box(0.24, 0.34, 0.24), 'stone', { p: p(top + 0.29), c: '#b87a58' });
    smokes.push({ p: p(top + 0.6), opts: { rate: 1.4, life: 4.5, size: 1.0, rise: 1.4, color: 0x8a8682, opacity: 0.3, spread: 0.25 } });
  }
  return res(b, { smokes, colliders: [{ x: 0, z: 0, hw: w / 2 + 0.15, hd: d / 2 + 0.15 }] });
}
// a hank of rope laid flat: straight lengths side by side (never a flat coil, which reads as a ring from above)
function hank(b, x, y, z, ry = 0, len = 1.1, n = 3, col = '#8a7656') {
  const c = Math.cos(ry), s = Math.sin(ry);
  for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * 0.13; b.add(cyl(0.06, 0.06, len, 6), 'cloth', { p: [x - s * o, y + 0.06, z + c * o], r: [0, ry, PI / 2], order: 'YXZ', c: col }); }
}
// a square bin of rope hanks
function ropeBin(seed) {
  const b = new Builder(seed);
  for (const sx of [-1, 1]) b.add(box(0.1, 0.7, 1.4), 'wood', { p: [sx * 0.7, 0.35, 0], c: PLANK });
  for (const sz of [-1, 1]) b.add(box(1.5, 0.7, 0.1), 'wood', { p: [0, 0.35, sz * 0.7], c: PLANK });
  b.add(box(1.4, 0.08, 1.4), 'wood', { p: [0, 0.04, 0], c: '#5a4a3a' });
  for (let k = 0; k < 3; k++) hank(b, 0, 0.18 + k * 0.13, b.r(-0.1, 0.1), b.r(-0.08, 0.08), 1.15, 4, k % 2 ? '#7e6a4e' : '#5a4c3a');
  return res(b, { collider: { r: 0.9 } });
}
// tar barrels in a square rack (dressing pass): a timber frame of square posts and straight rails with solid plank end
// boards, the barrels lying across it in one or two tiers, their ends hidden behind the boards (a barrel end seen from the
// side read as a disc in a hoop); the iron hoops are flush bands round the staves, set in from the ends
function barrelRow(seed, n = 5, tiers = 1) {
  const b = new Builder(seed), L = n * 0.9 + 0.3, H = tiers * 0.82 + 0.2, F = '#4a3c30';
  for (const sz of [-1, 1]) {
    b.add(box(L + 0.36, H, 0.1), 'woodDark', { p: [0, H / 2, sz * 0.62], c: '#3a302a' }); // the end boards
    for (const sx of [-1, 1]) b.add(box(0.18, H + 0.12, 0.18), 'beam', { p: [sx * (L / 2 + 0.1), (H + 0.12) / 2, sz * 0.62], c: F });
    b.add(box(L + 0.56, 0.14, 0.2), 'beam', { p: [0, H + 0.12, sz * 0.62], c: F });
  }
  for (const sx of [-1, 1]) b.add(box(0.16, 0.14, 1.4), 'beam', { p: [sx * (L / 2 + 0.1), H + 0.12, 0], c: F });
  for (const sz of [-0.3, 0.3]) b.add(box(L, 0.14, 0.14), 'beam', { p: [0, 0.1, sz], c: F });
  for (let t = 0; t < tiers; t++) for (let i = 0; i < n - (t ? 1 : 0); i++) {
    const x = (i - (n - 1 - (t ? 1 : 0)) / 2) * 0.9, y = 0.55 + t * 0.78;
    b.add(cyl(0.37, 0.37, 1.1, 14), 'woodDark', { p: [x, y, 0], r: [PI / 2, 0, 0], c: b.r() < 0.5 ? '#2c2824' : '#34302a' });
    for (const zz of [-0.24, 0.24]) b.add(cyl(0.374, 0.374, 0.07, 14), 'wIron', { p: [x, y, zz], r: [PI / 2, 0, 0], c: '#2a2a2c' });
  }
  return res(b, { colliders: [{ x: 0, z: 0, hw: L / 2 + 0.2, hd: 0.72 }] });
}
// a stack of crates with a hank of rope (the valley's crate stack carries an upright hooped barrel, a disc in a ring from
// above; none here)
function yardCrates(seed) {
  const b = new Builder(seed);
  const cr = (x, y, z, s, r) => { b.add(box(0.7 * s, 0.7 * s, 0.7 * s), 'woodLight', { p: [x, y + 0.35 * s, z], r: [0, r, 0], us: 1.2 }); for (const sy of [-1, 1]) b.add(box(0.74 * s, 0.07 * s, 0.74 * s), 'woodDark', { p: [x, y + 0.35 * s + sy * 0.33 * s, z], r: [0, r, 0] }); };
  cr(0, 0, 0, 1, 0.1); cr(0.78, 0, 0.08, 0.9, -0.1); cr(0.32, 0.7, 0.04, 0.8, 0.15); cr(-0.75, 0, -0.1, 0.85, 0.05);
  hank(b, 0.1, 0, 0.85, 0, 1.0, 3);
  return res(b, { collider: { r: 1.1 } });
}
// a straight-legged saw horse: a squared beam on four upright legs with a foot rail each end, a board across it
function sawHorse(seed) {
  const b = new Builder(seed);
  b.add(box(1.6, 0.16, 0.2), 'beam', { p: [0, 0.82, 0], c: '#6a5a48' });
  for (const sx of [-0.65, 0.65]) { for (const sz of [-0.22, 0.22]) b.add(box(0.1, 0.8, 0.1), 'beam', { p: [sx, 0.4, sz], c: '#5a4a3a' }); b.add(box(0.1, 0.08, 0.54), 'beam', { p: [sx, 0.18, 0], c: '#5a4a3a' }); }
  b.add(box(2.4, 0.06, 0.32), 'wood', { p: [b.r(-0.2, 0.2), 0.93, 0], c: '#a6865e' });
  return res(b, { collider: { r: 0.9 } });
}
// a workbench on straight legs, a few tools laid side by side on it (all one way, never crossed), a square tar bucket
function workBench(seed) {
  const b = new Builder(seed);
  b.add(box(2.2, 0.1, 0.8), 'wood', { p: [0, 0.9, 0], c: '#8a6e52' });
  for (const sx of [-0.95, 0.95]) for (const sz of [-0.3, 0.3]) b.add(box(0.12, 0.88, 0.12), 'beam', { p: [sx, 0.44, sz], c: '#5a4a3a' });
  b.add(box(2.0, 0.06, 0.6), 'wood', { p: [0, 0.25, 0], c: '#6e5a44' });
  for (let i = 0; i < 3; i++) b.add(box(0.7 + i * 0.1, 0.04, 0.05), i ? 'wIron' : 'beam', { p: [-0.4 + b.r(-0.05, 0.05), 0.97, -0.15 + i * 0.13], c: i ? IRON : '#6a5a48' });
  b.add(box(0.36, 0.34, 0.36), 'woodDark', { p: [0.7, 1.12, 0.1], c: '#3a302a' });
  b.add(box(0.3, 0.02, 0.3), 'wDark', { p: [0.7, 1.28, 0.1], c: '#0e0c0a' });
  hank(b, 0.6, 0.25, 0, 0, 0.8, 3, '#5a4c3a');
  return res(b, { collider: { r: 1.2 } });
}
// hemp yarn in square bales, bound with two straight bands, stacked two high
function yarnBales(seed, n = 3) {
  const b = new Builder(seed);
  for (let i = 0; i < n; i++) for (let t = 0; t < (i < n - 1 ? 2 : 1); t++) {
    const x = (i - (n - 1) / 2) * 1.05, y = 0.32 + t * 0.62;
    b.add(box(0.95, 0.6, 0.75), 'straw', { p: [x + b.r(-0.04, 0.04), y, b.r(-0.05, 0.05)], c: b.r() < 0.5 ? '#c8b080' : '#b8a070' });
    for (const bx2 of [-0.25, 0.25]) b.add(box(0.06, 0.62, 0.78), 'cloth', { p: [x + bx2, y, 0], c: '#5a4c3a' });
  }
  return res(b, { collider: { r: 1.1 + n * 0.25 } });
}
// a timber rack: square uprights with sawn poles laid along their arms (all one way)
function poleRack(seed, L = 5) {
  const b = new Builder(seed);
  for (const sx of [-L / 2 + 0.3, 0, L / 2 - 0.3]) { b.add(box(0.2, 2.0, 0.2), 'beam', { p: [sx, 1.0, 0], c: '#5a4a3a' }); for (const y of [0.7, 1.4]) b.add(box(0.14, 0.12, 0.9), 'beam', { p: [sx, y, 0.35], c: '#5a4a3a' }); }
  for (const y of [0.7, 1.4]) for (let i = 0; i < 4; i++) b.add(cyl(0.07, 0.07, L + b.r(-0.3, 0.2), 6), 'wood', { p: [b.r(-0.1, 0.1), y + 0.13, 0.12 + i * 0.17], r: [0, 0, PI / 2], c: '#a6865e' });
  return res(b, { colliders: [{ x: 0, z: 0.3, hw: L / 2, hd: 0.55 }] });
}
// a dark wrack of dried weed and drift laid by the tide: low flat lumps strung out along the line (local x)
function wrackPatch(seed) {
  const b = new Builder(seed);
  for (let i = 0; i < 5; i++) b.add(lumpy(sphere(0.5, 8, 4), 0.25, 2.2, seed + i, { flatBottom: 0 }), 'dirtPlain', { p: [-2 + i + b.r(-0.3, 0.3), -0.02, b.r(-0.25, 0.25)], s: [b.r(1.1, 1.8), 0.16, b.r(0.4, 0.7)], c: b.r() < 0.5 ? '#3a3a2a' : '#4a4232', uv: 'box' });
  b.add(cyl(0.05, 0.06, b.r(1.0, 1.6), 5), 'barkDark', { p: [b.r(-1, 1), 0.05, b.r(-0.2, 0.2)], r: [0, 0, PI / 2], c: '#b8b2a8' });
  return { builder: b };
}
// an open tar pan: a square brick hearth with a fire door, a square iron pan of tar on top, a ladle board across one corner
function tarPan(seed) {
  const b = new Builder(seed);
  b.add(box(2.0, 1.0, 2.0), 'stoneDark', { p: [0, 0.4, 0], c: BRICK, us: 0.6 });
  b.add(box(2.2, 0.14, 2.2), 'stoneLarge', { p: [0, 0.95, 0], c: '#6e665e' });
  b.add(box(0.7, 0.5, 0.06), 'wIron', { p: [0, 0.4, 1.02], c: '#1e1e20' });
  b.add(box(0.5, 0.3, 0.04), 'molten', { p: [0, 0.36, 1.0] });
  b.add(box(1.7, 0.5, 1.7), 'wIron', { p: [0, 1.25, 0], c: '#2a2a2c' });
  b.add(box(1.5, 0.06, 1.5), 'wDark', { p: [0, 1.48, 0], c: '#0e0c0a' }); // the tar surface, black and glossy
  b.add(box(1.5, 0.08, 0.2), 'wood', { p: [0.1, 1.54, -0.55], r: [0, 0.15, 0], c: PLANK });
  return res(b, { smokes: [{ p: [0, 1.7, 0], opts: { rate: 2.4, life: 5, size: 1.4, rise: 1.2, color: 0x3a3634, opacity: 0.38, spread: 0.6 } }], glows: [{ p: [0, 0.4, 1.1], color: 0xff8030, size: 1.6, intensity: 0.5 }], colliders: [{ x: 0, z: 0, hw: 1.15, hd: 1.15 }] });
}
// a long tarring trough on straight-legged trestles: the rope is drawn through hot tar along it
function tarTrough(seed, L = 7) {
  const b = new Builder(seed);
  b.add(box(L, 0.5, 0.8), 'wIron', { p: [0, 0.95, 0], c: '#2a2a2c' });
  b.add(box(L - 0.2, 0.04, 0.6), 'wDark', { p: [0, 1.19, 0], c: '#0e0c0a' });
  for (let x = -L / 2 + 0.5; x <= L / 2 - 0.4; x += (L - 1) / 3) for (const sz of [-0.3, 0.3]) b.add(box(0.16, 0.8, 0.16), 'beam', { p: [x, 0.4, sz], c: '#4a3c30' });
  strand(b, [-L / 2 - 1.5, 1.35, 0], [L / 2 + 1.5, 1.35, 0], 0.05, '#2a2420');
  return res(b, { colliders: [{ x: 0, z: 0, hw: L / 2, hd: 0.45 }] });
}
// a rack of rope hanks drying: two square posts and a rail (the hanks hang straight down from it as flat bundles)
// (dressing pass) square posts standing straight up on square stone footings, a top rail and a lower rail between them
// (level beams only: nothing diagonal, nothing crossing), the hanks hung over the top rail in pairs of straight lengths,
// a middle post on the long racks
function dryRack(seed, L = 4) {
  const b = new Builder(seed), posts = L > 4.6 ? [-L / 2, 0, L / 2] : [-L / 2, L / 2];
  for (const sx of posts) { b.add(box(0.22, 2.3, 0.22), 'beam', { p: [sx, 1.15, 0], c: '#5a4a3a' }); b.add(box(0.44, 0.22, 0.44), 'stoneLarge', { p: [sx, 0.08, 0], c: ST_L }); }
  b.add(box(L + 0.4, 0.16, 0.16), 'beam', { p: [0, 2.2, 0], c: '#5a4a3a' });
  b.add(box(L, 0.12, 0.12), 'beam', { p: [0, 0.62, 0], c: '#5a4a3a' });
  for (let x = -L / 2 + 0.45; x < L / 2 - 0.3; x += 0.5) {
    if (posts.some((p) => Math.abs(p - x) < 0.25)) continue;
    const len = b.r(1.0, 1.35), c = b.r() < 0.5 ? '#8a7656' : '#5a4c3a';
    for (const sz of [-0.07, 0.07]) b.add(box(0.13, len, 0.06), 'cloth', { p: [x, 2.2 - len / 2 + 0.05, sz], c });
  }
  return res(b, { colliders: posts.map((x) => ({ x, z: 0, r: 0.3 })) });
}
// timber stacked parallel: squared logs in layers all one way (no crossing sticks)
function timberStack(seed, L = 5, n = 4, rows = 3) {
  const b = new Builder(seed);
  for (let r = 0; r < rows; r++) for (let i = 0; i < n - r; i++) b.add(box(L + b.r(-0.3, 0.3), 0.42, 0.42), 'beam', { p: [b.r(-0.1, 0.1), 0.22 + r * 0.43, (i - (n - r - 1) / 2) * 0.46], c: '#8a6a48' });
  return res(b, { colliders: [{ x: 0, z: 0, hw: L / 2, hd: n * 0.24 }] });
}
// round logs stacked parallel in a low pile
function logPile(seed, L = 6, n = 5) {
  const b = new Builder(seed);
  for (let r = 0; r < 3; r++) for (let i = 0; i < n - r; i++) { const R = b.r(0.24, 0.32); b.add(cyl(R, R * 1.05, L + b.r(-0.4, 0.4), 10), 'bark', { p: [b.r(-0.15, 0.15), 0.3 + r * 0.5, (i - (n - r - 1) / 2) * 0.58], r: [0, 0, PI / 2], c: '#a08a70' }); }
  return res(b, { colliders: [{ x: 0, z: 0, hw: L / 2, hd: n * 0.3 }] });
}
// a sawn board stack: boards in layers, all one way
function boardStack(seed) {
  const b = new Builder(seed);
  for (let i = 0; i < 9; i++) b.add(box(4.2, 0.09, 1.5), 'wood', { p: [b.r(-0.05, 0.05), 0.12 + i * 0.1, 0], c: '#a6865e' });
  return res(b, { collider: { r: 1.5 } });
}
// a sawdust heap
function sawdust(seed) {
  const b = new Builder(seed);
  b.add(lumpy(sphere(1.2, 12, 6), 0.2, 1.6, seed, { flatBottom: 0 }), 'dirtPlain', { p: [0, -0.3, 0], s: [1.4, 0.5, 1.1], c: '#d8c49a', uv: 'box' });
  return res(b);
}
// a solid water wheel (axle along local x): a disc of planks behind straight iron straps, an iron tyre, paddle boards on its
// rim, a square hub block on a square axle
function waterWheel(seed, R = 2.4, thick = 0.7, nPad = 14) {
  const b = new Builder(seed);
  b.add(cyl(R, R, thick, 36), 'woodDark', { r: [0, 0, PI / 2], c: '#4e3c2c' });
  b.add(cyl(R + 0.07, R + 0.07, thick * 0.55, 36), 'wIron', { r: [0, 0, PI / 2], c: '#34363a' });
  for (const sx of [-1, 1]) for (const zz of [-R * 0.5, 0, R * 0.5]) { const half = Math.sqrt(Math.max(0, R * R - zz * zz)) * 0.96; b.add(box(0.06, half * 2, 0.18), 'wIron', { p: [sx * (thick / 2 + 0.02), 0, zz], c: '#2e3034' }); }
  for (let i = 0; i < nPad; i++) { const a = (i / nPad) * PI * 2, rr = R + 0.3; b.add(box(thick + 0.3, 0.65, 0.1), 'wood', { p: [0, Math.cos(a) * rr, Math.sin(a) * rr], r: [a, 0, 0], c: '#6e5640' }); }
  b.add(box(thick + 0.5, 0.7, 0.7), 'wIron', { c: '#3a3c40' });
  // the axle runs out of the hub on the mill's side only (+x), so from above wheel and axle make a T, never a cross
  b.add(box(thick + 3.2, 0.32, 0.32), 'wIron', { p: [(thick + 3.2) / 2 - thick / 2 - 0.1, 0, 0], c: '#2e3034' });
  return b;
}
// a Makers' saw mill (front, its door, faces +z; the wheel side is -x): a square stone house with a flat roof behind a
// parapet, a timber saw shed on its north end with the frame saw and the log bed, a gear box where the axle comes through
function sawMill(seed) {
  // (dressing pass) the mill house in the v111/v112 look: sooty stone, dark tarred corner posts, a steep gable of slate-grey
  // tiles with its ridge east-west (the gables to the door and to the wheel), a square chimney stack on the ridge
  const r = yardHouse(seed, { w: 7.5, d: 9, h: 5.0, roof: 'tile', tile: '#585450', wall: 'stone', stoneC: '#8a867e', ridgeZ: true, pitch: 0.58, door: 0, chimney: -1, wins: { front: [2.3], back: [-2.1], left: [-2.4, 2.4], right: [] } });
  const b = r.builder;
  // (the house is turned so its door faces east: local +z is east, local -z west toward the creek, local +x north)
  // the gear box on the back (west) wall where the wheel's axle comes in
  b.add(box(1.6, 1.6, 0.8), 'wIron', { p: [0, 2.0, -4.85], c: '#3a3c40' });
  b.add(box(0.32, 0.32, 2.4), 'wIron', { p: [0, 2.15, -6.0], c: '#2e3034' });
  // the saw shed on the north end: four square posts, a flat plank roof, open sides; the frame saw (two uprights, a top
  // rail, the blade between them) over a plank log bed with a log on it, all running north-south
  const sx0 = 3.75 + 3.3;
  for (const sx of [4.0, sx0 + 2.9]) for (const sz of [-3.0, 3.0]) b.add(box(0.26, 3.4, 0.26), 'beam', { p: [sx, 1.7, sz], c: '#5a4a3a' });
  { const tc = texTint('shingleWood', '#585450'), pit = 0.27; // (a low tiled gable over the shed, its ridge north-south)
    for (const s of [-1, 1]) b.add(box(6.8, 0.14, 3.8), 'shingleWood', { p: [sx0 + 0.1, 3.4 + 1.75 * Math.tan(pit) + 0.07, s * 1.75], r: [s * pit, 0, 0], c: tc, uv: 'box', us: 0.42 });
    b.add(box(6.8, 0.12, 0.24), 'shingleWood', { p: [sx0 + 0.1, 3.4 + 3.5 * Math.tan(pit) + 0.12, 0], c: shade(tc, 0.72) });
    for (const s of [-1, 1]) b.add(box(6.8, 0.3, 0.06), 'woodDark', { p: [sx0 + 0.1, 3.36, s * 3.5], c: '#2e241c' });
    b.add(gablePrism(7.0, 3.5 * Math.tan(pit), 0.12), 'woodDark', { p: [sx0 + 3.2, 3.42, 0], r: [0, PI / 2, 0], c: TAR_L, uv: 'box' }); }
  b.add(box(7.4, 0.3, 1.6), 'wood', { p: [sx0, 0.15, 0], c: PLANK });
  for (const sz of [-0.7, 0.7]) b.add(box(0.2, 2.6, 0.2), 'beam', { p: [sx0, 1.4, sz], c: '#4a3c30' });
  b.add(box(0.24, 0.22, 1.8), 'beam', { p: [sx0, 2.75, 0], c: '#4a3c30' });
  b.add(box(0.03, 1.7, 1.2), 'wSteel', { p: [sx0, 1.75, 0], c: '#b8bcc0' });
  b.add(cyl(0.34, 0.36, 5.6, 10), 'bark', { p: [sx0 + 0.6, 0.66, 0], r: [0, 0, PI / 2], c: '#a08a70' });
  r.colliders.push({ x: sx0, z: 0, hw: 3.7, hd: 0.9 });
  return r;
}
// a sluice at the foot of a log pond: two square stone piers, a flat stone lintel across them (a square opening), a plank
// gate in its guides, a short plank walk on top (local: the creek runs along z)
function sluice(seed, span = 3.2) {
  const b = new Builder(seed);
  for (const sx of [-1, 1]) b.add(box(1.4, 4.2, 2.2), 'stone', { p: [sx * (span / 2 + 0.7), 1.2, 0], c: ST, us: 0.5 });
  b.add(box(span + 2.8, 0.6, 2.4), 'stoneLarge', { p: [0, 3.5, 0], c: ST_L });
  b.add(box(span, 2.2, 0.18), 'wood', { p: [0, 1.6, 0.3], c: PLANK });
  for (const sx of [-1, 1]) b.add(box(0.14, 3.0, 0.3), 'wIron', { p: [sx * (span / 2 - 0.05), 1.9, 0.3], c: IRON });
  b.add(box(span - 0.4, 0.14, 0.12), 'wIron', { p: [0, 2.6, 0.42], c: IRON });
  return res(b, { colliders: [{ x: -(span / 2 + 0.7), z: 0, hw: 0.7, hd: 1.1 }, { x: span / 2 + 0.7, z: 0, hw: 0.7, hd: 1.1 }] });
}
// a tide gauge: a tall square post painted in bands (plain light and dark, no marks or numbers), a flat iron cap
function tideGauge(seed, h = 5) {
  const b = new Builder(seed);
  for (let y = 0, i = 0; y < h; y += 0.5, i++) b.add(box(0.3, 0.5, 0.3), 'wPaint', { p: [0, y - 2.5 + 0.25, 0], c: i % 2 ? '#2e3032' : '#d8d4c8' });
  b.add(box(0.44, 0.1, 0.44), 'wIron', { p: [0, h - 2.45, 0], c: IRON });
  return res(b, { collider: { r: 0.3 } });
}
// an old channel post on the flats: a square post with a flat cap, leaning a little, weed-dark at its foot
function channelPost(seed) {
  const b = new Builder(seed), lean = b.r(-0.08, 0.08);
  b.add(box(0.32, 3.4, 0.32), 'beam', { p: [0, 1.1, 0], r: [lean, 0, b.r(-0.06, 0.06)], c: '#6a5a48' });
  b.add(box(0.36, 0.7, 0.36), 'woodDark', { p: [0, -0.1, 0], c: '#2e3a2a' });
  b.add(box(0.44, 0.1, 0.44), 'wIron', { p: [0, 2.85, 0], r: [lean, 0, 0], c: IRON });
  return { builder: b, collider: { r: 0.3 } };
}
// a stranded log on the mud, half sunk
function strandedLog(seed) {
  const b = new Builder(seed), L = b.r(4, 7), R = b.r(0.25, 0.38);
  b.add(cyl(R, R * 1.1, L, 10), 'bark', { p: [0, R * 0.4, 0], r: [0, 0, PI / 2 + b.r(-0.04, 0.04)], c: '#7a6a58' });
  return { builder: b, collider: { r: 0.6 } };
}
// a floating log (for the ponds), along local x
function floatLog(seed) {
  const b = new Builder(seed), L = b.r(5, 7.5), R = b.r(0.26, 0.36);
  b.add(cyl(R, R * 1.06, L, 10), 'bark', { p: [0, 0, 0], r: [0, 0, PI / 2], c: '#9a8468' });
  return { builder: b };
}
// a dead pole: a planted tree killed by the salt, bare and grey, a few short broken stubs
function deadPole(seed) {
  const b = new Builder(seed), H = b.r(6.5, 9);
  b.add(cyl(0.08, 0.26, H, 8), 'barkDark', { p: [0, H / 2 - 0.2, 0], c: '#b8b2a8' });
  // three stubs, each a good way above the last and angled steeply up, so no two ever line up across the pole into a cross
  for (let i = 0, y = b.r(2.4, 3.2), a = b.r(0, PI * 2); i < 3 && y < H - 0.8; i++, y += b.r(1.3, 1.9), a += b.r(1.6, 2.4)) { const L = b.r(0.4, 0.8), t = 0.55, ox = Math.cos(a) * Math.sin(t) * L * 0.5, oz = Math.sin(a) * Math.sin(t) * L * 0.5; b.add(cyl(0.03, 0.05, L, 5), 'barkDark', { p: [ox, y + Math.cos(t) * L * 0.5, oz], r: [Math.sin(a) * t, 0, -Math.cos(a) * t], c: '#a8a298' }); }
  return { builder: b, collider: { r: 0.3 }, height: H };
}
// a stump where a row tree was felled
function stump(seed) {
  const b = new Builder(seed);
  b.add(cyl(0.3, 0.38, 0.5, 9), 'bark', { p: [0, 0.2, 0], c: '#8a7660' });
  return { builder: b, collider: { r: 0.4 } };
}
// shore stones and shingle, salt grass, a gorse bush
function shoreStone(seed, tint = '#7a7874') {
  const b = new Builder(seed);
  for (let i = 0; i < 1 + (seed % 3); i++) addRock(b, [b.r(-0.8, 0.8), 0, b.r(-0.8, 0.8)], [b.r(0.4, 1.0), b.r(0.25, 0.5), b.r(0.4, 0.9)], seed * 5 + i, { moss: 0.15, tint });
  return { builder: b, collider: { r: 0.8 } };
}
function saltGrass(seed) {
  const b = new Builder(seed);
  // (single cards at odd angles: three-card tufts drew a six-pointed star from straight above)
  for (let i = 0; i < 5; i++) addTuft(b, i % 2 ? 'reed' : 'grassCard', [b.r(-0.7, 0.7), 0, b.r(-0.7, 0.7)], b.r(0.5, 0.9), b.r(0.4, 0.75), b.r(0, 3.1), i % 2 ? '#b8b07a' : '#c8b884', 1);
  return { builder: b };
}
// a scow sunk in the mud: a flat-bottomed box hull with square ends (no beak of a bow), its planks sprung
function sunkScow(seed) {
  const b = new Builder(seed), L = 8, W = 2.6;
  b.add(box(L, 0.2, W), 'woodDark', { p: [0, 0.1, 0], c: '#3e342a' });
  for (const sz of [-1, 1]) b.add(box(L, 0.9, 0.14), 'woodDark', { p: [0, 0.5, sz * W / 2], r: [sz * 0.1, 0, 0], c: '#4a3e32' });
  for (const sx of [-1, 1]) b.add(box(0.14, 0.8, W), 'woodDark', { p: [sx * L / 2, 0.45, 0], c: '#4a3e32' });
  b.add(box(0.2, 0.16, W - 0.2), 'beam', { p: [0, 0.75, 0], c: '#5a4a3a' });
  return res(b, { colliders: [{ x: 0, z: 0, hw: L / 2, hd: W / 2 }] });
}

// (second dressing pass) rope laid out to dry on the grass: straight lengths side by side along local x, each held at both
// ends by a small square peg (parallel lines and pegs only: nothing crossing, never a coil)
function ropeLine(seed, L = 7, n = 4, col = '#8a7656') {
  const b = new Builder(seed);
  for (let i = 0; i < n; i++) {
    const z = (i - (n - 1) / 2) * 0.34, l = L - b.r(0, 0.6), x0 = -L / 2 + b.r(0, 0.3);
    b.add(cyl(0.045, 0.045, l, 6), 'cloth', { p: [x0 + l / 2, 0.05, z], r: [0, 0, PI / 2], c: b.r() < 0.5 ? col : shade(col, 0.88) });
    for (const x of [x0 - 0.12, x0 + l + 0.12]) b.add(box(0.09, 0.32, 0.09), 'beam', { p: [x, 0.1, z], c: '#5a4a3a' });
  }
  return { builder: b };
}
// rushes: single upright cards spread over a clump (never several crossing at one point, which reads as a star from above)
function rushClump(seed) {
  const b = new Builder(seed);
  for (let i = 0; i < 6; i++) addTuft(b, 'reed', [b.r(-0.55, 0.55), 0, b.r(-0.55, 0.55)], b.r(0.35, 0.6), b.r(0.7, 1.15), b.r(0, 3.1), i % 3 ? '#8a9a5a' : '#a8a066', 1);
  return { builder: b };
}
// low grass tufts: a few short single cards spread apart
function lowTufts(seed) {
  const b = new Builder(seed);
  for (let i = 0; i < 4; i++) addTuft(b, 'grassCard', [b.r(-0.45, 0.45), 0, b.r(-0.45, 0.45)], b.r(0.3, 0.5), b.r(0.22, 0.4), b.r(0, 3.1), i % 2 ? '#b8b07a' : '#9aa264', 1);
  return { builder: b };
}

// shingle laid on a path: small flat grey stones over a stride of ground (flat lumps, no rings, nothing standing up)
function shinglePatch(seed) {
  const b = new Builder(seed);
  for (let i = 0; i < 9; i++) { const s = b.r(0.12, 0.26); b.add(rbox(s * b.r(1.2, 1.9), 0.08, s, 0.03), 'stoneLarge', { p: [b.r(-0.6, 0.6), 0.02, b.r(-0.45, 0.45)], r: [0, b.r(0, 3.1), 0], c: ['#cac6bc', '#dcd8cc', '#b2aea4'][i % 3] }); }
  return { builder: b };
}

// ------------------------------------------------------------------ the area
export function buildTidewater(W, S) {
  const T = W.terrain, Tw = TIDEWATER;
  const H = (x, z) => T.height(x, z);
  const put = (key, x, z, r = 0, s = 1, sink = 0.05) => S.place(key, x, H(x, z) - sink, z, r, s);
  const pre = (key, r2) => { if (!S.prefabs.has(key)) S.addPrefab(key, r2); };
  const place = (r2, x, z, ry = 0, yOff = 0) => W.placeObject(r2, x, z, ry, yOff);
  const runtime = (W.tidewaterRuntime = []);
  // loose logs keep 9 m apart (a log is up to ~8 m long), so no two ever cross into an X or meet in a V
  const logsAt = [], logFree = (x, z) => { if (logsAt.some(([lx, lz]) => Math.hypot(lx - x, lz - z) < 9)) return false; logsAt.push([x, z]); return true; };
  for (let v = 0; v < 4; v++) pre('twstone' + v, shoreStone(v + 1101));
  for (let v = 0; v < 2; v++) pre('twboulder' + v, shoreStone(v + 1111, '#6a6862'));
  for (let v = 0; v < 3; v++) pre('twgrass' + v, saltGrass(v + 1121));
  for (let v = 0; v < 3; v++) pre('twlog' + v, strandedLog(v + 1131));
  for (let v = 0; v < 3; v++) pre('twfloat' + v, floatLog(v + 1141));
  for (let v = 0; v < 2; v++) pre('twpost' + v, channelPost(v + 1151));
  for (let v = 0; v < 4; v++) pre('twpine' + v, pine(v + 61, { scale: 0.82 + v * 0.05 }));
  for (let v = 0; v < 3; v++) pre('twdead' + v, deadPole(v + 1161));
  pre('twstump', stump(1171));
  pre('lantern', P.lanternPost(1172, 'yellow'));
  pre('crates', yardCrates(1173));
  pre('sacks', sacks(1174));
  pre('bench', stoneBench(1175));
  pre('twbin', ropeBin(1176));
  pre('twbarrels', barrelRow(1177));
  pre('twboards', boardStack(1178));
  pre('twbarrels2', barrelRow(1179, 4, 2));
  pre('twhorse', sawHorse(1180));
  pre('twbench', workBench(1181));
  pre('twbales', yarnBales(1182));
  pre('twpoles', poleRack(1183));
  for (let v = 0; v < 3; v++) pre('twwrack' + v, wrackPatch(1184 + v));
  for (let v = 0; v < 2; v++) pre('twgorse' + v, bush(1187 + v, { scale: 0.62 + v * 0.12 }));
  pre('twchips', sawdust(1189));
  for (let v = 0; v < 2; v++) pre('twropeline' + v, ropeLine(1391 + v, 7, 4, v ? '#3e342c' : '#8a7656'));
  for (let v = 0; v < 3; v++) pre('twrush' + v, rushClump(1393 + v));
  for (let v = 0; v < 3; v++) pre('twtuft' + v, lowTufts(1396 + v));
  for (let v = 0; v < 3; v++) pre('twshingle' + v, shinglePatch(1401 + v));

  // ---------------------------------------------------------------- the quay and the ship
  {
    const Q = Tw.quay, L = Q.x1 - Q.x0, D = Q.z1 - Q.z0, top = Q.top, b = new Builder(1201);
    // the deck: planks across, on three long stringers, on square piles down into the mud
    b.add(box(L, 0.18, D), 'wood', { p: [L / 2, top - 0.09, D / 2], c: '#8a7660', us: 1 });
    for (const z of [0.6, D / 2, D - 0.6]) b.add(box(L, 0.36, 0.3), 'beam', { p: [L / 2, top - 0.36, z], c: '#5a4a3a' });
    for (let x = 1; x < L; x += 3.5) for (const z of [0.6, D / 2, D - 0.4]) b.add(box(0.34, 8.5, 0.34), 'woodDark', { p: [x, top - 4.4, z], c: '#3e342a' });
    // the kerb along the water face, square bollards, fenders hanging down the face, a ladder down to the water
    b.add(box(L, 0.24, 0.3), 'beam', { p: [L / 2, top + 0.12, D - 0.15], c: '#5a4a3a' });
    for (const x of [4, 16, 27, 38]) { b.add(box(0.44, 0.6, 0.44), 'woodDark', { p: [x, top + 0.3, D - 0.6], c: '#3e342a' }); b.add(box(0.54, 0.08, 0.54), 'wIron', { p: [x, top + 0.62, D - 0.6], c: IRON }); }
    for (let x = 2.5; x < L; x += 4.2) b.add(box(0.36, 3.2, 0.24), 'beam', { p: [x, top - 1.6, D + 0.12], c: '#4a3c30' });
    for (const sx of [-0.35, 0.35]) b.add(box(0.1, 4.6, 0.1), 'wIron', { p: [32 + sx, top - 2.1, D + 0.2], c: IRON });
    for (let y = top - 4.2; y < top; y += 0.4) b.add(box(0.7, 0.05, 0.05), 'wIron', { p: [32, y, D + 0.2], c: IRON });
    W.placeAt(res(b), Q.x0, 0, Q.z0, 0);
    // the ice-bow ship along the quay's water face, bow east to the Sound's mouth; it floats on the tide (tick below)
    const ship = buildSteamship({ iceBow: true });
    const obj = W.placeAt({ builder: new Builder(1), dynamics: [ship], colliders: [{ x: 0, z: 0, hw: 3.95, hd: 17.2 }] }, Tw.berth.x, 0, Tw.berth.z, Tw.berth.ry);
    obj.name = 'tidewaterShip';
    markDynamic(obj);
    W.tidewaterShip = obj; runtime.push(obj);
    // the quay's stores, lanterns, the harbour man's desk, a tide gauge off the end
    for (const x of [455, 474, 492]) S.place('lantern', x, top, Q.z0 + 0.8, 0, 0.9);
    S.place('crates', 485, top, Q.z0 + 1.6, 0.2, 0.85); S.place('twbarrels', 460, top, Q.z0 + 1.6, 0, 0.9); S.place('twbin', 489.5, top, Q.z0 + 1.4, 0.1, 0.9);
    const desk = new Builder(1202);
    desk.add(box(1.6, 1.0, 0.7), 'woodDark', { p: [0, 0.5, 0], c: '#5e4a38' });
    desk.add(box(1.8, 0.08, 0.9), 'wood', { p: [0, 1.04, 0], c: '#8a6e52' });
    desk.add(box(0.5, 0.06, 0.36), 'cloth', { p: [0.3, 1.1, 0], c: '#e0d6c0' });
    W.placeAt(res(desk, { collider: { r: 0.9 } }), Tw.harbour.x + 1.8, top, Tw.harbour.z + 1.2, 0);
    W.placeAt(tideGauge(1203, 6), Q.x1 + 1.2, top - 3.0, Q.z1 - 0.6, 0);
  }

  // ---------------------------------------------------------------- the Tidewrights' camp
  const C = Tw.camp;
  const face = (x, z) => Math.atan2(C.x - x, C.z - z);
  // (dressing pass) the Tidewrights' houses in the v111/v112 look: thatch or tile over plaster in a dark timber frame, one
  // of sooty stone, square chimneys on the ridges
  const huts = [[456.5, -2582, 5.8, 4.6], [457, -2599.5, 6.4, 4.8], [480.5, -2607.5, 6.0, 4.6], [486, -2588.5, 5.6, 4.4]];
  const hutLook = [{ roof: 'thatch', chimney: 1 }, { roof: 'tile', tile: '#6a3228', chimney: -1 }, { roof: 'tile', tile: '#5a5652', wall: 'stone', chimney: 1, shutC: '#4a4038' }, { roof: 'thatch', chimney: -1, shutC: '#5e5440' }];
  huts.forEach(([x, z, w, d], i) => place(yardHouse(1210 + i, { w, d, h: 3.0, ...hutLook[i] }), x, z, face(x, z), -0.1));
  place(P.campfire(1220), 471.5, -2595.5, 0);
  put('bench', 468.5, -2592, 2.2); put('bench', 474.8, -2593.2, -2.2);
  for (const a of [-140, -60, 20, 100, 160]) { const r = a * PI / 180; put('lantern', C.x + Math.cos(r) * 12.5, C.z + Math.sin(r) * 12.5, -r); }
  place(dryRack(1221, 4.5), 463, -2604, 0.5); place(dryRack(1222, 4), 478.5, -2598.5, -1.0);
  for (const [x, z, r] of [[452.5, -2590.5, 0.4], [483.5, -2595.5, 1.3]]) put('twbin', x, z, r);
  for (const [x, z, r] of [[461.5, -2584.5, 0.2], [489.5, -2593.5, 2.0]]) put('crates', x, z, r);
  put('sacks', 476.5, -2583.5, 1.1);
  { const b = new Builder(1223); for (let k = 0; k < 3; k++) hank(b, 0, k * 0.13, 0, 0, 1.6, 5, k % 2 ? '#5a4c3a' : '#8a7656'); place(res(b, { collider: { r: 1 } }), 466, -2585, 0.4); }
  { const c = Tw.caravan; place(P.cart(1224), c.x + 2.5, c.z + 3, 0.7); put('crates', c.x + 4.8, c.z - 0.5, 0.4); }
  { const g = Tw.grave; put('bench', g.x, g.z - 1.6, 0); put('lantern', g.x + 2.2, g.z - 1.2, 0.4); }
  // (dressing pass) the camp at work: a workbench by the west house, yarn bales and a two-tier tar barrel rack by the east
  // houses, a long drying rack of hanks behind the square, a saw horse with a board on it, sawn poles racked by the ropewalk
  put('twbench', 462, -2579.5, 0.4); put('twbales', 482.5, -2581.5, -0.5); put('twbarrels2', 491.5, -2583.5, 1.5);
  place(dryRack(1225, 6), 471, -2608, 0.1); put('twhorse', 451, -2581.5, 0.3); put('twpoles', 489, -2619, 0);
  put('twbin', 474.5, -2609.5, 0.1); put('crates', 466.5, -2609, -0.2);

  // ---------------------------------------------------------------- the tar yards
  {
    const Y = Tw.taryard;
    for (const [dx, dz] of [[-4, -3], [1, -4.5], [5.5, -2]]) place(tarPan(1230 + dx), Y.x + dx, Y.z + dz, 0.08);
    place(tarTrough(1235, 7), Y.x - 1, Y.z + 3.5, 0.05);
    place(barrelRow(1236, 6), Y.x - 7.5, Y.z + 6.5, 0.4); place(barrelRow(1237, 4), Y.x + 6, Y.z + 5, -0.3);
    place(barrelRow(1238, 4), Y.x - 9, Y.z - 3, 1.4); // (lying, never stood on end: a hooped barrel top reads as a disc in a ring from above)
    put('twbin', Y.x + 9, Y.z - 4.5, 0.3); put('twbin', Y.x + 9.5, Y.z - 2.3, 0.1);
    place(timberStack(1239, 4.5, 4, 2), Y.x + 2, Y.z - 9, 0.1);
    // (dressing pass) the tar house on the yard's north side (stone, a red tile roof, its door to the pans), a second rack
    // of barrels two high, a bench with the tar bucket, saw horses
    place(yardHouse(1226, { w: 6.2, d: 4.6, h: 3.0, roof: 'tile', tile: '#6a3228', wall: 'stone', stoneC: '#7e7a72', chimney: 1, shutC: '#3e342c' }), Y.x + 5.5, Y.z - 17, 0, -0.1);
    put('twbarrels2', Y.x - 2, Y.z + 9.5, 0.1); put('twbench', Y.x + 9, Y.z + 5.5, -0.2); put('twhorse', Y.x - 6, Y.z - 7.5, 0.6);
  }

  // ---------------------------------------------------------------- the ropewalk
  {
    const R = Tw.ropewalk, L = R.x1 - R.x0, hw = R.hw, h = 3.4, b = new Builder(1240), cols = [], y0 = R.top;
    for (let x = 0; x <= L + 0.01; x += 4.5) for (const sz of [-1, 1]) { b.add(box(0.3, h, 0.3), 'beam', { p: [x, h / 2, sz * hw], c: '#5a4a3a' }); cols.push({ x, z: sz * hw, r: 0.3 }); }
    for (const sz of [-1, 1]) b.add(box(L + 0.3, 0.3, 0.26), 'beam', { p: [L / 2, h, sz * hw], c: '#5a4a3a' });
    // the roof (dressing pass, the v111 look): a low gable of slate-grey tiles the length of the walk, deep eaves with a dark
    // fascia board, a ridge cap, tarred plank gable ends with a tie beam
    { const pit = 0.36, over = 0.8, hs = hw + over, rise = hw * Math.tan(pit), sl = hs / Math.cos(pit), th = 0.15, tc = texTint('shingleWood', '#5a5652');
      const yR = h + 0.15 + rise, yE = h + 0.15 - over * Math.tan(pit);
      for (const s of [-1, 1]) {
        b.add(box(L + 1.4, th, sl), 'shingleWood', { p: [L / 2, (yR + yE) / 2 + th / 2 / Math.cos(pit), s * hs / 2], r: [s * pit, 0, 0], c: tc, uv: 'box', us: 0.42 });
        b.add(box(L + 1.4, th + 0.22, 0.06), 'woodDark', { p: [L / 2, yE - 0.04, s * (hs - 0.02)], c: '#2e241c' });
      }
      b.add(box(L + 1.4, 0.14, 0.26), 'shingleWood', { p: [L / 2, yR + th / Math.cos(pit) - 0.02, 0], c: shade(tc, 0.72) });
      for (const x of [0, L]) { b.add(gablePrism(hw * 2, rise, 0.14), 'woodDark', { p: [x, h + 0.15, 0], r: [0, PI / 2, 0], c: TAR_L, uv: 'box' }); b.add(box(0.2, 0.2, hw * 2 + 0.3), 'beam', { p: [x, h + 0.2, 0], c: '#2e241c' }); } }
    // a low plank wall along the north side (the sea wind), the south side open
    b.add(box(L, 1.2, 0.12), 'woodDark', { p: [L / 2, 0.6, -hw], c: TAR_L });
    // the strands: three laid the length of the walk at waist height, resting on square stake frames every 9 m (two posts and
    // a top board, the strands through notches in it)
    for (let x = 6; x < L - 4; x += 9) { for (const sz of [-0.8, 0.8]) b.add(box(0.14, 1.1, 0.14), 'beam', { p: [x, 0.55, sz], c: '#6a5a48' }); b.add(box(0.3, 0.12, 1.9), 'beam', { p: [x, 1.12, 0], c: '#6a5a48' }); }
    for (const sz of [-0.4, 0, 0.4]) strand(b, [2.2, 1.2, sz], [L - 4, 1.2, sz], 0.045);
    // the jack at the west end: a heavy square frame with three square whirl blocks on its face
    b.add(box(0.5, 2.0, 2.6), 'beam', { p: [1.4, 1.0, 0], c: '#4a3c30' });
    b.add(box(1.4, 0.4, 2.8), 'beam', { p: [1.4, 0.2, 0], c: '#4a3c30' });
    for (const sz of [-0.4, 0, 0.4]) b.add(box(0.3, 0.3, 0.3), 'wIron', { p: [1.8, 1.2, sz], c: IRON });
    // the traveller at the east end: a plank sledge with a post and a top board, the strands' ends on it
    b.add(box(1.6, 0.3, 1.8), 'wood', { p: [L - 3.2, 0.15, 0], c: PLANK });
    b.add(box(0.3, 1.2, 1.4), 'beam', { p: [L - 3.6, 0.8, 0], c: '#4a3c30' });
    for (const sz of [-0.4, 0, 0.4]) b.add(box(0.24, 0.24, 0.24), 'wIron', { p: [L - 3.9, 1.2, sz], c: IRON });
    // finished rope: hanks laid on the floor along the open side
    for (let x = 12; x < L - 8; x += 16) hank(b, x, 0.02, hw - 1.0, 0, 2.2, 4, x % 32 < 16 ? '#8a7656' : '#4a3e30');
    W.placeAt(res(b, { colliders: cols }), R.x0, y0 - 0.02, R.z, 0);
    for (const [x, sz] of [[R.x0 - 2, -1], [R.x1 + 2.5, 1]]) put('twbin', x, R.z + sz * 2.2, 0.1);
  }

  // ---------------------------------------------------------------- the Tide Mills: ponds, sluices, mills, wheels
  const wheels = [];
  {
    const wheelGeo = waterWheel(1250).geometries();
    Tw.ponds.forEach((Pd, i) => {
      // the pond's water: held at its own level above the highest tide
      const sea = createSea(W.tidewaterTerrain, W.engine.sunDir, { x: Pd.x, z: Pd.z, w: Pd.hx * 2, h: Pd.hz * 2 });
      const u = sea.material.uniforms; u.uDeep.value.set('#20302a'); u.uShallow.value.set('#4e5e48'); u.uSky.value.set('#a8b2b0'); u.uFoam.value.set('#c8c8b8');
      sea.position.y = Pd.level + 0.02; sea.name = 'tidewaterPond' + i;
      W.tidewaterGroup.add(sea); runtime.push(sea);
      // the plank revetment round the pond's square, square posts at its corners, a gap at the sluice
      const b = new Builder(1260 + i), top = Pd.level + 0.7;
      for (const sz of [-1, 1]) {
        const z = sz * (Pd.hz + 0.15);
        if (sz < 0) b.add(box(Pd.hx * 2 + 0.3, 1.5, 0.2), 'woodDark', { p: [0, top - 0.75, z], c: '#3e342a' });
        else for (const sx of [-1, 1]) b.add(box(Pd.hx - 2.4, 1.5, 0.2), 'woodDark', { p: [sx * (Pd.hx / 2 + 1.2), top - 0.75, z], c: '#3e342a' });
      }
      for (const sx of [-1, 1]) b.add(box(0.2, 1.5, Pd.hz * 2 + 0.3), 'woodDark', { p: [sx * (Pd.hx + 0.15), top - 0.75, 0], c: '#3e342a' });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.36, 2.0, 0.36), 'beam', { p: [sx * (Pd.hx + 0.15), top - 0.6, sz * (Pd.hz + 0.15)], c: '#5a4a3a' });
      W.placeAt(res(b), Pd.x, 0, Pd.z, 0);
      // logs floating, all lying the same way
      const rng = mulberry32(1270 + i);
      for (let k = 0; k < 12; k++) {
        const x = Pd.x + (rng() - 0.5) * (Pd.hx * 2 - 8), z = Pd.z + (rng() - 0.5) * (Pd.hz * 2 - 2.5);
        S.place('twfloat' + (k % 3), x, Pd.level - 0.12, z, (rng() - 0.5) * 0.25, 1);
      }
      // the sluice at the pond's foot, astride the head of the creek
      const cr = Tw.creeks[i][0];
      W.placeAt(sluice(1280 + i), cr[0], cr[2] - 0.2, Pd.z + Pd.hz + 0.6, 0);
    });
    Tw.mills.forEach((M, i) => {
      place(sawMill(1290 + i), M.x, M.z, PI / 2, -0.05);
      // the wheel in the creek beside the house, its axle into the gear box; stone pit walls either side of it
      const cr = tidewaterCreek(M.wx, M.z), bed = cr.bed, yc = bed + 2.15;
      const g = new THREE.Group();
      for (const { geo, mat } of wheelGeo) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; g.add(m); }
      g.position.set(M.wx, yc, M.z); g.name = 'tidewaterWheel' + i;
      markDynamic(g);
      W.tidewaterGroup.add(g); runtime.push(g);
      wheels.push({ g, bed, a: 0, w: 0 });
      const b = new Builder(1300 + i);
      for (const sx of [-1, 1]) b.add(box(0.8, 2.6, 6.4), 'stoneDark', { p: [sx * 1.25, 0.4, 0], c: ST_D, us: 0.5 });
      W.placeAt(res(b, { colliders: [{ x: -1.25, z: 0, hw: 0.4, hd: 3.2 }, { x: 1.25, z: 0, hw: 0.4, hd: 3.2 }] }), M.wx, bed - 0.3, M.z, 0);
      // the mill's yard: logs waiting, sawn timber, sawdust, boards stacked
      place(logPile(1310 + i, 6.5, 5), M.x + 8, M.z - 8, 0.05);
      place(timberStack(1315 + i, 5, 4, 3), M.x + 8.5, M.z + 3, -0.05);
      put('twboards', M.x + 5.5, M.z + 7.5, 0.05);
      place(sawdust(1320 + i), M.x - 1, M.z - 10.5, 0);
      put('lantern', M.x + 5, M.z - 2.5, -PI / 2);
      // (dressing pass) the mill yard at work: a saw horse with a board, a bench, a rack of sawn poles, a rack of tar barrels
      // (the second mill's yard climbs a bank at x +8..+12: its horse and bales stand on the level ground above it)
      put('twhorse', M.x + (i ? 14 : 10.5), M.z - 2.5, 0.1); put('twbench', M.x + 2, M.z + 6.5, 0); put('twpoles', M.x - 2.5, M.z + 7.5, PI / 2); // (run north-south: lying east-west its west end hung out over the creek bank)
      put(i ? 'twbales' : 'twbarrels2', M.x + (i ? 14 : 11), M.z + (i ? 9.5 : 7.5), 0.05); put('crates', M.x + 12, M.z - 6.5, 0.3);
    });
    // the races pad: a square stone hatch over the wheel pits (the Mill Races' way down comes with P13.4)
    {
      const Rp = Tw.races, b = new Builder(1330);
      b.add(box(4.2, 0.3, 4.2), 'stoneLarge', { p: [0, 0.05, 0], c: ST_L });
      b.add(box(2.6, 0.12, 2.6), 'wood', { p: [0, 0.24, 0], c: '#5a4a3a' });
      for (const sx of [-0.6, 0.6]) b.add(box(0.12, 0.08, 2.4), 'wIron', { p: [sx, 0.32, 0], c: IRON });
      place(res(b), Rp.x, Rp.z, 0.1, 0);
    }
  }

  // ---------------------------------------------------------------- the mud flats
  {
    const rng = mulberry32(1340);
    // old channel posts marking the creek mouths, in lines down each side
    for (const Cr of Tw.creeks) for (let k = 3; k < Cr.length - 1; k++) {
      const [ax, az] = Cr[k], [bx, bz] = Cr[k + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
      for (let t = 2; t < L; t += 5) for (const sd of [-1, 1]) {
        // (out past the creek's banks, which flare at its mouth: tidewaterCreek's width w)
        const cx = ax + (bx - ax) * (t / L), cz = az + (bz - az) * (t / L), o = 4.2 * tidewaterCreek(cx, cz).w, x = cx + nx * sd * o, z = cz + nz * sd * o;
        if (rng() < 0.75) put('twpost' + (rng() < 0.5 ? 0 : 1), x, z, rng() * 0.3, 1, 0.3);
      }
    }
    // stranded logs lying roughly along the shore, a sunk scow
    for (let i = 0; i < 26; i++) {
      const x = 504 + rng() * 84, dn = 3 + rng() * 20, z = soundNorthZ(x) + dn;
      if (tidewaterCreek(x, z).d < 5 || tidewaterGap(x, z) > -1 || Math.abs(x - 508) < 4 || !logFree(x, z)) continue;
      put('twlog' + (i % 3), x, z, (rng() - 0.5) * 0.5, 0.9 + rng() * 0.3, 0.2);
    }
    place(sunkScow(1345), 552, soundNorthZ(552) + 15, 0.18, -0.35);
  }

  // ---------------------------------------------------------------- (dressing pass) the wrack line and the ebb's pools
  {
    const rng = mulberry32(1346);
    // the wrack: dried weed and drift strung along the high-water mark (where the ground crosses 1.3 m) the length of the
    // north shore, in patches, each lying along the shore
    for (let x = 400; x <= 660; x += 3.2 + rng() * 2.5) {
      let z = null; for (let zz = soundNorthZ(x) - 14; zz < soundNorthZ(x) + 3; zz += 0.4) if (H(x, zz) < 1.3) { z = zz; break; }
      if (z === null || rng() < 0.25) continue;
      const Q = Tw.quay; if (x > Q.x0 - 3 && x < Q.x1 + 3 && z > Q.z0 - 6) continue;
      if (Math.abs(x - Tw.gate.x) < 7 || tidewaterCreek(x, z).d < 4.6) continue;
      const tz = (soundNorthZ(x + 1) - soundNorthZ(x - 1)) / 2;
      put('twwrack' + Math.floor(rng() * 3), x + rng() * 1.5, z + rng() * 0.6, -Math.atan(tz) + (rng() - 0.5) * 0.3, 0.8 + rng() * 0.5, 0.02);
    }
    // the pools the ebb leaves on the flats: still water in shallow hollows, shown only while the flats are out of the water
    const b = new Builder(1347);
    let n = 0;
    for (let k = 0; k < 90 && n < 34; k++) {
      const x = 508 + rng() * 80, z = soundNorthZ(x) + 3 + rng() * 18;
      if (tidewaterCreek(x, z).d < 5 || tidewaterGap(x, z) > -1.5 || Math.hypot(x - 552, z - soundNorthZ(552) - 15) < 6.5 || !logFree(x, z)) continue;
      logsAt.pop(); // (only checked against the logs, not kept)
      const sx = 0.8 + rng() * 1.8, sz = 0.5 + rng() * 1.0, y = Math.max(H(x - sx, z), H(x + sx, z), H(x, z - sz), H(x, z + sz)) + 0.02;
      // (a flat outline wobbling round an oval: no lumps standing up out of the water)
      const sh = new THREE.Shape(), m = 14, ph = rng() * 6;
      for (let j = 0; j <= m; j++) { const a = (j / m) * PI * 2, rr = 1 + 0.22 * Math.sin(a * 2 + ph) + 0.12 * Math.sin(a * 3 + ph * 2); j ? sh.lineTo(Math.cos(a) * rr * sx, Math.sin(a) * rr * sz) : sh.moveTo(Math.cos(a) * rr * sx, Math.sin(a) * rr * sz); }
      b.add(new THREE.ShapeGeometry(sh), 'ice', { p: [x, y, z], r: [-PI / 2, 0, rng() * PI], order: 'XYZ', c: '#62645e', uv: 'box' }); // (the ice material: a pale, glossy sheen of sky on still water)
      n++;
    }
    const pools = b.build({ shadow: false });
    pools.name = 'tidewaterPools';
    markDynamic(pools);
    W.tidewaterGroup.add(pools); runtime.push(pools);
    W.tidewaterPools = pools;
  }

  // ---------------------------------------------------------------- the Sea Gate
  {
    const G = Tw.gate, zN = soundNorthZ(G.x) - 3, zS = soundSouthZ(G.x) + 3, bed = Tw.sound.bed, top = G.top;
    const b = new Builder(1350), cols = [];
    const n = G.bays, bay = (zS - zN) / n, pw = 2.6;
    const gapMid = (G.gap[0] + G.gap[1]) / 2, oz = (zN + zS) / 2; // (built about the barrage's middle: local z = world z - oz)
    for (let i = 0; i <= n; i++) {
      const z = zN + i * bay - oz;
      b.add(box(G.pier, top - bed + 1, pw), 'stone', { p: [0, (top + bed) / 2 - 0.5, z], c: ST, us: 0.45 });
      b.add(box(G.pier + 0.4, 0.3, pw + 0.4), 'stoneLarge', { p: [0, top - 0.6, z], c: ST_L });
      b.add(box(G.pier + 0.8, 2.6, pw + 0.4), 'stoneDark', { p: [0, bed + 0.8, z], c: ST_D }); // the pier's foot, weed-dark
      // a cutwater on the seaward face: square (a flat face, not a point)
      b.add(box(1.2, top - bed - 1.5, pw - 0.6), 'stoneDark', { p: [G.pier / 2 + 0.6, (top + bed) / 2 - 1, z], c: ST_D });
      cols.push({ x: 0, z, hw: G.pier / 2 + 0.6, hd: pw / 2 });
    }
    // the gates: a timber leaf in iron guides in each bay, hung half open (its foot above the low water mark); in the jammed
    // bay the leaf has dropped crooked in its guides and stuck
    for (let i = 0; i < n; i++) {
      const z0 = zN + i * bay + pw / 2, z1 = zN + (i + 1) * bay - pw / 2, zc = (z0 + z1) / 2, span = z1 - z0;
      const jam = zc > G.gap[0] - 1 && zc < G.gap[1] + 1, lz = zc - oz;
      const foot = jam ? -0.2 : 0.6 + ((i * 37) % 5) * 0.12, hgt = 3.2;
      for (const s of [-1, 1]) b.add(box(0.5, top - bed, 0.3), 'wIron', { p: [-0.4, (top + bed) / 2, lz + s * (span / 2 + 0.1)], c: IRON });
      b.add(box(0.36, hgt, span), 'wood', { p: [-0.4, foot + hgt / 2, lz], r: [jam ? 0.08 : 0, 0, 0], c: '#5a4a3a' });
      for (let y = 0.4; y < hgt; y += 0.9) b.add(box(0.42, 0.16, span + 0.05), 'wIron', { p: [-0.4, foot + y, lz], r: [jam ? 0.08 : 0, 0, 0], c: '#2e3034' });
      // the crest: slabs over the bay with parapets, except the jammed bay, which is broken open
      if (!jam) {
        b.add(box(G.hw * 2 + 0.4, 0.5, bay - pw + 0.2), 'stoneLarge', { p: [0, top - 0.25, lz], c: ST_L });
        for (const sx of [-1, 1]) b.add(box(0.35, 0.9, bay - pw + 0.2), 'stone', { p: [sx * (G.hw + 0.2), top + 0.45, lz], c: ST });
      } else {
        // the winch houses over the jammed bay's piers: square, flat roofed, their drums shut in
        for (const zz of [z0 - pw / 2 - oz, z1 + pw / 2 - oz]) { b.add(box(3.6, 2.6, 2.4), 'stone', { p: [0, top + 1.3, zz], c: ST }); b.add(box(4.0, 0.25, 2.8), 'stoneLarge', { p: [0, top + 2.72, zz], c: ST_L }); }
        for (const s of [-1, 1]) strand(b, [-0.4, top + 1.2, lz + s * (span / 2 - 0.3)], [-0.4, foot + hgt, lz + s * (span / 2 - 0.3)], 0.06, '#3a3430');
      }
    }
    // the crest over the piers between bays, and its parapets (both colliders only along the walk the gap function opens)
    for (let i = 0; i <= n; i++) { const z = zN + i * bay - oz; if (Math.abs(z + oz - gapMid) < bay * 0.6) continue; b.add(box(G.hw * 2 + 0.4, 0.5, pw), 'stoneLarge', { p: [0, top - 0.25, z], c: ST_L }); for (const sx of [-1, 1]) b.add(box(0.35, 0.9, pw), 'stone', { p: [sx * (G.hw + 0.2), top + 0.45, z], c: ST }); }
    W.placeAt(res(b, { colliders: cols }), G.x, 0, oz, 0);
    // the gatehouses: square, flat roofed behind a parapet, square doors and slit windows (the north one on its pad, its door
    // to the land; the south one on the ridge foot)
    const gh = Tw.gatehouse;
    { const r = stoneBlock(1360, { w: gh.w, d: gh.d, h: gh.h, plinth: 2, door: 2.2, wins: 2, sideWins: 1, pipes: false, chimney: 0, tint: ST }); r.builder.add(box(gh.w - 0.2, 0.14, gh.d - 0.2), 'stoneLarge', { p: [0, gh.h + 0.26, 0], c: ST_D }); place(r, gh.x, gh.z, PI, 0); }
    { const r = stoneBlock(1361, { w: 8, d: 7, h: 7, plinth: 6, door: 0, wins: 1, sideWins: 1, pipes: false, tint: ST }); r.builder.add(box(7.8, 0.14, 6.8), 'stoneLarge', { p: [0, 7.26, 0], c: ST_D }); W.placeAt(r, G.x, top - 0.3, zS + 2, PI / 2); }
    put('lantern', gh.x + 6, gh.z - 6, 0); put('lantern', Tw.gatePad.x + 4.5, Tw.gatePad.z + 7, PI);
    W.placeAt(tideGauge(1362, 7), G.x - 4, -1.8, zN + 1.5, 0);
  }

  // ---------------------------------------------------------------- the tide-mark tower on the headland
  {
    const Tt = Tw.tower, b = new Builder(1370), s = Tt.s, h = Tt.h;
    b.add(box(s, h + 2, s), 'stone', { p: [0, h / 2 - 1, 0], c: ST, us: 0.45, ao: { y0: -0.2, y1: 3, min: 0.7 } });
    b.add(box(s + 0.5, 2.6, s + 0.5), 'stoneDark', { p: [0, -0.4, 0], c: ST_D });
    for (let y = 2.5; y < h - 0.5; y += 1.5) b.add(box(s + 0.12, 0.5, s + 0.12), 'wPaint', { p: [0, y, 0], c: (y / 1.5) % 2 < 1 ? '#e0dcd0' : '#3a3c3e' }); // painted bands
    b.add(box(1.2, 2.3, 0.1), 'woodDark', { p: [0, 1.15, s / 2 + 0.05], c: '#4a3c30' });
    b.add(box(1.8, 0.2, 0.6), 'stoneLarge', { p: [0, 2.45, s / 2 + 0.25], c: ST_L });
    b.add(box(s + 1.0, 0.45, s + 1.0), 'stoneLarge', { p: [0, h + 0.2, 0], c: ST_L }); // the flat cap
    b.add(box(s + 0.6, 0.2, s + 0.6), 'wIron', { p: [0, h + 0.52, 0], c: IRON });
    place(res(b, { colliders: [{ x: 0, z: 0, hw: s / 2 + 0.3, hd: s / 2 + 0.3 }] }), Tt.x, Tt.z, 0.05, 0);
  }

  // ---------------------------------------------------------------- the planted rows
  const keepClear = (x, z, pad = 0) => {
    if (tidewaterPathDist(x, z) < 4 + pad) return false;
    for (const Pd of [Tw.camp, Tw.taryard, ...Tw.mills, Tw.races, Tw.gatePad]) if (Math.hypot(x - Pd.x, z - Pd.z) < Pd.r + 3 + pad) return false;
    if (Math.hypot(x - Tw.tower.x, z - Tw.tower.z) < 6 + pad || Math.hypot(x - Tw.gatehouse.x, z - Tw.gatehouse.z) < 9 + pad) return false;
    if (Math.hypot(x - Tw.grave.x, z - Tw.grave.z) < 5 || Math.hypot(x - Tw.caravan.x, z - Tw.caravan.z) < 6) return false;
    const R = Tw.ropewalk; if (x > R.x0 - 4 - pad && x < R.x1 + 4 + pad && Math.abs(z - R.z) < R.hw + 3 + pad) return false;
    for (const Pd of Tw.ponds) if (Math.abs(x - Pd.x) < Pd.hx + 3 + pad && Math.abs(z - Pd.z) < Pd.hz + 3 + pad) return false;
    if (tidewaterCreek(x, z).d < 4.5 + pad) return false;
    const Q = Tw.quay; if (x > Q.x0 - 4 && x < Q.x1 + 4 && z > Q.z0 - 8 && z < Q.z1 + 2) return false;
    if (DUNGEONS.some((Dg) => Math.hypot(x - Dg.door.x, z - Dg.door.z) < 10 + pad)) return false;
    // (P13.5) the glade where the valley plants its own row (Chapter 44, the twplant objects): no old tree over the young poles
    if (OBJECTS.some((o) => o.kind === 'twplant' && Math.hypot(x - o.x, z - o.z) < 4.6 + pad)) return false;
    // (P14.5) the valley's own nursery beside it (Chapter 48, the twnurse beds): kept clear too
    if (OBJECTS.some((o) => o.kind === 'twnurse' && Math.hypot(x - o.x, z - o.z) < 3.4 + pad)) return false;
    for (const [hx, hz] of huts) if (Math.hypot(x - hx, z - hz) < 6 + pad) return false;
    if (Math.hypot(x - (Tw.taryard.x + 5.5), z - (Tw.taryard.z - 17)) < 6 + pad) return false; // (the tar house)
    return true;
  };
  {
    const R = Tw.rows, rng = mulberry32(1380);
    let ri = 0;
    for (let x = R.x0; x <= R.x1; x += R.dx, ri++) for (let z = R.z0 + (ri % 2) * R.dz / 2; z <= R.z1; z += R.dz) {
      if (tidewaterGap(x, z) > -3 || !keepClear(x, z, 1)) continue;
      const salt = saltK(x, z), roll = rng();
      if (salt > 0.55 || (salt > 0.3 && roll < salt)) put('twdead' + Math.floor(rng() * 3), x, z, rng() * 6, 0.9 + rng() * 0.2, 0.1);
      else if (roll < 0.06) put('twstump', x, z, rng() * 6, 1, 0.05);
      else put('twpine' + Math.floor(rng() * 4), x, z, rng() * 6, 0.92 + rng() * 0.16, 0.1);
    }
    // the rows on the south ridge, across the water: straight rows up the slope, the lowest one killed by the salt
    ri = 0;
    for (let x = 452; x <= 640; x += 8, ri++) {
      const foot = soundSouthZ(x);
      for (let k = 0, z = foot + 10 + (ri % 2) * 3; k < 9; k++, z += 6) {
        const h = tidewaterHeight(x, z);
        if (h > 42 || tidewaterShore(x, z) > -6) continue;
        const nx = tidewaterHeight(x + 1.5, z) - tidewaterHeight(x - 1.5, z), nz = tidewaterHeight(x, z + 1.5) - tidewaterHeight(x, z - 1.5);
        if (Math.hypot(nx, nz) / 3 > 1.1) continue;
        if (k === 0) put('twdead' + Math.floor(rng() * 3), x, z, rng() * 6, 0.9, 0.2);
        else put('twpine' + Math.floor(rng() * 4), x, z, rng() * 6, 0.95 + rng() * 0.15, 0.2);
      }
    }
  }

  // ---------------------------------------------------------------- scatter over the shore
  {
    let rng = mulberry32(1);
    const seed = (a, b2) => { rng = mulberry32(Math.imul(a + 41, 73856093) ^ Math.imul(b2 + 43, 19349663) ^ 0x7d3); };
    const pick = (base, n) => base + Math.floor(rng() * n);
    const cell = 5.5;
    for (let iz = 0, gz = Tw.minZ + 16; gz < Tw.maxZ - 16; iz++, gz += cell) for (let ix = 0, gx = Tw.minX + 16; gx < Tw.maxX - 16; ix++, gx += cell) {
      seed(ix, iz);
      const x = gx + rng() * cell, z = gz + rng() * cell, h = tidewaterHeight(x, z), s = tidewaterShore(x, z);
      if (s > -1 || h < 0.6 || !keepClear(x, z) || rowsK(x, z) > 0.3) continue;
      const roll = rng(), ex = 0.85 + rng() * 0.5, ry = rng() * PI * 2;
      const nx = tidewaterHeight(x + 1, z) - tidewaterHeight(x - 1, z), nz = tidewaterHeight(x, z + 1) - tidewaterHeight(x, z - 1), slope = Math.hypot(nx, nz) / 2;
      if (slope > 0.6) { if (roll < 0.22) put(pick('twboulder', 2), x, z, ry, ex * 1.2, 0.3); continue; }
      if (s > -14 || h < 1.6) { if (roll < 0.2) put(pick('twstone', 4), x, z, ry, ex * 0.8, 0.15); else if (roll < 0.16 && logFree(x, z)) put(pick('twlog', 3), x, z, ry, ex * 0.8, 0.15); continue; } // the shingle
      if (z > soundAxisZ(x)) { if (roll < 0.1) put(pick('twboulder', 2), x, z, ry, ex); continue; } // the ridge's foot
      // (dressing pass) the salt grass thicker, low gorse in the lee of the land, stones, and wood chips about the mills
      const mill = Tw.mills.some((M) => Math.hypot(x - M.x, z - M.z) < 22);
      if (roll < 0.34) put(pick('twgrass', 3), x, z, ry, ex, 0);
      else if (roll < 0.41 && saltK(x, z) < 0.3) put(pick('twgorse', 2), x, z, ry, ex, 0.05);
      else if (roll < 0.48) put(pick('twstone', 4), x, z, ry, ex * 0.7);
      else if (roll < 0.53 && mill) put('twchips', x, z, ry, 0.45 + rng() * 0.3, 0.12);
    }
    // salt grass along the creeks and the top of the flats
    for (let i = 0; i < 360; i++) {
      seed(997, i);
      const x = 500 + rng() * 92, z = soundNorthZ(x) - 6 + rng() * 10;
      if (!keepClear(x, z, -2) && tidewaterCreek(x, z).d > 2) continue;
      const h = tidewaterHeight(x, z); if (h < 1.0 || h > 3.6) continue;
      put(pick('twgrass', 3), x, z, rng() * 6, 0.6 + rng() * 0.5, 0);
    }
  }

  // ---------------------------------------------------------------- (second dressing pass) the camp's and the yards' open ground
  // the plain ground between the props broken up: rope laid out to dry in straight parallel lines, more timber stacked
  // parallel (each group all one way, side by side, never crossing), rushes and low tufts as single cards along the house
  // walls, the path edges and the yards' margins. Every piece is checked clear of the colliders, the tracks, the square,
  // the people, nodes and quest objects, the water and steep ground; placed after everything else so it sees them all.
  {
    const rng = mulberry32(1399);
    const people = [...NPCS, ...NODES, ...OBJECTS].filter((e) => typeof e.x === 'number' && Math.abs(e.x - 500) < 140 && Math.abs(e.z + 2600) < 70);
    // the townsfolk's work spots and walks (townsfolk.js): kept clear for the stacks
    const walks = [[[466, -2590], [474, -2597], [470, -2585], [462, -2595], [477, -2590], [466, -2590]], [[490, -2627.5], [468, -2603], [478, -2596]], [[482, -2571], [472, -2588], [484, -2592]],
      [[441.5, -2583.5], [442.9, -2584.4]], [[431, -2583.2], [436, -2591]], [[530.6, -2605.5], [544, -2593]], [[581, -2606.5], [582, -2603.5], [587.5, -2596]], [[576.6, -2608.5], [576.6, -2608.5]]];
    const segD = (Pl, x, z) => { let d = 1e9; for (let i = 0; i < Pl.length - 1; i++) { const [ax, az] = Pl[i], [bx, bz] = Pl[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0; d = Math.min(d, Math.hypot(ax + dx * t - x, az + dz * t - z)); } return d; };
    const mine = []; // (the rope lines laid here: points along each, kept clear by what follows)
    const blocked = (x, z, pad) => {
      for (const [mx, mz] of mine) if (Math.abs(mx - x) < 0.9 + pad && Math.abs(mz - z) < 0.9 + pad) return true;
      for (const c of S.colliders) if (Math.abs(c.x - x) < c.r + pad && Math.hypot(c.x - x, c.z - z) < c.r + pad) return true;
      for (const bx of W.boxes) { const dx = x - bx.x, dz = z - bx.z; if (Math.abs(dx) > bx.hw + bx.hd + pad + 1 || Math.abs(dz) > bx.hw + bx.hd + pad + 1) continue; const c = Math.cos(bx.rot || 0), s = Math.sin(bx.rot || 0), lx = dx * c - dz * s, lz = dx * s + dz * c; if (Math.abs(lx) < bx.hw + pad && Math.abs(lz) < bx.hd + pad) return true; }
      return false;
    };
    // a footprint (points along a line through x,z at turn ry, half length hl) clear of everything, on level dry ground
    const clear = (x, z, ry, hl, pad, roadPad, solid) => {
      const c = Math.cos(ry), s = Math.sin(ry);
      let lo = 1e9, hi = -1e9;
      for (let t = -hl; t <= hl + 1e-6; t += Math.max(0.5, hl / 6)) {
        const px = x + c * t, pz = z - s * t, h = H(px, pz);
        lo = Math.min(lo, h); hi = Math.max(hi, h);
        if (blocked(px, pz, pad) || tidewaterPathDist(px, pz) < roadPad || tidewaterShore(px, pz) > -5 || tidewaterCreek(px, pz).d < 5.5 || h < 1.9) return false;
        if (Math.hypot(px - C.x, pz - C.z) < 10 || tidewaterGround(px, pz).cobble > 0.15) return false;
        if (people.some((e) => Math.hypot(e.x - px, e.z - pz) < 3.2) || DUNGEONS.some((Dg) => Math.hypot(Dg.door.x - px, Dg.door.z - pz) < 8)) return false;
        if (solid && walks.some((Wk) => segD(Wk, px, pz) < 1.8)) return false;
        for (const Pd of Tw.ponds) if (Math.abs(px - Pd.x) < Pd.hx + 2 && Math.abs(pz - Pd.z) < Pd.hz + 2) return false;
        const R = Tw.ropewalk; if (px > R.x0 - 2 && px < R.x1 + 2 && Math.abs(pz - R.z) < R.hw + 1.5) return false;
      }
      return hi - lo < (solid ? 0.35 : 0.22);
    };
    // a group of n pieces side by side (spaced sp apart across their length), all at one turn; tries spots round (cx, cz)
    const group = (cx, cz, rad, ry, n, sp, hl, solid, putOne) => {
      for (let k = 0; k < 70; k++) {
        const a = rng() * PI * 2, rr = k ? Math.sqrt(rng()) * rad : 0, x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
        const nx = Math.sin(ry), nz = Math.cos(ry), spots = [];
        for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * sp; spots.push([x + nx * o, z + nz * o]); }
        if (!spots.every(([sx, sz]) => clear(sx, sz, ry, hl, solid ? 0.7 : 0.9, solid ? 3.0 : 2.4, solid))) continue;
        spots.forEach(([sx, sz], i) => { putOne(sx, sz, i); if (!solid) for (let t = -hl; t <= hl; t += 1) mine.push([sx + Math.cos(ry) * t, sz - Math.sin(ry) * t]); });
        return spots.length;
      }
      return 0;
    };
    const placed = { rope: 0, timber: 0 };
    // rope laid out to dry: in the camp's west and east grounds, behind the houses, by the tar yards and the ropewalk's ends
    for (const [cx, cz, rad, ry, n, v] of [[450, -2594, 5, PI / 2, 3, 0], [484, -2580, 5, 0, 2, 0], [466, -2581, 3.5, 0.15, 2, 1], [494, -2610, 6, 0, 3, 0], [422, -2602, 6, 0.5, 3, 1], [426, -2577, 6, 0.3, 2, 1], [470, -2615, 5, 0, 2, 0]]) {
      placed.rope += group(cx, cz, rad + 3, ry, n, 1.75, 3.6, false, (x, z) => put('twropeline' + v, x, z, ry + (rng() - 0.5) * 0.04, 1, 0.02));
    }
    // more timber stacked parallel: squared timber and round logs side by side in each yard, each group all one way
    for (const [cx, cz, rad, ry, n, kind] of [[449, -2594, 6, PI / 2, 2, 0], [494, -2592, 5, PI / 2, 2, 1], [424, -2594, 6, 0.1, 2, 0], [442, -2578, 6, 0, 2, 1], [546, -2588, 7, 0, 3, 0], [590, -2610, 6, PI / 2, 2, 1], [556, -2612, 5, 0, 2, 0]]) {
      placed.timber += group(cx, cz, rad, ry, n, kind ? 3.2 : 2.4, 2.8, true, (x, z, i) => place(kind ? logPile(1400 + placed.timber + i, 5.2, 4) : timberStack(1410 + placed.timber + i, 4.6, 3 + (i % 2), 2 + ((i + 1) % 2)), x, z, ry + (rng() - 0.5) * 0.03, 0));
    }
    // rushes and low tufts in clumps over the open ground of the camp, the tar yards and the mill yards: thicker along the
    // house walls and the edges of the tracks, none on the paving, the tar-black ground, the mud or the middle of a track
    let tufts = 0;
    for (const [x0, x1, z0, z1] of [[420, 504, -2630, -2568], [516, 592, -2622, -2580]]) for (let gz = z0; gz < z1; gz += 2.4) for (let gx = x0; gx < x1; gx += 2.4) {
      const x = gx + rng() * 2.4, z = gz + rng() * 2.4, roll = rng();
      if (tidewaterShore(x, z) > -4 || tidewaterCreek(x, z).d < 4 || H(x, z) < 1.7 || blocked(x, z, 0.5)) continue;
      const g = tidewaterGround(x, z);
      if (g.cobble > 0.2 || g.foundry > 0.35 || g.mud > 0.3 || g.path > 0.6 || g.sand > 0.55) continue;
      const R = Tw.ropewalk; if (x > R.x0 - 1 && x < R.x1 + 1 && Math.abs(z - R.z) < R.hw + 0.5) continue;
      if (Tw.ponds.some((Pd) => Math.abs(x - Pd.x) < Pd.hx + 1 && Math.abs(z - Pd.z) < Pd.hz + 1)) continue;
      const wall = blocked(x, z, 2.2), edge = g.path > 0.2;
      if (roll > (wall ? 0.75 : edge ? 0.6 : 0.36)) continue;
      const n = 1 + Math.floor(rng() * (wall ? 3 : 2));
      for (let i = 0; i < n; i++) {
        const tx = x + (rng() - 0.5) * 2.2, tz = z + (rng() - 0.5) * 2.2;
        if (blocked(tx, tz, 0.4)) continue;
        put((wall && rng() < 0.6) || rng() < 0.2 ? 'twrush' + Math.floor(rng() * 3) : 'twtuft' + Math.floor(rng() * 3), tx, tz, rng() * PI * 2, 0.8 + rng() * 0.45, 0.02);
        tufts++;
      }
    }
    // the shingle paths (painted grey in tidewaterGround): stones laid along each, a stride apart, off the house walls
    let stones = 0;
    for (const Pl of SHINGLE) for (let i = 0; i < Pl.length - 1; i++) {
      const [ax, az] = Pl[i], [bx, bz] = Pl[i + 1], L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(-(bz - az), bx - ax);
      for (let t = 0.4; t < L; t += 0.85 + rng() * 0.3) {
        const x = ax + (bx - ax) * (t / L) + (rng() - 0.5) * 0.4, z = az + (bz - az) * (t / L) + (rng() - 0.5) * 0.4;
        if (blocked(x, z, 0.2)) continue;
        put('twshingle' + Math.floor(rng() * 3), x, z, ry + (rng() - 0.5) * 0.6, 0.9 + rng() * 0.3, 0.03); stones++;
      }
    }
    W.tidewaterDress2 = { ...placed, tufts, stones };
  }

  // ---------------------------------------------------------------- the tide
  // the sea sheet and the ship follow tideLevel() (the shared tide clock: the client sets it to the server's time); the mill
  // wheels turn while the tide runs through their creeks, one way on the flood and the other on the ebb, still at slack water
  {
    const sea = W.tidewaterSea, ship = W.tidewaterShip, T0 = Tw.tide, maxRate = (T0.amp * 2 * PI) / T0.period;
    let last = null;
    W.tidewaterTick = (dt) => {
      const L = tideLevel();
      if (sea) sea.position.y = L + 0.02;
      if (ship) ship.position.y = L;
      if (W.tidewaterPools) W.tidewaterPools.visible = L < T0.dry - 0.15;
      const rate = last === null || dt <= 0 ? 0 : (L - last) / dt; last = L;
      for (const wh of wheels) {
        const wet = smooth01((L - wh.bed - 0.25) / 0.6);
        const tgt = wet * Math.max(-1, Math.min(1, rate / maxRate)) * 0.45;
        wh.w += (tgt - wh.w) * Math.min(1, dt * 0.8);
        if (Math.abs(wh.w) > 1e-4) { wh.a += wh.w * dt; wh.g.rotation.x = wh.a; }
      }
    };
    W.tidewaterTick(0);
  }
}
const smooth01 = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
