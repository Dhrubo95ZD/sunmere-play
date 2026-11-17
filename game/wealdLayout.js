// The Russet Weald (Part Fifteen): the wood's dressing, built into the world's wealdGroup (World.buildWeald).
//   the ropeway's lower station (a stone pad, a square timber station house with a flat roof over the solid bull wheel, the
//   car parked on its one straight hanger, square timber trestle towers with straight legs and level ties climbing the south
//   bank, the two ropes) · the Woodwrights' camp (square huts in the v111/v112 look round a worked square, a fire, benches,
//   cordwood stacked parallel) · the saw pits (square pits, a log on straight-legged trestles over each, sawdust heaps) · the
//   rides (straight, meeting only at T junctions; the crowns kept apart over each ride's line) · the Long Sheds (long square
//   seasoning sheds with straight-pitched roofs, the side walls parallel louvre slats between square posts, all jammed shut;
//   the first shed's west gable door onto the lofts' pad) · log decks (trunks lying parallel along the ride) · open
//   seasoning stacks (solid blocks with layer lines on the sides only) · the coppice panels (stools as upright offset clumps
//   of straight stems) under the standards (great oaks with smooth grey trunks and copper and gold crowns) · the Standards'
//   high wood (many half-cut and standing dead) · the Coppice Engine's twin ruts · the great ride's gate (two square posts
//   under a flat lintel) · the marked fall lines (banded posts at both edges of the ride, the half-cut standard at the base
//   that the gale throws down along the line) · bracken in single upright cards, grey stones, fallen branches lying
//   parallel · mist in the hollows · the gale: the standards come down, the mist thins and runs, the crowns sway harder
// Content rules: no domes, arches, spires, crosses, stars, sunbursts, crescents or spoked wheels; every opening square with a
// flat lintel; trestles and racks with straight legs (never X legs or X bracing); trunks, logs and slats parallel (never
// criss-crossed); cut ends and stump tops one plain colour (no growth rings); leaves plain ovals in lobed clumps; coppice
// never fans out from a centre; no ring of stones or mushrooms anywhere; no animals (a quiet, rustling wood); checked from
// straight above, from the ride floor and from the ropeway car.
import * as THREE from 'three';
import * as P from '../assets/props.js';
import { Builder, box, cyl, lumpy, sphere, tube, V3 } from '../assets/kit.js';
import { addRock, leafCluster } from '../assets/trees.js';
import { WEALD, wealdHeight, wealdGap, wealdPathDist, rideAt, panelAt, highwoodAt, shedAt, hollowK, fallLine, fallState, galeLevel } from '/sunmere-play/shared/weald.js';
import { NPCS, NODES, OBJECTS } from '/sunmere-play/shared/data.js';
import { mulberry32 } from '/sunmere-play/shared/noise.js';
import { DUNGEONS } from '/sunmere-play/shared/dungeons.js';
import { markDynamic } from './freeze.js';
import { stoneBench, sacks } from './reachLayout.js';
import { seedHut } from './rainwardLayout.js';
import { texTint } from '../assets/houses/parts.js';

const PI = Math.PI;
const ST = '#8a8a84', ST_L = '#aaa89e', TIMBER = '#4a3a2c', TIMBER_D = '#2e241c', PLANK = '#6e5a44', IRON = '#34363a', DUST = '#d8c49a';
const COPPER = ['#c8743a', '#b85e2a', '#d68a44'], GOLD = ['#e0b04a', '#d4a03c', '#ecc25e'];
const res = (b, extra = {}) => ({ builder: b, fires: [], glows: [], lanterns: [], smokes: [], colliders: [], ...extra });
const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _q = new THREE.Quaternion();
function beam(b, a, c, w, mat = 'beam', col = 0xffffff, d = w) {
  _d.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const L = _d.length(); _q.setFromUnitVectors(_up, _d.normalize());
  b.add(box(w, L, d), mat, { p: [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2], q: _q.clone(), c: col });
}
// a log along local x (a plain cylinder: its ends one flat plain colour, no rings)
function logX(b, L, r, p, col = '#d0c8bc', endC = '#c0a47c') {
  b.add(cyl(r, r * 1.04, L, 10), 'barkGrey', { p, r: [0, 0, PI / 2], c: col });
  for (const s of [-1, 1]) b.add(cyl(r * 0.96, r * 0.96, 0.03, 10), 'woodLight', { p: [p[0] + s * L / 2, p[1], p[2]], r: [0, 0, PI / 2], c: endC });
}

// ------------------------------------------------------------------ trees (local, ground at y 0)
// a great standard: a tall smooth grey trunk, three or four limbs climbing at uneven turns and heights, a crown of lobed
// copper and gold clumps (plain oval leaves) on a solid leaf-mass core
function standardTree(seed, scale = 1) {
  const b = new Builder(seed * 37 + 5);
  const H = b.r(7.5, 9.5) * scale, r0 = b.r(0.5, 0.62) * scale;
  const bend = (y) => 0.04 * Math.pow(Math.max(0, y / (H * 2)), 2) * H;
  const tw = (x, y) => [bend(y), 0, 0, 0];
  const lean = V3(b.r(-0.25, 0.25), 0, b.r(-0.25, 0.25));
  const pts = [V3(0, -0.4, 0), V3(lean.x * 0.3, H * 0.35, lean.z * 0.3), V3(lean.x * 0.7, H * 0.7, lean.z * 0.7), V3(lean.x, H, lean.z)];
  const greyC = (x, y) => { const k = 0.82 + 0.18 * Math.min(1, y / 3); return [k, k, k * 0.98]; };
  b.add(tube(pts, (t) => r0 * (1 + 0.45 * Math.pow(Math.max(0, 1 - t / 0.12), 2)) * (1 - 0.42 * t), 12, 14), 'barkGrey', { uv: 'keep', c: greyC, w: tw });
  const top = pts[3], canopyC = V3(top.x, H + 3.2 * scale, top.z), clusters = [];
  // (RF.5) three limbs at uneven angles, rising steeply with a short reach: the crowns are cut away round the hero, and four
  // long limbs at near right angles drew a big X (a cross) on the ground's view from straight above
  const nL = 3, a0 = b.r(0, 6.28), steps = [0, 2.0, 4.15];
  for (let i = 0; i < nL; i++) {
    const a = a0 + steps[i] + b.r(-0.25, 0.25), d = V3(Math.cos(a), 0, Math.sin(a)), L = b.r(3.0, 4.2) * scale;
    const st = pts[2].clone().lerp(top, 0.2 + i * 0.3 + b.r(-0.08, 0.08));
    const lp = [st, st.clone().addScaledVector(d, L * 0.25).add(V3(0, L * 0.6, 0)), st.clone().addScaledVector(d, L * 0.6).add(V3(0, L * 0.95, 0))];
    b.add(tube(lp, (t) => r0 * 0.38 * (1 - 0.65 * t), 8, 8), 'barkGrey', { uv: 'keep', c: greyC, w: tw });
    clusters.push({ c: lp[2].clone().add(V3(0, 0.6, 0)), R: b.r(2.0, 2.5) * scale }, { c: lp[1].clone().add(V3(0, 0.8, 0)), R: b.r(1.5, 1.9) * scale });
  }
  clusters.push({ c: canopyC.clone(), R: 2.7 * scale }, { c: canopyC.clone().add(V3(b.r(-1, 1), 1.2 * scale, b.r(-1, 1))), R: 2.0 * scale });
  const gold = seed % 3 === 0;
  for (const cl of clusters) {
    const sway = (p) => [bend(p.y), 0.09 * Math.min(1, Math.hypot(p.x - top.x, p.z - top.z) / 4) * scale, 0, 0];
    const leaf = (gold ? b.r() < 0.75 : b.r() < 0.3) ? 'leafGold' : 'leafCopper';
    leafCluster(b, leaf, cl.c, cl.R, Math.round(7 + cl.R * 3.2), { canopyC, tintLo: '#a89a8c', tintHi: '#ffffff', yLo: H - 0.5, yHi: H + 6 * scale, wind: sway, size: 1.4, upBias: 0.8, core: leaf === 'leafGold' ? 'coreGold' : 'coreCopper' });
  }
  return { builder: b, collider: { r: r0 * 1.2 }, height: H + 6 * scale };
}
// a half-cut standard left standing dead: the grey trunk, two short bare limbs at different heights, a dark felling notch
// cut in one side a metre up (left half done), the bark peeling pale; dead: no leaves at all, or a few dry clumps
function deadStandard(seed, scale = 1, notch = true, dry = false) {
  const b = new Builder(seed * 41 + 3);
  const H = b.r(8, 10.5) * scale, r0 = b.r(0.5, 0.6) * scale;
  const pts = [V3(0, -0.4, 0), V3(0, H * 0.4, 0), V3(b.r(-0.2, 0.2), H * 0.8, b.r(-0.2, 0.2)), V3(b.r(-0.3, 0.3), H, b.r(-0.3, 0.3))];
  const deadC = (x, y) => { const k = 0.9 + 0.1 * Math.min(1, y / 3); return [k * 0.98, k * 0.96, k * 0.9]; };
  b.add(tube(pts, (t) => r0 * (1 + 0.4 * Math.pow(Math.max(0, 1 - t / 0.12), 2)) * (1 - 0.6 * t), 12, 12), 'barkGrey', { uv: 'keep', c: deadC });
  const a0 = b.r(0, 6.28);
  for (let i = 0; i < 2; i++) {
    const a = a0 + i * 2.3, d = V3(Math.cos(a), 0, Math.sin(a)), st = pts[1].clone().lerp(pts[3], 0.35 + i * 0.4), L = b.r(1.6, 2.6) * scale;
    b.add(tube([st, st.clone().addScaledVector(d, L * 0.5).add(V3(0, L * 0.7, 0)), st.clone().addScaledVector(d, L).add(V3(0, L * 1.1, 0))], (t) => r0 * 0.3 * (1 - 0.7 * t), 7, 6), 'barkGrey', { uv: 'keep', c: deadC });
    if (dry) leafCluster(b, 'leafCopper', st.clone().addScaledVector(d, L).add(V3(0, L * 1.1 + 0.4, 0)), 1.1 * scale, 6, { canopyC: pts[3], tintLo: '#8a6a52', tintHi: '#b8987c', yLo: H - 2, yHi: H + 2, wind: () => [0, 0.05, 0, 0], size: 1.3, core: null });
  }
  // the felling notch: a dark square-cut wedge on +z a metre up, its faces plain pale wood
  if (notch) { b.add(box(r0 * 1.5, 0.34, r0 * 0.7), 'woodLight', { p: [0, 1.05, r0 * 0.78], c: '#c8b08a' }); b.add(box(r0 * 1.4, 0.26, r0 * 0.6), 'wDark', { p: [0, 1.05, r0 * 0.86], c: '#2a2420' }); }
  return { builder: b, collider: { r: r0 * 1.2 } };
}
// a coppice stool: a low knuckled stool and straight stems standing upright from it at offset points (never fanning out
// from a centre: each stem rises near-vertical where it stands), a small lobed clump on each stem's head. age 0 just cut
// (short shoots), 1 young poles, 2 grown poles, 3 overgrown
function coppiceStool(seed, age = 2) {
  const b = new Builder(seed * 53 + 11);
  b.add(lumpy(sphere(0.55, 9, 5), 0.25, 2, seed, { flatBottom: 0 }), 'barkGrey', { p: [0, -0.05, 0], s: [1.3, 0.45, 1.1], c: '#8a867c', uv: 'box' });
  const spots = [[0.32, 0.1], [-0.28, 0.34], [0.05, -0.38], [-0.4, -0.18], [0.42, -0.3], [0.12, 0.46]];
  const n = age === 0 ? 3 : 4 + (seed % 3);
  const Hs = [1.0, 3.6, 5.6, 7.2][age];
  for (let i = 0; i < n; i++) {
    const [sx, sz] = spots[(i + seed) % spots.length], H = Hs * b.r(0.8, 1.1), r = 0.05 + 0.025 * age;
    const tx = sx + b.r(-0.12, 0.12), tz = sz + b.r(-0.12, 0.12); // (the head stands almost over the foot: upright, not splayed)
    b.add(tube([V3(sx, 0.05, sz), V3((sx + tx) / 2, H * 0.5, (sz + tz) / 2), V3(tx, H, tz)], (t) => r * (1 - 0.5 * t), 6, 4), 'barkGrey', { uv: 'keep', c: [0.9, 0.9, 0.88], w: (x, y) => [0, 0.06 * Math.min(1, y / H), 0, 0] });
    const leaf = b.r() < 0.45 ? 'leafGold' : 'leafCopper', R = 0.45 + 0.35 * age;
    leafCluster(b, leaf, V3(tx, H + R * 0.35, tz), R, 4 + age * 2, { canopyC: V3(0, Hs, 0), tintLo: '#a89a8c', tintHi: '#ffffff', yLo: 0, yHi: Hs + 1, wind: (p) => [0, 0.08 * Math.min(1, p.y / Hs), 0, 0], size: 1.35, core: age >= 2 ? (leaf === 'leafGold' ? 'coreGold' : 'coreCopper') : null, coreK: 0.5 });
  }
  return age >= 1 ? { builder: b, collider: { r: 0.7 } } : { builder: b };
}
// a cut stump (its top one plain pale colour), a fallen branch lying along local x
function stump(seed) { const b = new Builder(seed); b.add(cyl(0.42, 0.55, 0.55, 10), 'barkGrey', { p: [0, 0.2, 0], c: '#d0c8bc' }); b.add(cyl(0.4, 0.4, 0.04, 10), 'woodLight', { p: [0, 0.48, 0], c: '#c8b08a' }); return { builder: b, collider: { r: 0.55 } }; }
function branch(seed) { const b = new Builder(seed); const L = b.r(3, 5); b.add(cyl(0.07, 0.12, L, 7), 'barkGrey', { p: [0, 0.1, 0], r: [0, 0, PI / 2], c: '#d0c8bc' }); return { builder: b }; }
// low russet undergrowth: small lobed copper and gold clumps in a row (plain oval leaves; never a rosette from above)
function bracken(seed, L = 2) {
  const b = new Builder(seed);
  for (let x = -L / 2; x <= L / 2; x += b.r(0.6, 0.85)) { const R = b.r(0.35, 0.5); leafCluster(b, b.r() < 0.6 ? 'leafCopper' : 'leafGold', V3(x, R * 0.7, b.r(-0.2, 0.2)), R, 4, { canopyC: V3(0, 0, 0), tintLo: '#b8a898', tintHi: '#f0e6dc', yLo: 0, yHi: 1, wind: (p) => [0, 0.05 * Math.min(1, p.y), 0, 0], size: 1.3, core: null }); }
  return { builder: b };
}
function greyStone(seed, big = false) {
  const b = new Builder(seed);
  for (let i = 0; i < (big ? 2 : 1 + (seed % 2)); i++) addRock(b, [b.r(-0.7, 0.7), 0, b.r(-0.7, 0.7)], big ? [b.r(1.2, 2.0), b.r(0.8, 1.3), b.r(1.0, 1.7)] : [b.r(0.35, 0.8), b.r(0.25, 0.45), b.r(0.35, 0.7)], seed * 5 + i, { moss: 0.5, tint: '#8a8880' });
  return big ? { builder: b, collider: { r: 1.6 } } : { builder: b };
}
// low drifts of fallen leaves: a few flat lumps in copper and gold
function leafDrift(seed) {
  const b = new Builder(seed);
  for (let i = 0; i < 3; i++) b.add(lumpy(sphere(0.6, 8, 4), 0.3, 2, seed + i, { flatBottom: 0 }), 'dirtPlain', { p: [b.r(-0.8, 0.8), -0.04, b.r(-0.6, 0.6)], s: [b.r(1.0, 1.8), 0.12, b.r(0.7, 1.2)], c: i % 2 ? COPPER[i % 3] : GOLD[i % 3], uv: 'box' });
  return { builder: b };
}
// a banded fall-line post (plain light and dark bands, no marks), a flat iron cap
function fallPost(seed) {
  const b = new Builder(seed);
  for (let i = 0; i < 4; i++) b.add(box(0.2, 0.45, 0.2), 'wPaint', { p: [0, 0.22 + i * 0.45, 0], c: i % 2 ? '#2e3032' : '#e0c890' });
  b.add(box(0.3, 0.07, 0.3), 'wIron', { p: [0, 1.84, 0], c: IRON });
  return { builder: b, collider: { r: 0.25 } };
}
// cordwood stacked parallel between two square end posts (log ends one plain colour)
function cordStack(seed, L = 3) {
  const b = new Builder(seed);
  for (const sx of [-L / 2, L / 2]) b.add(box(0.16, 1.5, 0.16), 'beam', { p: [sx, 0.75, 0], c: TIMBER });
  for (let r = 0; r < 5; r++) for (let i = 0; i < 4; i++) b.add(cyl(0.11, 0.11, 0.9, 8), 'woodLight', { p: [-L / 2 + 0.35 + i * (L - 0.7) / 3 + b.r(-0.05, 0.05), 0.14 + r * 0.24, 0], r: [PI / 2, 0, 0], c: r % 2 ? '#a88a66' : '#b49470' });
  b.add(box(L - 0.3, 1.1, 0.86), 'woodLight', { p: [0, 0.62, 0], c: '#8a7050' }); // (the solid core behind the ends)
  return res(b, { colliders: [{ x: 0, z: 0, hw: L / 2 + 0.1, hd: 0.5 }] });
}
// an open seasoning stack under a pent roof: a solid block of sawn oak with darker layer lines on its sides only (a flat
// top: the stickers between layers would draw a grid from above), on two square bearers; the roof on four square posts
function seasoningStack(seed, L = 5, D = 2.2) {
  const b = new Builder(seed), Hs = 1.7;
  for (const sx of [-L / 2 + 0.5, L / 2 - 0.5]) b.add(box(0.24, 0.22, D + 0.3), 'beam', { p: [sx, 0.11, 0], c: TIMBER_D });
  b.add(box(L, Hs, D), 'woodLight', { p: [0, 0.22 + Hs / 2, 0], c: '#a08262' });
  for (let y = 0.22 + 0.21; y < 0.22 + Hs - 0.05; y += 0.21) { for (const s of [-1, 1]) b.add(box(L + 0.01, 0.035, 0.02), 'wDark', { p: [0, y, s * (D / 2 + 0.005)], c: '#3a2e24' }); for (const s of [-1, 1]) b.add(box(0.02, 0.035, D + 0.01), 'wDark', { p: [s * (L / 2 + 0.005), y, 0], c: '#3a2e24' }); }
  const h = 3.0, rise = 0.5;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.2, h + (sz < 0 ? rise : 0), 0.2), 'beam', { p: [sx * (L / 2 + 0.3), (h + (sz < 0 ? rise : 0)) / 2, sz * (D / 2 + 0.3)], c: TIMBER });
  const ang = Math.atan2(rise, D + 0.6);
  b.add(box(L + 1.2, 0.1, (D + 1.6) / Math.cos(ang)), 'shingleWood', { p: [0, h + rise / 2 + 0.08, 0], r: [ang, 0, 0], c: texTint('shingleWood', '#5a4c40'), uv: 'box', us: 0.42 });
  return res(b, { colliders: [{ x: 0, z: 0, hw: L / 2 + 0.3, hd: D / 2 + 0.3 }] });
}
// a log deck: trunks lying parallel along local x on two plain bearers, three courses (no criss-crossing)
function logDeck(seed, L = 10, n = 5) {
  const b = new Builder(seed);
  for (const sx of [-L / 2 + 1.2, L / 2 - 1.2]) b.add(box(0.3, 0.3, n * 0.7 + 0.4), 'beam', { p: [sx, 0.15, 0], c: TIMBER_D });
  for (let r = 0; r < 3; r++) for (let i = 0; i < n - r; i++) { const rr = b.r(0.28, 0.36); logX(b, L + b.r(-0.6, 0.6), rr, [b.r(-0.2, 0.2), 0.3 + rr + r * 0.6, (i - (n - r - 1) / 2) * 0.72]); }
  return res(b, { colliders: [{ x: 0, z: 0, hw: L / 2 + 0.3, hd: n * 0.36 + 0.2 }] });
}
// a long seasoning shed (along local x, front +z): square posts on a stone sill wall every bay, the long walls closed with
// parallel louvre slats (jammed shut, all tilted the same way), the gable ends planked with a square door under a flat
// lintel, a straight-pitched shingle roof with a plain ridge board. door: which gable carries the big loft door ('w' / 'e')
function longShed(seed, L, W, door = null) {
  const b = new Builder(seed), h = 4.4, rise = 2.2, bay = 4;
  b.add(box(L + 0.3, 0.6, W + 0.3), 'stoneLarge', { p: [0, 0.1, 0], c: ST_L });
  const nB = Math.round(L / bay), bw = L / nB;
  for (let i = 0; i <= nB; i++) for (const sz of [-1, 1]) b.add(box(0.3, h, 0.3), 'beam', { p: [-L / 2 + i * bw, 0.4 + h / 2, sz * W / 2], c: TIMBER_D });
  for (const sz of [-1, 1]) {
    b.add(box(L + 0.2, 0.24, 0.32), 'beam', { p: [0, 0.52, sz * W / 2], c: TIMBER_D });
    b.add(box(L + 0.4, 0.3, 0.34), 'beam', { p: [0, 0.4 + h - 0.1, sz * W / 2], c: TIMBER_D });
    b.add(box(L - 0.2, h - 0.6, 0.1), 'wDark', { p: [0, 0.4 + h / 2, sz * (W / 2 - 0.12)], c: '#1e1a16' }); // (the dark behind the slats)
    for (let i = 0; i < nB; i++) {
      const cx = -L / 2 + (i + 0.5) * bw;
      for (let y = 0.95; y < 0.4 + h - 0.35; y += 0.3) b.add(box(bw - 0.32, 0.26, 0.04), 'beam', { p: [cx, y, sz * (W / 2 - 0.02)], r: [sz * 0.12, 0, 0], c: (i + Math.round(y * 3)) % 4 ? '#7a6450' : '#6e5a48' });
    }
  }
  // the gables: planked walls up into the roof's straight pitch (a plain triangle on top), a square door with a flat lintel
  const tri = new THREE.Shape(); tri.moveTo(-W / 2 - 0.05, 0); tri.lineTo(W / 2 + 0.05, 0); tri.lineTo(0, rise); tri.lineTo(-W / 2 - 0.05, 0);
  const tg = new THREE.ExtrudeGeometry(tri, { depth: 0.2, bevelEnabled: false }); tg.translate(0, 0, -0.1);
  for (const sx of [-1, 1]) {
    b.add(box(0.2, h, W), 'wood', { p: [sx * L / 2, 0.4 + h / 2, 0], c: PLANK, us: 1 });
    b.add(tg.clone(), 'wood', { p: [sx * L / 2, 0.4 + h, 0], r: [0, PI / 2, 0], c: PLANK, uv: 'box' });
    const big = door === (sx < 0 ? 'w' : 'e'), dw = big ? 3.2 : 2.0, dh = big ? 3.4 : 2.6;
    b.add(box(0.14, dh, dw), 'wood', { p: [sx * (L / 2 + 0.1), 0.4 + dh / 2, 0], c: '#4e3e30' });
    for (const s of [-1, 1]) b.add(box(0.26, dh + 0.2, 0.26), 'beam', { p: [sx * (L / 2 + 0.12), 0.4 + dh / 2, s * (dw / 2 + 0.13)], c: TIMBER_D });
    b.add(box(0.3, 0.32, dw + 0.8), 'beam', { p: [sx * (L / 2 + 0.14), 0.4 + dh + 0.16, 0], c: TIMBER_D });
    for (let y = 0.4 + 0.5; y < 0.4 + dh - 0.2; y += 0.9) b.add(box(0.05, 0.12, dw - 0.2), 'wIron', { p: [sx * (L / 2 + 0.18), y, 0], c: IRON }); // (plain level straps)
  }
  // the straight-pitched roof: two flat slabs from the eaves to the ridge, a ridge board, deep eaves
  const ang = Math.atan2(rise, W / 2), sl = (W / 2 + 0.9) / Math.cos(ang);
  for (const sz of [-1, 1]) b.add(box(L + 1.0, 0.16, sl), 'shingleWood', { p: [0, 0.4 + h + rise / 2 - 0.15, sz * (W / 4 + 0.2)], r: [sz * ang, 0, 0], c: texTint('shingleWood', '#4e4640'), uv: 'box', us: 0.42 });
  b.add(box(L + 1.1, 0.22, 0.3), 'woodDark', { p: [0, 0.4 + h + rise + 0.02, 0], c: TIMBER_D });
  return res(b, { colliders: [{ x: 0, z: 0, hw: L / 2 + 0.2, hd: W / 2 + 0.2 }] });
}
// a square timber trestle tower for the ropeway: four straight legs, level ties at three heights (never X bracing), a solid
// square cap on top with the two solid sheaves set on it along the rope's run (local z)
function ropeTower(seed, Ht, gauge) {
  const b = new Builder(seed), s = 1.3;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.32, Ht, 0.32), 'beam', { p: [sx * s, Ht / 2, sz * s], c: TIMBER_D });
  for (const y of [Ht * 0.3, Ht * 0.62, Ht - 0.3]) for (const sz of [-1, 1]) { b.add(box(s * 2 + 0.3, 0.22, 0.22), 'beam', { p: [0, y, sz * s], c: TIMBER }); b.add(box(0.22, 0.22, s * 2 + 0.3), 'beam', { p: [sz * s, y, 0], c: TIMBER }); }
  b.add(box(gauge + 1.4, 0.5, s * 2 + 0.6), 'wood', { p: [0, Ht + 0.25, 0], c: '#5e4a38' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { b.add(cyl(0.4, 0.4, 0.14, 14), 'wIron', { p: [sx * gauge / 2, Ht + 0.72, sz * 0.75], r: [0, 0, PI / 2], c: '#3a3c40' }); b.add(box(0.1, 0.5, 0.2), 'wIron', { p: [sx * gauge / 2 + 0.12, Ht + 0.6, sz * 0.75], c: IRON }); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.7, 0.4, 0.7), 'stoneLarge', { p: [sx * s, 0.05, sz * s], c: ST });
  return res(b, { colliders: [{ x: 0, z: 0, hw: s + 0.3, hd: s + 0.3 }] });
}
// the ropeway car: a square plank box with square windows and a flat roof, hung on one straight hanger from a small square
// carriage of two solid wheels on the rope (local z along the rope)
function ropeCar(seed) {
  const b = new Builder(seed), w = 2.0, d = 2.4, h = 2.0;
  b.add(box(w, h, d), 'wood', { p: [0, h / 2, 0], c: '#6a5440' });
  for (const sx of [-1, 1]) { b.add(box(0.06, 0.6, 1.4), 'glassWarm', { p: [sx * (w / 2 + 0.01), h * 0.66, 0] }); b.add(box(0.08, 0.1, 1.6), 'beam', { p: [sx * (w / 2 + 0.03), h * 0.66 + 0.36, 0], c: TIMBER_D }); }
  b.add(box(w + 0.3, 0.14, d + 0.3), 'woodDark', { p: [0, h + 0.07, 0], c: TIMBER_D });
  b.add(box(0.16, 2.6, 0.16), 'wIron', { p: [0, h + 1.4, 0], c: IRON }); // the one straight hanger
  b.add(box(0.5, 0.5, 1.4), 'wIron', { p: [0, h + 2.9, 0], c: '#3a3c40' });
  for (const sz of [-1, 1]) b.add(cyl(0.26, 0.26, 0.12, 14), 'wIron', { p: [0, h + 3.2, sz * 0.5], r: [0, 0, PI / 2], c: '#2e3034' });
  return res(b, { colliders: [{ x: 0, z: 0, hw: w / 2 + 0.1, hd: d / 2 + 0.1 }] });
}
// the ropeway's station house: a square timber frame on the pad (straight posts, level beams), a flat roof, the solid bull
// wheel lying flat under it (the rope's turn), a square stone counterweight pit and a brake lever box at the side
function stationHouse(seed, gauge) {
  const b = new Builder(seed), W = 8, D = 7, h = 5.2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.42, h, 0.42), 'beam', { p: [sx * W / 2, h / 2, sz * D / 2], c: TIMBER_D });
  for (const sz of [-1, 1]) b.add(box(W + 0.5, 0.36, 0.36), 'beam', { p: [0, h - 0.18, sz * D / 2], c: TIMBER_D });
  for (const sx of [-1, 1]) b.add(box(0.36, 0.36, D + 0.5), 'beam', { p: [sx * W / 2, h - 0.18, 0], c: TIMBER_D });
  b.add(box(W + 1.4, 0.3, D + 1.4), 'stoneLarge', { p: [0, h + 0.12, 0], c: ST_L });
  b.add(box(W + 1.0, 0.2, D + 1.0), 'mossRoof', { p: [0, h + 0.34, 0], c: texTint('mossRoof', '#6e6a4e') });
  b.add(box(W - 0.5, 0.06, 1.0), 'wood', { p: [0, 0.6, -D / 2 + 0.6], c: PLANK }); // (a plank landing at the back)
  b.add(cyl(gauge / 2 + 0.2, gauge / 2 + 0.2, 0.36, 28), 'wIron', { p: [0, 3.6, 0.6], c: '#3a3c40' }); // the bull wheel, a solid disc lying flat
  b.add(box(0.5, 3.4, 0.5), 'wIron', { p: [0, 1.85, 0.6], c: IRON });
  b.add(box(1.6, 1.2, 1.2), 'woodDark', { p: [W / 2 - 1.2, 0.6, -D / 2 + 1.0], c: '#4a3a2c' });
  b.add(box(0.12, 1.4, 0.12), 'wIron', { p: [W / 2 - 1.2, 1.8, -D / 2 + 1.0], r: [0.2, 0, 0], c: IRON });
  return res(b, { colliders: [...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ x: sx * W / 2, z: sz * D / 2, r: 0.4 }))), { x: 0, z: 0.6, r: 0.5 }, { x: W / 2 - 1.2, z: -D / 2 + 1.0, r: 0.9 }] });
}
// a saw pit: a square pit lined with planks, a log on two straight-legged trestles over it, the long saw upright in the cut
function sawPit(seed) {
  const b = new Builder(seed), L = 6, W = 1.6;
  b.add(box(L, 0.1, W), 'wDark', { p: [0, 0.02, 0], c: '#2a2218' });
  for (const sz of [-1, 1]) b.add(box(L + 0.3, 0.3, 0.2), 'beam', { p: [0, 0.12, sz * (W / 2 + 0.1)], c: TIMBER });
  for (const sx of [-1, 1]) b.add(box(0.2, 0.3, W + 0.4), 'beam', { p: [sx * (L / 2 + 0.05), 0.12, 0], c: TIMBER });
  for (const sx of [-L / 2 + 1, L / 2 - 1]) { b.add(box(0.2, 0.2, W + 0.9), 'beam', { p: [sx, 0.85, 0], c: TIMBER }); for (const sz of [-1, 1]) b.add(box(0.16, 0.85, 0.16), 'beam', { p: [sx, 0.42, sz * (W / 2 + 0.3)], c: TIMBER }); }
  logX(b, L + 1.2, 0.36, [0, 1.3, 0]);
  b.add(box(0.03, 2.4, 0.22), 'wIron', { p: [0.8, 1.3, 0], c: '#8a8c90' }); // the saw blade, a plain flat bar
  for (const y of [0.15, 2.45]) b.add(box(0.06, 0.06, 0.6), 'wood', { p: [0.8, y, 0], c: '#8a6a48' });
  return res(b, { colliders: [{ x: 0, z: 0, hw: L / 2 + 0.3, hd: W / 2 + 0.5 }] });
}
function dustHeap(seed) {
  const b = new Builder(seed);
  for (let i = 0; i < 3; i++) b.add(lumpy(sphere(0.6, 8, 5), 0.25, 2, seed + i, { flatBottom: 0 }), 'dirtPlain', { p: [b.r(-0.6, 0.6), -0.05, b.r(-0.6, 0.6)], s: [b.r(1.0, 1.5), b.r(0.35, 0.55), b.r(0.9, 1.3)], c: DUST, uv: 'box' });
  return { builder: b };
}

// ------------------------------------------------------------------ the wood
export function buildWeald(W, S) {
  const R = WEALD, T = W.terrain;
  const H = (x, z) => T.height(x, z);
  const put = (key, x, z, r = 0, s = 1, sink = 0.05) => S.place(key, x, H(x, z) - sink, z, r, s);
  const pre = (key, r2) => { if (!S.prefabs.has(key)) S.addPrefab(key, r2); };
  const place = (r2, x, z, ry = 0, yOff = 0) => W.placeObject(r2, x, z, ry, yOff);
  const runtime = (W.wealdRuntime = []);
  // a result built in world coordinates (the ropes, the ruts): placeAt files it by its origin, outside the box, so it is moved
  // into the wood's own group (its colliders stay where placeAt put them)
  const placeAbs = (r2, y = 0) => { const o = W.placeAt(r2, 0, y, 0, 0); W.wealdGroup.add(o); return o; };
  const rng = mulberry32(2500);
  for (let v = 0; v < 4; v++) pre('wdstd' + v, standardTree(2501 + v, 1.0 + v * 0.07));
  for (let v = 0; v < 3; v++) pre('wddead' + v, deadStandard(2511 + v, 1.0 + v * 0.06, v !== 2, v === 1));
  for (let a = 0; a < 4; a++) for (let v = 0; v < 2; v++) pre(`wdcop${a}_${v}`, coppiceStool(2520 + a * 2 + v, a));
  pre('wdstump', stump(2530)); pre('wdbranch', branch(2531));
  for (let v = 0; v < 3; v++) pre('wdbracken' + v, bracken(2532 + v, 1.4 + v * 0.6));
  for (let v = 0; v < 3; v++) pre('wdstone' + v, greyStone(2536 + v));
  pre('wdboulder', greyStone(2539, true));
  for (let v = 0; v < 3; v++) pre('wddrift' + v, leafDrift(2540 + v));
  pre('wdpost', fallPost(2544)); pre('wddust', dustHeap(2545));
  pre('lantern', P.lanternPost(2546, 'yellow'));
  pre('bench', stoneBench(2547)); pre('sacks', sacks(2548));

  // things the scatter keeps clear of: the people, the doors, the pads, the rides, the sheds, the decks, the huts
  const people = [...NPCS, ...NODES, ...OBJECTS].filter((e) => typeof e.x === 'number' && e.x > R.minX && e.x < R.maxX && e.z > R.minZ && e.z < R.maxZ);
  const huts = [];
  const PADS = [R.station.pad, R.camp, R.sawpits, R.lofts, R.greatride];
  const keepClear = (x, z, pad = 0) => {
    if (wealdPathDist(x, z) < pad) return false;
    for (const Pd of PADS) if (Math.max(Math.abs(x - Pd.x), Math.abs(z - Pd.z)) < Pd.s + 2 + pad) return false;
    if (Math.hypot(x - R.grave.x, z - R.grave.z) < 5 + pad || Math.hypot(x - R.caravan.x, z - R.caravan.z) < 5 + pad) return false;
    if (people.some((e) => Math.hypot(e.x - x, e.z - z) < 3 + pad)) return false;
    if (DUNGEONS.some((Dg) => Math.hypot(x - Dg.door.x, z - Dg.door.z) < 9 + pad)) return false;
    for (const [hx, hz, hr] of huts) if (Math.hypot(x - hx, z - hz) < hr + pad) return false;
    if (shedAt(x, z, 3 + pad)) return false;
    for (const D of R.decks) if (x > D.x0 - 2 - pad && x < D.x1 + 2 + pad && Math.abs(z - D.z) < D.hd + 2 + pad) return false;
    if (fallLine(x, z).d < 2.5 + pad) return false;
    if (Math.abs(x - R.track.x) < 4 && z > R.track.z0 - 2 && z < R.track.z1 + 2) return false;
    if (Math.abs(x - R.station.pad.x) < 9 && z > R.station.pad.z) return false; // (the ropeway's corridor up the bank: no crowns under the ropes)
    return true;
  };

  // ---------------------------------------------------------------- the ropeway's lower station
  const gauge = 2.6;
  {
    const Pd = R.station.pad, y = Pd.flat ?? wealdHeight(Pd.x, Pd.z);
    W.placeAt(stationHouse(2550, gauge), Pd.x, y, Pd.z + 1.5, 0);
    // the towers up the south bank to the ridge (standing on the bank, out of reach), the ropes from the bull wheel over them
    const towers = [];
    for (const [tz, th] of [[-3326, 9], [-3309, 10]]) { const ty = wealdHeight(Pd.x, tz) - 0.3; W.placeAt(ropeTower(2551 + towers.length, th, gauge), Pd.x, ty, tz, 0); towers.push([tz, ty + th + 0.95]); }
    const b = new Builder(2555), wheel = [Pd.z + 1.5 + 0.6, y + 3.8];
    const run = [wheel, ...towers, [-3296, towers[1][1] + 6]];
    for (const sx of [-1, 1]) for (let i = 0; i < run.length - 1; i++) beam(b, [Pd.x + sx * gauge / 2, run[i][1], run[i][0]], [Pd.x + sx * gauge / 2, run[i + 1][1], run[i + 1][0]], 0.07, 'wIron', '#2a2c30');
    placeAbs({ builder: b });
    // the car parked at the station, hung from the west rope over the pad's south edge (its roof below the rope)
    const cz = Pd.z + 5.4, ry = y + 3.8 - 0.1 + ((towers[0][1] - y - 3.8) * (cz - wheel[0])) / (towers[0][0] - wheel[0]);
    W.placeAt(ropeCar(2556), Pd.x - gauge / 2, ry - 5.2, cz, 0);
    W.wealdRope = { x: Pd.x, gauge, run };
    put('lantern', Pd.x - 6, Pd.z - 5.5, 0.3); put('lantern', Pd.x + 6.5, Pd.z - 5.5, -0.3);
    put('sacks', Pd.x + 5.5, Pd.z + 1, 0.6);
  }

  // ---------------------------------------------------------------- the Woodwrights' camp and the saw pits
  const C = R.camp, face = (x, z) => Math.atan2(C.x - x, C.z - z);
  {
    // four square huts round the worked square, each turned square-on to it (the north pair facing south, the south pair
    // north: turned diagonally to the fire the four read as an X from straight above); the spur comes in on the square's west side
    const hutAt = [[436, -3415, 5.2, 4.8, { roof: 'pent', tile: 'moss', chimney: true }], [457, -3415, 5.4, 5.0, { roof: 'flat', wall: 'stone', chimney: true, shutC: '#4a3e30' }], [457, -3395, 5.2, 4.8, { roof: 'pent', tile: '#4a4644', chimney: true }], [436, -3395, 5.2, 4.8, { roof: 'pent', tile: 'moss', wall: 'stone', chimney: false, shutC: '#5a4636' }]];
    hutAt.forEach(([x, z, w, d, o], i) => { place(seedHut(2560 + i, { w, d, h: 2.9, ...o }), x, z, z < C.z ? 0 : Math.PI, -0.1); huts.push([x, z, 5]); });
    place(P.campfire(2565), C.x - 0.5, C.z, 0);
    put('bench', C.x - 3.2, C.z + 2.4, 2.4); put('bench', C.x + 3.4, C.z - 2.6, -0.8);
    for (const [x, z] of [[446, -3419.5], [446, -3390.5], [433, -3405 + 3.2]]) put('lantern', x, z, face(x, z));
    place(cordStack(2566, 3.2), 451.5, -3420.5, 0); place(cordStack(2567, 2.6), 440.5, -3390.4, 0);
    put('sacks', 452, -3404, 0.3);
    { const g = R.grave; put('bench', g.x, g.z - 1.6, 0); put('lantern', g.x + 2.2, g.z - 1.2, 0.4); }
    { const cv = R.caravan; place(P.cart(2568), cv.x + 2.8, cv.z + 1.6, 0.3); }
    // the saw pits: two side by side along x (parallel), sawdust heaps round them, a log deck waiting beside them
    const Sp = R.sawpits;
    for (const dz of [-1.8, 1.8]) place(sawPit(2570 + (dz > 0 ? 1 : 0)), Sp.x - 0.5, Sp.z + dz, 0, -0.05);
    for (const [dx, dz] of [[-4.6, -4], [4.2, 3.8], [-5, 3.6]]) put('wddust', Sp.x + dx, Sp.z + dz, rng() * 6, 0.9, 0.05);
    place(logDeck(2572, 7, 4), Sp.x, Sp.z + 8.5, 0, -0.05);
  }

  // ---------------------------------------------------------------- the Long Sheds, the log decks, the open stacks
  W.wealdSheds = [];
  R.sheds.forEach((Sh, i) => {
    const L = Sh.x1 - Sh.x0, Wd = Sh.z1 - Sh.z0, cx = (Sh.x0 + Sh.x1) / 2, cz = (Sh.z0 + Sh.z1) / 2;
    W.placeAt(longShed(2580 + i, L, Wd, i === 0 ? 'w' : null), cx, Sh.flat ?? wealdHeight(cx, cz), cz, 0);
    W.wealdSheds.push({ x: cx, z: cz, L, W: Wd });
  });
  R.decks.forEach((D, i) => place(logDeck(2590 + i, D.x1 - D.x0, 4 + (i % 2)), (D.x0 + D.x1) / 2, D.z, 0, -0.05));
  for (const [x, z] of [[503, -3517], [559, -3517], [512, -3490.5]]) { place(seasoningStack(2596 + Math.round(x), 5.5, 2.2), x, z, 0, -0.05); huts.push([x, z, 4.5]); }
  // the lofts' pad: a stone kerb along its two sides, a lantern either side of the big gable door
  { const Lp = R.lofts; put('lantern', Lp.x + 2.4, Lp.z - 3.6, PI / 2); put('lantern', Lp.x + 2.4, Lp.z + 3.6, PI / 2); }

  // ---------------------------------------------------------------- the great ride's gate at the main ride's east end
  {
    const G2 = R.greatride, y = G2.flat ?? wealdHeight(G2.x, G2.z), b = new Builder(2600), gw = 9, gh = 6.5;
    for (const s of [-1, 1]) { b.add(box(0.9, gh, 0.9), 'beam', { p: [0, gh / 2, s * (gw / 2 + 0.45)], c: TIMBER_D }); b.add(box(1.3, 0.6, 1.3), 'stoneLarge', { p: [0, 0.2, s * (gw / 2 + 0.45)], c: ST_L }); }
    b.add(box(1.0, 0.8, gw + 2.6), 'beam', { p: [0, gh + 0.4, 0], c: TIMBER_D }); // the flat lintel
    for (const s of [-1, 1]) b.add(box(0.24, gh - 0.6, gw / 2 - 0.1), 'wood', { p: [0.2, (gh - 0.6) / 2 + 0.1, s * gw / 4], c: '#4e3e30' }); // the two leaves, shut
    for (const yy of [1.4, 4.6]) b.add(box(0.1, 0.18, gw - 0.4), 'wIron', { p: [0.36, yy, 0], c: IRON });
    W.placeAt(res(b, { colliders: [{ x: 0, z: 0, hw: 0.7, hd: gw / 2 + 1 }] }), G2.x + G2.s + 0.6, y, G2.z, 0);
    W.wealdGate = { x: G2.x + G2.s + 0.6, z: G2.z, y };
    put('lantern', G2.x + 3, G2.z - 6.2, -PI / 2); put('lantern', G2.x + 3, G2.z + 6.2, -PI / 2);
  }

  // ---------------------------------------------------------------- the fall lines: banded posts and the half-cut standards
  W.wealdFalls = [];
  {
    const geo = deadStandard(2610, 1.05, true, true).builder.geometries();
    let topY = 1; for (const { geo: gg } of geo) { gg.computeBoundingBox(); topY = Math.max(topY, gg.boundingBox.max.y); }
    R.falls.forEach((F, i) => {
      const dx = F.x2 - F.x, dz = F.z2 - F.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = -uz, nz = ux;
      // the ride this line crosses: posts at both its edges, 2 m to the side of the line
      let mx = F.x, mz = F.z, best = 1e9;
      for (let t = 0; t <= L; t += 0.25) { const x = F.x + ux * t, z = F.z + uz * t, d = rideAt(x, z).d; if (d < best) { best = d; mx = x; mz = z; } } // (where it crosses the ride's line)
      const Rd = rideAt(mx, mz);
      for (const s of [-1, 1]) { const t = s * (Rd.hw + 0.7); put('wdpost', mx + ux * t + nx * 2.2, mz + uz * t + nz * 2.2, 0, 1, 0.1); }
      // the half-cut standard at the base: a group pivoting at its foot, falling along the line (its notch faces the line)
      const g = new THREE.Group(), pivot = new THREE.Group();
      for (const { geo: gg, mat } of geo) { const m = new THREE.Mesh(gg, mat); m.castShadow = true; m.receiveShadow = true; pivot.add(m); }
      g.rotation.y = Math.atan2(ux, uz); // (local +z, the notch's side, toward the line; the pivot tilts it over along +z)
      g.add(pivot);
      pivot.scale.setScalar(L / topY); // (its crown comes to rest at the line's end, just over the ride's far edge)
      g.position.set(F.x, wealdHeight(F.x, F.z) - 0.1, F.z); g.name = 'wealdFall';
      markDynamic(g); W.wealdGroup.add(g); runtime.push(g);
      // the stump left when it is down (shown with the trunk lying across the ride)
      const st = new THREE.Group(); for (const { geo: gg, mat } of stump(2620 + i).builder.geometries()) st.add(new THREE.Mesh(gg, mat));
      st.position.copy(g.position); st.visible = false; markDynamic(st); W.wealdGroup.add(st); runtime.push(st);
      // P15.3 Clear the Rides: once the trunk is cut clear (shared/rides.js, ev 'rides'), it lies cut into a small deck of
      // logs on the standard's own side of the ride, parallel to the fall line, between the ride's edge and the stump
      const dk = new THREE.Group(), deckL = 9.5 - Rd.hw - 2.2, dB = new Builder(2630 + i);
      for (let r = 0; r < 2; r++) for (let k = 0; k < 3 - r; k++) logX(dB, deckL - r * 0.6 + dB.r(-0.2, 0.2), 0.3, [0, 0.32 + r * 0.56, (k - (2 - r) / 2) * 0.66], '#d0c8bc', '#c0a47c');
      for (const { geo: gg, mat } of dB.geometries()) { const m = new THREE.Mesh(gg, mat); m.castShadow = true; m.receiveShadow = true; dk.add(m); }
      const dd = Rd.hw + 1.1 + deckL / 2, dx2 = mx - ux * dd, dz2 = mz - uz * dd; // (from the crossing back toward the base)
      dk.position.set(dx2, wealdHeight(dx2, dz2) - 0.05, dz2); dk.rotation.y = Math.atan2(uz, -ux) + PI; dk.visible = false; dk.name = 'wealdDeckNew';
      markDynamic(dk); W.wealdGroup.add(dk); runtime.push(dk);
      // it comes to rest on the ground along its line: tipped past level where the ground falls away, short of it where it
      // rises (the line's far end is up to 3 m above or below the foot on the Standards' slopes)
      const rest = PI / 2 - 0.04 - Math.atan2(wealdHeight(F.x2, F.z2) - wealdHeight(F.x, F.z), L);
      // (and lies on the ground, not in it: the trunk's own thickness lifts it as it comes down; down at ground level the
      // standing tree's axis would leave the trunk sunk to its top, a thin line from above)
      W.wealdFalls.push({ g, pivot, st, ux, uz, dk, rest, lift: 0.75 * pivot.scale.x });
      S.colliders.push({ x: F.x, z: F.z, r: 0.7 });
    });
  }

  // ---------------------------------------------------------------- the trees: standards, coppice, the high wood, the banks
  {
    let rs = mulberry32(1);
    const seed = (a, b2) => { rs = mulberry32(Math.imul(a + 61, 73856093) ^ Math.imul(b2 + 67, 19349663) ^ 0x5d1); };
    const pick = (base, n) => base + Math.floor(rs() * n);
    const trees = [];
    const crownOK = (x, z, r) => { for (const [tx, tz, tr] of trees) if (Math.hypot(tx - x, tz - z) < (tr + r) * 0.8) return false; return true; };
    // standards: on a jittered 11 m grid (8 m in the high wood), their crowns kept off the rides' lines (trunk at least
    // 4 m off the ride edge: the crowns of the two sides never meet over a ride)
    for (let iz = 0, gz = R.minZ + 4; gz < R.maxZ - 4; iz++, gz += 9) for (let ix = 0, gx = R.minX + 4; gx < R.maxX - 4; ix++, gx += 9) {
      seed(ix, iz);
      const x = gx + rs() * 7, z = gz + rs() * 7, g = wealdGap(x, z), hw = highwoodAt(x, z), Pn = panelAt(x, z);
      if (g > 34 || (Math.abs(x - R.station.pad.x) < 9 && z > R.station.pad.z)) continue;
      // (and the ride scene's view of the car coming down: game.js ROPE_SHOT.weald looks from 16 m east of the rope, by the
      // pad, up the bank at the car; no trunk between that camera and the rope)
      if (x > R.station.pad.x && x < R.station.pad.x + 22 && z > R.station.pad.z - 2) continue;
      if (g < -1 && (!keepClear(x, z, 4) || hollowK(x, z) > 0.5)) continue;
      const roll = rs();
      if (hw) {
        // the high wood: great standards, many half-cut and standing dead
        if (!crownOK(x, z, 4.5)) continue;
        const dead = roll < 0.4;
        put(dead ? pick('wddead', 3) : pick('wdstd', 4), x, z, rs() * 6, 1.05 + rs() * 0.25, 0.2); trees.push([x, z, dead ? 2 : 5.5]);
        continue;
      }
      if (Pn && roll > 0.35) continue; // (the panels: standards only here and there over the coppice)
      if (g < -1 && roll > 0.75) continue;
      if (!crownOK(x, z, 5)) continue;
      const dead = g < -1 && rs() < 0.12;
      put(dead ? pick('wddead', 3) : pick('wdstd', 4), x, z, rs() * 6, 0.95 + rs() * 0.25, 0.2); trees.push([x, z, dead ? 2 : 5.5]);
    }
    // the coppice panels: stools in offset rows across each panel (all one age per panel, a few a round older)
    R.panels.forEach((Pn, pi) => {
      let row = 0;
      for (let z = Pn.z0 + 2; z < Pn.z1 - 1.5; z += 4.2, row++) for (let x = Pn.x0 + 2 + (row % 2) * 2.1; x < Pn.x1 - 1.5; x += 4.2) {
        const jx = x + (rng() - 0.5) * 1.4, jz = z + (rng() - 0.5) * 1.4;
        if (!keepClear(jx, jz, 1.2) || wealdGap(jx, jz) > -1.5 || trees.some(([tx, tz]) => Math.hypot(tx - jx, tz - jz) < 2.5)) continue;
        if (rng() < 0.12) { put('wdstump', jx, jz, rng() * 6, 0.8, 0.05); continue; }
        const age = Math.min(3, Math.max(0, Pn.age + (rng() < 0.15 ? 1 : 0)));
        put(`wdcop${age}_${Math.floor(rng() * 2)}`, jx, jz, rng() * 6, 0.9 + rng() * 0.25, 0.05);
      }
    });
    // the floor: bracken in rows of single upright cards, grey stones, fallen branches lying along the slope (all one way in
    // a stretch), leaf drifts, stumps; boulders at the bank feet. Nothing on the rides, the pads or round the people
    const cell = 4.0;
    for (let iz = 0, gz = R.minZ + 16; gz < R.maxZ - 16; iz++, gz += cell) for (let ix = 0, gx = R.minX + 16; gx < R.maxX - 16; ix++, gx += cell) {
      seed(ix + 500, iz);
      const x = gx + rs() * cell, z = gz + rs() * cell, g = wealdGap(x, z);
      if (g > 6) continue;
      if (g > -1) { const roll = rs(); if (roll < 0.15) put('wdboulder', x, z, rs() * 6, 0.9 + rs() * 0.4, 0.4); else if (roll < 0.55) put(pick('wdbracken', 3), x, z, (rs() - 0.5) * 0.5, 0.9 + rs() * 0.3, 0.05); continue; }
      if (!keepClear(x, z, 1.2) || trees.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 1.6)) continue;
      const roll = rs();
      if (roll < 0.22) put(pick('wdbracken', 3), x, z, (rs() - 0.5) * 0.4, 0.8 + rs() * 0.4, 0.03);
      else if (roll < 0.34) put(pick('wddrift', 3), x, z, rs() * 6, 0.9 + rs() * 0.5, 0.02);
      else if (roll < 0.4) put(pick('wdstone', 3), x, z, rs() * 6, 0.9, 0.12);
      else if (roll < 0.44) put('wdbranch', x, z, 0.15 + (rs() - 0.5) * 0.2, 1, 0.05);
      else if (roll < 0.46) put('wdstump', x, z, rs() * 6, 0.8 + rs() * 0.4, 0.05);
    }
    W.wealdTrees = trees.length;
  }

  // ---------------------------------------------------------------- mist in the hollows (and a little over the low rides)
  {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const x = cv.getContext('2d'), r2 = mulberry32(2700);
    for (let i = 0; i < 14; i++) { const cx = 40 + r2() * 176, cy = 54 + r2() * 30, rr = 26 + r2() * 30, gr = x.createRadialGradient(cx, cy, 0, cx, cy, rr); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 256, 128); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const mist = [];
    const add = (mx, mz, w, op) => {
      const mat = new THREE.SpriteMaterial({ map: tex, color: '#e6ddd0', transparent: true, opacity: op, depthWrite: false, fog: true });
      const s = new THREE.Sprite(mat), y = wealdHeight(mx, mz) + 0.9 + r2() * 0.5;
      s.scale.set(w, w * 0.22, 1); s.position.set(mx, y, mz); s.renderOrder = 4; s.name = 'wealdMist';
      markDynamic(s); W.wealdGroup.add(s); runtime.push(s);
      mist.push({ s, x0: mx, z0: mz, y0: y, op, sp: 0.5 + r2() * 0.8, ph: r2() * 100 });
    };
    for (const Hl of R.hollows) for (let i = 0; i < 4; i++) { const a = r2() * PI * 2, d = r2() * Hl.r * 0.45; add(Hl.x + Math.cos(a) * d, Hl.z + Math.sin(a) * d, Hl.r * (1.0 + r2() * 0.5), 0.34); }
    for (let i = 0; i < 10; i++) { const mx = 410 + r2() * 160, mz = -3560 + r2() * 220; if (wealdGap(mx, mz) < -4) add(mx, mz, 16 + r2() * 10, 0.14); }
    W.wealdMist = mist;
  }

  // ---------------------------------------------------------------- the gale
  // the half-cut standards come down along their lines one after another at the gale's height and lie across the rides until
  // it drops; the mist thins and runs before the wind (all from galeLevel() and fallState(): the shared world clock)
  W.wealdTick = (dt, t) => {
    const lvl = galeLevel(), FS = fallState();
    W.wealdFalls.forEach((F, i) => {
      const s = FS[i], k = s.down ? 1 : s.k, ease = k * k; // (it goes slowly, then all at once)
      F.pivot.rotation.x = ease * F.rest + (1 - k) * Math.sin(t * 1.6 + i) * 0.02 * lvl; F.pivot.position.y = ease * F.lift;
      F.st.visible = k > 0.02;
      // cut clear in this gale (ev 'rides' in game.js sets W.wealdCleared): the trunk is gone, its logs lie decked by the ride
      const cut = !!(s.down && W.wealdCleared?.[i]);
      F.g.visible = !cut; F.dk.visible = cut;
    });
    for (const m of W.wealdMist) { m.s.material.opacity = m.op * (1 - 0.75 * lvl); m.s.position.x = m.x0 + Math.sin(t * 0.02 * m.sp + m.ph) * (1.5 + 6 * lvl); m.s.position.z = m.z0 + Math.cos(t * 0.017 * m.sp + m.ph) * 1.5; }
  };
  W.wealdTick(0, 0);
  // the Woodwrights at work (townsfolk.js adds them): a sawyer on top of the log at each pit, a man stacking by the sheds,
  // one carrying sacks along the main ride by the camp, one sweeping the camp's square
  W.wealdFolk = [
    { v: 2, o: { role: 'hoe', at: [R.sawpits.x - 1.6, R.sawpits.z - 1.8], face: PI / 2, ghost: true } },
    { v: 7, o: { role: 'hoe', at: [R.sawpits.x + 0.8, R.sawpits.z + 3.4], face: PI, ghost: true } },
    { v: 4, o: { role: 'hoe', at: [521.5, -3466.5], face: 0, ghost: true } },
    { v: 5, o: { role: 'stroll', spots: [[424, -3447.5], [446, -3447.5], [466, -3447.5]], walk: 0.9 }, carry: 'sack' },
    { v: 3, o: { role: 'sweep', home: [C.x + 4, C.z + 4], spots: [[C.x + 4, C.z + 4]], walk: 0.55 }, tool: 'broom' },
  ];
}
