// The Windward Heights (Part Twelve): the plateau's dressing, built into the world's heightsGroup (World.buildHeights), and the
// lift's foot on the Rime Steps' Dam Crown (buildRimeLift, called from World.buildRime into the rimeGroup).
//   the counterweight lift: a timber landing deck out over the west cliff, a square timber headframe with a solid drum on its
//   cap beams, the cage, the counterweight in its own bay · the Windward Camp (square flat-roofed cold-stone houses, a wind
//   wall, a sheltered fire) · the Makers' wind engines on the Engine Rows' pads (square timber-and-iron towers, flat-topped
//   caps, three broad flat sail-boards on a solid round hub; still until the story restarts them, W.setEnginesTurning) ·
//   the Makers' Rest workshop (a long low flat-roofed stone building, shut) · drifts, rimed rock and wind-glazed ice · the
//   cloud sea round the plateau
// Content rules: no domes, arches, spires, crosses, stars, sunbursts or spoked wheels. Every roof is flat; tower bracing runs
// one way per bay (a zigzag, never an X); the sail-boards are an odd number of broad flat boards on a solid hub (never thin
// spokes, never a star outline), checked from the front and from straight above.
import * as THREE from 'three';
import * as P from '../assets/props.js';
import { Builder, box, rbox, cyl, lumpy, sphere, ico } from '../assets/kit.js';
import { addRock } from '../assets/trees.js';
import { HEIGHTS, heightsHeight, heightsPathDist, heightsZone, heightsEdge, hollowGapK } from '/sunmere-play/shared/heights.js';
import { RIME } from '/sunmere-play/shared/rime.js';
import { DUNGEONS } from '/sunmere-play/shared/dungeons.js';
import { mulberry32 } from '/sunmere-play/shared/noise.js';
import { G } from '../engine/globals.js';
import { markDynamic } from './freeze.js';
import { stoneBlock, cistern, stoneBench, sacks } from './reachLayout.js';
import { cold, roofSnow, icicles, sluiceHouse, timberShed, frostRock, iceBlock, iceSlab, drift } from './rimeLayout.js';
import { nearHouse } from './villageLayout.js';

const PI = Math.PI;
const ST = '#a8adb4', ST_D = '#6a7078', ST_L = '#c8ccd2', TIMBER = '#6a5038', SNOW = '#f4f7fb', IRON = '#3a3c40';
const res = (b, extra = {}) => ({ builder: b, fires: [], glows: [], lanterns: [], smokes: [], colliders: [], ...extra });
const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _q = new THREE.Quaternion();
// a square beam from point a to point c (local coordinates), w thick
function beam(b, a, c, w, mat = 'beam', col = 0xffffff) {
  _d.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const L = _d.length(); _q.setFromUnitVectors(_up, _d.normalize());
  b.add(box(w, L, w), mat, { p: [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2], q: _q.clone(), c: col });
}

// ------------------------------------------------------------------ the wind engine
// The tower (a scatter prefab; local: origin on the pad, the rotor faces -x, into the west wind): four square timber legs
// leaning in, girts at each storey, one diagonal per bay (alternating, a zigzag), iron plates at the joints, a boarded pump
// house at the foot, a platform and a flat-roofed cap house on top, a tail beam with a flat vane behind.
const ENG = { h: 12, base: 2.1, top: 1.3, hub: [-2.75, 13.15, 0], R: 1.05, L: 5.0, W: 1.9, n: 3 };
function engineTower(seed) {
  const b = new Builder(seed), E = ENG;
  const hw = (y) => E.base + (E.top - E.base) * (y / E.h);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) beam(b, [sx * E.base, -0.4, sz * E.base], [sx * E.top, E.h, sz * E.top], 0.34);
  const levels = [0.4, 3.2, 6.2, 9.2, E.h - 0.1];
  for (const [li, y] of levels.entries()) {
    const w = hw(y);
    for (const s of [-1, 1]) {
      b.add(box(w * 2 + 0.3, 0.24, 0.24), 'beam', { p: [0, y, s * w], c: 0xffffff });
      b.add(box(0.24, 0.24, w * 2 + 0.3), 'beam', { p: [s * w, y, 0], c: 0xffffff });
      for (const t of [-1, 1]) b.add(box(0.3, 0.36, 0.3), 'wIron', { p: [t * w, y, s * w], c: '#44464a' });
    }
    if (li > 0 && li < levels.length - 1) for (const s of [-1, 1]) b.add(box(w * 2 + 0.2, 0.07, 0.16), 'snowPack', { p: [0, y + 0.15, s * w], c: SNOW });
  }
  // short knee braces in the top corners of each bay instead of full diagonals: a diagonal on the near and far faces
  // read as a big X when you look through the open tower (content rules)
  for (let i = 0; i < levels.length - 1; i++) {
    // short gussets, and only on two adjacent faces (never on a face and the one opposite, which line up into an X
    // when seen through the tower)
    const y0 = levels[i] + 0.15, y1 = levels[i + 1] - 0.15, yk = y1 - Math.min(1.2, (y1 - y0) * 0.16), wk = hw(yk), w1 = hw(y1), s = i % 2 ? 1 : -1;
    for (const t of [-1, 1]) {
      beam(b, [t * wk, yk, s * wk], [t * w1 * 0.78, y1, s * w1], 0.13);
      beam(b, [-s * wk, yk, t * wk], [-s * w1, y1, t * w1 * 0.78], 0.13);
    }
  }
  // the pump house: plank walls round the foot, a flat plank roof, a door on the east side, the pump rod up the middle
  {
    const h = 2.7, w = E.base - 0.15;
    for (const s of [-1, 1]) { b.add(box(w * 2, h, 0.12), 'woodDark', { p: [0, h / 2 - 0.3, s * w], c: TIMBER }); b.add(box(0.12, h, w * 2), 'woodDark', { p: [s * w, h / 2 - 0.3, 0], c: TIMBER }); }
    b.add(box(w * 2 + 0.6, 0.18, w * 2 + 0.6), 'wood', { p: [0, h - 0.2, 0], c: '#7a6048' });
    roofSnow(b, w * 2 + 0.2, w * 2 + 0.2, h - 0.15);
    b.add(box(0.08, 1.9, 1.1), 'wood', { p: [w + 0.08, 0.65, 0], c: '#86684a' });
    b.add(box(0.06, 0.1, 1.0), 'wIron', { p: [w + 0.13, 0.9, 0], c: IRON });
    b.add(cyl(0.09, 0.09, E.h - 2.4, 8), 'wIron', { p: [0, E.h / 2 + 1.1, 0], c: '#4a4c50' });
  }
  // the platform and the cap house: square, flat-roofed, timber over an iron frame; snow on the roof, icicles off the eaves
  b.add(box(E.top * 2 + 1.0, 0.24, E.top * 2 + 1.0), 'wood', { p: [0, E.h + 0.12, 0], c: '#7a6048' });
  for (const s of [-1, 1]) { b.add(box(E.top * 2 + 1.0, 0.5, 0.1), 'beam', { p: [0, E.h + 0.5, s * (E.top + 0.45)], c: 0xffffff }); b.add(box(0.1, 0.5, E.top * 2 + 1.0), 'beam', { p: [s * (E.top + 0.45), E.h + 0.5, 0], c: 0xffffff }); }
  b.add(box(2.6, 2.0, 2.8), 'woodDark', { p: [0.1, E.h + 1.24, 0], c: '#5e4630' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.16, 2.04, 0.16), 'wIron', { p: [0.1 + sx * 1.3, E.h + 1.24, sz * 1.4], c: IRON });
  b.add(box(3.1, 0.22, 3.3), 'wood', { p: [0.1, E.h + 2.35, 0], c: '#7a6048' });
  b.add(box(3.15, 0.1, 3.35), 'wIron', { p: [0.1, E.h + 2.2, 0], c: IRON });
  roofSnow(b, 2.9, 3.1, E.h + 2.36);
  icicles(b, -1.45, -1.62, -1.45, 1.62, E.h + 2.1, 7, 0.5);
  icicles(b, 1.65, -1.62, 1.65, 1.62, E.h + 2.1, 6, 0.4);
  // the shaft out through the cap's front to the hub, in a square iron bearing block
  b.add(box(0.7, 0.7, 0.7), 'wIron', { p: [-1.3, E.hub[1], 0], c: '#44464a' });
  b.add(cyl(0.2, 0.2, 1.6, 10), 'wIron', { p: [-1.95, E.hub[1], 0], r: [0, 0, PI / 2], c: '#3e4044' });
  // the tail beam and its flat vane (keeps the sails into the wind)
  b.add(box(3.4, 0.24, 0.24), 'beam', { p: [2.9, E.h + 1.4, 0], c: 0xffffff });
  b.add(box(1.8, 1.5, 0.1), 'wood', { p: [4.4, E.h + 1.55, 0], c: '#8a6e50' });
  b.add(box(1.85, 0.1, 0.14), 'wIron', { p: [4.4, E.h + 2.3, 0], c: IRON });
  // a stone trough at the foot where the pumped water ran out (iced over)
  b.add(box(2.4, 0.6, 0.9), 'stoneDark', { p: [2.9, 0.1, 1.2], c: ST_D });
  b.add(box(2.1, 0.08, 0.6), 'iceBlue', { p: [2.9, 0.42, 1.2], c: '#ffffff' });
  b.add(cyl(0.1, 0.1, 1.2, 8), 'wIron', { p: [2.3, 0.6, 1.2], r: [0, 0, PI / 2], c: '#4a4c50' });
  // drifts banked against the windward legs
  b.add(lumpy(sphere(1.6, 12, 8), 0.22, 1.3, seed + 3, { flatBottom: 0 }), 'snowPack', { p: [-2.2, -0.2, 0.6], s: [1.1, 0.55, 2.0], c: SNOW, uv: 'box' });
  return { builder: b, collider: { r: 2.4 } };
}
// the rotor (local: axis along x, hub at the origin, the boards in the y-z plane): a solid round hub of timber under an iron
// face plate, and three broad flat sail-boards, each a plank panel in a timber frame with battens, bolted on at the hub's rim
function engineRotor(seed) {
  const b = new Builder(seed), E = ENG;
  b.add(cyl(E.R, E.R, 0.8, 28), 'woodDark', { r: [0, 0, PI / 2], c: '#5a4430' });
  b.add(cyl(E.R + 0.06, E.R + 0.06, 0.3, 28), 'wIron', { p: [0.12, 0, 0], r: [0, 0, PI / 2], c: '#3c3e42' });
  b.add(cyl(0.78, 0.7, 0.3, 24), 'wIron', { p: [-0.5, 0, 0], r: [0, 0, PI / 2], c: '#4a4c50' });
  b.add(cyl(0.34, 0.3, 0.3, 16), 'wIron', { p: [-0.75, 0, 0], r: [0, 0, PI / 2], c: '#36383c' });
  const pitch = 0.22, r0 = E.R - 0.15 + E.L / 2;
  for (let i = 0; i < E.n; i++) {
    const a = (i / E.n) * PI * 2, o = (pr, ry = 0) => ({ p: [0, Math.cos(a) * pr, Math.sin(a) * pr], r: [a, pitch + ry, 0], order: 'XYZ' });
    // the panel, its two stiles and three battens; a broad iron root plate where it meets the hub
    const P0 = o(r0);
    b.add(box(0.1, E.L, E.W), 'wood', { ...P0, c: '#9a7e5c' });
    for (const s of [-1, 1]) {
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(a, pitch, 0, 'XYZ'));
      const off = new THREE.Vector3(0, 0, s * (E.W / 2 - 0.08)).applyMatrix4(m);
      b.add(box(0.22, E.L + 0.1, 0.16), 'beam', { p: [off.x, Math.cos(a) * r0 + off.y, Math.sin(a) * r0 + off.z], r: [a, pitch, 0], order: 'XYZ', c: 0xffffff });
    }
    for (const t of [-0.32, 0.05, 0.42]) {
      const pr = r0 + t * E.L;
      b.add(box(0.2, 0.16, E.W + 0.06), 'beam', { ...o(pr), c: 0xffffff });
    }
    b.add(box(0.26, 0.8, E.W * 0.8), 'wIron', { ...o(E.R + 0.2), c: '#44464a' });
  }
  return b;
}

// ------------------------------------------------------------------ the lift
// the cage (local: its floor's centre at the origin, open on the east side): a plank floor, four square corner posts, rails
// on three sides, a plank roof, an iron eye where the rope takes it
function liftCage(seed) {
  const b = new Builder(seed), s = 1.5, h = 2.6;
  b.add(box(s * 2, 0.16, s * 2), 'wood', { p: [0, -0.08, 0], c: '#8a7058' });
  b.add(box(s * 2 + 0.1, 0.24, s * 2 + 0.1), 'wIron', { p: [0, -0.26, 0], c: IRON });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.18, h, 0.18), 'beam', { p: [sx * s, h / 2, sz * s], c: 0xffffff });
  for (const y of [0.55, 1.1]) {
    b.add(box(0.12, 0.12, s * 2), 'beam', { p: [-s, y, 0], c: 0xffffff });
    for (const sz of [-1, 1]) b.add(box(s * 2, 0.12, 0.12), 'beam', { p: [0, y, sz * s], c: 0xffffff });
  }
  b.add(box(0.1, 0.9, s * 2 - 0.2), 'woodDark', { p: [-s, 0.45, 0], c: TIMBER });
  b.add(box(s * 2 + 0.3, 0.16, s * 2 + 0.3), 'wood', { p: [0, h + 0.08, 0], c: '#7a6048' });
  roofSnow(b, s * 2, s * 2, h + 0.1);
  for (const sz of [-1, 1]) b.add(box(s * 2 + 0.3, 0.14, 0.2), 'wIron', { p: [0, h + 0.22, sz * 0.5], c: IRON });
  b.add(box(0.36, 0.36, 0.36), 'wIron', { p: [0, h + 0.5, 0], c: '#4a4c50' });
  b.add(box(0.06, 0.05, s * 2), 'wIron', { p: [s, 1.1, 0], c: IRON }); // a gate chain across the open side
  return b;
}
// the counterweight: an iron-bound timber box of stone (local: its centre at the origin)
function counterweight(seed) {
  const b = new Builder(seed);
  b.add(box(1.5, 2.4, 1.5), 'stoneDark', { c: ST_D });
  for (const y of [-1.0, 0, 1.0]) b.add(box(1.62, 0.18, 1.62), 'wIron', { p: [0, y, 0], c: IRON });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.16, 2.5, 0.16), 'wIron', { p: [sx * 0.76, 0, sz * 0.76], c: '#44464a' });
  b.add(box(0.3, 0.4, 0.3), 'wIron', { p: [0, 1.4, 0], c: '#4a4c50' });
  return b;
}
// a solid drum on an axle along local z (local: the axle's centre), iron bands at its ends, a square iron boss on each face
function drum(seed, R, len) {
  const b = new Builder(seed);
  b.add(cyl(R, R, len, 26), 'woodDark', { r: [PI / 2, 0, 0], c: '#5a4430' });
  for (const s of [-1, 1]) b.add(cyl(R + 0.08, R + 0.08, 0.16, 26), 'wIron', { p: [0, 0, s * (len / 2 - 0.05)], r: [PI / 2, 0, 0], c: IRON });
  for (const s of [-1, 1]) b.add(box(0.5, 0.5, 0.2), 'wIron', { p: [0, 0, s * (len / 2 + 0.08)], c: '#4a4c50' });
  // a flat iron strap straight across the drum (one, so a turning drum shows it turning)
  b.add(box(0.14, R * 2 + 0.06, len - 0.4), 'wIron', { c: '#44464a' });
  return b;
}
const ropeGeo = new THREE.CylinderGeometry(0.045, 0.045, 1, 6).translate(0, 0.5, 0);
const ropeMat = new THREE.MeshStandardMaterial({ color: 0x2e2c2a, roughness: 0.6, metalness: 0.4 });
function rope() { const m = new THREE.Mesh(ropeGeo, ropeMat); m.castShadow = true; return m; }

// the moving parts of one lift end: the cage, its rope, the counterweight and its rope, the drum(s). rig.set(off) puts the
// cage off metres from its rest (negative = below), the counterweight moving the other way, the drums turning to match.
function liftRig(o) {
  const g = new THREE.Group();
  const cage = liftCage(o.seed).build(); cage.position.set(o.cage[0], o.cage[1], o.cage[2]); g.add(cage);
  const cw = counterweight(o.seed + 1).build(); g.add(cw);
  const dA = drum(o.seed + 2, o.drumR, o.drumLen).build(); dA.position.fromArray(o.drum); g.add(dA);
  let dB = null;
  if (o.cwDrum) { dB = drum(o.seed + 3, 0.6, 1.0).build(); dB.position.fromArray(o.cwDrum); g.add(dB); }
  const rC = rope(), rW = rope(); g.add(rC, rW);
  const cwTop = (o.cwDrum || o.drum)[1] - (o.cwDrum ? 0.6 : o.drumR);
  g.userData.set = (off) => {
    cage.position.y = o.cage[1] + off;
    const top = cage.position.y + 3.0, bot = o.drum[1] - o.drumR;
    rC.position.set(o.cage[0], top, o.cage[2]); rC.scale.y = Math.max(0.05, bot - top);
    const cy = o.cw[1] - off * o.cwK;
    cw.position.set(o.cw[0], cy, o.cw[2]);
    rW.position.set(o.cw[0], cy + 1.6, o.cw[2]); rW.scale.y = Math.max(0.05, cwTop - (cy + 1.6));
    dA.rotation.z = off / o.drumR; if (dB) dB.rotation.z = off / o.drumR;
    g.userData.off = off;
  };
  g.userData.set(0);
  g.userData.cagePos = () => cage.getWorldPosition(new THREE.Vector3());
  return g;
}

// the landing deck, the headframe and the counterweight bay (world coordinates, origin at the deck's west end)
function liftLanding(W) {
  const F = HEIGHTS.lift, top = F.top, zc = (F.z0 + F.z1) / 2, L = F.x1 - F.x0, b = new Builder(610), cols = [];
  const X = (x) => x - F.x0, Z = (z) => z - zc;
  // the deck: planks over three long beams and cross joists; a strip of old snow along the north rail
  b.add(box(L, 0.18, F.z1 - F.z0), 'wood', { p: [L / 2, top - 0.09, 0], c: '#9a8a74', us: 1 });
  b.add(box(L - 2, 0.05, 0.9), 'snowPack', { p: [L / 2 + 1, top + 0.01, Z(F.z0) + 0.6], c: SNOW });
  for (const z of [-3.2, 0, 3.2]) b.add(box(L + 0.4, 0.42, 0.32), 'beam', { p: [L / 2, top - 0.4, z], c: 0xffffff });
  for (let x = 0.5; x < L; x += 2) b.add(box(0.26, 0.3, F.z1 - F.z0 + 0.4), 'beam', { p: [x, top - 0.72, 0], c: 0xffffff });
  // struts back into the cliff face under the overhang, iron shoes where they bite the rock
  for (const z of [-3.2, 3.2]) for (const [x0, x1, y1] of [[1, 11, 46], [5, 12.4, 52], [9, 13.6, 56.5]]) {
    beam(b, [x0, top - 0.6, z], [x1, y1, z], 0.34);
    b.add(box(0.7, 0.5, 0.6), 'wIron', { p: [x1, y1, z], c: IRON });
  }
  for (const z of [-3.2, 3.2]) b.add(box(0.3, 0.3, 0.3), 'beam', { p: [7, top - 4.2, z], c: 0xffffff });
  beam(b, [3, top - 3.0, -3.2], [3, top - 3.0, 3.2], 0.26); beam(b, [8, top - 5.5, -3.2], [8, top - 5.5, 3.2], 0.26);
  // footings on the rock where the deck comes ashore
  for (const x of [15, 19, 23]) for (const z of [-3.2, 3.2]) b.add(box(0.9, 1.4, 0.9), 'stoneColdDark', { p: [x, top - 1.3, z], c: ST_D });
  // rails: square posts and a top rail along both sides (from the headframe to the shore), a plain rail across the west end
  for (const sz of [-1, 1]) {
    const z = sz * 3.35;
    for (let x = 6.4; x <= 20.5; x += 2) b.add(box(0.16, 1.15, 0.16), 'beam', { p: [x, top + 0.57, z], c: 0xffffff });
    b.add(box(14.4, 0.12, 0.14), 'beam', { p: [13.4, top + 1.1, z], c: 0xffffff });
    b.add(box(14.4, 0.1, 0.12), 'beam', { p: [13.4, top + 0.55, z], c: 0xffffff });
    b.add(box(14.4, 0.07, 0.16), 'snowPack', { p: [13.4, top + 1.2, z], c: SNOW });
    cols.push({ x: 13.4, z, hw: 7.2, hd: 0.12 });
  }
  b.add(box(0.14, 0.12, 6.7), 'beam', { p: [0.15, top + 1.1, 0], c: 0xffffff });
  for (const z of [-3.2, -1.6, 0, 1.6, 3.2]) b.add(box(0.16, 1.15, 0.16), 'beam', { p: [0.15, top + 0.57, z], c: 0xffffff });
  // the headframe: four square posts round the cage from the cliff foot to the cap beams, girts and one diagonal per bay,
  // and a counterweight bay on its north side; the drum on the cap beams over the cage, a smaller drum over the counterweight
  const hx = [0, 4], hz = [-2.4, 2.4], wz = [-8.4, -4.4], y0 = 34, yT = top + 9.6;
  for (const x of hx) for (const z of [...hz, ...wz]) {
    b.add(box(0.42, yT - y0, 0.42), 'beam', { p: [x, (yT + y0) / 2, z], c: 0xffffff });
    if (z > -3) cols.push({ x, z, r: 0.35 });
  }
  for (const y of [top - 8, top - 2.2, top + 3.2, top + 6.6, yT]) {
    for (const x of hx) beam(b, [x, y, -8.4], [x, y, 2.4], 0.28);
    for (const z of [...hz, ...wz]) beam(b, [0, y, z], [4, y, z], 0.28);
  }
  {
    const ys = [top + 0.3, top + 3.2, top + 6.6, yT];
    for (let i = 0; i < ys.length - 1; i++) { const d = i % 2 ? 1 : -1; for (const z of [-8.4, 2.4]) beam(b, [d > 0 ? 0 : 4, ys[i], z], [d > 0 ? 4 : 0, ys[i + 1], z], 0.18); }
  }
  // the counterweight's guide rails, iron on timber, down the bay into the cloud
  for (const x of [1.25, 2.75]) b.add(box(0.14, yT - y0, 0.14), 'wIron', { p: [x, (yT + y0) / 2, -6.4], c: '#44464a' });
  // the cap: a plank floor on the cap beams, a low rail, the axle's bearing blocks, a brake lever by the cage
  b.add(box(4.6, 0.2, 11.4), 'wood', { p: [2, yT + 0.2, -3], c: '#7a6048' });
  b.add(box(4.4, 0.08, 11), 'snowPack', { p: [2, yT + 0.34, -3], s: [1, 1, 1], c: SNOW });
  for (const z of [-8.2, -4.6, -1.6, 1.6]) b.add(box(0.9, 0.7, 0.6), 'wIron', { p: [2, yT + 0.65, z], c: '#44464a' });
  b.add(cyl(0.14, 0.14, 11, 10), 'wIron', { p: [2, yT + 1.1, -3.1], r: [PI / 2, 0, 0], c: '#3a3c40' });
  b.add(box(0.5, 0.5, 0.5), 'wIron', { p: [5.3, top + 0.25, 2.9], c: '#44464a' });
  beam(b, [5.3, top + 0.4, 2.9], [5.8, top + 1.6, 2.9], 0.12, 'wIron', '#5a5c60');
  b.add(box(0.2, 0.2, 0.2), 'wGlowAmber', { p: [5.84, top + 1.7, 2.9] });
  W.placeAt(cold(res(b, { colliders: cols, glows: [{ p: [2, yT + 2.2, 2.6], color: 0xffb060, size: 2.6, intensity: 0.55 }] })), F.x0, 0, zc, 0);
  // the moving parts
  const rig = liftRig({ seed: 620, cage: [F.cage.x, top, F.cage.z], drum: [F.cage.x, yT + 1.1, F.cage.z], drumR: 0.95, drumLen: 2.2, cwDrum: [F.cage.x, yT + 1.1, zc - 6.4], cw: [F.cage.x, top - 6, zc - 6.4], cwK: 0.35 });
  rig.name = 'heightsLift';
  W.heightsGroup.add(rig);
  return rig;
}

// the lift's foot on the Rime Steps: a levelled stone plinth cut into the slope under the north wall, a tall square headframe
// over the cage (girts, one diagonal per bay), the counterweight bay on its west side, the drum on its cap beams, and the two
// ropes running up the wall from the drum to an iron anchor block on the crest, where the climb goes on toward the Heights
export function buildRimeLift(W) {
  const L = HEIGHTS.rimeLift, F = L.foot, T = W.terrain, floor = 40.7, b = new Builder(640), cols = [];
  const ox = F.x, oz = F.z, yT = floor + 15;
  b.add(box(5.6, 3.2, 5.6), 'stoneCold', { p: [0, floor - 1.6, 0], c: ST, us: 0.45 });
  b.add(box(5.9, 0.2, 5.9), 'stoneColdLarge', { p: [0, floor - 0.1, 0], c: ST_L });
  b.add(box(6.2, 6, 1.0), 'stoneColdDark', { p: [0, floor + 1.5, -3.3], c: ST_D }); // the retaining wall at the back
  for (const sx of [-1, 1]) b.add(box(1.0, 4, 3.8), 'stoneColdDark', { p: [sx * 3.1, floor + 0.6, -1.2], c: ST_D });
  // two steps down to the ice at the front
  b.add(box(3.2, 0.3, 0.8), 'stoneColdLarge', { p: [0, floor - 0.5, 3.2], c: ST_L });
  b.add(box(3.2, 0.3, 0.8), 'stoneColdLarge', { p: [0, floor - 0.95, 3.9], c: ST_L });
  const hx = [-2.2, 2.2], hz = [-2.2, 2.2];
  for (const x of [...hx, -5.2]) for (const z of hz) b.add(box(0.4, yT - floor + 0.2, 0.4), 'beam', { p: [x, (yT + floor) / 2, z], c: 0xffffff });
  for (const y of [floor + 3.2, floor + 7, floor + 11, yT]) {
    for (const x of hx) beam(b, [x, y, -2.2], [x, y, 2.2], 0.26);
    for (const z of hz) beam(b, [-2.2, y, z], [2.2, y, z], 0.26);
    for (const z of hz) beam(b, [-5.2, y, z], [-2.2, y, z], 0.24);
    beam(b, [-5.2, y, -2.2], [-5.2, y, 2.2], 0.24);
  }
  { const ys = [floor + 3.2, floor + 7, floor + 11, yT]; for (let i = 0; i < ys.length - 1; i++) { const yk = ys[i + 1] - 0.7, x = hx[i % 2]; for (const t of [-1, 1]) beam(b, [x, yk, 2.2 * t], [x, ys[i + 1], 1.5 * t], 0.15); } } // knee braces, no crossing diagonals (content rules)
  for (const z of [-0.9, 0.9]) b.add(box(0.12, yT - floor, 0.12), 'wIron', { p: [-3.7, (yT + floor) / 2, z], c: '#44464a' });
  b.add(box(8.2, 0.2, 5.2), 'wood', { p: [-1.5, yT + 0.2, 0], c: '#7a6048' });
  roofSnow(b, 7.8, 4.8, yT + 0.25);
  icicles(b, -5.5, 2.6, 2.6, 2.6, yT + 0.1, 16, 0.7);
  for (const x of [-4.5, -1.4, 1.4]) b.add(box(0.6, 0.7, 0.9), 'wIron', { p: [x, yT + 0.65, 0], c: '#44464a' });
  b.add(cyl(0.14, 0.14, 7.4, 10), 'wIron', { p: [-1.6, yT + 1.1, 0], r: [0, 0, PI / 2], c: '#3a3c40' });
  b.add(box(0.7, 0.5, 0.6), 'wGlowAmber', { p: [2.5, floor + 2.4, 2.3] });
  // the ropes up the wall to the anchor block on the crest (the climb's next leg), over a sheave frame part way up; both
  // legs are lifted until they clear the ground along their whole run
  {
    const gy = (z) => T.height(ox, oz + z), r0 = [yT + 1.1, -0.9], zA = -18.5, zS = -10.5;
    const A = [gy(zA) + 2.6, zA];
    let Sy = gy(zS) + 3.2;
    const clear = (a, c) => { for (let k = 0.05; k < 1; k += 0.05) { const z = a[1] + (c[1] - a[1]) * k, y = a[0] + (c[0] - a[0]) * k; if (y < gy(z) + 0.5) return false; } return true; };
    for (let i = 0; i < 40 && !(clear(r0, [Sy, zS]) && clear([Sy, zS], A)); i++) { Sy += 0.25; A[0] += 0.1; }
    for (const s of [-0.5, 0.5]) { beam(b, [s, r0[0], r0[1]], [s, Sy, zS], 0.09, 'wIron', '#2e2c2a'); beam(b, [s, Sy, zS], [s, A[0] - 0.3, zA], 0.09, 'wIron', '#2e2c2a'); }
    const sg = gy(zS);
    for (const sx of [-1.1, 1.1]) b.add(box(0.36, Sy - sg + 0.8, 0.36), 'beam', { p: [sx, (Sy + sg) / 2 - 0.2, zS], c: 0xffffff });
    b.add(box(2.6, 0.3, 0.4), 'beam', { p: [0, Sy - 0.2, zS], c: 0xffffff });
    b.add(cyl(0.3, 0.3, 1.6, 14), 'wIron', { p: [0, Sy + 0.1, zS], r: [0, 0, PI / 2], c: '#3e4044' });
    const ag = gy(zA);
    b.add(box(2.6, A[0] - ag + 1.2, 2.0), 'stoneColdDark', { p: [0, (A[0] + ag) / 2 - 0.6, zA], c: ST_D });
    b.add(box(2.0, 0.8, 1.0), 'wIron', { p: [0, A[0] + 0.1, zA], c: '#44464a' });
    b.add(box(2.4, 0.16, 1.8), 'snowPack', { p: [0, A[0] + 0.58, zA], c: SNOW });
  }
  cols.push({ x: 0, z: -0.5, hw: 2.6, hd: 2.7 }, { x: -3.7, z: 0, hw: 1.7, hd: 2.4 });
  W.placeAt(cold(res(b, { colliders: cols, glows: [{ p: [2.5, floor + 2.4, 2.6], color: 0xffb060, size: 2.4, intensity: 0.55 }] })), ox, 0, oz, F.ry);
  const rig = liftRig({ seed: 650, cage: [ox, floor, oz], drum: [ox - 1.6 + 1.6, yT + 1.1, oz], drumR: 0.9, drumLen: 2.2, cwDrum: null, cw: [ox - 3.7, floor + 9, oz], cwK: 0.5 });
  // (the foot's drum turns on the axle along x: swap the drum and rope frame round for that)
  rig.children[2].rotation.order = 'YXZ'; rig.children[2].rotation.y = PI / 2;
  rig.name = 'rimeLift';
  W.rimeGroup.add(rig);
  W.liftRigs = W.liftRigs || {};
  W.liftRigs.rime = rig;
}

// ------------------------------------------------------------------ the cloud sea
// two layers round the plateau: a billowing opaque deck at HEIGHTS.cloud (lit from the sun by its own slope) and a thin,
// faster wisp layer a little above it that breaks up the line where the deck meets the cliffs. Fogged into the sky.
const NOISE = /* glsl */ `
  float hh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
  float fb(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += vn(p) * a; p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;
function cloudLayer(cx, cz, y, size, segs, opts) {
  const g = new THREE.PlaneGeometry(size, size, segs, segs); g.rotateX(-PI / 2);
  const m = new THREE.ShaderMaterial({
    transparent: !!opts.wisp, depthWrite: !opts.wisp, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTop: { value: new THREE.Color(opts.top) }, uShade: { value: new THREE.Color(opts.shade) }, uSun: { value: new THREE.Vector3(0.4, 0.8, 0.3) }, uAmp: { value: opts.amp }, uSpeed: { value: opts.speed }, uScale: { value: opts.scale }, uAlpha: { value: opts.alpha ?? 1 } }]),
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime, uAmp, uSpeed, uScale; varying vec3 vW; varying float vH;
      ${NOISE}
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vec2 q = w.xz * uScale + vec2(uTime * uSpeed, uTime * uSpeed * 0.35);
        float n = fb(q) ; vH = n;
        w.y += (n - 0.5) * uAmp * 2.0;
        vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform vec3 uTop, uShade, uSun; uniform float uTime, uSpeed, uScale, uAlpha; varying vec3 vW; varying float vH;
      ${NOISE}
      void main() {
        vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); if (n.y < 0.0) n = -n;
        float lit = clamp(dot(n, normalize(uSun)) * 0.6 + 0.5, 0.0, 1.0);
        vec2 q = vW.xz * uScale * 3.1 + vec2(uTime * uSpeed * 1.6, 0.0);
        float d = fb(q);
        vec3 c = mix(uShade, uTop, clamp(vH * 0.9 + lit * 0.55 + d * 0.25 - 0.15, 0.0, 1.0));
        float a = uAlpha;
        ${opts.wisp ? 'a *= smoothstep(0.5, 0.75, fb(vW.xz * uScale * 1.7 + vec2(uTime * uSpeed * 2.2, 3.0)) + d * 0.2);' : ''}
        gl_FragColor = vec4(c, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  m.uniforms.uTime = G.time;
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(cx, y, cz);
  mesh.frustumCulled = false;
  mesh.renderOrder = opts.wisp ? 4 : 0;
  mesh.userData.setSun = (v) => m.uniforms.uSun.value.copy(v);
  return mesh;
}
export function createCloudSea(sunDir) {
  const H = HEIGHTS, cx = (H.minX + H.maxX) / 2, cz = (H.minZ + H.maxZ) / 2, g = new THREE.Group();
  g.name = 'heightsClouds';
  const deck = cloudLayer(cx, cz, H.cloud - 1.2, 3600, 220, { top: '#ffffff', shade: '#9fb2c8', amp: 2.2, speed: 0.045, scale: 0.012 });
  const wisp = cloudLayer(cx, cz, H.cloud + 2.6, 1400, 120, { top: '#ffffff', shade: '#c4d2e2', amp: 2.6, speed: 0.11, scale: 0.018, wisp: true, alpha: 0.75 });
  deck.userData.setSun(sunDir); wisp.userData.setSun(sunDir);
  g.add(deck, wisp);
  return g;
}

// ------------------------------------------------------------------ scatter prefabs
function bigDrift(seed) {
  const b = new Builder(seed);
  b.add(lumpy(sphere(2.4, 16, 8), 0.2, 1.0, seed, { flatBottom: 0 }), 'snowPack', { p: [0, -0.4, 0], s: [b.r(1.6, 2.4), 0.42, b.r(0.7, 1.0)], c: SNOW, uv: 'box' });
  return { builder: b };
}
// a rock scoured bare by the wind, rime feathered on its windward (west) face
function rimeRock(seed, tint = '#5e6268') {
  const b = new Builder(seed);
  const n = 1 + (seed % 3);
  for (let i = 0; i < n; i++) {
    const s = i === 0 ? 1 : 0.55, px = i ? b.r(-1, 1) : 0, pz = i ? b.r(-1, 1) : 0, sy = b.r(0.5, 1.0) * s;
    addRock(b, [px, 0, pz], [b.r(0.8, 1.6) * s, sy, b.r(0.8, 1.4) * s], seed * 7 + i, { mat: 'rock', moss: 0, tint });
    b.add(lumpy(ico(0.5 * s, 1), 0.2, 2, seed * 3 + i, { flatBottom: 0 }), 'ice', { p: [px - 0.7 * s, sy * 0.6, pz], s: [0.5, 1.0, 1.3], c: '#ffffff' });
  }
  return { builder: b, collider: { r: 1.1 } };
}
// a snow pole: a square timber post with an iron cap and a strip of rag-tied marker board, to find the road in a white-out
function snowPole(seed) {
  const b = new Builder(seed);
  b.add(box(0.16, 2.6, 0.16), 'beam', { p: [0, 1.2, 0], c: 0xffffff });
  b.add(box(0.22, 0.12, 0.22), 'wIron', { p: [0, 2.55, 0], c: IRON });
  b.add(box(0.06, 0.5, 0.22), 'cloth', { p: [0.1, 2.15, 0], c: '#b04a2a' });
  b.add(lumpy(sphere(0.4, 8, 6), 0.2, 2, seed, { flatBottom: 0 }), 'snowPack', { p: [-0.15, 0, 0], s: [1.2, 0.5, 1], c: SNOW, uv: 'box' });
  return { builder: b, collider: { r: 0.25 } };
}
// a stack of spare sail-boards under an iron-weighted cover (the Windwrights' stores), and a tidy labelled crate stack
function boardStack(seed) {
  const b = new Builder(seed);
  for (let i = 0; i < 5; i++) b.add(box(4.6, 0.12, 1.8), 'wood', { p: [b.r(-0.1, 0.1), 0.35 + i * 0.13, b.r(-0.05, 0.05)], c: '#9a7e5c' });
  for (const x of [-1.8, 0, 1.8]) b.add(box(0.2, 0.3, 2.0), 'beam', { p: [x, 0.15, 0], c: 0xffffff });
  b.add(box(4.8, 0.06, 1.95), 'cloth', { p: [0, 1.04, 0], c: '#7a7468' });
  b.add(box(4.6, 0.12, 1.7), 'snowPack', { p: [0, 1.12, 0], c: SNOW });
  return { builder: b, collider: { r: 1.6 } };
}
function labelledCrates(seed) {
  const b = new Builder(seed);
  for (const [x, z, y, s] of [[0, 0, 0, 1], [1.05, 0.1, 0, 0.9], [0.4, 0, 0.95, 0.85]]) {
    b.add(rbox(1.0 * s, 0.95 * s, 1.0 * s, 0.04), 'wood', { p: [x, y + 0.47 * s, z], c: '#8a6e50' });
    b.add(box(0.5 * s, 0.26 * s, 0.03), 'plaster', { p: [x, y + 0.55 * s, z + 0.51 * s], c: '#ece4d0' });
    b.add(box(0.36 * s, 0.03, 0.04), 'wDark', { p: [x, y + 0.58 * s, z + 0.53 * s], c: '#3a3028' });
  }
  return { builder: b, collider: { r: 1.1 } };
}

// the iron bar across the workshop door, in the workshop's own frame (its staples stay on the building)
function workshopBar() {
  const b = new Builder(803);
  b.add(box(3.4, 0.16, 0.12), 'wIron', { p: [0, 1.25, 7 / 2 + 0.2], c: IRON });
  return res(b);
}

// ------------------------------------------------------------------ the Makers' Rest workshop: long, low, flat-roofed, shut
function workshop(seed) {
  const r = stoneBlock(seed, { w: 16, d: 7, h: 3.8, plinth: 1.5, door: 2.4, wins: 0, sideWins: 0, pipes: false, tint: ST });
  const b = r.builder, w = 16, d = 7, h = 3.8;
  roofSnow(b, w - 0.3, d - 0.3, h + 0.22);
  icicles(b, -w / 2 - 0.2, d / 2 + 0.28, w / 2 + 0.2, d / 2 + 0.28, h - 0.15, 24, 0.7);
  // the door: two square staples for its iron bar (the bar itself is workshopBar, lifted per player once Kamal has lifted
  // it in Chapter 40, W.setRestOpen), and a painted board over it
  for (const s of [-1, 1]) b.add(box(0.2, 0.3, 0.2), 'wIron', { p: [s * 1.55, 1.25, d / 2 + 0.14], c: '#44464a' });
  b.add(box(2.6, 0.5, 0.08), 'plaster', { p: [0, 3.25, d / 2 + 0.12], c: '#e4dccb' });
  for (let i = 0; i < 5; i++) b.add(box(0.28, 0.06, 0.04), 'wDark', { p: [-0.9 + i * 0.45, 3.25, d / 2 + 0.17], c: '#3a3028' });
  // shuttered windows along the front and the back (plank shutters, an iron bar each)
  for (const sz of [-1, 1]) for (const x of [-6, -3.4, 3.4, 6]) {
    b.add(box(1.1, 1.2, 0.12), 'woodDark', { p: [x, 2.0, sz * (d / 2 + 0.06)], c: TIMBER });
    b.add(box(1.2, 0.08, 0.06), 'wIron', { p: [x, 2.0, sz * (d / 2 + 0.14)], c: IRON });
    b.add(box(1.3, 0.14, 0.4), 'stoneColdLarge', { p: [x, 2.7, sz * (d / 2 + 0.16)], c: ST_L });
  }
  // a square vent stack, cold, and a run of roof lights boarded over
  b.add(box(0.9, 1.4, 0.9), 'stoneColdDark', { p: [w / 2 - 1.4, h + 0.8, -d / 2 + 1.2], c: ST_D });
  b.add(box(1.1, 0.14, 1.1), 'wIron', { p: [w / 2 - 1.4, h + 1.55, -d / 2 + 1.2], c: IRON });
  for (const x of [-4.5, 0, 4.5]) b.add(box(2.0, 0.3, 1.4), 'woodDark', { p: [x, h + 0.42, -0.5], c: '#5e4630' });
  return r;
}

// ------------------------------------------------------------------ the area
export function buildHeights(W, S) {
  const T = W.terrain, Hs = HEIGHTS;
  const H = (x, z) => T.height(x, z);
  const put = (key, x, z, r = 0, s = 1, sink = 0.05) => S.place(key, x, H(x, z) - sink, z, r, s);
  const pre = (key, r2) => { if (!S.prefabs.has(key)) S.addPrefab(key, r2); };
  const place = (r2, x, z, ry = 0, yOff = 0) => W.placeObject(cold(r2), x, z, ry, yOff);
  for (let v = 0; v < 4; v++) pre('hrock' + v, rimeRock(v + 701));
  for (let v = 0; v < 2; v++) pre('hboulder' + v, rimeRock(v + 711, '#72767c'));
  for (let v = 0; v < 3; v++) pre('hfrock' + v, frostRock(v + 721, '#5a5e64'));
  for (let v = 0; v < 3; v++) pre('hdrift' + v, drift(v + 731));
  for (let v = 0; v < 3; v++) pre('hbigdrift' + v, bigDrift(v + 741));
  for (let v = 0; v < 2; v++) pre('hiceslab' + v, iceSlab(v + 751));
  for (let v = 0; v < 2; v++) pre('hiceblock' + v, iceBlock(v + 756));
  pre('hpole', snowPole(761));
  pre('hboards', boardStack(762));
  pre('hcrates', labelledCrates(763));
  pre('lantern', P.lanternPost(764, 'yellow'));
  pre('crates', P.crateStack(765));
  pre('sacks', sacks(766));
  pre('bench', stoneBench(767));
  pre('wengine', engineTower(770));

  // ---------------------------------------------------------------- the lift landing (and its rig)
  W.liftRigs = W.liftRigs || {};
  W.liftRigs.heights = liftLanding(W);

  // ---------------------------------------------------------------- the Windward Camp
  const C = Hs.camp;
  const face = (x, z) => Math.atan2(C.x - x, C.z - z);
  // the bunkhouse, the storehouse and the Windwrights' house: enterable works houses (shared/houses.js wh_*)
  W.buildHouses('heights');
  { const x = 440.5, z = -2112.5; place(timberShed(783, 5.4, 3.4, 2.8), x, z, face(x, z)); put('hboards', x - 0.2, z + 0.3, face(x, z) + PI / 2, 0.8); } // spare sail-boards
  place(cistern(784), 446, -2106, 0.3);
  place(P.campfire(785), 450.5, -2093.5, 0);
  for (const a of [-125, -55, 35, 100, 155]) { const r = a * PI / 180; put('lantern', C.x + Math.cos(r) * 10.5, C.z + Math.sin(r) * 10.5, -r); }
  put('bench', 448, -2091, 2.4); put('bench', 453.5, -2089.5, 3.4);
  for (const [x, z, r] of [[467.5, -2108, 0.4], [478, -2108.5, 1.2], [437.5, -2092, 2.0]]) if (!nearHouse(x, z, 0.6)) put('crates', x, z, r); // (off the house doorsteps)
  for (const [x, z, r] of [[469.5, -2118.5, 1.1], [446, -2081.5, 2.6]]) put('sacks', x, z, r);
  put('hcrates', 470.5, -2096, 0.2);
  // two of the crew's ridge tents pitched in the lee of the houses (slate canvas, a plain ridge line from above), each with
  // its stores beside it, so the open snow round the yard is lived in rather than one bare apron
  for (const [x, z, k] of [[463.5, -2117.5, 0], [451.5, -2083.2, 1]]) {
    if (nearHouse(x, z, 1.2)) continue;
    place(P.raiderTent(797 + k, 0.82, ['#66727e', '#525c66', '#7e8a96', '#2e363e']), x, z, face(x, z) + (k ? 0.25 : -0.2));
    put(k ? 'sacks' : 'crates', x + (k ? -2.6 : 2.8), z + (k ? 0.6 : 0.9), 0.5 + k);
  }
  { const c = Hs.caravan; place(P.cart(786), c.x + 4, c.z + 3.5, 0.5); put('crates', c.x + 6.5, c.z, 0.7); }
  { const g = Hs.grave; put('bench', g.x, g.z - 1.6, 0); put('lantern', g.x + 2.2, g.z - 1.2, 0.4); }
  // the wind wall: a low cold-stone wall round the camp's windward (west) side, open where the road comes through
  {
    const wall = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), b = new Builder(Math.round(x0 * 3 - z0));
      b.add(box(len, 1.4, 0.7), 'stone', { p: [0, 0.35, 0], c: ST }); b.add(box(len + 0.1, 0.16, 0.86), 'stoneLarge', { p: [0, 1.1, 0], c: ST_L });
      b.add(box(len, 0.14, 0.7), 'snowPack', { p: [0, 1.25, 0], c: SNOW });
      b.add(lumpy(sphere(1, 10, 6), 0.2, 1.2, Math.round(len * 7), { flatBottom: 0 }), 'snowPack', { p: [0, 0, -0.9], s: [len * 0.55, 0.9, 0.9], c: SNOW, uv: 'box' });
      for (let t = -len / 2; t <= len / 2 + 0.01; t += len / Math.max(1, Math.round(len / 4))) b.add(box(0.9, 1.8, 0.9), 'stoneDark', { p: [t, 0.6, 0], c: ST_D });
      W.placeObject(cold(res(b, { colliders: [{ x: 0, z: 0, hw: len / 2, hd: 0.45 }] })), (x0 + x1) / 2, (z0 + z1) / 2, -Math.atan2(z1 - z0, x1 - x0));
    };
    wall(436, -2082, 434, -2094.5); wall(434, -2105.5, 436, -2118); wall(452, -2078, 438, -2080.5);
  }
  // snow shovelled off the square into banks round its edge
  for (const [x, z, r, s] of [[462, -2124, 0.2, 1.3], [478, -2122, 2.4, 1.1], [440, -2076, 1.0, 1.2], [480, -2080, 0.6, 1.0]]) put('hdrift' + (Math.round(x) % 3), x, z, r, s, 0.25);
  // the camp square: a worked yard of squared slabs laid in courses (running joints, never a grid of crossings), worn and
  // patched, with a band of big dark setts where the road crosses it, a kerb of long stones with gaps for the road and the
  // houses, snow blown in against the kerbs and over the windward slabs, and the day's work stacked about the edges
  {
    const cx = 456.5, cz = -2099.5, ry = 0.08, half = 8.4, y0 = H(cx, cz), cr = Math.cos(ry), sr = Math.sin(ry);
    const wx = (lx, lz) => cx + lx * cr + lz * sr, wz = (lx, lz) => cz - lx * sr + lz * cr; // local yard -> world (yard turned by ry)
    const dy = (lx, lz) => H(wx(lx, lz), wz(lx, lz)) - y0;
    const rng = mulberry32(796), b = new Builder(796);
    const tones = ['#c4c8cd', '#cfd1d4', '#bcc1c7', '#d4d0ca', '#c8c4be', '#b8bec6'];
    const fire = [450.5 - cx, -2093.5 - cz]; // keep the fire ring on bare ground
    const slab = (lx, lz, w, d, col, t = 0.12, rise = 0.05, mat = 'stoneLarge') => b.add(rbox(w, t, d, 0.03), mat, { p: [lx, dy(lx, lz) + rise - t / 2, lz], c: col, uv: 'box' });
    // the trodden ground, swept clear: the road through the square (its edges ragged where the brooms stopped) and a few
    // worked patches beside it, by the fire, at Kamal's stand and in front of the store. Slabs off them lie under the snow, so
    // the square shows as one worn band with bays off it (never arms from the middle, never a disc).
    const bays = [[450.5, -2093.5, 3.6], [461, -2095.5, 2.6], [465.5, -2105.5, 2.8], [452, -2105, 2.2]];
    const trod = (lx, lz) => { const x = wx(lx, lz), z = wz(lx, lz); return Math.abs(z + 2100) < 1.8 + 0.7 * Math.sin(x * 0.9) * Math.sin(x * 0.37 + 1) || bays.some(([qx, qz, r]) => Math.hypot(x - qx, z - qz) < r); };
    // courses run east-west (along the road); each course is 0.9-1.2 m deep, its slabs 0.8-2.0 m long, so the joints never line up
    for (let lz = -half; lz < half - 0.4;) {
      const d = 0.9 + rng() * 0.3, mz = lz + d / 2, road = Math.abs(wz(0, mz) + 2100) < 1.9;
      for (let lx = -half + (rng() * 0.6); lx < half - 0.3;) {
        const w = road ? 1.0 + rng() * 0.5 : 0.8 + rng() * 1.2, ww = Math.min(w, half - lx) - 0.07, mx = lx + ww / 2 + 0.035;
        if (ww > 0.3 && Math.hypot(mx - fire[0], mz - fire[1]) > 2.0) {
          if (trod(mx, mz)) {
            const col = road ? ['#9aa0a8', '#a2a6ac', '#949aa2'][Math.floor(rng() * 3)] : tones[Math.floor(rng() * tones.length)];
            slab(mx, mz, ww, d - 0.07, col, 0.12, road ? 0.04 : 0.05 + (rng() - 0.5) * 0.025);
          } else if (rng() < 0.12) slab(mx, mz, ww, d - 0.07, tones[Math.floor(rng() * tones.length)], 0.12, 0.05); // a slab swept clear for work
          else slab(mx, mz, ww + 0.14, d + 0.08, SNOW, 0.16 + rng() * 0.08, 0.09 + rng() * 0.06, 'snowPack'); // snow lying on the slab
        }
        lx += w;
      }
      lz += d;
    }
    // inset flagstones: big dark setts of the Makers' own set into the road where it crosses (laid before the camp's slabs)
    for (const [lx, lz, w, d] of [[-5.0, -0.5, 2.0, 1.8], [-0.8, -0.3, 2.2, 1.9], [4.6, -0.6, 1.9, 1.8]]) slab(lx, lz, w, d, '#7e848c', 0.14, 0.075);
    // the kerb: long squared stones round the square, with gaps for the road (west and east) and the way to the bunkhouse
    const kerb = (x0, z0, x1, z1) => {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 1.7)), a = Math.atan2(-(z1 - z0), x1 - x0);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, lx = x0 + (x1 - x0) * t, lz = z0 + (z1 - z0) * t;
        b.add(rbox(L / n - 0.08, 0.26, 0.34, 0.03), 'stoneDark', { p: [lx, dy(lx, lz) + 0.06, lz], r: [0, a, 0], c: rng() < 0.5 ? '#6a7078' : '#62686f', uv: 'box' });
      }
    };
    const k = half + 0.2;
    kerb(-k, -k, k, -k); // north side, whole
    kerb(-k, k, -2.6, k); kerb(0.4, k, k, k); // south side, a gap for the way past the bunkhouse
    kerb(-k, -k, -k, -2.4); kerb(-k, 2.0, -k, k); // west side, the road comes in
    kerb(k, -k, k, -2.4); kerb(k, 2.0, k, k); // east side, the road goes on
    // snow blown in over the kerbs and banked in the corners, low and lumpy, so the square's edge never reads as one line
    for (const [lx, lz, sx, sz, rr] of [[-8.2, -6.0, 2.6, 1.3, 0.2], [-7.9, 5.6, 2.4, 1.5, -0.3], [-3.2, -8.6, 2.2, 1.0, 0.1], [7.8, 7.4, 2.0, 1.2, 0.5],
      [2.6, 8.6, 2.6, 1.0, 0], [6.9, -8.2, 1.8, 1.1, -0.4], [-8.9, 8.9, 2.0, 2.0, 0.8], [8.9, -8.9, 1.8, 1.6, 0.3]]) {
      b.add(lumpy(sphere(1, 12, 6), 0.3, 2.2, Math.round(lx * 13 + lz * 7), { flatBottom: 0 }), 'snowPack', { p: [lx, dy(lx, lz) - 0.02, lz], s: [sx, 0.34, sz], r: [0, rr, 0], c: SNOW, uv: 'box' });
    }
    // a stone gutter along the north kerb, iced, to carry the meltwater off the square
    b.add(box(2 * half - 1.0, 0.06, 0.4), 'ice', { p: [0.2, dy(0, -half + 0.45) + 0.04, -half + 0.45], c: '#cfe4f0' });
    place(res(b), cx, cz, ry, 0);
    // the day's work about the square's edges, clear of the road through it, the fire and the men standing in it
    put('crates', 463.6, -2096.4, 0.3); put('sacks', 459.2, -2106.8, 1.9); put('hboards', 452.6, -2106.9, 0.08, 0.7);
    put('hcrates', 449.2, -2104.4, 1.65, 0.8); put('crates', 464.2, -2105.6, 2.9, 0.85);
  }

  // ---------------------------------------------------------------- the wind engines on the Engine Rows
  const engines = [];
  {
    const rotor = engineRotor(790).geometries(), rng = mulberry32(791);
    for (const Pd of Hs.pads) {
      const x = Pd.x + 1.2, z = Pd.z, y = H(Pd.x, Pd.z) - 0.05, ry = (rng() - 0.5) * 0.08;
      S.place('wengine', x, y, z, ry, 1);
      const hx = x + ENG.hub[0] * Math.cos(ry), hz = z - ENG.hub[0] * Math.sin(ry);
      engines.push({ x: hx, y: y + ENG.hub[1], z: hz, ry, a: rng() * PI * 2, w: 0, on: false, pad: Pd });
    }
    const meshes = rotor.map(({ geo, mat }) => { const m = new THREE.InstancedMesh(geo, mat, engines.length); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; markDynamic(m); W.heightsGroup.add(m); return m; }); // (v115 review: they turn: dynamic casters, engine/shadowCache.js)
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Qa = new THREE.Quaternion(), Pv = new THREE.Vector3(), Sv = new THREE.Vector3(1, 1, 1), X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
    const write = () => {
      engines.forEach((e, i) => {
        Q.setFromAxisAngle(Y, e.ry).multiply(Qa.setFromAxisAngle(X, e.a));
        M.compose(Pv.set(e.x, e.y, e.z), Q, Sv);
        for (const m of meshes) m.setMatrixAt(i, M);
      });
      for (const m of meshes) m.instanceMatrix.needsUpdate = true;
    };
    write();
    W.heightsEngines = engines;
    // per-player story progress sets the engines turning: a count (the first n, ridge by ridge, north to south) or a list of
    // booleans, one per pad. They spin up and run down slowly.
    W.setEnginesTurning = (n) => { engines.forEach((e, i) => { e.on = Array.isArray(n) ? !!n[i] : i < (n | 0); }); };
    W.heightsTick = (dt) => {
      let moving = false;
      for (const e of engines) {
        const tgt = e.on ? 0.85 + 0.15 * Math.sin(e.pad.z * 0.37) : 0;
        e.w += (tgt - e.w) * Math.min(1, dt * 0.35);
        if (Math.abs(e.w) > 1e-4) { e.a += e.w * dt; moving = true; }
      }
      if (moving) write();
    };
  }

  // ---------------------------------------------------------------- the Makers' Rest workshop
  {
    const Wk = Hs.workshop;
    place(workshop(800), Wk.x + 0.5, Wk.z, -PI / 2, 0);
    // the door's iron bar: shown until this player's Kamal has lifted it (Chapter 40 "Lift the Bar", game.js)
    const bar = place(workshopBar(), Wk.x + 0.5, Wk.z, -PI / 2, 0);
    W.setRestOpen = (open) => { bar.visible = !open; };
    place(timberShed(801, 5, 3.2, 2.6), Wk.x + 1, Wk.z + 11.2, PI);
    put('hboards', Wk.x - 5.5, Wk.z + 9.5, 0.1, 0.9);
    put('hcrates', Wk.x - 5.5, Wk.z - 8.5, 1.6);
    put('hcrates', Wk.x - 6.2, Wk.z - 6.2, 0.4, 0.9);
    put('lantern', Wk.x - 5.5, Wk.z + 3.4, PI / 2);
    put('lantern', Wk.x - 5.5, Wk.z - 3.4, PI / 2);
    // a tidy stack of squared timber and a hand cart left square to the wall
    const b = new Builder(802);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4 - i; j++) b.add(box(4.2, 0.36, 0.36), 'beam', { p: [0, 0.2 + i * 0.37, (j - (3 - i) / 2) * 0.4], c: 0xffffff });
    b.add(box(4.2, 0.08, 1.4), 'snowPack', { p: [0, 1.25, 0], c: SNOW });
    place(res(b, { collider: { r: 1.4 } }), Wk.x + 6.5, Wk.z - 12, 0.05);
  }

  // ---------------------------------------------------------------- the cloud sea
  W.heightsGroup.add(createCloudSea(W.engine.sunDir));

  // ---------------------------------------------------------------- scatter over the plateau
  {
    let rng = mulberry32(1);
    const seed = (a, b2) => { rng = mulberry32(Math.imul(a + 31, 73856093) ^ Math.imul(b2 + 37, 19349663) ^ 0x7e1); };
    const pick = (base, n) => base + Math.floor(rng() * n);
    const F = Hs.lift;
    const keep = (x, z, pad = 0) => {
      if (heightsEdge(x, z) > -6 + pad) return false;
      if (Math.hypot(x - C.x, z - C.z) < C.r + 3 + pad) return false;
      if (heightsPathDist(x, z) < 4.5 + pad) return false;
      for (const Pd of Hs.pads) if (Math.hypot(x - Pd.x, z - Pd.z) < Pd.r + 3 + pad) return false;
      if (Math.hypot(x - Hs.workshop.x, z - Hs.workshop.z) < 16 + pad) return false;
      if (x < F.x1 + 10 && Math.abs(z - (F.z0 + F.z1) / 2) < 10) return false;
      if (Math.hypot(x - Hs.grave.x, z - Hs.grave.z) < 6) return false;
      if (Math.hypot(x - Hs.pumpHouse.x, z - Hs.pumpHouse.z) < Hs.pumpHouse.r + 4 + pad) return false; // the Pump Works' pump house
      if (DUNGEONS.some((Dg) => Math.hypot(x - Dg.door.x, z - Dg.door.z) < 10 + pad)) return false;
      return true;
    };
    const cell = 5.5;
    for (let iz = 0, gz = Hs.minZ + 16; gz < Hs.maxZ - 16; iz++, gz += cell) for (let ix = 0, gx = Hs.minX + 16; gx < Hs.maxX - 16; ix++, gx += cell) {
      seed(ix, iz);
      const x = gx + rng() * cell, z = gz + rng() * cell;
      if (!keep(x, z)) continue;
      const roll = rng(), zone = heightsZone(x, z), ex = 0.85 + rng() * 0.5, ry = rng() * PI * 2;
      const nx = heightsHeight(x + 1, z) - heightsHeight(x - 1, z), nz = heightsHeight(x, z + 1) - heightsHeight(x, z - 1), slope = Math.hypot(nx, nz) / 2;
      if (slope > 0.55) { if (roll < 0.22) put(pick('hrock', 4), x, z, ry, ex * 1.2, 0.3); else if (roll < 0.28) put(pick('hboulder', 2), x, z, ry, ex); continue; }
      if (zone === 'driftfields') {
        // long drifts lie across the wind (north-south), so the big lumps turn that way
        if (roll < 0.09) put(pick('hbigdrift', 3), x, z, PI / 2 + (rng() - 0.5) * 0.4, ex, 0.3);
        else if (roll < 0.15) put(pick('hdrift', 3), x, z, PI / 2 + (rng() - 0.5) * 0.6, ex, 0.2);
        else if (roll < 0.18) put(pick('hiceslab', 2), x, z, ry, ex * 0.7, 0.1);
        else if (roll < 0.2) put(pick('hfrock', 3), x, z, ry, ex * 0.8);
      } else if (zone === 'enginerows') {
        if (roll < 0.1) put(pick('hrock', 4), x, z, ry, ex);
        else if (roll < 0.14) put(pick('hboulder', 2), x, z, ry, ex * 0.9);
        else if (roll < 0.19) put(pick('hdrift', 3), x, z, PI / 2 + (rng() - 0.5) * 0.6, ex * 0.8, 0.2);
        else if (roll < 0.21) put(pick('hiceblock', 2), x, z, ry, ex * 0.6, 0.15);
      } else {
        if (roll < 0.14) put(pick('hrock', 4), x, z, ry, ex * 1.1);
        else if (roll < 0.2) put(pick('hboulder', 2), x, z, ry, ex);
        else if (roll < 0.24) put(pick('hdrift', 3), x, z, ry, ex, 0.2);
      }
    }
    // small stones and snow tufts everywhere
    for (let i = 0; i < 520; i++) {
      seed(977, i);
      const x = Hs.minX + 20 + rng() * (Hs.maxX - Hs.minX - 40), z = Hs.minZ + 20 + rng() * (Hs.maxZ - Hs.minZ - 40);
      if (!keep(x, z, -2)) continue;
      put(rng() < 0.55 ? pick('hfrock', 3) : pick('hdrift', 3), x, z, rng() * 6, 0.25 + rng() * 0.35, 0.08);
    }
    // the Makers' Rest rim: rimed boulders along its crest
    {
      const Ho = Hs.hollow;
      for (let i = 0; i < 46; i++) {
        seed(983, i);
        const a = rng() * PI * 2, dx = Math.cos(a);
        if (dx < -0.6) continue; // the open west mouth
        const k = 1 + 0.1 * Math.sin(2 * a + 0.7) + 0.07 * Math.sin(3 * a + 2.1) + 0.04 * Math.sin(5 * a + 0.4); // the rim's lobed outline (hollowDist)
        const d = (Ho.r + 4 + rng() * (Ho.rimW + 2)) * k, x = Ho.x + dx * d, z = Ho.z + Math.sin(a) * d;
        if (heightsEdge(x, z) > -4 || hollowGapK(x, z) > 0.2) continue; // the rim's worn gaps stay clear
        put(rng() < 0.6 ? pick('hboulder', 2) : pick('hrock', 4), x, z, rng() * 6, 0.9 + rng() * 0.8, 0.3);
      }
    }
    // snow poles along the road, both sides, every 14 m
    {
      const road = Hs.paths[0];
      seed(991, 0);
      for (let i = 0; i < road.length - 1; i++) {
        const [ax, az] = road[i], [bx, bz] = road[i + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
        for (let t = 3; t < L; t += 14) {
          const x0 = ax + (bx - ax) * (t / L), z0 = az + (bz - az) * (t / L);
          if (Math.hypot(x0 - C.x, z0 - C.z) < C.r + 2 || x0 < F.x1 + 4 || Math.hypot(x0 - Hs.workshop.x, z0 - Hs.workshop.z) < 14) continue;
          for (const sd of [-1, 1]) { const x = x0 + nx * sd * 3.6, z = z0 + nz * sd * 3.6; if (Hs.pads.some((Pd) => Math.hypot(x - Pd.x, z - Pd.z) < Pd.r + 2) || Math.hypot(x - Hs.pumpHouse.x, z - Hs.pumpHouse.z) < Hs.pumpHouse.r + 6) continue; put('hpole', x, z, rng() * 0.3, 1, 0.1); }
        }
      }
    }
  }
}
