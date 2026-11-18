// Machines of the Cinder Reach (Part Ten, levels 40-45): the Makers' first works on a volcanic island, still running
// untended after centuries. Ash-grey plating crusted with ash, slag dripping from every lower edge, glassy black slag
// and glowing seams where the heat still gets through.
//  - Ash Sentinel (0 ash-grey, 1 cinder-glass): a heavy walking guard with a furnace door on the chest, one visor slit
//  - Slag Hauler (0/1): a squat tracked hauler with a tipping skip of glowing slag and a front scoop
//  - Ore Crawler (0 cone drill, 1 toothed drum): a low wide machine on solid road wheels with a drill and an ore hopper
//  - Furnace Keeper (elite): a tall narrow tender with long tongs, a poker arm and a furnace belly
//  - The Ashwright (world boss): a vast ore smelter on treads: two square smelting towers, a pouring ladle crane,
//    an ore conveyor in and a slag chute out, solid flywheels
// Same interface as the other machines: userData.machine = { update(dt, speed), attack(dur, kind), hit(), die(), revive(), stun }.
// Content rules: no faces (one slit or one grille, never paired lamps), no spokes (solid discs with an offset bolt plate),
// no domes, rings, stars or radiating patterns; stacks and towers are square from above.
import * as THREE from 'three';
import { box, rbox, cyl, cone, sphere, ico } from './kit.js';
import { plate, vent, flywheel, stack, sleeve, heroTreads, crawl, wear, grime, bolt, bolts, bdisc } from './bossParts.js';
import { smoke, glowSprite } from './dynamic.js';
import { slotGlow } from './slotGlow.js';
import { Anim, finish, part, pivot } from './quarryMachines.js';
import { wearModel, MOTION } from './tripoModels.js';

const PI = Math.PI;
const rb = (w, h, d, r) => rbox(w, h, d, r, 1);
// armour plates with slightly coarser bolt rows than the boss kit default (fewer triangles on the common mobs)
const pl = (w, h, d, o = {}) => plate(w, h, d, { br: Math.max(0.032, Math.min(0.06, Math.min(w, h) * 0.05)), ...o });
const ASH = '#c4c0b8', ASH2 = '#a29e98', ASHL = '#dedad2', GLASS = '#34302f', SOOT = '#2a2828', IRONR = '#5c5650', BRASSO = '#9a8462';

// palette per variant: 0 ash-grey plating, orange heat; 1 black cinder-glass plating, red heat
function pal(v) {
  return v ? { paint: '#4a4646', paint2: '#383434', crust: '#9a9690', glow: 'wGlowRed', glowHex: 0xff4a20, trim: '#7a6a56' }
    : { paint: ASH, paint2: ASH2, crust: ASHL, glow: 'wGlowOrange', glowHex: 0xff8030, trim: BRASSO };
}
// ash crust over a top face: one even cap of settled ash over nearly the whole face.
// (RF.7 review) It was a scatter of separate pale lumps, and on a dark top (the cinder-glass variant, the Furnace Keeper)
// that read as the pips of a die from straight above, the same fault as the Rime Steps' frost. n seeds the tint.
function ash(b, cx, y, cz, w, d, n, col, s = 0.08) {
  if (w * d < 0.4) return; // a small pale square on a dark top reads as a dot, or the centre of a target round a head
  const t = s * 0.4;
  b.add(rb(w * 0.98, t, d * 0.96, t * 0.45), 'wPaint', { p: [cx, y, cz], c: wear(col, 0.08, n) });
}
// slag drips hanging off a lower edge from a to z: dark glassy cones, every few one still glowing at the tip
function drips(b, a, z, n, len, glow, every = 3, r = null) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1), l = len * b.r(0.45, 1.1), rr = r ?? len * 0.28;
    const x = a[0] + (z[0] - a[0]) * t, y = a[1] + (z[1] - a[1]) * t, zz = a[2] + (z[2] - a[2]) * t;
    b.add(cone(rr, l, 6), 'wDark', { p: [x, y - l / 2, zz], r: [PI, b.r(0, 3), 0], c: GLASS });
    if (every && i % every === 1) b.add(cone(rr * 0.45, l * 0.35, 5), glow, { p: [x, y - l * 0.92, zz], r: [PI, 0, 0] });
  }
}
// a glowing seam: a thin hot strip under two dark lips (reads as cracked heat, not a lamp)
function seam(b, glow, p, len, axis = 'z', t = 0.05) {
  const s = axis === 'z' ? [t, t, len] : axis === 'x' ? [len, t, t] : [t, len, t];
  b.add(box(...s), glow, { p });
}

// ==========================================================================
// ASH SENTINEL: a heavy walking guard (3 m)
// ==========================================================================
export function buildAshSentinel(variant = 0) {
  const v = variant === 1, P = pal(v), G = P.glow;
  const plateC = wear(P.paint, 0.32, 1 + variant), plate2C = wear(P.paint2, 0.3, 3), ironC = wear(IRONR, 0.25, 4), trimC = wear(P.trim, 0.3, 5);
  const root = new THREE.Group();
  const PY = 1.36;
  const pelvis = pivot(root, 0, PY, 0);
  const torso = pivot(pelvis, 0, 0.1, 0);
  torso.add(part((b) => {
    b.add(rb(1.12, 1.0, 0.8, 0.1), 'wPaint', { p: [0, 0.55, 0], c: grime(P.paint, 0.0, 0.8, 0.3, 2 + variant) });
    // upper chest armour and flank plates
    b.addBuilder(pl(0.98, 0.42, 0.1, { c: plateC, c2: plate2C, trim: 'wIron', trimC: '#5a5652', boltMat: 'wBrass', boltC: trimC, seed: 811 }), { p: [0, 0.82, 0.42], r: [-0.06, 0, 0] });
    for (const sx of [-1, 1]) b.addBuilder(pl(0.66, 0.74, 0.08, { c: plate2C, trim: 'wIron', trimC: '#5a5652', boltMat: 'wBrass', boltC: trimC, seed: 812, lips: false, sideLips: true }), { p: [sx * 0.58, 0.55, 0], r: [0, sx * PI / 2, 0] });
    // the furnace door low on the chest: a dark frame, a louvred hot grille and a hinged door bar on one side
    b.add(rb(0.66, 0.5, 0.08, 0.03), 'wDark', { p: [0, 0.33, 0.39], c: SOOT });
    b.addBuilder(vent(0.52, 0.38, { frame: 'wDark', frameC: '#4a4644', glow: G, n: 4, depth: 0.1 }), { p: [0, 0.33, 0.44] });
    b.add(rb(0.06, 0.46, 0.07, 0.02), 'wIron', { p: [-0.32, 0.33, 0.46], c: ironC });
    for (const y of [0.18, 0.48]) b.add(cyl(0.035, 0.035, 0.1, 8), 'wBrass', { p: [-0.34, y, 0.47], c: trimC });
    b.add(rb(0.09, 0.06, 0.08, 0.02), 'wBrass', { p: [0.3, 0.33, 0.49], c: trimC }); // the latch
    // collar, waist band and skirt
    b.add(rb(1.2, 0.12, 0.88, 0.04), 'wIron', { p: [0, 1.08, 0], c: ironC });
    b.add(rb(0.92, 0.16, 0.72, 0.04), 'wIron', { p: [0, 0.03, 0], c: ironC });
    b.add(rb(0.8, 0.14, 0.62, 0.03), 'wDark', { p: [0, -0.1, 0], c: SOOT });
    // back: boiler box with a hot slot, one square stack off to the right
    b.add(rb(0.8, 0.8, 0.34, 0.06), 'wPaint', { p: [0, 0.6, -0.55], c: plate2C });
    for (const y of [0.32, 0.88]) b.add(rb(0.84, 0.06, 0.38, 0.02), 'wIron', { p: [0, y, -0.55], c: ironC });
    b.add(box(0.42, 0.05, 0.02), G, { p: [0, 0.22, -0.73] });
    b.addBuilder(stack(0.2, 0.5, { c: SOOT, trimC: '#5a5450', seed: 813 }), { p: [0.26, 0.92, -0.6] });
    // shoulder bearings: solid discs with an offset bolt plate
    for (const sx of [-1, 1]) {
      b.add(bdisc(0.18, 0.08, 0.02, 18), 'wIron', { p: [sx * 0.6, 0.86, 0], r: [0, 0, PI / 2], c: ironC });
      b.add(rb(0.04, 0.1, 0.07, 0.01), 'wBrass', { p: [sx * 0.65, 0.95, 0], c: trimC });
    }
    // ash on the collar and the boiler, slag drips off the chest plate and collar
    ash(b, 0, 1.15, 0, 1.0, 0.7, 9, P.crust, 0.09);
    ash(b, 0, 1.01, -0.55, 0.7, 0.3, 4, P.crust, 0.07);
    drips(b, [-0.42, 0.6, 0.47], [0.42, 0.6, 0.47], 6, 0.16, G, 3);
    drips(b, [-0.55, 1.02, 0.4], [0.55, 1.02, 0.4], 5, 0.12, G, 0);
    drips(b, [-0.55, 0.15, 0.36], [-0.2, 0.15, 0.36], 2, 0.12, G, 0);
    seam(b, G, [0.57, 0.18, 0], 0.5); // a crack along the right flank skirt
  }, 810 + variant));
  // head: a squat block under an overhanging brow, one visor slit, a solid chin plate
  const head = pivot(torso, 0, 1.14, 0.04);
  head.add(part((b) => {
    b.add(rb(0.44, 0.3, 0.42, 0.06), 'wPaint', { p: [0, 0.15, 0], c: plateC });
    b.add(rb(0.52, 0.07, 0.5, 0.02), 'wIron', { p: [0, 0.33, 0.01], c: ironC });
    b.add(rb(0.5, 0.06, 0.14, 0.02), 'wIron', { p: [0, 0.27, 0.2], r: [0.35, 0, 0], c: ironC });
    b.add(rb(0.34, 0.045, 0.05, 0.015), G, { p: [0, 0.17, 0.205] });
    b.add(rb(0.4, 0.09, 0.05, 0.015), 'wDark', { p: [0, 0.07, 0.21], c: SOOT });
    bolts(b, 'wBrass', [0.225, 0.08, -0.12], [0.225, 0.08, 0.12], 3, 0.016, 'x', trimC);
    bolts(b, 'wBrass', [-0.225, 0.08, -0.12], [-0.225, 0.08, 0.12], 3, 0.016, 'x', trimC);
    ash(b, 0, 0.37, 0, 0.4, 0.4, 4, P.crust, 0.07);
  }, 814));
  // arms: right (sx -1) a slag hammer fist, left a crusted slab shield
  const arms = {};
  for (const sx of [-1, 1]) {
    const sh = pivot(torso, sx * 0.72, 0.86, 0);
    sh.add(part((b) => {
      b.add(sphere(0.16, 10, 8), 'wIron', { c: ironC });
      b.add(rb(0.42, 0.08, 0.5, 0.03), 'wPaint', { p: [sx * 0.04, 0.17, 0], r: [0, 0, -sx * 0.3], c: plateC });
      b.add(rb(0.3, 0.06, 0.46, 0.02), 'wPaint', { p: [sx * 0.17, 0.06, 0], r: [0, 0, -sx * 0.75], c: plate2C });
      bolts(b, 'wIron', [sx * 0.06, 0.22, -0.19], [sx * 0.06, 0.22, 0.19], 3, 0.016, 'y', '#8a8278');
      ash(b, sx * 0.02, 0.23, 0, 0.3, 0.4, 3, P.crust, 0.07);
      drips(b, [sx * 0.3, -0.04, -0.18], [sx * 0.3, -0.04, 0.18], 3, 0.12, G, 0);
      b.add(rb(0.22, 0.52, 0.24, 0.05), 'wPaint', { p: [0, -0.32, 0], c: plate2C });
      b.add(cyl(0.03, 0.03, 0.42, 8), 'wIron', { p: [sx * 0.12, -0.3, 0.06], c: '#9a948c' });
    }, 815));
    const el = pivot(sh, 0, -0.62, 0);
    el.add(part((b) => {
      b.add(sphere(0.12, 10, 8), 'wIron', { c: ironC });
      b.add(rb(0.24, 0.5, 0.26, 0.05), 'wPaint', { p: [0, -0.28, 0], c: plateC });
      b.add(rb(0.27, 0.12, 0.29, 0.03), 'wIron', { p: [0, -0.1, 0], c: ironC });
      if (sx < 0) {
        b.add(rb(0.46, 0.4, 0.48, 0.05), 'wDark', { p: [0, -0.66, 0], c: GLASS });
        for (const s2 of [-1, 1]) {
          b.add(rb(0.06, 0.44, 0.52, 0.02), 'wIron', { p: [s2 * 0.24, -0.66, 0], c: ironC });
          bolts(b, 'wIron', [s2 * 0.275, -0.52, -0.18], [s2 * 0.275, -0.52, 0.18], 3, 0.018, 'x', '#8a8278');
        }
        for (const x of [-0.1, 0.1]) b.add(box(0.05, 0.02, 0.36), G, { p: [x, -0.925, 0] });
        b.add(rb(0.36, 0.07, 0.4, 0.02), 'wDark', { p: [0, -0.88, 0], c: '#5a5450' });
        drips(b, [-0.2, -0.9, 0.18], [0.2, -0.9, -0.18], 3, 0.1, G, 0);
      } else {
        b.add(rb(0.09, 0.82, 0.64, 0.04), 'wIron', { p: [0.14, -0.44, 0.05], c: ironC });
        b.add(rb(0.1, 0.62, 0.5, 0.03), 'wPaint', { p: [0.17, -0.44, 0.05], c: plateC });
        b.add(rb(0.11, 0.06, 0.54, 0.02), 'wIron', { p: [0.18, -0.52, 0.05], c: ironC });
        seam(b, G, [0.23, -0.3, 0.02], 0.3);
        bolts(b, 'wIron', [0.235, -0.16, -0.2], [0.235, -0.16, 0.3], 2, 0.02, 'x', '#8a8278');
        bolts(b, 'wIron', [0.235, -0.72, -0.2], [0.235, -0.72, 0.3], 2, 0.02, 'x', '#8a8278');
        drips(b, [0.17, -0.86, -0.22], [0.17, -0.86, 0.32], 4, 0.14, G, 0);
      }
    }, 816 + (sx > 0 ? 1 : 0)));
    arms[sx < 0 ? 'R' : 'L'] = { sh, el };
  }
  // legs: thigh with a ram sleeve, a ram rod that follows the knee, shin with knee guard, a broad foot
  const legs = {};
  for (const sx of [-1, 1]) {
    const hip = pivot(pelvis, sx * 0.3, -0.05, 0);
    hip.add(part((b) => {
      b.add(sphere(0.15, 10, 8), 'wIron', { c: ironC });
      b.add(rb(0.24, 0.58, 0.28, 0.05), 'wPaint', { p: [0, -0.32, 0], c: plateC });
      b.add(rb(0.26, 0.2, 0.06, 0.02), 'wPaint', { p: [0, -0.22, 0.14], c: plate2C });
      b.add(cyl(0.05, 0.05, 0.24, 10), 'wIron', { p: [sx * 0.16, -0.2, -0.05], c: '#3a3634' });
    }, 818));
    const ram = pivot(hip, sx * 0.16, -0.44, -0.05);
    ram.add(part((b) => b.add(cyl(0.028, 0.028, 0.3, 8), 'wIron', { c: '#a8a49c' }), 819));
    const knee = pivot(hip, 0, -0.64, 0);
    knee.add(part((b) => {
      b.add(sphere(0.13, 10, 8), 'wIron', { c: ironC });
      b.add(rb(0.22, 0.56, 0.26, 0.05), 'wPaint', { p: [0, -0.3, 0], c: grime(P.paint, -0.6, -0.1, 0.35, 7) });
      b.add(rb(0.26, 0.17, 0.08, 0.02), 'wPaint', { p: [0, -0.06, 0.14], r: [-0.2, 0, 0], c: plate2C });
      b.add(rb(0.4, 0.14, 0.58, 0.04), 'wDark', { p: [0, -0.6, 0.08], c: SOOT });
      b.add(rb(0.36, 0.07, 0.18, 0.02), 'wIron', { p: [0, -0.52, 0.32], r: [0.3, 0, 0], c: ironC });
      b.add(cyl(0.03, 0.03, 0.4, 8), 'wIron', { p: [0, -0.3, -0.15], c: '#a8a49c' });
      ash(b, 0, -0.52, 0.08, 0.3, 0.4, 3, P.crust, 0.06);
    }, 820));
    legs[sx > 0 ? 'L' : 'R'] = { hip, knee, ram };
  }
  const puff = smoke({ rate: 3, life: 2.4, size: 0.6, rise: 1.5, color: 0x6a6662, opacity: 0.5 });
  puff.position.set(0.26, 1.62, -0.6); torso.add(puff);
  const glow = slotGlow(P.glowHex, 0.56, 0.42, 0.55); glow.position.set(0, 0.33, 0.5); torso.add(glow);
  const a = new Anim(root, { pelvis, torso, head, arms, legs });
  a.dynamics.push(puff, glow);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.1), e = 1 - Math.pow(1 - k, 3);
      p.pelvis.position.y = PY - 0.85 * e; p.pelvis.rotation.x = 0.25 * e; p.torso.rotation.x = 0.85 * e; p.head.rotation.x = 0.4 * e;
      p.legs.L.hip.rotation.x = -1.25 * e; p.legs.L.knee.rotation.x = 1.9 * e; p.legs.R.hip.rotation.x = -0.95 * e; p.legs.R.knee.rotation.x = 1.6 * e;
      p.arms.R.sh.rotation.x = -0.4 * e; p.arms.L.sh.rotation.z = 0.6 * e;
      puff.visible = false; glow.material.opacity = 0.55 * (1 - k);
      return;
    }
    puff.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 6);
    const sk = Math.min(1, this.speed / 2.5);
    this.phase = ((this.phase || 0) + this.speed * dt * 0.4 * ts) % 1;
    const ph = this.phase * PI * 2;
    const swing = Math.sin(ph) * 0.55 * sk;
    p.legs.L.hip.rotation.x = -swing; p.legs.R.hip.rotation.x = swing;
    p.legs.L.knee.rotation.x = Math.max(0, Math.cos(ph)) * 0.9 * sk + 0.05;
    p.legs.R.knee.rotation.x = Math.max(0, -Math.cos(ph)) * 0.9 * sk + 0.05;
    for (const L of [p.legs.L, p.legs.R]) L.ram.position.y = -0.44 - L.knee.rotation.x * 0.07;
    const stomp = Math.abs(Math.sin(ph));
    p.pelvis.position.y = PY - (1 - stomp) * 0.07 * sk + Math.sin(this.t * 1.5) * 0.015;
    p.pelvis.rotation.x = 0;
    p.pelvis.rotation.z = Math.sin(ph) * 0.06 * sk;
    p.torso.rotation.y = Math.sin(ph) * 0.1 * sk;
    p.head.rotation.x = 0;
    p.head.rotation.y = Math.sin(this.t * 0.6) * 0.35 * (1 - sk);
    p.arms.R.sh.rotation.x = swing * 0.6; p.arms.L.sh.rotation.x = -swing * 0.6 - 0.2;
    p.arms.R.el.rotation.x = -0.25; p.arms.L.el.rotation.x = -0.9; p.arms.L.sh.rotation.z = 0.15; p.arms.R.sh.rotation.z = 0;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      // overhead slag-hammer slam with the right arm
      const up = at < 0.45 ? at / 0.45 : 1, down = at < 0.45 ? 0 : Math.min(1, (at - 0.45) / 0.12), rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
      p.arms.R.sh.rotation.x = (-2.6 * up + 3.1 * down) * (1 - rec);
      p.arms.R.el.rotation.x = (-0.6 * up + 0.5 * down) * (1 - rec) - 0.25;
      p.torso.rotation.x = (-0.15 * up + 0.4 * down) * (1 - rec);
      p.pelvis.position.y -= 0.12 * down * (1 - rec);
    } else p.torso.rotation.x = Math.sin(this.t * 1.2) * 0.02;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.torso.rotation.x -= this.hitT * 0.22; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  return finish(root, a, 3.0);
}

// ==========================================================================
// SLAG HAULER: a squat tracked hauler (2.2 m tall, 3.5 m long)
// ==========================================================================
export function buildSlagHauler(variant = 0) {
  const v = variant === 1, P = pal(v), G = P.glow;
  const plateC = wear(P.paint, 0.32, 21 + variant), plate2C = wear(P.paint2, 0.3, 23), ironC = wear(IRONR, 0.25, 24), trimC = wear(P.trim, 0.3, 25);
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 1.56, len: 2.75, h: 0.62, tw: 0.36, paintC: v ? '#2e2c2c' : '#5a5652', linkC: '#5a5450', road: 2, seed: 900 + variant });
  const HY = 0.6;
  const hull = pivot(base, 0, HY, 0);
  hull.add(part((b) => {
    // chassis and deck
    b.add(rb(1.2, 0.36, 3.0, 0.06), 'wPaint', { p: [0, 0.1, 0], c: grime(P.paint2, -0.1, 0.3, 0.3, 26) });
    b.add(rb(1.36, 0.08, 3.1, 0.03), 'wIron', { p: [0, 0.3, 0], c: ironC });
    seam(b, G, [0.6, 0.0, -0.2], 2.0);
    // engine house at the front: plated, a louvred vent on the left flank only, a plain riveted front plate (no window)
    b.add(rb(1.1, 0.8, 0.8, 0.07), 'wPaint', { p: [0, 0.72, 0.85], c: grime(P.paint, 0.35, 1.1, 0.3, 27) });
    b.addBuilder(pl(1.04, 0.6, 0.08, { c: plateC, c2: plate2C, trim: 'wIron', trimC: '#5a5652', boltMat: 'wBrass', boltC: trimC, seed: 901 }), { p: [0, 0.74, 1.27], r: [-0.08, 0, 0] });
    b.addBuilder(vent(0.5, 0.4, { frame: 'wDark', frameC: '#4a4644', glow: G, n: 4, depth: 0.1 }), { p: [-0.56, 0.72, 0.85], r: [0, -PI / 2, 0] });
    b.addBuilder(pl(0.7, 0.5, 0.06, { c: plate2C, trim: 'wIron', trimC: '#5a5652', boltMat: 'wBrass', boltC: trimC, seed: 902 }), { p: [0.56, 0.72, 0.85], r: [0, PI / 2, 0] });
    b.add(rb(1.2, 0.08, 0.9, 0.03), 'wIron', { p: [0, 1.16, 0.85], c: ironC });
    b.addBuilder(stack(0.22, 0.42, { c: SOOT, trimC: '#5a5450', seed: 903 }), { p: [0.32, 1.2, 0.7] });
    b.add(cyl(0.06, 0.06, 0.6, 8), 'wBrass', { p: [-0.3, 1.24, 0.8], r: [PI / 2, 0, 0], c: trimC });
    // scoop pivot brackets and the skip's hinge block and ram sleeve
    for (const sx of [-1, 1]) b.add(rb(0.12, 0.26, 0.3, 0.03), 'wIron', { p: [sx * 0.62, 0.18, 1.25], c: ironC });
    b.add(rb(1.3, 0.14, 0.2, 0.04), 'wIron', { p: [0, 0.38, -1.45], c: ironC });
    b.addBuilder(sleeve(0.07, 0.4, { c: '#5a5652', trim: 'wBrass', trimC }), { p: [0, 0.48, -0.4], r: [-0.5, 0, 0] });
    ash(b, 0, 1.21, 0.85, 1.0, 0.8, 7, P.crust, 0.08);
    drips(b, [-0.6, 0.32, 1.25], [0.6, 0.32, 1.25], 5, 0.14, G, 3);
    drips(b, [0.62, -0.08, -1.3], [0.62, -0.08, 0.4], 4, 0.12, G, 0);
  }, 905 + variant));
  // tipping skip, hinged at the rear: a tapered plated box heaped with glowing slag under a dark crust
  const skip = pivot(hull, 0, 0.42, -1.45);
  skip.add(part((b) => {
    b.add(rb(1.2, 0.08, 1.5, 0.03), 'wIron', { p: [0, 0.05, 0.78], c: ironC });
    for (const sx of [-1, 1]) b.addBuilder(pl(1.56, 0.72, 0.08, { c: plateC, c2: plate2C, trim: 'wIron', trimC: '#5a5652', boltMat: 'wBrass', boltC: trimC, seed: 906 }), { p: [sx * 0.66, 0.42, 0.78], r: [0, sx * PI / 2, 0.0] });
    for (const [z, h] of [[0.02, 0.62], [1.55, 0.86]]) b.add(rb(1.36, h, 0.08, 0.03), 'wPaint', { p: [0, 0.05 + h / 2, z], c: plate2C });
    b.add(rb(1.4, 0.08, 0.14, 0.03), 'wIron', { p: [0, 0.94, 1.55], c: ironC });
    b.add(box(1.2, 0.04, 1.44), G, { p: [0, 0.68, 0.8] });
    for (let i = 0; i < 18; i++) b.add(ico(b.r(0.12, 0.2), 0), 'wDark', { p: [b.r(-0.5, 0.5), 0.72 + b.r(0, 0.1), b.r(0.15, 1.42)], s: [1.3, 0.6, 1.1], r: [b.r(0, 3), b.r(0, 3), 0], c: GLASS });
    drips(b, [-0.5, 0.62, -0.03], [0.5, 0.62, -0.03], 5, 0.22, G, 2, 0.05);
    ash(b, 0, 0.98, 1.55, 1.2, 0.1, 4, P.crust, 0.06);
  }, 907));
  const skipRam = pivot(skip, 0, 0.0, 1.1);
  skipRam.add(part((b) => b.add(cyl(0.035, 0.035, 0.5, 8), 'wIron', { p: [0, -0.2, 0], c: '#a8a49c' }), 908));
  // front scoop on two arms: a flat bucket with a toothed lip
  const scoop = pivot(hull, 0, 0.18, 1.25);
  scoop.add(part((b) => {
    for (const sx of [-1, 1]) b.add(rb(0.08, 0.14, 0.6, 0.03), 'wIron', { p: [sx * 0.7, -0.05, 0.25], r: [0.25, 0, 0], c: ironC });
    b.add(rb(1.5, 0.06, 0.42, 0.02), 'wPaint', { p: [0, -0.3, 0.55], c: plate2C });
    b.add(rb(1.5, 0.42, 0.06, 0.02), 'wPaint', { p: [0, -0.1, 0.35], r: [-0.2, 0, 0], c: plateC });
    for (const sx of [-1, 1]) b.add(rb(0.06, 0.38, 0.44, 0.02), 'wIron', { p: [sx * 0.75, -0.14, 0.53], c: ironC });
    for (let i = 0; i < 7; i++) b.add(rb(0.08, 0.05, 0.14, 0.015), 'wDark', { p: [-0.6 + i * 0.2, -0.32, 0.8], c: '#6a6460' });
    for (let i = 0; i < 6; i++) b.add(ico(0.08, 0), 'wDark', { p: [b.r(-0.6, 0.6), -0.22, b.r(0.4, 0.65)], c: GLASS });
  }, 909));
  const puff = smoke({ rate: 3, life: 2.2, size: 0.55, rise: 1.4, color: 0x5a5654, opacity: 0.5 });
  puff.position.set(0.32, 1.78, 0.7); hull.add(puff);
  const glow = slotGlow(P.glowHex, 1.2, 1.44, 0.45, { rx: -PI / 2, d: 0.12 }); glow.position.set(0, 0.78, 0.8); skip.add(glow);
  const a = new Anim(root, { base, hull, skip, scoop, wheels: TR.wheels });
  a.dynamics.push(puff, glow);
  let dist = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.0), e = 1 - Math.pow(1 - k, 2);
      p.hull.position.y = HY - 0.16 * e; p.hull.rotation.z = 0.22 * e; p.hull.rotation.x = 0.08 * e;
      p.skip.rotation.x = -0.5 * e; p.scoop.rotation.x = 0.35 * e;
      puff.visible = false; glow.material.opacity = 0.45 * (1 - k * 0.7);
      return;
    }
    puff.visible = true;
    const ts = this.stun ? 0.1 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.31) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    p.hull.position.y = HY + Math.abs(Math.sin(this.t * 7)) * 0.015 * Math.min(1, this.speed) + Math.sin(this.t * 9) * 0.004;
    p.hull.rotation.z = 0;
    p.hull.rotation.x = Math.sin(this.t * 1.7) * 0.012 - Math.min(0.04, this.speed * 0.012);
    const at = this.stepAttack(dt);
    let lift = 0, tip = 0;
    if (at >= 0) {
      // scoop rears up, slams down; the skip kicks and spills
      lift = at < 0.4 ? at / 0.4 : at < 0.55 ? 1 - 1.6 * ((at - 0.4) / 0.15) : -0.6 * (1 - (at - 0.55) / 0.45);
      tip = Math.sin(Math.min(1, at * 1.4) * PI) * 0.35;
      p.hull.position.z = Math.sin(at * PI) * 0.12;
    } else p.hull.position.z = 0;
    p.scoop.rotation.x = -lift * 0.75 + Math.sin(this.t * 1.3) * 0.03;
    p.skip.rotation.x = -tip;
    if (this.hitT > 0) { this.hitT -= dt * 3.5; p.hull.rotation.x -= this.hitT * 0.12; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  return finish(root, a, 2.2);
}

// ==========================================================================
// ORE CRAWLER: a low wide drilling machine on solid road wheels (1.6 m)
// ==========================================================================
export function buildOreCrawler(variant = 0) {
  const v = variant === 1, P = pal(v), G = P.glow;
  const plateC = wear(P.paint, 0.32, 41 + variant), plate2C = wear(P.paint2, 0.3, 43), ironC = wear(IRONR, 0.25, 44), trimC = wear(P.trim, 0.3, 45);
  const root = new THREE.Group();
  const WR = 0.3, WX = 0.93;
  // five solid road wheels a side, each its own pivot so they turn
  const wheels = [];
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) {
    const w = pivot(root, sx * WX, WR, -1.0 + i * 0.5);
    w.add(part((b) => {
      b.add(bdisc(WR, 0.22, 0.04, 18), 'wDark', { r: [0, 0, PI / 2], c: '#4a4644' });
      b.add(rb(0.26, WR * 0.3, WR * 0.3, 0.012), 'wDark', { c: '#8a847c' }); // square axle nut, no inner disc in a ring
      b.add(rb(0.03, WR * 0.36, WR * 0.24, 0.008), 'wDark', { p: [sx * 0.135, WR * 0.4, 0], c: '#c8a870' });
    }, 950 + i));
    wheels.push(w);
  }
  const HY = 0.55;
  const hull = pivot(root, 0, HY, 0);
  hull.add(part((b) => {
    b.add(rb(1.7, 0.5, 2.5, 0.08), 'wPaint', { p: [0, 0.12, 0], c: grime(P.paint2, -0.1, 0.35, 0.3, 46) });
    // armoured skirts over the wheel tops, a sloped glacis plate at the front
    for (const sx of [-1, 1]) {
      b.addBuilder(pl(2.6, 0.36, 0.07, { c: plateC, c2: plate2C, trim: 'wIron', trimC: '#5a5652', boltMat: 'wBrass', boltC: trimC, seed: 951 }), { p: [sx * 1.07, 0.1, 0], r: [0, sx * PI / 2, 0] });
      b.add(rb(0.24, 0.06, 2.6, 0.02), 'wIron', { p: [sx * 0.95, 0.31, 0], c: ironC });
      drips(b, [sx * 1.11, -0.08, -1.1], [sx * 1.11, -0.08, 1.1], 6, 0.14, G, 3);
    }
    b.addBuilder(pl(1.6, 0.5, 0.08, { c: plateC, c2: plate2C, trim: 'wIron', trimC: '#5a5652', boltMat: 'wBrass', boltC: trimC, seed: 952 }), { p: [0, 0.22, 1.24], r: [-0.6, 0, 0] });
    seam(b, G, [-0.86, -0.12, 0], 2.2);
    // ore hopper at the rear: an open plated box of ore, a few lumps still hot
    b.add(rb(1.2, 0.08, 1.0, 0.03), 'wIron', { p: [0, 0.4, -0.55], c: ironC });
    for (const sx of [-1, 1]) b.add(rb(0.07, 0.62, 1.04, 0.02), 'wPaint', { p: [sx * 0.62, 0.7, -0.55], r: [0, 0, sx * 0.1], c: plateC });
    for (const ez of [-1, 1]) b.add(rb(1.3, 0.62, 0.07, 0.02), 'wPaint', { p: [0, 0.7, -0.55 + ez * 0.52], r: [-ez * 0.1, 0, 0], c: plate2C });
    b.add(rb(1.34, 0.06, 0.1, 0.02), 'wIron', { p: [0, 1.02, -0.02], c: ironC });
    b.add(rb(1.34, 0.06, 0.1, 0.02), 'wIron', { p: [0, 1.02, -1.08], c: ironC });
    for (let i = 0; i < 14; i++) { const hot = i % 5 === 2; b.add(ico(b.r(0.1, 0.17), 0), hot ? G : 'wRust', { p: [b.r(-0.45, 0.45), 0.93 + b.r(0, 0.1), -0.55 + b.r(-0.38, 0.38)], r: [b.r(0, 3), b.r(0, 3), 0], c: hot ? 0xffffff : wear('#6a5a50', 0.4, i) }); }
    // engine block between the hopper and the drill, one square stack on the left
    b.add(rb(0.9, 0.36, 0.6, 0.05), 'wDark', { p: [0, 0.52, 0.35], c: SOOT });
    b.addBuilder(vent(0.46, 0.26, { frame: 'wDark', frameC: '#4a4644', glow: G, n: 3, depth: 0.08 }), { p: [0.46, 0.52, 0.35], r: [0, PI / 2, 0] });
    b.addBuilder(stack(0.16, 0.4, { c: SOOT, trimC: '#5a5450', seed: 953 }), { p: [-0.3, 0.7, 0.3] });
    b.add(rb(0.62, 0.42, 0.3, 0.05), 'wIron', { p: [0, 0.3, 1.18], c: ironC }); // drill boom mount
    ash(b, 0, 0.72, 0.35, 0.8, 0.5, 5, P.crust, 0.07);
    ash(b, 0, 0.38, 0.9, 1.4, 0.4, 5, P.crust, 0.07);
    drips(b, [-0.5, 0.0, 1.4], [0.5, 0.0, 1.4], 4, 0.14, G, 3);
  }, 954 + variant));
  // drill boom: a ram housing that thrusts the tool out of the front mount
  const boom = pivot(hull, 0, 0.3, 1.3);
  boom.add(part((b) => {
    b.add(rb(0.5, 0.4, 0.5, 0.05), 'wPaint', { p: [0, 0, 0.2], c: plateC });
    b.add(rb(0.56, 0.08, 0.54, 0.02), 'wIron', { p: [0, 0.2, 0.2], c: ironC });
    for (const sx of [-1, 1]) b.addBuilder(sleeve(0.05, 0.4, { c: '#5a5652', trim: 'wBrass', trimC }), { p: [sx * 0.3, -0.05, 0.2], r: [PI / 2, 0, 0] });
    b.add(cyl(0.12, 0.12, 0.2, 12), 'wIron', { p: [0, 0, 0.5], r: [PI / 2, 0, 0], c: ironC });
  }, 955));
  const bit = pivot(boom, 0, 0, 0.6);
  bit.add(part((b) => {
    if (!v) {
      // cone drill: a bevelled collar, the bit and a spiral flute of small blades
      b.add(cyl(0.2, 0.2, 0.1, 14), 'wIron', { p: [0, 0, 0.05], r: [PI / 2, 0, 0], c: '#7a746c' });
      b.add(cone(0.22, 0.8, 14), 'wMetal', { p: [0, 0, 0.5], r: [PI / 2, 0, 0], c: '#b8b4ac' });
      for (let i = 0; i < 12; i++) { const an = i * 1.0, k = i / 12; b.add(box(0.05, 0.03, 0.1), 'wDark', { p: [Math.cos(an) * 0.2 * (1 - k), Math.sin(an) * 0.2 * (1 - k), 0.15 + k * 0.62], r: [0, 0, an], c: '#5a5450' }); }
    } else {
      // toothed drum across the front, turning on the x axis (rows of teeth read as stripes from above)
      b.add(cyl(0.24, 0.24, 1.3, 14), 'wIron', { p: [0, 0, 0.26], r: [0, 0, PI / 2], c: '#6a645c' });
      for (const sx of [-1, 1]) b.add(rb(0.06, 0.4, 0.22, 0.02), 'wDark', { p: [sx * 0.66, 0, 0.1], c: SOOT });
      for (let j = 0; j < 6; j++) { const an = j * PI / 3; for (let i = 0; i < 5; i++) b.add(rb(0.12, 0.1, 0.06, 0.015), 'wMetal', { p: [-0.48 + i * 0.24 + (j % 2) * 0.12, Math.sin(an) * 0.28, 0.26 + Math.cos(an) * 0.28], r: [an, 0, 0], c: '#b0aca4' }); }
    }
  }, 956 + variant));
  const puff = smoke({ rate: 3, life: 2, size: 0.45, rise: 1.2, color: 0x5a5654, opacity: 0.5 });
  puff.position.set(-0.3, 1.25, 0.3); hull.add(puff);
  const glow = slotGlow(P.glowHex, 1.1, 0.9, 0.4, { rx: -PI / 2, d: 0.1 }); glow.position.set(0, 0.98, -0.55); hull.add(glow);
  const a = new Anim(root, { hull, boom, bit, wheels });
  a.dynamics.push(puff, glow);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 0.9), e = 1 - Math.pow(1 - k, 2);
      p.hull.position.y = HY - 0.18 * e; p.hull.rotation.z = -0.18 * e; p.hull.rotation.x = 0.1 * e;
      p.boom.rotation.x = 0.4 * e; p.bit.position.z = 0.6;
      puff.visible = false; glow.material.opacity = 0.4 * (1 - k * 0.7);
      return;
    }
    puff.visible = true;
    const ts = this.stun ? 0.1 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 6);
    for (const w of p.wheels) w.rotation.x += (this.speed / WR) * dt * ts;
    // the hull rides the wheels: a small pitch and roll over the ground
    p.hull.position.y = HY + Math.sin(this.t * 8) * 0.008 + Math.abs(Math.sin(this.t * 5.3)) * 0.012 * Math.min(1, this.speed);
    p.hull.rotation.x = Math.sin(this.t * 2.3) * 0.01; p.hull.rotation.z = Math.sin(this.t * 1.9) * 0.012 * Math.min(1, this.speed);
    const at = this.stepAttack(dt);
    let thrust = 0;
    if (at >= 0) thrust = at < 0.3 ? -0.3 * (at / 0.3) : at < 0.45 ? -0.3 + 1.3 * ((at - 0.3) / 0.15) : 1 - (at - 0.45) / 0.55;
    p.bit.position.z = 0.6 + thrust * 0.35;
    p.boom.rotation.x = Math.sin(this.t * 1.1) * 0.04 + (at >= 0 ? -0.08 * Math.sin(at * PI) : 0);
    const spin = (at >= 0 ? 30 : 6 + this.speed * 2) * dt * ts;
    if (v) p.bit.rotation.x += spin * 0.35; else p.bit.rotation.z += spin;
    if (this.hitT > 0) { this.hitT -= dt * 4; p.hull.rotation.x -= this.hitT * 0.12; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  // the Tripo model (tripoModels.js): drill first (+z), smoke from its square stack; the cinder-glass crawlers
  // (variant 1) in black glass-dark iron
  return wearModel(finish(root, a, 1.6), 'orecrawler', { fit: 'long', stretch: [0.9, 1.35], motion: MOTION.mob,
    keep: [puff], fx: [[puff, [-0.027, 0.41, 0.058]]], tint: v ? { c: '#30323e', k: 0.9, b: 0.36 } : null });
}

// ==========================================================================
// FURNACE KEEPER (elite): a tall narrow tending machine (4 m) with long tongs, a poker arm and a furnace belly
// ==========================================================================
export function buildFurnaceKeeper(variant = 0) {
  const P = pal(variant === 1), G = P.glow;
  const plateC = wear(P.paint, 0.32, 61), plate2C = wear(P.paint2, 0.3, 63), ironC = wear(IRONR, 0.25, 64), trimC = wear(P.trim, 0.3, 65);
  const root = new THREE.Group();
  const PY = 1.3;
  const pelvis = pivot(root, 0, PY, 0);
  const torso = pivot(pelvis, 0, 0.08, 0);
  torso.add(part((b) => {
    // the furnace belly: a heavy plated firebox with a big louvred door and a hot ash pan beneath
    b.add(rb(1.0, 1.0, 0.86, 0.09), 'wPaint', { p: [0, 0.52, 0], c: grime(P.paint2, 0.0, 0.9, 0.3, 66) });
    b.add(rb(0.84, 0.72, 0.08, 0.03), 'wDark', { p: [0, 0.54, 0.44], c: SOOT });
    b.addBuilder(vent(0.66, 0.56, { frame: 'wDark', frameC: '#4a4644', glow: G, n: 5, depth: 0.1 }), { p: [0, 0.54, 0.49] });
    b.add(rb(0.07, 0.62, 0.08, 0.02), 'wIron', { p: [0.4, 0.54, 0.51], c: ironC });
    for (const y of [0.32, 0.76]) b.add(cyl(0.04, 0.04, 0.11, 8), 'wBrass', { p: [0.42, y, 0.53], c: trimC });
    b.add(rb(0.84, 0.1, 0.5, 0.03), 'wIron', { p: [0, 0.06, 0.3], c: ironC });
    seam(b, G, [0, 0.1, 0.56], 0.66, 'x', 0.04);
    for (const sx of [-1, 1]) b.addBuilder(pl(0.76, 0.86, 0.08, { c: plateC, c2: plate2C, trim: 'wIron', trimC: '#5a5652', boltMat: 'wBrass', boltC: trimC, seed: 970 }), { p: [sx * 0.52, 0.52, 0], r: [0, sx * PI / 2, 0] });
    b.add(rb(1.08, 0.1, 0.94, 0.03), 'wIron', { p: [0, 1.04, 0], c: ironC });
    // the tall narrow column above the belly, banded, with a square flue up the back
    b.add(rb(0.66, 1.1, 0.58, 0.07), 'wPaint', { p: [0, 1.6, 0], c: plateC });
    for (const y of [1.3, 1.75, 2.1]) b.add(rb(0.72, 0.06, 0.64, 0.02), 'wIron', { p: [0, y, 0], c: ironC });
    b.addBuilder(pl(0.56, 0.5, 0.06, { c: plate2C, trim: 'wIron', trimC: '#5a5652', boltMat: 'wBrass', boltC: trimC, seed: 971 }), { p: [0, 1.55, 0.3] });
    b.add(rb(0.36, 1.5, 0.26, 0.04), 'wDark', { p: [0, 1.5, -0.4], c: SOOT });
    b.addBuilder(stack(0.3, 0.3, { c: SOOT, trimC: '#5a5450', seed: 972 }), { p: [0, 2.25, -0.42] });
    // shoulder yoke across the column top
    b.add(rb(1.06, 0.18, 0.4, 0.04), 'wIron', { p: [0, 1.98, 0], c: ironC });
    for (const sx of [-1, 1]) b.add(bdisc(0.15, 0.08, 0.02, 16), 'wIron', { p: [sx * 0.53, 1.98, 0], r: [0, 0, PI / 2], c: ironC });
    ash(b, 0, 1.1, 0.1, 0.9, 0.7, 8, P.crust, 0.08);
    ash(b, 0, 2.08, 0, 0.9, 0.3, 4, P.crust, 0.06);
    drips(b, [-0.45, 0.0, 0.45], [0.45, 0.0, 0.45], 6, 0.16, G, 3);
    drips(b, [-0.36, 1.27, 0.3], [0.36, 1.27, 0.3], 4, 0.12, G, 0);
  }, 973));
  // head: a narrow hooded block on the column, one visor slit
  const head = pivot(torso, 0, 2.12, 0.06);
  head.add(part((b) => {
    b.add(rb(0.4, 0.36, 0.42, 0.05), 'wPaint', { p: [0, 0.2, 0], c: plateC });
    b.add(rb(0.52, 0.06, 0.56, 0.02), 'wIron', { p: [0, 0.41, 0.03], c: ironC });
    b.add(rb(0.5, 0.05, 0.14, 0.02), 'wIron', { p: [0, 0.36, 0.24], r: [0.4, 0, 0], c: ironC });
    b.add(rb(0.28, 0.04, 0.05, 0.015), G, { p: [0, 0.24, 0.21] });
    b.add(rb(0.34, 0.12, 0.05, 0.015), 'wDark', { p: [0, 0.1, 0.22], c: SOOT });
    ash(b, 0, 0.45, 0, 0.4, 0.4, 4, P.crust, 0.06);
  }, 974));
  // long arms: right (sx -1) a poker with a hooked white-hot tip, left a pair of tongs
  const arms = {};
  for (const sx of [-1, 1]) {
    const sh = pivot(torso, sx * 0.62, 1.98, 0);
    sh.add(part((b) => {
      b.add(sphere(0.14, 10, 8), 'wIron', { c: ironC });
      b.add(rb(0.34, 0.07, 0.42, 0.03), 'wPaint', { p: [sx * 0.04, 0.15, 0], r: [0, 0, -sx * 0.35], c: plate2C });
      b.add(rb(0.16, 0.9, 0.18, 0.04), 'wPaint', { p: [0, -0.5, 0], c: plateC });
      b.add(cyl(0.028, 0.028, 0.7, 8), 'wIron', { p: [sx * 0.1, -0.5, 0.05], c: '#a8a49c' });
      drips(b, [sx * 0.2, 0.06, -0.15], [sx * 0.2, 0.06, 0.15], 3, 0.1, G, 0);
    }, 975));
    const el = pivot(sh, 0, -0.98, 0);
    el.add(part((b) => {
      b.add(sphere(0.11, 10, 8), 'wIron', { c: ironC });
      b.add(rb(0.15, 0.85, 0.17, 0.04), 'wPaint', { p: [0, -0.45, 0], c: plate2C });
      b.add(rb(0.19, 0.12, 0.21, 0.03), 'wIron', { p: [0, -0.86, 0], c: ironC });
      if (sx < 0) {
        // the poker: a long iron rod, a hooked end, the last span still glowing
        b.add(cyl(0.035, 0.035, 1.3, 8), 'wIron', { p: [0, -1.5, 0], c: '#5a5652' });
        b.add(cyl(0.032, 0.032, 0.3, 8), G, { p: [0, -2.28, 0] });
        b.add(cyl(0.032, 0.032, 0.22, 8), G, { p: [0, -2.43, 0.09], r: [-1.1, 0, 0] });
      } else b.add(rb(0.3, 0.12, 0.16, 0.03), 'wDark', { p: [0, -0.95, 0], c: SOOT });
    }, 976 + (sx > 0 ? 1 : 0)));
    const jaws = [];
    if (sx > 0) for (const s2 of [-1, 1]) {
      const j = pivot(el, s2 * 0.1, -0.98, 0);
      j.add(part((b) => {
        b.add(rb(0.05, 1.1, 0.08, 0.02), 'wIron', { p: [0, -0.55, 0], c: '#5a5652' });
        b.add(rb(0.1, 0.18, 0.1, 0.02), 'wIron', { p: [-s2 * 0.03, -1.12, 0], r: [0, 0, s2 * 0.5], c: '#4a4644' });
        b.add(box(0.04, 0.12, 0.06), G, { p: [-s2 * 0.06, -1.16, 0], r: [0, 0, s2 * 0.5] });
      }, 978));
      jaws.push({ j, s2 });
    }
    arms[sx < 0 ? 'R' : 'L'] = { sh, el, jaws };
  }
  const legs = {};
  for (const sx of [-1, 1]) {
    const hip = pivot(pelvis, sx * 0.3, -0.05, 0);
    hip.add(part((b) => {
      b.add(sphere(0.14, 10, 8), 'wIron', { c: ironC });
      b.add(rb(0.22, 0.56, 0.26, 0.05), 'wPaint', { p: [0, -0.3, 0], c: plateC });
      b.add(cyl(0.045, 0.045, 0.24, 10), 'wDark', { p: [sx * 0.14, -0.2, -0.05], c: SOOT });
    }, 979));
    const knee = pivot(hip, 0, -0.62, 0);
    knee.add(part((b) => {
      b.add(sphere(0.12, 10, 8), 'wIron', { c: ironC });
      b.add(rb(0.2, 0.54, 0.24, 0.05), 'wPaint', { p: [0, -0.28, 0], c: grime(P.paint, -0.6, -0.1, 0.35, 67) });
      b.add(rb(0.38, 0.12, 0.56, 0.04), 'wDark', { p: [0, -0.57, 0.06], c: SOOT });
      b.add(rb(0.24, 0.16, 0.07, 0.02), 'wPaint', { p: [0, -0.06, 0.13], r: [-0.2, 0, 0], c: plate2C });
      drips(b, [-0.08, -0.12, 0.17], [0.08, -0.12, 0.17], 2, 0.1, G, 0);
    }, 980));
    legs[sx > 0 ? 'L' : 'R'] = { hip, knee };
  }
  const puff = smoke({ rate: 3.5, life: 2.6, size: 0.7, rise: 1.6, color: 0x5a5654, opacity: 0.5 });
  puff.position.set(0, 2.85, -0.42); torso.add(puff);
  const glow = slotGlow(P.glowHex, 0.7, 0.6, 0.6); glow.position.set(0, 0.54, 0.55); torso.add(glow);
  const tip = glowSprite(0xffa040, 0.5, 0.7); tip.position.set(0, -2.3, 0); arms.R.el.add(tip);
  const a = new Anim(root, { pelvis, torso, head, arms, legs });
  a.dynamics.push(puff, glow, tip);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.3), e = 1 - Math.pow(1 - k, 3);
      // the tall frame folds at the knees and topples backwards onto its flue
      p.pelvis.position.y = PY - 0.8 * e; p.pelvis.rotation.x = -0.9 * e; p.torso.rotation.x = -0.25 * e;
      p.legs.L.hip.rotation.x = -1.4 * e; p.legs.L.knee.rotation.x = 1.9 * e; p.legs.R.hip.rotation.x = -1.2 * e; p.legs.R.knee.rotation.x = 1.7 * e;
      p.arms.R.sh.rotation.x = -0.9 * e; p.arms.L.sh.rotation.x = -0.6 * e; p.arms.R.el.rotation.x = -0.2; p.arms.L.el.rotation.x = -0.2;
      puff.visible = false; glow.material.opacity = 0.6 * (1 - k); tip.material.opacity = 0.7 * (1 - k);
      return;
    }
    puff.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 6);
    const sk = Math.min(1, this.speed / 2.5);
    this.phase = ((this.phase || 0) + this.speed * dt * 0.42 * ts) % 1;
    const ph = this.phase * PI * 2, swing = Math.sin(ph) * 0.5 * sk;
    p.legs.L.hip.rotation.x = -swing; p.legs.R.hip.rotation.x = swing;
    p.legs.L.knee.rotation.x = Math.max(0, Math.cos(ph)) * 0.85 * sk + 0.05;
    p.legs.R.knee.rotation.x = Math.max(0, -Math.cos(ph)) * 0.85 * sk + 0.05;
    p.pelvis.position.y = PY - (1 - Math.abs(Math.sin(ph))) * 0.06 * sk + Math.sin(this.t * 1.4) * 0.015;
    p.pelvis.rotation.x = 0; p.pelvis.rotation.z = Math.sin(ph) * 0.05 * sk;
    p.torso.rotation.y = Math.sin(ph) * 0.08 * sk;
    p.torso.rotation.z = Math.sin(this.t * 0.9) * 0.02; // the tall frame sways
    p.head.rotation.y = Math.sin(this.t * 0.5) * 0.4 * (1 - sk);
    // rest: both tools held forward and down, tongs slowly working
    let rSh = -0.35 + swing * 0.3, rEl = -0.7, lSh = -0.3 - swing * 0.3, lEl = -0.75, open = 0.12 + 0.08 * Math.sin(this.t * 1.7);
    const at = this.stepAttack(dt);
    if (at >= 0) {
      if (this.atkKind === 'slam') {
        // tongs: swing out wide and high, then snap in and shut
        const up = at < 0.45 ? at / 0.45 : 1, down = at < 0.45 ? 0 : Math.min(1, (at - 0.45) / 0.15), rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
        lSh = lSh + (-1.5 * up + 1.1 * down) * (1 - rec); lEl = lEl + (0.4 * up - 0.3 * down) * (1 - rec);
        open = 0.12 + (0.45 * up - 0.55 * down) * (1 - rec);
        p.torso.rotation.y += (0.35 * up - 0.6 * down) * (1 - rec);
      } else {
        // poker: draw back, then a long straight jab
        const back = at < 0.4 ? at / 0.4 : 1, jab = at < 0.4 ? 0 : Math.min(1, (at - 0.4) / 0.12), rec = at > 0.65 ? (at - 0.65) / 0.35 : 0;
        rSh = rSh + (0.35 * back - 1.25 * jab) * (1 - rec); rEl = rEl + (-0.5 * back + 1.0 * jab) * (1 - rec);
        p.torso.rotation.x = (-0.08 * back + 0.18 * jab) * (1 - rec);
      }
    } else p.torso.rotation.x = Math.sin(this.t * 1.1) * 0.02;
    p.arms.R.sh.rotation.x = rSh; p.arms.R.el.rotation.x = rEl; p.arms.L.sh.rotation.x = lSh; p.arms.L.el.rotation.x = lEl;
    p.arms.L.sh.rotation.z = 0.08; p.arms.R.sh.rotation.z = -0.08;
    for (const { j, s2 } of p.arms.L.jaws) j.rotation.z = s2 * Math.max(0, open);
    if (this.hitT > 0) { this.hitT -= dt * 3; p.torso.rotation.x -= this.hitT * 0.2; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  return finish(root, a, 4.0);
}

// ==========================================================================
// THE ASHWRIGHT (world boss): a vast ore smelter on treads, about 14 m long and 9 m tall
// ==========================================================================
export function buildAshwright() {
  const G = 'wGlowOrange';
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 6.4, len: 12.4, h: 2.1, tw: 1.4, paintC: '#4a4644', linkC: '#5a5450', road: 3, seed: 990 });
  const body = pivot(base, 0, 0, 0);
  const hullC = grime(ASH, 1.6, 4.4, 0.32, 1), hull2C = wear(ASH2, 0.3, 2), sootC = wear('#353232', 0.3, 3), ironC = wear(IRONR, 0.25, 4), trimC = wear(BRASSO, 0.3, 5), crust = ASHL;
  body.add(part((b) => {
    // the hull: a heavy core with four bolted plates a flank over a hot seam, a skirt band and a deck
    b.add(rb(5.2, 2.6, 10.6, 0.14), 'wPaint', { p: [0, 3.0, -0.2], c: hullC });
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 4; i++) b.addBuilder(pl(2.4, 1.3, 0.14, { c: wear(i % 2 ? ASH : '#7a7672', 0.32, i * 3 + sx), c2: hull2C, trim: 'wIron', trimC: '#5a5652', boltMat: 'wBrass', boltC: trimC, seed: 991 + i }), { p: [sx * 2.66, 3.55, -3.9 + i * 2.5], r: [0, sx * PI / 2, 0] });
      b.addBuilder(pl(10.4, 0.6, 0.14, { c: sootC, inset: false, trim: 'wIron', trimC: '#5a5450', boltMat: 'wBrass', boltC: trimC, seed: 995 }), { p: [sx * 2.66, 2.2, -0.2], r: [0, sx * PI / 2, 0] });
      seam(b, G, [sx * 2.64, 2.68, -0.2], 10.0, 'z', 0.1);
      drips(b, [sx * 2.76, 2.88, -5.0], [sx * 2.76, 2.88, 4.6], 14, 0.4, G, 3);
    }
    b.add(rb(5.8, 0.2, 11.0, 0.05), 'wIron', { p: [0, 4.4, -0.2], c: ironC });
    for (const sx of [-1, 1]) b.add(box(0.1, 0.1, 11.0), 'wBrass', { p: [sx * 2.9, 4.52, -0.2], c: trimC });
    // the front: one big louvred furnace grille between plated cheeks, an ore intake apron below
    b.addBuilder(vent(3.0, 1.5, { frame: 'wDark', frameC: '#4a4644', glow: G, n: 7, depth: 0.18 }), { p: [0, 3.0, 5.15] });
    for (const sx of [-1, 1]) b.addBuilder(pl(0.9, 2.2, 0.24, { c: hull2C, inset: false, trim: 'wIron', boltMat: 'wBrass', boltC: trimC, seed: 996 }), { p: [sx * 2.1, 3.0, 5.12] });
    b.addBuilder(pl(5.2, 0.6, 0.24, { c: sootC, trim: 'wIron', boltMat: 'wBrass', boltC: trimC, seed: 997 }), { p: [0, 4.05, 5.1], r: [-0.3, 0, 0] });
    b.add(rb(4.4, 0.2, 1.6, 0.05), 'wPaint', { p: [0, 1.6, 5.85], r: [-0.42, 0, 0], c: wear('#5a5652', 0.35, 8) });
    for (const sx of [-1, 1]) b.add(rb(0.18, 0.9, 1.7, 0.04), 'wIron', { p: [sx * 2.2, 1.9, 5.8], r: [-0.42, 0, 0], c: ironC });
    b.add(rb(4.5, 0.16, 0.3, 0.04), 'wMetal', { p: [0, 1.28, 6.55], c: '#a8a49c' });
    for (let i = 0; i < 10; i++) b.add(rb(0.16, 0.12, 0.3, 0.03), 'wDark', { p: [-1.95 + i * 0.43, 1.22, 6.72], c: '#5a5450' });
    drips(b, [-2.2, 2.15, 5.3], [2.2, 2.15, 5.3], 9, 0.36, G, 3);
    // the ore conveyor frame from the front deck up into the main tower
    for (const sx of [-1, 1]) {
      b.add(rb(0.16, 0.36, 4.6, 0.04), 'wIron', { p: [sx * 0.75, 5.8, 3.0], r: [0.58, 0, 0], c: ironC });
      b.add(rb(0.16, 1.6, 0.16, 0.04), 'wIron', { p: [sx * 0.75, 5.1, 4.2], c: ironC });
    }
    b.add(rb(1.34, 0.06, 4.5, 0.02), 'wDark', { p: [0, 5.7, 3.0], r: [0.58, 0, 0], c: SOOT });
    // the main smelting tower: square, banded, a tapping slot each side, a square stack on top
    b.add(rb(2.8, 3.7, 2.8, 0.12), 'wPaint', { p: [0, 6.35, 0.2], c: grime(ASH2, 4.6, 8.0, 0.32, 9) });
    for (const y of [4.8, 6.0, 7.2, 8.15]) b.add(rb(3.0, 0.16, 3.0, 0.05), 'wIron', { p: [0, y, 0.2], c: ironC });
    for (const sx of [-1, 1]) {
      b.addBuilder(pl(2.0, 0.9, 0.1, { c: hullC, c2: hull2C, trim: 'wIron', trimC: '#5a5652', boltMat: 'wBrass', boltC: trimC, seed: 998 }), { p: [sx * 1.42, 6.6, 0.2], r: [0, sx * PI / 2, 0] });
      b.add(rb(0.14, 0.4, 1.2, 0.04), 'wDark', { p: [sx * 1.44, 5.4, 0.2], c: SOOT });
      b.add(box(0.06, 0.18, 1.0), G, { p: [sx * 1.5, 5.4, 0.2] });
      drips(b, [sx * 1.52, 5.18, -0.3], [sx * 1.52, 5.18, 0.7], 4, 0.3, G, 2);
    }
    b.addBuilder(stack(1.0, 0.5, { c: SOOT, trimC: '#5a5450', seed: 999 }), { p: [0, 8.2, 0.2] });
    ash(b, 0, 8.25, 0.2, 2.6, 2.6, 14, crust, 0.2);
    // the roasting kiln behind: a smaller square tower, its own stack, and the slag chute out of its back
    b.add(rb(2.2, 3.0, 2.2, 0.1), 'wPaint', { p: [0, 6.0, -3.2], c: grime(ASH, 4.6, 7.4, 0.3, 10) });
    for (const y of [5.0, 6.2, 7.45]) b.add(rb(2.36, 0.14, 2.36, 0.04), 'wIron', { p: [0, y, -3.2], c: ironC });
    b.addBuilder(vent(1.2, 0.8, { frame: 'wDark', frameC: '#4a4644', glow: G, n: 4, depth: 0.14 }), { p: [-1.12, 6.0, -3.2], r: [0, -PI / 2, 0] });
    b.addBuilder(stack(0.8, 0.6, { c: SOOT, trimC: '#5a5450', seed: 1000 }), { p: [0.3, 7.5, -3.3] });
    ash(b, 0, 7.52, -3.2, 2.0, 2.0, 10, crust, 0.16);
    // the slag chute: a trough from the kiln's back down past the stern
    b.add(rb(1.2, 0.16, 4.0, 0.04), 'wIron', { p: [0, 4.6, -5.4], r: [-0.62, 0, 0], c: ironC });
    for (const sx of [-1, 1]) b.add(rb(0.12, 0.42, 4.0, 0.03), 'wPaint', { p: [sx * 0.62, 4.77, -5.4], r: [-0.62, 0, 0], c: sootC });
    b.add(box(1.0, 0.05, 3.8), G, { p: [0, 4.72, -5.4], r: [-0.62, 0, 0] });
    b.add(rb(0.2, 1.6, 0.2, 0.04), 'wIron', { p: [0, 3.6, -6.0], c: ironC });
    // slag spilled over the stern: glassy black lumps round a hot pool on a rear apron plate
    b.add(rb(3.6, 0.2, 1.4, 0.05), 'wIron', { p: [0, 1.0, -6.3], c: ironC });
    b.add(box(1.4, 0.06, 1.0), G, { p: [-0.2, 1.12, -6.4] });
    for (let i = 0; i < 16; i++) b.add(ico(b.r(0.2, 0.42), 0), 'wDark', { p: [b.r(-1.6, 1.4), 1.2 + b.r(-0.05, 0.15), -6.3 + b.r(-0.6, 0.6)], s: [1.3, 0.55, 1.1], r: [b.r(0, 3), b.r(0, 3), 0], c: GLASS });
    drips(b, [-1.6, 0.92, -6.95], [1.6, 0.92, -6.95], 8, 0.5, G, 2, 0.1);
    // the deck: walkways each side, copper steam pipes, flywheel pedestals on the left, a crane plinth on the right
    for (const sx of [-1, 1]) b.add(cyl(0.12, 0.12, 9.0, 8), 'wCopper', { p: [sx * 2.5, 4.75, -0.6], r: [PI / 2, 0, 0], c: wear(0xffffff, 0.3, 12) });
    for (const z of [-2.8, 1.8]) {
      b.add(rb(0.5, 1.0, 0.7, 0.06), 'wIron', { p: [-2.2, 5.0, z], c: ironC });
      b.addBuilder(sleeve(0.22, 1.6, { c: wear('#5a5652', 0.25, z) }), { p: [-2.2, 5.0, z + 1.3], r: [PI / 2, 0, 0] });
    }
    b.add(rb(1.6, 0.6, 1.6, 0.08), 'wPaint', { p: [2.0, 4.8, 1.6], c: hull2C });
    ash(b, 0, 4.55, -0.2, 5.0, 10.0, 26, crust, 0.18);
  }, 1001));
  const puffs = [[0, 9.2, 0.2, 2.2], [0.3, 8.6, -3.3, 1.7]].map(([x, y, z, s]) => { const q = smoke({ rate: 3, life: 3.6, size: s, rise: 2.0, color: 0x4a4644, opacity: 0.6 }); q.position.set(x, y, z); body.add(q); return q; });
  const glow = slotGlow(0xff8030, 3.1, 1.6, 0.75); glow.position.set(0, 3.0, 5.26); body.add(glow);
  const spill = slotGlow(0xff6a20, 1.6, 1.2, 0.6, { rx: -PI / 2, d: 0.14 }); spill.position.set(-0.2, 1.2, -6.4); body.add(spill);
  // solid flywheels on the left deck driving piston rods
  const flys = [], rods = [];
  for (const z of [-2.8, 1.8]) {
    const f = pivot(body, -2.7, 5.2, z);
    f.add(part((b) => b.addBuilder(flywheel(1.15, 0.3, { c: '#4a4644', seed: 1002 })), 1002));
    flys.push(f);
    const rd = pivot(body, -2.2, 5.0, z + 1.3);
    rd.add(part((b) => { b.add(cyl(0.09, 0.09, 1.8, 8), 'wMetal', { p: [0, 0, -0.4], r: [PI / 2, 0, 0], c: 0xffffff }); b.add(rb(0.3, 0.34, 0.34, 0.05), 'wMetal', { p: [0, 0, -1.3], c: '#a8a49c' }); }, 1003));
    rods.push(rd);
  }
  // the ore conveyor: slats with ore crawling up into the tower
  const beltF = pivot(body, 0, 5.78, 3.0); beltF.rotation.x = 0.58;
  const belt = pivot(beltF, 0, 0, 0);
  belt.add(part((b) => { for (let i = 0; i < 15; i++) { b.add(box(1.2, 0.07, 0.12), 'wIron', { p: [0, 0.04, -2.1 + i * 0.3], c: '#6a645c' }); if (i % 2) b.add(ico(0.13, 0), 'wRust', { p: [b.r(-0.4, 0.4), 0.15, -2.1 + i * 0.3], c: wear('#6a5a50', 0.4, i) }); } }, 1004));
  // the slag on the chute: hot lumps sliding down
  const chuteF = pivot(body, 0, 4.82, -5.4); chuteF.rotation.x = -0.62;
  const slag = pivot(chuteF, 0, 0, 0);
  slag.add(part((b) => { for (let i = 0; i < 10; i++) b.add(ico(b.r(0.14, 0.24), 0), i % 3 ? 'wDark' : G, { p: [b.r(-0.35, 0.35), 0.06, -1.8 + i * 0.4], s: [1.2, 0.6, 1.4], c: i % 3 ? GLASS : 0xffffff }); }, 1005));
  const runs = [{ run: belt, dir: -1, span: 0.3 }, { run: slag, dir: 1, span: 0.4 }];
  // the pouring crane: a turntable, a plated box-girder jib and a square crucible on a hanger
  const crane = pivot(body, 2.0, 5.1, 1.6);
  crane.add(part((b) => {
    b.add(rb(1.3, 0.6, 1.3, 0.08), 'wPaint', { c: hull2C });
    b.add(rb(1.0, 0.8, 0.9, 0.06), 'wPaint', { p: [0, 0.5, -0.8], c: sootC }); // counterweight house
    for (const sx of [-1, 1]) b.add(rb(0.14, 0.6, 4.6, 0.04), 'wPaint', { p: [sx * 0.24, 0.9, 2.0], r: [-0.28, 0, 0], c: wear(ASH2, 0.3, 14 + sx) });
    for (const sy of [-1, 1]) b.add(rb(0.62, 0.08, 4.6, 0.02), 'wIron', { p: [0, 0.9 + sy * 0.29, 2.0 + sy * 0.08], r: [-0.28, 0, 0], c: ironC });
    bolts(b, 'wBrass', [0.33, 0.95, 0.2], [0.33, 2.05, 3.9], 8, 0.045, 'x', trimC);
    b.addBuilder(sleeve(0.14, 1.8, { c: '#5a5652' }), { p: [0, 0.3, 1.1], r: [PI / 2 - 0.5, 0, 0] });
    b.add(bdisc(0.3, 0.16, 0.04, 16), 'wIron', { p: [0, 1.62, 4.2], r: [0, 0, PI / 2], c: '#7a746c' });
    b.add(rb(0.34, 0.12, 0.2, 0.03), 'wBrass', { p: [0.1, 1.74, 4.2], c: trimC });
    ash(b, 0, 1.25, 2.0, 0.5, 3.6, 8, crust, 0.1);
    drips(b, [-0.3, 0.55, 0.8], [-0.3, 1.4, 3.8], 6, 0.24, G, 3);
  }, 1006));
  const ladle = pivot(crane, 0, 1.0, 4.2);
  ladle.add(part((b) => {
    b.add(cyl(0.04, 0.04, 1.2, 6), 'wIron', { p: [0, -0.1, 0], c: '#2a2a2a' });
    b.add(rb(1.5, 0.1, 0.18, 0.03), 'wIron', { p: [0, -0.7, 0], c: '#5a5450' });
    for (const sx of [-1, 1]) b.add(rb(0.1, 0.9, 0.18, 0.03), 'wIron', { p: [sx * 0.72, -1.1, 0], c: '#5a5450' });
    // the crucible: a square tapered bucket with a pouring lip at the front, molten metal inside
    b.add(cyl(0.62, 0.42, 1.1, 4), 'wPaint', { p: [0, -1.65, 0], r: [0, PI / 4, 0], c: wear(SOOT, 0.35, 15) });
    b.add(rb(1.0, 0.12, 1.0, 0.03), 'wIron', { p: [0, -1.12, 0], c: '#6a6460' });
    b.add(rb(0.36, 0.08, 0.36, 0.02), 'wIron', { p: [0, -1.12, 0.6], c: '#6a6460' });
    b.add(box(0.76, 0.04, 0.76), G, { p: [0, -1.12, 0] });
    for (const sx of [-1, 1]) bolt(b, 'wBrass', [sx * 0.78, -1.4, 0], 0.08, 'x', trimC);
    drips(b, [-0.3, -2.2, 0.0], [0.3, -2.2, 0.0], 3, 0.25, G, 2);
  }, 1007));
  const pour = pivot(ladle, 0, -1.12, 0.66);
  pour.add(part((b) => { b.add(box(0.16, 3.6, 0.16), G, { p: [0, -1.8, 0.08] }); b.add(box(1.4, 0.06, 1.2), G, { p: [0, -3.6, 0.1] }); }, 1008));
  pour.visible = false;
  const lg = slotGlow(0xff7020, 0.8, 0.8, 0.8, { rx: -PI / 2, d: 0.12 }); lg.position.set(0, -1.06, 0); ladle.add(lg);
  const a = new Anim(root, { base, body, wheels: TR.wheels, crane, ladle, flys, rods, belt });
  a.dynamics.push(...puffs, glow, spill, lg);
  let dist = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 2.2), e = 1 - Math.pow(1 - k, 2);
      p.body.rotation.z = e * 0.1; p.body.rotation.x = -e * 0.05; p.body.position.y = -0.35 * e;
      p.crane.rotation.x = 0.5 * e; p.crane.rotation.y = 0.4 * e; p.ladle.rotation.x = 0.4 * e; pour.visible = false;
      for (const q of puffs) q.visible = false;
      glow.material.opacity = 0.75 * (1 - k); spill.material.opacity = 0.6 * (1 - k * 0.6); lg.material.opacity = 0.8 * (1 - k);
      return;
    }
    for (const q of puffs) q.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    for (const w of p.wheels) w.rotation.x += (this.speed / 1.05) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist); crawl(runs, this.t * 0.5 * ts);
    for (let i = 0; i < 2; i++) { p.flys[i].rotation.x += (0.7 + this.speed * 0.8) * dt * ts * (i ? -1 : 1); p.rods[i].position.z = [-2.8, 1.8][i] + 1.3 + Math.sin(p.flys[i].rotation.x) * 0.4; }
    p.body.position.y = Math.abs(Math.sin(this.t * 3.5)) * 0.05 * Math.min(1, this.speed);
    p.body.rotation.x = 0; p.body.rotation.z = Math.sin(this.t * 0.8) * 0.004;
    const at = this.stepAttack(dt);
    let swing = 0, tilt = 0;
    if (at >= 0) {
      // raise the jib, swing it down over the target and tip the crucible to pour
      swing = at < 0.4 ? -at / 0.4 : at < 0.55 ? -1 + 2.0 * ((at - 0.4) / 0.15) : 1.0 * (1 - (at - 0.55) / 0.45);
      tilt = at > 0.45 && at < 0.85 ? Math.sin(((at - 0.45) / 0.4) * PI) : 0;
    }
    pour.visible = tilt > 0.35;
    p.crane.rotation.x = swing * 0.32 + Math.sin(this.t * 0.6) * 0.04;
    p.crane.rotation.y = Math.sin(this.t * 0.35) * 0.3;
    p.ladle.rotation.x = -p.crane.rotation.x + tilt * 0.9;
    pour.rotation.x = -tilt * 0.9;
    glow.material.opacity = 0.6 + 0.2 * Math.sin(this.t * 5.3) * Math.sin(this.t * 3.1);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z += Math.sin(this.t * 25) * this.hitT * 0.012; }
    for (const q of puffs) q.userData.update(dt, this.t);
    spill.userData.update(dt, this.t); lg.userData.update(dt, this.t);
  };
  // the Tripo model (tripoModels.js): smoke from its two stacks, the furnace glow on its front grille
  return wearModel(finish(root, a, 9.0), 'ashwright', { fit: 'long', stretch: [0.88, 1.15], keep: [glow],
    fx: [[puffs[0], [0, 0.49, -0.09]], [puffs[1], [0.09, 0.4, -0.34]], [glow, [0, 0.15, 0.493], { s: 0.6 }]], motion: MOTION.boss });
}
