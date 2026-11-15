// The Sea Gate (Part Thirteen, the ten-player raid inside the Makers' barrage across the mouth of Tidewater Sound): four
// machine bosses of salt-eaten iron, tarred timber and old bronze, dark below a pale salt line where the galleries flood,
// grey silt caked on their treads, sea water running off them.
//  - The Gate Winch: a tracked winch house. Two square timber cheeks carry a solid chain drum (a plain cylinder along x,
//    its ends plain discs), the chain runs straight down the front to a square counterweight block, one square stack, one
//    gauge strip at the back. On a strike the drum runs free and the counterweight drops, then winds back up.
//  - The Silt Ram: a long tracked culvert scraper. A square silt hopper at the stern heaped with silt, a square ram beam
//    running in a square sleeve along the bed, a flat square ram head on its end that drives out on a strike.
//  - The Sluice Carriage: a carriage on eight solid rail wheels (plain discs). Two tall square posts and a flat head beam
//    carry a timber gate leaf banded in iron (all bands one way) that rises and drops in its guides on a strike.
//  - The Tide Engine (the last boss, it never moves): a square engine house on a stone plinth, two square cylinder casings
//    at its back, a straight toothed rack up its front lifting a gate leaf, a walking beam on one square pillar over the
//    top (one beam, one way), a solid flywheel on its right flank, one square stack, one gauge strip, sea water pouring
//    off the leaf.
// Same interface as the other machines: userData.machine = { update(dt, speed), attack(dur, kind), hit(), die(), revive(), stun }.
// Content rules: no faces (no lamps; a single gauge strip, never a pair, kept off the front), nothing animal-like (treads,
// flat plates and square blocks, never claws, jaws or legs), no spokes (solid discs), no domes, rings, stars or radiating
// patterns, nothing crossed (every beam, band and chain runs one way), everything square from above.
import * as THREE from 'three';
import { box, rbox, cyl, ico } from './kit.js';
import { plate, heroTreads, crawl, wear, grime, bolts, bdisc, flywheel, stack } from './bossParts.js';
import { smoke } from './dynamic.js';
import { slotGlow } from './slotGlow.js';
import { Anim, finish, part, pivot } from './quarryMachines.js';

const PI = Math.PI;
const rb = (w, h, d, r) => rbox(w, h, d, r, 1);
const pl = (w, h, d, o = {}) => plate(w, h, d, { br: Math.max(0.035, Math.min(0.07, Math.min(w, h) * 0.05)), ...o });
// salt-eaten iron, its darker plate, tarred timber, old bronze, tar black, silt, salt
const IRON = '#5a5e60', IRON2 = '#46494c', WOOD = '#5e4c3a', WOOD2 = '#4a3c2e', BRONZE = '#7a6a3e', TAR = '#2a2622', SILT = '#5a5148', SALT = '#dcd8ce';

function silt(b, cx, y, cz, w, d, n, s = 0.12) {
  for (let i = 0; i < n; i++) b.add(ico(s * b.r(0.6, 1.2), 0), 'wPaint', { p: [cx + b.r(-w / 2, w / 2), y, cz + b.r(-d / 2, d / 2)], s: [1.7, 0.4, 1.3], r: [0, b.r(0, 3), 0], c: wear(SILT, 0.15, i) });
}
function saltLine(b, w, d, y, cx = 0, cz = 0) { b.add(rb(w + 0.04, 0.12, d + 0.04, 0.02), 'wPaint', { p: [cx, y, cz], c: SALT }); }
function gauge(b, p, h, ry = 0) {
  b.add(rb(0.14, h + 0.1, 0.07, 0.02), 'wDark', { p, r: [0, ry, 0], c: '#262422' });
  b.add(box(0.06, h, 0.03), 'wWet', { p: [p[0] + Math.sin(ry) * 0.03, p[1], p[2] + Math.cos(ry) * 0.03], r: [0, ry, 0] });
}
// a straight hanging chain: square links one under another, all one way (from x, y top, z, down by len)
function chain(b, x, y, z, len, c, s = 1) {
  const n = Math.max(2, Math.round(len / (0.34 * s)));
  for (let i = 0; i < n; i++) b.add(rb(0.16 * s, 0.3 * s, i % 2 ? 0.06 * s : 0.16 * s, 0.02 * s), 'wIron', { p: [x, y - (i + 0.5) * (len / n), z], c });
}
const spray = (rate = 3, size = 0.8, rise = 1.0, opacity = 0.4) => smoke({ rate, life: 1.5, size, rise, color: 0xdce8ee, opacity, spread: 0.35 });
const steam = (rate = 2, size = 0.8, rise = 1.4, opacity = 0.38) => smoke({ rate, life: 1.8, size, rise, color: 0xe8ecee, opacity, spread: 0.3 });
// the plain tracked dead/move/hit handling the three moving bosses share
function moveTreads(a, TR, dt, speed, k = 0.65) {
  const ts = a.stun ? 0.15 : 1;
  a.speed += (speed - a.speed) * Math.min(1, dt * 3);
  for (const w of a.p.wheels) w.rotation.x += (a.speed / k) * dt * ts;
  a._dist = (a._dist || 0) + a.speed * dt * ts; if (TR) crawl(TR.runs, a._dist);
  return ts;
}
function shake(a, dt, k = 0.015) { if (a.hitT > 0) { a.hitT -= dt * 2.5; a.p.body.rotation.z = Math.sin(a.t * 25) * a.hitT * k; } else a.p.body.rotation.z = 0; }

// ==========================================================================
// THE GATE WINCH (about 7 m tall, 8 m long)
// ==========================================================================
export function buildGateWinch() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 4.0, len: 7.2, h: 1.3, tw: 1.0, paint: 'wPaint', paintC: TAR, linkC: '#4e4c48', road: 3, seed: 4110 });
  const body = pivot(base, 0, 0, 0);
  const hC = grime(WOOD, 0.8, 4.0, 0.3, 1), iC = wear(IRON, 0.25, 3), i2C = wear(IRON2, 0.25, 4), bC = wear(BRONZE, 0.3, 5), tC = wear(TAR, 0.2, 2);
  const P = (w, h, d, seed, o = {}) => pl(w, h, d, { mat: 'wPaint', c: i2C, c2: tC, trim: 'wIron', trimC: iC, boltMat: 'wBrass', boltC: bC, seed, ...o });
  const DY = 5.0, DR = 1.05;
  body.add(part((b) => {
    // the bed: an iron-shod frame over the treads, planked
    b.add(rb(3.6, 1.0, 7.6, 0.08), 'wPaint', { p: [0, 1.7, 0], c: tC });
    for (let i = 0; i < 8; i++) b.add(rb(3.5, 0.1, 0.84, 0.015), 'wWood', { p: [0, 2.25, -3.3 + i * 0.94], c: wear(i % 2 ? WOOD2 : WOOD, 0.3, 10 + i) });
    saltLine(b, 3.6, 7.6, 1.35);
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) b.addBuilder(P(2.2, 0.8, 0.12, 4111 + i), { p: [sx * 1.85, 1.62, -2.4 + i * 2.4], r: [0, sx * PI / 2, 0] });
    // the cheeks: two square timber frames either side of the drum, iron-banded, a bearing block on each
    for (const sx of [-1, 1]) {
      b.add(rb(0.7, 4.2, 2.8, 0.06), 'wWood', { p: [sx * 1.6, 4.3, 0.4], c: hC });
      for (const y of [3.0, 4.6, 6.0]) b.add(rb(0.78, 0.14, 2.88, 0.02), 'wIron', { p: [sx * 1.6, y, 0.4], c: iC });
      b.add(rb(0.9, 0.8, 1.2, 0.06), 'wBrass', { p: [sx * 1.6, DY, 0.4], c: bC });
      saltLine(b, 0.7, 2.8, 2.9, sx * 1.6, 0.4);
    }
    // the head beam over the cheeks (along x) and its flat roof plate
    b.add(rb(4.0, 0.5, 1.0, 0.05), 'wPaint', { p: [0, 6.65, 0.4], c: i2C });
    b.add(rb(3.6, 0.1, 1.1, 0.02), 'wBrass', { p: [0, 6.95, 0.4], c: bC });
    silt(b, 0, 7.02, 0.4, 3.6, 0.8, 8, 0.1);
    // the engine house at the stern: a square box, a flat roof, one square stack, one gauge on its back face
    b.add(rb(3.0, 2.2, 2.2, 0.08), 'wPaint', { p: [0, 3.4, -2.6], c: i2C });
    for (const y of [2.8, 4.0]) b.add(rb(3.06, 0.08, 2.26, 0.02), 'wBrass', { p: [0, y, -2.6], c: bC });
    b.add(rb(3.2, 0.14, 2.4, 0.03), 'wIron', { p: [0, 4.57, -2.6], c: iC });
    b.addBuilder(stack(0.55, 1.6, { c: '#2e2c2a', trimC: iC, seed: 4112 }), { p: [0.8, 4.6, -2.9] });
    gauge(b, [-0.6, 3.4, -3.74], 0.9, PI);
    // the chain guide at the bow: a square iron frame the chain runs down through
    b.add(rb(1.6, 0.3, 0.5, 0.04), 'wIron', { p: [0, 2.5, 3.2], c: iC });
    bolts(b, 'wBrass', [-1.82, 2.1, -3.4], [-1.82, 2.1, 3.4], 12, 0.05, 'x', bC);
    bolts(b, 'wBrass', [1.82, 2.1, -3.4], [1.82, 2.1, 3.4], 12, 0.05, 'x', bC);
  }, 4120));
  // the drum: a plain solid cylinder along x with raised chain bands (one way round it), turning about x
  const drum = pivot(body, 0, DY, 0.4);
  drum.add(part((b) => {
    b.add(cyl(DR, DR, 2.4, 24), 'wPaint', { r: [0, 0, PI / 2], c: wear('#3e3c3a', 0.25, 30) });
    for (const x of [-0.75, -0.25, 0.25, 0.75]) b.add(cyl(DR + 0.07, DR + 0.07, 0.22, 24), 'wIron', { p: [x, 0, 0], r: [0, 0, PI / 2], c: wear('#6a6c6e', 0.3, 31) });
    b.add(rb(0.3, 0.5, 0.2, 0.03), 'wBrass', { p: [-1.05, DR * 0.55, 0], c: bC }); // a bolt plate, off centre (it shows the drum turning)
  }, 4121));
  // the counterweight: a square iron block hung straight down the front on its chain
  const weight = pivot(body, 0, 3.6, 3.2);
  weight.add(part((b) => {
    chain(b, 0, 2.4, 0, 2.2, iC);
    b.add(rb(1.5, 1.1, 1.0, 0.08), 'wPaint', { p: [0, 0.6 - 0.55, 0], c: i2C });
    for (const y of [-0.25, 0.35]) b.add(rb(1.56, 0.1, 1.06, 0.02), 'wIron', { p: [0, y, 0], c: iC });
    b.add(box(1.4, 0.04, 0.2), 'wWet', { p: [0, -0.5, 0.5] });
    silt(b, 0, 0.55, 0, 1.2, 0.8, 4, 0.08);
  }, 4122));
  const s1 = steam(2, 0.8, 1.4, 0.38); s1.position.set(0.8, 6.4, -2.9); body.add(s1);
  const s2 = spray(3, 0.7, 0.6, 0.36); s2.position.set(0, 1.0, 3.3); body.add(s2);
  const glow = slotGlow(0x7ac8ff, 2.2, 0.5, 0.35, { rx: -PI / 2 }); glow.position.set(0, 1.26, 3.6); body.add(glow);
  const a = new Anim(root, { base, body, wheels: TR.wheels, drum, weight });
  a.dynamics.push(s1, s2, glow);
  let wy = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 2.0), e = 1 - Math.pow(1 - k, 2);
      p.weight.position.y = 3.6 - 1.4 * e; p.body.rotation.x = 0.04 * e; p.body.position.y = -0.25 * e;
      s1.visible = s2.visible = false; glow.material.opacity = 0.35 * (1 - k);
      for (const d of this.dynamics) d.userData.update?.(dt, this.t);
      return;
    }
    s1.visible = s2.visible = true;
    const ts = moveTreads(this, TR, dt, speed);
    // the counterweight drops with the drum running free, then winds slowly back up
    const at = this.stepAttack(dt);
    let target = Math.sin(this.t * 0.7) * 0.08;
    if (at >= 0) target = at < 0.45 ? 0.3 * (at / 0.45) : at < 0.6 ? 0.3 - 1.6 * ((at - 0.45) / 0.15) : -1.3 * (1 - (at - 0.6) / 0.4);
    const prev = wy;
    wy += (target - wy) * Math.min(1, dt * (at >= 0.45 && at < 0.6 ? 30 : 6));
    p.weight.position.y = 3.6 + wy;
    p.drum.rotation.x += ((wy - prev) / DR) * ts;
    p.body.position.y = Math.abs(Math.sin(this.t * 2.2)) * 0.03 * Math.min(1, this.speed);
    glow.material.opacity = 0.28 + 0.08 * Math.sin(this.t * 2.5);
    shake(this, dt);
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  return finish(root, a, 7.2);
}

// ==========================================================================
// THE SILT RAM (about 5.5 m tall, 10 m long)
// ==========================================================================
export function buildSiltRam() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 3.8, len: 8.4, h: 1.3, tw: 1.0, paint: 'wPaint', paintC: TAR, linkC: '#4e4c48', road: 3, seed: 4210 });
  const body = pivot(base, 0, 0, 0);
  const iC = wear(IRON, 0.25, 13), i2C = wear(IRON2, 0.25, 14), bC = wear(BRONZE, 0.3, 15), tC = wear(TAR, 0.2, 12), hC = grime(WOOD, 0.8, 3.0, 0.3, 11);
  const P = (w, h, d, seed, o = {}) => pl(w, h, d, { mat: 'wPaint', c: i2C, c2: tC, trim: 'wIron', trimC: iC, boltMat: 'wBrass', boltC: bC, seed, ...o });
  body.add(part((b) => {
    b.add(rb(3.4, 1.0, 8.8, 0.08), 'wPaint', { p: [0, 1.7, 0], c: tC });
    saltLine(b, 3.4, 8.8, 1.35);
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) b.addBuilder(P(2.0, 0.8, 0.12, 4211 + i), { p: [sx * 1.75, 1.62, -3.3 + i * 2.2], r: [0, sx * PI / 2, 0] });
    // the hopper at the stern: a square open bin heaped with wet silt, iron-banded
    b.add(rb(3.2, 2.2, 3.0, 0.08), 'wPaint', { p: [0, 3.3, -2.6], c: i2C });
    for (const y of [2.7, 3.8]) b.add(rb(3.26, 0.1, 3.06, 0.02), 'wIron', { p: [0, y, -2.6], c: iC });
    b.add(rb(2.8, 0.2, 2.6, 0.05), 'wPaint', { p: [0, 4.3, -2.6], c: wear(SILT, 0.2, 40) });
    silt(b, 0, 4.45, -2.6, 2.6, 2.4, 14, 0.18);
    // the engine box behind the hopper's front, one square stack, one gauge on the left flank
    b.add(rb(2.4, 1.4, 1.4, 0.06), 'wPaint', { p: [0, 2.9, -0.4], c: i2C });
    b.addBuilder(stack(0.5, 1.8, { c: '#2e2c2a', trimC: iC, seed: 4212 }), { p: [0.8, 3.6, -0.6] });
    gauge(b, [-1.22, 2.9, -0.2], 0.8, -PI / 2);
    // the ram's sleeve: a long square iron box along the bed, banded, with timber guide rails either side
    b.add(rb(1.4, 1.2, 4.6, 0.06), 'wIron', { p: [0, 2.85, 2.0], c: iC });
    for (const z of [0.4, 2.0, 3.6]) b.add(rb(1.5, 1.3, 0.14, 0.02), 'wBrass', { p: [0, 2.85, z], c: bC });
    for (const sx of [-1, 1]) b.add(rb(0.3, 0.4, 5.0, 0.04), 'wWood', { p: [sx * 1.3, 2.45, 2.0], c: hC });
    bolts(b, 'wBrass', [-1.72, 2.1, -4.0], [-1.72, 2.1, 4.0], 14, 0.05, 'x', bC);
    bolts(b, 'wBrass', [1.72, 2.1, -4.0], [1.72, 2.1, 4.0], 14, 0.05, 'x', bC);
  }, 4220));
  // the ram: a square beam out of the sleeve, a flat square ram head on its end
  const ram = pivot(body, 0, 2.85, 4.3);
  ram.add(part((b) => {
    b.add(rb(0.9, 0.9, 2.2, 0.05), 'wIron', { p: [0, 0, 0.3], c: wear('#6a6c6e', 0.3, 50) });
    b.add(rb(3.0, 2.0, 0.4, 0.06), 'wPaint', { p: [0, 0.1, 1.5], c: i2C });
    for (const y of [-0.6, 0.8]) b.add(rb(3.1, 0.14, 0.44, 0.02), 'wIron', { p: [0, y, 1.5], c: iC });
    b.add(box(2.8, 0.05, 0.3), 'wWet', { p: [0, -0.88, 1.6] });
    silt(b, 0, -0.75, 1.75, 2.8, 0.2, 6, 0.1);
  }, 4221));
  const s1 = steam(2, 0.8, 1.4, 0.38); s1.position.set(0.8, 5.6, -0.6); body.add(s1);
  const dust = smoke({ rate: 3, life: 1.6, size: 0.8, rise: 0.4, color: 0x8a8478, opacity: 0.32, spread: 0.6 }); dust.position.set(0, 1.0, 5.8); body.add(dust);
  const glow = slotGlow(0x7ac8ff, 2.6, 0.5, 0.35, { rx: -PI / 2 }); glow.position.set(0, 1.26, 4.6); body.add(glow);
  const a = new Anim(root, { base, body, wheels: TR.wheels, ram });
  a.dynamics.push(s1, dust, glow);
  let rz = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.8), e = 1 - Math.pow(1 - k, 2);
      p.body.rotation.z = 0.05 * e; p.body.position.y = -0.25 * e; p.ram.position.z = 4.3 - 0.6 * e;
      s1.visible = dust.visible = false; glow.material.opacity = 0.35 * (1 - k);
      for (const d of this.dynamics) d.userData.update?.(dt, this.t);
      return;
    }
    s1.visible = dust.visible = true;
    moveTreads(this, TR, dt, speed);
    const at = this.stepAttack(dt);
    let target = Math.sin(this.t * 0.8) * 0.06;
    if (at >= 0) target = at < 0.5 ? -0.8 * (at / 0.5) : at < 0.62 ? -0.8 + 2.8 * ((at - 0.5) / 0.12) : 2.0 * (1 - (at - 0.62) / 0.38);
    rz += (target - rz) * Math.min(1, dt * (at >= 0.5 && at < 0.62 ? 30 : 7));
    p.ram.position.z = 4.3 + rz;
    p.body.position.y = Math.abs(Math.sin(this.t * 2.4)) * 0.03 * Math.min(1, this.speed);
    glow.material.opacity = 0.28 + 0.08 * Math.sin(this.t * 2.7);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z = Math.sin(this.t * 25) * this.hitT * 0.015; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  return finish(root, a, 5.6);
}

// ==========================================================================
// THE SLUICE CARRIAGE (about 8.5 m tall, 7 m long)
// ==========================================================================
export function buildSluiceCarriage() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const body = pivot(base, 0, 0, 0);
  const iC = wear(IRON, 0.25, 23), i2C = wear(IRON2, 0.25, 24), bC = wear(BRONZE, 0.3, 25), tC = wear(TAR, 0.2, 22), hC = grime(WOOD, 0.8, 6.0, 0.3, 21);
  // eight solid rail wheels (plain discs), four a side, each turning about x
  const wheels = [];
  for (const sx of [-1, 1]) for (const z of [-2.6, -0.9, 0.9, 2.6]) {
    const w = pivot(base, sx * 2.25, 0.75, z);
    w.add(part((b) => { b.add(bdisc(0.75, 0.32, 0.06, 24), 'wIron', { r: [0, 0, PI / 2], c: wear('#4a4c4e', 0.25, 60) }); b.add(rb(0.12, 0.38, 0.22, 0.02), 'wBrass', { p: [sx * 0.18, 0.36, 0], c: bC }); }, 4310 + (sx > 0 ? 4 : 0) + Math.round(z)));
    wheels.push(w);
  }
  body.add(part((b) => {
    // the carriage bed: a heavy tarred frame on the axle boxes, planked, the salt line round it
    b.add(rb(4.4, 0.9, 6.6, 0.08), 'wPaint', { p: [0, 1.6, 0], c: tC }); // (as wide as the frame, so from above the head beam lies within it)
    for (const sx of [-1, 1]) b.add(rb(0.4, 0.5, 6.4, 0.04), 'wIron', { p: [sx * 2.0, 1.0, 0], c: iC }); // the axle-box sills
    for (let i = 0; i < 7; i++) b.add(rb(4.3, 0.1, 0.86, 0.015), 'wWood', { p: [0, 2.1, -2.8 + i * 0.94], c: wear(i % 2 ? WOOD2 : WOOD, 0.3, 30 + i) });
    saltLine(b, 4.4, 6.6, 1.3);
    // the frame: two tall square posts shod in iron and a flat head beam, the leaf's guides inside them
    for (const sx of [-1, 1]) {
      b.add(rb(0.6, 6.4, 0.7, 0.05), 'wWood', { p: [sx * 1.6, 5.3, 0.8], c: hC });
      for (const y of [2.9, 5.0, 7.1]) b.add(rb(0.7, 0.12, 0.8, 0.02), 'wIron', { p: [sx * 1.6, y, 0.8], c: iC });
      b.add(rb(0.14, 5.8, 0.3, 0.02), 'wIron', { p: [sx * 1.24, 5.1, 0.8], c: '#8a8c8e' });
    }
    b.add(rb(3.6, 0.6, 1.0, 0.06), 'wPaint', { p: [0, 8.7, 0.8], c: i2C }); // (no wider than the bed: from above a band within it, never a cross)
    b.add(rb(3.6, 0.1, 1.1, 0.02), 'wBrass', { p: [0, 9.04, 0.8], c: bC });
    silt(b, 0, 9.1, 0.8, 3.2, 0.8, 8, 0.12);
    // the hoist box at the back: a square iron box, one square stack, one gauge on its back
    b.add(rb(2.8, 1.8, 1.8, 0.08), 'wPaint', { p: [0, 3.0, -2.2], c: i2C });
    for (const y of [2.5, 3.5]) b.add(rb(2.86, 0.08, 1.86, 0.02), 'wBrass', { p: [0, y, -2.2], c: bC });
    b.addBuilder(stack(0.5, 1.5, { c: '#2e2c2a', trimC: iC, seed: 4311 }), { p: [-0.8, 3.9, -2.4] });
    gauge(b, [0.6, 3.0, -3.14], 0.8, PI);
    // the hoist chains, straight up from the box to the head beam
    for (const sx of [-1, 1]) chain(b, sx * 0.9, 8.4, 0.3, 4.6, iC);
  }, 4320));
  // the leaf: a timber gate leaf banded in iron (all bands along x), sliding up and down in the guides
  const leaf = pivot(body, 0, 4.4, 0.8);
  leaf.add(part((b) => {
    b.add(rb(2.3, 3.4, 0.4, 0.04), 'wWood', { c: wear(WOOD2, 0.3, 40) });
    for (const y of [-1.4, -0.5, 0.4, 1.3]) b.add(rb(2.34, 0.16, 0.46, 0.02), 'wIron', { p: [0, y, 0], c: iC });
    saltLine(b, 2.3, 0.4, -0.9);
    b.add(box(2.4, 0.04, 0.05), 'wWet', { p: [0, -1.7, 0.22] });
    silt(b, 0, -1.65, 0, 2.4, 0.3, 6, 0.08);
  }, 4321));
  const s1 = steam(2, 0.8, 1.4, 0.38); s1.position.set(-0.8, 5.6, -2.4); body.add(s1);
  const fall = spray(5, 1.0, 0.7, 0.42); fall.position.set(0, 2.4, 1.2); body.add(fall);
  const glow = slotGlow(0x7ac8ff, 3.0, 0.6, 0.35, { rx: -PI / 2 }); glow.position.set(0, 2.18, 1.4); body.add(glow);
  const a = new Anim(root, { base, body, wheels, leaf });
  a.dynamics.push(s1, fall, glow);
  let ly = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 2.0), e = 1 - Math.pow(1 - k, 2);
      p.leaf.position.y = 4.4 - 1.6 * e; p.leaf.rotation.z = 0.08 * e; p.body.position.y = -0.2 * e;
      s1.visible = fall.visible = false; glow.material.opacity = 0.35 * (1 - k);
      for (const d of this.dynamics) d.userData.update?.(dt, this.t);
      return;
    }
    s1.visible = fall.visible = true;
    moveTreads(this, null, dt, speed, 0.75);
    // the leaf lifts slowly, then drops hard in its guides
    const at = this.stepAttack(dt);
    let target = 0.6 + Math.sin(this.t * 0.6) * 0.15;
    if (at >= 0) target = at < 0.5 ? 0.6 + 2.0 * (at / 0.5) : at < 0.62 ? 2.6 - 3.2 * ((at - 0.5) / 0.12) : -0.6 + 1.2 * ((at - 0.62) / 0.38);
    ly += (target - ly) * Math.min(1, dt * (at >= 0.5 && at < 0.62 ? 30 : 5));
    p.leaf.position.y = 4.4 + ly;
    p.body.position.y = Math.abs(Math.sin(this.t * 2.0)) * 0.02 * Math.min(1, this.speed);
    glow.material.opacity = 0.28 + 0.08 * Math.sin(this.t * 2.3);
    shake(this, dt);
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  return finish(root, a, 9.2);
}

// ==========================================================================
// THE TIDE ENGINE (the last boss, about 13 m tall, 14 m wide; it never moves)
// ==========================================================================
export function buildTideEngine() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const body = pivot(base, 0, 0, 0);
  const iC = wear(IRON, 0.25, 33), i2C = wear(IRON2, 0.25, 34), bC = wear(BRONZE, 0.3, 35), tC = wear(TAR, 0.2, 32), hC = grime(WOOD, 1.0, 8.0, 0.3, 31);
  const sC = wear('#7e807a', 0.2, 36);
  const P = (w, h, d, seed, o = {}) => pl(w, h, d, { mat: 'wPaint', c: i2C, c2: tC, trim: 'wIron', trimC: iC, boltMat: 'wBrass', boltC: bC, seed, ...o });
  body.add(part((b) => {
    // the plinth: dressed stone, stepped, the pale salt line and weed-dark foot
    b.add(rb(13.0, 1.0, 9.0, 0.08), 'stoneDark', { p: [0, 0.5, 0], c: sC });
    b.add(rb(12.0, 0.8, 8.0, 0.08), 'stoneDark', { p: [0, 1.4, 0], c: sC });
    saltLine(b, 12.0, 8.0, 1.2);
    b.add(rb(13.06, 0.4, 9.06, 0.04), 'wPaint', { p: [0, 0.22, 0], c: '#3a3c34' });
    // the engine house: a square iron-plated block, banded, flat roof behind a low parapet
    b.add(rb(8.0, 5.6, 5.0, 0.1), 'wPaint', { p: [0, 4.6, -1.2], c: i2C });
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) b.addBuilder(P(1.5, 3.6, 0.14, 4411 + i), { p: [sx * 4.03, 4.6, -3.0 + i * 1.8], r: [0, sx * PI / 2, 0] });
    for (const y of [3.0, 5.4, 7.2]) b.add(rb(8.1, 0.14, 5.1, 0.02), 'wBrass', { p: [0, y, -1.2], c: bC });
    b.add(rb(8.4, 0.3, 5.4, 0.04), 'wIron', { p: [0, 7.55, -1.2], c: iC });
    for (const sx of [-1, 1]) b.add(rb(0.3, 0.6, 5.4, 0.03), 'wIron', { p: [sx * 4.05, 8.0, -1.2], c: iC });
    silt(b, 0, 7.75, -1.2, 7.0, 4.4, 14, 0.14);
    // two square cylinder casings at the back (tall boxes, set apart, banded), their valve chests on top
    for (const sx of [-1, 1]) {
      b.add(rb(1.8, 4.8, 1.8, 0.08), 'wPaint', { p: [sx * 2.4, 4.2, -4.6], c: i2C });
      for (const y of [2.6, 4.2, 5.8]) b.add(rb(1.86, 0.12, 1.86, 0.02), 'wIron', { p: [sx * 2.4, y, -4.6], c: iC });
      b.add(rb(1.2, 0.8, 1.2, 0.06), 'wBrass', { p: [sx * 2.4, 7.0, -4.6], c: bC });
    }
    // the stack (one, square) and the gauge (one strip, on the left flank, never on the front)
    b.addBuilder(stack(0.8, 3.4, { c: '#2e2c2a', trimC: iC, seed: 4412 }), { p: [-2.6, 7.7, -2.2] });
    gauge(b, [-4.12, 4.6, 0.2], 1.6, -PI / 2);
    // the walking beam's pillar: one square stone-and-iron pillar on the roof's middle, a square bearing on top
    b.add(rb(1.2, 3.0, 1.2, 0.06), 'stoneDark', { p: [0, 9.2, -1.2], c: sC });
    b.add(rb(1.5, 0.6, 1.5, 0.06), 'wIron', { p: [0, 10.9, -1.2], c: iC });
    // the rack guides up the front: two square iron posts either side of the rack, a flat head beam over them (along x)
    for (const sx of [-1, 1]) {
      b.add(rb(0.5, 9.6, 0.6, 0.05), 'wIron', { p: [sx * 1.6, 6.6, 2.0], c: iC });
      for (const y of [3.0, 6.0, 9.0]) b.add(rb(0.6, 0.12, 0.7, 0.02), 'wBrass', { p: [sx * 1.6, y, 2.0], c: bC });
    }
    b.add(rb(4.0, 0.6, 0.9, 0.06), 'wPaint', { p: [0, 11.6, 2.0], c: i2C });
    // the pinion housing on the front of the engine house: a square box where the rack is driven
    b.add(rb(2.4, 1.6, 1.0, 0.08), 'wIron', { p: [0, 4.6, 1.6], c: iC });
    // the flywheel's bearing on the right flank
    b.add(rb(1.0, 2.0, 1.6, 0.06), 'wIron', { p: [4.6, 4.6, 0.6], c: iC });
    bolts(b, 'wBrass', [-6.0, 1.5, -3.8], [-6.0, 1.5, 3.8], 12, 0.07, 'x', bC);
    bolts(b, 'wBrass', [6.0, 1.5, -3.8], [6.0, 1.5, 3.8], 12, 0.07, 'x', bC);
  }, 4420));
  // the rack: a straight toothed bar (the teeth all one way, on its face) carrying a section of gate leaf at its foot
  const rack = pivot(body, 0, 0, 2.0);
  rack.add(part((b) => {
    b.add(rb(0.7, 6.4, 0.5, 0.04), 'wIron', { p: [0, 5.9, 0], c: wear('#6a6c6e', 0.3, 50) }); // (its head stays under the guides' head beam even at the top of a heave: no '+' from the front)
    for (let i = 0; i < 16; i++) b.add(rb(0.74, 0.16, 0.18, 0.02), 'wIron', { p: [0, 3.0 + i * 0.4, 0.3], c: wear('#7a7c7e', 0.3, 51 + i) });
    // the leaf: broad tarred timber, iron bands along x, wet below the salt line
    b.add(rb(5.6, 2.8, 0.5, 0.05), 'wWood', { p: [0, 2.6, 0.6], c: hC });
    for (const y of [1.5, 2.6, 3.7]) b.add(rb(5.66, 0.16, 0.56, 0.02), 'wIron', { p: [0, y, 0.6], c: iC });
    b.add(box(5.2, 0.05, 0.08), 'wWet', { p: [0, 1.25, 0.88] });
    silt(b, 0, 4.05, 0.6, 5.2, 0.4, 8, 0.1);
  }, 4421));
  // the walking beam: one long beam along z on the pillar's bearing, rocking; a straight rod down to the rack's head
  const beam = pivot(body, 0, 11.2, -1.2);
  beam.add(part((b) => {
    b.add(rb(0.8, 0.9, 5.8, 0.06), 'wPaint', { p: [0, 0, -0.25], c: i2C }); // (it stops short of the rack's head beam: no cross from above)
    for (const z of [-2.6, 0, 2.2]) b.add(rb(0.86, 0.96, 0.14, 0.02), 'wBrass', { p: [0, 0, z], c: bC });
    b.add(rb(0.3, 2.2, 0.3, 0.03), 'wIron', { p: [0, -1.4, -3.2], c: iC }); // the rod down to the cylinders
  }, 4422));
  // the flywheel: a solid disc on the right flank (plain, an off-centre bolt plate)
  const fly = pivot(body, 5.4, 4.6, 0.6);
  fly.add(part((b) => b.addBuilder(flywheel(3.0, 0.6, { c: '#3a3836', hubC: bC, seed: 4423 })), 4423));
  const fall = spray(7, 1.3, 0.8, 0.46); fall.position.set(0, 1.8, 3.2); body.add(fall);
  const s1 = steam(3, 1.1, 1.8, 0.42); s1.position.set(-2.6, 11.4, -2.2); body.add(s1);
  const s2 = steam(2, 0.8, 1.2, 0.34); s2.position.set(2.4, 7.6, -4.6); body.add(s2);
  const glow = slotGlow(0x7ac8ff, 5.6, 2.0, 0.4, { rx: -PI / 2, d: 0.14 }); glow.position.set(0, 2.0, 3.6); body.add(glow);
  const a = new Anim(root, { base, body, wheels: [], rack, beam, fly });
  a.dynamics.push(fall, s1, s2, glow);
  let ry = 0, fw = 0.5;
  a.update = function (dt) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      // the rack settles, the beam stops level, the flywheel runs down, the water stops
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 3.0), e = 1 - Math.pow(1 - k, 2);
      fw *= Math.max(0, 1 - dt * 1.0); p.fly.rotation.x += fw * dt;
      p.rack.position.y = ry * (1 - e) - 0.4 * e; p.beam.rotation.x *= 1 - Math.min(1, dt * 2);
      fall.visible = k < 0.4; s1.visible = k < 0.6; s2.visible = false; glow.material.opacity = 0.4 * (1 - k);
      for (const d of this.dynamics) d.userData.update?.(dt, this.t);
      return;
    }
    fall.visible = s1.visible = s2.visible = true;
    const ts = this.stun ? 0.15 : 1;
    // the rack heaves the leaf up against the tide and lets it down; on a strike it heaves hard, then drops
    const at = this.stepAttack(dt);
    let target = 0.5 + Math.sin(this.t * 0.5) * 0.35;
    if (at >= 0) target = at < 0.5 ? 0.5 + 1.6 * (at / 0.5) : at < 0.62 ? 2.1 - 2.6 * ((at - 0.5) / 0.12) : -0.5 + 1.0 * ((at - 0.62) / 0.38);
    ry += (target - ry) * Math.min(1, dt * (at >= 0.5 && at < 0.62 ? 26 : 4)) * ts;
    p.rack.position.y = ry;
    p.beam.rotation.x = -ry * 0.06;
    fw += ((at >= 0 ? 2.0 : 0.6) - fw) * Math.min(1, dt * 2);
    p.fly.rotation.x += fw * dt * ts;
    glow.material.opacity = 0.34 + 0.1 * Math.sin(this.t * 1.7);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z = Math.sin(this.t * 25) * this.hitT * 0.006; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  return finish(root, a, 13.0);
}
