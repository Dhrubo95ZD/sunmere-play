// The Pump Works (Part Twelve, level 55 dungeon in the shafts under the Engine Rows on the Windward Heights): three machine
// bosses of weathered grey iron, black timber and old brass, rimed with frost, steam and meltwater leaking out of them.
//  - The Rod Engine: the walking engine that drove the pump rods in the Rod Hall. A plated hull on treads carrying a tall
//    square rod frame (two square posts and a flat head beam), a heavy square pump rod sliding up and down through its
//    guides (it drives the rod down to strike), a square steam chest behind with one sight gauge, and a solid flywheel with
//    lugs round its rim on its right flank.
//  - The Cistern Warden: the tank engine that kept the cisterns level. A great square riveted cistern on wide treads, its
//    meltwater surface open on top inside a frosted kerb, a square relief-valve stack on its back corner, a square pump
//    block low at the front with one outlet, a looping delivery pipe down its left side and a solid valve wheel on its right.
//  - The Great Pump (the last boss): a vast beam-engine pump. A heavy engine bed on wide treads; a tall square bob wall of
//    grey plate in the middle; the great beam, a long flat girder, rocking on top of it; at the front end the pump rod down
//    into a square pump barrel, meltwater spouting from its collar; at the back end the piston rod into a square-jacketed
//    steam cylinder; a big solid flywheel with lugs on the right of the bed.
// Same interface as the other machines: userData.machine = { update(dt, speed), attack(dur, kind), hit(), die(), revive(), stun }.
// Content rules: no faces (one gauge or one outlet, never a pair of lamps over a grille), nothing animal-like (treads, never
// legs), no spokes (wheels are solid discs with lugs on the rim and an off-centre bolt plate), no domes, rings, stars or
// radiating patterns, no crosses (straps and ribs run one way only); everything square from above.
import * as THREE from 'three';
import { box, rbox, cyl, ico, cone } from './kit.js';
import { plate, sleeve, heroTreads, crawl, wear, grime, bolts, bdisc, flywheel } from './bossParts.js';
import { smoke, glowSprite } from './dynamic.js';
import { slotGlow } from './slotGlow.js';
import { Anim, finish, part, pivot } from './quarryMachines.js';
import { wearModel, MOTION } from './tripoModels.js';

const PI = Math.PI;
const rb = (w, h, d, r) => rbox(w, h, d, r, 1);
const pl = (w, h, d, o = {}) => plate(w, h, d, { br: Math.max(0.035, Math.min(0.07, Math.min(w, h) * 0.05)), ...o });
// weathered grey iron, its darker plate, black timber, old brass, dark iron, frost and ice
const IRONG = '#7e8488', IRONG2 = '#62686c', TIMB = '#4e3e30', BRASS = '#9a7a48', DARK = '#3e4246', FROST = '#eef5fa', ICE = '#cfe6f4';

// frost crust: flattened pale lumps over a top face
function frost(b, cx, y, cz, w, d, n, s = 0.1) {
  for (let i = 0; i < n; i++) b.add(ico(s * b.r(0.6, 1.1), 0), 'wPaint', { p: [cx + b.r(-w / 2, w / 2), y, cz + b.r(-d / 2, d / 2)], s: [1.6, 0.36, 1.3], r: [0, b.r(0, 3), 0], c: wear(FROST, 0.12, i) });
}
// icicles hanging off a lower edge from a to z
function icicles(b, a, z, n, len) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1), l = len * b.r(0.4, 1.1);
    b.add(cone(len * 0.2, l, 5), 'wPaint', { p: [a[0] + (z[0] - a[0]) * t, a[1] + (z[1] - a[1]) * t - l / 2, a[2] + (z[2] - a[2]) * t], r: [PI, b.r(0, 3), 0], c: ICE });
  }
}
// one sight-gauge strip: a lit glass in a dark frame (always single, never a pair)
function gauge(b, p, h, ry = 0) {
  b.add(rb(0.14, h + 0.1, 0.07, 0.02), 'wDark', { p, r: [0, ry, 0], c: '#2e3236' });
  b.add(box(0.06, h, 0.03), 'wWet', { p: [p[0] + Math.sin(ry) * 0.03, p[1], p[2] + Math.cos(ry) * 0.03], r: [0, ry, 0] });
}
// a solid wheel on the x axis with square lugs round the rim and an off-centre bolt plate. Never spoked.
function lugWheel(b, r, w, o = {}) {
  const { c = wear(DARK, 0.3, 7), n = 12, lugC = BRASS } = o;
  b.add(bdisc(r, w, Math.min(r * 0.08, w * 0.3), 30), 'wIron', { r: [0, 0, PI / 2], c });
  // a square axle nut (a raised inner disc and a round hub read as a disc in a ring, an eye, from the side)
  b.add(rb(w * 1.6, r * 0.3, r * 0.3, Math.min(r * 0.03, w * 0.08)), 'wBrass', { c: BRASS });
  for (const sx of [-1, 1]) b.add(rb(w * 0.2, r * 0.32, r * 0.22, Math.min(r * 0.03, w * 0.06)), 'wBrass', { p: [sx * w * 0.7, r * 0.4, 0], c: BRASS });
  const bd = r * 0.16, bt = Math.min(r * 0.26, (2 * PI * r / n) * 0.4);
  for (let i = 0; i < n; i++) { const a = (i / n) * PI * 2, R = r + bd * 0.3; b.add(rb(w * 1.1, bd, bt, Math.min(0.03, bt * 0.2)), 'wBrass', { p: [0, Math.cos(a) * R, Math.sin(a) * R], r: [a, 0, 0], c: lugC }); }
}
const steam = (rate = 3, size = 0.8, rise = 1.4, opacity = 0.42) => smoke({ rate, life: 1.8, size, rise, color: 0xeef4f8, opacity, spread: 0.3 });
const spray = (rate = 3, size = 0.7, rise = 1.0, opacity = 0.4) => smoke({ rate, life: 1.4, size, rise, color: 0xdcecf6, opacity, spread: 0.35 });

// ==========================================================================
// THE ROD ENGINE (about 7.6 m tall, 6.4 m long)
// ==========================================================================
export function buildRodEngine() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 3.9, len: 6.2, h: 1.4, tw: 0.9, paint: 'wPaint', paintC: IRONG2, linkC: '#555a60', road: 2, seed: 2410 });
  const body = pivot(base, 0, 0, 0);
  const hC = grime(IRONG, 1.2, 3.2, 0.3, 1), h2C = wear(IRONG2, 0.3, 2), tC = wear(TIMB, 0.3, 3), iC = wear(DARK, 0.25, 4), bC = wear(BRASS, 0.3, 5);
  const P = (w, h, d, seed, o = {}) => pl(w, h, d, { mat: 'wPaint', c: hC, c2: h2C, trim: 'wIron', trimC: iC, boltMat: 'wBrass', boltC: bC, seed, ...o });
  body.add(part((b) => {
    // the hull: a plated block over the treads, a timber-planked deck with an iron lip
    b.add(rb(3.3, 1.6, 5.8, 0.12), 'wPaint', { p: [0, 2.0, -0.1], c: hC });
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) b.addBuilder(P(1.8, 1.0, 0.12, 2411 + i), { p: [sx * 1.7, 2.05, -2.0 + i * 1.9], r: [0, sx * PI / 2, 0] });
    for (let i = 0; i < 7; i++) b.add(rb(3.4, 0.12, 0.78, 0.02), 'wWood', { p: [0, 2.86, -2.8 + i * 0.86], c: wear(TIMB, 0.35, 10 + i) });
    for (const sx of [-1, 1]) b.add(rb(0.12, 0.2, 6.0, 0.02), 'wIron', { p: [sx * 1.72, 2.94, -0.1], c: iC });
    b.addBuilder(P(3.0, 1.2, 0.14, 2415, { inset: false }), { p: [0, 2.0, 2.82] });
    b.add(rb(3.2, 0.22, 0.4, 0.05), 'wIron', { p: [0, 1.25, 3.0], c: iC });
    // the rod frame at the front: two square timber posts shod in iron, a flat iron head beam, the rod guides
    for (const sx of [-1, 1]) {
      b.add(rb(0.55, 4.6, 0.55, 0.04), 'wWood', { p: [sx * 1.3, 5.2, 1.8], c: wear(TIMB, 0.3, 20 + sx) });
      for (const y of [3.4, 5.0, 6.6]) b.add(rb(0.64, 0.12, 0.64, 0.02), 'wIron', { p: [sx * 1.3, y, 1.8], c: iC });
      b.add(rb(0.7, 0.5, 0.7, 0.05), 'wIron', { p: [sx * 1.3, 3.15, 1.8], c: iC });
    }
    b.add(rb(3.4, 0.5, 0.8, 0.06), 'wPaint', { p: [0, 7.6, 1.8], c: hC });
    b.add(rb(3.5, 0.1, 0.9, 0.02), 'wIron', { p: [0, 7.9, 1.8], c: iC });
    for (const y of [4.0, 6.0]) b.add(rb(2.1, 0.22, 0.5, 0.03), 'wIron', { p: [0, y, 1.8], c: iC }); // the rod guides, one over the other
    frost(b, 0, 7.96, 1.8, 3.1, 0.6, 10, 0.12);
    icicles(b, [-1.5, 7.35, 2.22], [1.5, 7.35, 2.22], 8, 0.3);
    // the steam chest behind: a square riveted box, a flat lid, one sight gauge, one square exhaust stack on the left corner
    b.add(rb(2.6, 1.8, 2.0, 0.08), 'wIron', { p: [0, 3.8, -1.9], c: iC });
    for (const y of [3.2, 4.4]) b.add(rb(2.7, 0.1, 2.1, 0.02), 'wBrass', { p: [0, y, -1.9], c: bC });
    b.add(rb(2.8, 0.14, 2.2, 0.03), 'wPaint', { p: [0, 4.75, -1.9], c: h2C });
    gauge(b, [1.32, 3.8, -2.2], 1.1, PI / 2);
    b.add(rb(0.6, 1.6, 0.6, 0.05), 'wIron', { p: [-0.8, 5.6, -2.5], c: iC });
    b.add(rb(0.76, 0.14, 0.76, 0.02), 'wBrass', { p: [-0.8, 6.4, -2.5], c: bC });
    frost(b, 0.3, 4.85, -1.9, 2.0, 1.8, 10, 0.12);
    // the steam pipe from the chest forward to the rod frame, flanged
    b.add(cyl(0.16, 0.16, 3.2, 10), 'wIron', { p: [0.9, 4.9, 0.0], r: [PI / 2, 0, 0], c: iC });
    for (const z of [-1.2, 0.2, 1.4]) b.add(cyl(0.24, 0.24, 0.1, 10), 'wBrass', { p: [0.9, 4.9, z], r: [PI / 2, 0, 0], c: bC });
    b.add(rb(0.6, 0.9, 0.9, 0.05), 'wIron', { p: [1.7, 3.5, -0.4], c: iC }); // the flywheel bearing
    for (const sx of [-1, 1]) icicles(b, [sx * 1.78, 1.45, -2.9], [sx * 1.78, 1.45, 2.6], 9, 0.3);
    bolts(b, 'wBrass', [-1.8, 2.6, -2.9], [-1.8, 2.6, 2.6], 12, 0.05, 'x', bC);
    bolts(b, 'wBrass', [1.8, 2.6, -2.9], [1.8, 2.6, 2.6], 12, 0.05, 'x', bC);
  }, 2420));
  // the pump rod: a heavy square iron rod with a square crosshead block and a square plunger foot, sliding in its guides
  const rod = pivot(body, 0, 5.0, 1.8);
  rod.add(part((b) => {
    b.add(rb(0.44, 6.2, 0.44, 0.04), 'wIron', { p: [0, 0, 0], c: wear('#5a5e62', 0.3, 30) });
    b.add(rb(1.2, 0.5, 0.6, 0.05), 'wBrass', { p: [0, 2.9, 0], c: bC }); // the crosshead, under the head beam
    b.add(rb(0.9, 0.7, 0.9, 0.05), 'wIron', { p: [0, -3.0, 0], c: iC }); // the plunger foot
    for (const y of [-1.8, -0.4, 1.0]) b.add(rb(0.52, 0.1, 0.52, 0.02), 'wBrass', { p: [0, y, 0], c: bC });
    b.add(box(0.04, 3.6, 0.03), 'wWet', { p: [0.23, -0.6, 0.23] }); // wet down one edge, so the stroke shows
    icicles(b, [-0.35, -3.36, 0], [0.35, -3.36, 0], 3, 0.26);
  }, 2421));
  // the flywheel on the right flank
  const fly = pivot(body, 2.15, 3.5, -0.4);
  fly.add(part((b) => b.addBuilder(flywheel(1.0, 0.26, { c: '#4a4c50', seed: 2424 })), 2424));
  const s1 = steam(3, 0.8, 1.6, 0.42); s1.position.set(-0.8, 6.6, -2.5); body.add(s1);
  const s2 = spray(3, 0.6, 0.8, 0.36); s2.position.set(0, 1.4, 2.2); body.add(s2);
  const glow = slotGlow(0x7ac8ff, 3.1, 0.5, 0.4, { rx: -PI / 2 }); glow.position.set(0, 1.39, 3.0); body.add(glow);
  const a = new Anim(root, { base, body, wheels: TR.wheels, rod, fly });
  a.dynamics.push(s1, s2, glow);
  let dist = 0, ry = 0, ph = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.8), e = 1 - Math.pow(1 - k, 2);
      p.rod.position.y = 5.0 - 1.0 * e; p.body.rotation.z = 0.06 * e; p.body.rotation.x = -0.04 * e; p.body.position.y = -0.25 * e;
      s1.visible = s2.visible = false; glow.material.opacity = 0.4 * (1 - k);
      for (const d of this.dynamics) d.userData.update?.(dt, this.t);
      return;
    }
    s1.visible = s2.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.7) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    // the rod strokes steadily with the flywheel; on an attack it is drawn right up, then driven down hard
    ph += dt * ts * 1.6;
    const at = this.stepAttack(dt);
    let target = Math.sin(ph) * 0.45;
    if (at >= 0) target = at < 0.5 ? 0.45 + (at / 0.5) * 0.9 : at < 0.6 ? 1.35 - 2.1 * ((at - 0.5) / 0.1) : -0.75 + 0.75 * ((at - 0.6) / 0.4);
    ry += (target - ry) * Math.min(1, dt * (at >= 0.5 && at < 0.6 ? 30 : 8));
    p.rod.position.y = 5.0 + ry;
    p.fly.rotation.x += 1.6 * dt * ts + (at >= 0 ? dt * 2 : 0);
    p.body.position.y = Math.abs(Math.sin(this.t * 2.6)) * 0.03 * Math.min(1, this.speed);
    glow.material.opacity = 0.32 + 0.1 * Math.sin(this.t * 3.1);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z = Math.sin(this.t * 25) * this.hitT * 0.015; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  return finish(root, a, 8.2);
}

// ==========================================================================
// THE CISTERN WARDEN (about 6.4 m tall, 6.8 m long)
// ==========================================================================
export function buildCisternWarden() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 4.8, len: 5.8, h: 1.3, tw: 1.0, paint: 'wPaint', paintC: IRONG2, linkC: '#555a60', road: 2, seed: 2510 });
  const body = pivot(base, 0, 0, 0);
  const hC = grime(IRONG, 1.2, 5.2, 0.3, 11), h2C = wear(IRONG2, 0.3, 12), iC = wear(DARK, 0.25, 14), bC = wear(BRASS, 0.3, 15), tC = wear(TIMB, 0.3, 16);
  const P = (w, h, d, seed, o = {}) => pl(w, h, d, { mat: 'wPaint', c: hC, c2: h2C, trim: 'wIron', trimC: iC, boltMat: 'wBrass', boltC: bC, seed, ...o });
  body.add(part((b) => {
    // the bed over the treads
    b.add(rb(4.0, 0.9, 5.6, 0.1), 'wIron', { p: [0, 1.75, 0], c: iC });
    // the cistern: a great square riveted tank, plated in two courses on every side, iron bands round it (one way only)
    b.add(rb(4.2, 3.2, 4.6, 0.14), 'wPaint', { p: [0, 3.8, -0.3], c: hC });
    for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) b.addBuilder(P(2.1, 1.45, 0.12, 2511 + i * 2 + j), { p: [sx * 2.12, 3.05 + j * 1.5, -1.4 + i * 2.2], r: [0, sx * PI / 2, 0] });
    for (let j = 0; j < 2; j++) b.addBuilder(P(3.8, 1.45, 0.12, 2516 + j, { inset: false }), { p: [0, 3.05 + j * 1.5, -2.62] });
    for (const y of [2.3, 3.8, 5.3]) b.add(rb(4.35, 0.14, 4.75, 0.03), 'wIron', { p: [0, y, -0.3], c: iC });
    // its open top: a frosted kerb round a sheet of meltwater (square from above)
    for (const [x, z, w, d] of [[0, -2.5, 4.3, 0.3], [0, 1.9, 4.3, 0.3], [-2.0, -0.3, 0.3, 4.6], [2.0, -0.3, 0.3, 4.6]]) b.add(rb(w, 0.3, d, 0.04), 'wPaint', { p: [x, 5.5, z], c: h2C });
    b.add(box(3.7, 0.04, 4.1), 'wWet', { p: [0, 5.3, -0.3] });
    for (let i = 0; i < 6; i++) b.add(ico(b.r(0.25, 0.45), 0), 'iceBlue', { p: [b.r(-1.5, 1.5), 5.34, b.r(-2.0, 1.4)], s: [1.8, 0.2, 1.4], r: [0, b.r(0, 3), 0], c: wear(ICE, 0.1, i) });
    for (const [x, z, w, d] of [[0, -2.5, 4.0, 0.3], [0, 1.9, 4.0, 0.3], [-2.0, -0.3, 0.3, 4.4], [2.0, -0.3, 0.3, 4.4]]) frost(b, x, 5.67, z, w, d, 6, 0.09);
    icicles(b, [-2.1, 5.3, 1.96], [2.1, 5.3, 1.96], 9, 0.34);
    for (const sx of [-1, 1]) icicles(b, [sx * 2.2, 2.2, -2.4], [sx * 2.2, 2.2, 1.8], 8, 0.3);
    // the pump block low at the front: a square iron housing with one square outlet pouring into a trough lip
    b.add(rb(2.6, 1.4, 1.2, 0.08), 'wIron', { p: [0, 2.7, 2.5], c: iC });
    b.add(rb(2.7, 0.14, 1.3, 0.03), 'wBrass', { p: [0, 3.45, 2.5], c: bC });
    b.add(rb(1.0, 0.7, 0.2, 0.04), 'wDark', { p: [0, 2.6, 3.12], c: '#14181c' });
    b.add(rb(1.4, 0.14, 0.6, 0.03), 'wIron', { p: [0, 2.2, 3.35], c: iC });
    b.add(box(0.9, 0.04, 0.5), 'wWet', { p: [0, 2.28, 3.38] });
    b.add(box(0.8, 0.9, 0.03), 'wWet', { p: [0, 1.8, 3.62], r: [0.1, 0, 0] }); // the water falling from it
    gauge(b, [1.1, 2.75, 3.12], 0.8, 0);
    // the delivery pipe looping down the left side: up out of the pump block, along the flank, into the tank's top course
    b.add(cyl(0.26, 0.26, 2.0, 12), 'wIron', { p: [-1.6, 3.2, 2.5], c: iC });
    b.add(rb(0.62, 0.62, 0.62, 0.1), 'wIron', { p: [-1.6, 4.3, 2.5], c: iC });
    b.add(cyl(0.26, 0.26, 2.2, 12), 'wIron', { p: [-2.4, 4.3, 1.2], r: [PI / 2, 0, 0], c: iC });
    for (const z of [2.1, 0.6]) b.add(cyl(0.36, 0.36, 0.12, 12), 'wBrass', { p: [-2.4, 4.3, z], r: [PI / 2, 0, 0], c: bC });
    // timber bumpers along the bed
    for (const sx of [-1, 1]) b.add(rb(0.3, 0.4, 5.4, 0.04), 'wWood', { p: [sx * 2.05, 1.6, 0], c: tC });
    frost(b, 0, 3.55, 2.5, 2.4, 1.0, 6, 0.09);
  }, 2520));
  // the relief valve on the back right corner: a square stack with a flat weighted lid that lifts to blow off
  const valve = pivot(body, 1.3, 5.6, -2.0);
  valve.add(part((b) => {
    b.add(rb(0.8, 1.4, 0.8, 0.06), 'wIron', { p: [0, 0.7, 0], c: iC });
    for (const y of [0.3, 1.1]) b.add(rb(0.92, 0.1, 0.92, 0.02), 'wBrass', { p: [0, y, 0], c: bC });
    b.add(rb(0.12, 0.9, 0.12, 0.02), 'wIron', { p: [0.55, 1.4, 0], c: iC });
  }, 2530));
  const lid = pivot(valve, 0, 1.45, 0);
  lid.add(part((b) => { b.add(rb(1.0, 0.16, 1.0, 0.03), 'wBrass', { c: bC }); b.add(rb(0.4, 0.3, 0.4, 0.04), 'wIron', { p: [0, 0.22, 0], c: iC }); }, 2531));
  // the valve wheel on the right flank, turning
  const wheel = pivot(body, 2.35, 3.8, 0.4);
  wheel.add(part((b) => lugWheel(b, 1.05, 0.24, { n: 12 }), 2532));
  const s1 = steam(2, 0.7, 1.6, 0.36); s1.position.set(1.3, 7.2, -2.0); body.add(s1);
  const s2 = spray(4, 0.8, 0.6, 0.4); s2.position.set(0, 1.6, 3.7); body.add(s2);
  const s3 = steam(2, 0.9, 1.0, 0.3); s3.position.set(0, 5.6, -0.3); body.add(s3);
  const glow = slotGlow(0x7ac8ff, 3.7, 4.1, 0.45, { rx: -PI / 2 }); glow.position.set(0, 5.36, -0.3); body.add(glow);
  const a = new Anim(root, { base, body, wheels: TR.wheels, lid, wheel });
  a.dynamics.push(s1, s2, s3, glow);
  let dist = 0, ly = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 2.2), e = 1 - Math.pow(1 - k, 2);
      p.body.rotation.x = 0.06 * e; p.body.rotation.z = -0.05 * e; p.body.position.y = -0.3 * e; p.lid.position.y = 1.45 + 0.4 * e; p.lid.rotation.z = 0.5 * e;
      s1.visible = s2.visible = false; s3.visible = k < 0.6; glow.material.opacity = 0.45 * (1 - k);
      for (const d of this.dynamics) d.userData.update?.(dt, this.t);
      return;
    }
    s1.visible = s2.visible = s3.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.65) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    // the relief valve chatters on its seat; on an attack the pressure builds (the body shakes) and the lid lifts right up
    const at = this.stepAttack(dt);
    const want = at >= 0 ? (at < 0.55 ? 0.06 : at < 0.8 ? 0.7 : 0.7 * (1 - (at - 0.8) / 0.2)) : Math.max(0, Math.sin(this.t * 9)) * 0.03;
    ly += (want - ly) * Math.min(1, dt * 12);
    p.lid.position.y = 1.45 + ly;
    p.wheel.rotation.x += 0.4 * dt * ts;
    const shake = 0.01 + (at >= 0 && at < 0.55 ? at * 0.06 : 0);
    p.body.position.y = Math.sin(this.t * 29) * shake * 0.5 + Math.abs(Math.sin(this.t * 2.2)) * 0.03 * Math.min(1, this.speed);
    p.body.rotation.z = Math.sin(this.t * 23) * shake * 0.05;
    glow.material.opacity = 0.38 + 0.12 * Math.sin(this.t * 2.3);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z += Math.sin(this.t * 25) * this.hitT * 0.015; }
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  return finish(root, a, 7.2);
}

// ==========================================================================
// THE GREAT PUMP (the last boss, about 12.5 m tall, 13 m long)
// ==========================================================================
export function buildGreatPump() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 7.4, len: 9.4, h: 1.8, tw: 1.3, paint: 'wPaint', paintC: IRONG2, linkC: '#555a60', road: 3, seed: 2610 });
  const body = pivot(base, 0, 0, 0);
  const hC = grime(IRONG, 1.6, 9.0, 0.3, 21), h2C = wear(IRONG2, 0.3, 22), iC = wear(DARK, 0.25, 24), bC = wear(BRASS, 0.3, 25), tC = wear(TIMB, 0.3, 26);
  const P = (w, h, d, seed, o = {}) => pl(w, h, d, { mat: 'wPaint', c: hC, c2: h2C, trim: 'wIron', trimC: iC, boltMat: 'wBrass', boltC: bC, seed, ...o });
  body.add(part((b) => {
    // the engine bed: a long heavy plated block joining the treads, timber-planked on top
    b.add(rb(7.0, 1.2, 9.6, 0.1), 'wPaint', { p: [0, 2.2, 0], c: hC });
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) b.addBuilder(P(2.2, 0.9, 0.14, 2611 + i), { p: [sx * 3.52, 2.2, -3.45 + i * 2.3], r: [0, sx * PI / 2, 0] });
    for (let i = 0; i < 11; i++) b.add(rb(6.8, 0.12, 0.8, 0.02), 'wWood', { p: [0, 2.86, -4.4 + i * 0.88], c: wear(TIMB, 0.35, 30 + i) });
    bolts(b, 'wBrass', [-3.0, 1.75, 4.82], [3.0, 1.75, 4.82], 12, 0.06, 'z', bC);
    // the bob wall: a tall square block of grey plate in the middle of the bed, in three courses, banded, a flat cap
    b.add(rb(3.0, 7.2, 2.4, 0.1), 'wPaint', { p: [0, 6.5, 0], c: hC });
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) b.addBuilder(P(2.2, 2.0, 0.14, 2616 + i), { p: [sx * 1.52, 4.0 + i * 2.3, 0], r: [0, sx * PI / 2, 0] });
    for (const sz of [-1, 1]) for (let i = 0; i < 3; i++) b.addBuilder(P(2.6, 2.0, 0.14, 2620 + i, { inset: false }), { p: [0, 4.0 + i * 2.3, sz * 1.22], r: [0, sz > 0 ? 0 : PI, 0] });
    for (const y of [2.9, 5.2, 7.5, 9.8]) b.add(rb(3.12, 0.16, 2.52, 0.03), 'wIron', { p: [0, y, 0], c: iC });
    b.add(rb(3.4, 0.3, 2.8, 0.05), 'wPaint', { p: [0, 10.2, 0], c: h2C });
    b.add(rb(0.8, 0.8, 1.4, 0.05), 'wIron', { p: [0, 10.75, 0], c: iC }); // the beam's bearing block, under the beam
    b.add(rb(0.12, 6.2, 0.6, 0.02), 'wWood', { p: [1.62, 6.4, 0.7], c: tC }); // a timber ladder rail up one face
    for (let i = 0; i < 9; i++) b.add(rb(0.12, 0.08, 0.5, 0.02), 'wIron', { p: [1.64, 3.8 + i * 0.66, 0.7], c: iC });
    gauge(b, [-1.0, 6.4, 1.32], 2.2, 0); // one stroke gauge on the front face
    frost(b, 0, 10.38, 0, 3.0, 2.4, 12, 0.14);
    icicles(b, [-1.5, 9.7, 1.3], [1.5, 9.7, 1.3], 9, 0.4);
    // the pump barrel at the front: a tall square iron barrel down through the bed, its collar on top with meltwater over it
    b.add(rb(2.0, 4.6, 2.0, 0.1), 'wIron', { p: [0, 4.4, 3.6], c: iC });
    for (const y of [3.0, 4.6]) b.add(rb(2.16, 0.14, 2.16, 0.03), 'wBrass', { p: [0, y, 3.6], c: bC });
    b.add(rb(2.6, 0.4, 2.6, 0.06), 'wIron', { p: [0, 6.85, 3.6], c: iC });
    for (const [x, z, w, d] of [[0, 2.55, 2.6, 0.2], [0, 4.65, 2.6, 0.2], [-1.2, 3.6, 0.2, 2.0], [1.2, 3.6, 0.2, 2.0]]) b.add(rb(w, 0.24, d, 0.03), 'wBrass', { p: [x, 7.15, z], c: bC });
    b.add(box(2.0, 0.04, 1.8), 'wWet', { p: [0, 7.08, 3.6] });
    b.add(box(1.8, 3.6, 0.03), 'wWet', { p: [0, 5.0, 4.66], r: [0.03, 0, 0] }); // water sheeting down the barrel's front
    for (let i = 0; i < 6; i++) b.add(ico(b.r(0.2, 0.36), 0), 'iceBlue', { p: [-0.9 + i * 0.36, 2.9, 4.7 + b.r(0, 0.2)], s: [1.6, 0.7, 1.2], c: wear(ICE, 0.1, i) });
    icicles(b, [-1.3, 6.62, 4.92], [1.3, 6.62, 4.92], 9, 0.42);
    // the delivery main: out of the barrel's left side, down to the bed and away aft (where it was cut from the rising main)
    b.add(rb(0.9, 0.9, 0.9, 0.12), 'wIron', { p: [-1.5, 5.6, 3.6], c: iC });
    b.add(cyl(0.38, 0.38, 2.6, 14), 'wIron', { p: [-2.6, 4.4, 3.6], c: iC });
    b.add(cyl(0.38, 0.38, 7.0, 14), 'wIron', { p: [-2.6, 3.3, 0.0], r: [PI / 2, 0, 0], c: iC });
    for (const z of [2.6, 0.6, -1.4, -3.4]) b.add(cyl(0.52, 0.52, 0.14, 14), 'wBrass', { p: [-2.6, 3.3, z], r: [PI / 2, 0, 0], c: bC });
    b.add(rb(1.1, 1.1, 0.2, 0.04), 'wIron', { p: [-2.6, 3.3, -3.55], c: iC });
    // the steam cylinder at the back: a square iron jacket, banded, a flat cover, a square valve chest on its right side
    b.add(rb(2.4, 4.4, 2.4, 0.12), 'wIron', { p: [0, 5.0, -3.6], c: iC });
    for (const y of [3.4, 5.0, 6.6]) b.add(rb(2.56, 0.16, 2.56, 0.03), 'wBrass', { p: [0, y, -3.6], c: bC });
    b.add(rb(2.7, 0.3, 2.7, 0.05), 'wPaint', { p: [0, 7.35, -3.6], c: h2C });
    b.add(rb(0.9, 2.4, 1.4, 0.06), 'wPaint', { p: [1.65, 4.6, -3.6], c: hC });
    b.add(rb(0.14, 1.0, 0.14, 0.02), 'wIron', { p: [2.15, 6.2, -3.6], c: iC });
    b.add(rb(0.7, 0.7, 0.7, 0.05), 'wIron', { p: [0, 7.9, -3.6], c: iC }); // the gland the piston rod runs through
    frost(b, 0, 7.55, -3.6, 2.4, 2.4, 10, 0.12);
    icicles(b, [-1.3, 7.2, -4.9], [1.3, 7.2, -4.9], 8, 0.36);
    // the flywheel's plummer blocks on the right of the bed
    b.add(rb(0.8, 1.4, 1.2, 0.06), 'wIron', { p: [3.0, 3.5, -1.6], c: iC });
    for (const sx of [-1, 1]) icicles(b, [sx * 3.6, 1.6, -4.6], [sx * 3.6, 1.6, 4.6], 10, 0.38);
  }, 2630));
  // the great beam: a long flat girder of plated iron on timber cheeks, rocking on the bob wall (along z, one piece)
  const beam = pivot(body, 0, 11.3, 0);
  beam.add(part((b) => {
    b.add(rb(0.9, 1.1, 8.8, 0.08), 'wPaint', { c: grime(IRONG, -0.6, 0.6, 0.3, 40) });
    for (const sx of [-1, 1]) b.add(rb(0.16, 0.9, 8.2, 0.03), 'wWood', { p: [sx * 0.53, 0, 0], c: tC });
    for (const y of [-0.58, 0.58]) b.add(rb(1.1, 0.12, 8.9, 0.03), 'wIron', { p: [0, y, 0], c: iC });
    b.add(rb(1.4, 1.4, 1.0, 0.08), 'wIron', { p: [0, -0.3, 0], c: iC }); // the main bearing boss
    b.add(cyl(0.22, 0.22, 1.5, 12), 'wBrass', { r: [0, 0, PI / 2], c: bC }); // the gudgeon, barely past the boss
    for (const z of [-4.1, 4.1]) { b.add(rb(1.3, 1.2, 0.7, 0.06), 'wIron', { p: [0, -0.1, z], c: iC }); b.add(cyl(0.14, 0.14, 1.5, 10), 'wBrass', { p: [0, -0.2, z], r: [0, 0, PI / 2], c: bC }); }
    bolts(b, 'wBrass', [0.56, 0.3, -3.6], [0.56, 0.3, 3.6], 14, 0.05, 'x', bC);
    bolts(b, 'wBrass', [-0.56, 0.3, -3.6], [-0.56, 0.3, 3.6], 14, 0.05, 'x', bC);
    frost(b, 0, 0.66, 0, 0.9, 8.4, 16, 0.1);
    icicles(b, [0.4, -0.6, -3.6], [0.4, -0.6, 3.6], 10, 0.3);
  }, 2640));
  // the pump rod (front) and the piston rod (back), hanging from the beam's ends, square in section
  const pumpRod = pivot(body, 0, 11.1, 4.1);
  pumpRod.add(part((b) => {
    b.add(rb(0.5, 4.4, 0.5, 0.04), 'wIron', { p: [0, -2.2, 0], c: wear('#5a5e62', 0.3, 50) });
    for (const y of [-1.2, -2.8]) b.add(rb(0.6, 0.12, 0.6, 0.02), 'wBrass', { p: [0, y, 0], c: bC });
    b.add(box(0.04, 3.6, 0.03), 'wWet', { p: [0.26, -2.4, 0.26] });
  }, 2641));
  const pistonRod = pivot(body, 0, 11.1, -4.1);
  pistonRod.add(part((b) => {
    b.add(rb(0.36, 3.2, 0.36, 0.03), 'wIron', { p: [0, -1.6, 0], c: '#8a9096' });
    b.add(rb(0.7, 0.4, 0.5, 0.04), 'wBrass', { p: [0, -0.2, 0], c: bC });
  }, 2642));
  // the flywheel on the right of the bed: large, solid, lugs round its rim
  const fly = pivot(body, 3.75, 4.2, -1.6);
  fly.add(part((b) => lugWheel(b, 2.3, 0.4, { n: 16, c: wear('#3a3c40', 0.3, 60) }), 2643));
  const steamTop = steam(4, 1.3, 1.6, 0.45); steamTop.position.set(0, 8.2, -3.6); body.add(steamTop);
  const steamSide = steam(2, 0.8, 1.0, 0.34); steamSide.position.set(2.2, 6.7, -3.6); body.add(steamSide);
  const spout = spray(6, 1.1, 1.4, 0.48); spout.position.set(0, 7.3, 3.6); body.add(spout);
  const foot = spray(4, 1.0, 0.5, 0.42); foot.position.set(0, 2.9, 4.9); body.add(foot);
  const glow = slotGlow(0x7ac8ff, 2.0, 1.8, 0.5, { rx: -PI / 2, d: 0.14 }); glow.position.set(0, 7.12, 3.6); body.add(glow);
  const a = new Anim(root, { base, body, wheels: TR.wheels, beam, pumpRod, pistonRod, fly });
  a.dynamics.push(steamTop, steamSide, spout, foot, glow);
  let dist = 0, ang = 0, ph = 0;
  const setStroke = (p) => {
    p.beam.rotation.x = ang;
    // the beam's ends rise and fall by 4.1 sin(angle): the rods follow them (positive x rotation lowers the front end)
    p.pumpRod.position.y = 11.1 - Math.sin(ang) * 4.1;
    p.pistonRod.position.y = 11.1 + Math.sin(ang) * 4.1;
  };
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      // the beam stops at the bottom of its stroke, the steam dies away, the water stops spouting
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 2.6), e = 1 - Math.pow(1 - k, 2);
      ang += (0.16 - ang) * Math.min(1, dt * 2); setStroke(p);
      p.body.position.y = -0.3 * e; p.body.rotation.z = 0.02 * e;
      steamTop.visible = k < 0.5; steamSide.visible = false; spout.visible = k < 0.3;
      glow.material.opacity = 0.5 * (1 - k);
      for (const d of this.dynamics) d.userData.update?.(dt, this.t);
      return;
    }
    steamTop.visible = steamSide.visible = spout.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.9) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    // the beam rocks slowly, stroke by stroke; on an attack it heaves to the top of a long stroke, then drops hard
    ph += dt * ts * 0.9;
    const at = this.stepAttack(dt);
    let target = Math.sin(ph) * 0.13;
    if (at >= 0) target = at < 0.55 ? -0.2 * (at / 0.55) : at < 0.66 ? -0.2 + 0.42 * ((at - 0.55) / 0.11) : 0.22 * (1 - (at - 0.66) / 0.34);
    ang += (target - ang) * Math.min(1, dt * (at >= 0.55 && at < 0.66 ? 24 : 5));
    setStroke(p);
    p.fly.rotation.x += (0.9 + (at >= 0 ? 1.2 : 0)) * dt * ts;
    p.body.rotation.z = Math.sin(this.t * 0.5) * 0.004;
    glow.material.opacity = 0.42 + 0.14 * Math.sin(ph * 2);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z += Math.sin(this.t * 25) * this.hitT * 0.01; }
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  setStroke(a.p);
  // the Tripo model (tripoModels.js), a quarter turn (its beam came out across): the iced pump barrel at its -x end leads,
  // the flywheel on its +z face goes to the right. Steam off the cylinder, water over the barrel and at its foot.
  return wearModel(finish(root, a, 12.5), 'greatpump', { turn: 1, fit: 'long', size: 1.15, stretch: [0.9, 1.2],
    fx: [[steamTop, [0.4, 0.54, 0.12]], [steamSide, [0.45, 0.45, -0.1]], [spout, [-0.44, 0.46, 0.03]], [foot, [-0.49, 0.18, 0]]],
    motion: { ...MOTION.boss, heave: 0.5 } });
}
