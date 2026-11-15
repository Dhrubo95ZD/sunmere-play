// Village life props for the first zone (Sunmere Village, Brightfield and the roads between): small things that make the
// place look lived in. Every builder here uses materials the scatter already batches, so placing many of them through
// W.scatter costs no extra draw calls (one BatchedMesh per material). Rules kept: no crossbars on poles (banners hang from
// the pole itself), solid-disc wheels, a wind engine with five broad boards on a solid hub, faceless and animal-free.
import * as THREE from 'three';
import { Builder, rbox, box, cyl, cone, sphere, torus, lathe, card, lumpy, sstep } from './kit.js';
import { addRock, addTuft } from './trees.js';
import { IS_MOBILE } from '../engine/platform.js';
import { SETTINGS } from '../engine/settings.js';

const PI = Math.PI;

// a banner tied down the side of a single pole (no crossbar of any kind), with a round finial
export function flagPost(seed = 1, mat = 'bannerSun', h = 5.6) {
  const b = new Builder(seed);
  b.add(rbox(0.6, 0.35, 0.6, 0.05), 'stoneLarge', { p: [0, 0.15, 0], uv: 'box', c: '#efe6d6' });
  b.add(cyl(0.06, 0.075, h, 10), 'woodDark', { p: [0, h / 2 + 0.15, 0], c: 0xffffff });
  for (const y of [0.45, h - 0.15]) b.add(torus(0.085, 0.022, 6, 12), 'gold', { p: [0, y, 0], r: [PI / 2, 0, 0], c: 0xffffff });
  b.add(sphere(0.11, 10, 8), 'gold', { p: [0, h + 0.25, 0], c: 0xffffff });
  // the banner hangs from two rings on the pole and flutters more toward its free edge
  const top = h - 0.2, bw = 1.1, bh = 2.8;
  for (const y of [top - 0.1, top - bh * 0.55]) b.add(torus(0.08, 0.016, 5, 10), 'gold', { p: [0, y, 0], r: [PI / 2, 0, 0], c: 0xffffff });
  b.add(card(bw, bh, 4, 9), mat, { p: [bw / 2 + 0.07, top - bh / 2, 0], uv: 'keep', c: 0xffffff, w: (x, y) => [0, 0.02, 0, 0.16 * sstep(0.1, bw + 0.1, x)] });
  return { builder: b, collider: { r: 0.35 } };
}

// a coopered barrel (local, standing), optionally with a lid of produce
function barrelInto(b, x, z, s = 1, top = null, lying = false) {
  const prof = [[0.001, 0], [0.3, 0], [0.35, 0.22], [0.36, 0.45], [0.35, 0.68], [0.3, 0.9], [0.001, 0.9]].map(([r, y]) => [r * s, y * s]);
  const o = lying ? { p: [x, 0.36 * s, z - 0.45 * s], r: [PI / 2, 0, 0] } : { p: [x, 0, z] };
  b.add(lathe(prof, 14), 'wood', { ...o, uv: 'box', us: 1.4, c: '#d8b088' });
  if (!lying) {
    for (const y of [0.14, 0.45, 0.76]) b.add(torus(0.35 * s * (y === 0.45 ? 1.02 : 0.95), 0.018 * s, 5, 18), 'iron', { p: [x, y * s, z], r: [PI / 2, 0, 0], c: 0xffffff });
    if (top) for (let k = 0; k < 7; k++) { const a = k * 0.9; b.add(sphere(0.075 * s, 8, 6), 'cloth', { p: [x + Math.cos(a) * 0.16 * s * (k % 3 ? 1 : 0.3), 0.93 * s + (k % 2) * 0.05, z + Math.sin(a) * 0.16 * s * (k % 3 ? 1 : 0.3)], c: top }); }
  }
}

export function barrels(seed = 1, n = 3) {
  const b = new Builder(seed);
  const spots = [[0, 0], [0.72, 0.18], [0.3, 0.72], [-0.6, 0.5]];
  const tops = ['#d84a3a', null, '#e8b030', '#8ac040'];
  for (let i = 0; i < n; i++) barrelInto(b, spots[i][0], spots[i][1], 1 - (i % 2) * 0.1, tops[(i + seed) % 4]);
  if (seed % 2) barrelInto(b, -0.9, -0.5, 0.9, null, true);
  return { builder: b, collider: { r: 0.85 } };
}

// a heap of grain sacks
export function sacks(seed = 1, n = 6) {
  const b = new Builder(seed);
  for (let i = 0; i < n; i++) {
    const layer = i < 4 ? 0 : 1, x = layer ? (i - 4.5) * 0.5 : (i - 1.5) * 0.5, z = layer ? 0.05 : (i % 2) * 0.14;
    b.add(lumpy(sphere(0.3, 10, 8), 0.05, 3, seed + i), 'cloth', { p: [x, 0.2 + layer * 0.34, z], s: [1.05, 0.72, 0.85], r: [0, b.r(-0.4, 0.4), 0], uv: 'box', c: i % 3 ? '#e2d4b4' : '#cdb894' });
    b.add(cyl(0.06, 0.09, 0.1, 6), 'cloth', { p: [x + 0.26, 0.24 + layer * 0.34, z], r: [0, 0, PI / 2], c: '#bfa880' });
  }
  return { builder: b, collider: { r: 0.9 } };
}

// baskets of produce on the ground beside a stall
export function baskets(seed = 1) {
  const b = new Builder(seed);
  const cols = [['#d84a3a', '#e86a3a'], ['#8ac040', '#5a9a30'], ['#e8b030', '#f0c850'], ['#7a3a8a', '#9a5aa8']];
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.62, z = (i % 2) * 0.22, c = cols[(i + seed) % 4];
    b.add(lathe([[0.001, 0], [0.2, 0], [0.27, 0.22], [0.29, 0.3], [0.001, 0.3]], 12), 'straw', { p: [x, 0, z], uv: 'box', c: '#c89a58' });
    b.add(torus(0.28, 0.025, 5, 16), 'straw', { p: [x, 0.3, z], r: [PI / 2, 0, 0], c: '#a87a40' });
    for (let k = 0; k < 7; k++) { const a = k * 0.9 + i; const rr = k % 3 ? 0.14 : 0.03; b.add(sphere(0.075, 8, 6), 'cloth', { p: [x + Math.cos(a) * rr, 0.32 + (k % 2) * 0.05, z + Math.sin(a) * rr], c: c[k % 2] }); }
  }
  return { builder: b };
}

// a crate stack with goods: a slatted crate of fruit, a closed crate, a bolt of cloth
export function goodsPile(seed = 1) {
  const b = new Builder(seed);
  b.add(rbox(0.7, 0.5, 0.55, 0.03), 'woodLight', { p: [0, 0.25, 0], uv: 'box', c: 0xffffff });
  for (const sy of [-1, 1]) b.add(box(0.74, 0.06, 0.06), 'woodDark', { p: [0, 0.25 + sy * 0.17, 0.29], c: 0xffffff });
  for (let k = 0; k < 8; k++) b.add(sphere(0.08, 8, 6), 'cloth', { p: [-0.24 + (k % 4) * 0.16, 0.53, -0.1 + Math.floor(k / 4) * 0.2], c: ['#d84a3a', '#e8b030', '#8ac040', '#c86a2a'][(k + seed) % 4] });
  b.add(rbox(0.6, 0.6, 0.6, 0.03), 'woodDark', { p: [0.72, 0.3, -0.12], r: [0, 0.3, 0], uv: 'box', c: 0xffffff });
  b.add(cyl(0.16, 0.16, 0.9, 12), 'cloth', { p: [0.68, 0.76, -0.12], r: [0, 0.3, PI / 2], c: ['#3a5a9a', '#8e2a2a', '#4a6a2a'][seed % 3] });
  return { builder: b, collider: { r: 0.8 } };
}

// a washing line between two single poles, with plain cloths and shirts hanging (they flutter in the wind)
export function laundryLine(seed = 1, len = 5) {
  const b = new Builder(seed);
  for (const sx of [-1, 1]) {
    b.add(cyl(0.06, 0.07, 2.3, 8), 'beam', { p: [sx * len / 2, 1.15, 0], c: 0xffffff });
    b.add(rbox(0.3, 0.16, 0.3, 0.03), 'stoneLarge', { p: [sx * len / 2, 0.06, 0], uv: 'box', c: '#d8d0c0' });
  }
  // the line sags a little between the poles
  const sag = (x) => 2.18 - 0.18 * (1 - (2 * x / len) ** 2);
  const pts = []; for (let i = 0; i <= 12; i++) { const x = -len / 2 + (i / 12) * len; pts.push(new THREE.Vector3(x, sag(x), 0)); }
  b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.012, 4), 'leather', { uv: 'keep', c: '#d8ccb0' });
  const cols = ['#f2ece0', '#a8c0dc', '#e8d8b0', '#c86a4a', '#f2ece0', '#8aa868', '#d8c8e0'];
  let x = -len / 2 + 0.45;
  for (let i = 0; x < len / 2 - 0.4; i++) {
    const w = b.r(0.45, 0.8), h = b.r(0.5, 0.85), y = sag(x + w / 2) - h / 2 - 0.02;
    b.add(card(w, h, 2, 3), 'clothWind', { p: [x + w / 2, y, 0], r: [0, b.r(-0.1, 0.1), 0], uv: 'keep', c: cols[(i + seed) % cols.length], w: (xx, yy) => [0, 0, 0, 0.12 * sstep(y + h / 2, y - h / 2, yy)] });
    for (const px of [x + 0.05, x + w - 0.05]) b.add(box(0.03, 0.08, 0.03), 'woodLight', { p: [px, sag(px) - 0.02, 0], c: 0xffffff });
    x += w + b.r(0.12, 0.3);
  }
  addTuft(b, 'grassCard', [-len / 2, 0, 0], 0.7, 0.4, 0);
  addTuft(b, 'grassCard', [len / 2, 0, 0], 0.7, 0.4, 1);
  return { builder: b, colliders: [{ x: -len / 2, z: 0, r: 0.2 }, { x: len / 2, z: 0, r: 0.2 }] };
}

// split logs stacked against two stakes, a chopping block with a hatchet
export function woodPile(seed = 1) {
  const b = new Builder(seed);
  for (let layer = 0; layer < 4; layer++) for (let i = 0; i < 6 - (layer > 2 ? 1 : 0); i++) {
    b.add(cyl(0.12, 0.12, 0.7, 7), 'bark', { p: [-0.75 + i * 0.27 + (layer % 2) * 0.13, 0.13 + layer * 0.23, b.r(-0.05, 0.05)], r: [PI / 2, 0, b.r(-0.1, 0.1)], uv: 'box', c: 0xffffff });
  }
  for (const sx of [-1, 1]) b.add(box(0.08, 1.1, 0.08), 'beam', { p: [sx * 0.95, 0.55, 0], c: 0xffffff });
  b.add(cyl(0.3, 0.33, 0.5, 12), 'bark', { p: [1.6, 0.25, 0.4], uv: 'box', c: 0xffffff });
  b.add(cyl(0.29, 0.29, 0.02, 12), 'woodLight', { p: [1.6, 0.51, 0.4], c: '#e8c898' });
  b.add(cyl(0.022, 0.025, 0.55, 6), 'wood', { p: [1.55, 0.7, 0.42], r: [0.2, 0, -0.5], c: 0xffffff });
  b.add(box(0.05, 0.14, 0.2), 'iron', { p: [1.68, 0.56, 0.45], r: [0.2, 0, -0.5], c: '#9098a0' });
  for (let i = 0; i < 4; i++) b.add(box(0.1, 0.08, 0.35), 'woodLight', { p: [1.2 + b.r(-0.3, 0.6), 0.04, 0.9 + b.r(-0.2, 0.3)], r: [0, b.r(0, 3), 0], c: '#d8b888' });
  return { builder: b, collider: { r: 1.1 } };
}

// a flower tub (half barrel) or a long window-style planter box set on the ground by a wall
export function flowerTub(seed = 1) {
  const b = new Builder(seed);
  b.add(lathe([[0.001, 0], [0.34, 0], [0.4, 0.42], [0.001, 0.42]], 14), 'wood', { uv: 'box', us: 1.4, c: '#c8a070' });
  b.add(torus(0.38, 0.018, 5, 18), 'iron', { p: [0, 0.3, 0], r: [PI / 2, 0, 0], c: 0xffffff });
  for (let i = 0; i < 4; i++) addTuft(b, i % 2 ? 'flowers' : 'lavender', [Math.cos(i * 1.6) * 0.15, 0.38, Math.sin(i * 1.6) * 0.15], 0.5, 0.42, i, 0xffffff, 2);
  return { builder: b, collider: { r: 0.4 } };
}
export function planterBox(seed = 1, len = 1.8) {
  const b = new Builder(seed);
  b.add(rbox(len, 0.42, 0.45, 0.03), 'woodDark', { p: [0, 0.21, 0], uv: 'box', c: '#b08860' });
  b.add(box(len - 0.1, 0.04, 0.36), 'dirtPlain', { p: [0, 0.41, 0], uv: 'box', c: '#6a4a30' });
  for (let i = 0; i < Math.round(len / 0.45); i++) addTuft(b, i % 3 === 1 ? 'lavender' : 'flowers', [-len / 2 + 0.25 + i * 0.45, 0.4, 0], 0.5, 0.4, i * 0.7, 0xffffff, 2);
  return { builder: b, collider: { r: len * 0.45 } };
}

// a scarecrow: a single pole with a short peg on one side, an old coat and a straw hat hanging from the peg (no crossbar,
// no head and no face)
export function scarecrow(seed = 1) {
  const b = new Builder(seed);
  b.add(cyl(0.05, 0.065, 2.6, 8), 'woodDark', { p: [0, 1.3, 0], c: 0xffffff });
  b.add(cyl(0.03, 0.03, 0.45, 6), 'woodDark', { p: [0.2, 2.18, 0], r: [0, 0, -PI / 2 + 0.55], c: 0xffffff });
  const coat = ['#7a5a3a', '#5a6a7a', '#8a4a3a'][seed % 3];
  // coat body (two flaps) and drooping sleeves, hanging from the peg
  for (const sz of [-1, 1]) b.add(card(0.6, 1.05, 2, 4), 'clothWind', { p: [0.34, 1.62, sz * 0.05], r: [0, 0, 0.04], uv: 'keep', c: coat, w: (x, y) => [0, 0, 0, 0.1 * sstep(2.1, 1.1, y)] });
  for (const sz of [-1, 1]) b.add(card(0.18, 0.7, 1, 3), 'clothWind', { p: [0.34 + sz * 0.26, 1.72, 0.08 * sz], r: [0, 0, sz * 0.12], uv: 'keep', c: coat, w: (x, y) => [0, 0, 0, 0.14 * sstep(2.05, 1.3, y)] });
  b.add(box(0.36, 0.06, 0.12), 'beam', { p: [0.34, 2.12, 0], c: 0xffffff });
  // straw poking from the hem and cuffs
  addTuft(b, 'wheat', [0.34, 0.95, 0], 0.45, 0.25, 0, '#f0d890', 2);
  // the hat hangs by its brim off the peg's end, tipped toward the field
  b.add(cyl(0.34, 0.34, 0.03, 14), 'straw', { p: [0.42, 2.34, 0.02], r: [0.15, 0, -0.5], c: '#e0c070' });
  b.add(cyl(0.16, 0.2, 0.2, 12), 'straw', { p: [0.46, 2.43, 0.02], r: [0.15, 0, -0.5], c: '#d8b860' });
  addTuft(b, 'grassCard', [0, 0, 0], 0.6, 0.35, 0);
  return { builder: b, collider: { r: 0.2 } };
}

// vegetable rows: soil ridges with leafy heads (cabbages), tall stalks and low greens (local, rows along x)
// ground(lx, lz), when given, is the terrain height in the plot's own frame relative to its centre: the ridges and rails
// bend to follow it and every head, stalk and post sits on it, so a plot on a slope lies on the ground instead of half
// sinking into it (place it with W.placeObject, not the scatter)
export function vegRows(seed = 1, w = 8, d = 5, ground = null) {
  const b = new Builder(seed);
  const kinds = ['cabbage', 'stalk', 'green', 'cabbage'];
  let row = 0;
  for (let z = -d / 2 + 0.4; z < d / 2; z += 0.85, row++) {
    b.add(new THREE.BoxGeometry(w, 0.48, 0.5, Math.ceil(w * 2), 1, 1), 'dirtPlain', { p: [0, -0.12, z], uv: 'box', c: '#7a5636' }); // runs 0.3 m into the ground
    const k = kinds[(row + seed) % kinds.length];
    for (let x = -w / 2 + 0.35; x < w / 2 - 0.2; x += k === 'cabbage' ? 0.55 : 0.4) {
      const px = x + b.r(-0.06, 0.06);
      if (k === 'cabbage') b.add(lumpy(sphere(0.2, 9, 7), 0.05, 4, row * 31 + Math.round(x * 10)), 'cloth', { p: [px, 0.2, z], s: [1, 0.75, 1], uv: 'box', c: (xx, y, zz, nx, ny) => (ny > 0.6 ? [0.52, 0.8, 0.24] : [0.3, 0.55, 0.15]) });
      else if (k === 'stalk') addTuft(b, 'reed', [px, 0.1, z], 0.35, b.r(0.6, 0.8), b.r(0, 3), '#a8d070', 2);
      else addTuft(b, 'fern', [px, 0.1, z], 0.45, 0.3, b.r(0, 3), '#b8e080', 2);
    }
  }
  // a low wattle edge on the two long sides
  for (const sz of [-1, 1]) for (let x = -w / 2; x <= w / 2 + 0.01; x += w / 4) b.add(cyl(0.035, 0.04, 0.6, 5), 'woodDark', { p: [x, 0.3, sz * (d / 2 + 0.15)], c: 0xffffff });
  for (const sz of [-1, 1]) b.add(new THREE.BoxGeometry(w, 0.05, 0.04, Math.ceil(w * 2), 1, 1), 'woodLight', { p: [0, 0.45, sz * (d / 2 + 0.15)], c: '#b89870' });
  if (ground) conformTo(b, ground);
  return { builder: b };
}

// lay a builder's parts on uneven ground: long pieces (ridges, rails) bend vertex by vertex, small ones (heads, tufts,
// posts) move whole to the ground under their middle so they keep their shape
function conformTo(b, ground) {
  const bb = new THREE.Box3();
  for (const list of b.parts.values()) for (const g of list) {
    const p = g.attributes.position;
    bb.setFromBufferAttribute(p);
    if (bb.max.x - bb.min.x > 1.2 || bb.max.z - bb.min.z > 1.2) {
      for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + ground(p.getX(i), p.getZ(i)));
      g.computeVertexNormals(); // flat boxes: their faces stay flat
    } else { const dy = ground((bb.min.x + bb.max.x) / 2, (bb.min.z + bb.max.z) / 2); for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + dy); }
    p.needsUpdate = true;
  }
}

// a stack of square straw bales (Brightfield)
export function strawBales(seed = 1) {
  const b = new Builder(seed);
  const bale = (x, y, z, r) => {
    b.add(rbox(1.1, 0.5, 0.6, 0.08), 'straw', { p: [x, y + 0.25, z], r: [0, r, 0], uv: 'box', c: '#ecd27a' });
    for (const sx of [-0.28, 0.28]) b.add(box(0.03, 0.52, 0.62), 'leather', { p: [x + Math.cos(r) * sx, y + 0.25, z - Math.sin(r) * sx], r: [0, r, 0], c: '#a07040' });
  };
  bale(0, 0, 0, 0.05); bale(1.15, 0, 0.1, -0.05); bale(0.58, 0.5, 0.05, 0.12); bale(-0.3, 0, 0.75, 1.5);
  addTuft(b, 'wheat', [0.6, 0, 0.6], 0.6, 0.3, 0, '#f0d890', 2);
  return { builder: b, collider: { r: 1.1 } };
}

// a round straw bale lying on its side
export function roundBale(seed = 1) {
  const b = new Builder(seed);
  b.add(cyl(0.75, 0.75, 1.1, 18), 'straw', { p: [0, 0.75, 0], r: [PI / 2, 0, 0], uv: 'box', c: '#e4c870' });
  for (const sz of [-1, 1]) b.add(cyl(0.7, 0.7, 0.02, 18), 'straw', { p: [0, 0.75, sz * 0.56], r: [PI / 2, 0, 0], c: '#c8a850' });
  addTuft(b, 'wheat', [0.6, 0, 0.5], 0.5, 0.3, 0, '#f0d890', 2);
  return { builder: b, collider: { r: 0.85 } };
}

// a few small stones and a tuft at a road's edge
export function edgeStones(seed = 1) {
  const b = new Builder(seed);
  const n = 2 + (seed % 3);
  for (let i = 0; i < n; i++) addRock(b, [b.r(-0.6, 0.6), 0, b.r(-0.3, 0.3)], [b.r(0.14, 0.3), b.r(0.1, 0.2), b.r(0.14, 0.26)], seed * 7 + i, { moss: 0.3 });
  addTuft(b, 'grassCard', [b.r(-0.4, 0.4), 0, b.r(-0.2, 0.2)], 0.6, 0.35, b.r(0, 3));
  return { builder: b };
}

// a shallow rain puddle on a dirt track (a dark wet patch with a glossy centre)
export function puddle(seed = 1) {
  const b = new Builder(seed);
  const sx = b.r(0.7, 1.2), sz = b.r(0.45, 0.8);
  b.add(cyl(1, 1, 0.02, 20), 'dirtPlain', { p: [0, 0.015, 0], s: [sx * 1.25, 1, sz * 1.25], uv: 'box', c: '#5a4430' });
  b.add(lumpy(cyl(1, 1, 0.02, 20), 0.12, 2, seed), 'wellWater', { p: [0, 0.03, 0], s: [sx, 1, sz], c: '#c8d0d8' });
  return { builder: b };
}

// a fence run with a gate swung half open (local, along x)
export function fenceGate(seed = 1, open = 0.9) {
  const b = new Builder(seed);
  for (const sx of [-1, 1]) {
    b.add(box(0.18, 1.3, 0.18), 'beam', { p: [sx * 0.85, 0.65, 0], c: 0xffffff });
    b.add(cone(0.13, 0.2, 4), 'woodDark', { p: [sx * 0.85, 1.4, 0], r: [0, PI / 4, 0], c: 0xffffff });
    for (const y of [0.55, 1.0]) b.add(box(1.6, 0.1, 0.07), 'woodLight', { p: [sx * 1.7, y, 0.04], c: 0xffffff });
    b.add(box(0.15, 1.1, 0.15), 'beam', { p: [sx * 2.5, 0.55, 0], c: 0xffffff });
  }
  // the gate: a frame of two rails and upright slats (no diagonal brace), hung from the left post and swung open
  const g = new Builder(seed + 1);
  for (const y of [0.35, 0.95]) g.add(box(1.5, 0.09, 0.06), 'woodLight', { p: [0.78, y, 0], c: '#e0c8a0' });
  for (let i = 0; i < 5; i++) g.add(box(0.1, 0.8, 0.05), 'woodLight', { p: [0.16 + i * 0.31, 0.65, 0.04], c: '#d8c098' });
  b.addBuilder(g, { p: [-0.78, 0, 0.05], r: [0, -open, 0] });
  return { builder: b, colliders: [{ x: -1.7, z: 0, hw: 0.85, hd: 0.12 }, { x: 1.7, z: 0, hw: 0.85, hd: 0.12 }] };
}

// a wind engine for Brightfield: a stone tower with a timber gable cap and a rotor of five broad boards on a solid hub
// (placed with W.placeObject; the rotor turns slowly)
export function windEngine(seed = 1) {
  const b = new Builder(seed);
  b.add(lathe([[0.001, 0], [2.4, 0], [2.4, 0.4], [1.75, 7.6], [0.001, 7.6]], 18), 'plaster', { uv: 'box', us: 0.4, c: '#efe4d0' });
  for (const y of [0.4, 3.8]) b.add(torus(2.4 - y * 0.085, 0.07, 5, 26), 'beam', { p: [0, y, 0], r: [PI / 2, 0, 0], c: 0xffffff });
  b.add(rbox(1.0, 1.9, 0.12, 0.03), 'woodDark', { p: [0, 0.95, 2.36], r: [-0.03, 0, 0], uv: 'box', c: '#b08858' });
  for (const [y, a] of [[3.0, 0.6], [5.4, -0.9]]) b.add(rbox(0.5, 0.65, 0.1, 0.02), 'glassWarm', { p: [Math.sin(a) * (2.32 - y * 0.085), y, Math.cos(a) * (2.32 - y * 0.085)], r: [0, a, 0], c: 0xffffff });
  // gable cap: two pitched timber slopes over a plank box (no dome, no spire)
  b.add(rbox(3.6, 1.0, 3.4, 0.05), 'woodDark', { p: [0, 8.05, 0], uv: 'box', c: '#a07850' });
  for (const sx of [-1, 1]) b.add(box(2.15, 0.16, 3.9), 'shingleWood', { p: [sx * 0.95, 9.0, 0], r: [0, 0, -sx * 0.55], uv: 'box', c: '#b89070' });
  for (const sz of [-1, 1]) b.add(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-1.8, 0), new THREE.Vector2(1.8, 0), new THREE.Vector2(0, 1.1)])), 'woodDark', { p: [0, 8.55, sz * 1.7], r: [0, sz > 0 ? 0 : PI, 0], uv: 'box', c: '#a07850' });
  b.add(cyl(0.16, 0.16, 1.4, 10), 'iron', { p: [0, 8.2, 2.0], r: [PI / 2, 0, 0], c: 0xffffff });
  b.add(rbox(1.2, 0.12, 1.2, 0.03), 'beam', { p: [0, 0.06, 2.9], uv: 'box', c: 0xffffff });
  // the rotor: a solid hub disc and five broad boards with rounded ends
  const r = new Builder(seed + 1);
  r.add(cyl(1.05, 1.05, 0.35, 24), 'woodDark', { r: [PI / 2, 0, 0], c: '#8a6038' }); // broad enough to cover the boards' roots
  r.add(box(0.5, 0.5, 0.45), 'iron', { r: [0, 0, 0.3], c: 0xffffff }); // square axle cap, so the hub never reads as a disc in a ring
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2;
    r.add(rbox(1.85, 3.5, 0.08, 0.3), 'woodLight', { p: [Math.sin(a) * 2.6, Math.cos(a) * 2.6, -0.05], r: [0, 0.18, -a], order: 'ZYX', uv: 'box', c: '#efe0c4' });
    r.add(box(0.14, 3.4, 0.12), 'beam', { p: [Math.sin(a) * 2.6, Math.cos(a) * 2.6, 0.04], r: [0, 0, -a], c: 0xffffff });
  }
  const rotor = r.build({ shadow: true });
  rotor.position.set(0, 8.2, 2.75);
  rotor.userData.update = (dt) => { rotor.rotation.z -= dt * 0.55; };
  return { builder: b, dynamics: [rotor], collider: { r: 2.5 } };
}

// drifting leaves: one Points cloud that loops leaves through a region above the ground, carried by a light breeze
export function driftingLeaves(T, cx, cz, R, count = 200) {
  const q = SETTINGS.quality;
  if (IS_MOBILE || q === 'mobile' || q === 'low') count = Math.round(count * 0.35);
  const cv = document.createElement('canvas'); cv.width = cv.height = 32;
  const x = cv.getContext('2d');
  x.translate(16, 16); x.rotate(0.6);
  x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(0, 0, 13, 6, 0, 0, PI * 2); x.fill();
  x.strokeStyle = 'rgba(120,120,120,0.6)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(-12, 0); x.lineTo(12, 0); x.stroke();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), seed = new Float32Array(count);
  const tints = [[0.55, 0.7, 0.25], [0.78, 0.72, 0.28], [0.85, 0.55, 0.22], [0.45, 0.6, 0.22], [0.9, 0.78, 0.4]];
  const spawn = (i, anyY) => {
    const a = Math.random() * PI * 2, d = Math.sqrt(Math.random()) * R;
    const px = Math.cos(a) * d, pz = Math.sin(a) * d;
    const gy = T.height(cx + px, cz + pz);
    pos[i * 3] = px; pos[i * 3 + 2] = pz; pos[i * 3 + 1] = gy + (anyY ? 0.3 + Math.random() * 8 : 6 + Math.random() * 3);
  };
  for (let i = 0; i < count; i++) {
    spawn(i, true); seed[i] = Math.random() * 100;
    const t = tints[i % tints.length]; col.set(t, i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 5, 0), R + 10);
  const mat = new THREE.PointsMaterial({ size: 0.22, map: tex, vertexColors: true, transparent: true, alphaTest: 0.4, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = true;
  pts.userData.update = (dt, t) => {
    const p = geo.attributes.position.array;
    const wx = 0.55 + 0.35 * Math.sin(t * 0.13), wz = 0.25 * Math.cos(t * 0.09);
    for (let i = 0; i < count; i++) {
      const s = seed[i], k = i * 3;
      p[k] += (wx + Math.sin(t * 1.7 + s) * 0.45) * dt;
      p[k + 2] += (wz + Math.cos(t * 1.3 + s * 1.3) * 0.45) * dt;
      p[k + 1] -= (0.35 + 0.25 * Math.sin(t * 2.1 + s)) * dt;
      if (p[k] * p[k] + p[k + 2] * p[k + 2] > R * R) { spawn(i, true); continue; }
      if (p[k + 1] < T.height(cx + p[k], cz + p[k + 2]) + 0.05) spawn(i, false);
    }
    geo.attributes.position.needsUpdate = true;
  };
  return pts;
}
