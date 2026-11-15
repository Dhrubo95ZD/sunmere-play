// The Makers' automata of the Deepway (levels 36-40): old bronze gone green at the seams, run on water and counterweights.
//  - Sweeper: a low bronze cart on solid wheels with a turning brush drum in front and a hopper on its back
//  - Bronze Warden: a tall slim keeper of the halls, a lens band for a face, a maul-pole and a square shield
//  - Counterweight Engine: two great stilt legs under a housing, a stone weight swinging on a chain between them
//    (variant 1, the First Engine: a water tank on its back and two solid paddle wheels turning at its sides)
// Same interface as the other machines: userData.machine = { update(dt, speed), attack(dur, kind), hit(), die(), revive(), stun }.
// No spokes, no star or cross shapes: wheels are solid discs, poles never carry a crossbar.
import * as THREE from 'three';
import { box, rbox, cyl, sphere, torus } from './kit.js';
import { smoke, glowSprite } from './dynamic.js';
import { slotGlow } from './slotGlow.js';
import { Anim, finish, part, pivot, rivets } from './quarryMachines.js';

const PI = Math.PI;
const BRONZE = '#fff0dc', DARKB = '#d8b48a', VERD = '#8ab8a0';

function solidWheel(b, r, w, p, mat = 'wBronze') {
  b.add(cyl(r, r, w, 22), mat, { r: [0, 0, PI / 2], p, c: DARKB });
  for (const s of [-1, 1]) b.add(torus(r - 0.02, 0.03, 6, 24), 'wBronze', { r: [0, PI / 2, 0], p: [p[0] + s * w / 2, p[1], p[2]], c: BRONZE });
  b.add(cyl(r * 0.28, r * 0.28, w + 0.06, 14), 'wVerdigris', { r: [0, 0, PI / 2], p });
  b.add(box(w + 0.02, r * 0.18, r * 0.12), 'wGlowAmber', { p: [p[0], p[1] + r * 0.78, p[2]] }); // a lit stripe so the turning reads
}

// ==========================================================================
// SWEEPER
// ==========================================================================
export function buildSweeper() {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  body.add(part((b) => {
    b.add(rbox(0.9, 0.42, 1.3, 0.08), 'wBronze', { p: [0, 0.62, -0.05], c: BRONZE });
    b.add(rbox(0.96, 0.08, 1.36, 0.03), 'wVerdigris', { p: [0, 0.86, -0.05], c: VERD });
    // the hopper: an open box of swept grit
    b.add(rbox(0.7, 0.36, 0.6, 0.04), 'wBronze', { p: [0, 1.06, -0.3], c: DARKB });
    b.add(box(0.6, 0.06, 0.5), 'dFloorMine', { p: [0, 1.22, -0.3], c: '#6a5e50' });
    // the brush arm housing at the front and a wide flat lamp bar under the deck lip (no round eye)
    b.add(rbox(0.86, 0.18, 0.3, 0.04), 'wBronze', { p: [0, 0.52, 0.66], c: DARKB });
    b.add(box(0.56, 0.035, 0.02), 'wGlowAmber', { p: [0, 0.76, 0.605] });
    rivets(b, 'wBronze', [[0.4, 0.84, 0.5], [-0.4, 0.84, 0.5], [0.4, 0.84, -0.6], [-0.4, 0.84, -0.6]], 0.03);
  }, 801));
  const wheels = [];
  for (const [sx, z] of [[-1, 0.35], [1, 0.35], [-1, -0.45], [1, -0.45]]) { const w = pivot(body, sx * 0.52, 0.3, z); w.add(part((b) => solidWheel(b, 0.3, 0.12, [0, 0, 0]), 802)); wheels.push(w); }
  // the brush drum: a roller wrapped in bands of bristle
  const brush = pivot(body, 0, 0.26, 0.86);
  brush.add(part((b) => {
    b.add(cyl(0.22, 0.22, 0.92, 16), 'wDark', { r: [0, 0, PI / 2], c: '#4a4036' });
    for (let i = 0; i < 6; i++) b.add(torus(0.22, 0.05, 5, 16), 'dTimber', { r: [0, PI / 2, 0], p: [-0.38 + i * 0.152, 0, 0], c: '#a08458' });
  }, 803));
  const dust = smoke({ rate: 2, life: 1.2, size: 0.4, rise: 0.4, color: 0x9a8a76, opacity: 0.3 });
  dust.position.set(0, 0.1, 1.05); body.add(dust);
  const a = new Anim(root, { body, wheels, brush });
  a.dynamics.push(dust);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 0.7);
      p.body.rotation.z = -k * 0.5; p.body.position.y = -0.1 * k; dust.visible = false;
      return;
    }
    dust.visible = true;
    const ts = this.stun ? 0.1 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 6);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.3) * dt * ts;
    p.brush.rotation.x -= (3 + this.speed * 2) * dt * ts;
    p.body.position.y = Math.abs(Math.sin(this.t * 11)) * 0.012;
    const at = this.stepAttack(dt);
    let lunge = 0;
    if (at >= 0) lunge = at < 0.35 ? -0.3 * (at / 0.35) : at < 0.5 ? -0.3 + 1.3 * ((at - 0.35) / 0.15) : 1 - (at - 0.5) / 0.5;
    p.body.position.z = lunge * 0.35;
    p.body.rotation.x = -lunge * 0.08;
    if (this.hitT > 0) { this.hitT -= dt * 4; p.body.rotation.z = Math.sin(this.t * 40) * this.hitT * 0.05; }
    dust.userData.update(dt, this.t);
  };
  return finish(root, a, 1.6);
}

// ==========================================================================
// BRONZE WARDEN (variant 0 common, 1 the Hall-Keeper rare: darker, gilded trim)
// ==========================================================================
export function buildMakerWarden(variant = 0) {
  const main = 'wBronze', tint = variant === 1 ? '#a87a48' : BRONZE, trim = variant === 1 ? 'wGold' : 'wVerdigris', trimC = variant === 1 ? 0xffffff : VERD;
  const root = new THREE.Group();
  const pelvis = pivot(root, 0, 1.4, 0);
  const torso = pivot(pelvis, 0, 0.1, 0);
  torso.add(part((b) => {
    // a stack of bronze plates, narrow at the waist
    b.add(cyl(0.26, 0.2, 0.3, 14), main, { p: [0, 0.15, 0], c: tint });
    b.add(cyl(0.36, 0.28, 0.5, 14), main, { p: [0, 0.55, 0], c: tint });
    b.add(cyl(0.4, 0.36, 0.14, 14), trim, { p: [0, 0.86, 0], c: trimC });
    for (const y of [0.32, 0.46, 0.66]) b.add(torus(0.3 + y * 0.08, 0.018, 5, 18), trim, { r: [PI / 2, 0, 0], p: [0, y, 0], c: trimC });
    // a water gauge set into the chest: a lit glass tube
    b.add(rbox(0.12, 0.34, 0.06, 0.02), 'wGlowBlue', { p: [0, 0.56, 0.33] });
    b.add(rbox(0.18, 0.4, 0.04, 0.02), main, { p: [0, 0.56, 0.31], c: DARKB });
    // counterweight drum on the back
    b.add(cyl(0.16, 0.16, 0.5, 14), main, { p: [0, 0.6, -0.34], c: DARKB });
    rivets(b, trim, Array.from({ length: 8 }, (_, i) => [Math.sin(i / 8 * PI * 2) * 0.37, 0.86, Math.cos(i / 8 * PI * 2) * 0.37]), 0.022);
  }, 811));
  // a plain squared head with one straight lens slit (no face)
  const head = pivot(torso, 0, 0.96, 0);
  head.add(part((b) => {
    b.add(rbox(0.32, 0.3, 0.32, 0.07), main, { p: [0, 0.17, 0], c: tint });
    b.add(rbox(0.34, 0.05, 0.34, 0.02), trim, { p: [0, 0.33, 0], c: trimC });
    b.add(rbox(0.24, 0.045, 0.04, 0.015), 'wGlowAmber', { p: [0, 0.18, 0.16] });
  }, 812));
  const arms = {};
  for (const sx of [-1, 1]) {
    const sh = pivot(torso, sx * 0.46, 0.76, 0);
    sh.add(part((b) => {
      b.add(sphere(0.12, 12, 10), trim, { c: trimC });
      b.add(cyl(0.07, 0.07, 0.56, 10), main, { p: [0, -0.3, 0], c: tint });
    }, 813));
    const el = pivot(sh, 0, -0.6, 0);
    el.add(part((b) => {
      b.add(sphere(0.09, 10, 8), trim, { c: trimC });
      b.add(cyl(0.065, 0.06, 0.5, 10), main, { p: [0, -0.27, 0], c: tint });
      b.add(rbox(0.12, 0.14, 0.14, 0.03), main, { p: [0, -0.56, 0], c: DARKB });
      if (sx < 0) {
        // the maul-pole: a long bronze shaft with a heavy cylinder head (no crossbar)
        b.add(cyl(0.035, 0.035, 2.2, 8), 'wBronze', { p: [0, -0.56, 0.2], r: [PI / 2, 0, 0], c: DARKB });
        b.add(cyl(0.16, 0.16, 0.42, 14), main, { p: [0, -0.56, 1.3], r: [0, 0, PI / 2], c: tint });
        b.add(cyl(0.17, 0.17, 0.06, 14), trim, { p: [0.19, -0.56, 1.3], r: [0, 0, PI / 2], c: trimC });
        b.add(cyl(0.17, 0.17, 0.06, 14), trim, { p: [-0.19, -0.56, 1.3], r: [0, 0, PI / 2], c: trimC });
      } else {
        // a square shield plate
        b.add(rbox(0.08, 0.8, 0.7, 0.03), main, { p: [0.12, -0.4, 0.05], c: DARKB });
        b.add(rbox(0.09, 0.62, 0.52, 0.03), trim, { p: [0.14, -0.4, 0.05], c: trimC });
      }
    }, 814));
    arms[sx < 0 ? 'R' : 'L'] = { sh, el };
  }
  const legs = {};
  for (const sx of [-1, 1]) {
    const hip = pivot(pelvis, sx * 0.18, -0.02, 0);
    hip.add(part((b) => {
      b.add(sphere(0.11, 10, 8), trim, { c: trimC });
      b.add(cyl(0.085, 0.07, 0.62, 10), main, { p: [0, -0.33, 0], c: tint });
    }, 815));
    const knee = pivot(hip, 0, -0.68, 0);
    knee.add(part((b) => {
      b.add(sphere(0.09, 10, 8), trim, { c: trimC });
      b.add(cyl(0.075, 0.06, 0.6, 10), main, { p: [0, -0.32, 0], c: tint });
      b.add(rbox(0.2, 0.08, 0.34, 0.03), main, { p: [0, -0.66, 0.06], c: DARKB });
    }, 816));
    legs[sx > 0 ? 'L' : 'R'] = { hip, knee };
  }
  const glow = slotGlow(0x7ac8ff, 0.16, 0.4, 0.45); glow.position.set(0, 0.56, 0.37); torso.add(glow);
  const a = new Anim(root, { pelvis, torso, head, arms, legs });
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.0), e = 1 - Math.pow(1 - k, 3);
      p.pelvis.position.y = 1.4 - 0.95 * e; p.torso.rotation.x = 1.0 * e; p.head.rotation.x = 0.5 * e;
      p.legs.L.hip.rotation.x = -1.3 * e; p.legs.L.knee.rotation.x = 1.9 * e; p.legs.R.hip.rotation.x = -1.0 * e; p.legs.R.knee.rotation.x = 1.7 * e;
      p.arms.R.sh.rotation.x = -0.4 * e; glow.visible = false;
      return;
    }
    glow.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 6);
    const sk = Math.min(1, this.speed / 2.5);
    this.phase = ((this.phase || 0) + this.speed * dt * 0.45 * ts) % 1;
    const ph = this.phase * PI * 2, swing = Math.sin(ph) * 0.5 * sk;
    p.legs.L.hip.rotation.x = -swing; p.legs.R.hip.rotation.x = swing;
    p.legs.L.knee.rotation.x = Math.max(0, Math.cos(ph)) * 0.8 * sk + 0.04;
    p.legs.R.knee.rotation.x = Math.max(0, -Math.cos(ph)) * 0.8 * sk + 0.04;
    p.pelvis.position.y = 1.4 - (1 - Math.abs(Math.sin(ph))) * 0.05 * sk + Math.sin(this.t * 1.3) * 0.012;
    p.torso.rotation.y = Math.sin(ph) * 0.1 * sk;
    p.head.rotation.y = Math.sin(this.t * 0.6) * 0.5 * (1 - sk);
    p.arms.R.sh.rotation.x = -0.3 + swing * 0.3; p.arms.R.el.rotation.x = -0.9;
    p.arms.L.sh.rotation.x = -0.35 - swing * 0.3; p.arms.L.el.rotation.x = -1.0; p.arms.L.sh.rotation.z = 0.12;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      // the maul-pole comes up and over and down
      const up = at < 0.45 ? at / 0.45 : 1, down = at < 0.45 ? 0 : Math.min(1, (at - 0.45) / 0.12), rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
      p.arms.R.sh.rotation.x = (-2.4 * up + 2.9 * down) * (1 - rec) - 0.3 * rec;
      p.arms.R.el.rotation.x = -0.9 + 0.5 * down * (1 - rec);
      p.torso.rotation.x = (-0.12 * up + 0.35 * down) * (1 - rec);
    } else p.torso.rotation.x = Math.sin(this.t * 1.1) * 0.02;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.torso.rotation.x -= this.hitT * 0.2; }
  };
  return finish(root, a, 3.1);
}

// ==========================================================================
// COUNTERWEIGHT ENGINE (variant 0) / THE FIRST ENGINE (variant 1)
// ==========================================================================
export function buildCounterweight(variant = 0) {
  const first = variant === 1;
  const root = new THREE.Group();
  const body = pivot(root, 0, 2.6, 0);
  body.add(part((b) => {
    // the housing: a long bronze box across the tops of the legs, a drum inside it
    b.add(rbox(2.2, 0.6, 0.9, 0.08), 'wBronze', { p: [0, 0.2, 0], c: BRONZE });
    b.add(rbox(2.3, 0.1, 1.0, 0.03), 'wVerdigris', { p: [0, 0.55, 0], c: VERD });
    b.add(cyl(0.34, 0.34, 1.0, 18), 'wBronze', { p: [0, 0.2, 0.52], r: [0, 0, PI / 2], c: DARKB });
    rivets(b, 'wVerdigris', Array.from({ length: 10 }, (_, i) => [-1.0 + i * 0.222, 0.44, 0.46]), 0.026);
    if (first) {
      // a riveted water tank on its back with a lit gauge, a stack for the steam of its pumps
      b.add(cyl(0.6, 0.6, 1.6, 20), 'wBronze', { p: [0, 1.05, -0.1], r: [0, 0, PI / 2], c: DARKB });
      for (const x of [-0.6, 0, 0.6]) b.add(torus(0.61, 0.035, 6, 24), 'wVerdigris', { r: [0, PI / 2, 0], p: [x, 1.05, -0.1], c: VERD });
      b.add(rbox(0.9, 0.12, 0.08, 0.03), 'wGlowBlue', { p: [0, 1.05, 0.52] });
      b.add(cyl(0.12, 0.14, 0.9, 12), 'wDark', { p: [0.7, 1.7, -0.3], c: 0xffffff });
    } else {
      b.add(rbox(0.5, 0.16, 0.08, 0.03), 'wGlowAmber', { p: [0, 0.22, 0.47] });
    }
  }, 821));
  // the paddle wheels of the First Engine turn at its sides (solid rims, paddles between, no spokes)
  const paddles = [];
  if (first) for (const sx of [-1, 1]) {
    const w = pivot(body, sx * 1.35, 0.4, 0);
    w.add(part((b) => {
      for (const s of [-1, 1]) b.add(cyl(0.85, 0.85, 0.05, 26), 'wBronze', { r: [0, 0, PI / 2], p: [s * 0.18, 0, 0], c: DARKB });
      for (let k = 0; k < 10; k++) { const a = (k / 10) * PI * 2; b.add(box(0.36, 0.34, 0.05), 'dTimber', { p: [0, Math.cos(a) * 0.7, Math.sin(a) * 0.7], r: [a, 0, 0], c: '#a07c50' }); }
      b.add(cyl(0.16, 0.16, 0.46, 12), 'wVerdigris', { r: [0, 0, PI / 2], c: VERD });
    }, 822));
    paddles.push(w);
  }
  // stilt legs: thigh down and out, shin straight down to a broad foot
  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = pivot(body, sx * 0.95, 0, 0);
    hip.add(part((b) => {
      b.add(sphere(0.22, 12, 10), 'wVerdigris', { c: VERD });
      b.add(rbox(0.26, 1.3, 0.3, 0.05), 'wBronze', { p: [0, -0.65, 0], c: BRONZE });
      b.add(cyl(0.04, 0.04, 1.1, 8), 'wMetal', { p: [sx * 0.16, -0.6, -0.1], c: 0xffffff });
    }, 823));
    const knee = pivot(hip, 0, -1.3, 0);
    knee.add(part((b) => {
      b.add(sphere(0.18, 12, 10), 'wVerdigris', { c: VERD });
      b.add(rbox(0.22, 1.1, 0.26, 0.05), 'wBronze', { p: [0, -0.55, 0], c: DARKB });
      b.add(rbox(0.6, 0.14, 0.8, 0.04), 'wBronze', { p: [0, -1.1, 0.1], c: DARKB });
    }, 824));
    legs.push({ hip, knee });
  }
  // the weight: a chain from the drum, a dressed stone block banded in bronze
  const sw = pivot(body, 0, -0.1, 0);
  const chain = part((b) => { for (let i = 0; i < 6; i++) b.add(torus(0.08, 0.025, 5, 10), 'wIron', { p: [0, -0.12 - i * 0.16, 0], r: [0, i % 2 ? PI / 2 : 0, 0], c: '#5a5650' }); }, 825);
  sw.add(chain);
  const block = pivot(sw, 0, -1.45, 0);
  block.add(part((b) => {
    b.add(rbox(0.9, 0.7, 0.9, 0.06), 'dWallDeep', { c: '#8a8272' });
    b.add(box(0.96, 0.1, 0.96), 'wBronze', { p: [0, 0.2, 0], c: DARKB });
    b.add(box(0.96, 0.1, 0.96), 'wBronze', { p: [0, -0.2, 0], c: DARKB });
  }, 826));
  const lamp = first ? slotGlow(0x7ac8ff, 0.96, 0.2, 0.55) : slotGlow(0xffb060, 0.56, 0.22, 0.55); lamp.position.set(0, first ? 1.05 : 0.22, first ? 0.57 : 0.52); body.add(lamp);
  const steam = first ? smoke({ rate: 3, life: 2.6, size: 0.7, rise: 1.8, color: 0xc8c4bc, opacity: 0.4 }) : null;
  if (steam) { steam.position.set(0.7, 2.2, -0.3); body.add(steam); }
  const a = new Anim(root, { body, legs, sw, block, paddles });
  if (steam) a.dynamics.push(steam);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.2), e = 1 - Math.pow(1 - k, 3);
      p.body.position.y = 2.6 - 1.7 * e; p.body.rotation.z = 0.25 * e;
      p.legs[0].hip.rotation.z = -0.9 * e; p.legs[1].hip.rotation.z = 0.9 * e; p.legs[0].knee.rotation.z = 1.4 * e; p.legs[1].knee.rotation.z = -1.4 * e;
      p.sw.rotation.x = 0; lamp.visible = false; if (steam) steam.visible = false;
      return;
    }
    lamp.visible = true; if (steam) steam.visible = true;
    const ts = this.stun ? 0.12 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    const sk = Math.min(1, this.speed / 2.2);
    this.phase = ((this.phase || 0) + this.speed * dt * 0.32 * ts) % 1;
    const ph = this.phase * PI * 2, swing = Math.sin(ph) * 0.42 * sk;
    p.legs[0].hip.rotation.x = -swing; p.legs[1].hip.rotation.x = swing;
    p.legs[0].knee.rotation.x = Math.max(0, Math.cos(ph)) * 0.6 * sk;
    p.legs[1].knee.rotation.x = Math.max(0, -Math.cos(ph)) * 0.6 * sk;
    p.body.position.y = 2.6 - (1 - Math.abs(Math.sin(ph))) * 0.08 * sk + Math.sin(this.t * 1.1) * 0.02;
    p.body.rotation.z = Math.sin(ph) * 0.05 * sk;
    for (const w of p.paddles) w.rotation.x -= dt * (0.6 + this.speed * 0.5) * ts;
    // the weight sways with the stride; an attack hauls it back and swings it through
    let swingX = Math.sin(this.t * 1.4) * 0.08 + swing * 0.3;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      const back = at < 0.45 ? at / 0.45 : 1, thru = at < 0.45 ? 0 : Math.min(1, (at - 0.45) / 0.15), rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
      swingX = (-0.9 * back + 2.0 * thru) * (1 - rec);
      p.body.rotation.x = (0.08 * back - 0.12 * thru) * (1 - rec);
    } else p.body.rotation.x *= 0.9;
    p.sw.rotation.x = swingX;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.body.rotation.x -= this.hitT * 0.06; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  return finish(root, a, first ? 4.6 : 3.4);
}
