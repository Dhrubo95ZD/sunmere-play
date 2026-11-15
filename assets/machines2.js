// More machines for the new zones:
//  - Runaway Tiller (Brightfield, 3-4): a green-painted tilling engine on solid traction wheels with a spinning tine drum
//  - Dune Strider (Brasswind Dig, 12-14): a two-legged walking engine on long jointed legs, sand-gold plating
//  - Rustwood Sawyer (Rustwood, 15-17): a mossy tracked logging engine with a circular saw arm and a log claw
// Same interface as the other machines: userData.machine = { update(dt, speed), attack(dur, kind), hit(), die(), revive(), stun }.
import * as THREE from 'three';
import { box, rbox, cyl, cone, sphere, torus, lathe, gear } from './kit.js';
import { smoke } from './dynamic.js';
import { plate, vent, flywheel, sleeve, crawl, wear, bolt, bolts, bdisc } from './bossParts.js';
import { Anim, finish, treads, part, pivot, rivets } from './quarryMachines.js';
import { wearModel } from './tripoModels.js';

const PI = Math.PI;

// a traction wheel lying in the YZ plane, axle along x: one plain solid disc with a square axle nut, an offset bolt plate
// and tyre cleats (the old six-spoke wheel read as a star; a raised inner disc and round brass hub read as a disc in a ring)
function solidWheel(b, r, w, mat = 'wIron', c = '#8a8278') {
  b.add(bdisc(r + 0.01, w, Math.min(0.03, w * 0.25), 26), mat, { r: [0, 0, PI / 2], c });
  b.add(rbox(w + 0.06, r * 0.3, r * 0.3, 0.012, 1), 'wBrass', { c: 0xffffff });
  for (const sx of [-1, 1]) {
    b.add(rbox(0.02, r * 0.3, r * 0.2, 0.006, 1), 'wBrass', { p: [sx * (w * 0.58 + 0.01), r * 0.48, 0], c: 0xffffff });
    bolts(b, 'wBrass', [sx * (w * 0.58 + 0.025), r * 0.58, 0], [sx * (w * 0.58 + 0.025), r * 0.38, 0], 2, 0.016, 'x');
  }
  // cleats on the tyre
  for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; b.add(box(w * 0.9, 0.04, 0.08), mat, { p: [0, Math.cos(a) * (r + 0.02), Math.sin(a) * (r + 0.02)], r: [a, 0, 0], c }); }
}

// ==========================================================================
// RUNAWAY TILLER
// ==========================================================================
// variant 1: the Rusted Harvester (Westfold): the same engine, bigger, its paint long gone to rust
// variant 2: the Iron Thresher (first dungeon boss): oxblood paint and ochre trim, plated boiler, a rear firebox grille,
// a side flywheel driving a piston rod, a grain elevator whose slats crawl, and a hooded threshing drum
export function buildTiller(variant = 0) {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  const hero = variant === 2;
  const paint = hero ? wear('#8a3424', 0.28, 61) : variant ? '#a8643a' : '#6f9a4e', paintDark = hero ? wear('#5a2418', 0.3, 62) : variant ? '#7a4a2a' : '#4a6a34';
  const ochre = wear('#c8963a', 0.25, 63);
  body.add(part((b) => {
    // chassis rails and the boiler lying fore-aft
    for (const sx of [-1, 1]) b.add(rbox(0.08, 0.12, 1.7, 0.02), 'wIron', { p: [sx * 0.34, 0.5, 0.05], c: '#5a5a5a' });
    b.add(cyl(0.3, 0.3, 1.0, 18), 'wIron', { p: [0, 0.82, -0.1], r: [PI / 2, 0, 0], c: paint });
    for (const z of [-0.45, 0.0, 0.35]) b.add(torus(0.31, 0.022, 6, 22), 'wBrass', { p: [0, 0.82, z], c: 0xffffff });
    b.add(cyl(0.22, 0.3, 0.08, 18), 'wDark', { p: [0, 0.82, 0.42], r: [PI / 2, 0, 0], c: 0xffffff });
    // a square bolted door plate over the smokebox front, so the boiler end never reads as a round eye in a ring
    b.add(rbox(0.5, 0.5, 0.025, 0.03), 'wIron', { p: [0, 0.82, 0.47], c: paintDark });
    // seed hopper on top, a tool box behind
    b.add(lathe([[0.001, 0], [0.12, 0], [0.28, 0.32], [0.28, 0.4], [0.001, 0.4]], 4), 'wIron', { p: [0, 1.08, -0.15], r: [0, PI / 4, 0], c: paintDark });
    b.add(rbox(0.5, 0.3, 0.32, 0.03), 'wIron', { p: [0, 0.7, -0.72], c: paintDark });
    // chimney
    b.add(cyl(0.06, 0.08, 0.7, 10), 'wDark', { p: [0.16, 1.35, 0.15], c: 0xffffff });
    b.add(cyl(0.1, 0.07, 0.08, 10), 'wCopper', { p: [0.16, 1.72, 0.15], c: 0xffffff });
    // headlamp
    if (hero) {
      // the Thresher's lamp is a boxed lantern up on the right of the smokebox, never a single round eye in the middle
      b.add(rbox(0.12, 0.14, 0.1, 0.02), 'wBrass', { p: [0.2, 1.16, 0.4], c: ochre });
      b.add(box(0.08, 0.08, 0.02), 'wGlowAmber', { p: [0.2, 1.16, 0.455], c: 0xffffff });
      for (const x of [-0.12, 0, 0.12]) bolt(b, 'wBrass', [x, 0.95, 0.49], 0.02, 'z');
    } else {
      // a wide flat lamp bar along the top of the boiler, never a single round eye on the smokebox
      b.add(rbox(0.4, 0.07, 0.1, 0.02), 'wBrass', { p: [0, 1.15, 0.3], c: 0xffffff });
      b.add(box(0.34, 0.035, 0.02), 'wGlowAmber', { p: [0, 1.15, 0.355], c: 0xffffff });
    }
    // the tine drum frame
    for (const sx of [-1, 1]) b.add(rbox(0.06, 0.4, 0.5, 0.02), 'wIron', { p: [sx * 0.46, 0.42, 0.78], r: [0.5, 0, 0], c: paintDark });
    rivets(b, 'wBrass', [[0.35, 0.5, -0.5], [-0.35, 0.5, -0.5], [0.35, 0.5, 0.5], [-0.35, 0.5, 0.5]], 0.025);
    if (hero) {
      // boiler: bolt rows along every band, bolted armour plates down both flanks over the frame
      for (const z of [-0.45, 0.0, 0.35]) for (let i = 0; i < 14; i++) { const a = (i / 14) * PI * 2; bolt(b, 'wBrass', [Math.cos(a) * 0.325, 0.82 + Math.sin(a) * 0.325, z], 0.014, 'z'); }
      for (const sx of [-1, 1]) b.addBuilder(plate(0.9, 0.24, 0.04, { mat: 'wIron', c: paint, c2: paintDark, trim: 'wDark', trimC: '#5a5450', boltMat: 'wBrass', seed: 64 }), { p: [sx * 0.33, 0.66, -0.05], r: [0, sx * PI / 2, -sx * 0.15], order: 'YXZ' });
      // the firebox at the back: a plated box with one glowing louvred grille
      b.add(rbox(0.56, 0.36, 0.36, 0.03), 'wIron', { p: [0, 0.74, -0.72], c: paintDark });
      b.addBuilder(vent(0.36, 0.2, { frame: 'wDark', glow: 'wGlowAmber', n: 3, depth: 0.05, seed: 65 }), { p: [0, 0.72, -0.91], r: [0, PI, 0] });
      b.add(rbox(0.6, 0.05, 0.4, 0.015), 'wBrass', { p: [0, 0.94, -0.72], c: ochre });
      // a square chimney cap and an ochre rim on the hopper
      b.add(rbox(0.22, 0.04, 0.22, 0.01), 'wCopper', { p: [0.16, 1.82, 0.15], c: 0xffffff });
      for (const sx of [-1, 1]) for (const k of [-1, 1]) b.add(box(0.02, 0.06, 0.02), 'wCopper', { p: [0.16 + sx * 0.09, 1.78, 0.15 + k * 0.09], c: 0xffffff });
      b.add(rbox(0.42, 0.04, 0.42, 0.01), 'wBrass', { p: [0, 1.49, -0.15], c: ochre });
      // the hood over the threshing drum, ribbed, with a bolt row along its lip
      b.add(rbox(1.0, 0.05, 0.42, 0.02), 'wIron', { p: [0, 0.56, 0.86], r: [-0.35, 0, 0], c: paint });
      for (const x of [-0.3, 0, 0.3]) b.add(rbox(0.04, 0.05, 0.42, 0.01), 'wBrass', { p: [x, 0.59, 0.86], r: [-0.35, 0, 0], c: ochre });
      bolts(b, 'wBrass', [-0.44, 0.49, 1.05], [0.44, 0.49, 1.05], 7, 0.014, 'y');
      // the grain elevator: a slanted chute from the drum up to the hopper, on the right
      b.add(rbox(0.04, 0.12, 0.95, 0.01), 'wIron', { p: [0.44, 0.92, 0.42], r: [0.62, 0, 0], c: paintDark });
      b.add(rbox(0.04, 0.12, 0.95, 0.01), 'wIron', { p: [0.3, 0.92, 0.42], r: [0.62, 0, 0], c: paintDark });
      // flywheel bracket (left) and the piston sleeve (left flank)
      b.add(rbox(0.08, 0.14, 0.14, 0.02), 'wDark', { p: [-0.36, 1.0, -0.4], c: 0xffffff });
      b.addBuilder(sleeve(0.05, 0.36, { mat: 'wDark', c: '#7a7672', trim: 'wBrass', seed: 66 }), { p: [-0.36, 1.0, 0.05], r: [PI / 2, 0, 0] });
    }
  }, 61));
  const wheels = [];
  for (const sx of [-1, 1]) {
    const w = pivot(body, sx * 0.5, 0.48, -0.45);
    w.add(part((b) => solidWheel(b, 0.46, 0.14, 'wIron', hero ? wear('#5a4a3a', 0.3, 67) : '#8a8278'), 62));
    wheels.push(w);
  }
  const drum = pivot(body, 0, 0.26, 0.92);
  drum.add(part((b) => {
    b.add(cyl(0.08, 0.08, 0.92, 10), 'wIron', { r: [0, 0, PI / 2], c: '#6a6a6a' });
    for (let k = 0; k < 5; k++) for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + k * 0.6, x = -0.36 + k * 0.18;
      b.add(box(0.03, 0.26, 0.05), 'wMetal', { p: [x, Math.cos(a) * 0.15, Math.sin(a) * 0.15], r: [a, 0, 0.2], c: '#c8ccd0' });
    }
    if (hero) {
      // solid end discs and beater bars along the drum
      for (const x of [-0.45, 0.45]) b.add(bdisc(0.22, 0.03, 0.008, 18), 'wIron', { p: [x, 0, 0], r: [0, 0, PI / 2], c: '#5a4a3a' });
      for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2 + 0.26; b.add(box(0.86, 0.025, 0.04), 'wMetal', { p: [0, Math.cos(a) * 0.2, Math.sin(a) * 0.2], r: [a, 0, 0], c: '#a8acb0' }); }
    }
  }, 63));
  let fly = null, rod = null, belt = null;
  if (hero) {
    fly = pivot(body, -0.43, 1.0, -0.4);
    fly.add(part((b) => b.addBuilder(flywheel(0.24, 0.06, { mat: 'wIron', c: '#4a3a30', hub: 'wBrass', seed: 68 })), 68));
    rod = pivot(body, -0.36, 1.0, -0.12);
    rod.add(part((b) => { b.add(cyl(0.02, 0.02, 0.4, 6), 'wMetal', { p: [0, 0, 0.1], r: [PI / 2, 0, 0], c: 0xffffff }); b.add(rbox(0.06, 0.08, 0.06, 0.01), 'wMetal', { p: [0, 0, -0.1], c: '#a8a49c' }); }, 69));
    const ef = pivot(body, 0.37, 0.95, 0.42); ef.rotation.x = 0.62;
    belt = pivot(ef, 0, 0, 0);
    belt.add(part((b) => { for (let i = 0; i < 9; i++) b.add(box(0.12, 0.03, 0.04), 'wIron', { p: [0, 0.03, -0.44 + i * 0.11], c: ochre }); }, 70));
  }
  const beltRun = belt ? [{ run: belt, dir: 1, span: 0.11 }] : null;
  const puff = smoke({ rate: 3, life: 1.6, size: 0.4, rise: 1.0, color: 0x8a8480, opacity: 0.45 });
  puff.position.set(0.16, 1.78, 0.15);
  body.add(puff);
  const a = new Anim(root, hero ? { body, wheels, drum, fly, rod, belt } : { body, wheels, drum });
  a.dynamics.push(puff);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 0.8);
      p.body.rotation.z = k * 0.5; p.body.position.y = -0.1 * k;
      puff.visible = false;
      return;
    }
    puff.visible = true;
    const ts = this.stun ? 0.1 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 6);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.46) * dt * ts;
    p.body.position.y = Math.abs(Math.sin(this.t * 11)) * 0.02;
    const at = this.stepAttack(dt);
    let lunge = 0;
    if (at >= 0) lunge = at < 0.3 ? -0.3 * (at / 0.3) : at < 0.5 ? -0.3 + 1.3 * ((at - 0.3) / 0.2) : 1 - (at - 0.5) / 0.5;
    p.body.position.z = lunge * 0.35;
    p.body.rotation.x = lunge * 0.08 + Math.sin(this.t * 2) * 0.01;
    p.drum.rotation.x += dt * (at >= 0 ? 30 : 6 + this.speed * 2) * ts;
    if (hero) {
      p.fly.rotation.x += dt * (2.5 + this.speed * 2 + (at >= 0 ? 6 : 0)) * ts;
      p.rod.position.z = -0.12 + Math.sin(p.fly.rotation.x) * 0.08;
      crawl(beltRun, this.t * 0.5 * ts);
    }
    if (this.hitT > 0) { this.hitT -= dt * 4; p.body.rotation.z = Math.sin(this.t * 40) * this.hitT * 0.04; }
    puff.userData.update(dt, this.t);
  };
  finish(root, a, 1.8);
  // the Runaway Tiller wears the Tripo model (tripoModels.js): smoke from its square stack (back right of the box)
  if (variant === 0) wearModel(root, 'tiller', { keep: [puff], fx: [[puff, [0.1, 0.84, -0.264]]], fit: 'long',
    motion: { bob: 0.02, bobHz: 11, rock: 0.014, sway: 0.02, lunge: 0.35, flinch: 0.07, sink: 0.1, tilt: 0.5, dieDur: 0.8 } });
  return root;
}

// ==========================================================================
// DUNE STRIDER
// ==========================================================================
export function buildStrider() {
  const root = new THREE.Group();
  const H = 1.75; // hip height
  const pelvis = pivot(root, 0, H, 0);
  const hull = pivot(pelvis, 0, 0.15, 0);
  const sand = '#e8cc98';
  hull.add(part((b) => {
    // a boxy armoured cab on the hips: sloped glacis, a sensor bar across the front (no round eye), a cargo drum behind
    b.add(rbox(1.05, 0.62, 1.2, 0.08), 'wBrass', { p: [0, 0.12, 0], c: sand });
    b.add(rbox(0.95, 0.08, 0.55, 0.03), 'wBrass', { p: [0, 0.38, 0.38], r: [0.55, 0, 0], c: sand });
    b.add(rbox(1.08, 0.06, 1.24, 0.02), 'wCopper', { p: [0, -0.18, 0], c: 0xffffff });
    for (const z of [-0.3, 0.1]) b.add(box(1.08, 0.05, 0.05), 'wCopper', { p: [0, 0.44, z], c: 0xffffff });
    b.add(rbox(0.86, 0.1, 0.06, 0.02), 'wDark', { p: [0, 0.16, 0.6], c: 0xffffff });
    b.add(box(0.74, 0.04, 0.03), 'wGlowAmber', { p: [0, 0.16, 0.63], c: 0xffffff });
    for (const sx of [-1, 1]) b.add(rbox(0.06, 0.3, 0.9, 0.02), 'wCopper', { p: [sx * 0.54, 0.12, 0], c: 0xffffff });
    b.add(cyl(0.26, 0.26, 0.8, 16), 'wIron', { p: [0, 0.3, -0.62], r: [0, 0, PI / 2], c: '#a89a80' });
    for (const x of [-0.3, 0.3]) b.add(torus(0.265, 0.02, 6, 18), 'wBrass', { p: [x, 0.3, -0.62], r: [0, PI / 2, 0], c: 0xffffff });
    // exhausts run out low and backwards
    for (const sx of [-1, 1]) b.add(cyl(0.045, 0.055, 0.5, 10), 'wCopper', { p: [sx * 0.42, 0.0, -0.7], r: [PI / 2 + 0.25, 0, 0], c: 0xffffff });
    rivets(b, 'wCopper', Array.from({ length: 10 }, (_, i) => [(-0.45 + (i % 5) * 0.225), 0.43, i < 5 ? -0.5 : 0.5]), 0.022);
  }, 71));
  const legs = {};
  for (const sx of [-1, 1]) {
    const hip = pivot(pelvis, sx * 0.42, 0, 0);
    hip.add(part((b) => {
      b.add(sphere(0.14, 12, 10), 'wIron', { c: 0xffffff });
      b.add(rbox(0.2, 0.95, 0.24, 0.04), 'wBrass', { p: [0, -0.45, 0.12], r: [-0.3, 0, 0], c: sand });
      b.add(cyl(0.035, 0.035, 0.8, 8), 'wMetal', { p: [sx * 0.08, -0.42, 0.02], r: [-0.3, 0, 0], c: 0xffffff });
    }, 72));
    // knee bends backward (digitigrade), shin down to the ankle, a wide splayed foot for sand
    const knee = pivot(hip, 0, -0.88, 0.38);
    knee.add(part((b) => {
      b.add(sphere(0.1, 10, 8), 'wCopper', { c: 0xffffff });
      b.add(rbox(0.16, 0.8, 0.18, 0.03), 'wBrass', { p: [0, -0.36, -0.14], r: [0.38, 0, 0], c: sand });
      b.add(cyl(0.035, 0.035, 0.7, 8), 'wMetal', { p: [0.1, -0.34, -0.06], r: [0.38, 0, 0], c: 0xffffff });
    }, 73));
    const ankle = pivot(knee, 0, -0.72, -0.3);
    ankle.add(part((b) => {
      b.add(sphere(0.08, 10, 8), 'wIron', { c: 0xffffff });
      b.add(rbox(0.3, 0.06, 0.42, 0.02), 'wDark', { p: [0, -0.15, 0.08], c: 0xffffff });
      for (const t of [-0.12, 0, 0.12]) b.add(cone(0.035, 0.14, 6), 'wMetal', { p: [t, -0.16, 0.34], r: [PI / 2, 0, 0], c: 0xffffff });
      b.add(cyl(0.03, 0.03, 0.14, 6), 'wIron', { p: [0, -0.08, 0], c: 0xffffff });
    }, 74));
    legs[sx > 0 ? 'L' : 'R'] = { hip, knee, ankle };
  }
  const puffs = [-1, 1].map((sx) => { const pf = smoke({ rate: 2, life: 1.4, size: 0.4, rise: 0.8, color: 0xb0a088, opacity: 0.4 }); pf.position.set(sx * 0.42, -0.1, -0.95); hull.add(pf); return pf; });
  const a = new Anim(root, { pelvis, hull, legs });
  a.dynamics.push(...puffs);
  a.phase = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.0), e = 1 - Math.pow(1 - k, 3);
      p.pelvis.position.y = H - 1.2 * e; p.hull.rotation.x = 0.4 * e; p.hull.rotation.z = 0.3 * e;
      p.legs.L.hip.rotation.x = -0.8 * e; p.legs.R.hip.rotation.x = -0.6 * e; p.legs.L.knee.rotation.x = 1.2 * e; p.legs.R.knee.rotation.x = 1.0 * e;
      for (const d of this.dynamics) d.visible = false;
      return;
    }
    for (const d of this.dynamics) d.visible = true;
    const ts = this.stun ? 0.1 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 6);
    const mv = Math.min(1, this.speed / 3);
    this.phase += dt * (2.2 + this.speed * 1.1) * ts;
    const s1 = Math.sin(this.phase), c1 = Math.cos(this.phase);
    const at = this.stepAttack(dt);
    // walk: legs swing in opposition, the lifted leg folds at the knee; idle: a slow weight shift
    for (const [k, sg] of [['L', 1], ['R', -1]]) {
      const L = p.legs[k], sw = s1 * sg;
      L.hip.rotation.x = sw * 0.5 * mv + (1 - mv) * Math.sin(this.t * 0.8 + sg) * 0.04;
      L.knee.rotation.x = Math.max(0, -c1 * sg) * 0.7 * mv;
      L.ankle.rotation.x = -L.hip.rotation.x * 0.6 - L.knee.rotation.x * 0.4;
    }
    p.pelvis.position.y = H + Math.abs(c1) * 0.06 * mv - 0.04;
    p.hull.rotation.x = Math.sin(this.t * 1.3) * 0.03 + mv * 0.06;
    p.hull.rotation.z = s1 * 0.04 * mv;
    if (at >= 0) {
      // a stamping kick with the right leg
      const up = at < 0.45 ? at / 0.45 : 1, down = at < 0.45 ? 0 : Math.min(1, (at - 0.45) / 0.15), rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
      const k = (up - down * 1.4) * (1 - rec);
      p.legs.R.hip.rotation.x = -1.1 * up * (1 - rec) + 0.3 * down * (1 - rec);
      p.legs.R.knee.rotation.x = 1.2 * Math.max(0, k);
      p.hull.rotation.x = -0.15 * up * (1 - rec) + 0.12 * down * (1 - rec);
      p.pelvis.position.y = H + 0.12 * up * (1 - rec) - 0.1 * down * (1 - rec);
    }
    if (this.hitT > 0) { this.hitT -= dt * 4; p.hull.rotation.x -= this.hitT * 0.12; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  return finish(root, a, 3.0);
}

// ==========================================================================
// RUSTWOOD SAWYER
// ==========================================================================
export function buildSawyer() {
  const s = 1.15;
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const wheels = treads(base, s, 1.0 * s, 1.6, 'wRust');
  const body = pivot(base, 0, 0.72 * s, 0);
  const moss = '#6a8a4a';
  body.add(part((b) => {
    b.add(rbox(0.9 * s, 0.62 * s, 1.3 * s, 0.05 * s), 'wRust', { p: [0, 0.3 * s, -0.05 * s], c: 0xffffff });
    b.add(rbox(0.94 * s, 0.07 * s, 1.34 * s, 0.02 * s), 'wIron', { p: [0, 0.62 * s, -0.05 * s], c: 0xffffff });
    // moss and lichen grown over the plates
    for (let i = 0; i < 6; i++) b.add(sphere(0.12 * s, 8, 4, 0, PI * 2, 0, PI / 2), 'wRust', { p: [(-0.3 + (i % 3) * 0.3 + (i > 2 ? 0.1 : 0)) * s, 0.655 * s, (-0.1 + Math.floor(i / 3) * 0.35) * s], s: [1.8, 0.25, 1.4], c: '#8aae5a' });
    // boiler stack and a cab grille with a lamp
    b.add(cyl(0.1 * s, 0.13 * s, 0.9 * s, 12), 'wDark', { p: [-0.25 * s, 1.05 * s, -0.45 * s], c: 0xffffff });
    b.add(cyl(0.15 * s, 0.11 * s, 0.1 * s, 12), 'wCopper', { p: [-0.25 * s, 1.52 * s, -0.45 * s], c: 0xffffff });
    for (let i = 0; i < 5; i++) b.add(box(0.04 * s, 0.32 * s, 0.03 * s), 'wDark', { p: [(-0.24 + i * 0.12) * s, 0.32 * s, 0.61 * s], c: 0xffffff });
    // running lamps: flat slot strips along both flanks, nothing round on the front
    for (const sx of [-1, 1]) {
      b.add(rbox(0.04 * s, 0.08 * s, 0.4 * s, 0.01 * s), 'wBrass', { p: [sx * 0.46 * s, 0.5 * s, 0.3 * s], c: 0xffffff });
      b.add(box(0.02 * s, 0.035 * s, 0.34 * s), 'wGlowRed', { p: [sx * 0.48 * s, 0.5 * s, 0.3 * s], c: 0xffffff });
    }
    // chained logs strapped to the back
    for (let i = 0; i < 3; i++) b.add(cyl(0.1 * s, 0.1 * s, 0.85 * s, 8), 'bark', { p: [(0.12 + (i % 2) * 0.2) * s, (0.76 + (i > 1 ? 0.17 : 0)) * s, -0.3 * s], r: [PI / 2, 0, 0], c: 0xffffff });
    rivets(b, 'wIron', Array.from({ length: 8 }, (_, i) => [(i % 2 ? 0.46 : -0.46) * s, 0.42 * s, (-0.5 + Math.floor(i / 2) * 0.32) * s]), 0.025 * s);
  }, 81));
  // saw arm on the right
  const sh = pivot(body, 0.5 * s, 0.4 * s, 0.35 * s);
  sh.add(part((b) => { b.add(sphere(0.13 * s, 10, 8), 'wBrass', { c: 0xffffff }); b.add(rbox(0.12 * s, 0.12 * s, 0.75 * s, 0.03 * s), 'wDark', { p: [0, 0, 0.37 * s], c: 0xffffff }); }, 82));
  const sawHub = pivot(sh, 0.06 * s, 0, 0.8 * s);
  const saw = pivot(sawHub, 0, 0, 0);
  saw.add(part((b) => {
    b.add(gear(40, 0.5 * s, 0.56 * s, 0.03 * s, { hole: 0.05 * s, spokes: 0, bevel: 0 }), 'wMetal', { r: [0, PI / 2, 0], c: '#d8dce0' });
    b.add(cyl(0.1 * s, 0.1 * s, 0.08 * s, 12), 'wBrass', { r: [0, 0, PI / 2], c: 0xffffff });
  }, 83));
  // a log claw on the left
  const cl = pivot(body, -0.5 * s, 0.35 * s, 0.4 * s);
  cl.add(part((b) => {
    b.add(sphere(0.11 * s, 10, 8), 'wBrass', { c: 0xffffff });
    b.add(rbox(0.1 * s, 0.1 * s, 0.55 * s, 0.02 * s), 'wDark', { p: [0, 0, 0.27 * s], c: 0xffffff });
    for (const sy of [-1, 1]) b.add(cone(0.05 * s, 0.35 * s, 6), 'wIron', { p: [0, sy * 0.1 * s, 0.65 * s], r: [PI / 2 + sy * 0.5, 0, 0], c: 0xffffff });
  }, 84));
  const puff = smoke({ rate: 4, life: 2.2, size: 0.55 * s, rise: 1.2, color: 0x6a6460, opacity: 0.5 });
  puff.position.set(-0.25 * s, 1.6 * s, -0.45 * s);
  body.add(puff);
  const a = new Anim(root, { base, body, wheels, sh, saw, cl });
  a.dynamics.push(puff);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 0.9);
      p.body.rotation.z = -k * 0.3; p.sh.rotation.x = k * 0.8; p.body.position.y = (0.72 - 0.1 * k) * s;
      puff.visible = false;
      return;
    }
    puff.visible = true;
    const ts = this.stun ? 0.1 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 6);
    for (const w of p.wheels) w.rotation.x += (this.speed / (0.2 * s)) * dt * ts;
    p.body.position.y = (0.72 + Math.sin(this.t * 8) * 0.01) * s;
    const at = this.stepAttack(dt);
    let sweep = 0;
    if (at >= 0) sweep = at < 0.35 ? -(at / 0.35) : at < 0.6 ? -1 + 2.2 * ((at - 0.35) / 0.25) : 1.2 * (1 - (at - 0.6) / 0.4);
    // the saw arm sweeps across in front, the claw braces
    p.sh.rotation.y = -sweep * 0.7;
    p.sh.rotation.x = 0.25 + Math.sin(this.t * 1.2) * 0.05 - Math.abs(sweep) * 0.15;
    p.cl.rotation.x = 0.3 + Math.sin(this.t * 0.9 + 1) * 0.05 + (at >= 0 ? 0.2 : 0);
    p.saw.rotation.x += dt * (at >= 0 ? 40 : 12) * ts;
    if (this.hitT > 0) { this.hitT -= dt * 4; p.body.rotation.x = -this.hitT * 0.12; }
    puff.userData.update(dt, this.t);
  };
  return finish(root, a, 2.0);
}
