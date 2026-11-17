// Sunmere Village, part 2: market stalls, the forge with its waterwheel, the spring falls, cottages and the
// ranger training range. Stalls and cottages are merged per group (one object each) to keep draw calls low.
import * as THREE from 'three';
import { Builder, rbox, box, cyl, cone, sphere, torus, lathe, extrude, card, prism, arcShape, lumpy, ico } from './kit.js';
import { addRock, addTuft } from './trees.js';
import { lanternBuilder, fire, glowSprite } from './dynamic.js';
import { modelSlot, tripoEnabled } from './tripoModels.js';
import { roofX, archWin, planter, wallBanner } from './village.js';
import { heightAt, streamInfo, STREAM } from '/sunmere-play/shared/terrain.js';
import { waterfallTex } from '../engine/textures.js';
import { G } from '../engine/globals.js';

const PI = Math.PI;
const newRes = () => ({ fires: [], glows: [], lanterns: [], smokes: [], colliders: [], dynamics: [] });
const xf = (p, x, z, rot) => { const c = Math.cos(rot), s = Math.sin(rot); return [x + p[0] * c + p[2] * s, p[1], z - p[0] * s + p[2] * c]; };

// ======================================================================
// MARKET STALL (local, customers stand on +z)
// ======================================================================
function stall(seed, goods, canopy = 'canopyRed') {
  const b = new Builder(seed), lan = [];
  const W = 3.0, front = 0.95, back = -0.95;
  // counter: top, plank front, sides, legs; a lower back shelf
  b.add(rbox(W - 0.1, 0.08, 0.95, 0.02), 'woodLight', { p: [0, 0.98, 0.38], uv: 'box', c: 0xffffff });
  b.add(box(W - 0.1, 0.86, 0.06), 'wood', { p: [0, 0.52, 0.84], uv: 'box', c: '#d8b888' });
  for (const sx of [-1, 1]) b.add(box(0.06, 0.86, 0.9), 'wood', { p: [sx * (W / 2 - 0.08), 0.52, 0.38], uv: 'box', c: '#c8a070' });
  for (const sx of [-1, 1]) b.add(box(0.1, 0.94, 0.06), 'woodDark', { p: [sx * (W / 2 - 0.08), 0.47, 0.86], uv: 'box', c: 0xffffff });
  b.add(rbox(W - 0.3, 0.06, 0.5, 0.02), 'woodLight', { p: [0, 0.6, -0.55], uv: 'box', c: '#e0c8a0' });
  // posts and the peaked canopy
  const ridgeY = 3.2, eaveF = 2.3, eaveB = 2.5, zr = 0.05, zf = front + 0.3, zb = back - 0.2;
  for (const sx of [-1, 1]) {
    b.add(cyl(0.055, 0.065, eaveF, 8), 'woodDark', { p: [sx * W / 2, eaveF / 2, front], c: 0xffffff });
    b.add(cyl(0.055, 0.065, eaveB, 8), 'woodDark', { p: [sx * W / 2, eaveB / 2, back], c: 0xffffff });
    b.add(cyl(0.05, 0.05, ridgeY - eaveF + 0.1, 8), 'woodDark', { p: [sx * W / 2, (ridgeY + eaveF) / 2, zr], c: 0xffffff });
  }
  b.add(cyl(0.05, 0.05, W + 0.4, 8), 'woodDark', { p: [0, ridgeY, zr], r: [0, 0, PI / 2], c: 0xffffff });
  for (const sx of [-1, 1]) b.add(sphere(0.08, 8, 6), 'gold', { p: [sx * (W / 2 + 0.22), ridgeY, zr], c: 0xffffff });
  const slope = (z0, y0, z1, y1) => {
    const L = Math.hypot(z1 - z0, y1 - y0), a = Math.atan2(y0 - y1, z1 - z0);
    b.add(card(W + 0.3, L, 6, 3), canopy, { p: [0, (y0 + y1) / 2, (z0 + z1) / 2], r: [-PI / 2 + a, 0, 0], uv: 'keep', us: [1.2, 0.6], c: 0xffffff, w: (xx, yy, zz) => [0, 0, 0, 0.035 * Math.abs(zz - z0) / Math.abs(z1 - z0)] });
  };
  slope(zr, ridgeY, zf, eaveF - 0.05);
  slope(zr, ridgeY, zb, eaveB - 0.05);
  // scalloped valance along the front edge, alternating colours
  for (let i = 0; i < 9; i++) {
    const x = -W / 2 - 0.1 + (i + 0.5) * ((W + 0.2) / 9);
    b.add(new THREE.CircleGeometry(0.19, 10, PI, PI), 'clothWind', { p: [x, eaveF - 0.06, zf + 0.01], uv: 'keep', c: i % 2 ? '#efe0bf' : (canopy === 'canopyRed' ? '#a3362a' : '#2e4a92'), w: [0, 0, 0, 0.03] });
  }
  // pennant on the ridge
  b.add(cyl(0.02, 0.02, 0.8, 6), 'woodDark', { p: [0, ridgeY + 0.4, zr], c: 0xffffff });
  b.add(new THREE.CircleGeometry(0.3, 3), 'clothWind', { p: [0.22, ridgeY + 0.62, zr], r: [0, 0, 0], uv: 'keep', c: canopy === 'canopyRed' ? '#c8a040' : '#e8c060', w: (xx) => [0, 0.02, 0, 0.08 * Math.max(0, xx)] });
  lan.push({ p: [0, eaveF + 0.25, 0.2], len: 0.3, color: 'yellow', scale: 1.0 });
  // goods
  const R = (a, c) => b.r(a, c);
  if (goods === 'fruit') {
    for (let i = 0; i < 4; i++) {
      const x = -1.05 + i * 0.7;
      b.add(lathe([[0.001, 0], [0.2, 0], [0.27, 0.18], [0.25, 0.2], [0.001, 0.06]], 12), 'wood', { p: [x, 1.02, 0.4], c: '#b88a50' });
      const col = ['#c8302a', '#e8a828', '#7ab030', '#d86a28'][i];
      for (let k = 0; k < 9; k++) b.add(sphere(0.065, 8, 6), 'cloth', { p: [x + Math.cos(k * 2.1) * (k < 6 ? 0.13 : 0.05), 1.16 + (k >= 6 ? 0.07 : 0), 0.4 + Math.sin(k * 2.1) * (k < 6 ? 0.13 : 0.05)], c: col });
    }
    for (const sx of [-1, 1]) { b.add(rbox(0.6, 0.4, 0.45, 0.02), 'woodLight', { p: [sx * 1.0, 0.2, 1.2], uv: 'box', c: 0xffffff }); for (let k = 0; k < 8; k++) b.add(sphere(0.07, 8, 6), 'cloth', { p: [sx * 1.0 + (k % 4 - 1.5) * 0.13, 0.44, 1.12 + Math.floor(k / 4) * 0.15], c: sx > 0 ? '#e8c838' : '#a8c838' }); }
  } else if (goods === 'pottery') {
    const clay = ['#b8643a', '#c87a48', '#3a5a8a', '#8a4a2a', '#d8b890'];
    for (let i = 0; i < 6; i++) {
      const x = -1.15 + i * 0.46, h = R(0.3, 0.5), r = R(0.11, 0.16);
      b.add(lathe([[0.001, 0], [r * 0.7, 0], [r, h * 0.35], [r * 0.95, h * 0.6], [r * 0.45, h * 0.85], [r * 0.55, h], [r * 0.45, h], [0.001, h * 0.9]], 14), 'stone', { p: [x, 1.02, 0.4], c: clay[i % clay.length] });
    }
    for (const [x, z, s] of [[-1.25, 1.25, 1.6], [1.2, 1.3, 1.9], [0.9, 1.45, 1.2]]) b.add(lathe([[0.001, 0], [0.14, 0], [0.2, 0.18], [0.19, 0.3], [0.1, 0.42], [0.12, 0.48], [0.001, 0.46]].map(([r, h]) => [r * s, h * s]), 14), 'stone', { p: [x, 0, z], c: '#b8643a' });
  } else if (goods === 'cloth') {
    const cols = ['#2e4a92', '#8e2a2a', '#4a7a3a', '#c8a040', '#6a3a7a', '#e8dcc0'];
    for (let i = 0; i < 6; i++) for (let k = 0; k < 2 + (i % 2); k++) b.add(rbox(0.38, 0.11, 0.5, 0.03), 'cloth', { p: [-1.1 + i * 0.44, 1.08 + k * 0.115, 0.4], uv: 'box', c: cols[(i + k) % cols.length] });
    b.add(card(1.4, 1.0, 2, 3), 'carpetRed', { p: [0, 0.56, 0.885], uv: 'keep', c: 0xffffff });
    for (const [x, a] of [[-1.8, 0.2], [1.8, -0.15]]) b.add(cyl(0.12, 0.12, 1.6, 12), 'carpetBlue', { p: [x, 0.8, 0.9], r: [0, 0, a], c: 0xffffff });
  } else if (goods === 'bread') {
    for (let i = 0; i < 7; i++) b.add(lumpy(sphere(0.12, 10, 8), 0.05, 4, i), 'cloth', { p: [-1.1 + i * 0.37, 1.07, 0.35 + (i % 2) * 0.15], s: [1.5, 0.75, 0.9], uv: 'box', c: '#c88a40' });
    b.add(rbox(0.9, 0.04, 0.5, 0.02), 'woodLight', { p: [0.7, 1.03, 0.42], uv: 'box', c: '#f0d8a8' });
    for (const sx of [-1, 1]) b.add(lathe([[0.001, 0], [0.24, 0], [0.32, 0.32], [0.3, 0.34], [0.001, 0.08]], 12), 'wood', { p: [sx * 1.15, 0, 1.25], c: '#c09058' });
  } else if (goods === 'herbs') {
    for (let i = 0; i < 7; i++) addTuft(b, i % 2 ? 'lavender' : 'grassCard', [-1.2 + i * 0.4, eaveF - 0.75, zf - 0.2], 0.3, 0.5, i, 0xffffff, 2);
    for (let i = 0; i < 7; i++) b.add(cyl(0.006, 0.006, 0.3, 4), 'leather', { p: [-1.2 + i * 0.4, eaveF - 0.2, zf - 0.2], c: '#c8b890' });
    for (let i = 0; i < 5; i++) b.add(lathe([[0.001, 0], [0.08, 0], [0.09, 0.14], [0.05, 0.2], [0.06, 0.24], [0.001, 0.24]], 10), 'stone', { p: [-0.9 + i * 0.45, 1.02, 0.4], c: ['#3a6a4a', '#8a6a3a', '#5a4a7a'][i % 3] });
    for (const sx of [-1, 1]) b.add(lumpy(sphere(0.32, 10, 8), 0.06, 3, sx + 4), 'cloth', { p: [sx * 1.1, 0.28, 1.25], s: [1, 1.2, 1], uv: 'box', c: '#c8b088' });
  } else if (goods === 'lamps') {
    for (let i = 0; i < 4; i++) lanternBuilder(i % 2 ? 'yellow' : 'green', 0.6, b, [-0.95 + i * 0.63, 1.5, 0.4]);
    for (let i = 0; i < 5; i++) b.add(lathe([[0.001, 0], [0.12, 0], [0.13, 0.04], [0.06, 0.08], [0.02, 0.12], [0.001, 0.12]], 12), 'brass', { p: [-1.1 + i * 0.55, 1.02, 0.62], c: 0xffffff });
  }
  // sacks and a crate beside the stall
  b.add(lumpy(sphere(0.3, 10, 8), 0.07, 3, seed), 'cloth', { p: [-W / 2 - 0.35, 0.3, 0.2], s: [1, 1.25, 1], uv: 'box', c: '#c8b088' });
  b.add(rbox(0.55, 0.55, 0.55, 0.02), 'woodLight', { p: [W / 2 + 0.35, 0.28, -0.2], r: [0, 0.3, 0], uv: 'box', c: 0xffffff });
  return { b, lan };
}

// the Tripo market stall (tripoModels.js 'stall': counter of fruit, greens, bread and folded cloth under a scalloped red
// awning, sacks on its left, a crate of apples on its right; customers on +z like the built one), about 4.0 m across
// with its sacks and crate, 2.8 m deep, 3.15 m to the ridge. Its awning takes the stall's colour (a masked tint: only
// the red texels above the counter goods), so the blue-awning stalls stay blue.
export const STALL_GLB_S = 4.1;
const AWNING = {
  canopyRed: { fruit: null, bread: { c: '#b4502c', k: 0.7, b: 1.0 }, cloth: { c: '#9a2440', k: 0.7, b: 0.95 }, herbs: { c: '#8a3a26', k: 0.6, b: 0.95 } },
  canopyBlue: { pottery: { c: '#2e4a92', k: 0.92, b: 1.05 }, lamps: { c: '#2a6a8a', k: 0.92, b: 1.05 }, cloth: { c: '#3a3e94', k: 0.92, b: 1.0 } },
};
export function stallTint(canopy, goods) {
  const t = AWNING[canopy]?.[goods] ?? (canopy === 'canopyBlue' ? { c: '#2e4a92', k: 0.92, b: 1.05 } : null);
  return t ? { ...t, above: 0.455, red: true } : null;
}
export function stallSlot(fallback, tint, p = [0, 0, 0], ry = 0) {
  return modelSlot('stall', { p, ry, s: STALL_GLB_S, fallback, tint });
}

export function marketStreet(list) {
  const b = new Builder(51), res = newRes();
  const glb = tripoEnabled();
  list.forEach(([x, z, rot, goods, canopy], i) => {
    const y = heightAt(x, z);
    const st = stall(60 + i, goods, canopy);
    if (glb) {
      // the built stall stays as the stand-in until the model is in (and for good if it cannot load)
      const fb = st.b.build(); fb.position.set(x, y, z); fb.rotation.y = rot;
      res.dynamics.push(stallSlot(fb, stallTint(canopy, goods), [x, y, z], rot));
      return void res.colliders.push({ x, z, hw: 1.75, hd: 1.15, rot });
    }
    b.addBuilder(st.b, { p: [x, y, z], r: [0, rot, 0] });
    for (const l of st.lan) res.lanterns.push({ ...l, p: xf(l.p, x, z, rot).map((v, k) => (k === 1 ? v + y : v)) });
    const c = Math.cos(rot), s = Math.sin(rot);
    res.colliders.push({ x: x + 0 * c + 0 * s, z, hw: 1.75, hd: 1.15, rot });
  });
  res.builder = b;
  return res;
}

// ======================================================================
// FORGE WORKSHOP (local, open side +z): stone hearth, chimney, anvil, racks, grindstone, quench trough
// ======================================================================
export function forgeWorkshop() {
  const b = new Builder(52), res = newRes();
  const W = 9, D = 7, H = 3.6;
  b.add(rbox(W + 0.5, 0.5, D + 0.5, 0.05), 'stoneLarge', { p: [0, 0.15, 0], uv: 'box', c: '#d0c8b8' });
  // back and side walls (stone lower, timber-framed plaster upper on the sides), open front on posts
  b.add(box(W, H, 0.6), 'stoneLarge', { p: [0, H / 2, -D / 2 + 0.3], uv: 'box', us: 0.34, c: '#e8e0d0' });
  for (const sx of [-1, 1]) {
    b.add(box(0.5, 1.4, D - 1.2), 'stoneLarge', { p: [sx * (W / 2 - 0.25), 0.7, -0.6], uv: 'box', us: 0.34, c: '#e8e0d0' });
    b.add(box(0.36, H - 1.4, D - 1.2), 'plaster', { p: [sx * (W / 2 - 0.25), 1.4 + (H - 1.4) / 2, -0.6], uv: 'box', c: '#f0e4cc' });
    for (const z of [-3.2, -1.2, 0.8, 2.8]) b.add(box(0.42, H - 1.4, 0.2), 'beam', { p: [sx * (W / 2 - 0.25), 1.4 + (H - 1.4) / 2, z], c: 0xffffff });
    b.add(box(0.44, 0.22, D), 'beam', { p: [sx * (W / 2 - 0.25), H, 0], c: 0xffffff });
  }
  for (const x of [-W / 2 + 0.25, -1.5, 1.5, W / 2 - 0.25]) {
    b.add(box(0.3, H, 0.3), 'beam', { p: [x, H / 2, D / 2 - 0.15], c: 0xffffff });
    b.add(rbox(0.5, 0.3, 0.5, 0.04), 'stoneLarge', { p: [x, 0.15, D / 2 - 0.15], uv: 'box', c: 0xffffff });
  }
  b.add(box(W + 0.3, 0.3, 0.32), 'beam', { p: [0, H + 0.05, D / 2 - 0.15], c: 0xffffff });
  // gable roof with the ridge along x, blue slate, gables in plaster
  roofX(b, 0, 0, D + 0.2, W, 2.4, H + 0.2, { mat: 'slate', over: 0.55, ridge: 'beam' });
  for (const sx of [-1, 1]) b.add(prism(D + 0.2, 2.4, 0.3), 'plaster', { p: [sx * (W / 2 - 0.2), H + 0.2, 0], r: [0, PI / 2, 0], uv: 'box', c: '#f0e4cc' });
  // hearth: stone block with a square-headed fire mouth, glowing coals, a hood and the chimney
  const hx = -2.2, hz = -D / 2 + 1.4;
  const mouth = arcShape(1.1, 0.8, 0.45);
  const face = new THREE.Shape([new THREE.Vector2(-1.4, 0), new THREE.Vector2(1.4, 0), new THREE.Vector2(1.4, 1.3), new THREE.Vector2(-1.4, 1.3)]);
  const hole = new THREE.Path(mouth.getPoints(20).map((p) => new THREE.Vector2(p.x, p.y + 0.35)).reverse());
  face.holes.push(hole);
  b.add(extrude(face, 1.6, 0.03, 12), 'stoneLarge', { p: [hx, 0, hz - 0.8], boxuv: true, us: 0.34, c: '#c8c0b0' });
  b.add(box(1.1, 0.3, 1.4), 'stoneDark', { p: [hx, 0.32, hz - 0.1], uv: 'box', c: '#2a2220' });
  for (let i = 0; i < 9; i++) b.add(sphere(0.1, 6, 5), 'glowYellow', { p: [hx - 0.4 + (i % 3) * 0.4, 0.52, hz - 0.5 + Math.floor(i / 3) * 0.35], c: '#ff8a30' });
  res.fires.push({ p: [hx, 0.55, hz + 0.1], scale: 0.7, light: true });
  res.glows.push({ p: [hx, 0.9, hz + 0.9], color: 0xff7a30, size: 4, intensity: 0.6 });
  b.add(prism(2.8, 1.4, 1.6), 'stoneLarge', { p: [hx, 1.3, hz], uv: 'box', c: '#d8d0c0' });
  b.add(rbox(1.0, 4.6, 1.0, 0.05), 'stoneDark', { p: [hx, 4.1, hz - 0.2], uv: 'box', c: '#d8d0c0' });
  b.add(rbox(1.25, 0.25, 1.25, 0.04), 'stoneDark', { p: [hx, 6.45, hz - 0.2], uv: 'box', c: '#e8e0d0' });
  res.smokes.push({ p: [hx, 6.7, hz - 0.2], opts: { rate: 3, size: 1.2, color: 0x8a8480, opacity: 0.5 } });
  // bellows beside the hearth
  b.add(prism(0.7, 0.28, 1.0), 'leather', { p: [hx + 1.9, 0.75, hz + 0.1], r: [0, 0, PI / 2], uv: 'box', c: '#6a4a2a' });
  b.add(box(0.8, 0.06, 1.1), 'wood', { p: [hx + 1.9, 0.62, hz + 0.1], uv: 'box', c: 0xffffff });
  // the smith's corner, right of the hearth against the back wall: the Tripo smithy (tripoModels.js: brick forge with its
  // own small chimney and firebox, bellows on a frame, anvil on a stump, quench tub, tools and bars) at real size (the
  // anvil face 0.8 m over the floor), facing the open front. Until it loads (or with ?notripo=1) the built anvil, quench
  // trough and bar stock stand in for it.
  const alt = new Builder(53);
  const SM = { x: 1.75, z: -1.6, s: 2.6, y: 0.4 }; // GLB space: anvil at (-0.18, 0.31, 0.26), coals at (0.1, 0.34, -0.08)
  const glb = tripoEnabled();
  {
    const b = alt;
    // anvil on a stump, hammer and tongs
    const ax = 0.6, az = 1.2;
    b.add(cyl(0.36, 0.42, 0.6, 12), 'bark', { p: [ax, 0.3, az], uv: 'box', c: 0xffffff });
    b.add(box(0.36, 0.22, 0.26), 'iron', { p: [ax, 0.71, az], c: '#a0a8b0' });
    b.add(rbox(0.7, 0.18, 0.3, 0.03), 'iron', { p: [ax, 0.9, az], c: '#b8c0c8' });
    b.add(cone(0.12, 0.42, 10), 'iron', { p: [ax + 0.55, 0.9, az], r: [0, 0, -PI / 2], c: '#b8c0c8' });
    b.add(cyl(0.025, 0.025, 0.45, 6), 'wood', { p: [ax - 0.1, 1.02, az + 0.05], r: [0, 0.4, PI / 2], c: 0xffffff });
    b.add(box(0.12, 0.08, 0.08), 'iron', { p: [ax + 0.12, 1.02, az + 0.1], c: '#606870' });
    // quench trough
    b.add(rbox(1.4, 0.6, 0.6, 0.03), 'wood', { p: [2.6, 0.3, -1.6], uv: 'box', c: '#a07850' });
    b.add(box(1.25, 0.05, 0.46), 'wellWater', { p: [2.6, 0.55, -1.6], c: 0xffffff });
  }
  // weapon rack against the right wall: swords with disc guards, axes, a spear
  const rx = W / 2 - 0.7;
  for (const y of [0.5, 1.5]) b.add(box(0.12, 0.1, 2.6), 'woodDark', { p: [rx, y, 0.4], c: 0xffffff });
  for (const z of [-0.85, 1.65]) b.add(box(0.12, 1.7, 0.12), 'woodDark', { p: [rx, 0.85, z], c: 0xffffff });
  for (let i = 0; i < 4; i++) {
    const z = -0.5 + i * 0.6;
    b.add(box(0.03, 0.85, 0.08), 'iron', { p: [rx - 0.12, 1.15, z], r: [0, 0, -0.12], c: '#d0d8e0' });
    b.add(cyl(0.07, 0.07, 0.03, 12), 'brass', { p: [rx - 0.17, 0.72, z], r: [0, 0, PI / 2 - 0.12], c: 0xffffff });
    b.add(cyl(0.02, 0.02, 0.2, 6), 'leather', { p: [rx - 0.18, 0.6, z], r: [0, 0, -0.12], c: '#3a2616' });
  }
  for (const z of [1.9, 2.3]) {
    b.add(cyl(0.025, 0.025, 1.0, 6), 'wood', { p: [rx - 0.15, 0.95, z], r: [0, 0, -0.15], c: 0xffffff });
    b.add(box(0.03, 0.26, 0.22), 'iron', { p: [rx - 0.22, 1.4, z + 0.08], c: '#c0c8d0' });
  }
  // shields on the back wall: round with a plain boss, and a blue kite shield with a gold disc
  for (const [x, y, c] of [[-0.4, 2.4, '#8a5a32'], [0.55, 2.65, '#6a4a2a']]) { // (clear of the smithy's chimney and bellows frame)
    b.add(cyl(0.45, 0.45, 0.06, 20), 'wood', { p: [x, y, -D / 2 + 0.64], r: [PI / 2, 0, 0], c });
    b.add(torus(0.45, 0.03, 6, 20), 'iron', { p: [x, y, -D / 2 + 0.66], c: 0xffffff });
    b.add(sphere(0.1, 10, 8), 'iron', { p: [x, y, -D / 2 + 0.68], s: [1, 1, 0.6], c: '#c0c8d0' });
  }
  b.add(prism(0.9, 1.1, 0.06), 'cloth', { p: [3.3, 2.9, -D / 2 + 0.64], r: [0, 0, PI], c: '#2e4a92' });
  b.add(cyl(0.16, 0.16, 0.03, 16), 'gold', { p: [3.3, 2.6, -D / 2 + 0.68], r: [PI / 2, 0, 0], c: 0xffffff });
  // grindstone, barrels, coal heap, iron bars
  b.add(cyl(0.5, 0.5, 0.18, 20), 'stoneDark', { p: [-3.4, 0.85, 2.4], r: [0, 0, PI / 2], uv: 'box', c: '#b0a898' });
  for (const sz of [-1, 1]) b.add(box(0.1, 0.9, 0.1), 'woodDark', { p: [-3.4, 0.45, 2.4 + sz * 0.3], c: 0xffffff });
  b.add(cyl(0.03, 0.03, 0.8, 6), 'iron', { p: [-3.4, 0.85, 2.4], r: [PI / 2, 0, 0], c: 0xffffff });
  for (const [x, z] of [[3.6, 2.6], [3.0, 2.9]]) b.add(lathe([[0.001, 0], [0.28, 0], [0.33, 0.25], [0.34, 0.45], [0.33, 0.65], [0.28, 0.85], [0.001, 0.85]], 14), 'wood', { p: [x, 0, z], uv: 'box', us: 1.4, c: 0xffffff });
  for (let i = 0; i < 14; i++) b.add(ico(0.16, 0), 'stoneDark', { p: [-0.6 + (i % 5) * 0.22, 0.12 + Math.floor(i / 5) * 0.14, -2.6 + Math.floor(i / 5) * 0.08], r: [i, i * 2, 0], c: '#2a2624' });
  for (let i = 0; i < 6; i++) alt.add(box(0.9, 0.08, 0.1), 'iron', { p: [1.4, 0.3 + Math.floor(i / 3) * 0.09, -2.7 + (i % 3) * 0.12], c: '#707880' });
  // lantern under the eave and a sign banner
  res.lanterns.push({ p: [1.5, H - 0.25, D / 2 - 0.4], len: 0.3, color: 'yellow', scale: 1.1 });
  wallBanner(b, -1.5, H - 0.3, D / 2 - 0.3, 0, 0.8, 1.6, 'bannerRed');
  res.colliders.push({ x: 0, z: -D / 2 + 0.3, hw: W / 2, hd: 0.4 });
  for (const sx of [-1, 1]) res.colliders.push({ x: sx * (W / 2 - 0.25), z: -0.6, hw: 0.35, hd: (D - 1.2) / 2 });
  res.colliders.push({ x: hx, z: hz, hw: 1.5, hd: 1.0 });
  if (glb) {
    // the smithy: forge block and bellows frame along the wall, the forge's front step, the anvil stump, the quench tub
    const L = (gx, gz) => [SM.x + gx * SM.s, SM.z + gz * SM.s];
    const [bx, bz] = L(-0.045, -0.24), [fx2, fz2] = L(0.19, 0.1), [ax2, az2] = L(-0.18, 0.26), [qx, qz] = L(0.18, 0.3);
    res.colliders.push({ x: bx, z: bz, hw: 1.16, hd: 0.63 }, { x: fx2, z: fz2, hw: 0.5, hd: 0.26 }, { x: ax2, z: az2, r: 0.36 }, { x: qx, z: qz, r: 0.3 });
  } else res.colliders.push({ x: 0.6, z: 1.2, r: 0.45 }, { x: 2.6, z: -1.6, hw: 0.75, hd: 0.35 });
  res.colliders.push({ x: -3.4, z: 2.4, r: 0.5 });
  res.dynamics.push(modelSlot('smithy', { p: [SM.x, SM.y, SM.z], s: SM.s, fallback: alt.build(),
    extra: (k) => {
      // the coals in its firebox: small flames and a warm glow (the big hearth keeps the pooled light)
      const f = fire(0.2, { light: false }); f.position.set(0.1 * k, 0.335 * k, -0.07 * k);
      const gl = glowSprite(0xff7a30, 1.6, 0.5); gl.position.set(0.1 * k, 0.42 * k, 0.05 * k);
      return [f, gl];
    } }));
  res.builder = b;
  return res;
}

// ======================================================================
// WATERWHEEL (local: axle along x). Solid side discs and paddles; turns slowly.
// ======================================================================
export function waterwheel(axleY) {
  const b = new Builder(53), res = newRes();
  const R = 2.05, Wd = 1.1;
  const wb = new Builder(54);
  for (const sx of [-1, 1]) {
    const ring = new THREE.Shape(); ring.absarc(0, 0, R, 0, PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(0, 0, R - 0.32, 0, PI * 2, true); ring.holes.push(hole);
    wb.add(extrude(ring, 0.1, 0.02, 32), 'wood', { p: [sx * Wd / 2 - (sx > 0 ? 0.1 : 0), 0, 0], r: [0, PI / 2, 0], boxuv: true, c: '#a07848' });
    wb.add(cyl(0.6, 0.6, 0.12, 20), 'wood', { p: [sx * (Wd / 2 - 0.05), 0, 0], r: [0, 0, PI / 2], uv: 'box', c: '#8a6038' });
    wb.add(torus(R - 0.02, 0.04, 6, 40), 'iron', { p: [sx * (Wd / 2 + 0.02), 0, 0], r: [0, PI / 2, 0], c: 0xffffff });
  }
  wb.add(cyl(0.22, 0.22, Wd, 14), 'woodDark', { r: [0, 0, PI / 2], c: 0xffffff });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * PI * 2;
    wb.add(box(Wd - 0.1, 0.06, 0.5), 'wood', { p: [0, Math.cos(a) * (R - 0.12), Math.sin(a) * (R - 0.12)], r: [a + PI / 2, 0, 0], uv: 'box', c: '#b08858' });
  }
  const wheel = wb.build();
  const pivot = new THREE.Group();
  pivot.position.y = axleY;
  pivot.add(wheel);
  pivot.userData.update = (dt) => { pivot.rotation.x -= dt * 0.75; };
  res.dynamics.push(pivot);
  // axle through bearings on timber trestles on both banks
  b.add(cyl(0.12, 0.12, Wd + 3.2, 10), 'iron', { p: [0, axleY, 0], r: [0, 0, PI / 2], c: '#606870' });
  for (const sx of [-1, 1]) {
    const x = sx * (Wd / 2 + 1.2);
    for (const sz of [-1, 1]) b.add(box(0.22, axleY + 1.2, 0.22), 'beam', { p: [x, (axleY - 1.2) / 2, sz * 0.75], r: [sz * 0.32, 0, 0], c: 0xffffff });
    b.add(rbox(0.5, 0.36, 0.5, 0.04), 'iron', { p: [x, axleY, 0], c: '#505860' });
  }
  res.smokes.push({ p: [0, axleY - R + 0.15, 0.6], opts: { rate: 4, life: 1.6, size: 0.7, rise: 0.5, color: 0xeaf6f6, opacity: 0.3, spread: 0.6 } });
  res.builder = b;
  return res;
}

// ======================================================================
// SPRING FALLS: rock outcrop at the head of the stream with a ribbon of falling water (world coordinates)
// ======================================================================
export function fallRibbon(top, bottom, width, dir) {
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const pos = [], uv = [], idx = [];
  const N = 16, C = 6;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = new THREE.Vector3().lerpVectors(top, bottom, t);
    p.y = top.y + (bottom.y - top.y) * Math.pow(t, 1.6);
    p.addScaledVector(dir, Math.sin(t * PI) * 0.35 + t * 0.3);
    for (let j = 0; j <= C; j++) {
      const s = j / C - 0.5, w = width * (1 + t * 0.35);
      const q = p.clone().addScaledVector(side, s * w).addScaledVector(dir, Math.cos(s * PI) * 0.18);
      pos.push(q.x, q.y, q.z);
      uv.push(j / C * 1.5, t * 2.2);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < C; j++) { const a = i * (C + 1) + j, c = a + C + 1; idx.push(a, c, a + 1, c, c + 1, a + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { tMap: { value: waterfallTex() }, uTime: G.time, uNight: G.night },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: /* glsl */ `
        uniform float uNight;
      uniform sampler2D tMap; uniform float uTime; varying vec2 vUv;
      void main() {
        vec4 a = texture2D(tMap, vec2(vUv.x, vUv.y - uTime * 1.1));
        vec4 b = texture2D(tMap, vec2(vUv.x * 1.3 + 0.37, vUv.y * 0.8 - uTime * 1.6));
        float edge = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.5, 1.3, vUv.x);
        gl_FragColor = vec4((mix(a.rgb, b.rgb, 0.5) * 0.92) * (1.0 - 0.8 * uNight), max(a.a, b.a) * edge * 0.9);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 3;
  return m;
}

export function springFalls() {
  const b = new Builder(55), res = newRes();
  const [sx0, sz0] = STREAM.pts[0], [sx1, sz1] = STREAM.pts[1];
  const dir = new THREE.Vector3(sx1 - sx0, 0, sz1 - sz0).normalize();
  const lvl = streamInfo(sx0, sz0).level;
  const cliff = new THREE.Vector3(sx0, 0, sz0).addScaledVector(dir, -3.2);
  const g = heightAt(cliff.x, cliff.z);
  // the outcrop: big mossy boulders stacked around a notch
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const rocks = [[0, -3.4, 3.4, 3.2, 3.0], [0, 3.4, 3.2, 3.6, 3.0], [-2.6, 0, 3.6, 2.6, 3.2], [-3.8, -2.4, 3.0, 3.8, 2.8], [-3.6, 2.6, 2.8, 3.2, 2.6], [1.2, -5.6, 2.2, 1.8, 2.0], [1.0, 5.4, 2.4, 2.0, 2.2], [-1.0, -1.6, 1.8, 3.6, 1.8], [-1.0, 1.6, 1.8, 3.4, 1.8]];
  rocks.forEach(([along, across, sx, sy, sz], i) => {
    const p = cliff.clone().addScaledVector(dir, along).addScaledVector(side, across);
    addRock(b, [p.x, g - 0.6 + sy * 0.35, p.z], [sx, sy, sz], 300 + i, { moss: 0.9 });
  });
  // smaller stones and ferns around the plunge pool
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * PI * 2, r = 3.6 + (i % 3) * 0.5;
    const p = new THREE.Vector3(sx0, 0, sz0).addScaledVector(dir, Math.cos(a) * r * 0.6 - 0.8).addScaledVector(side, Math.sin(a) * r);
    if (Math.abs(Math.sin(a)) < 0.35 && Math.cos(a) > 0) continue;
    addRock(b, [p.x, heightAt(p.x, p.z) + 0.1, p.z], [0.7, 0.5, 0.6], 320 + i, { moss: 0.7 });
    addTuft(b, 'fern', [p.x + 0.6, heightAt(p.x, p.z), p.z + 0.4], 0.9, 0.7, i, 0xffffff, 3);
  }
  const top = cliff.clone().addScaledVector(dir, 0.6); top.y = g + 2.9;
  const bottom = new THREE.Vector3(sx0, lvl - 0.05, sz0).addScaledVector(dir, -0.4);
  res.dynamics.push(fallRibbon(top, bottom, 1.9, dir));
  res.smokes.push({ p: [bottom.x, bottom.y + 0.2, bottom.z], opts: { rate: 5, life: 2, size: 1.0, rise: 0.6, color: 0xeaf6f6, opacity: 0.32, spread: 0.8 } });
  res.colliders.push({ x: cliff.x - dir.x * 1.5, z: cliff.z - dir.z * 1.5, r: 4.2 });
  res.builder = b;
  return res;
}

// a small cascade marker: river stones on both banks of a fall (world coordinates)
export function cascadeStones(s0) {
  const b = new Builder(56 + Math.round(s0)), res = newRes();
  const P = STREAM.pts;
  let acc = 0, at = null;
  for (let i = 0; i < P.length - 1 && !at; i++) {
    const L = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]);
    if (acc + L >= s0) { const t = (s0 - acc) / L; at = { x: P[i][0] + (P[i + 1][0] - P[i][0]) * t, z: P[i][1] + (P[i + 1][1] - P[i][1]) * t, dx: (P[i + 1][0] - P[i][0]) / L, dz: (P[i + 1][1] - P[i][1]) / L }; }
    acc += L;
  }
  if (!at) { res.builder = b; return res; }
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1, along = (Math.floor(i / 2) - 2.5) * 0.9;
    const off = side * (2.4 + (i % 3) * 0.6);
    const x = at.x + at.dx * along - at.dz * off, z = at.z + at.dz * along + at.dx * off;
    addRock(b, [x, heightAt(x, z) + 0.15, z], [0.9 + (i % 3) * 0.3, 0.6 + (i % 2) * 0.3, 0.8], 340 + i + Math.round(s0), { moss: 0.8 });
  }
  // a few stones breaking the water at the lip
  for (let i = 0; i < 4; i++) {
    const off = (i - 1.5) * 1.1, x = at.x - at.dz * off, z = at.z + at.dx * off;
    addRock(b, [x, streamInfo(x, z).level - 0.25, z], [0.45, 0.35, 0.4], 360 + i + Math.round(s0), { moss: 0.5 });
  }
  res.smokes.push({ p: [at.x + at.dx * 1.5, streamInfo(at.x, at.z).level - 0.2, at.z + at.dz * 1.5], opts: { rate: 3, life: 1.6, size: 0.8, rise: 0.4, color: 0xeaf6f6, opacity: 0.25, spread: 1.0 } });
  res.builder = b;
  return res;
}

// ======================================================================
// COTTAGES (merged): stone footing, timber-framed plaster, blue slate roof, chimney, door, shuttered windows
// ======================================================================
function cottage(seed) {
  const b = new Builder(seed), smokes = [], lan = [];
  const W = 6.2, D = 4.8, H1 = 1.0, H = 3.4, rise = 2.5;
  const tint = ['#f2e6cc', '#efe0c4', '#f4ead6', '#ead8bc'][seed % 4];
  b.add(rbox(W + 0.3, 0.4, D + 0.3, 0.05), 'stoneLarge', { p: [0, 0.1, 0], uv: 'box', c: '#d0c8b8' });
  b.add(box(W, H1, D), 'stoneLarge', { p: [0, H1 / 2, 0], uv: 'box', us: 0.34, c: '#e0d8c8' });
  b.add(box(W - 0.1, H - H1, D - 0.1), 'plaster', { p: [0, H1 + (H - H1) / 2, 0], uv: 'box', c: tint });
  // timber frame: corner posts, sill and top plates, studs, single-direction braces (never crossing)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.22, H - H1 + 0.1, 0.22), 'beam', { p: [sx * W / 2, H1 + (H - H1) / 2, sz * D / 2], c: 0xffffff });
  for (const sz of [-1, 1]) { b.add(box(W + 0.24, 0.18, 0.22), 'beam', { p: [0, H1, sz * D / 2], c: 0xffffff }); b.add(box(W + 0.24, 0.2, 0.24), 'beam', { p: [0, H, sz * D / 2], c: 0xffffff }); }
  for (const sx of [-1, 1]) { b.add(box(0.22, 0.18, D + 0.24), 'beam', { p: [sx * W / 2, H1, 0], c: 0xffffff }); b.add(box(0.24, 0.2, D + 0.24), 'beam', { p: [sx * W / 2, H, 0], c: 0xffffff }); }
  // braces on the back and the sides only, so the front stays clear for the door and windows
  for (const [x, a] of [[-1.6, 0.62], [1.6, -0.62]]) b.add(box(0.13, 2.6, 0.12), 'beam', { p: [x, H1 + (H - H1) / 2, -D / 2 - 0.05], r: [0, 0, a], c: 0xffffff });
  for (const sx of [-1, 1]) b.add(box(0.12, 2.6, 0.13), 'beam', { p: [sx * (W / 2 + 0.05), H1 + (H - H1) / 2, -0.9], r: [sx * 0.62, 0, 0], c: 0xffffff });
  // roof (ridge along x) with plaster gables and gable windows
  roofX(b, 0, 0, D, W, rise, H, { mat: 'slate', over: 0.5, ridge: 'beam' });
  for (const sx of [-1, 1]) {
    b.add(prism(D, rise, 0.24), 'plaster', { p: [sx * (W / 2 - 0.1), H, 0], r: [0, PI / 2, 0], uv: 'box', c: tint });
    // the pane stands 2 cm proud of the plaster (face at W/2+0.02) inside an open four-bar frame: nothing lies in the
    // pane's plane behind or over it (a solid dark backing board sharing the pane's outer face z-fought into stripes)
    const gx = sx * (W / 2 + 0.06), gy = H + 0.85;
    b.add(box(0.04, 0.6, 0.55), 'glassWarm', { p: [gx, gy, 0], c: 0xffffff });
    for (const sz of [-1, 1]) b.add(box(0.12, 0.6, 0.07), 'woodDark', { p: [sx * (W / 2 + 0.07), gy, sz * 0.31], c: 0xffffff });
    for (const sy of [-1, 1]) b.add(box(0.12, 0.07, 0.69), 'woodDark', { p: [sx * (W / 2 + 0.07), gy + sy * 0.335, 0], c: 0xffffff });
  }
  // door with a stone step, porch lantern
  const dx = seed % 2 ? -1.6 : 1.6;
  const ds = arcShape(1.0, 2.1, 0.5);
  b.add(extrude(ds, 0.08, 0.01, 12), 'woodDark', { p: [dx, 0.3, D / 2 + 0.02], boxuv: true, c: '#e8d0b0' });
  b.add(rbox(1.4, 0.18, 0.6, 0.04), 'stoneLarge', { p: [dx, 0.16, D / 2 + 0.35], uv: 'box', c: 0xffffff });
  b.add(torus(0.06, 0.013, 6, 12), 'gold', { p: [dx + 0.3, 1.3, D / 2 + 0.12], c: 0xffffff });
  lan.push({ p: [dx + (dx > 0 ? -0.85 : 0.85), 2.3, D / 2 + 0.45], len: 0.25, color: 'yellow', scale: 0.9 });
  b.add(box(0.05, 0.05, 0.45), 'iron', { p: [dx + (dx > 0 ? -0.85 : 0.85), 2.52, D / 2 + 0.25], c: 0xffffff });
  // windows with shutters and flower boxes
  for (const x of [-dx * 0.3, -dx * 1.5]) {
    b.add(box(0.75, 0.85, 0.06), 'glassWarm', { p: [x, 2.1, D / 2 + 0.03], c: 0xffffff });
    b.add(box(0.95, 0.1, 0.16), 'woodDark', { p: [x, 2.58, D / 2 + 0.07], c: 0xffffff });
    b.add(box(0.06, 0.85, 0.08), 'woodDark', { p: [x, 2.1, D / 2 + 0.07], c: 0xffffff });
    for (const s of [-1, 1]) b.add(box(0.36, 0.9, 0.05), 'wood', { p: [x + s * 0.6, 2.1, D / 2 + 0.1], r: [0, s * 0.3, 0], uv: 'box', c: '#5a7aa8' });
    b.add(box(0.95, 0.2, 0.26), 'wood', { p: [x, 1.55, D / 2 + 0.18], uv: 'box', c: '#c8a070' });
    addTuft(b, seed % 2 ? 'lavender' : 'flowers', [x, 1.62, D / 2 + 0.18], 0.85, 0.36, 0, 0xffffff, 2);
  }
  // chimney with smoke
  const cx = seed % 3 === 0 ? -W / 2 + 0.9 : W / 2 - 0.9;
  b.add(rbox(0.7, 2.6, 0.7, 0.04), 'stoneDark', { p: [cx, H + 1.4, -0.9], uv: 'box', c: '#e0d8c8' });
  b.add(rbox(0.85, 0.16, 0.85, 0.03), 'stoneDark', { p: [cx, H + 2.75, -0.9], uv: 'box', c: '#f0e8d8' });
  smokes.push({ p: [cx, H + 2.95, -0.9], opts: { rate: 1.2, size: 0.9 } });
  // rain barrel and a woodpile
  b.add(lathe([[0.001, 0], [0.3, 0], [0.34, 0.3], [0.33, 0.62], [0.3, 0.8], [0.001, 0.8]], 14), 'wood', { p: [W / 2 + 0.45, 0, D / 2 - 0.4], uv: 'box', us: 1.4, c: 0xffffff });
  for (let i = 0; i < 9; i++) b.add(cyl(0.11, 0.11, 0.9, 8), 'bark', { p: [-W / 2 - 0.4, 0.12 + Math.floor(i / 3) * 0.2, -1.2 + (i % 3) * 0.24 + (Math.floor(i / 3) % 2) * 0.12], r: [0, 0, PI / 2], uv: 'box', c: 0xffffff });
  return { b, smokes, lan };
}

export function cottages(list) {
  const b = new Builder(57), res = newRes();
  list.forEach(([x, z, rot], i) => {
    const y = heightAt(x, z) - 0.05;
    const c = cottage(70 + i);
    b.addBuilder(c.b, { p: [x, y, z], r: [0, rot, 0] });
    for (const sm of c.smokes) res.smokes.push({ ...sm, p: xf(sm.p, x, z, rot).map((v, k) => (k === 1 ? v + y : v)) });
    for (const l of c.lan) res.lanterns.push({ ...l, p: xf(l.p, x, z, rot).map((v, k) => (k === 1 ? v + y : v)) });
    res.colliders.push({ x, z, hw: 3.5, hd: 2.8, rot });
  });
  res.builder = b;
  return res;
}

// ======================================================================
// RANGER TRAINING RANGE: straw targets on tripods, training dummies (local)
// ======================================================================
export function archeryTarget(seed = 1) {
  const b = new Builder(seed), res = newRes();
  // a square straw bale, roped, with one plain square patch to aim at (no ringed target face, content rules)
  b.add(box(1.4, 1.3, 0.4), 'straw', { p: [0, 1.3, 0], r: [-0.12, 0, 0], uv: 'box', c: 0xffffff });
  b.add(box(0.45, 0.45, 0.04), 'cloth', { p: [0.1, 1.36, 0.21], r: [-0.12, 0, 0], c: '#a84a32' });
  for (const y of [0.85, 1.75]) b.add(box(1.44, 0.05, 0.44), 'leather', { p: [0, y, 0.055 * (1.3 - y) / 0.45], r: [-0.12, 0, 0], c: '#6a4a2a' });
  for (const [x, z, a, c] of [[-0.45, 0.25, 0.25, 0], [0.45, 0.25, -0.25, 0], [0, -0.6, 0, 1]]) b.add(cyl(0.05, 0.06, 2.2, 8), 'woodDark', { p: [x, 1.0, z], r: [c ? -0.42 : 0.12, 0, a], c: 0xffffff });
  for (const [x, y] of [[0.12, 0.08], [-0.25, -0.18], [0.3, 0.32]]) {
    b.add(cyl(0.01, 0.01, 0.5, 5), 'wood', { p: [x, 1.3 + y, 0.42], r: [PI / 2 - 0.15, 0, 0], c: 0xffffff });
    b.add(box(0.002, 0.08, 0.04), 'cloth', { p: [x, 1.3 + y + 0.03, 0.64], c: '#e8e0c8' }); // (RF.5) one flight, not two crossed
  }
  res.colliders.push({ r: 0.7 });
  res.builder = b;
  return res;
}

export function trainingDummy(seed = 1) {
  const b = new Builder(seed), res = newRes();
  b.add(cyl(0.34, 0.4, 0.3, 12), 'bark', { p: [0, 0.15, 0], uv: 'box', c: 0xffffff });
  b.add(cyl(0.07, 0.08, 1.9, 8), 'woodDark', { p: [0, 1.15, 0], c: 0xffffff });
  b.add(lumpy(sphere(0.36, 14, 10), 0.05, 3, seed), 'straw', { p: [0, 1.4, 0], s: [1, 1.55, 0.8], uv: 'box', c: 0xffffff });
  b.add(lumpy(sphere(0.21, 12, 9), 0.04, 3, seed + 1), 'straw', { p: [0, 2.1, 0], uv: 'box', c: '#e8d090' });
  b.add(torus(0.28, 0.03, 6, 16), 'leather', { p: [0, 1.2, 0], r: [PI / 2, 0, 0], s: [1, 0.8, 1], c: '#6a4a2a' });
  b.add(torus(0.12, 0.025, 6, 14), 'leather', { p: [0, 1.95, 0], r: [PI / 2, 0, 0], c: '#c8b890' });
  // short arm stubs angled downward (never a horizontal crossbar)
  for (const sx of [-1, 1]) b.add(cyl(0.07, 0.06, 0.5, 8), 'straw', { p: [sx * 0.38, 1.55, 0], r: [0, 0, sx * 0.95], uv: 'box', c: '#d8c080' });
  b.add(card(0.5, 0.6, 1, 2), 'cloth', { p: [0, 1.35, 0.3], uv: 'keep', c: '#8a3a2a' });
  res.colliders.push({ r: 0.45 });
  res.builder = b;
  return res;
}
