// Machines of the Highreach (levels 20-25): engines built to drink the plateau's storms.
//  - Arc Roller: a drum on two solid wheels with a copper coil mast that crackles blue
//  - Coil Pylon: a planted arc turret, a coil column on a riveted stone and iron base (ranged: it throws arcs)
//  - The Stormengine (boss): a towering tracked engine with a coil tower, capacitor banks and two prong arms
// Same interface as the other machines: userData.machine = { update(dt, speed), attack(dur, kind), hit(), die(), revive(), stun }.
// No spokes, no star or cross shapes: wheels are solid discs, coils are rings.
import * as THREE from 'three';
import { box, rbox, cyl, torus } from './kit.js';
import { smoke } from './dynamic.js';
import { Anim, finish, treads, part, pivot, rivets } from './quarryMachines.js';
import { plate, stack, heroTreads, crawl, wear } from './bossParts.js';

const PI = Math.PI;
const IRON = '#5c6c82', IRON2 = '#46505e', COPPER = '#e08a48'; // slate-blue paint over steel

function disc(b, r, w, p) {
  b.add(cyl(r, r, w, 22), 'wPaint', { r: [0, 0, PI / 2], p, c: '#3e4450' });
  b.add(torus(r - 0.015, 0.035, 6, 26), 'wIron', { r: [0, PI / 2, 0], p: [p[0] + w / 2, p[1], p[2]], c: '#8a8e96' });
  b.add(torus(r - 0.015, 0.035, 6, 26), 'wIron', { r: [0, PI / 2, 0], p: [p[0] - w / 2, p[1], p[2]], c: '#8a8e96' });
  // a square axle nut (a round copper hub ringed by eight bolts read as an eye and a radiating pattern)
  b.add(rbox(w + 0.05, r * 0.3, r * 0.3, 0.02, 1), 'wCopper', { p });
  b.add(box(w + 0.03, r * 0.16, r * 0.1), 'wGlowBlue', { p: [p[0], p[1] + r * 0.82, p[2]] }); // a lit stripe so the turning reads
}

// a coil: a rod wrapped in copper rings, capped with a flat capacitor disc that glows
function coil(b, h, r, y0 = 0, rings = 7) {
  b.add(cyl(r * 0.35, r * 0.4, h, 10), 'wIron', { p: [0, y0 + h / 2, 0], c: IRON2 });
  for (let i = 0; i < rings; i++) { const t = i / (rings - 1); b.add(torus(r * (1 - t * 0.35), r * 0.16, 6, 18), 'wCopper', { r: [PI / 2, 0, 0], p: [0, y0 + h * (0.12 + t * 0.78), 0], c: COPPER }); }
  // square capacitor plates, unlit: two round lit discs in a row read as eyes from above
  b.add(box(r * 2.2, r * 0.3, r * 2.2), 'wIron', { p: [0, y0 + h + r * 0.15, 0], c: '#5a5e66' });
  b.add(box(r * 1.7, r * 0.12, r * 1.7), 'wIron', { p: [0, y0 + h + r * 0.34, 0], c: '#6a7078' });
  // square insulator blocks on the cap, a flat lit strip running fore-aft between them (no round lamp)
  for (const sz of [-1, 1]) b.add(box(r * 0.5, r * 0.32, r * 0.5), 'wPaint', { p: [0, y0 + h + r * 0.56, sz * r * 0.55], c: '#c8c0b0' });
  b.add(box(r * 0.3, r * 0.08, r * 1.5), 'wGlowBlue', { p: [0, y0 + h + r * 0.44, 0] });
}

// the crackle over a coil cap: a flat additive strip (a sprite would read as a round lamp from above)
function capGlow(color, r, y) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  const g = new THREE.Mesh(new THREE.BoxGeometry(r * 0.5, r * 0.14, r * 1.7), m);
  g.position.set(0, y, 0); g.renderOrder = 10; g.userData.s0 = 1;
  return g;
}

function crackle(a, sprite, base, dt, burst = 0) {
  const f = 0.55 + 0.45 * Math.abs(Math.sin(a.t * 23) * Math.sin(a.t * 7.7)) + burst;
  sprite.material.opacity = Math.min(1, base * f);
  sprite.scale.setScalar(sprite.userData.s0 * (0.85 + 0.3 * f));
}

// ==========================================================================
export function buildArcRoller() {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  body.add(part((b) => {
    // the drum lies across the wheels, banded in copper, with a lit grille in front
    b.add(cyl(0.44, 0.44, 0.96, 20), 'wPaint', { r: [0, 0, PI / 2], p: [0, 0.62, 0], c: IRON });
    for (const x of [-0.36, 0, 0.36]) b.add(torus(0.445, 0.03, 6, 24), 'wCopper', { r: [0, PI / 2, 0], p: [x, 0.62, 0] });
    b.add(rbox(0.62, 0.3, 0.2, 0.04), 'wPaint', { p: [0, 0.6, 0.42], c: IRON2 });
    for (let i = 0; i < 4; i++) b.add(box(0.48, 0.03, 0.02), 'wGlowBlue', { p: [0, 0.5 + i * 0.065, 0.53] });
    // a trailing skid and an exhaust stub
    b.add(rbox(0.16, 0.1, 0.7, 0.03), 'wIron', { p: [0, 0.22, -0.55], r: [0.35, 0, 0], c: IRON2 });
    b.add(cyl(0.05, 0.06, 0.32, 10), 'wDark', { p: [0.22, 1.02, -0.3], r: [-0.4, 0, 0] });
    rivets(b, 'wBrass', [[0.3, 0.98, 0.2], [-0.3, 0.98, 0.2], [0.3, 0.98, -0.2], [-0.3, 0.98, -0.2]], 0.025);
  }, 501));
  const wheels = [];
  for (const sx of [-1, 1]) { const w = pivot(body, sx * 0.6, 0.55, 0); w.add(part((b) => disc(b, 0.55, 0.16, [0, 0, 0]), 502)); wheels.push(w); }
  const mast = pivot(body, 0, 1.0, -0.05);
  mast.add(part((b) => coil(b, 0.95, 0.15, 0, 6), 503));
  const spark = capGlow(0x9ad8ff, 0.15, 0.95 + 0.15 * 0.46); mast.add(spark); // a flat lit strip, not a round glow sprite
  const puff = smoke({ rate: 2, life: 1.4, size: 0.35, rise: 1.0, color: 0x7a7c84, opacity: 0.4 });
  puff.position.set(0.22, 1.2, -0.38); body.add(puff);
  const a = new Anim(root, { body, wheels, mast });
  a.dynamics.push(puff);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 0.7);
      p.body.rotation.z = k * 0.6; p.body.position.y = -0.12 * k; p.mast.rotation.x = -0.5 * k;
      spark.visible = false; puff.visible = false;
      return;
    }
    spark.visible = true; puff.visible = true;
    const ts = this.stun ? 0.1 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 6);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.55) * dt * ts;
    p.body.position.y = Math.abs(Math.sin(this.t * 9)) * 0.015;
    const at = this.stepAttack(dt);
    let lunge = 0;
    if (at >= 0) lunge = at < 0.35 ? -0.4 * (at / 0.35) : at < 0.5 ? -0.4 + 1.4 * ((at - 0.35) / 0.15) : 1 - (at - 0.5) / 0.5;
    p.body.position.z = lunge * 0.3;
    p.mast.rotation.x = lunge * 0.35 + Math.sin(this.t * 3.1) * 0.03;
    crackle(this, spark, 0.9, dt, at >= 0 && at > 0.35 && at < 0.6 ? 0.8 : 0);
    if (this.hitT > 0) { this.hitT -= dt * 4; p.body.rotation.z = Math.sin(this.t * 40) * this.hitT * 0.05; }
    puff.userData.update(dt, this.t);
  };
  return finish(root, a, 2.2);
}

// ==========================================================================
export function buildCoilPylon() {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  body.add(part((b) => {
    // a squat stone footing bound in iron
    b.add(rbox(1.2, 0.5, 1.2, 0.08), 'wPaint', { p: [0, 0.25, 0], c: '#8a8478' });
    b.add(rbox(1.26, 0.1, 1.26, 0.03), 'wIron', { p: [0, 0.52, 0], c: IRON });
    for (const [x, z] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) b.add(cyl(0.07, 0.07, 0.62, 8), 'wIron', { p: [x, 0.31, z], c: IRON2 });
    rivets(b, 'wBrass', [[0.6, 0.53, 0], [-0.6, 0.53, 0], [0, 0.53, 0.6], [0, 0.53, -0.6]], 0.03);
  }, 511));
  // the head turns toward its target: a coil column with two short emitter horns
  const head = pivot(body, 0, 0.56, 0);
  head.add(part((b) => {
    coil(b, 1.7, 0.26, 0, 8);
    b.add(rbox(0.5, 0.26, 0.36, 0.05), 'wPaint', { p: [0, 1.0, 0.0], c: IRON });
    // one long emitter prong forward (a single unlit copper horn: no pair of lights that could read as eyes)
    b.add(cyl(0.05, 0.08, 0.7, 8), 'wCopper', { r: [PI / 2 - 0.3, 0, 0], p: [0, 1.12, 0.42] });
    b.add(box(0.16, 0.04, 0.16), 'wBrass', { r: [PI / 2 - 0.3, 0, 0], p: [0, 1.22, 0.76] }); // a square tip plate, not a round disc
    // vertical cooling fins on the sides
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) b.add(box(0.03, 0.22, 0.26), 'wIron', { p: [sx * (0.27 + i * 0.03), 1.0, 0], c: '#5a5e66' });
  }, 512));
  const spark = capGlow(0x9ad8ff, 0.26, 1.7 + 0.26 * 0.46); head.add(spark); // a flat lit strip, not a round glow sprite
  const a = new Anim(root, { body, head });
  a.update = function (dt) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 0.9);
      p.head.rotation.z = k * 0.55; p.head.position.y = 0.56 - 0.25 * k;
      spark.visible = false;
      return;
    }
    spark.visible = true;
    const at = this.stepAttack(dt);
    p.head.rotation.y = Math.sin(this.t * 0.6) * 0.15;
    p.head.position.y = 0.56 + (at >= 0 ? Math.sin(at * PI) * 0.06 : 0);
    crackle(this, spark, 0.85, dt, at >= 0 && at > 0.4 && at < 0.65 ? 1 : 0);
    if (this.hitT > 0) { this.hitT -= dt * 4; p.head.rotation.z = Math.sin(this.t * 40) * this.hitT * 0.04; }
  };
  return finish(root, a, 2.8);
}

// ==========================================================================
export function buildStormengine(variant = 0) {
  const root = new THREE.Group();
  const s = 1.0;
  const body = pivot(root, 0, 0, 0);
  // hero build: plated hull on crawling treads, capacitor banks in riveted cradles, one square stack and a transformer box
  // at the back (never a matched pair from above), square dynamo housings on the rear flanks, plinths under the coil towers
  const TR = heroTreads(body, { gauge: 2.4, len: 4.5, h: 0.9, tw: 0.42, paintC: variant ? '#3a4250' : '#404a58', linkC: '#6a6c70', road: 2, seed: 530 + variant });
  const hullC = wear(IRON, 0.26, 531), hull2C = wear(IRON2, 0.28, 532), trim = variant ? 'wBrass' : 'wCopper';
  body.add(part((b) => {
    // hull and a raised deck
    b.add(rbox(2.0, 1.0, 2.8, 0.1), 'wPaint', { p: [0, 1.45, 0], c: hullC });
    b.add(rbox(2.2, 0.16, 3.0, 0.05), 'wPaint', { p: [0, 1.98, 0], c: hull2C });
    for (const z of [-1.1, -0.4, 0.3, 1.0]) b.add(box(2.06, 0.06, 0.06), 'wCopper', { p: [0, 1.6, z] });
    // bolted armour down both flanks
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 2; i++) b.addBuilder(plate(1.3, 0.62, 0.06, { mat: 'wPaint', c: wear(i ? IRON : '#52627a', 0.3, 533 + i), c2: hull2C, trim: 'wIron', trimC: '#7a7e86', boltMat: trim, seed: 534 + i }), { p: [sx * 1.02, 1.4, -0.68 + i * 1.36], r: [0, sx * PI / 2, 0] });
    }
    // capacitor banks on both flanks, lit from inside, each in a riveted cradle
    for (const sx of [-1, 1]) {
      b.add(rbox(0.6, 0.12, 1.6, 0.03), 'wIron', { p: [sx * 0.85, 2.08, -0.4], c: '#5a5e66' });
      for (let i = 0; i < 3; i++) {
        // square canisters with square plates on top (round brass caps read as lamps from above)
        b.add(rbox(0.38, 0.7, 0.38, 0.03), 'wPaint', { p: [sx * 0.85, 2.4, -0.9 + i * 0.5], c: '#9aa4b0' });
        b.add(box(0.03, 0.46, 0.12), 'wGlowBlue', { p: [sx * (0.85 + 0.19), 2.4, -0.9 + i * 0.5] });
        b.add(box(0.42, 0.06, 0.42), 'wBrass', { p: [sx * 0.85, 2.77, -0.9 + i * 0.5] });
        b.add(rbox(0.5, 0.06, 0.06, 0.01), 'wIron', { p: [sx * 0.85, 2.2, -0.9 + i * 0.5], c: '#5a5e66' });
      }
      b.add(box(0.05, 0.05, 1.1), trim, { p: [sx * 0.85, 2.83, -0.4] });
    }
    // front glacis with one lit grille (no eye), under a bolted brow plate
    b.add(rbox(1.6, 0.8, 0.2, 0.06), 'wPaint', { p: [0, 1.5, 1.45], c: hull2C });
    for (let i = 0; i < 5; i++) b.add(box(1.2, 0.04, 0.03), 'wGlowBlue', { p: [0, 1.25 + i * 0.12, 1.56] });
    for (let i = 0; i < 6; i++) b.add(box(1.24, 0.03, 0.05), 'wIron', { p: [0, 1.19 + i * 0.12, 1.58], c: '#4a4e56' });
    b.addBuilder(plate(2.0, 0.26, 0.06, { mat: 'wPaint', c: hullC, inset: false, trim: 'wIron', trimC: '#7a7e86', boltMat: trim, seed: 536 }), { p: [0, 1.92, 1.48], r: [-0.4, 0, 0] });
    rivets(b, 'wBrass', [[0.95, 1.95, 1.4], [-0.95, 1.95, 1.4], [0.95, 1.95, -1.4], [-0.95, 1.95, -1.4]], 0.05);
    // the back: one square stack on the left, a finned transformer box on the right, a rear plate between
    b.addBuilder(stack(0.32, 0.9, { mat: 'wDark', c: '#3a3c42', trim: 'wIron', trimC: '#6a6e76', seed: 537 }), { p: [-0.6, 2.04, -1.3] });
    b.add(rbox(0.6, 0.5, 0.5, 0.05), 'wPaint', { p: [0.6, 2.3, -1.25], c: hull2C });
    for (let i = 0; i < 5; i++) b.add(box(0.64, 0.03, 0.54), 'wIron', { p: [0.6, 2.1 + i * 0.1, -1.25], c: '#6a6e76' });
    for (const z of [-1.43, -1.25, -1.07]) b.add(box(0.12, 0.24, 0.12), 'wPaint', { p: [0.6, 2.67, z], c: '#c8c0b0' }); // three square insulators in one fore-aft row
    b.addBuilder(plate(1.7, 0.6, 0.06, { mat: 'wPaint', c: hull2C, trim: 'wIron', trimC: '#7a7e86', boltMat: trim, seed: 538 }), { p: [0, 1.45, -1.43], r: [0, PI, 0] });
    // dynamo brackets
    for (const sx of [-1, 1]) b.add(rbox(0.2, 0.3, 0.3, 0.03), 'wIron', { p: [sx * 1.08, 2.25, -0.95], c: '#5a5e66' });
  }, 521));
  // the coil tower rising from the deck, on a plated plinth
  // variant 1, the Thunderhead: twin towers set fore and aft (one line, never a cross), brass-trimmed hull
  const plinth = (b, y0) => {
    b.add(rbox(0.9, 0.36, 0.9, 0.05), 'wIron', { p: [0, y0 + 0.18, 0], c: '#5a5e66' });
    for (const k of [0, 1, 2, 3]) b.addBuilder(plate(0.7, 0.24, 0.04, { mat: 'wIron', c: wear('#7a8090', 0.3, k), inset: false, trim: 'wCopper', boltMat: 'wCopper', seed: 539 + k }), { p: [Math.sin(k * PI / 2) * 0.46, y0 + 0.18, Math.cos(k * PI / 2) * 0.46], r: [0, k * PI / 2, 0] });
  };
  const tower = pivot(body, 0, 2.06, variant ? 0.55 : -0.3);
  tower.add(part((b) => { plinth(b, -0.05); coil(b, variant ? 2.2 : 2.6, 0.42, 0, 10); }, 522));
  const crown = capGlow(0x9ad8ff, 0.42, (variant ? 2.2 : 2.6) + 0.42 * 0.46); tower.add(crown);
  if (variant) {
    const t2 = pivot(tower, 0, 0, -1.25);
    t2.add(part((b) => { plinth(b, -0.05); coil(b, 3.0, 0.46, 0, 12); }, 527));
    const c2 = capGlow(0xc8ecff, 0.46, 3.0 + 0.46 * 0.46); t2.add(c2);
    tower.userData.c2 = c2;
    body.add(part((b) => { for (const sx of [-1, 1]) b.add(box(0.06, 0.08, 2.9), 'wBrass', { p: [sx * 1.02, 1.96, 0] }); b.add(box(2.06, 0.08, 0.06), 'wBrass', { p: [0, 1.96, 1.42] }); }, 528));
  }
  // two prong arms that slam down
  const arms = [];
  for (const sx of [-1, 1]) {
    const sh = pivot(body, sx * 1.15, 2.0, 0.9);
    sh.add(part((b) => {
      b.add(rbox(0.36, 0.36, 0.36, 0.06), 'wPaint', { c: hull2C });
      b.add(rbox(0.22, 0.22, 1.5, 0.05), 'wPaint', { p: [0, -0.1, 0.75], c: hullC });
      for (const k of [-1, 1]) b.add(box(0.1, 0.1, 0.6), 'wCopper', { p: [k * 0.1, -0.1, 1.75] });
      b.add(box(0.2, 0.05, 0.05), 'wGlowBlue', { p: [0, -0.1, 2.06] }); // a flat lit bar between the prongs, not a round lamp
      // armour sleeve and bolted cheek plates along the arm, insulator bands near the prongs
      b.add(rbox(0.3, 0.3, 0.7, 0.04), 'wPaint', { p: [0, -0.06, 0.45], c: wear('#52627a', 0.3, 540) });
      for (const k of [-1, 1]) for (let i = 0; i < 4; i++) b.add(box(0.03, 0.04, 0.04), 'wCopper', { p: [k * 0.16, 0.02, 0.2 + i * 0.17] });
      for (const z of [1.3, 1.42]) b.add(box(0.3, 0.3, 0.05), 'wPaint', { p: [0, -0.1, z], c: '#c8c0b0' }); // square insulator plates, not round discs
      b.add(cyl(0.05, 0.05, 0.6, 8), 'wCopper', { p: [0, -0.26, 0.3], r: [PI / 2 - 0.3, 0, 0] });
    }, 523 + sx));
    arms.push({ sh, sx });
  }
  // dynamo housings on the rear flanks: square bolted plates with a lit slot; they hum (a small shake) when the arms discharge
  // (round flywheels read as discs along both sides)
  const dyn = [];
  for (const sx of [-1, 1]) {
    const f = pivot(body, sx * 1.24, 2.25, -0.95);
    f.add(part((b) => {
      b.addBuilder(plate(0.76, 0.76, 0.1, { mat: 'wIron', c: wear('#4a5260', 0.3, 541), trim: 'wIron', trimC: '#7a7e86', boltMat: 'wCopper', seed: 541 }), { r: [0, sx * PI / 2, 0] });
      b.add(box(0.06, 0.1, 0.5), 'wGlowBlue', { p: [sx * 0.06, 0.18, 0] });
      b.add(box(0.06, 0.08, 0.3), 'wCopper', { p: [sx * 0.06, -0.18, 0] });
    }, 541));
    dyn.push(f);
  }
  const puffs = [-0.6].map((x) => { const p = smoke({ rate: 4, life: 2.4, size: 1.1, rise: 1.4, color: 0x5a5c62, opacity: 0.5 }); p.position.set(x, 3.2, -1.3); body.add(p); return p; });
  const a = new Anim(root, { body, tower, arms, wheels: TR.wheels, dyn });
  a.dynamics.push(...puffs);
  let dist = 0, dspin = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.4);
      p.tower.rotation.z = k * 0.4; p.body.position.y = -0.2 * k;
      for (const A of p.arms) A.sh.rotation.x = 0.6 * k;
      crown.visible = false; for (const q of puffs) q.visible = false;
      return;
    }
    crown.visible = true; for (const q of puffs) q.visible = true;
    this.speed += (speed - this.speed) * Math.min(1, dt * 4);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.45) * dt;
    dist += this.speed * dt; crawl(TR.runs, dist);
    p.body.position.y = Math.abs(Math.sin(this.t * 6)) * 0.03 * Math.min(1, this.speed);
    const at = this.stepAttack(dt);
    let lift = 0;
    if (at >= 0) lift = at < 0.45 ? at / 0.45 : at < 0.6 ? 1 - ((at - 0.45) / 0.15) * 1.6 : -0.6 * (1 - (at - 0.6) / 0.4);
    for (const A of p.arms) A.sh.rotation.x = -lift * 0.9 + Math.sin(this.t * 1.3 + A.sx) * 0.04;
    dspin += ((at >= 0 ? 9 : 1.6 + this.speed) - dspin) * Math.min(1, dt * 2);
    for (const f of p.dyn) f.position.x = Math.sign(f.position.x) * (1.24 + Math.min(0.02, dspin * 0.002) * Math.sin(this.t * 40));
    p.tower.rotation.z = Math.sin(this.t * 0.9) * 0.015;
    crackle(this, crown, 0.95, dt, at >= 0 && at > 0.45 && at < 0.7 ? 1 : 0);
    if (tower.userData.c2) crackle(this, tower.userData.c2, 0.95, dt, at >= 0 && at > 0.5 && at < 0.75 ? 1 : 0);
    if (this.hitT > 0) { this.hitT -= dt * 3; p.body.rotation.z = Math.sin(this.t * 30) * this.hitT * 0.02; }
    for (const q of puffs) q.userData.update(dt, this.t);
  };
  root.scale.setScalar(s);
  return finish(root, a, 5.2);
}
