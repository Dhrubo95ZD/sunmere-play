// The Drying Lofts (Part Fifteen, level 70 dungeon in the upper lofts of the Long Sheds in the Russet Weald): three machine
// bosses of old oxblood-brown paint over oiled iron and old bronze, dusted pale with a lifetime of oak dust on every top
// face, dark with damp toward their feet.
//  - The Stack Turner: the tracked machine that turned the stacks layer by layer so they dried even. A long tracked bed, a
//    square turning table on a square pedestal in the middle (it turns a quarter round, never a disc from above), two flat
//    square clamp plates on straight upright arms either side of it, a stack of oak held between them (a solid block,
//    layer lines on its sides only), and a square engine house at the stern with one square stack and one gauge strip.
//  - The Louvre Jack: the screw jack that set the louvres. A tracked base, a square frame at the front (two square posts and
//    a flat head beam laid on top) holding a louvre panel of parallel slats all set one way, and the jack outboard of the
//    right post: one straight square screw in a square nut housing, a flat square foot under it. Engine house behind.
//  - The Louvre Engine (the last boss): the engine that drives every louvre rod and gantry in the sheds, fixed against the
//    Engine Loft's north wall. A wide square engine house on a stone plinth, a long solid winding drum lying along its
//    front (plain round ends at the two flanks, one each side, never two on one face), a row of square louvre rods rising
//    out of its roof side by side (all upright, nothing crossing them), a square cam box they ride in, one square stack.
// Same interface as the other machines: userData.machine = { update(dt, speed), attack(dur, kind), hit(), die(), revive(), stun }.
// Content rules: no faces (no lamps; one gauge strip each, never a pair), nothing animal-like (treads, boxes and flat plates:
// flat square clamps, never claws or jaws), solid discs only (no spokes), nothing crossed (the slats, rods and screws run
// one way each, the screw stands clear of the slats), no domes, rings or stars; everything square from straight above.
import * as THREE from 'three';
import { rbox, box, cyl, rgb } from './kit.js';
import { plate, vent, stack, heroTreads, crawl, wear, bolts } from './bossParts.js';
import { smoke } from './dynamic.js';
import { slotGlow } from './slotGlow.js';
import { Anim, finish, part, pivot } from './quarryMachines.js';

const PI = Math.PI;
const rb = (w, h, d, r) => rbox(w, h, d, r, 1);
const pl = (w, h, d, o = {}) => plate(w, h, d, { br: Math.max(0.035, Math.min(0.07, Math.min(w, h) * 0.05)), ...o });
// oxblood-brown paint, its second shade, oiled iron, dark iron, old bronze, oak dust, damp, shed oak and its dark layer line
const PAINT = '#6a3e30', PAINT2 = '#56342a', IRON = '#4a4844', IRON2 = '#383632', BRONZE = '#8a7444', DUST = '#c8b494', DAMP = '#2e2a24', OAK = '#a08058', OAK2 = '#6e5438', DARK = '#262220';

// paint darkened toward the foot of a part (below low), where the damp gets in
function damp(base, low = 0.6, amt = 0.3, seed = 0) {
  const f = wear(base, amt, seed), M = rgb(DAMP);
  return (x, y, z) => { const c = f(x, y, z), k = y < low ? Math.min(1, (low - y) / 0.8) * 0.5 : 0; return [c[0] * (1 - k) + M[0] * k, c[1] * (1 - k) + M[1] * k, c[2] * (1 - k) + M[2] * k]; };
}
// oak dust lying on a top face: one thin pale slab, a little smaller than the face
function dust(b, cx, y, cz, w, d) { b.add(rb(w * 0.9, 0.03, d * 0.9, 0.01), 'wPaint', { p: [cx, y + 0.015, cz], c: wear(DUST, 0.12, Math.round(cx * 7 + cz * 3)) }); }
// a stack of oak: a solid block, its layer lines on the four sides only (never on top: from above it is one plain block)
function oakStack(b, cx, y, cz, w, h, d, n = 5) {
  b.add(rb(w, h, d, 0.03), 'wPaint', { p: [cx, y + h / 2, cz], c: wear(OAK, 0.18, 31) });
  for (let i = 1; i < n; i++) {
    const yy = y + (h * i) / n;
    for (const s of [-1, 1]) { b.add(box(w + 0.02, 0.05, 0.02), 'wPaint', { p: [cx, yy, cz + s * (d / 2 + 0.005)], c: OAK2 }); b.add(box(0.02, 0.05, d + 0.02), 'wPaint', { p: [cx + s * (w / 2 + 0.005), yy, cz], c: OAK2 }); }
  }
  dust(b, cx, y + h, cz, w, d);
}
// one sight-gauge strip (always single, never a pair)
function gauge(b, p, h, ry = 0) {
  b.add(rb(0.14, h + 0.1, 0.07, 0.02), 'wDark', { p, r: [0, ry, 0], c: DARK });
  b.add(box(0.06, h, 0.03), 'wGlowOrange', { p: [p[0] + Math.sin(ry) * 0.03, p[1], p[2] + Math.cos(ry) * 0.03], r: [0, ry, 0] });
}
// an engine house: flat roof, two bands, a louvred vent on its back (-z), one square stack, one gauge on a flank
function engineHouse(b, o) {
  const { w, h, d, x = 0, y, z, c, ironC, seed, stackX = w * 0.3, stackW = 0.4, stackH = 1.3, gaugeSide = 1 } = o;
  b.add(rb(w, h, d, 0.08), 'wPaint', { p: [x, y + h / 2, z], c });
  b.add(rb(w + 0.14, 0.12, d + 0.14, 0.03), 'wIron', { p: [x, y + h + 0.03, z], c: ironC });
  for (const t of [0.3, 0.75]) b.add(rb(w + 0.06, 0.08, d + 0.06, 0.02), 'wIron', { p: [x, y + h * t, z], c: ironC });
  b.addBuilder(vent(w * 0.56, h * 0.42, { frameC: DARK, glow: 'wGlowOrange', seed }), { p: [x, y + h * 0.5, z - d / 2 - 0.02], r: [0, PI, 0] });
  b.addBuilder(stack(stackW, stackH, { c: '#323230', trimC: ironC, seed: seed + 1 }), { p: [x + stackX, y + h + 0.06, z - d * 0.2] });
  gauge(b, [x + gaugeSide * (w / 2 + 0.04), y + h * 0.55, z + d * 0.15], h * 0.3, gaugeSide * PI / 2);
  dust(b, x - w * 0.1, y + h + 0.09, z + d * 0.1, w * 0.6, d * 0.6);
}
const puff = (rate = 2, size = 0.6) => smoke({ rate, life: 1.4, size, rise: 0.3, color: 0xc8b494, opacity: 0.35, spread: 0.5 });
const exhaust = (size = 0.7) => smoke({ rate: 2.2, life: 2.4, size, rise: 1.2, color: 0x8a8884, opacity: 0.4, spread: 0.18 });

// ==========================================================================
// THE STACK TURNER (about 5 m tall, 8 m long)
// ==========================================================================
export function buildStackTurner() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 3.4, len: 7.0, h: 1.2, tw: 0.9, paint: 'wPaint', paintC: PAINT2, linkC: '#4e4a44', road: 3, seed: 5110 });
  const body = pivot(base, 0, 0, 0);
  const pC = damp(PAINT, 1.5, 0.3, 1), p2C = damp(PAINT2, 1.5, 0.3, 2), iC = wear(IRON, 0.25, 3), i2C = wear(IRON2, 0.25, 4), bC = wear(BRONZE, 0.3, 5);
  const P = (w, h, d, seed) => pl(w, h, d, { mat: 'wPaint', c: pC, c2: p2C, trim: 'wIron', trimC: iC, boltMat: 'wBrass', boltC: bC, seed });
  body.add(part((b) => {
    b.add(rb(3.0, 0.9, 7.6, 0.08), 'wPaint', { p: [0, 1.6, 0], c: p2C });
    for (const sx of [-1, 1]) { b.add(rb(0.34, 0.44, 7.8, 0.04), 'wIron', { p: [sx * 1.52, 1.9, 0], c: iC }); for (let i = 0; i < 3; i++) b.addBuilder(P(2.3, 0.7, 0.12, 5111 + i), { p: [sx * 1.6, 1.55, -2.5 + i * 2.5], r: [0, sx * PI / 2, 0] }); }
    b.add(rb(2.9, 0.1, 7.4, 0.02), 'wIron', { p: [0, 2.1, 0], c: i2C });
    // the square pedestal under the turning table
    b.add(rb(1.3, 0.6, 1.3, 0.05), 'wIron', { p: [0, 2.45, 1.0], c: i2C });
    for (const y of [2.25, 2.65]) b.add(rb(1.4, 0.07, 1.4, 0.02), 'wBrass', { p: [0, y, 1.0], c: bC });
    engineHouse(b, { w: 2.6, h: 1.9, d: 1.8, y: 2.15, z: -2.8, c: pC, ironC: iC, seed: 5116, stackX: -0.7 });
    bolts(b, 'wBrass', [-1.52, 2.1, -3.7], [-1.52, 2.1, 3.7], 13, 0.05, 'x', bC);
    bolts(b, 'wBrass', [1.52, 2.1, -3.7], [1.52, 2.1, 3.7], 13, 0.05, 'x', bC);
    // a flat square bow plate low across the front
    b.add(rb(3.6, 0.8, 0.24, 0.05), 'wPaint', { p: [0, 0.85, 4.0], c: p2C });
    b.add(rb(3.7, 0.12, 0.3, 0.02), 'wIron', { p: [0, 0.42, 4.02], c: iC });
    dust(b, 0, 2.15, 2.9, 2.6, 1.2);
  }, 5120));
  // the turning table, the clamp arms and the stack: all on one pivot that turns and lifts
  const table = pivot(body, 0, 2.8, 1.0);
  table.add(part((b) => {
    b.add(rb(3.0, 0.24, 3.0, 0.04), 'wIron', { p: [0, 0, 0], c: iC });
    b.add(rb(3.06, 0.08, 3.06, 0.02), 'wBrass', { p: [0, -0.1, 0], c: bC });
    oakStack(b, 0, 0.12, 0, 2.2, 1.6, 2.4, 6);
    // the clamp arms: straight square uprights at the table's two sides, a flat square clamp plate on each, pressed flat to the stack
    for (const sx of [-1, 1]) {
      b.add(rb(0.3, 2.1, 0.4, 0.04), 'wPaint', { p: [sx * 1.36, 0.95, 0], c: pC });
      b.add(rb(0.12, 1.3, 1.9, 0.03), 'wIron', { p: [sx * 1.16, 0.95, 0], c: i2C });
      b.add(rb(0.36, 0.12, 0.46, 0.02), 'wIron', { p: [sx * 1.36, 2.04, 0], c: iC });
    }
  }, 5125));
  const s1 = exhaust(0.7); s1.position.set(-0.7, 5.4, -3.2); body.add(s1);
  const dst = puff(1.5, 0.7); dst.position.set(0, 3.0, 1.0); body.add(dst);
  const glow = slotGlow(0xff9a40, 1.2, 0.36, 0.4, { ry: PI }); glow.position.set(0, 3.1, -3.72); body.add(glow);
  const a = new Anim(root, { base, body, wheels: TR.wheels, table });
  a.dynamics.push(s1, dst, glow);
  let dist = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.6), e = 1 - Math.pow(1 - k, 2);
      p.body.rotation.z = 0.05 * e; p.body.position.y = -0.2 * e; p.table.rotation.z = 0.12 * e;
      s1.visible = dst.visible = false; glow.material.opacity = 0.4 * (1 - k);
      return;
    }
    s1.visible = dst.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.6) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    p.body.position.y = Math.abs(Math.sin(this.t * 4)) * 0.03 * Math.min(1, this.speed);
    // idle: the table turns slowly back and forth a little; on an attack it lifts and turns a quarter round, then sets down
    let lift = 0, turn = Math.sin(this.t * 0.6) * 0.08;
    const at = this.stepAttack(dt);
    if (at >= 0) { lift = at < 0.3 ? at / 0.3 : at < 0.75 ? 1 : 1 - (at - 0.75) / 0.25; turn = (PI / 2) * Math.min(1, Math.max(0, (at - 0.25) / 0.45)); }
    p.table.position.y = 2.8 + 0.7 * lift; p.table.rotation.y = turn;
    dst.userData.rate = 1.5 + (at >= 0.7 && at < 0.85 ? 30 : 0);
    if (this.hitT > 0) { this.hitT -= dt * 3; p.body.rotation.z = Math.sin(this.t * 30) * this.hitT * 0.02; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  return finish(root, a, 5.2);
}

// ==========================================================================
// THE LOUVRE JACK (about 6 m tall, 7 m long)
// ==========================================================================
export function buildLouvreJack() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 3.6, len: 6.2, h: 1.2, tw: 0.9, paint: 'wPaint', paintC: PAINT2, linkC: '#4e4a44', road: 3, seed: 5210 });
  const body = pivot(base, 0, 0, 0);
  const pC = damp(PAINT, 1.5, 0.3, 11), p2C = damp(PAINT2, 1.5, 0.3, 12), iC = wear(IRON, 0.25, 13), i2C = wear(IRON2, 0.25, 14), bC = wear(BRONZE, 0.3, 15);
  const P = (w, h, d, seed) => pl(w, h, d, { mat: 'wPaint', c: pC, c2: p2C, trim: 'wIron', trimC: iC, boltMat: 'wBrass', boltC: bC, seed });
  const FZ = 1.5, PX = 1.3, PH = 5.2, JX = 2.15; // the frame at the front (posts' x, height) and the jack's x, outboard of the right post
  body.add(part((b) => {
    b.add(rb(3.2, 0.9, 6.6, 0.08), 'wPaint', { p: [0, 1.6, 0], c: p2C });
    for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) b.addBuilder(P(2.8, 0.7, 0.12, 5211 + i), { p: [sx * 1.62, 1.55, -1.6 + i * 3.0], r: [0, sx * PI / 2, 0] });
    b.add(rb(3.3, 0.12, 6.7, 0.02), 'wIron', { p: [0, 2.08, 0], c: iC });
    // the frame: two square posts and a flat head beam laid on top of them
    for (const sx of [-1, 1]) {
      b.add(rb(0.6, 0.4, 0.8, 0.04), 'wIron', { p: [sx * PX, 2.3, FZ], c: i2C });
      b.add(rb(0.4, PH - 2.1, 0.46, 0.04), 'wIron', { p: [sx * PX, 2.1 + (PH - 2.1) / 2, FZ], c: iC });
    }
    b.add(rb(PX * 2 + 0.8, 0.44, 0.66, 0.05), 'wPaint', { p: [0, PH + 0.22, FZ], c: pC });
    dust(b, 0, PH + 0.44, FZ, PX * 2 + 0.6, 0.5);
    // the louvre panel held in the frame: parallel slats, all set one way, a plain dark board behind them
    b.add(rb(PX * 2 - 0.4, PH - 2.8, 0.08, 0.02), 'wDark', { p: [0, 2.1 + (PH - 2.1) / 2, FZ - 0.12], c: DARK });
    for (let y = 2.55; y < PH - 0.3; y += 0.34) b.add(box(PX * 2 - 0.46, 0.26, 0.05), 'wPaint', { p: [0, y, FZ + 0.02], r: [0.35, 0, 0], c: wear(OAK, 0.2, Math.round(y * 10)) });
    // the jack's housing: a square column up the outboard side, its nut box at the top (the screw rides in it)
    b.add(rb(0.7, 0.5, 0.9, 0.04), 'wIron', { p: [JX, 2.35, FZ], c: i2C });
    b.add(rb(0.62, 0.7, 0.7, 0.04), 'wBrass', { p: [JX, PH - 0.2, FZ], c: bC });
    b.add(rb(0.34, 0.3, 0.5, 0.03), 'wIron', { p: [PX + 0.42, PH - 0.2, FZ], c: iC }); // (the nut box's bracket to the post: level)
    engineHouse(b, { w: 2.6, h: 1.8, d: 2.2, y: 2.15, z: -1.8, c: pC, ironC: iC, seed: 5216, stackX: -0.8 });
    bolts(b, 'wBrass', [-1.62, 2.0, -3.1], [-1.62, 2.0, 3.1], 12, 0.05, 'x', bC);
    bolts(b, 'wBrass', [1.62, 2.0, -3.1], [1.62, 2.0, 3.1], 12, 0.05, 'x', bC);
  }, 5220));
  // the screw: one straight square screw through the nut box, a flat square foot under it, outboard of the frame
  const screw = pivot(body, JX, 0, FZ);
  screw.add(part((b) => {
    b.add(rb(0.22, 3.4, 0.22, 0.02), 'wIron', { p: [0, 0, 0], c: '#6a6864' });
    for (let k = 0; k < 9; k++) b.add(rb(0.27, 0.05, 0.27, 0.01), 'wIron', { p: [0, -1.5 + k * 0.36, 0], c: '#55524e' }); // its thread, level bands
    b.add(rb(0.9, 0.18, 0.9, 0.03), 'wIron', { p: [0, -1.78, 0], c: '#5a5854' });
  }, 5225));
  const s1 = exhaust(0.7); s1.position.set(-0.8, 5.3, -2.2); body.add(s1);
  const dst = puff(1.2, 0.6); dst.position.set(JX, 0.6, FZ); body.add(dst);
  const glow = slotGlow(0xff9a40, 1.2, 0.34, 0.4, { ry: PI }); glow.position.set(0, 3.05, -2.92); body.add(glow);
  const a = new Anim(root, { base, body, wheels: TR.wheels, screw });
  a.dynamics.push(s1, dst, glow);
  let dist = 0;
  const TOP = 3.9, LOW = 2.2; // the screw's height: wound up, and down with its foot on the boards
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.4), e = 1 - Math.pow(1 - k, 2);
      p.body.rotation.x = 0.04 * e; p.body.position.y = -0.2 * e;
      s1.visible = dst.visible = false; glow.material.opacity = 0.4 * (1 - k);
      return;
    }
    s1.visible = dst.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.6) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    let y = LOW + (TOP - LOW) * (0.5 + 0.5 * Math.sin(this.t * 0.9 * ts)) * 0.4 + (TOP - LOW) * 0.6;
    const at = this.stepAttack(dt);
    if (at >= 0) y = at < 0.5 ? TOP : at < 0.6 ? TOP - (TOP - LOW) * ((at - 0.5) / 0.1) : LOW + (TOP - LOW) * Math.max(0, (at - 0.75) / 0.25);
    p.screw.position.y = y;
    p.body.position.y = at >= 0.58 && at < 0.66 ? -0.05 : Math.abs(Math.sin(this.t * 4)) * 0.02 * Math.min(1, this.speed);
    dst.userData.rate = at >= 0.58 && at < 0.8 ? 36 : 1.2;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.body.rotation.z = Math.sin(this.t * 30) * this.hitT * 0.02; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  return finish(root, a, 6.0);
}

// ==========================================================================
// THE LOUVRE ENGINE (the last boss, about 8 m tall, 10 m wide; it faces +z, its back to the north wall)
// ==========================================================================
export function buildLouvreEngine() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const hull = pivot(base, 0, 0, 0);
  const pC = damp(PAINT, 1.4, 0.3, 21), p2C = damp(PAINT2, 1.4, 0.3, 22), iC = wear(IRON, 0.25, 23), i2C = wear(IRON2, 0.25, 24), bC = wear(BRONZE, 0.3, 25);
  const P = (w, h, d, seed) => pl(w, h, d, { mat: 'wPaint', c: pC, c2: p2C, trim: 'wIron', trimC: iC, boltMat: 'wBrass', boltC: bC, seed });
  const W = 8.6, D = 5.0, H = 4.6;
  hull.add(part((b) => {
    // the stone plinth and the engine house on it
    b.add(rb(W + 0.8, 0.6, D + 0.8, 0.05), 'stoneDark', { p: [0, 0.3, 0], c: '#5e5a54' });
    b.add(rb(W, H, D, 0.1), 'wPaint', { p: [0, 0.6 + H / 2, -0.2], c: pC });
    for (const t of [0.25, 0.8]) b.add(rb(W + 0.08, 0.12, D + 0.08, 0.02), 'wIron', { p: [0, 0.6 + H * t, -0.2], c: iC });
    for (let i = 0; i < 3; i++) b.addBuilder(P(2.4, 1.6, 0.14, 4411 + i), { p: [-2.8 + i * 2.8, 0.6 + H * 0.52, D / 2 - 0.12], r: [0, 0, 0] });
    b.add(rb(W + 0.3, 0.16, D + 0.3, 0.03), 'wIron', { p: [0, 0.6 + H + 0.06, -0.2], c: i2C });
    // the cam box on the roof the rods ride in (a long square box along x)
    b.add(rb(W - 1.6, 0.9, 1.6, 0.06), 'wPaint', { p: [0, 0.6 + H + 0.58, -0.6], c: p2C });
    b.add(rb(W - 1.5, 0.1, 1.7, 0.02), 'wIron', { p: [0, 0.6 + H + 1.06, -0.6], c: iC });
    dust(b, 0, 0.6 + H + 0.14, 1.2, W - 1.0, 1.6);
    // the winding drum's two square bearing blocks at the front, low down
    for (const sx of [-1, 1]) b.add(rb(0.8, 1.6, 1.2, 0.05), 'wIron', { p: [sx * (W / 2 - 0.2), 1.4, D / 2 + 0.6], c: i2C });
    b.add(rb(W + 0.2, 0.3, 1.6, 0.04), 'stoneDark', { p: [0, 0.6, D / 2 + 0.6], c: '#56524c' });
    // one square stack and one gauge on the right flank
    b.addBuilder(stack(0.7, 2.2, { c: '#323230', trimC: iC, seed: 4417 }), { p: [-W / 2 + 1.0, 0.6 + H + 0.08, -1.9] });
    gauge(b, [W / 2 + 0.04, 0.6 + H * 0.55, 0.6], H * 0.3, PI / 2);
    b.addBuilder(vent(2.6, 1.2, { frameC: DARK, glow: 'wGlowOrange', seed: 4418 }), { p: [1.6, 0.6 + H * 0.35, -0.2 - D / 2 - 0.02], r: [0, PI, 0] });
    bolts(b, 'wBrass', [-W / 2 + 0.2, 0.6 + H * 0.25, D / 2 - 0.06], [W / 2 - 0.2, 0.6 + H * 0.25, D / 2 - 0.06], 18, 0.06, 'z', bC);
  }, 4420));
  // the winding drum: a long solid drum along x across the front, rope wound on it, plain round ends at the flanks
  const drum = pivot(hull, 0, 1.55, D / 2 + 0.6);
  drum.add(part((b) => {
    b.add(cyl(0.72, 0.72, W - 1.0, 24), 'wIron', { p: [0, 0, 0], r: [0, 0, PI / 2], c: '#4e4a44' });
    b.add(cyl(0.76, 0.76, W - 2.4, 24), 'wPaint', { p: [0, 0, 0], r: [0, 0, PI / 2], c: wear('#8a7a5a', 0.2, 4419) }); // the rope on it
    for (let k = 0; k < 6; k++) b.add(box(0.1, 0.06, 1.48), 'wIron', { p: [-W / 2 + 0.9 + k * 0.05, 0.74, 0], c: '#5e5a54' }); // one bolt bar, so the turning shows
  }, 4421));
  // the louvre rods: six square rods side by side out of the cam box, all upright, each with a square cap
  const rods = [];
  for (let i = 0; i < 6; i++) {
    const r = pivot(hull, -2.75 + i * 1.1, 0.6 + H + 1.0, -0.6);
    r.add(part((b) => { b.add(rb(0.28, 2.4, 0.28, 0.03), 'wIron', { p: [0, 1.2, 0], c: iC }); b.add(rb(0.44, 0.2, 0.44, 0.03), 'wBrass', { p: [0, 2.45, 0], c: bC }); }, 4430 + i));
    rods.push(r);
  }
  const s1 = exhaust(1.0); s1.position.set(-W / 2 + 1.0, 0.6 + H + 2.6, -1.9); hull.add(s1);
  const dst = puff(2, 0.9); dst.position.set(0, 0.8, D / 2 + 1.6); hull.add(dst);
  const glow = slotGlow(0xff9a40, 2.2, 0.5, 0.45, { ry: PI }); glow.position.set(1.6, 0.6 + H * 0.35, -0.2 - D / 2 - 0.05); hull.add(glow);
  const a = new Anim(root, { base, hull, drum, rods });
  a.dynamics.push(s1, dst, glow);
  a.update = function (dt) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 2.0), e = 1 - Math.pow(1 - k, 3);
      p.hull.position.y = -0.1 * e; p.rods.forEach((r, i) => { r.position.y = 0.6 + H + 1.0 - 0.6 * e * (i % 2 ? 1 : 0.7); });
      s1.visible = dst.visible = false; glow.material.opacity = 0.45 * (1 - k);
      return;
    }
    s1.visible = dst.visible = true;
    const ts = this.stun ? 0.15 : 1;
    let beat = 1.2, heave = 0.35, spin = 0.3;
    const at = this.stepAttack(dt);
    if (at >= 0) { beat = 4; heave = 0.9; spin = 2.2; }
    p.rods.forEach((r, i) => { r.position.y = 0.6 + H + 1.0 + heave * Math.max(0, Math.sin(this.t * beat * ts - i * 0.9)); });
    p.drum.rotation.x += spin * dt * ts;
    p.hull.position.y = Math.abs(Math.sin(this.t * 6)) * 0.015;
    dst.userData.rate = at >= 0.4 && at < 0.7 ? 34 : 2;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.hull.rotation.z = Math.sin(this.t * 30) * this.hitT * 0.012; } else p.hull.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  return finish(root, a, 8.2);
}
