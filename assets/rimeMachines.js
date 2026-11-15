// Machines of the Rime Steps (Part Eleven, levels 45-50): the Makers' water-driven works in a glacier valley, still
// turning under the ice. Frost-blue iron (variant 0) or old bronze gone green at the seams (variant 1), rimed with frost,
// icicles off every lower edge, meltwater running in their troughs.
//  - Wheel Hammer: an ice-bound tilt-hammer on sledges, driven by a solid bucket wheel through a cam
//  - Flume Walker: a timber-and-iron water tower striding on two telescoping stilts, a rake boom for clearing flumes
//  - Sluice Keeper: a squat tracked gate-winder with a solid capstan and a gate arm it drops like a sluice gate
//  - Dam Sentry: a heavy armoured guard with a gate-plate shield and a square sluice-key maul, frost-rimed
//  - The Spillway Engine (world boss): a dam-gate engine on treads: two square gate towers, a sliding gate on square
//    rams, a stepped spillway chute running with meltwater, solid bucket wheels driving pistons, about 14 m tall
// Same interface as the other machines: userData.machine = { update(dt, speed), attack(dur, kind), hit(), die(), revive(), stun }.
// Content rules: no faces (no head lamps, no ports, no slits; a grille is never paired with lamps), no animal shapes
// (stilts telescope, they do not bend like legs of a bird), no spokes (solid discs with buckets on the rim and an
// offset bolt plate), no domes, rings, stars or radiating patterns; towers and tanks are square from above.
import * as THREE from 'three';
import { box, rbox, cyl, cone, ico } from './kit.js';
import { plate, sleeve, heroTreads, crawl, wear, grime, bolts, bdisc } from './bossParts.js';
import { smoke, glowSprite } from './dynamic.js';
import { slotGlow } from './slotGlow.js';
import { Anim, finish, part, pivot } from './quarryMachines.js';
import { wearModel, MOTION } from './tripoModels.js';

const PI = Math.PI;
const rb = (w, h, d, r) => rbox(w, h, d, r, 1);
const pl = (w, h, d, o = {}) => plate(w, h, d, { br: Math.max(0.032, Math.min(0.06, Math.min(w, h) * 0.05)), ...o });
const FROST = '#eef5fa', ICE = '#cfe6f4', WATER = '#8cc4e2', FOAM = '#f4fafc', WOOD = '#8a6c4c', WOOD2 = '#6e5440', DARK = '#33373c';

// palette per variant: 0 frost-blue iron with a cold blue gauge; 1 old bronze, verdigris at the seams, an amber gauge
function pal(v) {
  return v ? { mat: 'wBronze', paint: '#eadcc4', paint2: '#c8b494', iron: '#5a5048', trim: '#b89a62', glow: 'wGlowAmber', glowHex: 0xffb040, green: true }
    : { mat: 'wPaint', paint: '#8aa2b6', paint2: '#6c8498', iron: '#5c636c', trim: '#a8925e', glow: 'wGlowBlue', glowHex: 0x7ac8ff, green: false };
}
// frost crust: flattened pale lumps over a top face (on bronze, a few verdigris lumps mixed in)
function frost(b, cx, y, cz, w, d, n, s = 0.08, green = false) {
  for (let i = 0; i < n; i++) {
    const g = green && i % 3 === 1;
    b.add(ico(s * b.r(0.6, 1.1), 0), g ? 'wVerdigris' : 'wPaint', { p: [cx + b.r(-w / 2, w / 2), y, cz + b.r(-d / 2, d / 2)], s: [1.6, 0.36, 1.3], r: [0, b.r(0, 3), 0], c: g ? 0xffffff : wear(FROST, 0.12, i) });
  }
}
// icicles hanging off a lower edge from a to z
function icicles(b, a, z, n, len, r = null) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1), l = len * b.r(0.4, 1.1), rr = r ?? len * 0.2;
    b.add(cone(rr, l, 5), 'wPaint', { p: [a[0] + (z[0] - a[0]) * t, a[1] + (z[1] - a[1]) * t - l / 2, a[2] + (z[2] - a[2]) * t], r: [PI, b.r(0, 3), 0], c: ICE });
  }
}
// a sight-gauge strip: one lit glass in a dark frame (always single, never a pair)
function gauge(b, glow, p, h, ry = 0) {
  b.add(rb(0.12, h + 0.08, 0.06, 0.02), 'wDark', { p, r: [0, ry, 0], c: DARK });
  b.add(box(0.05, h, 0.03), glow, { p: [p[0] + Math.sin(ry) * 0.025, p[1], p[2] + Math.cos(ry) * 0.025], r: [0, ry, 0] });
}
// A solid water wheel on the x axis: one plain bevelled disc, a square axle nut, an off-centre bolt plate, and
// shallow buckets round the rim (timber boxes, each with an iron lip). Never spoked.
function bucketWheel(b, r, w, o = {}) {
  const { mat = 'wPaint', c = '#6c8498', bucket = 'wWood', bucketC = WOOD, n = 10, hub = 'wBrass', hubC = 0xffffff } = o;
  b.add(bdisc(r, w, Math.min(r * 0.08, w * 0.3), 28), mat, { r: [0, 0, PI / 2], c });
  // a square axle nut (a raised inner disc and a round hub read as a disc in a ring, an eye, from the side)
  b.add(rb(w * 1.5, r * 0.3, r * 0.3, Math.min(r * 0.03, w * 0.08)), hub, { c: hubC });
  for (const sx of [-1, 1]) {
    b.add(rb(w * 0.18, r * 0.34, r * 0.22, Math.min(r * 0.03, w * 0.06)), hub, { p: [sx * w * 0.66, r * 0.42, 0], c: hubC });
    b.add(rb(w * 0.14, r * 0.2, r * 0.4, Math.min(r * 0.03, w * 0.05)), 'wIron', { p: [sx * w * 0.6, -r * 0.4, 0], c: '#4a4e54' });
  }
  const bd = r * 0.2, bt = Math.min(r * 0.36, (2 * PI * r / n) * 0.45);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2, R = r + bd * 0.32;
    b.add(rb(w * 1.08, bd, bt, Math.min(0.03, bt * 0.2)), bucket, { p: [0, Math.cos(a) * R, Math.sin(a) * R], r: [a, 0, 0], c: bucketC });
    const lr = R + bd * 0.45, la = a + (bt * 0.4) / R;
    b.add(box(w * 1.12, bd * 0.12, bt * 0.5), 'wIron', { p: [0, Math.cos(la) * lr, Math.sin(la) * lr], r: [a, 0, 0], c: '#5a5e64' });
  }
}

// ==========================================================================
// WHEEL HAMMER: an ice-bound tilt-hammer on sledges (2.7 m tall, 3.6 m long)
// ==========================================================================
export function buildWheelHammer(variant = 0) {
  const P = pal(variant === 1), M = P.mat, G = P.glow;
  const pC = wear(P.paint, 0.3, 101 + variant), p2C = wear(P.paint2, 0.3, 103), ironC = wear(P.iron, 0.25, 104), trimC = wear(P.trim, 0.3, 105), woodC = wear(WOOD, 0.3, 106);
  const root = new THREE.Group();
  const hull = pivot(root, 0, 0, 0);
  const WX = 0.98, WY = 1.05, WZ = -1.05, WR = 0.92; // the wheel
  hull.add(part((b) => {
    // sledges: iron-shod timber runners with upturned noses, iron cross-ties
    for (const sx of [-1, 1]) {
      b.add(rb(0.22, 0.16, 3.2, 0.04), 'wWood', { p: [sx * 0.72, 0.1, -0.1], c: woodC });
      b.add(rb(0.25, 0.05, 3.2, 0.02), 'wIron', { p: [sx * 0.72, 0.025, -0.1], c: ironC });
      b.add(rb(0.22, 0.16, 0.6, 0.04), 'wWood', { p: [sx * 0.72, 0.24, 1.66], r: [-0.6, 0, 0], c: woodC });
      b.add(rb(0.25, 0.05, 0.62, 0.02), 'wIron', { p: [sx * 0.72, 0.18, 1.7], r: [-0.6, 0, 0], c: ironC });
      bolts(b, 'wBrass', [sx * 0.84, 0.12, -1.5], [sx * 0.84, 0.12, 1.3], 5, 0.025, 'x', trimC);
    }
    for (const z of [-1.3, -0.3, 0.7, 1.4]) b.add(rb(1.7, 0.12, 0.18, 0.03), 'wIron', { p: [0, 0.24, z], c: ironC });
    // the bed: a heavy plated frame with riveted flank plates
    b.add(rb(1.4, 0.4, 2.8, 0.06), M, { p: [0, 0.5, 0], c: grime(P.paint2, 0.3, 0.7, 0.3, 107) });
    for (const sx of [-1, 1]) b.addBuilder(pl(2.6, 0.34, 0.07, { mat: M, c: pC, c2: p2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 108, inset: false }), { p: [sx * 0.71, 0.5, 0], r: [0, sx * PI / 2, 0] });
    b.add(rb(1.5, 0.08, 2.9, 0.02), 'wIron', { p: [0, 0.72, 0], c: ironC });
    // the anvil at the front: a stepped iron block on a timber stock
    b.add(rb(0.74, 0.26, 0.74, 0.04), 'wWood', { p: [0, 0.89, 1.2], c: wear(WOOD2, 0.3, 109) });
    b.add(rb(0.6, 0.12, 0.62, 0.03), 'wIron', { p: [0, 1.06, 1.2], c: ironC });
    b.add(rb(0.5, 0.12, 0.54, 0.03), 'wDark', { p: [0, 1.17, 1.2], c: DARK });
    for (const sx of [-1, 1]) b.add(rb(0.06, 0.3, 0.8, 0.02), 'wIron', { p: [sx * 0.39, 0.9, 1.2], c: ironC });
    // the helve frame: two posts with bearing discs and a cap beam
    for (const sx of [-1, 1]) {
      b.add(rb(0.2, 1.1, 0.26, 0.04), M, { p: [sx * 0.3, 1.25, -0.75], c: p2C });
      b.add(bdisc(0.14, 0.08, 0.02, 16), 'wBrass', { p: [sx * 0.42, 1.55, -0.75], r: [0, 0, PI / 2], c: trimC });
      b.add(rb(0.14, 0.5, 0.5, 0.03), 'wIron', { p: [sx * 0.3, 0.95, -0.75], c: ironC });
    }
    b.add(rb(0.82, 0.14, 0.34, 0.03), 'wIron', { p: [0, 1.86, -0.75], c: ironC });
    frost(b, 0, 1.94, -0.75, 0.7, 0.25, 4, 0.06, P.green);
    // the wheel bearing block and axle housing on the right flank
    b.add(rb(0.22, 0.5, 0.42, 0.04), 'wIron', { p: [0.76, WY - 0.15, WZ], c: ironC });
    b.add(cyl(0.07, 0.07, 1.0, 10), 'wIron', { p: [0.45, WY, WZ], r: [0, 0, PI / 2], c: '#7a8088' });
    // the header tank over the wheel on a timber trestle, a spout over the buckets, one sight gauge
    for (const sz of [-1, 1]) b.add(rb(0.12, 1.5, 0.12, 0.03), 'wWood', { p: [WX + 0.36, 1.3, WZ + sz * 0.36], c: woodC });
    b.add(rb(0.14, 0.12, 0.9, 0.03), 'wWood', { p: [WX + 0.36, 0.6, WZ], c: woodC });
    b.add(rb(0.86, 0.5, 0.86, 0.06), M, { p: [WX, 2.32, WZ], c: pC });
    for (const y of [2.12, 2.52]) b.add(rb(0.92, 0.06, 0.92, 0.02), 'wIron', { p: [WX, y, WZ], c: ironC });
    gauge(b, G, [WX + 0.44, 2.32, WZ], 0.3, PI / 2);
    b.add(rb(0.26, 0.12, 0.5, 0.03), 'wWood', { p: [WX, 2.04, WZ + 0.58], r: [0.3, 0, 0], c: woodC });
    b.add(box(0.18, 0.32, 0.05), 'wPaint', { p: [WX, 1.84, WZ + 0.8], c: WATER });
    frost(b, WX, 2.58, WZ, 0.8, 0.8, 7, 0.08, P.green);
    icicles(b, [WX - 0.43, 2.07, WZ + 0.43], [WX + 0.43, 2.07, WZ + 0.43], 4, 0.18);
    icicles(b, [WX - 0.43, 2.07, WZ - 0.43], [WX - 0.43, 2.07, WZ + 0.3], 3, 0.15);
    // frost along the bed, icicles off its flanks and the anvil stock
    frost(b, 0, 0.77, 0.2, 1.3, 1.6, 8, 0.08, P.green);
    icicles(b, [-0.76, 0.34, -1.2], [-0.76, 0.34, 1.2], 6, 0.12);
    icicles(b, [-0.37, 0.76, 1.58], [0.37, 0.76, 1.58], 3, 0.1);
  }, 110 + variant));
  // the water wheel: solid, buckets on the rim, a cam lobe on the inner end of its axle under the helve tail
  const wheel = pivot(hull, WX, WY, WZ);
  wheel.add(part((b) => {
    bucketWheel(b, WR, 0.28, { mat: M, c: p2C, bucketC: woodC, n: 10, hubC: trimC });
    b.add(rb(0.16, 0.4, 0.22, 0.04), 'wIron', { p: [-WX, 0.2, 0], c: '#5a5e64' });
    frost(b, 0.15, WR * 0.5, 0, 0.02, 0.3, 2, 0.05);
  }, 111));
  // the helve: a long iron-bound timber beam pivoted between the posts, the hammer head over the anvil
  const helve = pivot(hull, 0, 1.55, -0.75);
  helve.add(part((b) => {
    b.add(rb(0.2, 0.24, 2.55, 0.04), 'wWood', { p: [0, 0, 0.95], c: woodC });
    for (const z of [-0.2, 0.5, 1.3]) b.add(rb(0.24, 0.28, 0.08, 0.02), 'wIron', { p: [0, 0, z], c: ironC });
    b.add(cyl(0.06, 0.06, 0.62, 10), 'wIron', { r: [0, 0, PI / 2], c: '#8a9098' });
    // the hammer head: a square iron block with a strap and a heavy face plate under it
    b.add(rb(0.44, 0.42, 0.48, 0.05), 'wIron', { p: [0, 0.02, 1.95], c: wear('#4e545a', 0.3, 112) });
    b.add(rb(0.5, 0.08, 0.54, 0.02), 'wDark', { p: [0, -0.21, 1.95], c: DARK });
    b.add(rb(0.48, 0.1, 0.52, 0.02), M, { p: [0, 0.26, 1.95], c: pC });
    bolts(b, 'wBrass', [0.235, 0.1, 1.78], [0.235, 0.1, 2.12], 2, 0.022, 'x', trimC);
    bolts(b, 'wBrass', [-0.235, 0.1, 1.78], [-0.235, 0.1, 2.12], 2, 0.022, 'x', trimC);
    frost(b, 0, 0.32, 1.95, 0.4, 0.4, 4, 0.06, P.green);
    icicles(b, [-0.24, -0.12, 2.2], [0.24, -0.12, 2.2], 3, 0.08);
  }, 113));
  // rear crampons: two pusher arms with iron ice-picks that shove the sledges along
  const picks = [];
  for (const sx of [-1, 1]) {
    const pk = pivot(hull, sx * 0.42, 0.55, -1.42);
    pk.add(part((b) => {
      b.add(bdisc(0.09, 0.1, 0.02, 12), 'wBrass', { r: [0, 0, PI / 2], c: trimC });
      b.add(rb(0.1, 0.5, 0.12, 0.03), 'wIron', { p: [0, -0.24, -0.06], r: [0.2, 0, 0], c: ironC });
      b.add(rb(0.2, 0.08, 0.16, 0.02), 'wIron', { p: [0, -0.5, -0.12], c: '#4a4e54' });
      b.add(cone(0.04, 0.12, 4), 'wMetal', { p: [0, -0.58, -0.12], r: [PI, 0, 0], c: '#c8ccd4' });
    }, 114));
    picks.push(pk);
  }
  const mist = smoke({ rate: 2, life: 1.6, size: 0.4, rise: 0.4, color: 0xeef6fa, opacity: 0.35, spread: 0.2 });
  mist.position.set(WX, 1.2, WZ + 0.9); hull.add(mist);
  const glow = slotGlow(P.glowHex, 0.13, 0.38, 0.5, { ry: PI / 2 }); glow.position.set(WX + 0.5, 2.32, WZ); hull.add(glow);
  const a = new Anim(root, { hull, wheel, helve, picks });
  a.dynamics.push(mist, glow);
  let wa = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.2), e = 1 - Math.pow(1 - k, 3);
      p.hull.rotation.z = 0.16 * e; p.hull.rotation.x = -0.06 * e; p.hull.position.y = -0.06 * e;
      p.helve.rotation.x = -0.25 * e; p.helve.rotation.z = 0.18 * e;
      mist.visible = false; glow.material.opacity = 0.5 * (1 - k);
      return;
    }
    mist.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    const sk = Math.min(1, this.speed / 2);
    wa += (1.1 + this.speed * 0.6) * dt * ts; p.wheel.rotation.x = wa;
    this.phase = ((this.phase || 0) + this.speed * dt * 0.7 * ts) % 1;
    const ph = this.phase * PI * 2;
    for (let i = 0; i < 2; i++) p.picks[i].rotation.x = Math.sin(ph + i * PI) * 0.45 * sk;
    // the sledges surge on each push; the cam keeps ticking the helve
    p.hull.position.z = Math.sin(ph * 2) * 0.04 * sk;
    p.hull.position.y = 0; p.hull.rotation.z = 0;
    p.hull.rotation.x = Math.sin(ph * 2) * 0.015 * sk;
    let lift = Math.pow(Math.max(0, Math.sin(wa * 2)), 3) * 0.12;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      // wind the head high, then let it fall on the anvil
      const up = at < 0.5 ? at / 0.5 : 1, down = at < 0.5 ? 0 : Math.min(1, (at - 0.5) / 0.08), rec = at > 0.75 ? (at - 0.75) / 0.25 : 0;
      lift = (0.85 * up * (1 - down)) * (1 - rec) + lift * rec;
      if (down > 0 && rec === 0) { p.hull.position.y = -0.04 * Math.sin(Math.min(1, (at - 0.5) / 0.15) * PI); p.hull.rotation.x += 0.03 * down; }
    }
    p.helve.rotation.x = -lift; p.helve.rotation.z = 0;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.hull.rotation.z = Math.sin(this.t * 30) * this.hitT * 0.03; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  return finish(root, a, 2.7);
}

// ==========================================================================
// FLUME WALKER: a timber-and-iron water tower on two telescoping stilts (6 m)
// ==========================================================================
export function buildFlumeWalker(variant = 0) {
  const P = pal(variant === 1), M = P.mat, G = P.glow;
  const pC = wear(P.paint, 0.3, 201 + variant), p2C = wear(P.paint2, 0.3, 203), ironC = wear(P.iron, 0.25, 204), trimC = wear(P.trim, 0.3, 205), woodC = wear(WOOD, 0.3, 206), wood2C = wear(WOOD2, 0.3, 207);
  const root = new THREE.Group();
  const PY = 3.2;
  const pelvis = pivot(root, 0, PY, 0);
  const body = pivot(pelvis, 0, 0, 0);
  body.add(part((b) => {
    // the hip yoke: a plated iron girder carrying both stilts, rams down to each stilt sleeve
    b.add(rb(1.4, 0.32, 0.56, 0.05), M, { p: [0, 0, 0], c: grime(P.paint2, -0.2, 0.2, 0.3, 208) });
    b.addBuilder(pl(1.3, 0.26, 0.06, { mat: M, c: pC, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, inset: false, seed: 209 }), { p: [0, 0, 0.29] });
    b.addBuilder(pl(1.3, 0.26, 0.06, { mat: M, c: pC, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, inset: false, seed: 210 }), { p: [0, 0, -0.29], r: [0, PI, 0] });
    // the tower: four corner timbers, plank walls, iron bands and corner straps
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(rb(0.16, 1.62, 0.16, 0.03), 'wWood', { p: [sx * 0.56, 0.98, sz * 0.5], c: woodC });
    for (const sz of [-1, 1]) for (let i = 0; i < 5; i++) b.add(rb(0.22, 1.48, 0.05, 0.015), 'wWood', { p: [-0.44 + i * 0.22, 0.98, sz * 0.5], c: i % 2 ? woodC : wood2C });
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) b.add(rb(0.05, 1.48, 0.24, 0.015), 'wWood', { p: [sx * 0.56, 0.98, -0.36 + i * 0.24], c: i % 2 ? wood2C : woodC });
    for (const y of [0.3, 1.0, 1.72]) b.add(rb(1.26, 0.08, 1.14, 0.02), 'wIron', { p: [0, y, 0], c: ironC });
    // one diagonal iron brace on each face (never crossed)
    for (const sz of [-1, 1]) b.add(rb(0.06, 1.5, 0.04, 0.01), 'wIron', { p: [0, 0.98, sz * 0.53], r: [0, 0, sz * 0.62], c: ironC });
    for (const sx of [-1, 1]) b.add(rb(0.04, 1.5, 0.06, 0.01), 'wIron', { p: [sx * 0.59, 0.98, 0], r: [sx * 0.55, 0, 0], c: ironC });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bolts(b, 'wBrass', [sx * 0.65, 0.4, sz * 0.5], [sx * 0.65, 1.6, sz * 0.5], 3, 0.022, 'x', trimC);
    // the flume trough over the top (front to back), water in it spilling off the front lip
    b.add(rb(0.66, 0.07, 1.9, 0.02), 'wWood', { p: [0, 1.84, 0], c: woodC });
    for (const sx of [-1, 1]) b.add(rb(0.06, 0.3, 1.9, 0.02), 'wWood', { p: [sx * 0.33, 1.98, 0], c: wood2C });
    for (const z of [-0.8, 0, 0.8]) b.add(rb(0.76, 0.06, 0.08, 0.015), 'wIron', { p: [0, 2.1, z], c: ironC });
    b.add(box(0.58, 0.04, 1.86), 'wPaint', { p: [0, 2.02, 0], c: WATER });
    b.add(box(0.14, 0.9, 0.04), 'wPaint', { p: [0, 1.42, 1.0], r: [0.08, 0, 0], c: WATER });
    icicles(b, [-0.33, 1.8, 0.94], [0.33, 1.8, 0.94], 4, 0.2);
    icicles(b, [-0.33, 1.8, -0.94], [0.33, 1.8, -0.94], 3, 0.16);
    // the header tank on the back of the trough, banded, frost on its lid, one gauge on its back
    b.add(rb(1.36, 0.46, 0.7, 0.05), M, { p: [0, 2.36, -0.5], c: pC });
    for (const y of [2.18, 2.5]) b.add(rb(1.42, 0.06, 0.76, 0.02), 'wIron', { p: [0, y, -0.5], c: ironC });
    b.add(rb(1.42, 0.06, 0.76, 0.02), M, { p: [0, 2.62, -0.5], c: p2C });
    for (const sx of [-1, 1]) b.add(rb(0.08, 0.5, 0.08, 0.02), 'wIron', { p: [sx * 0.64, 2.36, -0.84], c: ironC });
    gauge(b, G, [0.4, 2.36, -0.86], 0.26, PI);
    frost(b, 0, 2.66, -0.5, 1.3, 0.66, 8, 0.08, P.green);
    icicles(b, [-0.68, 2.12, -0.86], [0.68, 2.12, -0.86], 5, 0.16);
    frost(b, 0, 1.78, 0, 1.1, 1.0, 4, 0.06, P.green);
    icicles(b, [-0.63, 0.26, 0.5], [0.63, 0.26, 0.5], 5, 0.18);
    icicles(b, [-0.63, -0.16, -0.25], [0.63, -0.16, -0.25], 4, 0.14);
    // the rope winch on the left flank: a solid drum with a rope coil, a ratchet block and a crank arm
    b.add(rb(0.12, 0.5, 0.44, 0.03), 'wIron', { p: [-0.64, 1.2, 0.1], c: ironC });
    b.add(cyl(0.2, 0.2, 0.3, 14), 'wWood', { p: [-0.84, 1.2, 0.1], r: [0, 0, PI / 2], c: wood2C });
    for (const x of [-0.71, -0.97]) b.add(bdisc(0.26, 0.04, 0.01, 16), 'wIron', { p: [x, 1.2, 0.1], r: [0, 0, PI / 2], c: ironC });
    b.add(cyl(0.215, 0.215, 0.2, 14), 'wLeather', { p: [-0.84, 1.2, 0.1], r: [0, 0, PI / 2], c: '#8a7a5a' });
    b.add(rb(0.04, 0.36, 0.06, 0.01), 'wIron', { p: [-1.01, 1.36, 0.1], c: ironC });
    b.add(cyl(0.025, 0.025, 0.14, 6), 'wWood', { p: [-1.08, 1.52, 0.1], r: [0, 0, PI / 2], c: woodC });
    // the boom mount on the right front corner
    b.add(rb(0.24, 0.36, 0.3, 0.04), 'wIron', { p: [0.66, 1.5, 0.42], c: ironC });
  }, 211 + variant));
  // the rake boom: an iron-strapped timber beam with a rake head of short iron tines
  const boom = pivot(body, 0.7, 1.5, 0.45);
  boom.add(part((b) => {
    b.add(bdisc(0.12, 0.1, 0.02, 14), 'wBrass', { r: [0, 0, PI / 2], c: trimC });
    b.add(rb(0.14, 0.18, 1.9, 0.03), 'wWood', { p: [0.04, 0, 0.9], c: woodC });
    for (const z of [0.3, 0.95, 1.6]) b.add(rb(0.18, 0.22, 0.06, 0.015), 'wIron', { p: [0.04, 0, z], c: ironC });
    b.add(rb(0.6, 0.16, 0.22, 0.03), 'wIron', { p: [0.04, -0.06, 1.88], c: ironC });
    for (let i = 0; i < 5; i++) b.add(rb(0.05, 0.28, 0.06, 0.012), 'wMetal', { p: [0.04 - 0.24 + i * 0.12, -0.26, 1.92], r: [0.25, 0, 0], c: '#b8bcc4' });
    frost(b, 0.04, 0.1, 1.0, 0.1, 1.4, 4, 0.05, P.green);
    icicles(b, [0.04, -0.09, 0.4], [0.04, -0.09, 1.5], 3, 0.1);
  }, 212));
  // stilts: a long iron-bound timber upper with a sleeve, a sliding iron rod below, a flat sledge-pad foot kept level
  const legs = {};
  for (const sx of [-1, 1]) {
    const hip = pivot(pelvis, sx * 0.56, -0.02, 0);
    hip.add(part((b) => {
      b.add(bdisc(0.16, 0.14, 0.03, 16), 'wIron', { p: [sx * 0.12, 0, 0], r: [0, 0, PI / 2], c: ironC });
      b.add(rb(0.24, 0.3, 0.3, 0.04), 'wIron', { p: [0, -0.1, 0], c: ironC });
      b.add(rb(0.2, 1.6, 0.22, 0.04), 'wWood', { p: [0, -0.98, 0], c: woodC });
      for (const y of [-0.45, -1.0, -1.5]) b.add(rb(0.24, 0.07, 0.26, 0.015), 'wIron', { p: [0, y, 0], c: ironC });
      b.add(cyl(0.12, 0.12, 0.5, 12), 'wIron', { p: [0, -1.78, 0], c: '#6a7078' });
      b.add(cyl(0.14, 0.14, 0.08, 12), 'wBrass', { p: [0, -2.0, 0], c: trimC });
      icicles(b, [-0.1, -0.42, 0.13], [0.1, -0.42, 0.13], 2, 0.12);
    }, 213));
    const rod = pivot(hip, 0, -1.8, 0);
    rod.add(part((b) => b.add(cyl(0.065, 0.065, 1.5, 10), 'wMetal', { p: [0, -0.55, 0], c: '#c0c4ca' }), 214));
    const foot = pivot(rod, 0, -1.3, 0);
    foot.add(part((b) => {
      b.add(rb(0.18, 0.16, 0.18, 0.03), 'wIron', { p: [0, 0.02, 0], c: ironC });
      b.add(rb(0.46, 0.1, 0.82, 0.03), M, { p: [0, -0.06, 0.06], c: p2C });
      b.add(rb(0.5, 0.04, 0.86, 0.01), 'wIron', { p: [0, -0.12, 0.06], c: ironC });
      b.add(rb(0.46, 0.08, 0.2, 0.02), M, { p: [0, -0.04, 0.5], r: [-0.45, 0, 0], c: p2C });
      for (const z of [-0.22, 0.1, 0.36]) b.add(box(0.5, 0.04, 0.04), 'wMetal', { p: [0, -0.15, z], c: '#9aa0a8' });
      frost(b, 0, 0.0, 0.06, 0.36, 0.7, 3, 0.05);
    }, 215));
    legs[sx > 0 ? 'L' : 'R'] = { hip, rod, foot };
  }
  const drip = smoke({ rate: 2.5, life: 1.4, size: 0.35, rise: -0.6, color: 0xdceef8, opacity: 0.35, spread: 0.15 });
  drip.position.set(0, 1.4, 1.0); body.add(drip);
  const glow = slotGlow(P.glowHex, 0.13, 0.34, 0.5, { ry: PI }); glow.position.set(0.4, 2.36, -0.92); body.add(glow);
  const a = new Anim(root, { pelvis, body, boom, legs });
  a.dynamics.push(drip, glow);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.4), e = k * k;
      // one stilt folds out of its sleeve and the tower topples sideways onto it
      p.pelvis.position.y = PY - 2.2 * e; p.pelvis.rotation.z = 0.9 * e; p.pelvis.rotation.x = 0.1 * e;
      p.legs.R.hip.rotation.z = -0.9 * e; p.legs.L.hip.rotation.z = -0.6 * e; p.legs.L.rod.position.y = -1.8 + 0.6 * e;
      p.boom.rotation.x = 1.2 * e;
      drip.visible = false; glow.material.opacity = 0.5 * (1 - k);
      return;
    }
    drip.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    const sk = Math.min(1, this.speed / 2.5);
    this.phase = ((this.phase || 0) + this.speed * dt * 0.22 * ts) % 1;
    const ph = this.phase * PI * 2, swing = Math.sin(ph) * 0.3 * sk;
    p.legs.L.hip.rotation.x = -swing; p.legs.R.hip.rotation.x = swing;
    p.legs.L.hip.rotation.z = 0; p.legs.R.hip.rotation.z = 0;
    // a stilt draws up into its sleeve while it swings forward, then pushes down to plant
    p.legs.L.rod.position.y = -1.8 + Math.max(0, Math.cos(ph)) * 0.32 * sk;
    p.legs.R.rod.position.y = -1.8 + Math.max(0, -Math.cos(ph)) * 0.32 * sk;
    for (const L of [p.legs.L, p.legs.R]) L.foot.rotation.x = -L.hip.rotation.x;
    p.pelvis.position.y = PY - (1 - Math.abs(Math.cos(ph))) * 0.06 * sk + Math.sin(this.t * 1.3) * 0.015;
    p.pelvis.rotation.z = Math.sin(ph) * 0.05 * sk; p.pelvis.rotation.x = 0;
    p.body.rotation.y = Math.sin(ph) * 0.05 * sk;
    let bx = 0.75 + Math.sin(this.t * 0.7) * 0.05;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      // lift the rake high, then drag it down hard across the target
      const up = at < 0.45 ? at / 0.45 : 1, down = at < 0.45 ? 0 : Math.min(1, (at - 0.45) / 0.12), rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
      bx = bx + (-1.25 * up + 1.85 * down) * (1 - rec);
      p.body.rotation.x = (-0.06 * up + 0.1 * down) * (1 - rec);
    } else p.body.rotation.x = Math.sin(this.t * 1.1) * 0.012;
    p.boom.rotation.x = bx;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.body.rotation.x -= this.hitT * 0.12; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  return finish(root, a, 6.0);
}

// ==========================================================================
// SLUICE KEEPER: a squat tracked gate-winder with a capstan and a gate arm (2.1 m tall, 2.6 m long)
// ==========================================================================
export function buildSluiceKeeper(variant = 0) {
  const P = pal(variant === 1), M = P.mat, G = P.glow;
  const pC = wear(P.paint, 0.3, 301 + variant), p2C = wear(P.paint2, 0.3, 303), ironC = wear(P.iron, 0.25, 304), trimC = wear(P.trim, 0.3, 305);
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 1.74, len: 2.1, h: 0.6, tw: 0.38, paint: M, paintC: variant ? '#b09878' : '#4e5c68', linkC: '#5a5c60', road: 2, seed: 320 + variant });
  const HY = 0.58;
  const hull = pivot(base, 0, HY, 0);
  hull.add(part((b) => {
    // a squat banded hull, riveted flank plates, a heavy sill plate across the front
    b.add(rb(1.5, 0.78, 2.0, 0.08), M, { p: [0, 0.4, -0.05], c: grime(P.paint2, 0.0, 0.7, 0.3, 306) });
    for (const sx of [-1, 1]) b.addBuilder(pl(1.8, 0.56, 0.08, { mat: M, c: pC, c2: p2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 307 }), { p: [sx * 0.76, 0.42, -0.05], r: [0, sx * PI / 2, 0] });
    b.add(rb(1.62, 0.1, 2.1, 0.03), 'wIron', { p: [0, 0.82, -0.05], c: ironC });
    b.add(rb(1.4, 0.2, 0.3, 0.04), 'wIron', { p: [0, 0.12, 1.02], c: ironC });
    b.addBuilder(pl(1.3, 0.5, 0.08, { mat: M, c: p2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 308, inset: false }), { p: [0, 0.48, 0.97] });
    // the arm pedestal: two cheek plates on the front deck with a brass bearing each
    for (const sx of [-1, 1]) {
      b.add(rb(0.12, 0.42, 0.44, 0.03), M, { p: [sx * 0.36, 1.05, 0.25], c: pC });
      b.add(bdisc(0.12, 0.06, 0.02, 14), 'wBrass', { p: [sx * 0.43, 1.1, 0.25], r: [0, 0, PI / 2], c: trimC });
    }
    // the gear case beside the capstan, a pawl block and the single gauge on the back
    b.add(rb(0.42, 0.34, 0.5, 0.04), 'wIron', { p: [0.5, 1.0, -0.5], c: ironC });
    b.add(rb(0.12, 0.1, 0.24, 0.02), 'wBrass', { p: [0.3, 1.2, -0.5], c: trimC });
    gauge(b, G, [-0.45, 0.45, -1.06], 0.36, PI);
    b.add(rb(0.5, 0.3, 0.06, 0.02), 'wIron', { p: [0.3, 0.45, -1.06], c: ironC });
    frost(b, 0, 0.88, 0.2, 1.4, 1.4, 9, 0.08, P.green);
    icicles(b, [-0.8, 0.12, -0.9], [-0.8, 0.12, 0.8], 5, 0.12);
    icicles(b, [0.8, 0.12, -0.9], [0.8, 0.12, 0.8], 5, 0.12);
    icicles(b, [-0.6, 0.74, 1.03], [0.6, 0.74, 1.03], 4, 0.12);
  }, 309 + variant));
  // the capstan: a solid waisted drum with a chain coil, a flat cap with an off-centre bolt plate, one crank arm
  const cap = pivot(hull, 0, 0.86, -0.5);
  cap.add(part((b) => {
    b.add(cyl(0.4, 0.44, 0.14, 18), 'wIron', { p: [0, 0.07, 0], c: ironC });
    b.add(cyl(0.3, 0.34, 0.44, 18), M, { p: [0, 0.36, 0], c: pC });
    for (const y of [0.26, 0.34, 0.42]) b.add(cyl(0.335, 0.335, 0.05, 18), 'wIron', { p: [0, y, 0], c: '#4a4e54' });
    b.add(cyl(0.42, 0.38, 0.12, 18), M, { p: [0, 0.62, 0], c: p2C });
    b.add(rb(0.22, 0.06, 0.16, 0.02), 'wBrass', { p: [0.14, 0.7, 0.05], c: trimC });
    bolts(b, 'wBrass', [0.07, 0.73, 0.05], [0.21, 0.73, 0.05], 2, 0.018, 'y', trimC);
    b.add(rb(0.07, 0.07, 0.42, 0.02), 'wIron', { p: [0, 0.72, -0.24], c: ironC });
    b.add(cyl(0.035, 0.035, 0.2, 8), 'wWood', { p: [0, 0.84, -0.42], c: WOOD });
    frost(b, -0.12, 0.69, 0.05, 0.3, 0.4, 3, 0.06, P.green);
  }, 310));
  // the gate arm: two parallel beams from the pedestal, a riveted gate plate hanging from the tip
  const arm = pivot(hull, 0, 1.1, 0.25);
  arm.add(part((b) => {
    b.add(cyl(0.07, 0.07, 0.86, 10), 'wIron', { r: [0, 0, PI / 2], c: '#8a9098' });
    for (const sx of [-1, 1]) b.add(rb(0.1, 0.18, 1.45, 0.03), M, { p: [sx * 0.24, 0.02, 0.68], c: pC });
    b.add(rb(0.62, 0.14, 0.16, 0.03), 'wIron', { p: [0, 0.02, 1.36], c: ironC });
    b.add(rb(0.5, 0.1, 0.1, 0.02), 'wIron', { p: [0, 0.02, 0.6], c: ironC });
    // the gate: a heavy plate with horizontal stiffeners, guide shoes at its edges
    b.addBuilder(pl(1.16, 0.86, 0.12, { mat: M, c: p2C, c2: pC, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 311 }), { p: [0, -0.4, 1.46] });
    for (const y of [-0.26, -0.54]) b.add(rb(1.1, 0.06, 0.08, 0.015), 'wIron', { p: [0, y, 1.56], c: ironC });
    for (const sx of [-1, 1]) b.add(rb(0.08, 0.92, 0.18, 0.02), 'wIron', { p: [sx * 0.6, -0.4, 1.46], c: ironC });
    b.add(rb(1.22, 0.08, 0.2, 0.02), 'wDark', { p: [0, -0.84, 1.46], c: DARK });
    frost(b, 0, 0.1, 0.7, 0.5, 1.2, 5, 0.06, P.green);
    icicles(b, [-0.54, -0.88, 1.46], [0.54, -0.88, 1.46], 5, 0.14);
  }, 312));
  // the chain from the capstan drum to the arm
  const chain = part((b) => b.add(cyl(0.028, 0.028, 1, 6), 'wIron', { p: [0, 0.5, 0], c: '#3a3e44' }), 313);
  hull.add(chain);
  const up = new THREE.Vector3(0, 1, 0), dv = new THREE.Vector3();
  const glow = slotGlow(P.glowHex, 0.13, 0.44, 0.5, { ry: PI }); glow.position.set(-0.45, 0.45, -1.12); hull.add(glow);
  const a = new Anim(root, { base, hull, cap, arm, wheels: TR.wheels });
  a.dynamics.push(glow);
  let dist = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.1), e = 1 - Math.pow(1 - k, 3);
      p.hull.rotation.z = -0.14 * e; p.hull.rotation.x = 0.06 * e; p.hull.position.y = HY - 0.12 * e;
      p.arm.rotation.x = 0.5 * e;
      glow.material.opacity = 0.5 * (1 - k);
    } else {
      const ts = this.stun ? 0.15 : 1;
      this.speed += (speed - this.speed) * Math.min(1, dt * 5);
      for (const w of p.wheels) w.rotation.x += (this.speed / 0.3) * dt * ts;
      dist += this.speed * dt * ts; crawl(TR.runs, dist);
      p.hull.position.y = HY + Math.abs(Math.sin(this.t * 6)) * 0.02 * Math.min(1, this.speed);
      p.hull.rotation.z = 0; p.hull.rotation.x = Math.sin(this.t * 1.1) * 0.006;
      let ar = Math.sin(this.t * 0.9) * 0.04, spin = 0.25;
      const at = this.stepAttack(dt);
      if (at >= 0) {
        // wind the gate up on the capstan, then drop it like a sluice gate
        const rise = at < 0.5 ? at / 0.5 : 1, drop = at < 0.5 ? 0 : Math.min(1, (at - 0.5) / 0.09), rec = at > 0.72 ? (at - 0.72) / 0.28 : 0;
        ar = (-0.75 * rise + 1.2 * drop) * (1 - rec);
        spin = at < 0.5 ? 3.0 : drop < 1 ? -9 : -0.5;
        if (drop > 0 && rec === 0) p.hull.rotation.x += 0.05 * Math.sin(Math.min(1, (at - 0.5) / 0.16) * PI);
      }
      p.arm.rotation.x = ar;
      p.cap.rotation.y += spin * dt * ts;
      if (this.hitT > 0) { this.hitT -= dt * 3; p.hull.rotation.z = Math.sin(this.t * 30) * this.hitT * 0.03; }
    }
    // keep the chain strung from the drum to the arm's cross bar
    const th = p.arm.rotation.x, ay = 1.1 + 0.08 * Math.cos(th) - 0.6 * Math.sin(th), az = 0.25 + 0.08 * Math.sin(th) + 0.6 * Math.cos(th);
    chain.position.set(0, 0.86 + 0.36, -0.5 + 0.3);
    dv.set(0, ay - chain.position.y, az - chain.position.z);
    chain.scale.set(1, dv.length(), 1); chain.quaternion.setFromUnitVectors(up, dv.normalize());
    if (!this.dead) for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  // the Tripo model (tripoModels.js); the old-bronze keepers get a bronze tint over its frosted steel
  return wearModel(finish(root, a, 2.1), 'sluicekeeper', { fit: 'long', stretch: [0.88, 1.12], motion: MOTION.mob,
    tint: variant === 1 ? { c: '#c89458', k: 0.75, b: 0.9 } : null });
}

// ==========================================================================
// DAM SENTRY: a heavy armoured guard, frost-rimed (3.1 m)
// ==========================================================================
export function buildDamSentry(variant = 0) {
  const P = pal(variant === 1), M = P.mat, G = P.glow;
  const pC = wear(P.paint, 0.3, 401 + variant), p2C = wear(P.paint2, 0.3, 403), ironC = wear(P.iron, 0.25, 404), trimC = wear(P.trim, 0.3, 405);
  const root = new THREE.Group();
  const PY = 1.36;
  const pelvis = pivot(root, 0, PY, 0);
  const torso = pivot(pelvis, 0, 0.1, 0);
  torso.add(part((b) => {
    b.add(rb(1.14, 1.02, 0.82, 0.1), M, { p: [0, 0.56, 0], c: grime(P.paint, 0.0, 0.8, 0.3, 406) });
        // one broad breastplate, plain and slightly angled, with a single vertical keel strap (no openings, no ribs)
    b.add(rb(1.0, 0.86, 0.1, 0.04), M, { p: [0, 0.6, 0.43], r: [-0.05, 0, 0], c: pC });
    b.add(rb(0.12, 0.8, 0.06, 0.02), 'wIron', { p: [0.2, 0.6, 0.49], r: [-0.05, 0, 0], c: ironC });
    bolts(b, 'wBrass', [0.2, 0.3, 0.53], [0.2, 0.9, 0.51], 4, 0.02, 'z', trimC);
    b.add(rb(1.04, 0.07, 0.14, 0.02), 'wIron', { p: [0, 1.0, 0.43], c: ironC });
    for (const sx of [-1, 1]) b.addBuilder(pl(0.66, 0.76, 0.08, { mat: M, c: p2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 409, lips: false, sideLips: true }), { p: [sx * 0.59, 0.56, 0], r: [0, sx * PI / 2, 0] });
    // a gauge strip low on the right flank only
    gauge(b, G, [-0.64, 0.38, 0.12], 0.3, -PI / 2);
    // the armoured cowl in place of a head: a raised plated collar block, flat brow, vertical ribs, no openings
    b.add(rb(1.22, 0.14, 0.9, 0.04), 'wIron', { p: [0, 1.1, 0], c: ironC });
    b.add(rb(0.86, 0.26, 0.6, 0.06), M, { p: [0, 1.29, -0.02], c: pC });
    b.add(rb(0.94, 0.07, 0.68, 0.02), 'wIron', { p: [0, 1.44, -0.02], c: ironC });
    b.add(rb(0.8, 0.2, 0.06, 0.02), M, { p: [0, 1.28, 0.3], r: [-0.25, 0, 0], c: p2C });
    bolts(b, 'wBrass', [-0.3, 1.36, 0.31], [0.3, 1.36, 0.31], 4, 0.018, 'z', trimC);
    // waist and skirt
    b.add(rb(0.94, 0.16, 0.74, 0.04), 'wIron', { p: [0, 0.03, 0], c: ironC });
    b.add(rb(0.82, 0.14, 0.64, 0.03), 'wDark', { p: [0, -0.1, 0], c: DARK });
    // back: a square pressure tank with banding, two pipes into the shoulders
    b.add(rb(0.84, 0.84, 0.36, 0.06), M, { p: [0, 0.62, -0.57], c: p2C });
    for (const y of [0.34, 0.9]) b.add(rb(0.88, 0.06, 0.4, 0.02), 'wIron', { p: [0, y, -0.57], c: ironC });
    for (const sx of [-1, 1]) b.add(cyl(0.05, 0.05, 0.6, 8), 'wCopper', { p: [sx * 0.46, 0.95, -0.35], r: [0.9, 0, 0], c: 0xffffff });
    // shoulder bearings
    for (const sx of [-1, 1]) {
      b.add(bdisc(0.18, 0.08, 0.02, 18), 'wIron', { p: [sx * 0.61, 0.86, 0], r: [0, 0, PI / 2], c: ironC });
      b.add(rb(0.04, 0.1, 0.07, 0.01), 'wBrass', { p: [sx * 0.66, 0.95, 0], c: trimC });
    }
    frost(b, 0, 1.17, -0.05, 1.1, 0.8, 8, 0.09, P.green);
    frost(b, 0, 1.48, -0.02, 0.8, 0.6, 5, 0.07, P.green);
    frost(b, 0, 1.05, -0.57, 0.7, 0.3, 4, 0.07, P.green);
    icicles(b, [-0.45, 0.6, 0.48], [0.45, 0.6, 0.48], 6, 0.14);
    icicles(b, [-0.58, 1.03, 0.42], [0.58, 1.03, 0.42], 5, 0.12);
    icicles(b, [-0.4, 0.2, -0.76], [0.4, 0.2, -0.76], 4, 0.14);
  }, 410 + variant));
  // arms: right (sx -1) the sluice-key maul, left the gate-plate shield
  const arms = {};
  for (const sx of [-1, 1]) {
    const sh = pivot(torso, sx * 0.74, 0.86, 0);
    sh.add(part((b) => {
      b.add(rb(0.3, 0.3, 0.3, 0.08), 'wIron', { c: ironC });
      b.add(rb(0.44, 0.08, 0.52, 0.03), M, { p: [sx * 0.04, 0.18, 0], r: [0, 0, -sx * 0.3], c: pC });
      b.add(rb(0.32, 0.06, 0.48, 0.02), M, { p: [sx * 0.18, 0.06, 0], r: [0, 0, -sx * 0.75], c: p2C });
      bolts(b, 'wBrass', [sx * 0.06, 0.23, -0.19], [sx * 0.06, 0.23, 0.19], 3, 0.016, 'y', trimC);
      frost(b, sx * 0.02, 0.24, 0, 0.3, 0.4, 3, 0.07, P.green);
      icicles(b, [sx * 0.31, -0.04, -0.18], [sx * 0.31, -0.04, 0.18], 3, 0.12);
      b.add(rb(0.22, 0.52, 0.24, 0.05), M, { p: [0, -0.32, 0], c: p2C });
      b.add(cyl(0.03, 0.03, 0.42, 8), 'wIron', { p: [sx * 0.12, -0.3, 0.06], c: '#9aa0a8' });
    }, 411));
    const el = pivot(sh, 0, -0.62, 0);
    el.add(part((b) => {
      b.add(rb(0.22, 0.22, 0.22, 0.06), 'wIron', { c: ironC });
      b.add(rb(0.24, 0.5, 0.26, 0.05), M, { p: [0, -0.28, 0], c: pC });
      b.add(rb(0.27, 0.12, 0.29, 0.03), 'wIron', { p: [0, -0.1, 0], c: ironC });
      if (sx < 0) {
        // the sluice-key maul: a short shaft and a square iron head, banded
        b.add(cyl(0.05, 0.05, 0.5, 8), 'wIron', { p: [0, -0.7, 0.05], c: '#5a5e64' });
        b.add(rb(0.5, 0.44, 0.5, 0.06), 'wIron', { p: [0, -1.04, 0.05], c: wear('#4e545a', 0.3, 412) });
        for (const y of [-0.9, -1.18]) b.add(rb(0.54, 0.06, 0.54, 0.015), M, { p: [0, y, 0.05], c: pC });
        b.add(rb(0.44, 0.08, 0.44, 0.02), 'wDark', { p: [0, -1.28, 0.05], c: DARK });
        frost(b, 0, -0.82, 0.05, 0.4, 0.4, 3, 0.06, P.green);
        icicles(b, [-0.22, -1.3, 0.28], [0.22, -1.3, 0.28], 3, 0.1);
      } else {
        // the gate-plate shield: a tall riveted plate with horizontal stiffeners
        b.add(rb(0.09, 0.98, 0.7, 0.04), 'wIron', { p: [0.15, -0.5, 0.06], c: ironC });
        b.add(rb(0.1, 0.8, 0.56, 0.03), M, { p: [0.18, -0.5, 0.06], c: pC });
        for (const y of [-0.24, -0.5, -0.76]) b.add(rb(0.12, 0.06, 0.62, 0.015), 'wIron', { p: [0.2, y, 0.06], c: ironC });
        bolts(b, 'wBrass', [0.24, -0.1, -0.24], [0.24, -0.1, 0.36], 3, 0.02, 'x', trimC);
        bolts(b, 'wBrass', [0.24, -0.9, -0.24], [0.24, -0.9, 0.36], 3, 0.02, 'x', trimC);
        frost(b, 0.15, -0.02, 0.06, 0.08, 0.6, 3, 0.06, P.green);
        icicles(b, [0.16, -1.0, -0.24], [0.16, -1.0, 0.36], 4, 0.15);
      }
    }, 413 + (sx > 0 ? 1 : 0)));
    arms[sx < 0 ? 'R' : 'L'] = { sh, el };
  }
  const legs = {};
  for (const sx of [-1, 1]) {
    const hip = pivot(pelvis, sx * 0.3, -0.05, 0);
    hip.add(part((b) => {
      b.add(rb(0.26, 0.26, 0.26, 0.07), 'wIron', { c: ironC });
      b.add(rb(0.24, 0.58, 0.28, 0.05), M, { p: [0, -0.32, 0], c: pC });
      b.add(rb(0.26, 0.2, 0.06, 0.02), M, { p: [0, -0.22, 0.14], c: p2C });
      b.add(cyl(0.05, 0.05, 0.24, 10), 'wIron', { p: [sx * 0.16, -0.2, -0.05], c: '#3a3e44' });
    }, 415));
    const ram = pivot(hip, sx * 0.16, -0.44, -0.05);
    ram.add(part((b) => b.add(cyl(0.028, 0.028, 0.3, 8), 'wIron', { c: '#a8acb4' }), 416));
    const knee = pivot(hip, 0, -0.64, 0);
    knee.add(part((b) => {
      b.add(rb(0.22, 0.22, 0.22, 0.06), 'wIron', { c: ironC });
      b.add(rb(0.22, 0.56, 0.26, 0.05), M, { p: [0, -0.3, 0], c: grime(P.paint, -0.6, -0.1, 0.35, 417) });
      b.add(rb(0.26, 0.17, 0.08, 0.02), M, { p: [0, -0.06, 0.14], r: [-0.2, 0, 0], c: p2C });
      b.add(rb(0.42, 0.14, 0.6, 0.04), 'wDark', { p: [0, -0.6, 0.08], c: DARK });
      b.add(rb(0.38, 0.07, 0.18, 0.02), 'wIron', { p: [0, -0.52, 0.33], r: [0.3, 0, 0], c: ironC });
      b.add(cyl(0.03, 0.03, 0.4, 8), 'wIron', { p: [0, -0.3, -0.15], c: '#a8acb4' });
      frost(b, 0, -0.52, 0.08, 0.3, 0.4, 3, 0.06, P.green);
    }, 418));
    legs[sx > 0 ? 'L' : 'R'] = { hip, knee, ram };
  }
  const breath = smoke({ rate: 2, life: 2.0, size: 0.45, rise: 0.8, color: 0xeef6fa, opacity: 0.35 });
  breath.position.set(0, 1.12, -0.6); torso.add(breath);
  const glow = slotGlow(P.glowHex, 0.13, 0.38, 0.5, { ry: -PI / 2 }); glow.position.set(-0.7, 0.38, 0.12); torso.add(glow);
  const a = new Anim(root, { pelvis, torso, arms, legs });
  a.dynamics.push(breath, glow);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.1), e = 1 - Math.pow(1 - k, 3);
      p.pelvis.position.y = PY - 0.85 * e; p.pelvis.rotation.x = 0.25 * e; p.torso.rotation.x = 0.85 * e;
      p.legs.L.hip.rotation.x = -1.25 * e; p.legs.L.knee.rotation.x = 1.9 * e; p.legs.R.hip.rotation.x = -0.95 * e; p.legs.R.knee.rotation.x = 1.6 * e;
      p.arms.R.sh.rotation.x = -0.4 * e; p.arms.L.sh.rotation.z = 0.6 * e;
      breath.visible = false; glow.material.opacity = 0.5 * (1 - k);
      return;
    }
    breath.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 6);
    const sk = Math.min(1, this.speed / 2.5);
    this.phase = ((this.phase || 0) + this.speed * dt * 0.4 * ts) % 1;
    const ph = this.phase * PI * 2, swing = Math.sin(ph) * 0.55 * sk;
    p.legs.L.hip.rotation.x = -swing; p.legs.R.hip.rotation.x = swing;
    p.legs.L.knee.rotation.x = Math.max(0, Math.cos(ph)) * 0.9 * sk + 0.05;
    p.legs.R.knee.rotation.x = Math.max(0, -Math.cos(ph)) * 0.9 * sk + 0.05;
    for (const L of [p.legs.L, p.legs.R]) L.ram.position.y = -0.44 - L.knee.rotation.x * 0.07;
    p.pelvis.position.y = PY - (1 - Math.abs(Math.sin(ph))) * 0.07 * sk + Math.sin(this.t * 1.5) * 0.015;
    p.pelvis.rotation.x = 0; p.pelvis.rotation.z = Math.sin(ph) * 0.06 * sk;
    p.torso.rotation.y = Math.sin(ph) * 0.1 * sk + Math.sin(this.t * 0.6) * 0.12 * (1 - sk);
    p.arms.R.sh.rotation.x = swing * 0.6; p.arms.L.sh.rotation.x = -swing * 0.6 - 0.2;
    p.arms.R.el.rotation.x = -0.25; p.arms.L.el.rotation.x = -0.9; p.arms.L.sh.rotation.z = 0.15; p.arms.R.sh.rotation.z = 0;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      if (this.atkKind === 'slam') {
        // shield bash: the gate plate punched forward
        const back = at < 0.4 ? at / 0.4 : 1, hit = at < 0.4 ? 0 : Math.min(1, (at - 0.4) / 0.12), rec = at > 0.65 ? (at - 0.65) / 0.35 : 0;
        p.arms.L.sh.rotation.x += (0.4 * back - 1.3 * hit) * (1 - rec); p.arms.L.el.rotation.x += (-0.3 * back + 0.8 * hit) * (1 - rec);
        p.torso.rotation.y += (-0.3 * back + 0.5 * hit) * (1 - rec);
      } else {
        // overhead maul slam with the right arm
        const up = at < 0.45 ? at / 0.45 : 1, down = at < 0.45 ? 0 : Math.min(1, (at - 0.45) / 0.12), rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
        p.arms.R.sh.rotation.x = (-2.6 * up + 3.1 * down) * (1 - rec);
        p.arms.R.el.rotation.x = (-0.6 * up + 0.5 * down) * (1 - rec) - 0.25;
        p.torso.rotation.x = (-0.15 * up + 0.4 * down) * (1 - rec);
        p.pelvis.position.y -= 0.12 * down * (1 - rec);
      }
    } else p.torso.rotation.x = Math.sin(this.t * 1.2) * 0.02;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.torso.rotation.x -= this.hitT * 0.22; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  return finish(root, a, 3.1);
}

// ==========================================================================
// THE SPILLWAY ENGINE (world boss): a dam-gate engine on treads, about 14 m tall and 15 m long
// ==========================================================================
export function buildSpillwayEngine() {
  const P = pal(false), M = P.mat, G = P.glow;
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 7.0, len: 13.0, h: 2.2, tw: 1.5, paintC: '#4e5c68', linkC: '#5a5c60', road: 3, seed: 520 });
  const body = pivot(base, 0, 0, 0);
  const hullC = grime(P.paint, 1.8, 4.4, 0.3, 501), hull2C = wear(P.paint2, 0.3, 502), ironC = wear(P.iron, 0.25, 503), trimC = wear(P.trim, 0.3, 504), woodC = wear(WOOD, 0.3, 505), darkC = wear(DARK, 0.25, 506);
  const GZ = 1.4, GB = 4.6; // the gate line and the sill height
  body.add(part((b) => {
    // the hull: a heavy plated core, four plates a flank, a skirt band and a deck
    b.add(rb(5.8, 2.6, 11.4, 0.14), M, { p: [0, 3.1, -0.4], c: hullC });
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 4; i++) b.addBuilder(pl(2.5, 1.3, 0.14, { mat: M, c: wear(i % 2 ? P.paint : '#7890a4', 0.3, i * 3 + sx), c2: hull2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 507 + i }), { p: [sx * 2.96, 3.6, -4.2 + i * 2.7], r: [0, sx * PI / 2, 0] });
      b.addBuilder(pl(11.2, 0.6, 0.14, { mat: M, c: darkC, inset: false, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 511 }), { p: [sx * 2.96, 2.25, -0.4], r: [0, sx * PI / 2, 0] });
      b.add(box(0.06, 0.1, 10.6), G, { p: [sx * 2.95, 2.75, -0.4] });
      icicles(b, [sx * 3.06, 2.95, -5.6], [sx * 3.06, 2.95, 4.8], 14, 0.45);
    }
    b.add(rb(6.2, 0.22, 11.8, 0.05), 'wIron', { p: [0, 4.5, -0.4], c: ironC });
    for (const sx of [-1, 1]) b.add(box(0.12, 0.12, 11.8), 'wBrass', { p: [sx * 3.1, 4.63, -0.4], c: trimC });
    // the front: an ice-breaking plough under the chute foot, plated cheeks
    b.add(rb(5.6, 1.1, 1.6, 0.1), M, { p: [0, 2.2, 5.6], r: [0.5, 0, 0], c: hull2C });
    for (const sx of [-1, 1]) b.add(rb(0.3, 1.6, 1.8, 0.06), 'wIron', { p: [sx * 2.8, 2.4, 5.4], r: [0.5, 0, 0], c: ironC });
    b.add(rb(5.8, 0.2, 0.4, 0.05), 'wMetal', { p: [0, 1.4, 6.25], c: '#b0b6be' });
    // the gate towers: square, banded, plated, a guide slot down each inner face
    for (const sx of [-1, 1]) {
      const x = sx * 2.45;
      b.add(rb(1.8, 8.9, 2.2, 0.12), M, { p: [x, 9.0, GZ], c: grime(P.paint2, 4.6, 13.4, 0.3, 512 + sx) });
      for (const y of [5.2, 7.4, 9.6, 11.8, 13.3]) b.add(rb(1.96, 0.18, 2.36, 0.05), 'wIron', { p: [x, y, GZ], c: ironC });
      b.addBuilder(pl(1.5, 1.8, 0.12, { mat: M, c: hullC, c2: hull2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 514 }), { p: [x, 8.5, GZ + 1.12] });
      b.addBuilder(pl(1.9, 1.8, 0.12, { mat: M, c: hullC, c2: hull2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 515 }), { p: [sx * 3.36, 10.7, GZ], r: [0, sx * PI / 2, 0] });
      b.add(rb(0.12, 8.6, 0.5, 0.03), 'wDark', { p: [sx * 1.57, 9.0, GZ], c: darkC });
      frost(b, x, 13.42, GZ, 1.7, 2.1, 7, 0.16);
      icicles(b, [x - 0.9, 5.08, GZ + 1.19], [x + 0.9, 5.08, GZ + 1.19], 4, 0.4);
      icicles(b, [x - 0.9, 11.68, GZ + 1.19], [x + 0.9, 11.68, GZ + 1.19], 4, 0.35);
    }
    // the head girder across the towers, the two ram sleeves hanging under it
    b.add(rb(6.8, 1.0, 2.5, 0.1), M, { p: [0, 13.65, GZ], c: hull2C });
    b.addBuilder(pl(6.4, 0.7, 0.12, { mat: M, c: hullC, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 516 }), { p: [0, 13.65, GZ + 1.27] });
    for (const sx of [-1, 1]) {
      b.add(rb(0.62, 2.2, 0.62, 0.06), 'wIron', { p: [sx * 0.9, 12.05, GZ], c: wear('#5a6068', 0.25, 517) });
      for (const y of [11.1, 12.9]) b.add(rb(0.74, 0.14, 0.74, 0.03), 'wBrass', { p: [sx * 0.9, y, GZ], c: trimC });
    }
    frost(b, 0, 14.17, GZ, 6.4, 2.2, 16, 0.2);
    // the gate sill and the stepped spillway chute down over the plough
    b.add(rb(3.4, 0.3, 2.6, 0.05), 'wIron', { p: [0, GB - 0.12, GZ], c: ironC });
    const CA = 0.56, CL = 6.4, cz = GZ + 1.3 + Math.cos(CA) * CL / 2, cy = GB - 0.2 - Math.sin(CA) * CL / 2;
    b.add(rb(3.2, 0.24, CL, 0.05), M, { p: [0, cy, cz], r: [CA, 0, 0], c: darkC });
    for (const sx of [-1, 1]) {
      b.add(rb(0.22, 0.8, CL, 0.05), M, { p: [sx * 1.6, cy + 0.3, cz], r: [CA, 0, 0], c: hull2C });
      bolts(b, 'wBrass', [sx * 1.72, GB + 0.0, GZ + 1.5], [sx * 1.72, GB - 3.4, GZ + 1.5 + 5.2], 7, 0.05, 'x', trimC);
      b.add(rb(0.3, 2.4, 0.3, 0.05), 'wIron', { p: [sx * 1.3, 1.6, GZ + 6.2], c: ironC });
    }
    for (let i = 1; i < 5; i++) { const t = i / 5 - 0.5; b.add(rb(3.0, 0.22, 0.28, 0.04), 'wIron', { p: [0, cy - Math.sin(CA) * CL * t + 0.18, cz + Math.cos(CA) * CL * t], r: [CA, 0, 0], c: ironC }); }
    b.add(box(2.8, 0.05, CL - 0.2), 'wPaint', { p: [0, cy + 0.15, cz], r: [CA, 0, 0], c: WATER });
    // the foam pool at the chute foot
    b.add(rb(3.6, 0.2, 1.2, 0.05), 'wIron', { p: [0, 0.95, GZ + 7.2], c: ironC });
    for (let i = 0; i < 14; i++) b.add(ico(b.r(0.18, 0.36), 0), 'wPaint', { p: [b.r(-1.5, 1.5), 1.1 + b.r(0, 0.12), GZ + 7.2 + b.r(-0.45, 0.45)], s: [1.4, 0.55, 1.2], r: [b.r(0, 3), b.r(0, 3), 0], c: FOAM });
    // the reservoir: a big square banded tank on the rear deck, iced over, a single sight gauge on its back
    b.add(rb(5.0, 3.2, 4.2, 0.12), M, { p: [0, 6.2, -3.4], c: grime(P.paint, 4.6, 7.8, 0.3, 518) });
    for (const y of [5.0, 6.2, 7.4]) b.add(rb(5.2, 0.16, 4.4, 0.04), 'wIron', { p: [0, y, -3.4], c: ironC });
    b.add(rb(5.16, 0.14, 4.36, 0.04), M, { p: [0, 7.86, -3.4], c: hull2C });
    b.add(box(4.6, 0.06, 3.8), 'wPaint', { p: [0, 7.9, -3.4], c: ICE });
    gauge(b, G, [1.4, 6.2, -5.53], 2.0, PI);
    b.addBuilder(pl(2.2, 1.4, 0.12, { mat: M, c: hull2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 519 }), { p: [-1.0, 6.2, -5.52], r: [0, PI, 0] });
    frost(b, 0, 7.95, -3.4, 4.4, 3.8, 18, 0.22);
    icicles(b, [-2.52, 7.8, -5.52], [2.52, 7.8, -5.52], 9, 0.5);
    icicles(b, [-2.52, 4.9, -5.52], [2.52, 4.9, -5.52], 7, 0.4);
    // the race from the reservoir to the gate: a timber channel, water in it
    b.add(rb(2.6, 0.2, 2.6, 0.04), 'wWood', { p: [0, 5.2, -0.1], c: woodC });
    for (const sx of [-1, 1]) b.add(rb(0.16, 0.7, 2.6, 0.03), 'wWood', { p: [sx * 1.3, 5.5, -0.1], c: woodC });
    b.add(box(2.4, 0.05, 2.6), 'wPaint', { p: [0, 5.6, -0.1], c: WATER });
    // side flumes from the reservoir over the bucket wheels, water falling onto the buckets
    for (const sx of [-1, 1]) {
      b.add(rb(1.0, 0.16, 1.0, 0.03), 'wWood', { p: [sx * 3.1, 7.7, -3.0], c: woodC });
      for (const s2 of [-1, 1]) b.add(rb(0.1, 0.36, 1.0, 0.02), 'wWood', { p: [sx * 3.1 + s2 * 0.45, 7.85, -3.0], c: woodC });
      b.add(box(0.7, 0.9, 0.08), 'wPaint', { p: [sx * 3.4, 7.25, -2.55], c: WATER });
      // axle bearing blocks and piston sleeves along the deck
      b.add(rb(0.6, 1.2, 1.0, 0.06), 'wIron', { p: [sx * 2.75, 5.3, -3.6], c: ironC });
      b.addBuilder(sleeve(0.28, 2.0, { c: wear('#5a6068', 0.25, sx), trimC }), { p: [sx * 2.4, 5.1, -0.2], r: [PI / 2, 0, 0] });
      b.add(rb(0.7, 0.6, 0.8, 0.06), 'wIron', { p: [sx * 2.4, 5.1, -1.5], c: ironC });
    }
    frost(b, 0, 4.64, 3.6, 5.6, 2.6, 12, 0.18);
  }, 521));
  // the gate: a heavy plate with horizontal stiffeners, guide shoes, square rams up into the sleeves
  const gate = pivot(body, 0, 0, GZ);
  gate.add(part((b) => {
    b.addBuilder(pl(3.0, 4.2, 0.4, { mat: M, c: hull2C, c2: hullC, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 522 }), { p: [0, GB + 2.1, 0.1] });
    for (let i = 0; i < 4; i++) b.add(rb(2.9, 0.16, 0.24, 0.04), 'wIron', { p: [0, GB + 0.7 + i * 0.95, 0.42], c: ironC });
    for (const sx of [-1, 1]) b.add(rb(0.32, 4.3, 0.56, 0.04), 'wIron', { p: [sx * 1.5, GB + 2.1, 0], c: ironC });
    b.add(rb(3.1, 0.24, 0.6, 0.04), 'wDark', { p: [0, GB + 0.1, 0], c: darkC });
    for (const sx of [-1, 1]) {
      b.add(box(0.36, 2.8, 0.36), 'wMetal', { p: [sx * 0.9, GB + 4.2 + 1.3, 0], c: '#c0c6ce' });
      b.add(rb(0.6, 0.3, 0.6, 0.05), 'wIron', { p: [sx * 0.9, GB + 4.25, 0], c: ironC });
    }
    frost(b, 0, GB + 4.25, 0.1, 2.8, 0.4, 7, 0.12);
    for (let i = 0; i < 4; i++) frost(b, 0, GB + 0.8 + i * 0.95, 0.5, 2.6, 0.1, 3, 0.09);
    icicles(b, [-1.3, GB + 0.62, 0.56], [1.3, GB + 0.62, 0.56], 6, 0.3);
  }, 523));
  // the sheet of water running down the chute: foam flecks crawling down
  const CA = 0.56, CL = 6.4;
  const chuteF = pivot(body, 0, GB - 0.2 - Math.sin(CA) * CL / 2 + 0.2, GZ + 1.3 + Math.cos(CA) * CL / 2); chuteF.rotation.x = CA;
  const flow = pivot(chuteF, 0, 0, 0);
  flow.add(part((b) => { for (let i = 0; i < 14; i++) b.add(ico(b.r(0.12, 0.22), 0), 'wPaint', { p: [b.r(-1.2, 1.2), 0.02, -3.0 + i * 0.42], s: [1.6, 0.35, 1.2], c: FOAM }); }, 524));
  const runs = [{ run: flow, dir: -1, span: 0.42 }];
  // the bucket wheels on each flank, each with a crank pin driving a piston rod forward along the deck
  const wheels = [], rods = [];
  for (const sx of [-1, 1]) {
    const w = pivot(body, sx * 3.45, 5.6, -3.4);
    w.add(part((b) => {
      bucketWheel(b, 2.0, 0.5, { mat: M, c: hull2C, bucketC: woodC, n: 12, hubC: trimC });
      b.add(rb(0.3, 0.4, 0.4, 0.05), 'wBrass', { p: [-sx * 0.35, 1.0, 0], c: trimC });
    }, 525));
    wheels.push(w);
    const rd = pivot(body, sx * 2.4, 5.1, -0.2);
    rd.add(part((b) => { b.add(box(0.2, 0.2, 2.2), 'wMetal', { p: [0, 0, 1.1], c: '#c0c6ce' }); b.add(rb(0.44, 0.5, 0.5, 0.05), 'wIron', { p: [0, 0, 2.25], c: ironC }); }, 526));
    rods.push(rd);
  }
  const mist = smoke({ rate: 4, life: 2.6, size: 2.2, rise: 0.8, color: 0xeef6fa, opacity: 0.4, spread: 1.2 });
  mist.position.set(0, 1.6, GZ + 7.2); body.add(mist);
  const surge = smoke({ rate: 10, life: 1.6, size: 2.8, rise: 2.4, color: 0xf4fafc, opacity: 0.6, spread: 1.4 });
  surge.position.set(0, GB + 0.4, GZ + 1.4); body.add(surge); surge.userData.rate = 0;
  const glow = slotGlow(P.glowHex, 0.2, 2.1, 0.55, { ry: PI }); glow.position.set(1.4, 6.2, -5.6); body.add(glow);
  const a = new Anim(root, { base, body, gate, wheels: TR.wheels, buckets: wheels, rods });
  a.dynamics.push(mist, glow);
  let dist = 0, wa = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 2.2), e = 1 - Math.pow(1 - k, 2);
      p.body.rotation.z = e * 0.08; p.body.rotation.x = -e * 0.04; p.body.position.y = -0.35 * e;
      p.gate.position.y = -0.3 * e; p.gate.rotation.z = 0.06 * e;
      flow.visible = false; mist.visible = false; surge.visible = false;
      glow.material.opacity = 0.55 * (1 - k);
      return;
    }
    flow.visible = true; mist.visible = true; surge.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    for (const w of p.wheels) w.rotation.x += (this.speed / 1.1) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist); crawl(runs, this.t * 1.6 * ts);
    wa += (0.5 + this.speed * 0.3) * dt * ts;
    for (let i = 0; i < 2; i++) { p.buckets[i].rotation.x = wa * (i ? 1 : 1); p.rods[i].position.z = -0.2 + Math.sin(wa + i * PI) * 0.45; }
    p.body.position.y = Math.abs(Math.sin(this.t * 3.2)) * 0.05 * Math.min(1, this.speed);
    p.body.rotation.x = 0; p.body.rotation.z = Math.sin(this.t * 0.7) * 0.003;
    let gy = 0.15 + Math.sin(this.t * 0.8) * 0.08;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      // haul the gate up on the rams, then drop it and send the held water down the chute in one surge
      const rise = at < 0.45 ? at / 0.45 : 1, drop = at < 0.45 ? 0 : Math.min(1, (at - 0.45) / 0.07), rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
      gy = (2.6 * rise * (1 - drop)) * (1 - rec) + gy * rec;
      if (this.atkKind === 'slam' && drop > 0 && rec === 0) p.body.rotation.x = -0.02 * Math.sin(Math.min(1, (at - 0.45) / 0.2) * PI);
      if (drop > 0 && rec === 0) p.body.position.y -= 0.12 * Math.sin(Math.min(1, (at - 0.45) / 0.18) * PI);
      surge.userData.rate = at > 0.45 && at < 0.62 ? 12 : 0;
    } else surge.userData.rate = 0;
    p.gate.position.y = gy; p.gate.rotation.z = 0;
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z += Math.sin(this.t * 25) * this.hitT * 0.01; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
    surge.userData.update(dt, this.t);
  };
  // the Tripo model: mist off the foot of its spillway steps, the surge over the top step when the gate drops
  return wearModel(finish(root, a, 14.0), 'spillway', { fit: 'long', stretch: [0.88, 1.2],
    fx: [[mist, [0, 0.04, 0.5]], [surge, [0, 0.42, 0.18]]], motion: { ...MOTION.boss, heave: 0.6 } });
}
