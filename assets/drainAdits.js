// The Drain Adits (Part Fourteen, level 65 dungeon in the stone-lined drainage tunnels under the Seed Terraces of the Rainward
// Gorge): three machine bosses of wet dark-green paint, oiled iron and old bronze, caked red-brown with gorge mud from the
// treads up, moss along their top edges, mud sliding off them.
//  - The Spoil Tipper: the tracked skip that carried the spoil out of the adits. A long tracked bed, a deep square skip on it
//    (an open box, square from above, heaped with wet spoil) hinged at its front sill so it tips forward over the bow, two
//    square tipping rams under its back, and a square engine house at the stern with one square stack and one gauge strip.
//  - The Sump Ram: the tamper that seated the sumps' grates. A tracked base carrying a square guide frame (two square posts
//    and a flat head beam on top of them, nothing rising through it), a heavy square tamper block that rides up and down
//    between the posts on a single straight chain hung under the head beam, a flat square foot under the block, and a square
//    engine house behind.
//  - The Adit Driver (the last boss): the Makers' great drain-boring machine. A wide heavy tracked base, a long square boom
//    casing on square saddles pitched down to the front, the boring head (three plain stepped discs, one square bolt plate
//    off centre on each step, nothing at the centre: no tip, no hub, no teeth) turning under a deep square shroud so it never
//    shows to the front or to the sky as a round disc, a straight spoil conveyor in a square trough along its right flank, a
//    rack of clay drain pipes laid parallel along its left, and a square engine house at the back with one square stack.
// Same interface as the other machines: userData.machine = { update(dt, speed), attack(dur, kind), hit(), die(), revive(), stun }.
// Content rules: no faces (no lamps at all; one gauge strip each, never a pair; no openings in pairs on a face), nothing
// animal-like (treads, boxes and flat plates, never claws, jaws, horns or legs), no spokes (solid discs), no radiating teeth
// or rays on the head, no domes, rings or stars, nothing crossed (rams, chains and pipes run one way), everything square from
// straight above.
import * as THREE from 'three';
import { rbox, box, cyl, ico, rgb } from './kit.js';
import { plate, vent, stack, heroTreads, crawl, wear, bolts, bdisc, sub } from './bossParts.js';
import { smoke } from './dynamic.js';
import { slotGlow } from './slotGlow.js';
import { Anim, finish, part, pivot } from './quarryMachines.js';

const PI = Math.PI;
const rb = (w, h, d, r) => rbox(w, h, d, r, 1);
const pl = (w, h, d, o = {}) => plate(w, h, d, { br: Math.max(0.035, Math.min(0.07, Math.min(w, h) * 0.05)), ...o });
// wet dark-green paint, its second shade, oiled iron, dark iron, old bronze, red-brown gorge mud, moss
const PAINT = '#4c5848', PAINT2 = '#3e4a3c', IRON = '#4a4c48', IRON2 = '#3a3c38', BRONZE = '#8a7444', MUD = '#6a4a3a', MUD2 = '#7c5a44', MOSS = '#4e5e38', MOSS2 = '#5c6c40', DARK = '#262422', CLAY = '#9c6448', CLAY2 = '#8a5840';

// paint darkened and reddened toward the foot of a part (below `low`), where the mud splashes up
function muddy(base, low = 0.6, amt = 0.3, seed = 0) {
  const f = wear(base, amt, seed), M = rgb(MUD);
  return (x, y, z) => { const c = f(x, y, z), k = y < low ? Math.min(1, (low - y) / 0.8) * 0.55 : 0; return [c[0] * (1 - k) + M[0] * k, c[1] * (1 - k) + M[1] * k, c[2] * (1 - k) + M[2] * k]; };
}
// caked mud: one flattened slab first (so the lumps never read as dots), then flattened lumps on it
function mud(b, cx, y, cz, w, d, n, s = 0.12) {
  if (w > s && d > s) b.add(rb(w * 0.92 + s, s * 0.45, d * 0.92 + s, s * 0.2), 'wPaint', { p: [cx, y - s * 0.05, cz], c: wear(MUD, 0.14, n) });
  for (let i = 0; i < n; i++) b.add(ico(s * b.r(0.6, 1.15), 0), 'wPaint', { p: [cx + b.r(-w / 2, w / 2), y, cz + b.r(-d / 2, d / 2)], s: [1.7, 0.4, 1.3], r: [0, b.r(0, 3), 0], c: wear(i % 2 ? MUD : MUD2, 0.12, i) });
}
// moss pads along a top face (soft overlapping patches)
function moss(b, cx, y, cz, w, d, n, s = 0.14) {
  for (let i = 0; i < n; i++) { const pw = b.r(0.35, 0.7) * w, pd = b.r(0.35, 0.7) * d; b.add(rb(pw, s * 0.35, pd, s * 0.15), 'wPaint', { p: [cx + b.r(-0.5, 0.5) * (w - pw), y, cz + b.r(-0.5, 0.5) * (d - pd)], c: wear(i % 2 ? MOSS : MOSS2, 0.2, i + 7) }); }
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
  moss(b, x - w * 0.1, y + h + 0.11, z + d * 0.1, w * 0.6, d * 0.6, 3);
}
const ooze = (rate = 2, size = 0.6) => smoke({ rate, life: 1.2, size, rise: -0.5, color: 0x6a4a3a, opacity: 0.5, spread: 0.4 });
const exhaust = (size = 0.7) => smoke({ rate: 2.2, life: 2.4, size, rise: 1.2, color: 0x8a8884, opacity: 0.4, spread: 0.18 });

// ==========================================================================
// THE SPOIL TIPPER (about 4.8 m tall, 8.6 m long)
// ==========================================================================
export function buildSpoilTipper() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 3.4, len: 7.2, h: 1.3, tw: 0.9, paint: 'wPaint', paintC: PAINT2, linkC: '#4e4a44', road: 3, seed: 4110 });
  const body = pivot(base, 0, 0, 0);
  const pC = muddy(PAINT, 1.6, 0.3, 1), p2C = muddy(PAINT2, 1.6, 0.3, 2), iC = wear(IRON, 0.25, 3), i2C = wear(IRON2, 0.25, 4), bC = wear(BRONZE, 0.3, 5);
  const P = (w, h, d, seed) => pl(w, h, d, { mat: 'wPaint', c: pC, c2: p2C, trim: 'wIron', trimC: iC, boltMat: 'wBrass', boltC: bC, seed });
  body.add(part((b) => {
    // the bed: a long frame over the treads, iron sills, a flat deck
    b.add(rb(3.0, 0.9, 8.0, 0.08), 'wPaint', { p: [0, 1.7, 0], c: p2C });
    for (const sx of [-1, 1]) { b.add(rb(0.34, 0.44, 8.2, 0.04), 'wIron', { p: [sx * 1.52, 2.0, 0], c: iC }); for (let i = 0; i < 3; i++) b.addBuilder(P(2.4, 0.7, 0.12, 4111 + i), { p: [sx * 1.6, 1.62, -2.6 + i * 2.6], r: [0, sx * PI / 2, 0] }); }
    b.add(rb(2.9, 0.1, 7.8, 0.02), 'wIron', { p: [0, 2.2, 0], c: i2C });
    // the hinge sill at the front of the skip (one long square bar across the bed's width) and the skip's rest at the back
    b.add(rb(3.0, 0.3, 0.4, 0.04), 'wIron', { p: [0, 2.4, 2.4], c: iC });
    b.add(rb(2.6, 0.24, 0.5, 0.04), 'wIron', { p: [0, 2.36, -1.4], c: iC });
    // the two tipping rams' square sleeves, under the back of the skip, side by side and upright (lowered they sit in the bed)
    for (const sx of [-0.8, 0.8]) b.add(rb(0.36, 0.5, 0.36, 0.04), 'wIron', { p: [sx, 2.45, -0.9], c: i2C });
    // the engine house at the stern
    engineHouse(b, { w: 2.6, h: 1.9, d: 1.8, y: 2.25, z: -3.0, c: pC, ironC: iC, seed: 4116, stackX: -0.7 });
    bolts(b, 'wBrass', [-1.52, 2.2, -3.9], [-1.52, 2.2, 3.9], 14, 0.05, 'x', bC);
    bolts(b, 'wBrass', [1.52, 2.2, -3.9], [1.52, 2.2, 3.9], 14, 0.05, 'x', bC);
    mud(b, 0, 2.28, 3.4, 2.4, 0.9, 6, 0.12);
    // a flat square bow plate (a scraper blade across the front, low down)
    b.add(rb(3.6, 0.9, 0.24, 0.05), 'wPaint', { p: [0, 0.9, 4.2], c: p2C });
    b.add(rb(3.7, 0.12, 0.3, 0.02), 'wIron', { p: [0, 0.45, 4.22], c: iC });
    mud(b, 0, 0.5, 4.5, 3.2, 0.4, 6, 0.1);
  }, 4120));
  // the skip: an open square box hinged at its front lower edge (the pivot), heaped with wet spoil
  const skip = pivot(body, 0, 2.55, 2.4);
  skip.add(part((b) => {
    const L = 4.0, Wd = 2.9, H = 1.5;
    b.add(rb(Wd, 0.16, L, 0.04), 'wPaint', { p: [0, 0.08, -L / 2], c: p2C }); // floor
    for (const sx of [-1, 1]) b.addBuilder(P(L, H, 0.14, 4121 + (sx > 0 ? 1 : 0)), { p: [sx * (Wd / 2 - 0.07), H / 2, -L / 2], r: [0, sx * PI / 2, 0] });
    b.add(rb(Wd, H * 0.8, 0.14, 0.04), 'wPaint', { p: [0, H * 0.4, -0.07], c: pC }); // the low front lip
    b.add(rb(Wd, H, 0.14, 0.04), 'wPaint', { p: [0, H / 2, -L + 0.07], c: pC }); // the back
    for (const y of [0.2, H - 0.06]) b.add(rb(Wd + 0.08, 0.1, L + 0.04, 0.02), 'wIron', { p: [0, y, -L / 2], c: iC }); // bands round it
    // the spoil heaped inside, a flat mass with lumps (never a dome: a low lopsided slab)
    b.add(rb(Wd - 0.3, 0.6, L - 0.4, 0.2), 'wPaint', { p: [0, H - 0.2, -L / 2], c: wear(MUD, 0.16, 9) });
    mud(b, 0.2, H + 0.12, -L / 2 - 0.2, Wd - 0.6, L - 0.8, 12, 0.18);
    for (let k = 0; k < 4; k++) b.add(ico(0.2 + 0.05 * k, 0), 'stoneDark', { p: [-0.9 + k * 0.6, H + 0.22, -1.0 - (k % 2) * 1.6], s: [1.2, 0.7, 1.0], c: '#5e5c56' });
    moss(b, 0, H + 0.02, -L + 0.07, Wd * 0.8, 0.1, 2, 0.1);
  }, 4125));
  const rams = pivot(body, 0, 2.7, -0.9);
  rams.add(part((b) => { for (const sx of [-0.8, 0.8]) b.add(rb(0.22, 1.2, 0.22, 0.03), 'wIron', { p: [sx, 0.1, 0], c: '#6a6c6a' }); }, 4126));
  const s1 = exhaust(0.7); s1.position.set(-0.7, 5.6, -3.4); body.add(s1);
  const drip = ooze(2, 0.6); drip.position.set(0, 2.6, 3.1); body.add(drip);
  const glow = slotGlow(0xff9a40, 1.2, 0.36, 0.4, { ry: PI }); glow.position.set(0, 3.2, -3.92); body.add(glow);
  const a = new Anim(root, { base, body, wheels: TR.wheels, skip, rams });
  a.dynamics.push(s1, drip, glow);
  let dist = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.6), e = 1 - Math.pow(1 - k, 2);
      p.body.rotation.z = 0.05 * e; p.body.position.y = -0.2 * e; p.skip.rotation.x = 0.35 * e; p.rams.scale.y = 1;
      s1.visible = drip.visible = false; glow.material.opacity = 0.4 * (1 - k);
      return;
    }
    s1.visible = drip.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.65) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    p.body.position.y = Math.abs(Math.sin(this.t * 4)) * 0.03 * Math.min(1, this.speed);
    let tip = 0;
    const at = this.stepAttack(dt);
    if (at >= 0) tip = at < 0.45 ? at / 0.45 : at < 0.7 ? 1 : 1 - (at - 0.7) / 0.3; // the skip lifts at the back and tips forward, then settles
    p.skip.rotation.x = 0.7 * tip; // +x tips the back up (the box hangs back from its front hinge)
    p.rams.scale.y = 1 + 1.6 * tip; p.rams.position.y = 2.7 + 0.6 * tip;
    drip.userData.rate = 2 + tip * 30;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.body.rotation.z = Math.sin(this.t * 30) * this.hitT * 0.02; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  return finish(root, a, 4.8);
}

// ==========================================================================
// THE SUMP RAM (about 6 m tall, 7 m long)
// ==========================================================================
export function buildSumpRam() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 3.6, len: 6.2, h: 1.2, tw: 0.9, paint: 'wPaint', paintC: PAINT2, linkC: '#4e4a44', road: 3, seed: 4210 });
  const body = pivot(base, 0, 0, 0);
  const pC = muddy(PAINT, 1.6, 0.3, 11), p2C = muddy(PAINT2, 1.6, 0.3, 12), iC = wear(IRON, 0.25, 13), i2C = wear(IRON2, 0.25, 14), bC = wear(BRONZE, 0.3, 15);
  const P = (w, h, d, seed) => pl(w, h, d, { mat: 'wPaint', c: pC, c2: p2C, trim: 'wIron', trimC: iC, boltMat: 'wBrass', boltC: bC, seed });
  const FZ = 1.6, PX = 1.45, PH = 5.4; // the guide frame at the front: its posts' x and height
  body.add(part((b) => {
    b.add(rb(3.2, 0.9, 6.6, 0.08), 'wPaint', { p: [0, 1.6, 0], c: p2C });
    for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) b.addBuilder(P(2.8, 0.7, 0.12, 4211 + i), { p: [sx * 1.62, 1.55, -1.6 + i * 3.0], r: [0, sx * PI / 2, 0] });
    b.add(rb(3.3, 0.12, 6.7, 0.02), 'wIron', { p: [0, 2.08, 0], c: iC });
    // the guide frame: two square posts on square feet and a flat head beam laid on top of them (nothing rises through it)
    for (const sx of [-1, 1]) {
      b.add(rb(0.7, 0.4, 0.9, 0.04), 'wIron', { p: [sx * PX, 2.3, FZ], c: i2C });
      b.add(rb(0.44, PH - 2.1, 0.5, 0.04), 'wIron', { p: [sx * PX, 2.1 + (PH - 2.1) / 2, FZ], c: iC });
      for (const y of [2.8, 4.0]) b.add(rb(0.5, 0.08, 0.56, 0.02), 'wBrass', { p: [sx * PX, y, FZ], c: bC });
      // a square brace from each post back to the bed (in the side plane only: from the front it hides behind the post)
      b.add(rb(0.22, 0.22, 2.0, 0.03), 'wIron', { p: [sx * PX, 3.2, FZ - 1.0], r: [0.75, 0, 0], c: i2C });
    }
    b.add(rb(PX * 2 + 0.9, 0.5, 0.7, 0.05), 'wPaint', { p: [0, PH + 0.25, FZ], c: pC });
    b.add(rb(PX * 2 + 1.0, 0.1, 0.8, 0.02), 'wIron', { p: [0, PH + 0.55, FZ], c: iC });
    moss(b, 0, PH + 0.62, FZ, PX * 2, 0.5, 3, 0.12);
    // the chain's square block under the head beam
    b.add(rb(0.4, 0.3, 0.4, 0.03), 'wIron', { p: [0, PH - 0.12, FZ], c: i2C });
    // a square pit-plate in the bed under the frame where the foot lands (the tamper drops through the bed's open front)
    b.add(rb(2.4, 0.08, 1.3, 0.02), 'wIron', { p: [0, 2.12, FZ], c: '#2e302c' });
    engineHouse(b, { w: 2.6, h: 1.8, d: 2.2, y: 2.15, z: -1.8, c: pC, ironC: iC, seed: 4216, stackX: -0.8 });
    bolts(b, 'wBrass', [-1.62, 2.0, -3.1], [-1.62, 2.0, 3.1], 12, 0.05, 'x', bC);
    bolts(b, 'wBrass', [1.62, 2.0, -3.1], [1.62, 2.0, 3.1], 12, 0.05, 'x', bC);
    mud(b, 0.3, 2.16, 0.0, 2.4, 0.8, 5, 0.12);
  }, 4220));
  // the tamper: a heavy square block between the posts, a flat square foot under it, on one straight chain
  const tamp = pivot(body, 0, 0, FZ);
  tamp.add(part((b) => {
    b.add(rb(2.1, 1.2, 0.9, 0.06), 'wPaint', { p: [0, 0, 0], c: pC });
    for (const y of [-0.4, 0.4]) b.add(rb(2.16, 0.1, 0.96, 0.02), 'wIron', { p: [0, y, 0], c: iC });
    b.add(rb(0.5, 0.7, 0.5, 0.04), 'wIron', { p: [0, -0.9, 0], c: i2C }); // the foot's square shank
    b.add(rb(2.4, 0.2, 1.3, 0.04), 'wIron', { p: [0, -1.32, 0], c: '#5a5c58' }); // the flat foot
    mud(b, 0, -1.2, 0, 2.2, 1.1, 6, 0.1);
    mud(b, 0, 0.63, 0, 1.8, 0.7, 4, 0.08);
  }, 4225));
  const chain = pivot(body, 0, PH - 0.27, FZ);
  chain.add(part((b) => { for (let k = 0; k < 10; k++) b.add(rb(k % 2 ? 0.05 : 0.14, 0.2, k % 2 ? 0.14 : 0.05, 0.02), 'wIron', { p: [0, -0.1 - k * 0.18, 0], c: '#5e5c58' }); }, 4226));
  const s1 = exhaust(0.7); s1.position.set(-0.8, 5.3, -2.2); body.add(s1);
  const drip = ooze(1.5, 0.6); drip.position.set(0, 1.6, FZ); body.add(drip);
  const glow = slotGlow(0xff9a40, 1.2, 0.34, 0.4, { ry: PI }); glow.position.set(0, 3.05, -2.92); body.add(glow);
  const a = new Anim(root, { base, body, wheels: TR.wheels, tamp, chain });
  a.dynamics.push(s1, drip, glow);
  let dist = 0;
  const TOP = 4.3, LOW = 2.9; // the block's height: raised, and set down with its foot on the bed's plate
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.4), e = 1 - Math.pow(1 - k, 2);
      p.tamp.position.y = LOW + (p.tamp.position.y - LOW) * (1 - e * 0.2); p.body.rotation.x = 0.04 * e; p.body.position.y = -0.2 * e;
      s1.visible = drip.visible = false; glow.material.opacity = 0.4 * (1 - k);
      return;
    }
    s1.visible = drip.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.6) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    // idle: a slow tamping beat; on an attack it hauls the block right up and drops it
    let y = LOW + (TOP - LOW) * 0.5 * (0.5 - 0.5 * Math.cos(this.t * 1.6 * ts));
    const at = this.stepAttack(dt);
    if (at >= 0) y = at < 0.55 ? LOW + (TOP - LOW) * (at / 0.55) : at < 0.62 ? TOP - (TOP - LOW) * ((at - 0.55) / 0.07) : LOW;
    p.tamp.position.y = y;
    p.chain.scale.y = Math.max(0.3, (5.4 - 0.27 - (y + 0.6)) / 1.8);
    p.body.position.y = at >= 0.62 && at < 0.7 ? -0.05 : Math.abs(Math.sin(this.t * 4)) * 0.02 * Math.min(1, this.speed);
    drip.userData.rate = at >= 0.6 && at < 0.8 ? 40 : 1.5;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.body.rotation.z = Math.sin(this.t * 30) * this.hitT * 0.02; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  return finish(root, a, 6.0);
}

// ==========================================================================
// THE ADIT DRIVER (the last boss, about 7 m tall, 12 m long)
// ==========================================================================
export function buildAditDriver() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 5.2, len: 9.0, h: 1.7, tw: 1.2, paint: 'wPaint', paintC: PAINT2, linkC: '#4e4a44', road: 4, seed: 4310 });
  const hull = pivot(base, 0, 0, 0);
  const pC = muddy(PAINT, 2.2, 0.32, 21), p2C = muddy(PAINT2, 2.2, 0.3, 22), iC = wear(IRON, 0.25, 23), i2C = wear(IRON2, 0.25, 24), bC = wear(BRONZE, 0.3, 25);
  const P = (w, h, d, seed) => pl(w, h, d, { mat: 'wPaint', c: pC, c2: p2C, trim: 'wIron', trimC: iC, boltMat: 'wBrass', boltC: bC, seed });
  hull.add(part((b) => {
    // the hull: a heavy box over the treads, plated flanks, an iron deck
    b.add(rb(4.6, 1.4, 9.4, 0.1), 'wPaint', { p: [0, 2.3, -0.3], c: p2C });
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) b.addBuilder(P(2.9, 1.0, 0.14, 4311 + i), { p: [sx * 2.32, 2.3, -3.3 + i * 3.0], r: [0, sx * PI / 2, 0] });
    b.add(rb(4.8, 0.14, 9.6, 0.03), 'wIron', { p: [0, 3.05, -0.3], c: iC });
    // the boom's two square saddles and the long square boom casing, banded
    for (const z of [-0.6, 2.2]) b.add(rb(1.9, 0.8, 0.8, 0.05), 'wIron', { p: [0, 3.5, z], c: i2C });
    b.add(rb(1.6, 1.4, 6.4, 0.08), 'wPaint', { p: [0, 4.4, 1.2], c: pC });
    for (const z of [-1.2, 0.6, 2.4, 4.0]) b.add(rb(1.7, 1.5, 0.12, 0.02), 'wIron', { p: [0, 4.4, z], c: iC });
    moss(b, 0, 5.13, 1.0, 1.4, 5.6, 5, 0.14);
    // the engine house at the back, one stack
    engineHouse(b, { w: 4.0, h: 2.6, d: 2.6, y: 3.1, z: -3.6, c: pC, ironC: iC, seed: 4316, stackX: -1.2, stackW: 0.6, stackH: 2.0 });
    // the spoil conveyor along the right flank: a straight square trough rising from the front to a chute at the back, the
    // belt in it heaped with spoil (no slats across it)
    b.add(rb(0.9, 0.5, 8.0, 0.04), 'wPaint', { p: [2.9, 3.4, -0.2], r: [-0.14, 0, 0], c: p2C });
    for (const sx of [-1, 1]) b.add(rb(0.08, 0.6, 8.1, 0.02), 'wIron', { p: [2.9 + sx * 0.46, 3.55, -0.2], r: [-0.14, 0, 0], c: iC });
    for (const z of [-3, 0, 3]) b.add(rb(0.5, 1.0, 0.5, 0.04), 'wIron', { p: [2.9, 2.7 + (z < 0 ? 0.4 : 0), z], c: i2C });
    mud(b, 2.9, 3.78, -0.4, 0.6, 6.4, 10, 0.12);
    b.add(rb(1.1, 0.9, 1.0, 0.05), 'wPaint', { p: [2.9, 3.6, -4.3], c: pC }); // the chute at the back
    // the pipe rack along the left flank: straight clay drain pipes laid along z, parallel, on two square cradles
    for (const z of [-2.2, 1.6]) b.add(rb(1.0, 0.16, 0.2, 0.02), 'wIron', { p: [-2.9, 3.18, z], c: iC });
    for (let i = 0; i < 3; i++) b.add(cyl(0.16, 0.16, 5.2, 10), 'wPaint', { p: [-3.2 + i * 0.32, 3.44, -0.3], r: [PI / 2, 0, 0], c: wear(i % 2 ? CLAY2 : CLAY, 0.25, i) });
    b.add(cyl(0.16, 0.16, 4.4, 10), 'wPaint', { p: [-2.98, 3.74, -0.6], r: [PI / 2, 0, 0], c: wear(CLAY, 0.25, 7) });
    bolts(b, 'wBrass', [-2.32, 2.9, -4.6], [-2.32, 2.9, 4.0], 18, 0.06, 'x', bC);
    bolts(b, 'wBrass', [2.32, 2.9, -4.6], [2.32, 2.9, 4.0], 18, 0.06, 'x', bC);
    mud(b, 0, 3.14, 3.6, 3.8, 1.4, 8, 0.14);
  }, 4320));
  // the shroud: a deep square hood off the boom's front, its top plate covering the head from above, square cheeks
  hull.add(part((b) => {
    b.add(rb(3.4, 0.16, 2.6, 0.04), 'wPaint', { p: [0, 5.15, 5.4], c: pC });
    for (const sx of [-1, 1]) b.add(rb(0.16, 2.8, 2.6, 0.04), 'wPaint', { p: [sx * 1.62, 3.85, 5.4], c: p2C });
    b.add(rb(3.5, 0.2, 0.2, 0.03), 'wIron', { p: [0, 5.15, 6.7], c: iC });
    b.add(rb(3.6, 2.7, 0.24, 0.04), 'wPaint', { p: [0, 3.85, 6.66], c: p2C }); // its front plate, down to the cheeks' foot: the head is never seen face on
    for (const y of [3.0, 4.6]) b.add(rb(3.66, 0.12, 0.3, 0.02), 'wIron', { p: [0, y, 6.68], c: iC });
    mud(b, 0, 5.28, 5.4, 3.0, 2.2, 6, 0.12);
    moss(b, 0, 5.25, 5.0, 2.8, 1.6, 3, 0.12);
  }, 4321));
  // the ram out of the boom, pitched steeply down, and the head on it: three plain stepped discs (nothing at the centre)
  const tilt = pivot(hull, 0, 4.3, 4.4);
  tilt.rotation.x = 1.2;
  const ram = pivot(tilt, 0, 0, 0);
  ram.add(part((b) => {
    b.add(rb(0.9, 0.9, 1.8, 0.06), 'wIron', { p: [0, 0, 0.5], c: '#5e5c58' });
    b.add(rb(1.1, 1.1, 0.2, 0.03), 'wIron', { p: [0, 0, 0.0], c: iC });
  }, 4322));
  const head = pivot(ram, 0, 0, 1.6);
  const hC = wear('#55524c', 0.25, 4314);
  head.add(part((b) => {
    const steps = [[1.5, 0.45, 0.0], [1.12, 0.42, 0.45], [0.74, 0.38, 0.87]];
    steps.forEach(([r, w, z], i) => {
      b.add(bdisc(r, w, w * 0.25, 28), 'wIron', { p: [0, 0, z + w / 2], r: [PI / 2, 0, 0], c: hC });
      const a2 = i * 2.1;
      b.add(rb(r * 0.3, r * 0.3, 0.1, 0.02), 'wIron', { p: [Math.cos(a2) * r * 0.62, Math.sin(a2) * r * 0.62, z + w + 0.04], c: '#6e6a64' });
    });
    mud(b, 0, -1.2, 0.3, 1.0, 0.6, 4, 0.12);
  }, 4315));
  const s1 = exhaust(1.0); s1.position.set(-1.2, 7.9, -4.1); hull.add(s1);
  const spoil = ooze(2, 0.9); spoil.position.set(0, 0.2, 1.4); head.add(spoil);
  const chute = ooze(3, 0.7); chute.position.set(2.9, 3.2, -4.8); hull.add(chute);
  const glow = slotGlow(0xff9a40, 1.8, 0.5, 0.45, { ry: PI }); glow.position.set(0, 4.4, -4.93); hull.add(glow);
  const a = new Anim(root, { base, hull, ram, head, wheels: TR.wheels });
  a.dynamics.push(s1, chute, glow);
  let dist = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 2.0), e = 1 - Math.pow(1 - k, 3);
      p.hull.rotation.x = 0.06 * e; p.hull.rotation.z = 0.04 * e; p.hull.position.y = -0.2 * e; p.ram.position.z = -0.6 * e;
      s1.visible = spoil.visible = chute.visible = false; glow.material.opacity = 0.45 * (1 - k);
      return;
    }
    s1.visible = spoil.visible = chute.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.85) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    p.hull.position.y = Math.abs(Math.sin(this.t * 7)) * 0.025; // the whole machine shudders as it bores
    let rate = 0.6, rz = 0, sr = 2;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      // the head spins up and the ram draws back, then drives it down into the floor ahead
      const back = at < 0.35 ? at / 0.35 : 1, drive = at < 0.35 ? 0 : Math.min(1, (at - 0.35) / 0.12), rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
      rate = 2.4; rz = (-0.8 * back + 1.4 * drive) * (1 - rec);
      p.hull.rotation.x = 0.03 * drive * (1 - rec);
      if (drive > 0 && rec === 0) sr = 40;
    } else p.hull.rotation.x = 0;
    p.ram.position.z = rz;
    p.head.rotation.z += rate * dt * ts * PI * 2;
    spoil.userData.rate = sr;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.hull.rotation.z = Math.sin(this.t * 30) * this.hitT * 0.015; } else p.hull.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
    spoil.userData.update?.(dt, this.t);
  };
  return finish(root, a, 7.0);
}
