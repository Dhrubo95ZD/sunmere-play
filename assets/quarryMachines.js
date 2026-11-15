// Ironcliff Quarry machines: the tracked Quarry Driller (drill arm), the Ore Hauler (scoop arm) and the boss,
// the Stonegrinder: a towering tracked crusher with a toothed drum, twin smokestacks and a glowing furnace.
// Same interface as the other machines: userData.machine = { update(dt, speed), attack(dur, kind), hit(), die(), revive(), stun }.
import * as THREE from 'three';
import { Builder, box, rbox, cyl, cone, sphere, torus, lathe, gear, tube, V3 } from './kit.js';
import { plate, vent, stack, heroTreads, crawl, wear, grime, bdisc } from './bossParts.js';
import { glowSprite } from './dynamic.js';
import { slotGlow } from './slotGlow.js';
import { smoke } from './dynamic.js';
import { wearModel, MOTION } from './tripoModels.js';

const PI = Math.PI;
export const part = (fn, seed = 1) => { const b = new Builder(seed); fn(b); return b.build(); };
export const pivot = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
export const rivets = (b, mat, pts, r = 0.02) => { for (const p of pts) b.add(sphere(r, 6, 4), mat, { p, c: 0xffffff }); };

export class Anim {
  constructor(root, parts) { this.root = root; this.p = parts; this.t = Math.random() * 10; this.speed = 0; this.atk = -1; this.atkDur = 0.8; this.hitT = 0; this.dead = false; this.deadT = 0; this.stun = false; this.dynamics = []; }
  attack(dur = 0.8, kind = 'main') { if (this.dead) return; this.atk = 0; this.atkDur = dur; this.atkKind = kind; }
  hit() { this.hitT = 1; }
  die() { this.dead = true; this.deadT = 0; }
  revive() { this.dead = false; this.deadT = 0; }
  stepAttack(dt) { if (this.atk < 0) return -1; this.atk += dt / this.atkDur; if (this.atk >= 1) { this.atk = -1; return -1; } return this.atk; }
}
export function finish(root, a, height) {
  root.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  root.userData.machine = a;
  root.userData.height = height;
  return root;
}
// a tread unit: side plates, road wheels that spin, a track loop of links
export function treads(parent, s, w, len, mat = 'wIron') {
  const wheels = [];
  for (const sx of [-1, 1]) {
    const side = pivot(parent, sx * w / 2, 0, 0);
    side.add(part((b) => {
      b.add(rbox(0.16 * s, 0.42 * s, len * s, 0.04 * s), 'wDark', { p: [0, 0.32 * s, 0], c: 0xffffff });
      // track: flat links top and bottom, rounded ends
      const n = Math.round(len * 7);
      for (let i = 0; i < n; i++) {
        const z = (-len / 2 + (i + 0.5) * (len / n)) * s;
        b.add(box(0.24 * s, 0.05 * s, (len / n) * 0.8 * s), mat, { p: [0, 0.07 * s, z], c: '#8a8278' });
        b.add(box(0.24 * s, 0.05 * s, (len / n) * 0.8 * s), mat, { p: [0, 0.6 * s, z], c: '#8a8278' });
      }
      for (const ez of [-1, 1]) b.add(torus(0.26 * s, 0.035 * s, 6, 14, PI), mat, { p: [0, 0.335 * s, ez * len / 2 * s], r: [0, PI / 2, ez > 0 ? -PI / 2 : PI / 2], c: '#8a8278' });
      rivets(b, 'wBrass', Array.from({ length: 5 }, (_, i) => [sx * 0.085 * s, 0.5 * s, (-len / 2 + 0.2 + i * (len - 0.4) / 4) * s]), 0.025 * s);
    }, 7));
    for (let i = 0; i < 4; i++) {
      const wz = (-len / 2 + 0.25 + i * (len - 0.5) / 3) * s;
      const wh = pivot(side, sx * 0.01 * s, 0.3 * s, wz);
      wh.add(part((b) => { b.add(cyl(0.2 * s, 0.2 * s, 0.2 * s, 14), 'wIron', { r: [0, 0, PI / 2], c: '#a09888' }); b.add(cyl(0.07 * s, 0.07 * s, 0.24 * s, 8), 'wBrass', { r: [0, 0, PI / 2], c: 0xffffff }); }, 8));
      wheels.push(wh);
    }
  }
  return wheels;
}

// ==========================================================================
// QUARRY DRILLER (variant 0) / ORE HAULER (variant 1)
// ==========================================================================
export function buildDriller(variant = 0) {
  const s = variant === 1 ? 1.25 : 1;
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const wheels = treads(base, s, 1.05 * s, 1.5);
  const body = pivot(base, 0, 0.7 * s, 0);
  body.add(part((b) => {
    // boiler drum lying fore-aft with banded plates, a cab box at the back, smokestack
    // 0 Ironcliff driller, 1 Deepmine borer (rusted, bigger), 2 Concord loader (white enamel and brass, a cargo clamp)
    const hull = variant === 2 ? 'wPaint' : variant ? 'wRust' : 'wIron', hullC = variant === 2 ? '#e6dfd0' : variant ? 0xffffff : '#b8b0a4';
    b.add(cyl(0.38 * s, 0.38 * s, 1.1 * s, 18), hull, { p: [0, 0.3 * s, 0.05 * s], r: [PI / 2, 0, 0], c: hullC });
    for (const z of [-0.35, 0.05, 0.45]) b.add(torus(0.39 * s, 0.025 * s, 6, 22), 'wBrass', { p: [0, 0.3 * s, z * s], c: 0xffffff });
    b.add(cyl(0.3 * s, 0.38 * s, 0.1 * s, 18), 'wDark', { p: [0, 0.3 * s, 0.62 * s], r: [PI / 2, 0, 0], c: 0xffffff });
    // a square bolted door plate over the boiler front, so it never reads as a round eye in a ring
    b.add(rbox(0.62 * s, 0.62 * s, 0.03 * s, 0.04 * s), hull, { p: [0, 0.3 * s, 0.685 * s], c: variant === 2 ? '#bdb4a2' : variant ? '#8a7a6a' : '#7a746c' });
    b.add(rbox(0.7 * s, 0.55 * s, 0.5 * s, 0.05 * s), hull, { p: [0, 0.4 * s, -0.62 * s], c: variant === 2 ? '#d8d0c0' : '#9a9288' });
    b.add(box(0.5 * s, 0.18 * s, 0.04 * s), 'wGlowAmber', { p: [0, 0.48 * s, -0.36 * s], c: 0xffffff });
    b.add(cyl(0.07 * s, 0.09 * s, 0.7 * s, 10), 'wCopper', { p: [0.2 * s, 0.95 * s, -0.55 * s], c: 0xffffff });
    b.add(cyl(0.1 * s, 0.08 * s, 0.08 * s, 10), 'wCopper', { p: [0.2 * s, 1.32 * s, -0.55 * s], c: 0xffffff });
    // work lamp: a wide flat bar along the top of the boiler, never a single round eye on its front
    b.add(rbox(0.44 * s, 0.07 * s, 0.12 * s, 0.02 * s), 'wBrass', { p: [0, 0.7 * s, 0.48 * s], c: 0xffffff });
    b.add(box(0.38 * s, 0.035 * s, 0.02 * s), variant === 1 ? 'wGlowRed' : 'wGlowAmber', { p: [0, 0.7 * s, 0.545 * s], c: 0xffffff });
    // side gears
    for (const sx of [-1, 1]) b.add(gear(14, 0.16 * s, 0.2 * s, 0.04 * s, { hole: 0, spokes: 0 }) /* solid: four spokes made a cross */, 'wBrass', { p: [sx * 0.39 * s, 0.3 * s, -0.2 * s], r: [0, PI / 2, 0], c: 0xffffff });
  }, 11 + variant));
  // working arm on the right: shoulder, forearm, tool
  const sh = pivot(body, 0.42 * s, 0.35 * s, 0.35 * s);
  sh.add(part((b) => { b.add(sphere(0.14 * s, 10, 8), 'wBrass', { c: 0xffffff }); b.add(rbox(0.14 * s, 0.14 * s, 0.7 * s, 0.03 * s), 'wDark', { p: [0, 0, 0.35 * s], c: 0xffffff }); }, 13));
  const el = pivot(sh, 0, 0, 0.7 * s);
  el.add(part((b) => { b.add(sphere(0.11 * s, 10, 8), 'wBrass', { c: 0xffffff }); b.add(cyl(0.07 * s, 0.07 * s, 0.6 * s, 10), 'wIron', { p: [0, 0, 0.3 * s], r: [PI / 2, 0, 0], c: '#a8a098' }); }, 14));
  const tool = pivot(el, 0, 0, 0.62 * s);
  if (variant === 0) {
    tool.add(part((b) => {
      b.add(cyl(0.12 * s, 0.12 * s, 0.12 * s, 12), 'wBrass', { r: [PI / 2, 0, 0], c: 0xffffff });
      b.add(cone(0.13 * s, 0.6 * s, 14), 'wMetal', { p: [0, 0, 0.36 * s], r: [PI / 2, 0, 0], c: '#d0d4d8' });
      // spiral flute: small blades winding round the bit
      for (let i = 0; i < 9; i++) { const a = i * 1.1, k = i / 9; b.add(box(0.04 * s, 0.02 * s, 0.09 * s), 'wMetal', { p: [Math.cos(a) * 0.12 * (1 - k) * s, Math.sin(a) * 0.12 * (1 - k) * s, (0.1 + k * 0.5) * s], r: [0, 0, a], c: '#e0e4e8' }); }
    }, 15));
  } else if (variant === 2) {
    // a cargo clamp: two brass jaws
    tool.add(part((b) => {
      b.add(cyl(0.12 * s, 0.12 * s, 0.14 * s, 12), 'wBrass', { r: [PI / 2, 0, 0], c: 0xffffff });
      for (const sx of [-1, 1]) b.add(rbox(0.07 * s, 0.34 * s, 0.42 * s, 0.02 * s), 'wBrass', { p: [sx * 0.17 * s, 0, 0.26 * s], c: 0xffffff });
      b.add(rbox(0.4 * s, 0.08 * s, 0.1 * s, 0.02 * s), 'wPaint', { p: [0, 0, 0.06 * s], c: '#e6dfd0' });
    }, 17));
  } else {
    tool.add(part((b) => {
      b.add(rbox(0.5 * s, 0.32 * s, 0.4 * s, 0.03 * s), 'wRust', { p: [0, -0.05 * s, 0.2 * s], c: 0xffffff });
      for (let i = 0; i < 4; i++) b.add(cone(0.04 * s, 0.14 * s, 6), 'wMetal', { p: [(-0.18 + i * 0.12) * s, -0.2 * s, 0.4 * s], r: [PI / 2 + 0.5, 0, 0], c: 0xffffff });
      for (let i = 0; i < 5; i++) b.add(sphere(0.07 * s, 6, 5), 'stoneDark', { p: [(-0.16 + i * 0.08) * s, 0.06 * s, 0.18 * s], c: '#8a7a6a' });
    }, 16));
  }
  const puff = smoke({ rate: 3, life: 1.8, size: 0.45 * s, rise: 1.0, color: 0x8a8480, opacity: 0.45 });
  puff.position.set(0.2 * s, 1.4 * s, -0.55 * s);
  body.add(puff);
  const a = new Anim(root, { base, body, wheels, sh, el, tool });
  a.dynamics.push(puff);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 0.8);
      p.body.rotation.z = k * 0.35; p.sh.rotation.x = k * 0.9; p.body.position.y = (0.7 - 0.12 * k) * s;
      for (const d of this.dynamics) d.visible = false;
      return;
    }
    for (const d of this.dynamics) d.visible = true;
    const ts = this.stun ? 0.1 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 6);
    for (const w of p.wheels) w.rotation.x += (this.speed / (0.2 * s)) * dt * ts;
    p.body.position.y = (0.7 + Math.sin(this.t * 9) * 0.012) * s;
    p.body.rotation.x = Math.sin(this.t * 2.1) * 0.02;
    const at = this.stepAttack(dt);
    let reach = 0;
    if (at >= 0) reach = at < 0.35 ? -0.6 * (at / 0.35) : at < 0.55 ? -0.6 + 1.6 * ((at - 0.35) / 0.2) : 1.0 * (1 - (at - 0.55) / 0.45);
    p.sh.rotation.x = 0.35 + Math.sin(this.t * 1.4) * 0.06 - reach * 0.45;
    p.el.rotation.x = -0.25 + reach * 0.35;
    if (variant === 0) p.tool.rotation.z += dt * (at >= 0 ? 38 : 9) * ts;
    else p.tool.rotation.x = -reach * 0.8;
    if (this.hitT > 0) { this.hitT -= dt * 4; p.body.rotation.x -= this.hitT * 0.15; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  // the Tripo model (tripoModels.js; borers, the weighbridge and the launch engine are scaled copies): smoke from its stack;
  // the Deepmine haulers rust darker, the Concord's loaders are white enamel
  return wearModel(finish(root, a, 1.6 * s), 'driller', { fit: 'long', stretch: [0.85, 1.12], fx: [[puff, [0, 0.67, -0.39]]], motion: MOTION.mob,
    tint: variant === 1 ? { c: '#b07050', k: 0.3, b: 0.82 } : variant === 2 ? { c: '#f4eee2', k: 1, b: 3.0 } : null });
}

// ==========================================================================
// THE STONEGRINDER (boss)
// ==========================================================================
// variant 1: the Grand Bore (Deepmine boss): the same hull driving a huge fluted drill instead of the drum.
// Hero build: plated hull on crawling treads, a square furnace tower with one louvred grille, a single offset stack and a
// pressure drum (never a pair of round stacks from above), spinning flank flywheels and rams to the head yoke.
export function buildCrusher(variant = 0) {
  const s = variant ? 2.2 : 2.1;
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 1.3 * s, len: 2.0 * s, h: 0.62 * s, tw: 0.27 * s, paintC: variant ? '#4a4a50' : '#6a4a30', linkC: '#6a645c', road: 2, seed: 160 + variant });
  const wheels = TR.wheels;
  const body = pivot(base, 0, 0.75 * s, 0);
  const HULL = variant ? 'wIron' : 'wRust';
  const hullC = variant ? grime('#9a948a', -0.1 * s, 0.5 * s, 0.28, 161) : grime(0xffffff, -0.1 * s, 0.5 * s, 0.25, 161);
  const paintC = variant ? wear('#5a6470', 0.3, 162) : wear('#c8962e', 0.32, 162); // Grand Bore slate blue, Stonegrinder quarry yellow
  const ironC = wear('#7a7670', 0.28, 163);
  body.add(part((b) => {
    // armoured hull: core, bolted flank plates, a sloped glacis, brass deck bands
    b.add(rbox(1.25 * s, 0.6 * s, 1.9 * s, 0.06 * s), HULL, { p: [0, 0.2 * s, -0.05 * s], c: hullC });
    for (const sx of [-1, 1]) b.addBuilder(plate(1.7 * s, 0.34 * s, 0.05 * s, { mat: 'wPaint', c: paintC, c2: wear(variant ? '#46505c' : '#a07024', 0.3, 164), trim: 'wIron', trimC: '#5a5650', boltMat: 'wBrass', seed: 165 }), { p: [sx * 0.64 * s, 0.24 * s, -0.05 * s], r: [0, sx * PI / 2, 0] });
    b.addBuilder(plate(1.15 * s, 0.32 * s, 0.05 * s, { mat: 'wPaint', c: paintC, trim: 'wIron', trimC: '#5a5650', boltMat: 'wBrass', seed: 166 }), { p: [0, 0.38 * s, 0.84 * s], r: [-0.7, 0, 0] });
    for (let i = 0; i < 6; i++) b.add(box(1.28 * s, 0.05 * s, 0.05 * s), 'wBrass', { p: [0, 0.48 * s, (-0.85 + i * 0.32) * s], c: 0xffffff });
    // the furnace tower: square, plated, trim bands, one glowing grille facing forward
    b.add(rbox(0.88 * s, 1.2 * s, 0.88 * s, 0.07 * s), HULL, { p: [0, 1.05 * s, -0.45 * s], c: grime(variant ? '#7a7670' : '#b8a090', 0.5 * s, 1.6 * s, 0.3, 167) });
    for (const y of [0.55, 1.05, 1.6]) b.add(rbox(0.94 * s, 0.06 * s, 0.94 * s, 0.02 * s), 'wBrass', { p: [0, y * s, -0.45 * s], c: wear(0xffffff, 0.2, y * 10) });
    for (const sx of [-1, 1]) b.addBuilder(plate(0.7 * s, 0.4 * s, 0.04 * s, { mat: 'wPaint', c: paintC, inset: false, trim: 'wIron', trimC: '#5a5650', boltMat: 'wBrass', seed: 168 }), { p: [sx * 0.45 * s, 1.3 * s, -0.45 * s], r: [0, sx * PI / 2, 0] });
    b.addBuilder(vent(0.5 * s, 0.42 * s, { frame: 'wDark', n: 4, depth: 0.08 * s }), { p: [0, 0.82 * s, -0.0 * s] });
    b.add(rbox(1.0 * s, 0.08 * s, 1.0 * s, 0.02 * s), 'wIron', { p: [0, 1.68 * s, -0.45 * s], c: ironC });
    // one square stack set back on the left, a pressure drum lying fore-aft on the right
    b.addBuilder(stack(0.26 * s, 0.82 * s, { mat: 'wDark', c: '#3a3634', trim: 'wCopper', trimC: 0xffffff, seed: 169 }), { p: [-0.26 * s, 1.72 * s, -0.66 * s] });
    b.add(cyl(0.14 * s, 0.14 * s, 0.7 * s, 14), 'wCopper', { p: [0.28 * s, 1.88 * s, -0.5 * s], r: [PI / 2, 0, 0], c: wear(0xffffff, 0.25, 170) });
    for (const z of [-0.75, -0.25]) b.add(rbox(0.34 * s, 0.05 * s, 0.05 * s, 0.01 * s), 'wIron', { p: [0.28 * s, 1.75 * s, z * s], c: ironC });
    b.add(cyl(0.035 * s, 0.035 * s, 0.22 * s, 8), 'wBrass', { p: [0.28 * s, 2.07 * s, -0.5 * s], c: 0xffffff });
    for (const sx of [-1, 1]) {
      // catwalk rail along each side of the hull
      b.add(cyl(0.015 * s, 0.015 * s, 1.6 * s, 6), 'wIron', { p: [sx * 0.6 * s, 0.75 * s, -0.1 * s], r: [PI / 2, 0, 0], c: 0xffffff });
      for (let i = 0; i < 4; i++) b.add(cyl(0.015 * s, 0.015 * s, 0.25 * s, 6), 'wIron', { p: [sx * 0.6 * s, 0.63 * s, (-0.8 + i * 0.5) * s], c: 0xffffff });
      // flywheel bracket and a ram from the hull up to the head yoke
      b.add(rbox(0.1 * s, 0.16 * s, 0.16 * s, 0.02 * s), 'wIron', { p: [sx * 0.66 * s, 0.22 * s, 0.35 * s], c: ironC });
      b.add(cyl(0.06 * s, 0.06 * s, 0.5 * s, 10), 'wIron', { p: [sx * 0.48 * s, 0.56 * s, 0.62 * s], r: [1.0, 0, 0], c: ironC });
      b.add(cyl(0.035 * s, 0.035 * s, 0.4 * s, 8), 'wMetal', { p: [sx * 0.48 * s, 0.42 * s, 0.86 * s], r: [1.0, 0, 0], c: 0xffffff });
    }
  }, 21 + variant * 10));
  // flank flywheels: solid toothed discs that turn with the engine
  const flys = [];
  for (const sx of [-1, 1]) {
    const f = pivot(body, sx * 0.72 * s, 0.22 * s, 0.35 * s);
    f.add(part((b) => {
      b.add(gear(20, 0.28 * s, 0.33 * s, 0.05 * s, { hole: 0 }), 'wBrass', { r: [0, PI / 2, 0], c: wear(0xffffff, 0.2, 171) });
      b.add(bdisc(0.12 * s, 0.08 * s, 0.01 * s, 16), 'wBrass', { r: [0, 0, PI / 2], c: '#a08040' });
      b.add(rbox(0.07 * s, 0.1 * s, 0.07 * s, 0.01 * s), 'wBrass', { p: [sx * 0.03 * s, 0.17 * s, 0], c: '#8a6a30' });
    }, 172));
    flys.push(f);
  }
  // the crusher head: a plated yoke holding the drum or drill
  const head = pivot(body, 0, 0.15 * s, 0.95 * s);
  head.add(part((b) => {
    for (const sx of [-1, 1]) {
      b.add(rbox(0.12 * s, 0.5 * s, 0.7 * s, 0.03 * s), 'wDark', { p: [sx * 0.62 * s, 0, 0.25 * s], c: 0xffffff });
      b.add(rbox(0.04 * s, 0.36 * s, 0.56 * s, 0.01 * s), 'wPaint', { p: [sx * 0.69 * s, 0, 0.25 * s], c: paintC });
      for (let k = 0; k < 3; k++) b.add(cyl(0.02 * s, 0.02 * s, 0.03 * s, 6), 'wBrass', { p: [sx * 0.71 * s, 0.14 * s, (0.05 + k * 0.2) * s], r: [0, 0, PI / 2], c: 0xffffff });
      b.add(bdisc(0.1 * s, 0.06 * s, 0.01 * s, 16), 'wBrass', { p: [sx * 0.7 * s, 0, 0.45 * s], r: [0, 0, PI / 2], c: 0xffffff });
    }
    b.add(cyl(0.06 * s, 0.06 * s, 1.36 * s, 10), 'wBrass', { p: [0, 0, 0.45 * s], r: [0, 0, PI / 2], c: 0xffffff });
    b.add(rbox(1.3 * s, 0.1 * s, 0.14 * s, 0.03 * s), 'wPaint', { p: [0, 0.25 * s, 0.02 * s], c: paintC });
  }, 22));
  const drum = pivot(head, 0, 0, 0.45 * s);
  if (variant === 1) drum.add(part((b) => {
    // the bore: a bolted collar, a long cone and one helical flute winding to the tip (a screw, never a star)
    b.add(cyl(0.44 * s, 0.44 * s, 0.28 * s, 22), 'wBrass', { r: [PI / 2, 0, 0], c: wear(0xffffff, 0.2, 173) });
    b.add(cyl(0.46 * s, 0.46 * s, 0.06 * s, 22), 'wIron', { p: [0, 0, 0.12 * s], r: [PI / 2, 0, 0], c: ironC });
    b.add(rbox(0.16 * s, 0.1 * s, 0.3 * s, 0.02 * s), 'wIron', { p: [0, 0.42 * s, 0], c: ironC });
    b.add(cone(0.4 * s, 1.5 * s, 22), 'wMetal', { p: [0, 0, 0.85 * s], r: [PI / 2, 0, 0], c: '#c8ccd0' });
    const pts = [];
    for (let i = 0; i <= 64; i++) { const t = i / 64, an = t * PI * 2 * 3.2, rr = (0.39 * (1 - t) + 0.02) * s; pts.push(V3(Math.cos(an) * rr, Math.sin(an) * rr, (0.12 + t * 1.42) * s)); }
    b.add(tube(pts, (t) => (0.055 - 0.035 * t) * s, 6, 128), 'wMetal', { c: '#e8ecf0' });
  }, 24));
  else drum.add(part((b) => {
    // the grinding drum: solid end discs, two bands, staggered rows of pyramid teeth
    b.add(cyl(0.3 * s, 0.3 * s, 1.1 * s, 20), 'wIron', { r: [0, 0, PI / 2], c: '#9a948a' });
    for (const x of [-0.56, 0.56]) b.add(bdisc(0.38 * s, 0.06 * s, 0.015 * s, 22), 'wIron', { p: [x * s, 0, 0], r: [0, 0, PI / 2], c: '#6a6460' });
    for (const x of [-0.14, 0.14]) b.add(cyl(0.32 * s, 0.32 * s, 0.05 * s, 20), 'wIron', { p: [x * s, 0, 0], r: [0, 0, PI / 2], c: '#5a5450' });
    for (let i = 0; i < 8; i++) for (let k = 0; k < 4; k++) {
      const a = (i / 8) * PI * 2 + k * 0.4, x = (-0.42 + k * 0.28) * s;
      b.add(cone(0.07 * s, 0.2 * s, 4), 'wMetal', { p: [x, Math.cos(a) * 0.37 * s, Math.sin(a) * 0.37 * s], r: [a + PI / 2, 0, 0], c: '#d0d4d8' });
    }
  }, 23));
  const puffs = [[-0.26, 2.75, -0.66, 4, 1.1], [0.28, 2.2, -0.5, 2, 0.6]].map(([x, y, z, rate, size]) => { const p = smoke({ rate, life: 2.6, size, rise: 1.6, color: 0x5a5450, opacity: 0.55 }); p.position.set(x * s, y * s, z * s); body.add(p); return p; });
  const glow = slotGlow(0xff7a30, 0.54 * s, 0.46 * s, 0.6); glow.position.set(0, 0.82 * s, 0.06 * s); body.add(glow);
  const a = new Anim(root, { base, body, wheels, head, drum, flys });
  a.dynamics.push(...puffs, glow);
  let dist = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.4);
      p.head.rotation.x = k * 0.5; p.body.rotation.z = k * 0.12; p.body.position.y = (0.75 - 0.15 * k) * s;
      return;
    }
    const ts = this.stun ? 0.1 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 4);
    for (const w of p.wheels) w.rotation.x += (this.speed / (0.2 * s)) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    for (const f of p.flys) f.rotation.x += (1 + this.speed * 1.5) * dt * ts;
    p.body.position.y = (0.75 + Math.sin(this.t * 6) * 0.01) * s;
    const at = this.stepAttack(dt);
    let slam = 0;
    if (at >= 0) slam = at < 0.4 ? -0.5 * (at / 0.4) : at < 0.6 ? -0.5 + 1.2 * ((at - 0.4) / 0.2) : 0.7 * (1 - (at - 0.6) / 0.4);
    p.head.rotation.x = slam * (this.atkKind === 'slam' ? 0.9 : 0.55);
    p.body.rotation.x = slam * 0.08;
    if (variant === 1) p.drum.rotation.z += dt * (at >= 0 ? 22 : 5) * ts; else p.drum.rotation.x += dt * (at >= 0 ? 16 : 3) * ts;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.body.rotation.z = Math.sin(this.t * 40) * this.hitT * 0.02; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  return finish(root, a, 4.4);
}
