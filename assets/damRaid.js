// The Great Dam (Part Eleven raid, level 50): the four boss machines inside the Makers' greatest dam on the Rime Steps.
// Grey stone-coloured plate and blackened bronze, rimed with frost, water running and bursting out of every seam.
//  - The Penstock Engine: a valve engine on heavy treads that rides a length of the great penstock. The pipe lies along its
//    back in square saddles, banded by flanges; a square valve body stands up out of the pipe's middle with its stem and a
//    solid hand wheel on the right flank (lugs round the rim); a square valve house with a flat roof at the stern; the pipe's
//    mouth at the bow is shut by one square valve plate that slides up to loose a jet of water.
//  - The Ice Breaker: a heavy tracked engine with a wedge ram at the bow (two raked plates meeting at the stem) and a tilt
//    hammer over it: one long helve hinged between two square posts on the deck, a long square hammer head at its front end
//    (in line with the helve, so from above it is one bar, never a cross), a cam driven by a solid flywheel on the left flank,
//    a square boiler with one stack behind, broken ice heaped on the deck.
//  - The Governor: the regulator that held the turbines' speed. A square tower on treads, a tall spindle out of its top with
//    a square cap, two square brass weights on hinged arms that spin with the spindle and fly out as it races (links down to a
//    sliding collar), a solid flywheel on the right flank, a throttle valve and its lever on the left, the penstock coming in
//    behind, one sight gauge on the side.
//  - THE GREAT DAM'S HEART: the dam's master gate engine, standing against the north wall and never moving. A stepped stone
//    plinth; two great square piers under a flat lintel (no arch); between them the master gate, a wall of horizontal planks
//    and ribs (no upright rib down the middle, so never a cross) with water jetting through its seams; behind it the heart
//    chamber, a square stone block fed by three square penstock intakes from the wall; on the lintel a square winding house
//    with its drum and chains down to the gate; a solid gate wheel on the outer face of each pier; one counterweight on the
//    right; a square surge tank on the left; one depth gauge board on the right pier.
// Same interface as the other machines: userData.machine = { update(dt, speed), attack(dur, kind), hit(), die(), revive(), stun }.
// Content rules: no faces (one outlet or one gauge, never a pair of lamps or ports over a grille or slot, on any side or from
// above), nothing animal-like, no spokes (wheels are solid discs with lugs on the rim and an off-centre bolt plate), no domes,
// rings, stars or radiating patterns, no crosses; everything square from above.
import * as THREE from 'three';
import { box, rbox, cyl, cone, ico } from './kit.js';
import { plate, sleeve, heroTreads, crawl, wear, grime, bolts, bdisc, flywheel, stack } from './bossParts.js';
import { smoke, glowSprite } from './dynamic.js';
import { slotGlow } from './slotGlow.js';
import { Anim, finish, part, pivot } from './quarryMachines.js';

const PI = Math.PI;
const rb = (w, h, d, r) => rbox(w, h, d, r, 1);
const pl = (w, h, d, o = {}) => plate(w, h, d, { br: Math.max(0.035, Math.min(0.07, Math.min(w, h) * 0.05)), ...o });
// grey stone-coloured plate, blackened bronze, its bronze trim, dark iron, frost and ice
const STONE = '#8e959a', STONE2 = '#72797e', BRZ = '#463c34', TRIM = '#94764a', IRON = '#4a4e54', FROST = '#eef5fa', ICE = '#cfe6f4', WOOD = '#76604a';

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
// broken ice lumps heaped over a rectangle
function iceHeap(b, cx, y, cz, w, d, n, s = 0.3) {
  for (let i = 0; i < n; i++) b.add(ico(s * b.r(0.6, 1.3), 0), 'wPaint', { p: [cx + b.r(-w / 2, w / 2), y + b.r(0, s), cz + b.r(-d / 2, d / 2)], s: [b.r(1, 1.6), b.r(0.6, 1.0), b.r(1, 1.5)], r: [b.r(0, 3), b.r(0, 3), 0], c: i % 3 ? ICE : FROST });
}
// one sight-gauge strip: a lit glass in a dark frame (always single, never a pair)
function gauge(b, p, h, ry = 0) {
  b.add(rb(0.16, h + 0.1, 0.08, 0.02), 'wDark', { p, r: [0, ry, 0], c: '#2e3236' });
  b.add(box(0.07, h, 0.03), 'wGlowBlue', { p: [p[0] + Math.sin(ry) * 0.035, p[1], p[2] + Math.cos(ry) * 0.035], r: [0, ry, 0] });
}
// a solid gate wheel on the x axis: one plain bevelled disc, a square axle nut, an off-centre bolt plate, and square lugs
// round the rim (the hands' grips). Never spoked.
function gateWheel(b, r, w, o = {}) {
  const { c = wear(BRZ, 0.3, 7), n = 12, lugC = TRIM } = o;
  b.add(bdisc(r, w, Math.min(r * 0.08, w * 0.3), 28), 'wBronze', { r: [0, 0, PI / 2], c });
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
// the common tread-and-hull update: wheels turn, track runs crawl, a little bounce, a shudder when struck
function drive(a, p, TR, dt, speed, r = 0.7) {
  const ts = a.stun ? 0.15 : 1;
  a.speed += (speed - a.speed) * Math.min(1, dt * 3);
  for (const w of p.wheels) w.rotation.x += (a.speed / r) * dt * ts;
  a.dist = (a.dist || 0) + a.speed * dt * ts; crawl(TR.runs, a.dist);
  return ts;
}

// ==========================================================================
// THE PENSTOCK ENGINE (about 7 m tall, 8 m long)
// ==========================================================================
export function buildPenstockEngine() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 4.2, len: 7.2, h: 1.45, tw: 0.95, paint: 'wBronze', paintC: BRZ, linkC: '#555a60', road: 2, seed: 2410 });
  const body = pivot(base, 0, 0, 0);
  const hC = grime(STONE, 1.2, 3.4, 0.3, 1), h2C = wear(STONE2, 0.3, 2), bC = wear(BRZ, 0.3, 3), iC = wear(IRON, 0.25, 4), tC = wear(TRIM, 0.3, 5);
  const P = (w, h, d, seed, o = {}) => pl(w, h, d, { mat: 'wPaint', c: hC, c2: h2C, trim: 'wBronze', trimC: bC, boltMat: 'wBrass', boltC: tC, seed, ...o });
  const PR = 1.25, PY = 4.15; // the pipe's radius and the height of its axis
  body.add(part((b) => {
    // the hull: a long plated block over the treads, a bronze deck with a trim lip
    b.add(rb(3.5, 1.5, 7.0, 0.12), 'wPaint', { p: [0, 2.05, 0], c: hC });
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) b.addBuilder(P(2.1, 1.0, 0.12, 2411 + i), { p: [sx * 1.8, 2.05, -2.3 + i * 2.3], r: [0, sx * PI / 2, 0] });
    b.add(rb(3.8, 0.16, 7.3, 0.04), 'wBronze', { p: [0, 2.86, 0], c: bC });
    for (const sx of [-1, 1]) b.add(box(0.1, 0.1, 7.3), 'wBrass', { p: [sx * 1.9, 2.96, 0], c: tC });
    b.addBuilder(P(3.0, 1.1, 0.14, 2415, { inset: false }), { p: [0, 2.0, 3.55] });
    b.add(rb(3.3, 0.24, 0.4, 0.05), 'wIron', { p: [0, 1.25, 3.7], c: iC });
    // the penstock along the back: one great pipe in three square saddles, banded by flanges at its joints
    b.add(cyl(PR, PR, 6.6, 24), 'wBronze', { p: [0, PY, 0.3], r: [PI / 2, 0, 0], c: grime(BRZ, 3.0, 5.4, 0.3, 6) });
    for (const z of [-2.7, 0.3, 3.3]) {
      b.add(cyl(PR + 0.14, PR + 0.14, 0.24, 24), 'wIron', { p: [0, PY, z], r: [PI / 2, 0, 0], c: iC });
      for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * PI * 2; b.add(box(0.1, 0.1, 0.3), 'wBrass', { p: [Math.cos(a) * (PR + 0.12), PY + Math.sin(a) * (PR + 0.12), z], c: tC }); }
    }
    for (const z of [-1.7, 1.6]) {
      b.add(rb(3.0, 0.9, 0.7, 0.06), 'wPaint', { p: [0, 3.2, z], c: h2C });
      for (const sx of [-1, 1]) b.add(rb(0.5, 1.6, 0.74, 0.05), 'wPaint', { p: [sx * 1.25, 3.7, z], c: h2C });
      b.add(rb(3.1, 0.1, 0.8, 0.02), 'wBronze', { p: [0, 3.68, z], c: bC });
    }
    frost(b, 0, PY + PR - 0.05, 0.3, 1.2, 6.0, 18, 0.13);
    icicles(b, [-1.0, PY - 0.75, -2.4], [-1.0, PY - 0.75, 3.0], 9, 0.36);
    icicles(b, [1.0, PY - 0.75, -2.4], [1.0, PY - 0.75, 3.0], 9, 0.36);
    // the valve body: a square block standing up out of the pipe's middle, its bonnet, the stem and the stem's yoke
    b.add(rb(1.6, 1.3, 1.6, 0.08), 'wPaint', { p: [0, PY + 1.3, 0.3], c: hC });
    for (const y of [PY + 0.85, PY + 1.75]) b.add(rb(1.7, 0.12, 1.7, 0.02), 'wBronze', { p: [0, y, 0.3], c: bC });
    b.add(rb(1.2, 0.3, 1.2, 0.04), 'wIron', { p: [0, PY + 2.1, 0.3], c: iC });
    for (const sx of [-1, 1]) b.add(rb(0.16, 1.2, 0.16, 0.02), 'wIron', { p: [sx * 0.5, PY + 2.8, 0.3], c: iC });
    b.add(rb(1.2, 0.2, 0.3, 0.03), 'wIron', { p: [0, PY + 3.4, 0.3], c: iC });
    frost(b, 0, PY + 1.97, 0.3, 1.4, 1.4, 6, 0.1);
    // the valve house at the stern: a square plated house on the deck, a flat roof under snow, one sight gauge on its right side
    b.add(rb(2.6, 1.9, 1.8, 0.08), 'wPaint', { p: [0, 3.9, -3.0], c: hC });
    b.addBuilder(P(2.2, 1.3, 0.1, 2418, { inset: false }), { p: [0, 3.9, -3.92], r: [0, PI, 0] });
    b.add(rb(2.9, 0.18, 2.1, 0.03), 'wBronze', { p: [0, 4.92, -3.0], c: bC });
    b.add(rb(2.7, 0.2, 1.9, 0.12), 'wPaint', { p: [0, 5.1, -3.0], c: wear(FROST, 0.1, 9) });
    gauge(b, [1.32, 3.9, -2.7], 1.1, PI / 2);
    icicles(b, [-1.3, 4.8, -3.98], [1.3, 4.8, -3.98], 8, 0.32);
    // the bow: the pipe's mouth in a square frame (the valve plate that shuts it is its own part)
    b.add(rb(3.0, 3.0, 0.4, 0.06), 'wIron', { p: [0, PY - 0.1, 3.7], c: iC });
    for (const sx of [-1, 1]) b.add(rb(0.3, 3.4, 0.5, 0.04), 'wBronze', { p: [sx * 1.5, PY - 0.1, 3.8], c: bC }); // the plate's guides
    b.add(box(2.0, 2.0, 0.08), 'wDark', { p: [0, PY - 0.1, 3.92], c: '#141a1e' });
    b.add(rb(3.4, 0.3, 0.6, 0.05), 'wBronze', { p: [0, PY + 1.75, 3.8], c: bC });
    for (const sx of [-1, 1]) icicles(b, [sx * 1.92, 1.5, -3.2], [sx * 1.92, 1.5, 3.2], 9, 0.3);
    bolts(b, 'wBrass', [-1.92, 2.55, -3.2], [-1.92, 2.55, 3.2], 12, 0.05, 'x', tC);
    bolts(b, 'wBrass', [1.92, 2.55, -3.2], [1.92, 2.55, 3.2], 12, 0.05, 'x', tC);
    frost(b, 0, 2.96, -1.2, 3.4, 4.0, 14, 0.1);
  }, 2420));
  // the valve plate over the pipe's mouth: a riveted square that slides up its guides to loose the jet
  const valve = pivot(body, 0, PY - 0.1, 4.05);
  valve.add(part((b) => {
    b.add(rb(2.6, 2.6, 0.2, 0.04), 'wBronze', { c: grime(BRZ, -1.3, 1.3, 0.35, 20) });
    for (const y of [-1.2, 1.2]) b.add(rb(2.7, 0.16, 0.3, 0.03), 'wIron', { p: [0, y, 0], c: iC });
    for (const y of [-0.4, 0.4]) b.add(rb(2.5, 0.12, 0.26, 0.02), 'wIron', { p: [0, y, 0], c: iC });
    bolts(b, 'wBrass', [-1.1, 1.2, 0.17], [1.1, 1.2, 0.17], 7, 0.045, 'z', tC);
    bolts(b, 'wBrass', [-1.1, -1.2, 0.17], [1.1, -1.2, 0.17], 7, 0.045, 'z', tC);
    b.add(box(2.3, 0.03, 0.02), 'wGlowBlue', { p: [0, -1.3, 0.12] }); // water seeping under its foot
    icicles(b, [-1.1, -1.3, 0.05], [1.1, -1.3, 0.05], 7, 0.3);
  }, 2421));
  // the hand wheel on the right flank, on the valve stem's gear box: a solid disc with lugs round the rim
  body.add(part((b) => { b.add(rb(0.7, 0.8, 0.9, 0.05), 'wIron', { p: [1.95, 3.6, 0.3], c: iC }); }, 2422));
  const wheel = pivot(body, 2.45, 3.6, 0.3);
  wheel.add(part((b) => gateWheel(b, 1.15, 0.26, { n: 12 }), 2423));
  // the jet out of the mouth during an attack, spray from the flange seams, a cool glow under the pipe
  const jet = spray(0, 1.3, 0.6, 0.55); jet.position.set(0, PY - 0.6, 4.4); body.add(jet);
  const s1 = spray(2.5, 0.6, 1.0, 0.36); s1.position.set(1.3, PY, -2.7); body.add(s1);
  const s2 = spray(2.0, 0.6, 1.0, 0.34); s2.position.set(-1.3, PY, 3.3); body.add(s2);
  const glow = slotGlow(0x7ac8ff, 2.1, 2.1, 0.0); glow.position.set(0, PY - 0.1, 3.97); body.add(glow);
  const cool = slotGlow(0x6ac8ff, 2.6, 5.6, 0.35, { rx: -PI / 2 }); cool.position.set(0, 3.0, 0.3); body.add(cool);
  const a = new Anim(root, { base, body, wheels: TR.wheels, valve, wheel });
  a.dynamics.push(jet, s1, s2, glow, cool);
  let vy = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.8), e = 1 - Math.pow(1 - k, 2);
      p.valve.position.y = PY - 0.1 + 1.2 * e; p.body.rotation.z = 0.06 * e; p.body.rotation.x = 0.04 * e; p.body.position.y = -0.25 * e;
      jet.userData.rate = 0; s1.visible = false; s2.visible = false; glow.material.opacity = 0; cool.material.opacity = 0.35 * (1 - k);
      for (const d of this.dynamics) d.userData.update?.(dt, this.t);
      return;
    }
    s1.visible = true; s2.visible = true;
    const ts = drive(this, p, TR, dt, speed, 0.72);
    // the attack: the wheel spins the valve plate up, the jet roars out, then the plate drops shut
    const at = this.stepAttack(dt);
    const target = at >= 0 ? (at < 0.35 ? (at / 0.35) * 2.2 : at < 0.8 ? 2.2 : 2.2 * (1 - (at - 0.8) / 0.2)) : 0;
    const prev = vy;
    vy += (target - vy) * Math.min(1, dt * 8);
    p.valve.position.y = PY - 0.1 + vy;
    p.wheel.rotation.x += (vy - prev) * 1.6 + 0.12 * dt * ts;
    const open = vy / 2.2;
    jet.userData.rate = open > 0.3 ? 22 * open : 0;
    glow.material.opacity = 0.85 * open;
    cool.material.opacity = 0.3 + 0.1 * Math.sin(this.t * 2.7);
    p.body.position.y = Math.abs(Math.sin(this.t * 2.4)) * 0.03 * Math.min(1, this.speed);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z = Math.sin(this.t * 25) * this.hitT * 0.014; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  return finish(root, a, 7.6);
}

// ==========================================================================
// THE ICE BREAKER (about 7.4 m tall, 9 m long with its ram)
// ==========================================================================
export function buildIceBreaker() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 4.4, len: 6.8, h: 1.5, tw: 1.0, paint: 'wBronze', paintC: BRZ, linkC: '#555a60', road: 2, seed: 2510 });
  const body = pivot(base, 0, 0, 0);
  const hC = grime(STONE, 1.2, 3.6, 0.3, 11), h2C = wear(STONE2, 0.3, 12), bC = wear(BRZ, 0.3, 13), iC = wear(IRON, 0.25, 14), tC = wear(TRIM, 0.3, 15);
  const P = (w, h, d, seed, o = {}) => pl(w, h, d, { mat: 'wPaint', c: hC, c2: h2C, trim: 'wBronze', trimC: bC, boltMat: 'wBrass', boltC: tC, seed, ...o });
  body.add(part((b) => {
    // the hull: a heavy plated block, a bronze deck, armour plates down both flanks
    b.add(rb(3.7, 1.7, 6.6, 0.14), 'wPaint', { p: [0, 2.15, -0.2], c: hC });
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) b.addBuilder(P(1.95, 1.15, 0.12, 2511 + i), { p: [sx * 1.9, 2.15, -2.2 + i * 2.05], r: [0, sx * PI / 2, 0] });
    b.add(rb(4.0, 0.16, 6.9, 0.04), 'wBronze', { p: [0, 3.06, -0.2], c: bC });
    for (const sx of [-1, 1]) b.add(box(0.1, 0.1, 6.9), 'wBrass', { p: [sx * 2.0, 3.16, -0.2], c: tC });
    // the wedge ram at the bow: two raked plates meeting at a stem post, an iron cutting edge down the stem, ice packed on it
    for (const sx of [-1, 1]) {
      b.add(rb(0.3, 2.0, 2.9, 0.05), 'wIron', { p: [sx * 1.0, 1.55, 3.75], r: [0, sx * 0.62, 0], c: grime(IRON, 0.5, 2.5, 0.35, 16 + sx) });
      bolts(b, 'wBrass', [sx * 0.42, 2.35, 4.6], [sx * 1.62, 2.35, 2.9], 6, 0.05, 'x', tC);
    }
    b.add(rb(0.5, 2.2, 0.5, 0.05), 'wBronze', { p: [0, 1.6, 4.95], c: bC });
    b.add(box(0.16, 2.2, 0.2), 'wIron', { p: [0, 1.6, 5.22], c: '#8a9298' });
    b.add(rb(3.2, 0.2, 2.4, 0.04), 'wIron', { p: [0, 2.6, 3.6], c: iC });
    iceHeap(b, 0, 2.7, 3.7, 2.4, 1.6, 9, 0.28);
    icicles(b, [-1.7, 0.6, 2.6], [-0.2, 0.6, 4.8], 6, 0.3);
    icicles(b, [1.7, 0.6, 2.6], [0.2, 0.6, 4.8], 6, 0.3);
    // the hammer frame on the deck: two square posts banded in bronze, the hinge block between them for the helve
    for (const sx of [-1, 1]) {
      b.add(rb(0.6, 3.4, 0.7, 0.05), 'wPaint', { p: [sx * 1.15, 4.8, -1.5], c: wear(STONE2, 0.3, 20 + sx) });
      for (const y of [3.8, 5.0, 6.2]) b.add(rb(0.7, 0.12, 0.8, 0.02), 'wBronze', { p: [sx * 1.15, y, -1.5], c: bC });
      b.add(rb(0.5, 0.6, 0.9, 0.05), 'wIron', { p: [sx * 0.7, 6.3, -1.5], c: iC }); // bearing blocks
      b.add(rb(0.24, 0.24, 2.6, 0.03), 'wIron', { p: [sx * 1.15, 4.2, -2.6], r: [0.75, 0, 0], c: iC }); // a back stay to the deck
    }
    b.add(cyl(0.16, 0.16, 2.0, 10), 'wIron', { p: [0, 6.3, -1.5], r: [0, 0, PI / 2], c: '#7a7e84' }); // the hinge pin
    frost(b, 0, 6.62, -1.5, 2.6, 0.6, 6, 0.1);
    // the anvil block on the bow deck the hammer falls onto (it breaks the ice fed over the ram)
    b.add(rb(1.6, 0.5, 1.4, 0.06), 'wIron', { p: [0, 3.35, 2.6], c: '#3a3e44' });
    // the boiler at the stern: a square plated boiler, a flat-topped square stack, one sight gauge on its right side
    b.add(rb(2.8, 1.8, 1.9, 0.1), 'wBronze', { p: [0, 4.05, -2.9], c: bC });
    for (const y of [3.5, 4.6]) b.add(rb(2.9, 0.1, 2.0, 0.02), 'wIron', { p: [0, y, -2.9], c: iC });
    b.addBuilder(stack(0.6, 1.8, { c: '#3a3634', trimC: '#5a5450', seed: 2516 }), { p: [-0.7, 4.95, -3.1] });
    gauge(b, [1.42, 4.0, -2.6], 1.0, PI / 2);
    frost(b, 0.4, 4.98, -2.9, 1.6, 1.6, 8, 0.1);
    // the cam box on the left flank, driven off the flywheel, its push rod up to the helve
    b.add(rb(0.8, 1.2, 1.4, 0.06), 'wIron', { p: [-2.1, 3.6, -1.5], c: iC });
    for (const sx of [-1, 1]) icicles(b, [sx * 2.0, 1.4, -3.4], [sx * 2.0, 1.4, 2.8], 9, 0.32);
    bolts(b, 'wBrass', [-2.0, 2.75, -3.2], [-2.0, 2.75, 2.8], 11, 0.05, 'x', tC);
    bolts(b, 'wBrass', [2.0, 2.75, -3.2], [2.0, 2.75, 2.8], 11, 0.05, 'x', tC);
    iceHeap(b, 0.6, 3.1, 0.6, 2.2, 1.4, 7, 0.24);
  }, 2520));
  // the tilt hammer: a long square helve hinged at the frame, the long square head in line with it at the front end
  const helve = pivot(body, 0, 6.3, -1.5);
  helve.add(part((b) => {
    b.add(rb(0.5, 0.5, 4.6, 0.05), 'wWood', { p: [0, 0, 2.2], c: wear(WOOD, 0.35, 30) });
    for (const z of [0.4, 1.6, 2.8, 3.9]) b.add(rb(0.6, 0.6, 0.16, 0.02), 'wIron', { p: [0, 0, z], c: iC });
    b.add(rb(1.0, 1.5, 1.7, 0.08), 'wIron', { p: [0, -0.45, 4.35], c: grime(IRON, -1.2, 0.3, 0.35, 31) });
    b.add(rb(1.1, 0.16, 1.8, 0.03), 'wBronze', { p: [0, 0.3, 4.35], c: bC });
    b.add(rb(0.9, 0.2, 1.5, 0.03), 'wIron', { p: [0, -1.25, 4.35], c: '#8a9298' }); // the striking face
    frost(b, 0, 0.4, 4.35, 0.8, 1.4, 5, 0.1);
    icicles(b, [-0.4, -1.3, 3.7], [0.4, -1.3, 5.0], 5, 0.26);
  }, 2521));
  // the flywheel on the left flank that drives the cam, and the push rod
  const fly = pivot(body, -2.65, 3.55, -0.2);
  fly.add(part((b) => b.addBuilder(flywheel(1.05, 0.26, { c: '#4a4440', seed: 2522 })), 2522));
  const rod = pivot(body, -1.6, 4.2, -0.4);
  rod.add(part((b) => { b.add(rb(0.16, 2.2, 0.16, 0.02), 'wIron', { p: [0, 1.0, 0], c: iC }); }, 2523));
  const puff = smoke({ rate: 2.2, life: 3.0, size: 1.0, rise: 1.6, color: 0xc8ced4, opacity: 0.4 }); puff.position.set(-0.7, 7.3, -3.1); body.add(puff);
  const burst = spray(0, 1.4, 1.2, 0.55); burst.position.set(0, 3.5, 2.8); body.add(burst);
  const s1 = spray(1.6, 0.6, 0.9, 0.34); s1.position.set(0, 1.0, 5.0); body.add(s1);
  const glow = slotGlow(0x7ac8ff, 2.6, 1.8, 0.3, { rx: -PI / 2, d: 0.16 }); glow.position.set(0, 2.8, 3.7); body.add(glow);
  const a = new Anim(root, { base, body, wheels: TR.wheels, helve, fly, rod });
  a.dynamics.push(puff, burst, s1, glow);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 2.0), e = 1 - Math.pow(1 - k, 2);
      p.helve.rotation.x = 0.28 * e; p.body.rotation.z = -0.07 * e; p.body.rotation.x = 0.05 * e; p.body.position.y = -0.3 * e;
      puff.userData.rate = 0; burst.userData.rate = 0; s1.visible = false; glow.material.opacity = 0.3 * (1 - k);
      for (const d of this.dynamics) d.userData.update?.(dt, this.t);
      return;
    }
    s1.visible = true; puff.userData.rate = 2.2;
    const ts = drive(this, p, TR, dt, speed, 0.75);
    p.fly.rotation.x += (1.2 + this.speed * 0.8) * dt * ts;
    // idle: the hammer ticks over slowly; an attack lifts it high and drops it onto the anvil with a burst of ice and spray
    const at = this.stepAttack(dt);
    let lift = 0.08 + 0.06 * Math.max(0, Math.sin(this.t * 2.2));
    if (at >= 0) lift = at < 0.55 ? 0.08 + (at / 0.55) * 0.75 : at < 0.65 ? 0.83 * (1 - (at - 0.55) / 0.1) : 0.0;
    p.helve.rotation.x = -lift;
    p.rod.position.y = 4.2 + lift * 0.9;
    burst.userData.rate = at >= 0.63 && at < 0.8 ? 30 : 0;
    p.body.position.y = (at >= 0.63 && at < 0.7 ? -0.06 : 0) + Math.abs(Math.sin(this.t * 2.2)) * 0.03 * Math.min(1, this.speed);
    glow.material.opacity = 0.25 + (at >= 0.63 && at < 0.85 ? 0.5 : 0) + 0.06 * Math.sin(this.t * 3.1);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z = Math.sin(this.t * 25) * this.hitT * 0.014; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  return finish(root, a, 7.4);
}

// ==========================================================================
// THE GOVERNOR (about 9 m tall, 6 m long)
// ==========================================================================
export function buildGovernor() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 4.0, len: 5.8, h: 1.35, tw: 0.95, paint: 'wBronze', paintC: BRZ, linkC: '#555a60', road: 2, seed: 2610 });
  const body = pivot(base, 0, 0, 0);
  const hC = grime(STONE, 1.2, 4.4, 0.3, 21), h2C = wear(STONE2, 0.3, 22), bC = wear(BRZ, 0.3, 23), iC = wear(IRON, 0.25, 24), tC = wear(TRIM, 0.3, 25);
  const P = (w, h, d, seed, o = {}) => pl(w, h, d, { mat: 'wPaint', c: hC, c2: h2C, trim: 'wBronze', trimC: bC, boltMat: 'wBrass', boltC: tC, seed, ...o });
  const TOP = 6.0; // the top of the regulator tower, where the spindle comes out
  body.add(part((b) => {
    // the hull and deck
    b.add(rb(3.4, 1.4, 5.6, 0.12), 'wPaint', { p: [0, 1.95, 0], c: hC });
    for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) b.addBuilder(P(2.4, 0.95, 0.12, 2611 + i), { p: [sx * 1.75, 1.95, -1.3 + i * 2.6], r: [0, sx * PI / 2, 0] });
    b.add(rb(3.7, 0.16, 5.9, 0.04), 'wBronze', { p: [0, 2.73, 0], c: bC });
    for (const sx of [-1, 1]) b.add(box(0.1, 0.1, 5.9), 'wBrass', { p: [sx * 1.85, 2.83, 0], c: tC });
    b.addBuilder(P(2.8, 1.0, 0.14, 2614, { inset: false }), { p: [0, 1.95, 2.85] });
    // the regulator tower: a square plated block, banded, with a stepped flat cap and the spindle's bearing on top
    b.add(rb(2.5, 3.2, 2.5, 0.1), 'wPaint', { p: [0, 4.4, -0.2], c: hC });
    for (const sx of [-1, 1]) b.addBuilder(P(2.0, 2.2, 0.1, 2615 + sx), { p: [sx * 1.27, 4.4, -0.2], r: [0, sx * PI / 2, 0] });
    b.addBuilder(P(2.0, 2.2, 0.1, 2618), { p: [0, 4.4, 1.07] });
    for (const y of [3.0, 5.6]) b.add(rb(2.62, 0.14, 2.62, 0.02), 'wBronze', { p: [0, y, -0.2], c: bC });
    b.add(rb(2.8, 0.2, 2.8, 0.03), 'wIron', { p: [0, TOP + 0.1, -0.2], c: iC });
    b.add(rb(1.4, 0.4, 1.4, 0.05), 'wBronze', { p: [0, TOP + 0.4, -0.2], c: bC });
    frost(b, 0, TOP + 0.22, -0.2, 2.5, 2.5, 12, 0.11);
    icicles(b, [-1.3, TOP - 0.05, 1.2], [1.3, TOP - 0.05, 1.2], 8, 0.3);
    gauge(b, [1.34, 4.3, 0.4], 1.2, PI / 2); // one sight gauge, on the right side
    // the penstock coming in behind: a big pipe along the deck from the stern into the tower's back, flanged
    b.add(cyl(0.7, 0.7, 2.4, 18), 'wBronze', { p: [0, 3.6, -2.4], r: [PI / 2, 0, 0], c: grime(BRZ, 2.9, 4.3, 0.3, 26) });
    for (const z of [-1.4, -3.4]) b.add(cyl(0.84, 0.84, 0.18, 18), 'wIron', { p: [0, 3.6, z], r: [PI / 2, 0, 0], c: iC });
    b.add(rb(1.9, 0.6, 0.7, 0.05), 'wPaint', { p: [0, 2.95, -3.0], c: h2C });
    frost(b, 0, 4.3, -2.4, 0.9, 2.0, 6, 0.1);
    // the throttle valve on the left: a square valve box on the deck, its lever arm (its own part) up the tower's side
    b.add(rb(0.9, 1.0, 1.2, 0.06), 'wIron', { p: [-1.6, 3.3, 1.6], c: iC });
    b.add(rb(1.1, 0.12, 1.4, 0.02), 'wBronze', { p: [-1.6, 3.82, 1.6], c: bC });
    // the flywheel's bearing on the right
    b.add(rb(0.6, 0.9, 0.9, 0.05), 'wIron', { p: [1.85, 3.35, -1.4], c: iC });
    for (const sx of [-1, 1]) icicles(b, [sx * 1.86, 1.35, -2.6], [sx * 1.86, 1.35, 2.6], 8, 0.3);
    bolts(b, 'wBrass', [-1.86, 2.45, -2.6], [-1.86, 2.45, 2.6], 10, 0.05, 'x', tC);
    bolts(b, 'wBrass', [1.86, 2.45, -2.6], [1.86, 2.45, 2.6], 10, 0.05, 'x', tC);
    frost(b, 0, 2.83, 2.0, 3.2, 1.4, 8, 0.1);
  }, 2620));
  // the spindle: a tall shaft out of the tower top with a square cap; it carries the weights' arms and the sliding collar
  const spin = pivot(body, 0, TOP + 0.6, -0.2);
  spin.add(part((b) => {
    b.add(cyl(0.16, 0.16, 2.6, 10), 'wIron', { p: [0, 1.3, 0], c: '#7a7e84' });
    b.add(rb(0.7, 0.4, 0.7, 0.05), 'wBronze', { p: [0, 2.7, 0], c: bC }); // the head block the arms hang from
    b.add(rb(0.5, 0.2, 0.5, 0.03), 'wIron', { p: [0, 2.98, 0], c: iC });
    frost(b, 0, 3.1, 0, 0.4, 0.4, 3, 0.07);
  }, 2621));
  // two arms hinged at the head block, each with a square brass weight at its end; they fly out as the spindle races
  const arms = [-1, 1].map((sx, i) => {
    const arm = pivot(spin, sx * 0.36, 2.6, 0);
    arm.add(part((b) => {
      b.add(rb(0.14, 1.9, 0.14, 0.02), 'wIron', { p: [0, -0.95, 0], c: iC });
      b.add(rb(0.62, 0.62, 0.62, 0.06), 'wBrass', { p: [0, -2.0, 0], c: wear(TRIM, 0.3, 40 + i) });
      b.add(rb(0.7, 0.1, 0.7, 0.02), 'wBronze', { p: [0, -1.68, 0], c: bC });
      frost(b, 0, -1.67, 0, 0.5, 0.5, 3, 0.06);
    }, 2622 + i));
    arm.userData.sx = sx;
    return arm;
  });
  // the sliding sleeve on the spindle (it rides up as the weights fly out)
  const collar = pivot(spin, 0, 0.9, 0);
  collar.add(part((b) => { b.add(rb(0.4, 0.8, 0.4, 0.04), 'wBronze', { c: bC }); }, 2624)); // a tall sleeve, narrower than it is high (never a crossbar on the spindle)
  // the flywheel on the right flank and the throttle lever on the left
  const fly = pivot(body, 2.35, 3.35, -1.4);
  fly.add(part((b) => b.addBuilder(flywheel(1.1, 0.26, { c: '#4a4440', seed: 2625 })), 2625));
  const lever = pivot(body, -1.6, 3.9, 1.6);
  lever.add(part((b) => { b.add(rb(0.14, 2.0, 0.14, 0.02), 'wIron', { p: [0, 1.0, 0], c: iC }); b.add(rb(0.3, 0.3, 0.3, 0.03), 'wBrass', { p: [0, 2.0, 0], c: tC }); }, 2626));
  const s1 = spray(2.0, 0.6, 1.0, 0.34); s1.position.set(0, 3.0, -3.6); body.add(s1);
  const blast = spray(0, 1.5, 1.2, 0.5); blast.position.set(0, TOP + 1.0, -0.2); body.add(blast);
  const glow = slotGlow(0x7ac8ff, 0.16, 1.3, 0.3, { ry: PI / 2 }); glow.position.set(1.4, 4.3, 0.4); body.add(glow);
  const a = new Anim(root, { base, body, wheels: TR.wheels, spin, arms, collar, fly, lever });
  a.dynamics.push(s1, blast, glow);
  let w = 2, fling = 0.35;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    const setArms = (f) => { for (const arm of p.arms) arm.rotation.z = arm.userData.sx * f; p.collar.position.y = 0.9 + (f - 0.25) * 1.1; };
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 2.2), e = 1 - Math.pow(1 - k, 2);
      w *= Math.max(0, 1 - dt * 1.2); p.spin.rotation.y += w * dt; setArms(0.35 * (1 - e) + 0.05);
      p.body.rotation.z = 0.06 * e; p.body.rotation.x = -0.04 * e; p.body.position.y = -0.25 * e;
      s1.visible = false; blast.userData.rate = 0; glow.material.opacity = 0.3 * (1 - k);
      for (const d of this.dynamics) d.userData.update?.(dt, this.t);
      return;
    }
    s1.visible = true;
    const ts = drive(this, p, TR, dt, speed, 0.68);
    const at = this.stepAttack(dt);
    // the spindle runs with the engine; an attack races it, the weights fly right out and the spray bursts off the tower
    const wt = (2.2 + this.speed * 0.9 + (at >= 0 ? 7 * Math.sin(at * PI) : 0)) * ts;
    w += (wt - w) * Math.min(1, dt * 3);
    p.spin.rotation.y += w * dt;
    fling += (Math.min(1.05, 0.25 + w * 0.08) - fling) * Math.min(1, dt * 4);
    setArms(fling);
    p.fly.rotation.x += (1.0 + w * 0.3) * dt;
    p.lever.rotation.x = -0.15 - fling * 0.4;
    blast.userData.rate = at >= 0.4 && at < 0.75 ? 26 : 0;
    p.body.position.y = Math.abs(Math.sin(this.t * 2.5)) * 0.03 * Math.min(1, this.speed);
    glow.material.opacity = 0.25 + 0.1 * Math.sin(this.t * 3.3);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z = Math.sin(this.t * 25) * this.hitT * 0.014; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  return finish(root, a, 9.4);
}

// ==========================================================================
// THE GREAT DAM'S HEART (about 15 m tall, 17 m wide; faces +z, its back against the north wall)
// ==========================================================================
export function buildDamHeart() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const stC = grime('#949ca2', 0.0, 8.0, 0.28, 41), st2C = wear('#7a8288', 0.3, 42), bC = wear(BRZ, 0.3, 43), iC = wear(IRON, 0.25, 44), tC = wear(TRIM, 0.3, 45);
  const body = pivot(base, 0, 0, 0);
  const GW = 10.4, GH = 8.6, GZ = 2.2; // the master gate's opening: width, height, and the front face of the piers
  body.add(part((b) => {
    // the stepped stone plinth, its front step running out under the gate's sill
    b.add(rb(17.4, 0.6, 10.6, 0.06), 'stoneCold', { p: [0, 0.3, -1.0], c: st2C, uv: 'box', us: 0.4 });
    b.add(rb(16.4, 0.6, 9.6, 0.06), 'stoneCold', { p: [0, 0.9, -1.4], c: stC, uv: 'box', us: 0.4 });
    b.add(rb(GW + 1.2, 0.5, 1.6, 0.05), 'stoneCold', { p: [0, 1.0, GZ + 0.4], c: st2C, uv: 'box', us: 0.4 }); // the sill
    // the heart chamber behind the gate: a great square stone block, banded in blackened bronze
    b.add(rb(14.0, 11.0, 6.4, 0.12), 'stoneCold', { p: [0, 6.7, -2.6], c: stC, uv: 'box', us: 0.32 });
    const band = (y, w, d, cz, t = 0.2) => { for (const s of [-1, 1]) { b.add(box(w, 0.26, t), 'wBronze', { p: [0, y, cz + s * (d / 2 - t / 2)], c: bC }); b.add(box(t, 0.26, d - 2 * t), 'wBronze', { p: [s * (w / 2 - t / 2), y, cz], c: bC }); } };
    for (const y of [3.2, 7.4, 11.4]) band(y, 14.2, 6.6, -2.6);
    b.add(rb(14.6, 0.5, 7.0, 0.05), 'wIron', { p: [0, 12.4, -2.6], c: iC });
    b.add(rb(13.6, 0.5, 6.0, 0.05), 'stoneCold', { p: [0, 12.9, -2.6], c: st2C, uv: 'box', us: 0.4 });
    frost(b, 0, 13.18, -2.6, 13.0, 5.6, 30, 0.18);
    // the three square penstock intakes into the chamber's back, running on into the wall behind
    for (const x of [-4.4, 0, 4.4]) {
      b.add(rb(2.2, 2.2, 4.0, 0.08), 'wBronze', { p: [x, 5.0, -7.6], c: grime(BRZ, 3.8, 6.2, 0.3, 50 + x) });
      for (const z of [-6.2, -8.4]) b.add(rb(2.5, 2.5, 0.3, 0.04), 'wIron', { p: [x, 5.0, z], c: iC });
      b.add(rb(2.4, 0.9, 2.0, 0.05), 'stoneCold', { p: [x, 3.45, -7.0], c: st2C, uv: 'box', us: 0.4 });
      frost(b, x, 6.12, -7.6, 1.9, 3.6, 6, 0.12);
    }
    // the two great piers either side of the gate, square, stepped at the foot, banded, with flat caps
    for (const sx of [-1, 1]) {
      const x = sx * (GW / 2 + 1.5);
      b.add(rb(3.0, 1.2, 3.6, 0.06), 'stoneCold', { p: [x, 1.6, GZ - 0.8], c: st2C, uv: 'box', us: 0.4 });
      b.add(rb(2.6, 12.2, 3.0, 0.08), 'stoneCold', { p: [x, 7.2, GZ - 0.8], c: stC, uv: 'box', us: 0.32 });
      for (const y of [4.0, 8.0]) b.add(rb(2.8, 0.22, 3.2, 0.03), 'wBronze', { p: [x, y, GZ - 0.8], c: bC });
      b.add(rb(3.2, 0.4, 3.6, 0.04), 'wIron', { p: [x, 13.5, GZ - 0.8], c: iC });
      frost(b, x, 13.72, GZ - 0.8, 2.8, 3.2, 10, 0.14);
      // the gate's guide channel up the pier's inner face
      b.add(rb(0.5, GH + 1.4, 0.7, 0.04), 'wIron', { p: [sx * (GW / 2 + 0.05), 1.2 + (GH + 1.4) / 2, GZ - 0.2], c: iC });
      icicles(b, [x - 1.2, 13.28, GZ + 0.85], [x + 1.2, 13.28, GZ + 0.85], 5, 0.5);
    }
    // the flat lintel across the piers, its bronze-banded face, icicles off its foot
    b.add(rb(GW + 6.4, 1.6, 3.4, 0.08), 'stoneCold', { p: [0, GH + 2.7, GZ - 0.6], c: stC, uv: 'box', us: 0.32 });
    b.add(box(GW + 6.5, 0.24, 3.5), 'wBronze', { p: [0, GH + 2.0, GZ - 0.6], c: bC });
    bolts(b, 'wBrass', [-GW / 2 - 2.6, GH + 3.2, GZ + 1.16], [GW / 2 + 2.6, GH + 3.2, GZ + 1.16], 16, 0.07, 'z', tC);
    icicles(b, [-GW / 2, GH + 1.86, GZ + 1.0], [GW / 2, GH + 1.86, GZ + 1.0], 18, 0.6, 0.09);
    // the winding house on the lintel: a square stone house with a flat roof, the drum's bearings either side of it
    b.add(rb(5.0, 2.6, 2.8, 0.08), 'stoneCold', { p: [0, GH + 4.8, GZ - 1.0], c: st2C, uv: 'box', us: 0.4 });
    b.add(rb(5.6, 0.3, 3.4, 0.04), 'wIron', { p: [0, GH + 6.25, GZ - 1.0], c: iC });
    b.add(rb(5.2, 0.3, 3.0, 0.15), 'wPaint', { p: [0, GH + 6.5, GZ - 1.0], c: wear(FROST, 0.1, 60) });
    for (const sx of [-1, 1]) b.add(rb(0.7, 1.2, 0.9, 0.05), 'wIron', { p: [sx * 3.2, GH + 4.3, GZ + 0.4], c: iC });
    // the surge tank on the left behind the lintel: a square riveted tank with a flat lid
    b.add(rb(3.0, 3.6, 3.0, 0.1), 'wBronze', { p: [-4.8, 14.9, -3.4], c: bC });
    for (const y of [13.9, 15.6]) b.add(rb(3.1, 0.12, 3.1, 0.02), 'wIron', { p: [-4.8, y, -3.4], c: iC });
    b.add(rb(3.3, 0.2, 3.3, 0.03), 'wPaint', { p: [-4.8, 16.8, -3.4], c: st2C });
    frost(b, -4.8, 16.92, -3.4, 2.8, 2.8, 8, 0.12);
    // the depth gauge board on the right pier's face: marks down one side only, the lake line glowing on it
    const gx = GW / 2 + 1.5;
    b.add(rb(0.9, 6.4, 0.14, 0.02), 'wWood', { p: [gx, 6.0, GZ + 0.78], c: wear(WOOD, 0.3, 61) });
    for (let i = 0; i < 12; i++) b.add(box(i % 3 ? 0.24 : 0.44, 0.06, 0.05), 'wIron', { p: [gx - 0.33 + (i % 3 ? 0 : 0.1), 3.2 + i * 0.5, GZ + 0.87], c: '#2a2e32' });
    b.add(box(0.7, 0.06, 0.04), 'wGlowBlue', { p: [gx, 8.3, GZ + 0.88] });
    // the counterweight's sheave block on the right of the lintel
    b.add(rb(1.0, 0.8, 1.0, 0.05), 'wIron', { p: [gx + 0.4, GH + 3.9, GZ + 0.7], c: iC });
    // ice spilt along the plinth's foot, frozen spray on the chamber's face either side
    for (const sx of [-1, 1]) iceHeap(b, sx * 7.2, 1.2, GZ + 0.6, 2.0, 1.4, 5, 0.34);
    for (let i = 0; i < 6; i++) b.add(box(b.r(0.6, 1.4), b.r(1.0, 2.6), 0.1), 'wPaint', { p: [b.r(-5.5, 5.5), b.r(9.6, 11.0), 0.62], c: ICE });
  }, 2720));
  // the master gate: horizontal planks and horizontal iron ribs, never an upright down the middle, water jetting through the
  // seams; it rides in the guides and heaves when the Heart strikes
  const gate = pivot(body, 0, 1.25, GZ - 0.2);
  gate.add(part((b) => {
    b.add(rb(GW - 0.2, GH, 0.4, 0.05), 'wBronze', { p: [0, GH / 2, 0], c: grime(BRZ, 0, GH, 0.35, 70) });
    for (let i = 0; i < 10; i++) b.add(rb(GW - 0.4, 0.74, 0.14, 0.02), 'wWood', { p: [0, 0.45 + i * 0.83, 0.26], c: wear(WOOD, 0.35, 71 + i) });
    for (const y of [0.15, 2.6, 5.4, GH - 0.15]) b.add(rb(GW, 0.24, 0.5, 0.03), 'wIron', { p: [0, y, 0.12], c: iC });
    for (const y of [0.15, 2.6, 5.4, GH - 0.15]) bolts(b, 'wBrass', [-GW / 2 + 0.4, y, 0.4], [GW / 2 - 0.4, y, 0.4], 12, 0.06, 'z', tC);
    // the seams: bright water lines between some of the planks, uneven along the gate
    for (const [x, y, w] of [[-2.2, 0.87, 4.2], [2.6, 1.7, 3.4], [-0.8, 3.36, 5.6], [3.0, 4.2, 2.6], [-3.2, 6.7, 2.8], [1.4, 7.5, 3.2]]) b.add(box(w, 0.05, 0.04), 'wGlowBlue', { p: [x, y, 0.34] });
    // ice sheeted down the gate's face, icicles off its ribs
    for (const [x, y, w, h] of [[-4.7, 1.3, 0.5, 1.4], [4.6, 3.4, 0.4, 1.0], [-0.6, 6.6, 0.45, 1.0]]) b.add(box(w, h, 0.06), 'wPaint', { p: [x, y, 0.4], c: ICE }); // a few thin runs of ice down the planks, each clear of the seams and ribs (nothing crossing)
    icicles(b, [-GW / 2 + 0.5, 2.48, 0.4], [GW / 2 - 0.5, 2.48, 0.4], 12, 0.36);
    icicles(b, [-GW / 2 + 0.5, 5.28, 0.4], [GW / 2 - 0.5, 5.28, 0.4], 12, 0.36);
    for (const sx of [-2.6, 2.6]) b.add(cyl(0.08, 0.08, 4.0, 6), 'wIron', { p: [sx, GH + 2.0, -0.1], c: '#3a3e44' }); // the chains up to the drum
  }, 2721));
  // the winding drum across the front of the winding house, turning as the gate moves
  const drum = pivot(body, 0, GH + 4.3, GZ + 0.4);
  drum.add(part((b) => {
    b.add(cyl(0.6, 0.6, 5.6, 20), 'wIron', { r: [0, 0, PI / 2], c: iC });
    for (const x of [-2.6, -0.9, 0.9, 2.6]) b.add(cyl(0.7, 0.7, 0.12, 20), 'wBronze', { p: [x, 0, 0], r: [0, 0, PI / 2], c: bC });
    b.add(rb(0.4, 0.16, 0.3, 0.02), 'wBrass', { p: [1.8, 0.62, 0], c: tC });
  }, 2722));
  // a solid gate wheel on the outer face of each pier (on the flanks, never side by side on the front)
  const wheels = [-1, 1].map((sx, i) => {
    const wv = pivot(body, sx * (GW / 2 + 3.25), 6.0, GZ - 0.8);
    wv.add(part((b) => gateWheel(b, 1.9, 0.34, { n: 14 }), 2723 + i));
    return wv;
  });
  // the counterweight on the right: a square block on a chain from the sheave, riding opposite to the gate
  const weight = pivot(body, GW / 2 + 1.9, GH + 1.6, GZ + 0.7);
  weight.add(part((b) => {
    b.add(cyl(0.06, 0.06, 2.6, 6), 'wIron', { p: [0, 1.3, 0], c: '#3a3e44' });
    b.add(rb(1.1, 1.6, 1.1, 0.06), 'wIron', { p: [0, -0.4, 0], c: grime(IRON, -1.2, 0.4, 0.35, 80) });
    b.add(rb(1.2, 0.12, 1.2, 0.02), 'wBronze', { p: [0, 0.3, 0], c: bC });
    frost(b, 0, 0.42, 0, 0.9, 0.9, 3, 0.08);
  }, 2725));
  // the water: sprays along the gate's foot and seams, a jet from under the gate when it heaves, a cool glow on the floor
  const sprays = [[-3.4, 1.4], [0.2, 2.2], [3.6, 1.6], [-1.8, 4.6], [2.4, 6.0]].map(([x, y], i) => { const s = spray(1.8, 0.8, 0.9, 0.36); s.position.set(x, y, GZ + 0.6); body.add(s); return s; });
  const surge = spray(0, 2.4, 1.0, 0.55); surge.position.set(0, 1.4, GZ + 1.6); body.add(surge);
  const glow = slotGlow(0x7ac8ff, GW + 1.0, 3.0, 0.2, { rx: -PI / 2 }); glow.position.set(0, 1.3, GZ + 1.4); body.add(glow);
  const top = slotGlow(0x8ad0ff, GW - 1.0, 1.4, 0.25); top.position.set(0, 7.0, GZ + 0.55); body.add(top);
  const a = new Anim(root, { base, body, gate, drum, wheels, weight });
  a.dynamics.push(...sprays, surge, glow, top);
  let gy = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      // a dam does not fall: the gate settles home in its guides, the sprays thin out, the water stills
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 3.0);
      gy += (-0.15 - gy) * Math.min(1, dt * 2); p.gate.position.y = 1.25 + gy;
      for (const s of sprays) s.userData.rate = 1.8 * (1 - k);
      surge.userData.rate = 0; glow.material.opacity = 0.2 * (1 - k * 0.8); top.material.opacity = 0.25 * (1 - k);
      for (const d of this.dynamics) d.userData.update?.(dt, this.t);
      return;
    }
    for (const s of sprays) s.userData.rate = 1.8;
    // the gate never rests: it shudders in its guides against the lake behind it
    const at = this.stepAttack(dt);
    const heave = at >= 0 ? Math.sin(at * PI) : 0;
    const target = heave * 0.9 + Math.sin(this.t * 1.7) * 0.04 + Math.sin(this.t * 7.3) * 0.015;
    const prev = gy;
    gy += (target - gy) * Math.min(1, dt * 6);
    p.gate.position.y = 1.25 + gy;
    p.drum.rotation.x -= (gy - prev) / 0.6;
    p.weight.position.y = GH + 1.6 - gy * 0.8;
    for (const wv of p.wheels) wv.rotation.x += (0.08 + heave * 0.8) * dt;
    surge.userData.rate = heave > 0.2 ? 34 * heave : 0;
    glow.material.opacity = 0.18 + 0.04 * Math.sin(this.t * 2.3) + heave * 0.3; // a floor wash, kept low: from above it is a wide flat plane
    top.material.opacity = 0.22 + 0.06 * Math.sin(this.t * 3.1);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.position.x = Math.sin(this.t * 22) * this.hitT * 0.03; } else p.body.position.x = 0;
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  return finish(root, a, 15.5);
}
