// Machines of the Russet Weald (Part Fifteen, levels 65-70): the Makers' forest engines, still working the wood to the
// count they lost a lifetime ago. Oiled iron in a dark ox-red paint (variant 0) or old bronze gone green at the seams
// (variant 1); every one dusted with sawdust on its decks and copper and gold leaf on its top faces (plain oval leaves).
//  - Bark Stripper: a four-wheeled stripper with two solid roller drums one above the other in a square housing at the
//    front, the bark coming off them down a flat chute; strips of bark laid side by side along the deck
//  - Stump Grinder: a small tracked grinder with one straight boom off its bow, a plain solid disc head under a square shroud
//    at its end (open only underneath)
//  - Log Forwarder: a front engine unit and a rear bunk unit, each on two axles of solid wheels; the bunks are flat bolsters
//    with short straight stakes at their ends and logs lying in them along the machine; a loader portal (two posts and a flat
//    beam) behind the engine with a flat square clamp hung straight down on its rod
//  - Stack Crane: a square portal crane on four straight legs, each on a bogie of two solid wheels, a trolley across its two
//    long beams with a flat square clamp hung under it; the rare Damp-Bound Stacker is dark with damp, green at its feet, and
//    holds a sodden seasoning block (layer lines on its sides only)
//  - Feller: a tracked feller with a straight boom to a felling head: a square frame with two flat square clamp plates and a
//    plain flat saw bar under them; the rare Leaning Feller stands canted over on a sunk track, a half-cut butt in its clamps
//  - Ride Warden: a tall square column on a carriage of two big solid wheels and a small trailing one, a planked ride board
//    across its front, one straight side arm with a flat square tamper pad
//  - The Great Forwarder (world boss): a great forwarder on three axles a unit, its bunks loaded with oak, a tall loader
//    portal with its clamp, a second engine house, a straight drag chain to a trunk it hauls behind it; about 9 m tall
//  - The Fallen Standard (the Clear the Rides trunk, shared/rides.js): the trunk itself is the wood's own thrown standard
//    (client/game/wealdLayout.js); this is only a little sawdust where it is being cut, so it can be picked out and struck
// Same interface as the other machines: userData.machine = { update(dt, speed), attack(dur, kind), hit(), die(), revive(), stun }.
// Content rules (Part Fifteen's notes): no claw-like grabs (flat square clamp plates and straight stakes only), no beak-like
// saw guards (the saw bar is a plain flat bar), no faces (no lamps at all, one gauge strip only, vents only on backs), no
// spokes (solid discs with an offset bolt plate), no cogs, no domes, rings, stars or crossed parts; portals are two posts and
// a flat beam, never braced; logs lie parallel with plain one-colour ends (no growth rings); checked from straight above.
import * as THREE from 'three';
import { rbox, box, cyl, ico, sphere, rgb } from './kit.js';
import { plate, vent, stack, flywheel, heroTreads, crawl, wear, bolts, bdisc, sub } from './bossParts.js';
import { smoke } from './dynamic.js';
import { slotGlow } from './slotGlow.js';
import { Anim, finish, part, pivot } from './quarryMachines.js';

const PI = Math.PI;
const rb = (w, h, d, r) => rbox(w, h, d, r, 1);
const pl = (w, h, d, o = {}) => plate(w, h, d, { br: Math.max(0.032, Math.min(0.06, Math.min(w, h) * 0.05)), ...o });
const DARK = '#262422', DUST = '#d8c4a0', BARK = '#6a5848', LOGEND = '#c8aa80', LEAF = ['#b0521e', '#d8823a', '#c89a3a', '#8a3a18'];

function pal(v) {
  return v ? { mat: 'wBronze', paint: '#c8ae84', paint2: '#aa926c', iron: '#544c44', trim: '#b89a62', glow: 'wGlowAmber', glowHex: 0xffb040 }
    : { mat: 'wPaint', paint: '#7a4636', paint2: '#5e382c', iron: '#3c3a38', trim: '#a08a62', glow: 'wGlowOrange', glowHex: 0xff9a40 };
}
// dry dusty paint: the usual streaky wear, paler toward the top faces where sawdust settles
function dusted(base, top = 1.2, amt = 0.3, seed = 0) {
  const f = wear(base, amt, seed), D = rgb(DUST);
  return (x, y, z) => { const c = f(x, y, z), k = y > top ? Math.min(0.35, (y - top) * 0.5) : 0; return [c[0] * (1 - k) + D[0] * k, c[1] * (1 - k) + D[1] * k, c[2] * (1 - k) + D[2] * k]; };
}
// damp: darker, streaked down, green toward the foot (the Damp-Bound Stacker)
function damped(base, seed = 0) {
  const f = wear(base, 0.35, seed), M = rgb('#4e5e38');
  return (x, y, z) => { const c = f(x, y, z), st = 0.5 + 0.5 * Math.sin(x * 21 + z * 17 + seed), s = (st > 0.8 ? 0.7 : 0.85), k = y < 0.8 ? (0.8 - y) * 0.5 : 0; return [(c[0] * (1 - k) + M[0] * k) * s, (c[1] * (1 - k) + M[1] * k) * s, (c[2] * (1 - k) + M[2] * k) * s]; };
}
// fallen leaves on a top face: a few flat plain ovals, each its own turn (never a pattern)
function leaves(b, cx, y, cz, w, d, n, s = 0.09) {
  for (let i = 0; i < n; i++) b.add(sphere(s, 8, 4), 'wPaint', { p: [cx + b.r(-w / 2, w / 2), y, cz + b.r(-d / 2, d / 2)], s: [1, 0.1, 0.62], r: [0, b.r(0, 3.1), 0], c: LEAF[i % LEAF.length] });
}
// sawdust: one flat pale slab, then a few flattened lumps on it
function dust(b, cx, y, cz, w, d, n) {
  b.add(rb(w, 0.03, d, 0.012), 'wPaint', { p: [cx, y, cz], c: wear(DUST, 0.12, n) });
  for (let i = 0; i < n; i++) b.add(ico(0.07 * b.r(0.7, 1.2), 0), 'wPaint', { p: [cx + b.r(-w / 2, w / 2), y + 0.02, cz + b.r(-d / 2, d / 2)], s: [1.6, 0.35, 1.2], c: wear(DUST, 0.15, i) });
}
// a log lying along local z: a bark cylinder, its ends one flat plain colour (no rings)
function logZ(b, p, len, r, seed = 0) {
  b.add(cyl(r, r * 1.04, len, 10), 'wWood', { p, r: [PI / 2, 0, 0], c: wear(BARK, 0.3, seed) });
  for (const s of [-1, 1]) b.add(cyl(r * 0.95, r * 0.95, 0.02, 10), 'wPaint', { p: [p[0], p[1], p[2] + s * (len / 2 + 0.01)], r: [PI / 2, 0, 0], c: LOGEND });
}
function logX(b, p, len, r, seed = 0) {
  b.add(cyl(r, r * 1.04, len, 10), 'wWood', { p, r: [0, 0, PI / 2], c: wear(BARK, 0.3, seed) });
  for (const s of [-1, 1]) b.add(cyl(r * 0.95, r * 0.95, 0.02, 10), 'wPaint', { p: [p[0] + s * (len / 2 + 0.01), p[1], p[2]], r: [0, 0, PI / 2], c: LOGEND });
}
// a sight-gauge strip: one lit glass in a dark frame (always single)
function gauge(b, glow, p, h, ry = 0) {
  b.add(rb(0.12, h + 0.08, 0.06, 0.02), 'wDark', { p, r: [0, ry, 0], c: DARK });
  b.add(box(0.05, h, 0.03), glow, { p: [p[0] + Math.sin(ry) * 0.025, p[1], p[2] + Math.cos(ry) * 0.025], r: [0, ry, 0] });
}
// an engine house: flat roof, two bands, a louvred vent on its back (-z), one square stack, one gauge on a flank
function engineHouse(b, o) {
  const { w, h, d, x = 0, y, z, M, c, ironC, G, seed, stackX = w * 0.3, stackW = 0.22, stackH = 0.75, gaugeSide = 1 } = o;
  b.add(rb(w, h, d, 0.06), M, { p: [x, y + h / 2, z], c });
  b.add(rb(w + 0.1, 0.08, d + 0.1, 0.02), 'wIron', { p: [x, y + h + 0.02, z], c: ironC });
  for (const t of [0.3, 0.75]) b.add(rb(w + 0.04, 0.06, d + 0.04, 0.02), 'wIron', { p: [x, y + h * t, z], c: ironC });
  b.addBuilder(vent(w * 0.56, h * 0.42, { frameC: DARK, glow: G, seed }), { p: [x, y + h * 0.5, z - d / 2 - 0.02], r: [0, PI, 0] });
  b.addBuilder(stack(stackW, stackH, { c: '#323230', trimC: ironC, seed: seed + 1 }), { p: [x + stackX, y + h + 0.04, z - d * 0.2] });
  gauge(b, G, [x + gaugeSide * (w / 2 + 0.03), y + h * 0.55, z + d * 0.15], h * 0.3, gaugeSide * PI / 2);
}
// a solid wheel on the x axis at a pivot (flywheel: one plain disc, a square bolt plate off centre)
function wheel(parent, x, y, z, r, w, c, hubC, seed) {
  const g = pivot(parent, x, y, z);
  g.add(part((b) => b.addBuilder(flywheel(r, w, { mat: 'wIron', c, hub: 'wBrass', hubC, seed })), seed));
  return g;
}
// a flat square clamp: a crosshead and two flat square plates hung under it that slide shut across x (from above one square)
function clamp(parent, y, M, pC, ironC, trimC, s, seed, held = null) {
  const g = pivot(parent, 0, y, 0), plates = [];
  g.add(part((b) => {
    b.add(rb(1.0 * s, 0.16 * s, 0.7 * s, 0.03 * s), M, { p: [0, 0, 0], c: pC });
    b.add(rb(0.86 * s, 0.06 * s, 0.06 * s, 0.01), 'wIron', { p: [0, -0.1 * s, 0], c: ironC });
    bolts(b, 'wBrass', [-0.4 * s, 0.09 * s, 0.33 * s], [0.4 * s, 0.09 * s, 0.33 * s], 5, 0.02 * s, 'y', trimC);
    if (held) held(b);
  }, seed));
  for (const sx of [-1, 1]) {
    const j = pivot(g, sx * 0.38 * s, -0.12 * s, 0);
    j.add(part((b) => {
      b.add(rb(0.09 * s, 0.7 * s, 0.62 * s, 0.02 * s), 'wIron', { p: [0, -0.36 * s, 0], c: wear('#5c5a56', 0.25, sx + seed) });
      for (let i = 0; i < 3; i++) b.add(box(0.03 * s, 0.05 * s, 0.54 * s), 'wIron', { p: [-sx * 0.055 * s, -0.6 * s + i * 0.18 * s, 0], c: '#4a4844' });
    }, seed + 1));
    plates.push({ j, sx, x0: 0.38 * s });
  }
  return { g, plates };
}
const setClamp = (C, open) => { for (const P of C.plates) P.j.position.x = P.sx * (P.x0 + open); };

// ==========================================================================
// BARK STRIPPER: four solid wheels, two solid roller drums in a square housing at the front (2.4 m tall, 4.0 m long)
// ==========================================================================
export function buildBarkStripper(variant = 0) {
  const P = pal(variant === 1), M = P.mat, G = P.glow;
  const pC = dusted(P.paint, 1.2, 0.32, 3101 + variant), p2C = dusted(P.paint2, 1.2, 0.3, 3102), ironC = wear(P.iron, 0.25, 3103), trimC = wear(P.trim, 0.3, 3104);
  const root = new THREE.Group(), base = pivot(root, 0, 0, 0);
  const WR = 0.48, wheels = [];
  for (const sx of [-1, 1]) for (const z of [-1.15, 0.65]) wheels.push(wheel(base, sx * 0.92, WR, z, WR, 0.22, wear('#4a4642', 0.3, 3105), trimC, 3106));
  const BY = 0.64, body = pivot(base, 0, BY, 0);
  body.add(part((b) => {
    for (const sx of [-1, 1]) b.add(rb(0.22, 0.3, 3.3, 0.04), 'wIron', { p: [sx * 0.62, 0, -0.2], c: ironC });
    b.add(rb(1.2, 0.56, 2.9, 0.06), M, { p: [0, 0.36, -0.25], c: p2C });
    for (const sx of [-1, 1]) b.addBuilder(pl(2.6, 0.4, 0.06, { mat: M, c: pC, c2: p2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 3107 }), { p: [sx * 0.62, 0.38, -0.25], r: [0, sx * PI / 2, 0] });
    b.add(rb(1.3, 0.08, 3.0, 0.02), 'wIron', { p: [0, 0.68, -0.25], c: ironC });
    engineHouse(b, { w: 1.1, h: 0.9, d: 1.0, y: 0.7, z: -1.2, M, c: pC, ironC, G, seed: 3108 });
    // the roller housing at the bow: a square box open to the front, two flat cheeks, a flat lid
    b.add(rb(1.7, 0.08, 0.9, 0.02), M, { p: [0, 1.62, 1.15], c: pC });
    for (const sx of [-1, 1]) b.add(rb(0.08, 1.0, 0.9, 0.02), M, { p: [sx * 0.85, 1.12, 1.15], c: p2C });
    b.add(rb(1.7, 1.0, 0.08, 0.02), M, { p: [0, 1.12, 0.72], c: p2C });
    bolts(b, 'wBrass', [-0.78, 1.68, 1.55], [0.78, 1.68, 1.55], 7, 0.022, 'y', trimC);
    // the bark chute: a flat trough down the right flank; strips of bark laid side by side along the deck
    b.add(rb(0.45, 0.05, 1.6, 0.02), M, { p: [0.95, 0.66, 0.0], r: [0.3, 0, 0], c: p2C });
    for (const sx of [-1, 1]) b.add(rb(0.04, 0.2, 1.6, 0.01), M, { p: [0.95 + sx * 0.22, 0.75, 0.0], r: [0.3, 0, 0], c: pC });
    for (let i = 0; i < 5; i++) b.add(rb(0.16, 0.03, 1.1 + b.r(-0.2, 0.2), 0.01), 'wWood', { p: [-0.4 + i * 0.18, 0.74, 0.0], c: wear(BARK, 0.35, i) });
    dust(b, 0.2, 0.73, -0.4, 0.5, 0.3, 4);
    leaves(b, 0, 1.69, 1.15, 1.4, 0.7, 6); leaves(b, 0, 1.66, -1.2, 0.8, 0.7, 4);
  }, 3109 + variant));
  // the two roller drums, one above the other across the housing (plain solid drums with raised hoops)
  const rolls = [];
  for (const y of [0.86, 1.36]) {
    const r = pivot(body, 0, y, 1.2);
    r.add(part((b) => {
      b.add(cyl(0.2, 0.2, 1.5, 20), 'wIron', { r: [0, 0, PI / 2], c: wear('#5a5650', 0.3, y * 10) });
      for (let i = 0; i < 4; i++) b.add(cyl(0.215, 0.215, 0.06, 20), 'wIron', { p: [-0.6 + i * 0.4, 0, 0], r: [0, 0, PI / 2], c: '#6e6a64' });
      b.add(rb(0.06, 0.12, 0.12, 0.02), 'wBrass', { p: [0.78, 0.1, 0], c: trimC });
    }, 3110));
    rolls.push(r);
  }
  const exhaust = smoke({ rate: 2.2, life: 2.2, size: 0.42, rise: 1.0, color: 0x8a8884, opacity: 0.4, spread: 0.12 });
  exhaust.position.set(0.33, 2.45, -1.4); body.add(exhaust);
  const chips = smoke({ rate: 0, life: 0.9, size: 0.4, rise: -0.3, color: 0x8a6a4a, opacity: 0.55, spread: 0.5 });
  chips.position.set(0.95, 0.4, 0.8); body.add(chips);
  const glow = slotGlow(P.glowHex, 0.56, 0.32, 0.5, { ry: PI }); glow.position.set(0, 1.15, -1.72); body.add(glow);
  const a = new Anim(root, { base, body, rolls, wheels });
  a.dynamics.push(exhaust, glow);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt; const k = Math.min(1, this.deadT / 1.2), e = 1 - Math.pow(1 - k, 3);
      p.body.rotation.z = 0.09 * e; p.body.position.y = BY - 0.1 * e; exhaust.visible = false; chips.visible = false; glow.material.opacity = 0.5 * (1 - k);
      return;
    }
    exhaust.visible = true; chips.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    for (const w of p.wheels) w.rotation.x += (this.speed / WR) * dt * ts;
    p.body.position.y = BY + Math.abs(Math.sin(this.t * 7)) * 0.015 * Math.min(1, this.speed);
    let rate = 1.2, lunge = 0, cr = 0;
    const at = this.stepAttack(dt);
    if (at >= 0) { const f = Math.sin(Math.min(1, at / 0.6) * PI); rate = 7; lunge = 0.3 * f; if (at > 0.25 && at < 0.7) cr = 40; }
    p.body.position.z = lunge;
    p.rolls[0].rotation.x += rate * dt * ts * PI * 2; p.rolls[1].rotation.x -= rate * dt * ts * PI * 2;
    chips.userData.rate = cr;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.body.rotation.z = Math.sin(this.t * 30) * this.hitT * 0.03; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update(dt, this.t);
    chips.userData.update(dt, this.t);
  };
  return finish(root, a, 2.4);
}

// ==========================================================================
// STUMP GRINDER: a small tracked grinder, one straight boom to a solid disc head under a square shroud (2.2 m, 3.6 m long)
// ==========================================================================
export function buildStumpGrinder(variant = 0) {
  const P = pal(variant === 1), M = P.mat, G = P.glow;
  const pC = dusted(P.paint, 1.0, 0.32, 3201 + variant), p2C = dusted(P.paint2, 1.0, 0.3, 3202), ironC = wear(P.iron, 0.25, 3203), trimC = wear(P.trim, 0.3, 3204);
  const root = new THREE.Group(), base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 1.5, len: 2.3, h: 0.6, tw: 0.4, paint: M, paintC: variant ? '#a89070' : '#5a3a2e', linkC: '#4e4a44', road: 2, seed: 3205 + variant });
  const HY = 0.55, hull = pivot(base, 0, HY, 0);
  hull.add(part((b) => {
    b.add(rb(1.2, 0.6, 2.2, 0.07), M, { p: [0, 0.3, -0.2], c: p2C });
    for (const sx of [-1, 1]) b.addBuilder(pl(1.9, 0.42, 0.07, { mat: M, c: pC, c2: p2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 3206 }), { p: [sx * 0.61, 0.32, -0.2], r: [0, sx * PI / 2, 0] });
    b.add(rb(1.3, 0.08, 2.3, 0.02), 'wIron', { p: [0, 0.63, -0.2], c: ironC });
    engineHouse(b, { w: 1.0, h: 0.85, d: 0.95, y: 0.66, z: -0.75, M, c: pC, ironC, G, seed: 3207, gaugeSide: -1 });
    // the boom's foot: a square block on the bow
    b.add(rb(0.6, 0.5, 0.5, 0.04), 'wIron', { p: [0, 0.9, 0.72], c: ironC });
    dust(b, 0, 0.68, 0.3, 0.7, 0.4, 5);
    leaves(b, 0, 1.53, -0.75, 0.8, 0.7, 4);
  }, 3208 + variant));
  // the boom: one straight square beam forward and down from the bow block; the head at its end
  const boom = pivot(hull, 0, 1.0, 0.75);
  boom.add(part((b) => {
    b.add(cyl(0.08, 0.08, 0.7, 10), 'wIron', { r: [0, 0, PI / 2], c: ironC });
    b.add(rb(0.26, 0.26, 1.6, 0.04), M, { p: [0, 0, 0.8], c: pC });
    b.add(rb(0.3, 0.06, 1.5, 0.02), 'wIron', { p: [0, 0.15, 0.8], c: ironC });
    // the square shroud at the end: top and four sides, open only underneath
    b.add(rb(0.9, 0.06, 0.9, 0.02), M, { p: [0, -0.05, 1.75], c: pC });
    for (const sx of [-1, 1]) b.add(rb(0.05, 0.5, 0.9, 0.02), M, { p: [sx * 0.43, -0.3, 1.75], c: p2C });
    for (const sz of [-1, 1]) b.add(rb(0.9, 0.5, 0.05, 0.02), M, { p: [0, -0.3, 1.75 + sz * 0.43], c: p2C });
    bolts(b, 'wBrass', [-0.38, 0.0, 2.21], [0.38, 0.0, 2.21], 5, 0.02, 'z', trimC);
    leaves(b, 0, -0.01, 1.75, 0.7, 0.7, 3, 0.07);
  }, 3209 + variant));
  const head = pivot(boom, 0, -0.38, 1.75);
  head.add(part((b) => {
    b.add(bdisc(0.36, 0.14, 0.04, 28), 'wIron', { r: [0, 0, PI / 2], c: wear('#5a5650', 0.3, 3210) });
    b.add(rb(0.18, 0.12, 0.12, 0.02), 'wBrass', { p: [0.09, 0.18, 0], c: trimC });
  }, 3211));
  boom.rotation.x = 0.25;
  const exhaust = smoke({ rate: 2.2, life: 2.2, size: 0.4, rise: 1.0, color: 0x8a8884, opacity: 0.4, spread: 0.12 });
  exhaust.position.set(0.3, 2.3, -0.95); hull.add(exhaust);
  const chips = smoke({ rate: 0, life: 0.8, size: 0.45, rise: 0.2, color: 0xc8a878, opacity: 0.5, spread: 0.6 });
  chips.position.set(0, -0.6, 1.75); boom.add(chips);
  const glow = slotGlow(P.glowHex, 0.5, 0.3, 0.5, { ry: PI }); glow.position.set(0, 1.04, -1.24); hull.add(glow);
  const a = new Anim(root, { base, hull, boom, head, wheels: TR.wheels });
  a.dynamics.push(exhaust, glow);
  let dist = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt; const k = Math.min(1, this.deadT / 1.1), e = 1 - Math.pow(1 - k, 3);
      p.hull.rotation.z = -0.1 * e; p.boom.rotation.x = 0.25 + 0.3 * e; exhaust.visible = false; chips.visible = false; glow.material.opacity = 0.5 * (1 - k);
      return;
    }
    exhaust.visible = true; chips.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.3) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    let bx = 0.25 + Math.sin(this.t * 0.8) * 0.03, by = 0, rate = 2, cr = 0;
    const at = this.stepAttack(dt);
    if (at >= 0) { const dn = Math.sin(Math.min(1, at / 0.7) * PI); bx += 0.35 * dn; by = Math.sin(at * PI * 2) * 0.35 * dn; rate = 10; if (dn > 0.5) cr = 45; }
    p.boom.rotation.x = bx; p.boom.rotation.y = by;
    p.head.rotation.x += rate * dt * ts * PI * 2;
    chips.userData.rate = cr;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.hull.rotation.z = Math.sin(this.t * 30) * this.hitT * 0.03; } else p.hull.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update(dt, this.t);
    chips.userData.update(dt, this.t);
  };
  return finish(root, a, 2.2);
}

// ==========================================================================
// LOG FORWARDER: an engine unit and a bunk unit on solid wheels, flat bunks with short straight stakes, a loader portal with
// a flat square clamp (2.9 m tall, 6 m long). s scales it; great: the Great Forwarder's extra axles, loader and drag
// ==========================================================================
export function buildLogForwarder(variant = 0, s = 1, great = false) {
  const P = pal(variant === 1), M = P.mat, G = P.glow, sd = 3300 + (great ? 50 : 0) + variant;
  const pC = dusted(P.paint, 1.6 * s, 0.32, sd + 1), p2C = dusted(P.paint2, 1.6 * s, 0.3, sd + 2), ironC = wear(P.iron, 0.25, sd + 3), trimC = wear(P.trim, 0.3, sd + 4);
  const root = new THREE.Group(), base = pivot(root, 0, 0, 0);
  const WR = 0.5 * s, wheels = [];
  const axF = great ? [1.0, 1.9, 2.8] : [1.2, 2.3], axR = great ? [-0.6, -1.5, -2.4] : [-1.0, -2.1];
  for (const sx of [-1, 1]) for (const z of [...axF, ...axR]) wheels.push(wheel(base, sx * 0.98 * s, WR, z * s, WR, 0.3 * s, wear('#4a4642', 0.3, sd + 5), trimC, sd + 6));
  const BY = WR + 0.1 * s;
  // the engine unit (front, +z)
  const front = pivot(base, 0, BY, 0);
  front.add(part((b) => {
    const zc = (axF[0] + axF[axF.length - 1]) / 2 * s, L = (axF[axF.length - 1] - axF[0] + 1.6) * s;
    for (const sx of [-1, 1]) b.add(rb(0.2 * s, 0.3 * s, L, 0.04 * s), 'wIron', { p: [sx * 0.62 * s, 0, zc], c: ironC });
    b.add(rb(1.4 * s, 0.6 * s, L * 0.95, 0.06 * s), M, { p: [0, 0.4 * s, zc], c: p2C });
    for (const sx of [-1, 1]) b.addBuilder(pl(L * 0.9, 0.44 * s, 0.06 * s, { mat: M, c: pC, c2: p2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: sd + 7 }), { p: [sx * 0.72 * s, 0.42 * s, zc], r: [0, sx * PI / 2, 0] });
    b.add(rb(1.5 * s, 0.08 * s, L, 0.02 * s), 'wIron', { p: [0, 0.73 * s, zc], c: ironC });
    // the engine house faces back toward the bunks (its vent on the bow, the machine's back when it drags)
    engineHouse(b, { w: 1.2 * s, h: 1.0 * s, d: 1.2 * s, y: 0.76 * s, z: zc + 0.1 * s, M, c: pC, ironC, G, seed: sd + 8, stackW: 0.22 * s, stackH: 0.75 * s });
    // a timber bumper across the bow
    b.add(rb(1.6 * s, 0.24 * s, 0.26 * s, 0.04 * s), 'wWood', { p: [0, 0.15 * s, zc + L / 2 + 0.1 * s], c: wear('#6a5640', 0.3, sd) });
    if (great) engineHouse(b, { w: 1.0 * s, h: 0.7 * s, d: 0.9 * s, y: 0.76 * s, z: zc - 0.95 * s, M, c: p2C, ironC, G, seed: sd + 9, stackX: -0.3 * s, stackW: 0.2 * s, stackH: 0.6 * s, gaugeSide: -1 });
    leaves(b, 0, 1.8 * s, zc + 0.1 * s, 1.0 * s, 1.0 * s, 5, 0.09 * s);
    dust(b, 0, 0.78 * s, zc - 0.9 * s, 0.8 * s, 0.4 * s, 4);
  }, sd + 10));
  // the bunk unit (rear, -z): a deck, two or three flat bunk bolsters across x with short straight stakes at their ends,
  // the load of logs lying along z in them (parallel, plain ends)
  const rear = pivot(base, 0, BY, 0);
  const z0 = axR[axR.length - 1] * s - 0.8 * s, z1 = axR[0] * s + 0.8 * s, zc = (z0 + z1) / 2, RL = z1 - z0;
  rear.add(part((b) => {
    for (const sx of [-1, 1]) b.add(rb(0.2 * s, 0.3 * s, RL, 0.04 * s), 'wIron', { p: [sx * 0.62 * s, 0, zc], c: ironC });
    b.add(rb(1.5 * s, 0.14 * s, RL, 0.03 * s), M, { p: [0, 0.2 * s, zc], c: p2C });
    const nb = great ? 3 : 2;
    for (let i = 0; i < nb; i++) {
      const z = z0 + 0.4 * s + i * (RL - 0.8 * s) / (nb - 1);
      b.add(rb(2.1 * s, 0.18 * s, 0.24 * s, 0.03 * s), 'wIron', { p: [0, 0.36 * s, z], c: ironC });
      for (const sx of [-1, 1]) b.add(rb(0.12 * s, 0.9 * s, 0.12 * s, 0.02 * s), 'wIron', { p: [sx * 0.99 * s, 0.86 * s, z], c: wear('#4e4a46', 0.3, i + sx) }); // short straight stakes
    }
    // the load
    const n = great ? 7 : 5, rows = great ? [4, 3] : [3, 2];
    let k = 0;
    rows.forEach((cnt, row) => { for (let i = 0; i < cnt; i++, k++) logZ(b, [(i - (cnt - 1) / 2) * 0.46 * s, (0.62 + row * 0.38) * s, zc + b.r(-0.1, 0.1) * s], RL * 0.95, 0.21 * s, k); });
    void n;
    dust(b, 0.3 * s, 0.29 * s, zc + RL * 0.35, 0.4 * s, 0.4 * s, 3);
    leaves(b, 0, (great ? 1.24 : 0.86) * s, zc, 0.8 * s, RL * 0.7, great ? 8 : 5, 0.09 * s);
  }, sd + 11));
  // the joint between the units, and the loader portal just behind the engine unit: two straight posts, a flat beam
  const portZ = (axF[0] - 0.7) * s;
  const loader = pivot(base, 0, BY, portZ);
  loader.add(part((b) => {
    b.add(rb(0.5 * s, 0.4 * s, 0.6 * s, 0.04 * s), 'wIron', { p: [0, 0.3 * s, 0], c: ironC });
    const ph = great ? 2.9 : 2.2;
    for (const sx of [-1, 1]) b.add(rb(0.18 * s, ph * s, 0.2 * s, 0.03 * s), 'wIron', { p: [sx * 0.9 * s, ph / 2 * s, 0], c: ironC });
    b.add(rb(2.0 * s, 0.2 * s, 0.26 * s, 0.03 * s), M, { p: [0, ph * s, 0], c: pC });
    bolts(b, 'wBrass', [-0.85 * s, ph * s + 0.11 * s, 0.1 * s], [0.85 * s, ph * s + 0.11 * s, 0.1 * s], 6, 0.025 * s, 'y', trimC);
  }, sd + 12));
  // the loader beam: one straight square beam back from the portal over the bunks, the clamp hung straight down from its end
  const PH = (great ? 2.9 : 2.2) * s;
  const beam = pivot(loader, 0, PH + 0.18 * s, 0);
  beam.add(part((b) => {
    b.add(rb(0.24 * s, 0.24 * s, 2.0 * s, 0.03 * s), M, { p: [0, 0, -1.0 * s], c: p2C });
    b.add(rb(0.3 * s, 0.06 * s, 1.9 * s, 0.02 * s), 'wIron', { p: [0, 0.14 * s, -1.0 * s], c: ironC });
    b.add(cyl(0.03 * s, 0.03 * s, 0.9 * s, 6), 'wIron', { p: [0, -0.45 * s, -1.9 * s], c: '#2e2c2a' }); // the rod straight down
  }, sd + 13));
  const C = clamp(beam, -0.95 * s, M, pC, ironC, trimC, s, sd + 14, great ? (b) => logZ(b, [0, -0.5 * s, 0], 1.1 * s, 0.24 * s, 9) : null);
  C.g.position.z = -1.9 * s;
  // the Great Forwarder drags a trunk behind it on a straight chain
  let drag = null;
  if (great) {
    drag = pivot(base, 0, 0, z0 - 0.4 * s);
    drag.add(part((b) => {
      b.add(rb(0.12 * s, 0.12 * s, 1.6 * s, 0.03 * s), 'wIron', { p: [0, 0.45 * s, -0.8 * s], r: [-0.22, 0, 0], c: '#3a3836' }); // the chain, one straight run
      logX(b, [0, 0.32 * s, -1.75 * s], 3.4 * s, 0.32 * s, 31);
      leaves(b, 0, 0.66 * s, -1.75 * s, 2.6 * s, 0.4 * s, 5, 0.08 * s);
    }, sd + 15));
  }
  const exhaust = smoke({ rate: 2.6, life: 2.4, size: 0.45 * s, rise: 1.0 * s, color: 0x8a8884, opacity: 0.4, spread: 0.14 * s });
  exhaust.position.set(0.36 * s, 2.6 * s, ((axF[0] + axF[axF.length - 1]) / 2 - 0.1) * s); front.add(exhaust);
  const glow = slotGlow(P.glowHex, 0.62 * s, 0.38 * s, 0.5, { ry: PI }); glow.position.set(0, 1.26 * s, ((axF[0] + axF[axF.length - 1]) / 2 - 0.52) * s); front.add(glow); // (in the engine house's vent, on its back: nothing lit on the bow)
  const a = new Anim(root, { base, front, rear, beam, C, wheels, drag });
  a.dynamics.push(exhaust, glow);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt; const k = Math.min(1, this.deadT / 1.3), e = 1 - Math.pow(1 - k, 3);
      p.front.rotation.z = 0.07 * e; p.rear.rotation.z = -0.05 * e; p.beam.rotation.x = 0.35 * e; exhaust.visible = false; glow.material.opacity = 0.5 * (1 - k);
      return;
    }
    exhaust.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    for (const w of p.wheels) w.rotation.x += (this.speed / WR) * dt * ts;
    const bob = Math.abs(Math.sin(this.t * 6)) * 0.015 * s * Math.min(1, this.speed);
    p.front.position.y = BY + bob; p.rear.position.y = BY + bob * 0.6;
    let bx = Math.sin(this.t * 0.6) * 0.03, cy = -0.95 * s, open = 0.06 * s;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      // the beam swings down over the target and the clamp drops and shuts (a slam drops it hard)
      const dn = at < 0.45 ? at / 0.45 : 1, rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
      bx += (this.atkKind === 'slam' ? 0.5 : 0.32) * dn * (1 - rec); cy -= 0.5 * s * dn * (1 - rec); open = 0.06 * s * (1 - dn) - 0.06 * s * dn * (1 - rec);
    }
    p.beam.rotation.x = bx; p.C.g.position.y = cy; setClamp(p.C, open);
    if (p.drag) p.drag.rotation.y = Math.sin(this.t * 0.5) * 0.04 * Math.min(1, this.speed);
    if (this.hitT > 0) { this.hitT -= dt * 3; p.front.rotation.z = Math.sin(this.t * 30) * this.hitT * 0.02; } else p.front.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  return finish(root, a, (great ? 3.6 : 2.9) * s);
}
export const buildGreatForwarder = () => buildLogForwarder(0, 2.3, true);

// ==========================================================================
// STACK CRANE: a square portal crane on four straight legs on solid-wheel bogies, a trolley and a flat square clamp
// (3.4 m tall, 2.8 x 2.2 m). damp: the Damp-Bound Stacker (dark with damp, green at the feet, a sodden block in its clamp)
// ==========================================================================
export function buildStackCrane(variant = 0, damp = false) {
  const P = pal(variant === 1), M = P.mat, G = P.glow, sd = 3400 + variant + (damp ? 10 : 0);
  const pC = damp ? damped(P.paint, sd) : dusted(P.paint, 2.6, 0.32, sd + 1), p2C = damp ? damped(P.paint2, sd + 2) : dusted(P.paint2, 2.6, 0.3, sd + 2), ironC = damp ? damped(P.iron, sd + 3) : wear(P.iron, 0.25, sd + 3), trimC = wear(P.trim, 0.3, sd + 4);
  const root = new THREE.Group(), base = pivot(root, 0, 0, 0);
  const LX = 1.25, LZ = 1.0, H = 3.0, WR = 0.24, wheels = [];
  // the bogies: a square block under each leg, two solid wheels each, running along z
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const dz of [-0.24, 0.24]) wheels.push(wheel(base, sx * LX, WR, sz * LZ + dz, WR, 0.12, wear('#4a4642', 0.3, sd + 5), trimC, sd + 6));
  const frame = pivot(base, 0, 0, 0);
  frame.add(part((b) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      b.add(rb(0.3, 0.26, 0.8, 0.04), 'wIron', { p: [sx * LX, WR + 0.1, sz * LZ], c: ironC });
      b.add(rb(0.2, H - 0.3, 0.2, 0.03), M, { p: [sx * LX, (H + 0.3) / 2, sz * LZ], c: pC }); // straight legs
    }
    // the top: two long beams along x over the legs, two short end beams along z (a plain square frame from above), a
    // level tie low between each pair of legs at the ends (no braces)
    for (const sz of [-1, 1]) b.add(rb(LX * 2 + 0.4, 0.28, 0.26, 0.03), M, { p: [0, H, sz * LZ], c: p2C });
    for (const sx of [-1, 1]) { b.add(rb(0.24, 0.22, LZ * 2 + 0.2, 0.03), M, { p: [sx * LX, H - 0.02, 0], c: p2C }); b.add(rb(0.12, 0.12, LZ * 2, 0.02), 'wIron', { p: [sx * LX, 0.9, 0], c: ironC }); }
    // the engine house on the top at the -x end (its vent faces back, -z), the winch drum beside it
    engineHouse(b, { w: 0.9, h: 0.7, d: 1.2, x: -LX + 0.2, y: H + 0.14, z: 0, M, c: pC, ironC, G, seed: sd + 7, stackX: -0.2, stackW: 0.18, stackH: 0.55 });
    b.add(cyl(0.16, 0.16, 0.9, 16), 'wIron', { p: [-LX + 0.2, H + 0.3, 0.85], r: [0, 0, PI / 2], c: '#4a4844' });
    bolts(b, 'wBrass', [-LX + 0.3, H + 0.15, LZ + 0.14], [LX - 0.1, H + 0.15, LZ + 0.14], 7, 0.022, 'z', trimC);
    if (damp) {
      // dark wet patches down the legs, green at their feet, a few hanks of moss off the end beams
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(rb(0.24, 0.5, 0.24, 0.04), 'wPaint', { p: [sx * LX, 0.55, sz * LZ], c: wear('#4e5e38', 0.25, sx + sz) });
      for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) { const l = b.r(0.18, 0.34); b.add(box(0.03, l, 0.06), 'wPaint', { p: [sx * (LX + 0.13), H - 0.12 - l / 2, -0.8 + i * 0.4], c: i % 2 ? '#4e5e38' : '#5c6c40' }); }
    } else leaves(b, 0.5, H + 0.15, 0, 1.4, 1.6, 6);
  }, sd + 8));
  // the trolley across the long beams, a straight rod down from it to the clamp
  const trolley = pivot(base, 0.3, H + 0.16, 0);
  trolley.add(part((b) => {
    b.add(rb(0.6, 0.2, LZ * 2 + 0.3, 0.03), 'wIron', { c: ironC });
    b.add(rb(0.44, 0.3, 0.6, 0.04), M, { p: [0, 0.2, 0], c: pC });
    b.add(cyl(0.03, 0.03, 0.8, 6), 'wIron', { p: [0, -0.5, 0], c: '#2e2c2a' });
  }, sd + 9));
  const C = clamp(trolley, -1.0, M, pC, ironC, trimC, 1, sd + 10, damp ? (b) => {
    // a sodden seasoning block: a solid block, its layer lines on the sides only (nothing on its top)
    b.add(rb(0.62, 0.5, 0.56, 0.02), 'wWood', { p: [0, -0.48, 0], c: wear('#4e4234', 0.3, 5) });
    for (let i = 0; i < 3; i++) for (const sz of [-1, 1]) b.add(box(0.64, 0.02, 0.01), 'wPaint', { p: [0, -0.62 + i * 0.14, sz * 0.285], c: '#2e2822' });
  } : null);
  const exhaust = smoke({ rate: 2.0, life: 2.2, size: 0.38, rise: 1.0, color: 0x8a8884, opacity: 0.4, spread: 0.12 });
  exhaust.position.set(-LX, H + 1.5, -0.24); base.add(exhaust);
  const drip = damp ? smoke({ rate: 3, life: 0.8, size: 0.12, rise: -1.6, color: 0x9ab0b8, opacity: 0.5, spread: 0.3 }) : null;
  if (drip) { drip.position.set(0, -1.6, 0); C.g.add(drip); }
  const glow = slotGlow(P.glowHex, 0.4, 0.26, 0.45, { ry: PI }); glow.position.set(-LX + 0.2, H + 0.5, -0.63); base.add(glow);
  const a = new Anim(root, { base, frame, trolley, C, wheels });
  a.dynamics.push(exhaust, glow); if (drip) a.dynamics.push(drip);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt; const k = Math.min(1, this.deadT / 1.2), e = 1 - Math.pow(1 - k, 3);
      p.base.rotation.z = 0.06 * e; p.C.g.position.y = -1.0 - 1.1 * e; exhaust.visible = false; glow.material.opacity = 0.45 * (1 - k);
      return;
    }
    exhaust.visible = true; p.base.rotation.z = 0;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    for (const w of p.wheels) w.rotation.x += (this.speed / WR) * dt * ts;
    let tx = 0.3 + Math.sin(this.t * 0.4) * 0.25, cy = -1.0 + Math.sin(this.t * 0.9) * 0.05, open = 0.06;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      // the trolley runs to the bow (+x... the clamp drops out over the front) and the clamp falls and shuts
      const dn = at < 0.4 ? at / 0.4 : 1, rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
      tx = 0.3 * (1 - dn); cy = -1.0 - 1.15 * dn * (1 - rec); open = 0.06 * (1 - dn) - 0.07 * dn * (1 - rec);
    }
    p.trolley.position.x = tx; p.C.g.position.y = cy; setClamp(p.C, open);
    if (this.hitT > 0) { this.hitT -= dt * 3; p.frame.rotation.z = Math.sin(this.t * 30) * this.hitT * 0.015; } else p.frame.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  return finish(root, a, 3.6);
}

// ==========================================================================
// FELLER: tracked, a straight boom to a felling head of two flat square clamp plates over a plain flat saw bar
// (3.0 m tall, 4.4 m long). leaning: the Leaning Feller, canted over on a sunk track with a half-cut butt in its clamps
// ==========================================================================
export function buildFeller(variant = 0, leaning = false) {
  const P = pal(variant === 1), M = P.mat, G = P.glow, sd = 3500 + variant + (leaning ? 10 : 0);
  const pC = dusted(P.paint, 1.4, 0.32, sd + 1), p2C = dusted(P.paint2, 1.4, 0.3, sd + 2), ironC = wear(P.iron, 0.25, sd + 3), trimC = wear(P.trim, 0.3, sd + 4);
  const root = new THREE.Group(), base = pivot(root, 0, 0, 0);
  const lean = leaning ? 0.15 : 0;
  base.rotation.z = lean;
  const TR = heroTreads(base, { gauge: 2.0, len: 3.0, h: 0.72, tw: 0.48, paint: M, paintC: variant ? '#a89070' : '#5a3a2e', linkC: '#4e4a44', road: 2, seed: sd + 5 });
  const HY = 0.62, hull = pivot(base, 0, HY, 0);
  hull.add(part((b) => {
    b.add(rb(1.6, 0.7, 2.8, 0.08), M, { p: [0, 0.35, -0.2], c: p2C });
    for (const sx of [-1, 1]) b.addBuilder(pl(2.5, 0.5, 0.08, { mat: M, c: pC, c2: p2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: sd + 6 }), { p: [sx * 0.81, 0.38, -0.2], r: [0, sx * PI / 2, 0] });
    b.add(rb(1.7, 0.1, 2.9, 0.03), 'wIron', { p: [0, 0.74, -0.2], c: ironC });
    engineHouse(b, { w: 1.35, h: 1.0, d: 1.2, y: 0.78, z: -0.95, M, c: pC, ironC, G, seed: sd + 7 });
    // the slewing post on the bow: a square block on a flat turntable plate (square from above)
    b.add(rb(0.9, 0.12, 0.9, 0.03), 'wIron', { p: [0, 0.82, 0.75], c: ironC });
    b.add(rb(0.6, 0.7, 0.6, 0.05), M, { p: [0, 1.2, 0.75], c: pC });
    b.add(rb(1.4, 0.32, 0.26, 0.05), 'wIron', { p: [0, 0.5, -1.7], c: wear('#3a3836', 0.3, sd) }); // ballast at the stern
    dust(b, 0.3, 0.8, -0.1, 0.6, 0.4, 4);
    leaves(b, 0, 1.84, -0.95, 1.0, 0.8, 5);
    if (leaning) for (const sx of [-1, 1]) b.add(rb(0.5, 0.18, 2.8, 0.06), 'wPaint', { p: [sx * 1.0, -0.45, -0.2], c: wear('#5a4232', 0.2, sx) }); // the sunk track's leaf mould
  }, sd + 8));
  // the boom: one straight square beam forward from the post, the head at its end
  const boom = pivot(hull, 0, 1.45, 0.75);
  boom.add(part((b) => {
    b.add(cyl(0.09, 0.09, 0.7, 10), 'wIron', { r: [0, 0, PI / 2], c: ironC });
    b.add(rb(0.3, 0.3, 1.9, 0.04), M, { p: [0, 0, 0.95], c: pC });
    b.add(rb(0.34, 0.06, 1.8, 0.02), 'wIron', { p: [0, 0.17, 0.95], c: ironC });
    bolts(b, 'wBrass', [0.16, 0.0, 0.2], [0.16, 0.0, 1.7], 6, 0.02, 'x', trimC);
  }, sd + 9));
  // the head: a square frame hung from the boom's end, the clamp plates in it, the saw bar under them
  const head = pivot(boom, 0, -0.1, 1.95);
  head.add(part((b) => {
    b.add(rb(1.0, 0.16, 0.6, 0.03), M, { p: [0, 0, 0], c: pC });
    for (const sx of [-1, 1]) b.add(rb(0.12, 1.1, 0.5, 0.03), M, { p: [sx * 0.5, -0.6, 0], c: p2C });
    b.add(rb(1.0, 0.14, 0.5, 0.03), 'wIron', { p: [0, -1.15, 0], c: ironC });
    // the saw bar: one plain flat bar out to the right of the frame's foot, rounded at its end, a plain drive housing
    b.add(rb(0.34, 0.24, 0.42, 0.04), 'wIron', { p: [0.5, -1.25, 0], c: ironC });
    b.add(rb(1.5, 0.05, 0.26, 0.024), 'wIron', { p: [1.3, -1.25, 0], c: wear('#8a8680', 0.2, sd) });
    b.add(rb(1.5, 0.02, 0.06, 0.01), 'wIron', { p: [1.3, -1.23, 0.13], c: '#3a3836' });
    leaves(b, 0, 0.09, 0, 0.8, 0.4, 3, 0.07);
    if (leaning) { b.add(cyl(0.28, 0.3, 0.9, 10), 'wWood', { p: [0, -0.7, 0], c: wear(BARK, 0.3, 17) }); b.add(cyl(0.27, 0.27, 0.02, 10), 'wPaint', { p: [0, -0.24, 0], c: LOGEND }); } // the half-cut butt it still holds, upright (a plain top, no rings)
  }, sd + 10));
  const plates = [];
  for (const sx of [-1, 1]) {
    const j = pivot(head, sx * 0.36, -0.6, 0);
    j.add(part((b) => {
      b.add(rb(0.08, 0.8, 0.46, 0.02), 'wIron', { c: wear('#5c5a56', 0.25, sx + sd) });
      for (let i = 0; i < 3; i++) b.add(box(0.03, 0.05, 0.4), 'wIron', { p: [-sx * 0.05, -0.25 + i * 0.25, 0], c: '#4a4844' });
    }, sd + 11));
    plates.push({ j, sx, x0: 0.36 });
  }
  const C = { plates };
  const bar = head; // (the whole head turns about the boom for the sweep)
  boom.rotation.x = 0.12;
  const exhaust = smoke({ rate: 2.4, life: 2.2, size: 0.45, rise: 1.0, color: 0x8a8884, opacity: 0.4, spread: 0.12 });
  exhaust.position.set(0.4, 2.7, -1.2); hull.add(exhaust);
  const chips = smoke({ rate: 0, life: 0.8, size: 0.4, rise: 0.1, color: 0xc8a878, opacity: 0.5, spread: 0.5 });
  chips.position.set(1.2, -1.3, 0); head.add(chips);
  const glow = slotGlow(P.glowHex, 0.62, 0.36, 0.5, { ry: PI }); glow.position.set(0, 1.28, -1.57); hull.add(glow);
  const a = new Anim(root, { base, hull, boom, head, bar, C, wheels: TR.wheels });
  a.dynamics.push(exhaust, glow);
  let dist = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt; const k = Math.min(1, this.deadT / 1.2), e = 1 - Math.pow(1 - k, 3);
      p.base.rotation.z = lean + 0.1 * e; p.boom.rotation.x = 0.12 + 0.35 * e; exhaust.visible = false; chips.visible = false; glow.material.opacity = 0.5 * (1 - k);
      return;
    }
    exhaust.visible = true; chips.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.36) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    let bx = 0.12 + Math.sin(this.t * 0.7) * 0.03, hy = 0, open = leaning ? -0.06 : 0.04, cr = 0;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      // the head drops, the clamps shut, and the saw bar sweeps flat round under them
      const dn = at < 0.35 ? at / 0.35 : 1, rec = at > 0.75 ? (at - 0.75) / 0.25 : 0;
      bx += 0.3 * dn * (1 - rec); open = 0.04 - 0.1 * dn * (1 - rec);
      hy = at > 0.35 && at < 0.75 ? Math.sin((at - 0.35) / 0.4 * PI) * (this.atkKind === 'slam' ? 1.4 : 0.8) : 0;
      if (hy > 0.2) cr = 40;
    }
    p.boom.rotation.x = bx; p.head.rotation.y = hy; setClamp(p.C, open);
    chips.userData.rate = cr;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.hull.rotation.z = Math.sin(this.t * 30) * this.hitT * 0.03; } else p.hull.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update(dt, this.t);
    chips.userData.update(dt, this.t);
  };
  return finish(root, a, 3.0);
}

// ==========================================================================
// RIDE WARDEN: a tall square column on two big solid wheels and a trailing one, a planked ride board across its front,
// one straight side arm with a flat square tamper pad (3.2 m tall)
// ==========================================================================
export function buildRideWarden(variant = 0) {
  const P = pal(variant === 1), M = P.mat, G = P.glow, sd = 3600 + variant;
  const pC = dusted(P.paint, 2.6, 0.32, sd + 1), p2C = dusted(P.paint2, 2.6, 0.3, sd + 2), ironC = wear(P.iron, 0.25, sd + 3), trimC = wear(P.trim, 0.3, sd + 4);
  const root = new THREE.Group(), base = pivot(root, 0, 0, 0);
  const WR = 0.62, wheels = [];
  for (const sx of [-1, 1]) wheels.push(wheel(base, sx * 0.78, WR, 0.15, WR, 0.2, wear('#4a4642', 0.3, sd + 5), trimC, sd + 6));
  wheels.push(wheel(base, 0, 0.28, -1.05, 0.28, 0.16, wear('#4a4642', 0.3, sd + 7), trimC, sd + 8));
  const body = pivot(base, 0, WR, 0);
  body.add(part((b) => {
    b.add(rb(1.3, 0.3, 1.9, 0.04), 'wIron', { p: [0, 0, -0.3], c: ironC }); // the carriage
    b.add(rb(0.2, 0.2, 0.8, 0.03), 'wIron', { p: [0, -0.18, -0.95], c: ironC });
    // the column: a tall square body in plates, bands, a flat cap; a vent on its back, one gauge on a flank
    b.add(rb(0.85, 2.0, 0.75, 0.06), M, { p: [0, 1.15, -0.1], c: p2C });
    for (const sx of [-1, 1]) b.addBuilder(pl(0.65, 1.7, 0.06, { mat: M, c: pC, c2: p2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: sd + 9 }), { p: [sx * 0.43, 1.15, -0.1], r: [0, sx * PI / 2, 0] });
    for (const y of [0.4, 1.3, 2.05]) b.add(rb(0.92, 0.07, 0.82, 0.02), 'wIron', { p: [0, y, -0.1], c: ironC });
    b.add(rb(1.0, 0.12, 0.9, 0.03), M, { p: [0, 2.2, -0.1], c: pC });
    b.addBuilder(vent(0.5, 0.6, { frameC: DARK, glow: G, seed: sd + 10 }), { p: [0, 1.2, -0.49], r: [0, PI, 0] });
    b.addBuilder(stack(0.18, 0.5, { c: '#323230', trimC: ironC, seed: sd + 11 }), { p: [-0.25, 2.26, -0.3] });
    gauge(b, G, [0.47, 1.6, 0.1], 0.36, PI / 2);
    // the ride board: planks laid side by side across the front on two straight iron arms, an iron edge along its foot
    for (const sx of [-1, 1]) b.add(rb(0.1, 0.14, 1.0, 0.02), 'wIron', { p: [sx * 0.55, -0.2, 0.75], r: [0.25, 0, 0], c: ironC });
    for (let i = 0; i < 4; i++) b.add(rb(1.9, 0.16, 0.08, 0.02), 'wWood', { p: [0, -0.48 + i * 0.17, 1.24], c: wear('#6a5640', 0.3, i) });
    b.add(rb(1.94, 0.06, 0.1, 0.01), 'wIron', { p: [0, -0.55, 1.27], c: ironC });
    leaves(b, 0, 2.27, -0.1, 0.8, 0.7, 4); leaves(b, 0, 0.17, 1.24, 1.6, 0.05, 3, 0.07);
    dust(b, 0.3, 0.17, -0.85, 0.5, 0.3, 3);
  }, sd + 12));
  // the side arm: a shoulder block high on the right of the column, one straight arm down to a flat square tamper pad
  const arm = pivot(body, 0.55, 1.7, 0.0);
  arm.add(part((b) => {
    b.add(rb(0.26, 0.3, 0.3, 0.04), 'wIron', { c: ironC });
    b.add(rb(0.16, 1.5, 0.16, 0.03), M, { p: [0.1, -0.75, 0.2], r: [-0.15, 0, 0], c: pC });
    b.add(rb(0.48, 0.08, 0.48, 0.02), 'wIron', { p: [0.1, -1.52, 0.32], c: ironC });
    b.add(rb(0.22, 0.14, 0.22, 0.02), M, { p: [0.1, -1.42, 0.32], c: p2C });
  }, sd + 13));
  const exhaust = smoke({ rate: 2.0, life: 2.2, size: 0.38, rise: 1.0, color: 0x8a8884, opacity: 0.4, spread: 0.12 });
  exhaust.position.set(-0.25, 3.5, -0.3); body.add(exhaust);
  const dustFx = smoke({ rate: 0, life: 0.9, size: 0.5, rise: 0.1, color: 0x8a6a4a, opacity: 0.5, spread: 0.6 });
  dustFx.position.set(0.65, -0.55, 0.3); body.add(dustFx);
  const a = new Anim(root, { base, body, arm, wheels });
  a.dynamics.push(exhaust);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt; const k = Math.min(1, this.deadT / 1.2), e = 1 - Math.pow(1 - k, 3);
      p.body.rotation.x = -0.18 * e; p.arm.rotation.x = 0.5 * e; exhaust.visible = false; dustFx.visible = false;
      return;
    }
    exhaust.visible = true; dustFx.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    for (const w of p.wheels) w.rotation.x += (this.speed / WR) * dt * ts;
    p.body.rotation.x = Math.sin(this.t * 1.1) * 0.01;
    let ax = Math.sin(this.t * 0.8) * 0.04, dr = 0;
    const at = this.stepAttack(dt);
    if (at >= 0) { const up = at < 0.4 ? at / 0.4 : 1, dn = at < 0.4 ? 0 : Math.min(1, (at - 0.4) / 0.12), rec = at > 0.7 ? (at - 0.7) / 0.3 : 0; ax += (-1.1 * up + 1.5 * dn) * (1 - rec); if (dn > 0.9 && rec < 0.3) dr = 40; }
    p.arm.rotation.x = ax; dustFx.userData.rate = dr;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.body.rotation.z = Math.sin(this.t * 30) * this.hitT * 0.03; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update(dt, this.t);
    dustFx.userData.update(dt, this.t);
  };
  return finish(root, a, 3.2);
}

// ==========================================================================
// THE FALLEN STANDARD (the Clear the Rides trunk): only fresh sawdust where it is being cut; the wood draws the trunk
// ==========================================================================
export function buildFallenStandard() {
  const root = new THREE.Group();
  const g = part((b) => { dust(b, 0, 0.02, 0, 1.6, 0.9, 6); for (let i = 0; i < 4; i++) b.add(rb(0.22, 0.04, 0.12, 0.01), 'wPaint', { p: [b.r(-0.9, 0.9), 0.04, b.r(-0.5, 0.5)], r: [0, b.r(-0.3, 0.3), 0], c: LOGEND }); }, 3700);
  root.add(g);
  const a = new Anim(root, { g });
  a.update = function (dt) { this.t += dt; if (this.dead) { this.deadT += dt; } };
  return finish(root, a, 1.8);
}
