// The Makers' Rest (Part Twelve raid, level 55): the four boss machines of the Makers' last workshop under the hollow at the
// head of the Windward Heights. The Makers' workshop look, cleaner than the frost machines: oiled timber, black iron, bright
// worked brass, grey-green shop paint and whitewash trim, small brass labels on everything, and only a little frost.
//  - The Shop Crane: a gantry crane come down off its rails. Two end carriages along z on wheeled bogies (three solid wheels
//    a side), a square post at each end of each carriage, a side girder along the top of each pair of posts, and two plate
//    girder bridges along x at the carriages' ends (so from above the frame is one plain rectangle, never an H). A trolley
//    rides the bridges: a deck plate with a square winding house and one solid drum under it, two chains down to a square
//    spreader beam carrying a crated casting (the load it drops). One square lantern on the left carriage only; a small square
//    boiler and stack on the right carriage.
//  - The Board Plane: a long planing engine on two wide treads. A long iron bed with a half-planed sail-board clamped on it
//    slides fore and aft under a square cutter-block housing at the front (the board's front end always stays inside it, so
//    from above it is one bar running into one square block); a square steam engine at the back drives the cutter block by a
//    flat belt over two solid pulleys of different sizes on the right flank; a rack of finished boards on the left deck; pale
//    shavings heaped on a tray at the front.
//  - The Great Lathe: a heavy turning engine on a wide tracked deck (the deck covers the treads from above). A long bed of two
//    flat iron rails along x; a square headstock at the left driven by a flat belt from overhead line shafting on two square
//    posts behind it; a solid faceplate (edge-on from the front, never a round "eye") with a wind-engine hub clamped to it (a
//    plain drum with three flat square lugs, not a star); the hub's axle runs to a square tailstock at the right; a tool
//    carriage between with one tool post. Hot swarf curls on the bed; one square gauge on the headstock's back.
//  - THE GREAT GOVERNOR: the engine that kept every tower in time, against the north wall, never moving. A stepped stone
//    plinth; a long timing frame of oiled timber and black iron, two square end towers under a flat lintel (no arch); a long
//    solid timing drum turning slowly under the lintel, flat square cams in a staggered row round it; twelve square brake rods
//    rising out of twelve square floor slots in three groups of four, each lifting as its cam passes; a heavy square pendulum
//    on the right tower's face, swinging the count; a square steam cylinder at the left foot; ONE flat wind-vane board on a
//    post on the right tower's roof; one gauge board on the left tower.
// Same interface as the other machines: userData.machine = { update(dt, speed), attack(dur, kind), hit(), die(), revive(), stun }.
// attack(dur, 'main') is the melee swing; attack(dur, 'slam') is a telegraphed strike (each boss alternates its slam moves).
// Content rules: no faces (at most one square sight gauge per machine, off-centre; never two round lamps or ports side by side,
// never a single round lamp front and centre, no slot or grille under any lamp or gauge; lamps are square lanterns hung off to
// one side), nothing animal-like (treads or wheeled bogies, never legs), no spokes (wheels and pulleys are solid discs with an
// off-centre bolt plate), no crosses (straps, ribs and braces run one way, no X bracing, a shaft through a pulley only where
// the pulley is a wide drum), no domes, rings, stars or radiating patterns; everything square from above.
import * as THREE from 'three';
import { box, rbox, cyl, ico, torus } from './kit.js';
import { plate, heroTreads, crawl, wear, grime, bolts, bdisc, flywheel, stack } from './bossParts.js';
import { smoke, glowSprite } from './dynamic.js';
import { slotGlow } from './slotGlow.js';
import { Anim, finish, part, pivot } from './quarryMachines.js';

const PI = Math.PI;
const rb = (w, h, d, r) => rbox(w, h, d, r, 1);
const pl = (w, h, d, o = {}) => plate(w, h, d, { br: Math.max(0.035, Math.min(0.07, Math.min(w, h) * 0.05)), ...o });
// oiled timber and its darker grain, black iron, bright worked brass, grey-green shop paint and its shade, whitewash, pale
// planed timber, a little frost
const TIMB = '#7a5c3e', TIMB2 = '#5e4630', IRON = '#3e4246', BRASS = '#b08a50', SHOP = '#6e7a6e', SHOP2 = '#5a665a', WASH = '#e4dccb', PALE = '#e8d4a8', FROST = '#eef5fa';

// a brass label: a small square plate with two rivets along its top (the Makers labelled everything; no marks on it)
function label(b, p, ry = 0, s = 1) {
  b.add(rb(0.42 * s, 0.3 * s, 0.03, 0.01), 'wBrass', { p, r: [0, ry, 0], c: '#c8a060' });
  const ox = Math.cos(ry) * 0.15 * s, oz = -Math.sin(ry) * 0.15 * s, nx = Math.sin(ry) * 0.02, nz = Math.cos(ry) * 0.02;
  for (const k of [-1, 1]) b.add(box(0.035, 0.035, 0.02), 'wIron', { p: [p[0] + k * ox + nx, p[1] + 0.1 * s, p[2] + k * oz + nz], r: [0, ry, 0], c: '#3a3c40' });
}
// one sight-gauge strip: a lit glass in a dark frame (always single, never a pair)
function gauge(b, p, h, ry = 0) {
  b.add(rb(0.18, h + 0.12, 0.08, 0.02), 'wDark', { p, r: [0, ry, 0], c: '#2e3236' });
  b.add(box(0.08, h, 0.03), 'wGlowAmber', { p: [p[0] + Math.sin(ry) * 0.035, p[1], p[2] + Math.cos(ry) * 0.035], r: [0, ry, 0] });
}
// a square lantern hung off a bracket: iron cap and foot, four corner bars, a lit square glass between (one per machine)
function lantern(b, p) {
  const [x, y, z] = p;
  b.add(rb(0.42, 0.08, 0.42, 0.02), 'wIron', { p: [x, y + 0.3, z], c: IRON });
  b.add(rb(0.36, 0.06, 0.36, 0.02), 'wIron', { p: [x, y - 0.3, z], c: IRON });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.05, 0.56, 0.05), 'wBrass', { p: [x + sx * 0.16, y, z + sz * 0.16], c: BRASS });
  b.add(box(0.26, 0.48, 0.26), 'wGlowAmber', { p: [x, y, z] });
  b.add(box(0.06, 0.2, 0.06), 'wIron', { p: [x, y + 0.44, z], c: IRON });
}
// a timber crate: horizontal slats on each face between square corner battens (never a brace across a face), a brass label
function crate(b, cx, cy, cz, w, h, d, seed = 1, o = {}) {
  const c = wear(o.c || TIMB, 0.35, seed), cb = wear(TIMB2, 0.3, seed + 1);
  b.add(rb(w - 0.06, h - 0.06, d - 0.06, 0.03), 'wWood', { p: [cx, cy, cz], c: wear('#4e3a28', 0.3, seed + 2) });
  const n = Math.max(2, Math.round(h / 0.32)), sh = h / n;
  for (let i = 0; i < n; i++) {
    const y = cy - h / 2 + sh * (i + 0.5);
    b.add(box(w - 0.12, sh * 0.82, 0.05), 'wWood', { p: [cx, y, cz + d / 2 - 0.02], c });
    b.add(box(w - 0.12, sh * 0.82, 0.05), 'wWood', { p: [cx, y, cz - d / 2 + 0.02], c });
    b.add(box(0.05, sh * 0.82, d - 0.12), 'wWood', { p: [cx + w / 2 - 0.02, y, cz], c });
    b.add(box(0.05, sh * 0.82, d - 0.12), 'wWood', { p: [cx - w / 2 + 0.02, y, cz], c });
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.12, h + 0.02, 0.12), 'wWood', { p: [cx + sx * (w / 2 - 0.04), cy, cz + sz * (d / 2 - 0.04)], c: cb });
  b.add(rb(w - 0.04, 0.06, d - 0.04, 0.02), 'wWood', { p: [cx, cy + h / 2 + 0.01, cz], c });
  if (o.label !== false) label(b, [cx - w * 0.22, cy + h * 0.18, cz + d / 2 + 0.03], 0, Math.min(1.4, w * 0.5));
}
// pale wood shavings heaped over a rectangle
function shavings(b, cx, y, cz, w, d, n, s = 0.16) {
  for (let i = 0; i < n; i++) b.add(ico(s * b.r(0.6, 1.3), 0), 'wWood', { p: [cx + b.r(-w / 2, w / 2), y + b.r(0, s * 0.6), cz + b.r(-d / 2, d / 2)], s: [b.r(1.2, 1.8), b.r(0.4, 0.7), b.r(1.0, 1.6)], r: [b.r(0, 3), b.r(0, 3), 0], c: i % 3 ? PALE : '#d8bc88' });
}
// hot swarf: flattened chips of turned iron, heat-tinted (v112 leftovers: were part-ring curls, which read as crescents)
function swarf(b, cx, y, cz, w, d, n) {
  for (let i = 0; i < n; i++) b.add(ico(b.r(0.05, 0.08), 0), 'wIron', { p: [cx + b.r(-w / 2, w / 2), y + 0.025, cz + b.r(-d / 2, d / 2)], s: [b.r(1.2, 1.8), 0.35, b.r(0.8, 1.2)], r: [0, b.r(0, 3), 0], c: i % 3 === 0 ? '#9a6a3a' : i % 3 === 1 ? '#6a6e78' : '#8a7a5a' });
}
// a little frost where the workshop doors let the cold in: a few flattened pale lumps
function frost(b, cx, y, cz, w, d, n, s = 0.08) {
  for (let i = 0; i < n; i++) b.add(ico(s * b.r(0.6, 1.1), 0), 'wPaint', { p: [cx + b.r(-w / 2, w / 2), y, cz + b.r(-d / 2, d / 2)], s: [1.6, 0.34, 1.3], r: [0, b.r(0, 3), 0], c: wear(FROST, 0.12, i) });
}
// a short chain of flat links hanging down from the origin, one unit long (the caller scales it in y)
function chain(b, x, z, n = 10) {
  for (let i = 0; i < n; i++) b.add(box(i % 2 ? 0.05 : 0.14, 1 / n * 1.1, i % 2 ? 0.14 : 0.05), 'wIron', { p: [x, -(i + 0.5) / n, z], c: '#2e3034' });
}
const steam = (rate = 3, size = 0.8, rise = 1.4, opacity = 0.4) => smoke({ rate, life: 1.8, size, rise, color: 0xeef0f2, opacity, spread: 0.3 });
const sparks = (rate = 0) => smoke({ rate, life: 0.45, size: 0.18, rise: 1.6, color: 0xffc070, opacity: 0.9, spread: 2.2 });
const chips = (rate = 0, size = 0.32) => smoke({ rate, life: 1.1, size, rise: 0.5, color: 0xf0dcb0, opacity: 0.75, spread: 2.6 });
// the common drive update: wheels turn, track runs crawl
function drive(a, wheels, runs, dt, speed, r = 0.7) {
  const ts = a.stun ? 0.15 : 1;
  a.speed += (speed - a.speed) * Math.min(1, dt * 3);
  for (const w of wheels) w.rotation.x += (a.speed / r) * dt * ts;
  if (runs) { a.dist = (a.dist || 0) + a.speed * dt * ts; crawl(runs, a.dist); }
  return ts;
}
const ease = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 2);

// ==========================================================================
// THE SHOP CRANE (about 9 m tall, 9 m wide, 5.4 m long)
// ==========================================================================
export function buildShopCrane() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const body = pivot(base, 0, 0, 0);
  const sC = grime(SHOP, 0.3, 8.5, 0.28, 1), s2C = wear(SHOP2, 0.3, 2), iC = wear(IRON, 0.25, 3), bC = wear(BRASS, 0.3, 4), tC = wear(TIMB, 0.35, 5);
  const P = (w, h, d, seed, o = {}) => pl(w, h, d, { mat: 'wPaint', c: sC, c2: s2C, trim: 'wIron', trimC: iC, boltMat: 'wBrass', boltC: bC, seed, ...o });
  const X = 4.0, CL = 5.4, WR = 0.62, CY = 1.75, TOP = 7.1, BY = 7.6, BZ = CL / 2 - 0.3; // carriage x, length, wheel radius, carriage centre, post tops, bridge centre, bridge z
  body.add(part((b) => {
    for (const sx of [-1, 1]) {
      const x = sx * X;
      // the end carriage: a long box girder over its bogie, plated on the outer face, a trim lip along its top
      b.add(rb(0.9, 0.9, CL, 0.08), 'wPaint', { p: [x, CY, 0], c: sC });
      b.addBuilder(P(CL - 0.6, 0.62, 0.1, 3101 + sx), { p: [x + sx * 0.46, CY, 0], r: [0, sx * PI / 2, 0] });
      b.add(rb(1.0, 0.12, CL + 0.1, 0.03), 'wIron', { p: [x, CY + 0.5, 0], c: iC });
      // the bogie's inner side frame (the axle boxes sit on it, out of sight), the outer face of each wheel stays plain
      b.add(rb(0.16, 0.7, CL - 0.4, 0.03), 'wIron', { p: [x - sx * 0.4, 0.82, 0], c: iC });
      for (const z of [-1.9, 0, 1.9]) b.add(rb(0.3, 0.36, 0.5, 0.03), 'wIron', { p: [x - sx * 0.52, WR, z], c: '#34373b' });
      b.add(rb(0.9, 0.2, 0.3, 0.03), 'wIron', { p: [x, 0.9, CL / 2 - 0.1], c: iC }); // buffer beams at the carriage ends
      b.add(rb(0.9, 0.2, 0.3, 0.03), 'wIron', { p: [x, 0.9, -CL / 2 + 0.1], c: iC });
      // the two square posts, banded in iron, and the side girder joining their tops
      for (const sz of [-1, 1]) {
        const z = sz * BZ;
        b.add(rb(0.74, TOP - CY - 0.45, 0.74, 0.06), 'wPaint', { p: [x, (TOP + CY + 0.45) / 2, z], c: sC });
        for (const y of [2.9, 5.0]) b.add(rb(0.82, 0.12, 0.82, 0.02), 'wIron', { p: [x, y, z], c: iC });
        b.add(rb(0.9, 0.3, 0.9, 0.04), 'wIron', { p: [x, CY + 0.6, z], c: iC }); // the post's foot plate
        bolts(b, 'wBrass', [x - 0.3, CY + 0.6, z + sz * 0.46], [x + 0.3, CY + 0.6, z + sz * 0.46], 3, 0.04, 'z', bC);
      }
      b.add(rb(0.62, 0.6, 2 * BZ - 0.6, 0.05), 'wPaint', { p: [x, TOP + 0.1, 0], c: s2C });
      for (const y of [TOP - 0.18, TOP + 0.38]) b.add(rb(0.74, 0.08, 2 * BZ - 0.6, 0.02), 'wIron', { p: [x, y, 0], c: iC });
      label(b, [x + sx * 0.52, CY + 0.05, 1.4], sx * PI / 2, 1.2);
    }
    // the two plate-girder bridges along x at the carriages' ends: web, top and bottom flanges, a few short stiffeners on the
    // web between the flanges (never past them), the trolley's rail along the top
    for (const sz of [-1, 1]) {
      const z = sz * BZ, L = 2 * X + 0.9;
      b.add(rb(L, 1.0, 0.36, 0.04), 'wPaint', { p: [0, BY, z], c: sC });
      for (const y of [BY - 0.5, BY + 0.5]) b.add(rb(L + 0.04, 0.14, 0.62, 0.03), 'wIron', { p: [0, y, z], c: iC });
      for (let i = 0; i < 6; i++) { const x = -3.2 + i * 1.28; b.add(box(0.08, 0.84, 0.5), 'wIron', { p: [x, BY, z], c: iC }); }
      b.add(box(L - 0.4, 0.12, 0.12), 'wIron', { p: [0, BY + 0.63, z], c: '#7a7e84' });
      bolts(b, 'wBrass', [-3.8, BY - 0.5, z + sz * 0.33], [3.8, BY - 0.5, z + sz * 0.33], 14, 0.04, 'z', bC);
      label(b, [-2.6, BY + 0.15, z + sz * 0.2], sz > 0 ? 0 : PI, 1.1);
    }
    frost(b, -2.0, BY + 0.58, BZ, 2.4, 0.4, 5);
    // the small boiler on the right carriage (its stack is its own builder), one sight gauge on its outer side
    b.add(rb(1.1, 1.6, 1.8, 0.08), 'wBronze', { p: [X, CY + 1.25, -0.6], c: wear('#5a4a3a', 0.3, 6) });
    for (const y of [CY + 0.8, CY + 1.75]) b.add(rb(1.16, 0.08, 1.86, 0.02), 'wIron', { p: [X, y, -0.6], c: iC });
    b.addBuilder(stack(0.46, 2.6, { c: '#34302c', trimC: '#5a5450', seed: 3108 }), { p: [X, CY + 2.05, -1.0] });
    gauge(b, [X + 0.57, CY + 1.3, -0.2], 0.8, PI / 2);
    // the square lantern on the left carriage only, hung off a bracket from the front post's outer face
    b.add(rb(0.7, 0.08, 0.08, 0.02), 'wIron', { p: [-X - 0.62, 4.9, BZ], c: iC });
    b.add(box(0.04, 0.3, 0.04), 'wIron', { p: [-X - 0.9, 4.72, BZ], c: '#2e3034' });
    lantern(b, [-X - 0.9, 4.25, BZ]);
  }, 3110));
  // the wheels: three solid discs a side, each with an off-centre bolt plate (they turn as the crane runs)
  const wheels = [];
  for (const sx of [-1, 1]) for (const z of [-1.9, 0, 1.9]) {
    const w = pivot(body, sx * X, WR, z);
    w.add(part((b) => b.addBuilder(flywheel(WR, 0.3, { c: '#4a4c50', hub: 'wBrass', hubC: BRASS, seed: 3120 })), 3120 + wheels.length));
    wheels.push(w);
  }
  // the trolley riding the bridges: a deck plate spanning both, four small solid wheels on the rails, the square winding house
  // on top with a flat roof, the solid winding drum slung under the deck
  const trolley = pivot(body, 0, BY + 0.7, 0);
  trolley.add(part((b) => {
    b.add(rb(2.4, 0.26, 2 * BZ + 0.6, 0.04), 'wIron', { p: [0, 0.22, 0], c: iC });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(rb(0.34, 0.3, 0.5, 0.03), 'wIron', { p: [sx * 0.85, 0.0, sz * BZ], c: '#34373b' });
    b.add(rb(2.0, 1.5, 2.2, 0.08), 'wPaint', { p: [0, 1.1, 0], c: wear(WASH, 0.18, 7) });
    b.add(rb(2.0, 0.1, 2.2, 0.02), 'wWood', { p: [0, 0.4, 0], c: tC }); // timber sill
    b.add(rb(2.3, 0.14, 2.5, 0.03), 'wIron', { p: [0, 1.92, 0], c: iC });
    b.add(rb(2.1, 0.12, 2.3, 0.05), 'wWood', { p: [0, 2.04, 0], c: wear(TIMB2, 0.3, 8) });
    b.add(rb(0.8, 1.1, 0.05, 0.02), 'wWood', { p: [0.4, 1.0, 1.11], c: tC }); // a plank door, off-centre
    b.add(box(0.06, 0.06, 0.05), 'wBrass', { p: [0.1, 1.0, 1.15], c: BRASS });
    label(b, [-0.55, 1.35, 1.13], 0);
    frost(b, 0, 2.12, 0, 1.8, 2.0, 5);
    // the drum's bearings under the deck
    for (const sx of [-1, 1]) b.add(rb(0.3, 0.7, 0.7, 0.04), 'wIron', { p: [sx * 0.95, -0.25, 0], c: iC });
  }, 3130));
  const drum = pivot(trolley, 0, -0.45, 0);
  drum.add(part((b) => {
    b.add(cyl(0.42, 0.42, 1.6, 20), 'wIron', { r: [0, 0, PI / 2], c: '#55585e' });
    b.add(rb(0.3, 0.12, 0.2, 0.02), 'wBrass', { p: [0.4, 0.43, 0], c: BRASS }); // one bolt plate, so the turn shows
  }, 3131));
  // the load: two chains off the drum down to a square spreader beam, two short hangers to a crated casting
  const LEN = 3.6;
  const load = pivot(trolley, 0, -0.85, 0);
  const chains = pivot(load, 0, 0, 0);
  chains.add(part((b) => { chain(b, -0.5, 0, 12); chain(b, 0.5, 0, 12); }, 3132));
  chains.scale.y = LEN;
  const hook = pivot(load, 0, -LEN, 0);
  hook.add(part((b) => {
    b.add(rb(2.4, 0.3, 0.5, 0.04), 'wPaint', { p: [0, -0.15, 0], c: wear('#c8a040', 0.25, 9) }); // the spreader, painted yellow-ochre
    for (const sx of [-1, 1]) b.add(rb(0.24, 0.12, 0.24, 0.02), 'wIron', { p: [sx * 0.5, 0.03, 0], c: iC });
    for (const sx of [-1, 1]) b.add(box(0.08, 0.5, 0.08), 'wIron', { p: [sx * 0.9, -0.55, 0], c: '#2e3034' });
    crate(b, 0, -1.55, 0, 2.0, 1.5, 1.6, 3133);
    b.add(rb(1.2, 0.5, 1.0, 0.06), 'wIron', { p: [0, -0.62, 0], c: grime('#4a4c50', -0.9, -0.4, 0.3, 10) }); // the casting's top above the slats
  }, 3133));
  const puff = steam(2.2, 0.9, 1.6, 0.4); puff.position.set(X, CY + 4.9, -1.0); body.add(puff);
  const glow = glowSprite(0xffc070, 1.3, 0.55); glow.position.set(-X - 0.9, 4.25, BZ); body.add(glow);
  const dust = chips(0, 0.6); dust.position.set(0, 0.3, 0); body.add(dust); // the dust and splinters when the load lands
  const a = new Anim(root, { base, body, wheels, trolley, drum, load, chains, hook });
  a.dynamics.push(puff, glow, dust);
  let tx = 0, sway = 0, swayV = 0, drop = 0, slamN = 0, mode = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    const setLoad = (d) => { p.chains.scale.y = LEN + d; p.hook.position.y = -LEN - d; };
    if (this.dead) {
      // the brake lets go: the trolley runs to the end of its bridges, the load drops to the floor, the frame settles askew
      this.deadT += dt;
      const k = ease(this.deadT / 1.6);
      tx += (2.4 - tx) * Math.min(1, dt * 1.5); p.trolley.position.x = tx;
      drop += (2.0 - drop) * Math.min(1, dt * 4); setLoad(drop); p.load.rotation.z = 0;
      p.body.rotation.z = 0.035 * k; p.body.position.y = -0.12 * k;
      puff.userData.rate = 0; dust.userData.rate = this.deadT < 0.7 ? 14 : 0;
      for (const d of this.dynamics) d.userData.update?.(dt, this.t);
      return;
    }
    puff.userData.rate = 2.2;
    const ts = drive(this, p.wheels, null, dt, speed, WR);
    const at = this.stepAttack(dt);
    if (at >= 0 && at < dt / this.atkDur + 1e-3 && this.atkKind === 'slam') mode = slamN++ % 2;
    // idle: the trolley creeps along the bridges and back; slam A runs it out along the bridges (the spreader sweeps), slam B
    // drops the load and winches it back; the melee swing jerks the trolley and swings the load
    let txT = Math.sin(this.t * 0.35) * 0.35, dT = 0;
    if (at >= 0 && this.atkKind === 'slam' && mode === 0) txT = 2.3 * Math.sin(Math.min(1, at * 1.25) * PI);
    if (at >= 0 && this.atkKind === 'slam' && mode === 1) dT = at < 0.55 ? 0 : at < 0.68 ? 2.0 * (at - 0.55) / 0.13 : 2.0 * (1 - (at - 0.68) / 0.32);
    if (at >= 0 && this.atkKind !== 'slam') txT += 0.6 * Math.sin(at * PI);
    const pv = tx;
    tx += (txT - tx) * Math.min(1, dt * 3) * ts;
    const acc = (tx - pv) / Math.max(dt, 1e-3);
    p.trolley.position.x = tx;
    // the load hangs as a damped pendulum off the trolley
    swayV += (-sway * 3.2 - acc * 0.12) * dt - swayV * 0.8 * dt;
    sway += swayV * dt;
    p.load.rotation.z = Math.max(-0.4, Math.min(0.4, sway)) + Math.sin(this.t * 1.3) * 0.012;
    const pd = drop;
    drop += (dT - drop) * Math.min(1, dt * (dT > drop ? 14 : 3));
    setLoad(drop);
    p.drum.rotation.x += (drop - pd) / 0.42 + (tx - pv) * 0.2;
    dust.userData.rate = drop > 1.8 && dT > 1.5 ? 30 : 0;
    p.body.position.y = Math.abs(Math.sin(this.t * 2.6)) * 0.02 * Math.min(1, this.speed);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z = Math.sin(this.t * 25) * this.hitT * 0.01; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  a.revive = function () { this.dead = false; this.deadT = 0; drop = 0; tx = 0; sway = swayV = 0; };
  return finish(root, a, 9.0);
}

// ==========================================================================
// THE BOARD PLANE (about 6 m tall, 9 m long with its bed in)
// ==========================================================================
export function buildBoardPlane() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 4.2, len: 8.0, h: 1.4, tw: 0.95, paint: 'wPaint', paintC: SHOP2, linkC: '#555a60', road: 2, seed: 3210 });
  const body = pivot(base, 0, 0, 0);
  const sC = grime(SHOP, 1.2, 5.6, 0.28, 11), s2C = wear(SHOP2, 0.3, 12), iC = wear(IRON, 0.25, 13), bC = wear(BRASS, 0.3, 14), tC = wear(TIMB, 0.35, 15);
  const P = (w, h, d, seed, o = {}) => pl(w, h, d, { mat: 'wPaint', c: sC, c2: s2C, trim: 'wIron', trimC: iC, boltMat: 'wBrass', boltC: bC, seed, ...o });
  const DY = 2.68, HZ0 = 1.0, HZ1 = 4.0; // the deck's top, the cutter housing's back and front
  body.add(part((b) => {
    // the hull and deck
    b.add(rb(3.4, 1.2, 7.8, 0.1), 'wPaint', { p: [0, 2.0, 0], c: sC });
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) b.addBuilder(P(2.2, 0.85, 0.1, 3211 + i), { p: [sx * 1.72, 2.0, -2.5 + i * 2.5], r: [0, sx * PI / 2, 0] });
    b.add(rb(4.3, 0.16, 8.1, 0.04), 'wIron', { p: [0, DY - 0.08, 0], c: iC });
    for (const sx of [-1, 1]) b.add(box(0.08, 0.08, 8.1), 'wBrass', { p: [sx * 2.15, DY, 0], c: bC });
    // the bed's ways: two flat iron guides along the deck the bed slides on
    for (const sx of [-1, 1]) b.add(rb(0.3, 0.16, 7.4, 0.03), 'wIron', { p: [sx * 0.7, DY + 0.08, -0.2], c: '#5a5e64' });
    // the cutter housing at the front, standing over the bed: two square side blocks and a deep top block, a plain plated front
    // with one plank inspection door off to the right; the cutter block's drum turns inside, out of sight
    for (const sx of [-1, 1]) {
      b.add(rb(0.8, 2.3, HZ1 - HZ0, 0.08), 'wPaint', { p: [sx * 1.6, DY + 1.15, (HZ0 + HZ1) / 2], c: sC });
      for (const y of [DY + 0.4, DY + 1.9]) b.add(rb(0.86, 0.1, HZ1 - HZ0 + 0.06, 0.02), 'wIron', { p: [sx * 1.6, y, (HZ0 + HZ1) / 2], c: iC });
    }
    b.add(rb(4.0, 1.4, HZ1 - HZ0, 0.1), 'wPaint', { p: [0, DY + 2.95, (HZ0 + HZ1) / 2], c: sC });
    b.addBuilder(P(3.6, 1.0, 0.1, 3215, { inset: false }), { p: [0, DY + 2.95, HZ1 + 0.02] });
    b.add(rb(0.06, 0.8, 0.9, 0.02), 'wWood', { p: [-2.04, DY + 2.95, 2.6], c: tC }); // a plank inspection door on the left side (the front stays plain)
    b.add(rb(4.2, 0.16, HZ1 - HZ0 + 0.2, 0.03), 'wIron', { p: [0, DY + 3.72, (HZ0 + HZ1) / 2], c: iC });
    b.add(rb(3.9, 0.14, HZ1 - HZ0 - 0.1, 0.05), 'wWood', { p: [0, DY + 3.86, (HZ0 + HZ1) / 2], c: wear(TIMB2, 0.3, 16) });
    frost(b, -0.6, DY + 3.95, (HZ0 + HZ1) / 2, 2.4, 2.0, 5);
    label(b, [-2.03, DY + 1.3, 2.0], -PI / 2, 1.3);
    // the cutter block's axle out through the right side block to its small pulley
    b.add(cyl(0.12, 0.12, 0.5, 10), 'wIron', { p: [2.2, DY + 1.6, 2.6], r: [0, 0, PI / 2], c: '#7a7e84' });
    // the shavings tray bolted across the bow, heaped with pale shavings (off to the left)
    b.add(rb(3.4, 0.14, 0.9, 0.03), 'wIron', { p: [0, 1.7, 4.35], c: iC });
    for (const sx of [-1, 1]) b.add(rb(0.12, 0.4, 0.9, 0.02), 'wIron', { p: [sx * 1.66, 1.88, 4.35], c: iC });
    shavings(b, -0.5, 1.82, 4.35, 2.2, 0.7, 16, 0.17);
    shavings(b, 0, DY + 0.06, 3.2, 3.6, 1.0, 10, 0.12);
    // the steam engine at the stern: a square engine block across the deck, its cylinder lying on top, one square stack, one
    // sight gauge on the left side (the pulleys are on the right)
    b.add(rb(3.6, 2.1, 1.7, 0.1), 'wPaint', { p: [0, DY + 1.05, -3.15], c: sC });
    b.addBuilder(P(3.2, 1.5, 0.1, 3217, { inset: false }), { p: [0, DY + 1.05, -4.02], r: [0, PI, 0] });
    for (const y of [DY + 0.3, DY + 1.8]) b.add(rb(3.7, 0.1, 1.8, 0.02), 'wIron', { p: [0, y, -3.15], c: iC });
    b.add(rb(1.2, 0.9, 1.5, 0.08), 'wBronze', { p: [0.5, DY + 2.55, -3.15], c: wear('#5a4a3a', 0.3, 17) });
    for (const z of [-3.85, -2.45]) b.add(rb(1.3, 1.0, 0.12, 0.03), 'wIron', { p: [0.5, DY + 2.55, z], c: iC });
    b.addBuilder(stack(0.5, 1.9, { c: '#34302c', trimC: '#5a5450', seed: 3218 }), { p: [-1.1, DY + 2.1, -3.4] });
    gauge(b, [-1.83, DY + 1.1, -2.8], 0.9, -PI / 2);
    // the engine pulley's bearing on the right
    b.add(rb(0.4, 0.9, 0.9, 0.04), 'wIron', { p: [2.0, DY + 1.25, -3.2], c: iC });
    // the rack of finished boards on the left deck: a low iron cradle with straight boards stacked flat
    for (const z of [-1.9, 0.2]) b.add(rb(1.1, 0.2, 0.3, 0.03), 'wIron', { p: [-1.55, DY + 0.1, z], c: iC });
    for (let i = 0; i < 4; i++) b.add(rb(0.95, 0.1, 3.0, 0.02), 'wWood', { p: [-1.55 + (i % 2) * 0.04, DY + 0.25 + i * 0.12, -0.85 + (i % 2) * 0.06], c: wear(i % 2 ? PALE : '#dcc494', 0.15, 18 + i) });
    label(b, [-1.55, DY + 0.33, 0.7], 0, 0.9);
    // an oil tank on the right deck
    b.add(rb(0.8, 0.7, 1.1, 0.06), 'wBronze', { p: [1.55, DY + 0.35, -1.0], c: wear('#5a4a3a', 0.3, 19) });
    b.add(rb(0.3, 0.12, 0.3, 0.03), 'wBrass', { p: [1.55, DY + 0.76, -1.2], c: bC });
    bolts(b, 'wBrass', [-1.74, 2.55, -3.6], [-1.74, 2.55, 3.6], 12, 0.045, 'x', bC);
    bolts(b, 'wBrass', [1.74, 2.55, -3.6], [1.74, 2.55, 3.6], 12, 0.045, 'x', bC);
  }, 3220));
  // the bed: a long iron table with a half-planed sail-board clamped on it (rough at the back, planed bright toward the front);
  // its front end never leaves the cutter housing, even run fully out
  const bed = pivot(body, 0, DY + 0.16, 0);
  bed.add(part((b) => {
    b.add(rb(1.8, 0.42, 5.6, 0.05), 'wIron', { p: [0, 0.21, -0.5], c: grime(IRON, 0, 0.42, 0.25, 20) });
    for (const x of [-0.45, 0, 0.45]) b.add(box(0.08, 0.04, 5.5), 'wDark', { p: [x, 0.43, -0.5], c: '#22252a' }); // T-slots along the table
    b.add(rb(1.4, 0.22, 2.6, 0.03), 'wWood', { p: [0, 0.54, -1.9], c: wear('#c4a274', 0.3, 21) });
    b.add(rb(1.4, 0.17, 2.4, 0.03), 'wWood', { p: [0, 0.515, 0.6], c: wear(PALE, 0.12, 22) });
    b.add(rb(1.8, 0.3, 0.3, 0.03), 'wIron', { p: [0, 0.57, -3.25], c: iC }); // the end clamp bar
    for (const sx of [-1, 1]) b.add(rb(0.16, 0.24, 0.5, 0.02), 'wIron', { p: [sx * 0.8, 0.55, -1.2], c: iC }); // side dogs
    label(b, [-0.5, 0.25, -3.32], PI, 0.8);
  }, 3221));
  // the two pulleys on the right flank, of different sizes and heights, and the flat belt between them
  const big = pivot(body, 2.4, DY + 1.25, -3.2);
  big.add(part((b) => b.addBuilder(flywheel(0.95, 0.34, { c: '#3e4044', seed: 3222 })), 3222));
  const small = pivot(body, 2.4, DY + 1.6, 2.6);
  small.add(part((b) => b.addBuilder(flywheel(0.45, 0.3, { c: '#3e4044', seed: 3223 })), 3223));
  body.add(part((b) => {
    const z0 = -3.2, y0 = DY + 1.25, z1 = 2.6, y1 = DY + 1.6, L = Math.hypot(z1 - z0, y1 - y0), ang = Math.atan2(y1 - y0, z1 - z0);
    for (const [r0, r1] of [[0.97, 0.47], [-0.97, -0.47]]) {
      const ya = y0 + r0, yb = y1 + r1, l = Math.hypot(z1 - z0, yb - ya);
      b.add(box(0.28, 0.05, l), 'wLeather', { p: [2.4, (ya + yb) / 2, (z0 + z1) / 2], r: [-Math.atan2(yb - ya, z1 - z0), 0, 0], c: '#5a3a22' });
    }
    void L; void ang;
  }, 3224));
  const chute = chips(1.2, 0.26); chute.position.set(-0.4, DY + 0.6, HZ1 + 0.3); body.add(chute);
  const burst = chips(0, 0.42); burst.position.set(0, DY + 1.2, (HZ0 + HZ1) / 2); body.add(burst);
  const puff = steam(2.0, 0.9, 1.5, 0.4); puff.position.set(-1.1, DY + 4.3, -3.4); body.add(puff);
  const glow = slotGlow(0xffb060, 0.14, 0.9, 0.3, { ry: -PI / 2 }); glow.position.set(-1.88, DY + 1.1, -2.8); body.add(glow);
  const a = new Anim(root, { base, body, wheels: TR.wheels, bed, big, small });
  a.dynamics.push(chute, burst, puff, glow);
  let bz = 0, w = 4, slamN = 0, mode = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      // the belt slips: the pulleys run down, the bed stops where it was, the hull settles on its treads
      this.deadT += dt;
      const k = ease(this.deadT / 1.8);
      w *= Math.max(0, 1 - dt * 1.2); p.small.rotation.x += w * dt; p.big.rotation.x += w * 0.47 * dt;
      p.body.rotation.z = -0.04 * k; p.body.rotation.x = 0.03 * k; p.body.position.y = -0.18 * k;
      chute.userData.rate = 0; burst.userData.rate = 0; puff.userData.rate = 0; glow.material.opacity = 0.3 * (1 - k);
      for (const d of this.dynamics) d.userData.update?.(dt, this.t);
      return;
    }
    puff.userData.rate = 2.0;
    const ts = drive(this, TR.wheels, TR.runs, dt, speed, 0.7);
    const at = this.stepAttack(dt);
    if (at >= 0 && at < dt / this.atkDur + 1e-3 && this.atkKind === 'slam') mode = slamN++ % 2;
    // idle: the bed works slowly to and fro under the cutter; slam A runs the bed right out (the length of the loft), slam B
    // races the cutter block and throws shavings all round; the melee swing jabs the bed forward
    let bzT = Math.sin(this.t * 0.7) * 0.35, wT = 6;
    if (at >= 0 && this.atkKind === 'slam' && mode === 0) bzT = at < 0.6 ? -0.6 * (at / 0.6) : at < 0.72 ? -0.6 + 2.8 * ((at - 0.6) / 0.12) : 2.2 * (1 - (at - 0.72) / 0.28);
    if (at >= 0 && this.atkKind === 'slam' && mode === 1) wT = 6 + 26 * Math.sin(at * PI);
    if (at >= 0 && this.atkKind !== 'slam') bzT = 0.9 * Math.sin(at * PI);
    bz += (bzT - bz) * Math.min(1, dt * (at >= 0.6 && at < 0.72 ? 20 : 5)) * ts;
    p.bed.position.z = bz;
    w += (wT - w) * Math.min(1, dt * 3);
    p.small.rotation.x += w * dt * ts; p.big.rotation.x += w * 0.47 * dt * ts;
    chute.userData.rate = 1.2 + Math.max(0, w - 6) * 0.3;
    burst.userData.rate = mode === 1 && at >= 0.35 && at < 0.8 ? 34 : 0;
    p.body.position.y = Math.abs(Math.sin(this.t * 2.4)) * 0.025 * Math.min(1, this.speed);
    glow.material.opacity = 0.28 + 0.06 * Math.sin(this.t * 2.9);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z = Math.sin(this.t * 25) * this.hitT * 0.014; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  return finish(root, a, 6.6);
}

// ==========================================================================
// THE GREAT LATHE (about 9 m tall with its shafting, 10.8 m wide, 5 m deep)
// ==========================================================================
export function buildGreatLathe() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  // the treads run along z (the way it drives) under a deck wide enough to hide them from above
  const TR = heroTreads(base, { gauge: 7.2, len: 4.6, h: 1.4, tw: 1.0, paint: 'wPaint', paintC: SHOP2, linkC: '#555a60', road: 1, seed: 3310 });
  const body = pivot(base, 0, 0, 0);
  const sC = grime(SHOP, 1.2, 7.0, 0.28, 21), s2C = wear(SHOP2, 0.3, 22), iC = wear(IRON, 0.25, 23), bC = wear(BRASS, 0.3, 24), tC = wear(TIMB, 0.35, 25);
  const P = (w, h, d, seed, o = {}) => pl(w, h, d, { mat: 'wPaint', c: sC, c2: s2C, trim: 'wIron', trimC: iC, boltMat: 'wBrass', boltC: bC, seed, ...o });
  const DY = 2.6, RY = 4.02, CY = 5.2, HX = -3.5, TX = 3.5; // deck top, rail top, centre height, headstock and tailstock x
  body.add(part((b) => {
    // the wide deck over the treads
    b.add(rb(9.6, 1.1, 4.4, 0.1), 'wPaint', { p: [0, 2.0, 0], c: sC });
    for (const sz of [-1, 1]) for (let i = 0; i < 3; i++) b.addBuilder(P(2.8, 0.8, 0.1, 3311 + i), { p: [-3.1 + i * 3.1, 2.0, sz * 2.22], r: [0, sz > 0 ? 0 : PI, 0] });
    b.add(rb(10.8, 0.16, 5.0, 0.04), 'wIron', { p: [0, DY - 0.08, 0], c: iC });
    for (const sz of [-1, 1]) b.add(box(10.8, 0.08, 0.08), 'wBrass', { p: [0, DY, sz * 2.5], c: bC });
    bolts(b, 'wBrass', [-4.6, 2.3, 2.28], [4.6, 2.3, 2.28], 14, 0.045, 'z', bC);
    // the bed: two pedestal cabinets and two flat iron rails along x between them (a gap between the rails)
    b.add(rb(2.4, RY - DY - 0.36, 2.2, 0.06), 'wPaint', { p: [HX, (DY + RY - 0.36) / 2, 0], c: s2C });
    b.add(rb(1.9, RY - DY - 0.36, 1.9, 0.06), 'wPaint', { p: [TX, (DY + RY - 0.36) / 2, 0], c: s2C });
    for (const x of [HX, TX]) label(b, [x - 0.4, DY + 0.55, x === HX ? 1.12 : 0.97], 0, 1.1);
    for (const sz of [-1, 1]) {
      b.add(rb(8.8, 0.36, 0.44, 0.03), 'wIron', { p: [0, RY - 0.18, sz * 0.46], c: grime(IRON, RY - 0.36, RY, 0.2, 26 + sz) });
      b.add(box(8.6, 0.03, 0.3), 'wIron', { p: [0, RY + 0.005, sz * 0.46], c: '#8a8e94' }); // the ways, bright from the carriage
    }
    for (const x of [-1.3, 1.8]) b.add(rb(0.6, RY - DY - 0.36, 1.2, 0.04), 'wIron', { p: [x, (DY + RY - 0.36) / 2, 0], c: iC }); // the bed's feet
    swarf(b, 0.6, RY, 0, 3.4, 0.5, 14);
    swarf(b, 0.4, DY, 1.6, 4.0, 1.2, 12);
    // the headstock: a square housing on the bed, banded, a flat lid with the belt's slot in it, one gauge on its back
    b.add(rb(2.2, 2.8, 2.4, 0.1), 'wPaint', { p: [HX, RY + 1.4, 0], c: sC });
    for (const y of [RY + 0.35, RY + 2.45]) b.add(rb(2.28, 0.1, 2.48, 0.02), 'wIron', { p: [HX, y, 0], c: iC });
    b.addBuilder(P(1.8, 1.6, 0.08, 3315, { inset: false }), { p: [HX, RY + 1.4, 1.22] });
    b.add(rb(2.4, 0.16, 2.6, 0.03), 'wIron', { p: [HX, RY + 2.88, 0], c: iC });
    b.add(box(0.7, 0.04, 1.2), 'wDark', { p: [HX, RY + 2.97, -0.6], c: '#141618' });
    gauge(b, [HX + 0.6, RY + 1.3, -1.24], 1.1, PI);
    // the tailstock: a square block on the rails, its quill toward the work, a square crank arm on its right end (off-centre)
    b.add(rb(1.6, 2.5, 1.6, 0.08), 'wPaint', { p: [TX, RY + 1.25, 0], c: sC }); // tall enough to hide the faceplate from the right
    b.add(rb(1.7, 0.1, 1.7, 0.02), 'wIron', { p: [TX, RY + 2.2, 0], c: iC });
    b.add(cyl(0.2, 0.2, 0.5, 12), 'wIron', { p: [TX - 1.0, CY, 0], r: [0, 0, PI / 2], c: '#8a8e94' });
    b.add(rb(0.14, 0.9, 0.22, 0.02), 'wIron', { p: [TX + 0.86, CY - 0.25, 0.45], c: iC });
    b.add(rb(0.4, 0.14, 0.14, 0.02), 'wBrass', { p: [TX + 1.0, CY - 0.68, 0.45], c: bC });
    // the overhead line shafting behind the headstock: two square posts, bearing blocks on their tops, the shaft along x
    for (const x of [-5.0, -0.7]) {
      b.add(rb(0.5, 9.4 - DY, 0.5, 0.05), 'wWood', { p: [x, (9.4 + DY) / 2, -1.7], c: tC });
      for (const y of [DY + 0.5, 6.0, 8.4]) b.add(rb(0.58, 0.1, 0.58, 0.02), 'wIron', { p: [x, y, -1.7], c: iC });
      b.add(rb(0.4, 0.4, 1.35, 0.04), 'wWood', { p: [x, 9.6, -1.275], c: tC }); // a hanger arm forward off the post's top, ending over the shaft
      b.add(rb(0.6, 0.5, 0.6, 0.04), 'wIron', { p: [x, 9.2, -0.6], c: iC }); // the shaft's bearing, hung under the arm's end
    }
    b.add(cyl(0.12, 0.12, 4.3, 10), 'wIron', { p: [-2.85, 9.2, -0.6], r: [0, 0, PI / 2], c: '#7a7e84' }); // ends in the bearings (from above: corners, never a +)
    // the wide drum pulley on the shaft over the headstock and the flat belt hanging straight down from it into the lid's slot
    b.add(cyl(0.5, 0.5, 0.7, 20), 'wIron', { p: [HX, 9.2, -0.6], r: [0, 0, PI / 2], c: '#4a4c50' });
    for (const z of [-1.08, -0.12]) b.add(box(0.5, 9.2 - RY - 2.97, 0.05), 'wLeather', { p: [HX, (9.2 + RY + 2.97) / 2, z], c: '#5a3a22' });
    frost(b, -2.85, 9.42, -0.6, 4.0, 0.3, 4, 0.06);
  }, 3320));
  // the work, turning: the faceplate (a plain solid disc, edge-on from the front and within the headstock's depth from above),
  // one off-centre bolt plate on it, the hub clamped to it and the hub's axle on to the tailstock
  const spin = pivot(body, 0, CY, 0);
  spin.add(part((b) => {
    b.add(bdisc(1.1, 0.3, 0.06, 30), 'wIron', { p: [HX + 1.25, 0, 0], r: [0, 0, PI / 2], c: '#55585e' });
    b.add(rb(0.12, 0.34, 0.34, 0.03), 'wBrass', { p: [HX + 1.43, 0.66, 0], c: BRASS });
    b.add(cyl(0.22, 0.22, TX - HX - 2.4, 14), 'wIron', { p: [(HX + TX) / 2 + 0.4, 0, 0], r: [0, 0, PI / 2], c: '#8a8e94' });
    b.add(rb(0.3, 0.06, 0.12, 0.01), 'wBrass', { p: [1.2, 0.23, 0], c: BRASS }); // a turned shoulder mark, so the turn shows
  }, 3321));
  const hub = pivot(spin, HX + 1.85, 0, 0);
  hub.add(part((b) => {
    b.add(cyl(0.72, 0.72, 0.9, 24), 'wBronze', { r: [0, 0, PI / 2], c: wear('#6a5640', 0.3, 27) });
    for (let i = 0; i < 3; i++) { const t = (i / 3) * PI * 2 + 0.3; b.add(rb(0.8, 0.34, 0.5, 0.04), 'wBronze', { p: [0, Math.cos(t) * 0.86, Math.sin(t) * 0.86], r: [t, 0, 0], c: wear('#5a4a36', 0.3, 28 + i) }); }
    b.add(rb(0.08, 0.3, 0.3, 0.02), 'wBrass', { p: [0.48, 0.32, 0.12], c: BRASS }); // one bolt plate, off-centre
  }, 3322));
  // the tool carriage on the rails between: a saddle, a cross-slide, one square tool post on the front side with its tool
  const carriage = pivot(body, 1.0, RY, 0);
  carriage.add(part((b) => {
    b.add(rb(1.3, 0.4, 1.3, 0.05), 'wPaint', { p: [0, 0.2, 0], c: s2C });
    b.add(rb(0.9, 0.3, 1.0, 0.04), 'wIron', { p: [0, 0.55, 0.15], c: iC });
    b.add(rb(0.4, 0.5, 0.4, 0.04), 'wIron', { p: [0, 0.95, 0.5], c: '#34373b' });
    b.add(box(0.1, 0.1, 0.36), 'wIron', { p: [0, CY - RY, 0.36], c: '#c0c4c8' });
    b.add(rb(0.16, 0.5, 0.16, 0.02), 'wIron', { p: [0.4, 0.8, 0.62], c: iC }); // the feed handle, upright
  }, 3323));
  const spark = sparks(0); spark.position.set(1.0, CY, 0.3); body.add(spark);
  const flash = glowSprite(0xffb060, 1.2, 0); flash.position.set(1.0, CY + 0.05, 0.35); body.add(flash);
  const glow = slotGlow(0xffb060, 0.14, 1.1, 0.3, { ry: PI }); glow.position.set(HX + 0.6, RY + 1.3, -1.29); body.add(glow);
  const a = new Anim(root, { base, body, wheels: TR.wheels, spin, hub, carriage });
  a.dynamics.push(spark, flash, glow);
  let w = 1.6, slamN = 0, mode = 0, slide = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      // the belt comes off: the work runs down and stops, the hub sits loose on its clamps
      this.deadT += dt;
      const k = ease(this.deadT / 2.0);
      w *= Math.max(0, 1 - dt * 0.9); p.spin.rotation.x += w * dt;
      p.hub.position.x = HX + 1.85 + 0.35 * k; p.hub.rotation.z = 0.08 * k;
      p.body.rotation.z = 0.03 * k; p.body.position.y = -0.15 * k;
      spark.userData.rate = 0; flash.material.opacity = 0; glow.material.opacity = 0.3 * (1 - k);
      for (const d of this.dynamics) d.userData.update?.(dt, this.t);
      return;
    }
    const ts = drive(this, TR.wheels, TR.runs, dt, speed, 0.7);
    const at = this.stepAttack(dt);
    if (at >= 0 && at < dt / this.atkDur + 1e-3 && this.atkKind === 'slam') mode = slamN++ % 2;
    // idle: the work turns, the carriage feeds slowly along; slam A spins it up and throws hot swarf; slam B works the hub
    // loose so it wobbles and slides out along its axle, then it seats again; the melee swing bites the tool in (sparks)
    let wT = 1.6, sT = 0, cut = 0;
    if (at >= 0 && this.atkKind === 'slam' && mode === 0) { wT = 1.6 + 9 * Math.sin(at * PI); cut = Math.sin(at * PI); }
    if (at >= 0 && this.atkKind === 'slam' && mode === 1) { wT = 4; sT = at < 0.5 ? 0.15 * Math.sin(at * 40) : at < 0.7 ? 1.1 * (at - 0.5) / 0.2 : 1.1 * (1 - (at - 0.7) / 0.3); }
    if (at >= 0 && this.atkKind !== 'slam') cut = Math.sin(at * PI);
    w += (wT - w) * Math.min(1, dt * 3);
    p.spin.rotation.x += w * dt * ts;
    slide += (Math.max(0, sT) - slide) * Math.min(1, dt * 10);
    p.hub.position.x = HX + 1.85 + slide;
    p.hub.rotation.z = mode === 1 && at >= 0 ? Math.sin(this.t * 31) * 0.05 * Math.sin(at * PI) : 0;
    p.carriage.position.x = 1.0 + Math.sin(this.t * 0.25) * 0.5;
    spark.position.x = flash.position.x = p.carriage.position.x;
    spark.userData.rate = cut > 0.2 ? 40 * cut : 0;
    flash.material.opacity = cut > 0.2 ? 0.7 * cut : 0;
    p.body.position.y = Math.abs(Math.sin(this.t * 2.4)) * 0.025 * Math.min(1, this.speed);
    glow.material.opacity = 0.28 + 0.06 * Math.sin(this.t * 3.1);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z = Math.sin(this.t * 25) * this.hitT * 0.01; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  return finish(root, a, 9.4);
}

// ==========================================================================
// THE GREAT GOVERNOR (about 16 m tall with its vane, 19 m wide; faces +z, its back against the north wall)
// ==========================================================================
export function buildGreatGovernor() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const body = pivot(base, 0, 0, 0);
  const stC = grime('#a8a294', 0, 1.2, 0.25, 41), st2C = wear('#8e887c', 0.3, 42), tC = grime(TIMB, 1.2, 12, 0.3, 43), t2C = wear(TIMB2, 0.3, 44), iC = wear(IRON, 0.25, 45), bC = wear(BRASS, 0.3, 46), sC = grime(SHOP, 1.2, 11, 0.25, 47);
  const PY = 1.2, TWX = 8.0, TZ = -0.8, TH = 12.0, DRY = 10.0, DRZ = -0.2, DRR = 1.0, RZ = 1.15; // plinth top, towers, drum, rod line
  // the twelve rods: three groups of four (the three ridges), centred under the drum
  const RODX = [];
  for (const g of [-4.2, 0, 4.2]) for (const k of [-1.35, -0.45, 0.45, 1.35]) RODX.push(g + k);
  body.add(part((b) => {
    // the stepped stone plinth
    b.add(rb(19.6, 0.6, 9.0, 0.06), 'stoneCold', { p: [0, 0.3, -0.6], c: st2C, uv: 'box', us: 0.4 });
    b.add(rb(18.6, 0.6, 8.0, 0.06), 'stoneCold', { p: [0, 0.9, -0.8], c: stC, uv: 'box', us: 0.4 });
    b.add(box(18.62, 0.08, 0.08), 'wBrass', { p: [0, PY - 0.04, 3.2], c: bC });
    // the twelve square floor slots, each with a square iron kerb (four bars, never a round rim)
    for (const x of RODX) {
      b.add(box(0.5, 0.03, 0.5), 'wDark', { p: [x, PY + 0.01, RZ], c: '#0a0b0c' });
      for (const [dx, dz, w, d] of [[0, -0.31, 0.72, 0.12], [0, 0.31, 0.72, 0.12], [-0.31, 0, 0.12, 0.5], [0.31, 0, 0.12, 0.5]]) b.add(box(w, 0.06, d), 'wIron', { p: [x + dx, PY + 0.03, RZ + dz], c: iC });
    }
    // a brass label on the plinth's face under each group of rods
    for (const g of [-4.2, 0, 4.2]) label(b, [g, 0.95, 3.22], 0, 1.4);
    // the back panel between the towers: plain grey-green shop paint, iron banded only above the rod heads
    b.add(rb(13.4, 10.6, 0.5, 0.06), 'wPaint', { p: [0, PY + 5.3, -2.3], c: sC });
    for (const y of [10.9, 11.7]) b.add(rb(13.5, 0.14, 0.6, 0.02), 'wIron', { p: [0, y, -2.3], c: iC });
    // the two square end towers of oiled timber, stepped at the foot, banded in black iron, flat caps
    for (const sx of [-1, 1]) {
      const x = sx * TWX;
      b.add(rb(3.4, 1.0, 4.2, 0.06), 'stoneCold', { p: [x, PY + 0.5, TZ], c: st2C, uv: 'box', us: 0.4 });
      b.add(rb(2.6, TH - PY - 1.0, 3.4, 0.08), 'wWood', { p: [x, (TH + PY + 1.0) / 2, TZ], c: tC, uv: 'box', us: 0.6 });
      for (const z of [TZ - 1.7, TZ + 1.7]) for (const xx of [x - 1.3, x + 1.3]) b.add(box(0.18, TH - PY - 1.0, 0.18), 'wIron', { p: [xx, (TH + PY + 1.0) / 2, z], c: iC }); // iron corner angles
      for (const y of [3.6, 7.0, 10.4]) b.add(rb(2.72, 0.2, 3.52, 0.02), 'wIron', { p: [x, y, TZ], c: iC });
      bolts(b, 'wBrass', [x - 1.0, 7.0, TZ + 1.78], [x + 1.0, 7.0, TZ + 1.78], 5, 0.05, 'z', bC);
      // the drum's bearing block on the tower's inner face
      b.add(rb(0.9, 1.4, 1.6, 0.05), 'wIron', { p: [x - sx * 1.6, DRY, DRZ], c: iC });
    }
    // the flat lintel across the towers, its iron cap, a little frost on top
    b.add(rb(19.0, 1.4, 3.8, 0.08), 'wWood', { p: [0, TH + 0.7, TZ], c: t2C, uv: 'box', us: 0.6 });
    b.add(rb(19.4, 0.3, 4.2, 0.04), 'wIron', { p: [0, TH + 1.55, TZ], c: iC });
    b.add(box(19.02, 0.16, 0.06), 'wIron', { p: [0, TH + 0.2, TZ + 1.91], c: iC });
    bolts(b, 'wBrass', [-8.6, TH + 1.0, TZ + 1.92], [8.6, TH + 1.0, TZ + 1.92], 18, 0.06, 'z', bC);
    // the gauge board on the left tower's face: marks down one side only, one lit line on it
    { const gx = -TWX, gz = TZ + 1.72;
      b.add(rb(1.0, 5.2, 0.14, 0.02), 'wWood', { p: [gx, 6.6, gz], c: wear(WASH, 0.15, 48) });
      for (let i = 0; i < 12; i++) b.add(box(i % 4 ? 0.22 : 0.42, 0.06, 0.05), 'wIron', { p: [gx - 0.36 + (i % 4 ? 0 : 0.1), 4.4 + i * 0.4, gz + 0.09], c: '#2a2e32' });
      b.add(box(0.7, 0.07, 0.04), 'wGlowAmber', { p: [gx + 0.05, 8.0, gz + 0.1] });
      label(b, [gx, 3.7, gz + 0.09], 0, 1.4); }
    // the pendulum's pivot block on the right tower's face
    b.add(rb(1.0, 0.8, 0.7, 0.05), 'wIron', { p: [TWX, 11.2, TZ + 2.0], c: iC });
    // the steam cylinder at the left foot: a square-jacketed cylinder on the plinth with its valve chest on top
    b.add(rb(2.4, 1.7, 1.9, 0.1), 'wPaint', { p: [-TWX, PY + 0.85, 2.0], c: wear('#4e5a52', 0.3, 49) });
    for (const x of [-TWX - 1.15, -TWX + 1.15]) b.add(rb(0.16, 1.8, 2.0, 0.03), 'wIron', { p: [x, PY + 0.85, 2.0], c: iC });
    b.add(rb(1.2, 0.5, 1.0, 0.05), 'wBronze', { p: [-TWX + 0.3, PY + 1.95, 2.0], c: wear('#5a4a3a', 0.3, 50) });
    b.add(cyl(0.12, 0.12, 2.0, 10), 'wIron', { p: [-TWX - 0.6, PY + 2.6, 1.4], c: '#55585e' }); // the steam pipe up the tower
    // the vane's post on the right tower's roof
    b.add(rb(0.7, 0.4, 0.7, 0.04), 'wIron', { p: [TWX, TH + 1.9, TZ], c: iC });
    b.add(box(0.2, 2.4, 0.2), 'wIron', { p: [TWX, TH + 3.1, TZ], c: '#4a4e54' });
  }, 3420));
  // the timing drum: a long solid drum turning under the lintel, twelve flat square cams round it in a staggered row (each
  // lifts its rod in turn), one brass bolt plate on each end
  const ORDER = [0, 4, 8, 1, 5, 9, 2, 6, 10, 3, 7, 11]; // the order the rods are struck in: one in each group in turn
  const PH = RODX.map((_, i) => -(ORDER.indexOf(i) / 12) * PI * 2);
  const drum = pivot(body, 0, DRY, DRZ);
  drum.add(part((b) => {
    b.add(cyl(DRR, DRR, 2 * TWX - 3.2, 28), 'wIron', { r: [0, 0, PI / 2], c: wear('#4e5156', 0.25, 51) });
    for (let i = 0; i < 12; i++) {
      const t = PH[i];
      b.add(rb(0.6, 0.32, 0.7, 0.04), 'wBronze', { p: [RODX[i], Math.sin(t) * (DRR + 0.12), Math.cos(t) * (DRR + 0.12)], r: [PI / 2 - t, 0, 0], c: wear('#6a5640', 0.3, 52) });
    }
    for (const sx of [-1, 1]) b.add(rb(0.12, 0.4, 0.3, 0.02), 'wBrass', { p: [sx * (TWX - 1.65), 0.6, 0.3], c: BRASS });
  }, 3421));
  // the rods: square bars rising out of their slots, a square tappet head reaching back under the drum
  const rods = RODX.map((x, i) => {
    const r = pivot(body, x, 0, RZ);
    r.add(part((b) => {
      b.add(rb(0.34, 8.6, 0.34, 0.03), 'wIron', { p: [0, PY + 4.3 - 0.6, 0], c: grime('#55585e', PY, 8.6, 0.25, 60 + i) });
      b.add(rb(0.5, 0.36, 0.9, 0.04), 'wIron', { p: [0, PY + 8.15, -0.28], c: '#34373b' });
      b.add(box(0.36, 0.12, 0.36), 'wBrass', { p: [0, PY + 1.1, 0], c: BRASS }); // a brass collar low on the rod
    }, 3430 + i));
    return r;
  });
  // the pendulum on the right tower's face: a long square rod and a heavy square bob, swinging the count
  const pend = pivot(body, TWX, 11.0, TZ + 2.45);
  pend.add(part((b) => {
    b.add(rb(0.24, 6.0, 0.24, 0.03), 'wIron', { p: [0, -3.0, 0], c: '#55585e' });
    b.add(rb(1.1, 1.6, 0.6, 0.08), 'wBrass', { p: [0, -6.4, 0], c: wear(BRASS, 0.25, 61) });
    b.add(rb(1.16, 0.12, 0.66, 0.02), 'wIron', { p: [0, -5.75, 0], c: iC });
    b.add(rb(0.4, 0.4, 0.4, 0.04), 'wIron', { p: [0, 0, 0], c: iC });
  }, 3440));
  // the wind vane: ONE flat board on the post, a small square counterweight on the other side, turning with the wind
  const vane = pivot(body, TWX, TH + 4.3, TZ);
  vane.add(part((b) => {
    b.add(box(0.1, 0.1, 3.4), 'wIron', { p: [0, 0, 0.7], c: '#4a4e54' });
    b.add(rb(0.07, 0.8, 1.1, 0.02), 'wWood', { p: [0, 0.05, 2.0], c: wear(WASH, 0.2, 62) }); // the one board, out at the arm's end
    b.add(rb(0.34, 0.34, 0.34, 0.03), 'wIron', { p: [0, 0, -0.85], c: iC });
  }, 3441));
  const puff = steam(2.4, 1.0, 1.6, 0.42); puff.position.set(-TWX - 0.6, PY + 3.7, 1.4); body.add(puff);
  const blast = steam(0, 1.6, 1.4, 0.5); blast.position.set(-TWX + 0.3, PY + 2.2, 2.6); body.add(blast);
  const vents = [[-4.2, 1.8], [0, 2.2], [4.2, 1.6]].map(([x, y]) => { const s = steam(0, 1.2, 1.0, 0.4); s.position.set(x, PY + y, RZ + 0.8); body.add(s); return s; });
  const glow = slotGlow(0xffb060, 0.8, 0.12, 0.35); glow.position.set(-TWX + 0.05, 8.0, TZ + 1.82); body.add(glow);
  const a = new Anim(root, { base, body, drum, rods, pend, vane });
  a.dynamics.push(puff, blast, ...vents, glow);
  let ang = 0, w = 0.35, swing = 0.14, jerk = 0, vy = 0;
  const lifts = RODX.map(() => 0);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    void speed;
    if (this.dead) {
      // the count runs out: the drum stops, every rod drops home into its slot, the pendulum hangs still, the steam dies away
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 3.0);
      w *= Math.max(0, 1 - dt * 1.0); ang += w * dt; p.drum.rotation.x = ang;
      for (let i = 0; i < 12; i++) { lifts[i] += (0 - lifts[i]) * Math.min(1, dt * 5); p.rods[i].position.y = lifts[i]; }
      swing *= Math.max(0, 1 - dt * 0.6); p.pend.rotation.z = swing * Math.sin(this.t * 2.2);
      puff.userData.rate = 2.4 * (1 - k); blast.userData.rate = 0; for (const s of vents) s.userData.rate = 0;
      glow.material.opacity = 0.35 * (1 - k);
      for (const d of this.dynamics) d.userData.update?.(dt, this.t);
      return;
    }
    const at = this.stepAttack(dt);
    const slam = at >= 0 && this.atkKind === 'slam', heave = at >= 0 ? Math.sin(at * PI) : 0;
    // idle: the drum turns slowly and each cam lifts its rod in turn; a slam races the drum, every rod jerks in its group in
    // turn and the cylinder blows off steam; the melee swing jerks the nearest group
    w += ((slam ? 0.35 + 2.6 * heave : 0.35) - w) * Math.min(1, dt * 3);
    ang += w * dt * (this.stun ? 0.15 : 1);
    p.drum.rotation.x = ang;
    jerk = slam ? heave : at >= 0 ? heave * 0.4 : 0;
    for (let i = 0; i < 12; i++) {
      const cam = Math.pow(Math.max(0, Math.cos(PH[i] - ang + 0.3)), 8) * 0.75;
      const g = Math.floor(i / 4), j = slam ? Math.max(0, Math.sin((at * 3 - g * 0.5) * PI)) * 0.9 : at >= 0 && g === 1 ? jerk * 0.6 : 0;
      const tgt = Math.max(cam, j);
      lifts[i] += (tgt - lifts[i]) * Math.min(1, dt * (tgt > lifts[i] ? 14 : 9));
      p.rods[i].position.y = lifts[i];
    }
    swing += ((slam ? 0.26 : 0.14) - swing) * Math.min(1, dt * 0.8);
    p.pend.rotation.z = swing * Math.sin(this.t * 2.2);
    vy += Math.sin(this.t * 0.13) * dt * 0.4 - vy * dt * 0.3;
    p.vane.rotation.y = 0.9 + Math.sin(this.t * 0.11) * 0.8 + vy;
    puff.userData.rate = 2.4;
    blast.userData.rate = slam && at >= 0.3 && at < 0.75 ? 30 : 0;
    for (const [i, s] of vents.entries()) s.userData.rate = slam && Math.sin((at * 3 - i * 0.5) * PI) > 0.6 ? 18 : 0;
    glow.material.opacity = 0.32 + 0.06 * Math.sin(this.t * 2.3);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.position.x = Math.sin(this.t * 22) * this.hitT * 0.03; } else p.body.position.x = 0;
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  return finish(root, a, 16.0);
}
