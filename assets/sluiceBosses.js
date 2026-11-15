// The Sluice Galleries (Part Eleven, level 50 dungeon inside the old dam on the Rime Steps): three machine bosses of grey
// stone-coloured plate and blackened bronze, rimed with frost, water running and leaking out of them.
//  - The Gate Winder: the winding engine that worked the sluice gates. A plated hull on treads carrying a square gate frame
//    (two square posts and a flat head beam with the winding drum), a riveted sluice gate hanging in the frame on chains
//    (it lifts the gate and lets it drop), a large solid gate wheel on its left flank with paddle lugs round the rim, a
//    solid flywheel on its right, and a square water tank behind with one sight gauge.
//  - The Turbine Heart: the water turbine that drove the works. A square turbine casing on short treads, the penstock pipe
//    coming down into it from behind, a square governor housing on top, two solid runner discs spinning in open frames on
//    its flanks, and one square tailrace mouth low at the front with water pouring out of it.
//  - The Floodgate (the last boss): the last gate of the dam, walking. Two square gate towers on wide treads, a flat head
//    beam across them, and between them a huge gate of horizontal planks and ribs (never a cross), cracked, with water
//    jetting through its seams. A solid gate wheel on the outer face of each tower, square rams holding the gate.
// Same interface as the other machines: userData.machine = { update(dt, speed), attack(dur, kind), hit(), die(), revive(), stun }.
// Content rules: no faces (one gauge or one outlet, never a pair of lamps over a grille), nothing animal-like, no spokes
// (wheels are solid discs with paddles on the rim and an off-centre bolt plate), no domes, rings, stars or radiating
// patterns, no crosses; everything square from above.
import * as THREE from 'three';
import { box, rbox, cyl, cone, ico } from './kit.js';
import { plate, sleeve, heroTreads, crawl, wear, grime, bolts, bdisc, flywheel } from './bossParts.js';
import { smoke, glowSprite } from './dynamic.js';
import { slotGlow } from './slotGlow.js';
import { Anim, finish, part, pivot } from './quarryMachines.js';
import { wearModel, MOTION } from './tripoModels.js';

const PI = Math.PI;
const rb = (w, h, d, r) => rbox(w, h, d, r, 1);
const pl = (w, h, d, o = {}) => plate(w, h, d, { br: Math.max(0.035, Math.min(0.07, Math.min(w, h) * 0.05)), ...o });
// grey stone-coloured plate, blackened bronze, its bronze trim, dark iron, frost and ice
const STONE = '#8c9296', STONE2 = '#70777c', BRZ = '#4a4038', BRZ2 = '#3a322c', TRIM = '#9a7a48', IRON = '#4c5056', FROST = '#eef5fa', ICE = '#cfe6f4', WATER = '#8cc4e2', WOOD = '#7a6048';

// frost crust: flattened pale lumps over a top face
function frost(b, cx, y, cz, w, d, n, s = 0.1) {
  for (let i = 0; i < n; i++) b.add(ico(s * b.r(0.6, 1.1), 0), 'wPaint', { p: [cx + b.r(-w / 2, w / 2), y, cz + b.r(-d / 2, d / 2)], s: [1.6, 0.36, 1.3], r: [0, b.r(0, 3), 0], c: wear(FROST, 0.12, i) });
}
// icicles hanging off a lower edge from a to z
function icicles(b, a, z, n, len, r = null) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1), l = len * b.r(0.4, 1.1), rr = r ?? len * 0.2;
    b.add(cone(rr, l, 5), 'wPaint', { p: [a[0] + (z[0] - a[0]) * t, a[1] + (z[1] - a[1]) * t - l / 2, a[2] + (z[2] - a[2]) * t], r: [PI, b.r(0, 3), 0], c: ICE });
  }
}
// one sight-gauge strip: a lit glass in a dark frame (always single, never a pair)
function gauge(b, p, h, ry = 0) {
  b.add(rb(0.14, h + 0.1, 0.07, 0.02), 'wDark', { p, r: [0, ry, 0], c: '#2e3236' });
  b.add(box(0.06, h, 0.03), 'wWet', { p: [p[0] + Math.sin(ry) * 0.03, p[1], p[2] + Math.cos(ry) * 0.03], r: [0, ry, 0] });
}
// a solid gate wheel on the x axis: a bevelled disc, a raised inner disc and hub, an off-centre bolt plate, and square
// paddle lugs round the rim (the hands' grips). Never spoked.
function gateWheel(b, r, w, o = {}) {
  const { c = wear(BRZ, 0.3, 7), n = 12, lugC = TRIM } = o;
  b.add(bdisc(r, w, Math.min(r * 0.08, w * 0.3), 30), 'wBronze', { r: [0, 0, PI / 2], c });
  // a square axle nut on the plain face (an inner disc and a round hub read as a disc in a ring, an eye, from the side)
  b.add(rb(w * 1.5, r * 0.3, r * 0.3, Math.min(r * 0.03, w * 0.08)), 'wBrass', { c: TRIM });
  for (const sx of [-1, 1]) {
    b.add(rb(w * 0.2, r * 0.32, r * 0.22, Math.min(r * 0.03, w * 0.06)), 'wBrass', { p: [sx * w * 0.7, r * 0.4, 0], c: TRIM });
    b.add(rb(w * 0.16, r * 0.2, r * 0.4, Math.min(r * 0.03, w * 0.05)), 'wIron', { p: [sx * w * 0.64, -r * 0.42, 0], c: '#3e4246' });
  }
  const bd = r * 0.16, bt = Math.min(r * 0.26, (2 * PI * r / n) * 0.4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2, R = r + bd * 0.3;
    b.add(rb(w * 1.1, bd, bt, Math.min(0.03, bt * 0.2)), 'wBrass', { p: [0, Math.cos(a) * R, Math.sin(a) * R], r: [a, 0, 0], c: lugC });
  }
}
// a spray of water: a pale puffing emitter
const spray = (rate = 3, size = 0.7, rise = 1.2, opacity = 0.42) => smoke({ rate, life: 1.6, size, rise, color: 0xdcecf6, opacity, spread: 0.3 });

// ==========================================================================
// THE GATE WINDER (about 6.6 m tall, 6.6 m long)
// ==========================================================================
export function buildGateWinder() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 3.9, len: 6.4, h: 1.4, tw: 0.9, paint: 'wBronze', paintC: BRZ, linkC: '#555a60', road: 2, seed: 1410 });
  const body = pivot(base, 0, 0, 0);
  const hC = grime(STONE, 1.2, 3.2, 0.3, 1), h2C = wear(STONE2, 0.3, 2), bC = wear(BRZ, 0.3, 3), iC = wear(IRON, 0.25, 4), tC = wear(TRIM, 0.3, 5);
  const P = (w, h, d, seed, o = {}) => pl(w, h, d, { mat: 'wPaint', c: hC, c2: h2C, trim: 'wBronze', trimC: bC, boltMat: 'wBrass', boltC: tC, seed, ...o });
  body.add(part((b) => {
    // the hull: a plated block over the treads, a blackened bronze deck with a trim lip
    b.add(rb(3.3, 1.6, 6.0, 0.12), 'wPaint', { p: [0, 2.0, -0.2], c: hC });
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) b.addBuilder(P(1.85, 1.0, 0.12, 1411 + i), { p: [sx * 1.7, 2.05, -2.1 + i * 1.95], r: [0, sx * PI / 2, 0] });
    b.add(rb(3.6, 0.16, 6.3, 0.04), 'wBronze', { p: [0, 2.88, -0.2], c: bC });
    for (const sx of [-1, 1]) b.add(box(0.1, 0.1, 6.3), 'wBrass', { p: [sx * 1.8, 2.98, -0.2], c: tC });
    b.addBuilder(P(3.0, 1.2, 0.14, 1415, { inset: false }), { p: [0, 2.0, 2.85] });
    b.add(rb(3.2, 0.22, 0.4, 0.05), 'wIron', { p: [0, 1.25, 3.0], c: iC });
    // the gate frame at the front: two square posts banded in bronze, a flat head beam carrying the winding drum
    for (const sx of [-1, 1]) {
      b.add(rb(0.5, 4.0, 0.5, 0.05), 'wPaint', { p: [sx * 1.55, 4.9, 2.2], c: wear(STONE2, 0.3, 10 + sx) });
      for (const y of [3.4, 4.8, 6.2]) b.add(rb(0.6, 0.12, 0.6, 0.02), 'wBronze', { p: [sx * 1.55, y, 2.2], c: bC });
      b.add(rb(0.16, 3.6, 0.12, 0.02), 'wIron', { p: [sx * 1.3, 4.8, 2.2], c: iC }); // the gate's guide rail
      b.add(rb(0.7, 0.5, 0.7, 0.05), 'wBronze', { p: [sx * 1.55, 3.1, 2.2], c: bC });
    }
    b.add(rb(3.7, 0.5, 0.8, 0.06), 'wPaint', { p: [0, 7.05, 2.2], c: hC });
    b.add(rb(3.8, 0.1, 0.9, 0.02), 'wBronze', { p: [0, 7.34, 2.2], c: bC });
    frost(b, 0, 7.4, 2.2, 3.4, 0.6, 10, 0.12);
    icicles(b, [-1.7, 6.8, 2.62], [1.7, 6.8, 2.62], 9, 0.3);
    // the water tank behind: a square riveted tank, a flat lid, one sight gauge, a short square overflow spout
    b.add(rb(2.6, 1.8, 2.0, 0.08), 'wBronze', { p: [0, 3.8, -2.1], c: bC });
    for (const y of [3.2, 4.4]) b.add(rb(2.7, 0.1, 2.1, 0.02), 'wIron', { p: [0, y, -2.1], c: iC });
    b.add(rb(2.8, 0.14, 2.2, 0.03), 'wPaint', { p: [0, 4.75, -2.1], c: h2C });
    gauge(b, [1.32, 3.8, -2.4], 1.1, PI / 2);
    b.add(rb(0.4, 0.3, 0.7, 0.04), 'wIron', { p: [-0.7, 3.4, -3.3], c: iC });
    b.add(box(0.26, 0.04, 0.5), 'wWet', { p: [-0.7, 3.47, -3.45] });
    frost(b, 0, 4.85, -2.1, 2.4, 1.8, 12, 0.12);
    icicles(b, [-1.25, 2.88, -3.1], [1.25, 2.88, -3.1], 7, 0.32);
    // the chain coil on the drum shaft bearings, the flywheel bearing on the right
    b.add(rb(0.6, 0.9, 0.9, 0.05), 'wIron', { p: [1.7, 3.5, -0.4], c: iC });
    b.addBuilder(sleeve(0.14, 1.4, { c: '#5a5e62', trim: 'wBrass', trimC: tC }), { p: [-1.1, 3.6, 0.6], r: [PI / 2, 0, 0] });
    for (const sx of [-1, 1]) icicles(b, [sx * 1.78, 1.45, -3.0], [sx * 1.78, 1.45, 2.6], 9, 0.3);
    frost(b, 0, 2.98, 0.6, 3.2, 2.0, 14, 0.1);
    bolts(b, 'wBrass', [-1.8, 2.6, -3.0], [-1.8, 2.6, 2.6], 12, 0.05, 'x', tC);
    bolts(b, 'wBrass', [1.8, 2.6, -3.0], [1.8, 2.6, 2.6], 12, 0.05, 'x', tC);
  }, 1420));
  // the winding drum on the head beam (a solid cylinder along x), turning as the gate moves
  const drum = pivot(body, 0, 6.5, 2.2);
  drum.add(part((b) => {
    b.add(cyl(0.38, 0.38, 2.4, 18), 'wIron', { r: [0, 0, PI / 2], c: iC });
    for (const x of [-1.05, -0.35, 0.35, 1.05]) b.add(cyl(0.44, 0.44, 0.08, 18), 'wBronze', { p: [x, 0, 0], r: [0, 0, PI / 2], c: bC });
    b.add(rb(0.3, 0.12, 0.2, 0.02), 'wBrass', { p: [0.7, 0.4, 0], c: tC });
  }, 1421));
  // the gate: a riveted plate of horizontal planks in an iron frame, hung on two chains, icicles off its foot
  const gate = pivot(body, 0, 4.2, 2.3);
  gate.add(part((b) => {
    b.add(rb(2.5, 2.5, 0.22, 0.04), 'wBronze', { c: grime(BRZ, -1.2, 1.2, 0.35, 20) });
    for (let i = 0; i < 6; i++) b.add(rb(2.42, 0.34, 0.08, 0.02), 'wWood', { p: [0, -1.05 + i * 0.42, 0.13], c: wear(WOOD, 0.35, 21 + i) });
    for (const y of [-1.24, 1.24]) b.add(rb(2.6, 0.14, 0.32, 0.03), 'wIron', { p: [0, y, 0], c: iC });
    for (const sx of [-1, 1]) b.add(rb(0.14, 2.6, 0.32, 0.03), 'wIron', { p: [sx * 1.25, 0, 0], c: iC });
    bolts(b, 'wBrass', [-1.1, 1.24, 0.18], [1.1, 1.24, 0.18], 7, 0.04, 'z', tC);
    bolts(b, 'wBrass', [-1.1, -1.24, 0.18], [1.1, -1.24, 0.18], 7, 0.04, 'z', tC);
    for (const sx of [-0.7, 0.7]) b.add(cyl(0.05, 0.05, 2.3, 6), 'wIron', { p: [sx, 2.4, -0.05], c: '#3a3e44' }); // the chains up to the drum
    // water seeping through the seams of the planks
    for (let i = 0; i < 3; i++) b.add(box(2.2, 0.03, 0.02), 'wWet', { p: [0, -0.84 + i * 0.84, 0.18] });
    frost(b, 0, 1.33, 0, 2.4, 0.3, 6, 0.08);
    icicles(b, [-1.1, -1.3, 0.05], [1.1, -1.3, 0.05], 8, 0.34);
  }, 1422));
  // the gate wheel on the left flank: a large solid disc with paddle lugs, the hands' wheel for winding by hand
  const wheel = pivot(body, -1.95, 3.6, -0.4);
  wheel.add(part((b) => gateWheel(b, 1.35, 0.28, { n: 12 }), 1423));
  // the flywheel on the right flank
  const fly = pivot(body, 2.15, 3.5, -0.4);
  fly.add(part((b) => b.addBuilder(flywheel(0.9, 0.24, { c: '#4a4440', seed: 1424 })), 1424));
  const s1 = spray(3, 0.7, 1.0, 0.4); s1.position.set(0, 2.9, 2.6); body.add(s1);
  const s2 = spray(2, 0.5, 0.8, 0.35); s2.position.set(-0.7, 3.4, -3.5); body.add(s2);
  const glow = slotGlow(0x7ac8ff, 2.3, 1.9, 0.45); glow.position.set(0, 0, 0.24); gate.add(glow); // on the gate's planked face, riding with it
  const a = new Anim(root, { base, body, wheels: TR.wheels, gate, drum, wheel, fly });
  a.dynamics.push(s1, s2, glow);
  let dist = 0, gy = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.8), e = 1 - Math.pow(1 - k, 2);
      p.gate.position.y = 4.2 - 1.3 * e; p.body.rotation.z = -0.07 * e; p.body.rotation.x = 0.04 * e; p.body.position.y = -0.25 * e;
      s1.visible = false; glow.material.opacity = 0.45 * (1 - k);
      for (const d of this.dynamics) d.userData.update?.(dt, this.t);
      return;
    }
    s1.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.7) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    p.fly.rotation.x += (1.0 + this.speed) * dt * ts;
    // the attack: wind the gate up slowly, then let it drop
    const at = this.stepAttack(dt);
    let target = Math.sin(this.t * 0.8) * 0.05;
    if (at >= 0) target = at < 0.5 ? (at / 0.5) * 1.4 : at < 0.62 ? 1.4 * (1 - (at - 0.5) / 0.12) : -0.12 * Math.sin((at - 0.62) * 20) * (1 - at);
    const prev = gy;
    gy += (target - gy) * Math.min(1, dt * (at >= 0.5 && at < 0.62 ? 30 : 6));
    p.gate.position.y = 4.2 + gy;
    p.drum.rotation.x -= (gy - prev) / 0.38;
    p.wheel.rotation.x -= (gy - prev) / 0.6 + 0.15 * dt * ts;
    p.body.position.y = Math.abs(Math.sin(this.t * 2.6)) * 0.03 * Math.min(1, this.speed);
    glow.material.opacity = 0.35 + 0.12 * Math.sin(this.t * 3.1);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z = Math.sin(this.t * 25) * this.hitT * 0.015; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  // the Tripo model (tripoModels.js): the gate's spray at its foot, the tank's overflow at the back; the plank glow stays
  // with the hidden built gate
  return wearModel(finish(root, a, 7.4), 'gatewinder', { fit: 'long', stretch: [0.9, 1.15],
    fx: [[s1, [0, 0.2, 0.5]], [s2, [0.2, 0.52, -0.38]]], motion: { ...MOTION.boss, heave: 0.5 } });
}

// ==========================================================================
// THE TURBINE HEART (about 6.4 m tall, 6.8 m long)
// ==========================================================================
export function buildTurbineHeart() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 4.6, len: 5.4, h: 1.3, tw: 1.0, paint: 'wBronze', paintC: BRZ, linkC: '#555a60', road: 2, seed: 1510 });
  const body = pivot(base, 0, 0, 0);
  const hC = grime(STONE, 1.2, 3.6, 0.3, 11), h2C = wear(STONE2, 0.3, 12), bC = wear(BRZ, 0.3, 13), iC = wear(IRON, 0.25, 14), tC = wear(TRIM, 0.3, 15);
  const P = (w, h, d, seed, o = {}) => pl(w, h, d, { mat: 'wPaint', c: hC, c2: h2C, trim: 'wBronze', trimC: bC, boltMat: 'wBrass', boltC: tC, seed, ...o });
  body.add(part((b) => {
    // the turbine casing: a big square block, chamfered, plated on every side, two bronze bands round it
    b.add(rb(3.8, 2.6, 4.4, 0.2), 'wPaint', { p: [0, 2.6, 0], c: hC });
    for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) b.addBuilder(P(1.9, 1.5, 0.12, 1511 + i), { p: [sx * 1.92, 2.6, -1.05 + i * 2.1], r: [0, sx * PI / 2, 0] });
    for (const y of [1.6, 3.6]) b.add(rb(3.95, 0.16, 4.55, 0.04), 'wBronze', { p: [0, y, 0], c: bC });
    b.add(rb(4.0, 0.18, 4.6, 0.04), 'wPaint', { p: [0, 3.95, 0], c: h2C });
    // the tailrace mouth: one square opening low at the front, dark inside, water pouring from its sill
    b.addBuilder(P(3.4, 1.0, 0.14, 1515, { inset: false }), { p: [0, 3.2, 2.22] });
    b.add(rb(2.0, 1.1, 0.2, 0.04), 'wIron', { p: [0, 2.0, 2.22], c: iC });
    b.add(box(1.6, 0.8, 0.1), 'wDark', { p: [0, 2.0, 2.28], c: '#14181c' });
    b.add(rb(2.2, 0.14, 0.6, 0.03), 'wBronze', { p: [0, 1.42, 2.45], c: bC });
    b.add(box(1.5, 0.04, 0.5), 'wWet', { p: [0, 1.5, 2.48] }); // the water over the sill
    b.add(box(1.4, 1.1, 0.03), 'wWet', { p: [0, 0.92, 2.76], r: [0.12, 0, 0] }); // and the sheet falling from it
    gauge(b, [1.3, 2.7, 2.3], 0.8, 0);
    // the governor housing on top: a square block with a flat hood, a square hatch, one sight gauge round the back
    b.add(rb(1.8, 1.5, 1.8, 0.08), 'wBronze', { p: [0, 4.75, -0.3], c: bC });
    b.add(rb(2.1, 0.16, 2.1, 0.03), 'wPaint', { p: [0, 5.58, -0.3], c: h2C });
    b.add(rb(0.12, 0.6, 0.12, 0.02), 'wIron', { p: [0.7, 5.95, -0.3], c: iC });
    b.add(rb(0.9, 0.08, 0.5, 0.02), 'wIron', { p: [0.7, 6.25, -0.3], c: iC });
    b.add(rb(0.7, 0.5, 0.06, 0.02), 'wIron', { p: [0, 4.8, 0.62], c: iC });
    gauge(b, [-0.5, 4.75, -1.22], 0.8, PI);
    // the penstock: a big pipe from behind and above, bending down into the back of the casing, flanged at each joint
    // (it rises straight up the back, then turns back over the stern, where it was cut from the dam's main)
    b.add(cyl(0.62, 0.62, 4.4, 18), 'wBronze', { p: [0, 4.4, -3.2], c: bC });
    b.add(rb(1.3, 1.3, 1.3, 0.2), 'wBronze', { p: [0, 6.7, -3.2], c: bC });
    b.add(cyl(0.62, 0.62, 1.4, 18), 'wBronze', { p: [0, 6.7, -4.3], r: [PI / 2, 0, 0], c: bC });
    for (const y of [3.0, 4.6, 6.0]) b.add(cyl(0.76, 0.76, 0.16, 18), 'wIron', { p: [0, y, -3.2], c: iC });
    b.add(rb(1.5, 1.5, 0.22, 0.04), 'wIron', { p: [0, 6.7, -5.0], c: iC }); // a square blanking plate where it was cut from the main
    bolts(b, 'wBrass', [-0.55, 7.3, -5.12], [0.55, 7.3, -5.12], 4, 0.05, 'z', tC);
    bolts(b, 'wBrass', [-0.55, 6.1, -5.12], [0.55, 6.1, -5.12], 4, 0.05, 'z', tC);
    b.add(rb(1.2, 1.4, 0.9, 0.05), 'wPaint', { p: [0, 2.2, -2.5], c: h2C }); // the valve chest where it meets the casing
    b.add(rb(0.16, 0.9, 0.16, 0.02), 'wIron', { p: [0.7, 3.2, -2.6], c: iC });
    // frost and icicles everywhere water has run
    frost(b, 0, 4.05, 1.1, 3.6, 2.0, 14, 0.12);
    frost(b, 0, 5.68, -0.3, 1.8, 1.8, 8, 0.1);
    for (const sx of [-1, 1]) icicles(b, [sx * 1.98, 1.32, -2.1], [sx * 1.98, 1.32, 2.1], 9, 0.32);
    icicles(b, [-1.7, 2.68, 2.33], [1.7, 2.68, 2.33], 8, 0.26);
    icicles(b, [-0.5, 4.75, -3.6], [0.5, 4.95, -4.0], 4, 0.4);
  }, 1520));
  // the runners: a solid disc spinning in an open square frame on each flank, the water that drives them glinting
  const runners = [];
  for (const sx of [-1, 1]) {
    const fr = pivot(body, sx * 2.25, 2.7, 0.2);
    fr.add(part((b) => {
      for (const sz of [-1, 1]) b.add(rb(0.3, 2.6, 0.24, 0.03), 'wIron', { p: [0, 0, sz * 1.35], c: iC });
      for (const sy of [-1, 1]) b.add(rb(0.3, 0.24, 2.94, 0.03), 'wIron', { p: [0, sy * 1.3, 0], c: iC });
      b.add(rb(0.4, 0.4, 0.4, 0.04), 'wBrass', { p: [-sx * 0.12, 0, 0], c: tC });
      frost(b, 0, 1.44, 0, 0.3, 2.8, 5, 0.07);
    }, 1530 + (sx > 0 ? 1 : 0)));
    const rn = pivot(body, sx * 2.35, 2.7, 0.2);
    rn.add(part((b) => {
      b.add(bdisc(1.12, 0.22, 0.05, 30), 'wBronze', { r: [0, 0, PI / 2], c: wear('#5a4a3a', 0.3, 40 + sx) });
      b.add(rb(0.34, 0.5, 0.5, 0.04), 'wBrass', { c: TRIM }); // a square hub boss: no concentric disc-in-a-ring face (content rules)
      b.add(rb(0.12, 0.3, 0.2, 0.02), 'wBrass', { p: [sx * 0.2, 0.42, 0], c: TRIM }); // the off-centre bolt plate
      b.add(rb(0.1, 0.2, 0.36, 0.02), 'wIron', { p: [sx * 0.18, -0.48, 0], c: '#3a3e44' }); // a balance block
      b.add(box(0.03, 0.1, 1.6), 'wWet', { p: [sx * 0.13, 0.86, 0] }); // a wet streak at the rim, so the spin shows
    }, 1532 + (sx > 0 ? 1 : 0)));
    runners.push(rn);
  }
  const s1 = spray(4, 0.9, 0.7, 0.42); s1.position.set(0, 1.0, 2.9); body.add(s1);
  const s2 = spray(2, 0.6, 1.2, 0.35); s2.position.set(0, 6.7, -5.2); body.add(s2);
  const s3 = spray(2, 0.5, 1.0, 0.32); s3.position.set(-2.4, 1.6, 0.2); body.add(s3);
  const glow = slotGlow(0x7ac8ff, 1.5, 1.2, 0.5, { rx: 0.12 }); glow.position.set(0, 0.95, 2.8); body.add(glow);
  const a = new Anim(root, { base, body, wheels: TR.wheels, runners });
  a.dynamics.push(s1, s2, s3, glow);
  let dist = 0, rev = 1.5;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 2.2), e = 1 - Math.pow(1 - k, 2);
      rev *= Math.max(0, 1 - dt * 0.8);
      for (const r of p.runners) r.rotation.x += rev * dt;
      p.body.rotation.x = 0.06 * e; p.body.position.y = -0.3 * e;
      s1.visible = s2.visible = s3.visible = false; glow.material.opacity = 0.5 * (1 - k);
      return;
    }
    s1.visible = s2.visible = s3.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.65) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    // the runners spin fast and race up as it winds up a blast
    const at = this.stepAttack(dt);
    const want = (at >= 0 ? (at < 0.6 ? 4 + at * 14 : 12 - (at - 0.6) * 18) : 4) * ts;
    rev += (want - rev) * Math.min(1, dt * 2.5);
    for (let i = 0; i < 2; i++) p.runners[i].rotation.x += rev * dt * (i ? -1 : 1);
    const shake = 0.012 + (at >= 0 ? 0.03 : 0);
    p.body.position.y = Math.sin(this.t * 31) * shake * 0.5 + Math.abs(Math.sin(this.t * 2.4)) * 0.03 * Math.min(1, this.speed);
    p.body.rotation.z = Math.sin(this.t * 27) * shake * 0.06;
    glow.material.opacity = 0.42 + 0.14 * Math.sin(this.t * 5.3);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z += Math.sin(this.t * 25) * this.hitT * 0.015; }
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  // the Tripo model: spray off the tailrace sill, the cut penstock's end and the left runner; it stands a little forward of
  // the built bounds' middle (the built penstock ran far aft)
  return wearModel(finish(root, a, 7.0), 'turbineheart', { fit: 'wide', stretch: [0.9, 1.12], center: [0, 0.1],
    fx: [[s1, [0, 0.1, 0.39]], [s2, [0.15, 0.93, -0.37]], [s3, [-0.44, 0.22, 0.05]]], motion: MOTION.boss });
}

// ==========================================================================
// THE FLOODGATE (the last boss, about 10.5 m tall, 9 m wide)
// ==========================================================================
// the slots along the gate's iron lip: [x, width], uneven so they never pair up or form a row of 'eyes'
const SLOTS = [[-2.15, 0.75], [-1.22, 1.0], [-0.3, 0.62], [0.52, 0.92], [1.48, 0.78], [2.2, 0.5]];
export function buildFloodgate() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 7.6, len: 6.4, h: 1.8, tw: 1.3, paint: 'wBronze', paintC: BRZ, linkC: '#555a60', road: 2, seed: 1610 });
  const body = pivot(base, 0, 0, 0);
  const hC = grime(STONE, 1.6, 9.0, 0.3, 21), h2C = wear(STONE2, 0.3, 22), bC = wear(BRZ, 0.3, 23), iC = wear(IRON, 0.25, 24), tC = wear(TRIM, 0.3, 25);
  const P = (w, h, d, seed, o = {}) => pl(w, h, d, { mat: 'wPaint', c: hC, c2: h2C, trim: 'wBronze', trimC: bC, boltMat: 'wBrass', boltC: tC, seed, ...o });
  body.add(part((b) => {
    // the sill: a heavy plated beam joining the treads, the gate seat along its top
    b.add(rb(8.4, 1.2, 3.2, 0.1), 'wPaint', { p: [0, 2.2, 0], c: hC });
    b.addBuilder(P(6.6, 0.9, 0.14, 1611, { inset: false }), { p: [0, 2.2, 1.62] });
    b.add(rb(6.4, 0.2, 0.9, 0.04), 'wBronze', { p: [0, 2.9, 0.5], c: bC });
    // the two gate towers: square, stone-grey plate in three courses with bronze bands, flat capped tops
    for (const sx of [-1, 1]) {
      const x = sx * 3.55;
      b.add(rb(1.9, 7.4, 2.8, 0.1), 'wPaint', { p: [x, 6.3, 0], c: hC });
      for (let i = 0; i < 3; i++) {
        b.addBuilder(P(2.5, 2.0, 0.14, 1612 + i), { p: [x + sx * 0.96, 3.9 + i * 2.35, 0], r: [0, sx * PI / 2, 0] });
        b.addBuilder(P(1.6, 2.0, 0.14, 1615 + i, { inset: false }), { p: [x, 3.9 + i * 2.35, 1.42] });
      }
      for (const y of [2.8, 5.1, 7.45, 9.8]) b.add(rb(2.0, 0.16, 2.9, 0.03), 'wBronze', { p: [x, y, 0], c: bC });
      b.add(rb(2.3, 0.3, 3.2, 0.05), 'wPaint', { p: [x, 10.15, 0], c: h2C });
      b.add(rb(1.4, 0.5, 1.6, 0.05), 'wBronze', { p: [x, 10.55, -0.3], c: bC }); // the ram housing
      frost(b, x, 10.32, 0, 2.0, 2.8, 12, 0.14);
      icicles(b, [x - sx * 0.95, 9.7, 1.45], [x + sx * 0.95, 9.7, 1.45], 5, 0.4);
      icicles(b, [x + sx * 1.0, 9.7, -1.4], [x + sx * 1.0, 9.7, 1.4], 6, 0.4);
      // the gate slot: a dark iron guide down the inner face of each tower
      b.add(rb(0.3, 6.8, 0.6, 0.03), 'wIron', { p: [x - sx * 1.0, 6.4, 0.6], c: iC });
      // one sight gauge, on the right tower only, showing how high the lake stands
      if (sx > 0) gauge(b, [x + 0.4, 6.0, 1.52], 2.4, 0);
    }
    // the head beam: flat, straight across the tops of the towers, with its square lifting rams
    b.add(rb(9.2, 0.7, 1.3, 0.08), 'wPaint', { p: [0, 10.2, 0.6], c: hC });
    b.add(rb(9.3, 0.12, 1.4, 0.02), 'wBronze', { p: [0, 10.6, 0.6], c: bC });
    for (const x of [-1.6, 1.6]) b.addBuilder(sleeve(0.2, 1.4, { c: '#5a5e62', trim: 'wBrass', trimC: tC }), { p: [x, 9.4, 0.6] });
    frost(b, 0, 10.7, 0.6, 8.6, 1.0, 18, 0.14);
    icicles(b, [-2.5, 9.85, 1.27], [2.5, 9.85, 1.27], 12, 0.5);
    // the ballast tank behind: a long square tank on the sill, water slopping at its overflow
    b.add(rb(5.0, 2.0, 1.8, 0.08), 'wBronze', { p: [0, 3.8, -1.7], c: bC });
    for (const y of [3.2, 4.3]) b.add(rb(5.1, 0.1, 1.9, 0.02), 'wIron', { p: [0, y, -1.7], c: iC });
    b.add(rb(5.2, 0.14, 2.0, 0.03), 'wPaint', { p: [0, 4.85, -1.7], c: h2C });
    frost(b, 0, 4.95, -1.7, 4.8, 1.6, 12, 0.12);
    for (const sx of [-1, 1]) icicles(b, [sx * 4.1, 1.6, -1.5], [sx * 4.1, 1.6, 1.5], 7, 0.36);
    bolts(b, 'wBrass', [-3.2, 1.75, 1.66], [3.2, 1.75, 1.66], 14, 0.06, 'z', tC);
  }, 1620));
  // the gate: horizontal timber planks in a riveted iron frame with horizontal ribs only (never a cross), cracked through
  // its middle planks, water jetting from the seams and sheeting off its foot
  const gate = pivot(body, 0, 6.2, 0.75);
  gate.add(part((b) => {
    b.add(rb(5.4, 6.0, 0.36, 0.05), 'wBronze', { c: grime(BRZ, -3, 3, 0.35, 30) });
    for (let i = 0; i < 12; i++) b.add(rb(5.2, 0.44, 0.1, 0.02), 'wWood', { p: [0, -2.72 + i * 0.495, 0.22], r: [0, 0, i === 5 ? 0.02 : i === 6 ? -0.025 : 0], c: wear(i === 5 || i === 6 ? '#5a4836' : WOOD, 0.35, 31 + i) });
    for (const y of [-2.95, -1.0, 1.0, 2.95]) b.add(rb(5.6, 0.22, 0.44, 0.04), 'wIron', { p: [0, y, 0.06], c: iC });
    for (const sx of [-1, 1]) b.add(rb(0.24, 6.1, 0.44, 0.04), 'wIron', { p: [sx * 2.72, 0, 0.06], c: iC });
    for (const y of [-2.95, -1.0, 1.0, 2.95]) bolts(b, 'wBrass', [-2.4, y, 0.3], [2.4, y, 0.3], 10, 0.05, 'z', tC);
    // the cracks: thin glowing water seams along the split planks, short and broken, a few leaking down
    for (const [x, y, w] of [[-1.6, 0.0, 1.2], [-0.2, 0.06, 0.9], [1.1, -0.02, 1.4], [-0.9, 0.48, 0.7], [0.6, 0.52, 0.8]]) b.add(box(w, 0.04, 0.03), 'wWet', { p: [x, y, 0.29] });
    for (const [x, y, h] of [[-1.3, -0.75, 0.9], [0.4, -0.85, 1.1], [1.75, -0.6, 0.7]]) b.add(box(0.04, h, 0.03), 'wWet', { p: [x, y, 0.3] }); // drips below the seams, never crossing them
    // the foot of the gate: water sheeting from under it, ice built up along it
    b.add(box(5.0, 0.06, 0.6), 'wWet', { p: [0, -3.05, 0.5] });
    for (let i = 0; i < 10; i++) b.add(ico(b.r(0.16, 0.3), 0), 'iceBlue', { p: [-2.4 + i * 0.53, -2.95, b.r(0.3, 0.6)], s: [1.6, 0.7, 1.2], r: [0, b.r(0, 3), 0], c: wear(ICE, 0.1, i) });
    frost(b, 0, 3.1, 0.06, 5.2, 0.4, 10, 0.12);
    icicles(b, [-2.5, -3.1, 0.06], [2.5, -3.1, 0.06], 12, 0.42);
  }, 1630));
  // the gate wheels: a large solid disc on the outer face of each tower, turning as the gate moves
  const wheels2 = [];
  for (const sx of [-1, 1]) {
    const wh = pivot(body, sx * 4.75, 6.6, 0.2);
    wh.add(part((b) => gateWheel(b, 1.7, 0.34, { n: 14, c: wear(BRZ2, 0.3, 50 + sx) }), 1640 + (sx > 0 ? 1 : 0)));
    wheels2.push(wh);
  }
  // the water through the gate: a straight iron lip runs across the gate under the cracked planks, slit with narrow
  // rectangular slots of uneven width and spacing, and a flat translucent curtain falls from each slot down the gate face.
  // Flat sheets only (thin boxes, edge-on lines from above), never round puffs, never a few in a row that could read as a face.
  gate.add(part((b) => {
    b.add(rb(5.3, 0.12, 0.18, 0.02), 'wIron', { p: [0, -0.32, 0.36], c: iC });
    for (const [x, w] of SLOTS) b.add(box(w, 0.05, 0.06), 'wIron', { p: [x, -0.4, 0.46], c: '#202428' });
  }, 1650));
  const jets = [];
  for (const [x, w] of SLOTS) { const s = slotGlow(0x9cd4f4, w, 2.5, 0.5, { d: 0.03 }); s.position.set(x, -1.68, 0.5); gate.add(s); jets.push(s); }
  // the run-off at the foot: one wide flat sheet of water lying on the sill, a rectangle from every side
  const foot = slotGlow(0x9cd4f4, 5.2, 0.9, 0.42, { rx: -PI / 2 }); foot.position.set(0, -3.0, 0.85); gate.add(foot);
  const glow = slotGlow(0x7ac8ff, 5.0, 1.4, 0.5); glow.position.set(0, 0.25, 0.34); gate.add(glow); // a band over the cracked middle planks
  const a = new Anim(root, { base, body, wheels: TR.wheels, gate, wheels2 });
  a.dynamics.push(...jets, foot, glow);
  let dist = 0, gy = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      // the gate gives way and settles askew in its slot, the jets die away
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 2.4), e = 1 - Math.pow(1 - k, 2);
      p.gate.position.y = 6.2 - 0.9 * e; p.gate.rotation.z = 0.06 * e; p.gate.rotation.x = 0.08 * e;
      p.body.position.y = -0.3 * e;
      for (const j of jets) j.visible = k < 0.5;
      glow.material.opacity = 0.5 * (1 - k);
      for (const d of this.dynamics) d.userData.update?.(dt, this.t);
      return;
    }
    for (const j of jets) j.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.9) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    // the attack: heave the gate up in its slot, then slam it down
    const at = this.stepAttack(dt);
    let target = Math.sin(this.t * 0.6) * 0.06;
    if (at >= 0) target = at < 0.55 ? (at / 0.55) * 1.6 : at < 0.65 ? 1.6 * (1 - (at - 0.55) / 0.1) : -0.1 * Math.sin((at - 0.65) * 22) * (1 - at);
    const prev = gy;
    gy += (target - gy) * Math.min(1, dt * (at >= 0.55 && at < 0.65 ? 30 : 5));
    p.gate.position.y = 6.2 + gy;
    for (let i = 0; i < 2; i++) p.wheels2[i].rotation.x += ((gy - prev) / 0.9) * (i ? 1 : -1) + 0.1 * dt * ts * (i ? 1 : -1);
    p.body.rotation.z = Math.sin(this.t * 0.5) * 0.004;
    glow.material.opacity = 0.42 + 0.14 * Math.sin(this.t * 4.1) * Math.sin(this.t * 2.3);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z += Math.sin(this.t * 25) * this.hitT * 0.01; }
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  finish(root, a, 11);
  // the Tripo model (tripoModels.js): its own icy curtains hang under the gate; the shimmering water sheets fall over them
  // (squeezed to the narrower gate) and the run-off lies at its foot. The cracked-plank glow stays with the built gate.
  wearModel(root, 'floodgate', {
    keep: [...jets, foot],
    fx: [...jets.map((j, i) => [j, [SLOTS[i][0] / 2.5 * 0.15, 0.105, 0.068], { sx: 0.62, sy: 0.48 }]), [foot, [0, 0.012, 0.1], { sx: 0.62 }]],
    fit: 'wide', stretch: [0.85, 1.3],
    motion: { bob: 0.035, bobHz: 6, rock: 0.004, sway: 0.006, lunge: 0.6, heave: 1.0, flinch: 0.03, sink: 0.6, tilt: 0.06, dieDur: 2.4 },
  });
  return root;
}
