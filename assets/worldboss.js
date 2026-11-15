// The Wandering Forge: a world boss. A whole foundry on treads that crawls the north road between Foundry Watch and the
// Highreach. Rust-red hull, a furnace grille glowing in front (bars, not eyes), three chimneys in a line fore and aft, a crane
// with a ladle of molten iron that it swings down on its attackers.
import * as THREE from 'three';
import { box, rbox, cyl, torus, lathe, ico, tube, V3 } from './kit.js';
import { plate, vent, flywheel, stack, sleeve, heroTreads, crawl, wear, grime, bolt, bolts, bdisc } from './bossParts.js';
import { smoke, glowSprite } from './dynamic.js';
import { slotGlow } from './slotGlow.js';
import { Anim, finish, treads, part, pivot, rivets } from './quarryMachines.js';
import { wearModel, MOTION } from './tripoModels.js';

const PI = Math.PI;
const rb = (w, h, d, r) => rbox(w, h, d, r, 1); // low-segment bevel for the many small boss parts
const RUST = '#7a3a24', RUST2 = '#5a2a1a', IRONP = '#5a5a60';

export function buildWanderingForge() {
  const root = new THREE.Group();
  const s = 1.0;
  const base = pivot(root, 0, 0, 0);
  // long tread units under the whole train: a riveted skirt, solid toothed sprockets, crawling track runs
  const TR = heroTreads(base, { gauge: 4.4, len: 16.1, h: 1.6, tw: 1.1, paintC: '#4a3a32', linkC: '#6a645c', road: 2, seed: 640 });
  const wheels = TR.wheels, TRR = 0.8;
  const body = pivot(base, 0, 0, 0);
  const hullC = grime(RUST, 1.8, 4.2, 0.3, 1), hull2C = grime(RUST2, 3.9, 5.6, 0.3, 2), sootC = wear('#3a3230', 0.3, 3), ironC = wear(IRONP, 0.25, 4);
  body.add(part((b) => {
    // the foundry hull: a heavy core, three bolted armour plates down each flank over a molten seam, a skirt band
    b.add(rbox(4.0, 2.2, 6.4, 0.12), 'wPaint', { p: [0, 2.9, 0], c: hullC });
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) b.addBuilder(plate(2.0, 1.0, 0.12, { c: wear(i === 1 ? '#8a4428' : RUST, 0.32, i * 3 + sx), c2: wear(RUST2, 0.3, i), trim: 'wIron', trimC: '#5a5654', seed: 641 + i }), { p: [sx * 2.06, 3.42, -2.15 + i * 2.15], r: [0, sx * PI / 2, 0] });
      b.addBuilder(plate(6.3, 0.62, 0.12, { c: wear('#4a3a32', 0.3, sx), inset: false, trim: 'wIron', trimC: '#6a645c', seed: 645 }), { p: [sx * 2.06, 2.12, 0], r: [0, sx * PI / 2, 0] });
      b.add(box(0.1, 0.1, 6.0), 'wGlowOrange', { p: [sx * 2.04, 2.62, 0] });
    }
    // the deck and its brass edge, a front walkway with a hand rail
    b.add(rb(4.2, 0.14, 6.6, 0.04), 'wIron', { p: [0, 4.05, 0], c: ironC });
    for (const sx of [-1, 1]) b.add(box(0.08, 0.08, 6.6), 'wBrass', { p: [sx * 2.1, 4.13, 0] });
    for (const z of [-2.6, -1.3, 0, 1.3, 2.6]) b.add(box(4.08, 0.08, 0.08), 'wBrass', { p: [0, 3.98, z] });
    for (const sx of [-1, 1]) {
      b.add(cyl(0.035, 0.035, 1.5, 6), 'wIron', { p: [sx * 1.95, 4.75, 2.45], r: [PI / 2, 0, 0], c: '#6a645c' });
      for (const z of [1.8, 2.45, 3.1]) b.add(cyl(0.03, 0.03, 0.7, 6), 'wIron', { p: [sx * 1.95, 4.42, z], c: '#6a645c' });
    }
    // the furnace house: soot-black, plated sides, a sloped brow over the front
    b.add(rb(3.4, 1.4, 4.6, 0.1), 'wPaint', { p: [0, 4.75, -0.6], c: hull2C });
    for (const sx of [-1, 1]) b.addBuilder(plate(4.3, 1.0, 0.1, { c: sootC, c2: wear(RUST2, 0.3, 5), trim: 'wBrass', trimC: 0xffffff, boltMat: 'wIron', boltC: '#8a8478', seed: 646 }), { p: [sx * 1.72, 4.78, -0.6], r: [0, sx * PI / 2, 0] });
    b.addBuilder(plate(3.5, 0.6, 0.14, { c: sootC, trim: 'wBrass', boltMat: 'wIron', boltC: '#8a8478', seed: 647 }), { p: [0, 5.3, 1.72], r: [-0.5, 0, 0] });
    b.add(rb(3.6, 0.16, 4.8, 0.04), 'wIron', { p: [0, 5.5, -0.6], c: ironC });
    // furnace front: plated cheeks, a heavy brow, one louvred grille glowing between them, and a pour trough below
    b.addBuilder(vent(2.9, 1.7, { frame: 'wDark', frameC: '#4a4644', n: 7, depth: 0.16 }), { p: [0, 2.85, 3.3] });
    for (const sx of [-1, 1]) b.addBuilder(plate(0.5, 2.1, 0.22, { c: ironC, inset: false, trim: 'wBrass', boltMat: 'wBrass', seed: 648 }), { p: [sx * 1.75, 2.9, 3.3] });
    b.addBuilder(plate(4.0, 0.55, 0.22, { c: wear(RUST2, 0.3, 7), trim: 'wBrass', boltMat: 'wIron', boltC: '#8a8478', seed: 649 }), { p: [0, 3.95, 3.3], r: [-0.3, 0, 0] });
    b.add(rb(1.3, 0.2, 0.8, 0.05), 'wIron', { p: [0, 1.85, 3.75], r: [0.18, 0, 0], c: ironC });
    b.add(box(1.0, 0.04, 0.7), 'wGlowOrange', { p: [0, 1.97, 3.78], r: [0.18, 0, 0] });
    // the slag plough: two push arms out to a ribbed, angled blade between the treads
    for (const sx of [-1, 1]) {
      b.add(rb(0.3, 0.36, 4.4, 0.05), 'wIron', { p: [sx * 1.25, 1.45, 5.3], r: [0.12, 0, 0], c: ironC });
      b.add(cyl(0.12, 0.12, 2.0, 10), 'wMetal', { p: [sx * 0.7, 1.75, 4.6], r: [PI / 2 - 0.2, 0, 0], c: 0xffffff });
    }
    b.add(rb(3.3, 1.5, 0.22, 0.06), 'wPaint', { p: [0, 0.95, 7.55], r: [-0.32, 0, 0], c: wear('#5a4a3a', 0.35, 8) });
    b.add(rb(3.4, 0.16, 0.3, 0.04), 'wMetal', { p: [0, 0.22, 7.8], r: [-0.32, 0, 0], c: '#c8c4bc' });
    for (const x of [-1.2, -0.4, 0.4, 1.2]) b.add(rb(0.12, 1.3, 0.4, 0.03), 'wIron', { p: [x, 1.0, 7.3], r: [-0.32, 0, 0], c: ironC });
    bolts(b, 'wBrass', [-1.5, 1.55, 7.82], [1.5, 1.55, 7.82], 9, 0.05);
    // the ore tender behind: a plated hopper of rock and glowing slag on frame rails
    for (const sx of [-1, 1]) b.add(rb(0.26, 0.3, 4.8, 0.04), 'wIron', { p: [sx * 1.25, 1.8, -5.5], c: ironC });
    b.add(rb(3.2, 0.2, 4.2, 0.05), 'wIron', { p: [0, 1.98, -5.6], c: ironC });
    for (const sx of [-1, 1]) b.addBuilder(plate(4.2, 1.5, 0.12, { c: wear('#6a3a26', 0.35, 9 + sx), c2: wear(RUST, 0.3, 2), trim: 'wIron', trimC: '#5a5654', seed: 650 }), { p: [sx * 1.62, 2.8, -5.6], r: [0, sx * PI / 2, 0] });
    for (const ez of [-1, 1]) b.addBuilder(plate(3.36, 1.5, 0.12, { c: wear('#6a3a26', 0.35, 11), trim: 'wIron', trimC: '#5a5654', seed: 651 }), { p: [0, 2.8, -5.6 + ez * 2.08], r: [0, ez > 0 ? 0 : PI, 0] });
    for (let i = 0; i < 16; i++) { const x = -1.2 + (i % 4) * 0.8 + b.r(-0.2, 0.2), z = -7.2 + Math.floor(i / 4) * 1.05 + b.r(-0.2, 0.2); b.add(ico(b.r(0.28, 0.45), 0), 'wRust', { p: [x, 3.25 + b.r(0, 0.25), z], r: [b.r(0, 3), b.r(0, 3), 0], c: wear('#5a4a40', 0.4, i) }); }
    // the hot slag shows as one seam running fore and aft between the rocks (scattered glowing lumps read as paired dots from above)
    b.add(box(0.36, 0.08, 3.4), 'wGlowOrange', { p: [0.15, 3.2, -5.6] });
    // conveyor frame from the tender up to the furnace house
    for (const sx of [-1, 1]) b.add(rb(0.12, 0.3, 3.6, 0.03), 'wIron', { p: [sx * 0.62, 4.15, -3.85], r: [-0.6, 0, 0], c: ironC });
    b.add(rb(1.1, 0.06, 3.5, 0.02), 'wDark', { p: [0, 4.06, -3.85], r: [-0.6, 0, 0], c: '#3a3634' });
    for (const sx of [-1, 1]) b.add(rb(0.14, 2.0, 0.14, 0.03), 'wIron', { p: [sx * 0.62, 3.1, -4.9], c: ironC });
    // copper steam pipes along the house
    for (const sx of [-1, 1]) {
      b.add(cyl(0.08, 0.08, 4.2, 8), 'wCopper', { p: [sx * 1.86, 5.35, -0.6], r: [PI / 2, 0, 0], c: wear(0xffffff, 0.3, 12) });
      for (const z of [-2.4, -0.6, 1.2]) b.add(rb(0.22, 0.12, 0.12, 0.03), 'wBrass', { p: [sx * 1.86, 5.35, z] });
    }
    // three square stacks in a single line along the spine
    for (const [z, h] of [[-2.4, 2.5], [-1.0, 2.2], [0.4, 1.9]]) b.addBuilder(stack(0.78, h, { c: '#3a3434', trimC: '#5a5450', seed: 652 + h }), { p: [0, 5.5, z] });
    // flywheel brackets and the piston sleeves down each flank
    for (const sx of [-1, 1]) {
      b.add(rb(0.3, 0.5, 0.5, 0.05), 'wIron', { p: [sx * 2.2, 3.3, -1.7], c: ironC });
      b.addBuilder(sleeve(0.2, 1.5, { c: wear('#6a6460', 0.25, sx) }), { p: [sx * 2.36, 3.3, 0.85], r: [PI / 2, 0, 0] });
    }
  }, 601));
  const puffs = [[-2.4, 2.5], [-1.0, 2.2], [0.4, 1.9]].map(([z, h]) => { const p = smoke({ rate: 3, life: 3.4, size: 1.6, rise: 1.8, color: 0x4a4644, opacity: 0.55 }); p.position.set(0, 5.5 + h + 0.4, z); body.add(p); return p; });
  const glow = slotGlow(0xff8030, 3.0, 1.8, 0.75); glow.position.set(0, 2.85, 3.4); body.add(glow);
  // flank flywheels (solid discs) driving piston rods
  const flys = [], rods = [];
  for (const sx of [-1, 1]) {
    const f = pivot(body, sx * 2.5, 3.3, -1.7);
    f.add(part((b) => b.addBuilder(flywheel(0.95, 0.24, { c: '#5a524c', seed: 655 })), 655));
    flys.push(f);
    const rd = pivot(body, sx * 2.36, 3.3, -0.2);
    rd.add(part((b) => { b.add(cyl(0.08, 0.08, 1.6, 8), 'wMetal', { p: [0, 0, 0.3], r: [PI / 2, 0, 0], c: 0xffffff }); b.add(rb(0.24, 0.3, 0.3, 0.04), 'wMetal', { p: [0, 0, -0.5], c: '#a8a49c' }); }, 656));
    rods.push(rd);
  }
  // the conveyor belt: slats crawling up the incline into the furnace
  const beltF = pivot(body, 0, 4.12, -3.85); beltF.rotation.x = -0.6;
  const belt = pivot(beltF, 0, 0, 0);
  belt.add(part((b) => { for (let i = 0; i < 13; i++) b.add(box(1.0, 0.06, 0.1), 'wIron', { p: [0, 0, -1.65 + i * 0.27], c: '#7a746c' }); }, 657));
  const beltRun = [{ run: belt, dir: -1, span: 0.27 }];
  // the crane: a plated box-girder jib on a turntable, a ram beneath, a solid sheave at the tip
  const crane = pivot(body, 1.6, 5.2, 1.4);
  crane.add(part((b) => {
    b.add(rb(0.9, 0.45, 0.9, 0.08), 'wPaint', { c: ironC });
    b.add(rb(0.7, 0.5, 0.6, 0.06), 'wPaint', { p: [0, 0.2, -0.65], c: wear('#3a3434', 0.3, 13) });
    for (const sx of [-1, 1]) b.add(rb(0.1, 0.42, 3.5, 0.03), 'wPaint', { p: [sx * 0.16, 0.42, 1.5], r: [-0.25, 0, 0], c: wear(RUST2, 0.3, 14 + sx) });
    for (const sy of [-1, 1]) b.add(rb(0.42, 0.06, 3.5, 0.02), 'wIron', { p: [0, 0.42 + sy * 0.2, 1.5 + sy * 0.05], r: [-0.25, 0, 0], c: ironC });
    bolts(b, 'wIron', [0.22, 0.6, 0.2], [0.22, 1.35, 3.0], 7, 0.035, 'x', '#c8a060');
    b.add(cyl(0.09, 0.09, 1.7, 8), 'wMetal', { p: [0, -0.02, 0.9], r: [PI / 2 - 0.45, 0, 0], c: 0xffffff });
    b.add(bdisc(0.22, 0.12, 0.03, 16), 'wIron', { p: [0, 0.9, 3.15], r: [0, 0, PI / 2], c: '#8a8478' });
    b.add(cyl(0.025, 0.025, 1.6, 6), 'wIron', { p: [0, -0.2, 3.1], c: '#2a2a2a' });
  }, 602));
  const ladle = pivot(crane, 0, -1.0, 3.1);
  ladle.add(part((b) => {
    // a square tapered ladle (a round bowl with a round molten pool read as a disc in a ring from above)
    b.add(cyl(0.81, 0.57, 0.9, 4), 'wPaint', { p: [0, -0.4, 0], r: [0, PI / 4, 0], c: wear('#3a3434', 0.35, 15) });
    for (const [y, w] of [[-0.62, 0.94], [-0.3, 1.06]]) b.add(rb(w, 0.07, w, 0.02), 'wIron', { p: [0, y, 0], c: '#6a6460' });
    for (const sz of [-1, 1]) { b.add(rb(1.22, 0.08, 0.1, 0.02), 'wIron', { p: [0, 0.08, sz * 0.56], c: '#6a6460' }); b.add(rb(0.1, 0.08, 1.02, 0.02), 'wIron', { p: [sz * 0.56, 0.08, 0], c: '#6a6460' }); }
    b.add(box(1.04, 0.04, 1.04), 'wGlowOrange', { p: [0, 0.06, 0] });
    b.add(rb(0.3, 0.08, 0.3, 0.02), 'wIron', { p: [0, 0.03, 0.62], c: '#6a6460' });
    for (const sx of [-1, 1]) { b.add(rb(0.08, 0.95, 0.16, 0.02), 'wIron', { p: [sx * 0.66, 0.1, 0], c: '#5a5450' }); bolt(b, 'wIron', [sx * 0.71, -0.3, 0], 0.07, 'x', '#c8a060'); }
    b.add(rb(1.42, 0.1, 0.16, 0.03), 'wIron', { p: [0, 0.6, 0], c: '#5a5450' });
  }, 603));
  const lg = slotGlow(0xff7020, 1.0, 1.0, 0.8, { rx: -PI / 2, d: 0.12 }); lg.position.set(0, 0.12, 0); ladle.add(lg);
  const a = new Anim(root, { base, body, wheels, crane, ladle, flys, rods, belt });
  a.dynamics.push(...puffs);
  let dist = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 2);
      p.body.rotation.z = k * 0.12; p.crane.rotation.x = 0.6 * k; p.body.position.y = -0.3 * k;
      glow.visible = false; lg.visible = false; for (const q of puffs) q.visible = false;
      return;
    }
    glow.visible = true; lg.visible = true; for (const q of puffs) q.visible = true;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    for (const w of p.wheels) w.rotation.x += (this.speed / TRR) * dt;
    dist += this.speed * dt; crawl(TR.runs, dist); crawl(beltRun, this.t * 0.6);
    for (let i = 0; i < 2; i++) { p.flys[i].rotation.x += (0.7 + this.speed * 0.9) * dt; p.rods[i].position.z = -0.2 + Math.sin(p.flys[i].rotation.x) * 0.35; }
    p.body.position.y = Math.abs(Math.sin(this.t * 4)) * 0.04 * Math.min(1, this.speed);
    const at = this.stepAttack(dt);
    let swing = 0;
    if (at >= 0) swing = at < 0.4 ? -at / 0.4 : at < 0.55 ? -1 + 2.2 * ((at - 0.4) / 0.15) : 1.2 * (1 - (at - 0.55) / 0.45);
    p.crane.rotation.x = swing * 0.45 + Math.sin(this.t * 0.7) * 0.05;
    p.crane.rotation.y = Math.sin(this.t * 0.4) * 0.25;
    p.ladle.rotation.x = -p.crane.rotation.x; // the ladle hangs level
    glow.material.opacity = 0.6 + 0.2 * Math.sin(this.t * 5.3) * Math.sin(this.t * 3.1);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z = Math.sin(this.t * 25) * this.hitT * 0.012; }
    for (const q of puffs) q.userData.update(dt, this.t);
  };
  root.scale.setScalar(s);
  // the Tripo model (tripoModels.js): smoke from its three stacks, the furnace glow on its front grille
  return wearModel(finish(root, a, 8.4), 'wforge', { fit: 'long', stretch: [0.88, 1.12], keep: [glow],
    fx: [[puffs[0], [0, 0.4, 0.29]], [puffs[1], [0.08, 0.31, -0.44]], [puffs[2], [0, 0.43, -0.34]], [glow, [0, 0.19, 0.497], { s: 0.6 }]],
    motion: MOTION.boss });
}


// The Dune Dredge: a mid-level world boss of the Sunscar. A sand-yellow dredging engine on wide treads, with two screw
// augers turning in front (seen from above they read as stripes, never a wheel or star), a cab with one long window band,
// and a back conveyor that throws a plume of sand.
// Hero build: plated hull on crawling treads, helical auger flights, a conveyor whose slats crawl, one square stack, a
// louvred engine grille on the left flank, and a flywheel on the right flank.
// variant 1, the Leviathan Hull (Harrow Coast): the same engine dressed as a Shipwrights' hull: tar-dark paint over a pale
// waterline band, copper sheathing along the bow, verdigris trim and a hotter boiler grille.
const SAND = '#c8a060', SAND2 = '#a07840', BRASS = '#d8a650';
export function buildDuneDredge(variant = 0) {
  const lev = variant === 1;
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 3.6, len: 9.9, h: 1.2, tw: 0.62, paintC: lev ? '#2a3238' : '#7a6040', linkC: '#6a645c', road: 2, seed: 610 + variant });
  const wheels = TR.wheels;
  const body = pivot(base, 0, 0, 0);
  const P1 = lev ? wear('#2e3a44', 0.3, 611) : wear(SAND, 0.3, 611), P2 = lev ? wear('#1e262c', 0.3, 612) : wear(SAND2, 0.32, 612);
  const TRIMM = lev ? 'wVerdigris' : 'wBrass', ironC = wear('#5a5650', 0.28, 613);
  body.add(part((b) => {
    b.add(rbox(3.1, 1.5, 5.0, 0.1), 'wPaint', { p: [0, 2.0, -0.2], c: P1 });
    b.add(rbox(3.3, 0.18, 5.3, 0.05), 'wPaint', { p: [0, 1.28, -0.2], c: P2 });
    for (const z of [-2.2, -1.1, 0, 1.1]) b.add(box(3.16, 0.08, 0.08), TRIMM, { p: [0, 2.7, z] });
    // bolted flank plates over a lower band (the Leviathan's band is a pale waterline)
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) b.addBuilder(plate(1.5, 0.8, 0.08, { mat: 'wPaint', c: lev ? wear(i === 1 ? '#34424e' : '#2e3a44', 0.3, i) : wear(i === 1 ? '#d8b070' : SAND, 0.3, i), c2: P2, trim: 'wIron', trimC: '#5a5650', boltMat: TRIMM, seed: 614 + i }), { p: [sx * 1.56, 2.2, -1.85 + i * 1.6], r: [0, sx * PI / 2, 0] });
      b.add(rbox(0.06, 0.22, 5.0, 0.02), 'wPaint', { p: [sx * 1.58, 1.58, -0.2], c: lev ? '#d8d4c8' : '#5a4a34' });
    }
    // the cab: one long window band across the front, a plated roof with a hand rail
    b.add(rbox(2.0, 1.1, 1.6, 0.08), 'wPaint', { p: [0, 3.3, 1.0], c: P2 });
    b.add(box(1.7, 0.26, 0.04), 'wGlowOrange', { p: [0, 3.45, 1.81] });
    b.add(rbox(1.8, 0.06, 0.08, 0.02), 'wIron', { p: [0, 3.6, 1.83], c: ironC });
    b.add(rbox(2.2, 0.12, 1.8, 0.04), 'wPaint', { p: [0, 3.9, 1.0], c: '#5a4a34' });
    for (const sx of [-1, 1]) b.addBuilder(plate(1.4, 0.7, 0.06, { mat: 'wPaint', c: P1, inset: false, trim: TRIMM, boltMat: TRIMM, seed: 617 }), { p: [sx * 1.02, 3.25, 1.0], r: [0, sx * PI / 2, 0] });
    // auger frame across the front
    b.add(rbox(3.4, 0.3, 0.5, 0.05), 'wIron', { p: [0, 1.45, 2.55], c: ironC });
    for (const sx of [-1, 1]) b.addBuilder(plate(1.6, 1.0, 0.2, { mat: 'wIron', c: ironC, inset: false, trim: 'wPaint', trimC: P1, boltMat: TRIMM, seed: 618 }), { p: [sx * 1.6, 1.0, 3.0], r: [0, sx * PI / 2, 0] });
    if (lev) {
      // copper sheathing on the bow, bolted in overlapping strakes
      for (let i = 0; i < 3; i++) b.add(rbox(3.2, 0.32, 0.12, 0.03), 'wCopper', { p: [0, 1.75 + i * 0.3, 2.35 - i * 0.03], r: [-0.25, 0, 0], c: wear(0xffffff, 0.35, i) });
      bolts(b, 'wVerdigris', [-1.45, 2.4, 2.25], [1.45, 2.4, 2.25], 11, 0.04);
    }
    // back conveyor ramp frame (the slats crawl on their own pivot)
    for (const sx of [-1, 1]) b.add(rbox(0.1, 0.24, 2.7, 0.03), 'wIron', { p: [sx * 0.52, 3.2, -2.9], r: [0.5, 0, 0], c: ironC });
    b.add(rbox(0.9, 0.06, 2.6, 0.02), 'wDark', { p: [0, 3.12, -2.9], r: [0.5, 0, 0], c: '#3a3634' });
    // the engine bay: one louvred grille low on the left flank
    b.addBuilder(vent(1.4, 0.5, { frame: 'wDark', glow: 'wGlowOrange', n: 4, depth: 0.1, seed: 619 }), { p: [-1.64, 2.0, -1.0], r: [0, -PI / 2, 0] });
    // one square exhaust stack, off to one side
    b.addBuilder(stack(0.42, 1.5, { mat: 'wDark', c: '#3a3434', trim: TRIMM, trimC: 0xffffff, seed: 620 }), { p: [-1.0, 2.7, -0.8] });
    // flywheel bracket on the right
    b.add(rbox(0.2, 0.36, 0.36, 0.04), 'wIron', { p: [1.66, 2.2, -1.0], c: ironC });
  }, 611 + variant * 10));
  // the two screw augers, turning on horizontal axes across the front: a shaft and one helical flight each
  const augers = [];
  for (const sx of [-0.8, 0.8]) {
    const ag = pivot(body, sx, 0.95, 3.05);
    ag.add(part((b) => {
      b.add(cyl(0.12, 0.12, 1.4, 10), 'wIron', { r: [0, 0, Math.PI / 2], c: '#6a6460' });
      const pts = [];
      for (let i = 0; i <= 48; i++) { const t = i / 48, an = t * PI * 2 * 2.4; pts.push(V3(-0.64 + t * 1.28, Math.cos(an) * 0.34, Math.sin(an) * 0.34)); }
      b.add(tube(pts, 0.07, 5, 96), 'wBrass', { c: lev ? '#b08a50' : 0xffffff });
      for (const x of [-0.72, 0.72]) b.add(bdisc(0.2, 0.06, 0.015, 14), 'wIron', { p: [x, 0, 0], r: [0, 0, PI / 2], c: '#4a4642' });
    }, 612 + augers.length));
    augers.push(ag);
  }
  // conveyor slats
  const cf = pivot(body, 0, 3.2, -2.9); cf.rotation.x = 0.5;
  const belt = pivot(cf, 0, 0, 0);
  belt.add(part((b) => { for (let i = 0; i < 10; i++) b.add(box(0.86, 0.06, 0.1), 'wIron', { p: [0, 0.06, -1.25 + i * 0.27], c: lev ? '#6a7072' : '#8a7a5a' }); }, 621));
  const beltRun = [{ run: belt, dir: -1, span: 0.27 }];
  const fly = pivot(body, 1.86, 2.2, -1.0);
  fly.add(part((b) => b.addBuilder(flywheel(0.6, 0.16, { mat: 'wIron', c: lev ? '#3a4044' : '#6a5a44', hub: TRIMM, seed: 622 })), 622));
  const sand = smoke({ rate: 6, life: 1.8, size: 1.2, rise: 0.6, color: lev ? 0xc8c4b8 : 0xd8b880, opacity: 0.55, spread: 0.6 });
  sand.position.set(0, 4.3, -4.0); body.add(sand);
  const puff = smoke({ rate: 3, life: 2.6, size: 1.0, rise: 1.6, color: 0x4a4644, opacity: 0.5 });
  puff.position.set(-1.0, 4.6, -0.8); body.add(puff);
  const glow = slotGlow(0xff8030, 1.45, 0.55, 0.55, { ry: -PI / 2 }); glow.position.set(-1.71, 2.0, -1.0); body.add(glow);
  const a = new Anim(root, { base, body, wheels, augers, belt, fly });
  a.dynamics.push(glow);
  let dist = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt; const k = Math.min(1, this.deadT / 2);
      p.body.rotation.z = -k * 0.1; p.body.position.y = -0.25 * k; sand.visible = false; puff.visible = false; glow.visible = false;
      return;
    }
    sand.visible = true; puff.visible = true; glow.visible = true;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.6) * dt;
    dist += this.speed * dt; crawl(TR.runs, dist);
    const at = this.stepAttack(dt);
    const spin = 2 + this.speed * 2 + (at >= 0 ? 14 : 0);
    for (const g of p.augers) g.rotation.x += spin * dt;
    crawl(beltRun, this.t * (0.6 + (at >= 0 ? 1.2 : 0)));
    p.fly.rotation.x += (1 + this.speed) * dt;
    p.body.position.y = Math.abs(Math.sin(this.t * 5)) * 0.03 * Math.min(1, this.speed);
    p.body.rotation.x = at >= 0 ? Math.sin(at * Math.PI) * 0.06 : 0;
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z = Math.sin(this.t * 25) * this.hitT * 0.012; }
    sand.userData.rate = 4 + this.speed * 4 + (at >= 0 ? 10 : 0);
    sand.userData.update(dt, this.t); puff.userData.update(dt, this.t); glow.userData.update(dt, this.t);
  };
  // the Tripo model: sand off the top of its conveyor, smoke from its stack, the window slit plated over; the Leviathan
  // Hull is tarred dark
  return wearModel(finish(root, a, 5.2), 'dredge', { fit: 'long', stretch: [0.85, 1.12],
    fx: [[sand, [0, 0.36, -0.49]], [puff, [0.17, 0.44, 0.17]]], motion: MOTION.boss,
    // a plain plate in its paint over the wide dark window slit (above the toothed auger it read as a visor over teeth)
    plates: [{ box: [-0.18, 0.236, 0.358, 0.18, 0.299, 0.386], uv: [0.9494, 0.8383] }],
    tint: lev ? { c: '#4a5660', k: 0.9, b: 0.34 } : null });
}
