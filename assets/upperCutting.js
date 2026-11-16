// The Upper Cutting (Part Fourteen, the ten-player raid in the Makers' deep cut at the head of the Rainward Gorge): four
// machine bosses of oiled iron in the gorge's dark wet green, old bronze gone green at the seams and rain-dark timber, red
// gorge mud caked on their treads and splashed up their flanks, streaked where the rain runs off them.
//  - The Stump Puller Prime: the great tracked puller that cleared the cut of its timber. A portal mast at the bow (two
//    square posts and a flat head beam), a crosshead that runs down the mast, and a grip of two flat square ribbed plates
//    that close across x; a solid winch drum on the deck, its cable straight up to the mast head; the engine house aft.
//  - The Spoil Conveyor: a long tracked belt that carried the spoil out of the cut. Two straight side girders climbing to
//    its head, the belt's flat slats across them (all one way), solid end rollers, a square spoil hopper at its foot, the
//    engine house under the belt's foot; its head lifts and tips on a strike.
//  - The Bed Ram: a tamping ram that rams new seed beds level. A tracked bed carries one square portal frame (two posts and
//    a flat head beam) with a heavy square ram block sliding in it on a straight shaft, a broad flat square foot shod in
//    felt; the engine house behind. On a strike the ram climbs and drops.
//  - The Terrace Engine (the last boss, it never moves): a great cutting engine on a stone plinth against the north face. A
//    square engine house, a wide solid cutting drum across its front (hoops round it, plain end caps, one bolt plate off
//    centre so the turn shows) carried on two straight side arms under a flat hood, a straight spoil chute down its right
//    flank, a solid flywheel on its left flank, one square stack, one gauge strip on its back.
// Same interface as the other machines: userData.machine = { update(dt, speed), attack(dur, kind), hit(), die(), revive(), stun }.
// Content rules: no faces (no lamps at all; a single gauge strip, never a pair, kept off the fronts), nothing animal-like
// (treads, flat plates and square blocks, never claws, jaws or legs: the grip is two flat plates), no spokes (solid discs),
// no teeth round a disc (the drum carries only hoops), no domes, rings, stars or radiating patterns, nothing crossed (every
// beam, slat, band and cable runs one way), masts and frames are portals with no braces, everything square from above.
import * as THREE from 'three';
import { rbox, box, cyl, ico } from './kit.js';
import { plate, stack, flywheel, heroTreads, crawl, wear, grime, bolts, bdisc } from './bossParts.js';
import { smoke } from './dynamic.js';
import { Anim, finish, part, pivot } from './quarryMachines.js';

const PI = Math.PI;
const rb = (w, h, d, r) => rbox(w, h, d, r, 1);
const pl = (w, h, d, o = {}) => plate(w, h, d, { br: Math.max(0.035, Math.min(0.07, Math.min(w, h) * 0.05)), ...o });
// the gorge's wet green paint, its darker plate, oiled iron, old bronze, rain-dark timber, red mud, moss
const PAINT = '#56604f', PAINT2 = '#465044', IRON = '#3c3e3a', BRONZE = '#9a8662', WOOD = '#5e4c3a', WOOD2 = '#4a3c2e', MUD = '#6a4a3a', MUD2 = '#7c5a44', MOSS = '#4e5e38', DARK = '#262422';

// caked mud: one flattened slab over a face, then flattened lumps on it (soft, never a pattern of dots)
function mud(b, cx, y, cz, w, d, n, s = 0.12) {
  b.add(rb(w * 0.92 + s, s * 0.45, d * 0.92 + s, s * 0.2), 'wPaint', { p: [cx, y - s * 0.05, cz], c: wear(MUD, 0.14, n) });
  for (let i = 0; i < n; i++) b.add(ico(s * b.r(0.6, 1.15), 0), 'wPaint', { p: [cx + b.r(-w / 2, w / 2), y, cz + b.r(-d / 2, d / 2)], s: [1.7, 0.4, 1.3], r: [0, b.r(0, 3), 0], c: wear(i % 3 === 1 ? MOSS : i % 2 ? MUD : MUD2, 0.12, i) });
}
// rain streaks down a flank: thin upright dark strips side by side along x (parallel, never crossing)
function streaks(b, x0, x1, y, z, h, n, ry = 0) {
  for (let i = 0; i < n; i++) { const x = x0 + (i + 0.5) * (x1 - x0) / n, l = h * b.r(0.5, 1); b.add(box(0.05, l, 0.02), 'wPaint', { p: [x, y - l / 2, z], r: [0, ry, 0], c: '#2e3430' }); }
}
// one sight-gauge strip in a dark frame (always single)
function gauge(b, p, h, ry = 0) {
  b.add(rb(0.14, h + 0.1, 0.07, 0.02), 'wDark', { p, r: [0, ry, 0], c: DARK });
  b.add(box(0.06, h, 0.03), 'wGlowOrange', { p: [p[0] + Math.sin(ry) * 0.03, p[1], p[2] + Math.cos(ry) * 0.03], r: [0, ry, 0] });
}
// a square engine house: flat roof, two bands, one square stack
function house(b, o) {
  const { w, h, d, x = 0, y, z, c, c2, ironC, seed, stackX = w * 0.28, stackW = 0.5, stackH = 1.6 } = o;
  b.add(rb(w, h, d, 0.08), 'wPaint', { p: [x, y + h / 2, z], c });
  for (const t of [0.3, 0.75]) b.add(rb(w + 0.06, 0.1, d + 0.06, 0.02), 'wIron', { p: [x, y + h * t, z], c: ironC });
  b.add(rb(w + 0.2, 0.14, d + 0.2, 0.03), 'wIron', { p: [x, y + h + 0.05, z], c: ironC });
  b.add(rb(w * 0.9, 0.06, d * 0.9, 0.02), 'wPaint', { p: [x, y + h + 0.14, z], c: c2 });
  b.addBuilder(stack(stackW, stackH, { c: '#2e2c2a', trimC: ironC, seed }), { p: [x + stackX, y + h + 0.1, z - d * 0.2] });
}
const steam = (rate = 2, size = 0.8, rise = 1.4, opacity = 0.38) => smoke({ rate, life: 1.8, size, rise, color: 0xe2e6e2, opacity, spread: 0.3 });
const mudSpray = (size = 0.7) => smoke({ rate: 0, life: 1.0, size, rise: -0.3, color: 0x6a4a3a, opacity: 0.55, spread: 0.8 });
function moveTreads(a, TR, dt, speed, k = 0.65) {
  const ts = a.stun ? 0.15 : 1;
  a.speed += (speed - a.speed) * Math.min(1, dt * 3);
  for (const w of a.p.wheels) w.rotation.x += (a.speed / k) * dt * ts;
  a._dist = (a._dist || 0) + a.speed * dt * ts; if (TR) crawl(TR.runs, a._dist);
  return ts;
}
function shake(a, dt, k = 0.015) { if (a.hitT > 0) { a.hitT -= dt * 2.5; a.p.body.rotation.z = Math.sin(a.t * 25) * a.hitT * k; } else a.p.body.rotation.z = 0; }
function dying(a, dt, dur, fn) { a.deadT += dt; const k = Math.min(1, a.deadT / dur), e = 1 - Math.pow(1 - k, 2); fn(e, k); for (const d of a.dynamics) d.userData.update?.(dt, a.t); }

// ==========================================================================
// THE STUMP PULLER PRIME (about 7.5 m tall, 8 m long)
// ==========================================================================
export function buildStumpPrime() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 4.0, len: 7.4, h: 1.4, tw: 1.0, paint: 'wPaint', paintC: '#3e443c', linkC: '#4e4a44', road: 3, seed: 5110 });
  const body = pivot(base, 0, 0, 0);
  const pC = grime(PAINT, 1.4, 5.0, 0.3, 5101), p2C = wear(PAINT2, 0.25, 5102), iC = wear(IRON, 0.25, 5103), bC = wear(BRONZE, 0.3, 5104), hC = grime(WOOD, 0.8, 3.0, 0.3, 5105);
  const P = (w, h, d, seed) => pl(w, h, d, { mat: 'wPaint', c: pC, c2: p2C, trim: 'wIron', trimC: iC, boltMat: 'wBrass', boltC: bC, seed });
  body.add(part((b) => {
    // the hull over the treads, riveted flank plates, a planked deck
    b.add(rb(3.6, 1.2, 7.4, 0.08), 'wPaint', { p: [0, 1.8, -0.2], c: p2C });
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) b.addBuilder(P(2.2, 0.9, 0.12, 5111 + i), { p: [sx * 1.85, 1.8, -2.6 + i * 2.4], r: [0, sx * PI / 2, 0] });
    for (let i = 0; i < 7; i++) b.add(rb(3.5, 0.1, 0.9, 0.015), 'wWood', { p: [0, 2.45, -3.3 + i * 0.98], c: wear(i % 2 ? WOOD2 : WOOD, 0.3, 5120 + i) });
    // the engine house aft, one gauge on its back face
    house(b, { w: 3.0, h: 2.2, d: 2.4, y: 2.5, z: -2.4, c: pC, c2: p2C, ironC: iC, seed: 5113 });
    gauge(b, [-0.7, 3.6, -3.64], 0.9, PI);
    streaks(b, -1.3, 1.3, 4.6, -1.18, 1.4, 9);
    // the winch: a solid drum across the deck, solid end discs, its cable straight up to the mast head
    b.add(cyl(0.55, 0.55, 2.4, 20), 'wIron', { p: [0, 3.2, 0.8], r: [0, 0, PI / 2], c: '#4a4844' });
    for (const sx of [-1, 1]) { b.add(bdisc(0.85, 0.16, 0.05, 24), 'wIron', { p: [sx * 1.3, 3.2, 0.8], r: [0, 0, PI / 2], c: iC }); b.add(rb(0.3, 0.9, 0.8, 0.04), 'wPaint', { p: [sx * 1.5, 2.9, 0.8], c: p2C }); }
    b.add(cyl(0.06, 0.06, 4.0, 6), 'wIron', { p: [0, 5.1, 2.0], r: [-0.55, 0, 0], c: '#2e2c2a' });
    // the mast: two square posts and a flat head beam over the bow (a portal, no braces), a sheave block on the beam
    for (const sx of [-1, 1]) {
      b.add(rb(0.45, 5.6, 0.5, 0.05), 'wIron', { p: [sx * 1.55, 4.6, 3.1], c: iC });
      b.add(rb(0.6, 0.7, 0.7, 0.05), 'wPaint', { p: [sx * 1.55, 2.3, 3.05], c: p2C });
      streaks(b, sx * 1.55 - 0.15, sx * 1.55 + 0.15, 7.2, 3.37, 3.0, 2);
    }
    b.add(rb(3.6, 0.5, 0.7, 0.05), 'wPaint', { p: [0, 7.55, 3.1], c: pC });
    b.add(rb(0.8, 0.6, 0.8, 0.05), 'wBrass', { p: [0, 7.15, 3.1], c: bC });
    mud(b, 0, 2.55, 1.9, 3.0, 1.2, 8, 0.12);
    mud(b, 1.0, 2.55, -3.6, 1.2, 0.4, 4, 0.1);
    bolts(b, 'wBrass', [-1.82, 2.3, -3.8], [-1.82, 2.3, 3.4], 14, 0.05, 'x', bC);
    bolts(b, 'wBrass', [1.82, 2.3, -3.8], [1.82, 2.3, 3.4], 14, 0.05, 'x', bC);
  }, 5130));
  // the grip: a crosshead running down the mast and two flat square ribbed plates that slide shut across x. The crosshead
  // is as wide as the plates' spread, so from above the grip reads as one square
  const GY = 4.4, grip = pivot(body, 0, GY, 3.6);
  grip.add(part((b) => {
    b.add(rb(2.8, 0.4, 1.8, 0.05), 'wPaint', { p: [0, 0.7, 0.3], c: pC });
    b.add(rb(2.4, 0.9, 0.3, 0.05), 'wPaint', { p: [0, 0.7, -0.5], c: p2C });
    b.add(rb(2.3, 0.14, 0.14, 0.02), 'wIron', { p: [0, 0.42, 0.3], c: iC }); // the slide bar the plates run on
    bolts(b, 'wBrass', [-1.2, 0.92, 1.18], [1.2, 0.92, 1.18], 6, 0.05, 'y', bC);
  }, 5131));
  const grips = [];
  for (const sx of [-1, 1]) {
    const j = pivot(grip, sx * 1.05, 0.42, 0.3);
    j.add(part((b) => {
      b.add(rb(0.3, 0.3, 0.5, 0.03), 'wIron', { c: iC });
      b.add(rb(0.24, 1.9, 1.7, 0.03), 'wIron', { p: [0, -1.05, 0], c: wear('#5c5a56', 0.25, 5140 + sx) });
      for (let i = 0; i < 5; i++) b.add(box(0.07, 0.12, 1.5), 'wIron', { p: [-sx * 0.15, -1.75 + i * 0.36, 0], c: '#4a4844' }); // flat ribs along z, parallel
      mud(b, 0, -1.95, 0, 0.24, 1.4, 4, 0.1);
    }, 5141 + (sx > 0 ? 1 : 0)));
    grips.push({ j, sx });
  }
  const s1 = steam(2.5, 0.9, 1.4, 0.38); s1.position.set(0.84, 6.4, -2.9); body.add(s1);
  const spray = mudSpray(0.9); spray.position.set(0, 0.6, 3.8); body.add(spray);
  const glow = { material: {} }; // (no glow slot: one gauge strip is the only light on each machine, never two side by side)
  const a = new Anim(root, { base, body, wheels: TR.wheels, grip, grips });
  a.dynamics.push(s1);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      dying(this, dt, 1.8, (e, k) => { p.body.rotation.z = -0.06 * e; p.body.rotation.x = 0.04 * e; p.body.position.y = -0.25 * e; p.grip.position.y = GY - 2.0 * e; s1.visible = spray.visible = false; glow.material.opacity = 0.45 * (1 - k); });
      return;
    }
    s1.visible = spray.visible = true;
    moveTreads(this, TR, dt, speed);
    // the grip drops onto the stump, the plates close, and the whole puller rears back to draw it out
    let gy = GY + Math.sin(this.t * 0.7) * 0.06, open = 0, sr = 0;
    p.body.rotation.x = 0;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      const drop = at < 0.3 ? at / 0.3 : 1, shut = at < 0.3 ? 0 : Math.min(1, (at - 0.3) / 0.12), pull = at < 0.45 ? 0 : Math.min(1, (at - 0.45) / 0.15), rec = at > 0.75 ? (at - 0.75) / 0.25 : 0;
      gy += (-2.2 * drop + 2.6 * pull) * (1 - rec);
      open = -0.4 * shut * (1 - rec) + 0.2 * drop * (1 - shut);
      p.body.rotation.x = -0.05 * pull * (1 - rec);
      if (shut > 0 && pull < 1) sr = 30;
    }
    p.grip.position.y = gy;
    for (const J of p.grips) J.j.position.x = J.sx * (1.05 + open);
    spray.userData.rate = sr;
    p.body.position.y = Math.abs(Math.sin(this.t * 2.2)) * 0.03 * Math.min(1, this.speed);
    glow.material.opacity = 0.38 + 0.08 * Math.sin(this.t * 2.5);
    shake(this, dt);
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
    spray.userData.update(dt, this.t);
  };
  return finish(root, a, 7.6);
}

// ==========================================================================
// THE SPOIL CONVEYOR (about 6.5 m tall, 11 m long)
// ==========================================================================
export function buildSpoilConveyor() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 3.8, len: 8.6, h: 1.3, tw: 0.95, paint: 'wPaint', paintC: '#3e443c', linkC: '#4e4a44', road: 3, seed: 5210 });
  const body = pivot(base, 0, 0, 0);
  const pC = grime(PAINT, 1.4, 4.0, 0.3, 5201), p2C = wear(PAINT2, 0.25, 5202), iC = wear(IRON, 0.25, 5203), bC = wear(BRONZE, 0.3, 5204);
  const P = (w, h, d, seed) => pl(w, h, d, { mat: 'wPaint', c: pC, c2: p2C, trim: 'wIron', trimC: iC, boltMat: 'wBrass', boltC: bC, seed });
  body.add(part((b) => {
    b.add(rb(3.4, 1.0, 8.8, 0.08), 'wPaint', { p: [0, 1.7, 0], c: p2C });
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) b.addBuilder(P(2.0, 0.8, 0.12, 5211 + i), { p: [sx * 1.75, 1.66, -3.3 + i * 2.2], r: [0, sx * PI / 2, 0] });
    // the hopper at the foot (the stern): a square open bin heaped with wet spoil, iron-banded
    b.add(rb(3.2, 1.8, 2.8, 0.08), 'wPaint', { p: [0, 3.1, -3.1], c: pC });
    for (const y of [2.6, 3.6]) b.add(rb(3.26, 0.1, 2.86, 0.02), 'wIron', { p: [0, y, -3.1], c: iC });
    mud(b, 0, 4.05, -3.1, 2.6, 2.2, 14, 0.2);
    // the engine house under the belt's foot, one stack, one gauge on its right flank (off the front)
    house(b, { w: 2.4, h: 1.4, d: 2.0, y: 2.2, z: -0.6, c: pC, c2: p2C, ironC: iC, seed: 5213, stackX: -0.75, stackW: 0.46, stackH: 2.2 });
    gauge(b, [1.23, 2.9, -0.3], 0.8, PI / 2);
    // the belt's fixed foot: two straight girders from the hopper to the pivot amidships (along z, parallel)
    for (const sx of [-1, 1]) b.add(rb(0.3, 0.5, 4.2, 0.04), 'wIron', { p: [sx * 1.1, 3.9, -1.0], c: iC });
    // the pivot posts the belt's head hinges on: two square posts
    for (const sx of [-1, 1]) b.add(rb(0.4, 2.2, 0.5, 0.04), 'wIron', { p: [sx * 1.1, 3.0, 1.2], c: iC });
    mud(b, 0, 2.25, 3.4, 2.8, 1.6, 8, 0.14);
    bolts(b, 'wBrass', [-1.72, 2.1, -4.2], [-1.72, 2.1, 4.2], 14, 0.05, 'x', bC);
    bolts(b, 'wBrass', [1.72, 2.1, -4.2], [1.72, 2.1, 4.2], 14, 0.05, 'x', bC);
  }, 5220));
  // the belt's head: two side girders climbing forward from the pivot, slats across between them (all one way), a solid
  // roller at the head; it lifts and tips on a strike
  const HL = 6.2, head = pivot(body, 0, 4.1, 1.2);
  head.rotation.x = -0.32;
  head.add(part((b) => {
    for (const sx of [-1, 1]) {
      b.add(rb(0.3, 0.6, HL, 0.04), 'wPaint', { p: [sx * 1.15, 0, HL / 2], c: pC });
      b.add(rb(0.34, 0.1, HL + 0.04, 0.02), 'wIron', { p: [sx * 1.15, 0.33, HL / 2], c: iC });
    }
    b.add(cyl(0.42, 0.42, 2.2, 18), 'wIron', { p: [0, 0, HL], r: [0, 0, PI / 2], c: '#4a4844' });
    for (const sx of [-1, 1]) b.add(bdisc(0.5, 0.1, 0.03, 20), 'wIron', { p: [sx * 1.12, 0, HL], r: [0, 0, PI / 2], c: iC });
    // a spoil lip at the head: a flat plate down from the roller
    b.add(rb(2.2, 0.9, 0.12, 0.03), 'wIron', { p: [0, -0.6, HL + 0.45], r: [0.3, 0, 0], c: iC });
    mud(b, 0, 0.36, HL * 0.6, 1.6, HL * 0.7, 10, 0.16);
  }, 5230));
  // the slats: one group riding along the girders (offset modulo their spacing as the belt runs)
  const SG = 0.55, slats = new THREE.Group(); head.add(slats);
  slats.add(part((b) => { for (let i = 0; i < Math.floor(HL / SG); i++) b.add(rb(1.9, 0.08, 0.36, 0.02), 'wWood', { p: [0, 0.3, 0.3 + i * SG], c: wear(i % 2 ? WOOD2 : WOOD, 0.3, 5240 + i) }); }, 5241));
  const s1 = steam(2, 0.8, 1.4, 0.38); s1.position.set(-0.75, 5.8, -1.0); body.add(s1);
  const spray = mudSpray(1.0); spray.position.set(0, 5.0, 7.0); body.add(spray);
  const glow = { material: {} }; // (no glow slot: one gauge strip is the only light on each machine, never two side by side)
  const a = new Anim(root, { base, body, wheels: TR.wheels, head, slats });
  a.dynamics.push(s1);
  let tip = 0, run = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      dying(this, dt, 2.0, (e, k) => { p.head.rotation.x = -0.32 + 0.3 * e; p.body.rotation.z = 0.05 * e; p.body.position.y = -0.25 * e; s1.visible = spray.visible = false; glow.material.opacity = 0.4 * (1 - k); });
      return;
    }
    s1.visible = spray.visible = true;
    const ts = moveTreads(this, TR, dt, speed);
    run = (run + dt * 0.9 * ts) % SG; p.slats.position.z = run;
    const at = this.stepAttack(dt);
    let target = Math.sin(this.t * 0.6) * 0.03, sr = 0;
    if (at >= 0) { target = at < 0.4 ? -0.5 * (at / 0.4) : at < 0.55 ? -0.5 + 0.8 * ((at - 0.4) / 0.15) : 0.3 * (1 - (at - 0.55) / 0.45); if (at > 0.4 && at < 0.7) sr = 30; }
    tip += (target - tip) * Math.min(1, dt * (at >= 0.4 && at < 0.55 ? 20 : 5));
    p.head.rotation.x = -0.32 + tip;
    spray.userData.rate = sr;
    p.body.position.y = Math.abs(Math.sin(this.t * 2.4)) * 0.03 * Math.min(1, this.speed);
    glow.material.opacity = 0.34 + 0.08 * Math.sin(this.t * 2.7);
    shake(this, dt);
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
    spray.userData.update(dt, this.t);
  };
  return finish(root, a, 6.6);
}

// ==========================================================================
// THE BED RAM (about 8 m tall, 7 m long)
// ==========================================================================
export function buildBedRam() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 4.2, len: 6.6, h: 1.3, tw: 1.0, paint: 'wBronze', paintC: '#a89070', linkC: '#4e4a44', road: 3, seed: 5310 });
  const body = pivot(base, 0, 0, 0);
  // old bronze, green at the seams (the Makers' oldest machine in the cut)
  const pC = grime('#c8ae84', 1.4, 7.0, 0.32, 5301), p2C = wear('#aa926c', 0.28, 5302), iC = wear('#544c44', 0.25, 5303), bC = wear('#b89a62', 0.3, 5304), hC = grime(WOOD, 0.8, 3.0, 0.3, 5305);
  const P = (w, h, d, seed) => pl(w, h, d, { mat: 'wBronze', c: pC, c2: p2C, trim: 'wIron', trimC: iC, boltMat: 'wBrass', boltC: bC, seed });
  body.add(part((b) => {
    b.add(rb(4.0, 1.0, 6.8, 0.08), 'wBronze', { p: [0, 1.7, 0], c: p2C });
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) b.addBuilder(P(2.0, 0.8, 0.12, 5311 + i), { p: [sx * 2.05, 1.66, -2.2 + i * 2.2], r: [0, sx * PI / 2, 0] });
    for (let i = 0; i < 7; i++) b.add(rb(3.9, 0.1, 0.86, 0.015), 'wWood', { p: [0, 2.25, -2.9 + i * 0.96], c: wear(i % 2 ? WOOD2 : WOOD, 0.3, 5320 + i) });
    // the engine house aft, one gauge on its back face
    b.add(rb(3.0, 2.0, 2.2, 0.08), 'wBronze', { p: [0, 3.3, -2.2], c: pC });
    for (const y of [2.8, 3.9]) b.add(rb(3.06, 0.1, 2.26, 0.02), 'wIron', { p: [0, y, -2.2], c: iC });
    b.add(rb(3.2, 0.14, 2.4, 0.03), 'wIron', { p: [0, 4.36, -2.2], c: iC });
    b.addBuilder(stack(0.5, 1.6, { c: '#2e2c2a', trimC: iC, seed: 5313 }), { p: [-0.8, 4.4, -2.5] });
    gauge(b, [0.7, 3.3, -3.34], 0.8, PI);
    // moss on the house roof (soft pads, overlapping)
    for (let i = 0; i < 4; i++) b.add(rb(b.r(0.6, 1.2), 0.05, b.r(0.5, 1.0), 0.02), 'wPaint', { p: [b.r(-0.9, 0.9), 4.45, -2.2 + b.r(-0.6, 0.6)], c: wear(i % 2 ? MOSS : '#5c6c40', 0.2, i) });
    // the frame: two tall square posts and a flat head beam (a portal, no braces), straight guides inside the posts
    for (const sx of [-1, 1]) {
      b.add(rb(0.7, 7.0, 0.8, 0.06), 'wWood', { p: [sx * 1.6, 5.7, 1.2], c: hC });
      for (const y of [3.0, 5.2, 7.4]) b.add(rb(0.8, 0.14, 0.9, 0.02), 'wIron', { p: [sx * 1.6, y, 1.2], c: iC });
      b.add(rb(0.14, 6.4, 0.3, 0.02), 'wIron', { p: [sx * 1.2, 5.5, 1.2], c: '#7a7c7e' });
    }
    b.add(rb(3.9, 0.7, 1.1, 0.06), 'wBronze', { p: [0, 9.5, 1.2], c: pC });
    b.add(rb(3.9, 0.1, 1.2, 0.02), 'wIron', { p: [0, 9.88, 1.2], c: iC });
    // the lifting chain over the head beam: straight links down to the ram (all one way)
    for (let i = 0; i < 6; i++) b.add(rb(0.18, 0.34, i % 2 ? 0.07 : 0.18, 0.02), 'wIron', { p: [0, 9.05 - i * 0.38, 1.2], c: iC });
    mud(b, 0, 2.35, 2.9, 3.4, 1.0, 8, 0.12);
    bolts(b, 'wBrass', [-2.02, 2.1, -3.2], [-2.02, 2.1, 3.2], 12, 0.05, 'x', bC);
    bolts(b, 'wBrass', [2.02, 2.1, -3.2], [2.02, 2.1, 3.2], 12, 0.05, 'x', bC);
  }, 5330));
  // the ram: a heavy square block on a straight shaft between the guides, a broad flat square foot shod in felt
  const RY = 4.2, ram = pivot(body, 0, RY, 1.2);
  ram.add(part((b) => {
    b.add(rb(2.0, 1.8, 1.4, 0.08), 'wBronze', { p: [0, 0.6, 0], c: pC });
    for (const y of [0.1, 1.1]) b.add(rb(2.06, 0.14, 1.46, 0.02), 'wIron', { p: [0, y, 0], c: iC });
    b.add(rb(0.5, 1.6, 0.5, 0.04), 'wIron', { p: [0, 2.2, 0], c: '#5a5c5e' });
    b.add(rb(2.6, 0.3, 2.0, 0.05), 'wIron', { p: [0, -0.45, 0], c: iC });
    b.add(rb(2.5, 0.12, 1.9, 0.03), 'wPaint', { p: [0, -0.66, 0], c: '#6a6058' }); // the felt
    mud(b, 0, -0.62, 0, 2.2, 1.6, 6, 0.1);
  }, 5331));
  const s1 = steam(2, 0.8, 1.4, 0.38); s1.position.set(-0.8, 6.2, -2.5); body.add(s1);
  const spray = mudSpray(1.1); spray.position.set(0, 0.3, 1.2); body.add(spray);
  const glow = { material: {} }; // (no glow slot: one gauge strip is the only light on each machine, never two side by side)
  const a = new Anim(root, { base, body, wheels: TR.wheels, ram });
  a.dynamics.push(s1);
  let ry = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      dying(this, dt, 1.8, (e, k) => { p.ram.position.y = RY - 2.4 * e; p.body.rotation.z = 0.05 * e; p.body.position.y = -0.2 * e; s1.visible = spray.visible = false; glow.material.opacity = 0.4 * (1 - k); });
      return;
    }
    s1.visible = spray.visible = true;
    moveTreads(this, TR, dt, speed);
    // the ram climbs slowly in its guides, then drops onto the bed and bounces once
    const at = this.stepAttack(dt);
    let target = Math.sin(this.t * 0.9) * 0.08, sr = 0;
    if (at >= 0) { target = at < 0.5 ? 2.8 * (at / 0.5) : at < 0.6 ? 2.8 - 5.4 * ((at - 0.5) / 0.1) : -2.6 * (1 - (at - 0.6) / 0.4); if (at > 0.58 && at < 0.75) sr = 40; }
    ry += (target - ry) * Math.min(1, dt * (at >= 0.5 && at < 0.6 ? 40 : 6));
    p.ram.position.y = RY + ry;
    spray.userData.rate = sr;
    p.body.position.y = Math.abs(Math.sin(this.t * 2.2)) * 0.03 * Math.min(1, this.speed);
    glow.material.opacity = 0.34 + 0.08 * Math.sin(this.t * 2.4);
    shake(this, dt);
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
    spray.userData.update(dt, this.t);
  };
  return finish(root, a, 9.9);
}

// ==========================================================================
// THE TERRACE ENGINE (about 11 m tall, 14 m wide; it never moves)
// ==========================================================================
export function buildTerraceEngine() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const body = pivot(base, 0, 0, 0);
  const pC = grime(PAINT, 2.0, 9.0, 0.32, 5401), p2C = wear(PAINT2, 0.25, 5402), iC = wear(IRON, 0.25, 5403), bC = wear(BRONZE, 0.3, 5404), sC = wear('#6a6a64', 0.2, 5405);
  const P = (w, h, d, seed) => pl(w, h, d, { mat: 'wPaint', c: pC, c2: p2C, trim: 'wIron', trimC: iC, boltMat: 'wBrass', boltC: bC, seed });
  body.add(part((b) => {
    // the stone plinth, dressed and square, mud heaped against its front
    b.add(rb(13.0, 1.2, 9.0, 0.1), 'stoneLarge', { p: [0, 0.6, -1.0], c: sC });
    b.add(rb(13.2, 0.14, 9.2, 0.03), 'wIron', { p: [0, 1.22, -1.0], c: iC });
    // the engine house: a long square block, banded, riveted plates down both flanks
    house(b, { w: 8.0, h: 4.6, d: 5.0, y: 1.3, z: -2.6, c: pC, c2: p2C, ironC: iC, seed: 5413, stackX: 2.6, stackW: 0.9, stackH: 3.0 });
    for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) b.addBuilder(P(2.2, 1.8, 0.14, 5414 + i), { p: [sx * 4.05, 3.4, -3.8 + i * 2.4], r: [0, sx * PI / 2, 0] });
    gauge(b, [-1.6, 4.0, -5.14], 1.3, PI);
    streaks(b, -3.6, 3.6, 5.8, -0.08, 2.6, 18);
    // the arm housings either side of the drum (where the arms pivot), square
    for (const sx of [-1, 1]) b.add(rb(1.2, 2.4, 1.8, 0.06), 'wPaint', { p: [sx * 5.4, 3.6, 0.6], c: p2C });
    // the spoil chute down the right flank: a straight square trough from the drum hood to the plinth, a mud tongue off its foot
    b.add(rb(1.2, 0.5, 6.2, 0.05), 'wIron', { p: [6.4, 3.0, -1.0], r: [0.5, 0, 0], c: iC });
    for (const sx of [-1, 1]) b.add(rb(0.12, 0.6, 6.2, 0.02), 'wIron', { p: [6.4 + sx * 0.6, 3.3, -1.0], r: [0.5, 0, 0], c: '#4a4844' });
    mud(b, 6.4, 1.3, -4.4, 1.6, 2.0, 10, 0.2);
    mud(b, 0, 1.3, 3.0, 11.0, 1.6, 18, 0.22);
    bolts(b, 'wBrass', [-4.02, 1.5, -5.0], [-4.02, 1.5, -0.2], 10, 0.06, 'x', bC);
    bolts(b, 'wBrass', [4.02, 1.5, -5.0], [4.02, 1.5, -0.2], 10, 0.06, 'x', bC);
  }, 5420));
  // the flywheel on the left flank: a solid disc turning about x
  const fly = pivot(body, -4.6, 4.2, -3.2);
  fly.add(part((b) => { b.addBuilder(flywheel(2.0, 0.5, { c: '#4a4844', hubC: bC, seed: 5430 })); }, 5431));
  // the arms and the drum: two straight side arms out from the housings, the flat hood over the drum, the drum turning
  const arms = pivot(body, 0, 3.6, 0.6);
  arms.add(part((b) => {
    for (const sx of [-1, 1]) {
      b.add(rb(0.7, 0.9, 4.2, 0.05), 'wPaint', { p: [sx * 5.4, -0.4, 1.9], r: [0.18, 0, 0], c: pC });
      b.add(rb(0.8, 1.0, 0.8, 0.05), 'wBrass', { p: [sx * 5.4, -1.0, 3.9], c: bC }); // the bearing block
    }
    b.add(rb(10.6, 0.3, 3.0, 0.05), 'wPaint', { p: [0, 1.1, 3.6], c: pC }); // the hood: flat, square from above
    b.add(rb(10.8, 0.1, 3.1, 0.02), 'wIron', { p: [0, 1.28, 3.6], c: iC });
    mud(b, 0, 1.34, 3.6, 9.6, 2.4, 14, 0.16);
    for (const sx of [-1, 1]) b.add(rb(0.12, 1.6, 3.0, 0.02), 'wIron', { p: [sx * 5.3, 0.3, 3.6], c: iC }); // the hood's side cheeks
  }, 5440));
  const DR = 1.6, drum = pivot(arms, 0, -1.0, 3.9);
  drum.add(part((b) => {
    b.add(cyl(DR, DR, 9.6, 28), 'wIron', { r: [0, 0, PI / 2], c: wear('#4a4c48', 0.25, 5450) });
    for (let i = 0; i < 7; i++) b.add(cyl(DR * 1.05, DR * 1.05, 0.2, 28), 'wIron', { p: [-4.8 + (i + 0.5) * 9.6 / 7, 0, 0], r: [0, 0, PI / 2], c: wear('#6a6c68', 0.3, 5451 + i) });
    for (const sx of [-1, 1]) { b.add(bdisc(DR * 1.02, 0.2, 0.06, 28), 'wIron', { p: [sx * 4.86, 0, 0], r: [0, 0, PI / 2], c: iC }); b.add(rb(0.16, 0.6, 0.6, 0.04), 'wBrass', { p: [sx * 4.98, DR * 0.55, 0], c: bC }); }
    mud(b, 0, -DR + 0.1, 0.4, 8.6, 0.8, 10, 0.16);
  }, 5452));
  const s1 = steam(3, 1.2, 1.8, 0.4); s1.position.set(2.6, 9.2, -3.6); body.add(s1);
  const s2 = steam(1.5, 0.9, 1.0, 0.3); s2.position.set(-4.6, 6.5, -3.2); body.add(s2);
  const spray = mudSpray(1.6); spray.position.set(0, 1.2, 5.6); body.add(spray);
  const glow = { material: {} }; // (no glow slot: one gauge strip is the only light on each machine, never two side by side)
  const a = new Anim(root, { base, body, wheels: [], fly, arms, drum });
  a.dynamics.push(s1, s2);
  let pitch = 0;
  a.update = function (dt) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      dying(this, dt, 3.0, (e, k) => { p.arms.rotation.x = 0.22 * e; p.drum.rotation.x += dt * 0.5 * (1 - k); s1.visible = s2.visible = spray.visible = false; glow.material.opacity = 0.45 * (1 - k); });
      return;
    }
    s1.visible = s2.visible = spray.visible = true;
    const ts = this.stun ? 0.15 : 1;
    p.drum.rotation.x += dt * 1.6 * ts; p.fly.rotation.x += dt * 0.9 * ts;
    // the arms dip the drum into the face, then lift it out
    const at = this.stepAttack(dt);
    let target = Math.sin(this.t * 0.5) * 0.02, sr = 6;
    if (at >= 0) { target = at < 0.45 ? -0.12 * (at / 0.45) : at < 0.6 ? -0.12 + 0.36 * ((at - 0.45) / 0.15) : 0.24 * (1 - (at - 0.6) / 0.4); if (at > 0.45 && at < 0.8) sr = 40; }
    pitch += (target - pitch) * Math.min(1, dt * (at >= 0.45 && at < 0.6 ? 18 : 4));
    p.arms.rotation.x = pitch;
    spray.userData.rate = sr;
    glow.material.opacity = 0.38 + 0.08 * Math.sin(this.t * 2.1);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.position.x = Math.sin(this.t * 30) * this.hitT * 0.04; } else p.body.position.x = 0;
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
    spray.userData.update(dt, this.t);
  };
  return finish(root, a, 11.0);
}
