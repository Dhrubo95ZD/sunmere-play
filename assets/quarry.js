// Ironcliff Quarry props: timber derrick cranes, scaffolds against the cut walls, stacks of cut stone,
// canvas work tents and a tool rack (shovels and mallets).
import * as THREE from 'three';
import { Builder, box, rbox, cyl, cone, sphere, torus, card, prism, lumpy } from './kit.js';
import { addRock } from './trees.js';

const PI = Math.PI;

// a rope (thin cylinder) between two points
function rope(b, a, c, r = 0.02, mat = 'leather', col = '#c8b890') {
  const A = new THREE.Vector3(...a), C = new THREE.Vector3(...c);
  const mid = A.clone().add(C).multiplyScalar(0.5), L = A.distanceTo(C);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), C.clone().sub(A).normalize());
  b.add(cyl(r, r, L, 5), mat, { p: [mid.x, mid.y, mid.z], q, c: col });
}

// derrick crane: a mast braced by two back legs, a boom reaching out over +z with a hook block (local)
export function derrick(seed = 1) {
  const b = new Builder(seed);
  const H = 8.5, boomL = 9, boomA = 0.55;
  b.add(rbox(1.4, 0.4, 1.4, 0.05), 'stoneLarge', { p: [0, 0.2, 0], uv: 'box', c: 0xffffff });
  b.add(cyl(0.18, 0.22, H, 10), 'beam', { p: [0, H / 2, 0], c: 0xffffff });
  for (const sx of [-1, 1]) {
    const foot = [sx * 3.2, 0, -3.6], top = [0, H - 0.4, 0];
    rope(b, foot, top, 0.13, 'beam', '#ffffff');
    b.add(rbox(0.8, 0.5, 0.8, 0.05), 'stoneLarge', { p: [foot[0], 0.25, foot[2]], uv: 'box', c: 0xffffff });
  }
  // boom pivoting at the mast foot, tip held by a rope from the mast head
  const tip = [0, 1.2 + Math.sin(boomA) * boomL, Math.cos(boomA) * boomL];
  rope(b, [0, 1.2, 0.2], tip, 0.14, 'beam', '#ffffff');
  rope(b, [0, H, 0], tip, 0.025);
  // winch drum at the mast foot
  b.add(cyl(0.3, 0.3, 0.8, 12), 'wood', { p: [0, 0.9, -0.6], r: [0, 0, PI / 2], uv: 'box', c: 0xffffff });
  for (const sx of [-1, 1]) b.add(box(0.1, 1.0, 0.6), 'beam', { p: [sx * 0.5, 0.6, -0.6], c: 0xffffff });
  b.add(cyl(0.025, 0.025, 0.5, 6), 'iron', { p: [0.72, 0.9, -0.6], r: [0, 0, PI / 2], c: 0xffffff });
  // hook block and a slung stone
  const hy = tip[1] - 4.2;
  rope(b, tip, [0, hy + 0.3, tip[2]], 0.02);
  b.add(rbox(0.3, 0.4, 0.2, 0.04), 'iron', { p: [0, hy + 0.15, tip[2]], c: '#606870' });
  rope(b, [0, hy, tip[2]], [-0.5, hy - 0.7, tip[2] - 0.3], 0.018); rope(b, [0, hy, tip[2]], [0.5, hy - 0.7, tip[2] + 0.3], 0.018);
  b.add(rbox(1.3, 0.7, 0.9, 0.06), 'stoneLarge', { p: [0, hy - 1.05, tip[2]], uv: 'box', c: '#e8e0d0' });
  return { builder: b, collider: { r: 1.0 } };
}

// timber scaffold with two plank decks and a ladder (local, against a wall on -z)
export function scaffold(seed = 2, w = 5, h = 4.2) {
  const b = new Builder(seed);
  for (const x of [-w / 2, 0, w / 2]) for (const z of [0, 1.4]) b.add(box(0.14, h, 0.14), 'beam', { p: [x, h / 2, z], c: 0xffffff });
  for (const y of [h * 0.48, h]) {
    b.add(box(w + 0.3, 0.08, 1.6), 'woodLight', { p: [0, y, 0.7], uv: 'box', c: '#d8c098' });
    b.add(box(w + 0.2, 0.08, 0.08), 'beam', { p: [0, y + 0.9, 1.4], c: 0xffffff });
  }
  for (const x of [-w / 4, w / 4]) b.add(box(0.1, Math.hypot(h * 0.48, w / 2), 0.08), 'beam', { p: [x, h * 0.24, 1.42], r: [0, 0, x < 0 ? 0.9 : -0.9], c: 0xffffff });
  // ladder
  for (const sx of [-0.22, 0.22]) b.add(box(0.06, h * 0.52, 0.06), 'wood', { p: [w / 2 + 0.5 + sx, h * 0.25, 1.5], r: [0.12, 0, 0], c: 0xffffff });
  for (let i = 0; i < 7; i++) b.add(box(0.44, 0.04, 0.04), 'wood', { p: [w / 2 + 0.5, 0.25 + i * 0.3, 1.5 - i * 0.035], c: 0xffffff });
  // tools and a bucket on the deck
  b.add(cyl(0.16, 0.13, 0.28, 10), 'wood', { p: [-1.2, h * 0.48 + 0.18, 0.6], uv: 'box', c: 0xffffff });
  return { builder: b, colliders: [{ x: 0, z: 0.7, hw: w / 2 + 0.3, hd: 0.9 }] };
}

// stack of cut stone blocks (local)
export function stoneStack(seed = 3) {
  const b = new Builder(seed);
  const n = 5 + (seed % 3);
  for (let i = 0; i < n; i++) {
    const layer = i < 3 ? 0 : i < 5 ? 1 : 2, k = i - [0, 3, 5][layer];
    const x = (k - (layer === 0 ? 1 : layer === 1 ? 0.5 : 0)) * 1.25, y = 0.35 + layer * 0.7;
    b.add(rbox(1.2, 0.68, 0.85, 0.05), 'stoneLarge', { p: [x + b.r(-0.05, 0.05), y, b.r(-0.08, 0.08)], r: [0, b.r(-0.06, 0.06), 0], uv: 'box', c: '#ece4d4' });
  }
  for (let i = 0; i < 6; i++) b.add(sphere(0.08, 5, 4), 'stoneDark', { p: [b.r(-1.8, 1.8), 0.04, b.r(-0.9, 0.9)], c: '#a8a090' });
  return { builder: b, collider: { r: 1.9 } };
}

// canvas work tent: ridge pole, sloped canvas, open front (local, opening on +z)
export function workTent(seed = 4, color = '#e8dcc0') {
  const b = new Builder(seed);
  const W = 3.2, D = 3.6, H = 2.6;
  for (const z of [-D / 2, D / 2]) b.add(cyl(0.05, 0.05, H, 8), 'woodDark', { p: [0, H / 2, z], c: 0xffffff });
  b.add(cyl(0.045, 0.045, D + 0.4, 8), 'woodDark', { p: [0, H, 0], r: [PI / 2, 0, 0], c: 0xffffff });
  const ang = Math.atan2(H - 0.2, W / 2), L = Math.hypot(W / 2, H - 0.2);
  for (const sx of [-1, 1]) b.add(card(D + 0.2, L, 6, 3), 'clothWind', { p: [sx * W / 4, (H + 0.2) / 2, 0], r: [0, PI / 2, sx * (PI / 2 - ang)], uv: 'keep', c: color, w: [0, 0, 0, 0.03] });
  b.add(prism(W, H - 0.2, 0.04), 'clothWind', { p: [0, 0.2, -D / 2], uv: 'box', c: color });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(cone(0.04, 0.3, 5), 'wood', { p: [sx * (W / 2 + 0.3), 0.1, sz * (D / 2 - 0.2)], r: [PI, 0, 0], c: 0xffffff });
  // bedroll and a crate inside
  b.add(rbox(0.7, 0.14, 1.8, 0.06), 'cloth', { p: [-0.6, 0.07, -0.2], uv: 'box', c: '#7a5a3a' });
  b.add(rbox(0.5, 0.45, 0.5, 0.02), 'woodLight', { p: [0.7, 0.23, -1.1], uv: 'box', c: 0xffffff });
  return { builder: b, colliders: [{ x: 0, z: 0, hw: W / 2 + 0.2, hd: D / 2 + 0.2 }] };
}

// tool rack with shovels and mallets leaning on a rail (local)
export function toolRack(seed = 5) {
  const b = new Builder(seed);
  for (const x of [-1.1, 1.1]) b.add(box(0.12, 1.2, 0.12), 'beam', { p: [x, 0.6, 0], c: 0xffffff });
  b.add(box(2.5, 0.1, 0.12), 'beam', { p: [0, 1.15, 0], c: 0xffffff });
  for (let i = 0; i < 5; i++) {
    const x = -0.9 + i * 0.45;
    b.add(cyl(0.025, 0.025, 1.3, 6), 'wood', { p: [x, 0.62, 0.12], r: [0.18, 0, 0], c: 0xffffff });
    if (i % 2) b.add(box(0.2, 0.26, 0.02), 'iron', { p: [x, 0.05, 0.22], r: [0.18, 0, 0], c: '#9098a0' });
    else b.add(cyl(0.08, 0.08, 0.24, 10), 'wood', { p: [x, 1.25, 0.0], r: [0, 0, PI / 2], c: '#9a7048' });
  }
  return { builder: b, collider: { r: 1.2 } };
}

// pile of broken rock and ore
export function rubble(seed = 6) {
  const b = new Builder(seed);
  for (let i = 0; i < 7; i++) addRock(b, [b.r(-1.4, 1.4), 0.1, b.r(-1.1, 1.1)], [b.r(0.4, 0.8), b.r(0.3, 0.6), b.r(0.4, 0.7)], seed * 13 + i, { moss: 0.1, tint: i % 3 ? '#ffffff' : '#c8a088' });
  return { builder: b, collider: { r: 1.5 } };
}
