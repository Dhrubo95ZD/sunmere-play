// Character builder: base body + layered outfit pieces + weapons for the six classes, raiders and NPCs.
// Every humanoid is faceless: helms with dark slits, deep hoods with a dark void, or a full face wrap.
import * as THREE from 'three';
import { RigBuilder, CHAINS, charMat } from './rig.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Builder, rbox, box, cyl, cone, sphere, ico, torus, lathe, extrude, tube, gear, lerp, sstep, clamp, rgb, V3 } from './kit.js';
import { lanternBuilder } from './dynamic.js';
import { heatObject, heatCharMat, upgAttr, fillUpg, upgCover } from './heat.js';
import { parseLook } from '/sunmere-play/shared/items.js';
import { heroRig, heroOn } from './hero/heroBody.js';

const PI = Math.PI;

// --------------------------------------------------------------------------
// geometry helpers
// tapered limb hanging down from the bone origin (bottom -> top profile)
function limb(rTop, rBot, L, seg = 12) {
  return lathe([[0.001, -L], [rBot * 0.75, -L + 0.012], [rBot, -L * 0.9], [lerp(rTop, rBot, 0.45) * 1.03, -L * 0.5], [rTop, -L * 0.12], [rTop * 0.75, -0.005], [0.001, 0.01]], seg);
}
// shell around a body section (open tube, lathe profile [r, y] bottom->top), squashed in depth
function shell(profile, seg = 20) { return lathe(profile, seg); }
const dome = (r, seg = 16) => sphere(r, seg, Math.max(6, seg / 2), 0, PI * 2, 0, PI / 2);

// weights for the torso: hips -> spine -> chest by height
function torsoW(y) {
  if (y < 1.07) return [['hips', 1]];
  if (y < 1.2) { const t = (y - 1.07) / 0.13; return [['hips', 1 - t], ['spine', t]]; }
  if (y < 1.38) { const t = (y - 1.2) / 0.18; return [['spine', 1 - t], ['chest', t]]; }
  return [['chest', 1]];
}
// robe skirt: follows hips at the top, blends into the legs on each side lower down
function robeW(side) {
  return (x, y) => {
    // (S0 review) the new body's legs stride further than the old body's (the UAL run clips): its robes, coat tails and
    // skirts follow the legs more, or the front leg pushed through the cloth on every run step
    const H = heroOn();
    const t = clamp((1.0 - y) / (H ? 0.6 : 0.9), 0, 1);
    const sx = clamp(x / (H ? 0.09 : 0.12), -1, 1); // -1 right .. +1 left
    const wl = clamp(0.5 + sx * 0.5, 0, 1), wr = 1 - wl;
    const legK = H ? Math.sqrt(t) * 0.92 : t * 0.75;
    const out = [['hips', 1 - legK]];
    const shinK = sstep(0.45, 1, t);
    if (wl > 0) { out.push(['thighL', legK * wl * (1 - shinK * 0.5)]); out.push(['shinL', legK * wl * shinK * 0.5]); }
    if (wr > 0) { out.push(['thighR', legK * wr * (1 - shinK * 0.5)]); out.push(['shinR', legK * wr * shinK * 0.5]); }
    return out;
  };
}

// --------------------------------------------------------------------------
// base body (under-suit, hands, boots, head). opts: colours + bulk
function baseBody(rb, o) {
  if (rb.hero) { rb.hero.body(rb, o); return; } // the new skinned body (hero/heroBody.js, ?herobody=1): region colours from o
  const bulk = o.bulk ?? 1;
  const suit = o.suit ?? '#3a3550';
  // torso (the rig's V-taper widens the chest and shoulders over the waist)
  rb.addW(shell([[0.15 * bulk, 0.96], [0.19 * bulk, 1.05], [0.175 * bulk, 1.17], [0.205 * bulk, 1.32], [0.235 * bulk, 1.44], [0.215 * bulk, 1.53], [0.13, 1.6], [0.06, 1.64]], 18), 'cloth',
    (x, y) => torsoW(y), { s: [1, 1, 0.66], c: suit, ao: [0.95, 1.4, 0.75] });
  // pelvis
  rb.add(rbox(0.32 * bulk, 0.2, 0.22, 0.06), 'cloth', 'hips', { p: [0, -0.04, 0], c: o.pants ?? suit });
  // neck wrapped in the suit's cloth, head dark (always covered)
  rb.add(cyl(0.068, 0.08, 0.16, 12), 'cloth', 'neck', { p: [0, 0.02, 0], c: o.neck ?? shadeHex(suit, 0.55) });
  rb.add(sphere(0.115, 14, 10), 'dark', 'head', { p: [0, 0.1, 0.01], s: [0.95, 1.08, 1] });
  // arms
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? 1 : -1;
    const ax = rb.rest['arm' + s][0], ay = rb.rest['arm' + s][1];
    // deltoid: blends from the chest into the upper arm (no ball joint)
    rb.addW(sphere(0.094 * bulk, 14, 10), 'cloth', (x) => {
      const t = clamp((Math.abs(x) - (Math.abs(ax) - 0.07)) / 0.12, 0, 1);
      return [['chest', 0.5 * (1 - t)], ['arm' + s, 0.5 + 0.5 * t]];
    }, { p: [ax - sx * 0.012, ay - 0.012, 0], s: [1.12, 0.92, 1.05], c: o.sleeve ?? suit, taper: false });
    rb.add(limb(0.082 * bulk, 0.066 * bulk, 0.3), 'cloth', 'arm' + s, { c: o.sleeve ?? suit });
    rb.add(lathe([[0.001, -0.28], [0.052 * bulk, -0.268], [0.057 * bulk, -0.24], [0.068 * bulk, -0.13], [0.07 * bulk, -0.04], [0.052 * bulk, -0.005], [0.001, 0.01]], 12), 'cloth', 'fore' + s, { c: o.sleeve ?? suit });
    fist(rb, s, o.glove ?? '#4a3424', o.gloveKind ?? 'leather');
    // legs
    rb.add(limb(0.1 * bulk, 0.075 * bulk, 0.45), 'cloth', 'thigh' + s, { c: o.pants ?? suit });
    rb.add(sphere(0.07 * bulk, 10, 8), 'cloth', 'shin' + s, { c: o.pants ?? suit });
    rb.add(limb(0.075 * bulk, 0.058 * bulk, 0.44), 'cloth', 'shin' + s, { c: o.pants ?? suit });
    boot(rb, s, o.boot ?? '#4a3220', o.bootKind ?? 'leather');
  }
}
// darken a '#rrggbb' colour
function shadeHex(h, k) {
  const n = parseInt(h.slice(1), 16);
  const f = (v) => Math.round(Math.min(255, v * k)).toString(16).padStart(2, '0');
  return '#' + f((n >> 16) & 255) + f((n >> 8) & 255) + f(n & 255);
}

function fist(rb, s, color, kind = 'leather') {
  const mat = kind === 'metal' ? 'metal' : 'leather';
  const bone = 'hand' + s;
  const sx = s === 'L' ? 1 : -1; // +sx = outer (back of the hand), -sx = inner (palm, thumb)
  // heroic hands: every part scaled x1.25 about the grip centre (0, -0.06, 0.02), so weapons still sit in the fist
  const K = 1.25;
  const at = (p) => [p[0] * K, -0.06 + (p[1] + 0.06) * K, 0.02 + (p[2] - 0.02) * K];
  const put = (geo, m, o) => rb.add(geo, m, bone, { ...o, p: at(o.p), s: K });
  // weapons sit on a grip line through (0, -0.06) running along +Z (blade end), so the fist closes around it:
  // four curled fingers as rings round the grip (index at the blade end), gap toward the palm
  const gapAng = Math.atan2(0.86, -sx * 0.5);
  const fingers = [[0.033, 0.0275, 0.0118], [0.011, 0.028, 0.012], [-0.011, 0.0272, 0.0115], [-0.032, 0.025, 0.0105]];
  for (const [dz, R, r] of fingers) put(torus(R, r, 7, 12, PI * 1.55), mat, { p: [0, -0.06, 0.02 + dz], r: [0, 0, gapAng + PI * 0.225], c: color });
  // palm and back of the hand, rounded, from the wrist down onto the fingers
  put(rbox(0.072, 0.08, 0.104, 0.028), mat, { p: [sx * 0.012, -0.028, 0.02], c: color });
  // thumb wrapped over the index finger on the inner side
  put(rbox(0.024, 0.054, 0.026, 0.011), mat, { p: [-sx * 0.03, -0.042, 0.054], r: [0.5, 0, sx * 0.32], c: color });
  put(sphere(0.014, 8, 6), mat, { p: [-sx * 0.022, -0.068, 0.07], c: color });
  if (kind === 'metal') {
    // gauntlet: a plate over the back of the hand and a ridge over the knuckles
    put(rbox(0.026, 0.076, 0.104, 0.01), 'metal', { p: [sx * 0.044, -0.034, 0.02], c: color });
    put(cyl(0.013, 0.013, 0.1, 8), 'metal', { p: [sx * 0.03, -0.074, 0.02], r: [PI / 2, 0, 0], c: color });
  }
}

function boot(rb, s, color, kind = 'leather') {
  const mat = kind === 'metal' ? 'metal' : 'leather';
  const bone = 'foot' + s;
  rb.add(rbox(0.135, 0.1, 0.31, 0.042), mat, bone, { p: [0, -0.03, 0.065], c: color });
  rb.add(rbox(0.125, 0.06, 0.12, 0.024), mat, bone, { p: [0, -0.04, 0.175], r: [0.16, 0, 0], c: color }); // raised toe cap
  rb.add(rbox(0.14, 0.025, 0.32, 0.01), 'leather', bone, { p: [0, -0.075, 0.065], c: '#2a1c12' }); // sole
  if (kind !== 'metal') rb.add(limb(0.08, 0.075, 0.24, 12), mat, 'shin' + s, { p: [0, -0.2, 0], c: color }); // boot shaft
  else {
    rb.add(limb(0.085, 0.078, 0.26, 12), 'metal', 'shin' + s, { p: [0, -0.18, 0], c: color });
    for (let i = 0; i < 3; i++) rb.add(rbox(0.125, 0.03, 0.08, 0.01), 'metal', bone, { p: [0, -0.005 + i * 0.008, 0.1 + i * 0.05], r: [0.25, 0, 0], c: color });
  }
  rb.add(torus(0.08, 0.012, 6, 16), mat === 'metal' ? 'metal' : 'leather', 'shin' + s, { p: [0, -0.2, 0], r: [PI / 2, 0, 0], c: kind === 'metal' ? '#e8b84a' : '#3a2616' });
}

// --------------------------------------------------------------------------
// outfit pieces
function belt(rb, color = '#5a3a22', buckle = '#e8b84a', pouches = 2) {
  rb.add(torus(0.205, 0.035, 6, 28), 'leather', 'hips', { p: [0, 0.0, 0], r: [PI / 2, 0, 0], s: [1, 0.66, 1], c: color });
  rb.add(rbox(0.09, 0.075, 0.03, 0.012), 'metal', 'hips', { p: [0, 0.0, 0.142], c: buckle });
  rb.add(rbox(0.05, 0.035, 0.02, 0.008), 'leather', 'hips', { p: [0, 0.0, 0.158], c: color });
  for (let i = 0; i < pouches; i++) {
    const a = PI * 0.55 + i * 0.5;
    const sx = i % 2 ? -1 : 1;
    rb.add(rbox(0.09, 0.11, 0.06, 0.02), 'leather', 'hips', { p: [sx * 0.19, -0.05, 0.03 - i * 0.04], r: [0, sx * 0.9, 0], c: '#6a4a2c' });
    rb.add(rbox(0.095, 0.035, 0.065, 0.01), 'leather', 'hips', { p: [sx * 0.19, 0.005, 0.03 - i * 0.04], r: [0, sx * 0.9, 0], c: '#4e3420' });
  }
}

// layered plate pauldron: partial dome (open toward the neck) with its rim built in the same frame
function plateGeo(r, sx, sy, sz, rimR, side = 0, spanK = 1.35) {
  // side: +1 left (outer = +x), -1 right (outer = -x), 0 full; spanK: how far round the arm a side plate reaches (x PI)
  const span = side ? PI * spanK : PI * 2;
  const phi0 = side > 0 ? PI - span / 2 : side < 0 ? -span / 2 : 0;
  const d = sphere(r, 20, 9, phi0, span, 0, PI / 2);
  d.scale(sx, sy, sz);
  const t = torus(r, rimR, 6, 28, span);
  t.rotateX(PI / 2);
  // torus angle a = PI - phi; start of arc must land on PI - (phi0 + span)
  t.rotateY(side ? -(PI - phi0 - span) : 0);
  t.scale(sx, 1, sz);
  return [d, t];
}
function pauldron(rb, s, o) {
  const sx = s === 'L' ? 1 : -1;
  const bone = 'arm' + s;
  const metal = o.metal, trim = o.trim;
  const big = o.size ?? 1;
  // big top dome + overlapping lower lames (own mesh, hidden while worn shoulder armour covers it)
  const plates = [[0.155, 0.03, 0.075, 0.32], [0.13, 0.06, -0.01, 0.62], [0.115, 0.085, -0.075, 0.86]].slice(0, o.lames ?? 2);
  for (const [r0, ox, oy, rz] of plates) {
    const r = r0 * big;
    const p = [sx * ox * big, oy * big, 0];
    const rot = [0, 0, -sx * rz];
    const [d, t] = plateGeo(r, 1.06, 0.58, 1.16, 0.009 * big, sx);
    rb.add(d, 'pmetal', bone, { p, r: rot, c: metal, paint: 0.5, us: 1.2 });
    rb.add(t, 'pmetal', bone, { p, r: rot, c: trim, paint: 0.3 });
  }
  if (o.gem) {
    rb.add(cyl(0.04 * big, 0.04 * big, 0.02, 12), 'pmetal', bone, { p: [sx * 0.07 * big, 0.135 * big, 0.06 * big], r: [0.9, 0, -sx * 0.5], c: trim });
    // (a polished stone that does not glow: two glowing blue points, one on each shoulder, broke "no glow on characters",
    // combat_design 10.2; review 18 Nov)
    rb.add(ico(0.026 * big, 0), 'pmetal', bone, { p: [sx * 0.075 * big, 0.143 * big, 0.067 * big], c: o.gem });
  }
  if (o.spike) rb.add(cone(0.035 * big, 0.12 * big, 8), 'pmetal', bone, { p: [sx * 0.08 * big, 0.16 * big, 0], r: [0, 0, -sx * 0.5], c: trim });
}

function leatherPauldron(rb, s, color, trim = '#3a2616') {
  const sx = s === 'L' ? 1 : -1;
  const [d, t] = plateGeo(0.12, 1, 0.6, 1.1, 0.01, sx);
  rb.add(d, 'pleather', 'arm' + s, { p: [sx * 0.02, 0.05, 0], r: [0, 0, -sx * 0.4], c: color });
  rb.add(t, 'pleather', 'arm' + s, { p: [sx * 0.02, 0.05, 0], r: [0, 0, -sx * 0.4], c: trim });
}

function breastplate(rb, metal, trim, { heavy = false } = {}) {
  const k = heavy ? 1.1 : 1;
  rb.addW(shell([[0.2 * k, 1.1], [0.205 * k, 1.2], [0.235 * k, 1.33], [0.255 * k, 1.44], [0.24 * k, 1.52], [0.17, 1.58]], 22), 'metal', (x, y) => torsoW(y), { s: [1, 1, 0.7], c: metal, paint: 0.5, ao: [1.05, 1.5, 0.7] });
  // central ridge + trims
  rb.addW(torus(0.235 * k, 0.012, 6, 28), 'metal', (x, y) => torsoW(y), { p: [0, 1.11, 0], r: [PI / 2, 0, 0], s: [0.86, 0.6, 1], c: trim });
  rb.addW(torus(0.175, 0.014, 6, 28), 'metal', () => [['chest', 1]], { p: [0, 1.575, 0], r: [PI / 2, 0, 0], s: [1, 0.72, 1], c: trim });
  // abdomen bands (fauld)
  for (let i = 0; i < 3; i++) {
    const y = 1.06 - i * 0.055;
    rb.addW(shell([[0.215 * k + i * 0.012, y - 0.045], [0.21 * k + i * 0.01, y]], 22), 'metal', () => [['hips', 1]], { s: [1, 1, 0.72], c: i === 2 ? trim : metal });
  }
  // embossed diamond on the chest
  rb.addW(rbox(0.07, 0.07, 0.02, 0.008), 'metal', () => [['chest', 1]], { p: [0, 1.42, 0.178 * k], r: [0, 0, PI / 4], c: trim });
}

function tassets(rb, metal, trim) {
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? 1 : -1;
    for (let i = 0; i < 2; i++) {
      rb.add(rbox(0.17, 0.11, 0.035, 0.02), 'metal', 'thigh' + s, { p: [sx * 0.03, -0.07 - i * 0.09, 0.07], r: [-0.15, 0, sx * 0.1], c: metal });
      rb.add(box(0.17, 0.015, 0.038), 'metal', 'thigh' + s, { p: [sx * 0.03, -0.122 - i * 0.09, 0.075], r: [-0.15, 0, sx * 0.1], c: trim });
    }
  }
}

function greaves(rb, metal, trim) {
  for (const s of ['L', 'R']) {
    rb.add(shell([[0.075, -0.4], [0.085, -0.2], [0.09, -0.06], [0.07, 0.02]], 14), 'metal', 'shin' + s, { s: [1, 1, 1.05], c: metal });
    rb.add(sphere(0.075, 12, 8, 0, PI * 2, 0, PI * 0.6), 'metal', 'shin' + s, { p: [0, 0.01, 0.03], r: [0.5, 0, 0], c: metal });
    rb.add(torus(0.08, 0.01, 6, 16), 'metal', 'shin' + s, { p: [0, -0.05, 0.035], r: [0.5, 0, 0], s: [1, 1, 1], c: trim });
    rb.add(shell([[0.1, -0.38], [0.108, -0.2], [0.1, -0.02]], 14), 'metal', 'thigh' + s, { c: metal });
  }
}

function gauntlets(rb, metal, trim) {
  for (const s of ['L', 'R']) {
    rb.add(shell([[0.065, -0.27], [0.078, -0.2], [0.094, -0.13], [0.074, -0.05]], 14), 'metal', 'fore' + s, { c: metal, paint: 0.4 });
    rb.add(torus(0.094, 0.012, 6, 16), 'metal', 'fore' + s, { p: [0, -0.13, 0], r: [PI / 2, 0, 0], c: trim });
    rb.add(shell([[0.085, -0.22], [0.09, -0.05], [0.08, 0.02]], 14), 'metal', 'arm' + s, { c: metal, paint: 0.4 });
    rb.add(sphere(0.07, 12, 8, 0, PI * 2, 0, PI * 0.6), 'metal', 'fore' + s, { p: [0, 0.01, -0.02], r: [-0.5, 0, 0], c: metal });
  }
}

function bracers(rb, color, trim = '#3a2616') {
  for (const s of ['L', 'R']) {
    rb.add(shell([[0.058, -0.26], [0.068, -0.18], [0.072, -0.07], [0.062, -0.03]], 12), 'leather', 'fore' + s, { c: color });
    for (const y of [-0.09, -0.19]) rb.add(torus(0.068, 0.008, 5, 14), 'leather', 'fore' + s, { p: [0, y, 0], r: [PI / 2, 0, 0], c: trim });
  }
}

// hanging panel (tabard / loincloth) on a chain. side: 'F' | 'B'
function tabard(rb, side, color, trim, { w = 0.32, len = 0.62, emblem = null, point = true } = {}) {
  const chain = side === 'F' ? CHAINS.tabF : CHAINS.tabB;
  const z = side === 'F' ? 0.165 : -0.165;
  const top = rb.rest[chain[0]][1];
  const rows = 8, cols = 4;
  const pos = [], idx = [];
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    for (let i = 0; i <= cols; i++) {
      const u = i / cols - 0.5;
      const ww = w * lerp(1, 0.92, t);
      const yy = top + 0.02 - t * len - (point ? (1 - Math.abs(u) * 2) * 0.1 * (t > 0.85 ? (t - 0.85) / 0.15 : 0) : 0);
      const bulge = Math.cos(u * PI) * 0.03 * (1 - t * 0.5);
      pos.push(u * ww, yy, z + (side === 'F' ? 1 : -1) * (bulge + t * 0.02));
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + cols + 1;
    if (side === 'F') idx.push(a, b, a + 1, b, b + 1, a + 1); else idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const wfn = rb.chainWeights(chain, 'hips');
  rb.addW(g, 'cloth', wfn, { c: color, paint: 0.1, us: 1.2 });
  // gold edges
  for (const sx of [-1, 1]) {
    const e = new THREE.CylinderGeometry(0.009, 0.009, len - 0.02, 5, 6);
    rb.addW(e, 'metal', wfn, { p: [sx * (w / 2 - 0.004), top + 0.02 - len / 2, z + (side === 'F' ? 0.012 : -0.012)], c: trim });
  }
  if (emblem) {
    const ey = top - 0.2, ez = z + (side === 'F' ? 0.03 : -0.03);
    rb.addW(cyl(0.06, 0.06, 0.012, 20), 'metal', wfn, { p: [0, ey, ez], r: [PI / 2, 0, 0], c: trim });
    if (emblem === 'sun') rb.addW(rbox(0.13, 0.024, 0.014, 0.004), 'metal', wfn, { p: [0, ey - 0.085, ez], c: trim });
    if (emblem === 'diamond') rb.addW(rbox(0.1, 0.1, 0.012, 0.005), 'metal', wfn, { p: [0, ey, ez + 0.004], r: [0, 0, PI / 4], c: trim });
  }
}

// flowing cape on the cape chain. o: outer, inner, len, w0, w1, tattered, out, clasp, hem ('point' | 'round' | 'flat'),
// border (colour of a rolled border on the sides and hem), kind (part kind for the cloth; the class's own cape is 'ccape'),
// trimKind (part kind for the border), q (worn cloak quality: q4+ extra border stripes)
function capePoint(o, u, t, offset) {
  const top = o.top, len = o.len, w0 = o.w0, w1 = o.w1;
  const w = lerp(w0, w1, t);
  const ang = u * lerp(2.2, 1.4, t);
  const R = lerp(0.2, 0.34, t);
  let x = Math.sin(ang) * R * (w / (R * 1.6));
  let z = -(o.z0 ?? 0.17) - (Math.cos(ang) * R - R) * 0.9 - t * 0.12 - offset - (o.out || 0) * (1 + t);
  // long vertical folds, deeper toward the hem
  z -= Math.sin((u + 0.5) * PI * 2 * 3) * 0.016 * sstep(0.05, 0.8, t);
  // outer corners fold forward so the lining shows
  const c = sstep(0.3, 0.5, Math.abs(u)) * sstep(0.35, 1, t);
  z += c * 0.09; x *= 1 - c * 0.06;
  let y = top + 0.02 - t * len;
  const tat = o.tattered ? (Math.sin(Math.round((u + 0.5) * 8) * 2.7) * 0.5 + 0.5) * 0.12 * (t > 0.9 ? 1 : 0) : 0;
  y += tat;
  // shaped hem: a shallow point (or a rounded scallop) at the centre
  if (!o.tattered && o.hem !== 'flat') y -= (o.hem === 'round' ? 0.05 * Math.cos(u * PI) : 0.07 * (1 - (2 * u) ** 2)) * sstep(0.75, 1, t);
  return [x, y, z];
}
function cape(rb, o) {
  const chain = CHAINS.cape;
  const kind = o.kind ?? 'ccape', trimKind = o.trimKind ?? kind;
  const P = { ...o, top: rb.rest.cape0[1], len: o.len ?? 1.15, w0: o.w0 ?? 0.46, w1: o.w1 ?? 0.72 };
  const wfn = rb.chainWeights(chain, 'chest');
  const rows = 14, cols = 24;
  const sheet = (Q, offset, color, flip, aoK = 0.84) => {
    const pos = [], idx = [], col = [];
    for (let j = 0; j <= rows; j++) {
      const t = j / rows;
      for (let i = 0; i <= cols; i++) {
        const u = i / cols - 0.5;
        pos.push(...capePoint(Q, u, t, offset));
      }
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i, b = a + cols + 1;
      if (flip) idx.push(a, a + 1, b, b, a + 1, b + 1); else idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const base = rgb(color);
    // soft AO in the inner folds through the vertex colour
    rb.addW(g, kind, wfn, {
      c: (x, y, z) => {
        const u = clamp(x / Math.max(0.1, lerp(Q.w0, Q.w1, clamp((Q.top - y) / Q.len, 0, 1))), -0.5, 0.5);
        const fold = Math.sin((u + 0.5) * PI * 2 * 3);
        const k = lerp(1, aoK, Math.max(0, -fold) * sstep(0.05, 0.6, (Q.top - y) / Q.len));
        return [base[0] * k, base[1] * k, base[2] * k];
      }, paint: 0.08, us: 1.2, ao: [Q.top - Q.len, Q.top - Q.len * 0.4, 0.75],
    });
  };
  // a rolled border along both sides and the hem (and a second, embroidered line inside it)
  const edge = (Q, offset, inset, r, color, k = trimKind) => {
    const pts = [];
    const du = inset / Math.max(0.2, Q.w1), dt = inset / Q.len;
    const t1 = 1 - dt, ul = -0.5 + du, ur = 0.5 - du, t0 = 0.02 + dt;
    for (let j = 0; j <= 10; j++) pts.push(capePoint(Q, ul, lerp(t0, t1, j / 10), offset));
    for (let i = 1; i < 16; i++) pts.push(capePoint(Q, lerp(ul, ur, i / 16), t1, offset));
    for (let j = 10; j >= 0; j--) pts.push(capePoint(Q, ur, lerp(t0, t1, j / 10), offset));
    const g = tube(pts.map((p) => V3(...p)), r, 6, 90, { capEnd: true, capStart: true });
    rb.addW(g, k, wfn, { uv: 'keep', c: color, paint: 0.2 });
  };
  sheet(P, 0.012, o.outer, false);
  sheet(P, 0.0, o.inner, true);
  // the border thickens with quality; q3 adds an inner line in the quality colour, q4 a second gold one inside it
  if (o.border) edge(P, 0.006, 0, o.q ? [0, 0.013, 0.018, 0.022, 0.024, 0.024, 0.024][o.q] : 0.01, o.border);
  if (o.q >= 3 && o.q < 5) edge(P, 0.019, 0.055, 0.008, o.border || '#e8c060');
  if (o.q === 4) edge(P, 0.019, 0.1, 0.0055, '#e8c060');
  if (o.q >= 5) edge(P, 0.019, 0.06, 0.0055, '#e8c060');
  // (no shoulder mantle on q5: seen from the top-down camera its rounded, pleated hem fanned out round the neck like
  // a crescent or rays; the legendary cloak stands out by its colours, thickest border, gold stripe)
  // clasps at the collar, on top of the shoulders in front (square plates: round gold discs either side of the neck
  // read as medallions)
  const clasps = [[0.155, 1.585, 0.05], [-0.155, 1.585, 0.05]];
  if (o.clasp) for (const p of clasps) rb.addW(rbox(0.056, 0.02, 0.056, 0.006), o.claspKind ?? 'metal', () => [['chest', 1]], { p, r: [PI / 2 - 0.5, 0, 0], c: o.clasp });
  // (no collar cord: v107 review, the gold cord between the clasps with a round gem at its centre read as a ring round
  // the neck with a medallion, a disc inside a ring; it is gone for every class and quality)
}

function robeSkirt(rb, color, trim, { len = 0.92, flare = 0.36 } = {}) {
  const g = new THREE.CylinderGeometry(0.215, flare, len, 22, 8, true);
  g.translate(0, 1.02 - len / 2, 0);
  // gentle folds
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
    const a = Math.atan2(z, x), t = (1.02 - y) / len;
    const f = 1 + Math.sin(a * 9) * 0.035 * t;
    p.setX(i, x * f); p.setZ(i, z * f * 0.85);
  }
  g.computeVertexNormals();
  rb.addW(g, 'cloth', robeW(), { c: color, ao: [0.1, 0.9, 0.7] });
  // hem trim
  const hem = new THREE.TorusGeometry(flare * 0.99, 0.014, 5, 32);
  hem.rotateX(PI / 2);
  hem.scale(1, 1, 0.85);
  hem.translate(0, 1.02 - len + 0.01, 0);
  rb.addW(hem, 'metal', robeW(), { c: trim });
  rb.hero?.robe(rb, 1.02 - len); // the new body: no thighs through the robe on a run
}

function robeTop(rb, color, trim, sleeveColor) {
  rb.addW(shell([[0.21, 0.96], [0.215, 1.1], [0.235, 1.3], [0.25, 1.44], [0.23, 1.53], [0.15, 1.6]], 20), 'cloth', (x, y) => torsoW(y), { s: [1, 1, 0.7], c: color });
  // twin embroidered lapels (no single centre strip)
  for (const sx of [-1, 1]) {
    rb.addW(box(0.03, 0.5, 0.012), 'metal', (x, y) => torsoW(y), { p: [sx * 0.07, 1.3, 0.172], r: [-0.08, 0, sx * 0.12], c: trim });
  }
  // wide sleeves
  for (const s of ['L', 'R']) {
    rb.add(shell([[0.13, -0.27], [0.11, -0.18], [0.08, -0.06], [0.07, 0.0]], 14), 'cloth', 'fore' + s, { c: sleeveColor ?? color });
    rb.add(torus(0.128, 0.012, 5, 18), 'metal', 'fore' + s, { p: [0, -0.265, 0], r: [PI / 2, 0, 0], c: trim });
    rb.add(shell([[0.085, -0.3], [0.095, -0.1], [0.09, 0.02]], 14), 'cloth', 'arm' + s, { c: sleeveColor ?? color });
  }
}

function clothShoulders(rb, color, trim) {
  // soft cowl around the collar
  rb.addW(shell([[0.2, 1.5], [0.19, 1.55], [0.15, 1.6], [0.1, 1.645]], 22), 'cloth', () => [['chest', 1]], { s: [1, 1, 0.8], c: color, paint: 0.25 });
  rb.addW(torus(0.198, 0.016, 6, 30), 'cloth', () => [['chest', 1]], { p: [0, 1.5, 0], r: [PI / 2, 0, 0], s: [1, 0.8, 1], c: color });
  if (trim) rb.addW(torus(0.2, 0.007, 5, 30), 'metal', () => [['chest', 1]], { p: [0, 1.488, 0], r: [PI / 2, 0, 0], s: [1, 0.8, 1], c: trim });
}

// helm types (all faceless)
function greatHelm(rb, metal, trim) {
  rb.add(lathe([[0.01, -0.02], [0.135, -0.02], [0.145, 0.06], [0.147, 0.16], [0.128, 0.23], [0.075, 0.265], [0.01, 0.272]], 22), 'metal', 'head', { s: [1, 1, 1.06], c: metal, paint: 0.45, us: 1.2 });
  // flat face plate with a recessed eye slit between a brow ridge and a lower plate
  rb.add(rbox(0.2, 0.2, 0.05, 0.02), 'metal', 'head', { p: [0, 0.08, 0.13], c: metal, paint: 0.4, us: 1.2 });
  rb.add(rbox(0.215, 0.034, 0.06, 0.012), 'metal', 'head', { p: [0, 0.158, 0.135], c: trim });
  rb.add(box(0.17, 0.026, 0.03), 'dark', 'head', { p: [0, 0.133, 0.147] });
  rb.add(rbox(0.18, 0.02, 0.055, 0.008), 'metal', 'head', { p: [0, 0.112, 0.14], c: metal, paint: 0.4 });
  rb.add(torus(0.146, 0.011, 6, 26), 'metal', 'head', { p: [0, -0.012, 0], r: [PI / 2, 0, 0], s: [1, 1.06, 1], c: trim });
  rb.add(rbox(0.05, 0.05, 0.02, 0.006), 'metal', 'head', { p: [0, 0.215, 0.13], r: [-0.45, 0, PI / 4], c: trim });
  // crest ridge front-to-back over the top
  rb.add(torus(0.14, 0.01, 6, 20, PI), 'metal', 'head', { p: [0, 0.13, 0], r: [0, PI / 2, 0], s: [1, 1, 1.06], c: trim });
  // and a raised ridge along the flat top, so from straight above the crest runs front to back across the dome instead of
  // a short dash inside a dome in a gold ring (review 18 Nov; it stops short of the brow, so no upright line meets the
  // brow bar from the front)
  rb.add(rbox(0.024, 0.03, 0.17, 0.008), 'metal', 'head', { p: [0, 0.272, -0.01], c: trim });
}

function bucketHelm(rb, metal, trim, { stepped = false } = {}) {
  rb.add(lathe([[0.01, -0.03], [0.15, -0.03], [0.155, 0.12], [0.15, 0.22], [0.13, 0.26], [0.01, 0.27]], 20), 'metal', 'head', { s: [1, 1, 1.05], c: metal, paint: 0.3 });
  rb.add(box(0.22, 0.026, 0.06), 'dark', 'head', { p: [0, 0.13, 0.145] });
  // (review 18 Nov, from straight above) no trim band round the top edge: the flat top inside it read as a disc in a ring
  // with the lathe's centre point as a dot. A straight ridge runs front to back over the top instead, and the boss on the
  // brow is a plain metal rivet (a single glowing blue stone in the middle of the face read as an eye)
  rb.add(rbox(0.03, 0.022, 0.27, 0.008), 'metal', 'head', { p: [0, 0.27, 0.0], s: [1, 1, 1.05], c: trim });
  rb.add(torus(0.152, 0.016, 6, 24), 'metal', 'head', { p: [0, -0.02, 0], r: [PI / 2, 0, 0], s: [1, 1.05, 1], c: trim });
  rb.add(rbox(0.07, 0.07, 0.025, 0.008), 'metal', 'head', { p: [0, 0.06, 0.155], r: [0, 0, PI / 4], c: trim });
  rb.add(ico(0.018, 0), 'metal', 'head', { p: [0, 0.06, 0.168], c: trim });
  // gorget (a stepped, two-shell gorget on the heavy helm)
  rb.add(shell([[0.2, -0.12], [0.17, -0.06], [0.12, -0.02]], 18), 'metal', 'neck', { p: [0, 0, 0], s: [1, 1, 0.85], c: metal });
  if (stepped) {
    rb.add(shell([[0.255, -0.17], [0.235, -0.13], [0.2, -0.1]], 22), 'metal', 'neck', { s: [1, 1, 0.82], c: metal, paint: 0.5 });
    // (no trim rings on the two shells: from above they made concentric bronze bands round the helm, review 18 Nov)
  }
}

// hood shell deform: soft point at the back of the crown, and the cowl flares out at the bottom
function hoodDeform(x, y, z, pointed) {
  if (z < 0 && y > 0) z = z - pointed * Math.pow(y / 0.168, 1.5) * (-z / 0.168);
  if (y < -0.04) { const k = 1 + (-0.04 - y) * 1.6; x *= k; z *= k; }
  return [x, y, z];
}
function hood(rb, color, { fur = null, trim = null, pointed = 0.08 } = {}) {
  // hood shell: sphere with a tall oval opening at the front (phi 0.5PI is +z); a brow drapes over the top of the opening
  const open = PI * 0.62, browT = PI * 0.15;
  const HP = { p: [0, 0.11, -0.012], s: [1.02, 1.12, 1.08] };
  const deform = (g) => {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, ...hoodDeform(p.getX(i), p.getY(i), p.getZ(i), pointed));
    g.computeVertexNormals();
    return g;
  };
  const shellG = (r) => {
    const a = deform(new THREE.SphereGeometry(r, 26, 16, PI * 0.5 + open / 2, PI * 2 - open, 0, PI * 0.8));
    const b = deform(new THREE.SphereGeometry(r, 8, 4, PI * 0.5 - open / 2, open, 0, browT));
    return mergeGeometries([a.toNonIndexed(), b.toNonIndexed()], false);
  };
  rb.add(shellG(0.168), 'cloth', 'head', { ...HP, c: color, paint: 0.25 });
  // inner lining a shade darker, so the opening reads as depth
  const inner = shellG(0.158);
  inner.scale(-1, 1, 1);
  rb.add(inner, 'cloth', 'head', { ...HP, c: '#141010', paint: 0 });
  // dark void filling the opening (no face)
  rb.add(sphere(0.13, 16, 12), 'dark', 'head', { p: [0, 0.1, 0.0], s: [0.95, 1.08, 0.95] });
  // rolled lip that follows the opening's own edge (flush, no separate hoop), drooping at the brow
  const R = 0.164, lipPts = [];
  const pt = (phi, th) => V3(...hoodDeform(-R * Math.cos(phi) * Math.sin(th), R * Math.cos(th), R * Math.sin(phi) * Math.sin(th), pointed));
  const pa = PI * 0.5 - open / 2, pb = PI * 0.5 + open / 2, th1 = PI * 0.78;
  for (let i = 0; i <= 8; i++) lipPts.push(pt(pa, lerp(th1, browT + 0.06, i / 8)));
  for (let i = 1; i < 8; i++) lipPts.push(pt(lerp(pa, pb, i / 8), browT + 0.03 + Math.sin((i / 8) * PI) * 0.035));
  for (let i = 0; i <= 8; i++) lipPts.push(pt(pb, lerp(browT + 0.06, th1, i / 8)));
  rb.add(tube(lipPts, 0.015, 6, 60, { capEnd: true, capStart: true }), 'cloth', 'head', { ...HP, uv: 'keep', c: color, paint: 0.35 });
  if (trim) rb.add(tube(lipPts.map((v) => v.clone().multiplyScalar(1.045)), 0.0055, 5, 60, { capEnd: true, capStart: true }), 'metal', 'head', { ...HP, uv: 'keep', c: trim });
  // drape onto shoulders
  rb.addW(shell([[0.27, 1.45], [0.23, 1.52], [0.16, 1.6], [0.12, 1.67]], 22), 'cloth', (x, y) => (y > 1.62 ? [['neck', 1]] : [['chest', 1]]), { s: [1, 1, 0.82], c: color });
  if (trim) rb.addW(torus(0.268, 0.01, 5, 26), 'metal', () => [['chest', 1]], { p: [0, 1.45, 0], r: [PI / 2, 0, 0], s: [1, 0.82, 1], c: trim });
  if (fur) {
    // lumpy fur collar
    const f = new THREE.TorusGeometry(0.19, 0.07, 8, 24);
    const fp = f.attributes.position;
    for (let i = 0; i < fp.count; i++) {
      const x = fp.getX(i), y = fp.getY(i), z = fp.getZ(i);
      const k = 1 + Math.sin(x * 60) * Math.cos(y * 55) * 0.12 + Math.sin(z * 80) * 0.06;
      fp.setXYZ(i, x * k, y * k, z * k);
    }
    f.computeVertexNormals();
    rb.addW(f, 'cloth', () => [['chest', 1]], { p: [0, 1.56, -0.01], r: [PI / 2, 0, 0], s: [1.05, 0.85, 0.75], c: fur, paint: 0.3 });
  }
}

// a townsfolk work cap: a flat cloth crown with a band, over the same faceless face wrap and neck cowl as the turban
// (a plain flat top from above: no wraps, rims or tails)
function workCap(rb, color, band) {
  rb.add(cyl(0.128, 0.122, 0.11, 20), 'cloth', 'head', { p: [0, 0.215, -0.008], c: color, paint: 0.3 });
  rb.add(cyl(0.131, 0.131, 0.03, 20), 'cloth', 'head', { p: [0, 0.17, -0.008], c: band, paint: 0.3 });
  rb.add(box(0.15, 0.014, 0.07), 'cloth', 'head', { p: [0, 0.165, 0.13], c: band });
  rb.add(sphere(0.124, 16, 12, 0, PI * 2, PI * 0.5, PI * 0.5), 'cloth', 'head', { p: [0, 0.105, 0.012], s: [1.02, 1.05, 1.07], c: band });
  rb.add(box(0.18, 0.04, 0.03), 'dark', 'head', { p: [0, 0.128, 0.112] });
  rb.add(lathe([[0.1, -0.07], [0.095, -0.02], [0.088, 0.03], [0.07, 0.07]], 16), 'cloth', 'neck', { s: [1, 1, 1.05], c: band });
}

function turban(rb, wrap, scarfColor) {
  // three wide, flat wraps tilted alternately so they cross at the front, a scarf-coloured band over them
  const W = [[0.132, 0.19, 0.2], [0.127, 0.215, -0.2], [0.12, 0.24, 0.16]];
  W.forEach(([R, y, tilt], i) => rb.add(torus(R, 0.042, 8, 26), 'cloth', 'head', { p: [0, y, -0.008], r: [PI / 2 + tilt, 0, 0], s: [1, 1, 0.85], c: i % 2 ? '#e6d6b4' : wrap, paint: 0.3 }));
  rb.add(torus(0.134, 0.018, 6, 26), 'cloth', 'head', { p: [0, 0.215, -0.008], r: [PI / 2 + 0.05, 0.0, 0.42], s: [1, 1, 0.85], c: scarfColor, paint: 0.3 });
  rb.add(sphere(0.115, 14, 8), 'cloth', 'head', { p: [0, 0.245, -0.012], s: [1.1, 0.45, 1.1], c: wrap, paint: 0.3 });
  // full face wrap leaving only a dark band
  rb.add(sphere(0.124, 16, 12, 0, PI * 2, PI * 0.5, PI * 0.5), 'cloth', 'head', { p: [0, 0.105, 0.012], s: [1.02, 1.05, 1.07], c: scarfColor });
  rb.add(box(0.18, 0.04, 0.03), 'dark', 'head', { p: [0, 0.128, 0.112] });
  // neck cowl so no dark stub shows under the wrap
  rb.add(lathe([[0.1, -0.07], [0.095, -0.02], [0.088, 0.03], [0.07, 0.07]], 16), 'cloth', 'neck', { s: [1, 1, 1.05], c: scarfColor });
  // scarf tails on the scarf chain
  const chain = CHAINS.scarf;
  for (const sx of [-0.04, 0.05]) {
    const g = new THREE.PlaneGeometry(0.1, 0.8, 1, 8);
    g.rotateX(PI / 2);
    g.translate(sx, 0, -0.5);
    g.translate(0, rb.rest.scarf0[1], 0);
    rb.addW(g, 'cloth', (x, y, z) => {
      const d = clamp((-z - 0.12) / 0.72, 0, 1) * 3;
      const i = Math.min(2, Math.floor(d)), t = d - i;
      return [[chain[i], 1 - t], [chain[i + 1], t]];
    }, { c: scarfColor });
  }
}

function leafMantle(rb, colors) {
  // overlapping leaf plates around the shoulders (the herbalist's own shoulder piece: hidden under worn shoulder armour)
  const leaf = () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.quadraticCurveTo(0.06, 0.08, 0, 0.2); s.quadraticCurveTo(-0.06, 0.08, 0, 0);
    return extrude(s, 0.01, 0.004, 6);
  };
  // (review 18 Nov, from straight above: evenly spaced leaves of one length round the neck read as a sunburst. The
  // spacing, length, droop and lean are now uneven, the same every build; they lie down the shoulders, not out)
  const jit = (k) => { const x = Math.sin(k * 12.9898) * 43758.5453; return x - Math.floor(x) - 0.5; };
  for (let ring = 0; ring < 2; ring++) {
    const n = 16 - ring * 3;
    for (let i = 0; i < n; i++) {
      const k = i + ring * 31 + 1;
      const a = ((i + 0.55 * jit(k)) / n) * PI * 2;
      const r = 0.25 - ring * 0.05;
      const y = 1.5 + ring * 0.06;
      const sz = 0.82 + 0.36 * (jit(k * 3.7) + 0.5);
      rb.add(leaf(), 'pcloth', 'chest', {
        p: [Math.sin(a) * r, y - rb.rest.chest[1], Math.cos(a) * r * 0.78], s: [sz, sz * (0.85 + 0.3 * (jit(k * 5.3) + 0.5)), 1],
        r: [PI * 0.7 - ring * 0.15 + 0.22 * jit(k * 2.1), a, 0.35 * jit(k * 7.9)], order: 'YXZ', c: colors[(i + ring) % colors.length],
      });
    }
  }
}

function quiver(rb) {
  const g = new Builder(5);
  rb.addW(cyl(0.06, 0.05, 0.55, 12), 'leather', () => [['chest', 1]], { p: [0.08, 1.38, -0.2], r: [0, 0, -0.45], c: '#6a4426' });
  rb.addW(torus(0.06, 0.01, 5, 14), 'metal', () => [['chest', 1]], { p: [0.2, 1.62, -0.2], r: [PI / 2, 0, -0.45], c: '#d8b04a' });
  for (let i = 0; i < 6; i++) {
    const ox = (i % 3 - 1) * 0.025, oz = (Math.floor(i / 3) - 0.5) * 0.025;
    rb.addW(cyl(0.006, 0.006, 0.3, 4), 'leather', () => [['chest', 1]], { p: [0.21 + ox, 1.75, -0.2 + oz], r: [0, 0, -0.45], c: '#c8a878' });
    rb.addW(box(0.004, 0.07, 0.03), 'cloth', () => [['chest', 1]], { p: [0.27 + ox, 1.86, -0.2 + oz], r: [0, 0, -0.45], c: i % 2 ? '#e8e0c8' : '#9c2a2a' });
  }
  // strap across the chest
  // (spine and chest only, never the hips: then a Dragonslayer chest hides all of it, not every other triangle)
  rb.addW(box(0.04, 0.62, 0.02), 'leather', (x, y) => torsoW(Math.max(y, 1.2)), { p: [0, 1.33, 0.165], r: [0, 0, 0.62], c: '#4e3420' });
}

// --------------------------------------------------------------------------
// chemist pieces
function labCoat(rb, coat, dark, brass) {
  rb.addW(shell([[0.215, 0.96], [0.22, 1.1], [0.24, 1.3], [0.252, 1.44], [0.232, 1.53], [0.16, 1.6]], 22), 'cloth', (x, y) => torsoW(y), { s: [1, 1, 0.71], c: coat });
  // high collar
  rb.addW(shell([[0.17, 1.55], [0.165, 1.62], [0.18, 1.7]], 20), 'cloth', () => [['chest', 1]], { s: [1, 1, 0.85], c: dark });
  // coat tails: long skirt split at the front (phi 0.5PI is +z)
  const gap = PI * 0.24;
  const g = new THREE.CylinderGeometry(0.225, 0.33, 0.78, 24, 6, true, PI * 0.5 + gap / 2, PI * 2 - gap);
  g.translate(0, 1.0 - 0.39, 0);
  rb.addW(g, 'cloth', robeW(), { c: coat, ao: [0.25, 0.95, 0.75] });
  // brass buttons down both sides of the opening
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) rb.addW(sphere(0.012, 8, 6), 'metal', (x, y) => torsoW(y), { p: [sx * 0.085, 1.48 - i * 0.1, 0.168], c: brass });
  // sleeves with rolled cuffs
  for (const s of ['L', 'R']) {
    rb.add(shell([[0.085, -0.3], [0.09, -0.12], [0.085, 0.02]], 14), 'cloth', 'arm' + s, { c: coat });
    rb.add(shell([[0.078, -0.27], [0.08, -0.06]], 14), 'cloth', 'fore' + s, { c: coat });
    rb.add(torus(0.08, 0.02, 6, 16), 'cloth', 'fore' + s, { p: [0, -0.2, 0], r: [PI / 2, 0, 0], c: dark });
  }
}

function bandolier(rb, colors) {
  rb.addW(box(0.06, 0.7, 0.025), 'leather', (x, y) => torsoW(y), { p: [0, 1.32, 0.175], r: [0, 0, -0.62], c: '#4a2e1a' });
  for (let i = 0; i < colors.length; i++) {
    const t = i / (colors.length - 1) - 0.5;
    const x = -t * 0.36, y = 1.32 + t * 0.42;
    rb.addW(cyl(0.016, 0.016, 0.075, 8), 'glow', (xx, yy) => torsoW(yy), { p: [x, y, 0.2], r: [0, 0, -0.62], c: colors[i] });
    rb.addW(cyl(0.012, 0.012, 0.02, 6), 'metal', (xx, yy) => torsoW(yy), { p: [x - 0.02, y + 0.03, 0.2], r: [0, 0, -0.62], c: '#d9a650' });
  }
}

// leather cap + goggles with dark lenses + respirator: the face is fully covered
function goggleMask(rb, cap, brass) {
  rb.add(sphere(0.135, 18, 12, 0, PI * 2, 0, PI * 0.62), 'leather', 'head', { p: [0, 0.1, -0.005], s: [1, 1.05, 1.08], c: '#5a3a24' });
  rb.add(sphere(0.124, 16, 12), 'leather', 'head', { p: [0, 0.095, 0.0], s: [0.98, 1.05, 1.0], c: '#2a2220' });
  rb.add(torus(0.128, 0.012, 5, 24), 'leather', 'head', { p: [0, 0.135, 0], r: [PI / 2 + 0.1, 0, 0], s: [1, 1.08, 1], c: '#3a2616' });
  // one wrap-round visor band, not two round lenses (a pair of rimmed circles reads as eyes): a brass frame arc
  // round the front of the head with a single dark lens strip set in it
  for (const [R, t, arc, kind, c, sz] of [[0.128, 0.026, 1.9, 'metal', brass, 0.75], [0.136, 0.018, 1.6, 'dark', undefined, 0.7]]) {
    rb.add(torus(R, t, 6, 24, arc), kind, 'head', { p: [0, 0.135, 0], r: [PI / 2, 0, PI / 2 - arc / 2], s: [1, 1, sz], c });
  }
  // respirator snout + twin filter canisters
  rb.add(lathe([[0.001, -0.02], [0.06, -0.02], [0.075, 0.03], [0.065, 0.06], [0.001, 0.07]], 14), 'leather', 'head', { p: [0, 0.03, 0.1], r: [PI / 2 - 0.25, 0, 0], c: '#3a3036' });
  for (const sx of [-1, 1]) {
    rb.add(cyl(0.03, 0.03, 0.06, 12), 'metal', 'head', { p: [sx * 0.075, 0.02, 0.135], r: [PI / 2, 0, sx * 0.6], c: '#8a8a90' });
    rb.add(torus(0.03, 0.005, 4, 12), 'metal', 'head', { p: [sx * 0.093, 0.01, 0.16], r: [PI / 2, 0, sx * 0.6], c: brass });
  }
  rb.add(cyl(0.025, 0.025, 0.02, 12), 'metal', 'head', { p: [0, 0.03, 0.17], r: [PI / 2 - 0.25, 0, 0], c: brass });
}

function pressureTank(rb, brass) {
  const w = () => [['chest', 1]];
  rb.addW(cyl(0.085, 0.085, 0.42, 16), 'metal', w, { p: [0, 1.34, -0.25], c: '#c0703a', paint: 0.4 });
  rb.addW(sphere(0.085, 16, 8, 0, PI * 2, 0, PI / 2), 'metal', w, { p: [0, 1.55, -0.25], c: '#c0703a' });
  rb.addW(sphere(0.085, 16, 8, 0, PI * 2, PI / 2, PI / 2), 'metal', w, { p: [0, 1.13, -0.25], c: '#c0703a' });
  for (const y of [1.2, 1.34, 1.48]) rb.addW(torus(0.087, 0.008, 5, 18), 'metal', w, { p: [0, y, -0.25], r: [PI / 2, 0, 0], c: brass });
  // pressure gauge dial
  rb.addW(cyl(0.035, 0.035, 0.02, 14), 'metal', w, { p: [0.07, 1.42, -0.2], r: [0, 0, PI / 2], c: brass });
  rb.addW(cyl(0.028, 0.028, 0.022, 14), 'cloth', w, { p: [0.075, 1.42, -0.2], r: [0, 0, PI / 2], c: '#f0e8d0' });
  // coiled hose
  const pts = [];
  for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push(V3(-0.07 + Math.sin(t * PI * 3) * 0.04, 1.58 - t * 0.5, -0.22 + Math.cos(t * PI * 3) * 0.04)); }
  rb.addW(tube(pts, 0.012, 6, 60), 'leather', w, { uv: 'keep', c: '#2a2220' });
  // shoulder straps
  for (const sx of [-1, 1]) rb.addW(box(0.04, 0.42, 0.02), 'leather', (x, y) => torsoW(y), { p: [sx * 0.11, 1.38, -0.17], c: '#3a2616' });
}

// --------------------------------------------------------------------------
// deadeye pieces (body B, the Ironclad Gunhand: a long road coat, a smooth closed steel mask under a flat-brimmed hat)
// a knee-length road coat: the body, two lapels in the accent colour, a waistcoat with two rows of brass buttons (never a
// single centre line: it would cross the belt), a turned-up collar open at the front, skirts split at the front
function roadCoat(rb, coat, accent, brass) {
  const dark = shadeHex(coat, 0.7);
  rb.addW(shell([[0.215, 0.96], [0.22, 1.1], [0.24, 1.3], [0.252, 1.44], [0.232, 1.53], [0.16, 1.6]], 22), 'cloth', (x, y) => torsoW(y), { s: [1, 1, 0.71], c: coat });
  // the waistcoat between the lapels
  // (Deadeye look pass) a panel that follows the coat's curve, not a flat slab on the chest
  const wc = new THREE.LatheGeometry([[0.226, 1.11], [0.234, 1.2], [0.246, 1.32], [0.256, 1.44], [0.244, 1.5]].map(([r, y]) => new THREE.Vector2(r, y)), 8, -0.38, 0.76);
  rb.addW(wc, 'cloth', (x, y) => torsoW(y), { s: [1, 1, 0.71], c: dark, paint: 0.15 });
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) rb.addW(sphere(0.011, 8, 6), 'metal', (x, y) => torsoW(y), { p: [sx * 0.045, 1.47 - i * 0.075, 0.176], c: brass });
    // lapels: two broad strips in a V, stopping above the waist (Deadeye look pass: so the bandolier, right shoulder to left
    // hip, passes their ends and never crosses one)
    rb.addW(box(0.05, 0.33, 0.014), 'cloth', (x, y) => torsoW(y), { p: [sx * 0.096, 1.365, 0.17], r: [-0.06, 0, sx * 0.16], c: accent });
  }
  // a turned-up collar standing at the back and sides, open at the front (theta 0 is +z)
  const cgap = PI * 0.62;
  const col = new THREE.CylinderGeometry(0.15, 0.19, 0.13, 22, 1, true, cgap / 2, PI * 2 - cgap);
  col.translate(0, 1.6, -0.015);
  rb.addW(col, 'cloth', () => [['chest', 1]], { s: [1, 1, 0.86], c: accent, ao: [1.5, 1.7, 0.8] });
  // skirts to the knee, split at the front, folded, a dark hem band. (Deadeye look pass, new body) the back is two long
  // tails on the back cloth chain (tabB) with a vent between them, so they trail and swing behind on runs and turns
  // (down and back, never spread); the front and side skirts follow the legs (robeW). Fold creases are shaded in.
  const gap = PI * 0.22, len = 0.5, back = PI * 0.3, vent = PI * 0.025, tlen = 0.6;
  const base = rgb(coat);
  const folds = (n, k0, top, L) => (x, y, z) => {
    const a = Math.atan2(x, z / 0.86), t = clamp((top - y) / L, 0, 1), cr = Math.max(0, -Math.sin(a * n));
    const k = 1 - cr * 0.3 * (0.35 + 0.65 * t) - (1 - t) * 0.04;
    return [base[0] * k * k0, base[1] * k * k0, base[2] * k * k0];
  };
  const skirtPiece = (t0, tl, L, r1, n) => {
    const g = new THREE.CylinderGeometry(0.225, r1, L, Math.max(6, Math.round(tl * 9)), 7, true, t0, tl);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
      const a = Math.atan2(x, z), t = (L / 2 - y) / L, f = 1 + Math.sin(a * n) * 0.045 * t;
      p.setX(i, x * f); p.setZ(i, z * f * 0.86);
    }
    g.computeVertexNormals();
    g.translate(0, 1.0 - L / 2, 0);
    return g;
  };
  for (const [t0, tl] of [[gap / 2, PI - back - gap / 2], [PI + back, PI - back - gap / 2]]) {
    rb.addW(skirtPiece(t0, tl, len, 0.31, 7), 'cloth', robeW(), { c: folds(7, 1, 1.0, len), ao: [0.45, 1.0, 0.75] });
    const hem = new THREE.CylinderGeometry(0.322, 0.328, 0.045, Math.max(6, Math.round(tl * 9)), 1, true, t0, tl);
    hem.scale(1, 1, 0.86); hem.translate(0, 1.0 - len + 0.025, 0);
    rb.addW(hem, 'cloth', robeW(), { c: dark });
  }
  // the two back tails: a touch wider than the skirt so their edges lap over it, longer, on the tabB chain from the belt
  const tw = rb.chainWeights(CHAINS.tabB, 'hips');
  for (const [t0, tl] of [[PI - back - 0.05, back + 0.05 - vent], [PI + vent, back + 0.05 - vent]]) {
    const g = skirtPiece(t0, tl, tlen, 0.33, 9);
    g.scale(1.03, 1, 1.03);
    rb.addW(g, 'cloth', tw, { c: folds(9, 0.94, 1.0, tlen), ao: [0.35, 1.0, 0.75] });
    const hem = new THREE.CylinderGeometry(0.348, 0.352, 0.045, 8, 1, true, t0, tl);
    hem.scale(1.03, 1, 0.86 * 1.03); hem.translate(0, 1.0 - tlen + 0.025, 0);
    rb.addW(hem, 'cloth', tw, { c: dark });
  }
  // a half-belt across the small of the back over the tails' tops, two brass buttons (horizontal: no cross)
  rb.add(rbox(0.2, 0.045, 0.02, 0.008), 'cloth', 'hips', { p: [0, 0.05, -0.168], c: dark });
  for (const sx of [-1, 1]) rb.add(sphere(0.012, 8, 6), 'metal', 'hips', { p: [sx * 0.08, 0.05, -0.181], c: brass });
  // the front edges of the skirts in the accent colour (two edges well apart, below the belt: no cross)
  for (const sx of [-1, 1]) {
    const a = gap / 2 + 0.02;
    const e = box(0.022, len - 0.04, 0.012);
    e.rotateX(-0.16);
    rb.addW(e, 'cloth', robeW(), { p: [sx * Math.sin(a) * 0.272, 1.0 - len / 2 - 0.02, Math.cos(a) * 0.272 * 0.86], c: accent });
  }
  // sleeves with broad turned-back cuffs and two studs on each cuff
  for (const s of ['L', 'R']) {
    rb.add(shell([[0.085, -0.3], [0.09, -0.12], [0.085, 0.02]], 14), 'cloth', 'arm' + s, { c: coat });
    rb.add(shell([[0.078, -0.2], [0.08, -0.04]], 14), 'cloth', 'fore' + s, { c: coat });
    rb.add(shell([[0.1, -0.265], [0.098, -0.2], [0.086, -0.15]], 14), 'cloth', 'fore' + s, { c: accent });
    for (const a of [0.6, 1.3]) rb.add(sphere(0.01, 6, 4), 'metal', 'fore' + s, { p: [Math.cos(a) * (s === 'L' ? 1 : -1) * 0.1, -0.21, Math.sin(a) * 0.1], c: brass });
  }
}
// a wide sash under the belt in the accent colour, its tail knotted off to the left hip (not down the middle)
function gunSash(rb, accent) {
  rb.addW(shell([[0.228, 0.95], [0.236, 1.03], [0.232, 1.1]], 22), 'cloth', () => [['hips', 1]], { s: [1, 1, 0.74], c: accent });
  rb.add(rbox(0.075, 0.28, 0.016, 0.006), 'cloth', 'hips', { p: [0.1, -0.2, 0.16], r: [-0.1, 0, 0.18], c: shadeHex(accent, 0.85) });
  rb.add(rbox(0.05, 0.05, 0.03, 0.01), 'cloth', 'hips', { p: [0.075, -0.06, 0.168], c: accent });
}
// two leather hip holsters (flap open: the pistols are in the fists; riding, they go in here), a belt of paper
// cartridges on the right front and a dark leather cartridge pouch behind the left hip (no flask: a flat brass flask
// reads as a drinking flask)
// the two holster bodies alone (at = the pistol's place, HOLSTER.at or HOLSTER.tripo; loop = the belt loop's x)
function holsterPair(rb, brass, at = HOLSTER.at, loop = 0.232, mat = 'leather') {
  for (const sx of [-1, 1]) {
    // the pistol's place in it (EntityView holsters the pistols here out of combat and while riding: HOLSTER)
    const [hx, hy, hz] = at, o = [sx * hx, hy, hz];
    rb.add(rbox(0.056, 0.26, 0.072, 0.016), mat, 'hips', { p: [o[0], o[1] - 0.106, o[2] + 0.096], r: [-0.3, 0, 0], c: '#4a3020' });
    rb.add(rbox(0.06, 0.04, 0.076, 0.01), mat, 'hips', { p: [o[0], o[1] + 0.012, o[2] + 0.06], r: [-0.3, 0, 0], c: '#3a2416' });
    rb.add(box(0.064, 0.012, 0.03), 'metal', 'hips', { p: [o[0], o[1] - 0.12, o[2] + 0.1], r: [-0.3, 0, 0], c: brass });
    // the loop over the belt
    rb.add(rbox(0.04, 0.09, 0.02, 0.006), mat, 'hips', { p: [sx * loop, 0.0, at[2] + 0.03], r: [0, sx * 0.5, 0], c: '#3a2416' });
  }
}
function holsters(rb, brass) {
  holsterPair(rb, brass);
  for (let i = 0; i < 6; i++) {
    const t = 0.3 + i * 0.1;
    rb.add(cyl(0.0085, 0.0085, 0.04, 6), 'metal', 'hips', { p: [-Math.sin(t) * 0.214, 0.004, Math.cos(t) * 0.142 + 0.006], c: i % 2 ? '#d8b060' : brass });
  }
  rb.add(rbox(0.085, 0.08, 0.034, 0.012), 'leather', 'hips', { p: [0.15, -0.06, -0.15], r: [0, -0.6, 0], c: '#2e1e14' });
  rb.add(rbox(0.088, 0.034, 0.038, 0.008), 'leather', 'hips', { p: [0.15, -0.026, -0.15], r: [0, -0.6, 0], c: '#3a2416' });
  rb.add(box(0.016, 0.012, 0.006), 'metal', 'hips', { p: [0.161, -0.032, -0.167], r: [0, -0.6, 0], c: brass }); // the flap's stud, on the outer face
}
// at: the pistol's place on the hips bone (x for the left hip; the right is mirrored); tripo: the same on the bulkier Tripo
// coat (its skirts stand further out); rx: the pistol's tilt in it (barrel down, a little back)
export const HOLSTER = { at: [0.27, -0.01, 0.03], tripo: [0.3, -0.01, 0.05], rx: Math.PI / 2 - 0.3 };
export const holsterAt = (root) => (root?.userData?.tbody ? HOLSTER.tripo : HOLSTER.at);
// Out of combat the Deadeye's pistols ride in the hip holsters (EntityView decides when, v108). The pistols in the hands
// are hidden by shrinking the weapon bones (no visibility flag the gear code owns is touched, and a gear change while
// holstered just shows up in the holsters), and copies sharing their geometry and materials sit in the holsters, barrel
// down. The copies are rebuilt when the pistols in the hands change. Safe to call every frame.
const _hm = new THREE.Matrix4();
export function setPistolsHolstered(root, on) {
  const U = root.userData, B = U.bones;
  if (!B?.hips) return;
  const H = U.holstered || (U.holstered = { on: false, src: [], copies: [] });
  const want = [];
  if (on) for (const bn of ['weaponR', 'weaponL']) for (const c of B[bn]?.children || []) if (!c.isBone && c.visible && c.userData.pistol) want.push([c, bn === 'weaponR' ? -1 : 1]);
  if (want.length !== H.src.length || want.some(([c], i) => c !== H.src[i])) {
    for (const k of H.copies) k.parent?.remove(k);
    H.copies = want.map(([c, sx]) => {
      const k = new THREE.Group();
      k.name = 'holstered'; k.userData.holsterCopy = true; k.userData.sx = sx;
      c.updateMatrixWorld(true);
      const inv = c.matrixWorld.clone().invert();
      c.traverse((m) => {
        if (!m.isMesh || !m.visible) return;
        const n = new THREE.Mesh(m.geometry, m.material);
        n.castShadow = true; n.receiveShadow = true;
        _hm.multiplyMatrices(inv, m.matrixWorld).decompose(n.position, n.quaternion, n.scale);
        k.add(n);
      });
      k.scale.copy(c.scale);
      B.hips.add(k);
      return k;
    });
    H.src = want.map(([c]) => c);
  }
  const at = holsterAt(root);
  for (const k of H.copies) { k.position.set(k.userData.sx * at[0], at[1], at[2]); k.rotation.set(HOLSTER.rx, 0, 0); }
  // only empty hands when something went in the holsters (a look with no pistols keeps whatever it holds)
  const s = on && H.copies.length ? 1e-4 : 1;
  for (const bn of ['weaponR', 'weaponL']) if (B[bn] && B[bn].scale.x !== s) B[bn].scale.setScalar(s);
  H.on = on && H.copies.length > 0;
}
// the Tripo body (tripoBody.js, v108) brings no hands or mask of its own (tools/tripo/deadeye/rig_body.py cuts them off):
// these closed gauntleted fists go on the hand bones, and a smooth closed steel mask (a rounded block: no ridge, no slit,
// no features) under its hat on the head bone. The mask fills up into the Tripo hat (brim underside at y 1.84, crown from
// 1.87, crown radius ~0.1) and back over the hat's thin post: a rounder, shorter block left a gap under the brim with the
// post showing in it. Its rounded top edges sit inside the brim and crown, so from every side the mask meets the brim
// v108: the head is a smooth wrapped cloth hood instead of the steel block: one rounded egg of dark cloth from the collar
// up into the hat (it still fills the space under the brim and round the hat's post), and a scarf band in the variant's
// accent wound once round the lower part. Completely featureless: no eyes,
// nose, mouth or seams down the front, nothing in pairs; under the brim from above, so no ring shows.
// Hands go in rb, the hood in hb (drawn matte: tripoBody.js marks its vertices dull). v = the coat variant.
setTripoHands((rb, hb, v = 0) => {
  for (const s of ['L', 'R']) fist(rb, s, '#4e3e32', 'metal');
  const accent = DEADEYE_LOOKS[v % 3][1], head = () => [['head', 1]];
  const wrap = lathe([[0.001, 1.585], [0.06, 1.59], [0.08, 1.61], [0.093, 1.65], [0.1, 1.7], [0.103, 1.76], [0.103, 1.82], [0.1, 1.85], [0.085, 1.868], [0.05, 1.876], [0.001, 1.878]], 24);
  hb.addW(wrap, 'metal', head, { p: [0, 0, -0.012], s: [0.96, 1, 1.28], c: '#64584e', paint: 0.22, taper: false });
  const band = lathe([[0.1, 1.598], [0.107, 1.62], [0.108, 1.655], [0.101, 1.678]], 24);
  band.translate(0, -1.638, 0); band.rotateX(0.14); band.rotateZ(0.05); band.translate(0, 1.638, 0);
  hb.addW(band, 'metal', head, { p: [0, 0, -0.012], s: [0.94, 1, 1.3], c: accent, paint: 0.2, taper: false });
  // the hip holsters on the Tripo coat (matte, with the hood: hb), a little further out than on the procedural outfit
  holsterPair(hb, '#c89a50', HOLSTER.tripo, 0.27, 'metal');
});
// (Deadeye look pass, new body) the head: a fitted cloth cowl over the plain head egg (no face, no seams, nothing in
// pairs), a scarf wound up over the lower half and round the neck with one tail on the scarf chain, under a flat-crowned
// road hat pulled a little forward. From straight above the hat must not read as a disc in a ring: the crown is a rounded
// square, longer front to back, and the brim an oval whose sides curl up, both one colour (the band sits low on the
// crown, under its flared top edge, so it never shows from above). Built in head-bone units (rb.add scales the head x1.1).
const squircle = (x, z, n) => { const a = Math.atan2(x, z), c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)); return 1 / Math.pow(c ** n + s ** n, 1 / n); };
function hatPiece(g, f) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const o = f(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, o[0], o[1], o[2]); }
  // the hat sits on the crown of the head and tips 4 deg forward about the head's centre
  g.translate(0, 0.205 - 0.1, -0.006); g.rotateX(0.035); g.translate(0, 0.1, 0);
  g.computeVertexNormals();
  return g;
}
function roadHat(rb, hat, band) {
  // the crown's footprint: a rounded square, longer front to back and pinched narrower at the front (a teardrop from
  // above, like a worn road hat's crown); its flat top a touch lower at the front
  const sq = (x, y, z) => { const k = squircle(x, z, 3.2), Z = z * k * 1.12; return [x * k * 0.95 * (1 - 0.22 * Math.max(0, Z / 0.14)), y - (y > 0.1 ? 0.012 * Math.max(0, Z / 0.14) : 0), Z]; };
  // (review 18 Nov) a pinched crease runs front to back down the crown's top, so from straight above the crown is not a
  // flat oval sitting in the brim's oval (a disc in a ring): one soft valley, deepest at the front, nothing radiating
  const crease = (x, y, z) => { const o = sq(x, y, z); if (y > 0.118) o[1] -= 0.02 * Math.exp(-((o[0] / 0.032) ** 2)) * (0.75 + 0.25 * Math.max(0, o[2] / 0.14)); return o; };
  rb.add(hatPiece(lathe([[0.001, 0], [0.122, 0], [0.12, 0.05], [0.126, 0.1], [0.134, 0.117], [0.126, 0.126], [0.095, 0.127], [0.06, 0.128], [0.03, 0.128], [0.001, 0.128]], 32), crease), 'leather', 'head', { c: hat, paint: 0.3, us: 2 });
  rb.add(hatPiece(lathe([[0.1235, 0.0], [0.1245, 0.012], [0.1235, 0.028]], 32), sq), 'cloth', 'head', { c: band, paint: 0.2 });
  // the brim: a thin long oval with a rounded edge, the sides curled well up, the front and back dipping
  const brim = lathe([[0.104, -0.007], [0.17, -0.007], [0.235, -0.006], [0.284, -0.004], [0.292, 0.001], [0.285, 0.006], [0.235, 0.007], [0.17, 0.007], [0.104, 0.007]], 44);
  rb.add(hatPiece(brim, (x, y, z) => {
    const X = x * 0.84, side = Math.max(0, (Math.abs(X) - 0.1) / 0.145);
    return [X * (1 - 0.12 * side * side), y + 0.085 * side * side - 0.018 * (z / 0.29) ** 2 - (z > 0 ? 0.01 * z / 0.29 : 0), z * 1.02];
  }), 'leather', 'head', { c: hat, paint: 0.3, us: 2 });
}
function scarfHead(rb, cowl, scarf) {
  rb.add(sphere(0.121, 22, 16), 'cloth', 'head', { p: [0, 0.102, 0.006], s: [0.97, 1.08, 1.04], c: cowl, paint: 0.2 });
  // the scarf: two soft turns wound round the jaw and lower head, both rising a little to the front (parallel: they never
  // cross), over a fill in the cowl's cloth
  rb.add(sphere(0.124, 22, 10, 0, PI * 2, PI * 0.5, PI * 0.5), 'cloth', 'head', { p: [0, 0.07, 0.008], s: [0.97, 1.0, 1.05], c: cowl, paint: 0.2 });
  for (const [R, r, y, tl, k] of [[0.106, 0.036, 0.014, 0.1, 0.9], [0.113, 0.034, 0.064, 0.16, 1]]) {
    rb.add(torus(R, r, 8, 26), 'cloth', 'head', { p: [0, y, 0.01], r: [PI / 2 - tl, 0, 0], s: [0.98, 1.08, 0.72], c: shadeHex(scarf, k), paint: 0.3 });
  }
  // wound round the neck down into the collar
  rb.add(lathe([[0.112, -0.08], [0.104, -0.03], [0.096, 0.02], [0.084, 0.07]], 18), 'cloth', 'neck', { s: [1, 1, 1.05], c: scarf, paint: 0.25 });
  // the knot behind the left ear (no hanging tail: down the back it crossed the bandolier's back run)
  rb.add(rbox(0.06, 0.05, 0.04, 0.015), 'cloth', 'neck', { p: [0.05, 0.03, -0.1], r: [0.3, 0.4, 0], c: scarf });
}
// a leather bandolier from the right shoulder over the top and down to the left hip, front and back (one strap, one
// direction: nothing crosses it), brass cartridges in loops across the front run. Follows the road coat's own shell.
function bandolierStrap(rb, leather, brass) {
  const prof = [[0.215, 0.96], [0.22, 1.1], [0.24, 1.3], [0.252, 1.44], [0.232, 1.53], [0.16, 1.6]];
  const coatR = (y) => { for (let i = 0; i + 1 < prof.length; i++) if (y <= prof[i + 1][1]) return lerp(prof[i][0], prof[i + 1][0], clamp((y - prof[i][1]) / (prof[i + 1][1] - prof[i][1]), 0, 1)); return prof[prof.length - 1][0]; };
  const side = (t, zs) => { const x = lerp(0.19, -0.118, t), y = lerp(1.0, 1.55, t), r = coatR(y); return V3(x, y, zs * (0.71 * Math.sqrt(Math.max(r * r - x * x, 0.0009)) + 0.02)); };
  const pts = [];
  for (let i = 0; i <= 10; i++) pts.push(side(i / 10, 1));
  pts.push(V3(-0.124, 1.6, 0.075), V3(-0.128, 1.632, 0.0), V3(-0.124, 1.6, -0.075));
  for (let i = 10; i >= 0; i--) pts.push(side(i / 10, -1));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), N = 60, w = 0.052, th = 0.012;
  const pos = [], idx = [], frames = [];
  for (let i = 0; i <= N; i++) {
    const P = curve.getPointAt(i / N), T = curve.getTangentAt(i / N);
    const n = V3(P.x, Math.max(0, P.y - 1.5) * 4, P.z / 0.71).normalize();
    const s = V3().crossVectors(T, n).normalize();
    n.crossVectors(s, T).normalize();
    frames.push([P, n, s]);
    for (const [a, b] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) pos.push(P.x + s.x * a * w / 2 + n.x * b * th, P.y + s.y * a * w / 2 + n.y * b * th, P.z + s.z * a * w / 2 + n.z * b * th);
  }
  for (let i = 0; i < N; i++) for (let k = 0; k < 4; k++) { const a = i * 4 + k, b = i * 4 + ((k + 1) % 4), c = a + 4, d = b + 4; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const tw = (x, y) => torsoW(Math.max(y, 1.12));
  rb.addW(g, 'leather', tw, { c: leather, paint: 0.2 });
  // brass cartridges across the strap on the front run, every other one a shade darker
  const Y = V3(0, 1, 0), q = new THREE.Quaternion();
  for (let i = 0; i < 6; i++) {
    const [P, n, s] = frames[Math.round(N * (0.13 + i * 0.045))];
    const c = cyl(0.0085, 0.0085, w * 0.8, 7);
    c.applyQuaternion(q.setFromUnitVectors(Y, s));
    c.translate(P.x + n.x * (th + 0.007), P.y + n.y * (th + 0.007), P.z + n.z * (th + 0.007));
    rb.addW(c, 'metal', tw, { c: i % 2 ? '#d8b060' : brass });
  }
}

// --------------------------------------------------------------------------
// WEAPONS: built in weapons.js (every builder takes the item quality and the model grows with it)
import { longsword, kiteShield, recurveBow, arrowMesh, reactorRod, gearStaff, flaskMesh, scimitar, roundShield, warhammer, towerShield, herbStaff, dagger, battleAxe, flangedMace, pistol, sidearm, WEAPON_MODEL, SHIELD_MODEL, LEG_MODEL, LEG_SHIELD, SIDEARM_MODEL } from './weapons.js';
import { dsRefresh } from './dragonslayer.js';
import { dsaSync } from './dsArmour.js';
import { tripoBodySync, setTripoHands, DEADEYE_LOOKS } from './tripoBody.js';
import { lookChange } from './charMerge.js';
export { longsword, kiteShield, recurveBow, arrowMesh, reactorRod, gearStaff, flaskMesh, scimitar, roundShield, warhammer, towerShield, herbStaff, dagger, battleAxe, flangedMace, pistol, sidearm };

// the hottest piece in either hand (heat.js reads it for the particle caps): wu given by setCharWeapon, the offhand's by
// setCharOffhand (userData.heatOff)
function heatHandSync(root, wu) {
  const U = root.userData;
  if (wu !== undefined) U.heatWeap = wu >= 7 ? wu : 0;
  U.heatHand = Math.max(U.heatWeap || 0, U.heatOff || 0);
}
// put the chosen weapon type, at its quality, into a built character's hand (a bow goes in the left hand).
// wu / ou: the heat stage the weapon and the offhand show (0, or 7..10: heat.js); q6 (Prismatic) adds the oxide sheen
export function setCharWeapon(root, wtype, q = 1, oh = null, wu = 0, ou = 0) {
  const bones = root.userData.bones;
  if (!bones) return;
  setCharOffhand(root, oh, q, ou);
  const key = `${wtype || ''}:${q}:${wu || 0}`;
  if (root.userData.weaponKey === key) return;
  lookChange(root); // (v115: a merged player goes back to its per-kind meshes first, charMerge.js)
  root.userData.weaponKey = key;
  root.userData.heatObj = null;
  for (const bn of ['weaponR', 'weaponL']) for (const c of [...(bones[bn]?.children || [])]) {
    if (c.userData.qglow || c.userData.swapped) c.parent.remove(c);
    else if (!c.isBone && !c.userData.offSwap) c.visible = c.userData.isSidearm ? !root.userData.offKey?.split(':')[0] : true; // (the Deadeye's own sidearm: setCharOffhand)
  }
  const [wt, model] = String(wtype || '').split('@'); // 'sword@keeper': a named legendary's own model
  const make = (model && LEG_MODEL[model]) || WEAPON_MODEL[wt];
  const bow = wt === 'bow', hand = bow ? bones.weaponL : bones.weaponR;
  if (make && hand) {
    // hide the outfit's own weapon in this hand and add the chosen one at its quality
    for (const c of hand.children) if (!c.userData.swapped && !c.userData.offSwap && !c.isBone) c.visible = false;
    const w = make(q); w.rotation.set(bow ? -Math.PI / 2 : Math.PI / 2, 0, 0); w.userData.swapped = true;
    w.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    if (wu >= 7 || q >= 6) heatObject(w, wu, q >= 6);
    if (wu >= 7) root.userData.heatObj = w;
    hand.add(w);
  }
  heatHandSync(root, wu);
  // the bow the string code drives is whichever bow is showing
  root.userData.bow = null;
  root.traverse((o) => { if (o.userData?.string && o.visible !== false && (!o.parent || o.parent.visible !== false)) root.userData.bow = root.userData.bow || o; });
  if (bow && make) root.userData.bow = hand.children.find((c) => c.userData.swapped) || root.userData.bow;
  dsRefresh(root);
}

// worn shoulder armour shows over (and hides) the class's own: 'plate:4' (weight:quality), or null for the class's own look.
// Each tier is a step up in shape: q1 one plain dome; q2 rivets; q3 a second lame and a polished trim; q4 a third lame,
// a crest ridge, a raised flange and a gem; q5 four lames, gold filigree and a gold gem (nothing glows).
// Plate is smooth polished lames, mail a leather cap over a ring-mail spaulder with a hanging fringe, cloth a soft mantle.
// (Legendary is golden; Prismatic a straw-tempered steel whose colour play is the sheen in the reflection)
const Q_TRIM = { 1: '#a89070', 2: '#7ac85a', 3: '#5a9aff', 4: '#b070f0', 5: '#f2b636', 6: '#d8bc78' };
const ARM_LOOK = {
  plate: { mat: 'wArmour', col: ['#8a8c90', '#a2a7b0', '#b8bec8', '#c4cad4', '#d2d6de', '#aab2cc'], sc: [1.06, 0.58, 1.16], rim: 0.011 },
  mail: { mat: 'wLeather', col: ['#5a3a24', '#5e3e26', '#4a3020', '#3e2a1e', '#3a2418', '#2c2a36'], sc: [1.04, 0.56, 1.12], rim: 0.01 },
  cloth: { mat: 'wCloth', col: ['#5a4a36', '#3e5a34', '#2e4a6e', '#4a3a6a', '#7a1e1e', '#22305a'], sc: [1.12, 0.5, 1.2], rim: 0.013 },
};
// [radius, out, up, outward tilt, how far round the arm]: the top dome, then lames stepping down the outer arm
// the lower lames tuck up under the top one (each peeks out a little further down the outer arm) rather than stacking down it
const LAMES = [[0.155, 0.03, 0.075, 0.32, 1.2], [0.142, 0.048, 0.045, 0.48, 1.0], [0.13, 0.064, 0.016, 0.64, 0.9], [0.12, 0.078, -0.012, 0.78, 0.8]];
// how far round the top lame the quality trim reaches (x PI): an arc over the outer shoulder only, open on the neck side,
// so the two shoulders' trims never join into a ring round the head when seen from above
const TRIM_SPAN = 0.78;
// a point on a dome lame (dome-local: phi round the rim, th from the pole) and the outward normal there
function domePt(r, sc, phi, th, lift = 0) {
  const n0 = V3(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th));
  const p = V3(n0.x * r * sc[0], n0.y * r * sc[1], n0.z * r * sc[2]);
  const n = V3(p.x / (sc[0] * sc[0]), p.y / (sc[1] * sc[1]), p.z / (sc[2] * sc[2])).normalize();
  return [p.addScaledVector(n, lift), n];
}
// orient a geometry's +Y along n and move it to p
function placeOn(geo, p, n) {
  geo.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), n)));
  geo.translate(p.x, p.y, p.z);
  return geo;
}
function shoulderPiece(kind, q, sx, heat = 0, ds = false) {
  q = clamp(Math.round(q) || 1, 1, 6);
  const b = new Builder(40 + q);
  const L = ARM_LOOK[kind];
  // a Dragonslayer piece shown before (or without) its model: crimson lacquer with gold trims (dsArmour.js)
  const trim = ds ? DSA_PAL.gold : Q_TRIM[q];
  const trimMat = q >= 3 ? 'wTrimPolish' : q === 2 ? 'wTrim' : L.mat; // Rare and up: a polished metal trim, never a glow
  const trimCol = q === 1 && !ds ? (kind === 'plate' ? '#6a6c70' : kind === 'mail' ? '#3a2616' : '#3e3226') : trim;
  const span = PI * TRIM_SPAN, phiC = sx > 0 ? PI : 0;
  const nL = [1, 1, 2, 3, 4, 4][q - 1];
  const col = ds ? (kind === 'cloth' ? DSA_PAL.cloth : DSA_PAL.metal) : L.col[q - 1];
  // mail: a ring-mail spaulder under the leather cap, with a fringe of links along its lower edge
  if (kind === 'mail') {
    const mr = 0.148, mp = [sx * 0.045, 0.012, 0], mrot = [0, 0, -sx * 0.55];
    const [md] = plateGeo(mr, 1.05, 0.7, 1.12, 0.008, sx);
    b.add(md, 'wMail', { p: mp, r: mrot, c: ds ? DSA_PAL.metal : q >= 4 ? '#d8dce2' : '#ffffff', us: 6 });
    for (let i = 0; i < 9; i++) {
      const phi = phiC + (i / 8 - 0.5) * PI * 0.95;
      const [pp] = domePt(mr, [1.05, 0.7, 1.12], phi, PI / 2, 0.004);
      const g = rbox(0.035, 0.05, 0.012, 0.005);
      g.rotateY(Math.atan2(-Math.cos(phi), Math.sin(phi)));
      g.translate(pp.x, pp.y - 0.022, pp.z);
      b.add(g, 'wMail', { p: mp, r: mrot, c: (q >= 3 || ds) && i % 2 ? trim : ds ? DSA_PAL.metal : '#ffffff', us: 6 });
    }
  }
  for (let li = nL - 1; li >= 0; li--) {
    const [r, ox, oy, rz, spanK] = LAMES[li];
    const rr = kind === 'mail' ? r * 0.82 : r;
    const p = [sx * ox, oy + (kind === 'mail' ? 0.02 : 0), 0], rot = [0, 0, -sx * rz];
    const [d, t] = plateGeo(rr, L.sc[0], L.sc[1], L.sc[2], li === 0 && q >= 3 ? 0.015 : li ? 0.007 : L.rim, sx, spanK);
    b.add(d, L.mat, { p, r: rot, c: li ? shadeHex(col, 0.92 - li * 0.04) : col, us: kind === 'plate' ? 1.2 : undefined });
    // the top lame carries the polished quality trim over the outer shoulder only; lower lames a plain edge in the quality colour
    const tt = li ? t : plateGeo(rr, L.sc[0], L.sc[1], L.sc[2], q >= 3 ? 0.015 : L.rim, sx, TRIM_SPAN)[1];
    // (lower lames get a plain darker edge, gold at q5, so the stack does not read as rings of the quality colour)
    b.add(tt, li ? (q >= 5 ? 'wTrim' : L.mat) : trimMat, { p, r: rot, c: li ? (q >= 5 ? '#b89048' : shadeHex(col, 0.72)) : trimCol });
    if (li > 0) continue;
    // q2+: rivets (studs on cloth) along the top lame's rim
    if (q >= 2) for (let k = 0; k < 5; k++) {
      const [pp, nn] = domePt(rr, L.sc, phiC + (k / 4 - 0.5) * span * 0.84, PI / 2 - 0.13, 0.002);
      b.add(placeOn(sphere(0.009, 8, 6), pp, nn), q >= 4 ? 'wTrim' : L.mat === 'wCloth' ? 'wBrass' : L.mat, { p, r: rot, c: q >= 4 ? '#e8c060' : kind === 'plate' ? '#9a9ea6' : '#c8a060' });
    }
    // q4+: crest ridge from front to back over the top and a recessed gem
    if (q >= 4) {
      const ridge = [];
      for (let k = 0; k <= 12; k++) { const a = lerp(-0.47, 0.47, k / 12) * PI; ridge.push(V3(0, Math.cos(a) * rr * L.sc[1] + 0.004, Math.sin(a) * rr * L.sc[2])); }
      b.add(tube(ridge, 0.009, 6, 30, { capEnd: true, capStart: true }), kind === 'cloth' ? 'wTrim' : L.mat === 'wLeather' ? 'wArmour' : L.mat, { p, r: rot, uv: 'keep', c: kind === 'plate' ? col : '#c8ccd4' });
      const [gp, gn] = domePt(rr, L.sc, phiC, PI * 0.36, 0.0);
      b.add(placeOn(cyl(0.034, 0.03, 0.014, 16), gp.clone(), gn), trimMat, { p, r: rot, c: trim });
      b.add(placeOn(ico(0.022, 1), gp.clone().addScaledVector(gn, 0.008), gn), 'wQ' + q, { p, r: rot, c: 0xffffff });
    }
    // q5: gold filigree band inset inside the rim
    if (q >= 5) {
      const th = PI / 2 - 0.3;
      const fg = torus(rr * Math.sin(th), 0.005, 5, 28, span);
      fg.rotateX(PI / 2);
      fg.rotateY(-(PI - (sx > 0 ? PI - span / 2 : -span / 2) - span));
      fg.scale(L.sc[0] * 1.01, 1, L.sc[2] * 1.01);
      fg.translate(0, rr * Math.cos(th) * L.sc[1] + 0.003, 0);
      b.add(fg, 'wTrim', { p, r: rot, c: '#e8c060' });
    }
  }
  const out = b.build();
  out.userData.armSwap = true;
  out.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = true; m.receiveShadow = true;
  });
  // grows a little with quality, capped near 1.1x the class's own pauldron
  out.scale.setScalar([1.0, 1.02, 1.04, 1.06, 1.08, 1.08][q - 1]);
  // heat on the metal only (a cloth mantle's studs and filigree), the Prismatic sheen on the same
  if (heat >= 7 || q >= 6) heatObject(out, heat, q >= 6);
  return out;
}
// classes whose collars, hoods or mantles stand out at the shoulder: worn pieces sit a little further out and lower
const ARM_OUT = { ranger: 0.03, herbalist: 0.03, chemist: 0.015, warden: 0.02, deadeye: 0.025 };
export function setCharArmor(root, sh) {
  const U = root.userData, bones = U.bones;
  if (!bones || U.armKey === (sh || '')) return;
  lookChange(root);
  U.armKey = sh || '';
  for (const bn of ['armL', 'armR']) for (const c of [...(bones[bn]?.children || [])]) if (c.userData.armSwap) c.parent.remove(c);
  const L = parseLook(sh), kind = L?.w, q = L?.q || 1;
  const worn = ['plate', 'mail', 'cloth'].includes(kind);
  // the class's own pauldrons (and the herbalist's leaf mantle) hide under worn shoulder armour
  for (const k of ['pmetal', 'pleather', 'pglow', 'pcloth']) if (U.meshes?.[k]) U.meshes[k].visible = !worn;
  if (worn) {
    const o = ARM_OUT[U.kind] || 0;
    for (const [bn, sx] of [['armL', 1], ['armR', -1]]) if (bones[bn]) {
      const piece = shoulderPiece(kind, q, sx, L.heat, L.ds);
      piece.position.set(sx * o, -o * 0.6, 0);
      bones[bn].add(piece);
    }
  }
  dsaLater(root); // a Dragonslayer pauldron model hides the built piece once it is in
}
// a worn cloak (back slot): its own skinned meshes on the character's skeleton, so it swings on the cape bones; the
// class's own cape hides under it. Its colours, a border in the quality colour, a shaped hem and (q4+) border stripes
// follow the cloak's quality. ck = quality or null.
const CLOAK = { 1: ['#6a5a44', '#3e3428'], 2: ['#3e6a34', '#24401e'], 3: ['#2c4a8a', '#1a2a50'], 4: ['#4e2e7a', '#c8a050'], 5: ['#9a1e1e', '#e8c060'], 6: ['#1e2a50', '#7a52c8'] };
// the sandblade's back tabard, the chemist's pressure tank and the ranger's quiver stand out from the back
const CLOAK_OUT = { sandblade: 0.13, chemist: 0.2, ranger: 0.1, knight: 0.02, warden: 0.04, deadeye: 0.07 };
export function setCharCape(root, ck) {
  const U = root.userData;
  if (!U.skeleton || U.capeKey === (ck || '')) return;
  lookChange(root);
  U.capeKey = ck || '';
  for (const m of U.capeMeshes || []) { m.parent?.remove(m); m.geometry.dispose(); }
  U.capeMeshes = []; U.capeMesh = null;
  const L = parseLook(ck), q = L && !L.w ? L.q : 0;
  const on = !!(q && CLOAK[q]);
  if (U.meshes?.ccape) U.meshes.ccape.visible = !on;
  dsaLater(root); // (the new cloak meshes get the hide mask's attribute)
  if (!on) return;
  const rb = new RigBuilder();
  // the Dragonslayer cloak (plan D, back slot): crimson outside, a white lining, a gold border and clasp, any rarity
  const [outer, inner] = L.ds ? [DSA_PAL.cloak, DSA_PAL.lining] : CLOAK[q];
  cape(rb, { outer, inner, len: 1.14, w0: 0.5, w1: 0.84, out: CLOAK_OUT[U.kind] ?? 0.05, tattered: false, kind: 'cloth', trimKind: 'trim', border: L.ds ? DSA_PAL.gold : Q_TRIM[q], q: L.ds ? Math.max(4, q) : q, clasp: q >= 4 || L.ds ? '#e8c060' : null, claspKind: 'trim' });
  const add = (kind, mat) => {
    if (!rb.parts[kind].length) return null;
    const mesh = new THREE.SkinnedMesh(mergeGeometries(rb.parts[kind], false), mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.0, 0), 2.6);
    mesh.bind(U.skeleton, new THREE.Matrix4());
    root.add(mesh);
    U.capeMeshes.push(mesh);
    return mesh;
  };
  U.capeMesh = add('cloth', U.mats?.cloth || Object.values(U.mats || {})[0]);
  // (cloth never heats; the border and clasp below do)
  // polished metal border and clasp, no glow; the cloth never heats, its metal border and clasp do (and take the sheen)
  const tm = add('trim', charMat('trim', { roughness: 0.2, metalness: 0.75 }));
  if (tm && (L.heat >= 7 || q >= 6)) { heatCharMat(tm.material); fillUpg(tm.geometry, L.heat >= 7 ? L.heat : 0, q >= 6 ? 1 : 0); }
  add('glow', charMat('glow'));
}
// the off hand: a kite, round or tower shield on the forearm, or a dagger in the left hand
export function setCharOffhand(root, oh, q = 1, ou = 0) {
  const bones = root.userData.bones;
  const okey = `${oh || ''}:${q}:${ou || 0}`;
  if (!bones || root.userData.offKey === okey) return;
  lookChange(root);
  root.userData.offKey = okey;
  for (const bn of ['foreL', 'weaponL']) for (const c of [...(bones[bn]?.children || [])]) if (c.userData.offSwap) c.parent.remove(c);
  // the outfit's own off-hand piece (a shield on the forearm, the Deadeye's own sidearm in the left fist) hides under a worn one
  const own = [...(bones.foreL?.children || []).filter((c) => c.userData.isShield), ...(bones.weaponL?.children || []).filter((c) => c.userData.isSidearm)];
  for (const c of own) c.visible = !oh;
  const [ot, omodel] = String(oh || '').split('@'); // 'kite@ds_knight_shield': a shield with a model of its own
  if (SHIELD_MODEL[ot] && bones.foreL) {
    oh = ot;
    const sh = (omodel && LEG_SHIELD[omodel] ? LEG_SHIELD[omodel] : SHIELD_MODEL[ot])(q); sh.userData.offSwap = true; sh.position.set(oh === 'tower' ? 0.12 : 0.1, oh === 'tower' ? -0.12 : oh === 'round' ? -0.14 : -0.15, 0.02); sh.rotation.set(0, Math.PI / 2, 0);
    sh.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    if (ou >= 7 || q >= 6) heatObject(sh, ou, q >= 6);
    bones.foreL.add(sh);
  } else if (oh === 'dagger' && bones.weaponL) {
    const d = dagger(q); d.userData.offSwap = true; d.rotation.set(Math.PI / 2, 0, 0);
    if (ou >= 7 || q >= 6) heatObject(d, ou, q >= 6);
    bones.weaponL.add(d);
  } else if (SIDEARM_MODEL[ot] && bones.weaponL) {
    // the Deadeye's off-hand pistol, held in the left fist like the main one in the right ('sidearm@ds_deadeye_pistol_l')
    const d = ((omodel && SIDEARM_MODEL[omodel]) || SIDEARM_MODEL[ot])(q); d.userData.offSwap = true; d.rotation.set(Math.PI / 2, 0, 0);
    d.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    if (ou >= 7 || q >= 6) heatObject(d, ou, q >= 6);
    bones.weaponL.add(d);
  } else for (const c of own) c.visible = true;
  root.userData.heatOff = ou >= 7 ? ou : 0;
  heatHandSync(root);
  dsRefresh(root);
}

// --------------------------------------------------------------------------
// WORN BODY ARMOUR (head, chest, hands, legs, feet): gr = 'p3.-.m2.c4.p6:9@ds' (shared/items.js gearLook / parseLook), one
// code per slot, weight letter + quality 1..6 [+ ':' heat 7..10] [+ '@ds'], '-' for empty. The heat and the Prismatic sheen
// go on the metal of that slot through the per-vertex attribute 'upg' (heat.js; the head takes the temper tint only). Each worn slot recolours the class's own pieces in that part of the body to the
// piece's weight and quality (plate polished steel, mail dark iron, cloth a lacquer in the dye; the cloth parts take the
// quality's dye), and adds a few pieces of its own on top, placed from the body's real surface so they sit on any outfit:
//   hands: a cuff at the wrist (plate a flared steel cuff, mail a studded band, cloth two wraps)
//   legs:  plate and mail a knee cop on each knee, cloth a band round each thigh
//   feet:  a band at the top of the boot, plate a steel toe cap
//   chest: a plaque on the breast from Uncommon up (a gem from Epic)
// Every tier is a step up: Common plain edges; Uncommon edges in the quality colour; Rare and up polished metal trims in
// the quality colour (never glowing); Epic studs; Legendary gold. An empty slot shows the class's own colours.
const GEAR_SLOT_ORDER = ['head', 'chest', 'hands', 'legs', 'feet'];
const BONE_SLOT = {
  head: 'head', neck: 'head',
  spine: 'chest', chest: 'chest', clavL: 'chest', clavR: 'chest', armL: 'chest', armR: 'chest',
  foreL: 'hands', foreR: 'hands', handL: 'hands', handR: 'hands', weaponL: 'hands', weaponR: 'hands',
  hips: 'legs', thighL: 'legs', thighR: 'legs', skirtL0: 'legs', skirtL1: 'legs', skirtR0: 'legs', skirtR1: 'legs',
  shinL: 'feet', shinR: 'feet', footL: 'feet', footR: 'feet',
  // the new body's bones (hero/heroBody.js): its regions take the worn pieces' colours like the old body's parts did
  Head: 'head', neck_01: 'head', spine_01: 'chest', spine_02: 'chest', spine_03: 'chest', clavicle_l: 'chest', clavicle_r: 'chest',
  upperarm_l: 'chest', upperarm_r: 'chest', lowerarm_l: 'hands', lowerarm_r: 'hands', hand_l: 'hands', hand_r: 'hands',
  middle_01_l: 'hands', middle_02_l: 'hands', middle_03_l: 'hands', thumb_01_l: 'hands', thumb_02_l: 'hands', thumb_03_l: 'hands',
  middle_01_r: 'hands', middle_02_r: 'hands', middle_03_r: 'hands', thumb_01_r: 'hands', thumb_02_r: 'hands', thumb_03_r: 'hands',
  pelvis: 'legs', thigh_l: 'legs', thigh_r: 'legs', calf_l: 'feet', calf_r: 'feet', foot_l: 'feet', foot_r: 'feet', ball_l: 'feet', ball_r: 'feet',
};
// q6 Prismatic: a deep temper blue dye and a blued steel; its colour play is the sheen in the reflection (heat.js)
const GEAR_DYE = ['#7a6a52', '#4a7a3a', '#2e5a9a', '#5a3a8a', '#a02a1e', '#26346a'];
const GEAR_METAL = {
  p: ['#8c8a86', '#a8aeb6', '#b6c6e2', '#a898c8', '#e2c070', '#a8b2d0'],
  m: ['#5e5a52', '#727a68', '#5e7090', '#6e5e86', '#b88a48', '#5c6280'],
};
const GEAR_LEATHER = { p: '#4e3a2a', m: '#5a3e26', c: '#6a4e34' };
// the Dragonslayer palette (the armour models' crimson lacquer, white enamel and gold rims): the recolour shown while the
// models load or without them (?notripo=1), the cloth classes' robes under the models, the cloak and built pauldrons
export const DSA_PAL = { metal: '#7e1612', leather: '#4a1a14', cloth: '#8a1a18', gold: '#e0a640', cloak: '#8a1a18', lining: '#4a0e0c' };
function dsaTone(kind) { return rgb(kind === 'metal' ? DSA_PAL.metal : kind === 'leather' ? DSA_PAL.leather : DSA_PAL.cloth); }
const mixHex = (a, b, t) => { const A = rgb(a), B = rgb(b); return [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]; };
// the colour a worn piece of weight w (p/m/c) and quality q gives each material kind
function gearTone(w, q, kind) {
  const dye = GEAR_DYE[q - 1];
  if (kind === 'metal') return w === 'c' ? mixHex(dye, '#8a8a8a', 0.35) : rgb(GEAR_METAL[w][q - 1]);
  if (kind === 'leather') return mixHex(GEAR_LEATHER[w], dye, [0, 0.25, 0.35, 0.4, 0.45, 0.45][q - 1]);
  return w === 'm' ? mixHex(dye, '#3a3028', 0.2) : rgb(dye);
}
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
// remember each class mesh's own colours and which slot every vertex belongs to (by the bone that moves it most)
function gearPrep(root) {
  const U = root.userData;
  if (U.gearBase) return U.gearBase;
  const names = U.skeleton.bones.map((b) => b.name);
  const out = {};
  for (const kind of ['metal', 'leather', 'cloth']) {
    const mesh = U.meshes?.[kind];
    const geo = mesh?.geometry, C = geo?.attributes.color, SI = geo?.attributes.skinIndex, SW = geo?.attributes.skinWeight;
    if (!C || !SI || !SW) continue;
    const n = C.count, base = new Float32Array(n * 3), slot = new Int8Array(n).fill(-1), tab = new Uint8Array(n);
    const sum = new Float64Array(5), cnt = new Float64Array(5);
    for (let i = 0; i < n; i++) {
      base[i * 3] = C.getX(i); base[i * 3 + 1] = C.getY(i); base[i * 3 + 2] = C.getZ(i);
      let bi = SI.getX(i), bw = SW.getX(i);
      if (SW.getY(i) > bw) { bi = SI.getY(i); bw = SW.getY(i); }
      if (SW.getZ(i) > bw) { bi = SI.getZ(i); bw = SW.getZ(i); }
      if (SW.getW(i) > bw) { bi = SI.getW(i); }
      const s = GEAR_SLOT_ORDER.indexOf(BONE_SLOT[names[Math.round(bi)]]);
      slot[i] = s;
      if (/^tab[FB]/.test(names[Math.round(bi)])) tab[i] = 1; // the tabards: a Dragonslayer chest recolours them too
      if (s >= 0) { sum[s] += lum(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]); cnt[s]++; }
    }
    // each slot's average brightness: a vertex that bright takes the tone exactly, brighter trims stay brighter
    const ref = Array.from(sum, (v, s) => (cnt[s] ? v / cnt[s] : 0.5) || 0.5);
    // metal: the satin finish it was built with (rig.js headDullAttr), so a worn dark tint can go matte and come back
    const D = kind === 'metal' ? geo.attributes.dull : null;
    out[kind] = { base, slot, tab, ref, mesh, float: C.array instanceof Float32Array, dull: D ? Float32Array.from(D.array) : null };
  }
  return (U.gearBase = out);
}
// the body's surface round a bone at a height (bind pose, model space): the furthest a class mesh reaches from the bone's
// vertical axis (limbs), or forward of the centre line (the chest)
function gearReach(root, bone, y, tol, mode = 'radial') {
  const U = root.userData, b = U.rest[bone], names = U.skeleton.bones.map((x) => x.name);
  const want = new Set(mode === 'front' ? ['chest', 'spine'] : [bone]);
  // the new body (hero/heroBody.js): its vertices measured as they would sit on the old rig at rest
  const hero = U.hero, HB = hero ? HERO_OLD[bone] || (mode === 'front' ? 'spine_03' : null) : null, hv = hero ? new THREE.Vector3() : null;
  if (HB) { want.add(HB); if (mode === 'front') want.add('spine_02'); }
  let best = 0;
  for (const kind of ['metal', 'leather', 'cloth', 'pmetal', 'pleather', 'pcloth']) {
    const geo = U.meshes?.[kind]?.geometry;
    if (!geo) continue;
    const P = geo.attributes.position, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
    for (let i = 0; i < P.count; i++) {
      const py = P.getY(i);
      if (SW.getX(i) < 0.5 || !want.has(names[Math.round(SI.getX(i))])) continue;
      let px = P.getX(i), pz = P.getZ(i), qy = py;
      if (hero && SI.getX(i) >= hero.N) { hero.oldRest(Math.round(SI.getX(i)), px, py, pz, hv); px = hv.x; qy = hv.y; pz = hv.z; }
      if (Math.abs(qy - y) > tol) continue;
      if (mode === 'front') { if (Math.abs(px) < 0.05) best = Math.max(best, pz); }
      else best = Math.max(best, Math.hypot(px - b[0], pz - b[2]));
    }
  }
  return best;
}
const HERO_OLD = { foreL: 'lowerarm_l', foreR: 'lowerarm_r', thighL: 'thigh_l', thighR: 'thigh_r', shinL: 'calf_l', shinR: 'calf_r', chest: 'spine_03', armL: 'upperarm_l', armR: 'upperarm_r' };
// the pieces a worn slot adds, as skinned meshes on the character's own skeleton
function gearPieces(root, rb, slot, w, q) {
  const U = root.userData, R = U.rest;
  const trim = q >= 2 ? Q_TRIM[q] : null;
  const metal = w === 'c' ? 'cloth' : w === 'm' ? 'leather' : 'metal';
  const tone = gearTone(w, q, metal);
  const edge = trim || (w === 'p' ? '#6a6c70' : w === 'm' ? '#3a2616' : '#3e3226');
  const edgeKind = trim ? 'trim' : metal;
  const studs = q >= 4 ? (q >= 6 ? '#e2c47e' : q >= 5 ? '#e8c060' : '#c8ccd4') : null;
  // a band round a vertical limb bone at local height y: just outside whatever the outfit already has there
  const band = (bone, y, tube, extra = 0) => {
    const r = Math.max(0.05, gearReach(root, bone, R[bone][1] + y, 0.025)) + tube * 0.6 + extra;
    return r;
  };
  if (slot === 'hands') for (const s of ['L', 'R']) {
    const bone = 'fore' + s, y = -0.215;
    const r = band(bone, y, 0.012, 0.004);
    if (w === 'p') {
      // flared steel cuff and its edge
      rb.addW(shell([[r * 0.98, y - 0.035], [r * 1.12, y + 0.025]], 18), metal, () => [[bone, 1]], { p: [R[bone][0], R[bone][1], R[bone][2]], c: tone, taper: false });
      rb.addW(torus(r * 1.12, 0.009, 6, 20), edgeKind, () => [[bone, 1]], { p: [R[bone][0], R[bone][1] + y + 0.025, R[bone][2]], r: [PI / 2, 0, 0], c: edge, taper: false });
    } else if (w === 'm') {
      rb.addW(torus(r, 0.014, 6, 20), metal, () => [[bone, 1]], { p: [R[bone][0], R[bone][1] + y, R[bone][2]], r: [PI / 2, 0, 0], c: tone, taper: false });
      rb.addW(torus(r + 0.004, 0.006, 5, 20), edgeKind, () => [[bone, 1]], { p: [R[bone][0], R[bone][1] + y + 0.016, R[bone][2]], r: [PI / 2, 0, 0], c: edge, taper: false });
    } else {
      for (const dy of [0, 0.03]) rb.addW(torus(r - dy * 0.1, 0.008, 5, 18), dy ? edgeKind : 'cloth', () => [[bone, 1]], { p: [R[bone][0], R[bone][1] + y + dy, R[bone][2]], r: [PI / 2, 0, 0], c: dy ? edge : gearTone(w, q, 'cloth'), taper: false });
    }
    if (studs) for (const a of [0.6, -0.6]) {
      const sx = s === 'L' ? 1 : -1;
      rb.addW(sphere(0.01, 8, 6), 'trim', () => [[bone, 1]], { p: [R[bone][0] + Math.sin(a + (sx > 0 ? PI / 2 : -PI / 2)) * (r + 0.006), R[bone][1] + y, R[bone][2] + Math.cos(a + (sx > 0 ? PI / 2 : -PI / 2)) * (r + 0.006)], c: studs, taper: false });
    }
  }
  if (slot === 'legs') for (const s of ['L', 'R']) {
    if (w === 'c') {
      const bone = 'thigh' + s, y = -0.22;
      const r = band(bone, y, 0.011, 0.003);
      rb.addW(torus(r, 0.011, 6, 22), 'cloth', () => [[bone, 1]], { p: [R[bone][0], R[bone][1] + y, R[bone][2]], r: [PI / 2, 0, 0], c: gearTone(w, q, 'cloth'), taper: false });
      if (trim) rb.addW(torus(r + 0.002, 0.005, 5, 22), 'trim', () => [[bone, 1]], { p: [R[bone][0], R[bone][1] + y - 0.014, R[bone][2]], r: [PI / 2, 0, 0], c: trim, taper: false });
    } else {
      // knee cop: a cupped plate over the front of the knee, an edge round it, a stud from Epic
      const bone = 'shin' + s;
      const r = Math.max(0.07, gearReach(root, bone, R[bone][1] + 0.01, 0.03)) + 0.006;
      const kr = w === 'p' ? 0.07 : 0.06;
      const p = [R[bone][0], R[bone][1] + 0.02, R[bone][2] + r - kr * 0.55];
      rb.addW(sphere(kr, 14, 8, 0, PI * 2, 0, PI * 0.42), metal, () => [[bone, 1]], { p, r: [PI / 2 - 0.15, 0, 0], c: tone, taper: false });
      rb.addW(torus(kr * Math.sin(PI * 0.42), 0.007, 5, 18), edgeKind, () => [[bone, 1]], { p: [p[0], p[1] + Math.sin(0.15) * kr * Math.cos(PI * 0.42), p[2] + kr * Math.cos(PI * 0.42) * Math.cos(0.15)], r: [-0.15, 0, 0], c: edge, taper: false });
      if (studs) rb.addW(sphere(0.013, 8, 6), 'trim', () => [[bone, 1]], { p: [p[0], p[1], p[2] + kr * 0.9 + 0.004], c: studs, taper: false });
    }
  }
  if (slot === 'feet') for (const s of ['L', 'R']) {
    const bone = 'shin' + s, y = -0.19;
    const r = band(bone, y, 0.013, 0.004);
    rb.addW(torus(r, 0.013, 6, 20), w === 'c' ? 'cloth' : metal, () => [[bone, 1]], { p: [R[bone][0], R[bone][1] + y, R[bone][2]], r: [PI / 2, 0, 0], c: w === 'c' ? gearTone(w, q, 'cloth') : tone, taper: false });
    rb.addW(torus(r + 0.003, 0.006, 5, 20), edgeKind, () => [[bone, 1]], { p: [R[bone][0], R[bone][1] + y + 0.016, R[bone][2]], r: [PI / 2, 0, 0], c: edge, taper: false });
    if (w === 'p') {
      const fb = 'foot' + s, f = R[fb];
      rb.addW(rbox(0.14, 0.064, 0.13, 0.026), 'metal', () => [[fb, 1]], { p: [f[0], f[1] - 0.03, f[2] + 0.182], r: [0.16, 0, 0], c: tone, taper: false });
      rb.addW(box(0.142, 0.012, 0.016), edgeKind, () => [[fb, 1]], { p: [f[0], f[1] - 0.0, f[2] + 0.12], r: [0.16, 0, 0], c: edge, taper: false });
    }
    if (studs) for (const a of [-0.5, 0, 0.5]) rb.addW(sphere(0.009, 8, 6), 'trim', () => [[bone, 1]], { p: [R[bone][0] + Math.sin(a) * (r + 0.012), R[bone][1] + y, R[bone][2] + Math.cos(a) * (r + 0.012)], c: studs, taper: false });
  }
  if (slot === 'chest' && q >= 2) {
    // a rounded plaque on the breast, just in front of whatever the outfit has there
    const y = 1.42, z = Math.max(0.15, gearReach(root, 'chest', y, 0.035, 'front')) + 0.004;
    const pk = w === 'c' ? 'cloth' : metal;
    rb.addW(rbox(0.1, 0.085, 0.02, 0.012), pk, () => [['chest', 1]], { p: [0, y, z], c: w === 'c' ? gearTone(w, q, 'cloth') : tone, taper: false });
    rb.addW(rbox(0.112, 0.097, 0.012, 0.012), edgeKind, () => [['chest', 1]], { p: [0, y, z - 0.006], c: edge, taper: false });
    if (q >= 4) rb.addW(ico(0.02, 1), 'trim', () => [['chest', 1]], { p: [0, y, z + 0.014], s: [1, 1, 0.6], c: q >= 6 ? '#7a52c8' : q >= 5 ? '#ffc23a' : '#b070f0', taper: false });
  }
}
// the bone that moves a vertex most -> its GEAR_SLOT_ORDER slot (-1: none)
function vertexSlot(SI, SW, names, i) {
  let bi = SI.getX(i), bw = SW.getX(i);
  if (SW.getY(i) > bw) { bi = SI.getY(i); bw = SW.getY(i); }
  if (SW.getZ(i) > bw) { bi = SI.getZ(i); bw = SW.getZ(i); }
  if (SW.getW(i) > bw) bi = SI.getW(i);
  return GEAR_SLOT_ORDER.indexOf(BONE_SLOT[names[Math.round(bi)]]);
}
// write a skinned geometry's heat attribute from the worn slots (slot: a precomputed vertex -> slot list, else from the skin)
function gearUpg(root, geo, worn, slot = null) {
  const a = upgAttr(geo), A = a.array, n = geo.attributes.position.count;
  const SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight, names = root.userData.skeleton.bones.map((b) => b.name);
  for (let i = 0; i < n; i++) {
    const s = slot ? slot[i] : SI && SW ? vertexSlot(SI, SW, names, i) : -1, wq = s >= 0 ? worn[s] : null;
    // the head: the temper tint without the glow (negative), so nothing lights up near a faceless helm's front
    A[i * 2] = wq ? (s === 0 ? -wq[2] : wq[2]) : 0; A[i * 2 + 1] = wq ? wq[3] : 0;
  }
  a.needsUpdate = true;
  upgCover(root); // the class's pauldrons and anything else drawn with that material: zeros
}
export function setCharGear(root, gr) {
  const U = root.userData;
  if (!U.skeleton || !U.meshes || U.gearKey === (gr || '')) return;
  lookChange(root);
  U.gearKey = gr || '';
  const codes = String(gr || '').split('.');
  // each slot: [weight letter, quality 1..6, heat 0 or 7..10, sheen 0/1] (old codes 'p3' parse with no heat)
  // (a fifth entry marks a Dragonslayer piece: dsArmour.js wears its model; until then, and on cloth chests, the class's
  // own pieces there take the Dragonslayer palette instead of the worn weight's)
  const worn = GEAR_SLOT_ORDER.map((s, i) => { const L = parseLook(codes[i]); return L && /^[pmc]$/.test(L.w) ? [L.w, L.q, L.heat >= 7 ? L.heat : 0, L.q >= 6 ? 1 : 0, L.ds ? 1 : 0] : null; });
  // 1. recolour the class's own pieces slot by slot
  const base = gearPrep(root);
  for (const kind of Object.keys(base)) {
    const { base: B, slot, tab, ref, mesh, float, dull: D0 } = base[kind];
    const dsTab = worn[1]?.[4] ? 1 : -1; // a Dragonslayer chest: the class's tabards in its palette
    const C = mesh.geometry.attributes.color, max = float ? 1.6 : 1;
    // worn mail or cloth darkens the class's metal: a dark tint on polished metal keeps crisp highlights (two of them side
    // by side on a helm read as eyes), so those vertices go fully matte (rough, barely metallic)
    const DA = D0 && mesh.geometry.attributes.dull;
    if (DA) { for (let i = 0; i < D0.length; i++) { const wq = worn[slot[i]]; DA.array[i] = wq && wq[0] !== 'p' ? 1 : D0[i]; } DA.needsUpdate = true; }
    const tones = worn.map((wq) => (wq ? (wq[4] ? dsaTone(kind) : gearTone(wq[0], wq[1], kind)) : null));
    for (let i = 0; i < C.count; i++) {
      const s = slot[i] >= 0 ? slot[i] : tab[i] ? dsTab : -1, r = B[i * 3], g = B[i * 3 + 1], b = B[i * 3 + 2];
      const t = s >= 0 ? tones[s] : null;
      if (!t) { C.setXYZ(i, r, g, b); continue; }
      // keep the outfit's light and shade and some of its bright accents (gold trims), take the worn piece's colour
      const L = lum(r, g, b), mx = Math.max(r, g, b), sat = mx > 0 ? (mx - Math.min(r, g, b)) / mx : 0;
      const f = clamp(L / ref[s], 0.25, 1.8), K = worn[s][4] ? (kind === 'cloth' ? 0.95 : 0.92 - 0.3 * sat) : kind === 'cloth' ? 0.85 : 0.88 - 0.45 * sat;
      C.setXYZ(i, Math.min(max, lerp(r, t[0] * f, K)), Math.min(max, lerp(g, t[1] * f, K)), Math.min(max, lerp(b, t[2] * f, K)));
    }
    C.needsUpdate = true;
  }
  // heat and sheen (heat.js): the class's own metal in each worn slot and the worn pieces' metal and trims (cloth and
  // leather never heat). Per vertex, on the same meshes: no extra draw calls. Patched once a character first needs it.
  const heatOn = worn.some((wq) => wq && (wq[2] || wq[3]));
  if (heatOn || U.heatBody) {
    U.heatBody = true;
    if (base.metal) { heatCharMat(base.metal.mesh.material); gearUpg(root, base.metal.mesh.geometry, worn, base.metal.slot); }
  }
  // 2. the worn pieces' own parts
  for (const m of U.gearMeshes || []) { m.parent?.remove(m); m.geometry.dispose(); }
  U.gearMeshes = [];
  const rb = new RigBuilder();
  worn.forEach((wq, i) => { if (wq && !wq[4]) gearPieces(root, rb, GEAR_SLOT_ORDER[i], wq[0], wq[1]); });
  for (const kind of ['metal', 'leather', 'cloth', 'trim']) {
    if (!rb.parts[kind].length) continue;
    let mat = U.mats?.[kind];
    if (kind === 'trim') mat = U.gearTrimMat || (U.gearTrimMat = charMat('trim', { roughness: 0.2, metalness: 0.75 })); // polished metal trim, no glow
    else if (!mat) mat = U.gearMats?.[kind] || ((U.gearMats ||= {})[kind] = charMat(kind));
    const geo = mergeGeometries(rb.parts[kind], false);
    if (kind === 'metal') geo.setAttribute('dull', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count), 1));
    if (U.heatBody && (kind === 'metal' || kind === 'trim')) { heatCharMat(mat); gearUpg(root, geo, worn); }
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.0, 0), 2.6);
    mesh.bind(U.skeleton, new THREE.Matrix4());
    mesh.userData.gearPiece = true;
    root.add(mesh);
    U.gearMeshes.push(mesh);
  }
  dsaLater(root);
}
// the Dragonslayer armour models (dsArmour.js) follow the look codes once all of a look's setChar* calls are in (they
// come one after another: setCharArmor, setCharCape, setCharGear), so a change of look builds the merged mesh once
function dsaLater(root) {
  const U = root.userData;
  if (U.dsaQueued) return;
  U.dsaQueued = true;
  queueMicrotask(() => { U.dsaQueued = false; tripoBodySync(root); dsaSync(root); }); // (the Tripo body first: the armour masks it)
}

// --------------------------------------------------------------------------
// CLASS DEFINITIONS
const OUTFITS = {
  knight(rb, v = 0) {
    const metal = '#c8ced8', gold = '#e2ad3e', blue = ['#2c4a9a', '#8a2626', '#2a6a3a'][v % 3];
    baseBody(rb, { suit: '#2a3550', pants: '#2a3550', glove: metal, gloveKind: 'metal', boot: metal, bootKind: 'metal', bulk: 1.05 });
    breastplate(rb, metal, gold);
    tassets(rb, metal, gold);
    greaves(rb, metal, gold);
    gauntlets(rb, metal, gold);
    pauldron(rb, 'L', { metal, trim: gold, gem: '#5aa8ff' });
    pauldron(rb, 'R', { metal, trim: gold, gem: '#5aa8ff' });
    belt(rb, '#5a3a22', gold, 2);
    tabard(rb, 'F', blue, gold, { emblem: 'sun' });
    tabard(rb, 'B', blue, gold, { len: 0.55 });
    cape(rb, { outer: '#f1ebdd', inner: blue, clasp: gold, len: 1.18, border: gold, z0: 0.19 });
    clothShoulders(rb, '#f1ebdd', gold);
    greatHelm(rb, metal, gold);
    rb.attachTo('weaponR', longsword(), { r: [PI / 2, 0, 0] });
    rb.attachTo('foreL', kiteShield(), { p: [0.1, -0.15, 0.02], r: [0, PI / 2, 0] });
  },
  ranger(rb, v = 0) {
    const green = ['#4f6e2a', '#7a4a24', '#46566a'][v % 3], greenIn = ['#2f4418', '#4a2c14', '#2a3440'][v % 3], leather = '#7a5230', dark = '#4e3420';
    baseBody(rb, { suit: '#5a4630', pants: '#5a4630', sleeve: '#4a3a26', glove: dark, boot: '#4a3420' });
    rb.addW(shell([[0.205, 1.0], [0.21, 1.12], [0.23, 1.3], [0.245, 1.44], [0.22, 1.53], [0.15, 1.59]], 20), 'leather', (x, y) => torsoW(y), { s: [1, 1, 0.69], c: leather });
    for (let i = 0; i < 4; i++) rb.addW(box(0.36, 0.012, 0.012), 'leather', (x, y) => torsoW(y), { p: [0, 1.16 + i * 0.08, 0.16], c: dark });
    leatherPauldron(rb, 'L', '#6a4626', dark);
    leatherPauldron(rb, 'R', '#6a4626', dark);
    bracers(rb, '#6a4626', dark);
    belt(rb, dark, '#c8a050', 3);
    tabard(rb, 'F', '#5a4630', dark, { w: 0.28, len: 0.5 });
    tabard(rb, 'B', '#5a4630', dark, { w: 0.3, len: 0.5 });
    cape(rb, { outer: green, inner: greenIn, len: 1.05, tattered: true, w1: 0.66, out: 0.03 });
    hood(rb, green, { fur: '#d8c8a0' });
    quiver(rb);
    // limbs run along the fist's grip axis; the string sits on the archer's side of the hand (toward the wrist)
    rb.attachTo('weaponL', recurveBow(), { r: [-PI / 2, 0, 0] });
    rb.attachTo('hips', dagger(), { p: [-0.2, -0.08, 0.05], r: [PI * 0.92, 0, 0.3] });
  },
  chemist(rb, v = 0) {
    const coat = ['#4e2e62', '#245262', '#6a2a2a'][v % 3], coatDark = ['#341c44', '#163640', '#441a1a'][v % 3], brass = '#d9a650', apron = '#7a5232';
    baseBody(rb, { suit: '#2e2a30', pants: '#3a2e2a', sleeve: coat, glove: '#2a1e16', boot: '#3a2616' });
    labCoat(rb, coat, coatDark, brass);
    // leather apron over the coat
    tabard(rb, 'F', apron, '#4a2e1a', { w: 0.3, len: 0.86, point: false });
    rb.addW(shell([[0.215, 1.1], [0.235, 1.3], [0.24, 1.36]], 20), 'leather', (x, y) => torsoW(y), { s: [1, 1, 0.7], c: apron });
    belt(rb, '#3a2414', brass, 2);
    bandolier(rb, ['#c080ff', '#ffb040', '#80ffb0', '#ff7050', '#c080ff', '#80d8ff']);
    goggleMask(rb, coatDark, brass);
    pressureTank(rb, brass);
    rb.attachTo('weaponR', reactorRod(), { r: [PI / 2, 0, 0] });
  },
  sandblade(rb, v = 0) {
    const cream = '#e8d8b4', red = ['#a32e2e', '#22608a', '#3a6e2a'][v % 3], leather = '#7a5230';
    baseBody(rb, { suit: cream, pants: '#d8c8a0', sleeve: cream, glove: leather, boot: '#5a3a22' });
    // baggy trousers
    for (const s of ['L', 'R']) rb.add(lathe([[0.001, -0.42], [0.09, -0.4], [0.13, -0.28], [0.12, -0.1], [0.11, 0.0]], 14), 'cloth', 'thigh' + s, { c: '#ddcca4' });
    rb.addW(shell([[0.21, 0.98], [0.215, 1.12], [0.235, 1.3], [0.245, 1.44], [0.22, 1.53], [0.15, 1.6]], 20), 'cloth', (x, y) => torsoW(y), { s: [1, 1, 0.7], c: cream });
    // wide red sash with gold pattern
    rb.addW(shell([[0.225, 0.96], [0.235, 1.04], [0.23, 1.12]], 22), 'cloth', () => [['hips', 1]], { s: [1, 1, 0.74], c: red });
    for (const y of [0.97, 1.11]) rb.addW(torus(0.232, 0.008, 5, 26), 'metal', () => [['hips', 1]], { p: [0, y, 0], r: [PI / 2, 0, 0], s: [1, 0.74, 1], c: '#e0b04a' });
    tabard(rb, 'F', red, '#e0b04a', { w: 0.26, len: 0.62, emblem: 'diamond' });
    tabard(rb, 'B', red, '#e0b04a', { w: 0.26, len: 0.55 });
    bracers(rb, leather, '#3a2616');
    leatherPauldron(rb, 'L', leather);
    belt(rb, '#4a2e1a', '#e0b04a', 2);
    turban(rb, cream, red);
    // diagonal scarf over the torso (spine and chest only, so a Dragonslayer chest hides all of it)
    rb.addW(box(0.07, 0.66, 0.02), 'cloth', (x, y) => torsoW(Math.max(y, 1.2)), { p: [0.02, 1.33, 0.17], r: [0, 0, -0.6], c: red });
    rb.attachTo('weaponR', scimitar(), { r: [PI / 2, 0, 0] });
    rb.attachTo('foreL', roundShield(), { p: [0.1, -0.14, 0.02], r: [0, PI / 2, 0] });
  },
  warden(rb, v = 0) {
    // blackened steel with warm bronze trim and a crimson (or slate, or olive) tabard and cape: no longer a dark knight
    const steel = '#868b96', bronze = '#c08a4a';
    const cloth = ['#8a2626', '#2e4e5e', '#4e5a26'][v % 3], capeO = ['#7a1e1e', '#24404e', '#424a1e'][v % 3], capeI = ['#3a1010', '#142630', '#262c10'][v % 3];
    rb.matTweak.metal = { envMapIntensity: 1.3, roughness: 0.46, metalness: 0.45 };
    rb.matTweak.pmetal = rb.matTweak.metal;
    baseBody(rb, { suit: '#3a3434', pants: '#3a3434', glove: steel, gloveKind: 'metal', boot: steel, bootKind: 'metal', bulk: 1.15 });
    breastplate(rb, steel, bronze, { heavy: true });
    tassets(rb, steel, bronze);
    greaves(rb, steel, bronze);
    gauntlets(rb, steel, bronze);
    pauldron(rb, 'L', { metal: steel, trim: bronze, size: 1.32, lames: 3 });
    pauldron(rb, 'R', { metal: steel, trim: bronze, size: 1.32, lames: 3 });
    belt(rb, '#3a2616', bronze, 2);
    tabard(rb, 'F', cloth, bronze, { emblem: 'diamond', w: 0.4 });
    tabard(rb, 'B', cloth, bronze, { w: 0.4, len: 0.55 });
    cape(rb, { outer: capeO, inner: capeI, clasp: bronze, len: 1.15, w1: 0.86, w0: 0.52, border: bronze, z0: 0.2, hem: 'flat' });
    bucketHelm(rb, steel, bronze, { stepped: true });
    rb.attachTo('weaponR', warhammer(), { r: [PI / 2, 0, 0] });
    rb.attachTo('foreL', towerShield(), { p: [0.12, -0.12, 0.02], r: [0, PI / 2, 0] });
  },
  herbalist(rb, v = 0) {
    const cream = '#e8dcc0', green = ['#4f7a2a', '#2a6a6a', '#8a6a2a'][v % 3], hoodC = ['#4a6a24', '#24605e', '#7a5e24'][v % 3], gold = '#d8b04a';
    baseBody(rb, { suit: '#5a4a30', pants: '#5a4a30', glove: '#4a3420', boot: '#4a3420' });
    robeTop(rb, cream, gold, green);
    robeSkirt(rb, cream, gold, { len: 0.9, flare: 0.36 });
    tabard(rb, 'F', green, gold, { w: 0.26, len: 0.72, emblem: 'sun' });
    tabard(rb, 'B', green, gold, { w: 0.3, len: 0.7 });
    belt(rb, '#4a3420', gold, 3);
    // herb bundles and flasks
    for (let i = 0; i < 3; i++) rb.add(cyl(0.02, 0.02, 0.08, 8), 'glow', 'hips', { p: [-0.18 + i * 0.05, -0.06, 0.15], c: '#9ae84a' });
    rb.add(sphere(0.07, 10, 8), 'leather', 'hips', { p: [0.2, -0.1, 0.06], s: [1, 1.2, 0.8], c: '#7a5a34' });
    leafMantle(rb, ['#4f7a24', '#6a9a30', '#3d6420', '#86b040']);
    hood(rb, hoodC, { trim: gold, pointed: 0.1 });
    rb.attachTo('weaponR', herbStaff(), { r: [PI / 2, 0, 0] });
  },
  // the Ironclad Gunhand (body B): v0 black and rust (the concept), v1 slate and tan, v2 grey and teal
  deadeye(rb, v = 0) {
    const [coat, accent, hat] = DEADEYE_LOOKS[v % 3];
    const brass = '#c89a50', steel = '#666a72';
    rb.matTweak.metal = { envMapIntensity: 0.9, roughness: 0.5, metalness: 0.5 };
    baseBody(rb, { suit: '#2e2824', pants: '#2e2824', sleeve: coat, glove: '#6a5442', gloveKind: 'metal', boot: '#2e2620' });
    roadCoat(rb, coat, accent, brass);
    gunSash(rb, accent);
    belt(rb, '#2a1c14', brass, 0);
    holsters(rb, brass);
    bandolierStrap(rb, '#3a2618', brass);
    scarfHead(rb, shadeHex(coat, 0.8), shadeHex(accent, 0.5));
    // (the hat band in the hat's own darker leather: an accent band showed as a coloured arc round the crown from above
    // whenever the head tipped forward)
    roadHat(rb, hat, shadeHex(hat, 0.62));
    // a matched pair of leather shoulder plates, brass-studded (two squared lames each side, sat down onto the shoulder; hidden under
    // worn shoulder armour) (squared plates, not the round lames: seen from below while aiming their rims floated like rings)
    for (const [s, sx] of [['L', 1], ['R', -1]]) {
      for (const [w, h, d, x, y, rz] of [[0.15, 0.032, 0.18, 0.035, 0.035, 0.5], [0.13, 0.03, 0.16, 0.08, -0.03, 0.92]]) {
        rb.add(rbox(w, h, d, 0.014), 'pleather', 'arm' + s, { p: [sx * x, y, 0], r: [0, 0, -sx * rz], c: '#3e2a1c', paint: 0.35 });
        rb.add(sphere(0.011, 6, 4), 'pmetal','arm' + s, { p: [sx * (x - 0.03 * Math.cos(rz)), y + 0.024 + 0.03 * Math.sin(rz), d * 0.38], c: brass });
      }
    }
    // boots: steel toe caps, a strap below the knee and a steel band round the shaft
    for (const s of ['L', 'R']) {
      rb.add(rbox(0.13, 0.06, 0.1, 0.022), 'metal', 'foot' + s, { p: [0, -0.03, 0.19], r: [0.16, 0, 0], c: steel });
      rb.add(shell([[0.084, -0.17], [0.084, -0.11]], 14), 'metal', 'shin' + s, { c: steel });
      rb.add(shell([[0.08, -0.06], [0.08, -0.02]], 14), 'leather', 'shin' + s, { c: '#3a2416' });
    }
    rb.attachTo('weaponR', pistol(), { r: [PI / 2, 0, 0] });
    const sa = sidearm(); sa.userData.isSidearm = true;
    rb.attachTo('weaponL', sa, { r: [PI / 2, 0, 0] });
  },
  // 0 Dustcloak raider, 1 Dustcloak lookout (bow), 2 Varrok, 3 Briar cutthroat, 4 Briar bowman, 5 Garrick Briar,
  // 6 Glade poacher, 7 Deepmine sapper, 8 Dustcloak looter, 9 Rustwood scavenger, 10 Rask the Looter-King, 11 Overseer Dregg,
  // 12 Briar smuggler, 13-15 the Cragborn of the Highreach
  raider(rb, v = 0) {
    const P = [
      ['#4a3020', '#3e2a22', '#3a2a20', 'daggers'],
      ['#4a3020', '#6a2a22', '#3a2a20', 'bow'],
      ['#5a2a20', '#3e2a22', '#3a2a20', 'axe', { cape: ['#6a1e18', '#3a1210'], pauldron: '#5a5a62' }],
      ['#3e3a22', '#3f5a2a', '#2e3420', 'daggers'],
      ['#3e3a22', '#4a6a2a', '#2e3420', 'bow'],
      ['#4a3a20', '#2f4a22', '#2a3020', 'axe', { cape: ['#2f4a22', '#1a2a12'], pauldron: '#6a6a70' }],
      ['#5a4a2a', '#7a6a3a', '#4a4030', 'daggers'],
      ['#4a3a2a', '#6a5038', '#3a3028', 'axe', { lamp: true }],
      ['#6a5030', '#b0904e', '#5a4630', 'daggers'],
      ['#3a3a3a', '#5a5a58', '#2e2e2e', 'axe'],
      ['#6a5030', '#a8803e', '#4a3a28', 'daggers', { cape: ['#8a6a3a', '#4a3a20'], pauldron: '#8a7a5a' }],
      ['#4a3a2a', '#5a4030', '#3a3028', 'axe', { cape: ['#4a3020', '#2a1a10'], pauldron: '#5a5a62', lamp: true }],
      ['#3e3a22', '#2f4a22', '#2a3020', 'daggers', { cape: ['#6a4a2a', '#3a2a14'], pauldron: '#7a6a50' }],
      // 13 Cragborn marauder, 14 Cragborn slinger, 15 Thane Halbrek (Highreach)
      ['#3a4048', '#5a6a7a', '#2a3038', 'axe', { pauldron: '#7a8088' }],
      ['#3a4048', '#6a7a88', '#2a3038', 'bow'],
      ['#2e343c', '#4a5a6e', '#22282e', 'axe', { cape: ['#3a4a5e', '#1e2630'], pauldron: '#9aa0a8', lamp: true }],
      // 16 Stormworks lineman, 17 Chief Engineer Voss
      ['#3a3226', '#5a6a5a', '#2a2a22', 'axe', { lamp: true }],
      ['#3a2a1e', '#2e4a5a', '#22201c', 'axe', { cape: ['#2a4a5a', '#162630'], pauldron: '#c88a4a', lamp: true }],
      // 18 Concord enforcer, 19 Concord marksman, 20 Factor Corvane: the Brass Concord's white and brass
      ['#5a4632', '#ddd5c4', '#3a3632', 'axe', { pauldron: '#c8a050' }],
      ['#5a4632', '#d4ccba', '#34302c', 'bow'],
      ['#4a3a2a', '#e8e0d0', '#2e2a26', 'axe', { cape: ['#e2d8c4', '#8a6a3a'], pauldron: '#d8b060', lamp: true }],
      // 21 Sealmaster Orrin, keeper of the Concord's strongrooms
      ['#3a2e24', '#e6d8b8', '#2a2622', 'axe', { cape: ['#c8a050', '#5a3e1a'], pauldron: '#e8c870' }],
      // 22 the Provost of the Brass Concord: charcoal coat, brass and gold
      ['#2a2420', '#3a3430', '#1e1a18', 'axe', { cape: ['#2e2a26', '#c8a050'], pauldron: '#e8c060', lamp: true }],
      // 23 Guild riveter, 24 Guild harpooneer (bow), 25 Guild yard-foreman: the Shipwrights' Guild's navy and copper
      ['#3a2a1e', '#2e4a6a', '#1e2430', 'axe', { pauldron: '#c87a3a' }],
      ['#3a2a1e', '#34506e', '#1e2430', 'bow'],
      ['#2e241c', '#26405e', '#1a2028', 'axe', { cape: ['#26405e', '#c87a3a'], pauldron: '#d88a46', lamp: true }],
      // 26 the Guildmaster of the Shipwrights' Guild: deep navy and gold
      ['#241c16', '#1e3048', '#141a22', 'axe', { cape: ['#1e3048', '#e0b050'], pauldron: '#f0c860', lamp: true }],
      // 27 Glasswright kilnhand, 28 Glasswright sling-thrower, 29 Kilnmaster: bleached white and teal
      ['#5a4a38', '#e8e4d8', '#3a3a34', 'axe', { pauldron: '#4ab8b0' }],
      ['#5a4a38', '#dcd8ca', '#3a3a34', 'bow'],
      ['#4a3c2e', '#eeeae0', '#2e2e2a', 'axe', { cape: ['#eeeae0', '#2a9a94'], pauldron: '#5ad0c8', lamp: true }],
      // 30 the Glasswright of Vitrea: white, teal and gold
      ['#3a3026', '#f4f0e6', '#24282a', 'axe', { cape: ['#2a9a94', '#e8c060'], pauldron: '#e8c060', lamp: true }],
    ];
    const [leather, cloth, suit, weapon, ex = {}] = P[v] || P[0];
    baseBody(rb, { suit, pants: suit, glove: '#2a1c12', boot: '#2e2016' });
    rb.addW(shell([[0.205, 1.0], [0.21, 1.12], [0.23, 1.3], [0.245, 1.44], [0.22, 1.53], [0.15, 1.59]], 20), 'leather', (x, y) => torsoW(y), { s: [1, 1, 0.69], c: leather });
    leatherPauldron(rb, 'R', '#3a2616');
    bracers(rb, '#3a2616');
    belt(rb, '#2a1c12', '#8a7a5a', 2);
    tabard(rb, 'F', cloth, '#2a1c12', { w: 0.26, len: 0.48, point: false });
    hood(rb, cloth, { pointed: 0.05 });
    if (ex.pauldron) pauldron(rb, 'L', { metal: ex.pauldron, trim: '#8a6a3a', size: 1.2, spike: true });
    if (ex.cape) cape(rb, { outer: ex.cape[0], inner: ex.cape[1], len: 1.0, tattered: true });
    if (ex.lamp) { rb.add(cyl(0.05, 0.05, 0.1, 8), 'glow', 'hips', { p: [0.2, -0.04, 0.1], c: '#ffc860' }); rb.add(cyl(0.06, 0.06, 0.02, 8), 'metal', 'hips', { p: [0.2, 0.02, 0.1], c: '#8a7a5a' }); }
    if (weapon === 'axe') rb.attachTo('weaponR', battleAxe(), { r: [PI / 2, 0, 0] });
    else if (weapon === 'bow') { quiver(rb); rb.attachTo('weaponL', recurveBow(), { r: [-PI / 2, 0, 0] }); rb.attachTo('hips', dagger(), { p: [-0.2, -0.08, 0.05], r: [PI * 0.92, 0, 0.3] }); }
    else { rb.attachTo('weaponR', dagger(), { r: [PI / 2, 0, 0] }); rb.attachTo('weaponL', dagger(), { r: [PI / 2, 0, 0] }); }
  },
  // townsfolk: four cuts (long robe and hood, tunic and wrap, short tunic and cowl, work coat) across eight earthy
  // colourways, both picked from the variant so a crowd rarely repeats; v 0-2 keep their old colours
  villager(rb, v = 0) {
    const COLS = [['#6a5a3a', '#8a7a52'], ['#3a5a6a', '#7a8a8a'], ['#6a3a3a', '#a08a6a'], ['#4a5a34', '#9a9a6a'], ['#5a4a5e', '#a89a88'],
      ['#7a5a2e', '#c8a870'], ['#36484a', '#b8a888'], ['#6e6252', '#3e3428']];
    const PANTS = ['#4a3a2a', '#3a3430', '#4e4436', '#2e3438'];
    const cols = COLS[v < 3 ? v : (v * 5 + 3) % COLS.length], cut = v < 3 ? 0 : (v * 3 + 1) % 4, pants = PANTS[(v * 7) % PANTS.length];
    baseBody(rb, { suit: cols[0], pants, glove: '#3a2a1a', boot: v % 2 ? '#3a2a1a' : '#4a3424' });
    if (cut === 3) {
      // a long belted work coat with no standing collar (a high collar rings the head when seen from above)
      robeTop(rb, cols[0], cols[1], cols[1]);
      robeSkirt(rb, cols[0], cols[1], { len: 0.82, flare: 0.14 });
      belt(rb, '#3a2616', '#a08050', 2);
    } else {
      robeTop(rb, cols[0], cols[1], cut === 1 ? cols[1] : cols[0]);
      if (cut === 0) robeSkirt(rb, cols[0], cols[1], { len: 0.6, flare: 0.3 });
      if (cut === 2) robeSkirt(rb, cols[0], cols[1], { len: 0.34, flare: 0.2 });
      belt(rb, cut === 1 ? '#5a3a22' : '#3a2616', '#a08050', cut === 1 ? 2 : 1);
    }
    if (cut === 0) hood(rb, cols[1], { pointed: 0.04 });
    else if (cut === 1) workCap(rb, cols[1], cols[0]);
    else if (cut === 2) hood(rb, cols[1], { pointed: 0, trim: cols[0] });
    else workCap(rb, '#cdbd98', cols[1]);
  },
};

export const CLASS_IDS = ['knight', 'ranger', 'chemist', 'sandblade', 'warden', 'herbalist', 'deadeye'];

export function buildCharacter(kind, variant = 0) {
  const rb = new RigBuilder();
  rb.hero = heroRig(kind); // null unless the new body is on
  OUTFITS[kind](rb, variant);
  const sliver = new THREE.BufferGeometry();
  sliver.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.4, -0.02, 0.001, 1.4, -0.02, 0, 1.401, -0.02], 3));
  rb.addW(sliver, 'dark', () => [['cape1', 0.34], ['cape2', 0.33], ['cape3', 0.33]], { taper: false });
  const root = rb.build(kind + ':' + variant + (rb.hero ? ':h' : '')); // characters of one look share their vertex arrays (rig.js)
  root.userData.kind = kind;
  root.userData.variant = variant;
  if (rb.hero) rb.hero.finish(root);
  if (kind === 'deadeye') dsaLater(root); // the Tripo body (tripoBody.js) for a look no setChar* call follows
  // find the bow string for live updates
  root.traverse((o) => { if (o.userData?.string) root.userData.bow = o; });
  return root;
}
