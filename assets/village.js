// Sunmere Village, part 1: the guild hall terrace and its grand staircase, the hall itself, the crystal
// fountain plaza, the south gate and the level stone beam bridges.
// Everything here is modelled in WORLD coordinates (place with World.placeAbs) so the terrace, the steps and
// the bridge decks line up exactly with the walkable surfaces defined in shared/terrain.js (deckAt).
// Content rules: banners carry the heater-shield-and-band crest (bannerTex 'sun': no sun discs), square-headed windows and
// doors with flat lintels (no arches), crenellated or low hipped tower tops (no spires), no crosses.
import * as THREE from 'three';
import { Builder, rbox, box, cyl, cone, sphere, torus, lathe, extrude, card, prism, arcShape, lumpy } from './kit.js';
import { addRock, addTuft, crystalCluster } from './trees.js';
import { basinWater, waterCurtain } from './dressing.js';
import { lanternBuilder } from './dynamic.js';
import { VILLAGE, BRIDGES, heightAt, streamInfo } from '/sunmere-play/shared/terrain.js';

const PI = Math.PI;
const T = VILLAGE.terrace, S = VILLAGE.stairs;
const WARM = '#efe6d6', PALE = '#f6efe2';

// ------------------------------------------------------------------ shared pieces
// gable roof with the ridge along z; the slabs pass exactly through the wall-top edges and overhang below them
export function roofZ(b, cx, cz, span, len, rise, y0, { mat = 'slate', over = 0.5, ridge = 'gold', thick = 0.22 } = {}) {
  const ang = Math.atan2(rise, span / 2), half = span / 2 + over;
  const L = half / Math.cos(ang);
  for (const sx of [-1, 1]) {
    const mx = cx + sx * half / 2, my = y0 + rise - (half / 2) * Math.tan(ang);
    b.add(box(L, thick, len + over * 2), mat, { p: [mx, my + thick / 2, cz], r: [0, 0, -sx * ang], uv: 'box', c: 0xffffff });
    b.add(box(L, 0.05, len + over * 2 - 0.1), 'woodDark', { p: [mx, my - 0.03, cz], r: [0, 0, -sx * ang], c: '#b8a890' });
    // gold eave trim along the drip edge
    b.add(box(0.08, 0.1, len + over * 2), 'gold', { p: [cx + sx * half, y0 - over * Math.tan(ang) + 0.02, cz], c: 0xffffff });
  }
  if (ridge) b.add(cyl(0.15, 0.15, len + over * 2 + 0.1, 10), ridge, { p: [cx, y0 + rise + thick * 0.8, cz], r: [PI / 2, 0, 0], c: 0xffffff });
}
// same with the ridge along x (gables face east and west)
export function roofX(b, cx, cz, span, len, rise, y0, opts = {}) {
  const tmp = new Builder(1);
  roofZ(tmp, 0, 0, span, len, rise, 0, opts);
  b.addBuilder(tmp, { p: [cx, y0, cz], r: [0, PI / 2, 0] });
}
// triangular gable wall (base at y0) facing +z or -z, or rotated
export function gable(b, cx, cz, w, h, y0, mat = 'stone', rotY = 0, c = WARM) {
  b.add(prism(w, h, 0.3), mat, { p: [cx, y0, cz], r: [0, rotY, 0], uv: 'box', c });
}
// square-headed window with a flat stone lintel, set into a wall facing rotY (0 = +z); y is the sill height
// (the name is historical: arcShape builds a plain rectangle, never a round top)
export function archWin(b, x, y, z, rotY, w = 0.9, h = 1.8, frame = 'stone', glass = 'glassWarm') {
  const s = arcShape(w, h, w / 2);
  const fx = Math.sin(rotY), fz = Math.cos(rotY);
  b.add(extrude(s, 0.05, 0, 14), glass, { p: [x + fx * 0.01, y, z + fz * 0.01], r: [0, rotY, 0], c: 0xffffff });
  const pts = s.getPoints(30);
  const fr = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x * 1.22, p.y * 1.07 - 0.04)));
  fr.holes.push(new THREE.Path(pts.slice().reverse()));
  b.add(extrude(fr, 0.16, 0.02, 14), frame, { p: [x, y, z], r: [0, rotY, 0], boxuv: true, c: PALE });
  b.add(rbox(w * 1.45, 0.12, 0.34, 0.03), frame, { p: [x + fx * 0.12, y - 0.06, z + fz * 0.12], r: [0, rotY, 0], uv: 'box', c: PALE });
  // flat lintel across the head, matching the sill
  b.add(rbox(w * 1.45, 0.16, 0.34, 0.03), frame, { p: [x + fx * 0.12, y + h * 1.07 + 0.02, z + fz * 0.12], r: [0, rotY, 0], uv: 'box', c: PALE });
  // one central upright mullion only (no transom, so no cross)
  b.add(box(0.06, h, 0.08), 'woodDark', { p: [x + fx * 0.05, y + h / 2, z + fz * 0.05], r: [0, rotY, 0], c: 0xffffff });
}
// (was a hanging banner; content rules: no banners) a plain raised stone panel where it hung, facing rotY
export function wallBanner(b, x, yTop, z, rotY, w = 1.2, h = 3.6) {
  const fx = Math.sin(rotY), fz = Math.cos(rotY);
  b.add(rbox(w, h, 0.12, 0.03), 'stoneLarge', { p: [x + fx * 0.07, yTop - h / 2, z + fz * 0.07], r: [0, rotY, 0], uv: 'box', c: '#efe6d6' });
}
// stone planter with lavender and white flowers
export function planter(b, x, y, z, w, d, rotY = 0, kinds = ['lavender', 'flowers']) {
  b.add(rbox(w, 0.62, d, 0.06), 'stoneLarge', { p: [x, y + 0.31, z], r: [0, rotY, 0], uv: 'box', c: PALE });
  b.add(rbox(w + 0.12, 0.1, d + 0.12, 0.03), 'stone', { p: [x, y + 0.62, z], r: [0, rotY, 0], uv: 'box', c: '#fff6e8' });
  b.add(box(w - 0.2, 0.06, d - 0.2), 'dirtPlain', { p: [x, y + 0.6, z], r: [0, rotY, 0], uv: 'box', c: '#8a6a4a' });
  const n = Math.max(2, Math.round(w / 0.55)), c = Math.cos(rotY), s = Math.sin(rotY);
  for (let i = 0; i < n; i++) {
    const lx = (i + 0.5) / n * (w - 0.3) - (w - 0.3) / 2;
    for (const lz of d > 0.9 ? [-d * 0.22, d * 0.22] : [0]) {
      const k = kinds[(i + (lz > 0 ? 1 : 0)) % kinds.length];
      addTuft(b, k, [x + lx * c + lz * s, y + 0.6, z - lx * s + lz * c], 0.6, k === 'lavender' ? 0.6 : 0.45, i * 1.3, 0xffffff, 2);
    }
  }
}
// brazier: fluted stone pedestal and an iron bowl; returns the flame anchor
export function brazier(b, res, x, y, z, s = 1) {
  b.add(lathe([[0.001, 0], [0.42, 0], [0.42, 0.12], [0.3, 0.2], [0.24, 0.85], [0.34, 0.95], [0.001, 0.95]].map(([r, h]) => [r * s, h * s]), 14), 'stoneLarge', { p: [x, y, z], c: PALE, uv: 'box' });
  b.add(lathe([[0.001, 0], [0.22, 0], [0.5, 0.25], [0.56, 0.42], [0.52, 0.44], [0.001, 0.3]].map(([r, h]) => [r * s, h * s]), 16), 'iron', { p: [x, y + 0.95 * s, z], c: 0xffffff });
  b.add(torus(0.55 * s, 0.035 * s, 6, 20), 'gold', { p: [x, y + 1.37 * s, z], r: [PI / 2, 0, 0], c: 0xffffff });
  for (let i = 0; i < 6; i++) b.add(sphere(0.12 * s, 6, 5), 'stoneDark', { p: [x + Math.cos(i) * 0.22 * s, y + 1.3 * s, z + Math.sin(i) * 0.22 * s], c: '#3a2a20' });
  res.fires.push({ p: [x, y + 1.32 * s, z], scale: 0.85 * s, light: false });
  res.glows.push({ p: [x, y + 1.7 * s, z], color: 0xffa040, size: 3.2 * s, intensity: 0.55 });
}
// stone balustrade from (ax,az) to (bx,bz) at height y: plinth, turned balusters, rail, square posts
export function balustrade(b, ax, az, bx, bz, y, { h = 0.95, post = 3.2, mat = 'stone' } = {}) {
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), rot = Math.atan2(dx, dz) - PI / 2;
  const at = (t) => [ax + dx * t, az + dz * t];
  const mid = at(0.5);
  b.add(rbox(L, 0.16, 0.42, 0.03), mat, { p: [mid[0], y + 0.08, mid[1]], r: [0, rot, 0], uv: 'box', c: PALE });
  b.add(rbox(L, 0.16, 0.4, 0.04), mat, { p: [mid[0], y + h - 0.08, mid[1]], r: [0, rot, 0], uv: 'box', c: '#fff8ec' });
  const bal = lathe([[0.001, 0], [0.09, 0], [0.09, 0.05], [0.06, 0.12], [0.11, 0.32], [0.05, 0.55], [0.08, 0.6], [0.08, 0.63], [0.001, 0.63]].map(([r, hh]) => [r, hh * (h - 0.32) / 0.63]), 8);
  const nb = Math.floor(L / 0.34);
  for (let i = 0; i < nb; i++) { const p = at((i + 0.5) / nb); b.add(bal, mat, { p: [p[0], y + 0.16, p[1]], c: PALE }); }
  const np = Math.max(1, Math.round(L / post));
  for (let i = 0; i <= np; i++) {
    const p = at(i / np);
    b.add(rbox(0.46, h + 0.08, 0.46, 0.04), mat, { p: [p[0], y + (h + 0.08) / 2, p[1]], r: [0, rot, 0], uv: 'box', c: PALE });
    b.add(rbox(0.56, 0.12, 0.56, 0.03), mat, { p: [p[0], y + h + 0.12, p[1]], r: [0, rot, 0], uv: 'box', c: '#fff8ec' });
    b.add(sphere(0.14, 10, 8), mat, { p: [p[0], y + h + 0.3, p[1]], c: '#fff8ec' });
  }
}
const newRes = () => ({ fires: [], glows: [], lanterns: [], smokes: [], colliders: [], dynamics: [] });

// ======================================================================
// HALL TERRACE + GRAND STAIRCASE
// ======================================================================
export function hallTerrace() {
  const b = new Builder(41), res = newRes();
  const top = T.top, foot = 3.0;
  const hb = heightAt(0, S.bottom + 0.6), mid = (top + hb) / 2;
  const wallH = top - foot;
  const sw = S.w / 2, stringerOut = sw + 0.7;
  // retaining walls: battered plinth, big ashlar courses, coping
  const wall = (cx, cz, w, d) => {
    b.add(box(w, wallH, d), 'stoneLarge', { p: [cx, foot + wallH / 2, cz], uv: 'box', us: 0.34, c: WARM, ao: { y0: foot + 0.6, y1: foot + 2.4, min: 0.72 } });
    b.add(rbox(w + 0.5, 1.4, d + 0.5, 0.06), 'stoneLarge', { p: [cx, foot + 0.7, cz], uv: 'box', us: 0.34, c: '#d8cfbe' });
    b.add(rbox(w + 0.34, 0.3, d + 0.34, 0.04), 'stone', { p: [cx, top - 0.05, cz], uv: 'box', c: PALE });
    b.add(box(w + 0.1, 0.12, d + 0.1), 'gold', { p: [cx, top - 0.32, cz], c: 0xffffff });
  };
  const fz = T.z1 - 0.4;
  wall((T.x0 - stringerOut) / 2, fz, -T.x0 - stringerOut, 0.8);
  wall((T.x1 + stringerOut) / 2, fz, T.x1 - stringerOut, 0.8);
  wall(T.x0 + 0.4, (T.z0 + T.z1) / 2, 0.8, T.z1 - T.z0);
  wall(T.x1 - 0.4, (T.z0 + T.z1) / 2, 0.8, T.z1 - T.z0);
  wall(0, T.z0 + 0.4, T.x1 - T.x0, 0.8);
  // paving
  b.add(box(T.x1 - T.x0 - 1.4, 0.16, T.z1 - T.z0 - 1.4), 'stoneLarge', { p: [0, top - 0.08, (T.z0 + T.z1) / 2], uv: 'box', us: 0.4, c: '#ddd4c4' });
  // pilasters on the front wall
  for (const x of [-16.4, -12.2, -8.0, 8.0, 12.2, 16.4]) {
    b.add(rbox(0.9, wallH - 0.4, 0.5, 0.04), 'stoneLarge', { p: [x, foot + (wallH - 0.4) / 2, T.z1 + 0.2], uv: 'box', us: 0.34, c: PALE });
    b.add(rbox(1.1, 0.24, 0.66, 0.04), 'stone', { p: [x, top - 0.5, T.z1 + 0.22], uv: 'box', c: '#fff8ec' });
    // a lantern hung on each pilaster
    res.lanterns.push({ p: [x, top - 1.1, T.z1 + 0.62], len: 0.3, color: 'yellow', scale: 1.1 });
    b.add(box(0.06, 0.06, 0.5), 'iron', { p: [x, top - 0.84, T.z1 + 0.5], c: 0xffffff });
  }
  // corner bastions with braziers
  for (const sx of [-1, 1]) {
    const x = sx * (T.x1 - 0.2), z = T.z1 - 0.2;
    b.add(rbox(2.6, top + 1.4 - foot, 2.6, 0.06), 'stoneLarge', { p: [x, (top + 1.4 + foot) / 2, z], uv: 'box', us: 0.34, c: WARM });
    b.add(rbox(3.0, 0.3, 3.0, 0.05), 'stone', { p: [x, top + 1.5, z], uv: 'box', c: PALE });
    b.add(box(2.66, 0.12, 2.66), 'gold', { p: [x, top + 1.2, z], c: 0xffffff });
    brazier(b, res, x, top + 1.65, z, 1.1);
    res.colliders.push({ x, z, r: 1.7 });
  }
  // parapet balustrades: front segments and the front half of the sides
  balustrade(b, T.x0 + 1.4, T.z1 - 0.4, -stringerOut - 0.3, T.z1 - 0.4, top + 0.1);
  balustrade(b, stringerOut + 0.3, T.z1 - 0.4, T.x1 - 1.4, T.z1 - 0.4, top + 0.1);
  for (const sx of [-1, 1]) balustrade(b, sx * (T.x1 - 0.4), T.z1 - 1.6, sx * (T.x1 - 0.4), T.z0 + 1.0, top + 0.1);
  // planters along the forecourt edge and banner poles at the stair head
  for (const x of [-15.2, -11.4, -7.6, 7.6, 11.4, 15.2]) planter(b, x, top, T.z1 - 1.6, 2.4, 0.9);
  for (const sx of [-1, 1]) {
    const x = sx * 5.6, z = T.z1 - 1.4;
    b.add(rbox(0.6, 0.4, 0.6, 0.05), 'stoneLarge', { p: [x, top + 0.2, z], uv: 'box', c: PALE });
    b.add(cyl(0.07, 0.08, 6.4, 10), 'woodDark', { p: [x, top + 3.4, z], c: 0xffffff });
    b.add(cyl(0.04, 0.04, 1.5, 8), 'gold', { p: [x, top + 6.35, z], r: [0, 0, PI / 2], c: 0xffffff });
    b.add(sphere(0.11, 10, 8), 'gold', { p: [x, top + 6.7, z], c: 0xffffff });
    b.add(card(1.25, 3.2, 3, 10), 'bannerSun', { p: [x, top + 4.7, z + 0.03], uv: 'keep', c: 0xffffff, w: (xx, yy) => [0, 0.02, 0, 0.14 * Math.min(1, Math.max(0, (top + 6.3 - yy) / 3.2))] });
  }
  // carpet across the forecourt to the hall door
  b.add(card(2.6, T.z1 - VILLAGE.terrace.z1 + 4.6, 1, 1), 'carpetBlue', { p: [0, top + 0.012, T.z1 - 2.3], r: [-PI / 2, 0, 0], uv: 'keep', us: [1, 1.6], c: 0xffffff });

  // ----- staircase: two flights of eight with a landing
  const flight = (zLow, zHigh, yLow, yHigh, n) => {
    const run = (zLow - zHigh) / n, rise = (yHigh - yLow) / n;
    for (let i = 0; i < n; i++) {
      const yt = yLow + (i + 1) * rise, zf = zLow - i * run, zc = zf - run / 2;
      b.add(box(S.w, yt - foot, run), 'stoneLarge', { p: [0, (yt + foot) / 2, zc], uv: 'box', us: 0.4, c: '#e6ddcc' });
      b.add(rbox(S.w, 0.07, 0.12, 0.03), 'stone', { p: [0, yt - 0.03, zf - 0.02], uv: 'box', c: '#fff6e8' });
      // carpet: tread, riser, gold stair rod at the riser foot
      b.add(card(2.6, run, 1, 1), 'carpetBlue', { p: [0, yt + 0.012, zc], r: [-PI / 2, 0, 0], uv: 'keep', us: [1, run / 1.6], c: 0xffffff });
      b.add(card(2.6, rise, 1, 1), 'carpetBlue', { p: [0, yt - rise / 2, zf + 0.012], uv: 'keep', us: [1, rise / 1.6], c: 0xe0e0e0 });
      b.add(cyl(0.025, 0.025, 2.8, 8), 'gold', { p: [0, yt - rise + 0.03, zf + 0.03], r: [0, 0, PI / 2], c: 0xffffff });
    }
  };
  flight(S.bottom, S.landing1, hb, mid, 8);
  b.add(box(S.w, mid - foot, S.landing1 - S.landing0), 'stoneLarge', { p: [0, (mid + foot) / 2, (S.landing0 + S.landing1) / 2], uv: 'box', us: 0.4, c: '#e6ddcc' });
  b.add(card(2.6, S.landing1 - S.landing0, 1, 1), 'carpetBlue', { p: [0, mid + 0.012, (S.landing0 + S.landing1) / 2], r: [-PI / 2, 0, 0], uv: 'keep', c: 0xffffff });
  flight(S.landing0, S.top, mid, top, 8);
  // stair walls: an extruded profile following the nosing line, 1 m above it, with a sloped coping
  const rail = 0.95;
  const prof = [[S.bottom + 0.4, foot], [S.bottom + 0.4, hb + rail], [S.landing1, mid + rail], [S.landing0, mid + rail], [S.top, top + rail], [S.top, foot]];
  const shape = new THREE.Shape(prof.map(([z, y]) => new THREE.Vector2(z, y)));
  for (const sx of [-1, 1]) {
    const g = extrude(shape, 0.7, 0.02, 4);
    b.add(g, 'stoneLarge', { p: [sx * (sw + (sx > 0 ? 0.7 : 0)), 0, 0], r: [0, -PI / 2, 0], boxuv: true, us: 0.34, c: WARM });
    // coping on each run
    const cop = (z0, y0, z1, y1) => {
      const L = Math.hypot(z1 - z0, y1 - y0), a = Math.atan2(y1 - y0, z0 - z1);
      b.add(rbox(0.92, 0.16, L + 0.1, 0.04), 'stone', { p: [sx * (sw + 0.35), (y0 + y1) / 2 + 0.08, (z0 + z1) / 2], r: [a, 0, 0], uv: 'box', c: '#fff8ec' });
    };
    cop(S.bottom + 0.4, hb + rail, S.landing1, mid + rail);
    cop(S.landing1, mid + rail, S.landing0, mid + rail);
    cop(S.landing0, mid + rail, S.top, top + rail);
    // newel pillars: braziers at the foot and the head, planters on the landing
    const newel = (z, y, h) => {
      b.add(rbox(1.05, y + h - foot, 1.05, 0.05), 'stoneLarge', { p: [sx * (sw + 0.35), (y + h + foot) / 2, z], uv: 'box', us: 0.34, c: PALE });
      b.add(rbox(1.3, 0.22, 1.3, 0.04), 'stone', { p: [sx * (sw + 0.35), y + h + 0.06, z], uv: 'box', c: '#fff8ec' });
      b.add(box(1.08, 0.1, 1.08), 'gold', { p: [sx * (sw + 0.35), y + h - 0.25, z], c: 0xffffff });
      return y + h + 0.17;
    };
    brazier(b, res, sx * (sw + 0.35), newel(S.bottom + 0.1, hb, 1.25), S.bottom + 0.1, 0.9);
    planter(b, sx * (sw + 0.35), newel(S.landing0 - 0.2, mid, 1.05), S.landing0 - 0.2, 0.9, 0.9);
    brazier(b, res, sx * (sw + 0.35), newel(S.top - 0.2, top, 1.05), S.top - 0.2, 0.9);
    // terraced flower beds outside the stair walls
    const bx = sx * (stringerOut + 1.9);
    b.add(rbox(3.8, hb + 0.55 - foot, S.bottom - S.landing1 - 0.4, 0.05), 'stoneLarge', { p: [bx, (hb + 0.55 + foot) / 2, (S.bottom + S.landing1) / 2 - 0.1], uv: 'box', us: 0.34, c: WARM });
    b.add(rbox(3.8, mid + 0.55 - foot, S.landing0 - S.top - 0.2, 0.05), 'stoneLarge', { p: [bx, (mid + 0.55 + foot) / 2, (S.landing0 + S.top) / 2 - 0.1], uv: 'box', us: 0.34, c: WARM });
    for (const [z0, z1, y] of [[S.bottom - 0.2, S.landing1, hb + 0.55], [S.landing0, S.top + 0.1, mid + 0.55]]) {
      b.add(box(3.5, 0.06, Math.abs(z1 - z0) - 0.5), 'dirtPlain', { p: [bx, y, (z0 + z1) / 2], uv: 'box', c: '#7a5a3a' });
      const n = 7;
      for (let i = 0; i < n; i++) for (const ox of [-1, 0, 1]) {
        const z = z0 - (i + 0.5) / n * Math.abs(z1 - z0);
        addTuft(b, (i + ox) % 3 === 0 ? 'flowers' : 'lavender', [bx + ox * 1.05, y, z], 0.62, 0.6, i + ox, 0xffffff, 2);
      }
      b.add(lumpy(sphere(0.62, 12, 9), 0.1, 3, 7 + sx), 'coreBush', { p: [bx + sx * 1.1, y + 0.45, (z0 + z1) / 2], s: [1, 0.8, 1], uv: 'box', c: '#bcd89a' });
    }
  }
  // colliders: terrace walls (gap for the stairs), stair walls with their flower beds
  const cz = T.z1 - 0.45;
  res.colliders.push({ x: (T.x0 - stringerOut) / 2, z: cz, hw: (-T.x0 - stringerOut) / 2, hd: 0.55 });
  res.colliders.push({ x: (T.x1 + stringerOut) / 2, z: cz, hw: (T.x1 - stringerOut) / 2, hd: 0.55 });
  res.colliders.push({ x: T.x0 + 0.4, z: (T.z0 + T.z1) / 2, hw: 0.55, hd: (T.z1 - T.z0) / 2 });
  res.colliders.push({ x: T.x1 - 0.4, z: (T.z0 + T.z1) / 2, hw: 0.55, hd: (T.z1 - T.z0) / 2 });
  res.colliders.push({ x: 0, z: T.z0 + 0.4, hw: (T.x1 - T.x0) / 2, hd: 0.55 });
  for (const sx of [-1, 1]) res.colliders.push({ x: sx * (sw + 0.35 + 2.0), z: (S.bottom + S.top) / 2 + 0.1, hw: 2.4, hd: (S.bottom - S.top) / 2 + 0.6 });
  for (const sx of [-1, 1]) res.colliders.push({ x: sx * 5.6, z: T.z1 - 1.4, r: 0.4 });
  res.builder = b;
  return res;
}

// ======================================================================
// GUILD HALL: nave with a tall front gable, entrance portal, two crenellated towers, side wings
// ======================================================================
export function guildHall() {
  const b = new Builder(42), res = newRes();
  const B0 = T.top;
  const nave = { x: 7, z0: -55, z1: -38, h: 9.2, rise: 6.6 };
  const eave = B0 + nave.h;
  // ---- nave
  const nzc = (nave.z0 + nave.z1) / 2, nd = nave.z1 - nave.z0;
  b.add(box(nave.x * 2, nave.h, nd), 'stone', { p: [0, B0 + nave.h / 2, nzc], uv: 'box', us: 0.5, c: WARM, ao: { y0: B0, y1: B0 + 2.5, min: 0.78 } });
  b.add(rbox(nave.x * 2 + 0.6, 1.0, nd + 0.6, 0.05), 'stoneLarge', { p: [0, B0 + 0.5, nzc], uv: 'box', us: 0.34, c: '#ddd4c2' });
  b.add(box(nave.x * 2 + 0.3, 0.26, nd + 0.3), 'gold', { p: [0, eave - 0.13, nzc], c: 0xffffff });
  b.add(box(nave.x * 2 + 0.2, 0.18, nd + 0.2), 'stone', { p: [0, B0 + 4.6, nzc], uv: 'box', c: PALE });
  gable(b, 0, nave.z1 - 0.15, nave.x * 2, nave.rise, eave);
  gable(b, 0, nave.z0 + 0.15, nave.x * 2, nave.rise, eave);
  roofZ(b, 0, nzc, nave.x * 2, nd, nave.rise, eave, { over: 0.7 });
  // gold finials on the gable apexes (round, no spires)
  for (const z of [nave.z1 - 0.2, nave.z0 + 0.2]) { b.add(sphere(0.3, 14, 10), 'gold', { p: [0, eave + nave.rise + 0.45, z], c: 0xffffff }); b.add(cyl(0.1, 0.14, 0.4, 10), 'gold', { p: [0, eave + nave.rise + 0.15, z], c: 0xffffff }); }
  // gable: a big square-headed window with a flat lintel over the portal
  archWin(b, 0, B0 + 10.8, nave.z1 + 0.02, 0, 2.2, 2.8, 'stone');
  // a small square window in the gable apex (square-headed: no round rings or arches)
  b.add(box(1.0, 1.0, 0.06), 'glassWarm', { p: [0, B0 + 14.6, nave.z1 + 0.06], c: 0xffffff });
  b.add(box(1.3, 0.16, 0.2), 'stone', { p: [0, B0 + 15.18, nave.z1 + 0.1], uv: 'box', c: PALE });
  b.add(box(1.3, 0.16, 0.2), 'stone', { p: [0, B0 + 14.02, nave.z1 + 0.1], uv: 'box', c: PALE });
  for (const sx of [-1, 1]) b.add(box(0.16, 1.0, 0.2), 'stone', { p: [sx * 0.58, B0 + 14.6, nave.z1 + 0.1], uv: 'box', c: PALE });
  // side windows and buttresses
  for (const sx of [-1, 1]) {
    for (const z of [-42.2, -46.6, -51]) archWin(b, sx * (nave.x + 0.02), B0 + 3.2, z, sx * PI / 2, 1.2, 3.6, 'stone');
    for (const z of [-40, -44.4, -48.8, -53.2]) {
      b.add(rbox(1.1, 7.2, 0.8, 0.04), 'stoneLarge', { p: [sx * (nave.x + 0.5), B0 + 3.6, z], uv: 'box', us: 0.34, c: PALE });
      b.add(prism(0.8, 1.0, 1.1), 'stoneLarge', { p: [sx * (nave.x + 0.5), B0 + 7.2, z], r: [0, PI / 2, 0], uv: 'box', c: PALE });
    }
  }
  // ---- entrance portal
  const pz0 = nave.z1, pz1 = nave.z1 + 2.4, pw = 7.0, ph = 8.0;
  const dw = 3.2, dh = 5.4;
  const ds = arcShape(dw, dh, dw / 2);
  {
    const slab = new THREE.Shape([new THREE.Vector2(-pw / 2, 0), new THREE.Vector2(pw / 2, 0), new THREE.Vector2(pw / 2, ph), new THREE.Vector2(-pw / 2, ph)]);
    slab.holes.push(new THREE.Path(ds.getPoints(32).reverse()));
    b.add(extrude(slab, pz1 - pz0 - 0.3, 0.02, 16), 'stone', { p: [0, B0, pz0 + 0.3], boxuv: true, us: 0.5, c: WARM });
  }
  b.add(box(pw + 0.24, 0.24, pz1 - pz0 + 0.24), 'gold', { p: [0, B0 + ph - 0.1, (pz0 + pz1) / 2], c: 0xffffff });
  gable(b, 0, pz1 - 0.15, pw, 2.4, B0 + ph);
  roofZ(b, 0, (pz0 + pz1) / 2, pw, pz1 - pz0, 2.4, B0 + ph, { over: 0.45 });
  b.add(sphere(0.22, 12, 9), 'gold', { p: [0, B0 + ph + 2.75, pz1 - 0.1], c: 0xffffff });
  // the doorway: a deep square-headed passage glowing warm inside, doors folded back, square gold door surround, jamb columns
  b.add(extrude(ds, 0.04, 0, 16), 'doorWarm', { p: [0, B0, pz0 + 0.31], c: 0xffffff });
  b.add(box(dw, 0.12, pz1 - pz0 - 0.3), 'carpetBlue', { p: [0, B0 + 0.06, (pz0 + 0.3 + pz1) / 2], uv: 'box', c: 0xffffff });
  for (const k of [1.0, 1.12]) {
    const ring = new THREE.Shape(arcShape(dw * k + 0.9, dh * (k * 0.06 + 0.97) + 0.5, (dw * k + 0.9) / 2).getPoints(36));
    ring.holes.push(new THREE.Path(arcShape(dw * k + 0.6, dh * (k * 0.06 + 0.97) + 0.32, (dw * k + 0.6) / 2).getPoints(36).reverse()));
    b.add(extrude(ring, 0.12, 0.02, 16), k === 1 ? 'gold' : 'stone', { p: [0, B0, pz1 + 0.01], boxuv: true, c: k === 1 ? 0xffffff : PALE });
  }
  for (const sx of [-1, 1]) {
    // door leaves folded back into the passage, hinged at the jambs
    {
      const hx = sx * (dw / 2 - 0.08), hz = pz1 - 0.25, a = 0.22, len = dw / 2 - 0.1;
      const dirx = -sx * Math.sin(a), dirz = -Math.cos(a), rot = Math.atan2(-dirz, dirx);
      const lh = dh - dw / 2 + 0.4;
      b.add(box(len, lh, 0.12), 'woodDark', { p: [hx + dirx * len / 2, B0 + lh / 2, hz + dirz * len / 2], r: [0, rot, 0], uv: 'box', c: '#e8d8c0' });
      for (const yy of [0.7, 1.9, 3.1]) b.add(box(len - 0.08, 0.07, 0.15), 'iron', { p: [hx + dirx * len / 2, B0 + yy, hz + dirz * len / 2], r: [0, rot, 0], c: 0xffffff });
    }
    // jamb columns with gold capitals
    b.add(cyl(0.2, 0.24, dh - dw / 2, 14), 'stoneLarge', { p: [sx * (dw / 2 + 0.68), B0 + (dh - dw / 2) / 2, pz1 + 0.22], uv: 'box', c: PALE });
    b.add(cyl(0.3, 0.24, 0.24, 14), 'gold', { p: [sx * (dw / 2 + 0.68), B0 + dh - dw / 2 + 0.06, pz1 + 0.22], c: 0xffffff });
    b.add(rbox(0.6, 0.3, 0.6, 0.04), 'stoneLarge', { p: [sx * (dw / 2 + 0.68), B0 + 0.15, pz1 + 0.22], uv: 'box', c: PALE });
    // lantern brackets beside the door
    b.add(box(0.06, 0.06, 0.6), 'iron', { p: [sx * (pw / 2 - 0.5), B0 + 4.4, pz1 + 0.3], c: 0xffffff });
    res.lanterns.push({ p: [sx * (pw / 2 - 0.5), B0 + 4.1, pz1 + 0.58], len: 0.35, color: 'yellow', scale: 1.3 });
  }
  // a plain square gold plaque in a stone frame over the door (no disc, ring or halo)
  b.add(box(1.5, 1.1, 0.1), 'stone', { p: [0, B0 + dh + 1.6, pz1 + 0.05], uv: 'box', c: PALE });
  b.add(box(1.1, 0.7, 0.14), 'gold', { p: [0, B0 + dh + 1.6, pz1 + 0.08], c: 0xffffff });
  res.glows.push({ p: [0, B0 + 2.4, pz1 - 0.6], color: 0xffc060, size: 3.6, intensity: 0.16 });
  // facade banners between the portal and the towers
  for (const sx of [-1, 1]) wallBanner(b, sx * 5.1, eave - 0.6, nave.z1, 0, 1.4, 5.2);
  // ---- towers (crenellated, a flat slab roof inside the parapet)
  for (const sx of [-1, 1]) {
    const tx = sx * 9.2, tz = -38.6, tw = 4.4, th = 15.2;
    b.add(box(tw, th, tw), 'stone', { p: [tx, B0 + th / 2, tz], uv: 'box', us: 0.5, c: WARM, ao: { y0: B0, y1: B0 + 2.5, min: 0.78 } });
    b.add(rbox(tw + 0.6, 1.2, tw + 0.6, 0.05), 'stoneLarge', { p: [tx, B0 + 0.6, tz], uv: 'box', us: 0.34, c: '#ddd4c2' });
    for (const y of [B0 + 4.6, B0 + 9.6]) b.add(box(tw + 0.2, 0.2, tw + 0.2), 'stone', { p: [tx, y, tz], uv: 'box', c: PALE });
    const top = B0 + th;
    b.add(rbox(tw + 0.7, 0.5, tw + 0.7, 0.05), 'stoneLarge', { p: [tx, top + 0.25, tz], uv: 'box', us: 0.34, c: PALE });
    b.add(box(tw + 0.74, 0.12, tw + 0.74), 'gold', { p: [tx, top + 0.05, tz], c: 0xffffff });
    // corbels under the parapet
    for (let i = 0; i < 5; i++) for (const [ox, oz, r] of [[0, 1, 0], [0, -1, 0], [1, 0, PI / 2], [-1, 0, PI / 2]]) {
      const u = (i - 2) * 0.95;
      b.add(rbox(0.32, 0.5, 0.36, 0.03), 'stone', { p: [tx + ox * (tw / 2 + 0.16) + (oz ? u : 0), top - 0.24, tz + oz * (tw / 2 + 0.16) + (ox ? u : 0)], r: [0, r, 0], uv: 'box', c: PALE });
    }
    // merlons
    const half = tw / 2 + 0.3;
    for (let i = 0; i < 5; i++) {
      const u = -half + 0.35 + i * ((half * 2 - 0.7) / 4);
      for (const [px, pz] of [[u, half - 0.2], [u, -half + 0.2], [half - 0.2, u], [-half + 0.2, u]]) {
        b.add(rbox(0.66, 0.9, 0.4, 0.04), 'stoneLarge', { p: [tx + px, top + 0.95, tz + pz], r: [0, Math.abs(pz) > Math.abs(px) ? 0 : PI / 2, 0], uv: 'box', c: PALE });
      }
    }
    // a flat square slate slab inside the parapet (no pointed roof, finial, pole or flag)
    b.add(box(tw + 0.1, 0.36, tw + 0.1), 'slate', { p: [tx, top + 0.62, tz], uv: 'box', c: 0xffffff });
    // narrow square-headed windows with flat lintels on the outward faces, three storeys
    for (const y of [B0 + 2.2, B0 + 6.6, B0 + 11.0]) {
      archWin(b, tx, y, tz + tw / 2 + 0.01, 0, 0.7, 1.7, 'stone');
      archWin(b, tx + sx * (tw / 2 + 0.01), y, tz, sx * PI / 2, 0.7, 1.7, 'stone');
    }
    wallBanner(b, tx, B0 + 14.4, tz + tw / 2, 0, 1.3, 4.0);
    res.colliders.push({ x: tx, z: tz, hw: tw / 2 + 0.35, hd: tw / 2 + 0.35 });
  }
  // ---- side wings with front gables
  for (const sx of [-1, 1]) {
    const wx0 = 11.4, wx1 = 17.6, wz0 = -54, wz1 = -41, wh = 6.4, wr = 3.4;
    const wxc = sx * (wx0 + wx1) / 2, ww = wx1 - wx0, wzc = (wz0 + wz1) / 2, wd = wz1 - wz0;
    b.add(box(ww, wh, wd), 'stone', { p: [wxc, B0 + wh / 2, wzc], uv: 'box', us: 0.5, c: WARM, ao: { y0: B0, y1: B0 + 2.5, min: 0.78 } });
    b.add(rbox(ww + 0.5, 0.9, wd + 0.5, 0.05), 'stoneLarge', { p: [wxc, B0 + 0.45, wzc], uv: 'box', us: 0.34, c: '#ddd4c2' });
    b.add(box(ww + 0.24, 0.2, wd + 0.24), 'gold', { p: [wxc, B0 + wh - 0.1, wzc], c: 0xffffff });
    gable(b, wxc, wz1 - 0.15, ww, wr, B0 + wh);
    gable(b, wxc, wz0 + 0.15, ww, wr, B0 + wh);
    roofZ(b, wxc, wzc, ww, wd, wr, B0 + wh, { over: 0.5 });
    b.add(sphere(0.2, 10, 8), 'gold', { p: [wxc, B0 + wh + wr + 0.32, wz1 - 0.2], c: 0xffffff });
    archWin(b, wxc, B0 + wh + 0.5, wz1 + 0.02, 0, 0.9, 1.9, 'stone');
    for (const ox of [-1.5, 1.5]) {
      archWin(b, wxc + ox, B0 + 1.4, wz1 + 0.02, 0, 1.0, 2.8, 'stone');
      planter(b, wxc + ox, B0 + 0.0, wz1 + 0.75, 1.5, 0.6);
    }
    for (const z of [-44.5, -48, -51.5]) archWin(b, sx * (wx1 + 0.02), B0 + 1.6, z, sx * PI / 2, 1.0, 2.6, 'stone');
    // chimney with smoke on the outer slope
    const cx = sx * 15.6, czz = -50;
    b.add(rbox(0.9, 5.0, 0.9, 0.04), 'stoneDark', { p: [cx, B0 + wh + 1.8, czz], uv: 'box', c: '#e0d8c8' });
    b.add(rbox(1.1, 0.2, 1.1, 0.04), 'stoneDark', { p: [cx, B0 + wh + 4.35, czz], uv: 'box', c: '#f0e8d8' });
    res.smokes.push({ p: [cx, B0 + wh + 4.6, czz], opts: { rate: 1.6, size: 1.1 } });
    res.colliders.push({ x: wxc, z: wzc, hw: ww / 2 + 0.3, hd: wd / 2 + 0.3 });
  }
  // cypress shrubs and planters along the hall front
  for (const sx of [-1, 1]) {
    for (const x of [sx * 12.4, sx * 16.4]) b.add(lumpy(cone(0.75, 3.6, 12), 0.07, 3, 5), 'coreTree', { p: [x, B0 + 1.8, -38.4], uv: 'box', c: '#d8ecc8' });
  }
  res.colliders.push({ x: 0, z: nzc, hw: nave.x + 0.4, hd: nd / 2 + 0.3 });
  res.colliders.push({ x: 0, z: (pz0 + pz1) / 2, hw: pw / 2 + 0.3, hd: (pz1 - pz0) / 2 + 0.1 });
  res.builder = b;
  return res;
}

// ======================================================================
// PLAZA FOUNTAIN (local coordinates; the plaza centre): square stone basins and a plain stone pillar.
// Everything is square or a rounded rectangle, so from above it never reads as rings round a disc.
// ======================================================================
export function crystalFountain() {
  const b = new Builder(43), res = newRes();
  const wall = (half, y0, h, t, mat, c) => { // four straight walls round a square of half-size `half`
    for (const [x, z, w, d] of [[0, half - t / 2, half * 2, t], [0, -half + t / 2, half * 2, t], [half - t / 2, 0, t, half * 2 - t * 2], [-half + t / 2, 0, t, half * 2 - t * 2]])
      b.add(rbox(w, h, d, 0.04), mat, { p: [x, y0 + h / 2, z], uv: 'box', us: 0.4, c });
  };
  // low outer step and the main basin: straight walls with a pale coping
  b.add(rbox(11.0, 0.32, 11.0, 0.08), 'stoneLarge', { p: [0, -0.04, 0], uv: 'box', us: 0.4, c: '#e2d8c6' });
  wall(4.75, 0, 0.62, 0.62, 'stoneLarge', PALE);
  wall(4.85, 0.62, 0.12, 0.82, 'stone', '#fff8ec');
  b.add(box(8.3, 0.1, 8.3), 'stoneDark', { p: [0, 0.08, 0], uv: 'box', c: '#5a6a6a' });
  // square pedestal and the raised middle basin
  b.add(rbox(1.3, 1.9, 1.3, 0.05), 'stoneLarge', { p: [0, 0.95, 0], uv: 'box', us: 0.4, c: PALE });
  b.add(rbox(3.9, 0.22, 3.9, 0.05), 'stoneLarge', { p: [0, 1.92, 0], uv: 'box', us: 0.4, c: PALE });
  wall(1.95, 2.0, 0.24, 0.3, 'stone', '#fff8ec');
  // the centrepiece: a plain square stone pillar with a flat cap, water spilling from a short spout on one face.
  // The cap overhangs the spout on every side, so from straight above it reads as one plain square.
  b.add(rbox(0.62, 1.5, 0.62, 0.04), 'stoneLarge', { p: [0, 2.75, 0], uv: 'box', us: 0.4, c: PALE });
  b.add(rbox(1.04, 0.18, 1.04, 0.03), 'stone', { p: [0, 3.57, 0], uv: 'box', c: '#fff8ec' });
  b.add(box(0.16, 0.12, 0.2), 'stone', { p: [0, 3.05, 0.39], uv: 'box', c: '#e8dcc6' });
  // water: lower pool, middle basin, the sheet falling from the middle basin's rim, the spout's stream
  const low = basinWater(4.15, true); low.position.y = 0.6; res.dynamics.push(low);
  const midW = basinWater(1.8, true); midW.position.y = 2.13; res.dynamics.push(midW);
  const cur = waterCurtain(1.95 * Math.SQRT2, 2.05 * Math.SQRT2, 1.5, 1.5, 4); cur.position.y = 1.38; res.dynamics.push(cur);
  const spout = waterCurtain(0.05, 0.09, 0.9, 2); spout.position.set(0, 2.62, 0.5); res.dynamics.push(spout);
  // flowers floating along the pool's edge
  for (let i = 0; i < 12; i++) { const s = i % 4, f = ((i >> 2) - 1) * 2.2; const [x, z] = [[f, 3.75], [f, -3.75], [3.75, f], [-3.75, f]][s]; addTuft(b, 'flowers', [x, 0.62, z], 0.5, 0.25, i, 0xffffff, 2); }
  res.colliders.push({ x: 0, z: 0, hw: 5.0, hd: 5.0 });
  res.builder = b;
  return res;
}

// four straight planter beds round the fountain (gaps for the four avenues), local coordinates
export function plazaPlanters() {
  const b = new Builder(44), res = newRes();
  // (RF.7 review) two long beds east and west of the fountain, running north-south, parallel to its sides: the four beds
  // stood on the diagonals round it (an X from straight above, and with the four roads out of the plaza an eight-rayed star);
  // they also break the east-west line through the plaza, so the four roads no longer read as one + across it
  const r = 8.4, len = 6, dep = 1.4;
  for (let q = 0; q < 2; q++) {
    const cx = q ? r : -r, cz = 0, ry = PI / 2;
    b.add(rbox(len, 0.62, dep, 0.06), 'stoneLarge', { p: [cx, 0.31, cz], r: [0, ry, 0], uv: 'box', us: 0.4, c: PALE });
    b.add(box(len - 0.36, 0.06, dep - 0.36), 'dirtPlain', { p: [cx, 0.62, cz], r: [0, ry, 0], uv: 'box', c: '#7a5a3a' });
    const ux = Math.cos(ry), uz = -Math.sin(ry), nx = -uz, nz = ux;
    const n = 8;
    for (let i = 0; i < n; i++) {
      const t = ((i + 0.5) / n - 0.5) * (len - 0.8);
      for (const o of [-0.35, 0.35]) {
        const k = (i + (o > 0 ? 1 : 0)) % 3 === 0 ? 'flowers' : 'lavender';
        addTuft(b, k, [cx + ux * t + nx * o, 0.62, cz + uz * t + nz * o], 0.62, k === 'lavender' ? 0.62 : 0.45, i * 3 + q, 0xffffff, 2);
      }
    }
    b.add(lumpy(sphere(0.55, 12, 9), 0.1, 3, q), 'coreBush', { p: [cx, 0.95, cz], s: [1, 0.85, 1], uv: 'box', c: '#bcd89a' });
    res.colliders.push({ x: cx, z: cz, hw: len / 2, hd: dep / 2, rot: ry });
  }
  res.builder = b;
  return res;
}

// tall banner pole with a hanging sun banner (local)
export function bannerPost(seed = 1) {
  const b = new Builder(seed), res = newRes();
  b.add(rbox(0.6, 0.35, 0.6, 0.05), 'stoneLarge', { p: [0, 0.15, 0], uv: 'box', c: PALE });
  // (RF.5) the pole stops at the hanging bar (a T, never a cross): the pole and its gold knob ran on above the bar and
  // drew a cross from the side
  b.add(cyl(0.06, 0.075, 5.35, 10), 'woodDark', { p: [0, 2.825, 0], c: 0xffffff });
  for (const y of [0.45, 5.3]) b.add(torus(0.085, 0.022, 6, 12), 'gold', { p: [0, y, 0], r: [PI / 2, 0, 0], c: 0xffffff });
  b.add(cyl(0.035, 0.035, 1.3, 8), 'gold', { p: [0, 5.45, 0.0], r: [0, 0, PI / 2], c: 0xffffff });
  b.add(card(1.1, 2.8, 3, 9), 'bannerSun', { p: [0, 3.95, 0.04], uv: 'keep', c: 0xffffff, w: (xx, yy) => [0, 0.02, 0, 0.14 * Math.min(1, Math.max(0, (5.4 - yy) / 2.8))] });
  res.colliders.push({ r: 0.35 });
  res.builder = b;
  return res;
}

// ======================================================================
// SOUTH GATE: two great pillars with braziers and stone panels, crenellated wall stubs (local, faces +z)
// ======================================================================
export function southGate() {
  const b = new Builder(45), res = newRes();
  for (const sx of [-1, 1]) {
    const x = sx * 5.4;
    b.add(rbox(2.6, 1.2, 2.6, 0.06), 'stoneLarge', { p: [x, 0.4, 0], uv: 'box', us: 0.34, c: '#ddd4c2' });
    b.add(box(2.2, 6.6, 2.2), 'stoneLarge', { p: [x, 3.6, 0], uv: 'box', us: 0.34, c: WARM, ao: { y0: 0, y1: 2, min: 0.75 } });
    for (const y of [2.4, 4.8]) b.add(box(2.34, 0.18, 2.34), 'stone', { p: [x, y, 0], uv: 'box', c: PALE });
    b.add(rbox(2.8, 0.4, 2.8, 0.05), 'stone', { p: [x, 7.05, 0], uv: 'box', c: PALE });
    b.add(box(2.3, 0.12, 2.3), 'gold', { p: [x, 6.75, 0], c: 0xffffff });
    brazier(b, res, x, 7.25, 0, 1.25);
    // (no banners on the gate towers: a plain raised stone panel on the inner and the front face instead)
    b.add(box(0.12, 3.6, 1.3), 'stone', { p: [x - sx * 1.17, 4.55, 0], uv: 'box', c: PALE });
    b.add(box(1.3, 3.6, 0.12), 'stone', { p: [x, 4.55, 1.17], uv: 'box', c: PALE });
    res.lanterns.push({ p: [x - sx * 1.5, 4.0, 0], len: 0.35, color: 'yellow', scale: 1.2 });
    b.add(box(0.5, 0.06, 0.06), 'iron', { p: [x - sx * 1.3, 4.3, 0], c: 0xffffff });
    res.colliders.push({ x, z: 0, hw: 1.3, hd: 1.3 });
    // wall stub with merlons
    const w0 = 6.5, w1 = 15;
    const wc = sx * (w0 + w1) / 2, wl = w1 - w0;
    b.add(box(wl, 3.2, 1.0), 'stoneLarge', { p: [wc, 1.6, 0], uv: 'box', us: 0.34, c: WARM, ao: { y0: 0, y1: 1.5, min: 0.75 } });
    b.add(box(wl + 0.1, 0.22, 1.2), 'stone', { p: [wc, 3.25, 0], uv: 'box', c: PALE });
    for (let i = 0; i < 6; i++) b.add(rbox(0.8, 0.8, 1.0, 0.04), 'stoneLarge', { p: [sx * (w0 + 0.7 + i * (wl - 1.4) / 5), 3.75, 0], uv: 'box', c: PALE });
    b.add(rbox(1.3, 4.2, 1.3, 0.05), 'stoneLarge', { p: [sx * (w1 + 0.4), 2.1, 0], uv: 'box', us: 0.34, c: PALE });
    res.colliders.push({ x: wc, z: 0, hw: wl / 2, hd: 0.6 });
    // flower beds at the pillar feet
    planter(b, x + sx * 1.9, 0, 1.5, 1.4, 0.8);
  }
  res.builder = b;
  return res;
}

// ======================================================================
// STONE BRIDGE over the stream: a level beam bridge on two piers, flat deck and flat lintel (no hump, no arch) (world coordinates, from shared BRIDGES[i])
// ======================================================================
export function archBridge(i) {
  const br = BRIDGES[i], res = newRes();
  const b = new Builder(46 + i);
  const [ax, az] = br.a, [bx, bz] = br.b;
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), rot = Math.atan2(-dz, dx);
  const hA = heightAt(ax, az), hB = heightAt(bx, bz);
  const deck = (t) => hA + (hB - hA) * t + br.rise * Math.sin(PI * t) + 0.12;
  const si = streamInfo((ax + bx) / 2, (az + bz) / 2);
  const bed = si.level - 1.1, spring = si.level - 0.35;
  const N = 24;
  // body: deck curve on top, abutments down to the bed, a square-headed opening underneath (a flat stone lintel, no arch)
  const body = new THREE.Shape();
  body.moveTo(0, bed);
  for (let k = 0; k <= N; k++) { const t = k / N; body.lineTo(t * L, deck(t) - 0.14); }
  const a0 = L * 0.2, a1 = L * 0.8;
  const top = Math.max(si.level + 0.25, Math.min(deck(0.2), deck(0.8)) - 0.6); // the lintel's underside, clear of the deck
  body.lineTo(L, bed); body.lineTo(a1, bed); body.lineTo(a1, top); body.lineTo(a0, top);
  body.lineTo(a0, bed); body.lineTo(0, bed);
  const place = (geo, mat, o = {}) => b.add(geo, mat, { m: new THREE.Matrix4().makeTranslation(ax, 0, az).multiply(new THREE.Matrix4().makeRotationY(rot)).multiply(o.m || new THREE.Matrix4()), c: o.c ?? 0xffffff, boxuv: true, us: o.us });
  place(extrude(body, br.w, 0.02, 4), 'stoneLarge', { c: WARM, us: 0.34 }); // extrude() is already centred on its depth
  // a pale lintel band over the opening and pale jambs down its sides, on both faces (almost flush)
  for (const side of [-1, 1]) {
    const band = new THREE.Shape();
    band.moveTo(a0 - 0.3, top); band.lineTo(a1 + 0.3, top); band.lineTo(a1 + 0.3, top + 0.28); band.lineTo(a0 - 0.3, top + 0.28); band.closePath();
    place(extrude(band, 0.04, 0.0, 4), 'stone', { m: new THREE.Matrix4().makeTranslation(0, 0, side * (br.w / 2 + 0.01)), c: PALE, us: 0.42 });
    for (const [j0, j1] of [[a0 - 0.3, a0], [a1, a1 + 0.3]]) {
      const jb = new THREE.Shape();
      jb.moveTo(j0, bed); jb.lineTo(j1, bed); jb.lineTo(j1, top); jb.lineTo(j0, top); jb.closePath();
      place(extrude(jb, 0.04, 0.0, 4), 'stone', { m: new THREE.Matrix4().makeTranslation(0, 0, side * (br.w / 2 + 0.01)), c: PALE, us: 0.42 });
    }
  }
  // cobbled deck strip and parapets with coping
  const strip = new THREE.Shape();
  strip.moveTo(0, deck(0) - 0.14);
  for (let k = 0; k <= N; k++) { const t = k / N; strip.lineTo(t * L, deck(t) - 0.1); }
  for (let k = N; k >= 0; k--) { const t = k / N; strip.lineTo(t * L, deck(t) - 0.2); }
  place(extrude(strip, br.w - 0.6, 0, 4), 'cobble', { m: new THREE.Matrix4().makeTranslation(0, 0.08, 0), c: '#e8e0d0', us: 0.6 });
  for (const side of [-1, 1]) {
    const par = new THREE.Shape();
    par.moveTo(0, deck(0) - 0.2);
    for (let k = 0; k <= N; k++) { const t = k / N; par.lineTo(t * L, deck(t) + 0.72); }
    for (let k = N; k >= 0; k--) { const t = k / N; par.lineTo(t * L, deck(t) - 0.2); }
    place(extrude(par, 0.34, 0.02, 4), 'stoneLarge', { m: new THREE.Matrix4().makeTranslation(0, 0, side * (br.w / 2 - 0.17)), c: PALE, us: 0.34 });
    for (let k = 0; k < N; k++) {
      const t0 = k / N, t1 = (k + 1) / N, y0 = deck(t0) + 0.78, y1 = deck(t1) + 0.78;
      const seg = Math.hypot(L / N, y1 - y0), a = Math.atan2(y1 - y0, L / N);
      place(rbox(seg + 0.02, 0.12, 0.44, 0.03), 'stone', { m: new THREE.Matrix4().makeTranslation((t0 + t1) / 2 * L, (y0 + y1) / 2, side * (br.w / 2 - 0.17)).multiply(new THREE.Matrix4().makeRotationZ(a)), c: '#fff8ec', us: 0.42 });
    }
    // end posts with lanterns
    for (const t of [0, 1]) {
      const px = t * L + (t ? 0.2 : -0.2), py = deck(t);
      place(rbox(0.62, 1.5, 0.62, 0.05), 'stoneLarge', { m: new THREE.Matrix4().makeTranslation(px, py + 0.55, side * (br.w / 2 - 0.17)), c: PALE, us: 0.34 });
      place(rbox(0.76, 0.14, 0.76, 0.03), 'stone', { m: new THREE.Matrix4().makeTranslation(px, py + 1.33, side * (br.w / 2 - 0.17)), c: '#fff8ec' });
      const wp = new THREE.Vector3(px, py + 1.4, side * (br.w / 2 - 0.17)).applyMatrix4(new THREE.Matrix4().makeRotationY(rot)).add(new THREE.Vector3(ax, 0, az));
      lanternBuilder('yellow', 1.0, b, [wp.x, wp.y + 0.8, wp.z]);
      res.glows.push({ p: [wp.x, wp.y + 0.38, wp.z], color: 0xffc060, size: 2.2, intensity: 0.5 });
    }
  }
  // colliders along both parapets (rotated boxes in world space)
  const ux = dx / L, uz = dz / L, nx = -uz, nz = ux;
  for (const side of [-1, 1]) {
    res.colliders.push({ x: (ax + bx) / 2 + nx * side * (br.w / 2 - 0.1), z: (az + bz) / 2 + nz * side * (br.w / 2 - 0.1), hw: L / 2 - 0.4, hd: 0.25, rot });
  }
  res.builder = b;
  return res;
}
