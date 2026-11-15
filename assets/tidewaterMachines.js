// Machines of Tidewater Sound (Part Thirteen, levels 55-60): the Makers' yard machines, still running unwound a lifetime
// after the last yard hand stopped winding them, hauling and dredging wherever the tide leaves them. Tarred iron and
// timber (variant 0) or old bronze gone green at the seams (variant 1), every one stained dark below a pale salt line
// where the spring tides reach, grey silt caked on the treads, wheels and feet.
//  - Log Haulier: a tracked timber haulier with a portal mast at the front and a grab of two flat bars (flat tines under
//    a load of logs laid parallel, a flat clamp plate pressed down on top); the rare Snagged Haulier also drags a
//    waterlogged log behind it on a straight chain, with old rope hanks hung over its mast
//  - Saw Carriage: a timber carriage on four solid wheels with a log dogged on its bed and an upright frame saw (a sash of
//    straight blades stroked up and down by a solid crank wheel); the rare Mudbound Saw is caked in silt to the axles
//  - Rope Layer: the ropewalk's traveller, a narrow three-wheeled carriage with a square jack frame turning three square
//    whirl blocks in a row, a square rope bin with straight hanks, and a long lay-pole with a square tarred weight
//  - Silt Dredge: a tracked pontoon with a portal gantry and an inclined bucket ladder, a chain of square open scoops
//    climbing it, a flat spoil chute off one side
//  - Tide Warden: a tall gate keeper on two straight telescoping legs with flat mud pads, a tall sluice-board shield of
//    upright planks and a long gate key with a square socket head
//  - The Great Dredge (world boss): a dredge pontoon walking the flats on four square spud legs, a bucket ladder off its
//    bow under a portal gantry, the engine house amidships, the winch house at the stern; about 14 m tall
// Same interface as the other machines: userData.machine = { update(dt, speed), attack(dur, kind), hit(), die(), revive(), stun }.
// Content rules: no faces (no lamps at all, no ports or slits; one gauge strip only, never a pair; vents only on backs
// and flanks), no animal shapes (grabs are flat bars and square scoops, never claws or jaws; legs are straight columns
// that slide, they do not bend), no spokes (solid discs with an offset bolt plate), no domes, rings, stars or radiating
// patterns; stacks and housings square from above; gantries are portals (two posts and a flat beam), no braces, nothing
// crossed; timber and rope lie parallel; logs never cross the grab bars where they would show past them from above.
import * as THREE from 'three';
import { rbox, box, cyl, cone, ico } from './kit.js';
import { rgb } from './kit.js';
import { plate, vent, stack, flywheel, heroTreads, crawl, wear, bolts, bdisc, sub } from './bossParts.js';
import { smoke } from './dynamic.js';
import { slotGlow } from './slotGlow.js';
import { Anim, finish, part, pivot } from './quarryMachines.js';

const PI = Math.PI;
const rb = (w, h, d, r) => rbox(w, h, d, r, 1);
const pl = (w, h, d, o = {}) => plate(w, h, d, { br: Math.max(0.032, Math.min(0.06, Math.min(w, h) * 0.05)), ...o });
const SILT = '#5a5148', SILT2 = '#6e655a', SALT = '#e4e0d6', WOOD = '#6e5a44', WOOD2 = '#584836', BARK = '#5a4a3a', GRAIN = '#b89a72', DARK = '#262422', TAR = '#1e1c1a', ROPE = '#8a7656', ROPE2 = '#6e5e46';
// a square ram: an iron sleeve with iron collars (square and unlit, so its end never reads as an eye)
const sqRam = (r, h, c, collarC, seed) => sub((b) => {
  b.add(rb(r * 2, h, r * 2, r * 0.12), 'wIron', { c });
  for (const y of [-h / 2 + r * 0.3, h / 2 - r * 0.3]) b.add(box(r * 2.4, r * 0.5, r * 2.4), 'wIron', { p: [0, y, 0], c: collarC });
}, seed);

// palette per variant: 0 tarred iron and timber with a warm firebox glow; 1 old bronze, verdigris at the seams, amber glow
function pal(v) {
  return v ? { mat: 'wBronze', paint: '#d2b88c', paint2: '#b49a72', iron: '#584e44', trim: '#b89a62', glow: 'wGlowAmber', glowHex: 0xffb040, green: true }
    : { mat: 'wPaint', paint: '#66625a', paint2: '#545048', iron: '#3e3c3a', trim: '#9a8662', glow: 'wGlowOrange', glowHex: 0xff9a40, green: false };
}
// the tide line: below `mark` (in the part's own coordinates) the paint is stained toward silt and darker, a pale salt
// band just at the mark (a little wavy), above it the usual streaky wear
function tided(base, mark, amt = 0.3, seed = 0) {
  const f = wear(base, amt, seed), S = rgb(SILT), W = rgb(SALT);
  return (x, y, z) => {
    const c = f(x, y, z), m = mark + 0.03 * Math.sin(x * 3.1 + z * 2.3 + seed);
    if (y < m) { const k = Math.min(1, (m - y) / 0.5) * 0.5; return [(c[0] * (1 - k) + S[0] * k) * 0.82, (c[1] * (1 - k) + S[1] * k) * 0.82, (c[2] * (1 - k) + S[2] * k) * 0.82]; }
    const band = Math.max(0, 1 - (y - m) / 0.07) * 0.55;
    return [c[0] * (1 - band) + W[0] * band, c[1] * (1 - band) + W[1] * band, c[2] * (1 - band) + W[2] * band];
  };
}
// caked silt: one flattened slab over a face first (so the lumps never read as scattered dots), then flattened lumps on it
function silt(b, cx, y, cz, w, d, n, s = 0.08, green = false) {
  if (w > s && d > s) b.add(rb(w * 0.92 + s, s * 0.45, d * 0.92 + s, s * 0.2), 'wPaint', { p: [cx, y - s * 0.05, cz], c: wear(SILT, 0.14, n) });
  for (let i = 0; i < n; i++) {
    // on bronze a few lumps carry the dull green of the seams (matt paint, never the bright verdigris, which glints)
    const g = green && i % 4 === 1;
    b.add(ico(s * b.r(0.6, 1.15), 0), 'wPaint', { p: [cx + b.r(-w / 2, w / 2), y, cz + b.r(-d / 2, d / 2)], s: [1.7, 0.4, 1.3], r: [0, b.r(0, 3), 0], c: wear(g ? '#56665a' : i % 2 ? SILT : SILT2, 0.12, i) });
  }
}
// a sight-gauge strip: one lit glass in a dark frame (always single, never a pair)
function gauge(b, glow, p, h, ry = 0) {
  b.add(rb(0.12, h + 0.08, 0.06, 0.02), 'wDark', { p, r: [0, ry, 0], c: DARK });
  b.add(box(0.05, h, 0.03), glow, { p: [p[0] + Math.sin(ry) * 0.025, p[1], p[2] + Math.cos(ry) * 0.025], r: [0, ry, 0] });
}
// a log along the given axis ('x' or 'z'): an 8-sided bark cylinder with pale cut ends (lying, so from above it is a bar)
function log(b, p, len, r, axis = 'z', seed = 0) {
  const rot = axis === 'x' ? [0, 0, PI / 2] : [PI / 2, 0, 0];
  b.add(cyl(r, r * 1.04, len, 8), 'wWood', { p, r: rot, c: wear(BARK, 0.35, seed) });
  for (const s of [-1, 1]) {
    const e = axis === 'x' ? [p[0] + s * (len / 2 + 0.005), p[1], p[2]] : [p[0], p[1], p[2] + s * (len / 2 + 0.005)];
    b.add(cyl(r * 0.92, r * 0.92, 0.012, 8), 'wWood', { p: e, r: rot, c: GRAIN });
  }
}
// rope in a hank: n straight lengths side by side along x (never a coil, which reads as a ring from above)
function hank(b, p, len, n = 4, r = 0.035, ry = 0) {
  for (let i = 0; i < n; i++) {
    const o = (i - (n - 1) / 2) * r * 2.1;
    b.add(cyl(r, r, len, 6), 'wCloth', { p: [p[0] + Math.sin(ry) * o, p[1], p[2] + Math.cos(ry) * o], r: [0, ry, PI / 2], c: i % 2 ? ROPE2 : ROPE });
  }
}
// a square open scoop facing +y (its mouth up), w across, d deep in z, h tall: a floor and four walls, a hardened lip
function scoop(w, d, h, o) {
  const { mat, c, iron, ironC, full = false } = o;
  return sub((s) => {
    const t = Math.max(0.025, w * 0.06);
    s.add(rb(w, t, d, t * 0.3), mat, { p: [0, t / 2, 0], c });
    for (const sx of [-1, 1]) s.add(rb(t, h, d, t * 0.3), mat, { p: [sx * (w / 2 - t / 2), h / 2, 0], c });
    for (const sz of [-1, 1]) s.add(rb(w, h, t, t * 0.3), mat, { p: [0, h / 2, sz * (d / 2 - t / 2)], c });
    s.add(rb(w * 1.02, t * 1.2, t * 1.8, t * 0.3), iron, { p: [0, h, d / 2 - t / 2], c: ironC });
    if (full) s.add(rb(w - t * 2.2, h * 0.5, d - t * 2.2, h * 0.12), 'wPaint', { p: [0, h * 0.62, 0], c: wear(SILT, 0.15, 3) });
  }, 41);
}
// a bucket ladder along local +z (0..L): two side rails, rungs, a solid tumbler disc at the foot; returns runs (top and
// bottom chain pivots) with their scoops on, to crawl
function bucketLadder(parent, L, o) {
  const { w, rail, mat, c, c2, iron, ironC, trimC, pitch, sw, sd, sh, seed } = o;
  parent.add(part((b) => {
    for (const sx of [-1, 1]) {
      b.add(rb(rail * 0.5, rail * 1.6, L, rail * 0.1), mat, { p: [sx * (w / 2 + rail * 0.25), 0, L / 2], c });
      b.add(rb(rail * 0.56, rail * 0.3, L * 0.98, rail * 0.08), iron, { p: [sx * (w / 2 + rail * 0.25), rail * 0.82, L / 2], c: ironC });
      bolts(b, 'wBrass', [sx * (w / 2 + rail * 0.52), 0, rail], [sx * (w / 2 + rail * 0.52), 0, L - rail], Math.max(3, Math.round(L / 0.8)), rail * 0.08, 'x', trimC);
    }
    const nr = Math.max(3, Math.round(L / (pitch * 2.2)));
    for (let i = 0; i < nr; i++) b.add(rb(w + rail * 0.4, rail * 0.5, rail * 0.5, rail * 0.1), iron, { p: [0, 0, (i + 0.5) * L / nr], c: ironC });
    b.add(bdisc(rail * 1.9, w * 0.8, rail * 0.2, 20), iron, { p: [0, 0, L], r: [0, 0, PI / 2], c: ironC });
    b.add(rb(w * 0.84, rail * 0.7, rail * 0.6, rail * 0.1), 'wBrass', { p: [0, rail * 1.0, L], c: trimC });
    b.add(rb(w * 0.9, rail * 2.2, rail * 1.4, rail * 0.15), mat, { p: [0, 0, 0], c: c2 });
  }, seed));
  const runs = [];
  const full = scoop(sw, sd, sh, { mat, c: c2, iron, ironC, full: true }), empty = scoop(sw, sd, sh, { mat, c: c2, iron, ironC });
  for (const [y, dir, sc] of [[rail * 1.0, 1, full], [-rail * 1.0, -1, empty]]) {
    const run = pivot(parent, 0, y, 0);
    run.add(part((b) => {
      for (let z = pitch * 0.6; z < L - pitch * 0.4; z += pitch) b.addBuilder(sc, { p: [0, 0, z], r: dir > 0 ? [0, 0, 0] : [PI, 0, 0] });
    }, seed + 1));
    // the top run climbs toward the tumbler (local -z), the bottom run runs down to the foot
    runs.push({ run, dir: dir > 0 ? -1 : 1, span: pitch });
  }
  return runs;
}
const crawlRuns = (runs, d) => { for (const R of runs) { const m = ((d % R.span) + R.span) % R.span; R.run.position.z = R.dir > 0 ? m - R.span * 0.5 : R.span * 0.5 - m; } };

// ==========================================================================
// LOG HAULIER: a tracked timber haulier with a portal mast and a flat-bar grab (2.4 m tall, 4.0 m long)
// ==========================================================================
export function buildLogHaulier(variant = 0, snagged = false) {
  const P = pal(variant === 1), M = P.mat, G = P.glow;
  const pC = tided(P.paint, 0.2, 0.32, 1301 + variant), p2C = tided(P.paint2, 0.25, 0.3, 1303), ironC = wear(P.iron, 0.25, 1304), trimC = wear(P.trim, 0.3, 1305), woodC = wear(WOOD, 0.3, 1306);
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 1.9, len: 2.9, h: 0.72, tw: 0.46, paint: M, paintC: variant ? '#a89070' : '#46443f', linkC: '#4e4a44', road: 2, seed: 1320 + variant });
  const HY = 0.6;
  const hull = pivot(base, 0, HY, 0);
  hull.add(part((b) => {
    // the hull: a long low box, riveted flank plates, a deck plate
    b.add(rb(1.5, 0.7, 2.7, 0.08), M, { p: [0, 0.35, -0.1], c: p2C });
    for (const sx of [-1, 1]) b.addBuilder(pl(2.4, 0.5, 0.08, { mat: M, c: pC, c2: p2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 1307 }), { p: [sx * 0.76, 0.38, -0.1], r: [0, sx * PI / 2, 0] });
    b.add(rb(1.62, 0.1, 2.8, 0.03), 'wIron', { p: [0, 0.74, -0.1], c: ironC });
    // the engine house at the back: flat roof, a louvred vent on its back, one square stack, one gauge
    b.add(rb(1.25, 0.85, 1.2, 0.06), M, { p: [0, 1.2, -0.75], c: pC });
    b.add(rb(1.35, 0.08, 1.3, 0.02), 'wIron', { p: [0, 1.66, -0.75], c: ironC });
    for (const y of [0.95, 1.4]) b.add(rb(1.29, 0.06, 1.24, 0.02), 'wIron', { p: [0, y, -0.75], c: ironC });
    b.addBuilder(vent(0.7, 0.42, { frameC: DARK, glow: G, seed: 1308 }), { p: [-0.12, 1.2, -1.37], r: [0, PI, 0] });
    b.addBuilder(stack(0.24, 0.8, { c: '#323230', trimC: ironC, seed: 1309 }), { p: [0.38, 1.7, -1.0] });
    gauge(b, G, [0.64, 1.2, -0.5], 0.3, PI / 2);
    // a fuel bunker of split timber ahead of the engine house, the billets laid parallel along the hull
    b.add(rb(1.1, 0.34, 0.6, 0.04), 'wWood', { p: [0, 0.94, 0.15], c: woodC });
    for (let i = 0; i < 4; i++) b.add(rb(0.2, 0.14, 0.56, 0.03), 'wWood', { p: [-0.36 + i * 0.24, 1.17, 0.15], c: wear(i % 2 ? GRAIN : '#9a7e5c', 0.3, i) });
    // the mast: two square posts with a flat head beam (a portal, no braces), a hoist ram on the centre line behind it
    for (const sx of [-1, 1]) {
      b.add(rb(0.16, 1.75, 0.18, 0.03), 'wIron', { p: [sx * 0.62, 1.22, 1.12], c: ironC });
      b.add(rb(0.22, 0.24, 0.26, 0.03), M, { p: [sx * 0.62, 0.45, 1.1], c: p2C });
    }
    b.add(rb(1.46, 0.16, 0.24, 0.03), M, { p: [0, 2.1, 1.12], c: pC });
    b.add(rb(0.3, 0.12, 0.3, 0.02), 'wBrass', { p: [0, 2.22, 1.12], c: trimC });
    b.addBuilder(sqRam(0.07, 1.1, '#4e4c48', ironC, 1310), { p: [0, 1.5, 0.95] });
    // a ballast block and tow plate at the stern
    b.add(rb(1.3, 0.3, 0.26, 0.05), 'wIron', { p: [0, 0.5, -1.55], c: wear('#3a3836', 0.3, 1311) });
    // silt caked on the deck and the bunker's foot
    silt(b, 0, 0.8, -1.45, 1.2, 0.18, 4, 0.07, P.green);
    silt(b, 0.45, 0.8, 0.75, 0.4, 0.5, 3, 0.06, P.green);
    if (snagged) {
      // old rope hanks hung over the head beam, and a tow chain of straight links off the stern plate
      hank(b, [0, 2.0, 1.25], 1.1, 4, 0.035);
      for (const sx of [-0.35, 0.3]) for (let k = 0; k < 4; k++) b.add(cyl(0.03, 0.03, 0.32, 6), 'wCloth', { p: [sx + k * 0.06 - 0.09, 1.86 - k * 0.04, 1.32], c: k % 2 ? ROPE2 : ROPE });
      for (let k = 0; k < 6; k++) b.add(rb(0.07, 0.07, 0.22, 0.02), 'wIron', { p: [0, 0.46 - k * 0.03, -1.8 - k * 0.2], r: [k % 2 ? 0 : 0, 0, k % 2 ? PI / 2 : 0], c: '#4a4642' });
    }
  }, 1312 + variant));
  // the grab: a back plate sliding on the mast, two flat tines under a load of three logs (laid across, parallel), a flat
  // clamp plate pressed down on top. The clamp is as deep as the tines are long, so from above it hides them
  const grab = pivot(hull, 0, 0.5, 1.3);
  grab.add(part((b) => {
    b.add(rb(1.34, 0.6, 0.12, 0.03), M, { p: [0, 0.28, 0], c: p2C });
    for (const sx of [-1, 1]) b.add(rb(0.26, 0.2, 0.2, 0.03), 'wIron', { p: [sx * 0.62, 0.42, -0.12], c: ironC });
    for (const sx of [-1, 1]) b.add(rb(0.24, 0.08, 0.95, 0.02), 'wIron', { p: [sx * 0.4, 0.02, 0.52], c: '#5c5a56' });
    log(b, [0, 0.24, 0.3], 2.0, 0.18, 'x', 1);
    log(b, [0, 0.24, 0.7], 2.0, 0.18, 'x', 2);
    log(b, [0, 0.55, 0.5], 1.9, 0.17, 'x', 3);
    for (const sx of [-1, 1]) b.add(rb(0.12, 0.5, 0.12, 0.02), 'wIron', { p: [sx * 0.55, 0.68, 0.02], c: ironC });
    b.add(rb(1.5, 0.08, 1.0, 0.02), M, { p: [0, 0.82, 0.5], c: pC });
    b.add(rb(1.52, 0.1, 0.12, 0.02), 'wIron', { p: [0, 0.82, 1.0], c: ironC });
    bolts(b, 'wBrass', [-0.65, 0.87, 0.94], [0.65, 0.87, 0.94], 6, 0.022, 'y', trimC);
  }, 1313 + variant));
  // the Snagged Haulier drags a waterlogged log behind it, end on along its own line
  let drag = null;
  if (snagged) {
    drag = pivot(base, 0, 0.26, -2.6);
    drag.add(part((b) => { log(b, [0, 0, -1.2], 2.6, 0.26, 'z', 9); silt(b, 0, 0.2, -1.2, 0.3, 2.0, 6, 0.08); }, 1314));
  }
  const exhaust = smoke({ rate: 2.5, life: 2.2, size: 0.45, rise: 1.0, color: 0x8a8884, opacity: 0.4, spread: 0.12 });
  exhaust.position.set(0.38, 2.6, -1.0); hull.add(exhaust);
  const mud = smoke({ rate: 0, life: 0.9, size: 0.5, rise: -0.4, color: 0x5a5148, opacity: 0.55, spread: 0.6 });
  mud.position.set(0, 0.2, 1.8); hull.add(mud);
  const glow = slotGlow(P.glowHex, 0.62, 0.36, 0.5, { ry: PI }); glow.position.set(-0.12, 1.2, -1.44); hull.add(glow);
  const a = new Anim(root, { base, hull, grab, wheels: TR.wheels, drag });
  a.dynamics.push(exhaust, glow);
  let dist = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.1), e = 1 - Math.pow(1 - k, 3);
      p.hull.rotation.z = 0.12 * e; p.hull.rotation.x = 0.06 * e; p.hull.position.y = HY - 0.1 * e;
      p.grab.position.y = 0.5 - 0.35 * e; p.grab.rotation.x = 0.25 * e;
      exhaust.visible = false; mud.visible = false; glow.material.opacity = 0.5 * (1 - k);
      return;
    }
    exhaust.visible = true; mud.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.36) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    p.hull.position.y = HY + Math.abs(Math.sin(this.t * 6)) * 0.02 * Math.min(1, this.speed);
    p.hull.rotation.x = Math.sin(this.t * 1.1) * 0.005; p.hull.rotation.z = 0; p.hull.position.z = 0;
    let gy = 0.5 + Math.sin(this.t * 0.7) * 0.03, gz = 1.3, gr = 0, mr = 0;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      // run the grab up the mast, then drive the load down and forward into the target
      const up = at < 0.45 ? at / 0.45 : 1, down = at < 0.45 ? 0 : Math.min(1, (at - 0.45) / 0.1), rec = at > 0.72 ? (at - 0.72) / 0.28 : 0;
      gy += (0.75 * up - 0.95 * down) * (1 - rec);
      gz += 0.3 * down * (1 - rec);
      gr = (-0.12 * up + 0.3 * down) * (1 - rec);
      if (down > 0 && rec === 0) { p.hull.rotation.x += 0.05 * Math.sin(Math.min(1, (at - 0.45) / 0.18) * PI); mr = 30; }
    }
    p.grab.position.y = gy; p.grab.position.z = gz; p.grab.rotation.x = gr;
    if (p.drag) { p.drag.rotation.y = Math.sin(this.t * 0.9) * 0.06; p.drag.position.y = 0.26 + Math.abs(Math.sin(this.t * 4)) * 0.02 * Math.min(1, this.speed); }
    mud.userData.rate = mr;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.hull.rotation.z = Math.sin(this.t * 30) * this.hitT * 0.03; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
    mud.userData.update(dt, this.t);
  };
  return finish(root, a, 2.4);
}

// ==========================================================================
// SAW CARRIAGE: a timber carriage on four solid wheels with an upright frame saw (3.4 m tall, 3.8 m long)
// ==========================================================================
export function buildSawCarriage(variant = 0, mudbound = false) {
  const P = pal(variant === 1), M = P.mat, G = P.glow;
  const pC = tided(P.paint, 0.0, 0.32, 1401 + variant), p2C = tided(P.paint2, 0.0, 0.3, 1403), ironC = wear(P.iron, 0.25, 1404), trimC = wear(P.trim, 0.3, 1405), woodC = wear(WOOD, 0.3, 1406), wood2C = wear(WOOD2, 0.3, 1407);
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const WR = 0.42, wheels = [];
  for (const sx of [-1, 1]) for (const z of [-1.15, 1.05]) {
    const w = pivot(base, sx * 0.8, WR, z);
    w.add(part((b) => {
      b.addBuilder(flywheel(WR, 0.16, { mat: 'wIron', c: tided('#4e4a44', -0.1, 0.3, 1408), hub: 'wBrass', hubC: trimC, seed: 1409 }));
      if (mudbound) silt(b, 0, -0.12, 0, 0.2, 0.7, 4, 0.1, P.green);
    }, 1410));
    wheels.push(w);
  }
  const BY = 0.62;
  const bed = pivot(base, 0, BY, 0);
  bed.add(part((b) => {
    // the frame: two long iron-shod timber sills, the axle blocks, a plank deck along the bed
    for (const sx of [-1, 1]) {
      b.add(rb(0.24, 0.34, 3.6, 0.04), 'wWood', { p: [sx * 0.6, 0, -0.05], c: woodC });
      b.add(rb(0.26, 0.08, 3.62, 0.02), 'wIron', { p: [sx * 0.6, -0.17, -0.05], c: ironC });
      for (const z of [-1.15, 1.05]) b.add(rb(0.2, 0.28, 0.36, 0.04), 'wIron', { p: [sx * 0.7, -0.1, z], c: ironC });
    }
    for (let i = 0; i < 5; i++) b.add(rb(0.26, 0.07, 3.5, 0.015), 'wWood', { p: [-0.5 + i * 0.25, 0.2, -0.05], c: i % 2 ? wood2C : woodC });
    // the log on the bed, held by two iron dogs a side (upright square clamps)
    log(b, [0, 0.55, -0.3], 2.7, 0.3, 'z', 7);
    for (const sx of [-1, 1]) for (const z of [-1.2, 0.6]) {
      b.add(rb(0.12, 0.62, 0.16, 0.02), 'wIron', { p: [sx * 0.42, 0.5, z], c: ironC });
      b.add(rb(0.2, 0.08, 0.16, 0.02), 'wIron', { p: [sx * 0.34, 0.8, z], c: ironC });
    }
    // the engine at the stern: a square boiler house, flat roof, a vent on its back, one square stack, one gauge
    b.add(rb(1.0, 1.0, 0.7, 0.06), M, { p: [0, 0.74, -1.55], c: pC });
    b.add(rb(1.08, 0.08, 0.78, 0.02), 'wIron', { p: [0, 1.27, -1.55], c: ironC });
    b.addBuilder(vent(0.6, 0.4, { frameC: DARK, glow: G, seed: 1411 }), { p: [0, 0.7, -1.92], r: [0, PI, 0] });
    b.addBuilder(stack(0.22, 0.7, { c: '#323230', trimC: ironC, seed: 1412 }), { p: [-0.28, 1.3, -1.6] });
    gauge(b, G, [-0.52, 0.85, -1.4], 0.28, -PI / 2);
    // the drive: a square shaft casing from the engine forward along the right sill to the crank
    b.add(rb(0.16, 0.16, 2.4, 0.03), 'wIron', { p: [0.86, 0.12, 0.0], c: wear('#45423e', 0.25, 1413) });
    // sawdust and silt along the deck
    silt(b, 0, 0.26, 1.15, 0.9, 0.5, 4, 0.06, P.green);
    if (mudbound) { silt(b, 0, -0.05, 0, 1.3, 3.4, 12, 0.12); silt(b, 0, 0.88, -0.3, 0.4, 1.6, 6, 0.08); }
  }, 1414 + variant));
  // the frame saw at the bow: a portal of two square posts and a flat head beam, a solid crank wheel on the right
  const frame = pivot(bed, 0, 0.1, 1.45);
  frame.add(part((b) => {
    for (const sx of [-1, 1]) {
      b.add(rb(0.18, 2.6, 0.2, 0.03), 'wIron', { p: [sx * 0.72, 1.3, 0], c: ironC });
      b.add(rb(0.08, 2.4, 0.08, 0.02), 'wMetal', { p: [sx * 0.6, 1.3, 0.0], c: '#9a9894' }); // the sash guides
    }
    b.add(rb(1.64, 0.2, 0.3, 0.03), M, { p: [0, 2.65, 0], c: pC });
    b.add(rb(1.4, 0.12, 0.22, 0.02), 'wBrass', { p: [0, 2.79, 0], c: trimC });
    b.add(rb(1.5, 0.16, 0.26, 0.03), M, { p: [0, 0.0, 0], c: p2C });
  }, 1415 + variant));
  // the sash: stiles and rails round three straight upright blades, stroked up and down on the guides
  const sash = pivot(frame, 0, 1.1, 0.0);
  sash.add(part((b) => {
    for (const sx of [-1, 1]) b.add(rb(0.1, 1.3, 0.12, 0.02), 'wWood', { p: [sx * 0.52, 0, 0], c: woodC });
    for (const y of [-0.62, 0.62]) b.add(rb(1.14, 0.12, 0.14, 0.02), 'wWood', { p: [0, y, 0], c: wood2C });
    for (const x of [-0.25, 0, 0.25]) {
      b.add(box(0.06, 1.16, 0.012), 'wEdge', { p: [x, 0, 0], c: '#d6d8da' });
      for (const y of [-0.56, 0.56]) b.add(rb(0.1, 0.08, 0.08, 0.015), 'wIron', { p: [x, y, 0], c: ironC });
    }
    if (mudbound) silt(b, 0, -0.66, 0.02, 1.0, 0.1, 5, 0.06, P.green);
  }, 1416 + variant));
  // the crank wheel and its rod (the rod hangs off the sash's bottom rail to the wheel's pin)
  const crank = pivot(frame, 0.92, 0.36, 0);
  crank.add(part((b) => b.addBuilder(flywheel(0.34, 0.12, { mat: 'wIron', c: '#5a5650', hub: 'wBrass', hubC: trimC, seed: 1417 })), 1418));
  const rod = pivot(sash, 0.78, -0.62, 0);
  rod.add(part((b) => b.add(rb(0.06, 0.62, 0.06, 0.015), 'wIron', { p: [0, -0.31, 0], c: '#6a6862' }), 1419));
  const exhaust = smoke({ rate: 2.2, life: 2.2, size: 0.42, rise: 1.0, color: 0x8a8884, opacity: 0.4, spread: 0.12 });
  exhaust.position.set(-0.28, 2.1, -1.6); bed.add(exhaust);
  const dust = smoke({ rate: 0, life: 0.9, size: 0.45, rise: -0.3, color: 0xc8b494, opacity: 0.5, spread: 0.5 });
  dust.position.set(0, 0.5, 0.2); frame.add(dust);
  const glow = slotGlow(P.glowHex, 0.52, 0.32, 0.5, { ry: PI }); glow.position.set(0, 0.7, -1.98); bed.add(glow);
  const a = new Anim(root, { base, bed, frame, sash, crank, rod, wheels });
  a.dynamics.push(exhaust, glow);
  let st = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.2), e = 1 - Math.pow(1 - k, 3);
      p.bed.rotation.z = 0.1 * e; p.bed.position.y = BY - 0.12 * e; p.frame.rotation.x = 0.55 * e;
      exhaust.visible = false; dust.visible = false; glow.material.opacity = 0.5 * (1 - k);
      return;
    }
    exhaust.visible = true; dust.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    for (const w of p.wheels) w.rotation.x += (this.speed / WR) * dt * ts;
    p.bed.position.y = BY + Math.abs(Math.sin(this.t * 7)) * 0.015 * Math.min(1, this.speed);
    let rate = 1.2, fr = 0, dr = 0;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      // the saw races and the whole frame tips forward onto the target, then rights itself
      const tip = at < 0.4 ? 0 : Math.min(1, (at - 0.4) / 0.15), rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
      rate = 7;
      fr = (-0.08 * (at < 0.4 ? at / 0.4 : 1) + 0.62 * tip) * (1 - rec);
      if (tip > 0 && rec === 0) dr = 40;
    }
    st += rate * dt * ts * PI * 2;
    p.sash.position.y = 1.1 + Math.sin(st) * 0.22;
    p.crank.rotation.x = st;
    p.rod.rotation.x = Math.cos(st) * 0.18;
    p.frame.rotation.x = fr;
    dust.userData.rate = dr;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.bed.rotation.z = Math.sin(this.t * 30) * this.hitT * 0.03; } else p.bed.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update(dt, this.t);
    dust.userData.update(dt, this.t);
  };
  return finish(root, a, 3.4);
}

// ==========================================================================
// ROPE LAYER: the ropewalk's traveller, a narrow three-wheeled carriage with a jack of three square whirls (2.7 m tall)
// ==========================================================================
export function buildRopeLayer(variant = 0) {
  const P = pal(variant === 1), M = P.mat, G = P.glow;
  const pC = tided(P.paint, 0.1, 0.32, 1501 + variant), p2C = tided(P.paint2, 0.1, 0.3, 1503), ironC = wear(P.iron, 0.25, 1504), trimC = wear(P.trim, 0.3, 1505), woodC = wear(WOOD, 0.3, 1506), wood2C = wear(WOOD2, 0.3, 1507);
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const wheels = [];
  for (const sx of [-1, 1]) {
    const w = pivot(base, sx * 0.66, 0.55, -0.55);
    w.add(part((b) => b.addBuilder(flywheel(0.55, 0.14, { mat: 'wWood', c: tided(WOOD2, -0.2, 0.3, 1508), hub: 'wIron', hubC: ironC, seed: 1509 })), 1510));
    wheels.push({ w, r: 0.55 });
  }
  const fw = pivot(base, 0, 0.32, 0.78);
  fw.add(part((b) => b.addBuilder(flywheel(0.32, 0.12, { mat: 'wIron', c: '#4e4a44', hub: 'wBrass', hubC: trimC, seed: 1511 })), 1512));
  wheels.push({ w: fw, r: 0.32 });
  const BY = 0.62;
  const body = pivot(base, 0, BY, 0);
  body.add(part((b) => {
    // the carriage: a narrow timber body on iron sills, the front wheel's square fork
    b.add(rb(0.96, 0.4, 2.0, 0.05), 'wWood', { p: [0, 0.05, -0.05], c: woodC });
    for (const sx of [-1, 1]) b.add(rb(0.08, 0.44, 2.04, 0.02), 'wIron', { p: [sx * 0.5, 0.05, -0.05], c: ironC });
    for (const sx of [-1, 1]) b.add(rb(0.08, 0.5, 0.16, 0.02), 'wIron', { p: [sx * 0.12, -0.18, 0.8], c: ironC });
    b.add(rb(0.34, 0.08, 0.2, 0.02), 'wIron', { p: [0, 0.08, 0.8], c: ironC });
    b.add(rb(1.5, 0.12, 0.16, 0.03), 'wIron', { p: [0, -0.07, -0.55], c: ironC }); // the rear axle bar
    // the boiler at the back: a square upright box, flat top, a vent on its back, one square stack, one gauge
    b.add(rb(0.8, 1.2, 0.62, 0.06), M, { p: [0, 0.85, -0.7], c: pC });
    b.add(rb(0.88, 0.08, 0.7, 0.02), 'wIron', { p: [0, 1.48, -0.7], c: ironC });
    for (const y of [0.55, 1.1]) b.add(rb(0.84, 0.06, 0.66, 0.02), 'wIron', { p: [0, y, -0.7], c: ironC });
    b.addBuilder(vent(0.5, 0.36, { frameC: DARK, glow: G, seed: 1513 }), { p: [0, 0.8, -1.02], r: [0, PI, 0] });
    b.addBuilder(stack(0.2, 0.7, { c: '#323230', trimC: ironC, seed: 1514 }), { p: [0.2, 1.52, -0.82] });
    gauge(b, G, [-0.42, 0.95, -0.6], 0.28, -PI / 2);
    // a square rope bin amidships with laid rope in straight hanks
    b.add(rb(0.86, 0.36, 0.62, 0.03), 'wWood', { p: [0, 0.42, 0.05], c: wood2C });
    b.add(box(0.74, 0.04, 0.5), 'wDark', { p: [0, 0.58, 0.05], c: DARK });
    hank(b, [0, 0.64, 0.05], 0.66, 6, 0.04, PI / 2);
    // the jack at the front: two square posts and a flat head beam, the head plate between them
    for (const sx of [-1, 1]) b.add(rb(0.12, 1.85, 0.14, 0.02), 'wIron', { p: [sx * 0.44, 1.12, 0.62], c: ironC });
    b.add(rb(1.04, 0.14, 0.2, 0.03), M, { p: [0, 2.08, 0.62], c: pC });
    b.add(rb(0.84, 0.66, 0.1, 0.03), M, { p: [0, 1.0, 0.64], c: p2C });
    b.addBuilder(pl(0.8, 0.5, 0.05, { mat: M, c: pC, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, inset: false, seed: 1515 }), { p: [0, 1.0, 0.7] });
    // the pole mount on the right post
    b.add(rb(0.2, 0.24, 0.24, 0.03), 'wIron', { p: [0.56, 1.75, 0.62], c: ironC });
    silt(b, 0, -0.14, -0.05, 0.8, 1.7, 6, 0.07, P.green);
  }, 1516 + variant));
  // the three whirls: square blocks in a row low on the head plate, each turning on its own axle, a square peg on each
  const whirls = [];
  for (const x of [-0.25, 0, 0.25]) {
    const w = pivot(body, x, 0.86, 0.8);
    w.add(part((b) => {
      b.add(rb(0.16, 0.16, 0.12, 0.02), 'wIron', { c: ironC });
      b.add(rb(0.05, 0.05, 0.16, 0.01), 'wBrass', { p: [0.04, 0.04, 0.12], c: trimC });
    }, 1517));
    whirls.push(w);
  }
  // the lay-pole: a long iron-bound timber pole on the right post with a square tarred weight at its end
  const pole = pivot(body, 0.7, 1.75, 0.62);
  pole.add(part((b) => {
    b.add(bdisc(0.11, 0.1, 0.02, 14), 'wBrass', { r: [0, 0, PI / 2], c: trimC });
    b.add(rb(0.11, 0.13, 1.9, 0.03), 'wWood', { p: [0.06, 0, 0.9], c: woodC });
    for (const z of [0.4, 1.0, 1.5]) b.add(rb(0.15, 0.17, 0.06, 0.015), 'wIron', { p: [0.06, 0, z], c: ironC });
    b.add(rb(0.3, 0.3, 0.34, 0.04), 'wDark', { p: [0.06, 0, 1.95], c: TAR });
    b.add(rb(0.34, 0.06, 0.38, 0.015), 'wIron', { p: [0.06, 0.15, 1.95], c: ironC });
  }, 1518));
  const exhaust = smoke({ rate: 2.2, life: 2.2, size: 0.4, rise: 1.0, color: 0x8a8884, opacity: 0.4, spread: 0.12 });
  exhaust.position.set(0.2, 2.35, -0.82); body.add(exhaust);
  const glow = slotGlow(P.glowHex, 0.42, 0.28, 0.5, { ry: PI }); glow.position.set(0, 0.8, -1.08); body.add(glow);
  const a = new Anim(root, { base, body, pole, whirls, wheels });
  a.dynamics.push(exhaust, glow);
  let wa = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.1), e = k * k;
      // the front wheel's fork gives and it pitches onto its nose
      p.body.rotation.x = 0.28 * e; p.body.position.y = BY - 0.3 * e; p.body.rotation.z = -0.06 * e; p.pole.rotation.x = 1.2 * e;
      exhaust.visible = false; glow.material.opacity = 0.5 * (1 - k);
      return;
    }
    exhaust.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    for (const W of p.wheels) W.w.rotation.x += (this.speed / W.r) * dt * ts;
    p.body.position.y = BY + Math.abs(Math.sin(this.t * 8)) * 0.012 * Math.min(1, this.speed);
    p.body.rotation.x = 0; p.body.rotation.z = Math.sin(this.t * 1.3) * 0.006;
    let px = 0.95 + Math.sin(this.t * 0.8) * 0.04, ws = 4;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      // the pole is swung up behind the jack, then brought down on the target, the whirls racing
      const up = at < 0.45 ? at / 0.45 : 1, down = at < 0.45 ? 0 : Math.min(1, (at - 0.45) / 0.12), rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
      px += (-1.6 * up + 2.0 * down) * (1 - rec);
      p.body.rotation.x = (-0.04 * up + 0.07 * down) * (1 - rec);
      ws = 18;
    }
    p.pole.rotation.x = px;
    wa += ws * dt * ts;
    p.whirls.forEach((w, i) => { w.rotation.z = wa * (i % 2 ? -1 : 1); });
    if (this.hitT > 0) { this.hitT -= dt * 3; p.body.rotation.z += Math.sin(this.t * 30) * this.hitT * 0.03; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  return finish(root, a, 2.7);
}

// ==========================================================================
// SILT DREDGE: a tracked pontoon with a portal gantry and a bucket ladder of square scoops (2.8 m tall, 4.8 m long)
// ==========================================================================
export function buildSiltDredge(variant = 0) {
  const P = pal(variant === 1), M = P.mat, G = P.glow;
  const pC = tided(P.paint, 0.35, 0.32, 1601 + variant), p2C = tided(P.paint2, 0.4, 0.3, 1603), ironC = wear(P.iron, 0.25, 1604), trimC = wear(P.trim, 0.3, 1605);
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 2.0, len: 3.0, h: 0.7, tw: 0.62, paint: M, paintC: variant ? '#a89070' : '#46443f', linkC: '#4e4a44', road: 2, seed: 1620 + variant });
  const HY = 0.6;
  const hull = pivot(base, 0, HY, 0);
  hull.add(part((b) => {
    // the pontoon: a deep box hull with a raked bow block, riveted flank plates, a deck plate
    b.add(rb(1.7, 0.8, 2.9, 0.08), M, { p: [0, 0.4, -0.25], c: p2C });
    b.add(rb(1.7, 0.5, 0.6, 0.06), M, { p: [0, 0.55, 1.25], r: [-0.5, 0, 0], c: p2C });
    for (const sx of [-1, 1]) b.addBuilder(pl(2.6, 0.56, 0.08, { mat: M, c: pC, c2: p2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 1606 }), { p: [sx * 0.86, 0.42, -0.25], r: [0, sx * PI / 2, 0] });
    b.add(rb(1.82, 0.1, 3.0, 0.03), 'wIron', { p: [0, 0.84, -0.25], c: ironC });
    // the gantry: two square posts and a flat head beam inside the hull's width, the upper tumbler box on the beam
    for (const sx of [-1, 1]) b.add(rb(0.16, 1.9, 0.18, 0.03), 'wIron', { p: [sx * 0.58, 1.8, 0.62], c: ironC });
    b.add(rb(1.34, 0.18, 0.28, 0.03), M, { p: [0, 2.78, 0.62], c: pC });
    b.add(rb(0.62, 0.36, 0.42, 0.05), 'wIron', { p: [0, 2.6, 0.86], c: ironC });
    // the spoil chute: a short flat trough off the outside of the left post, down over the side (outboard of the post, so
    // from the front it never crosses it)
    b.add(rb(0.8, 0.06, 0.42, 0.02), M, { p: [-1.06, 1.95, 0.62], r: [0, 0, 0.45], c: p2C });
    for (const sz of [-1, 1]) b.add(rb(0.8, 0.16, 0.04, 0.01), M, { p: [-1.06, 2.01, 0.62 + sz * 0.2], r: [0, 0, 0.45], c: pC });
    b.add(rb(0.12, 0.12, 0.3, 0.02), 'wIron', { p: [-0.72, 2.12, 0.62], c: ironC });
    // the engine house at the stern: flat roof, a vent on its back, one square stack, one gauge
    b.add(rb(1.3, 0.9, 1.1, 0.06), M, { p: [0, 1.32, -1.0], c: pC });
    b.add(rb(1.4, 0.08, 1.2, 0.02), 'wIron', { p: [0, 1.81, -1.0], c: ironC });
    b.addBuilder(vent(0.7, 0.42, { frameC: DARK, glow: G, seed: 1607 }), { p: [0, 1.3, -1.57], r: [0, PI, 0] });
    b.addBuilder(stack(0.24, 0.85, { c: '#323230', trimC: ironC, seed: 1608 }), { p: [-0.38, 1.85, -1.2] });
    gauge(b, G, [0.66, 1.35, -0.8], 0.3, PI / 2);
    // silt spilled over the deck and caked down the flanks
    silt(b, 0.2, 0.9, 0.2, 1.1, 0.7, 7, 0.08, P.green);
    silt(b, -0.6, 0.9, -0.2, 0.3, 0.6, 3, 0.07, P.green);
    silt(b, 0, 1.86, -1.0, 1.0, 0.8, 4, 0.06, P.green);
  }, 1609 + variant));
  // the bucket ladder off the tumbler, down and forward to the mud
  const ladder = pivot(hull, 0, 2.5, 0.98);
  const LA = 0.98;
  ladder.rotation.x = LA;
  const runs = bucketLadder(ladder, 3.3, { w: 0.5, rail: 0.12, mat: M, c: pC, c2: p2C, iron: 'wIron', ironC, trimC, pitch: 0.44, sw: 0.42, sd: 0.32, sh: 0.22, seed: 1610 });
  const exhaust = smoke({ rate: 2.5, life: 2.2, size: 0.45, rise: 1.0, color: 0x8a8884, opacity: 0.4, spread: 0.12 });
  exhaust.position.set(-0.38, 2.85, -1.2); hull.add(exhaust);
  const spoil = smoke({ rate: 3, life: 1.0, size: 0.4, rise: -1.2, color: 0x5a5148, opacity: 0.6, spread: 0.2 });
  spoil.position.set(-1.45, 1.7, 0.62); hull.add(spoil);
  const spray = smoke({ rate: 0, life: 0.9, size: 0.6, rise: 0.3, color: 0x6e655a, opacity: 0.55, spread: 0.8 });
  spray.position.set(0, 0, 3.2); ladder.add(spray);
  const glow = slotGlow(P.glowHex, 0.62, 0.36, 0.5, { ry: PI }); glow.position.set(0, 1.3, -1.64); hull.add(glow);
  const a = new Anim(root, { base, hull, ladder, wheels: TR.wheels });
  a.dynamics.push(exhaust, glow, spoil);
  let dist = 0, cd = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.2), e = 1 - Math.pow(1 - k, 3);
      p.hull.rotation.z = -0.12 * e; p.hull.rotation.x = 0.06 * e; p.hull.position.y = HY - 0.12 * e;
      p.ladder.rotation.x = LA + 0.3 * e;
      exhaust.visible = false; spoil.visible = false; spray.visible = false; glow.material.opacity = 0.5 * (1 - k);
      return;
    }
    exhaust.visible = true; spoil.visible = true; spray.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.35) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    p.hull.position.y = HY + Math.abs(Math.sin(this.t * 5)) * 0.02 * Math.min(1, this.speed);
    p.hull.rotation.x = Math.sin(this.t * 1.0) * 0.005; p.hull.rotation.z = 0;
    let lr = LA + Math.sin(this.t * 0.9) * 0.03, cs = 0.5, sr = 0, so = 3;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      // the ladder is lifted, then dropped and raked through the target with the chain racing
      const up = at < 0.4 ? at / 0.4 : 1, down = at < 0.4 ? 0 : Math.min(1, (at - 0.4) / 0.12), rec = at > 0.72 ? (at - 0.72) / 0.28 : 0;
      lr = LA + (-0.4 * up + 0.62 * down) * (1 - rec);
      cs = 2.4; so = 10;
      if (down > 0 && rec === 0) sr = 36;
    }
    p.ladder.rotation.x = lr;
    cd += cs * dt * ts; crawlRuns(runs, cd);
    spray.userData.rate = sr; spoil.userData.rate = so;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.hull.rotation.z = Math.sin(this.t * 30) * this.hitT * 0.03; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
    spray.userData.update(dt, this.t);
  };
  return finish(root, a, 2.8);
}

// ==========================================================================
// TIDE WARDEN: a gate keeper on two straight telescoping legs, a sluice-board shield and a gate key (3.4 m)
// ==========================================================================
export function buildTideWarden(variant = 0) {
  const P = pal(variant === 1), M = P.mat, G = P.glow;
  const PY = 1.6;
  const pC = tided(P.paint, -0.4, 0.32, 1701 + variant), p2C = wear(P.paint2, 0.3, 1703), ironC = wear(P.iron, 0.25, 1704), trimC = wear(P.trim, 0.3, 1705), woodC = wear(WOOD, 0.3, 1706), wood2C = wear(WOOD2, 0.3, 1707);
  const root = new THREE.Group();
  const pelvis = pivot(root, 0, PY, 0);
  const body = pivot(pelvis, 0, 0, 0);
  body.add(part((b) => {
    // the hip block carrying both legs
    b.add(rb(1.0, 0.32, 0.6, 0.05), 'wIron', { c: ironC });
    // the body: a square plated case, iron bands, a flat cap block with a plain plated front (no openings)
    b.add(rb(1.1, 1.1, 0.78, 0.07), M, { p: [0, 0.78, 0], c: pC });
    b.addBuilder(pl(0.96, 0.84, 0.07, { mat: M, c: p2C, c2: pC, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 1708 }), { p: [0, 0.78, 0.4] });
    for (const y of [0.32, 1.26]) b.add(rb(1.18, 0.08, 0.86, 0.02), 'wIron', { p: [0, y, 0], c: ironC });
    b.add(rb(0.84, 0.42, 0.66, 0.06), M, { p: [0, 1.56, -0.04], c: p2C });
    b.addBuilder(pl(0.74, 0.32, 0.05, { mat: M, c: pC, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, inset: false, seed: 1709 }), { p: [0, 1.56, 0.3] });
    b.add(rb(0.94, 0.08, 0.76, 0.02), 'wIron', { p: [0, 1.8, -0.04], c: ironC });
    b.add(rb(0.5, 0.1, 0.4, 0.02), 'wBrass', { p: [0, 1.88, -0.06], c: trimC });
    // the shoulders: square bearing blocks
    for (const sx of [-1, 1]) b.add(rb(0.28, 0.32, 0.4, 0.05), 'wIron', { p: [sx * 0.66, 1.15, 0], c: ironC });
    // a firebox on its back with a vent, one square stack, one gauge on the left flank
    b.add(rb(0.74, 0.7, 0.3, 0.05), M, { p: [0, 0.72, -0.52], c: p2C });
    b.addBuilder(vent(0.5, 0.36, { frameC: DARK, glow: G, seed: 1710 }), { p: [0, 0.72, -0.68], r: [0, PI, 0] });
    b.addBuilder(stack(0.18, 0.6, { c: '#323230', trimC: ironC, seed: 1711 }), { p: [0.28, 1.1, -0.55] });
    gauge(b, G, [-0.56, 0.7, 0.1], 0.3, -PI / 2);
    // dried silt on the cap and in the corners
    silt(b, 0, 1.83, -0.2, 0.6, 0.3, 3, 0.05, P.green);
  }, 1712 + variant));
  // the shield arm (left): a tall sluice board of upright planks in an iron frame, two square lifting lugs on top
  const shield = pivot(body, -0.82, 1.1, 0.15);
  shield.add(part((b) => {
    b.add(rb(0.2, 0.2, 0.5, 0.03), 'wIron', { p: [0, 0, 0.1], c: ironC });
    const S = sub((s) => {
      for (let i = 0; i < 5; i++) s.add(rb(0.17, 1.8, 0.08, 0.015), 'wWood', { p: [-0.36 + i * 0.18, 0, 0], c: tided(i % 2 ? WOOD2 : WOOD, -0.3, 0.3, i) });
      for (const sx of [-1, 1]) s.add(rb(0.07, 1.86, 0.11, 0.015), 'wIron', { p: [sx * 0.46, 0, 0], c: ironC });
      for (const y of [-0.9, -0.1, 0.9]) s.add(rb(0.98, 0.08, 0.11, 0.015), 'wIron', { p: [0, y, 0], c: ironC });
      for (const sx of [-1, 1]) s.add(rb(0.12, 0.14, 0.12, 0.02), 'wIron', { p: [sx * 0.26, 0.98, 0], c: ironC });
      bolts(s, 'wBrass', [-0.38, 0.9, 0.06], [0.38, 0.9, 0.06], 5, 0.02, 'z', trimC);
    }, 1713);
    b.addBuilder(S, { p: [-0.12, -0.35, 0.42], r: [0, -0.25, 0] });
  }, 1714));
  // the key arm (right): a long iron gate key with a square socket head
  const key = pivot(body, 0.82, 1.1, 0.05);
  key.add(part((b) => {
    b.add(bdisc(0.13, 0.12, 0.02, 14), 'wBrass', { r: [0, 0, PI / 2], c: trimC });
    b.add(rb(0.18, 0.5, 0.2, 0.03), M, { p: [0.04, -0.26, 0], c: p2C });
    b.add(rb(0.1, 0.1, 2.1, 0.02), 'wIron', { p: [0.06, -0.5, 0.9], c: '#5e5c58' });
    for (const z of [0.15, 0.4]) b.add(rb(0.16, 0.16, 0.08, 0.02), 'wBrass', { p: [0.06, -0.5, z], c: trimC });
    b.add(rb(0.32, 0.32, 0.36, 0.04), 'wIron', { p: [0.06, -0.5, 2.05], c: wear('#45423e', 0.3, 1715) });
    b.add(box(0.14, 0.14, 0.04), 'wDark', { p: [0.06, -0.5, 2.24], c: DARK });
  }, 1716));
  // legs: a straight square upper column with a sleeve, a sliding lower column, a broad flat mud pad kept level
  const legs = {};
  for (const sx of [-1, 1]) {
    const hip = pivot(pelvis, sx * 0.36, -0.06, 0);
    hip.add(part((b) => {
      b.add(bdisc(0.15, 0.12, 0.03, 16), 'wIron', { p: [sx * 0.12, 0, 0], r: [0, 0, PI / 2], c: ironC });
      b.add(rb(0.26, 0.82, 0.3, 0.04), M, { p: [0, -0.4, 0], c: pC });
      for (const y of [-0.2, -0.65]) b.add(rb(0.3, 0.07, 0.34, 0.015), 'wIron', { p: [0, y, 0], c: ironC });
      b.add(rb(0.22, 0.22, 0.26, 0.03), 'wBrass', { p: [0, -0.84, 0], c: trimC });
    }, 1717));
    const rod = pivot(hip, 0, -0.84, 0);
    rod.add(part((b) => b.add(rb(0.16, 0.7, 0.18, 0.03), 'wIron', { p: [0, -0.32, 0], c: tided('#55524c', -0.3, 0.25, 1718) }), 1719));
    const foot = pivot(rod, 0, -0.66, 0);
    foot.add(part((b) => {
      b.add(rb(0.2, 0.14, 0.2, 0.03), 'wIron', { p: [0, 0.04, 0], c: ironC });
      b.add(rb(0.5, 0.1, 0.78, 0.03), M, { p: [0, -0.06, 0.06], c: wear(SILT, 0.2, sx) });
      b.add(rb(0.54, 0.04, 0.82, 0.01), 'wIron', { p: [0, -0.11, 0.06], c: ironC });
      silt(b, 0, -0.0, 0.06, 0.4, 0.7, 4, 0.06);
    }, 1720));
    legs[sx > 0 ? 'L' : 'R'] = { hip, rod, foot };
  }
  const exhaust = smoke({ rate: 2, life: 2.0, size: 0.35, rise: 1.0, color: 0x8a8884, opacity: 0.4, spread: 0.1 });
  exhaust.position.set(0.28, 1.8, -0.55); body.add(exhaust);
  const glow = slotGlow(P.glowHex, 0.42, 0.28, 0.5, { ry: PI }); glow.position.set(0, 0.72, -0.74); body.add(glow);
  const a = new Anim(root, { pelvis, body, shield, key, legs });
  a.dynamics.push(exhaust, glow);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.3), e = k * k;
      // the legs telescope shut and it sinks to its pads, then tips forward onto its shield
      p.pelvis.position.y = PY - 0.9 * e; p.pelvis.rotation.x = 0.5 * e;
      p.legs.L.rod.position.y = -0.84 + 0.5 * e; p.legs.R.rod.position.y = -0.84 + 0.5 * e;
      p.key.rotation.x = 1.2 * e; p.shield.rotation.z = -0.3 * e;
      exhaust.visible = false; glow.material.opacity = 0.5 * (1 - k);
      return;
    }
    exhaust.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    const sk = Math.min(1, this.speed / 2.5);
    this.phase = ((this.phase || 0) + this.speed * dt * 0.36 * ts) % 1;
    const ph = this.phase * PI * 2, swing = Math.sin(ph) * 0.32 * sk;
    p.legs.L.hip.rotation.x = -swing; p.legs.R.hip.rotation.x = swing;
    p.legs.L.rod.position.y = -0.84 + Math.max(0, Math.cos(ph)) * 0.16 * sk;
    p.legs.R.rod.position.y = -0.84 + Math.max(0, -Math.cos(ph)) * 0.16 * sk;
    for (const L of [p.legs.L, p.legs.R]) L.foot.rotation.x = -L.hip.rotation.x;
    p.pelvis.position.y = PY - (1 - Math.abs(Math.cos(ph))) * 0.05 * sk + Math.sin(this.t * 1.4) * 0.012;
    p.pelvis.rotation.z = Math.sin(ph) * 0.04 * sk; p.pelvis.rotation.x = 0;
    p.body.rotation.y = Math.sin(ph) * 0.05 * sk; p.body.rotation.x = 0.04;
    let kx = 0.5 + Math.sin(this.t * 0.7) * 0.04, sy = 0;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      // the key is raised high over the cap, then brought down on the target behind the shield
      const up = at < 0.45 ? at / 0.45 : 1, down = at < 0.45 ? 0 : Math.min(1, (at - 0.45) / 0.12), rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
      kx += (-1.9 * up + 2.4 * down) * (1 - rec);
      p.body.rotation.x += (-0.06 * up + 0.14 * down) * (1 - rec);
      sy = 0.3 * up * (1 - rec);
    }
    p.key.rotation.x = kx; p.shield.rotation.y = sy;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.body.rotation.x -= this.hitT * 0.12; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  return finish(root, a, 3.4);
}

// ==========================================================================
// THE GREAT DREDGE (world boss): a dredge pontoon walking on four square spud legs, a bucket ladder off its bow (14 m)
// ==========================================================================
export function buildGreatDredge() {
  const P = pal(false), M = P.mat, G = P.glow;
  const HB = 3.2, HH = 2.8, HD = HB + HH; // the hull's bottom, height and deck
  const hullC = tided('#6c6860', 1.3, 0.3, 1801), hull2C = tided(P.paint2, 1.3, 0.3, 1802), ironC = wear(P.iron, 0.25, 1803), trimC = wear(P.trim, 0.3, 1804), woodC = wear(WOOD, 0.3, 1805), darkC = wear(DARK, 0.25, 1806);
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  const LX = 3.4, LZ = [5.4, -5.6]; // the spud legs' lines
  body.add(part((b) => {
    // the pontoon: a long deep box, a raked bow block, four plates a flank, a rubbing strake and the deck
    b.add(rb(8.0, HH, 14.4, 0.14), M, { p: [0, HB + HH / 2, -0.6], c: hull2C });
    b.add(rb(8.0, HH * 0.6, 2.0, 0.12), M, { p: [0, HB + HH * 0.55, 7.0], r: [-0.55, 0, 0], c: hull2C });
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 4; i++) b.addBuilder(pl(3.2, 1.7, 0.14, { mat: M, c: tided(i % 2 ? P.paint : '#5e5a52', 1.3 - 0.85, 0.3, i * 3 + sx), c2: hullC, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 1807 + i }), { p: [sx * 4.06, HB + 1.45, -6.0 + i * 3.6], r: [0, sx * PI / 2, 0] });
      b.add(rb(0.26, 0.3, 14.6, 0.05), 'wWood', { p: [sx * 4.1, HB + 2.55, -0.6], c: woodC });
    }
    b.add(rb(8.4, 0.24, 14.8, 0.05), 'wIron', { p: [0, HD + 0.02, -0.6], c: ironC });
    // the spud guides: a long open slot housing at each corner (two cheeks and two end blocks, square from above), so a
    // leg can slide fore and aft in it as it strides
    for (const sx of [-1, 1]) for (const lz of LZ) {
      for (const cx of [-1, 1]) b.add(rb(0.34, 1.6, 3.4, 0.06), M, { p: [sx * LX + cx * 0.78, HD + 0.8, lz], c: hullC });
      for (const cz of [-1, 1]) b.add(rb(1.9, 1.6, 0.34, 0.06), 'wIron', { p: [sx * LX, HD + 0.8, lz + cz * 1.55], c: ironC });
      b.add(rb(1.96, 0.12, 3.5, 0.03), 'wIron', { p: [sx * LX, HD + 1.62, lz], c: ironC });
    }
    // the engine house amidships: flat roof, banded, louvred vents on each flank, one big square stack off to port (a pair
    // of stack tops side by side read as two eyes from above), one gauge
    b.add(rb(4.4, 3.2, 4.6, 0.12), M, { p: [0, HD + 1.6, -0.4], c: wear(P.paint, 0.3, 1811) });
    b.add(rb(4.7, 0.22, 4.9, 0.05), 'wIron', { p: [0, HD + 3.25, -0.4], c: ironC });
    for (const y of [HD + 0.7, HD + 2.3]) b.add(rb(4.5, 0.14, 4.7, 0.04), 'wIron', { p: [0, y, -0.4], c: ironC });
    for (const sx of [-1, 1]) b.addBuilder(vent(2.4, 1.0, { frameC: darkC, glow: G, seed: 1812 }), { p: [sx * 2.22, HD + 1.5, -0.4], r: [0, sx * PI / 2, 0] });
    b.addBuilder(pl(3.6, 1.4, 0.12, { mat: M, c: hullC, c2: hull2C, trim: 'wIron', trimC: ironC, boltMat: 'wBrass', boltC: trimC, seed: 1813 }), { p: [0, HD + 1.6, 1.94] });
    b.addBuilder(stack(1.1, 3.4, { c: '#2e2e2c', trimC: ironC, seed: 1814 }), { p: [-1.1, HD + 3.3, -1.6] });
    // (the one gauge on the engine house's stern face, high on the starboard side: on the port flank it stood beside the
    // glowing vent like a lamp over a grille, a face; the flanks keep only their vents)
    gauge(b, G, [1.5, HD + 2.6, -2.79], 0.9, PI);
    // the gantry at the bow: two square posts and a flat head beam, inside the hull's width; the upper tumbler housing
    for (const sx of [-1, 1]) {
      b.add(rb(0.7, 7.6, 0.8, 0.08), 'wIron', { p: [sx * 2.2, HD + 3.8, 5.0], c: ironC });
      b.add(rb(1.0, 0.6, 1.1, 0.08), M, { p: [sx * 2.2, HD + 0.3, 5.0], c: hullC });
    }
    b.add(rb(5.2, 0.7, 1.0, 0.1), M, { p: [0, HD + 7.8, 5.0], c: wear(P.paint, 0.3, 1816) });
    b.add(rb(4.6, 0.2, 0.9, 0.04), 'wBrass', { p: [0, HD + 8.25, 5.0], c: trimC });
    b.add(rb(2.6, 1.6, 1.8, 0.1), 'wIron', { p: [0, HD + 7.0, 5.7], c: ironC });
    // the spoil chute: a flat trough off the outside of the starboard post, down over the side (outboard of the post, so
    // from the front it never crosses it), on a square iron bracket
    b.add(rb(3.4, 0.14, 1.4, 0.04), M, { p: [4.2, HD + 4.4, 5.0], r: [0, 0, -0.5], c: hull2C });
    for (const sz of [-1, 1]) b.add(rb(3.4, 0.5, 0.12, 0.03), M, { p: [4.2, HD + 4.65, 5.0 + sz * 0.66], r: [0, 0, -0.5], c: hullC });
    b.add(rb(0.5, 0.5, 1.0, 0.05), 'wIron', { p: [2.75, HD + 5.2, 5.0], c: ironC });
    // the winch house at the stern: flat roof, two solid winch drums lying across on its back deck
    b.add(rb(5.0, 2.2, 2.6, 0.1), M, { p: [0, HD + 1.1, -5.0 + 0.0], c: hullC });
    b.add(rb(5.3, 0.18, 2.9, 0.04), 'wIron', { p: [0, HD + 2.25, -5.0], c: ironC });
    for (const z of [-6.6, -7.5]) {
      b.add(cyl(0.45, 0.45, 3.6, 16), 'wIron', { p: [0, HD + 0.6, z], r: [0, 0, PI / 2], c: '#4a4844' });
      for (const sx of [-1, 1]) b.add(bdisc(0.62, 0.12, 0.04, 18), 'wIron', { p: [sx * 1.86, HD + 0.6, z], r: [0, 0, PI / 2], c: ironC });
      for (let k = 0; k < 6; k++) b.add(cyl(0.47, 0.47, 0.04, 16), 'wIron', { p: [-1.4 + k * 0.56, HD + 0.6, z], r: [0, 0, PI / 2], c: '#3a3836' });
    }
    // silt slopped over the bow deck and caked on the strakes; a tar-black band along the waterline
    silt(b, 0, HD + 0.14, 4.0, 4.0, 2.6, 14, 0.28);
    silt(b, 2.5, HD + 0.14, 1.6, 1.2, 1.4, 5, 0.2);
    silt(b, 0, HD + 3.4, -0.6, 3.4, 3.6, 8, 0.16);
    for (const sx of [-1, 1]) b.add(rb(0.12, 0.5, 14.2, 0.03), 'wDark', { p: [sx * 4.08, HB + 0.3, -0.6], c: TAR });
  }, 1817));
  // the spud legs: square iron columns through the guides, a broad square mud pad under each; they lift and stride
  const legs = [];
  const LEN = 10.2;
  [[1, LZ[0]], [-1, LZ[1]], [-1, LZ[0]], [1, LZ[1]]].forEach(([sx, lz], i) => {
    const g = pivot(root, sx * LX, 0, lz);
    g.add(part((b) => {
      b.add(rb(1.1, LEN, 1.1, 0.08), 'wIron', { p: [0, LEN / 2 + 0.3, 0], c: tided('#4e4c48', 2.0, 0.3, 1820 + i) });
      for (const y of [2.2, 4.4, 6.6, 8.8]) b.add(rb(1.2, 0.12, 1.2, 0.02), 'wIron', { p: [0, y, 0], c: '#3a3836' });
      b.add(rb(1.5, 0.3, 1.5, 0.05), 'wBrass', { p: [0, LEN + 0.3, 0], c: trimC });
      b.add(rb(2.4, 0.36, 2.4, 0.08), M, { p: [0, 0.18, 0], c: wear(SILT, 0.2, i) });
      b.add(rb(1.5, 0.3, 1.5, 0.05), 'wIron', { p: [0, 0.5, 0], c: ironC });
      silt(b, 0, 0.42, 0, 2.2, 2.2, 8, 0.2);
      silt(b, 0, 0.9, 0, 1.0, 1.0, 4, 0.16);
    }, 1824 + i));
    legs.push({ g, x: sx * LX, z: lz, pair: i < 2 ? 0 : 1 });
  });
  // the bucket ladder off the upper tumbler, down and forward to the mud
  const ladder = pivot(body, 0, HD + 6.9, 6.0);
  const LA = 0.92;
  ladder.rotation.x = LA;
  const runs = bucketLadder(ladder, 10.0, { w: 1.6, rail: 0.36, mat: M, c: hullC, c2: hull2C, iron: 'wIron', ironC, trimC, pitch: 1.3, sw: 1.3, sd: 0.95, sh: 0.7, seed: 1830 });
  const exhaust = [];
  { const e = smoke({ rate: 4.5, life: 3.0, size: 1.6, rise: 1.6, color: 0x8a8884, opacity: 0.45, spread: 0.35 }); e.position.set(-1.1, HD + 7.4, -1.6); body.add(e); exhaust.push(e); }
  const spoil = smoke({ rate: 5, life: 1.6, size: 1.4, rise: -2.6, color: 0x5a5148, opacity: 0.6, spread: 0.6 });
  spoil.position.set(5.8, HD + 3.4, 5.0); body.add(spoil);
  const spray = smoke({ rate: 0, life: 1.3, size: 2.2, rise: 0.6, color: 0x6e655a, opacity: 0.55, spread: 2.4 });
  spray.position.set(0, 0, 10.2); ladder.add(spray);
  const glow = slotGlow(P.glowHex, 0.2, 1.0, 0.55, { ry: PI }); glow.position.set(1.5, HD + 2.6, -2.86); body.add(glow);
  const a = new Anim(root, { body, ladder, legs });
  a.dynamics.push(...exhaust, glow, spoil);
  let cd = 0, ph = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 2.2), e = 1 - Math.pow(1 - k, 2);
      // the port spuds sink into the mud and it settles over onto them, the ladder dropping onto the flats
      p.body.position.y = -1.4 * e; p.body.rotation.z = 0.08 * e; p.body.rotation.x = 0.03 * e;
      for (const L of p.legs) { L.g.position.y = (L.x < 0 ? -1.6 : -0.9) * e; L.g.position.z = L.z; }
      p.ladder.rotation.x = LA + 0.2 * e;
      for (const x of exhaust) x.visible = false; spoil.visible = false; spray.visible = false;
      glow.material.opacity = 0.55 * (1 - k);
      return;
    }
    for (const x of exhaust) x.visible = true; spoil.visible = true; spray.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    const sk = Math.min(1, this.speed / 0.8);
    // the stride: two diagonal pairs; a lifted leg swings forward in its slot, a planted one slides back as the hull goes on
    ph = (ph + this.speed * dt * 0.12 * ts) % 1;
    let lift0 = 0;
    for (const L of p.legs) {
      const q = (ph + L.pair * 0.5) * PI * 2, up = Math.max(0, Math.sin(q));
      L.g.position.y = up * 0.9 * sk;
      L.g.position.z = L.z - Math.cos(q) * 1.0 * sk;
      L.g.position.x = L.x;
      if (L.pair === 0) lift0 = up;
    }
    p.body.position.y = Math.sin(ph * PI * 4) * 0.08 * sk + Math.sin(this.t * 0.6) * 0.03;
    p.body.rotation.z = (lift0 - 0.5) * 0.012 * sk; p.body.rotation.x = 0; p.body.position.z = 0;
    let lr = LA + Math.sin(this.t * 0.5) * 0.02, ly = 0, cs = 0.9, sr = 0, so = 5;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      if (this.atkKind === 'slam') {
        // the ladder is hauled right up under the gantry and dropped onto the flats
        const up = at < 0.45 ? at / 0.45 : 1, down = at < 0.45 ? 0 : Math.min(1, (at - 0.45) / 0.08), rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
        lr = LA + (-0.6 * up + 0.72 * down) * (1 - rec);
        if (down > 0 && rec === 0) { p.body.position.y -= 0.18 * Math.sin(Math.min(1, (at - 0.45) / 0.18) * PI); sr = 40; }
        cs = 3; so = 16;
      } else {
        // the ladder is lowered and swung across the front, the chain racing, and dragged back
        const set = at < 0.35 ? at / 0.35 : 1, sweep = at < 0.35 ? 0 : Math.min(1, (at - 0.35) / 0.25), rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
        lr = LA + 0.2 * set * (1 - rec);
        ly = (0.25 * set - 0.55 * sweep) * (1 - rec);
        if (sweep > 0 && rec === 0) sr = 34;
        cs = 2.6; so = 10;
      }
    }
    p.ladder.rotation.x = lr; p.ladder.rotation.y = ly;
    cd += cs * dt * ts; crawlRuns(runs, cd);
    spray.userData.rate = sr; spoil.userData.rate = so;
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z += Math.sin(this.t * 25) * this.hitT * 0.008; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
    spray.userData.update(dt, this.t);
  };
  return finish(root, a, 14.0);
}
