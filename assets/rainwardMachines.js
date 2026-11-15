// Machines of the Rainward Gorge (Part Fourteen, levels 60-65): the Makers' nursery machines, still running unwound a
// lifetime after the last Seedwright wound them, cutting terraces to an old plan, pulling stumps that are long gone and
// boring drains into a hill that no longer drains. Oiled iron and timber in a dark wet green (variant 0) or old bronze gone
// green at the seams (variant 1); every one rain-dark, streaked where the water runs off it, red gorge mud caked on the
// treads, wheels and feet, moss on the old ones.
//  - Stump Puller: a tracked puller with a portal mast at the front and a grip of two flat square plates that close on a
//    stump and draw it out of the ground on the mast; the rare Mired Puller is mud to the deck and still holds the last
//    stump it pulled (a short cut butt, no roots) in its grip
//  - Terrace Cutter: a four-wheeled cutter with a solid cutting drum across its front under a flat hood, carried on two
//    straight side arms, a flat spoil chute down its right flank; the rare Moss-Grown Cutter is green with moss over every
//    top face, straight hanks of moss hung off its flanks
//  - Drain Borer: a tracked borer with a square boom down its centre line, a ram in it driving a head of plain stepped
//    discs (no teeth), a rack of straight clay drain pipes laid along its back
//  - Seed Drill: a row planter on two big solid wheels and a small front wheel, a square seed hopper over a bar of parallel
//    coulters (flat upright blades, one seed tube straight down to each), a plain press roller behind
//  - Slope Warden: a tall keeper of the slope on two straight telescoping legs with broad cleated pads, a retaining board
//    of laid planks for a shield, a long tamper with a flat square foot, a rack of upright stakes on its back
//  - The Hill Leveller (world boss): a great tracked cutting engine, its cutting drum across the bow on two side arms under
//    a flat hood, the engine house amidships, a straight spoil conveyor up its starboard side to a portal at the stern, the
//    winch house at the stern; about 13 m tall
// Same interface as the other machines: userData.machine = { update(dt, speed), attack(dur, kind), hit(), die(), revive(), stun }.
// Content rules: no faces (no lamps at all, no ports or slits; one gauge strip only, never a pair; vents only on backs
// and flanks), no animal shapes (grips are flat square plates and cutters solid drums, never claws, grips or beak-like
// blades; legs are straight columns that slide, they do not bend), no spokes (solid discs with an offset bolt plate), no
// teeth round a disc (the borer's head is plain stepped discs, the cutters' drums carry only hoops round them), no domes,
// rings, stars or radiating patterns; stacks and housings square from above; masts and gantries are portals (two posts and a
// flat beam), no braces, nothing crossed; pipes, stakes, planks, coulters and moss hanks lie parallel.
import * as THREE from 'three';
import { rbox, box, cyl, ico } from './kit.js';
import { rgb } from './kit.js';
import { plate, vent, stack, flywheel, heroTreads, crawl, wear, bolts, bdisc, sub } from './bossParts.js';
import { smoke } from './dynamic.js';
import { slotGlow } from './slotGlow.js';
import { Anim, finish, part, pivot } from './quarryMachines.js';

const PI = Math.PI;
const rb = (w, h, d, r) => rbox(w, h, d, r, 1);
const pl = (w, h, d, o = {}) => plate(w, h, d, { br: Math.max(0.032, Math.min(0.06, Math.min(w, h) * 0.05)), ...o });
const MUD = '#6a4a3a', MUD2 = '#7c5a44', MOSS = '#4e5e38', MOSS2 = '#5c6c40', WOOD = '#6a5640', WOOD2 = '#544534', BARK = '#5a4a3a', GRAIN = '#b89a72', DARK = '#262422', CLAY = '#9c6448', CLAY2 = '#8a5a42';

// palette per variant: 0 oiled iron and a dark wet green paint with a warm firebox glow; 1 old bronze, green at the seams
function pal(v) {
  return v ? { mat: 'wBronze', paint: '#c8ae84', paint2: '#aa926c', iron: '#544c44', trim: '#b89a62', glow: 'wGlowAmber', glowHex: 0xffb040, green: true }
    : { mat: 'wPaint', paint: '#56604f', paint2: '#465044', iron: '#3c3e3a', trim: '#9a8662', glow: 'wGlowOrange', glowHex: 0xff9a40, green: false };
}
// rain-dark paint: the usual streaky wear, darkened in thin upright streaks where the rain runs off (parallel, never
// crossing), and darker and redder toward the foot of the part (below `low`), where the gorge mud splashes up
function rained(base, low = 0.3, amt = 0.3, seed = 0) {
  const f = wear(base, amt, seed), M = rgb(MUD);
  return (x, y, z) => {
    const c = f(x, y, z);
    const st = 0.5 + 0.5 * Math.sin(x * 23.0 + z * 19.0 + seed), s = st > 0.86 ? 0.82 : 1;
    const k = y < low ? Math.min(1, (low - y) / 0.45) * 0.45 : 0;
    return [(c[0] * (1 - k) + M[0] * k) * s, (c[1] * (1 - k) + M[1] * k) * s, (c[2] * (1 - k) + M[2] * k) * s];
  };
}
// caked mud: one flattened slab over a face first (so the lumps never read as scattered dots), then flattened lumps on it
function mud(b, cx, y, cz, w, d, n, s = 0.08, green = false) {
  if (w > s && d > s) b.add(rb(w * 0.92 + s, s * 0.45, d * 0.92 + s, s * 0.2), 'wPaint', { p: [cx, y - s * 0.05, cz], c: wear(MUD, 0.14, n) });
  for (let i = 0; i < n; i++) {
    const g = green && i % 4 === 1;
    b.add(ico(s * b.r(0.6, 1.15), 0), 'wPaint', { p: [cx + b.r(-w / 2, w / 2), y, cz + b.r(-d / 2, d / 2)], s: [1.7, 0.4, 1.3], r: [0, b.r(0, 3), 0], c: wear(g ? MOSS : i % 2 ? MUD : MUD2, 0.12, i) });
  }
}
// moss on a top face: a few flat matt pads, overlapping (soft patches, never a pattern of dots)
function moss(b, cx, y, cz, w, d, n, s = 0.1) {
  for (let i = 0; i < n; i++) {
    const pw = b.r(0.35, 0.7) * w, pd = b.r(0.35, 0.7) * d;
    b.add(rb(pw, s * 0.35, pd, s * 0.15), 'wPaint', { p: [cx + b.r(-0.5, 0.5) * (w - pw), y, cz + b.r(-0.5, 0.5) * (d - pd)], c: wear(i % 2 ? MOSS : MOSS2, 0.2, i + 7) });
  }
}
// straight hanks of moss hung from an edge running along z (thin upright strips side by side, only on flanks and backs)
function mossHanks(b, x, y, z0, z1, n, len = 0.3) {
  for (let i = 0; i < n; i++) {
    const z = z0 + (i + 0.5) * (z1 - z0) / n, l = len * b.r(0.6, 1.1);
    b.add(box(0.03, l, 0.07), 'wPaint', { p: [x, y - l / 2, z], c: wear(i % 2 ? MOSS : MOSS2, 0.2, i) });
  }
}
// a sight-gauge strip: one lit glass in a dark frame (always single, never a pair)
function gauge(b, glow, p, h, ry = 0) {
  b.add(rb(0.12, h + 0.08, 0.06, 0.02), 'wDark', { p, r: [0, ry, 0], c: DARK });
  b.add(box(0.05, h, 0.03), glow, { p: [p[0] + Math.sin(ry) * 0.025, p[1], p[2] + Math.cos(ry) * 0.025], r: [0, ry, 0] });
}
// a short cut log along x: an 8-sided bark cylinder with pale cut ends (lying, so from above it is a bar)
function butt(b, p, len, r, seed = 0) {
  b.add(cyl(r, r * 1.04, len, 8), 'wWood', { p, r: [0, 0, PI / 2], c: wear(BARK, 0.35, seed) });
  for (const s of [-1, 1]) b.add(cyl(r * 0.92, r * 0.92, 0.012, 8), 'wWood', { p: [p[0] + s * (len / 2 + 0.005), p[1], p[2]], r: [0, 0, PI / 2], c: GRAIN });
}
// an engine house: flat roof, two bands, a louvred vent on its back (-z), one square stack, one gauge on a flank
function engineHouse(b, o) {
  const { w, h, d, x = 0, y, z, M, c, ironC, G, seed, stackX = w * 0.3, stackW = 0.22, stackH = 0.75, gaugeSide = 1 } = o;
  b.add(rb(w, h, d, 0.06), M, { p: [x, y + h / 2, z], c });
  b.add(rb(w + 0.1, 0.08, d + 0.1, 0.02), 'wIron', { p: [x, y + h + 0.02, z], c: ironC });
  for (const t of [0.3, 0.75]) b.add(rb(w + 0.04, 0.06, d + 0.04, 0.02), 'wIron', { p: [x, y + h * t, z], c: ironC });
  b.addBuilder(vent(w * 0.56, h * 0.42, { frameC: DARK, glow: G, seed }), { p: [x, y + h * 0.5, z - d / 2 - 0.02], r: [0, PI, 0] });
  b.addBuilder(stack(stackW, stackH, { c: '#323230', trimC: ironC, seed: seed + 1 }), { p: [x + stackX, y + h + 0.04, z - d * 0.2] });
  gauge(b, G, [x + gaugeSide * (w / 2 + 0.03), y + h * 0.55, z + d * 0.15], h * 0.3, gaugeSide * PI / 2);
}
// a plain solid cutting drum on the x axis: a drum, raised hoops round it (no bars along it: from the end those would
// stand out round the rim like teeth), solid end caps each with one square bolt plate off centre so the turn shows
function drum(r, len, o) {
  const { mat = 'wIron', c, hoopC, capC, n = 5, seed = 1 } = o;
  return sub((s) => {
    s.add(cyl(r, r, len, 24), mat, { r: [0, 0, PI / 2], c });
    for (let i = 0; i < n; i++) s.add(cyl(r * 1.05, r * 1.05, Math.min(0.12, len * 0.04), 24), mat, { p: [-len / 2 + (i + 0.5) * len / n, 0, 0], r: [0, 0, PI / 2], c: hoopC });
    for (const sx of [-1, 1]) {
      s.add(bdisc(r * 1.02, Math.max(0.05, r * 0.12), r * 0.04, 24), 'wIron', { p: [sx * (len / 2 + r * 0.04), 0, 0], r: [0, 0, PI / 2], c: capC });
      s.add(rb(r * 0.1, r * 0.34, r * 0.34, r * 0.03), 'wBrass', { p: [sx * (len / 2 + r * 0.12), r * 0.55, 0], c: capC });
    }
  }, seed);
}

// ==========================================================================
// STUMP PULLER: a tracked puller with a portal mast and a grip of two flat square plates (2.6 m tall, 3.8 m long)
// ==========================================================================
export function buildStumpPuller(variant = 0, mired = false) {
  const P = pal(variant === 1), M = P.mat, G = P.glow;
  const pC = rained(P.paint, 0.3, 0.32, 2101 + variant), p2C = rained(P.paint2, 0.3, 0.3, 2103), ironC = wear(P.iron, 0.25, 2104), trimC = wear(P.trim, 0.3, 2105);
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 1.9, len: 2.8, h: 0.7, tw: 0.46, paint: M, paintC: variant ? '#a89070' : '#3e443c', linkC: '#4e4a44', road: 2, seed: 2120 + variant });
  const HY = 0.6;
  const hull = pivot(base, 0, HY, 0);
  hull.add(part((b) => {
    // the hull: a long low box, riveted flank plates, a deck plate
    b.add(rb(1.5, 0.7, 2.6, 0.08), M, { p: [0, 0.35, -0.1], c: p2C });
    for (const sx of [-1, 1]) b.addBuilder(pl(2.3, 0.5, 0.08, { mat: M, c: pC, c2: p2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 2107 }), { p: [sx * 0.76, 0.38, -0.1], r: [0, sx * PI / 2, 0] });
    b.add(rb(1.62, 0.1, 2.7, 0.03), 'wIron', { p: [0, 0.74, -0.1], c: ironC });
    engineHouse(b, { w: 1.25, h: 0.9, d: 1.1, y: 0.78, z: -0.8, M, c: pC, ironC, G, seed: 2108, gaugeSide: -1 });
    // the winch: a solid drum lying across the deck ahead of the engine house, its cable straight up to the mast head
    b.add(cyl(0.2, 0.2, 1.0, 16), 'wIron', { p: [0, 1.0, 0.2], r: [0, 0, PI / 2], c: '#4a4844' });
    for (const sx of [-1, 1]) {
      b.add(bdisc(0.3, 0.08, 0.03, 18), 'wIron', { p: [sx * 0.54, 1.0, 0.2], r: [0, 0, PI / 2], c: ironC });
      b.add(rb(0.12, 0.34, 0.3, 0.02), M, { p: [sx * 0.64, 0.92, 0.2], c: p2C });
    }
    b.add(cyl(0.025, 0.025, 1.3, 6), 'wIron', { p: [0, 1.62, 0.66], r: [-0.72, 0, 0], c: '#2e2c2a' });
    // the mast: two square posts with a flat head beam (a portal, no braces), a square sheave block on the beam
    for (const sx of [-1, 1]) {
      b.add(rb(0.16, 1.9, 0.18, 0.03), 'wIron', { p: [sx * 0.62, 1.3, 1.12], c: ironC });
      b.add(rb(0.22, 0.26, 0.26, 0.03), M, { p: [sx * 0.62, 0.45, 1.1], c: p2C });
    }
    b.add(rb(1.46, 0.16, 0.26, 0.03), M, { p: [0, 2.26, 1.12], c: pC });
    b.add(rb(0.32, 0.22, 0.3, 0.03), 'wBrass', { p: [0, 2.12, 1.12], c: trimC });
    // a ballast block at the stern; mud on the deck and the hull's foot
    b.add(rb(1.3, 0.3, 0.24, 0.05), 'wIron', { p: [0, 0.5, -1.5], c: wear('#3a3836', 0.3, 2111) });
    mud(b, 0, 0.8, 0.75, 1.2, 0.4, 4, 0.07, P.green);
    mud(b, 0.4, 0.8, -1.35, 0.5, 0.2, 3, 0.06, P.green);
    if (mired) {
      // mired to the deck: mud slabbed over the track skirts and the hull, moss on the engine house roof
      for (const sx of [-1, 1]) mud(b, sx * 0.95, 0.42, -0.1, 0.4, 2.7, 9, 0.12, true);
      mud(b, 0, 0.82, -0.1, 1.4, 2.4, 10, 0.1, true);
      moss(b, 0, 1.72, -0.8, 1.2, 1.0, 5, 0.12);
      mossHanks(b, -0.66, 1.6, -1.25, -0.4, 5, 0.32);
    }
  }, 2112 + variant));
  // the grip: a crosshead sliding on the mast, two flat square grip plates hung under it that slide shut across x. The
  // crosshead is as wide and deep as the plates' spread, so from above the grip is one square
  const grip = pivot(hull, 0, 1.3, 1.36);
  const grips = [];
  grip.add(part((b) => {
    b.add(rb(1.1, 0.16, 0.8, 0.03), M, { p: [0, 0.3, 0.2], c: pC });
    b.add(rb(0.9, 0.36, 0.12, 0.03), M, { p: [0, 0.3, -0.18], c: p2C });
    for (const sx of [-1, 1]) b.add(rb(0.2, 0.2, 0.2, 0.03), 'wIron', { p: [sx * 0.62, 0.3, -0.18], c: ironC });
    b.add(rb(0.9, 0.06, 0.06, 0.01), 'wIron', { p: [0, 0.2, 0.2], c: ironC }); // the slide bar the plates run on
    bolts(b, 'wBrass', [-0.46, 0.39, 0.55], [0.46, 0.39, 0.55], 5, 0.022, 'y', trimC);
    if (mired) butt(b, [0, -0.32, 0.2], 0.72, 0.24, 5);
  }, 2113 + variant));
  for (const sx of [-1, 1]) {
    const j = pivot(grip, sx * 0.42, 0.2, 0.2);
    j.add(part((b) => {
      b.add(rb(0.12, 0.12, 0.2, 0.02), 'wIron', { p: [0, 0, 0], c: ironC });
      b.add(rb(0.1, 0.75, 0.7, 0.02), 'wIron', { p: [0, -0.42, 0], c: wear('#5c5a56', 0.25, sx) });
      // flat parallel grip ribs across the plate's inner face
      for (let i = 0; i < 4; i++) b.add(box(0.03, 0.05, 0.62), 'wIron', { p: [-sx * 0.065, -0.68 + i * 0.16, 0], c: '#4a4844' });
      if (mired) mud(b, 0, -0.78, 0, 0.1, 0.6, 3, 0.06);
    }, 2114));
    grips.push({ j, sx });
  }
  const exhaust = smoke({ rate: 2.5, life: 2.2, size: 0.45, rise: 1.0, color: 0x8a8884, opacity: 0.4, spread: 0.12 });
  exhaust.position.set(0.37, 2.6, -1.0); hull.add(exhaust);
  const spray = smoke({ rate: 0, life: 0.9, size: 0.5, rise: -0.4, color: 0x6a4a3a, opacity: 0.55, spread: 0.6 });
  spray.position.set(0, -0.4, 1.7); hull.add(spray);
  const glow = slotGlow(P.glowHex, 0.62, 0.32, 0.5, { ry: PI }); glow.position.set(0, 1.23, -1.4); hull.add(glow);
  const a = new Anim(root, { base, hull, grip, grips, wheels: TR.wheels });
  a.dynamics.push(exhaust, glow);
  let dist = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.1), e = 1 - Math.pow(1 - k, 3);
      p.hull.rotation.z = -0.12 * e; p.hull.rotation.x = 0.06 * e; p.hull.position.y = HY - 0.12 * e;
      p.grip.position.y = 1.3 - 0.75 * e;
      for (const J of p.grips) J.j.position.x = J.sx * (0.42 + 0.06 * e);
      exhaust.visible = false; spray.visible = false; glow.material.opacity = 0.5 * (1 - k);
      return;
    }
    exhaust.visible = true; spray.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.35) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    p.hull.position.y = HY + Math.abs(Math.sin(this.t * 6)) * 0.02 * Math.min(1, this.speed);
    p.hull.rotation.x = 0; p.hull.rotation.z = 0;
    let gy = 1.3 + Math.sin(this.t * 0.7) * 0.03, open = 0, sr = 0;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      // the grip drops onto the target, the plates close on it, and the whole puller rears back to draw it out
      const drop = at < 0.3 ? at / 0.3 : 1, shut = at < 0.3 ? 0 : Math.min(1, (at - 0.3) / 0.12), pull = at < 0.45 ? 0 : Math.min(1, (at - 0.45) / 0.15), rec = at > 0.75 ? (at - 0.75) / 0.25 : 0;
      gy += (-0.75 * drop + 0.9 * pull) * (1 - rec);
      open = -0.16 * shut * (1 - rec) + 0.08 * drop * (1 - shut);
      p.hull.rotation.x = -0.07 * pull * (1 - rec);
      if (shut > 0 && pull < 1) sr = 30;
    }
    p.grip.position.y = gy;
    for (const J of p.grips) J.j.position.x = J.sx * (0.42 + open);
    spray.userData.rate = sr;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.hull.rotation.z = Math.sin(this.t * 30) * this.hitT * 0.03; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
    spray.userData.update(dt, this.t);
  };
  return finish(root, a, 2.6);
}

// ==========================================================================
// TERRACE CUTTER: four solid wheels, a solid cutting drum across the front under a flat hood (2.5 m tall, 4.2 m long)
// ==========================================================================
export function buildTerraceCutter(variant = 0, mossy = false) {
  const P = pal(variant === 1), M = P.mat, G = P.glow;
  const pC = rained(P.paint, 0.2, 0.32, 2201 + variant), p2C = rained(P.paint2, 0.2, 0.3, 2203), ironC = wear(P.iron, 0.25, 2204), trimC = wear(P.trim, 0.3, 2205), woodC = wear(WOOD, 0.3, 2206);
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const WR = 0.46, wheels = [];
  for (const sx of [-1, 1]) for (const z of [-1.2, 0.55]) {
    const w = pivot(base, sx * 0.86, WR, z);
    w.add(part((b) => {
      b.addBuilder(flywheel(WR, 0.2, { mat: 'wIron', c: rained('#4e4a44', -0.1, 0.3, 2208), hub: 'wBrass', hubC: trimC, seed: 2209 }));
      mud(b, 0, -0.14, 0, 0.22, 0.7, 4, 0.1, P.green);
    }, 2210));
    wheels.push(w);
  }
  const BY = 0.66;
  const body = pivot(base, 0, BY, 0);
  body.add(part((b) => {
    // the chassis: two iron sills, the axle blocks, a plated deck box between the wheels
    for (const sx of [-1, 1]) {
      b.add(rb(0.22, 0.3, 3.2, 0.04), 'wIron', { p: [sx * 0.6, 0, -0.3], c: ironC });
      for (const z of [-1.2, 0.55]) b.add(rb(0.2, 0.28, 0.36, 0.04), 'wIron', { p: [sx * 0.72, -0.1, z], c: ironC });
    }
    b.add(rb(1.2, 0.6, 2.9, 0.06), M, { p: [0, 0.4, -0.3], c: p2C });
    for (const sx of [-1, 1]) b.addBuilder(pl(2.6, 0.42, 0.06, { mat: M, c: pC, c2: p2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 2211 }), { p: [sx * 0.62, 0.42, -0.3], r: [0, sx * PI / 2, 0] });
    b.add(rb(1.3, 0.08, 3.0, 0.02), 'wIron', { p: [0, 0.72, -0.3], c: ironC });
    engineHouse(b, { w: 1.1, h: 0.95, d: 1.05, y: 0.74, z: -1.15, M, c: pC, ironC, G, seed: 2212, gaugeSide: -1 });
    // the drive: a square chain case down the left flank from the engine to the drum arm's pivot
    b.add(rb(0.14, 0.3, 2.1, 0.03), 'wIron', { p: [-0.72, 0.62, 0.15], c: wear('#45423e', 0.25, 2213) });
    // the spoil chute: a flat trough off the right flank, straight down and back over the rear wheel
    b.add(rb(0.5, 0.06, 1.8, 0.02), M, { p: [0.95, 0.6, -0.4], r: [0.32, 0, 0], c: p2C });
    for (const sx of [-1, 1]) b.add(rb(0.05, 0.22, 1.8, 0.02), M, { p: [0.95 + sx * 0.24, 0.7, -0.4], r: [0.32, 0, 0], c: pC });
    b.add(rb(0.3, 0.3, 0.3, 0.04), 'wIron', { p: [0.8, 0.8, 0.5], c: ironC });
    // a timber bumper beam at the stern; spoil and mud along the deck
    b.add(rb(1.3, 0.22, 0.24, 0.04), 'wWood', { p: [0, 0.12, -1.85], c: woodC });
    mud(b, 0, 0.78, -0.2, 0.9, 1.0, 5, 0.07, P.green);
    if (mossy) {
      moss(b, 0, 0.78, -0.2, 1.2, 1.6, 6, 0.12);
      moss(b, 0, 1.74, -1.15, 1.0, 0.9, 4, 0.12);
      for (const sx of [-1, 1]) mossHanks(b, sx * 0.67, 0.68, -1.55, 0.9, 8, 0.32);
    }
  }, 2214 + variant));
  // the drum arms: two straight side beams on a cross shaft at the deck's front, the drum between their front ends, a flat
  // hood over it (as wide and deep as the drum, so from above the front is one rectangle)
  const arm = pivot(body, 0, 0.62, 0.95);
  const DR = 0.42, DL = 1.6;
  arm.add(part((b) => {
    b.add(cyl(0.09, 0.09, 1.9, 10), 'wIron', { r: [0, 0, PI / 2], c: ironC });
    for (const sx of [-1, 1]) {
      b.add(rb(0.14, 0.24, 1.2, 0.03), M, { p: [sx * 0.92, -0.12, 0.5], r: [0.22, 0, 0], c: pC });
      b.add(rb(0.18, 0.3, 0.3, 0.03), 'wIron', { p: [sx * 0.92, -0.26, 1.05], c: ironC });
    }
    b.add(rb(2.0, 0.08, 1.05, 0.02), M, { p: [0, 0.3, 1.0], c: pC });
    for (const sx of [-1, 1]) b.add(rb(0.07, 0.5, 1.05, 0.02), M, { p: [sx * 0.97, 0.06, 1.0], c: p2C });
    b.add(rb(2.04, 0.1, 0.1, 0.02), 'wIron', { p: [0, 0.3, 1.52], c: ironC });
    bolts(b, 'wBrass', [-0.9, 0.36, 1.48], [0.9, 0.36, 1.48], 7, 0.022, 'y', trimC);
    if (mossy) { moss(b, 0, 0.36, 1.0, 1.8, 0.9, 5, 0.1); for (const sx of [-1, 1]) mossHanks(b, sx * 1.01, -0.18, 0.55, 1.45, 4, 0.26); }
  }, 2215 + variant));
  const spin = pivot(arm, 0, -0.32, 1.05);
  spin.add(part((b) => b.addBuilder(drum(DR, DL, { mat: 'wIron', c: rained('#5a5650', -1, 0.3, 2216), hoopC: '#6e6a64', capC: trimC, seed: 2217 })), 2218));
  const exhaust = smoke({ rate: 2.2, life: 2.2, size: 0.42, rise: 1.0, color: 0x8a8884, opacity: 0.4, spread: 0.12 });
  exhaust.position.set(0.33, 2.5, -1.36); body.add(exhaust);
  const spoil = smoke({ rate: 0, life: 1.0, size: 0.5, rise: -0.3, color: 0x6a4a3a, opacity: 0.55, spread: 0.6 });
  spoil.position.set(0, -0.3, 1.5); arm.add(spoil);
  const glow = slotGlow(P.glowHex, 0.56, 0.34, 0.5, { ry: PI }); glow.position.set(0, 1.21, -1.7); body.add(glow);
  const a = new Anim(root, { base, body, arm, spin, wheels });
  a.dynamics.push(exhaust, glow);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.2), e = 1 - Math.pow(1 - k, 3);
      p.body.rotation.z = 0.08 * e; p.body.position.y = BY - 0.1 * e; p.arm.rotation.x = 0.3 * e;
      exhaust.visible = false; spoil.visible = false; glow.material.opacity = 0.5 * (1 - k);
      return;
    }
    exhaust.visible = true; spoil.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    for (const w of p.wheels) w.rotation.x += (this.speed / WR) * dt * ts;
    p.body.position.y = BY + Math.abs(Math.sin(this.t * 7)) * 0.015 * Math.min(1, this.speed);
    let rate = 1.4, ar = Math.sin(this.t * 0.8) * 0.02, sr = 0;
    p.body.position.z = 0;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      // the drum is raised, races, and is brought down into the target as the cutter lurches forward
      const up = at < 0.4 ? at / 0.4 : 1, down = at < 0.4 ? 0 : Math.min(1, (at - 0.4) / 0.12), rec = at > 0.72 ? (at - 0.72) / 0.28 : 0;
      rate = 6;
      ar += (-0.45 * up + 0.62 * down) * (1 - rec);
      p.body.position.z = 0.18 * down * (1 - rec);
      if (down > 0 && rec === 0) sr = 40;
    }
    p.arm.rotation.x = ar;
    p.spin.rotation.x += rate * dt * ts * PI * 2;
    spoil.userData.rate = sr;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.body.rotation.z = Math.sin(this.t * 30) * this.hitT * 0.03; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update(dt, this.t);
    spoil.userData.update(dt, this.t);
  };
  return finish(root, a, 2.5);
}

// ==========================================================================
// DRAIN BORER: a tracked borer, a square boom with a ram driving a head of plain stepped discs (2.3 m tall, 4.0 m long)
// ==========================================================================
export function buildDrainBorer(variant = 0) {
  const P = pal(variant === 1), M = P.mat, G = P.glow;
  const pC = rained(P.paint, 0.3, 0.32, 2301 + variant), p2C = rained(P.paint2, 0.3, 0.3, 2303), ironC = wear(P.iron, 0.25, 2304), trimC = wear(P.trim, 0.3, 2305);
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 1.7, len: 2.5, h: 0.62, tw: 0.42, paint: M, paintC: variant ? '#a89070' : '#3e443c', linkC: '#4e4a44', road: 2, seed: 2320 + variant });
  const HY = 0.55;
  const hull = pivot(base, 0, HY, 0);
  hull.add(part((b) => {
    b.add(rb(1.32, 0.62, 2.4, 0.08), M, { p: [0, 0.31, -0.1], c: p2C });
    for (const sx of [-1, 1]) b.addBuilder(pl(2.1, 0.44, 0.07, { mat: M, c: pC, c2: p2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 2307 }), { p: [sx * 0.67, 0.34, -0.1], r: [0, sx * PI / 2, 0] });
    b.add(rb(1.44, 0.1, 2.5, 0.03), 'wIron', { p: [0, 0.66, -0.1], c: ironC });
    engineHouse(b, { w: 1.15, h: 0.85, d: 0.9, y: 0.7, z: -0.85, M, c: pC, ironC, G, seed: 2308, stackX: -0.32, gaugeSide: 1 });
    // the boom: a long square casing down the centre line on two square saddles, banded
    b.add(rb(0.5, 0.46, 2.3, 0.05), M, { p: [0, 1.0, 0.55], c: pC });
    for (const z of [-0.2, 0.5, 1.2]) b.add(rb(0.58, 0.54, 0.08, 0.02), 'wIron', { p: [0, 1.0, z], c: ironC });
    for (const z of [0.0, 1.1]) b.add(rb(0.66, 0.36, 0.3, 0.03), 'wIron', { p: [0, 0.74, z], c: ironC });
    b.add(rb(0.56, 0.52, 0.12, 0.03), 'wIron', { p: [0, 1.0, 1.68], c: ironC });
    // the pipe rack along the back of the deck beside the boom: straight clay drain pipes laid along z, parallel
    for (const sx of [-1, 1]) {
      for (const z of [-0.4, 0.3]) b.add(rb(0.34, 0.1, 0.1, 0.02), 'wIron', { p: [sx * 0.48, 0.76, z], c: ironC });
      for (let i = 0; i < 2; i++) for (let j = 0; j < (i ? 1 : 2); j++) {
        const x = sx * (0.4 + j * 0.16 - (i ? -0.08 : 0)), y = 0.88 + i * 0.14;
        b.add(cyl(0.075, 0.075, 1.2, 8), 'wPaint', { p: [x, y, -0.05], r: [PI / 2, 0, 0], c: wear(i % 2 ? CLAY2 : CLAY, 0.25, i + j) });
      }
    }
    // a square spoil box on the right flank at the front, heaped with mud
    b.add(rb(0.36, 0.36, 0.6, 0.03), M, { p: [0.86, 0.45, 0.9], c: p2C });
    mud(b, 0.86, 0.65, 0.9, 0.26, 0.5, 4, 0.06, P.green);
    mud(b, 0, 0.72, 1.1, 1.0, 0.3, 4, 0.06, P.green);
    if (variant) moss(b, 0, 1.6, -0.85, 1.0, 0.8, 4, 0.1);
  }, 2312 + variant));
  // the ram out of the boom's front, pitched steeply down into the ground ahead (it bores drains down into the hill), and the
  // head on it: three plain stepped discs, one square bolt plate off centre on each step so the turn shows (nothing at the
  // centre: no tip, no hub). Pitched down and under a square shroud, the head never faces the front or the sky as a round
  // disc: from the front it is a low flat ellipse under the shroud's plate, from above the shroud hides it
  const tilt = pivot(hull, 0, 1.0, 1.7);
  tilt.rotation.x = 1.0;
  tilt.add(part((b) => {
    b.add(rb(1.06, 0.06, 1.0, 0.02), M, { p: [0, 0.52, 0.72], c: pC });
    for (const sx of [-1, 1]) b.add(rb(0.06, 0.5, 1.0, 0.02), M, { p: [sx * 0.53, 0.28, 0.72], c: p2C });
    b.add(rb(1.1, 0.1, 0.1, 0.02), 'wIron', { p: [0, 0.52, 1.22], c: ironC });
    b.add(rb(0.4, 0.56, 0.3, 0.03), 'wIron', { p: [0, 0.28, 0.1], c: ironC });
  }, 2319 + variant));
  // a flat top plate off the boom's front over the head's back (the shroud's plate faces mostly forward, so from straight
  // above this is what covers the head), on two square cheeks
  hull.add(part((b) => {
    b.add(rb(1.12, 0.07, 0.68, 0.02), M, { p: [0, 1.17, 2.0], c: pC });
    for (const sx of [-1, 1]) b.add(rb(0.06, 0.3, 0.6, 0.02), M, { p: [sx * 0.56, 1.02, 1.98], c: p2C });
  }, 2318 + variant));
  const ram = pivot(tilt, 0, 0, 0);
  ram.add(part((b) => {
    b.add(rb(0.3, 0.3, 0.6, 0.04), 'wIron', { p: [0, 0, 0.18], c: '#5e5c58' });
    b.add(rb(0.38, 0.38, 0.08, 0.02), 'wIron', { p: [0, 0, 0.0], c: ironC });
  }, 2313));
  const head = pivot(ram, 0, 0, 0.5);
  const hC = rained(variant ? '#8a7a5c' : '#55524c', -1, 0.25, 2314);
  head.add(part((b) => {
    const steps = [[0.44, 0.14, 0.0], [0.33, 0.13, 0.14], [0.22, 0.12, 0.27]];
    steps.forEach(([r, w, z], i) => {
      b.add(bdisc(r, w, w * 0.25, 20), 'wIron', { p: [0, 0, z + w / 2], r: [PI / 2, 0, 0], c: hC });
      const a = i * 2.1;
      b.add(rb(r * 0.3, r * 0.3, 0.04, 0.01), 'wIron', { p: [Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, z + w + 0.01], c: '#6e6a64' });
    });
    mud(b, 0, -0.38, 0.1, 0.3, 0.2, 3, 0.05);
  }, 2315 + variant));
  const exhaust = smoke({ rate: 2.2, life: 2.2, size: 0.42, rise: 1.0, color: 0x8a8884, opacity: 0.4, spread: 0.12 });
  exhaust.position.set(-0.32, 2.4, -1.03); hull.add(exhaust);
  const spoil = smoke({ rate: 0, life: 0.9, size: 0.5, rise: -0.3, color: 0x6a4a3a, opacity: 0.55, spread: 0.5 });
  spoil.position.set(0, 0, 0.4); head.add(spoil);
  const glow = slotGlow(P.glowHex, 0.62, 0.3, 0.5, { ry: PI }); glow.position.set(0, 1.12, -1.33); hull.add(glow);
  const a = new Anim(root, { base, hull, ram, head, wheels: TR.wheels });
  a.dynamics.push(exhaust, glow);
  let dist = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.1), e = 1 - Math.pow(1 - k, 3);
      p.hull.rotation.x = 0.1 * e; p.hull.rotation.z = 0.06 * e; p.hull.position.y = HY - 0.12 * e; p.ram.position.z = -0.3 * e;
      exhaust.visible = false; spoil.visible = false; glow.material.opacity = 0.5 * (1 - k);
      return;
    }
    exhaust.visible = true; spoil.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.31) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    p.hull.position.y = HY + Math.abs(Math.sin(this.t * 6)) * 0.02 * Math.min(1, this.speed);
    p.hull.rotation.x = 0; p.hull.rotation.z = 0;
    let rate = 0.8, rz = 0, sr = 0;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      // the head spins up, the ram draws back, then drives it forward into the target
      const back = at < 0.35 ? at / 0.35 : 1, drive = at < 0.35 ? 0 : Math.min(1, (at - 0.35) / 0.12), rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
      rate = 5;
      rz += (-0.3 * back + 0.7 * drive) * (1 - rec);
      p.hull.rotation.x = 0.04 * drive * (1 - rec);
      if (drive > 0 && rec === 0) sr = 38;
    }
    p.ram.position.z = rz;
    p.head.rotation.z += rate * dt * ts * PI * 2;
    spoil.userData.rate = sr;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.hull.rotation.z = Math.sin(this.t * 30) * this.hitT * 0.03; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
    spoil.userData.update(dt, this.t);
  };
  return finish(root, a, 2.3);
}

// ==========================================================================
// SEED DRILL: a row planter on two big solid wheels, a square hopper over a bar of parallel coulters (2.3 m tall)
// ==========================================================================
export function buildSeedDrill(variant = 0) {
  const P = pal(variant === 1), M = P.mat, G = P.glow;
  const pC = rained(P.paint, 0.1, 0.32, 2401 + variant), p2C = rained(P.paint2, 0.1, 0.3, 2403), ironC = wear(P.iron, 0.25, 2404), trimC = wear(P.trim, 0.3, 2405), woodC = wear(WOOD, 0.3, 2406), wood2C = wear(WOOD2, 0.3, 2407);
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const wheels = [];
  for (const sx of [-1, 1]) {
    const w = pivot(base, sx * 1.08, 0.62, -0.55);
    w.add(part((b) => { b.addBuilder(flywheel(0.62, 0.16, { mat: 'wIron', c: rained('#4e4a44', -0.2, 0.3, 2408), hub: 'wBrass', hubC: trimC, seed: 2409 })); mud(b, 0, -0.2, 0, 0.18, 0.9, 4, 0.1, P.green); }, 2410));
    wheels.push({ w, r: 0.62 });
  }
  const fw = pivot(base, 0, 0.3, 1.25);
  fw.add(part((b) => b.addBuilder(flywheel(0.3, 0.14, { mat: 'wIron', c: '#4e4a44', hub: 'wBrass', hubC: trimC, seed: 2411 })), 2412));
  wheels.push({ w: fw, r: 0.3 });
  const BY = 0.62;
  const body = pivot(base, 0, BY, 0);
  body.add(part((b) => {
    // the frame: two timber side rails on iron sills, the rear axle bar, the front wheel's square fork
    for (const sx of [-1, 1]) {
      b.add(rb(0.16, 0.24, 2.4, 0.03), 'wWood', { p: [sx * 0.78, 0.05, 0.25], c: woodC });
      b.add(rb(0.18, 0.06, 2.42, 0.02), 'wIron', { p: [sx * 0.78, -0.08, 0.25], c: ironC });
      b.add(rb(0.08, 0.36, 0.16, 0.02), 'wIron', { p: [sx * 0.12, -0.19, 1.25], c: ironC }); // the fork's cheeks, hung under the beam (never through it)
    }
    b.add(rb(2.2, 0.12, 0.16, 0.03), 'wIron', { p: [0, 0.0, -0.55], c: ironC });
    b.add(rb(1.72, 0.12, 0.18, 0.03), 'wWood', { p: [0, 0.05, 1.3], c: wood2C });
    // the engine at the back between the big wheels
    engineHouse(b, { w: 0.9, h: 0.85, d: 0.62, y: 0.12, z: -0.95, M, c: pC, ironC, G, seed: 2413, stackX: 0.22, stackW: 0.2, stackH: 0.7, gaugeSide: 1 });
    // the seed hopper: a wide square box on four square posts, planked lid, iron corner straps
    for (const sx of [-1, 1]) for (const z of [0.0, 0.8]) b.add(rb(0.12, 0.62, 0.12, 0.02), 'wIron', { p: [sx * 0.74, 0.42, z], c: ironC });
    b.add(rb(1.7, 0.62, 0.9, 0.05), M, { p: [0, 1.04, 0.4], c: pC });
    for (const y of [0.78, 1.3]) b.add(rb(1.76, 0.06, 0.96, 0.02), 'wIron', { p: [0, y, 0.4], c: ironC });
    for (let i = 0; i < 5; i++) b.add(rb(1.74, 0.05, 0.17, 0.01), 'wWood', { p: [0, 1.38, 0.04 + i * 0.18], c: i % 2 ? wood2C : woodC });
    b.addBuilder(pl(1.5, 0.4, 0.05, { mat: M, c: p2C, c2: pC, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, inset: false, seed: 2414 }), { p: [0, 1.04, 0.86] });
    // the feed box: a solid square trough from the hopper's floor down to the coulter bar, the seed running inside it to
    // each coulter (solid, so from the front no tube runs on through the bar into a coulter as an upright through a beam)
    b.add(rb(1.56, 0.5, 0.3, 0.03), M, { p: [0, 0.5, 0.5], c: p2C });
    b.add(rb(1.6, 0.06, 0.34, 0.02), 'wIron', { p: [0, 0.3, 0.5], c: ironC });
    // the press roller behind the coulters: one plain long roller on square bearing blocks
    b.add(cyl(0.18, 0.18, 1.5, 16), 'wIron', { p: [0, -0.4, -0.05], r: [0, 0, PI / 2], c: rained('#4e4c48', -1, 0.3, 2415) });
    for (const sx of [-1, 1]) b.add(rb(0.12, 0.5, 0.2, 0.02), 'wIron', { p: [sx * 0.8, -0.2, -0.05], c: ironC });
    mud(b, 0, -0.56, -0.05, 1.3, 0.1, 6, 0.06, P.green);
    if (variant) moss(b, 0, 1.42, 0.4, 1.5, 0.8, 5, 0.1);
  }, 2416 + variant));
  // the coulter bar: a square bar across the frame, six flat upright coulter blades in a row along it (parallel, along z)
  const bar = pivot(body, 0, 0.18, 0.5);
  bar.add(part((b) => {
    b.add(rb(1.6, 0.12, 0.14, 0.02), 'wIron', { c: ironC });
    for (let i = 0; i < 6; i++) {
      const x = -0.65 + i * 0.26;
      b.add(rb(0.08, 0.14, 0.16, 0.02), 'wIron', { p: [x, -0.1, 0], c: ironC });
      b.add(rb(0.035, 0.46, 0.3, 0.008), 'wEdge', { p: [x, -0.36, 0.04], c: '#c4c6c8' });
      b.add(rb(0.05, 0.1, 0.18, 0.01), 'wIron', { p: [x, -0.56, 0.02], c: '#4a4844' });
    }
    mud(b, 0, -0.55, 0.05, 1.4, 0.2, 5, 0.05, P.green);
  }, 2417));
  const exhaust = smoke({ rate: 2.0, life: 2.0, size: 0.36, rise: 1.0, color: 0x8a8884, opacity: 0.4, spread: 0.1 });
  exhaust.position.set(0.22, 1.75, -1.07); body.add(exhaust);
  const dust = smoke({ rate: 0, life: 1.0, size: 0.45, rise: -0.2, color: 0x7c5a44, opacity: 0.5, spread: 0.7 });
  dust.position.set(0, -0.55, 0.3); bar.add(dust);
  const glow = slotGlow(P.glowHex, 0.46, 0.3, 0.5, { ry: PI }); glow.position.set(0, 0.55, -1.28); body.add(glow);
  const a = new Anim(root, { base, body, bar, wheels });
  a.dynamics.push(exhaust, glow);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.2), e = 1 - Math.pow(1 - k, 3);
      p.body.rotation.x = 0.12 * e; p.body.rotation.z = -0.06 * e; p.body.position.y = BY - 0.08 * e; p.bar.position.y = 0.18 - 0.1 * e;
      exhaust.visible = false; dust.visible = false; glow.material.opacity = 0.5 * (1 - k);
      return;
    }
    exhaust.visible = true; dust.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    for (const W of p.wheels) W.w.rotation.x += (this.speed / W.r) * dt * ts;
    p.body.position.y = BY + Math.abs(Math.sin(this.t * 7)) * 0.012 * Math.min(1, this.speed);
    let by = 0.18 + Math.sin(this.t * 1.3) * 0.01, bx = 0, rx = 0, dr = this.speed > 0.5 ? 6 : 0;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      // the coulter bar is lifted, the drill rears on its big wheels, then it drives the coulters down into the target
      const up = at < 0.4 ? at / 0.4 : 1, down = at < 0.4 ? 0 : Math.min(1, (at - 0.4) / 0.1), rec = at > 0.72 ? (at - 0.72) / 0.28 : 0;
      by += (0.3 * up - 0.42 * down) * (1 - rec);
      bx = (-0.2 * up + 0.35 * down) * (1 - rec);
      rx = (-0.08 * up + 0.1 * down) * (1 - rec);
      if (down > 0 && rec === 0) dr = 40;
    }
    p.bar.position.y = by; p.bar.rotation.x = bx; p.body.rotation.x = rx;
    dust.userData.rate = dr;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.body.rotation.z = Math.sin(this.t * 30) * this.hitT * 0.03; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update(dt, this.t);
    dust.userData.update(dt, this.t);
  };
  return finish(root, a, 2.3);
}

// ==========================================================================
// SLOPE WARDEN: two straight telescoping legs with cleated pads, a retaining board and a long tamper (3.4 m)
// ==========================================================================
export function buildSlopeWarden(variant = 0) {
  const P = pal(variant === 1), M = P.mat, G = P.glow;
  const PY = 1.6;
  const pC = rained(P.paint, -0.4, 0.32, 2501 + variant), p2C = wear(P.paint2, 0.3, 2503), ironC = wear(P.iron, 0.25, 2504), trimC = wear(P.trim, 0.3, 2505), woodC = wear(WOOD, 0.3, 2506), wood2C = wear(WOOD2, 0.3, 2507);
  const root = new THREE.Group();
  const pelvis = pivot(root, 0, PY, 0);
  const body = pivot(pelvis, 0, 0, 0);
  body.add(part((b) => {
    b.add(rb(1.0, 0.32, 0.6, 0.05), 'wIron', { c: ironC });
    // the body: a square plated case, iron bands, a flat cap block with a plain plated front (no openings)
    b.add(rb(1.1, 1.1, 0.78, 0.07), M, { p: [0, 0.78, 0], c: pC });
    b.addBuilder(pl(0.96, 0.84, 0.07, { mat: M, c: p2C, c2: pC, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 2508 }), { p: [0, 0.78, 0.4] });
    for (const y of [0.32, 1.26]) b.add(rb(1.18, 0.08, 0.86, 0.02), 'wIron', { p: [0, y, 0], c: ironC });
    b.add(rb(0.9, 0.36, 0.7, 0.06), M, { p: [0, 1.52, -0.04], c: p2C });
    b.add(rb(1.0, 0.08, 0.8, 0.02), 'wIron', { p: [0, 1.74, -0.04], c: ironC });
    for (const sx of [-1, 1]) b.add(rb(0.28, 0.32, 0.4, 0.05), 'wIron', { p: [sx * 0.66, 1.15, 0], c: ironC });
    // a firebox on its back with a vent, one square stack, one gauge on the right flank
    b.add(rb(0.74, 0.62, 0.28, 0.05), M, { p: [0, 0.62, -0.5], c: p2C });
    b.addBuilder(vent(0.5, 0.32, { frameC: DARK, glow: G, seed: 2510 }), { p: [0, 0.62, -0.65], r: [0, PI, 0] });
    b.addBuilder(stack(0.18, 0.55, { c: '#323230', trimC: ironC, seed: 2511 }), { p: [-0.32, 1.78, -0.28] });
    gauge(b, G, [0.56, 0.7, 0.1], 0.3, PI / 2);
    // the stake rack across its back above the firebox: a square frame of two posts and two rails, five upright stakes
    for (const sx of [-1, 1]) b.add(rb(0.08, 1.2, 0.08, 0.02), 'wIron', { p: [sx * 0.42, 1.5, -0.58], c: ironC });
    for (const y of [1.05, 1.95]) b.add(rb(0.92, 0.07, 0.1, 0.02), 'wIron', { p: [0, y, -0.58], c: ironC });
    for (let i = 0; i < 4; i++) b.add(rb(0.09, 1.4, 0.09, 0.02), 'wWood', { p: [-0.27 + i * 0.18, 1.55, -0.66], c: i % 2 ? wood2C : woodC });
    mud(b, 0, 1.79, 0.1, 0.6, 0.3, 3, 0.05, P.green);
    if (variant) { moss(b, 0, 1.8, 0.05, 0.9, 0.6, 4, 0.1); mossHanks(b, -0.57, 1.3, -0.3, 0.3, 4, 0.3); }
  }, 2512 + variant));
  // the board arm (left): a retaining board of planks laid flat across, two upright battens at its ends, two lugs on top
  const shield = pivot(body, -0.82, 1.1, 0.15);
  shield.add(part((b) => {
    b.add(rb(0.2, 0.2, 0.5, 0.03), 'wIron', { p: [0, 0, 0.1], c: ironC });
    const S = sub((s) => {
      for (let i = 0; i < 6; i++) s.add(rb(1.0, 0.24, 0.08, 0.015), 'wWood', { p: [0, -0.62 + i * 0.25, 0], c: rained(i % 2 ? WOOD2 : WOOD, -0.6, 0.3, i) });
      for (const sx of [-1, 1]) s.add(rb(0.08, 1.56, 0.12, 0.015), 'wIron', { p: [sx * 0.52, 0, 0], c: ironC });
      for (const sx of [-1, 1]) s.add(rb(0.12, 0.14, 0.12, 0.02), 'wIron', { p: [sx * 0.26, 0.84, 0], c: ironC });
      bolts(s, 'wBrass', [-0.52, -0.6, 0.07], [-0.52, 0.6, 0.07], 4, 0.02, 'z', trimC);
      bolts(s, 'wBrass', [0.52, -0.6, 0.07], [0.52, 0.6, 0.07], 4, 0.02, 'z', trimC);
      mud(s, 0, -0.74, 0.05, 0.9, 0.05, 4, 0.05);
    }, 2513);
    b.addBuilder(S, { p: [-0.12, -0.3, 0.42], r: [0, -0.25, 0] });
  }, 2514));
  // the tamper arm (right): a long pole with a flat square foot plate (a rammer), carried pointing forward
  const tamper = pivot(body, 0.82, 1.1, 0.05);
  tamper.add(part((b) => {
    b.add(bdisc(0.13, 0.12, 0.02, 14), 'wBrass', { r: [0, 0, PI / 2], c: trimC });
    b.add(rb(0.18, 0.5, 0.2, 0.03), M, { p: [0.04, -0.26, 0], c: p2C });
    b.add(rb(0.1, 0.1, 2.0, 0.02), 'wWood', { p: [0.06, -0.5, 0.85], c: woodC });
    for (const z of [0.15, 0.4, 1.6]) b.add(rb(0.14, 0.14, 0.07, 0.02), 'wIron', { p: [0.06, -0.5, z], c: ironC });
    b.add(rb(0.22, 0.22, 0.24, 0.03), 'wIron', { p: [0.06, -0.5, 1.9], c: ironC });
    b.add(rb(0.5, 0.5, 0.1, 0.03), 'wIron', { p: [0.06, -0.5, 2.05], c: wear('#45423e', 0.3, 2515) });
    mud(b, 0.06, -0.5, 2.1, 0.4, 0.04, 3, 0.05);
  }, 2516));
  // legs: a straight square upper column with a sleeve, a sliding lower column, a broad cleated pad kept level
  const legs = {};
  for (const sx of [-1, 1]) {
    const hip = pivot(pelvis, sx * 0.36, -0.06, 0);
    hip.add(part((b) => {
      b.add(bdisc(0.15, 0.12, 0.03, 16), 'wIron', { p: [sx * 0.12, 0, 0], r: [0, 0, PI / 2], c: ironC });
      b.add(rb(0.26, 0.82, 0.3, 0.04), M, { p: [0, -0.4, 0], c: pC });
      for (const y of [-0.2, -0.65]) b.add(rb(0.3, 0.07, 0.34, 0.015), 'wIron', { p: [0, y, 0], c: ironC });
      b.add(rb(0.22, 0.22, 0.26, 0.03), 'wBrass', { p: [0, -0.84, 0], c: trimC });
    }, 2517));
    const rod = pivot(hip, 0, -0.84, 0);
    rod.add(part((b) => b.add(rb(0.16, 0.7, 0.18, 0.03), 'wIron', { p: [0, -0.32, 0], c: rained('#55524c', -0.3, 0.25, 2518) }), 2519));
    const foot = pivot(rod, 0, -0.66, 0);
    foot.add(part((b) => {
      b.add(rb(0.2, 0.14, 0.2, 0.03), 'wIron', { p: [0, 0.04, 0], c: ironC });
      b.add(rb(0.52, 0.1, 0.8, 0.03), M, { p: [0, -0.06, 0.06], c: wear(MUD, 0.2, sx) });
      // cleats under the pad: flat bars across it, parallel, for grip on the wet slope
      for (let i = 0; i < 4; i++) b.add(rb(0.54, 0.05, 0.06, 0.01), 'wIron', { p: [0, -0.12, -0.26 + i * 0.21], c: ironC });
      mud(b, 0, 0.0, 0.06, 0.42, 0.7, 4, 0.06);
    }, 2520));
    legs[sx > 0 ? 'L' : 'R'] = { hip, rod, foot };
  }
  const exhaust = smoke({ rate: 2, life: 2.0, size: 0.35, rise: 1.0, color: 0x8a8884, opacity: 0.4, spread: 0.1 });
  exhaust.position.set(-0.32, 2.42, -0.28); body.add(exhaust);
  const thud = smoke({ rate: 0, life: 0.9, size: 0.5, rise: -0.2, color: 0x6a4a3a, opacity: 0.55, spread: 0.6 });
  thud.position.set(0.06, -0.5, 2.15); tamper.add(thud);
  const glow = slotGlow(P.glowHex, 0.42, 0.26, 0.5, { ry: PI }); glow.position.set(0, 0.62, -0.68); body.add(glow);
  const a = new Anim(root, { pelvis, body, shield, tamper, legs });
  a.dynamics.push(exhaust, glow);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.3), e = k * k;
      p.pelvis.position.y = PY - 0.9 * e; p.pelvis.rotation.x = 0.5 * e;
      p.legs.L.rod.position.y = -0.84 + 0.5 * e; p.legs.R.rod.position.y = -0.84 + 0.5 * e;
      p.tamper.rotation.x = 1.2 * e; p.shield.rotation.z = -0.3 * e;
      exhaust.visible = false; thud.visible = false; glow.material.opacity = 0.5 * (1 - k);
      return;
    }
    exhaust.visible = true; thud.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    const sk = Math.min(1, this.speed / 2.5);
    this.phase = ((this.phase || 0) + this.speed * dt * 0.36 * ts) % 1;
    const ph = this.phase * PI * 2, swing = Math.sin(ph) * 0.32 * sk;
    p.legs.L.hip.rotation.x = -swing; p.legs.R.hip.rotation.x = swing;
    p.legs.L.rod.position.y = -0.84 + Math.max(0, Math.cos(ph)) * 0.16 * sk;
    p.legs.R.rod.position.y = -0.84 + Math.max(0, -Math.cos(ph)) * 0.16 * sk;
    for (const L of [p.legs.L, p.legs.R]) L.foot.rotation.x = -L.hip.rotation.x;
    p.pelvis.position.y = PY - (1 - Math.abs(Math.cos(ph))) * 0.05 * sk + Math.sin(this.t * 1.4) * 0.012;
    p.pelvis.rotation.z = Math.sin(ph) * 0.04 * sk; p.pelvis.rotation.x = 0;
    p.body.rotation.y = Math.sin(ph) * 0.05 * sk; p.body.rotation.x = 0.04;
    let kx = 0.5 + Math.sin(this.t * 0.7) * 0.04, sy = 0, tr = 0;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      // the tamper is raised high, then rammed down on the target behind the board
      const up = at < 0.45 ? at / 0.45 : 1, down = at < 0.45 ? 0 : Math.min(1, (at - 0.45) / 0.1), rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
      kx += (-1.9 * up + 2.4 * down) * (1 - rec);
      p.body.rotation.x += (-0.06 * up + 0.14 * down) * (1 - rec);
      sy = 0.3 * up * (1 - rec);
      if (down > 0 && rec === 0) tr = 36;
    }
    p.tamper.rotation.x = kx; p.shield.rotation.y = sy;
    thud.userData.rate = tr;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.body.rotation.x -= this.hitT * 0.12; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
    thud.userData.update(dt, this.t);
  };
  return finish(root, a, 3.4);
}

// ==========================================================================
// THE HILL LEVELLER (world boss): a great tracked cutting engine, its drum across the bow on two side arms (13 m)
// ==========================================================================
export function buildHillLeveller() {
  const P = pal(false), M = P.mat, G = P.glow;
  const HB = 2.2, HH = 2.8, HD = HB + HH; // the hull's bottom, height and deck
  const hullC = rained('#58604f', HB + 0.8, 0.3, 2601), hull2C = rained(P.paint2, HB + 0.8, 0.3, 2602), ironC = wear(P.iron, 0.25, 2603), trimC = wear(P.trim, 0.3, 2604), woodC = wear(WOOD, 0.3, 2605), darkC = wear(DARK, 0.25, 2606);
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 6.6, len: 11.0, h: 2.6, tw: 1.5, paint: M, paintC: '#3e443c', linkC: '#4a4642', road: 4, seed: 2620 });
  const body = pivot(base, 0, 0, 0);
  body.add(part((b) => {
    // the hull: a long deep box between the treads, four plates a flank, a rubbing strake, the deck
    b.add(rb(5.4, HH, 11.6, 0.14), M, { p: [0, HB + HH / 2, -0.2], c: hull2C });
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 4; i++) b.addBuilder(pl(2.7, 1.6, 0.12, { mat: M, c: rained(i % 2 ? P.paint : '#4e584a', 0.0, 0.3, i * 3 + sx), c2: hullC, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 2607 + i }), { p: [sx * 2.74, HB + 1.5, -4.4 + i * 2.9], r: [0, sx * PI / 2, 0] });
      b.add(rb(0.24, 0.28, 11.8, 0.05), 'wWood', { p: [sx * 2.78, HB + 2.5, -0.2], c: woodC });
    }
    b.add(rb(5.8, 0.24, 12.0, 0.05), 'wIron', { p: [0, HD + 0.02, -0.2], c: ironC });
    // the engine house amidships, off to port: flat roof, banded, a louvred vent on its port flank and on its back, one big
    // square stack (one only: a pair of stack tops reads as two eyes from above), the gauge on the stern face
    b.add(rb(3.4, 3.2, 4.4, 0.12), M, { p: [-0.8, HD + 1.6, -0.6], c: wear(P.paint, 0.3, 2611) });
    b.add(rb(3.7, 0.22, 4.7, 0.05), 'wIron', { p: [-0.8, HD + 3.25, -0.6], c: ironC });
    for (const y of [HD + 0.7, HD + 2.3]) b.add(rb(3.5, 0.14, 4.5, 0.04), 'wIron', { p: [-0.8, y, -0.6], c: ironC });
    b.addBuilder(vent(2.4, 1.0, { frameC: darkC, glow: G, seed: 2612 }), { p: [-2.52, HD + 1.5, -0.6], r: [0, -PI / 2, 0] });
    b.addBuilder(pl(2.8, 1.4, 0.12, { mat: M, c: hullC, c2: hull2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 2613 }), { p: [-0.8, HD + 1.6, 1.64] });
    b.addBuilder(stack(1.0, 3.2, { c: '#2e2e2c', trimC: ironC, seed: 2614 }), { p: [-1.6, HD + 3.3, -1.6] });
    gauge(b, G, [0.3, HD + 2.4, -2.83], 0.9, PI);
    // the winch house at the stern: flat roof, a solid winch drum lying across on its back deck
    b.add(rb(4.4, 2.0, 2.2, 0.1), M, { p: [0, HD + 1.0, -4.6], c: hullC });
    b.add(rb(4.7, 0.18, 2.5, 0.04), 'wIron', { p: [0, HD + 2.05, -4.6], c: ironC });
    b.add(cyl(0.45, 0.45, 3.4, 16), 'wIron', { p: [0, HD + 0.6, -6.1], r: [0, 0, PI / 2], c: '#4a4844' });
    for (const sx of [-1, 1]) b.add(bdisc(0.62, 0.12, 0.04, 18), 'wIron', { p: [sx * 1.76, HD + 0.6, -6.1], r: [0, 0, PI / 2], c: ironC });
    // the spoil conveyor: a straight inclined belt up the starboard side from behind the drum to a portal at the stern (two
    // square posts and a flat head beam, no braces), its flights square bars across the belt, parallel
    const CX = 1.85, CZ0 = 4.6, CZ1 = -5.4, CY0 = HD + 0.7, CY1 = HD + 5.4, CL = Math.hypot(CZ0 - CZ1, CY1 - CY0), CA = Math.atan2(CY1 - CY0, CZ0 - CZ1);
    const cm = [CX, (CY0 + CY1) / 2, (CZ0 + CZ1) / 2];
    b.add(rb(1.3, 0.18, CL, 0.04), M, { p: cm, r: [CA, 0, 0], c: hull2C });
    for (const sx of [-1, 1]) b.add(rb(0.1, 0.42, CL, 0.03), M, { p: [CX + sx * 0.68, cm[1] + 0.12, cm[2]], r: [CA, 0, 0], c: hullC });
    const nf = 16;
    for (let i = 0; i < nf; i++) {
      const t = (i + 0.5) / nf, z = CZ0 + (CZ1 - CZ0) * t, y = CY0 + (CY1 - CY0) * t + 0.14;
      b.add(rb(1.2, 0.1, 0.12, 0.02), 'wIron', { p: [CX, y, z], r: [CA, 0, 0], c: '#4a4642' });
    }
    // spoil on the belt in flat slabs between the flights
    for (let i = 0; i < 6; i++) { const t = 0.1 + i * 0.14, z = CZ0 + (CZ1 - CZ0) * t, y = CY0 + (CY1 - CY0) * t + 0.22; b.add(rb(1.0, 0.16, 0.5, 0.06), 'wPaint', { p: [CX, y, z], r: [CA, 0, 0], c: wear(i % 2 ? MUD : MUD2, 0.15, i) }); }
    for (const sx of [-1, 1]) b.add(rb(0.4, CY1 - HD + 0.2, 0.4, 0.05), 'wIron', { p: [CX + sx * 0.85, HD + (CY1 - HD) / 2, CZ1 + 0.3], c: ironC });
    b.add(rb(2.2, 0.36, 0.5, 0.05), M, { p: [CX, CY1 + 0.25, CZ1 + 0.3], c: hullC });
    b.add(rb(1.4, 0.24, 0.9, 0.04), M, { p: [CX, CY1 - 0.3, CZ1 - 0.5], r: [0.6, 0, 0], c: hull2C });
    b.add(rb(0.6, 0.9, 0.5, 0.05), 'wIron', { p: [CX, CY0 - 0.2, CZ0 + 0.1], c: ironC });
    // the drum arms' bearings at the bow, square blocks on the deck's front corners
    for (const sx of [-1, 1]) b.add(rb(0.9, 1.1, 1.1, 0.08), 'wIron', { p: [sx * 2.4, HD + 0.2, 5.0], c: ironC });
    // the bow: a flat plated face (no openings) and a timber fender beam low across it
    b.addBuilder(pl(4.8, 2.0, 0.14, { mat: M, c: hullC, c2: hull2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 2615 }), { p: [0, HB + 1.5, 5.62] });
    b.add(rb(5.0, 0.4, 0.4, 0.06), 'wWood', { p: [0, HB + 0.35, 5.7], c: woodC });
    // mud slopped over the bow deck and the treads' skirts, moss on the roofs and the winch house, a dark wet band low
    mud(b, 0.6, HD + 0.14, 3.6, 3.4, 2.0, 12, 0.26);
    mud(b, -2.0, HD + 0.14, -3.2, 1.2, 1.0, 5, 0.2);
    for (const sx of [-1, 1]) mud(b, sx * 3.3, 2.65, 0, 1.2, 10.0, 16, 0.24);
    moss(b, -0.8, HD + 3.4, -0.6, 3.2, 4.2, 8, 0.2);
    moss(b, 0, HD + 2.18, -4.6, 4.0, 2.0, 5, 0.18);
    mossHanks(b, -2.54, HD + 3.1, -2.6, 1.4, 10, 0.6);
    for (const sx of [-1, 1]) b.add(rb(0.12, 0.5, 11.4, 0.03), 'wDark', { p: [sx * 2.74, HB + 0.3, -0.2], c: '#1e1c1a' });
  }, 2617));
  // the drum boom: two long straight side arms from the bow bearings, the solid drum between their front ends under a flat
  // hood as wide and deep as the drum
  const DR = 1.6, DL = 6.0;
  const boom = pivot(body, 0, HD + 0.2, 5.0);
  boom.add(part((b) => {
    b.add(cyl(0.4, 0.4, 5.6, 14), 'wIron', { r: [0, 0, PI / 2], c: ironC });
    for (const sx of [-1, 1]) {
      b.add(rb(0.6, 0.9, 4.6, 0.08), M, { p: [sx * 3.25, -0.6, 2.1], r: [0.28, 0, 0], c: hullC });
      b.add(rb(0.8, 1.2, 1.2, 0.08), 'wIron', { p: [sx * 3.25, -1.3, 4.3], c: ironC });
      b.addBuilder(pl(3.6, 0.6, 0.08, { mat: M, c: hull2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, inset: false, seed: 2618 }), { p: [sx * 3.58, -0.62, 2.0], r: [0.28, sx * PI / 2, 0] });
    }
    b.add(rb(7.0, 0.22, 3.6, 0.05), M, { p: [0, 0.75, 4.3], c: wear(P.paint, 0.3, 2619) });
    for (const sx of [-1, 1]) b.add(rb(0.16, 1.4, 3.6, 0.04), M, { p: [sx * 3.45, 0.1, 4.3], c: hullC });
    b.add(rb(7.1, 0.3, 0.3, 0.05), 'wIron', { p: [0, 0.75, 6.1], c: ironC });
    bolts(b, 'wBrass', [-3.2, 0.9, 6.0], [3.2, 0.9, 6.0], 12, 0.05, 'y', trimC);
    mud(b, 0, 0.9, 4.3, 6.0, 3.0, 12, 0.24);
    moss(b, 0, 0.9, 4.0, 6.0, 2.6, 6, 0.18);
  }, 2621));
  const spin = pivot(boom, 0, -1.3, 4.3);
  spin.add(part((b) => b.addBuilder(drum(DR, DL, { mat: 'wIron', c: rained('#5a5650', -3, 0.3, 2622), hoopC: '#6e6a64', capC: trimC, n: 9, seed: 2623 })), 2624));
  const exhaust = smoke({ rate: 4.5, life: 3.0, size: 1.5, rise: 1.6, color: 0x8a8884, opacity: 0.45, spread: 0.35 });
  exhaust.position.set(-1.6, HD + 7.0, -1.6); body.add(exhaust);
  const spoil = smoke({ rate: 5, life: 1.6, size: 1.3, rise: -2.6, color: 0x6a4a3a, opacity: 0.6, spread: 0.6 });
  spoil.position.set(1.85, HD + 4.6, -6.4); body.add(spoil);
  const spray = smoke({ rate: 0, life: 1.3, size: 2.2, rise: 0.6, color: 0x6a4a3a, opacity: 0.55, spread: 2.6 });
  spray.position.set(0, -1.4, 5.8); boom.add(spray);
  const glow = slotGlow(P.glowHex, 2.0, 0.8, 0.55, { ry: -PI / 2 }); glow.position.set(-2.6, HD + 1.5, -0.6); body.add(glow);
  const a = new Anim(root, { base, body, boom, spin, wheels: TR.wheels });
  a.dynamics.push(exhaust, glow, spoil);
  let dist = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 2.2), e = 1 - Math.pow(1 - k, 2);
      // the drum drops into the mud and the engine settles nose down over it, listing to port
      p.boom.rotation.x = 0.32 * e; p.body.rotation.x = 0.05 * e; p.body.rotation.z = -0.05 * e; p.body.position.y = -0.4 * e;
      exhaust.visible = false; spoil.visible = false; spray.visible = false;
      glow.material.opacity = 0.55 * (1 - k);
      return;
    }
    exhaust.visible = true; spoil.visible = true; spray.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    for (const w of p.wheels) w.rotation.x += (this.speed / 1.3) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    p.body.position.y = Math.abs(Math.sin(this.t * 3)) * 0.04 * Math.min(1, this.speed) + Math.sin(this.t * 0.6) * 0.02;
    p.body.rotation.x = 0; p.body.rotation.z = 0;
    let br = Math.sin(this.t * 0.5) * 0.02, by = 0, rate = 0.8, sr = 0, so = 5;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      if (this.atkKind === 'slam') {
        // the drum is hauled right up on its arms and dropped onto the slope
        const up = at < 0.45 ? at / 0.45 : 1, down = at < 0.45 ? 0 : Math.min(1, (at - 0.45) / 0.08), rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
        br += (-0.5 * up + 0.62 * down) * (1 - rec);
        if (down > 0 && rec === 0) { p.body.position.y -= 0.16 * Math.sin(Math.min(1, (at - 0.45) / 0.18) * PI); sr = 44; }
        rate = 3; so = 14;
      } else {
        // the drum is lowered and swung across the front, racing, and drawn back
        const set = at < 0.35 ? at / 0.35 : 1, sweep = at < 0.35 ? 0 : Math.min(1, (at - 0.35) / 0.25), rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
        br += 0.16 * set * (1 - rec);
        by = (0.12 * set - 0.26 * sweep) * (1 - rec);
        if (sweep > 0 && rec === 0) sr = 36;
        rate = 3.6; so = 10;
      }
    }
    p.boom.rotation.x = br; p.boom.rotation.y = by;
    p.spin.rotation.x += rate * dt * ts * PI * 2;
    spray.userData.rate = sr; spoil.userData.rate = so;
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z += Math.sin(this.t * 25) * this.hitT * 0.008; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
    spray.userData.update(dt, this.t);
  };
  return finish(root, a, 13.0);
}
