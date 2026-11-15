// Machines of the Windward Heights (Part Twelve, levels 50-55): the storm machines the Makers built to clear ice off the
// wind-scoured plateau, run wild among the stopped wind engines. Weathered grey iron (variant 0) or old bronze gone
// green at the seams (variant 1), wind-scoured bare on their weather faces, snow packed into every lee corner, rime
// feathers growing off the windward edges.
//  - Ice Plough: a tracked ice-clearing plough with a big angled moldboard blade on push arms
//  - Gale Walker: a tall narrow walker on two telescoping stilts and a rear brace strut, leaning into the wind, a single
//    flat vane board on a mast on its back, an ice-pick pole on its right side
//  - Rime Sweeper: a low four-wheeled sweeper with a solid rotating brush drum under a hood
//  - Tower Warden: a heavy armoured guard with a tall plank shield and a long square-headed winding bar
//  - The Stormplough (world boss): a huge plough engine on treads, a square wind tower on its back carrying a wind engine
//    of three broad sail-boards on a solid hub, about 14 m tall
// Same interface as the other machines: userData.machine = { update(dt, speed), attack(dur, kind), hit(), die(), revive(), stun }.
// Content rules: no faces (no head lamps, no ports, no slits; one gauge only, never a pair), no animal shapes (stilts
// telescope, they do not bend like the legs of a bird), no spokes (solid discs with an offset bolt plate), no domes,
// rings, stars or radiating patterns; the wind engine is an odd number of broad flat boards on a solid hub; towers,
// tanks and stacks are square from above; straps run in one direction only, never crossed.
import * as THREE from 'three';
import { box, rbox, cyl, cone, ico } from './kit.js';
import { plate, vent, stack, sleeve, heroTreads, crawl, wear, grime, bolts, bdisc, sub } from './bossParts.js';
import { smoke, glowSprite } from './dynamic.js';
import { slotGlow } from './slotGlow.js';
import { Anim, finish, part, pivot } from './quarryMachines.js';
import { wearModel, MOTION } from './tripoModels.js';

const PI = Math.PI;
const rb = (w, h, d, r) => rbox(w, h, d, r, 1);
const pl = (w, h, d, o = {}) => plate(w, h, d, { br: Math.max(0.032, Math.min(0.06, Math.min(w, h) * 0.05)), ...o });
// a square ram: an iron sleeve with iron collars (square and unlit, so its end never reads as an eye)
const sqRam = (r, h, c, collarC, seed) => sub((b) => {
  b.add(rb(r * 2, h, r * 2, r * 0.12), 'wIron', { c });
  for (const y of [-h / 2 + r * 0.3, h / 2 - r * 0.3]) b.add(box(r * 2.4, r * 0.5, r * 2.4), 'wIron', { p: [0, y, 0], c: collarC });
}, seed);
const SNOW = '#f2f6f8', RIME = '#dfeaf2', WOOD = '#7e6a54', WOOD2 = '#64523f', DARK = '#303234', BRISTLE = '#5c5448';

// palette per variant: 0 weathered grey iron with a warm firebox gauge; 1 old bronze, verdigris at the seams, amber gauge
function pal(v) {
  return v ? { mat: 'wBronze', paint: '#e6d6ba', paint2: '#c4ae8c', iron: '#5a5048', trim: '#b89a62', glow: 'wGlowAmber', glowHex: 0xffb040, green: true }
    : { mat: 'wPaint', paint: '#8e9296', paint2: '#717579', iron: '#55585c', trim: '#9c8c6a', glow: 'wGlowOrange', glowHex: 0xff9a40, green: false };
}
// packed snow: flattened pale lumps over a top face (on bronze, a few verdigris lumps mixed in)
function snow(b, cx, y, cz, w, d, n, s = 0.08, green = false) {
  // one continuous drift slab first (so the lumps never read as scattered dots on a dark top), then lumps on it
  if (w > s && d > s) b.add(rb(w * 0.92 + s, s * 0.5, d * 0.92 + s, s * 0.22), 'wPaint', { p: [cx, y - s * 0.05, cz], c: wear(SNOW, 0.08, n) });
  for (let i = 0; i < n; i++) {
    const g = green && i % 4 === 1;
    b.add(ico(s * b.r(0.6, 1.15), 0), g ? 'wVerdigris' : 'wPaint', { p: [cx + b.r(-w / 2, w / 2), y, cz + b.r(-d / 2, d / 2)], s: [1.7, 0.34, 1.3], r: [0, b.r(0, 3), 0], c: g ? 0xffffff : wear(SNOW, 0.1, i) });
  }
}
// rime feathers: short flat ice blades growing forward (into the wind) off a front edge from a to z
function rime(b, a, z, n, len) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1), l = len * b.r(0.5, 1.1);
    b.add(cone(len * 0.22, l, 4), 'wPaint', { p: [a[0] + (z[0] - a[0]) * t, a[1] + (z[1] - a[1]) * t, a[2] + (z[2] - a[2]) * t + l / 2], r: [PI / 2, 0, b.r(-0.3, 0.3)], s: [1, 1, 0.35], c: RIME });
  }
}
// a sight-gauge strip: one lit glass in a dark frame (always single, never a pair)
function gauge(b, glow, p, h, ry = 0) {
  b.add(rb(0.12, h + 0.08, 0.06, 0.02), 'wDark', { p, r: [0, ry, 0], c: DARK });
  b.add(box(0.05, h, 0.03), glow, { p: [p[0] + Math.sin(ry) * 0.025, p[1], p[2] + Math.cos(ry) * 0.025], r: [0, ry, 0] });
}
// A moldboard blade facing +z, centred at the origin with its cutting edge at y 0: three stacked slabs that curl
// forward at the top, a hardened cutting edge, end boards, upright stiffeners on the back (parallel, never crossed)
function moldboard(b, w, h, o) {
  const { mat, c, c2, iron, ironC, trimC, green, seed = 1 } = o;
  const t = Math.max(0.05, h * 0.06), sh = h / 3;
  const slabs = [[sh * 0.5, 0.2, 0], [sh * 1.5, -0.05, sh * 0.06], [sh * 2.5, -0.38, sh * 0.32]];
  for (const [y, rx, z] of slabs) b.add(rb(w, sh * 1.04, t, Math.min(0.03, t * 0.3)), mat, { p: [0, y, z], r: [rx, 0, 0], c });
  b.add(rb(w * 1.01, sh * 0.18, t * 1.6, 0.02), 'wMetal', { p: [0, sh * 0.08, sh * 0.06], r: [0.2, 0, 0], c: '#a8acb0' });
  bolts(b, 'wBrass', [-w / 2 + 0.15, sh * 0.12, sh * 0.06 + t], [w / 2 - 0.15, sh * 0.12, sh * 0.06 + t], Math.max(4, Math.round(w / 0.35)), Math.max(0.02, h * 0.018), 'z', trimC);
  b.add(rb(w * 1.02, sh * 0.12, t * 1.8, 0.02), iron, { p: [0, h * 0.98, sh * 0.45], c: ironC });
  for (const sx of [-1, 1]) b.add(rb(t * 1.2, h * 1.02, sh * 1.1, 0.03), iron, { p: [sx * (w / 2 + t * 0.5), h * 0.5, sh * 0.15], c: ironC });
  const n = Math.max(3, Math.round(w / 0.7));
  for (let i = 0; i < n; i++) b.add(rb(t * 1.4, h * 0.86, sh * 0.42, 0.02), iron, { p: [-w / 2 + (i + 0.5) * w / n, h * 0.47, -t - sh * 0.12], c: ironC });
  b.add(rb(w * 0.96, sh * 0.16, sh * 0.3, 0.02), mat, { p: [0, h * 0.42, -t - sh * 0.3], c: c2 });
  // snow packed against the lower face and along the top edge
  snow(b, 0, sh * 0.35, sh * 0.42, w * 0.9, sh * 0.25, Math.round(w * 4), sh * 0.32, green);
  snow(b, 0, h * 1.04, sh * 0.42, w * 0.9, sh * 0.08, Math.round(w * 2), sh * 0.16, green);
}

// ==========================================================================
// ICE PLOUGH: a tracked ice-clearing plough with a big angled blade (2.4 m tall, 3.6 m long)
// ==========================================================================
export function buildIcePlough(variant = 0) {
  const P = pal(variant === 1), M = P.mat, G = P.glow;
  const pC = wear(P.paint, 0.32, 601 + variant), p2C = wear(P.paint2, 0.3, 603), ironC = wear(P.iron, 0.25, 604), trimC = wear(P.trim, 0.3, 605);
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 1.9, len: 2.6, h: 0.7, tw: 0.44, paint: M, paintC: variant ? '#b09878' : '#5a5e62', linkC: '#5a5c60', road: 2, seed: 620 + variant });
  const HY = 0.62;
  const hull = pivot(base, 0, HY, 0);
  hull.add(part((b) => {
    // a long banded hull, riveted flank plates, a deck rail
    b.add(rb(1.5, 0.8, 2.4, 0.08), M, { p: [0, 0.4, -0.1], c: grime(P.paint2, 0.0, 0.8, 0.3, 606) });
    for (const sx of [-1, 1]) b.addBuilder(pl(2.2, 0.58, 0.08, { mat: M, c: pC, c2: p2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 607 }), { p: [sx * 0.76, 0.42, -0.1], r: [0, sx * PI / 2, 0] });
    b.add(rb(1.62, 0.1, 2.5, 0.03), 'wIron', { p: [0, 0.84, -0.1], c: ironC });
    // the push-frame pedestals at the front with brass bearings
    for (const sx of [-1, 1]) {
      b.add(rb(0.2, 0.46, 0.5, 0.04), 'wIron', { p: [sx * 0.62, 0.3, 1.1], c: ironC });
      b.add(bdisc(0.13, 0.06, 0.02, 14), 'wBrass', { p: [sx * 0.73, 0.36, 1.1], r: [0, 0, PI / 2], c: trimC });
    }
    // the blade lift ram: one square sleeve on the centre line, leaning forward off the deck (a round pair read as two eyes)
    b.addBuilder(sqRam(0.08, 0.5, '#5a5e62', ironC, 611), { p: [0, 1.02, 0.85], r: [0.9, 0, 0] });
    // the engine house at the back: flat roof, a louvred vent on its back, one square stack, one gauge
    b.add(rb(1.2, 0.72, 1.0, 0.06), M, { p: [0, 1.22, -0.6], c: pC });
    b.add(rb(1.3, 0.08, 1.1, 0.02), 'wIron', { p: [0, 1.6, -0.6], c: ironC });
    b.addBuilder(vent(0.7, 0.42, { frameC: DARK, glow: G, seed: 608 }), { p: [-0.12, 1.2, -1.12], r: [0, PI, 0] });
    b.addBuilder(stack(0.24, 0.8, { c: '#3a3c3e', trimC: ironC, seed: 609 }), { p: [0.4, 1.62, -0.85] });
    gauge(b, G, [0.62, 1.2, -0.3], 0.3, PI / 2);
    // a ballast block over the rear, a tow eye
    b.add(rb(1.3, 0.3, 0.3, 0.05), 'wIron', { p: [0, 0.6, -1.36], c: wear('#45484c', 0.3, 610) });
    b.add(rb(0.2, 0.14, 0.2, 0.03), 'wBrass', { p: [0, 0.4, -1.55], c: trimC });
    // snow drifted in the lee (rear) of the engine house, rime on its front edge
    snow(b, 0, 1.66, -0.75, 1.1, 0.6, 7, 0.09, P.green);
    snow(b, 0, 0.9, -1.1, 1.3, 0.5, 6, 0.09, P.green);
    snow(b, 0, 0.9, 0.5, 1.3, 0.9, 5, 0.07, P.green);
    rime(b, [-0.55, 1.58, -0.1], [0.55, 1.58, -0.1], 5, 0.12);
  }, 611 + variant));
  // the blade: push arms from the pedestals forward to a wide moldboard set at an angle across the front
  const blade = pivot(hull, 0, 0.36, 1.1);
  blade.add(part((b) => {
    b.add(cyl(0.06, 0.06, 1.5, 10), 'wIron', { r: [0, 0, PI / 2], c: '#7a7e84' });
    for (const sx of [-1, 1]) b.add(rb(0.14, 0.18, 0.86, 0.03), M, { p: [sx * 0.6, -0.18, 0.4], r: [0.4, 0, 0], c: p2C });
    b.add(rb(1.3, 0.14, 0.18, 0.03), 'wIron', { p: [0, -0.36, 0.8], c: ironC });
    b.addBuilder(sub((s) => moldboard(s, 2.5, 0.95, { mat: M, c: pC, c2: p2C, iron: 'wIron', ironC, trimC, green: P.green }), 612), { p: [0, -0.92, 0.98], r: [0, 0.32, 0] });
  }, 613));
  const spray = smoke({ rate: 0, life: 1.0, size: 0.7, rise: 0.9, color: 0xf4f8fa, opacity: 0.5, spread: 0.6 });
  spray.position.set(0.5, -0.4, 1.4); hull.add(spray);
  const exhaust = smoke({ rate: 2.5, life: 2.2, size: 0.45, rise: 1.0, color: 0x9a9894, opacity: 0.4, spread: 0.12 });
  exhaust.position.set(0.4, 2.5, -0.85); hull.add(exhaust);
  const glow = slotGlow(P.glowHex, 0.72, 0.44, 0.5, { ry: PI }); glow.position.set(-0.12, 1.2, -1.19); hull.add(glow);
  const a = new Anim(root, { base, hull, blade, wheels: TR.wheels });
  a.dynamics.push(exhaust, glow);
  let dist = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.1), e = 1 - Math.pow(1 - k, 3);
      p.hull.rotation.z = 0.13 * e; p.hull.rotation.x = 0.07 * e; p.hull.position.y = HY - 0.1 * e;
      p.blade.rotation.x = 0.12 * e; p.blade.rotation.z = -0.08 * e;
      exhaust.visible = false; spray.visible = false; glow.material.opacity = 0.5 * (1 - k);
      return;
    }
    exhaust.visible = true; spray.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.35) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    p.hull.position.y = HY + Math.abs(Math.sin(this.t * 6)) * 0.02 * Math.min(1, this.speed);
    p.hull.position.z = 0; p.hull.rotation.z = 0; p.hull.rotation.x = Math.sin(this.t * 1.1) * 0.005;
    let br = 0.04 + Math.sin(this.t * 0.8) * 0.02, sr = Math.min(1, this.speed / 2) * 10;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      // lift the blade on its rams, then drive it down and forward through the target
      const up = at < 0.45 ? at / 0.45 : 1, down = at < 0.45 ? 0 : Math.min(1, (at - 0.45) / 0.1), rec = at > 0.72 ? (at - 0.72) / 0.28 : 0;
      br = (-0.55 * up + 0.65 * down) * (1 - rec) + br * rec;
      p.hull.position.z = (-0.08 * up + 0.3 * down) * (1 - rec);
      if (down > 0 && rec === 0) { p.hull.rotation.x += 0.05 * Math.sin(Math.min(1, (at - 0.45) / 0.18) * PI); sr = 30; }
    }
    p.blade.rotation.x = br; p.blade.rotation.z = 0;
    spray.userData.rate = sr;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.hull.rotation.z = Math.sin(this.t * 30) * this.hitT * 0.03; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
    spray.userData.update(dt, this.t);
  };
  return finish(root, a, 2.4);
}

// ==========================================================================
// GALE WALKER: a tall narrow walker braced against the wind, a vane board on its back (5.6 m)
// ==========================================================================
export function buildGaleWalker(variant = 0) {
  const P = pal(variant === 1), M = P.mat, G = P.glow;
  const pC = wear(P.paint, 0.32, 701 + variant), p2C = wear(P.paint2, 0.3, 703), ironC = wear(P.iron, 0.25, 704), trimC = wear(P.trim, 0.3, 705), woodC = wear(WOOD, 0.3, 706), wood2C = wear(WOOD2, 0.3, 707);
  const root = new THREE.Group();
  const PY = 2.9, LEAN = 0.16;
  const pelvis = pivot(root, 0, PY, 0);
  const body = pivot(pelvis, 0, 0, 0);
  body.rotation.x = LEAN;
  body.add(part((b) => {
    // the hip girder: a short plated block carrying both stilts
    b.add(rb(1.0, 0.34, 0.6, 0.05), M, { c: grime(P.paint2, -0.2, 0.2, 0.3, 708) });
    b.addBuilder(pl(0.9, 0.28, 0.06, { mat: M, c: pC, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, inset: false, seed: 709 }), { p: [0, 0, 0.31] });
    // the tower: tall and narrow, plated front, timber-planked flanks, iron bands, a flat cap
    b.add(rb(0.74, 2.1, 0.62, 0.06), M, { p: [0, 1.25, 0], c: grime(P.paint, 0.2, 2.3, 0.3, 710) });
    for (let i = 0; i < 3; i++) b.addBuilder(pl(0.66, 0.58, 0.06, { mat: M, c: i % 2 ? pC : p2C, c2: pC, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 711 + i }), { p: [0, 0.56 + i * 0.66, 0.32] });
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) b.add(rb(0.05, 1.9, 0.2, 0.015), 'wWood', { p: [sx * 0.38, 1.25, -0.2 + i * 0.2], c: i % 2 ? wood2C : woodC });
    for (const y of [0.3, 1.0, 1.7, 2.24]) b.add(rb(0.84, 0.07, 0.72, 0.02), 'wIron', { p: [0, y, 0], c: ironC });
    b.add(rb(0.92, 0.12, 0.8, 0.03), M, { p: [0, 2.36, 0], c: p2C });
    b.add(rb(0.7, 0.16, 0.6, 0.03), 'wIron', { p: [0, 2.5, -0.02], c: ironC });
    // a ballast box low on the front (keeps it from blowing over), one gauge on the left flank
    b.add(rb(0.6, 0.36, 0.3, 0.04), 'wIron', { p: [0, 0.4, 0.5], c: wear('#45484c', 0.3, 714) });
    for (const sx of [-1, 1]) b.add(rb(0.06, 0.4, 0.34, 0.015), M, { p: [sx * 0.3, 0.4, 0.5], c: pC });
    gauge(b, G, [-0.42, 1.0, 0.1], 0.34, -PI / 2);
    // the pole mount on the right shoulder
    b.add(rb(0.2, 0.3, 0.3, 0.04), 'wIron', { p: [0.46, 1.95, 0.05], c: ironC });
    // the vane mast up the back: a square post with a bearing collar at its top
    b.add(rb(0.14, 1.6, 0.14, 0.03), 'wIron', { p: [0, 2.2, -0.4], c: ironC });
    for (const y of [1.6, 2.3]) b.add(rb(0.26, 0.12, 0.22, 0.02), 'wIron', { p: [0, y, -0.36], c: ironC });
    b.add(rb(0.22, 0.1, 0.22, 0.02), 'wBrass', { p: [0, 3.0, -0.4], c: trimC });
    // wind-scoured front, snow packed on the cap and in the lee at the back, rime feathers on the front edges
    snow(b, 0, 2.6, -0.1, 0.6, 0.5, 5, 0.08, P.green);
    snow(b, 0, 0.2, -0.25, 0.6, 0.3, 3, 0.07, P.green);
    rime(b, [-0.36, 2.3, 0.4], [0.36, 2.3, 0.4], 4, 0.14);
    rime(b, [-0.36, 1.7, 0.36], [0.36, 1.7, 0.36], 3, 0.1);
  }, 715 + variant));
  // the vane: one flat board on a short boom behind the mast, it weathercocks in the gusts
  const vane = pivot(body, 0, 2.9, -0.4);
  vane.add(part((b) => {
    b.add(rb(0.1, 0.1, 0.8, 0.02), 'wIron', { p: [0, 0, -0.4], c: ironC });
    b.add(rb(0.06, 1.0, 1.1, 0.02), 'wWood', { p: [0, 0.1, -1.2], c: woodC });
    for (const z of [-0.75, -1.65]) b.add(rb(0.09, 1.04, 0.07, 0.015), 'wIron', { p: [0, 0.1, z], c: ironC });
    b.add(rb(0.09, 0.07, 1.14, 0.015), 'wIron', { p: [0, 0.62, -1.2], c: ironC });
    b.add(rb(0.09, 0.07, 1.14, 0.015), 'wIron', { p: [0, -0.42, -1.2], c: ironC });
    bolts(b, 'wBrass', [0.05, 0.62, -0.78], [0.05, 0.62, -1.62], 3, 0.018, 'x', trimC);
  }, 716));
  // the ice-pick pole: a long iron-bound timber pole with a square iron head and a single pick
  const pole = pivot(body, 0.58, 1.95, 0.05);
  pole.add(part((b) => {
    b.add(bdisc(0.12, 0.1, 0.02, 14), 'wBrass', { r: [0, 0, PI / 2], c: trimC });
    b.add(rb(0.12, 0.14, 2.0, 0.03), 'wWood', { p: [0.06, 0, 0.95], c: woodC });
    for (const z of [0.4, 1.1, 1.7]) b.add(rb(0.16, 0.18, 0.06, 0.015), 'wIron', { p: [0.06, 0, z], c: ironC });
    b.add(rb(0.22, 0.26, 0.3, 0.03), 'wIron', { p: [0.06, 0, 2.05], c: wear('#4a4e52', 0.3, 717) });
    b.add(cone(0.07, 0.42, 4), 'wMetal', { p: [0.06, -0.3, 2.1], r: [PI, 0, 0], c: '#c4c8cc' });
    rime(b, [0.06, 0.08, 1.9], [0.06, 0.08, 1.9], 1, 0.12);
  }, 718));
  // stilts: an iron-bound timber upper with a sleeve, a sliding rod below, a broad sledge-pad foot kept level
  const legs = {};
  for (const sx of [-1, 1]) {
    const hip = pivot(pelvis, sx * 0.42, -0.04, 0);
    hip.add(part((b) => {
      b.add(bdisc(0.15, 0.13, 0.03, 16), 'wIron', { p: [sx * 0.1, 0, 0], r: [0, 0, PI / 2], c: ironC });
      b.add(rb(0.22, 0.28, 0.28, 0.04), 'wIron', { p: [0, -0.1, 0], c: ironC });
      b.add(rb(0.18, 1.42, 0.2, 0.04), 'wWood', { p: [0, -0.86, 0], c: woodC });
      for (const y of [-0.4, -0.9, -1.35]) b.add(rb(0.22, 0.07, 0.24, 0.015), 'wIron', { p: [0, y, 0], c: ironC });
      b.add(cyl(0.11, 0.11, 0.44, 12), 'wIron', { p: [0, -1.58, 0], c: '#64686e' });
      b.add(cyl(0.13, 0.13, 0.07, 12), 'wBrass', { p: [0, -1.78, 0], c: trimC });
    }, 719));
    const rod = pivot(hip, 0, -1.6, 0);
    rod.add(part((b) => b.add(cyl(0.06, 0.06, 1.4, 10), 'wMetal', { p: [0, -0.5, 0], c: '#bcc0c4' }), 720));
    const foot = pivot(rod, 0, -1.2, 0);
    foot.add(part((b) => {
      b.add(rb(0.16, 0.16, 0.16, 0.03), 'wIron', { p: [0, 0.02, 0], c: ironC });
      b.add(rb(0.44, 0.1, 0.8, 0.03), M, { p: [0, -0.06, 0.06], c: p2C });
      b.add(rb(0.48, 0.04, 0.84, 0.01), 'wIron', { p: [0, -0.12, 0.06], c: ironC });
      b.add(rb(0.44, 0.08, 0.2, 0.02), M, { p: [0, -0.04, 0.5], r: [-0.45, 0, 0], c: p2C });
      for (const z of [-0.2, 0.12, 0.36]) b.add(box(0.48, 0.04, 0.04), 'wMetal', { p: [0, -0.15, z], c: '#9aa0a6' });
      snow(b, 0, 0.0, 0.06, 0.34, 0.7, 3, 0.05);
    }, 721));
    legs[sx > 0 ? 'L' : 'R'] = { hip, rod, foot };
  }
  // the rear brace: a raking strut from the back of the hip girder to a spiked pad, set down on every stride
  const brace = pivot(pelvis, 0, -0.1, -0.32);
  brace.add(part((b) => {
    b.add(bdisc(0.12, 0.3, 0.02, 14), 'wIron', { r: [0, 0, PI / 2], c: ironC });
    b.add(rb(0.12, 0.12, 3.4, 0.03), 'wIron', { p: [0, 0, -1.7], c: wear('#55585c', 0.25, 722) });
    for (const z of [-0.7, -1.7, -2.7]) b.add(rb(0.16, 0.16, 0.06, 0.015), 'wBrass', { p: [0, 0, z], c: trimC });
    b.add(rb(0.36, 0.3, 0.08, 0.02), 'wIron', { p: [0, 0, -3.42], c: ironC });
    b.add(cone(0.05, 0.2, 4), 'wMetal', { p: [0, 0, -3.56], r: [-PI / 2, 0, 0], c: '#c0c4c8' });
  }, 723));
  const BR = -0.95;
  brace.rotation.x = BR;
  const gust = smoke({ rate: 2, life: 1.4, size: 0.5, rise: 0.2, color: 0xf2f6f8, opacity: 0.3, spread: 0.3 });
  gust.position.set(0, 2.8, -0.6); body.add(gust);
  const glow = slotGlow(P.glowHex, 0.13, 0.42, 0.5, { ry: -PI / 2 }); glow.position.set(-0.47, 1.0, 0.1); body.add(glow);
  const a = new Anim(root, { pelvis, body, vane, pole, brace, legs });
  a.dynamics.push(gust, glow);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.4), e = k * k;
      // the wind wins: one stilt folds and it goes over backwards onto its brace, then down
      p.pelvis.position.y = PY - 2.2 * e; p.pelvis.rotation.x = -0.9 * e; p.pelvis.rotation.z = 0.25 * e;
      p.legs.R.hip.rotation.x = -0.8 * e; p.legs.L.hip.rotation.x = -0.5 * e; p.legs.L.rod.position.y = -1.6 + 0.6 * e;
      p.brace.rotation.x = BR - 0.4 * e; p.pole.rotation.x = 0.9 * e; p.vane.rotation.y = 0.6 * e;
      gust.visible = false; glow.material.opacity = 0.5 * (1 - k);
      return;
    }
    gust.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    const sk = Math.min(1, this.speed / 2.5);
    this.phase = ((this.phase || 0) + this.speed * dt * 0.24 * ts) % 1;
    const ph = this.phase * PI * 2, swing = Math.sin(ph) * 0.3 * sk;
    p.legs.L.hip.rotation.x = -swing; p.legs.R.hip.rotation.x = swing;
    p.legs.L.rod.position.y = -1.6 + Math.max(0, Math.cos(ph)) * 0.3 * sk;
    p.legs.R.rod.position.y = -1.6 + Math.max(0, -Math.cos(ph)) * 0.3 * sk;
    for (const L of [p.legs.L, p.legs.R]) L.foot.rotation.x = -L.hip.rotation.x;
    // the brace lifts and swings forward twice a cycle, set down between strides
    p.brace.rotation.x = BR - Math.max(0, Math.sin(ph * 2)) * 0.18 * sk;
    p.pelvis.position.y = PY - (1 - Math.abs(Math.cos(ph))) * 0.06 * sk + Math.sin(this.t * 1.3) * 0.015;
    p.pelvis.rotation.z = Math.sin(ph) * 0.05 * sk; p.pelvis.rotation.x = 0;
    // it shudders in the gusts and the vane weathercocks
    const g = Math.sin(this.t * 0.9) * 0.6 + Math.sin(this.t * 2.3) * 0.4;
    p.body.rotation.x = LEAN + g * 0.015; p.body.rotation.y = Math.sin(ph) * 0.05 * sk;
    p.vane.rotation.y = g * 0.35;
    let px = 0.85 + Math.sin(this.t * 0.7) * 0.04;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      // swing the pick pole high, then chop it down onto the target
      const up = at < 0.45 ? at / 0.45 : 1, down = at < 0.45 ? 0 : Math.min(1, (at - 0.45) / 0.12), rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
      px = px + (-1.5 * up + 1.95 * down) * (1 - rec);
      p.body.rotation.x += (-0.08 * up + 0.14 * down) * (1 - rec);
    }
    p.pole.rotation.x = px;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.body.rotation.x -= this.hitT * 0.12; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  return finish(root, a, 5.6);
}

// ==========================================================================
// RIME SWEEPER: a low sweeper with a solid rotating brush drum (1.7 m tall, 2.9 m long)
// ==========================================================================
export function buildRimeSweeper(variant = 0) {
  const P = pal(variant === 1), M = P.mat, G = P.glow;
  const pC = wear(P.paint, 0.32, 801 + variant), p2C = wear(P.paint2, 0.3, 803), ironC = wear(P.iron, 0.25, 804), trimC = wear(P.trim, 0.3, 805);
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const HY = 0.42;
  const hull = pivot(base, 0, HY, 0);
  hull.add(part((b) => {
    // a low wedge hull, riveted flank plates, a skid plate underneath
    b.add(rb(1.3, 0.5, 1.9, 0.08), M, { p: [0, 0.2, -0.15], c: grime(P.paint2, -0.05, 0.45, 0.3, 806) });
    for (const sx of [-1, 1]) b.addBuilder(pl(1.7, 0.4, 0.07, { mat: M, c: pC, c2: p2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 807 }), { p: [sx * 0.66, 0.2, -0.15], r: [0, sx * PI / 2, 0] });
    b.add(rb(1.2, 0.06, 1.8, 0.02), 'wIron', { p: [0, -0.07, -0.15], c: ironC });
    b.add(rb(1.4, 0.08, 2.0, 0.02), 'wIron', { p: [0, 0.47, -0.15], c: ironC });
    // axle housings for the four solid wheels
    for (const z of [0.45, -0.85]) b.add(rb(1.5, 0.14, 0.18, 0.03), 'wIron', { p: [0, 0.0, z], c: ironC });
    // the engine hood at the back: a flat-topped box, a louvred vent on its back, a short square stack, one gauge
    b.add(rb(1.0, 0.5, 0.9, 0.06), M, { p: [0, 0.74, -0.6], c: pC });
    b.add(rb(1.08, 0.07, 0.98, 0.02), 'wIron', { p: [0, 1.0, -0.6], c: ironC });
    b.addBuilder(vent(0.6, 0.32, { frameC: DARK, glow: G, seed: 808 }), { p: [0, 0.72, -1.06], r: [0, PI, 0] });
    b.addBuilder(stack(0.2, 0.55, { c: '#3a3c3e', trimC: ironC, seed: 809 }), { p: [-0.32, 1.02, -0.8] });
    gauge(b, G, [0.51, 0.74, -0.45], 0.26, PI / 2);
    // the brush arms' bearing blocks on the front deck
    for (const sx of [-1, 1]) b.add(rb(0.14, 0.3, 0.3, 0.03), 'wIron', { p: [sx * 0.6, 0.55, 0.62], c: ironC });
    // a hopper on the mid-deck for swept ice, open-topped, rimed
    b.add(rb(0.9, 0.34, 0.6, 0.04), M, { p: [0, 0.66, 0.1], c: p2C });
    b.add(box(0.8, 0.04, 0.5), 'wPaint', { p: [0, 0.8, 0.1], c: RIME });
    snow(b, 0, 0.82, 0.1, 0.7, 0.4, 5, 0.07, P.green);
    snow(b, 0, 1.04, -0.75, 0.9, 0.4, 5, 0.07, P.green);
    rime(b, [-0.62, 0.48, 0.8], [0.62, 0.48, 0.8], 5, 0.1);
  }, 810 + variant));
  // four solid wheels: plain bevelled discs with a square axle nut and an offset bolt plate (no inner disc in a ring)
  const wheels = [];
  for (const z of [0.45, -0.85]) for (const sx of [-1, 1]) {
    const w = pivot(hull, sx * 0.78, 0.0, z);
    w.add(part((b) => {
      b.add(bdisc(0.36, 0.2, 0.04, 22), 'wDark', { r: [0, 0, PI / 2], c: '#3c3e40' });
      b.add(rb(0.24, 0.1, 0.1, 0.015), 'wIron', { c: ironC });
      b.add(rb(0.06, 0.12, 0.1, 0.02), 'wBrass', { p: [sx * 0.13, 0.1, 0], c: trimC });
    }, 811));
    wheels.push(w);
  }
  // the brush carrier: two arms from the bearing blocks forward to the drum, a hood over the drum
  const carrier = pivot(hull, 0, 0.55, 0.62);
  carrier.add(part((b) => {
    b.add(cyl(0.05, 0.05, 1.3, 10), 'wIron', { r: [0, 0, PI / 2], c: '#7a7e84' });
    for (const sx of [-1, 1]) b.add(rb(0.1, 0.14, 0.7, 0.03), M, { p: [sx * 0.76, -0.12, 0.3], r: [0.35, 0, 0], c: p2C });
    for (const sx of [-1, 1]) b.add(rb(0.08, 0.5, 0.5, 0.02), 'wIron', { p: [sx * 0.84, -0.35, 0.62], c: ironC });
    // the hood: two flat plates bent over the top and front of the drum
    b.add(rb(1.7, 0.06, 0.6, 0.02), M, { p: [0, 0.02, 0.58], c: pC });
    b.add(rb(1.7, 0.4, 0.06, 0.02), M, { p: [0, -0.12, 0.9], r: [-0.35, 0, 0], c: pC });
    b.add(rb(1.74, 0.06, 0.08, 0.015), 'wIron', { p: [0, 0.06, 0.3], c: ironC });
    bolts(b, 'wBrass', [-0.7, 0.06, 0.88], [0.7, 0.06, 0.88], 5, 0.018, 'y', trimC);
    snow(b, 0, 0.07, 0.6, 1.5, 0.4, 6, 0.07, P.green);
  }, 812));
  // the brush drum: a solid bristle roller with iron bands and end discs; a low helical seam shows it turning
  const drum = pivot(carrier, 0, -0.4, 0.62);
  drum.add(part((b) => {
    b.add(cyl(0.34, 0.34, 1.5, 22), 'wLeather', { r: [0, 0, PI / 2], c: wear(BRISTLE, 0.3, 813) });
    for (const x of [-0.5, 0, 0.5]) b.add(cyl(0.345, 0.345, 0.06, 22), 'wIron', { p: [x, 0, 0], r: [0, 0, PI / 2], c: '#4a4c50' });
    for (const sx of [-1, 1]) b.add(bdisc(0.3, 0.05, 0.015, 18), 'wIron', { p: [sx * 0.77, 0, 0], r: [0, 0, PI / 2], c: ironC });
    for (let i = 0; i < 10; i++) { const t = i / 9, a = t * PI * 1.4; b.add(rb(0.12, 0.03, 0.08, 0.01), 'wLeather', { p: [-0.7 + t * 1.4, Math.cos(a) * 0.34, Math.sin(a) * 0.34], r: [a, 0, 0], c: '#6c6254' }); }
    b.add(rb(0.06, 0.08, 0.14, 0.02), 'wBrass', { p: [0.8, 0.12, 0], c: trimC });
  }, 814));
  const spray = smoke({ rate: 0, life: 0.9, size: 0.6, rise: 0.8, color: 0xf4f8fa, opacity: 0.5, spread: 0.5 });
  spray.position.set(0, -0.3, 1.3); carrier.add(spray);
  const exhaust = smoke({ rate: 2, life: 2.0, size: 0.38, rise: 0.9, color: 0x9a9894, opacity: 0.4, spread: 0.1 });
  exhaust.position.set(-0.32, 1.7, -0.8); hull.add(exhaust);
  const glow = slotGlow(P.glowHex, 0.62, 0.34, 0.5, { ry: PI }); glow.position.set(0, 0.72, -1.13); hull.add(glow);
  const a = new Anim(root, { base, hull, carrier, drum, wheels });
  a.dynamics.push(exhaust, glow);
  let spin = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.0), e = 1 - Math.pow(1 - k, 3);
      p.hull.rotation.z = -0.12 * e; p.hull.rotation.x = 0.1 * e; p.hull.position.y = HY - 0.12 * e;
      p.carrier.rotation.x = 0.25 * e;
      exhaust.visible = false; spray.visible = false; glow.material.opacity = 0.5 * (1 - k);
      return;
    }
    exhaust.visible = true; spray.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.36) * dt * ts;
    p.hull.position.y = HY + Math.abs(Math.sin(this.t * 7)) * 0.015 * Math.min(1, this.speed);
    p.hull.position.z = 0; p.hull.rotation.z = 0; p.hull.rotation.x = Math.sin(this.t * 1.3) * 0.006;
    let cr = 0.02, sp = 3 + this.speed * 3, sr = Math.min(1, this.speed / 2) * 8;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      // rev the brush up, then lunge and grind it down into the target
      const rev = at < 0.4 ? at / 0.4 : 1, hit = at < 0.4 ? 0 : Math.min(1, (at - 0.4) / 0.12), rec = at > 0.72 ? (at - 0.72) / 0.28 : 0;
      sp += 18 * rev * (1 - rec);
      cr = (-0.3 * rev + 0.42 * hit) * (1 - rec) + 0.02 * rec;
      p.hull.position.z = (-0.06 * rev + 0.32 * hit) * (1 - rec);
      if (hit > 0 && rec === 0) sr = 28;
    }
    spin -= sp * dt * ts; p.drum.rotation.x = spin;
    p.carrier.rotation.x = cr;
    spray.userData.rate = sr;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.hull.rotation.z = Math.sin(this.t * 30) * this.hitT * 0.03; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
    spray.userData.update(dt, this.t);
  };
  return finish(root, a, 1.7);
}

// ==========================================================================
// TOWER WARDEN: a heavy armoured guard with a plank shield and a winding bar (3.3 m)
// ==========================================================================
export function buildTowerWarden(variant = 0) {
  const P = pal(variant === 1), M = P.mat, G = P.glow;
  const pC = wear(P.paint, 0.32, 901 + variant), p2C = wear(P.paint2, 0.3, 903), ironC = wear(P.iron, 0.25, 904), trimC = wear(P.trim, 0.3, 905), woodC = wear(WOOD, 0.3, 906), wood2C = wear(WOOD2, 0.3, 907);
  const root = new THREE.Group();
  const PY = 1.42;
  const pelvis = pivot(root, 0, PY, 0);
  const torso = pivot(pelvis, 0, 0.1, 0);
  torso.add(part((b) => {
    // a deep barrel-chested hull, squared off
    b.add(rb(1.2, 1.1, 0.86, 0.1), M, { p: [0, 0.6, 0], c: grime(P.paint, 0.0, 0.9, 0.3, 908) });
    // one broad plain breastplate, tilted back a little, with horizontal straps only (nothing crossed, no openings)
    b.add(rb(1.06, 0.92, 0.1, 0.04), M, { p: [0, 0.62, 0.45], r: [-0.06, 0, 0], c: pC });
    for (const y of [0.32, 0.72]) b.add(rb(1.1, 0.07, 0.06, 0.02), 'wIron', { p: [0, y, 0.51], r: [-0.06, 0, 0], c: ironC });
    bolts(b, 'wBrass', [-0.42, 0.32, 0.55], [0.42, 0.32, 0.55], 5, 0.02, 'z', trimC);
    b.add(rb(1.1, 0.08, 0.16, 0.02), 'wIron', { p: [0, 1.06, 0.45], c: ironC });
    for (const sx of [-1, 1]) b.addBuilder(pl(0.7, 0.82, 0.08, { mat: M, c: p2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 909, lips: false, sideLips: true }), { p: [sx * 0.62, 0.6, 0], r: [0, sx * PI / 2, 0] });
    gauge(b, G, [-0.67, 0.36, 0.14], 0.3, -PI / 2);
    // the cowl in place of a head: a stepped, flat-topped plated block set low between the shoulders, no openings
    b.add(rb(1.3, 0.14, 0.94, 0.04), 'wIron', { p: [0, 1.18, 0], c: ironC });
    b.add(rb(0.8, 0.34, 0.62, 0.06), M, { p: [0, 1.4, -0.04], c: pC });
    b.add(rb(0.88, 0.08, 0.7, 0.02), 'wIron', { p: [0, 1.6, -0.04], c: ironC });
    b.add(rb(0.62, 0.1, 0.5, 0.02), M, { p: [0, 1.68, -0.06], c: p2C });
    b.add(rb(0.76, 0.24, 0.06, 0.02), M, { p: [0, 1.38, 0.29], r: [-0.22, 0, 0], c: p2C });
    // waist and a skirt of three broad plates
    b.add(rb(0.98, 0.16, 0.78, 0.04), 'wIron', { p: [0, 0.02, 0], c: ironC });
    b.add(rb(0.86, 0.14, 0.68, 0.03), 'wDark', { p: [0, -0.1, 0], c: DARK });
    for (const sx of [-1, 0, 1]) b.add(rb(0.34, 0.36, 0.06, 0.02), M, { p: [sx * 0.34, -0.22, 0.4], r: [-0.12, 0, 0], c: sx ? p2C : pC });
    // back: a tall square boiler with banding and a flat cap, two pipes into the shoulders
    b.add(rb(0.84, 1.0, 0.4, 0.06), M, { p: [0, 0.7, -0.6], c: p2C });
    for (const y of [0.34, 0.74, 1.1]) b.add(rb(0.88, 0.06, 0.44, 0.02), 'wIron', { p: [0, y, -0.6], c: ironC });
    b.add(rb(0.9, 0.08, 0.46, 0.02), M, { p: [0, 1.24, -0.6], c: pC });
    for (const sx of [-1, 1]) b.add(cyl(0.05, 0.05, 0.6, 8), 'wCopper', { p: [sx * 0.48, 1.0, -0.36], r: [0.9, 0, 0], c: 0xffffff });
    // shoulder bearings
    for (const sx of [-1, 1]) {
      b.add(bdisc(0.19, 0.08, 0.02, 18), 'wIron', { p: [sx * 0.64, 0.92, 0], r: [0, 0, PI / 2], c: ironC });
      b.add(rb(0.04, 0.1, 0.07, 0.01), 'wBrass', { p: [sx * 0.69, 1.0, 0], c: trimC });
    }
    snow(b, 0, 1.26, -0.3, 1.1, 0.4, 6, 0.09, P.green);
    snow(b, 0, 1.73, -0.06, 0.55, 0.4, 3, 0.06, P.green);
    snow(b, 0, 1.29, -0.6, 0.7, 0.3, 4, 0.07, P.green);
    rime(b, [-0.5, 1.1, 0.53], [0.5, 1.1, 0.53], 5, 0.12);
    rime(b, [-0.36, 1.62, 0.3], [0.36, 1.62, 0.3], 3, 0.1);
  }, 910 + variant));
  // arms: right (sx -1) the winding bar, left the plank shield
  const arms = {};
  for (const sx of [-1, 1]) {
    const sh = pivot(torso, sx * 0.78, 0.92, 0);
    sh.add(part((b) => {
      b.add(rb(0.32, 0.32, 0.32, 0.08), 'wIron', { c: ironC });
      // squared pauldron: a flat top plate and a stepped side plate
      b.add(rb(0.5, 0.1, 0.56, 0.03), M, { p: [sx * 0.05, 0.2, 0], c: pC });
      b.add(rb(0.1, 0.36, 0.52, 0.03), M, { p: [sx * 0.27, 0.04, 0], c: p2C });
      bolts(b, 'wBrass', [sx * 0.05, 0.26, -0.2], [sx * 0.05, 0.26, 0.2], 3, 0.017, 'y', trimC);
      snow(b, sx * 0.04, 0.26, 0, 0.32, 0.44, 3, 0.07, P.green);
      b.add(rb(0.24, 0.54, 0.26, 0.05), M, { p: [0, -0.34, 0], c: p2C });
      b.add(cyl(0.03, 0.03, 0.44, 8), 'wIron', { p: [sx * 0.13, -0.32, 0.06], c: '#9aa0a6' });
    }, 911));
    const el = pivot(sh, 0, -0.66, 0);
    el.add(part((b) => {
      b.add(rb(0.23, 0.23, 0.23, 0.06), 'wIron', { c: ironC });
      b.add(rb(0.26, 0.52, 0.28, 0.05), M, { p: [0, -0.3, 0], c: pC });
      b.add(rb(0.29, 0.12, 0.31, 0.03), 'wIron', { p: [0, -0.1, 0], c: ironC });
      if (sx < 0) {
        // the winding bar: a long iron bar held at the grip, a square socket head at its far end, a counter-block behind
        b.add(rb(0.16, 0.16, 0.18, 0.03), 'wIron', { p: [0, -0.6, 0.02], c: ironC });
        b.add(rb(0.08, 0.08, 1.9, 0.02), 'wIron', { p: [0, -0.6, 0.6], c: '#5a5e62' });
        for (const z of [0.4, 0.9]) b.add(rb(0.11, 0.11, 0.06, 0.015), 'wBrass', { p: [0, -0.6, z], c: trimC });
        b.add(rb(0.36, 0.36, 0.42, 0.05), 'wIron', { p: [0, -0.6, 1.62], c: wear('#4a4e52', 0.3, 912) });
        b.add(rb(0.4, 0.06, 0.46, 0.015), M, { p: [0, -0.4, 1.62], c: pC });
        b.add(rb(0.4, 0.06, 0.46, 0.015), M, { p: [0, -0.8, 1.62], c: pC });
        b.add(rb(0.2, 0.2, 0.06, 0.02), 'wDark', { p: [0, -0.6, 1.85], c: DARK });
        b.add(rb(0.2, 0.2, 0.24, 0.03), 'wIron', { p: [0, -0.6, -0.42], c: ironC });
        rime(b, [0, -0.42, 1.82], [0, -0.42, 1.82], 1, 0.1);
      } else {
        // the shield: a tall board of upright planks with horizontal iron bands and a rim
        for (let i = 0; i < 4; i++) b.add(rb(0.07, 1.3, 0.2, 0.015), 'wWood', { p: [0.17, -0.45, -0.3 + i * 0.2], c: i % 2 ? wood2C : woodC });
        for (const y of [-0.02, -0.45, -0.88]) b.add(rb(0.1, 0.07, 0.84, 0.015), 'wIron', { p: [0.21, y, 0], c: ironC });
        b.add(rb(0.1, 1.36, 0.06, 0.015), 'wIron', { p: [0.2, -0.45, -0.42], c: ironC });
        b.add(rb(0.1, 1.36, 0.06, 0.015), 'wIron', { p: [0.2, -0.45, 0.42], c: ironC });
        bolts(b, 'wBrass', [0.27, -0.02, -0.32], [0.27, -0.02, 0.32], 4, 0.018, 'x', trimC);
        bolts(b, 'wBrass', [0.27, -0.88, -0.32], [0.27, -0.88, 0.32], 4, 0.018, 'x', trimC);
        snow(b, 0.17, 0.22, 0, 0.08, 0.7, 3, 0.06, P.green);
      }
    }, 913 + (sx > 0 ? 1 : 0)));
    arms[sx < 0 ? 'R' : 'L'] = { sh, el };
  }
  const legs = {};
  for (const sx of [-1, 1]) {
    const hip = pivot(pelvis, sx * 0.32, -0.05, 0);
    hip.add(part((b) => {
      b.add(rb(0.28, 0.28, 0.28, 0.07), 'wIron', { c: ironC });
      b.add(rb(0.26, 0.6, 0.3, 0.05), M, { p: [0, -0.33, 0], c: pC });
      b.add(rb(0.28, 0.22, 0.06, 0.02), M, { p: [0, -0.22, 0.15], c: p2C });
      b.add(cyl(0.05, 0.05, 0.24, 10), 'wIron', { p: [sx * 0.17, -0.2, -0.05], c: '#3a3e44' });
    }, 915));
    const ram = pivot(hip, sx * 0.17, -0.45, -0.05);
    ram.add(part((b) => b.add(cyl(0.028, 0.028, 0.3, 8), 'wIron', { c: '#a8acb4' }), 916));
    const knee = pivot(hip, 0, -0.66, 0);
    knee.add(part((b) => {
      b.add(rb(0.23, 0.23, 0.23, 0.06), 'wIron', { c: ironC });
      b.add(rb(0.24, 0.56, 0.28, 0.05), M, { p: [0, -0.3, 0], c: grime(P.paint, -0.6, -0.1, 0.35, 917) });
      b.add(rb(0.28, 0.18, 0.08, 0.02), M, { p: [0, -0.06, 0.15], r: [-0.2, 0, 0], c: p2C });
      b.add(rb(0.44, 0.14, 0.64, 0.04), 'wDark', { p: [0, -0.62, 0.08], c: DARK });
      b.add(rb(0.4, 0.07, 0.18, 0.02), 'wIron', { p: [0, -0.54, 0.35], r: [0.3, 0, 0], c: ironC });
      b.add(cyl(0.03, 0.03, 0.4, 8), 'wIron', { p: [0, -0.3, -0.16], c: '#a8acb4' });
      snow(b, 0, -0.54, 0.08, 0.3, 0.44, 3, 0.06, P.green);
    }, 918));
    legs[sx > 0 ? 'L' : 'R'] = { hip, knee, ram };
  }
  const steam = smoke({ rate: 2, life: 2.0, size: 0.45, rise: 0.8, color: 0xeef2f4, opacity: 0.35 });
  steam.position.set(0, 1.4, -0.6); torso.add(steam);
  const glow = slotGlow(P.glowHex, 0.13, 0.38, 0.5, { ry: -PI / 2 }); glow.position.set(-0.72, 0.36, 0.14); torso.add(glow);
  const a = new Anim(root, { pelvis, torso, arms, legs });
  a.dynamics.push(steam, glow);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.1), e = 1 - Math.pow(1 - k, 3);
      p.pelvis.position.y = PY - 0.9 * e; p.pelvis.rotation.x = 0.25 * e; p.torso.rotation.x = 0.85 * e;
      p.legs.L.hip.rotation.x = -1.25 * e; p.legs.L.knee.rotation.x = 1.9 * e; p.legs.R.hip.rotation.x = -0.95 * e; p.legs.R.knee.rotation.x = 1.6 * e;
      p.arms.R.sh.rotation.x = -0.4 * e; p.arms.L.sh.rotation.z = 0.6 * e;
      steam.visible = false; glow.material.opacity = 0.5 * (1 - k);
      return;
    }
    steam.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 6);
    const sk = Math.min(1, this.speed / 2.5);
    this.phase = ((this.phase || 0) + this.speed * dt * 0.38 * ts) % 1;
    const ph = this.phase * PI * 2, swing = Math.sin(ph) * 0.52 * sk;
    p.legs.L.hip.rotation.x = -swing; p.legs.R.hip.rotation.x = swing;
    p.legs.L.knee.rotation.x = Math.max(0, Math.cos(ph)) * 0.9 * sk + 0.05;
    p.legs.R.knee.rotation.x = Math.max(0, -Math.cos(ph)) * 0.9 * sk + 0.05;
    for (const L of [p.legs.L, p.legs.R]) L.ram.position.y = -0.45 - L.knee.rotation.x * 0.07;
    p.pelvis.position.y = PY - (1 - Math.abs(Math.sin(ph))) * 0.07 * sk + Math.sin(this.t * 1.5) * 0.015;
    p.pelvis.rotation.x = 0; p.pelvis.rotation.z = Math.sin(ph) * 0.06 * sk;
    p.torso.rotation.y = Math.sin(ph) * 0.1 * sk + Math.sin(this.t * 0.6) * 0.1 * (1 - sk);
    p.arms.R.sh.rotation.x = swing * 0.5 + 0.1; p.arms.L.sh.rotation.x = -swing * 0.5 - 0.25;
    p.arms.R.el.rotation.x = -0.35; p.arms.L.el.rotation.x = -0.85; p.arms.L.sh.rotation.z = 0.12; p.arms.R.sh.rotation.z = 0;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      if (this.atkKind === 'slam') {
        // shield bash: the plank shield punched forward
        const back = at < 0.4 ? at / 0.4 : 1, hit = at < 0.4 ? 0 : Math.min(1, (at - 0.4) / 0.12), rec = at > 0.65 ? (at - 0.65) / 0.35 : 0;
        p.arms.L.sh.rotation.x += (0.4 * back - 1.3 * hit) * (1 - rec); p.arms.L.el.rotation.x += (-0.3 * back + 0.8 * hit) * (1 - rec);
        p.torso.rotation.y += (-0.3 * back + 0.5 * hit) * (1 - rec);
      } else {
        // the winding bar brought up over the shoulder and down hard
        const up = at < 0.45 ? at / 0.45 : 1, down = at < 0.45 ? 0 : Math.min(1, (at - 0.45) / 0.12), rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
        p.arms.R.sh.rotation.x = (-2.4 * up + 2.9 * down) * (1 - rec) + 0.1 * rec;
        p.arms.R.el.rotation.x = (-0.7 * up + 0.6 * down) * (1 - rec) - 0.35;
        p.torso.rotation.x = (-0.15 * up + 0.4 * down) * (1 - rec);
        p.pelvis.position.y -= 0.12 * down * (1 - rec);
      }
    } else p.torso.rotation.x = Math.sin(this.t * 1.2) * 0.02;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.torso.rotation.x -= this.hitT * 0.22; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  return finish(root, a, 3.3);
}

// ==========================================================================
// THE STORMPLOUGH (world boss): a wind-driven plough engine on treads, about 14 m tall and 15 m long
// ==========================================================================
export function buildStormplough() {
  const P = pal(false), M = P.mat, G = P.glow;
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 7.2, len: 12.4, h: 2.3, tw: 1.6, paintC: '#56595c', linkC: '#5a5c60', road: 3, seed: 1020 });
  const body = pivot(base, 0, 0, 0);
  const hullC = grime('#a2a6aa', 1.8, 4.6, 0.3, 1001), hull2C = wear(P.paint2, 0.3, 1002), ironC = wear(P.iron, 0.25, 1003), trimC = wear(P.trim, 0.3, 1004), woodC = wear(WOOD, 0.3, 1005), wood2C = wear(WOOD2, 0.3, 1006), darkC = wear(DARK, 0.25, 1007);
  const TZ = -3.6, TB = 4.7, TT = 9.3, HUBY = 10.2, HUBZ = TZ - 1.9; // the wind tower line, its base and top, the hub
  body.add(part((b) => {
    // the hull: a heavy plated core, four plates a flank, a skirt band and a deck
    b.add(rb(5.8, 2.7, 11.2, 0.14), M, { p: [0, 3.25, -0.3], c: hullC });
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 4; i++) b.addBuilder(pl(2.5, 1.3, 0.14, { mat: M, c: wear(i % 2 ? P.paint : '#7c8084', 0.3, i * 3 + sx), c2: hull2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 1008 + i }), { p: [sx * 2.96, 3.75, -4.1 + i * 2.7], r: [0, sx * PI / 2, 0] });
      b.addBuilder(pl(11.0, 0.6, 0.14, { mat: M, c: darkC, inset: false, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 1012 }), { p: [sx * 2.96, 2.35, -0.3], r: [0, sx * PI / 2, 0] });
      b.add(box(0.06, 0.1, 10.4), G, { p: [sx * 2.95, 2.85, -0.3] });
    }
    b.add(rb(6.2, 0.22, 11.6, 0.05), 'wIron', { p: [0, TB - 0.1, -0.3], c: ironC });
    for (const sx of [-1, 1]) b.add(box(0.12, 0.12, 11.6), 'wBrass', { p: [sx * 3.1, TB + 0.03, -0.3], c: trimC });
    // the push frame at the front: two heavy beams and the lift rams
    for (const sx of [-1, 1]) {
      b.add(rb(0.7, 1.4, 1.6, 0.08), 'wIron', { p: [sx * 2.4, 2.4, 5.6], c: ironC });
      b.add(bdisc(0.5, 0.2, 0.08, 18), 'wBrass', { p: [sx * 2.8, 2.2, 6.0], r: [0, 0, PI / 2], c: trimC });
    }
    // one square lift ram on the centre line (a round pair read as two eyes from the front)
    b.addBuilder(sqRam(0.34, 2.0, wear('#585c60', 0.25, 5), ironC, 1025), { p: [0, 5.2, 5.0], r: [0.85, 0, 0] });
    // the engine house amidships: flat roof, louvred vents on each flank, two square stacks, one gauge
    b.add(rb(4.6, 3.0, 4.4, 0.12), M, { p: [0, TB + 1.5, 2.0], c: grime(P.paint2, TB, TB + 3, 0.3, 1013) });
    b.add(rb(4.9, 0.2, 4.7, 0.05), 'wIron', { p: [0, TB + 3.05, 2.0], c: ironC });
    for (const y of [TB + 0.6, TB + 2.2]) b.add(rb(4.7, 0.14, 4.5, 0.04), 'wIron', { p: [0, y, 2.0], c: ironC });
    for (const sx of [-1, 1]) b.addBuilder(vent(2.4, 1.0, { frameC: darkC, glow: G, seed: 1014 }), { p: [sx * 2.32, TB + 1.4, 2.0], r: [0, sx * PI / 2, 0] });
    b.addBuilder(pl(3.6, 1.2, 0.12, { mat: M, c: hullC, c2: hull2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 1015 }), { p: [0, TB + 1.4, 4.24] });
    b.addBuilder(stack(0.9, 2.8, { c: '#38393b', trimC: ironC, seed: 1016 }), { p: [1.3, TB + 3.1, 0.9] });
    gauge(b, G, [-2.33, TB + 2.4, 3.4], 0.9, -PI / 2);
    // the wind tower on the rear deck: square, four corner posts, planked faces, iron bands, a flat cap house
    b.add(rb(2.2, TT - TB, 2.2, 0.1), M, { p: [0, (TB + TT) / 2, TZ], c: grime(P.paint, TB, TT, 0.3, 1017) });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(rb(0.36, TT - TB + 0.2, 0.36, 0.05), 'wIron', { p: [sx * 1.15, (TB + TT) / 2, TZ + sz * 1.15], c: ironC });
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) b.add(rb(0.08, TT - TB - 0.6, 0.42, 0.02), 'wWood', { p: [sx * 1.12, (TB + TT) / 2, TZ - 0.75 + i * 0.5], c: i % 2 ? wood2C : woodC });
    for (const y of [TB + 0.8, TB + 2.3, TB + 3.8]) b.add(rb(2.6, 0.18, 2.6, 0.04), 'wIron', { p: [0, y, TZ], c: ironC });
    // the cap house: a flat-topped box, its long axis fore-and-aft, bearing the main shaft out of its back
    b.add(rb(2.9, 1.7, 3.6, 0.1), M, { p: [0, HUBY, TZ - 0.1], c: hull2C });
    b.add(rb(3.1, 0.2, 3.8, 0.05), 'wIron', { p: [0, HUBY + 0.95, TZ - 0.1], c: ironC });
    b.add(rb(3.0, 0.18, 3.7, 0.05), 'wIron', { p: [0, HUBY - 0.92, TZ - 0.1], c: ironC });
    b.addBuilder(pl(3.2, 1.2, 0.12, { mat: M, c: hullC, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 1018 }), { p: [1.48, HUBY, TZ - 0.1], r: [0, PI / 2, 0] });
    b.addBuilder(pl(3.2, 1.2, 0.12, { mat: M, c: hullC, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 1019 }), { p: [-1.48, HUBY, TZ - 0.1], r: [0, -PI / 2, 0] });
    b.add(rb(1.0, 1.0, 0.5, 0.06), 'wIron', { p: [0, HUBY, TZ - 1.95], c: ironC });
    b.add(cyl(0.3, 0.3, 0.8, 14), 'wIron', { p: [0, HUBY, TZ - 2.2], r: [PI / 2, 0, 0], c: '#6a6e74' });
    // the drive shaft down the tower's front face into the engine house, in a square casing
    b.add(rb(0.5, TT - TB, 0.5, 0.05), 'wIron', { p: [0, (TB + TT) / 2, TZ + 1.4], c: wear('#4c5054', 0.25, 1021) });
    b.add(rb(1.2, 0.8, 2.6, 0.06), 'wIron', { p: [0, TB + 0.4, TZ + 2.3], c: ironC });
    // the coal and ballast bins at the stern
    b.add(rb(5.0, 1.0, 1.4, 0.08), M, { p: [0, TB + 0.5, -5.4], c: hull2C });
    b.add(box(4.6, 0.08, 1.1), 'wDark', { p: [0, TB + 0.98, -5.4], c: darkC });
    // packed snow in every lee (the rear faces and tops), rime feathers on the front edges
    snow(b, -0.6, TB + 3.2, 2.3, 3.0, 3.6, 12, 0.24);
    snow(b, 0, TB + 1.05, -5.4, 4.6, 1.0, 8, 0.2);
    snow(b, 0, HUBY + 1.08, TZ - 0.1, 2.8, 3.4, 10, 0.2);
    for (const sx of [-1, 1]) snow(b, sx * 2.6, TB + 0.05, 4.4, 0.8, 1.6, 4, 0.18);
    rime(b, [-2.3, TB + 3.0, 4.25], [2.3, TB + 3.0, 4.25], 9, 0.3);
    rime(b, [-1.45, HUBY + 0.85, TZ + 1.7], [1.45, HUBY + 0.85, TZ + 1.7], 6, 0.26);
    rime(b, [-2.9, TB - 0.1, 5.4], [2.9, TB - 0.1, 5.4], 10, 0.3);
  }, 1022));
  // the plough: push beams forward from the frame to a huge moldboard set at an angle across the bow
  const blade = pivot(body, 0, 2.2, 6.0);
  blade.add(part((b) => {
    b.add(cyl(0.3, 0.3, 5.4, 14), 'wIron', { r: [0, 0, PI / 2], c: '#6a6e74' });
    for (const sx of [-1, 1]) b.add(rb(0.6, 0.8, 3.0, 0.08), M, { p: [sx * 2.0, -0.7, 1.4], r: [0.42, 0, 0], c: hull2C });
    b.add(rb(4.6, 0.6, 0.7, 0.08), 'wIron', { p: [0, -1.3, 2.7], c: ironC });
    b.addBuilder(sub((s) => moldboard(s, 9.0, 3.2, { mat: M, c: hullC, c2: hull2C, iron: 'wIron', ironC, trimC, green: false }), 1023), { p: [0, -2.15, 3.3], r: [0, 0.24, 0] });
  }, 1024));
  // the wind engine (it faces aft, the viewer side is -z): a solid hub with three broad flat sail-boards (timber slats in an iron frame), turning on the
  // main shaft out of the back of the cap house. Odd count, broad boards, never spokes or a star.
  const rotor = pivot(body, 0, HUBY, HUBZ - 0.3);
  rotor.add(part((b) => {
    // the hub: one plain bevelled solid disc with a square axle cap (a raised inner disc and round cap read as a disc in a ring)
    b.add(bdisc(1.5, 0.5, 0.12, 30), 'wIron', { r: [PI / 2, 0, 0], c: '#62666a' });
    b.add(rb(0.6, 0.6, 0.8, 0.06), 'wBrass', { c: trimC });
    // one long brass key strap across the hub face, off to one side (a single bar, so the turn shows)
    b.add(rb(0.24, 1.3, 0.12, 0.03), 'wBrass', { p: [0.5, 0.15, -0.5], r: [0, 0, 0.3], c: trimC });
    const L = 2.9, W = 2.1, R0 = 1.1, ns = 6, sl = (L - 0.24) / ns;
    // one board laid along +y from the hub rim, pitched about its own long axis; the stock runs up its back
    const board = sub((s) => {
      for (let k = 0; k < ns; k++) s.add(rb(W, sl * 0.96, 0.1, 0.02), 'wWood', { p: [0, R0 + 0.12 + (k + 0.5) * sl, 0], c: k % 2 ? woodC : wood2C });
      s.add(rb(W + 0.12, 0.14, 0.16, 0.03), 'wIron', { p: [0, R0 + L, 0], c: ironC });
      for (const sx of [-1, 1]) s.add(rb(0.12, L, 0.16, 0.03), 'wIron', { p: [sx * (W / 2), R0 + L / 2, 0], c: ironC });
      bolts(s, 'wBrass', [0, R0 + 0.4, 0.07], [0, R0 + L - 0.3, 0.07], 4, 0.06, 'z', trimC);
    }, 1026);
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * PI * 2 + 0.3;
      b.addBuilder(board, { p: [0, 0, -0.1], r: [0, 0.22, ang], order: 'ZYX' });
      b.add(rb(0.34, L + 0.2, 0.26, 0.04), 'wIron', { p: [-Math.sin(ang) * (R0 + L / 2 - 0.1), Math.cos(ang) * (R0 + L / 2 - 0.1), 0.14], r: [0, 0, ang], c: '#4e5256' });
    }
  }, 1025));
  const spray = smoke({ rate: 0, life: 1.4, size: 2.4, rise: 1.6, color: 0xf4f8fa, opacity: 0.5, spread: 2.4 });
  spray.position.set(1.5, -1.0, 4.0); blade.add(spray);
  const exhaust = [];
  { const e = smoke({ rate: 4, life: 3.0, size: 1.6, rise: 1.6, color: 0x8e8c88, opacity: 0.45, spread: 0.35 }); e.position.set(1.3, TB + 6.5, 0.9); body.add(e); exhaust.push(e); }
  const gust = smoke({ rate: 0, life: 1.8, size: 3.0, rise: 0.4, color: 0xf2f6f8, opacity: 0.45, spread: 3.0 });
  gust.position.set(0, HUBY, HUBZ - 1.5); body.add(gust);
  const glow = slotGlow(P.glowHex, 0.2, 1.0, 0.55, { ry: -PI / 2 }); glow.position.set(-2.4, TB + 2.4, 3.4); body.add(glow);
  const a = new Anim(root, { base, body, blade, rotor, wheels: TR.wheels });
  a.dynamics.push(...exhaust, glow);
  let dist = 0, ra = 0, rs = 0.6;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 2.2), e = 1 - Math.pow(1 - k, 2);
      p.body.rotation.z = e * 0.07; p.body.rotation.x = e * 0.04; p.body.position.y = -0.35 * e;
      p.blade.rotation.x = 0.18 * e; p.blade.rotation.z = -0.05 * e;
      rs *= Math.max(0, 1 - dt * 0.8); ra += rs * dt; p.rotor.rotation.z = ra;
      for (const x of exhaust) x.visible = false; spray.visible = false; gust.visible = false;
      glow.material.opacity = 0.55 * (1 - k);
      return;
    }
    for (const x of exhaust) x.visible = true; spray.visible = true; gust.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    for (const w of p.wheels) w.rotation.x += (this.speed / 1.15) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    p.body.position.y = Math.abs(Math.sin(this.t * 3.0)) * 0.05 * Math.min(1, this.speed);
    p.body.position.z = 0; p.body.rotation.x = 0; p.body.rotation.z = Math.sin(this.t * 0.7) * 0.003;
    let br = 0.03 + Math.sin(this.t * 0.6) * 0.02, by = 0, target = 0.6 + this.speed * 0.25, sr = Math.min(1, this.speed / 2) * 14, gr = 0;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      if (this.atkKind === 'slam') {
        // the wind engine races, the plough is hauled high on its rams and dropped
        const up = at < 0.45 ? at / 0.45 : 1, down = at < 0.45 ? 0 : Math.min(1, (at - 0.45) / 0.08), rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
        br = (-0.5 * up + 0.6 * down) * (1 - rec) + br * rec;
        target = 0.6 + 3.2 * up * (1 - rec);
        if (down > 0 && rec === 0) { p.body.position.y -= 0.14 * Math.sin(Math.min(1, (at - 0.45) / 0.18) * PI); p.body.rotation.x = 0.02 * Math.sin(Math.min(1, (at - 0.45) / 0.2) * PI); sr = 40; }
        gr = at < 0.5 ? 8 : 0;
      } else {
        // the plough swept across the front: lowered, swung out to one side and dragged back
        const set = at < 0.35 ? at / 0.35 : 1, sweep = at < 0.35 ? 0 : Math.min(1, (at - 0.35) / 0.25), rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
        br = (-0.25 * set + 0.3 * sweep) * (1 - rec) + br * rec;
        by = (0.22 * set - 0.48 * sweep) * (1 - rec);
        p.body.position.z = 0.4 * sweep * (1 - rec);
        if (sweep > 0 && rec === 0) sr = 36;
        target = 1.6;
      }
    }
    p.blade.rotation.x = br; p.blade.rotation.y = by; p.blade.rotation.z = 0;
    rs += (target - rs) * Math.min(1, dt * 1.5); ra += rs * dt * ts; p.rotor.rotation.z = ra;
    spray.userData.rate = sr; gust.userData.rate = gr;
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z += Math.sin(this.t * 25) * this.hitT * 0.01; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
    spray.userData.update(dt, this.t); gust.userData.update(dt, this.t);
  };
  // the Tripo model (tripoModels.js): exhaust from the cab stacks, snow thrown off the blade, the gust from the windmill
  return wearModel(finish(root, a, 14.0), 'stormplough', { fit: 'long', stretch: [0.88, 1.12],
    fx: [[exhaust[0], [0, 0.52, 0.02]], [spray, [0, 0.08, 0.5]], [gust, [0.24, 0.6, -0.27]]], motion: MOTION.boss });
}
