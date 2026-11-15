// The Ore Galleries (Part Ten, level 45 dungeon): the last boss, the Great Sorter. The Skip Engine and the Gallery Bore are
// scaled island machines (creatures.js buildMachine: skipengine, gallerybore).
//  - The Great Sorter: the engine the Makers set at the head of their mine to grade its ore. A plated hull on heavy treads
//    carrying a square intake hopper, two stepped grading screens (parallel slats only, never a grid) that shake the ore down
//    to three square sorting bins at the stern, two grab-bucket arms at the front corners, a solid flywheel driving the
//    screens and a square stack. One louvred furnace grille in front: no face, no paired lamps.
// Content rules: everything square from above, no spokes, no domes, rings or radiating patterns.
import * as THREE from 'three';
import { box, rbox, cyl, ico, taper } from './kit.js';
import { plate, vent, flywheel, stack, sleeve, heroTreads, crawl, wear, grime, bolts } from './bossParts.js';
import { smoke, glowSprite } from './dynamic.js';
import { slotGlow } from './slotGlow.js';
import { Anim, finish, part, pivot } from './quarryMachines.js';
import { wearModel, MOTION } from './tripoModels.js';

const PI = Math.PI;
const rb = (w, h, d, r) => rbox(w, h, d, r, 1);
const BASALT = '#6e6864', ASH = '#a29e98', SOOT = '#2a2828', IRONR = '#5c5650', BRASS = '#a88a52', GLASS = '#34302f';

export function buildGreatSorter() {
  const G = 'wGlowOrange';
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 5.2, len: 8.8, h: 1.7, tw: 1.1, paintC: '#3e3a38', linkC: '#5a5450', road: 2, seed: 1210 });
  const body = pivot(base, 0, 0, 0);
  const hullC = grime(BASALT, 1.4, 3.6, 0.3, 1), hull2C = wear('#58524e', 0.3, 2), ashC = wear(ASH, 0.3, 3), ironC = wear(IRONR, 0.25, 4), trimC = wear(BRASS, 0.3, 5);
  const P = (w, h, d, seed, o = {}) => plate(w, h, d, { c: hullC, c2: hull2C, trim: 'wIron', trimC: '#5a5652', boltMat: 'wBrass', boltC: trimC, seed, ...o });
  body.add(part((b) => {
    // the hull: a plated core over the treads, a brass-trimmed deck
    b.add(rb(4.2, 2.0, 8.0, 0.12), 'wPaint', { p: [0, 2.4, 0], c: hullC });
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) b.addBuilder(P(2.4, 1.1, 0.12, 1211 + i, { c: wear(i % 2 ? BASALT : '#5a5654', 0.3, i + sx) }), { p: [sx * 2.16, 2.55, -2.6 + i * 2.6], r: [0, sx * PI / 2, 0] });
      b.add(box(0.08, 0.12, 7.6), G, { p: [sx * 2.14, 1.78, 0] }); // a hot seam along the skirt
    }
    b.add(rb(4.6, 0.18, 8.4, 0.04), 'wIron', { p: [0, 3.45, 0], c: ironC });
    for (const sx of [-1, 1]) b.add(box(0.1, 0.1, 8.4), 'wBrass', { p: [sx * 2.3, 3.56, 0], c: trimC });
    // the front: one louvred furnace grille, a toothed intake lip below it
    b.addBuilder(vent(2.6, 1.0, { frame: 'wDark', frameC: '#4a4644', glow: G, n: 6, depth: 0.16 }), { p: [0, 2.5, 4.05] });
    for (const sx of [-1, 1]) b.addBuilder(P(0.7, 1.7, 0.2, 1215, { inset: false }), { p: [sx * 1.75, 2.45, 4.02] });
    b.add(rb(3.8, 0.18, 1.3, 0.04), 'wPaint', { p: [0, 1.3, 4.6], r: [-0.4, 0, 0], c: hull2C });
    for (let i = 0; i < 9; i++) b.add(rb(0.16, 0.12, 0.28, 0.03), 'wMetal', { p: [-1.7 + i * 0.425, 1.02, 5.2], c: '#a8a49c' });
    // the intake hopper: a square tapered bin on four legs, heaped with ore (some still hot), a brass rim
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(rb(0.3, 1.6, 0.3, 0.04), 'wIron', { p: [sx * 1.1, 4.3, 1.6 + sz * 1.1], c: ironC });
    b.add(taper(box(3.0, 1.8, 3.0), 0.55, 0.55, 'y').rotateX(PI), 'wPaint', { p: [0, 5.6, 1.6], c: grime(BASALT, 4.8, 6.4, 0.3, 6) });
    b.add(rb(3.2, 0.14, 3.2, 0.03), 'wBrass', { p: [0, 6.55, 1.6], c: trimC });
    for (let i = 0; i < 22; i++) { const hot = i % 6 === 3; b.add(ico(b.r(0.18, 0.32), 0), hot ? G : 'wRust', { p: [b.r(-1.2, 1.2), 6.55 + b.r(-0.05, 0.25), 1.6 + b.r(-1.2, 1.2)], r: [b.r(0, 3), b.r(0, 3), 0], c: hot ? 0xffffff : wear('#5a4a42', 0.4, i) }); }
    // the drive house behind the hopper: a square block with a square stack, the flywheel bearing on its left
    b.add(rb(2.4, 1.6, 2.0, 0.08), 'wPaint', { p: [0, 4.3, -1.4], c: hull2C });
    b.addBuilder(vent(1.2, 0.7, { frame: 'wDark', frameC: '#4a4644', glow: G, n: 4, depth: 0.12 }), { p: [1.22, 4.3, -1.4], r: [0, PI / 2, 0] });
    b.addBuilder(stack(0.8, 2.4, { c: SOOT, trimC: '#5a5450', seed: 1216 }), { p: [0.5, 5.1, -1.8] });
    b.add(rb(0.6, 1.0, 0.8, 0.05), 'wIron', { p: [-1.5, 4.2, -1.4], c: ironC });
    b.addBuilder(sleeve(0.18, 1.2, { c: '#5a5652' }), { p: [-1.5, 4.3, -0.4], r: [PI / 2, 0, 0] });
    // the stern: three square sorting bins hung off the back, each catching one grade (dark ore, hot ore, grey slag)
    for (let i = 0; i < 3; i++) {
      const x = -1.4 + i * 1.4;
      b.add(rb(1.2, 1.2, 1.2, 0.05), 'wPaint', { p: [x, 2.2, -4.7], c: wear(i === 1 ? '#5a4a40' : BASALT, 0.3, 20 + i) });
      b.add(rb(1.28, 0.1, 1.28, 0.02), 'wBrass', { p: [x, 2.84, -4.7], c: trimC });
      for (let k = 0; k < 6; k++) b.add(ico(b.r(0.12, 0.2), 0), i === 1 && k % 2 ? G : 'wDark', { p: [x + b.r(-0.4, 0.4), 2.85, -4.7 + b.r(-0.4, 0.4)], r: [b.r(0, 3), b.r(0, 3), 0], c: i === 1 && k % 2 ? 0xffffff : i === 2 ? ashC : GLASS });
      // a short square chute from the screens' foot down into the bin
      b.add(rb(0.7, 0.1, 1.2, 0.02), 'wIron', { p: [x, 3.25, -4.1], r: [-0.5, 0, 0], c: ironC });
    }
    b.add(rb(4.4, 0.16, 0.3, 0.04), 'wIron', { p: [0, 1.6, -5.35], c: ironC });
    // ash and soot on every top
    for (let i = 0; i < 24; i++) b.add(ico(b.r(0.08, 0.16), 0), 'wPaint', { p: [b.r(-2.1, 2.1), 3.56, b.r(-3.8, 3.8)], s: [1.5, 0.4, 1.2], r: [0, b.r(0, 3), 0], c: wear(ASH, 0.3, i) });
    bolts(b, 'wBrass', [-2.25, 3.0, -3.8], [-2.25, 3.0, 3.8], 12, 0.05, 'x', trimC);
    bolts(b, 'wBrass', [2.25, 3.0, -3.8], [2.25, 3.0, 3.8], 12, 0.05, 'x', trimC);
  }, 1220));
  // the grading screens, one each side of the drive house: three stepped decks of parallel slats running fore and aft,
  // each pivoted so the machine can shake them
  const screens = [];
  for (const sx of [-1, 1]) {
    const sc = pivot(body, sx * 1.55, 3.7, -2.4);
    sc.add(part((b) => {
      for (let t = 0; t < 3; t++) {
        const y = 0.9 - t * 0.38, z = 1.4 - t * 1.05;
        b.add(rb(1.2, 0.08, 1.0, 0.02), 'wIron', { p: [0, y, z], r: [-0.18, 0, 0], c: ironC });
        for (let k = 0; k < 5; k++) b.add(box(0.06, 0.06, 0.96), 'wMetal', { p: [-0.48 + k * 0.24, y + 0.07, z], r: [-0.18, 0, 0], c: '#b0aca4' });
        for (const ex of [-1, 1]) b.add(rb(0.06, 0.24, 1.02, 0.02), 'wPaint', { p: [ex * 0.62, y + 0.1, z], r: [-0.18, 0, 0], c: hull2C });
        for (let k = 0; k < 3; k++) b.add(ico(b.r(0.08, 0.14), 0), k === 1 && t === 1 ? G : 'wRust', { p: [b.r(-0.4, 0.4), y + 0.16, z + b.r(-0.3, 0.3)], c: k === 1 && t === 1 ? 0xffffff : wear('#6a5a50', 0.4, k + t) });
      }
      for (const ez of [-1, 1]) b.add(rb(0.12, 1.2, 0.12, 0.02), 'wIron', { p: [sx * 0.5, 0.1, 0.4 + ez * 1.1], c: ironC });
    }, 1230 + (sx > 0 ? 1 : 0)));
    screens.push(sc);
  }
  // the flywheel that drives the screens: a solid disc on the left of the drive house
  const fly = pivot(body, -2.15, 4.4, -0.4);
  fly.add(part((b) => b.addBuilder(flywheel(0.95, 0.26, { c: '#4a4644', seed: 1240 })), 1240));
  // the grab arms at the front corners: a plated boom on a turret, a square grab bucket at the end
  const arms = [], buckets = [];
  for (const sx of [-1, 1]) {
    const arm = pivot(body, sx * 1.9, 3.7, 3.3);
    arm.add(part((b) => {
      b.add(rb(0.9, 0.6, 0.9, 0.06), 'wPaint', { c: hull2C });
      b.add(rb(0.4, 0.4, 2.8, 0.05), 'wPaint', { p: [sx * 0.15, 0.3, 1.3], r: [-0.25, 0, 0], c: wear(BASALT, 0.3, 30 + sx) });
      b.add(rb(0.46, 0.06, 2.8, 0.02), 'wIron', { p: [sx * 0.15, 0.53, 1.36], r: [-0.25, 0, 0], c: ironC });
      b.addBuilder(sleeve(0.1, 1.4, { c: '#5a5652', trim: 'wBrass', trimC }), { p: [sx * 0.15, -0.1, 0.8], r: [PI / 2 - 0.4, 0, 0] });
    }, 1250 + (sx > 0 ? 1 : 0)));
    const bk = pivot(arm, sx * 0.15, 0.55, 2.65);
    bk.add(part((b) => {
      b.add(rb(0.2, 0.8, 0.2, 0.03), 'wIron', { p: [0, -0.4, 0], c: ironC });
      b.add(taper(box(1.0, 0.7, 0.9), 0.75, 0.75, 'y').rotateX(PI), 'wPaint', { p: [0, -1.1, 0.1], c: wear(SOOT, 0.3, 32) });
      for (let i = 0; i < 4; i++) b.add(rb(0.14, 0.18, 0.08, 0.02), 'wMetal', { p: [-0.33 + i * 0.22, -1.5, 0.48], c: '#a8a49c' });
      b.add(ico(0.2, 0), G, { p: [0, -0.82, 0.1] });
    }, 1252 + (sx > 0 ? 1 : 0)));
    arms.push(arm); buckets.push(bk);
  }
  const puff = smoke({ rate: 3, life: 3.4, size: 1.4, rise: 1.8, color: 0x4a4644, opacity: 0.55 }); puff.position.set(0.5, 7.7, -1.8); body.add(puff);
  const glow = slotGlow(0xff8030, 2.7, 1.1, 0.7); glow.position.set(0, 2.5, 4.15); body.add(glow);
  const hg = slotGlow(0xff7020, 2.6, 2.6, 0.45, { rx: -PI / 2, d: 0.2 }); hg.position.set(0, 6.7, 1.6); body.add(hg);
  const a = new Anim(root, { base, body, wheels: TR.wheels, screens, fly, arms, buckets });
  a.dynamics.push(puff, glow, hg);
  let dist = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 2.0), e = 1 - Math.pow(1 - k, 2);
      p.body.rotation.z = e * 0.08; p.body.rotation.x = e * 0.05; p.body.position.y = -0.3 * e;
      for (let i = 0; i < 2; i++) { p.arms[i].rotation.x = 0.5 * e; p.buckets[i].rotation.x = 0.6 * e; }
      puff.visible = false; glow.material.opacity = 0.7 * (1 - k); hg.material.opacity = 0.45 * (1 - k * 0.7);
      return;
    }
    puff.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.85) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    p.fly.rotation.x += (1.2 + this.speed) * dt * ts;
    // the screens shake fore and aft with the flywheel, out of step with each other
    for (let i = 0; i < 2; i++) p.screens[i].position.z = -2.4 + Math.sin(p.fly.rotation.x * 2 + i * PI) * 0.06;
    p.body.position.y = Math.abs(Math.sin(this.t * 3.2)) * 0.04 * Math.min(1, this.speed);
    p.body.rotation.z = Math.sin(this.t * 0.7) * 0.004;
    const at = this.stepAttack(dt);
    let lift = 0;
    if (at >= 0) lift = at < 0.4 ? -at / 0.4 : at < 0.55 ? -1 + 2.2 * ((at - 0.4) / 0.15) : 1.2 * (1 - (at - 0.55) / 0.45);
    for (let i = 0; i < 2; i++) {
      const own = i === 0 ? lift : lift * 0.6;
      p.arms[i].rotation.x = own * 0.45 + Math.sin(this.t * 0.6 + i) * 0.04;
      p.arms[i].rotation.y = Math.sin(this.t * 0.4 + i * 2) * 0.12;
      p.buckets[i].rotation.x = -p.arms[i].rotation.x * 0.8;
    }
    glow.material.opacity = 0.55 + 0.2 * Math.sin(this.t * 4.7) * Math.sin(this.t * 2.9);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z += Math.sin(this.t * 25) * this.hitT * 0.015; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  // the Tripo model (tripoModels.js): smoke from its stack
  return wearModel(finish(root, a, 7.5), 'sorter', { fit: 'long', stretch: [0.85, 1.12], fx: [[puff, [0, 0.64, 0]]], motion: MOTION.boss });
}
