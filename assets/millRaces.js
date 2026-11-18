// The Mill Races (Part Thirteen, level 60 dungeon in the wheel pits and race tunnels under the tide mills on Tidewater Sound):
// three machine bosses of tarred timber, salt-eaten iron and old bronze, dark below a pale salt line where the races flood,
// grey silt caked on their treads and feet, sea water running off them.
//  - The Log Carriage: the carriage that ran logs down the Log Way to the saws. A long tracked bed of tarred planks with three
//    logs laid parallel along it, held under two portal dogs (two square posts and a flat clamp beam each, along x), a
//    square engine house at the stern with one square stack and one gauge, and a flat square pusher plate on a square ram
//    at the bow that it drives out to strike.
//  - The Frame Saw: the great frame saw of the Saw Pit. A tracked base carrying a tall square portal (two posts, a flat head
//    beam) with a sash of five straight upright blades stroked up and down inside it, a solid crank disc on its right flank
//    driving the sash by a square connecting rod, and a short log bed before it.
//  - The Great Undershot (the last boss): the solid wheel that drove every saw in the yard. A heavy iron bed on wide treads,
//    two square timber-and-stone cheeks either side of a huge solid wheel (a plain disc, square float boards on its rim, an
//    off-centre bolt plate, never spoked), the shaft out through the right cheek into a square gear house, a square sluice
//    hatch over the wheel's head and sea water pouring off its floats.
// Same interface as the other machines: userData.machine = { update(dt, speed), attack(dur, kind), hit(), die(), revive(), stun }.
// Content rules: no faces (no lamps at all, one gauge strip only, never a pair), nothing animal-like (treads and flat
// plates, never claws, jaws or legs), no spokes (solid discs), no domes, rings, stars or radiating patterns (the floats are
// short square boards on the rim like a lugged wheel's lugs), nothing crossed (beams and blades run one way), everything
// square from above.
import * as THREE from 'three';
import { box, rbox, cyl, ico } from './kit.js';
import { plate, heroTreads, crawl, wear, grime, bolts, bdisc, flywheel, stack } from './bossParts.js';
import { smoke } from './dynamic.js';
import { slotGlow } from './slotGlow.js';
import { Anim, finish, part, pivot } from './quarryMachines.js';

const PI = Math.PI;
const rb = (w, h, d, r) => rbox(w, h, d, r, 1);
const pl = (w, h, d, o = {}) => plate(w, h, d, { br: Math.max(0.035, Math.min(0.07, Math.min(w, h) * 0.05)), ...o });
// tarred timber, its paler grain, salt-eaten iron, old bronze, tar black, silt, salt
const TAR = '#2a2622', WOOD = '#5e4c3a', WOOD2 = '#4a3c2e', IRON = '#5a5e60', IRON2 = '#46494c', BRONZE = '#7a6a3e', SILT = '#5a5148', SALT = '#dcd8ce';

// silt crust: flattened grey lumps over a face
// (RF.7 review) one flattened slab over the face first, so the lumps never read as scattered dots (die pips) on a dark top
function silt(b, cx, y, cz, w, d, n, s = 0.12) {
  if (w > s && d > s) b.add(rb(w * 0.92 + s, s * 0.45, d * 0.92 + s, s * 0.2), 'wPaint', { p: [cx, y - s * 0.05, cz], c: wear(SILT, 0.14, n) });
  for (let i = 0; i < n; i++) b.add(ico(s * b.r(0.6, 1.2), 0), 'wPaint', { p: [cx + b.r(-w / 2, w / 2), y, cz + b.r(-d / 2, d / 2)], s: [1.7, 0.4, 1.3], r: [0, b.r(0, 3), 0], c: wear(SILT, 0.15, i) });
}
// the pale salt line a hand's height round a block (a thin band, one way only)
function saltLine(b, w, d, y, cx = 0, cz = 0) { b.add(rb(w + 0.04, 0.12, d + 0.04, 0.02), 'wPaint', { p: [cx, y, cz], c: SALT }); }
// one sight-gauge strip: a lit glass in a dark frame (always single, never a pair)
function gauge(b, p, h, ry = 0) {
  b.add(rb(0.14, h + 0.1, 0.07, 0.02), 'wDark', { p, r: [0, ry, 0], c: '#262422' });
  b.add(box(0.06, h, 0.03), 'wWet', { p: [p[0] + Math.sin(ry) * 0.03, p[1], p[2] + Math.cos(ry) * 0.03], r: [0, ry, 0] });
}
// a straight log along z (a squared-off barked log: no round end grain rings showing as discs)
function log(b, p, len, r, seed) {
  b.add(rb(r * 2, r * 1.9, len, r * 0.45), 'wWood', { p, c: wear('#5a4a3a', 0.3, seed) });
  for (const s of [-1, 1]) b.add(rb(r * 1.7, r * 1.6, 0.04, r * 0.3), 'wWood', { p: [p[0], p[1], p[2] + s * (len / 2 + 0.01)], c: wear('#5e4c3a', 0.15, seed + 1) }); // end grain as dark as the bark (two pale log ends side by side read as eyes)
}
const spray = (rate = 3, size = 0.8, rise = 1.0, opacity = 0.4) => smoke({ rate, life: 1.5, size, rise, color: 0xdce8ee, opacity, spread: 0.35 });
const steam = (rate = 2, size = 0.8, rise = 1.4, opacity = 0.38) => smoke({ rate, life: 1.8, size, rise, color: 0xe8ecee, opacity, spread: 0.3 });

// ==========================================================================
// THE LOG CARRIAGE (about 5.6 m tall, 9 m long)
// ==========================================================================
export function buildLogCarriage() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 3.6, len: 7.4, h: 1.3, tw: 0.9, paint: 'wPaint', paintC: TAR, linkC: '#4e4c48', road: 3, seed: 3110 });
  const body = pivot(base, 0, 0, 0);
  const hC = grime(WOOD, 0.8, 3.0, 0.3, 1), tC = wear(TAR, 0.2, 2), iC = wear(IRON, 0.25, 3), i2C = wear(IRON2, 0.25, 4), bC = wear(BRONZE, 0.3, 5);
  const P = (w, h, d, seed, o = {}) => pl(w, h, d, { mat: 'wPaint', c: tC, c2: i2C, trim: 'wIron', trimC: iC, boltMat: 'wBrass', boltC: bC, seed, ...o });
  body.add(part((b) => {
    // the bed: a long tarred timber frame over the treads, iron-shod sills, a planked deck along it
    b.add(rb(3.1, 1.0, 8.2, 0.08), 'wPaint', { p: [0, 1.75, 0], c: tC });
    for (const sx of [-1, 1]) { b.add(rb(0.34, 0.5, 8.4, 0.04), 'wWood', { p: [sx * 1.55, 2.05, 0], c: hC }); b.add(rb(0.36, 0.1, 8.42, 0.02), 'wIron', { p: [sx * 1.55, 1.78, 0], c: iC }); }
    for (let i = 0; i < 9; i++) b.add(rb(0.3, 0.1, 8.0, 0.015), 'wWood', { p: [-1.24 + i * 0.31, 2.32, 0], c: wear(i % 2 ? WOOD2 : WOOD, 0.3, 10 + i) });
    saltLine(b, 3.1, 8.2, 1.4);
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) b.addBuilder(P(2.4, 0.8, 0.12, 3111 + i), { p: [sx * 1.6, 1.62, -2.6 + i * 2.6], r: [0, sx * PI / 2, 0] });
    // three logs laid parallel along the bed, their ends staggered (a pair of log ends side by side read as eyes)
    log(b, [-0.9, 2.8, 0.5], 6.2, 0.44, 20); log(b, [0, 2.8, -0.3], 5.4, 0.44, 21); log(b, [0.9, 2.8, -0.6], 5.0, 0.44, 22);
    // the log dogs: two portals along x (two square posts and a flat clamp beam pressed down on the logs)
    for (const z of [-1.6, 2.4]) {
      for (const sx of [-1, 1]) { b.add(rb(0.34, 2.4, 0.34, 0.04), 'wIron', { p: [sx * 1.5, 3.4, z], c: iC }); b.add(rb(0.42, 0.1, 0.42, 0.02), 'wBrass', { p: [sx * 1.5, 4.2, z], c: bC }); }
      b.add(rb(3.4, 0.36, 0.5, 0.05), 'wIron', { p: [0, 4.6, z], c: i2C });
      b.add(rb(2.6, 0.16, 0.4, 0.03), 'wIron', { p: [0, 3.3, z], c: iC }); // the clamp bar on the logs
      silt(b, 0, 4.8, z, 3.0, 0.4, 5, 0.1);
    }
    // the engine house at the stern: a square box, a flat roof, one square stack, one gauge
    b.add(rb(2.6, 1.8, 1.8, 0.08), 'wPaint', { p: [0, 3.3, -3.4], c: i2C });
    b.add(rb(2.8, 0.14, 2.0, 0.03), 'wIron', { p: [0, 4.27, -3.4], c: iC });
    for (const y of [2.8, 3.7]) b.add(rb(2.66, 0.08, 1.86, 0.02), 'wBrass', { p: [0, y, -3.4], c: bC });
    b.addBuilder(stack(0.5, 1.4, { c: '#2e2c2a', trimC: iC, seed: 3112 }), { p: [-0.7, 4.3, -3.6] });
    gauge(b, [1.32, 3.3, -3.0], 0.9, PI / 2);
    silt(b, 0.3, 4.36, -3.4, 2.0, 1.4, 8, 0.1);
    // the ram's square sleeve at the bow
    b.add(rb(1.1, 1.1, 1.6, 0.06), 'wIron', { p: [0, 2.0, 3.9], c: iC });
    for (const z of [3.3, 4.5]) b.add(rb(1.22, 1.22, 0.12, 0.02), 'wBrass', { p: [0, 2.0, z], c: bC });
    bolts(b, 'wBrass', [-1.6, 2.2, -3.8], [-1.6, 2.2, 3.8], 14, 0.05, 'x', bC);
    bolts(b, 'wBrass', [1.6, 2.2, -3.8], [1.6, 2.2, 3.8], 14, 0.05, 'x', bC);
  }, 3120));
  // the pusher: a square ram with a flat square plate on its end
  const ram = pivot(body, 0, 2.0, 4.6);
  ram.add(part((b) => {
    b.add(rb(0.6, 0.6, 1.6, 0.05), 'wIron', { p: [0, 0, 0.2], c: wear('#6a6c6e', 0.3, 30) });
    b.add(rb(2.6, 1.6, 0.3, 0.06), 'wPaint', { p: [0, 0.1, 1.1], c: i2C });
    for (const y of [-0.5, 0.7]) b.add(rb(2.7, 0.12, 0.34, 0.02), 'wIron', { p: [0, y, 1.1], c: iC });
    b.add(box(2.4, 0.04, 0.2), 'wWet', { p: [0, -0.68, 1.18] });
    silt(b, 0, 0.95, 1.1, 2.4, 0.2, 4, 0.08);
  }, 3121));
  const s1 = steam(2, 0.7, 1.4, 0.38); s1.position.set(-0.7, 6.0, -3.6); body.add(s1);
  const s2 = spray(3, 0.7, 0.6, 0.36); s2.position.set(0, 0.9, 4.4); body.add(s2);
  const glow = slotGlow(0x7ac8ff, 2.4, 0.4, 0.35, { rx: -PI / 2 }); glow.position.set(0, 1.26, 4.0); body.add(glow);
  const a = new Anim(root, { base, body, wheels: TR.wheels, ram });
  a.dynamics.push(s1, s2, glow);
  let dist = 0, rz = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.8), e = 1 - Math.pow(1 - k, 2);
      p.body.rotation.z = 0.05 * e; p.body.rotation.x = 0.03 * e; p.body.position.y = -0.25 * e; p.ram.position.z = 4.6 - 0.5 * e;
      s1.visible = s2.visible = false; glow.material.opacity = 0.35 * (1 - k);
      for (const d of this.dynamics) d.userData.update?.(dt, this.t);
      return;
    }
    s1.visible = s2.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.65) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    // the pusher draws back, then drives out hard
    const at = this.stepAttack(dt);
    let target = Math.sin(this.t * 0.8) * 0.06;
    if (at >= 0) target = at < 0.5 ? -0.6 * (at / 0.5) : at < 0.62 ? -0.6 + 2.2 * ((at - 0.5) / 0.12) : 1.6 * (1 - (at - 0.62) / 0.38);
    rz += (target - rz) * Math.min(1, dt * (at >= 0.5 && at < 0.62 ? 30 : 7));
    p.ram.position.z = 4.6 + rz;
    p.body.position.y = Math.abs(Math.sin(this.t * 2.4)) * 0.03 * Math.min(1, this.speed);
    glow.material.opacity = 0.28 + 0.08 * Math.sin(this.t * 2.7);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z = Math.sin(this.t * 25) * this.hitT * 0.015; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  return finish(root, a, 5.6);
}

// ==========================================================================
// THE FRAME SAW (about 8 m tall, 7 m long)
// ==========================================================================
export function buildFrameSaw() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 4.4, len: 6.4, h: 1.3, tw: 1.0, paint: 'wPaint', paintC: TAR, linkC: '#4e4c48', road: 2, seed: 3210 });
  const body = pivot(base, 0, 0, 0);
  const hC = grime(WOOD, 0.8, 3.0, 0.3, 11), tC = wear(TAR, 0.2, 12), iC = wear(IRON, 0.25, 13), i2C = wear(IRON2, 0.25, 14), bC = wear(BRONZE, 0.3, 15);
  body.add(part((b) => {
    // the base: a heavy tarred frame over the treads, planked on top, the salt line round it
    b.add(rb(3.9, 1.0, 6.6, 0.08), 'wPaint', { p: [0, 1.7, 0], c: tC });
    for (let i = 0; i < 8; i++) b.add(rb(3.8, 0.1, 0.76, 0.015), 'wWood', { p: [0, 2.25, -2.9 + i * 0.82], c: wear(i % 2 ? WOOD2 : WOOD, 0.3, 20 + i) });
    saltLine(b, 3.9, 6.6, 1.35);
    // the portal: two tall square posts shod in iron, a flat head beam and a flat sill beam (along x)
    for (const sx of [-1, 1]) {
      b.add(rb(0.6, 6.0, 0.7, 0.05), 'wWood', { p: [sx * 1.7, 5.3, 0.6], c: hC });
      for (const y of [2.8, 4.8, 6.8]) b.add(rb(0.7, 0.12, 0.8, 0.02), 'wIron', { p: [sx * 1.7, y, 0.6], c: iC });
      b.add(rb(0.14, 5.2, 0.14, 0.02), 'wIron', { p: [sx * 1.34, 5.1, 0.6], c: '#8a8c8e' }); // the sash guides
    }
    b.add(rb(4.2, 0.6, 0.9, 0.06), 'wPaint', { p: [0, 8.3, 0.6], c: i2C });
    b.add(rb(4.3, 0.1, 1.0, 0.02), 'wBrass', { p: [0, 8.64, 0.6], c: bC });
    b.add(rb(3.8, 0.4, 0.8, 0.05), 'wPaint', { p: [0, 2.5, 0.6], c: i2C });
    silt(b, 0, 8.7, 0.6, 3.8, 0.7, 8, 0.12);
    // the log bed before the portal: a short log dogged on two square blocks
    log(b, [0, 2.9, 2.4], 2.6, 0.5, 30);
    for (const sx of [-1, 1]) b.add(rb(0.3, 0.8, 0.3, 0.03), 'wIron', { p: [sx * 0.75, 2.8, 2.4], c: iC });
    // the crank house on the right: a square bearing block for the crank disc's shaft
    b.add(rb(0.8, 1.6, 1.2, 0.06), 'wIron', { p: [2.2, 3.0, -1.2], c: iC });
    // the engine at the back: a square boiler box, one square stack, one gauge
    b.add(rb(2.8, 2.0, 1.8, 0.08), 'wPaint', { p: [0, 3.2, -2.3], c: i2C });
    for (const y of [2.7, 3.7]) b.add(rb(2.86, 0.08, 1.86, 0.02), 'wBrass', { p: [0, y, -2.3], c: bC });
    b.addBuilder(stack(0.5, 1.6, { c: '#2e2c2a', trimC: iC, seed: 3211 }), { p: [0.8, 4.2, -2.6] });
    gauge(b, [-1.42, 3.2, -2.0], 1.0, -PI / 2);
    bolts(b, 'wBrass', [-2.0, 2.0, -3.0], [-2.0, 2.0, 3.0], 12, 0.05, 'x', bC);
    bolts(b, 'wBrass', [2.0, 2.0, -3.0], [2.0, 2.0, 3.0], 12, 0.05, 'x', bC);
  }, 3220));
  // the sash: two stiles, two rails and five straight upright blades, stroked up and down in the portal
  const sash = pivot(body, 0, 5.2, 0.6);
  sash.add(part((b) => {
    for (const sx of [-1, 1]) b.add(rb(0.22, 3.4, 0.3, 0.03), 'wWood', { p: [sx * 1.18, 0, 0], c: wear(WOOD, 0.3, 40) });
    for (const y of [-1.6, 1.6]) b.add(rb(2.6, 0.26, 0.34, 0.03), 'wWood', { p: [0, y, 0], c: wear(WOOD2, 0.3, 41) });
    for (let i = 0; i < 5; i++) {
      const x = -0.8 + i * 0.4;
      b.add(box(0.1, 3.0, 0.02), 'wEdge', { p: [x, 0, 0], c: '#c8cacc' });
      for (const y of [-1.45, 1.45]) b.add(rb(0.18, 0.14, 0.12, 0.02), 'wIron', { p: [x, y, 0], c: iC });
    }
    b.add(box(0.04, 2.6, 0.03), 'wWet', { p: [1.3, 0, 0.17] });
  }, 3221));
  // the crank disc on the right flank and its connecting rod down to the sash's bottom rail
  const crank = pivot(body, 2.7, 3.0, -1.2);
  crank.add(part((b) => b.addBuilder(flywheel(1.3, 0.3, { c: '#3e3c3a', hubC: bC, seed: 3222 })), 3222));
  const conrod = pivot(body, 2.4, 3.0, -1.2);
  conrod.add(part((b) => { b.add(rb(0.22, 0.22, 2.2, 0.03), 'wIron', { p: [0, 0, 1.0], c: iC }); b.add(rb(0.34, 0.34, 0.34, 0.04), 'wBrass', { p: [0, 0, 2.05], c: bC }); }, 3223));
  const s1 = steam(2, 0.8, 1.4, 0.38); s1.position.set(0.8, 6.2, -2.6); body.add(s1);
  const dust = smoke({ rate: 3, life: 1.6, size: 0.7, rise: 0.4, color: 0xc8b898, opacity: 0.32, spread: 0.5 }); dust.position.set(0, 3.0, 1.6); body.add(dust);
  const s2 = spray(3, 0.8, 0.6, 0.36); s2.position.set(0, 0.8, 3.3); body.add(s2);
  const a = new Anim(root, { base, body, wheels: TR.wheels, sash, crank, conrod });
  a.dynamics.push(s1, dust, s2);
  let dist = 0, ph = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 2.0), e = 1 - Math.pow(1 - k, 2);
      p.sash.position.y = 5.2 - 0.9 * e; p.body.rotation.x = 0.05 * e; p.body.rotation.z = -0.04 * e; p.body.position.y = -0.3 * e;
      s1.visible = dust.visible = s2.visible = false;
      for (const d of this.dynamics) d.userData.update?.(dt, this.t);
      return;
    }
    s1.visible = dust.visible = s2.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.65) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    // the sash strokes with the crank; on an attack the crank races and the stroke quickens
    const at = this.stepAttack(dt);
    ph += dt * ts * (at >= 0 ? 9 : 2.4);
    p.crank.rotation.x = ph;
    p.sash.position.y = 5.2 + Math.sin(ph) * 0.6;
    p.conrod.rotation.x = Math.sin(ph) * 0.25;
    p.body.position.y = Math.sin(this.t * 31) * (at >= 0 ? 0.02 : 0.006);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z = Math.sin(this.t * 25) * this.hitT * 0.015; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  return finish(root, a, 8.4);
}

// ==========================================================================
// THE GREAT UNDERSHOT (the last boss, about 11 m tall, 12 m long)
// ==========================================================================
export function buildGreatUndershot() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 8.4, len: 10.6, h: 1.8, tw: 1.4, paint: 'wPaint', paintC: TAR, linkC: '#4e4c48', road: 3, seed: 3310 });
  const body = pivot(base, 0, 0, 0);
  const hC = grime(WOOD, 1.0, 6.0, 0.3, 21), tC = wear(TAR, 0.2, 22), iC = wear(IRON, 0.25, 23), i2C = wear(IRON2, 0.25, 24), bC = wear(BRONZE, 0.3, 25);
  const P = (w, h, d, seed, o = {}) => pl(w, h, d, { mat: 'wPaint', c: tC, c2: i2C, trim: 'wIron', trimC: iC, boltMat: 'wBrass', boltC: bC, seed, ...o });
  const WR = 4.2, WY = 6.0, CX = 2.7;
  body.add(part((b) => {
    // the bed: a heavy iron-shod timber frame over the treads, with a sunken square race between the cheeks
    b.add(rb(8.0, 1.2, 11.0, 0.1), 'wPaint', { p: [0, 2.0, 0], c: tC });
    saltLine(b, 8.0, 11.0, 1.7);
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) b.addBuilder(P(2.5, 0.9, 0.14, 3311 + i), { p: [sx * 4.02, 2.0, -3.9 + i * 2.6], r: [0, sx * PI / 2, 0] });
    b.add(box(4.4, 0.05, 10.6), 'wWet', { p: [0, 2.64, 0] }); // the race floor, running wet
    // the cheeks: two square timber walls either side of the wheel, iron-banded, with square bearing blocks on top
    for (const sx of [-1, 1]) {
      b.add(rb(1.1, 3.0, 3.4, 0.08), 'wWood', { p: [sx * CX, 4.0, 0], c: hC });
      for (const y of [3.2, 4.6]) b.add(rb(1.2, 0.16, 3.5, 0.03), 'wIron', { p: [sx * CX, y, 0], c: iC });
      saltLine(b, 1.1, 3.4, 2.9, sx * CX, 0);
      b.add(rb(1.4, 0.5, 3.5, 0.05), 'wPaint', { p: [sx * CX, 5.6, 0], c: i2C }); // the bearing seat, the cheek's full length (from above: parallel strips, no band across the wheel)
      b.add(rb(1.5, 1.2, 3.5, 0.08), 'wIron', { p: [sx * CX, WY + 0.2, 0], c: i2C }); // the bearing block, as long as the cheek (a short block read as a band across the wheel from above)
      silt(b, sx * CX, 6.84, 0, 1.2, 3.2, 6, 0.1);
      bolts(b, 'wBrass', [sx * (CX + 0.56), 3.9, -1.5], [sx * (CX + 0.56), 3.9, 1.5], 6, 0.06, 'x', bC);
    }
    // the sluice hatch over the wheel's head: a flat timber hatch on two square posts at the front, its board raised
    for (const sx of [-1, 1]) b.add(rb(0.5, 8.2, 0.5, 0.04), 'wWood', { p: [sx * 1.9, 6.7, 5.1], c: hC });
    b.add(rb(4.4, 0.5, 0.6, 0.05), 'wIron', { p: [0, 10.8, 5.1], c: iC });
    b.add(rb(3.4, 1.0, 0.16, 0.03), 'wWood', { p: [0, 9.9, 5.1], c: wear(WOOD2, 0.3, 70) }); // the hatch board, raised
    // the gear house on the right: a square iron box round the shaft's end, a flat roof, one square stack, one gauge
    b.add(rb(2.2, 3.4, 3.2, 0.1), 'wPaint', { p: [4.6, 4.9, -0.6], c: i2C });
    for (const y of [4.0, 5.8]) b.add(rb(2.26, 0.1, 3.26, 0.02), 'wBrass', { p: [4.6, y, -0.6], c: bC });
    b.add(rb(2.4, 0.2, 3.4, 0.04), 'wIron', { p: [4.6, 6.7, -0.6], c: iC });
    b.addBuilder(stack(0.6, 1.8, { c: '#2e2c2a', trimC: iC, seed: 3312 }), { p: [4.7, 6.8, -1.6] });
    gauge(b, [5.72, 4.9, -0.2], 1.4, PI / 2);
    silt(b, 4.6, 6.84, -0.6, 2.0, 3.0, 8, 0.1);
    // the head race at the back: a square timber trough feeding the wheel, running wet
    b.add(rb(4.2, 0.9, 3.0, 0.06), 'wWood', { p: [0, 3.0, -5.0], c: hC });
    b.add(box(3.6, 0.05, 2.8), 'wWet', { p: [0, 3.46, -5.0] });
  }, 3320));
  // the shaft through the right cheek into the gear house (square in section)
  body.add(part((b) => { b.add(rb(5.0, 0.7, 0.7, 0.05), 'wIron', { p: [1.6, WY, 0], c: iC }); }, 3321));
  // the wheel: a huge plain solid disc with square float boards on its rim and an off-centre bolt plate, turning about x
  const wheel = pivot(body, 0, WY, 0);
  wheel.add(part((b) => {
    b.add(bdisc(WR, 2.6, 0.2, 40), 'wPaint', { r: [0, 0, PI / 2], c: wear('#3a3028', 0.2, 50) }); // plain tarred faces (grained wood on the disc's fan drew radiating rays)
    for (const sx of [-1, 1]) {
      b.add(rb(0.12, WR * 0.5, WR * 0.36, 0.03), 'wBrass', { p: [sx * 1.36, WR * 0.5, 0], c: bC }); // the bolt plate, off centre
    }
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2, R = WR + 0.1; // short, broad blocks like a lugged wheel's lugs (thin floats read as rays)
      b.add(rb(2.7, 0.3, 0.75, 0.04), 'wWood', { p: [0, Math.cos(a) * R, Math.sin(a) * R], r: [a, 0, 0], c: wear(WOOD2, 0.3, 60 + i) });
    }
  }, 3322));
  const fall = spray(6, 1.2, 0.8, 0.46); fall.position.set(0, 2.8, 3.8); body.add(fall);
  const head = spray(4, 1.0, 1.0, 0.4); head.position.set(0, 3.6, -4.6); body.add(head);
  const s1 = steam(3, 1.0, 1.6, 0.4); s1.position.set(4.7, 9.0, -1.6); body.add(s1);
  const glow = slotGlow(0x7ac8ff, 4.0, 3.0, 0.4, { rx: -PI / 2, d: 0.14 }); glow.position.set(0, 2.68, 3.0); body.add(glow);
  const a = new Anim(root, { base, body, wheels: TR.wheels, wheel });
  a.dynamics.push(fall, head, s1, glow);
  let dist = 0, w = 0.35;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      // the wheel runs down and stands still, the water stops pouring off it
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 3.0), e = 1 - Math.pow(1 - k, 2);
      w *= Math.max(0, 1 - dt * 1.2); p.wheel.rotation.x += w * dt;
      p.body.position.y = -0.3 * e; p.body.rotation.z = 0.015 * e;
      fall.visible = k < 0.4; head.visible = false; s1.visible = k < 0.5; glow.material.opacity = 0.4 * (1 - k);
      for (const d of this.dynamics) d.userData.update?.(dt, this.t);
      return;
    }
    fall.visible = head.visible = s1.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    for (const q of p.wheels) q.rotation.x += (this.speed / 0.9) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    // the wheel turns slowly in its race; on an attack it surges
    const at = this.stepAttack(dt);
    const want = at >= 0 ? (at < 0.6 ? 1.6 : 0.6) : 0.35;
    w += (want - w) * Math.min(1, dt * 2.5);
    p.wheel.rotation.x += w * dt * ts;
    p.body.position.y = Math.sin(this.t * 1.3) * 0.02 + (at >= 0 && at > 0.55 && at < 0.7 ? -0.08 : 0);
    glow.material.opacity = 0.34 + 0.1 * Math.sin(this.t * 1.9);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z = Math.sin(this.t * 25) * this.hitT * 0.008; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update?.(dt, this.t);
  };
  return finish(root, a, 11.0);
}
